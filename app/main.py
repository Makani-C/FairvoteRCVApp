from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import votes, polls, results

app = FastAPI(title="Ranked Choice Voting")

# Configure CORS
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

# Template setup
templates = Jinja2Templates(directory="templates")

# Include routers
app.include_router(polls.router)
app.include_router(votes.router)
app.include_router(results.router)

@app.get("/")
async def root(request: Request):
    """Serve the main voting page"""
    return templates.TemplateResponse("voting.html", {"request": request})

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
