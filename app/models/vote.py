from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, func
from sqlalchemy.orm import relationship

from database import Base


class Option(Base):
    __tablename__ = "options"

    id = Column(Integer, primary_key=True, index=True)
    poll_id = Column(Integer, ForeignKey("polls.id"))
    text = Column(String, nullable=False)

    # Relationships
    poll = relationship("Poll", back_populates="options")


class Vote(Base):
    __tablename__ = "votes"

    id = Column(Integer, primary_key=True, index=True)
    poll_id = Column(Integer, ForeignKey("polls.id"))
    email = Column(String, nullable=False)
    rankings = Column(JSON, nullable=False)  # Store rankings as {"option_id": rank}
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    poll = relationship("Poll", back_populates="votes")