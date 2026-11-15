# Air-Eyes — Environmental Monitoring System

Full-stack MVP based on the supplied architecture and permission matrix.

**Backend:** FastAPI, SQLAlchemy, SQLite, JWT, local image uploads  
**Frontend:** React + Vite + Leaflet

## Run
Backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```
Frontend (new terminal):
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Open `http://localhost:5173`; API docs at `http://127.0.0.1:8000/docs`.

Development admin: `admin@example.com` / `Admin123!`. Change this and `SECRET_KEY` before deployment.

## Roles
- citizen: submit photo/GPS reports; read own reports; public flood map
- crew: read assigned work orders and technical drainage map; update assigned jobs; upload proof
- engineer: review/override AI labels, re-rank priority, create/assign/close work orders
- admin: manage users, assets, AI thresholds and all operational records

## Important
The AI and flood-risk functions are **demo heuristics**, not trained models or validated forecasts. The weather integration is a stub. Replace them with validated local image/flood models and an approved rainfall API before real-world use. For production, use PostgreSQL/PostGIS, Alembic migrations, object storage, HTTPS, audit logs, rate limiting, image scanning, backups, and security/privacy testing.

## Updated navigation and access boundaries
The authenticated UI now uses five primary destinations. On mobile, these appear as a fixed five-item bottom navigation bar; on larger screens they remain in the sidebar.

- **Dashboard** — overview, reports, role-specific cases, and technician leaderboard in one workspace.
- **Flood & Weather** — flood incident map and state weather-risk forecast together. State report counts are shown alongside each state's forecast risk.
- **Camera & Analysis** — camera-node streaming and multi-camera analysis (admin, engineer, technician).
- **AI Detection** — registered camera detection tools (admin, engineer, technician; management actions remain admin-only).
- **Administration / My Account** — user management for admins; account summary for other roles.

Engineers are limited to their assigned state for reports, flood-map points, weather-risk details, and report comment access. Citizens see their own reports and associated map points. Technicians see engineer-approved work awaiting action and their own pending-closure submissions. Camera data is protected by a dedicated read permission; camera management remains separately permission-gated.

## Frontend layout
- `frontend/src.jsx` — Vite entry point
- `frontend/App.jsx` — application shell, authentication, shared data loading, and shared feature components
- `frontend/pages/` — page composition components (`DashboardPage`, `FloodWeatherPage`, `CameraAnalysisPage`, `AIDetectionPage`, `AdminPage`)
- `frontend/style.css` — design system and responsive/mobile navigation styles

The project archive preserves the SQLite database files supplied with the original project. Local `.env` files, virtual environments, and `node_modules` are excluded; copy the supplied `.env.example` files and provide your own credentials/settings before running.
