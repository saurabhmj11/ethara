"use client";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: "up" | "down" | "neutral";
  icon?: string;
  color?: "blue" | "green" | "amber" | "violet" | "rose" | "slate";
}

const COLOR_MAP: Record<string, string> = {
  blue: "from-blue-500 to-blue-600",
  green: "from-emerald-500 to-emerald-600",
  amber: "from-amber-500 to-amber-600",
  violet: "from-violet-500 to-violet-600",
  rose: "from-rose-500 to-rose-600",
  slate: "from-slate-500 to-slate-600",
};

export default function StatCard({ label, value, hint, trend, icon, color = "blue" }: StatCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
          {hint && (
            <div className={cn(
              "mt-1 text-xs",
              trend === "up" && "text-emerald-600",
              trend === "down" && "text-rose-600",
              (!trend || trend === "neutral") && "text-slate-500"
            )}>
              {hint}
            </div>
          )}
        </div>
        {icon && (
          <div className={cn(
            "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-xl",
            COLOR_MAP[color]
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
