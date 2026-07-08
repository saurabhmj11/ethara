"""AI Assistant service - hybrid rule-based intent detection + LLM via z-ai CLI."""
from __future__ import annotations
import re
import json
import subprocess
import time
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models import (
    Employee, Project, Floor, Bay, Seat,
    EmployeeStatus, SeatStatus,
)
from app.services import crud


# ---------- Intent detection ----------
INTENT_KEYWORDS = {
    "available_seats": [
        r"empty seat", r"available seat", r"free seat", r"vacant seat",
        r"open seat", r"how many seat.*available", r"seat.*free",
    ],
    "occupied_seats": [
        r"occupied seat", r"how many.*occupied", r"used seat",
    ],
    "new_joiners": [
        r"new joiner", r"new hire", r"onboarding", r"on-boarding",
        r"recent.*join", r"new employee", r"new joiners without seat",
    ],
    "floor_utilization": [
        r"floor.*util", r"utilization.*floor", r"floor.*occupancy",
        r"which floor.*empty", r"which floor.*full", r"floor.*available",
    ],
    "project_employees": [
        r"who.*project", r"employee.*project", r"project.*member",
        r"team.*project", r"people.*project",
    ],
    "employee_seat": [
        r"where.*sit", r"seat of", r"seat for", r"find.*employee.*seat",
        r"locate.*employee", r"where.*employee",
    ],
    "total_stats": [
        r"how many employee", r"total employee", r"overall stat",
        r"summary", r"overview", r"dashboard",
    ],
    "project_distribution": [
        r"project distribution", r"project.*count", r"employee.*per project",
        r"project.*size",
    ],
    "department_distribution": [
        r"department.*count", r"department.*employee", r"by department",
        r"department.*size",
    ],
}


def detect_intent(query: str) -> str:
    """Return one of the INTENT_KEYWORDS keys or 'unknown'."""
    q = query.lower()
    # Check in priority order
    priority = [
        "available_seats", "occupied_seats", "new_joiners",
        "floor_utilization", "project_employees", "employee_seat",
        "project_distribution", "department_distribution", "total_stats",
    ]
    for intent in priority:
        for pat in INTENT_KEYWORDS.get(intent, []):
            if re.search(pat, q):
                return intent
    return "unknown"


# ---------- Data fetchers (one per intent) ----------
def fetch_available_seats(db: Session, query: str) -> dict:
    """Find available seats, optionally filtered by floor/bay mentioned in the query."""
    # Try to extract a floor name like "Floor 1" or "Floor 3"
    m = re.search(r"floor\s*(\d+|[a-zA-Z]+)", query, re.IGNORECASE)
    floor_filter = None
    if m:
        floor_name = f"Floor {m.group(1)}"
        floor = db.query(Floor).filter(func.lower(Floor.name) == floor_name.lower()).first()
        if floor:
            floor_filter = floor.id

    q = db.query(Seat).filter(Seat.status == SeatStatus.AVAILABLE.value)
    if floor_filter:
        bay_ids = [b.id for b in db.query(Bay).filter(Bay.floor_id == floor_filter).all()]
        q = q.filter(Seat.bay_id.in_(bay_ids))

    seats = q.order_by(Seat.seat_number).limit(50).all()
    total = q.count()

    by_floor = {}
    for s in seats[:50]:
        bay = db.query(Bay).filter(Bay.id == s.bay_id).first()
        floor = db.query(Floor).filter(Floor.id == bay.floor_id).first() if bay else None
        fname = floor.name if floor else "Unknown"
        by_floor.setdefault(fname, []).append(s.seat_number)

    return {
        "intent": "available_seats",
        "total_available": total,
        "floor_filter": floor_filter,
        "sample_seats": [s.seat_number for s in seats[:20]],
        "by_floor_sample": {k: v[:5] for k, v in list(by_floor.items())[:5]},
    }


