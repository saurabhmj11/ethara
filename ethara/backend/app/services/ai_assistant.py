"""AI Assistant service.

Architecture
------------
Hybrid design with two layers:

1. Rule-based intent detection (regex patterns) classifies the user's query
   into one of 9 intents, then runs the appropriate SQLAlchemy query to
   fetch structured data from the database.

2. Natural-language generation (NLG) — produces a human-readable answer
   from the structured data using one of these strategies, in order:

   a) LLM call (if available): the `z-ai` CLI is invoked via subprocess
      to refine the templated answer. Falls through silently on any error.
   b) Template-based fallback: deterministic natural-language generation
      driven by per-intent templates. ALWAYS works — no external deps.

This means the AI Assistant returns a real natural-language answer in every
deployment environment, whether or not an LLM is reachable.
"""
from __future__ import annotations
import json
import re
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


# ============================================================
# Intent detection
# ============================================================
INTENT_KEYWORDS = {
    "available_seats": [
        r"empty seat", r"available seat", r"free seat", r"vacant seat",
        r"open seat", r"how many seat.*available", r"seat.*free",
        r"unoccupied seat", r"how many.*free",
    ],
    "occupied_seats": [
        r"occupied seat", r"how many.*occupied", r"used seat",
        r"seat.*taken",
    ],
    "new_joiners": [
        r"new joiner", r"new hire", r"onboarding", r"on-boarding",
        r"recent.*join", r"new employee", r"new joiners without seat",
        r"new joiner.*no seat", r"who.*onboarding",
    ],
    "floor_utilization": [
        r"floor.*util", r"utilization.*floor", r"floor.*occupancy",
        r"which floor.*empty", r"which floor.*full", r"floor.*available",
        r"floor.*stats",
    ],
    "project_employees": [
        r"who.*project", r"employee.*project", r"project.*member",
        r"team.*project", r"people.*project", r"how many.*in.*project",
        r"project.*size",
    ],
    "employee_seat": [
        r"where.*sit", r"seat of", r"seat for", r"find.*employee.*seat",
        r"locate.*employee", r"where.*employee", r"which seat.*employee",
    ],
    "total_stats": [
        r"how many employee", r"total employee", r"overall stat",
        r"summary", r"overview", r"dashboard", r"big picture",
    ],
    "project_distribution": [
        r"project distribution", r"project.*count", r"employee.*per project",
    ],
    "department_distribution": [
        r"department.*count", r"department.*employee", r"by department",
        r"department.*size", r"department.*breakdown",
    ],
}


def detect_intent(query: str) -> str:
    q = query.lower()
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


# ============================================================
# Data fetchers (one per intent)
# ============================================================
def fetch_available_seats(db: Session, query: str) -> dict:
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
        "floor_filter_name": next((f.name for f in db.query(Floor).all() if f.id == floor_filter), None) if floor_filter else None,
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
    projects = db.query(Project).all()
    matched_project = None
    q_lower = query.lower()
    for p in projects:
        if p.name.lower() in q_lower or p.code.lower() in q_lower:
            matched_project = p
            break
    if not matched_project:
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


# ============================================================
# Template-based natural-language generation (always works)
# ============================================================
def _format_int(n: int) -> str:
    return f"{n:,}"


def _list_sample(items: list, max_n: int = 5) -> str:
    """Format a sample list like 'a, b, c, d, e'."""
    if not items:
        return ""
    sample = items[:max_n]
    return ", ".join(str(s) for s in sample) + (f" and {len(items) - max_n} more" if len(items) > max_n else "")


