from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import Dict, Any

from database import get_db
from models import Poll, Vote, Option
from results_service import calculate_ranked_choice_results

router = APIRouter(
    prefix="/results",
    tags=["results"],
)

templates = Jinja2Templates(directory="templates")


@router.get("/poll/{poll_id}")
def get_poll_results(request: Request, poll_id: int, db: Session = Depends(get_db)):
    """Render the results page for a specific poll"""
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")

    votes = db.query(Vote).filter(Vote.poll_id == poll_id).all()
    options = db.query(Option).filter(Option.poll_id == poll_id).all()

    # Only calculate results if there are votes
    results = None
    if votes:
        results = calculate_ranked_choice_results(votes, options)

    return templates.TemplateResponse(
        "results.html",
        {
            "request": request,
            "poll": poll,
            "options": options,
            "votes_count": len(votes),
            "results": results
        }
    )


@router.get("/api/poll/{poll_id}")
def get_poll_results_json(poll_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get JSON results for a specific poll"""
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")

    votes = db.query(Vote).filter(Vote.poll_id == poll_id).all()
    options = db.query(Option).filter(Option.poll_id == poll_id).all()

    # Only calculate results if there are votes
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
