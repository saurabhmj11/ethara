"use client";

export function LoadingSpinner({ size = "md", label }: { size?: "sm" | "md" | "lg"; label?: string }) {
  const cls = size === "lg" ? "spinner spinner-lg" : size === "sm" ? "spinner" : "spinner";
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
      <span className={cls} />
      {label && <span className="text-sm font-medium">{label}</span>}
    </div>
  );
}

export function ErrorState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="card border-rose-200 bg-rose-50">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-rose-900">Something went wrong</h3>
          <p className="text-sm text-rose-700 mt-1">{message}</p>
          {hint && <p className="text-xs text-rose-500 mt-2">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="skeleton h-3 w-20 mb-3"></div>
          <div className="skeleton h-8 w-24 mb-2"></div>
          <div className="skeleton h-3 w-32"></div>
        </div>
        <div className="skeleton w-12 h-12 rounded-xl"></div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      {icon && <div className="text-5xl mb-3 opacity-40">{icon}</div>}
      <h3 className="text-base font-semibold text-slate-700">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
