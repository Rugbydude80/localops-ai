from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database configuration with fallback to SQLite
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:password@localhost:5432/localops_ai"
)

# Try PostgreSQL first, fallback to SQLite for local development
try:
    # Test PostgreSQL connection
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        conn.execute("SELECT 1")
    print("✅ Connected to PostgreSQL database")
except Exception as e:
    print(f"⚠️  PostgreSQL connection failed: {e}")
    print("🔄 Falling back to SQLite for local development")
    DATABASE_URL = "sqlite:///./localops_ai.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Create session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()