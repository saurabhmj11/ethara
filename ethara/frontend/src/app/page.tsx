"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { DashboardStats, FloorUtilization, ProjectDistribution, DepartmentDistribution, ActivityLog } from "@/types";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import { LoadingSpinner, ErrorState, SkeletonCard } from "@/components/Loading";
import { DashboardIcon, UsersIcon, SparkleIcon, FolderIcon } from "@/components/Sidebar";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const PIE_COLORS = ["#4f46e5", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)",
  padding: "8px 12px",
};

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
      <div className="fade-in">
        <PageHeader title="Dashboard" description="Real-time overview of seat allocation, projects, and employees at Ethara." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} hint="Make sure the backend is running and the database is seeded." />;
  }

  if (!stats) return null;

  const seatPieData = [
    { name: "Occupied", value: stats.occupied_seats, color: "#4f46e5" },
    { name: "Available", value: stats.available_seats, color: "#10b981" },
    { name: "Reserved", value: stats.reserved_seats, color: "#f59e0b" },
    { name: "Maintenance", value: stats.maintenance_seats, color: "#ef4444" },
  ];

  return (
    <div className="space-y-6 fade-in">
      <PageHeader
        title="Dashboard"
        description="Real-time overview of seat allocation, projects, and employees at Ethara."
        badge={<span className="badge badge-success badge-dot">Live</span>}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Employees"
          value={stats.total_employees.toLocaleString()}
          icon={<UsersIcon className="w-5 h-5" />}
          color="indigo"
          hint={`${stats.active_employees.toLocaleString()} active`}
        />
        <StatCard
          label="New Joiners"
          value={stats.new_joiners}
          icon={<SparkleIcon className="w-5 h-5" />}
          color="violet"
          hint="Awaiting seat allocation"
        />
        <StatCard
          label="Seat Utilization"
          value={`${stats.utilization_pct}%`}
          icon={<DashboardIcon className="w-5 h-5" />}
          color="amber"
          hint={`${stats.occupied_seats}/${stats.total_seats} seats`}
          progress={stats.utilization_pct}
        />
        <StatCard
          label="Active Projects"
          value={stats.active_projects}
          icon={<FolderIcon className="w-5 h-5" />}
          color="emerald"
          hint={`${stats.total_projects} total projects`}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Floor-wise Utilization</h3>
              <p className="text-xs text-slate-500 mt-0.5">Occupied vs. total seats per floor</p>
            </div>
            <span className="badge badge-info">{stats.total_floors} floors</span>
          </div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={floors} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradOccupied" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={1} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="floor_name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                <Bar dataKey="total" name="Total Seats" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
                <Bar dataKey="occupied" name="Occupied" fill="url(#gradOccupied)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Seat Status</h3>
              <p className="text-xs text-slate-500 mt-0.5">Distribution of {stats.total_seats} seats</p>
            </div>
          </div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={seatPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  label={(e: any) => e.value > 0 ? `${e.name}: ${e.value}` : ""}
                >
                  {seatPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="white" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Top Projects by Team Size</h3>
              <p className="text-xs text-slate-500 mt-0.5">Projects with the most assigned employees</p>
            </div>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={projects} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="project_name" tick={{ fontSize: 11, fill: "#64748b" }} width={110} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="employee_count" name="Employees" radius={[0, 6, 6, 0]}>
                  {projects.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Department Distribution</h3>
              <p className="text-xs text-slate-500 mt-0.5">Headcount across departments</p>
            </div>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={departments}
                  dataKey="employee_count"
                  nameKey="department"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label={(e: any) => e.employee_count > 50 ? e.department : ""}
                  labelLine={false}
                >
                  {departments.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="white" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity logs */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">Recent Activity</h3>
            <p className="text-xs text-slate-500 mt-0.5">Latest seat allocation / release events</p>
          </div>
          <a href="/analytics" className="btn btn-ghost btn-sm">View all →</a>
        </div>
        <div className="space-y-1">
          {logs.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">No recent activity.</p>}
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-sm py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <span className={`badge ${
                  log.action === "ALLOCATE" ? "badge-info" :
                  log.action === "RELEASE" ? "badge-warning" :
                  log.action === "RESERVE" ? "badge-success" :
                  "badge-muted"
                } badge-dot`}>{log.action}</span>
                <span className="text-slate-700">{log.details || "—"}</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {new Date(log.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
