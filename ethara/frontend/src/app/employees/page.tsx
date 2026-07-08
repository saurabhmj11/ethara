"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Employee, Project, Floor } from "@/types";
import { formatDate } from "@/lib/utils";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [floorFilter, setFloorFilter] = useState("");
  const [hasSeatFilter, setHasSeatFilter] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  const PAGE_SIZE = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [empResp, deptResp] = await Promise.all([
        api.listEmployees({
          skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE,
          search: search || undefined,
          status: statusFilter || undefined,
          department: departmentFilter || undefined,
          project_id: projectFilter ? Number(projectFilter) : undefined,
          floor_id: floorFilter ? Number(floorFilter) : undefined,
          has_seat: hasSeatFilter === "yes" ? true : hasSeatFilter === "no" ? false : undefined,
        }),
        departments.length === 0 ? api.listDepartments() : Promise.resolve(departments),
      ]);
      setEmployees(empResp.items);
      setTotal(empResp.total);
      setPages(empResp.pages);
      if (Array.isArray(deptResp)) setDepartments(deptResp);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, departmentFilter, projectFilter, floorFilter, hasSeatFilter, departments]);

  useEffect(() => {
    api.listProjects({ limit: 200 }).then((r) => setProjects(r.items)).catch(() => {});
    api.listFloors().then(setFloors).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-5 fade-in">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-600 mt-1">{total.toLocaleString()} employees total</p>
        </div>
      </header>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input
            className="input"
            placeholder="Search name, email, code..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
          />
          <select className="select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select className="select" value={departmentFilter} onChange={(e) => { setDepartmentFilter(e.target.value); resetPage(); }}>
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="select" value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); resetPage(); }}>
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="select" value={floorFilter} onChange={(e) => { setFloorFilter(e.target.value); resetPage(); }}>
            <option value="">All Floors</option>
            {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select className="select" value={hasSeatFilter} onChange={(e) => { setHasSeatFilter(e.target.value); resetPage(); }}>
            <option value="">Any Seat Status</option>
            <option value="yes">Has Seat</option>
            <option value="no">No Seat</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Project</th>
                <th>Seat</th>
                <th>Floor</th>
                <th>Status</th>
                <th>Join Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="text-center py-8 text-slate-500"><span className="spinner mr-2" />Loading...</td></tr>
              )}
              {!loading && employees.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-slate-500">No employees match your filters.</td></tr>
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
                  <td>
                    {e.project_name ? (
                      <div>
                        <div className="font-medium">{e.project_name}</div>
                        <div className="text-xs text-slate-500 font-mono">{e.project_code}</div>
                      </div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td>
                    {e.seat_number ? (
                      <span className="font-mono text-xs">{e.seat_number}</span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td>{e.floor_name || "—"}</td>
                  <td>
                    <span className={`badge ${
                      e.status === "ACTIVE" ? "badge-success" :
                      e.status === "ONBOARDING" ? "badge-warning" :
                      "badge-muted"
                    }`}>{e.status}</span>
                  </td>
                  <td className="text-xs">{formatDate(e.join_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-100 text-sm">
            <div className="text-slate-600">
              Page {page} of {pages} — Showing {employees.length} of {total.toLocaleString()}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
