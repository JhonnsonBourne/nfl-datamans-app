import os
import importlib
import inspect
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

import pandas as pd


# Candidate import names for the library. Users can override via env var NFLREADPY_MODULE.
DEFAULT_MODULE_CANDIDATES: List[str] = [
    "nflreadpy",
    "nflreadr",
]


# For each dataset key, try these function names in order until one is found.
DATASET_CANDIDATES: Dict[str, List[str]] = {
    "schedules": ["load_schedules", "schedules", "read_schedules", "load_schedule"],
    "rosters": ["load_rosters", "rosters", "read_rosters"],
    "weekly": [
        "load_weekly_player_stats",
        "load_weekly",
        "weekly_player_stats",
        "read_weekly_player_stats",
    ],
    "player_stats": ["load_player_stats", "player_stats", "read_player_stats"],
    "pbp": ["load_pbp", "pbp", "read_pbp"],
    "players": ["load_players", "players", "read_players", "load_player_ids"],
    "injuries": ["load_injuries", "injuries", "read_injuries"],
    # Additional datasets commonly provided by nflreadpy/nflreadr
    "nextgen_stats": [
        "load_nextgen_stats",
        "nextgen_stats",
        "load_ngs",
        "read_nextgen_stats",
    ],
    "participation": [
        "load_participation",
        "participation",
        "read_participation",
    ],
    "snap_counts": [
        "load_snap_counts",
        "snap_counts",
        "read_snap_counts",
    ],
    "ftn_charting": [
        "load_ftn_charting",
        "ftn_charting",
        "read_ftn_charting",
    ],
    "ff_opportunity": [
        "load_ff_opportunity",
        "ff_opportunity",
        "read_ff_opportunity",
    ],
}


def import_library(preferred: Optional[str] = None):
    """Import the nflreadpy/nflreadr module, optionally honoring a preferred name or env var.

    Resolution order:
    - preferred (argument)
    - NFLREADPY_MODULE (env var)
    - DEFAULT_MODULE_CANDIDATES list
    """
    names: List[str] = []
    if preferred:
        names.append(preferred)
    env_name = os.getenv("NFLREADPY_MODULE")
    if env_name and env_name not in names:
        names.append(env_name)
    for candidate in DEFAULT_MODULE_CANDIDATES:
        if candidate not in names:
            names.append(candidate)

    last_err: Optional[BaseException] = None
    for name in names:
        try:
            return importlib.import_module(name)
        except BaseException as exc:  # noqa: BLE001
            last_err = exc
            continue
    raise ImportError(
        f"Could not import any nflreadpy module from {names}. Last error: {last_err}"
    )


def _first_callable(module: Any, names: Iterable[str]) -> Tuple[Callable[..., Any], str]:
    for nm in names:
        func = getattr(module, nm, None)
        if callable(func):
            return func, nm
    raise AttributeError("None of the candidate function names exist on the module.")


def resolve_dataset_callable(module: Any, dataset: str) -> Tuple[Callable[..., Any], str]:
    """Return the callable and its name for a given logical dataset key."""
    if dataset not in DATASET_CANDIDATES:
        raise KeyError(
            f"Unknown dataset '{dataset}'. Options: {sorted(DATASET_CANDIDATES.keys())}"
        )
    try:
        return _first_callable(module, DATASET_CANDIDATES[dataset])
    except AttributeError:
        # Fallback: if weekly loader not present, try player_stats as a backend
        if dataset == "weekly":
            try:
                return _first_callable(module, DATASET_CANDIDATES["player_stats"])
            except AttributeError:
                pass
        # Re-raise if no fallback available
        raise


def _coerce_to_dataframe(obj: Any) -> pd.DataFrame:
    # If object already a pandas DataFrame
    if isinstance(obj, pd.DataFrame):
        return obj
    # Polars or similar: try to_pandas if available
    to_pandas = getattr(obj, "to_pandas", None)
    if callable(to_pandas):
        try:
            return to_pandas()
        except Exception:  # noqa: BLE001
            pass
    # Fall back to constructing a DataFrame
    return pd.DataFrame(obj)


def _best_seasons_param_name(func: Callable[..., Any]) -> Optional[str]:
    """Heuristically choose the parameter name for seasons/years."""
    try:
        sig = inspect.signature(func)
    except (TypeError, ValueError):
        return None
    candidates = ["seasons", "season", "years", "year"]
    for nm in candidates:
        if nm in sig.parameters:
            return nm
    return None


def call_dataset(
    module: Any,
    dataset: str,
    seasons: Optional[Iterable[int]] = None,
    **kwargs: Any,
) -> Tuple[pd.DataFrame, str]:
    """Call the appropriate function for a dataset and return (DataFrame, function_name).

    - Attempts to pass seasons/years if the target function supports it.
    - Additional kwargs are forwarded only if the function accepts them.
    """
    func, func_name = resolve_dataset_callable(module, dataset)

    call_kwargs: Dict[str, Any] = {}

    # Respect function signature
    try:
        sig = inspect.signature(func)
        param_names = set(sig.parameters.keys())
        has_var_kw = any(
            p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()
        )
    except (TypeError, ValueError):
        param_names = set()
        has_var_kw = True  # assume permissive if signature not introspectable

    # Forward seasons if provided
    if seasons is not None:
        seasons_list = list(seasons)
        pname = _best_seasons_param_name(func)
        # Only forward seasons if the function accepts a season-ish parameter
        if pname is not None:
            call_kwargs[pname] = seasons_list

    # Forward any explicitly provided kwargs that match the function signature
    for k, v in kwargs.items():
        if (param_names and k in param_names) or has_var_kw or not param_names:
            call_kwargs[k] = v

    # If the requested dataset is weekly but we fell back to a player_stats function,
    # attempt to signal "weekly" via common parameter conventions.
    if dataset == "weekly" and func_name in set(DATASET_CANDIDATES.get("player_stats", [])):
        # Prefer a boolean switch if available
        if "weekly" in param_names:
            call_kwargs["weekly"] = True
        # Otherwise try a type/level selector
        elif "stat_type" in param_names:
            call_kwargs["stat_type"] = "weekly"
        elif "type" in param_names:
            call_kwargs["type"] = "weekly"
        elif "level" in param_names:
            call_kwargs["level"] = "weekly"

    result = func(**call_kwargs)
    df = _coerce_to_dataframe(result)
    return df, func_name


def available_dataset_functions(module: Any) -> Dict[str, Optional[str]]:
    """Return which function name (if any) is available for each dataset key."""
    out: Dict[str, Optional[str]] = {}
    for key, candidates in DATASET_CANDIDATES.items():
        try:
            _, nm = _first_callable(module, candidates)
            out[key] = nm
        except Exception:  # noqa: BLE001
            out[key] = None
    return out
