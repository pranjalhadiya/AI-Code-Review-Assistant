from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.models import user
from app.models import project
from app.models import review          
from app.models import review_finding
from app.routes import auth
from app.routes import upload
from app.routes import review as review_routes

Base.metadata.create_all(bind=engine)

# Create the FastAPI application.
app = FastAPI(
    title="AI Code Review Assistant",
    description="Backend API for AI-powered source code analysis",
    version="0.1.0"
)


# Allow the React frontend to communicate with the FastAPI backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Create all database tables when the application starts.
@app.on_event("startup")
def create_database_tables():
    Base.metadata.create_all(bind=engine)


# Register the authentication routes.
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(review_routes.router)


# Root endpoint.
@app.get("/")
def read_root():
    return {"message": "AI Code Review Assistant backend is running"}


# Health-check endpoint.
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "AI Code Review Assistant API"
    }