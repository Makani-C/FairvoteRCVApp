from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Poll, Option
from schemas import Poll as PollSchema, PollCreate

router = APIRouter(
    prefix="/polls",
    tags=["polls"],
)


@router.post("/", response_model=PollSchema, status_code=status.HTTP_201_CREATED)
def create_poll(poll: PollCreate, db: Session = Depends(get_db)):
    """Create a new poll with options"""
    db_poll = Poll(title=poll.title, description=poll.description)
    db.add(db_poll)
    db.flush()  # Get the poll ID

    # Create options
    for option_text in poll.options:
        db_option = Option(poll_id=db_poll.id, text=option_text)
        db.add(db_option)

    db.commit()
    db.refresh(db_poll)
    return db_poll


@router.get("/", response_model=List[PollSchema])
def get_polls(db: Session = Depends(get_db)):
    """Get all polls"""
    return db.query(Poll).all()


@router.get("/{poll_id}", response_model=PollSchema)
def get_poll(poll_id: int, db: Session = Depends(get_db)):
    """Get a specific poll by ID"""
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")
    return poll


@router.delete("/{poll_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_poll(poll_id: int, db: Session = Depends(get_db)):
    """Delete a poll"""
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")

    db.delete(poll)
    db.commit()
    return None