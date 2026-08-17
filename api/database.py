"""
Database configuration and session management for StudentAI.
Uses SQLite for development, easily swappable to PostgreSQL for production.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# Vercel's root filesystem is read-only. We must use /tmp if running on Vercel.
is_vercel = os.getenv("VERCEL") == "1"
default_db_path = "sqlite:////tmp/studentai.db" if is_vercel else "sqlite:///./studentai.db"

DATABASE_URL = os.getenv("DATABASE_URL", default_db_path)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


db_initialized = False

def get_db():
    """Dependency to get a database session."""
    global db_initialized
    if not db_initialized:
        try:
            init_db()
            db_initialized = True
        except Exception as e:
            print("Failed to initialize database:", e)
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables in the database."""
    from models import User, Document, Quiz, Flashcard, ChatMessage, Task
    Base.metadata.create_all(bind=engine)
    
    # Ensure default user exists for local auth mode
    try:
        from auth import ensure_default_user
        db = SessionLocal()
        ensure_default_user(db)
        db.close()
    except Exception as e:
        print("Could not create default user:", e)
        
    print("✅ Database tables created successfully!")
