from fastapi import APIRouter, Depends, HTTPException, status  
from sqlalchemy.orm import Session  

from app.database import get_db  
from app.models.user import User  
from app.schemas.user_schema import UserCreate, UserResponse, UserLogin, Token   
from app.services.auth_service import hash_password, verify_password, create_access_token, get_current_user   


router = APIRouter(
    prefix="/auth",   
    tags=["Authentication"]  
)

@router.post(
    "/register",              
    response_model=UserResponse,  
    status_code=status.HTTP_201_CREATED  
)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
   

    existing_user = db.query(User).filter(User.email == user_data.email).first()


    if existing_user:
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="An account with this email already exists."  
        )

    hashed_pw = hash_password(user_data.password)  

    new_user = User(  
        name=user_data.name,
        email=user_data.email,
        password_hash=hashed_pw 
    )

    db.add(new_user)   
    db.commit()         
    db.refresh(new_user) 

    return new_user  


@router.post(
    "/login",                
    response_model=Token       
)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
   
    user = db.query(User).filter(User.email == credentials.email).first()
    

    if not user or not verify_password(credentials.password, user.password_hash):
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,  
            detail="Incorrect email or password."      
        )
    access_token = create_access_token(data={"sub": user.email})
 

    return Token(access_token=access_token, token_type="bearer")

@router.get(
     "/me",
     response_model=UserResponse
) 
def read_current_user(current_user: User = Depends(get_current_user)):

    return current_user