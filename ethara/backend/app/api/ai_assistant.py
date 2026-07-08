"""AI Assistant routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.ai_assistant import answer_query
from app.schemas import AIQuery, AIResponse

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


@router.post("/query", response_model=AIResponse)
def query(payload: AIQuery, db: Session = Depends(get_db)):
    return answer_query(db, payload.query)


@router.get("/suggestions", response_model=list[str])
def suggestions():
    """Return sample queries users can try."""
    return [
        "How many available seats are there on Floor 2?",
        "Show me all new joiners without a seat",
        "What is the floor-wise utilization?",
        "How many employees are in project ATLAS?",
        "Where does employee ETH0001 sit?",
        "Show me the project distribution",
        "Give me an overall summary of seat utilization",
        "Which floors have the most available seats?",
    ]
