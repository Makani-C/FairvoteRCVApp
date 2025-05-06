import os
from pydantic import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./local_dev.db")

    class Config:
        env_file = ".env"


settings = Settings()
