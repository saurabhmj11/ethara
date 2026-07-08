"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Project } from "@/types";
import { formatDate } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import { LoadingSpinner, EmptyState } from "@/components/Loading";
import { FolderIcon } from "@/components/Sidebar";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const PAGE_SIZE = 12;

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
      <PageHeader
        title="Projects"
        description={`${total} projects`}
        badge={<span className="badge badge-info badge-dot">Project Mapping</span>}
      />

      <div className="card flex flex-wrap gap-3 items-center">
        <input
          className="input flex-1 min-w-[240px]"
          placeholder="Search by name, code, or manager..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => { setActiveOnly(e.target.checked); setPage(1); }}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Active only
        </label>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading projects..." />
      ) : projects.length === 0 ? (
        <EmptyState icon="📁" title="No projects found" description="Try adjusting your search or filters." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="card card-hover group cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                    <FolderIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{p.name}</h3>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">{p.code}</div>
                  </div>
                </div>
                <span className={`badge ${p.is_active ? "badge-success badge-dot" : "badge-muted"}`}>
                  {p.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-sm text-slate-600 line-clamp-2 min-h-[40px] mb-4">{p.description || "No description"}</p>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Manager</div>
                  <div className="text-sm font-medium text-slate-800 mt-0.5">{p.manager_name || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Team Size</div>
                  <div className="text-sm font-bold text-indigo-600 mt-0.5">{p.employee_count ?? 0} {p.employee_count === 1 ? "person" : "people"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Start</div>
                  <div className="text-xs text-slate-600 mt-0.5">{formatDate(p.start_date)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">End</div>
                  <div className="text-xs text-slate-600 mt-0.5">{formatDate(p.end_date)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