def fetch_occupied_seats(db: Session) -> dict:
    total = db.query(func.count(Seat.id)).filter(Seat.status == SeatStatus.OCCUPIED.value).scalar() or 0
    grand_total = db.query(func.count(Seat.id)).scalar() or 0
    return {
        "intent": "occupied_seats",
        "occupied_seats": total,
        "total_seats": grand_total,
        "occupancy_pct": round((total / grand_total) * 100, 2) if grand_total else 0,
    }


def fetch_new_joiners(db: Session) -> dict:
    new_joiners = (
        db.query(Employee)
        .filter(Employee.status == EmployeeStatus.ONBOARDING.value)
        .order_by(Employee.join_date.desc())
        .limit(50)
        .all()
    )
    total = (
        db.query(func.count(Employee.id))
        .filter(Employee.status == EmployeeStatus.ONBOARDING.value)
        .scalar()
        or 0
    )
    without_seat = sum(1 for e in new_joiners if not e.seat_id)
    return {
        "intent": "new_joiners",
        "total_new_joiners": total,
        "without_seat": without_seat,
        "sample_new_joiners": [
            {
                "emp_code": e.emp_code,
                "name": e.full_name,
                "department": e.department,
                "join_date": e.join_date.isoformat() if e.join_date else None,
                "has_seat": bool(e.seat_id),
            }
            for e in new_joiners[:20]
        ],
    }


def fetch_floor_utilization(db: Session) -> dict:
    return {"intent": "floor_utilization", "floors": crud.get_floor_utilization(db)}


def fetch_project_employees(db: Session, query: str) -> dict:
    """Find employees on a specific project mentioned in the query."""
    # Try to extract project name/code
    projects = db.query(Project).all()
    matched_project = None
    q_lower = query.lower()
    for p in projects:
        if p.name.lower() in q_lower or p.code.lower() in q_lower:
            matched_project = p
            break
    if not matched_project:
        # Return top 10 projects by employee count
        return {
            "intent": "project_employees",
            "matched_project": None,
            "top_projects": crud.get_project_distribution(db, limit=10),
        }
    employees = (
        db.query(Employee)
        .filter(Employee.project_id == matched_project.id)
        .order_by(Employee.full_name)
        .limit(50)
        .all()
    )
    total = (
        db.query(func.count(Employee.id))
        .filter(Employee.project_id == matched_project.id)
        .scalar()
        or 0
    )
    return {
        "intent": "project_employees",
        "matched_project": {
            "id": matched_project.id,
            "name": matched_project.name,
            "code": matched_project.code,
            "manager": matched_project.manager_name,
        },
        "total_employees": total,
        "sample_employees": [
            {
                "emp_code": e.emp_code,
                "name": e.full_name,
                "designation": e.designation,
                "department": e.department,
            }
            for e in employees[:20]
        ],
    }


def fetch_employee_seat(db: Session, query: str) -> dict:
    """Find the seat of an employee by name or emp_code mentioned in the query."""
    # Extract potential name (very crude)
    employees = db.query(Employee).all()
    q_lower = query.lower()
    matched = None
    for e in employees:
        if e.full_name.lower() in q_lower or e.emp_code.lower() in q_lower:
            matched = e
            break
    if not matched:
        return {
            "intent": "employee_seat",
            "matched_employee": None,
            "message": "Could not identify the employee from the query. Try including their full name or employee code.",
        }
    seat_info = None
    if matched.seat_id:
        seat = db.query(Seat).filter(Seat.id == matched.seat_id).first()
        if seat:
            bay = db.query(Bay).filter(Bay.id == seat.bay_id).first()
            floor = db.query(Floor).filter(Floor.id == bay.floor_id).first() if bay else None
            seat_info = {
                "seat_number": seat.seat_number,
                "bay": bay.name if bay else None,
                "floor": floor.name if floor else None,
                "status": seat.status,
            }
    return {
        "intent": "employee_seat",
        "matched_employee": {
            "emp_code": matched.emp_code,
            "name": matched.full_name,
            "department": matched.department,
            "designation": matched.designation,
        },
        "seat": seat_info,
    }


