"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  DashboardStats, FloorUtilization, ProjectDistribution,
  DepartmentDistribution, ActivityLog,
} from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar,
} from "recharts";
import { formatDateTime } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import { LoadingSpinner } from "@/components/Loading";

const COLORS = ["#4f46e5", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6"];
const TOOLTIP_STYLE = { borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)", padding: "8px 12px" };

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [floors, setFloors] = useState<FloorUtilization[]>([]);
  const [projects, setProjects] = useState<ProjectDistribution[]>([]);
  const [departments, setDepartments] = useState<DepartmentDistribution[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getFloorUtilization(),
      api.getProjectDistribution(15),
      api.getDepartmentDistribution(),
      api.getActivityLogs(50),
    ]).then(([s, f, p, d, l]) => {
      setStats(s); setFloors(f); setProjects(p); setDepartments(d); setLogs(l.items);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner size="lg" label="Loading analytics..." />;
  if (!stats) return null;

  const utilizationByFloor = floors.map(f => ({
    name: f.floor_name,
    utilization: f.utilization_pct,
    fill: f.utilization_pct > 80 ? "#ef4444" : f.utilization_pct > 60 ? "#f59e0b" : "#10b981",
  }));

  return (
    <div className="space-y-5 fade-in">
      <PageHeader
        title="Analytics"
        description="Deep-dive into utilization, distribution, and activity trends."
        badge={<span className="badge badge-info badge-dot">Insights</span>}
      />

      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Utilization Rate", value: `${stats.utilization_pct}%`, hint: `${stats.occupied_seats} of ${stats.total_seats} seats`, color: "from-indigo-500 to-violet-600" },
          { label: "Available Seats", value: stats.available_seats, hint: "Ready for allocation", color: "from-emerald-500 to-teal-600" },
          { label: "New Joiners", value: stats.new_joiners, hint: "Awaiting seats", color: "from-amber-500 to-orange-600" },
          { label: "Active Projects", value: stats.active_projects, hint: `${stats.total_projects} total`, color: "from-cyan-500 to-blue-600" },
        ].map((kpi, i) => (
          <div key={i} className="card relative overflow-hidden">
            <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${kpi.color} opacity-10`}></div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">{kpi.label}</div>
            <div className={`text-3xl font-bold mt-2 bg-gradient-to-br ${kpi.color} bg-clip-text text-transparent tabular-nums`}>{kpi.value}</div>
            <div className="text-xs text-slate-500 mt-1">{kpi.hint}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-1">Floor Utilization %</h3>
          <p className="text-xs text-slate-500 mb-4">Green ≤ 60%, Amber 60-80%, Red &gt; 80%</p>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <RadialBarChart innerRadius="20%" outerRadius="100%" data={utilizationByFloor} startAngle={90} endAngle={-270}>
                <RadialBar background dataKey="utilization" cornerRadius={8} />
                <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v}%`, "Utilization"]} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-1">Department Headcount</h3>
          <p className="text-xs text-slate-500 mb-4">All employees grouped by department</p>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={departments} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="department" tick={{ fontSize: 10, fill: "#64748b" }} angle={-45} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="employee_count" name="Employees" radius={[6, 6, 0, 0]}>
                  {departments.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-1">Top 15 Projects by Team Size</h3>
          <p className="text-xs text-slate-500 mb-4">Which projects have the most employees</p>
          <div style={{ width: "100%", height: 400 }}>
            <ResponsiveContainer>
              <BarChart data={projects} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="project_name" tick={{ fontSize: 10, fill: "#64748b" }} width={110} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="employee_count" name="Employees" radius={[0, 6, 6, 0]}>
                  {projects.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-1">Floor Capacity & Occupancy</h3>
          <p className="text-xs text-slate-500 mb-4">Stacked view of seat status per floor</p>
          <div style={{ width: "100%", height: 400 }}>
            <ResponsiveContainer>
              <BarChart data={floors} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="floor_name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                <Bar dataKey="occupied" name="Occupied" stackId="a" fill="#4f46e5" radius={[0, 0, 0, 0]} />
                <Bar dataKey="available" name="Available" stackId="a" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity log */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">Activity Log</h3>
            <p className="text-xs text-slate-500 mt-0.5">Audit trail of last 50 seat allocation, release, and reserve actions</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Details</th>
                <th>Actor</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-500">No activity yet.</td></tr>}
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span className={`badge badge-dot ${
                      log.action === "ALLOCATE" ? "badge-info" :
                      log.action === "RELEASE" ? "badge-warning" :
                      log.action === "RESERVE" ? "badge-success" :
                      "badge-muted"
                    }`}>{log.action}</span>
                  </td>
                  <td className="text-sm text-slate-700">{log.details || "—"}</td>
                  <td className="text-xs text-slate-500 font-mono">{log.actor || "—"}</td>
                  <td className="text-xs text-slate-500">{formatDateTime(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
