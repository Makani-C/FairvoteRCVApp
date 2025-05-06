from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from database.session import get_db
from database.models import Poll, Vote, Option
from utils.results import calculate_ranked_choice_results

router = APIRouter(
    prefix="/results",
    tags=["results"],
)


@router.get("/api/poll/{poll_id}")
def get_poll_results(poll_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get JSON results for a specific poll"""
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")

    votes = db.query(Vote).filter(Vote.poll_id == poll_id).all()
    options = db.query(Option).filter(Option.poll_id == poll_id).all()

    if not votes:
        return {
            "poll": {
                "id": poll.id,
                "title": poll.title,
                "description": poll.description
            },
            "options": [{"id": opt.id, "text": opt.text} for opt in options],
            "votes_count": 0,
            "results": None
        }

    results = calculate_ranked_choice_results(votes, options)

    return {
        "poll": {
            "id": poll.id,
            "title": poll.title,
            "description": poll.description
        },
        "options": [{"id": opt.id, "text": opt.text} for opt in options],
        "votes_count": len(votes),
        "results": results
    }
