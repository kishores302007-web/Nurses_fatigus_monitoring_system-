import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Configure connection arguments and engine parameters
is_sqlite = settings.DATABASE_URL.startswith("sqlite://")

if is_sqlite:
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        settings.DATABASE_URL, 
        connect_args=connect_args
    )
else:
    # MySQL connection pool settings to prevent timeouts
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=10,
        max_overflow=20
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
