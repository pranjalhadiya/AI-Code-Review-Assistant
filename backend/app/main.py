from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.models import user
from app.routes import auth

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Code Review Assistant",
    description="Backend API for AI-powered source code analysis",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

@app.get("/")
def read_root():
    return {"message": "AI Code Review Assistant backend is running"}


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "AI Code Review Assistant API"
    }