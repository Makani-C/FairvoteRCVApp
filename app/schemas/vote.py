from typing import Dict
from pydantic import BaseModel, validator
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

    @validator('rankings')
    def validate_rankings(cls, rankings):
        if not rankings:
            raise ValueError("At least one option must be ranked")

        # Check for duplicate rankings
        if len(set(rankings.values())) != len(rankings.values()):
            raise ValueError("Each rank value must be unique")
        return rankings
