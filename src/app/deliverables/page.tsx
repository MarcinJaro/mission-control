"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import DashboardHeader from "../../components/DashboardHeader";

interface DeliverableFile {
  id: string;
  name: string;
  agent: string;
  agentName: string;
  agentEmoji: string;
  mtime: string;
  size: number;
  sizeFormatted: string;
  ext: string;
  isImage: boolean;
  downloadUrl: string;
}

interface ApiResponse {
  files: DeliverableFile[];
  count: number;
  sources: { agent: string; name: string; emoji: string }[];
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// Extension icons - minimal text
const EXT_LABELS: Record<string, string> = {
  ".md": "MD",
  ".txt": "TXT",
  ".json": "JSON",
  ".csv": "CSV",
  ".pdf": "PDF",
  ".html": "HTML",
  ".png": "IMG",
  ".jpg": "IMG",
  ".jpeg": "IMG",
  ".gif": "GIF",
  ".webp": "IMG",
};

// Agent initials
const AGENT_INITIALS: Record<string, string> = {
  main: "G",
  bestia: "B",
  marketing: "M",
  ksiegowy: "F",
  assistant: "Z",
  investor: "G",
};

// File Card - clean design
function FileCard({ 
  file, 
  showAgent = true,
}: { 
  file: DeliverableFile; 
  showAgent?: boolean;
}) {
  const extLabel = EXT_LABELS[file.ext] || "FILE";
  const isNew = (Date.now() - new Date(file.mtime).getTime()) < 3600000;
  const date = new Date(file.mtime);
  const timeStr = date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const dateStr = date.toISOString().split("T")[0];

  return (
    <div className="card-glow p-4 group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center font-mono text-xs text-[var(--text-muted)]">
          {extLabel}
        </div>
        <div className="flex items-center gap-2">
          {isNew && (
            <span className="bg-[var(--accent-dim)] text-[var(--accent)] px-2 py-0.5 rounded text-[10px] font-mono uppercase">
              new
            </span>
          )}
          {showAgent && (
            <span className="text-[10px] bg-[var(--bg-elevated)] px-2 py-0.5 rounded text-[var(--text-muted)] font-mono">
              {file.agentName}
            </span>
          )}
        </div>
      </div>
      
      <h3 className="font-medium text-sm text-[var(--text-primary)] mb-1 truncate group-hover:text-[var(--accent)] transition-colors" title={file.name}>
        {file.name}
      </h3>
      
      <div className="flex items-center gap-2 mb-4 text-[10px] text-[var(--text-muted)] font-mono">
        <span>{dateStr}</span>
        <span className="text-[var(--border)]">•</span>
        <span>{timeStr}</span>
        <span className="text-[var(--border)]">•</span>
        <span>{file.sizeFormatted}</span>
      </div>
      
      <div className="flex items-center gap-2 pt-3 border-t border-[var(--border)]">
        <a
          href={file.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 btn-ghost text-xs py-2 text-center"
        >
          View
        </a>
        <a
          href={`${file.downloadUrl}?download=true`}
          className="btn-primary text-xs py-2 px-4"
        >
          Download
        </a>
      </div>
    </div>
  );
}

// Agent stat button
function AgentStatButton({
  agent,
  name,
  count,
  isActive,
  onClick,
}: {
  agent: string;
  name: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-shrink-0 w-20 md:w-auto rounded-xl border p-3 md:p-4 transition-all text-left",
        isActive
          ? "bg-[var(--accent-dim)] border-[var(--accent)]"
          : "bg-[var(--bg-surface)] border-[var(--border)] hover:border-[var(--border-glow)]"
      )}
    >
      <div className="w-7 h-7 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center font-mono text-xs text-[var(--text-muted)] mb-2">
        {AGENT_INITIALS[agent] || name.charAt(0)}
      </div>
      <div className={cn(
        "text-xl font-bold font-mono",
        isActive ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
      )}>
        {count}
      </div>
      <div className="text-[10px] text-[var(--text-muted)] truncate font-mono">{name}</div>
    </button>
  );
}

export default function DeliverablesPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>("all");

  useEffect(() => {
    fetchDeliverables();
    const interval = setInterval(fetchDeliverables, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDeliverables = async () => {
    try {
      const res = await fetch("https://maverick.creativerebels.pl/api/files");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError("Server offline");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = data?.files.filter(
    f => agentFilter === "all" || f.agent === agentFilter
  ) || [];

  // Group by date
  const byDate: Record<string, DeliverableFile[]> = {};
  filteredFiles.forEach(f => {
    const dateKey = f.mtime.split("T")[0];
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(f);
  });
  const sortedDates = Object.keys(byDate).sort().reverse();

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const agentStats = data?.sources.map(s => ({
    ...s,
    count: data.files.filter(f => f.agent === s.agent).length,
  })) || [];

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--text-primary)]">
      <DashboardHeader
        rightContent={
          <>
            <span className="text-[var(--accent)] bg-[var(--accent-dim)] px-2 py-0.5 rounded text-xs font-mono">
              {data?.count || 0} files
            </span>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="terminal-input px-3 py-1.5 text-sm"
            >
              <option value="all">All agents</option>
              {agentStats.map(s => (
                <option key={s.agent} value={s.agent}>
                  {s.name} ({s.count})
                </option>
              ))}
            </select>
            <button
              onClick={fetchDeliverables}
              className="btn-ghost px-3 py-1.5 text-sm"
            >
              Refresh
            </button>
          </>
        }
      />
      
      {/* Mobile Filter Bar */}
      <div className="md:hidden bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 py-3 flex items-center gap-2">
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="terminal-input flex-1 px-3 py-2 text-sm"
        >
          <option value="all">All ({data?.count || 0})</option>
          {agentStats.map(s => (
            <option key={s.agent} value={s.agent}>
              {s.name} ({s.count})
            </option>
          ))}
        </select>
        <button
          onClick={fetchDeliverables}
          className="btn-ghost px-3 py-2 text-sm"
        >
          ↻
        </button>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Agent Stats - horizontal scroll on mobile */}
        <div className="flex md:grid md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6 md:mb-8 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {agentStats.map(s => (
            <AgentStatButton
              key={s.agent}
              agent={s.agent}
              name={s.name}
              count={s.count}
              isActive={s.agent === agentFilter}
              onClick={() => setAgentFilter(s.agent === agentFilter ? "all" : s.agent)}
            />
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[var(--text-muted)] font-mono text-sm">Loading...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400">!</span>
            </div>
            <p className="text-[var(--text-muted)] font-mono text-sm">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && sortedDates.length === 0 && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center mx-auto mb-4">
              <span className="text-[var(--text-muted)]">◇</span>
            </div>
            <p className="text-[var(--text-muted)] font-mono text-sm">No deliverables</p>
          </div>
        )}

        {/* Files by Date */}
        {sortedDates.map(date => {
          let dateLabel = date;
          if (date === today) dateLabel = `Today`;
          else if (date === yesterday) dateLabel = `Yesterday`;

          return (
            <section key={date} className="mb-6 md:mb-8">
              <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] mb-4 flex items-center gap-3">
                <span>{dateLabel}</span>
                <span className="text-[var(--accent)]">{byDate[date].length}</span>
                <span className="flex-1 h-px bg-[var(--border)]" />
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {byDate[date].map(file => (
                  <FileCard
                    key={file.id}
                    file={file}
                    showAgent={agentFilter === "all"}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-[var(--border)] text-center">
          <p className="text-[10px] text-[var(--text-muted)] font-mono">
            Auto-refresh: 30s
          </p>
        </footer>
      </main>
    </div>
  );
}
