"use client";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon: React.ReactNode;
  color?: "indigo" | "emerald" | "amber" | "violet" | "rose" | "slate" | "cyan";
  progress?: number; // 0-100, optional progress bar
}

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string; bar: string }> = {
  indigo:  { bg: "from-indigo-500 to-indigo-600",   text: "text-indigo-600",   ring: "ring-indigo-100",   bar: "from-indigo-500 to-violet-500" },
  emerald: { bg: "from-emerald-500 to-emerald-600", text: "text-emerald-600",  ring: "ring-emerald-100",  bar: "from-emerald-500 to-teal-500" },
  amber:   { bg: "from-amber-500 to-orange-500",    text: "text-amber-600",    ring: "ring-amber-100",    bar: "from-amber-500 to-orange-500" },
  violet:  { bg: "from-violet-500 to-purple-600",   text: "text-violet-600",   ring: "ring-violet-100",   bar: "from-violet-500 to-fuchsia-500" },
  rose:    { bg: "from-rose-500 to-pink-600",       text: "text-rose-600",     ring: "ring-rose-100",     bar: "from-rose-500 to-pink-500" },
  slate:   { bg: "from-slate-600 to-slate-700",     text: "text-slate-600",    ring: "ring-slate-100",    bar: "from-slate-500 to-slate-700" },
  cyan:    { bg: "from-cyan-500 to-blue-600",       text: "text-cyan-600",     ring: "ring-cyan-100",     bar: "from-cyan-500 to-blue-500" },
};

export default function StatCard({ label, value, hint, trend, trendValue, icon, color = "indigo", progress }: StatCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className="card card-hover overflow-hidden relative group">
      {/* Decorative gradient blob */}
      <div className={cn("absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br opacity-10 group-hover:opacity-20 transition-opacity", c.bg)}></div>

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</div>
          <div className="mt-1.5 flex items-center gap-1.5">
            {trend && trendValue && (
              <span className={cn(
                "inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded",
                trend === "up" && "bg-emerald-50 text-emerald-700",
                trend === "down" && "bg-rose-50 text-rose-700",
                trend === "neutral" && "bg-slate-100 text-slate-600"
              )}>
                {trend === "up" && "↑"}
                {trend === "down" && "↓"}
                {trend === "neutral" && "→"}
                {trendValue}
              </span>
            )}
            {hint && <span className="text-xs text-slate-500">{hint}</span>}
          </div>
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg ring-4",
          c.bg, c.ring
        )}>
          {icon}
        </div>
      </div>

      {progress !== undefined && (
        <div className="mt-4">
          <div className="progress">
            <div className={cn("progress-bar bg-gradient-to-r", c.bar)} style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}
    </div>
  );
}
