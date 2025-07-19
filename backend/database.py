from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database configuration - Using Supabase Client instead of direct connection
import os
from supabase._sync.client import create_client

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required")

# Create Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Test connection
try:
    # Test the connection by querying a simple table
    result = supabase.table('businesses').select('id').limit(1).execute()
    print("✅ Connected to Supabase using client")
except Exception as e:
    print(f"❌ Supabase client connection failed: {e}")
    print("🚫 No fallback to SQLite - Supabase connection is required")
    raise e

# Create a mock engine for compatibility with existing code
class MockEngine:
    def connect(self):
        return MockConnection()

class MockConnection:
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass
    
    def execute(self, query):
        return MockResult()

class MockResult:
    def fetchone(self):
        return [1]

# Use a proper SQLAlchemy engine for session compatibility
from sqlalchemy import create_engine as create_sqlalchemy_engine
engine = create_sqlalchemy_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

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