def fetch_total_stats(db: Session) -> dict:
    stats = crud.get_dashboard_stats(db)
    return {"intent": "total_stats", "stats": stats}


def fetch_project_distribution(db: Session) -> dict:
    return {"intent": "project_distribution", "projects": crud.get_project_distribution(db, limit=15)}


def fetch_department_distribution(db: Session) -> dict:
    return {"intent": "department_distribution", "departments": crud.get_department_distribution(db)}


# ---------- LLM call via z-ai CLI ----------
def call_llm(system_prompt: str, user_prompt: str, max_retries: int = 2) -> str:
    """Call the z-ai CLI to get an LLM response. Falls back to a stub if CLI is unavailable."""
    cmd = ["z-ai", "chat", "--prompt", user_prompt, "--system", system_prompt, "-o", "/tmp/zai_resp.json"]
    last_err = None
    for attempt in range(max_retries + 1):
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=45, check=False,
            )
            if result.returncode == 0:
                try:
                    with open("/tmp/zai_resp.json") as f:
                        data = json.load(f)
                    # The CLI saves the completion in a JSON structure
                    if isinstance(data, dict):
                        # Try common keys
                        return (
                            data.get("content")
                            or data.get("response")
                            or data.get("choices", [{}])[0].get("message", {}).get("content")
                            or str(data)
                        )
                    return str(data)
                except Exception:
                    # Fall back to stdout
                    return result.stdout.strip() or "Could not parse LLM response."
            else:
                last_err = result.stderr or result.stdout
        except subprocess.TimeoutExpired:
            last_err = "LLM call timed out"
        except FileNotFoundError:
            last_err = "z-ai CLI not installed"
        except Exception as e:
            last_err = str(e)
    # Fallback: produce a deterministic response without LLM
    return f"[LLM unavailable ({last_err})] Could not generate a natural language response."


SYSTEM_PROMPT = """You are the AI Assistant for the Ethara Seat Allocation & Project Mapping System.
You help HR, Admin, and Project teams query employee seating, project assignments, seat availability, and utilization metrics.

Given a user's question and structured data fetched from the database, write a clear, concise, friendly natural-language answer.
- If numbers are provided, use them.
- If sample lists are provided, mention them but don't dump everything — highlight 3-5 examples.
- If a filter was applied (e.g. specific floor or project), acknowledge it.
- If no data was found, say so clearly.
- Be specific and useful. Avoid filler.
"""


def answer_query(db: Session, query: str) -> dict:
    """Main entry: detect intent → fetch data → call LLM → return response."""
    start = time.time()
    intent = detect_intent(query)
    # Fetch structured data
    if intent == "available_seats":
        data = fetch_available_seats(db, query)
    elif intent == "occupied_seats":
        data = fetch_occupied_seats(db)
    elif intent == "new_joiners":
        data = fetch_new_joiners(db)
    elif intent == "floor_utilization":
        data = fetch_floor_utilization(db)
    elif intent == "project_employees":
        data = fetch_project_employees(db, query)
    elif intent == "employee_seat":
        data = fetch_employee_seat(db, query)
    elif intent == "project_distribution":
        data = fetch_project_distribution(db)
    elif intent == "department_distribution":
        data = fetch_department_distribution(db)
    elif intent == "total_stats":
        data = fetch_total_stats(db)
    else:
        data = {"intent": "unknown", "message": "I couldn't classify your query. Try asking about: available seats, occupied seats, new joiners, floor utilization, project members, or where an employee sits."}

    # Generate natural-language answer
    user_prompt = f"""USER QUESTION: {query}

DETECTED INTENT: {intent}

FETCHED DATA (JSON):
{json.dumps(data, default=str, indent=2)}

Write a concise, friendly answer to the user's question based on this data. If the data doesn't fully answer the question, say so.
"""
    answer = call_llm(SYSTEM_PROMPT, user_prompt)

    elapsed_ms = int((time.time() - start) * 1000)
    return {
        "query": query,
        "answer": answer,
        "data": data,
        "intent": intent,
        "sql": None,
        "elapsed_ms": elapsed_ms,
    }
