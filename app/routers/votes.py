from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Vote, Poll, Option
from schemas import Vote as VoteSchema, VoteCreate

router = APIRouter(
    prefix="/votes",
    tags=["votes"],
)

templates = Jinja2Templates(directory="templates")


@router.post("/", response_model=VoteSchema, status_code=status.HTTP_201_CREATED)
def create_vote(poll_id: int, vote: VoteCreate, db: Session = Depends(get_db)):
    """Submit a vote for a poll"""
    # Check if poll exists
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")

    # Check if options exist and belong to the poll
    option_ids = list(vote.rankings.keys())
    poll_options = db.query(Option).filter(Option.poll_id == poll_id).all()
    poll_option_ids = [option.id for option in poll_options]

    for option_id in option_ids:
        if option_id not in poll_option_ids:
            raise HTTPException(status_code=400, detail=f"Option {option_id} not found in poll {poll_id}")

    # Check if user already voted
    existing_vote = db.query(Vote).filter(
        Vote.poll_id == poll_id,
        Vote.email == vote.email
    ).first()

    if existing_vote:
        raise HTTPException(status_code=400, detail="User has already voted in this poll")

    # Create vote
    db_vote = Vote(
        poll_id=poll_id,
        email=vote.email,
        rankings=vote.rankings
    )

    db.add(db_vote)
    db.commit()
    db.refresh(db_vote)
    return db_vote


@router.get("/poll/{poll_id}", response_model=List[VoteSchema])
def get_votes_for_poll(poll_id: int, db: Session = Depends(get_db)):
    """Get all votes for a specific poll"""
    # Check if poll exists
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")

    votes = db.query(Vote).filter(Vote.poll_id == poll_id).all()
    return votes


@router.delete("/{vote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vote(vote_id: int, db: Session = Depends(get_db)):
    """Delete a vote"""
    vote = db.query(Vote).filter(Vote.id == vote_id).first()
    if vote is None:
        raise HTTPException(status_code=404, detail="Vote not found")

    db.delete(vote)
    db.commit()
    return None


@router.get("/form/{poll_id}")
def get_voting_form(request: Request, poll_id: int, db: Session = Depends(get_db)):
    """Render the voting form for a specific poll"""
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")

    options = db.query(Option).filter(Option.poll_id == poll_id).all()

    return templates.TemplateResponse(
        "voting.html",
        {
            "request": request,
            "poll": poll,
            "options": options
        }
    )
