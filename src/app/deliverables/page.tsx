"use client";

// Force dynamic rendering (skip static generation)
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";

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

const EXT_ICONS: Record<string, string> = {
  ".md": "📝",
  ".txt": "📄",
  ".json": "📊",
  ".csv": "📊",
  ".pdf": "📕",
  ".html": "🌐",
  ".png": "🖼️",
  ".jpg": "🖼️",
  ".jpeg": "🖼️",
  ".gif": "🖼️",
  ".webp": "🖼️",
};

function FileCard({ 
  file, 
  onCopyPath,
  showAgent = true,
}: { 
  file: DeliverableFile; 
  onCopyPath: (path: string) => void;
  showAgent?: boolean;
}) {
  const icon = EXT_ICONS[file.ext] || "📄";
  const isNew = (Date.now() - new Date(file.mtime).getTime()) < 3600000; // Last hour
  const date = new Date(file.mtime);
  const timeStr = date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const dateStr = date.toISOString().split("T")[0];

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-zinc-700 transition-all hover:shadow-lg group">
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex items-center gap-2">
          {isNew && (
            <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full text-xs font-medium">
              NEW
            </span>
          )}
          {showAgent && (
            <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">
              {file.agentEmoji} {file.agentName}
            </span>
          )}
        </div>
      </div>
      
      <h3 className="font-semibold text-white mb-1 truncate" title={file.name}>
        {file.name}
      </h3>
      
      <div className="flex items-center gap-2 mb-3 text-xs text-zinc-500">
        <span>{dateStr}</span>
        <span>•</span>
        <span>{timeStr}</span>
        <span>•</span>
        <span>{file.sizeFormatted}</span>
      </div>
      
      <div className="flex items-center gap-2 pt-3 border-t border-zinc-800">
        <a
          href={file.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-sm px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>👁️</span>
          <span>View</span>
        </a>
        <a
          href={`${file.downloadUrl}?download=true`}
          className="bg-orange-600 hover:bg-orange-500 text-sm px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>⬇️</span>
          <span>Download</span>
        </a>
      </div>
    </div>
  );
}

export default function DeliverablesPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchDeliverables();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDeliverables, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDeliverables = async () => {
    try {
      // Fetch from local maverick server via tunnel
      const res = await fetch("https://maverick.creativerebels.pl/api/files");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError("Failed to load deliverables - is maverick server running?");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopied(path);
    setTimeout(() => setCopied(null), 2000);
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

  // Stats per agent
  const agentStats = data?.sources.map(s => ({
    ...s,
    count: data.files.filter(f => f.agent === s.agent).length,
  })) || [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-xl font-bold flex items-center gap-2 hover:opacity-80">
              <span>🎯</span>
              <span>Mission Control</span>
            </a>
            <a 
              href="/chat" 
              className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              <span>💬</span>
              <span>Chat</span>
            </a>
            <a 
              href="/deliverables" 
              className="bg-orange-600 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"
            >
              <span>📦</span>
              <span>Deliverables</span>
            </a>
          </div>
          
          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Agent:</span>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Agents ({data?.count || 0})</option>
              {agentStats.map(s => (
                <option key={s.agent} value={s.agent}>
                  {s.emoji} {s.name} ({s.count})
                </option>
              ))}
            </select>
            <button
              onClick={fetchDeliverables}
              className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              🔄
            </button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {copied && (
        <div className="fixed top-20 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
          ✓ Path copied!
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {agentStats.map(s => (
            <button
              key={s.agent}
              onClick={() => setAgentFilter(s.agent === agentFilter ? "all" : s.agent)}
              className={`rounded-xl border p-4 transition-all ${
                s.agent === agentFilter
                  ? "bg-orange-600/20 border-orange-500"
                  : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div className="text-2xl mb-1">{s.emoji}</div>
              <div className="text-2xl font-bold text-orange-500">{s.count}</div>
              <div className="text-xs text-zinc-500">{s.name}</div>
            </button>
          ))}
        </div>

        {/* Loading/Error */}
        {loading && (
          <div className="text-center py-12 text-zinc-500">
            Loading deliverables...
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-400">
            {error}
          </div>
        )}

        {/* Files by Date */}
        {!loading && !error && sortedDates.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            No deliverables yet
          </div>
        )}

        {sortedDates.map(date => {
          let dateLabel = date;
          if (date === today) dateLabel = `📅 Today (${date})`;
          else if (date === yesterday) dateLabel = `📅 Yesterday (${date})`;
          else dateLabel = `📅 ${date}`;

          return (
            <section key={date} className="mb-8">
              <h2 className="text-lg font-semibold mb-4 text-orange-400">
                {dateLabel}
                <span className="text-sm font-normal text-zinc-500 ml-2">
                  ({byDate[date].length} files)
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {byDate[date].map(file => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onCopyPath={handleCopyPath}
                    showAgent={agentFilter === "all"}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-zinc-800 text-center text-sm text-zinc-600">
          📦 Team Deliverables • Auto-refreshes every 30s
        </footer>
      </main>
    </div>
  );
}
