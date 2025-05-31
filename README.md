# Ranked Choice Voting Portal
A web application for creating and conducting ranked choice voting polls

## Features

### For Voters
- **Voting Interface**: Simple numeric ranking system for poll options
- **Real-time Results**: Visual representation of ranked choice voting rounds
- **Vote Tracking**: See how your vote contributed to the final outcome

### For Administrators
- **Poll Management**: Create, lock/unlock, and delete polls
- **Voter Oversight**: View all voters and their rankings for any poll

## Technology Stack
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Deployment**: Docker with Fly.io configuration
- **Styling**: Custom CSS with professional design system

## Project Structure
```
fairvotercvapp/
├── app/
│   ├── main.py              # FastAPI application and routes
│   ├── database/
│   │   ├── models.py        # SQLAlchemy database models
│   │   └── session.py       # Database connection setup
│   ├── utils/
│   │   └── results.py       # Ranked choice voting algorithm
│   ├── schemas.py           # Pydantic data models
│   ├── static/
│   │   ├── app.js          # Frontend JavaScript application
│   │   ├── styles.css      # Professional styling
│   │   └── index.html      # Single-page application
├── Dockerfile              # Container configuration
├── docker-compose.yml      # Container orchestration
├── requirements.txt        # Python dependencies
├── fly.toml                # Fly.io deployment config
└── start.sh                # Application startup script
```

## Installation & Setup

### Prerequisites
- Python 3.9+
- Docker & Docker Compose

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fairvotercvapp
   ```

2. **Run the application with docker compose**
   ```bash
   docker-compose up --build
   ```

3. **Access the application**
   - Open browser to `http://localhost:8000`


## Using the App

1. **Create test polls** through the admin interface
2. **Submit test votes** with different ranking patterns
3. **Verify RCV calculations** in results view

### Ranked Choice Voting Algorithm

The application implements Instant Runoff Voting (IRV):

1. **Initial Count**: Count all first-choice votes
2. **Majority Check**: If any option has >50%, they win
3. **Elimination**: Remove option with fewest votes
4. **Redistribution**: Transfer eliminated option's votes to voters' next choices
5. **Repeat**: Continue until majority winner or one option remains