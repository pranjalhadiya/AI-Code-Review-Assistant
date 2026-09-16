from sqlalchemy import create_engine  # create_engine: builds the object that manages the actual connection to our PostgreSQL database.
from sqlalchemy.orm import sessionmaker, declarative_base  # sessionmaker: a factory that produces database sessions. declarative_base: creates the base class all our table models inherit from.

from app.config import settings  # Imports our settings object so we can read DATABASE_URL from the .env file.


# ---------- 1. THE ENGINE ----------
engine = create_engine(
    settings.DATABASE_URL,  # The Supabase connection string, telling SQLAlchemy which database to connect to.
    pool_pre_ping=True,     # Tests a pooled connection is still alive before reusing it — important for cloud databases that drop idle connections.
)


# ---------- 2. THE SESSION FACTORY ----------
SessionLocal = sessionmaker(
    autocommit=False,  # Don't save changes automatically; we call .commit() explicitly when ready.
    autoflush=False,   # Don't auto-send pending changes before every query; gives us predictable control.
    bind=engine,       # Ties this factory to the engine above so its sessions talk to Supabase.
)


# ---------- 3. THE BASE CLASS FOR MODELS ----------
Base = declarative_base()  # All our models (User, Project, Review, ReviewFinding) inherit from this. SQLAlchemy uses it as a registry of every table.


# ---------- 4. THE DEPENDENCY FUNCTION ----------
def get_db():
    """
    Provides a database session to any API route that needs one,
    and guarantees the session is closed afterward.
    """
    db = SessionLocal()  # Creates a fresh database session for this request.
    try:
        yield db  # Hands the session to the route function, then pauses here while the route runs.
    finally:
        db.close()  # Runs no matter what (success or error) — closes the session and returns its connection to the pool.