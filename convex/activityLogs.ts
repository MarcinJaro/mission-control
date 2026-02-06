import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Activity types
export const ActivityType = {
  TASK_CREATED: "task_created",
  TASK_UPDATED: "task_updated",
  TASK_COMPLETED: "task_completed",
  TASK_ASSIGNED: "task_assigned",
  MESSAGE_SENT: "message_sent",
  CHAT_MESSAGE: "chat_message",
  CRON_EXECUTED: "cron_executed",
  AGENT_WOKE: "agent_woke",
  FILE_CREATED: "file_created",
  CUSTOM: "custom",
} as const;

// Log an activity
export const log = mutation({
  args: {
    type: v.string(),
    agentId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    taskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activityLogs", {
      type: args.type,
      agentId: args.agentId,
      agentName: args.agentName,
      title: args.title,
      description: args.description,
      metadata: args.metadata,
      taskId: args.taskId,
      createdAt: Date.now(),
    });
  },
});

// Get recent activity
export const recent = query({
  args: {
    limit: v.optional(v.number()),
    agentId: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    let query = ctx.db
      .query("activityLogs")
      .order("desc");
    
    const logs = await query.take(limit * 2); // Take more to filter
    
    let filtered = logs;
    
    if (args.agentId) {
      filtered = filtered.filter(l => l.agentId === args.agentId);
    }
    
    if (args.type) {
      filtered = filtered.filter(l => l.type === args.type);
    }
    
    return filtered.slice(0, limit);
  },
});

// Get activity for a specific task
export const forTask = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("activityLogs")
      .filter(q => q.eq(q.field("taskId"), args.taskId))
      .order("desc")
      .take(50);
    
    return logs;
  },
});

// Get activity stats
export const stats = query({
  args: {
    hoursAgo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hoursAgo = args.hoursAgo || 24;
    const since = Date.now() - (hoursAgo * 60 * 60 * 1000);
    
    const logs = await ctx.db
      .query("activityLogs")
      .order("desc")
      .take(1000);
    
    const recentLogs = logs.filter(l => l.createdAt > since);
    
    // Count by type
    const byType: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    
    recentLogs.forEach(log => {
      byType[log.type] = (byType[log.type] || 0) + 1;
      if (log.agentId) {
        byAgent[log.agentId] = (byAgent[log.agentId] || 0) + 1;
      }
    });
    
    return {
      total: recentLogs.length,
      byType,
      byAgent,
      since,
    };
  },
});
