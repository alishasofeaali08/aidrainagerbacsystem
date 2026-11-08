from pathlib import Path
from uuid import uuid4
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import select
from .config import settings
from .db import Base, engine, get_db, SessionLocal
from .models import User, Report, Asset, WorkOrder, Threshold, Comment
from .security import hash_pw, check_pw, token_for, current_user, roles
from .rbac import Permission, require_permissions, require_any_permission, has_permission
from .ai import classify_image, flood_score, priority, state_from_coords, weather_risk_for_state, STATE_CAPITALS

Base.metadata.create_all(bind=engine)
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app=FastAPI(title="Air-Eyes API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in settings.cors_origins.split(",")], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.mount("/uploads",StaticFiles(directory=settings.upload_dir),name="uploads")
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
        db.commit()
    finally: db.close()
seed()

@app.get("/")
def home(): return {"service":"Air-Eyes API","docs":"/docs"}

@app.post("/api/auth/register")
def register(name: str=Form(...), email: str=Form(...), password: str=Form(...), ic_number: str=Form(""), iem_number: str=Form(""), db: Session=Depends(get_db)):
    if db.scalar(select(User).where(User.email==email)): raise HTTPException(409,"Email already registered")
    if len(password)<8: raise HTTPException(422,"Password must be at least 8 characters")
    ic = _validate_ic(ic_number)
    if not ic: raise HTTPException(422,"IC number is required for citizen registration")
    if db.scalar(select(User).where(User.ic_number==ic)): raise HTTPException(409,"IC number already registered")
    u=User(name=name,email=email,password_hash=hash_pw(password),role="citizen",active=True,ic_number=ic,iem_number=iem_number)
    db.add(u);db.commit();db.refresh(u)
    return {"message":"Registration successful","user":{"id":u.id,"name":u.name,"email":u.email,"role":u.role,"state":u.state,"iem_number":u.iem_number or "","ic_number":u.ic_number or ""}}

@app.post("/api/auth/login")
def login(email: str=Form(...), password: str=Form(...), db: Session=Depends(get_db)):
    u=db.scalar(select(User).where(User.email==email))
    if not u or not u.active or not check_pw(password,u.password_hash): raise HTTPException(401,"Incorrect login")
    return {"access_token":token_for(u.id),"token_type":"bearer","user":{"id":u.id,"name":u.name,"email":u.email,"role":u.role,"state":u.state or "","iem_number":u.iem_number or "","ic_number":u.ic_number or ""}}

@app.get("/api/auth/me")
def me(u: User=Depends(current_user)): return {"id":u.id,"name":u.name,"email":u.email,"role":u.role,"state":u.state or "","iem_number":u.iem_number or "","ic_number":u.ic_number or ""}

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
    return [{"id":x.id,"name":x.name,"email":x.email,"role":x.role,"active":x.active,"state":x.state or "","iem_number":x.iem_number or "","ic_number":x.ic_number or ""} for x in db.scalars(select(User)).all()]

@app.post("/api/admin/users")
def add_user(name:str, email:str, password:str, role:str, state:str="", iem_number:str="", ic_number:str="", db:Session=Depends(get_db), u:User=Depends(require_permissions(Permission.CREATE_USER))):
    if role not in VALID_ROLES: raise HTTPException(422,"Invalid role")
    if role=="engineer" and state and state not in MY_STATES: raise HTTPException(422,"Invalid state")
    if db.scalar(select(User).where(User.email==email)): raise HTTPException(409,"Email already exists")
    ic=""
    if role in IC_ROLES:
        ic=_validate_ic(ic_number)
        if not ic: raise HTTPException(422,f"IC number is required for {role}")
        if db.scalar(select(User).where(User.ic_number==ic)): raise HTTPException(409,"IC number already registered")
    x=User(name=name,email=email,password_hash=hash_pw(password),role=role,state=state,iem_number=iem_number,ic_number=ic)
    db.add(x);db.commit();db.refresh(x)
    return {"id":x.id,"name":x.name,"email":x.email,"role":x.role,"state":x.state or "","iem_number":x.iem_number or "","ic_number":x.ic_number or ""}

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
def weather_risk(db:Session=Depends(get_db), u:User=Depends(require_permissions(Permission.READ_FLOOD_MAP))):
    from sqlalchemy import func
    results = []
    for state in MY_STATES:
        active = db.scalar(
            select(func.count()).select_from(Report)
            .where(Report.state==state)
            .where(Report.status.not_in(["resolved","rejected"]))
        ) or 0
        results.append(weather_risk_for_state(state, active))
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
