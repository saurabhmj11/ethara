/**
 * Type definitions matching backend Pydantic schemas.
 */

export interface Project {
  id: number;
  name: string;
  code: string;
  description?: string;
  manager_name?: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  employee_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Floor {
  id: number;
  name: string;
  code: string;
  description?: string;
  bay_count?: number;
  seat_count?: number;
  occupied_count?: number;
}

export interface Bay {
  id: number;
  name: string;
  code: string;
  floor_id: number;
  capacity: number;
  floor_name?: string;
  seat_count?: number;
  occupied_count?: number;
}

export type SeatStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";

export interface Seat {
  id: number;
  seat_number: string;
  bay_id: number;
  status: SeatStatus;
  reserved_for_employee_id?: number;
  bay_name?: string;
  floor_name?: string;
  occupant_name?: string;
  occupant_emp_code?: string;
  created_at: string;
  updated_at: string;
}

export type EmployeeStatus = "ACTIVE" | "ONBOARDING" | "INACTIVE";

export interface Employee {
  id: number;
  emp_code: string;
  full_name: string;
  email: string;
  phone?: string;
  department?: string;
  designation?: string;
  status: EmployeeStatus;
  join_date?: string;
  project_id?: number;
  seat_id?: number;
  manager_name?: string;
  project_name?: string;
  project_code?: string;
  seat_number?: string;
  bay_name?: string;
  floor_name?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_employees: number;
  active_employees: number;
  new_joiners: number;
  total_seats: number;
  occupied_seats: number;
  available_seats: number;
  reserved_seats: number;
  maintenance_seats: number;
  utilization_pct: number;
  total_projects: number;
  active_projects: number;
  total_floors: number;
  total_bays: number;
}

export interface FloorUtilization {
  floor_name: string;
  total: number;
  occupied: number;
  available: number;
  utilization_pct: number;
}

export interface ProjectDistribution {
  project_name: string;
  project_code: string;
  employee_count: number;
}

export interface DepartmentDistribution {
  department: string;
  employee_count: number;
}

export interface ActivityLog {
  id: number;
  action: string;
  actor?: string;
  employee_id?: number;
  seat_id?: number;
  details?: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AIResponse {
  query: string;
  answer: string;
  data?: any;
  sql?: string;
  intent?: string;
  elapsed_ms: number;
}
