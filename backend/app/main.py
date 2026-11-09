from pathlib import Path
from uuid import uuid4
from datetime import datetime, timezone
import math
import httpx
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import select
from .config import settings
from .db import Base, engine, get_db, SessionLocal
from .models import User, Report, Asset, WorkOrder, Threshold, Comment, AICamera
from .security import hash_pw, check_pw, token_for, current_user, roles
from .rbac import Permission, require_permissions, require_any_permission, has_permission
from .ai import classify_image, flood_score, priority, state_from_coords, weather_risk_for_state, STATE_CAPITALS, analyze_route_flood_risk
from .accuweather import get_accuweather_client
from .metmalaysia import get_metmalaysia_client
from .weatherapi import get_weatherapi_client

Base.metadata.create_all(bind=engine)
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app=FastAPI(title="Air-Eyes API", version="1.0")
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "https://air-eyes-ctrl-system2.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/uploads",
    StaticFiles(directory=settings.upload_dir),
    name="uploads"
)
VALID_ROLES={"citizen","technician","engineer","admin"}
IC_ROLES={"citizen","technician"}  # roles that require IC number

def _validate_ic(ic: str) -> str:
    """Validate and normalise Malaysian IC (MyKad): exactly 12 digits, no dashes."""
    digits = ic.replace("-","").strip()
    if digits and (len(digits)!=12 or not digits.isdigit()):
        raise HTTPException(422,"IC number must be exactly 12 digits (e.g. 990101-01-1234 or 990101011234)")
    return digits

MY_STATES=["Johor","Kedah","Kelantan","Melaka","Negeri Sembilan","Pahang","Perak","Perlis","Pulau Pinang","Sabah","Sarawak","Selangor","Terengganu","Kuala Lumpur","Putrajaya","Labuan"]

def seed():
    db=SessionLocal()
    try:
        if not db.scalar(select(User).where(User.email=="admin@example.com")):
            db.add(User(name="System Admin",email="admin@example.com",password_hash=hash_pw("Admin123!"),role="admin"))
        for k,v in {"blockage_confidence":.6,"high_flood_risk":.7}.items():
            if not db.scalar(select(Threshold).where(Threshold.key==k)): db.add(Threshold(key=k,value=v))
        
        # Seed AI Cameras
        if not db.scalar(select(AICamera)):
            db.add(AICamera(name="Smart Drain Camera A - KLCC", location="KLCC, Kuala Lumpur", latitude=3.1579, longitude=101.7123, status="green"))
            db.add(AICamera(name="Smart Drain Camera B - Pavilion", location="Pavilion, Kuala Lumpur", latitude=3.1488, longitude=101.7137, status="red"))
            db.add(AICamera(name="Smart Drain Camera C - Masjid Jamek", location="Masjid Jamek, Kuala Lumpur", latitude=3.1492, longitude=101.6961, status="green"))
        
        db.commit()
    finally: db.close()
seed()

@app.get("/")
def home(): return {"service":"Air-Eyes API","docs":"/docs"}

