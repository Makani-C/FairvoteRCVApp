import os
from pydantic import BaseSettings, validator

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    @validator("DATABASE_URL", pre=True)
    def replace_postgres_scheme(cls, v):
        if v and v.startswith("postgres:"):
            return v.replace("postgres:", "postgresql:", 1)
        return v
    
    class Config:
        env_file = ".env"
        validate_assignment = True

settings = Settings()
