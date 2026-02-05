import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// All agents' deliverables directories
const DELIVERABLE_SOURCES = [
  { agent: "marketing", name: "Maverick", emoji: "🎯", path: "/Users/marcin/.openclaw/agents/marketing/workspace/deliverables" },
  { agent: "bestia", name: "Bestia", emoji: "🦁", path: "/Users/marcin/.openclaw/agents/bestia/workspace/deliverables" },
  { agent: "ksiegowy", name: "Feliks", emoji: "📊", path: "/Users/marcin/.openclaw/agents/ksiegowy/workspace/deliverables" },
  { agent: "assistant", name: "Zosia", emoji: "✨", path: "/Users/marcin/.openclaw/agents/assistant/workspace/deliverables" },
  { agent: "investor", name: "Gordon", emoji: "🐺", path: "/Users/marcin/.openclaw/agents/investor/workspace/deliverables" },
  { agent: "main", name: "Gilfoyl", emoji: "🤖", path: "/Users/marcin/.openclaw/workspace-main/deliverables" },
];

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export async function GET() {
  const files: DeliverableFile[] = [];

  for (const source of DELIVERABLE_SOURCES) {
    if (!fs.existsSync(source.path)) continue;

    try {
      const entries = fs.readdirSync(source.path);
      
      for (const entry of entries) {
        if (entry.startsWith(".")) continue;
        
        const fullPath = path.join(source.path, entry);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) continue;

        const ext = path.extname(entry).toLowerCase();
        const isImage = [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext);

        files.push({
          id: `${source.agent}-${entry}`,
          name: entry,
          agent: source.agent,
          agentName: source.name,
          agentEmoji: source.emoji,
          mtime: stats.mtime.toISOString(),
          size: stats.size,
          sizeFormatted: formatSize(stats.size),
          ext,
          isImage,
          downloadUrl: `/api/deliverables/${source.agent}/${encodeURIComponent(entry)}`,
        });
      }
    } catch (err) {
      console.error(`Error reading ${source.path}:`, err);
    }
  }

  // Sort by date (newest first)
  files.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());

  return NextResponse.json({
    files,
    count: files.length,
    sources: DELIVERABLE_SOURCES.map(s => ({ agent: s.agent, name: s.name, emoji: s.emoji })),
  });
}