def generate_answer_template(query: str, data: dict) -> str:
    """Deterministic natural-language answer from structured data.

    This is the fallback when no LLM is available — it always produces a
    real natural-language response tailored to the intent.
    """
    intent = data.get("intent", "unknown")

    if intent == "available_seats":
        total = data.get("total_available", 0)
        floor_name = data.get("floor_filter_name")
        sample = data.get("sample_seats", [])
        by_floor = data.get("by_floor_sample", {})

        if total == 0:
            return "There are currently no available seats. All seats are either occupied, reserved, or under maintenance."

        scope = f" on {floor_name}" if floor_name else ""
        lines = [f"There are **{_format_int(total)} available seats**{scope} right now."]
        if by_floor:
            floor_summary = "; ".join(
                f"{fname}: {len(seats)} seats" for fname, seats in by_floor.items()
            )
            lines.append(f"Breakdown by floor — {floor_summary}.")
        if sample:
            lines.append(f"Sample seat numbers: {_list_sample(sample)}.")
        lines.append("You can allocate any of these to a new joiner via the New Joiners page or the Seat Map.")
        return " ".join(lines)

    if intent == "occupied_seats":
        occ = data.get("occupied_seats", 0)
        total = data.get("total_seats", 0)
        pct = data.get("occupancy_pct", 0)
        return (
            f"Currently **{_format_int(occ)} of {_format_int(total)} seats are occupied** ({pct}% occupancy). "
            f"That leaves {_format_int(total - occ)} seats available for new allocations."
        )

    if intent == "new_joiners":
        total = data.get("total_new_joiners", 0)
        without = data.get("without_seat", 0)
        sample = data.get("sample_new_joiners", [])
        if total == 0:
            return "There are no employees currently in the ONBOARDING status — everyone has been onboarded."
        lines = [f"There are **{_format_int(total)} new joiners** in the onboarding status."]
        if without > 0:
            lines.append(f"Of those, **{without} do not yet have a seat assigned**.")
        if sample:
            sample_str = "; ".join(
                f"{s['name']} ({s['emp_code']}, {s.get('department', '—')})"
                for s in sample[:5]
            )
            lines.append(f"Recent new joiners: {sample_str}.")
        lines.append("Head to the New Joiners page to auto-allocate seats to them.")
        return " ".join(lines)

    if intent == "floor_utilization":
        floors = data.get("floors", [])
        if not floors:
            return "No floor data available."
        lines = ["Here's the floor-wise utilization:"]
        for f in floors:
            lines.append(
                f"• **{f['floor_name']}**: {f['occupied']} of {f['total']} seats occupied "
                f"({f['utilization_pct']}% utilization, {f['available']} available)"
            )
        busiest = max(floors, key=lambda x: x["utilization_pct"])
        emptiest = min(floors, key=lambda x: x["utilization_pct"])
        lines.append(
            f"The busiest floor is **{busiest['floor_name']}** at {busiest['utilization_pct']}%, "
            f"and the most available seats are on **{emptiest['floor_name']}** ({emptiest['available']} free)."
        )
        return "\n".join(lines)

    if intent == "project_employees":
        proj = data.get("matched_project")
        if not proj:
            top = data.get("top_projects", [])
            if not top:
                return "I couldn't identify a specific project in your query, and there are no projects in the database."
            lines = ["I couldn't identify a specific project in your query. Here are the top projects by team size:"]
            for p in top[:5]:
                lines.append(f"• **{p['project_name']}** ({p['project_code']}): {p['employee_count']} employees")
            lines.append("Try asking again with a project name, e.g., \"How many employees are in project Atlas?\"")
            return "\n".join(lines)
        total = data.get("total_employees", 0)
        sample = data.get("sample_employees", [])
        manager = proj.get("manager")
        lines = [
            f"Project **{proj['name']}** ({proj['code']}) has **{_format_int(total)} employees** assigned."
        ]
        if manager:
            lines.append(f"It's managed by {manager}.")
        if sample:
            names = "; ".join(f"{s['name']} ({s['emp_code']})" for s in sample[:5])
            lines.append(f"Team members include: {names}.")
        return " ".join(lines)

    if intent == "employee_seat":
        emp = data.get("matched_employee")
        if not emp:
            return (
                "I couldn't identify the employee from your query. "
                "Please include their full name (e.g., \"Where does Jane Smith sit?\") "
                "or employee code (e.g., \"Where does ETH0001 sit?\")."
            )
        seat = data.get("seat")
        if not seat:
            return (
                f"**{emp['name']}** ({emp['emp_code']}, {emp.get('department', '—')}) "
                f"does not currently have a seat assigned. They may be a new joiner awaiting allocation, "
                f"or a remote/hot-desk employee."
            )
        return (
            f"**{emp['name']}** ({emp['emp_code']}, {emp.get('designation', '—')}, "
            f"{emp.get('department', '—')}) sits at seat **{seat['seat_number']}** "
            f"in {seat.get('bay', '—')} on {seat.get('floor', '—')}. "
            f"Current seat status: {seat.get('status', '—')}."
        )

    if intent == "total_stats":
        s = data.get("stats", {})
        return (
            f"Here's the overall picture at Ethara:\n"
            f"• **{_format_int(s.get('total_employees', 0))} employees** total "
            f"({_format_int(s.get('active_employees', 0))} active, {s.get('new_joiners', 0)} new joiners)\n"
            f"• **{_format_int(s.get('total_seats', 0))} seats** — {s.get('occupied_seats', 0)} occupied, "
            f"{s.get('available_seats', 0)} available, {s.get('reserved_seats', 0)} reserved, "
            f"{s.get('maintenance_seats', 0)} under maintenance\n"
            f"• **{s.get('utilization_pct', 0)}% seat utilization** across {s.get('total_floors', 0)} floors "
            f"and {s.get('total_bays', 0)} bays\n"
            f"• **{s.get('total_projects', 0)} projects** ({s.get('active_projects', 0)} currently active)"
        )

    if intent == "project_distribution":
        projects = data.get("projects", [])
        if not projects:
            return "No project distribution data available."
        lines = ["Here's how employees are distributed across the top projects:"]
        for p in projects[:10]:
            lines.append(f"• **{p['project_name']}** ({p['project_code']}): {p['employee_count']} employees")
        total = sum(p["employee_count"] for p in projects)
        lines.append(f"These top {len(projects)} projects account for {_format_int(total)} employee assignments.")
        return "\n".join(lines)

    if intent == "department_distribution":
        depts = data.get("departments", [])
        if not depts:
            return "No department distribution data available."
        lines = ["Here's the headcount breakdown by department:"]
        for d in depts[:10]:
            lines.append(f"• **{d['department']}**: {d['employee_count']} employees")
        return "\n".join(lines)

    return (
        "I'm not sure how to help with that. Try asking about:\n"
        "• Available seats (e.g., \"How many available seats on Floor 2?\")\n"
        "• New joiners (e.g., \"Show me all new joiners without a seat\")\n"
        "• Floor utilization (e.g., \"What is the floor-wise utilization?\")\n"
        "• Project members (e.g., \"How many employees in project Atlas?\")\n"
        "• Employee location (e.g., \"Where does ETH0001 sit?\")\n"
        "• Overall summary (e.g., \"Give me an overview\")"
    )


