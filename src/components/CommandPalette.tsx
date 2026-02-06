"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  type: "task" | "message" | "chat" | "page";
  title: string;
  subtitle?: string;
  href?: string;
  agentId?: string;
}

const agentColors: Record<string, string> = {
  main: "text-cyan-400",
  gilfoyl: "text-cyan-400",
  bestia: "text-amber-400",
  marketing: "text-purple-400",
  ksiegowy: "text-emerald-400",
  assistant: "text-pink-400",
  investor: "text-red-400",
  allegro: "text-orange-400",
  marcin: "text-blue-400",
};

const typeIcons: Record<string, string> = {
  task: "◉",
  message: "◈",
  chat: "◈",
  page: "◇",
};

// Static pages for navigation
const PAGES: SearchResult[] = [
  { id: "page-tasks", type: "page", title: "Tasks", subtitle: "Kanban board", href: "/" },
  { id: "page-chat", type: "page", title: "Chat", subtitle: "Agent coordination", href: "/chat" },
  { id: "page-schedule", type: "page", title: "Schedule", subtitle: "Cron calendar", href: "/schedule" },
  { id: "page-activity", type: "page", title: "Activity", subtitle: "Activity feed", href: "/activity" },
  { id: "page-deliverables", type: "page", title: "Deliverables", subtitle: "Files & documents", href: "/deliverables" },
  { id: "page-metrics", type: "page", title: "Metrics", subtitle: "Business dashboards", href: "/metrics" },
];

function SearchResultItem({ 
  result, 
  isSelected, 
  onClick 
}: { 
  result: SearchResult; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  const icon = typeIcons[result.type] || "•";
  const agentColor = result.agentId ? agentColors[result.agentId] || "text-zinc-400" : "";
  
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
        isSelected 
          ? "bg-zinc-800 text-white" 
          : "text-zinc-300 hover:bg-zinc-800/50"
      }`}
    >
      <span className={`font-mono text-sm ${isSelected ? "text-cyan-400" : "text-zinc-500"}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate">{result.title}</span>
          {result.agentId && (
            <span className={`text-xs font-mono ${agentColor}`}>
              {result.agentId}
            </span>
          )}
        </div>
        {result.subtitle && (
          <div className="text-xs text-zinc-500 truncate">{result.subtitle}</div>
        )}
      </div>
      <span className="text-xs text-zinc-600 font-mono uppercase">{result.type}</span>
    </button>
  );
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Fetch tasks and messages for search
  const tasks = useQuery(api.tasks.list, {});
  const chatMessages = useQuery(api.chat.recent, { limit: 50 });

  // Build search results
  const results: SearchResult[] = [];
  
  const lowerQuery = query.toLowerCase();
  
  // Add matching pages
  if (query.length === 0) {
    results.push(...PAGES);
  } else {
    PAGES.forEach(page => {
      if (page.title.toLowerCase().includes(lowerQuery) || 
          page.subtitle?.toLowerCase().includes(lowerQuery)) {
        results.push(page);
      }
    });
  }
  
  // Add matching tasks
  if (tasks && query.length > 0) {
    tasks.forEach((task: any) => {
      if (task.title.toLowerCase().includes(lowerQuery) ||
          task.description?.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: `task-${task._id}`,
          type: "task",
          title: task.title,
          subtitle: `${task.status} • ${task.priority}`,
          href: `/?task=${task._id}`,
          agentId: task.assignees?.[0]?.sessionKey,
        });
      }
    });
  }
  
  // Add matching chat messages
  if (chatMessages && query.length > 0) {
    chatMessages.forEach((msg: any) => {
      if (msg.content.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: `chat-${msg._id}`,
          type: "chat",
          title: msg.content.substring(0, 60) + (msg.content.length > 60 ? "..." : ""),
          subtitle: msg.authorName,
          href: "/chat",
          agentId: msg.authorId,
        });
      }
    });
  }

  // Limit results
  const limitedResults = results.slice(0, 10);

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, limitedResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && limitedResults[selectedIndex]) {
      e.preventDefault();
      const result = limitedResults[selectedIndex];
      if (result.href) {
        router.push(result.href);
        setIsOpen(false);
      }
    }
  }, [limitedResults, selectedIndex, router]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    if (result.href) {
      router.push(result.href);
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors"
      >
        <span className="font-mono">⌘K</span>
        <span>Search</span>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="fixed inset-x-4 top-[20%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[600px] z-50">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
            <span className="text-zinc-500 font-mono">⌕</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search tasks, messages, pages..."
              className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-zinc-600 text-sm"
            />
            <kbd className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-500 font-mono">ESC</kbd>
          </div>
          
          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {limitedResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-zinc-500 text-sm">
                {query ? "No results found" : "Start typing to search..."}
              </div>
            ) : (
              <div className="py-2">
                {limitedResults.map((result, index) => (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    isSelected={index === selectedIndex}
                    onClick={() => handleSelect(result)}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-4 text-xs text-zinc-600">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> select</span>
            <span><kbd className="font-mono">esc</kbd> close</span>
          </div>
        </div>
      </div>
    </>
  );
}
