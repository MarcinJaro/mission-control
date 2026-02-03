import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Agents - each OpenClaw agent instance
  agents: defineTable({
    name: v.string(),
    emoji: v.string(),
    avatarUrl: v.optional(v.string()), // Profile picture URL
    role: v.string(),
    description: v.optional(v.string()),
    sessionKey: v.string(), // e.g., "main", "bestia", "ksiegowy"
    status: v.union(
      v.literal("idle"),
      v.literal("active"),
      v.literal("blocked"),
      v.literal("offline")
    ),
    currentTaskId: v.optional(v.id("tasks")),
    lastSeenAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_sessionKey", ["sessionKey"])
    .index("by_status", ["status"]),

  // Projects - group related tasks
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(), // Tailwind color class
    emoji: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("archived")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"]),

  // Tasks - units of work
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
      v.literal("blocked")
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    projectId: v.optional(v.id("projects")),
    assigneeIds: v.array(v.id("agents")),
    createdBy: v.optional(v.id("agents")),
    dueAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_status", ["status"])
    .index("by_project", ["projectId"])
    .index("by_priority", ["priority"])
    .index("by_createdAt", ["createdAt"]),

  // Messages - comments/discussion on tasks
  messages: defineTable({
    taskId: v.id("tasks"),
    fromAgentId: v.id("agents"),
    content: v.string(),
    attachmentIds: v.optional(v.array(v.id("documents"))),
    mentions: v.optional(v.array(v.id("agents"))),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
  })
    .index("by_task", ["taskId"])
    .index("by_agent", ["fromAgentId"])
    .index("by_createdAt", ["createdAt"]),

  // Documents - deliverables, research, protocols
  documents: defineTable({
    title: v.string(),
    content: v.string(), // Markdown
    type: v.union(
      v.literal("deliverable"),
      v.literal("research"),
      v.literal("protocol"),
      v.literal("note"),
      v.literal("spec"),
      v.literal("other")
    ),
    taskId: v.optional(v.id("tasks")),
    projectId: v.optional(v.id("projects")),
    createdBy: v.id("agents"),
    createdAt: v.number(),
    updatedAt: v.number(),
    version: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_task", ["taskId"])
    .index("by_project", ["projectId"])
    .index("by_type", ["type"])
    .index("by_createdAt", ["createdAt"]),

  // Activities - audit trail of everything
  activities: defineTable({
    type: v.union(
      v.literal("task_created"),
      v.literal("task_updated"),
      v.literal("task_assigned"),
      v.literal("task_completed"),
      v.literal("message_sent"),
      v.literal("document_created"),
      v.literal("document_updated"),
      v.literal("agent_status_changed"),
      v.literal("project_created"),
      v.literal("mention")
    ),
    agentId: v.id("agents"),
    message: v.string(),
    targetId: v.optional(v.string()), // Generic reference
    targetType: v.optional(v.string()), // "task", "document", "project"
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_agent", ["agentId"])
    .index("by_createdAt", ["createdAt"]),

  // Chat Messages - MC Chat for agent coordination
  chatMessages: defineTable({
    authorType: v.union(v.literal("human"), v.literal("agent")),
    authorId: v.string(), // sessionKey or "marcin"
    authorName: v.string(), // Display name
    content: v.string(),
    mentions: v.array(v.string()), // @mentioned sessionKeys
    taskId: v.optional(v.id("tasks")), // Optional link to task
    replyToId: v.optional(v.id("chatMessages")), // Threading
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_author", ["authorId"])
    .index("by_task", ["taskId"]),

  // Router Decisions - audit trail for message routing
  routerDecisions: defineTable({
    messageId: v.id("chatMessages"),
    targets: v.array(v.string()), // sessionKeys to trigger
    reasoning: v.string(), // Why these agents
    model: v.string(), // haiku / gpt-4o-mini
    cost: v.number(), // API cost in USD
    triggered: v.boolean(), // Did we actually trigger?
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_createdAt", ["createdAt"]),

  // Notifications - @mentions and alerts
  notifications: defineTable({
    targetAgentId: v.id("agents"),
    fromAgentId: v.optional(v.id("agents")),
    type: v.union(
      v.literal("mention"),
      v.literal("assignment"),
      v.literal("task_update"),
      v.literal("review_request"),
      v.literal("system")
    ),
    title: v.string(),
    content: v.string(),
    referenceId: v.optional(v.string()),
    referenceType: v.optional(v.string()),
    read: v.boolean(),
    delivered: v.boolean(),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_target", ["targetAgentId"])
    .index("by_read", ["read"])
    .index("by_delivered", ["delivered"])
    .index("by_createdAt", ["createdAt"]),
});
