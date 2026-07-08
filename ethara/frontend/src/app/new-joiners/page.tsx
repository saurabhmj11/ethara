"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Employee, Floor } from "@/types";
import { formatDate } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import { LoadingSpinner, EmptyState } from "@/components/Loading";
import { SparkleIcon } from "@/components/Sidebar";

export default function NewJoinersPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [preferredFloor, setPreferredFloor] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [allocatingId, setAllocatingId] = useState<number | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

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
    setBulkRunning(true);
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
    setBulkRunning(false);
    await load();
  };

  return (
    <div className="space-y-5 fade-in">
      <PageHeader
        title="New Joiners"
        description={`${total} onboarding employees awaiting seat allocation`}
        badge={<span className="badge badge-warning badge-dot">Awaiting</span>}
        actions={
          <button
            className="btn btn-success"
            onClick={handleAllocateAll}
            disabled={loading || employees.length === 0 || bulkRunning}
          >
            {bulkRunning ? <><span className="spinner" /> Allocating...</> : <><SparkleIcon className="w-4 h-4" /> Auto-allocate All</>}
          </button>
        }
      />

      <div className="card flex flex-wrap gap-3 items-center">
        <input
          className="input flex-1 min-w-[240px]"
          placeholder="Search by name, email, code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 whitespace-nowrap">Preferred floor:</label>
          <select
            className="select"
            style={{ width: "auto" }}
            value={preferredFloor}
            onChange={(e) => setPreferredFloor(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Auto-pick</option>
            {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>

      {message && (
        <div className={`card py-3 flex items-center gap-3 fade-in ${message.type === "success" ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"}`}>
          <span className="text-xl">{message.type === "success" ? "✓" : "✕"}</span>
          <p className={`text-sm font-medium flex-1 ${message.type === "success" ? "text-emerald-700" : "text-rose-700"}`}>
            {message.text}
          </p>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-700">×</button>
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
                <tr><td colSpan={7}><LoadingSpinner label="Loading new joiners..." /></td></tr>
              )}
              {!loading && employees.length === 0 && (
                <tr><td colSpan={7}><EmptyState icon="🎉" title="All new joiners seated!" description="No onboarding employees are awaiting seat allocation." /></td></tr>
              )}
              {!loading && employees.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-xs text-slate-500">{e.emp_code}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                        {e.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{e.full_name}</div>
                        <div className="text-xs text-slate-500">{e.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-slate-600">{e.department || "—"}</td>
                  <td className="text-slate-600">{e.designation || "—"}</td>
                  <td className="text-slate-600">{e.project_name || "—"}</td>
                  <td className="text-xs text-slate-500">{formatDate(e.join_date)}</td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAllocate(e.id)}
                      disabled={allocatingId === e.id || bulkRunning}
                    >
                      {allocatingId === e.id ? <><span className="spinner" /> Allocating</> : <><SparkleIcon className="w-3.5 h-3.5" /> Allocate Seat</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white flex-shrink-0">
            <SparkleIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-indigo-900 mb-1">Auto-allocation strategy</h3>
            <p className="text-sm text-indigo-800 leading-relaxed">
              When you click <b>Allocate</b>, the system tries to seat the new joiner in the same bay as their project teammates (clustering). If no project teammates have seats yet, it picks a seat on the preferred floor (if set), otherwise any available seat. The new joiner&apos;s status is automatically promoted from <code className="px-1.5 py-0.5 bg-white rounded text-xs font-mono text-indigo-700">ONBOARDING</code> to <code className="px-1.5 py-0.5 bg-white rounded text-xs font-mono text-emerald-700">ACTIVE</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
