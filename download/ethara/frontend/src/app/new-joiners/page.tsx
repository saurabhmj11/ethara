"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Employee, Floor } from "@/types";
import { formatDate } from "@/lib/utils";

export default function NewJoinersPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [preferredFloor, setPreferredFloor] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [allocatingId, setAllocatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.listEmployees({
        status: "ONBOARDING", limit: 100, search: search || undefined,
      });
      setEmployees(r.items);
      setTotal(r.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    api.listFloors().then(setFloors).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAllocate = async (empId: number) => {
    setAllocatingId(empId);
    setMessage(null);
    try {
      const r = await api.allocateNewJoiner(empId, preferredFloor || undefined);
      setMessage({ type: "success", text: `${r.message}${r.seat_number ? ` — Seat ${r.seat_number}` : ""}` });
      await load();
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setAllocatingId(null);
    }
  };

  const handleAllocateAll = async () => {
    setMessage(null);
    let successCount = 0;
    let failCount = 0;
    for (const e of employees) {
      try {
        await api.allocateNewJoiner(e.id, preferredFloor || undefined);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setMessage({
      type: successCount > 0 ? "success" : "error",
      text: `Bulk allocation complete: ${successCount} succeeded, ${failCount} failed.`,
    });
    await load();
  };

  return (
    <div className="space-y-5 fade-in">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Joiners</h1>
          <p className="text-sm text-slate-600 mt-1">{total} onboarding employees awaiting seat allocation</p>
        </div>
        <button className="btn btn-primary" onClick={handleAllocateAll} disabled={loading || employees.length === 0}>
          ⚡ Auto-allocate All
        </button>
      </header>

      <div className="card flex flex-wrap gap-3 items-center">
        <input
          className="input flex-1 min-w-[240px]"
          placeholder="Search by name, email, code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Preferred floor:</label>
          <select className="select" value={preferredFloor} onChange={(e) => setPreferredFloor(e.target.value ? Number(e.target.value) : "")} style={{ width: "auto" }}>
            <option value="">Auto-pick</option>
            {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>

      {message && (
        <div className={`card ${message.type === "success" ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"} py-3`}>
          <p className={`text-sm font-medium ${message.type === "success" ? "text-emerald-700" : "text-rose-700"}`}>
            {message.type === "success" ? "✓ " : "✗ "}{message.text}
          </p>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Project</th>
                <th>Join Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500"><span className="spinner mr-2" />Loading...</td></tr>
              )}
              {!loading && employees.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">No new joiners — all seats allocated 🎉</td></tr>
              )}
              {!loading && employees.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-xs">{e.emp_code}</td>
                  <td>
                    <div className="font-medium text-slate-900">{e.full_name}</div>
                    <div className="text-xs text-slate-500">{e.email}</div>
                  </td>
                  <td>{e.department || "—"}</td>
                  <td>{e.designation || "—"}</td>
                  <td>{e.project_name || "—"}</td>
                  <td className="text-xs">{formatDate(e.join_date)}</td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAllocate(e.id)}
                      disabled={allocatingId === e.id}
                    >
                      {allocatingId === e.id ? "Allocating..." : "⚡ Allocate Seat"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-1">Auto-allocation strategy</h3>
        <p className="text-sm text-blue-800">
          When you click <b>Allocate</b>, the system tries to seat the new joiner in the same bay as their project teammates (clustering). If no project teammates have seats yet, it picks a seat on the preferred floor (if set), otherwise any available seat. The new joiner&apos;s status is automatically promoted from <code>ONBOARDING</code> to <code>ACTIVE</code>.
        </p>
      </div>
    </div>
  );
}
