"use client";

export const dynamic = 'force-dynamic';

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

function timeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// Agent colors - matching dashboard theme
const agentColors: Record<string, string> = {
  main: "bg-[var(--accent)]",
  bestia: "bg-amber-500",
  marketing: "bg-violet-500",
  ksiegowy: "bg-blue-500",
  assistant: "bg-pink-500",
  investor: "bg-cyan-500",
  marcin: "bg-red-500",
  human: "bg-red-500",
};

// Agent avatars
const agentAvatars: Record<string, string> = {
  main: "/avatars/gilfoyl.jpg",
  bestia: "/avatars/bestia.jpg",
  marketing: "/avatars/maverick.jpg",
  ksiegowy: "/avatars/feliks.jpg",
  assistant: "/avatars/zosia.jpg",
  investor: "/avatars/gordon.jpg",
  marcin: "/avatars/marcin.jpg",
  human: "/avatars/marcin.jpg",
};

// Message bubble component - clean design
function MessageBubble({ message, isOwn }: { message: any; isOwn: boolean }) {
  const bgColor = agentColors[message.authorId] || "bg-zinc-600";
  const avatarUrl = agentAvatars[message.authorId];
  const initial = message.authorName?.charAt(0)?.toUpperCase() || "?";

  const highlightMentions = (content: string) => {
    return content.split(/(@\w+)/g).map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className="text-[var(--accent)] font-semibold">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={cn("flex gap-3 mb-4", isOwn && "flex-row-reverse")}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={message.authorName}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white",
            bgColor
          )}
          title={message.authorName}
        >
          {initial}
        </div>
      )}

      <div className={cn("max-w-[75%] md:max-w-[70%]", isOwn && "text-right")}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-[var(--text-primary)]">{message.authorName}</span>
          <span className="text-xs text-[var(--text-muted)] font-mono">{formatTime(message.createdAt)}</span>
        </div>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 inline-block text-left text-sm",
            isOwn ? "bg-[var(--accent)] text-[var(--bg-deep)]" : "bg-[var(--bg-elevated)] border border-[var(--border)]"
          )}
        >
          <p className="whitespace-pre-wrap">{highlightMentions(message.content)}</p>
        </div>
      </div>
    </div>
  );
}

// Online indicator - with avatars
function OnlineIndicator({ agents }: { agents: any[] | undefined }) {
  const onlineAgents = agents?.filter((a) => a.status === "active" || a.status === "idle") || [];

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {onlineAgents.slice(0, 4).map((agent) => {
          const avatarUrl = agentAvatars[agent.sessionKey];
          return avatarUrl ? (
            <img
              key={agent._id}
              src={avatarUrl}
              alt={agent.name}
              className="w-6 h-6 rounded-full object-cover border-2 border-[var(--bg-deep)]"
              title={agent.name}
            />
          ) : (
            <div
              key={agent._id}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-[var(--bg-deep)] text-white",
                agentColors[agent.sessionKey] || "bg-zinc-600"
              )}
              title={agent.name}
            >
              {agent.name?.charAt(0)}
            </div>
          );
        })}
      </div>
      <span className="text-xs text-[var(--text-muted)] font-mono">
        {onlineAgents.length} online
      </span>
    </div>
  );
}

// Router stats - minimal
function RouterStats() {
  const stats = useQuery(api.chat.routerStats, {});
  if (!stats) return null;

  return (
    <div className="hidden md:flex items-center gap-4 text-xs text-[var(--text-muted)] font-mono">
      <span>${stats.totalCost.toFixed(4)}</span>
      <span>{stats.totalMessages} routed</span>
    </div>
  );
}

export default function ChatPage() {
  const messages = useQuery(api.chat.list, { limit: 100 });
  const agents = useQuery(api.agents.list);
  const sendMessage = useMutation(api.chat.send);

  const [newMessage, setNewMessage] = useState("");
  const [sendAs, setSendAs] = useState("marcin");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    const authorName =
      sendAs === "marcin"
        ? "Marcin"
        : agents?.find((a) => a.sessionKey === sendAs)?.name || sendAs;

    await sendMessage({
      authorType: sendAs === "marcin" ? "human" : "agent",
      authorId: sendAs,
      authorName,
      content: newMessage,
    });

    setNewMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-deep)]">
      {/* Desktop Header */}
      <header className="hidden md:flex bg-[var(--bg-surface)] border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors font-mono text-sm">
              ← back
            </Link>
            <div className="h-4 w-px bg-[var(--border)]" />
            <h1 className="font-mono text-sm uppercase tracking-widest text-[var(--text-muted)]">
              Team Chat
            </h1>
            <OnlineIndicator agents={agents} />
          </div>
          <RouterStats />
        </div>
      </header>
      
      {/* Mobile subheader */}
      <div className="md:hidden bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 py-2 flex items-center justify-between">
        <OnlineIndicator agents={agents} />
      </div>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          {messages?.length === 0 && (
            <div className="text-center text-[var(--text-muted)] py-16">
              <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center mx-auto mb-4">
                <span className="text-[var(--accent)]">◈</span>
              </div>
              <p className="font-mono text-sm">No messages yet</p>
              <p className="text-xs mt-1">Use @mentions to ping agents</p>
            </div>
          )}

          {messages?.map((message) => (
            <MessageBubble
              key={message._id}
              message={message}
              isOwn={message.authorId === sendAs}
            />
          ))}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="bg-[var(--bg-surface)] border-t border-[var(--border)] p-3 md:p-4 safe-area-bottom">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row gap-2 md:gap-3">
          <div className="flex gap-2 md:contents">
            <select
              value={sendAs}
              onChange={(e) => setSendAs(e.target.value)}
              className="terminal-input flex-1 md:flex-none md:min-w-[140px] px-3 py-2 text-sm"
            >
              <option value="marcin">Marcin</option>
              {agents?.map((agent) => (
                <option key={agent._id} value={agent.sessionKey}>
                  {agent.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleSend}
              disabled={!newMessage.trim()}
              className={cn(
                "md:hidden px-4 py-2 rounded-lg transition-all font-medium text-sm",
                newMessage.trim()
                  ? "btn-primary"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-not-allowed"
              )}
            >
              Send
            </button>
          </div>

          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (@name to mention)"
              rows={1}
              className="terminal-input w-full px-4 py-2.5 pr-16 text-sm resize-none"
              style={{ minHeight: "44px", maxHeight: "120px" }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] font-mono">
              enter ↵
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className={cn(
              "hidden md:block px-6 py-2.5 rounded-lg transition-all font-medium",
              newMessage.trim()
                ? "btn-primary"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-not-allowed"
            )}
          >
            Send
          </button>
        </div>

        {/* Mention hints */}
        <div className="max-w-3xl mx-auto mt-2 text-[10px] text-[var(--text-muted)] overflow-x-auto whitespace-nowrap scrollbar-hide font-mono">
          {agents?.map((agent) => (
            <button
              key={agent._id}
              onClick={() => setNewMessage((m) => m + `@${agent.name} `)}
              className="hover:text-[var(--accent)] transition-colors mx-1.5"
            >
              @{agent.name}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