# ============================================================
# LLM refinement (optional, best-effort)
# ============================================================
def _try_llm_refine(query: str, data: dict, template_answer: str) -> Optional[str]:
    """Attempt to refine the templated answer via the z-ai CLI.

    Returns the refined answer on success, or None on any failure
    (CLI missing, timeout, parse error, etc.). The caller uses the
    template_answer as fallback.
    """
    system_prompt = (
        "You are the AI Assistant for the Ethara Seat Allocation System. "
        "Refine the given draft answer into polished, friendly natural language. "
        "Keep all numbers and facts exactly as given. Do not invent new data. "
        "Be concise."
    )
    user_prompt = (
        f"USER QUESTION: {query}\n\n"
        f"DETECTED INTENT: {data.get('intent')}\n\n"
        f"FETCHED DATA (JSON):\n{json.dumps(data, default=str, indent=2)}\n\n"
        f"DRAFT ANSWER:\n{template_answer}\n\n"
        f"Refine the draft answer. Keep it under 4 sentences."
    )

    try:
        result = subprocess.run(
            ["z-ai", "chat", "--prompt", user_prompt, "--system", system_prompt, "-o", "/tmp/zai_resp.json"],
            capture_output=True, text=True, timeout=15, check=False,
        )
        if result.returncode != 0:
            return None
        try:
            with open("/tmp/zai_resp.json") as f:
                resp = json.load(f)
            if isinstance(resp, dict):
                content = (
                    resp.get("content")
                    or resp.get("response")
                    or (resp.get("choices", [{}])[0].get("message", {}).get("content") if resp.get("choices") else None)
                )
                if content and isinstance(content, str) and len(content.strip()) > 10:
                    return content.strip()
        except Exception:
            pass
        # Fall back to stdout
        if result.stdout and len(result.stdout.strip()) > 10:
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
        pass
    return None


# ============================================================
# Public entry point
# ============================================================
def answer_query(db: Session, query: str, use_llm: bool = True) -> dict:
    """Main entry: detect intent → fetch data → generate answer.

    Args:
        db: SQLAlchemy session
        query: user's natural-language question
        use_llm: if True (default), try to refine via LLM. The template
                 answer is always produced first as a guaranteed fallback.

    Returns dict with: query, answer, data, intent, sql, elapsed_ms, llm_used.
    """
    start = time.time()
    intent = detect_intent(query)

    # Fetch structured data based on intent
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
        data = {
            "intent": "unknown",
            "message": "I couldn't classify your query.",
        }

    # Step 1: Always produce a template-based natural-language answer
    answer = generate_answer_template(query, data)
    llm_used = False

    # Step 2: Optionally refine via LLM (best-effort)
    if use_llm and intent != "unknown":
        refined = _try_llm_refine(query, data, answer)
        if refined:
            answer = refined
            llm_used = True

    elapsed_ms = int((time.time() - start) * 1000)
    return {
        "query": query,
        "answer": answer,
        "data": data,
        "intent": intent,
        "sql": None,
        "elapsed_ms": elapsed_ms,
        "llm_used": llm_used,
    }
