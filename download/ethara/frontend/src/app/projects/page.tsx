"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Project } from "@/types";
import { formatDate } from "@/lib/utils";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.listProjects({
        skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE,
        search: search || undefined,
        is_active: activeOnly ? true : undefined,
      });
      setProjects(r.items);
      setTotal(r.total);
      setPages(r.pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, activeOnly]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 fade-in">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        <p className="text-sm text-slate-600 mt-1">{total} projects</p>
      </header>

      <div className="card flex flex-wrap gap-3 items-center">
        <input
          className="input flex-1 min-w-[240px]"
          placeholder="Search by name, code, or manager..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={activeOnly} onChange={(e) => { setActiveOnly(e.target.checked); setPage(1); }} />
          Active only
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && (
          <div className="col-span-full text-center py-12 text-slate-500"><span className="spinner mr-2" />Loading projects...</div>
        )}
        {!loading && projects.map((p) => (
          <div key={p.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <div className="text-xs font-mono text-slate-500">{p.code}</div>
              </div>
              <span className={`badge ${p.is_active ? "badge-success" : "badge-muted"}`}>
                {p.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-sm text-slate-600 line-clamp-2 min-h-[40px]">{p.description || "No description"}</p>
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>
                <div className="text-slate-400 uppercase font-semibold text-[10px]">Manager</div>
                <div className="font-medium">{p.manager_name || "—"}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase font-semibold text-[10px]">Employees</div>
                <div className="font-medium">{p.employee_count ?? 0}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase font-semibold text-[10px]">Start</div>
                <div className="font-medium">{formatDate(p.start_date)}</div>
              </div>
              <div>
                <div className="text-slate-400 uppercase font-semibold text-[10px]">End</div>
                <div className="font-medium">{formatDate(p.end_date)}</div>
              </div>
            </div>
          </div>
        ))}
        {!loading && projects.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">No projects found.</div>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-slate-600">Page {page} of {pages}</div>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
