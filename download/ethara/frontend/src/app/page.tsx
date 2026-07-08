"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { DashboardStats, FloorUtilization, ProjectDistribution, DepartmentDistribution, ActivityLog } from "@/types";
import StatCard from "@/components/StatCard";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const PIE_COLORS = ["#2563eb", "#7c3aed", "#16a34a", "#d97706", "#dc2626", "#0891b2", "#db2777", "#65a30d"];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [floors, setFloors] = useState<FloorUtilization[]>([]);
  const [projects, setProjects] = useState<ProjectDistribution[]>([]);
  const [departments, setDepartments] = useState<DepartmentDistribution[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getFloorUtilization(),
      api.getProjectDistribution(8),
      api.getDepartmentDistribution(),
      api.getActivityLogs(8),
    ])
      .then(([s, f, p, d, l]) => {
        setStats(s);
        setFloors(f);
        setProjects(p);
        setDepartments(d.slice(0, 8));
        setLogs(l.items);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-rose-300 bg-rose-50">
        <h3 className="font-semibold text-rose-700">Failed to load dashboard</h3>
        <p className="text-sm text-rose-600 mt-1">{error}</p>
        <p className="text-xs text-rose-500 mt-2">Make sure the backend is running on http://localhost:8000</p>
      </div>
    );
  }

  if (!stats) return null;

  const seatPieData = [
    { name: "Occupied", value: stats.occupied_seats, color: "#2563eb" },
    { name: "Available", value: stats.available_seats, color: "#16a34a" },
    { name: "Reserved", value: stats.reserved_seats, color: "#d97706" },
    { name: "Maintenance", value: stats.maintenance_seats, color: "#dc2626" },
  ];

  return (
    <div className="space-y-6 fade-in">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600 mt-1">
          Real-time overview of seat allocation, projects, and employees at Ethara.
        </p>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value={stats.total_employees.toLocaleString()} icon="👥" color="blue" hint={`${stats.active_employees.toLocaleString()} active`} />
        <StatCard label="New Joiners" value={stats.new_joiners} icon="✨" color="violet" hint="Awaiting seat allocation" />
        <StatCard label="Seat Utilization" value={`${stats.utilization_pct}%`} icon="🪑" color="amber" hint={`${stats.occupied_seats}/${stats.total_seats} seats`} trend={stats.utilization_pct > 80 ? "up" : "neutral"} />
        <StatCard label="Active Projects" value={stats.active_projects} icon="📁" color="green" hint={`${stats.total_projects} total projects`} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-slate-900 mb-1">Floor-wise Utilization</h3>
          <p className="text-xs text-slate-500 mb-4">Occupied vs. total seats per floor</p>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={floors} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="floor_name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(value: any, name: any) => [value, name === "occupied" ? "Occupied" : "Total Seats"]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" name="Total Seats" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="occupied" name="Occupied" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-1">Seat Status</h3>
          <p className="text-xs text-slate-500 mb-4">Distribution of all {stats.total_seats} seats</p>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={seatPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${e.value}`}>
                  {seatPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-1">Top Projects by Employee Count</h3>
          <p className="text-xs text-slate-500 mb-4">Projects with the most assigned employees</p>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={projects} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="project_name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="employee_count" name="Employees" radius={[0, 4, 4, 0]}>
                  {projects.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-900 mb-1">Department Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">Headcount across departments</p>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={departments} dataKey="employee_count" nameKey="department" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.department}>
                  {departments.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity logs */}
      <div className="card">
        <h3 className="font-semibold text-slate-900 mb-1">Recent Activity</h3>
        <p className="text-xs text-slate-500 mb-4">Latest seat allocation / release events</p>
        <div className="space-y-2">
          {logs.length === 0 && <p className="text-sm text-slate-500">No recent activity.</p>}
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-sm border-b border-slate-100 last:border-0 py-2">
              <div className="flex items-center gap-3">
                <span className={`badge ${
                  log.action === "ALLOCATE" ? "badge-info" :
                  log.action === "RELEASE" ? "badge-warning" :
                  log.action === "RESERVE" ? "badge-success" :
                  "badge-muted"
                }`}>{log.action}</span>
                <span className="text-slate-700">{log.details || "—"}</span>
              </div>
              <span className="text-xs text-slate-500">
                {new Date(log.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
