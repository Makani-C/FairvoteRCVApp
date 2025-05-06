import os
from pydantic import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/rcv")

    class Config:
        env_file = ".env"


settings = Settings()
