# NFL Data One-Stop Shop

A modern web application for NFL statistics, player analysis, and fantasy football insights.

## CI/CD Status

![Tests](https://github.com/JhonnsonBourne/nfl-datamans-app/workflows/Tests/badge.svg)
![Performance Tests](https://github.com/JhonnsonBourne/nfl-datamans-app/workflows/Performance%20Tests/badge.svg)
![E2E Tests](https://github.com/JhonnsonBourne/nfl-datamans-app/workflows/E2E%20Tests/badge.svg)
![Code Quality](https://github.com/JhonnsonBourne/nfl-datamans-app/workflows/Code%20Quality/badge.svg)

## Architecture

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Data Source**: nflverse via nflreadpy

## Local Development

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Run the API server
uvicorn api:app --reload
# API will be available at http://localhost:8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
# Frontend will be available at http://localhost:5173
```

## Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import project in Vercel
3. Set root directory to `frontend/`
4. Set environment variable: `VITE_API_URL=<your-backend-url>`
5. Deploy

### Backend (Render)

1. Create new Web Service on Render
2. Connect GitHub repository
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn api:app --host 0.0.0.0 --port $PORT`
5. Add environment variables if needed
6. Deploy

## Features

- **Player Stats Explorer**: Advanced filtering, aggregation, and metrics
- **Player Comparison**: Side-by-side player analysis
- **Leaderboards**: Top performers by category
- **Team Stats**: Team-level aggregation and trends

## Tech Stack

### Frontend
- React 18
- React Router
- Tailwind CSS
- Axios
- Vite

### Backend
- FastAPI
- nflreadpy
- pandas
- numpy

## Data

Data is sourced from [nflverse](https://nflverse.nflverse.com/), an open-source collection of NFL data packages.
