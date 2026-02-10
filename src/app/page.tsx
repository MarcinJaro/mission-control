"use client";

// Force dynamic rendering (skip static generation)
export const dynamic = 'force-dynamic';

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardHeader from "../components/DashboardHeader";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// Avatar Component
function Avatar({ 
  agent, 
  size = "md" 
}: { 
  agent: { emoji?: string; avatarUrl?: string; name?: string }; 
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizeClasses = {
    sm: "w-6 h-6 text-sm",
    md: "w-8 h-8 text-lg",
    lg: "w-10 h-10 text-xl",
    xl: "w-12 h-12 text-2xl",
  };
  
  if (agent.avatarUrl) {
    return (
      <img 
        src={agent.avatarUrl} 
        alt={agent.name || "Avatar"}
        className={cn(sizeClasses[size], "rounded-full object-cover")}
      />
    );
  }
  
  return (
    <div className={cn(
      sizeClasses[size], 
      "rounded-full bg-zinc-800 flex items-center justify-center"
    )}>
      {agent.emoji || "👤"}
    </div>
  );
}

// Agent Card Component
function AgentCard({ agent }: { agent: any }) {
  return (
    <div className="card-glow p-4">
      <div className="flex items-center gap-3">
        <div className={cn(
          "relative",
          agent.status === "active" && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-deep)] rounded-full"
        )}>
          <Avatar agent={agent} size="lg" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate text-[var(--text-primary)]">{agent.name}</h3>
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                agent.status === "active" && "status-active",
                agent.status === "idle" && "status-idle",
                agent.status === "blocked" && "status-blocked",
                agent.status === "offline" && "status-offline"
              )}
            />
          </div>
          <p className="text-sm text-[var(--text-secondary)] truncate font-mono text-xs">{agent.role}</p>
        </div>
      </div>
      {agent.lastSeenAt && (
        <p className="text-xs text-[var(--text-muted)] mt-3 font-mono">
          ↳ {timeAgo(agent.lastSeenAt)}
        </p>
      )}
    </div>
  );
}

// Activity Item Component
function ActivityItem({ activity }: { activity: any }) {
  return (
    <div className="activity-item flex items-start gap-3 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors px-2 -mx-2 rounded">
      <Avatar agent={activity.agent || { emoji: "📋" }} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)]">{activity.message}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">{timeAgo(activity.createdAt)}</p>
      </div>
    </div>
  );
}

// Priority colors - refined accents
const priorityColors: Record<string, string> = {
  low: "border-l-[var(--text-muted)]",
  medium: "border-l-indigo-400",
  high: "border-l-amber-400",
  urgent: "border-l-red-400",
};

// Status colors - with glow
const statusColors: Record<string, string> = {
  inbox: "bg-[var(--text-muted)]",
  assigned: "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]",
  in_progress: "bg-[var(--accent)] shadow-[0_0_8px_var(--accent-dim)]",
  review: "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.5)]",
  done: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]",
  blocked: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]",
};

// Task Card Component (for drag overlay)
const deliverableIcons: Record<string, string> = {
  report: "📄",
  code: "💻",
  design: "🎨",
  doc: "📝",
  link: "🔗",
  other: "📎",
};

