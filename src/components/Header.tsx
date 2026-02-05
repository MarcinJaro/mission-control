"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();

  const navItems = [
    { href: "/", label: "Dashboard", icon: "🎯" },
    { href: "/chat", label: "Chat", icon: "💬" },
    { href: "/deliverables", label: "Deliverables", icon: "📦" },
  ];

  return (
    <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-bold flex items-center gap-2 hover:opacity-80">
            <span>🎯</span>
            <span>Mission Control</span>
          </Link>
          
          <nav className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                  pathname === item.href
                    ? "bg-orange-600"
                    : "bg-zinc-800 hover:bg-zinc-700"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {isLoaded && user && (
            <span className="text-sm text-zinc-400">
              {user.firstName || user.emailAddresses[0]?.emailAddress}
            </span>
          )}
          <UserButton 
            afterSignOutUrl="/sign-in"
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              }
            }}
          />
        </div>
      </div>
    </header>
  );
}
