import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// Get messages for a task
export const byTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("asc")
      .collect();
    
    // Enrich with agent info
    return await Promise.all(
      messages.map(async (msg) => {
        const fromAgent = await ctx.db.get(msg.fromAgentId);
        return { ...msg, fromAgent };
      })
    );
  },
});

// Post a message
export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    content: v.string(),
    agentSessionKey: v.string(),
    attachmentIds: v.optional(v.array(v.id("documents"))),
  },
  handler: async (ctx, args) => {
    // Find agent
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.agentSessionKey))
      .first();
    
    if (!agent) throw new Error("Agent not found");
    
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    
    const now = Date.now();
    
    // Parse mentions from content (@name)
    const mentionPattern = /@(\w+)/g;
    const mentionNames = [...args.content.matchAll(mentionPattern)].map((m) => m[1].toLowerCase());
    
    // Find mentioned agents
    const allAgents = await ctx.db.query("agents").collect();
    const mentionedAgents = allAgents.filter((a) =>
      mentionNames.includes(a.name.toLowerCase())
    );
    
    const id = await ctx.db.insert("messages", {
      taskId: args.taskId,
      fromAgentId: agent._id,
      content: args.content,
      attachmentIds: args.attachmentIds,
      mentions: mentionedAgents.map((a) => a._id),
      createdAt: now,
    });
    
    // Log activity
    await ctx.db.insert("activities", {
      type: "message_sent",
      agentId: agent._id,
      message: `${agent.emoji} ${agent.name} commented on "${task.title}"`,
      targetId: args.taskId,
      targetType: "task",
      createdAt: now,
    });
    
    // Notify mentioned agents
    for (const mentioned of mentionedAgents) {
      await ctx.db.insert("notifications", {
        targetAgentId: mentioned._id,
        fromAgentId: agent._id,
        type: "mention",
        title: `${agent.name} mentioned you`,
        content: args.content.substring(0, 200),
        referenceId: args.taskId,
        referenceType: "task",
        read: false,
        delivered: false,
        createdAt: now,
      });
      
      // Also log mention activity
      await ctx.db.insert("activities", {
        type: "mention",
        agentId: agent._id,
        message: `${agent.emoji} ${agent.name} mentioned @${mentioned.name}`,
        targetId: args.taskId,
        targetType: "task",
        createdAt: now,
      });
    }
    
    // Send Telegram notification for mentions
    if (mentionedAgents.length > 0) {
      const mentionTags = mentionedAgents.map(a => `@${a.name}`).join(" ");
      const telegramMsg = `🎯 <b>Mission Control</b>\n\n` +
        `${agent.emoji} <b>${agent.name}</b> mentioned ${mentionTags}\n` +
        `📋 Task: <i>${task.title}</i>\n\n` +
        `"${args.content.substring(0, 300)}${args.content.length > 300 ? '...' : ''}"`;
      
      await ctx.scheduler.runAfter(0, internal.telegram.broadcastToTeam, {
        message: telegramMsg,
      });
    }
    
    // Notify task assignees (if not the sender)
    for (const assigneeId of task.assigneeIds) {
      if (assigneeId !== agent._id && !mentionedAgents.some((a) => a._id === assigneeId)) {
        await ctx.db.insert("notifications", {
          targetAgentId: assigneeId,
          fromAgentId: agent._id,
          type: "task_update",
          title: `New comment on "${task.title}"`,
          content: args.content.substring(0, 200),
          referenceId: args.taskId,
          referenceType: "task",
          read: false,
          delivered: false,
          createdAt: now,
        });
      }
    }
    
    return id;
  },
});

// Edit message
export const edit = mutation({
  args: {
    id: v.id("messages"),
    content: v.string(),
    agentSessionKey: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.id);
    if (!message) throw new Error("Message not found");
    
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.agentSessionKey))
      .first();
    
    if (!agent || agent._id !== message.fromAgentId) {
      throw new Error("Not authorized");
    }
    
    await ctx.db.patch(args.id, {
      content: args.content,
      editedAt: Date.now(),
    });
  },
});

// Recent messages across all tasks
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_createdAt")
      .order("desc")
      .take(args.limit || 20);
    
    return await Promise.all(
      messages.map(async (msg) => {
        const fromAgent = await ctx.db.get(msg.fromAgentId);
        const task = await ctx.db.get(msg.taskId);
        return { ...msg, fromAgent, task };
      })
    );
  },
});
