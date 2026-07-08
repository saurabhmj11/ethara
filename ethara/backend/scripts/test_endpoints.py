"""Smoke test for all backend endpoints using FastAPI TestClient.
Run with: python scripts/test_endpoints.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def section(title):
    print(f"\n{'='*60}\n{title}\n{'='*60}")


def test_endpoint(method, path, expected_status=200, **kwargs):
    resp = getattr(client, method.lower())(path, **kwargs)
    status = "✓" if resp.status_code == expected_status else "✗"
    print(f"{status} {method} {path} → {resp.status_code}")
    if resp.status_code != expected_status:
        print(f"  Body: {resp.text[:200]}")
    return resp


def main():
    section("Health & Root")
    test_endpoint("GET", "/")
    test_endpoint("GET", "/health")

    section("Dashboard")
    r = test_endpoint("GET", "/api/v1/dashboard/stats")
    print(f"  Stats: {r.json()}")
    r = test_endpoint("GET", "/api/v1/dashboard/floor-utilization")
    print(f"  Floors: {len(r.json())} entries")
    r = test_endpoint("GET", "/api/v1/dashboard/project-distribution")
    print(f"  Projects: {len(r.json())} entries")
    r = test_endpoint("GET", "/api/v1/dashboard/department-distribution")
    print(f"  Departments: {len(r.json())} entries")
    r = test_endpoint("GET", "/api/v1/dashboard/activity-logs?limit=3")
    print(f"  Logs: {len(r.json()['items'])} entries")

    section("Projects")
    r = test_endpoint("GET", "/api/v1/projects?limit=3")
    print(f"  Projects: {r.json()['total']} total, showing {len(r.json()['items'])}")
    first_proj = r.json()["items"][0]
    test_endpoint("GET", f"/api/v1/projects/{first_proj['id']}")

    section("Floors & Bays")
    r = test_endpoint("GET", "/api/v1/floors")
    print(f"  Floors: {len(r.json())}")
    r2 = test_endpoint("GET", "/api/v1/floors/bays/all")
    print(f"  Bays: {len(r2.json())}")

    section("Seats")
    r = test_endpoint("GET", "/api/v1/seats?limit=3")
    print(f"  Seats: {r.json()['total']} total")
    r = test_endpoint("GET", "/api/v1/seats?status=AVAILABLE&limit=3")
    print(f"  Available seats: {r.json()['total']}")
    r = test_endpoint("GET", "/api/v1/seats?status=OCCUPIED&limit=3")
    print(f"  Occupied seats: {r.json()['total']}")

    section("Employees")
    r = test_endpoint("GET", "/api/v1/employees?limit=3")
    print(f"  Employees: {r.json()['total']} total")
    r = test_endpoint("GET", "/api/v1/employees?status=ONBOARDING&limit=3")
    print(f"  New joiners: {r.json()['total']}")
    r = test_endpoint("GET", "/api/v1/employees?search=eth&limit=3")
    print(f"  Search 'eth': {r.json()['total']} matches")
    r = test_endpoint("GET", "/api/v1/employees/departments")
    print(f"  Departments: {len(r.json())}")

    section("AI Assistant")
    r = test_endpoint("GET", "/api/v1/ai/suggestions")
    print(f"  Suggestions: {len(r.json())}")
    print("  Testing AI query (may take a few seconds for LLM call)...")
    r = test_endpoint("POST", "/api/v1/ai/query", json={"query": "How many available seats are there?"})
    print(f"  Intent: {r.json().get('intent')}")
    print(f"  Answer: {r.json().get('answer', '')[:200]}")
    print(f"  Elapsed: {r.json().get('elapsed_ms')}ms")

    section("Seat Allocation Flow (end-to-end)")
    # Get an available seat and an onboarding employee
    r = test_endpoint("GET", "/api/v1/seats?status=AVAILABLE&limit=1")
    available_seat = r.json()["items"][0]
    r = test_endpoint("GET", "/api/v1/employees?status=ONBOARDING&limit=1")
    new_joiner = r.json()["items"][0]
    print(f"  Available seat: {available_seat['seat_number']} (id={available_seat['id']})")
    print(f"  New joiner: {new_joiner['emp_code']} - {new_joiner['full_name']} (id={new_joiner['id']})")

    # Allocate
    r = test_endpoint("POST", "/api/v1/seats/allocate-new-joiner",
                      json={"employee_id": new_joiner["id"], "actor": "test"})
    print(f"  Allocation: {r.json()}")

    section("All tests complete!")


if __name__ == "__main__":
    main()
