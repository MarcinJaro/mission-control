"use client";

import { useState, useEffect } from "react";
import DashboardHeader from "../../components/DashboardHeader";

// Types for cron jobs
interface CronJob {
  id: string;
  name: string;
  agentId: string;
  enabled: boolean;
  schedule: {
    kind: "at" | "every" | "cron";
    at?: string;
    everyMs?: number;
    expr?: string;
    tz?: string;
  };
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: string;
  };
}

// Agent colors
const agentColors: Record<string, { bg: string; text: string; border: string }> = {
  main: { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-500/30" },
  bestia: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" },
  marketing: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30" },
  ksiegowy: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" },
  assistant: { bg: "bg-pink-500/20", text: "text-pink-400", border: "border-pink-500/30" },
  investor: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
  allegro: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" },
};

const agentNames: Record<string, string> = {
  main: "Gilfoyl",
  bestia: "Bestia",
  marketing: "Maverick",
  ksiegowy: "Feliks",
  assistant: "Zosia",
  investor: "Gordon",
  allegro: "Allegro",
};

// Helper to format time
function formatTime(date: Date): string {
  return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(ms: number): string {
  const now = Date.now();
  const diff = ms - now;
  
  if (diff < 0) return "Past";
  
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `In ${minutes} min`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `In ${hours} hours`;
  
  const days = Math.floor(hours / 24);
  return `In ${days} days`;
}

function formatInterval(ms: number): string {
  const minutes = ms / 60000;
  if (minutes < 60) return `Every ${minutes} min`;
  const hours = minutes / 60;
  if (hours < 24) return `Every ${hours}h`;
  const days = hours / 24;
  return `Every ${days}d`;
}

// Parse cron expression to get next occurrences
function parseCronToTimes(expr: string, tz?: string): { hour: number; minute: number; days: number[] } | null {
  // Simple parser for common patterns: "0 9 * * *" = 9:00 daily
  const parts = expr.split(" ");
  if (parts.length !== 5) return null;
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  // Parse days of week (0 = Sunday, 1-5 = Mon-Fri, etc.)
  let days: number[] = [];
  if (dayOfWeek === "*") {
    days = [0, 1, 2, 3, 4, 5, 6];
  } else if (dayOfWeek.includes("-")) {
    const [start, end] = dayOfWeek.split("-").map(Number);
    for (let i = start; i <= end; i++) days.push(i);
  } else if (dayOfWeek.includes(",")) {
    days = dayOfWeek.split(",").map(Number);
  } else {
    days = [parseInt(dayOfWeek)];
  }
  
  return {
    hour: parseInt(hour),
    minute: parseInt(minute),
    days,
  };
}

// Get week dates
function getWeekDates(): Date[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dayOfWeek);
  
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + i);
    return date;
  });
}

