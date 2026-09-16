from datetime import datetime, timedelta, timezone  
from passlib.context import CryptContext  
from jose import jwt, JWTError 
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