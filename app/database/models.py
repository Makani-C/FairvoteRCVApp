from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
import json

from database.session import Base


class Poll(Base):
    __tablename__ = "polls"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    options = relationship("Option", back_populates="poll", cascade="all, delete-orphan")
    votes = relationship("Vote", back_populates="poll", cascade="all, delete-orphan")


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
    created_at = Column(DateTime, server_default=func.now())

    _rankings = Column("rankings", Text, nullable=False)

    # Relationships
    poll = relationship("Poll", back_populates="votes")

    # Property methods to handle JSON serialization/deserialization
    @property
    def rankings(self):
        return json.loads(self._rankings)

    @rankings.setter
    def rankings(self, value):
        self._rankings = json.dumps(value)
