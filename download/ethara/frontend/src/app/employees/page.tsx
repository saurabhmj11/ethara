"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Employee, Project, Floor } from "@/types";
import { formatDate } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import { LoadingSpinner, EmptyState } from "@/components/Loading";
import { UsersIcon } from "@/components/Sidebar";

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
  const activeFilters = [search, statusFilter, departmentFilter, projectFilter, floorFilter, hasSeatFilter].filter(Boolean).length;

  return (
    <div className="space-y-5 fade-in">
      <PageHeader
        title="Employees"
        description={`${total.toLocaleString()} employees total`}
        badge={activeFilters > 0 ? <span className="badge badge-info">{activeFilters} filter{activeFilters > 1 ? "s" : ""}</span> : undefined}
      />

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <UsersIcon className="w-4 h-4 text-slate-400" />
          <span className="text-xs uppercase font-bold tracking-wider text-slate-500">Search & Filter</span>
        </div>
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
                <tr><td colSpan={9}><LoadingSpinner label="Loading employees..." /></td></tr>
              )}
              {!loading && employees.length === 0 && (
                <tr><td colSpan={9}><EmptyState icon="🔍" title="No employees match your filters" description="Try adjusting or clearing your search criteria." /></td></tr>
              )}
              {!loading && employees.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-xs text-slate-500">{e.emp_code}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {e.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{e.full_name}</div>
                        <div className="text-xs text-slate-500">{e.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{e.department || "—"}</td>
                  <td className="text-slate-600">{e.designation || "—"}</td>
                  <td>
                    {e.project_name ? (
                      <div>
                        <div className="font-medium text-slate-800">{e.project_name}</div>
                        <div className="text-xs text-slate-400 font-mono">{e.project_code}</div>
                      </div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td>
                    {e.seat_number ? (
                      <span className="font-mono text-xs px-2 py-1 bg-slate-100 rounded text-slate-700">{e.seat_number}</span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="text-slate-600">{e.floor_name || "—"}</td>
                  <td>
                    <span className={`badge badge-dot ${
                      e.status === "ACTIVE" ? "badge-success" :
                      e.status === "ONBOARDING" ? "badge-warning" :
                      "badge-muted"
                    }`}>{e.status}</span>
                  </td>
                  <td className="text-xs text-slate-500">{formatDate(e.join_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-100 text-sm">
            <div className="text-slate-600">
              Showing <span className="font-semibold">{(page - 1) * PAGE_SIZE + 1}</span>–<span className="font-semibold">{Math.min(page * PAGE_SIZE, total)}</span> of <span className="font-semibold">{total.toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span className="px-3 py-1.5 text-xs text-slate-500 font-medium">Page {page} of {pages}</span>
              <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
