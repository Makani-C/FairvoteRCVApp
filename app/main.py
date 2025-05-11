from fastapi import APIRouter, Depends, FastAPI, status, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from database.session import engine, Base, get_db
from database.models import Poll, Option, Vote
from schemas import Poll as PollSchema, PollCreate, Vote as VoteSchema, VoteCreate
from utils.results import calculate_ranked_choice_results


# ============ Main Application Routes ============
base_router = APIRouter(prefix="")

@base_router.get("/", response_class=FileResponse)
async def root():
    """Serve the main voting page"""
    return "static/index.html"


@base_router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint"""
    result = db.execute(text("SELECT 1")).scalar()
    return {"status": "healthy"}


# ============ Poll Routes ============
polls_router = APIRouter(prefix="/polls", tags=["polls"])

@polls_router.post("/", response_model=PollSchema, status_code=status.HTTP_201_CREATED)
async def create_poll(poll: PollCreate, db: Session = Depends(get_db)):
    """Create a new poll with options"""
    # Create poll first
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


@polls_router.get("/", response_model=List[PollSchema])
async def get_polls(db: Session = Depends(get_db)):
    """Get all polls"""
    return db.query(Poll).all()


@polls_router.get("/{poll_id}", response_model=PollSchema)
async def get_poll(poll_id: int, db: Session = Depends(get_db)):
    """Get a specific poll by ID"""
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")
    return poll


@polls_router.delete("/{poll_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_poll(poll_id: int, db: Session = Depends(get_db)):
    """Delete a poll"""
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")

    db.delete(poll)
    db.commit()
    return None


# ============ Vote Routes ============
votes_router = APIRouter(prefix="/votes", tags=["votes"])

@votes_router.post("/", response_model=VoteSchema, status_code=status.HTTP_201_CREATED)
async def create_vote(poll_id: int, vote: VoteCreate, db: Session = Depends(get_db)):
    """Submit a vote for a poll"""
    # Validate poll exists
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")

    # Validate options exist and belong to the poll
    option_ids = list(map(int, vote.rankings.keys()))
    poll_options = db.query(Option).filter(Option.poll_id == poll_id).all()
    poll_option_ids = [option.id for option in poll_options]

    invalid_options = [opt_id for opt_id in option_ids if opt_id not in poll_option_ids]
    if invalid_options:
        raise HTTPException(
            status_code=400,
            detail=f"Options {invalid_options} not found in poll {poll_id}"
        )

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


@votes_router.get("/poll/{poll_id}", response_model=List[VoteSchema])
async def get_votes_for_poll(poll_id: int, db: Session = Depends(get_db)):
    """Get all votes for a specific poll"""
    # Check if poll exists
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")

    votes = db.query(Vote).filter(Vote.poll_id == poll_id).all()
    return votes


@votes_router.delete("/{vote_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vote(vote_id: int, db: Session = Depends(get_db)):
    """Delete a vote"""
    vote = db.query(Vote).filter(Vote.id == vote_id).first()
    if vote is None:
        raise HTTPException(status_code=404, detail="Vote not found")

    db.delete(vote)
    db.commit()
    return None


@votes_router.get("/form/{poll_id}")
async def get_voting_form(request: Request, poll_id: int, db: Session = Depends(get_db)):
    """Render the voting form for a specific poll"""
    # Validate poll exists
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


# ============ Results Routes ============
results_router = APIRouter(prefix="/results", tags=["results"])


@results_router.get("/api/poll/{poll_id}")
async def get_poll_results(poll_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get JSON results for a specific poll"""
    # Validate poll exists
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")

    votes = db.query(Vote).filter(Vote.poll_id == poll_id).all()
    options = db.query(Option).filter(Option.poll_id == poll_id).all()

    # Handle no votes case
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


app = FastAPI(title="Ranked Choice Voting")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
Base.metadata.create_all(bind=engine)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize Jinja2 templates
templates = Jinja2Templates(directory="templates")

# Include the routers
app.include_router(base_router)
app.include_router(polls_router)
app.include_router(votes_router)
app.include_router(results_router)
