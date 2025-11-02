from __future__ import annotations

import io
from typing import Dict, List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from nflread_adapter import (
    DATASET_CANDIDATES,
    available_dataset_functions,
    call_dataset,
    import_library,
)


app = FastAPI(title="NFL Data API", version="1.0.0")

# Permissive CORS for local development; tighten in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/datasets")
def list_datasets(module: Optional[str] = Query(None, description="Library override: nflreadpy or nflreadr")):
    try:
        mod = import_library(module)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Import error: {e}") from e

    funcs = available_dataset_functions(mod)
    return {"library": mod.__name__, "available": funcs}


def _parse_seasons(
    seasons: Optional[List[int]] = None,
    seasons_csv: Optional[str] = None,
) -> List[int]:
    out: List[int] = []
    if seasons:
        out.extend(seasons)
    if seasons_csv:
        for tok in seasons_csv.split(","):
            tok = tok.strip()
            if not tok:
                continue
            try:
                out.append(int(tok))
            except ValueError:
                # Ignore invalid tokens
                continue
    # Deduplicate while preserving order
    seen = set()
    unique: List[int] = []
    for y in out:
        if y not in seen:
            seen.add(y)
            unique.append(y)
    return unique


@app.get("/v1/data/{dataset}")
def get_data(
    dataset: str,
    module: Optional[str] = Query(None, description="Library override: nflreadpy or nflreadr"),
    seasons: Optional[List[int]] = Query(None, description="Repeat param, e.g. seasons=2021&seasons=2022"),
    seasons_csv: Optional[str] = Query(None, description="Comma-separated seasons, e.g. 2021,2022"),
    columns: Optional[str] = Query(None, description="Comma-separated column whitelist"),
    limit: int = Query(1000, ge=1, le=100000),
    offset: int = Query(0, ge=0),
    fmt: str = Query("json", pattern="^(json|csv)$", description="json or csv"),
):
    # Validate dataset key
    if dataset not in DATASET_CANDIDATES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown dataset '{dataset}'. Options: {sorted(DATASET_CANDIDATES.keys())}",
        )

    # Import library
    try:
        mod = import_library(module)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Import error: {e}") from e

    # Seasons
    years = _parse_seasons(seasons=seasons, seasons_csv=seasons_csv)

    # Load
    try:
        df, func_name = call_dataset(mod, dataset, seasons=years or None)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Load error: {e}") from e

    # Column selection
    if columns:
        wanted = [c.strip() for c in columns.split(",") if c.strip()]
        present = [c for c in wanted if c in df.columns]
        if present:
            df = df[present]

    # Offset and limit
    if offset:
        df = df.iloc[offset:]
    if limit:
        df = df.iloc[:limit]

    # Format
    if fmt == "json":
        # FastAPI will serialize this efficiently
        records = df.to_dict(orient="records")
        return JSONResponse(
            content={
                "library": mod.__name__,
                "function": func_name,
                "dataset": dataset,
                "count": len(records),
                "data": records,
            }
        )
    # CSV streaming
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    filename = f"{dataset}_{'_'.join(map(str, years)) if years else 'all'}.csv"
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


if __name__ == "__main__":
    # Convenience local run: uvicorn api:app --reload
    import uvicorn  # type: ignore

    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)

