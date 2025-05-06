from typing import Dict, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime

class VoteCreate(BaseModel):
    email: str
    rankings: Dict[int, int]  # option_id: rank

class Vote(VoteCreate):
    id: int
    poll_id: int
    created_at: datetime

    class Config:
        orm_mode = True
