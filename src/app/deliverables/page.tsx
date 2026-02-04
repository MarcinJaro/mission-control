"use client";

import { useState, useEffect } from "react";

// Maverick's deliverables data
const DELIVERABLES = {
  documents: [
    {
      id: "competitor-matrix",
      name: "Competitor Pricing Matrix",
      description: "Senuto, Surfer, Contadu, MarketMuse — pricing, features, positioning vs BuzzRank.",
      type: "Strategy",
      project: "BuzzRank",
      date: "2026-02-04",
      path: "buzzrank-competitor-pricing-matrix.md",
    },
    {
      id: "testimonial-template",
      name: "Testimonial Collection Template",
      description: "Kwestionariusz, formaty (cytat, case study, video), placement guide.",
      type: "Template",
      project: "BuzzRank",
      date: "2026-02-04",
      path: "buzzrank-testimonial-template.md",
    },
    {
      id: "landing-copy",
      name: "Landing Page Copy (PL)",
      description: "4 warianty headline, wszystkie sekcje przetłumaczone, CTA po polsku.",
      type: "Copy",
      project: "BuzzRank",
      date: "2026-02-04",
      path: "buzzrank-landing-copy-pl.md",
    },
    {
      id: "onboarding-emails",
      name: "Onboarding Email Sequence",
      description: "5 emaili: Welcome → Feature → Success → Upgrade → Win-back.",
      type: "Email",
      project: "BuzzRank",
      date: "2026-02-04",
      path: "buzzrank-onboarding-emails.md",
    },
    {
      id: "linkedin-pack",
      name: "LinkedIn Content Pack",
      description: "Company page setup, 3 launch posty, content calendar, hashtagi.",
      type: "Social",
      project: "BuzzRank",
      date: "2026-02-04",
      path: "buzzrank-linkedin-content-pack.md",
    },
  ],
  graphics: [
    {
      id: "linkedin-banner",
      name: "LinkedIn Banner",
      description: "Cover image for LinkedIn company page. 2816x1536px.",
      type: "Banner",
      project: "BuzzRank",
      date: "2026-02-03",
      path: "2026-02-03-buzzrank-linkedin-banner.png",
    },
    {
      id: "linkedin-post-1",
      name: "LinkedIn Post Horizontal",
      description: "Workflow visualization. 2848x1504px.",
      type: "Post",
      project: "BuzzRank",
      date: "2026-02-03",
      path: "2026-02-03-buzzrank-linkedin-post-1.png",
    },
    {
      id: "linkedin-square",
      name: "LinkedIn Square Post",
      description: "AI content creation visual. 2048x2048px.",
      type: "Square",
      project: "BuzzRank",
      date: "2026-02-03",
      path: "2026-02-03-buzzrank-linkedin-square.png",
    },
  ],
};

const TYPE_COLORS: Record<string, string> = {
  Strategy: "bg-blue-500/20 text-blue-400",
  Template: "bg-purple-500/20 text-purple-400",
  Copy: "bg-emerald-500/20 text-emerald-400",
  Email: "bg-amber-500/20 text-amber-400",
  Social: "bg-pink-500/20 text-pink-400",
  Banner: "bg-orange-500/20 text-orange-400",
  Post: "bg-cyan-500/20 text-cyan-400",
  Square: "bg-indigo-500/20 text-indigo-400",
};

function FileCard({ 
  file, 
  onCopyPath 
}: { 
  file: typeof DELIVERABLES.documents[0]; 
  onCopyPath: (path: string) => void;
}) {
  const basePath = "~/.openclaw/agents/marketing/workspace";
  const isGraphic = file.path.endsWith('.png') || file.path.endsWith('.jpg');
  const fullPath = isGraphic 
    ? `${basePath}/${file.path}`
    : `${basePath}/deliverables/${file.path}`;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-zinc-700 transition-all hover:shadow-lg group">
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">
          {isGraphic ? "🖼️" : "📄"}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[file.type] || "bg-zinc-700 text-zinc-300"}`}>
          {file.type}
        </span>
      </div>
      
      <h3 className="font-semibold text-white mb-1">{file.name}</h3>
      <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{file.description}</p>
      
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-500">
          {file.project}
        </span>
        <span className="text-xs text-zinc-600">{file.date}</span>
      </div>
      
      <div className="flex items-center gap-2 pt-3 border-t border-zinc-800">
        <button
          onClick={() => onCopyPath(fullPath)}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-sm px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>📋</span>
          <span>Copy Path</span>
        </button>
        <button
          onClick={() => {
            const cmd = isGraphic ? `open "${fullPath}"` : `cat "${fullPath}"`;
            navigator.clipboard.writeText(cmd);
          }}
          className="bg-orange-600 hover:bg-orange-500 text-sm px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>📂</span>
          <span>Open</span>
        </button>
      </div>
    </div>
  );
}

export default function DeliverablesPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopied(path);
    setTimeout(() => setCopied(null), 2000);
  };

  const allFiles = [...DELIVERABLES.documents, ...DELIVERABLES.graphics];
  const projects = [...new Set(allFiles.map(f => f.project))];
  
  const filteredDocs = filter === "all" 
    ? DELIVERABLES.documents 
    : DELIVERABLES.documents.filter(d => d.project === filter);
  
  const filteredGraphics = filter === "all"
    ? DELIVERABLES.graphics
    : DELIVERABLES.graphics.filter(g => g.project === filter);

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
            <span className="text-sm text-zinc-500">Project:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Projects</option>
              {projects.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
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
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="text-3xl font-bold text-orange-500">{DELIVERABLES.documents.length}</div>
            <div className="text-sm text-zinc-500">Documents</div>
          </div>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="text-3xl font-bold text-orange-500">{DELIVERABLES.graphics.length}</div>
            <div className="text-sm text-zinc-500">Graphics</div>
          </div>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="text-3xl font-bold text-orange-500">{projects.length}</div>
            <div className="text-sm text-zinc-500">Projects</div>
          </div>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="text-3xl font-bold text-emerald-500">70%</div>
            <div className="text-sm text-zinc-500">BuzzRank Ready</div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-8">
          <p className="text-sm text-zinc-400">
            <span className="text-orange-500 font-medium">📂 Base path:</span>{" "}
            <code className="bg-zinc-800 px-2 py-0.5 rounded">~/.openclaw/agents/marketing/workspace/</code>
          </p>
        </div>

        {/* Documents */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>📄</span>
            <span>Documents</span>
            <span className="text-sm font-normal text-zinc-500">({filteredDocs.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map(doc => (
              <FileCard key={doc.id} file={doc} onCopyPath={handleCopyPath} />
            ))}
          </div>
        </section>

        {/* Graphics */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>🖼️</span>
            <span>Graphics</span>
            <span className="text-sm font-normal text-zinc-500">({filteredGraphics.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGraphics.map(graphic => (
              <FileCard key={graphic.id} file={graphic} onCopyPath={handleCopyPath} />
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-zinc-800 text-center text-sm text-zinc-600">
          🎯 Maverick Marketing Dashboard • Updated: 2026-02-04
        </footer>
      </main>
    </div>
  );
}
