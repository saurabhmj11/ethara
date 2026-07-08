"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  DashboardStats, FloorUtilization, ProjectDistribution,
  DepartmentDistribution, ActivityLog,
} from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area, RadialBarChart, RadialBar,
} from "recharts";
import { formatDateTime } from "@/lib/utils";

const COLORS = ["#2563eb", "#7c3aed", "#16a34a", "#d97706", "#dc2626", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#0d9488"];

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

  if (loading) return <div className="flex items-center justify-center h-96"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;
  if (!stats) return null;

  const utilizationByFloor = floors.map(f => ({ name: f.floor_name, utilization: f.utilization_pct, fill: f.utilization_pct > 80 ? "#dc2626" : f.utilization_pct > 60 ? "#d97706" : "#16a34a" }));

  return (
    <div className="space-y-5 fade-in">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-600 mt-1">Deep-dive into utilization, distribution, and activity trends.</p>
      </header>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-xs uppercase text-slate-500 font-semibold">Utilization Rate</div>
          <div className="text-3xl font-bold mt-2">{stats.utilization_pct}%</div>
          <div className="text-xs text-slate-500 mt-1">{stats.occupied_seats} of {stats.total_seats} seats</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-slate-500 font-semibold">Available Seats</div>
          <div className="text-3xl font-bold mt-2 text-emerald-600">{stats.available_seats}</div>
          <div className="text-xs text-slate-500 mt-1">Ready for allocation</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-slate-500 font-semibold">New Joiners</div>
          <div className="text-3xl font-bold mt-2 text-amber-600">{stats.new_joiners}</div>
          <div className="text-xs text-slate-500 mt-1">Awaiting seats</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-slate-500 font-semibold">Projects</div>
          <div className="text-3xl font-bold mt-2">{stats.total_projects}</div>
          <div className="text-xs text-slate-500 mt-1">{stats.active_projects} active</div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-1">Floor Utilization %</h3>
          <p className="text-xs text-slate-500 mb-4">Green ≤ 60%, Amber 60-80%, Red &gt; 80%</p>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <RadialBarChart innerRadius="20%" outerRadius="100%" data={utilizationByFloor} startAngle={90} endAngle={-270}>
                <RadialBar background dataKey="utilization" cornerRadius={6} />
                <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(v: any) => [`${v}%`, "Utilization"]} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-1">Department Headcount</h3>
          <p className="text-xs text-slate-500 mb-4">All employees grouped by department</p>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={departments} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="department" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="employee_count" name="Employees" radius={[4, 4, 0, 0]}>
                  {departments.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-1">Top 15 Projects by Team Size</h3>
          <p className="text-xs text-slate-500 mb-4">Which projects have the most employees</p>
          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              <BarChart data={projects} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="project_name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="employee_count" name="Employees" radius={[0, 4, 4, 0]}>
                  {projects.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-1">Floor Capacity & Occupancy</h3>
          <p className="text-xs text-slate-500 mb-4">Stacked view of seat status per floor</p>
          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              <BarChart data={floors} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="floor_name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="occupied" name="Occupied" stackId="a" fill="#2563eb" />
                <Bar dataKey="available" name="Available" stackId="a" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity log */}
      <div className="card">
        <h3 className="font-semibold text-slate-900 mb-1">Activity Log (last 50 events)</h3>
        <p className="text-xs text-slate-500 mb-4">Audit trail of all seat allocation, release, and reserve actions</p>
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
                    <span className={`badge ${
                      log.action === "ALLOCATE" ? "badge-info" :
                      log.action === "RELEASE" ? "badge-warning" :
                      log.action === "RESERVE" ? "badge-success" :
                      "badge-muted"
                    }`}>{log.action}</span>
                  </td>
                  <td className="text-sm">{log.details || "—"}</td>
                  <td className="text-xs text-slate-500">{log.actor || "—"}</td>
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
