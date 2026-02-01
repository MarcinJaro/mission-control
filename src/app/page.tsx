"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
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
    <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar agent={agent} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{agent.name}</h3>
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                agent.status === "active" && "bg-emerald-500 animate-pulse",
                agent.status === "idle" && "bg-zinc-500",
                agent.status === "blocked" && "bg-amber-500",
                agent.status === "offline" && "bg-zinc-700"
              )}
            />
          </div>
          <p className="text-sm text-zinc-400 truncate">{agent.role}</p>
        </div>
      </div>
      {agent.lastSeenAt && (
        <p className="text-xs text-zinc-500 mt-2">
          Last seen: {timeAgo(agent.lastSeenAt)}
        </p>
      )}
    </div>
  );
}

// Activity Item Component
function ActivityItem({ activity }: { activity: any }) {
  return (
    <div className="activity-item flex items-start gap-3 py-3 border-b border-zinc-800 last:border-0">
      <Avatar agent={activity.agent || { emoji: "📋" }} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-300">{activity.message}</p>
        <p className="text-xs text-zinc-500 mt-1">{timeAgo(activity.createdAt)}</p>
      </div>
    </div>
  );
}

// Priority colors
const priorityColors: Record<string, string> = {
  low: "border-l-zinc-600",
  medium: "border-l-blue-500",
  high: "border-l-amber-500",
  urgent: "border-l-red-500",
};

// Status colors
const statusColors: Record<string, string> = {
  inbox: "bg-zinc-500",
  assigned: "bg-blue-500",
  in_progress: "bg-amber-500",
  review: "bg-purple-500",
  done: "bg-emerald-500",
  blocked: "bg-red-500",
};

// Task Card Component (for drag overlay)
function TaskCardContent({ task }: { task: any }) {
  return (
    <>
      <h4 className="font-medium text-sm mb-2 line-clamp-2">{task.title}</h4>
      {task.assignees?.length > 0 && (
        <div className="flex items-center gap-1 mt-2">
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
    </>
  );
}

// Sortable Task Card Component
function SortableTaskCard({
  task,
  onClick,
}: {
  task: any;
  onClick: () => void;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "bg-zinc-900 rounded-lg p-3 border border-zinc-800 border-l-4 cursor-grab active:cursor-grabbing",
        "hover:border-zinc-700 transition-colors touch-none",
        priorityColors[task.priority] || "border-l-zinc-600",
        isDragging && "shadow-xl ring-2 ring-emerald-500/50"
      )}
    >
      <TaskCardContent task={task} />
    </div>
  );
}

