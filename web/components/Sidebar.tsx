"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/review", label: "Review", icon: "⚡" },
  { href: "/history", label: "History", icon: "📋" },
  { href: "/traces", label: "Traces", icon: "🔭" },
  { href: "/strategy", label: "Strategy", icon: "🧠" },
  { href: "/improvement", label: "Improvement", icon: "📈" },
  { href: "/architecture", label: "Architecture", icon: "🗺" },
  { href: "/pr-reviews", label: "PR Reviews", icon: "🔀" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <>
      <aside
        style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
        className="w-48 hidden md:flex flex-col shrink-0"
      >
        <div className="px-4 py-5 border-b" style={{ borderColor: "var(--border)" }}>
          <span style={{ color: "var(--accent)" }} className="text-sm font-bold tracking-widest uppercase">
            TraceForge
          </span>
        </div>
        <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
          {NAV.map(({ href, label, icon }) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors"
                style={{
                  background: active ? "var(--accent-dim, #4c1d95)" : "transparent",
                  color: active ? "#fff" : "var(--muted)",
                }}
              >
                <span>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <nav
        className="flex md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
        }}
      >
        {NAV.map(({ href, label, icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center flex-1 py-2 gap-0.5"
              style={{
                color: active ? "var(--accent)" : "var(--muted)",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
              <span style={{ fontSize: 10 }}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
