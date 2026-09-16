from datetime import datetime, timedelta, timezone  
from passlib.context import CryptContext  
from jose import jwt, JWTError 
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db

from app.config import settings  



pwd_context = CryptContext(
    schemes=["bcrypt"],   
    deprecated="auto"      
)


def hash_password(plain_password: str) -> str:
  
    return pwd_context.hash(plain_password) 

def verify_password(plain_password: str, hashed_password: str) -> bool:
  
    return pwd_context.verify(plain_password, hashed_password)  


def create_access_token(data: dict) -> str:

    to_encode = data.copy()  
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)  
    to_encode.update({"exp": expire})  

    encoded_jwt = jwt.encode(
        to_encode,                    
        settings.JWT_SECRET_KEY,     
        algorithm=settings.JWT_ALGORITHM  
    )
    return encoded_jwt  


def decode_access_token(token: str) -> dict | None:
   
    try:
        payload = jwt.decode(
            token,                         
            settings.JWT_SECRET_KEY,       
            algorithms=[settings.JWT_ALGORITHM] 
        )
        return payload  
    except JWTError:  
        return None  


oauth2_scheme = HTTPBearer()



def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),  
    db: Session = Depends(get_db)          
):
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},  
    )

    payload = decode_access_token(credentials.credentials)  
    if payload is None:
        raise credentials_exception 

    email: str = payload.get("sub")  
    if email is None:
        raise credentials_exception  

    from app.models.user import User  
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception  

    return user  