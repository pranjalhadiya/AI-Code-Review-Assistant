from sqlalchemy import text  # 'text' lets us write a raw SQL string for SQLAlchemy to execute.
from app.database import engine  # Imports the engine we configured.

try:
    with engine.connect() as connection:  # Opens an actual connection to Supabase. 'with' ensures it closes automatically afterward.
        result = connection.execute(text("SELECT version();"))  # Runs a simple SQL query asking PostgreSQL for its version number.
        print("✅ Connected successfully!")
        print(result.scalar())  # .scalar() grabs the single value returned by the query and prints it.
except Exception as e:  # If anything goes wrong (wrong password, no internet, wrong host), catch it.
    print("❌ Connection failed:")
    print(e)  # Print the full error so we can diagnose it.