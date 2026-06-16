import os

class Settings:
    PROJECT_NAME: str = "Nurse Fatigue Intelligence & Workforce Optimization Platform"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "SUPER_SECRET_SECURITY_TOKEN_KEY_987654321")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///C:/Users/DELL/Desktop/IOT_intern_final_projectn/backend/data/fatigue_platform.db"
    )
    
    # RAG dirs
    CHROMA_DB_DIR: str = "C:/Users/DELL/Desktop/IOT_intern_final_projectn/backend/data/chroma"
    DOCS_DIR: str = "C:/Users/DELL/Desktop/IOT_intern_final_projectn/backend/data/documents"

settings = Settings()
