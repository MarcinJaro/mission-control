"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// Utility functions
function timeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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

// Agent colors for avatars
const agentColors: Record<string, string> = {
  main: "bg-emerald-600",
  bestia: "bg-amber-600",
  marketing: "bg-purple-600",
  ksiegowy: "bg-blue-600",
  assistant: "bg-pink-600",
  investor: "bg-cyan-600",
  marcin: "bg-red-600",
  human: "bg-red-600",
};

// Agent emojis
const agentEmojis: Record<string, string> = {
  main: "🤖",
  bestia: "🦁",
  marketing: "🎯",
  ksiegowy: "📊",
  assistant: "✨",
  investor: "🐺",
  marcin: "👤",
  human: "👤",
};

// Message bubble component
function MessageBubble({ message, isOwn }: { message: any; isOwn: boolean }) {
  const bgColor = agentColors[message.authorId] || "bg-zinc-700";
  const emoji = agentEmojis[message.authorId] || "👤";

  // Highlight @mentions in content
  const highlightMentions = (content: string) => {
    return content.split(/(@\w+)/g).map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className="text-emerald-400 font-semibold">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={cn("flex gap-3 mb-4", isOwn && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0",
          bgColor
        )}
        title={message.authorName}
      >
        {emoji}
      </div>

      {/* Message content */}
      <div className={cn("max-w-[70%]", isOwn && "text-right")}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">{message.authorName}</span>
          <span className="text-xs text-zinc-500">{formatTime(message.createdAt)}</span>
          {message.editedAt && (
            <span className="text-xs text-zinc-600">(edited)</span>
          )}
        </div>
        <div
          className={cn(
            "rounded-2xl px-4 py-2 inline-block text-left",
            isOwn ? "bg-emerald-600" : "bg-zinc-800"
          )}
        >
          <p className="whitespace-pre-wrap">{highlightMentions(message.content)}</p>
        </div>
        {message.mentions?.length > 0 && (
          <div className="text-xs text-zinc-500 mt-1">
            mentions: {message.mentions.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

// Online indicator
function OnlineIndicator({ agents }: { agents: any[] | undefined }) {
  const onlineAgents = agents?.filter((a) => a.status === "active" || a.status === "idle") || [];

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {onlineAgents.slice(0, 5).map((agent) => (
          <div
            key={agent._id}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 border-zinc-900",
              agentColors[agent.sessionKey] || "bg-zinc-700"
            )}
            title={agent.name}
          >
            {agent.emoji}
          </div>
        ))}
      </div>
      <span className="text-sm text-zinc-500">
        {onlineAgents.length} online
      </span>
    </div>
  );
}

// Router stats display
function RouterStats() {
  const stats = useQuery(api.chat.routerStats, {});

  if (!stats) return null;

  return (
    <div className="flex items-center gap-4 text-xs text-zinc-500">
      <span>Router: ${stats.totalCost.toFixed(4)} today</span>
      <span>{stats.totalMessages} routed</span>
      <span>{stats.triggeredCount} triggered</span>
    </div>
  );
}

// Main Chat Page
export default function ChatPage() {
  const messages = useQuery(api.chat.list, { limit: 100 });
  const agents = useQuery(api.agents.list);
  const sendMessage = useMutation(api.chat.send);

  const [newMessage, setNewMessage] = useState("");
  const [sendAs, setSendAs] = useState("marcin");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
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
    <div className="min-h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              ← Back
            </Link>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span>💬</span>
              <span>MC Chat</span>
            </h1>
            <OnlineIndicator agents={agents} />
          </div>
          <RouterStats />
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {messages?.length === 0 && (
            <div className="text-center text-zinc-500 py-12">
              <p className="text-4xl mb-4">💬</p>
              <p>No messages yet. Start the conversation!</p>
              <p className="text-sm mt-2">
                Use @mentions to ping specific agents
              </p>
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
      <footer className="bg-zinc-900 border-t border-zinc-800 p-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          {/* Send as selector */}
          <select
            value={sendAs}
            onChange={(e) => setSendAs(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm min-w-[140px]"
          >
            <option value="marcin">👤 Marcin</option>
            {agents?.map((agent) => (
              <option key={agent._id} value={agent.sessionKey}>
                {agent.emoji} {agent.name}
              </option>
            ))}
          </select>

          {/* Message input */}
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (use @name to mention, Enter to send)"
              rows={1}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 pr-20 focus:outline-none focus:border-zinc-600 resize-none"
              style={{ minHeight: "44px", maxHeight: "120px" }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
              Enter ↵
            </div>
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className={cn(
              "px-6 py-2 rounded-lg transition-colors font-medium",
              newMessage.trim()
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            )}
          >
            Send
          </button>
        </div>

        {/* Mention hints */}
        <div className="max-w-4xl mx-auto mt-2 text-xs text-zinc-600">
          Quick mentions:{" "}
          {agents?.map((agent) => (
            <button
              key={agent._id}
              onClick={() => setNewMessage((m) => m + `@${agent.name} `)}
              className="hover:text-zinc-400 transition-colors mx-1"
            >
              @{agent.name}
            </button>
          ))}
          <button
            onClick={() => setNewMessage((m) => m + "@Marcin ")}
            className="hover:text-zinc-400 transition-colors mx-1"
          >
            @Marcin
          </button>
        </div>
      </footer>
    </div>
  );
}
