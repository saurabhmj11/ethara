"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/employees", label: "Employees", icon: "👥" },
  { href: "/projects", label: "Projects", icon: "📁" },
  { href: "/seats", label: "Seat Map", icon: "🪑" },
  { href: "/new-joiners", label: "New Joiners", icon: "✨" },
  { href: "/analytics", label: "Analytics", icon: "📈" },
  { href: "/ai-assistant", label: "AI Assistant", icon: "🤖" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed top-0 left-0 w-64 h-screen bg-slate-900 text-white flex flex-col z-50">
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-500 rounded-lg flex items-center justify-center font-bold text-lg">
            E
          </div>
          <div>
            <div className="font-semibold text-base leading-tight">Ethara</div>
            <div className="text-xs text-slate-400">Seat Allocation System</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-700">
        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <span className="text-lg">📘</span>
          API Docs (Swagger)
        </a>
      </div>
    </aside>
  );
}
