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
