/**
 * API client for the Ethara backend.
 * Backend base URL is configured via NEXT_PUBLIC_API_URL.
 */
import type {
  Project, Floor, Bay, Seat, Employee,
  DashboardStats, FloorUtilization, ProjectDistribution,
  DepartmentDistribution, ActivityLog, PaginatedResponse, AIResponse,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${API_PREFIX}${path}`;
  const resp = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const err = await resp.json();
      detail = err.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

export const api = {
  // Dashboard
  getStats: () => fetchJson<DashboardStats>("/dashboard/stats"),
  getFloorUtilization: () => fetchJson<FloorUtilization[]>("/dashboard/floor-utilization"),
  getProjectDistribution: (limit = 15) =>
    fetchJson<ProjectDistribution[]>(`/dashboard/project-distribution?limit=${limit}`),
  getDepartmentDistribution: () =>
    fetchJson<DepartmentDistribution[]>("/dashboard/department-distribution"),
  getActivityLogs: (limit = 50) =>
    fetchJson<{ items: ActivityLog[]; total: number }>(`/dashboard/activity-logs?limit=${limit}`),

  // Projects
  listProjects: (params: { skip?: number; limit?: number; search?: string; is_active?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.skip != null) q.set("skip", String(params.skip));
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.search) q.set("search", params.search);
    if (params.is_active != null) q.set("is_active", String(params.is_active));
    return fetchJson<PaginatedResponse<Project>>(`/projects?${q.toString()}`);
  },
  getProject: (id: number) => fetchJson<Project>(`/projects/${id}`),
  createProject: (data: Partial<Project>) =>
    fetchJson<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id: number, data: Partial<Project>) =>
    fetchJson<Project>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProject: (id: number) =>
    fetchJson<void>(`/projects/${id}`, { method: "DELETE" }),

  // Floors & Bays
  listFloors: () => fetchJson<Floor[]>("/floors"),
  listBays: (floorId?: number) =>
    fetchJson<Bay[]>(`/floors/bays/all${floorId ? `?floor_id=${floorId}` : ""}`),

  // Seats
  listSeats: (params: {
    skip?: number; limit?: number; bay_id?: number; floor_id?: number;
    status?: string; search?: string;
  } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== "") q.set(k, String(v));
    });
    return fetchJson<PaginatedResponse<Seat>>(`/seats?${q.toString()}`);
  },
  getSeat: (id: number) => fetchJson<Seat>(`/seats/${id}`),
  allocateSeat: (employee_id: number, seat_id: number, actor = "ui-user") =>
    fetchJson<{ success: boolean; message: string }>(`/seats/allocate`, {
      method: "POST", body: JSON.stringify({ employee_id, seat_id, actor }),
    }),
  releaseSeat: (seat_id: number, actor = "ui-user") =>
    fetchJson<{ success: boolean; message: string }>(`/seats/release`, {
      method: "POST", body: JSON.stringify({ seat_id, actor }),
    }),
  reserveSeat: (seat_id: number, employee_id: number, actor = "ui-user") =>
    fetchJson<{ success: boolean; message: string }>(`/seats/reserve`, {
      method: "POST", body: JSON.stringify({ seat_id, employee_id, actor }),
    }),
  allocateNewJoiner: (employee_id: number, preferred_floor_id?: number, actor = "ui-user") =>
    fetchJson<{ success: boolean; message: string; seat_number?: string }>(`/seats/allocate-new-joiner`, {
      method: "POST", body: JSON.stringify({ employee_id, preferred_floor_id, actor }),
    }),

  // Employees
  listEmployees: (params: {
    skip?: number; limit?: number; search?: string; department?: string;
    status?: string; project_id?: number; floor_id?: number; bay_id?: number;
    has_seat?: boolean;
  } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== "") q.set(k, String(v));
    });
    return fetchJson<PaginatedResponse<Employee>>(`/employees?${q.toString()}`);
  },
  listDepartments: () => fetchJson<string[]>("/employees/departments"),
  getEmployee: (id: number) => fetchJson<Employee>(`/employees/${id}`),
  createEmployee: (data: Partial<Employee>) =>
    fetchJson<Employee>("/employees", { method: "POST", body: JSON.stringify(data) }),
  updateEmployee: (id: number, data: Partial<Employee>) =>
    fetchJson<Employee>(`/employees/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteEmployee: (id: number) =>
    fetchJson<void>(`/employees/${id}`, { method: "DELETE" }),

  // AI Assistant
  aiQuery: (query: string) =>
    fetchJson<AIResponse>("/ai/query", { method: "POST", body: JSON.stringify({ query }) }),
  aiSuggestions: () => fetchJson<string[]>("/ai/suggestions"),
};