// Static Task Card (for overlay)
function TaskCard({ task }: { task: any }) {
  return (
    <div
      className={cn(
        "bg-zinc-900 rounded-lg p-3 border border-zinc-800 border-l-4",
        "shadow-2xl ring-2 ring-emerald-500",
        priorityColors[task.priority] || "border-l-zinc-600"
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
}: {
  title: string;
  tasks: any[];
  status: string;
  onTaskClick: (task: any) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex-1 min-w-[250px] max-w-[300px]">
      <div className="flex items-center gap-2 mb-4">
        <div className={cn("w-3 h-3 rounded-full", statusColors[status])} />
        <h3 className="font-semibold text-sm uppercase tracking-wide text-zinc-400">
          {title}
        </h3>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
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
            "space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 min-h-[100px] rounded-lg p-2 -m-2 transition-colors",
            isOver && "bg-zinc-800/50 ring-2 ring-emerald-500/30"
          )}
        >
          {tasks.map((task) => (
            <SortableTaskCard 
              key={task._id} 
              task={task} 
              onClick={() => onTaskClick(task)} 
            />
          ))}
          {tasks.length === 0 && (
            <div className={cn(
              "text-zinc-600 text-sm text-center py-8 border-2 border-dashed rounded-lg transition-colors",
              isOver ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-zinc-800"
            )}>
              {isOver ? "Drop here ✓" : "No tasks"}
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
  const [commentAs, setCommentAs] = useState("human");
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const addMessage = useMutation(api.messages.create);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const assignTask = useMutation(api.tasks.assign);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await addMessage({
      taskId: task._id,
      content: newComment,
      agentSessionKey: commentAs,
    });
    setNewComment("");
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateStatus({
      id: task._id,
      status: newStatus as any,
      agentSessionKey: "main",
    });
  };

  const handleToggleAssignee = async (agentId: string) => {
    if (!fullTask) return;
    const currentIds = fullTask.assigneeIds || [];
    const newIds = currentIds.includes(agentId)
      ? currentIds.filter((id: string) => id !== agentId)
      : [...currentIds, agentId];
    await assignTask({
      id: task._id,
      assigneeIds: newIds,
      agentSessionKey: "main",
    });
  };

  if (!fullTask) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-start justify-between">
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

        {/* Description */}
        {fullTask.description && (
          <div className="p-4 border-b border-zinc-800">
            <p className="text-zinc-300 whitespace-pre-wrap">{fullTask.description}</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

        {/* Comment input */}
        <div className="p-4 border-t border-zinc-800">
          <div className="flex gap-2 items-center">
            <select
              value={commentAs}
              onChange={(e) => setCommentAs(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-sm"
              title="Comment as"
            >
              {agents?.map((agent) => (
                <option key={agent._id} value={agent.sessionKey}>
                  {agent.emoji} {agent.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              placeholder="Add a comment... (use @name to mention)"
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
    <div className="flex items-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">Today:</span>
        <span className="font-medium">{stats.activitiesToday} activities</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">Tasks:</span>
        <span className="text-emerald-500">{stats.tasksCompleted} done</span>
        <span className="text-zinc-600">·</span>
        <span className="text-amber-500">{stats.tasksInProgress} active</span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-400">{stats.tasksInbox} inbox</span>
      </div>
    </div>
  );
}

// Main Dashboard
export default function Dashboard() {
  const agents = useQuery(api.agents.list);
  const tasksByStatus = useQuery(api.tasks.byStatus);
  const activities = useQuery(api.activities.feed, { limit: 30 });
  const updateStatus = useMutation(api.tasks.updateStatus);
  
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [activeTask, setActiveTask] = useState<any>(null);

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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span>🎯</span>
              <span>Mission Control</span>
            </h1>
            <StatsBar />
          </div>
          <button
            onClick={() => setShowCreateTask(true)}
            className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>+</span>
            <span>New Task</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Activity Feed - Left Sidebar */}
        <aside className="w-80 border-r border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-semibold text-zinc-400 uppercase text-sm tracking-wide">
              Activity Feed
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto px-4">
            {activities?.map((activity) => (
              <ActivityItem key={activity._id} activity={activity} />
            ))}
            {(!activities || activities.length === 0) && (
              <p className="text-zinc-600 text-center py-8">No activity yet</p>
            )}
          </div>
        </aside>

        {/* Kanban Board - Center */}
        <main className="flex-1 overflow-x-auto">
          <div className="p-6">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
            >
              <div className="flex gap-4">
                <KanbanColumn
                  title="Inbox"
                  status="inbox"
                  tasks={tasksByStatus?.inbox || []}
                  onTaskClick={setSelectedTask}
                />
                <KanbanColumn
                  title="Assigned"
                  status="assigned"
                  tasks={tasksByStatus?.assigned || []}
                  onTaskClick={setSelectedTask}
                />
                <KanbanColumn
                  title="In Progress"
                  status="in_progress"
                  tasks={tasksByStatus?.in_progress || []}
                  onTaskClick={setSelectedTask}
                />
                <KanbanColumn
                  title="Review"
                  status="review"
                  tasks={tasksByStatus?.review || []}
                  onTaskClick={setSelectedTask}
                />
                <KanbanColumn
                  title="Done"
                  status="done"
                  tasks={tasksByStatus?.done || []}
                  onTaskClick={setSelectedTask}
                />
              </div>
              
              <DragOverlay>
                {activeTask ? <TaskCard task={activeTask} /> : null}
              </DragOverlay>
            </DndContext>
          </div>
        </main>

        {/* Agents - Right Sidebar */}
        <aside className="w-72 border-l border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-semibold text-zinc-400 uppercase text-sm tracking-wide">
              Team
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {agents?.map((agent) => (
              <AgentCard key={agent._id} agent={agent} />
            ))}
            {(!agents || agents.length === 0) && (
              <p className="text-zinc-600 text-center py-8">No agents found</p>
            )}
          </div>
        </aside>
      </div>

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