function TaskCardContent({ task }: { task: any }) {
  return (
    <>
      <h4 className="font-medium text-sm mb-2 line-clamp-2">{task.title}</h4>
      <div className="flex items-center justify-between mt-2">
        {task.assignees?.length > 0 && (
          <div className="flex items-center gap-1">
            {task.assignees.slice(0, 3).map((agent: any) => (
              <div key={agent?._id} title={agent?.name}>
                <Avatar agent={agent || { emoji: "👤" }} size="sm" />
              </div>
            ))}
            {task.assignees.length > 3 && (
              <span className="text-xs text-zinc-500">+{task.assignees.length - 3}</span>
            )}
          </div>
        )}
        {task.deliverables?.length > 0 && (
          <div className="flex items-center gap-0.5" title={`${task.deliverables.length} deliverable(s)`}>
            {task.deliverables.slice(0, 4).map((d: any) => (
              <span key={d.id} className="text-xs opacity-70 hover:opacity-100 transition-opacity" title={d.title}>
                {deliverableIcons[d.type] || "📎"}
              </span>
            ))}
            {task.deliverables.length > 4 && (
              <span className="text-[10px] text-zinc-500">+{task.deliverables.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// Sortable Task Card Component
function SortableTaskCard({
  task,
  onClick,
  onDelete,
}: {
  task: any;
  onClick: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirm(`Delete "${task.title}"?`)) {
      onDelete();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border)] border-l-4 cursor-grab active:cursor-grabbing",
        "hover:border-[var(--border-glow)] hover:bg-[var(--bg-elevated)] transition-all duration-200 touch-none group relative",
        priorityColors[task.priority] || "border-l-[var(--text-muted)]",
        isDragging && "shadow-2xl ring-2 ring-[var(--accent)] scale-105"
      )}
    >
      <button
        onClick={handleDelete}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all text-[var(--text-muted)] hover:text-red-400 p-1.5 rounded-lg hover:bg-[var(--bg-hover)]"
        title="Delete task"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
      <TaskCardContent task={task} />
    </div>
  );
}

// Static Task Card (for overlay)
function TaskCard({ task }: { task: any }) {
  return (
    <div
      className={cn(
        "bg-[var(--bg-elevated)] rounded-xl p-3 border border-[var(--accent)] border-l-4",
        "shadow-2xl shadow-[var(--accent-dim)] ring-2 ring-[var(--accent)] scale-105",
        priorityColors[task.priority] || "border-l-[var(--text-muted)]"
      )}
    >
      <TaskCardContent task={task} />
    </div>
  );
}

// Kanban Column Component
function KanbanColumn({
  title,
  tasks,
  status,
  onTaskClick,
  onTaskDelete,
}: {
  title: string;
  tasks: any[];
  status: string;
  onTaskClick: (task: any) => void;
  onTaskDelete: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex-shrink-0 w-[280px] md:w-auto md:flex-1 md:min-w-[250px] md:max-w-[300px] snap-center">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--border)]">
        <div className={cn("w-2.5 h-2.5 rounded-full", statusColors[status])} />
        <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] font-medium">
          {title}
        </h3>
        <span className="text-xs text-[var(--accent)] bg-[var(--accent-dim)] px-2.5 py-0.5 rounded-full font-mono font-semibold">
          {tasks.length}
        </span>
      </div>
      <SortableContext
        items={tasks.map((t) => t._id)}
        strategy={verticalListSortingStrategy}
      >
        <div 
          ref={setNodeRef}
          className={cn(
            "space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 min-h-[100px] rounded-xl p-2 -m-2 transition-all duration-200",
            isOver && "bg-[var(--accent-dim)] ring-2 ring-[var(--accent)]"
          )}
        >
          {tasks.map((task) => (
            <SortableTaskCard 
              key={task._id} 
              task={task} 
              onClick={() => onTaskClick(task)}
              onDelete={() => onTaskDelete(task._id)}
            />
          ))}
          {tasks.length === 0 && (
            <div className={cn(
              "text-[var(--text-muted)] text-sm text-center py-10 border-2 border-dashed rounded-xl transition-all duration-200 font-mono",
              isOver ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]" : "border-[var(--border)]"
            )}>
              {isOver ? "↳ drop here" : "∅ empty"}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Task Detail Modal
function TaskDetail({
  task,
  onClose,
}: {
  task: any;
  onClose: () => void;
}) {
  const fullTask = useQuery(api.tasks.get, { id: task._id });
  const agents = useQuery(api.agents.list);
  const [newComment, setNewComment] = useState("");
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const addMessage = useMutation(api.messages.create);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const assignTask = useMutation(api.tasks.assign);

  // Issue 2: Always comment as user (main)
  const commentAs = "human";

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await addMessage({
        taskId: task._id,
        content: newComment,
        agentSessionKey: commentAs,
      });
      setNewComment("");
      setShowMentions(false);
    } catch (err) {
      console.error("Failed to send comment:", err);
      alert("Failed to send comment. Check console for details.");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateStatus({
      id: task._id,
      status: newStatus as any,
      agentSessionKey: "main",
    });
  };

  const handleToggleAssignee = async (agentId: Id<"agents">) => {
    if (!fullTask) return;
    const currentIds = fullTask.assigneeIds || [];
    const newIds = currentIds.includes(agentId)
      ? currentIds.filter((id) => id !== agentId)
      : [...currentIds, agentId];
    await assignTask({
      id: task._id,
      assigneeIds: newIds,
      agentSessionKey: "main",
    });
  };

  // Issue 3: Quick tag agents
  const insertMention = (agentName: string) => {
    const before = newComment.slice(0, cursorPosition);
    const after = newComment.slice(cursorPosition);
    setNewComment(before + `@${agentName} ` + after);
    setCursorPosition(before.length + agentName.length + 2);
  };

  // Issue 4: @mention autocomplete
  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart || 0;
    setNewComment(value);
    setCursorPosition(cursor);

    // Check for @ symbol
    const beforeCursor = value.slice(0, cursor);
    const atMatch = beforeCursor.match(/@(\w*)$/);
    
    if (atMatch) {
      setMentionFilter(atMatch[1].toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (agentName: string) => {
    const beforeCursor = newComment.slice(0, cursorPosition);
    const afterCursor = newComment.slice(cursorPosition);
    const beforeAt = beforeCursor.replace(/@\w*$/, '');
    setNewComment(beforeAt + `@${agentName} ` + afterCursor);
    setCursorPosition(beforeAt.length + agentName.length + 2);
    setShowMentions(false);
  };

  const filteredAgents = agents?.filter(agent => 
    mentionFilter ? agent.name.toLowerCase().includes(mentionFilter) : true
  );

  if (!fullTask) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="p-4 border-b border-zinc-800 flex items-start justify-between flex-shrink-0">
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{fullTask.title}</h2>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <select
                value={fullTask.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm"
              >
                <option value="inbox">📥 Inbox</option>
                <option value="assigned">📌 Assigned</option>
                <option value="in_progress">🚧 In Progress</option>
                <option value="review">👀 Review</option>
                <option value="done">✅ Done</option>
                <option value="blocked">🚫 Blocked</option>
              </select>
              
              {/* Assignees */}
              <div className="relative">
                <button
                  onClick={() => setShowAssignMenu(!showAssignMenu)}
                  className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded px-3 py-1 text-sm hover:border-zinc-600"
                >
                  {fullTask.assignees?.length > 0 ? (
                    <>
                      {fullTask.assignees.map((agent: any) => (
                        <span key={agent?._id} title={agent?.name}>
                          {agent?.emoji}
                        </span>
                      ))}
                      <span className="text-zinc-400 ml-1">▼</span>
                    </>
                  ) : (
                    <>
                      <span className="text-zinc-500">+ Assign</span>
                      <span className="text-zinc-400">▼</span>
                    </>
                  )}
                </button>
                
                {showAssignMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 min-w-[200px]">
                    <div className="p-2 border-b border-zinc-700 text-xs text-zinc-500 uppercase">
                      Assign to agents
                    </div>
                    {agents?.map((agent) => {
                      const isAssigned = fullTask.assigneeIds?.includes(agent._id);
                      return (
                        <button
                          key={agent._id}
                          onClick={() => handleToggleAssignee(agent._id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-700 text-left",
                            isAssigned && "bg-zinc-700/50"
                          )}
                        >
                          <span className="text-lg">{agent.emoji}</span>
                          <span className="flex-1">{agent.name}</span>
                          {isAssigned && <span className="text-emerald-500">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Issue 1: Scrollable content area (description + deliverables + messages) */}
        <div className="flex-1 overflow-y-auto">
          {/* Description */}
          {fullTask.description && (
            <div className="p-4 border-b border-zinc-800">
              <p className="text-zinc-300 whitespace-pre-wrap">{fullTask.description}</p>
            </div>
          )}

          {/* Deliverables */}
          {(fullTask.deliverables?.length ?? 0) > 0 && (
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-xs uppercase text-zinc-500 font-semibold mb-3 tracking-wider">Deliverables</h3>
              <div className="grid grid-cols-2 gap-2">
                {fullTask.deliverables!.map((d: any) => (
                  <a
                    key={d.id}
                    href={d.url.startsWith("/") ? d.url : d.url}
                    target={d.url.startsWith("/") ? "_self" : "_blank"}
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 rounded-lg px-3 py-2 transition-all group"
                  >
                    <span className="text-lg">{deliverableIcons[d.type] || "📎"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-emerald-400 transition-colors">{d.title}</p>
                    </div>
                    <svg className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="p-4 space-y-4">
            {fullTask.messages?.map((msg: any) => (
              <div key={msg._id} className="flex items-start gap-3">
                <Avatar agent={msg.fromAgent || { emoji: "👤" }} size="md" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{msg.fromAgent?.name || "Unknown"}</span>
                    <span className="text-xs text-zinc-500">{timeAgo(msg.createdAt)}</span>
                  </div>
                  <p className="text-zinc-300 mt-1 whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {(!fullTask.messages || fullTask.messages.length === 0) && (
              <p className="text-zinc-500 text-center py-4">No comments yet</p>
            )}
          </div>
        </div>

        {/* Comment input - Fixed at bottom */}
        <div className="p-4 border-t border-zinc-800 flex-shrink-0">
          {/* Issue 3: Quick tag agent chips */}
          <div className="flex flex-wrap gap-1 mb-2">
            {agents?.map((agent) => (
              <button
                key={agent._id}
                onClick={() => insertMention(agent.name)}
                className="inline-flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded px-2 py-1 text-xs transition-colors"
                title={`Mention @${agent.name}`}
              >
                <span>{agent.emoji}</span>
                <span className="hidden sm:inline">{agent.name}</span>
              </button>
            ))}
          </div>

          <div className="relative">
            {/* Issue 4: @mention dropdown */}
            {showMentions && filteredAgents && filteredAgents.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-20 min-w-[200px] max-h-[200px] overflow-y-auto">
                {filteredAgents.map((agent) => (
                  <button
                    key={agent._id}
                    onClick={() => selectMention(agent.name)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-700 text-left"
                  >
                    <span className="text-lg">{agent.emoji}</span>
                    <span className="flex-1">{agent.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 items-center">
              {/* Issue 2: Fixed user label instead of dropdown */}
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm flex items-center gap-1">
                <span>👤</span>
                <span className="hidden sm:inline">Marcin</span>
              </div>
              <input
                type="text"
                value={newComment}
                onChange={handleCommentChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !showMentions) {
                    handleAddComment();
                  } else if (e.key === "Escape") {
                    setShowMentions(false);
                  }
                }}
                placeholder="Add a comment... (type @ to mention)"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-zinc-600"
              />
              <button
                onClick={handleAddComment}
                className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Create Task Modal
function CreateTaskModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const agents = useQuery(api.agents.list);
  const createTask = useMutation(api.tasks.create);

  const handleToggleAgent = (agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await createTask({
      title,
      description: description || undefined,
      priority: priority as any,
      assigneeIds: selectedAgents.length > 0 ? selectedAgents as any : undefined,
      createdBySessionKey: "main",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 max-w-lg w-full p-6">
        <h2 className="text-xl font-semibold mb-4">Create Task</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Task title..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-zinc-600"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description..."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-zinc-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2"
              >
                <option value="low">🟢 Low</option>
                <option value="medium">🔵 Medium</option>
                <option value="high">🟠 High</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Assign to</label>
            <div className="flex flex-wrap gap-2">
              {agents?.map((agent) => {
                const isSelected = selectedAgents.includes(agent._id);
                return (
                  <button
                    key={agent._id}
                    onClick={() => handleToggleAgent(agent._id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors",
                      isSelected
                        ? "bg-zinc-700 border-zinc-600"
                        : "bg-zinc-800 border-zinc-700 hover:border-zinc-600"
                    )}
                  >
                    <span>{agent.emoji}</span>
                    <span className="text-sm">{agent.name}</span>
                    {isSelected && <span className="text-emerald-500 text-sm">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-zinc-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg transition-colors"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}

// Stats Bar
function StatsBar() {
  const stats = useQuery(api.activities.stats);

  if (!stats) return null;

  return (
    <div className="flex items-center gap-6 text-sm font-mono">
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-muted)]">today:</span>
        <span className="text-[var(--text-primary)]">{stats.activitiesToday}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-emerald-400">✓{stats.tasksCompleted}</span>
        <span className="text-[var(--accent)]">◉{stats.tasksInProgress}</span>
        <span className="text-[var(--text-muted)]">○{stats.tasksInbox}</span>
      </div>
    </div>
  );
}

// Activity Sheet Component
function ActivitySheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const activities = useQuery(api.activities.feed, { limit: 30 });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />
          
          {/* Sheet */}
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-[var(--bg-surface)] border-r border-[var(--border)] z-40 flex flex-col"
          >
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] font-medium">
                Activity Feed
              </h2>
              <button
                onClick={onClose}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {activities?.map((activity, i) => (
                <div key={activity._id} style={{ animationDelay: `${i * 0.05}s` }}>
                  <ActivityItem activity={activity} />
                </div>
              ))}
              {(!activities || activities.length === 0) && (
                <p className="text-[var(--text-muted)] text-center py-8 font-mono text-sm">∅ no activity</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Agents Sheet Component
function AgentsSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const agents = useQuery(api.agents.list);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />
          
          {/* Sheet */}
          <motion.div
            initial={{ x: 288 }}
            animate={{ x: 0 }}
            exit={{ x: 288 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed right-0 top-0 bottom-0 w-72 bg-[var(--bg-surface)] border-l border-[var(--border)] z-40 flex flex-col"
          >
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)] font-medium">
                Agents
              </h2>
              <button
                onClick={onClose}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {agents?.map((agent, i) => (
                <div key={agent._id} className="animate-in" style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
                  <AgentCard agent={agent} />
                </div>
              ))}
              {(!agents || agents.length === 0) && (
                <p className="text-[var(--text-muted)] text-center py-8 font-mono text-sm">∅ no agents</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Main Dashboard
export default function Dashboard() {
  const agents = useQuery(api.agents.list);
  const tasksByStatus = useQuery(api.tasks.byStatus);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const deleteTask = useMutation(api.tasks.deleteTask);
  
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [showActivitySheet, setShowActivitySheet] = useState(false);
  const [showAgentsSheet, setShowAgentsSheet] = useState(false);

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask({ id: taskId as Id<"tasks"> });
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Find task by ID across all statuses
  const findTask = (id: string) => {
    if (!tasksByStatus) return null;
    for (const status of Object.keys(tasksByStatus)) {
      const task = tasksByStatus[status]?.find((t: any) => t._id === id);
      if (task) return task;
    }
    return null;
  };

  // Find which column a task is in
  const findColumn = (id: string) => {
    if (!tasksByStatus) return null;
    for (const status of Object.keys(tasksByStatus)) {
      if (tasksByStatus[status]?.some((t: any) => t._id === id)) {
        return status;
      }
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = findTask(event.active.id as string);
    setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Determine target status
    let targetStatus: string | null = null;
    
    // Check if dropped over a column (status)
    const validStatuses = ['inbox', 'assigned', 'in_progress', 'review', 'done', 'blocked'];
    if (validStatuses.includes(overId)) {
      targetStatus = overId;
    } else {
      // Dropped over another task - find its column
      targetStatus = findColumn(overId);
    }
    
    if (!targetStatus) return;
    
    const currentStatus = findColumn(activeId);
    if (currentStatus === targetStatus) return;
    
    // Update task status
    await updateStatus({
      id: activeId as Id<"tasks">,
      status: targetStatus as any,
      agentSessionKey: "main",
    });
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Optional: can add visual feedback here
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-deep)]">
      <DashboardHeader
        rightContent={
          <>
            <div className="h-6 w-px bg-[var(--border)]" />
            <StatsBar />
            <div className="h-6 w-px bg-[var(--border)]" />
            {/* Activity toggle button */}
            <button
              onClick={() => setShowActivitySheet(!showActivitySheet)}
              className="btn-ghost flex items-center gap-2"
              title="Toggle Activity Feed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <span>Activity</span>
            </button>
            
            {/* Agents toggle button */}
            <button
              onClick={() => setShowAgentsSheet(!showAgentsSheet)}
              className="btn-ghost flex items-center gap-2"
              title="Toggle Agents Panel"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Agents</span>
            </button>
            
            <button
              onClick={() => setShowCreateTask(true)}
              className="btn-primary flex items-center gap-2"
            >
              <span className="font-mono">+</span>
              <span>New Task</span>
            </button>
          </>
        }
      />

      {/* Mobile Stats Bar */}
      <div className="md:hidden bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 py-2">
        <StatsBar />
      </div>

      {/* Main Content - Now full width */}
      <div className="flex-1 flex overflow-hidden">
        {/* Kanban Board - Full width */}
        <main className="flex-1 overflow-x-auto animate-in delay-2">
          <div className="p-3 md:p-6 grid-bg min-h-full">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
            >
              {/* Horizontal scroll container for mobile */}
              <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory md:snap-none">
                <KanbanColumn
                  title="Inbox"
                  status="inbox"
                  tasks={tasksByStatus?.inbox || []}
                  onTaskClick={setSelectedTask}
                  onTaskDelete={handleDeleteTask}
                />
                <KanbanColumn
                  title="Assigned"
                  status="assigned"
                  tasks={tasksByStatus?.assigned || []}
                  onTaskClick={setSelectedTask}
                  onTaskDelete={handleDeleteTask}
                />
                <KanbanColumn
                  title="In Progress"
                  status="in_progress"
                  tasks={tasksByStatus?.in_progress || []}
                  onTaskClick={setSelectedTask}
                  onTaskDelete={handleDeleteTask}
                />
                <KanbanColumn
                  title="Review"
                  status="review"
                  tasks={tasksByStatus?.review || []}
                  onTaskClick={setSelectedTask}
                  onTaskDelete={handleDeleteTask}
                />
                <KanbanColumn
                  title="Done"
                  status="done"
                  tasks={tasksByStatus?.done || []}
                  onTaskClick={setSelectedTask}
                  onTaskDelete={handleDeleteTask}
                />
              </div>
              
              <DragOverlay>
                {activeTask ? <TaskCard task={activeTask} /> : null}
              </DragOverlay>
            </DndContext>
          </div>
        </main>
      </div>

      {/* Animated Sheets */}
      <ActivitySheet isOpen={showActivitySheet} onClose={() => setShowActivitySheet(false)} />
      <AgentsSheet isOpen={showAgentsSheet} onClose={() => setShowAgentsSheet(false)} />

      {/* Modals */}
      {selectedTask && (
        <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
      {showCreateTask && (
        <CreateTaskModal onClose={() => setShowCreateTask(false)} />
      )}
    </div>
  );
}
