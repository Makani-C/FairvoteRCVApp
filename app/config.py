import os
from pydantic import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL")



settings = Settings()
if settings.DATABASE_URL.startswith('postgres:'):
    settings.DATABASE_URL = settings.DATABASE_URL.replace('postgres:', 'postgresql:', 1)