// Components
function AlwaysRunningBadge({ job }: { job: CronJob }) {
  const colors = agentColors[job.agentId] || agentColors.main;
  const interval = job.schedule.everyMs 
    ? formatInterval(job.schedule.everyMs)
    : job.schedule.expr || "recurring";
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md ${colors.bg} ${colors.border} border`}>
      <span className={`text-sm font-mono ${colors.text}`}>{job.name}</span>
      <span className="text-xs text-zinc-500">◦</span>
      <span className="text-xs text-zinc-400">{interval}</span>
    </div>
  );
}

function CalendarBlock({ job, hour }: { job: CronJob; hour: number }) {
  const colors = agentColors[job.agentId] || agentColors.main;
  
  return (
    <div className={`p-1.5 rounded text-xs truncate ${colors.bg} ${colors.text} border ${colors.border}`}>
      <div className="font-medium truncate">{job.name.replace(/^[🦁🎯📊✨🐺🛒🌅] /, "").substring(0, 15)}...</div>
      <div className="text-[10px] opacity-70">{hour}:00</div>
    </div>
  );
}

function NextUpItem({ job }: { job: CronJob }) {
  const colors = agentColors[job.agentId] || agentColors.main;
  const nextRun = job.state?.nextRunAtMs;
  
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
      <span className={`text-sm ${colors.text}`}>{job.name.replace(/^[🦁🎯📊✨🐺🛒🌅] /, "")}</span>
      <span className="text-xs text-zinc-500">
        {nextRun ? formatRelative(nextRun) : "—"}
      </span>
    </div>
  );
}

export default function SchedulePage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "today">("week");
  
  // Fetch cron jobs
  useEffect(() => {
    async function fetchJobs() {
      try {
        const res = await fetch("/api/crons");
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
        }
      } catch (err) {
        console.error("Failed to fetch crons:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, []);
  
  const enabledJobs = jobs.filter(j => j.enabled);
  const alwaysRunning = enabledJobs.filter(j => j.schedule.kind === "every");
  const cronJobs = enabledJobs.filter(j => j.schedule.kind === "cron");
  const oneShots = enabledJobs.filter(j => j.schedule.kind === "at");
  
  // Build calendar data
  const weekDates = getWeekDates();
  const calendarData: Record<number, Record<number, CronJob[]>> = {};
  
  // Initialize
  for (let day = 0; day < 7; day++) {
    calendarData[day] = {};
    for (let hour = 5; hour < 24; hour++) {
      calendarData[day][hour] = [];
    }
  }
  
  // Populate from cron jobs
  cronJobs.forEach(job => {
    const parsed = parseCronToTimes(job.schedule.expr || "");
    if (parsed) {
      parsed.days.forEach(day => {
        if (calendarData[day] && calendarData[day][parsed.hour]) {
          calendarData[day][parsed.hour].push(job);
        }
      });
    }
  });
  
  // Next up - sorted by nextRunAtMs
  const nextUp = enabledJobs
    .filter(j => j.state?.nextRunAtMs && j.state.nextRunAtMs > Date.now())
    .sort((a, b) => (a.state?.nextRunAtMs || 0) - (b.state?.nextRunAtMs || 0))
    .slice(0, 8);
  
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date().getDay();
  
  if (loading) {
    return (
      <main className="min-h-screen bg-black p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-zinc-800 rounded w-48 mb-6" />
            <div className="h-64 bg-zinc-900 rounded-lg" />
          </div>
        </div>
      </main>
    );
  }
  
  return (
    <div className="min-h-screen bg-[var(--bg-deep)]">
      <DashboardHeader
        rightContent={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("week")}
              className={`px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                view === "week" 
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]" 
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView("today")}
              className={`px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                view === "today" 
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]" 
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Today
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              ↻
            </button>
          </div>
        }
      />
      <main className="p-4 md:p-6 pb-24 md:pb-6">
        <div className="max-w-7xl mx-auto">
        
        {/* Always Running */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-amber-400">⚡</span>
            <span className="text-white font-mono font-medium">Always Running</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alwaysRunning.length > 0 ? (
              alwaysRunning.map(job => <AlwaysRunningBadge key={job.id} job={job} />)
            ) : (
              <span className="text-zinc-500 text-sm">No recurring tasks</span>
            )}
          </div>
        </div>
        
        {/* Calendar Grid */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 mb-6 overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Day headers */}
            <div className="grid grid-cols-8 gap-2 mb-2">
              <div className="text-xs text-zinc-600 font-mono" /> {/* Time column */}
              {dayNames.map((day, i) => (
                <div 
                  key={day}
                  className={`text-center text-sm font-mono py-2 rounded ${
                    i === today ? "bg-cyan-500/20 text-cyan-400" : "text-zinc-400"
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>
            
            {/* Time slots */}
            <div className="space-y-1">
              {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map(hour => (
                <div key={hour} className="grid grid-cols-8 gap-2">
                  <div className="text-xs text-zinc-600 font-mono py-1 text-right pr-2">
                    {hour}:00
                  </div>
                  {[0, 1, 2, 3, 4, 5, 6].map(day => (
                    <div 
                      key={day}
                      className={`min-h-[32px] rounded border ${
                        day === today 
                          ? "border-cyan-500/20 bg-cyan-500/5" 
                          : "border-zinc-800/50 bg-zinc-900/30"
                      }`}
                    >
                      {calendarData[day][hour]?.map(job => (
                        <CalendarBlock key={job.id} job={job} hour={hour} />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Next Up */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-zinc-400">◇</span>
            <span className="text-white font-mono font-medium">Next Up</span>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {nextUp.length > 0 ? (
              nextUp.map(job => <NextUpItem key={job.id} job={job} />)
            ) : (
              <span className="text-zinc-500 text-sm">No upcoming tasks</span>
            )}
          </div>
        </div>
        
        {/* Stats */}
        <div className="mt-6 flex items-center gap-6 text-xs text-zinc-600 font-mono">
          <span>{enabledJobs.length} active jobs</span>
          <span>{alwaysRunning.length} recurring</span>
          <span>{cronJobs.length} scheduled</span>
          <span>{oneShots.length} one-shot</span>
        </div>
      </div>
    </main>
    </div>
  );
}
