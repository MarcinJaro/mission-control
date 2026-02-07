"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import DashboardHeader from "../../components/DashboardHeader";
import { useSearchParams } from "next/navigation";
import React from "react";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const TYPE_ICONS: Record<string, string> = {
  deliverable: "📄",
  research: "🔬",
  protocol: "📋",
  note: "📝",
  spec: "📐",
  other: "📎",
};

const TYPE_COLORS: Record<string, string> = {
  deliverable: "text-emerald-400",
  research: "text-blue-400",
  protocol: "text-amber-400",
  note: "text-zinc-400",
  spec: "text-purple-400",
  other: "text-zinc-500",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Simple markdown renderer (headers, bold, code blocks, lists, tables)
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactElement[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${codeKey++}`} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-x-auto text-xs font-mono text-zinc-300 my-3">
            {codeLines.join("\n")}
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-2xl font-bold mt-6 mb-3 text-[var(--text-primary)]">{renderInline(line.slice(2))}</h1>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-xl font-semibold mt-5 mb-2 text-[var(--text-primary)]">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-lg font-medium mt-4 mb-2 text-[var(--text-primary)]">{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="border-zinc-800 my-4" />);
    } else if (line.startsWith("| ")) {
      // Table row - collect all table rows
      const tableRows: string[] = [line];
      while (i + 1 < lines.length && lines[i + 1].startsWith("|")) {
        i++;
        tableRows.push(lines[i]);
      }
      elements.push(
        <div key={i} className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {tableRows.filter(r => !r.match(/^\|[\s-|]+\|$/)).map((row, ri) => {
                const cells = row.split("|").filter(c => c.trim());
                const isHeader = ri === 0;
                return (
                  <tr key={ri} className={isHeader ? "border-b border-zinc-700" : "border-b border-zinc-800/50"}>
                    {cells.map((cell, ci) => 
                      isHeader 
                        ? <th key={ci} className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">{renderInline(cell.trim())}</th>
                        : <td key={ci} className="px-3 py-2 text-zinc-300">{renderInline(cell.trim())}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex gap-2 ml-2 my-0.5">
          <span className="text-zinc-600 mt-0.5">•</span>
          <span className="text-zinc-300 text-sm">{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-zinc-300 text-sm my-1">{renderInline(line)}</p>);
    }
  }

  return <div className="space-y-0">{elements}</div>;
}

function renderInline(text: string): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  // Bold, inline code, links
  const regex = /(\*\*(.+?)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++} className="font-semibold text-[var(--text-primary)]">{match[2]}</strong>);
    } else if (match[4]) {
      parts.push(<code key={key++} className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-400">{match[4]}</code>);
    } else if (match[6] && match[7]) {
      parts.push(<a key={key++} href={match[7]} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">{match[6]}</a>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length ? parts : [text];
}

function isImageMime(mime?: string | null): boolean {
  return !!mime && mime.startsWith("image/");
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Document viewer modal
function DocumentViewer({ docId, onClose }: { docId: string; onClose: () => void }) {
  const doc = useQuery(api.documents.get, { id: docId as Id<"documents"> });

  if (!doc) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasFile = !!doc.fileUrl;
  const isImage = isImageMime(doc.mimeType);
  const isPdf = doc.mimeType === "application/pdf";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-start justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{TYPE_ICONS[doc.type] || "📄"}</span>
              <h2 className="text-xl font-semibold">{doc.title}</h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              {doc.createdByAgent && (
                <span>{doc.createdByAgent.emoji} {doc.createdByAgent.name}</span>
              )}
              <span>v{doc.version}</span>
              <span>{timeAgo(doc.createdAt)}</span>
              {doc.fileName && <span className="font-mono">{doc.fileName}</span>}
              {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
              {doc.task && (
                <span className="bg-zinc-800 px-2 py-0.5 rounded">📋 {doc.task.title}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasFile && (
              <a
                href={doc.fileUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg transition-colors"
              >
                Download
              </a>
            )}
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Image */}
          {hasFile && isImage && (
            <div className="flex items-center justify-center">
              <img src={doc.fileUrl!} alt={doc.title} className="max-w-full max-h-[70vh] rounded-lg border border-zinc-800" />
            </div>
          )}

          {/* PDF */}
          {hasFile && isPdf && (
            <iframe src={doc.fileUrl!} className="w-full h-[70vh] rounded-lg border border-zinc-800" />
          )}

          {/* Other file - download prompt */}
          {hasFile && !isImage && !isPdf && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4 text-2xl">
                📎
              </div>
              <p className="text-zinc-300 mb-2">{doc.fileName || doc.title}</p>
              <p className="text-zinc-500 text-sm mb-4">{doc.mimeType} • {formatFileSize(doc.fileSize)}</p>
              <a
                href={doc.fileUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-lg transition-colors"
              >
                Download File
              </a>
            </div>
          )}

          {/* Markdown content */}
          {doc.content && <MarkdownContent content={doc.content} />}
        </div>
      </div>
    </div>
  );
}

// Document card
function DocCard({ doc, onClick }: { doc: any; onClick: () => void }) {
  const isNew = (Date.now() - doc.createdAt) < 3600000;
  const isImage = isImageMime(doc.mimeType);
  const hasFile = !!doc.fileUrl;

  return (
    <div
      onClick={onClick}
      className="card-glow group cursor-pointer hover:border-[var(--border-glow)] transition-all overflow-hidden"
    >
      {/* Image thumbnail */}
      {hasFile && isImage && (
        <div className="h-32 bg-zinc-800 overflow-hidden">
          <img src={doc.fileUrl} alt={doc.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-lg">
            {hasFile && isImage ? "🖼️" : TYPE_ICONS[doc.type] || "📄"}
          </div>
          <div className="flex items-center gap-2">
            {isNew && (
              <span className="bg-[var(--accent-dim)] text-[var(--accent)] px-2 py-0.5 rounded text-[10px] font-mono uppercase">
                new
              </span>
            )}
            <span className={cn("text-[10px] uppercase font-mono", TYPE_COLORS[doc.type] || "text-zinc-500")}>
              {doc.mimeType ? doc.mimeType.split("/")[1]?.toUpperCase() || doc.type : doc.type}
            </span>
          </div>
        </div>

        <h3 className="font-medium text-sm text-[var(--text-primary)] mb-1 truncate group-hover:text-[var(--accent)] transition-colors">
          {doc.title}
        </h3>

        <div className="flex items-center gap-2 mb-2 text-[10px] text-[var(--text-muted)] font-mono">
          {doc.createdByAgent && <span>{doc.createdByAgent.emoji} {doc.createdByAgent.name}</span>}
          <span className="text-[var(--border)]">•</span>
          <span>{timeAgo(doc.createdAt)}</span>
          {doc.fileSize && (
            <>
              <span className="text-[var(--border)]">•</span>
              <span>{formatFileSize(doc.fileSize)}</span>
            </>
          )}
        </div>

        {doc.content && (
          <p className="text-xs text-zinc-500 line-clamp-2">
            {doc.content.slice(0, 150).replace(/[#*`|]/g, "")}...
          </p>
        )}
      </div>
    </div>
  );
}

