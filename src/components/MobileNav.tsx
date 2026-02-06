"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const NAV_ITEMS = [
  { label: "Tasks", href: "/", icon: "◉" },
  { label: "Chat", href: "/chat", icon: "◈" },
  { label: "Files", href: "/deliverables", icon: "◇" },
  { label: "Metrics", href: "/metrics", icon: "◆" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[var(--bg-deep)] z-50 flex items-center justify-between px-4 border-b border-[var(--border)] safe-area-top">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="text-lg font-mono text-[var(--accent)]">⌘</span>
          <span className="font-mono font-bold tracking-tight text-sm text-[var(--text-primary)]">
            MC<span className="text-[var(--accent)]">_</span>
          </span>
        </div>

        {/* New Task Button (mobile) */}
        <Link
          href="/?new=true"
          className="btn-primary px-3 py-1.5 text-sm font-mono flex items-center gap-1"
        >
          <span>+</span>
          <span>new</span>
        </Link>
      </div>

      {/* Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--bg-surface)] border-t border-[var(--border)] z-50 flex items-center justify-around px-2 safe-area-bottom">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl transition-all",
                isActive
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-muted)]"
              )}
            >
              <span className={cn(
                "text-lg font-mono transition-transform",
                isActive && "scale-110"
              )}>
                {item.icon}
              </span>
              <span className="text-[9px] font-mono uppercase tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

// Desktop sidebar with navigation
export function DesktopHeader({ 
  children,
  showNewTask,
  onNewTask,
}: { 
  children?: React.ReactNode;
  showNewTask?: boolean;
  onNewTask?: () => void;
}) {
  const pathname = usePathname();

  return (
    <header className="hidden md:flex bg-zinc-900 border-b border-zinc-800 px-6 py-4 animate-in">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold flex items-center gap-3 text-zinc-100">
            <span className="text-2xl">⌘</span>
            <span className="font-mono tracking-tight">
              MISSION<span className="text-emerald-500">_</span>CTRL
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link 
              href="/chat" 
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors",
                pathname === "/chat" 
                  ? "bg-zinc-800 text-emerald-400" 
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              )}
            >
              <span>💬</span>
              <span>Chat</span>
            </Link>
            <Link 
              href="/deliverables" 
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors",
                pathname === "/deliverables" 
                  ? "bg-zinc-800 text-emerald-400" 
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              )}
            >
              <span>📦</span>
              <span>Deliverables</span>
            </Link>
            <Link 
              href="/metrics" 
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors",
                pathname === "/metrics" 
                  ? "bg-zinc-800 text-emerald-400" 
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              )}
            >
              <span>📊</span>
              <span>Metrics</span>
            </Link>
          </nav>
          {children}
        </div>
        {showNewTask && onNewTask && (
          <button
            onClick={onNewTask}
            className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2"
          >
            <span className="font-mono">+</span>
            <span>New Task</span>
          </button>
        )}
      </div>
    </header>
  );
}
