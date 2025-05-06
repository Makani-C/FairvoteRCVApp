from typing import List, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime

class OptionBase(BaseModel):
    text: str

class OptionCreate(OptionBase):
    pass

class Option(OptionBase):
    id: int
    poll_id: int

    class Config:
        orm_mode = True

class PollBase(BaseModel):
    title: str
    description: Optional[str] = None

class PollCreate(PollBase):
    options: List[str]

class Poll(PollBase):
    id: int
    created_at: datetime
    options: List[Option]

    class Config:
        orm_mode = True