import { Suspense } from "react";

function DeliverablesContent() {
  const searchParams = useSearchParams();
  const docParam = searchParams.get("doc");
  const [selectedDoc, setSelectedDoc] = useState<string | null>(docParam);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const documents = useQuery(api.documents.list, {
    type: typeFilter !== "all" ? typeFilter : undefined,
    limit: 100,
  });

  const filteredDocs = documents || [];

  // Group by date
  const byDate: Record<string, any[]> = {};
  filteredDocs.forEach((d: any) => {
    const dateKey = new Date(d.createdAt).toISOString().split("T")[0];
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(d);
  });
  const sortedDates = Object.keys(byDate).sort().reverse();

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Type stats
  const typeCounts: Record<string, number> = {};
  (documents || []).forEach((d: any) => {
    typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;
  });

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--text-primary)]">
      <DashboardHeader
        rightContent={
          <>
            <span className="text-[var(--accent)] bg-[var(--accent-dim)] px-2 py-0.5 rounded text-xs font-mono">
              {documents?.length || 0} docs
            </span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="terminal-input px-3 py-1.5 text-sm"
            >
              <option value="all">All types</option>
              {Object.entries(typeCounts).map(([type, count]) => (
                <option key={type} value={type}>
                  {TYPE_ICONS[type]} {type} ({count})
                </option>
              ))}
            </select>
          </>
        }
      />

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Loading */}
        {!documents && (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[var(--text-muted)] font-mono text-sm">Loading...</p>
          </div>
        )}

        {/* Empty */}
        {documents && documents.length === 0 && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center mx-auto mb-4">
              <span className="text-[var(--text-muted)]">📄</span>
            </div>
            <p className="text-[var(--text-muted)] font-mono text-sm">No documents yet</p>
            <p className="text-[var(--text-muted)] font-mono text-xs mt-1">Agents create deliverables when completing tasks</p>
          </div>
        )}

        {/* Documents by Date */}
        {sortedDates.map(date => {
          let dateLabel = date;
          if (date === today) dateLabel = "Today";
          else if (date === yesterday) dateLabel = "Yesterday";

          return (
            <section key={date} className="mb-6 md:mb-8">
              <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] mb-4 flex items-center gap-3">
                <span>{dateLabel}</span>
                <span className="text-[var(--accent)]">{byDate[date].length}</span>
                <span className="flex-1 h-px bg-[var(--border)]" />
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {byDate[date].map((doc: any) => (
                  <DocCard
                    key={doc._id}
                    doc={doc}
                    onClick={() => setSelectedDoc(doc._id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* Document viewer */}
      {selectedDoc && (
        <DocumentViewer docId={selectedDoc} onClose={() => setSelectedDoc(null)} />
      )}
    </div>
  );
}

export default function DeliverablesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DeliverablesContent />
    </Suspense>
  );
}