async def _geocode_internal(location: str) -> tuple[float, float]:
    """Helper to geocode a location string within Malaysia."""
    if not location or len(location.strip()) < 2:
        return None
    nominatim_url = "https://nominatim.openstreetmap.org/search"
    params = {"q": location, "format": "json", "limit": 1, "countrycodes": "MY"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(nominatim_url, params=params, headers={"User-Agent": "Air-Eyes-System"})
            if response.status_code == 200:
                results = response.json()
                if results and len(results) > 0:
                    return float(results[0]["lat"]), float(results[0]["lon"])
    except: pass
    return None

@app.post("/api/auth/register")
async def register(name: str=Form(...), email: str=Form(...), password: str=Form(...), ic_number: str=Form(""), iem_number: str=Form(""), department_office: str=Form(""), role: str=Form("citizen"), db: Session=Depends(get_db)):
    if db.scalar(select(User).where(User.email==email)): raise HTTPException(409,"Email already registered")
    if len(password)<8: raise HTTPException(422,"Password must be at least 8 characters")
    if role not in VALID_ROLES: raise HTTPException(422,"Invalid role")
    ic = _validate_ic(ic_number)
    if not ic: raise HTTPException(422,"IC number is required for registration")
    if db.scalar(select(User).where(User.ic_number==ic)): raise HTTPException(409,"IC number already registered")
    
    lat, lon = None, None
    if role == "technician" and department_office:
        coords = await _geocode_internal(department_office)
        if coords:
            lat, lon = coords

    u=User(name=name,email=email,password_hash=hash_pw(password),role=role,active=True,ic_number=ic,iem_number=iem_number,department_office=department_office,current_latitude=lat,current_longitude=lon)
    db.add(u);db.commit();db.refresh(u)
    return {"message":"Registration successful","user":{"id":u.id,"name":u.name,"email":u.email,"role":u.role,"state":u.state,"iem_number":u.iem_number or "","ic_number":u.ic_number or "","department_office":u.department_office or ""}}

@app.post("/api/auth/login")
def login(email: str=Form(...), password: str=Form(...), db: Session=Depends(get_db)):
    u=db.scalar(select(User).where(User.email==email))
    if not u or not u.active or not check_pw(password,u.password_hash): raise HTTPException(401,"Incorrect login")
    return {"access_token":token_for(u.id),"token_type":"bearer","user":{"id":u.id,"name":u.name,"email":u.email,"role":u.role,"state":u.state or "","iem_number":u.iem_number or "","ic_number":u.ic_number or "","department_office":u.department_office or ""}}

@app.get("/api/auth/me")
def me(u: User=Depends(current_user)): return {"id":u.id,"name":u.name,"email":u.email,"role":u.role,"state":u.state or "","iem_number":u.iem_number or "","ic_number":u.ic_number or "","department_office":u.department_office or ""}

@app.post("/api/reports")
async def create_report(description: str=Form(""), latitude: float=Form(...), longitude: float=Form(...), photo: UploadFile|None=File(None), db: Session=Depends(get_db), u: User=Depends(require_permissions(Permission.CREATE_REPORT))):
    if not (-90<=latitude<=90 and -180<=longitude<=180): raise HTTPException(422,"Invalid GPS coordinates")
    path=None
    if photo and photo.filename:
        if photo.content_type not in {"image/jpeg","image/png","image/webp"}: raise HTTPException(415,"JPG, PNG or WEBP only")
        raw=await photo.read()
        if len(raw)>settings.max_upload_mb*1024*1024: raise HTTPException(413,"Photo too large")
        ext={"image/jpeg":".jpg","image/png":".png","image/webp":".webp"}[photo.content_type]
        name=uuid4().hex+ext; Path(settings.upload_dir,name).write_bytes(raw); path="/uploads/"+name
    label,conf=classify_image(description,bool(path)); risk=flood_score(description)
    detected_state=state_from_coords(latitude,longitude)
    r=Report(citizen_id=u.id,description=description,latitude=latitude,longitude=longitude,photo_path=path,ai_label=label,ai_confidence=conf,flood_risk=risk,priority=priority(conf,risk),state=detected_state)
    db.add(r);db.commit();db.refresh(r);return report_json(r)

def report_json(r):
    return {
        "id":r.id,"citizen_id":r.citizen_id,"description":r.description,
        "latitude":r.latitude,"longitude":r.longitude,"photo_path":r.photo_path,
        "status":r.status,"ai_label":r.override_label or r.ai_label,
        "ai_confidence":r.ai_confidence,"flood_risk":r.flood_risk,"priority":r.priority,
        "risk_approved":r.risk_approved,"proof_approved":r.proof_approved,
        "fix_photo_path":r.fix_photo_path,"technician_comment":r.technician_comment or "",
        "state":r.state or "","assigned_engineer_id":r.assigned_engineer_id
    }

@app.get("/api/reports")
def reports(db: Session=Depends(get_db), u: User=Depends(require_permissions(Permission.READ_REPORT))):
    q=select(Report).order_by(Report.id.desc())
    if u.role=="citizen": q=q.where(Report.citizen_id==u.id)
    # Engineer only sees reports for their assigned state
    if u.role=="engineer" and u.state: q=q.where(Report.state==u.state)
    elif u.role=="engineer": q=q.where(Report.id==-1)  # no state assigned → see nothing
    return [report_json(r) for r in db.scalars(q).all()]

@app.patch("/api/reports/{rid}/review")
def review(rid:int, ai_label:str|None=None, maintenance_priority:int|None=None, status:str|None=None, flood_risk:float|None=None, db:Session=Depends(get_db), u:User=Depends(require_any_permission(Permission.REVIEW_REPORT, Permission.FULL_CONTROL))):
    r=db.get(Report,rid)
    if not r: raise HTTPException(404,"Report not found")
    if u.role=="engineer" and u.state and r.state and r.state!=u.state:
        raise HTTPException(403,"This report belongs to a different state")
    if ai_label is not None: r.override_label=ai_label
    if maintenance_priority is not None:
        if not 1<=maintenance_priority<=5: raise HTTPException(422,"Priority must be 1-5")
        r.priority=maintenance_priority
    if status is not None:
        if status not in {"submitted","reviewed","in_progress","engineer_approved","pending_closure","resolved","rejected"}: raise HTTPException(422,"Invalid status")
        r.status=status
    if flood_risk is not None:
        if not 0<=flood_risk<=1: raise HTTPException(422,"Flood risk must be between 0 and 1")
        r.flood_risk=flood_risk
    db.commit();return report_json(r)

@app.patch("/api/reports/{rid}/approve-risk")
def approve_risk(rid:int, flood_risk:float|None=None, db:Session=Depends(get_db), u:User=Depends(require_any_permission(Permission.REVIEW_REPORT, Permission.FULL_CONTROL))):
    if u.role not in {"engineer","admin"}: raise HTTPException(403,"Only engineers or admins can approve risk")
    r=db.get(Report,rid)
    if not r: raise HTTPException(404,"Report not found")
    if u.role=="engineer" and u.state and r.state and r.state!=u.state:
        raise HTTPException(403,"This report belongs to a different state")
    if flood_risk is not None:
        if not 0<=flood_risk<=1: raise HTTPException(422,"Flood risk must be between 0 and 1")
        r.flood_risk=flood_risk
    r.risk_approved=True
    r.assigned_engineer_id=u.id
    r.status="engineer_approved"
    db.commit();return report_json(r)

@app.patch("/api/reports/{rid}/technician-submit")
async def technician_submit(rid:int, comment:str=Form(""), file:UploadFile|None=File(None), db:Session=Depends(get_db), u:User=Depends(require_permissions(Permission.REVIEW_REPORT))):
    if u.role not in {"technician","admin"}: raise HTTPException(403,"Only technicians can submit fix reports")
    r=db.get(Report,rid)
    if not r: raise HTTPException(404,"Report not found")
    if r.status!="engineer_approved": raise HTTPException(422,"Report must be engineer-approved before technician can submit a fix")
    if file and file.filename:
        if file.content_type not in {"image/jpeg","image/png","image/webp"}: raise HTTPException(415,"JPG, PNG or WEBP only")
        raw=await file.read()
        if len(raw)>settings.max_upload_mb*1024*1024: raise HTTPException(413,"File too large")
        ext={"image/jpeg":".jpg","image/png":".png","image/webp":".webp"}[file.content_type]
        name=uuid4().hex+ext; Path(settings.upload_dir,name).write_bytes(raw); r.fix_photo_path="/uploads/"+name
    if not r.fix_photo_path: raise HTTPException(422,"A fix photo is required")
    r.technician_comment=comment
    r.status="pending_closure"
    db.commit();return report_json(r)

@app.patch("/api/reports/{rid}/approve-closure")
def approve_closure(rid:int, db:Session=Depends(get_db), u:User=Depends(require_any_permission(Permission.REVIEW_REPORT, Permission.FULL_CONTROL))):
    if u.role not in {"engineer","admin"}: raise HTTPException(403,"Only engineers or admins can approve closure")
    r=db.get(Report,rid)
    if not r: raise HTTPException(404,"Report not found")
    if r.status!="pending_closure": raise HTTPException(422,"Report must be pending closure before it can be closed")
    if u.role=="engineer" and u.state and r.state and r.state!=u.state:
        raise HTTPException(403,"This report belongs to a different state")
    r.status="resolved"; r.proof_approved=True
    db.commit();return report_json(r)

@app.get("/api/map/flood")
def flood_map(db:Session=Depends(get_db),u:User=Depends(require_permissions(Permission.READ_FLOOD_MAP))):
    return [{"id":r.id,"latitude":r.latitude,"longitude":r.longitude,"risk_score":r.flood_risk,"status":r.status,"priority":r.priority,"description":r.description,"photo_path":r.photo_path,"state":r.state or "","ai_label":r.override_label or r.ai_label} for r in db.scalars(select(Report)).all()]

@app.get("/api/reports/{rid}/comments")
def get_comments(rid:int, db:Session=Depends(get_db), u:User=Depends(current_user)):
    r=db.get(Report,rid)
    if not r: raise HTTPException(404,"Report not found")
    comments=db.scalars(select(Comment).where(Comment.report_id==rid).order_by(Comment.created_at)).all()
    return [{"id":c.id,"user_name":c.user_name,"user_role":c.user_role,"text":c.text,"created_at":c.created_at.isoformat()} for c in comments]

@app.post("/api/reports/{rid}/comments")
def post_comment(rid:int, text:str=Form(...), db:Session=Depends(get_db), u:User=Depends(current_user)):
    r=db.get(Report,rid)
    if not r: raise HTTPException(404,"Report not found")
    if not text.strip(): raise HTTPException(422,"Comment cannot be empty")
    c=Comment(report_id=rid,user_id=u.id,user_name=u.name,user_role=u.role,text=text.strip())
    db.add(c);db.commit();db.refresh(c)
    return {"id":c.id,"user_name":c.user_name,"user_role":c.user_role,"text":c.text,"created_at":c.created_at.isoformat()}

@app.get("/api/map/drainage")
def drainage_map(db:Session=Depends(get_db),u:User=Depends(require_permissions(Permission.READ_DRAINAGE_MAP))):
    return [{"id":a.id,"asset_code":a.code,"asset_type":a.asset_type,"latitude":a.latitude,"longitude":a.longitude,"condition":a.condition} for a in db.scalars(select(Asset)).all()]

@app.get("/api/admin/users")
def users(db:Session=Depends(get_db),u:User=Depends(require_permissions(Permission.READ_USER))):
    return [{"id":x.id,"name":x.name,"email":x.email,"role":x.role,"active":x.active,"state":x.state or "","iem_number":x.iem_number or "","ic_number":x.ic_number or "","department_office":x.department_office or "","last_location_update":x.last_location_update.isoformat() if x.last_location_update else None} for x in db.scalars(select(User)).all()]

@app.post("/api/admin/users")
def add_user(name:str, email:str, password:str, role:str, state:str="", iem_number:str="", ic_number:str="", department_office:str="", db:Session=Depends(get_db), u:User=Depends(require_permissions(Permission.CREATE_USER))):
    if role not in VALID_ROLES: raise HTTPException(422,"Invalid role")
    if role=="engineer" and state and state not in MY_STATES: raise HTTPException(422,"Invalid state")
    if db.scalar(select(User).where(User.email==email)): raise HTTPException(409,"Email already exists")
    ic=""
    if role in IC_ROLES:
        ic=_validate_ic(ic_number)
        if not ic: raise HTTPException(422,f"IC number is required for {role}")
        if db.scalar(select(User).where(User.ic_number==ic)): raise HTTPException(409,"IC number already registered")
    x=User(name=name,email=email,password_hash=hash_pw(password),role=role,state=state,iem_number=iem_number,ic_number=ic,department_office=department_office)
    db.add(x);db.commit();db.refresh(x)
    return {"id":x.id,"name":x.name,"email":x.email,"role":x.role,"state":x.state or "","iem_number":x.iem_number or "","ic_number":x.ic_number or "","department_office":x.department_office or ""}

@app.patch("/api/admin/users/{uid}")
def change_user(uid:int, role:str|None=None, active:bool|None=None, state:str|None=None, db:Session=Depends(get_db), u:User=Depends(require_permissions(Permission.UPDATE_USER))):
    x=db.get(User,uid)
    if not x: raise HTTPException(404,"User not found")
    if x.id==u.id: raise HTTPException(403,"Cannot modify your own account")
    if role is not None:
        if role not in VALID_ROLES: raise HTTPException(422,"Invalid role")
        x.role=role
    if active is not None: x.active=active
    if state is not None:
        if state and state not in MY_STATES: raise HTTPException(422,"Invalid state")
        x.state=state
    db.commit();return {"message":"User updated","state":x.state or ""}

@app.patch("/api/reports/{rid}/set-state")
def set_report_state(rid:int, state:str, db:Session=Depends(get_db), u:User=Depends(require_permissions(Permission.FULL_CONTROL))):
    if state not in MY_STATES: raise HTTPException(422,"Invalid state")
    r=db.get(Report,rid)
    if not r: raise HTTPException(404,"Report not found")
    r.state=state
    db.commit();return report_json(r)

@app.get("/api/weather-risk")
def weather_risk(provider: str = None, db:Session=Depends(get_db), u:User=Depends(require_permissions(Permission.READ_FLOOD_MAP))):
    from sqlalchemy import func
    results = []
    for state in MY_STATES:
        active = db.scalar(
            select(func.count()).select_from(Report)
            .where(Report.state==state)
            .where(Report.status.not_in(["resolved","rejected"]))
        ) or 0
        results.append(weather_risk_for_state(state, active, provider=provider))
    results.sort(key=lambda x: x.get("combined_risk",0), reverse=True)
    return results

@app.delete("/api/admin/users/{uid}")
def delete_user(uid:int,db:Session=Depends(get_db),u:User=Depends(require_permissions(Permission.DELETE_USER))):
    x=db.get(User,uid)
    if not x: raise HTTPException(404,"User not found")
    if x.id==u.id: raise HTTPException(403,"Cannot delete your own account")
    db.delete(x);db.commit();return {"message":"User deleted"}

@app.get("/api/admin/ai-thresholds")
def thresholds(db:Session=Depends(get_db),u:User=Depends(require_permissions(Permission.READ_THRESHOLD))):
    return {x.key:x.value for x in db.scalars(select(Threshold)).all()}

@app.put("/api/admin/ai-thresholds/{key}")
def set_threshold(key:str,value:float,db:Session=Depends(get_db),u:User=Depends(require_permissions(Permission.UPDATE_THRESHOLD))):
    if not 0<=value<=1: raise HTTPException(422,"Value must be between 0 and 1")
    x=db.scalar(select(Threshold).where(Threshold.key==key))
    if not x: x=Threshold(key=key,value=value);db.add(x)
    else: x.value=value
    db.commit();return {"key":key,"value":value}

@app.get("/api/radar/imagery")
async def get_radar_imagery(latitude: float, longitude: float, resolution: str = "1024x1024", u: User=Depends(require_permissions(Permission.READ_FLOOD_MAP))):
    """Get radar and satellite imagery for a location using AccuWeather."""
    if not settings.accuweather_api_key:
        raise HTTPException(501, "AccuWeather API key not configured")
    
    client = await get_accuweather_client()
    location_key = await client.get_location_key(latitude, longitude)
    
    if not location_key:
        raise HTTPException(404, "Could not find location for given coordinates")
    
    imagery = await client.get_radar_imagery(location_key, resolution)
    
    if not imagery:
        raise HTTPException(502, "Failed to fetch radar imagery from AccuWeather")
    
    return imagery

@app.get("/api/radar/tile")
async def get_radar_tile(zoom: int, x: int, y: int, timestamp: str | None = None, u: User=Depends(require_permissions(Permission.READ_FLOOD_MAP))):
    """Get radar tile URL for map overlay using AccuWeather."""
    if not settings.accuweather_api_key:
        raise HTTPException(501, "AccuWeather API key not configured")
    
    if not (0 <= zoom <= 18):
        raise HTTPException(422, "Zoom level must be between 0 and 18")
    
    client = await get_accuweather_client()
    tile_url = await client.get_radar_tiles(zoom, x, y, timestamp)
    
    if not tile_url:
        raise HTTPException(502, "Failed to fetch radar tile from AccuWeather")
    
    return {"tile_url": tile_url, "zoom": zoom, "x": x, "y": y}

@app.get("/api/radar/products")
async def get_radar_products(locations: bool = False, u: User=Depends(require_permissions(Permission.READ_FLOOD_MAP))):
    """List available radar products from AccuWeather."""
    if not settings.accuweather_api_key:
        raise HTTPException(501, "AccuWeather API key not configured")
    
    client = await get_accuweather_client()
    products = await client.get_radar_products(locations=locations)
    
    return {"products": products}

@app.get("/api/weather/metmalaysia/forecast")
async def get_metmalaysia_forecast(location_filter: str = None, limit: int = 100, u: User=Depends(require_permissions(Permission.READ_FLOOD_MAP))):
    """Get weather forecast from MET Malaysia Open Data API (no auth required)."""
    client = await get_metmalaysia_client()
    forecast = await client.get_open_data_forecast(location_filter=location_filter, limit=limit)
    
    if not forecast:
        raise HTTPException(502, "Failed to fetch MET Malaysia forecast")
    
    return forecast

@app.get("/api/weather/metmalaysia/warnings")
async def get_metmalaysia_warnings(u: User=Depends(require_permissions(Permission.READ_FLOOD_MAP))):
    """Get weather warnings from MET Malaysia Open Data API (no auth required)."""
    client = await get_metmalaysia_client()
    warnings = await client.get_open_data_warnings()
    
    if not warnings:
        raise HTTPException(502, "Failed to fetch MET Malaysia warnings")
    
    return warnings

@app.get("/api/weather/weatherapi/current")
async def get_weatherapi_current(location: str, aqi: bool = False, u: User=Depends(require_permissions(Permission.READ_FLOOD_MAP))):
    """Get current weather from WeatherAPI.com."""
    if not settings.weatherapi_key:
        raise HTTPException(501, "WeatherAPI.com key not configured")
    
    client = await get_weatherapi_client()
    weather = await client.get_current_weather(location, aqi=aqi)
    
    if not weather:
        raise HTTPException(502, "Failed to fetch WeatherAPI.com current weather")
    
    return weather

@app.get("/api/weather/weatherapi/forecast")
async def get_weatherapi_forecast(location: str, days: int = 7, hourly: bool = False, u: User=Depends(require_permissions(Permission.READ_FLOOD_MAP))):
    """Get weather forecast from WeatherAPI.com."""
    if not settings.weatherapi_key:
        raise HTTPException(501, "WeatherAPI.com key not configured")
    
    if not 1 <= days <= 14:
        raise HTTPException(422, "Days must be between 1 and 14")
    
    client = await get_weatherapi_client()
    forecast = await client.get_forecast(location, days=days, hourly=hourly)
    
    if not forecast:
        raise HTTPException(502, "Failed to fetch WeatherAPI.com forecast")
    
    return forecast

@app.get("/api/weather/weatherapi/radar")
async def get_weatherapi_radar(location: str, u: User=Depends(require_permissions(Permission.READ_FLOOD_MAP))):
    """Get radar imagery data from WeatherAPI.com (Pro+ plan required)."""
    if not settings.weatherapi_key:
        raise HTTPException(501, "WeatherAPI.com key not configured")
    
    client = await get_weatherapi_client()
    radar = await client.get_radar(location)
    
    if not radar:
        raise HTTPException(502, "Failed to fetch WeatherAPI.com radar")
    
    return radar

@app.get("/api/route/flood-safe")
async def get_flood_safe_route(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    db: Session = Depends(get_db),
    u: User = Depends(require_permissions(Permission.READ_FLOOD_MAP))
):
    """
    Get a route from origin to destination with flood risk analysis.
    Uses OSRM for routing and analyzes flood risk along the route based on nearby reports.
    """
    if not (-90 <= origin_lat <= 90 and -180 <= origin_lon <= 180):
        raise HTTPException(422, "Invalid origin coordinates")
    if not (-90 <= dest_lat <= 90 and -180 <= dest_lon <= 180):
        raise HTTPException(422, "Invalid destination coordinates")
    
    # Fetch route from OSRM
    osrm_url = f"{settings.osrm_api_url}/route/v1/driving/{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
    params = {
        "overview": "full",
        "geometries": "geojson"
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(osrm_url, params=params)
            if response.status_code != 200:
                raise HTTPException(502, f"OSRM routing failed: {response.status_code}")
            
            route_data = response.json()
            
            if route_data.get("code") != "Ok":
                raise HTTPException(502, f"OSRM error: {route_data.get('message', 'Unknown error')}")
            
            if not route_data.get("routes"):
                raise HTTPException(404, "No route found between these locations")
            
            route = route_data["routes"][0]
            geometry = route.get("geometry", {})
            coordinates = geometry.get("coordinates", [])  # OSRM returns [lon, lat]
            
            # Convert to [lat, lon] format for our analysis
            route_coordinates = [[coord[1], coord[0]] for coord in coordinates]
            
            # Get flood reports for risk analysis
            flood_reports = [
                {
                    "latitude": r.latitude,
                    "longitude": r.longitude,
                    "risk_score": r.flood_risk,
                    "flood_risk": r.flood_risk
                }
                for r in db.scalars(select(Report)).all()
            ]
            
            # Analyze flood risk along the route
            risk_analysis = analyze_route_flood_risk(route_coordinates, flood_reports)
            
            return {
                "route": {
                    "distance": route.get("distance", 0),  # meters
                    "duration": route.get("duration", 0),  # seconds
                    "geometry": geometry,
                    "coordinates": route_coordinates
                },
                "flood_risk_analysis": risk_analysis
            }
            
    except httpx.TimeoutException:
        raise HTTPException(504, "Routing service timeout")
    except Exception as e:
        raise HTTPException(500, f"Route calculation error: {str(e)}")

@app.get("/api/geocode")
async def geocode_location(
    location: str,
    u: User = Depends(require_permissions(Permission.READ_FLOOD_MAP))
):
    """
    Geocode a location name to coordinates using Nominatim (OpenStreetMap).
    Returns latitude and longitude for the given location name.
    """
    if not location or len(location.strip()) < 2:
        raise HTTPException(422, "Location name is required")
    
    # Use Nominatim API (free, no API key required)
    nominatim_url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": location,
        "format": "json",
        "limit": 1,
        "countrycodes": "MY"  # Restrict to Malaysia
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(nominatim_url, params=params, headers={"User-Agent": "DrainWatch-Flood-Routing"})
            if response.status_code != 200:
                raise HTTPException(502, f"Geocoding service failed: {response.status_code}")
            
            results = response.json()
            
            if not results or len(results) == 0:
                raise HTTPException(404, f"Location '{location}' not found in Malaysia")
            
            result = results[0]
            lat = float(result.get("lat"))
            lon = float(result.get("lon"))
            display_name = result.get("display_name", location)
            
            return {
                "location": location,
                "display_name": display_name,
                "latitude": lat,
                "longitude": lon
            }
            
    except httpx.TimeoutException:
        raise HTTPException(504, "Geocoding service timeout")
    except Exception as e:
        raise HTTPException(500, f"Geocoding error: {str(e)}")


@app.get("/api/technicians/nearest")
async def get_nearest_technicians(
    latitude: float,
    longitude: float,
    radius_km: float = 50,
    db: Session = Depends(get_db),
    u: User = Depends(require_permissions(Permission.READ_FLOOD_MAP))
):
    """
    Find nearest technicians to a given location.
    Returns technicians sorted by distance, within the specified radius.
    Radius is in km. Use a large radius (e.g. 3000) to find all in Malaysia.
    """
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise HTTPException(422, "Invalid coordinates")
    
    # Get all active technicians
    technicians = db.scalars(
        select(User).where(User.role == "technician").where(User.active == True)
    ).all()
    
    nearby_technicians = []
    
    for tech in technicians:
        if tech.current_latitude is None or tech.current_longitude is None:
            continue
        
        # Calculate distance using Haversine formula (simplified)
        lat_diff = tech.current_latitude - latitude
        lon_diff = tech.current_longitude - longitude
        distance_km = math.sqrt(lat_diff**2 + lon_diff**2) * 111  # Approximate km
        
        if distance_km <= radius_km:
            nearby_technicians.append({
                "id": tech.id,
                "name": tech.name,
                "latitude": tech.current_latitude,
                "longitude": tech.current_longitude,
                "distance_km": round(distance_km, 2),
                "level": tech.level,
                "points": tech.points,
                "total_reports_resolved": tech.total_reports_resolved,
                "avatar_style": tech.avatar_style,
                "department_office": tech.department_office or "",
                "last_location_update": tech.last_location_update.isoformat() if tech.last_location_update else None
            })
    
    # Sort by distance
    nearby_technicians.sort(key=lambda x: x["distance_km"])
    
    return {
        "location": {"latitude": latitude, "longitude": longitude},
        "radius_km": radius_km,
        "technicians": nearby_technicians,
        "count": len(nearby_technicians)
    }


@app.post("/api/technicians/update-location")
def update_technician_location(
    latitude: float,
    longitude: float,
    db: Session = Depends(get_db),
    u: User = Depends(current_user)
):
    """
    Update current location for a technician.
    Only technicians can update their own location.
    """
    if u.role != "technician":
        raise HTTPException(403, "Only technicians can update their location")
    
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise HTTPException(422, "Invalid coordinates")
    
    u.current_latitude = latitude
    u.current_longitude = longitude
    u.last_location_update = datetime.now(timezone.utc)
    db.commit()
    
    return {
        "message": "Location updated",
        "latitude": latitude,
        "longitude": longitude,
        "updated_at": u.last_location_update.isoformat()
    }


@app.get("/api/route/turn-by-turn")
async def get_turn_by_turn_directions(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    u: User = Depends(require_permissions(Permission.READ_FLOOD_MAP))
):
    """
    Get turn-by-turn navigation instructions using OSRM.
    Returns detailed step-by-step directions like Waze/Google Maps.
    """
    if not (-90 <= origin_lat <= 90 and -180 <= origin_lon <= 180):
        raise HTTPException(422, "Invalid origin coordinates")
    if not (-90 <= dest_lat <= 90 and -180 <= dest_lon <= 180):
        raise HTTPException(422, "Invalid destination coordinates")
    
    # Fetch route with steps from OSRM
    osrm_url = f"{settings.osrm_api_url}/route/v1/driving/{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "true"
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(osrm_url, params=params)
            if response.status_code != 200:
                raise HTTPException(502, f"OSRM routing failed: {response.status_code}")
            
            route_data = response.json()
            
            if route_data.get("code") != "Ok":
                raise HTTPException(502, f"OSRM error: {route_data.get('message', 'Unknown error')}")
            
            if not route_data.get("routes"):
                raise HTTPException(404, "No route found between these locations")
            
            route = route_data["routes"][0]
            legs = route.get("legs", [])
            
            # Extract turn-by-turn instructions
            instructions = []
            total_distance = 0
            total_duration = 0
            
            for leg in legs:
                for step in leg.get("steps", []):
                    # OSRM coordinates are [lon, lat], but Leaflet expects [lat, lon]
                    loc = step.get("maneuver", {}).get("location", [0, 0])
                    instruction = {
                        "instruction": step.get("maneuver", {}).get("type", "Continue"),
                        "modifier": step.get("maneuver", {}).get("modifier", ""),
                        "distance": step.get("distance", 0),
                        "duration": step.get("duration", 0),
                        "name": step.get("name", ""),
                        "maneuver": step.get("maneuver", {}),
                        "location": [loc[1], loc[0]] # Flip to [lat, lon]
                    }
                    instructions.append(instruction)
                    total_distance += step.get("distance", 0)
                    total_duration += step.get("duration", 0)
            
            # Convert to human-readable instructions
            readable_instructions = []
            for i, step in enumerate(instructions):
                readable_instructions.append({
                    "step": i + 1,
                    "instruction": _format_instruction(step),
                    "distance_m": step["distance"],
                    "distance": step["distance"], # alias for frontend convenience
                    "distance_text": f"{step['distance']/1000:.1f} km" if step["distance"] >= 1000 else f"{int(step['distance'])} m",
                    "duration_sec": step["duration"],
                    "duration_text": f"{int(step['duration']/60)} min" if step["duration"] >= 60 else f"{int(step['duration'])} sec",
                    "street": step["name"] or "Unnamed road",
                    "name": step["name"] or "Unnamed road", # alias
                    "location": step["location"],
                    "maneuver": step["maneuver"]
                })
            
            return {
                "route": {
                    "distance": total_distance,
                    "distance_text": f"{total_distance/1000:.1f} km",
                    "duration": total_duration,
                    "duration_text": f"{int(total_duration/60)} min",
                    # Geometry comes as [lon, lat], needs flip for Leaflet
                    "coordinates": [[c[1], c[0]] for c in route.get("geometry", {}).get("coordinates", [])]
                },
                "steps": readable_instructions # renamed from instructions to match frontend
            }
            
    except httpx.TimeoutException:
        raise HTTPException(504, "Routing service timeout")
    except Exception as e:
        raise HTTPException(500, f"Route calculation error: {str(e)}")

@app.get("/api/ai-cameras")
def get_ai_cameras(db: Session = Depends(get_db)):
    cameras = db.scalars(select(AICamera)).all()
    return [{
        "id": c.id,
        "name": c.name,
        "location": c.location,
        "latitude": c.latitude,
        "longitude": c.longitude,
        "status": c.status,
        "last_update": c.last_update.isoformat()
    } for c in cameras]

@app.post("/api/ai-cameras")
async def create_ai_camera(name: str = Form(...), location: str = Form(...), db: Session = Depends(get_db), u: User = Depends(require_permissions(Permission.MANAGE_AI_CAMERAS))):
    coords = await _geocode_internal(location)
    if not coords:
        raise HTTPException(422, "Could not geocode the provided location. Please be more specific.")
    lat, lon = coords
    c = AICamera(name=name, location=location, latitude=lat, longitude=lon)
    db.add(c); db.commit(); db.refresh(c)
    return {"message": "AI Camera registered", "id": c.id}

@app.patch("/api/ai-cameras/{cid}")
def update_ai_camera(cid: int, status: str = Form(...), db: Session = Depends(get_db), u: User = Depends(require_permissions(Permission.MANAGE_AI_CAMERAS))):
    c = db.get(AICamera, cid)
    if not c: raise HTTPException(404, "Camera not found")
    if status not in {"red", "green"}: raise HTTPException(422, "Invalid status")
    c.status = status
    c.last_update = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Status updated", "status": c.status}

@app.delete("/api/ai-cameras/{cid}")
def delete_ai_camera(cid: int, db: Session = Depends(get_db), u: User = Depends(require_permissions(Permission.MANAGE_AI_CAMERAS))):
    c = db.get(AICamera, cid)
    if not c: raise HTTPException(404, "Camera not found")
    db.delete(c); db.commit()
    return {"message": "Camera deleted"}

@app.post("/api/ai-cameras/{cid}/analyze-sam2")
async def analyze_camera_sam2(cid: int, image: UploadFile = File(...), db: Session = Depends(get_db), u: User = Depends(require_permissions(Permission.MANAGE_AI_CAMERAS))):
    """
    Simulated SAM 2 (Segment Anything Model 2) analysis endpoint.
    It takes a camera frame and returns high-precision segmentation metrics.
    """
    from .ai import segment_water_sam2
    
    c = db.get(AICamera, cid)
    if not c: raise HTTPException(404, "Camera not found")
    
    contents = await image.read()
    result = segment_water_sam2(contents)
    
    # Update camera status based on high-precision SAM 2 results
    # If SAM 2 detects > 70% water area, consider it a flood
    if result["water_area_ratio"] > 0.70:
        c.status = "red"
    else:
        c.status = "green"
    
    c.last_update = datetime.now(timezone.utc)
    db.commit()
    
    return {
        "camera_id": cid,
        "camera_name": c.name,
        "sam2_analysis": result,
        "updated_status": c.status
    }

def _format_instruction(step):
    """Convert OSRM maneuver to human-readable instruction."""
    maneuver = step.get("maneuver", {})
    instruction_type = maneuver.get("type", "continue")
    modifier = maneuver.get("modifier", "")
    street = step.get("name", "the road")
    
    if not street:
        street = "the road"
    
    instructions = {
        "turn": f"Turn {modifier} onto {street}",
        "new name": f"Continue on {street}",
        "depart": f"Head {modifier} on {street}",
        "arrive": f"You have arrived at your destination",
        "merge": f"Merge onto {street}",
        "on ramp": f"Take the ramp onto {street}",
        "off ramp": f"Take the ramp off {street}",
        "fork": f"At the fork, take the {modifier} onto {street}",
        "roundabout": f"Enter the roundabout",
        "roundabout exit": f"Exit the roundabout onto {street}",
        "end of road": f"Turn {modifier} at the end of the road",
        "continue": f"Continue on {street}",
        "notification": f"Continue"
    }
    
    base = instructions.get(instruction_type, f"Continue on {street}")
    
    if modifier and instruction_type not in ["new name", "arrive", "continue"]:
        if instruction_type == "turn":
            base = f"Turn {modifier} onto {street}"
        elif instruction_type == "depart":
            base = f"Head {modifier} on {street}"
    
    return base
