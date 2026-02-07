"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

interface DashboardHeaderProps {
  rightContent?: React.ReactNode;
}

export default function DashboardHeader({ rightContent }: DashboardHeaderProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Board", icon: "◉" },
    { href: "/chat", label: "Chat", icon: "◈" },
    { href: "/deliverables", label: "Deliverables", icon: "◇" },
    { href: "/metrics", label: "Metrics", icon: "◆" },
  ];

  return (
    <header className="hidden md:flex bg-[var(--bg-surface)] border-b border-[var(--border)] px-6 py-4 animate-in">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold flex items-center gap-3 text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
            <span className="text-2xl">⌘</span>
            <span className="font-mono tracking-tight">MISSION<span className="text-[var(--accent)]">_</span>CTRL</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "btn-ghost text-sm flex items-center gap-2 transition-colors",
                  pathname === item.href && "text-[var(--accent)] bg-[var(--accent-dim)]"
                )}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
        {rightContent && (
          <div className="flex items-center gap-3">
            {rightContent}
          </div>
        )}
      </div>
    </header>
  );
}
