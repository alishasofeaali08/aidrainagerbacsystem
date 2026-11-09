from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .config import settings
from .db import get_db
from .models import User

oauth = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
def hash_pw(p): return bcrypt.hashpw(p.encode('utf-8'), bcrypt.gensalt(12)).decode('utf-8')
def check_pw(p,h): return bcrypt.checkpw(p.encode('utf-8'), h.encode('utf-8'))
def token_for(uid):
    exp = datetime.now(timezone.utc) + timedelta(hours=12)
    return jwt.encode({"sub": str(uid), "exp": exp}, settings.secret_key, algorithm="HS256")
def current_user(token=Depends(oauth), db: Session=Depends(get_db)):
    try: uid=int(jwt.decode(token, settings.secret_key, algorithms=["HS256"])["sub"])
    except (JWTError, ValueError, KeyError): raise HTTPException(401, "Invalid or expired token")
    u=db.get(User,uid)
    if not u or not u.active: raise HTTPException(401, "Inactive or missing user")
    return u
def roles(*allowed):
    def check(u: User=Depends(current_user)):
        if u.role not in allowed: raise HTTPException(403, "Insufficient permissions")
        return u
    return check
