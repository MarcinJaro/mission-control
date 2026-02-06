"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";

// Agent colors
const agentColors: Record<string, { bg: string; text: string; dot: string }> = {
  main: { bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "bg-cyan-400" },
  gilfoyl: { bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "bg-cyan-400" },
  bestia: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  marketing: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400" },
  maverick: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400" },
  ksiegowy: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  feliks: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  assistant: { bg: "bg-pink-500/10", text: "text-pink-400", dot: "bg-pink-400" },
  zosia: { bg: "bg-pink-500/10", text: "text-pink-400", dot: "bg-pink-400" },
  investor: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  gordon: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  allegro: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
  human: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  marcin: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
};

const agentNames: Record<string, string> = {
  main: "Gilfoyl",
  gilfoyl: "Gilfoyl",
  bestia: "Bestia",
  marketing: "Maverick",
  maverick: "Maverick",
  ksiegowy: "Feliks",
  feliks: "Feliks",
  assistant: "Zosia",
  zosia: "Zosia",
  investor: "Gordon",
  gordon: "Gordon",
  allegro: "Allegro",
  human: "Marcin",
  marcin: "Marcin",
};

const typeIcons: Record<string, string> = {
  task_created: "◉",
  task_updated: "◎",
  task_completed: "✓",
  task_assigned: "→",
  message_sent: "◈",
  chat_message: "◈",
  cron_executed: "⚡",
  agent_woke: "↑",
  file_created: "◇",
  custom: "•",
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("pl-PL", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function ActivityItem({ log }: { log: any }) {
  const colors = agentColors[log.agentId || "main"] || agentColors.main;
  const agentName = log.agentName || agentNames[log.agentId || ""] || log.agentId || "System";
  const icon = typeIcons[log.type] || "•";

  return (
    <div className="flex gap-4 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/30 px-2 -mx-2 rounded transition-colors">
      {/* Timeline dot */}
      <div className="flex flex-col items-center gap-1 pt-1">
        <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
        <div className="w-px flex-1 bg-zinc-800/50" />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Agent + Type */}
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-mono ${colors.text}`}>{agentName}</span>
              <span className="text-zinc-600 text-xs font-mono">{icon}</span>
              <span className="text-zinc-500 text-xs">{log.type.replace(/_/g, " ")}</span>
            </div>
            
            {/* Title */}
            <p className="text-zinc-200 text-sm">{log.title}</p>
            
            {/* Description */}
            {log.description && (
              <p className="text-zinc-500 text-xs mt-1 line-clamp-2">{log.description}</p>
            )}
          </div>
          
          {/* Time */}
          <div className="text-right shrink-0">
            <div className="text-xs text-zinc-500 font-mono">{formatTime(log.createdAt)}</div>
            <div className="text-[10px] text-zinc-600">{timeAgo(log.createdAt)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ stats }: { stats: any }) {
  if (!stats) return null;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
        <div className="text-2xl font-mono text-white">{stats.total}</div>
        <div className="text-xs text-zinc-500">actions (24h)</div>
      </div>
      
      {Object.entries(stats.byAgent || {}).slice(0, 3).map(([agent, count]) => {
        const colors = agentColors[agent] || agentColors.main;
        return (
          <div key={agent} className={`${colors.bg} border border-zinc-800 rounded-lg p-3`}>
            <div className={`text-2xl font-mono ${colors.text}`}>{count as number}</div>
            <div className="text-xs text-zinc-500">{agentNames[agent] || agent}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function ActivityPage() {
  const [filter, setFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  
  const logs = useQuery(api.activityLogs.recent, {
    limit: 100,
    agentId: filter || undefined,
    type: typeFilter || undefined,
  });
  
  const stats = useQuery(api.activityLogs.stats, { hoursAgo: 24 });
  
  // Also fetch chat messages and task updates as activity sources
  const chatMessages = useQuery(api.chat.recent, { limit: 30 });
  const recentMessages = useQuery(api.messages.recent, { limit: 30 });
  
  // Combine all activity sources
  const allActivity = [
    ...(logs || []),
    ...(chatMessages || []).map((m: any) => ({
      _id: m._id,
      type: "chat_message",
      agentId: m.authorId,
      agentName: m.authorName,
      title: m.content.substring(0, 100) + (m.content.length > 100 ? "..." : ""),
      createdAt: m.createdAt,
    })),
    ...(recentMessages || []).map((m: any) => ({
      _id: m._id,
      type: "message_sent",
      agentId: m.fromAgent?.sessionKey,
      agentName: m.fromAgent?.name,
      title: m.content.substring(0, 100) + (m.content.length > 100 ? "..." : ""),
      description: m.task?.title,
      createdAt: m.createdAt,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
  
  const agents = ["main", "bestia", "marketing", "ksiegowy", "assistant", "investor", "allegro", "marcin"];
  const types = ["task_created", "task_completed", "message_sent", "chat_message", "cron_executed"];

  return (
    <main className="min-h-screen bg-black p-4 md:p-6 pb-24 md:pb-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white font-mono">Activity Feed</h1>
            <p className="text-sm text-zinc-500 font-mono">Real-time agent activity tracking</p>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={filter || ""}
              onChange={(e) => setFilter(e.target.value || null)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300 font-mono"
            >
              <option value="">All agents</option>
              {agents.map(agent => (
                <option key={agent} value={agent}>{agentNames[agent]}</option>
              ))}
            </select>
            
            <select
              value={typeFilter || ""}
              onChange={(e) => setTypeFilter(e.target.value || null)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300 font-mono"
            >
              <option value="">All types</option>
              {types.map(type => (
                <option key={type} value={type}>{type.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Stats */}
        <StatsCard stats={stats} />
        
        {/* Activity List */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          {allActivity.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">◯</div>
              <p className="text-zinc-500 font-mono">No activity yet</p>
              <p className="text-zinc-600 text-sm mt-2">Agent actions will appear here</p>
            </div>
          ) : (
            <div className="space-y-0">
              {allActivity.map((log) => (
                <ActivityItem key={log._id} log={log} />
              ))}
            </div>
          )}
        </div>
        
        {/* Footer stats */}
        <div className="mt-4 text-xs text-zinc-600 font-mono text-center">
          Showing {allActivity.length} activities
        </div>
      </div>
    </main>
  );
}
