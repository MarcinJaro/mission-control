import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

// ============ QUERIES ============

// Get recent chat messages
export const list = query({
  args: {
    limit: v.optional(v.number()),
    before: v.optional(v.number()), // createdAt timestamp for pagination
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    let q = ctx.db
      .query("chatMessages")
      .withIndex("by_createdAt")
      .order("desc");
    
    if (args.before) {
      q = q.filter((msg) => msg.lt(msg.field("createdAt"), args.before!));
    }
    
    const messages = await q.take(limit);
    return messages.reverse(); // Return in chronological order
  },
});

// Get messages since timestamp (for context injection)
export const since = query({
  args: {
    sinceMs: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_createdAt")
      .filter((msg) => msg.gte(msg.field("createdAt"), args.sinceMs))
      .order("asc")
      .take(limit);
    
    return messages;
  },
});

// Get context for agent (last N messages or last 30 min)
export const contextForAgent = query({
  args: {
    maxMessages: v.optional(v.number()),
    maxAgeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxMessages = args.maxMessages ?? 10;
    const maxAgeMs = args.maxAgeMs ?? 30 * 60 * 1000; // 30 minutes
    const cutoff = Date.now() - maxAgeMs;
    
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_createdAt")
      .order("desc")
      .take(maxMessages);
    
    // Filter by age and reverse to chronological
    return messages
      .filter(m => m.createdAt >= cutoff)
      .reverse();
  },
});

// ============ MUTATIONS ============

// Send a chat message
export const send = mutation({
  args: {
    authorType: v.union(v.literal("human"), v.literal("agent")),
    authorId: v.string(),
    authorName: v.string(),
    content: v.string(),
    taskId: v.optional(v.id("tasks")),
    replyToId: v.optional(v.id("chatMessages")),
  },
  handler: async (ctx, args) => {
    // Extract @mentions from content
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(args.content)) !== null) {
      mentions.push(match[1].toLowerCase());
    }
    
    const messageId = await ctx.db.insert("chatMessages", {
      authorType: args.authorType,
      authorId: args.authorId,
      authorName: args.authorName,
      content: args.content,
      mentions,
      taskId: args.taskId,
      replyToId: args.replyToId,
      createdAt: Date.now(),
    });
    
    // Trigger webhook asynchronously
    await ctx.scheduler.runAfter(0, api.chat.triggerWebhook, {
      messageId,
      authorId: args.authorId,
      authorName: args.authorName,
      content: args.content,
      mentions,
    });
    
    // Log activity
    // Note: We'd need to resolve agent ID from sessionKey for proper activity logging
    // For now, skip activity logging for chat messages
    
    return { messageId, mentions };
  },
});

// Edit a message (only author can edit)
export const edit = mutation({
  args: {
    messageId: v.id("chatMessages"),
    authorId: v.string(), // Must match original author
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.authorId !== args.authorId) throw new Error("Not authorized");
    
    // Re-extract mentions
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(args.content)) !== null) {
      mentions.push(match[1].toLowerCase());
    }
    
    await ctx.db.patch(args.messageId, {
      content: args.content,
      mentions,
      editedAt: Date.now(),
    });
    
    return { success: true };
  },
});

// Store router decision (for audit)
export const logRouterDecision = mutation({
  args: {
    messageId: v.id("chatMessages"),
    targets: v.array(v.string()),
    reasoning: v.string(),
    model: v.string(),
    cost: v.number(),
    triggered: v.boolean(),
  },
  handler: async (ctx, args) => {
    const decisionId = await ctx.db.insert("routerDecisions", {
      messageId: args.messageId,
      targets: args.targets,
      reasoning: args.reasoning,
      model: args.model,
      cost: args.cost,
      triggered: args.triggered,
      createdAt: Date.now(),
    });
    
    return { decisionId };
  },
});

// ============ ACTIONS ============

// Trigger webhook for new message (called via scheduler)
export const triggerWebhook = action({
  args: {
    messageId: v.id("chatMessages"),
    authorId: v.string(),
    authorName: v.string(),
    content: v.string(),
    mentions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      // Get Convex site URL from environment or construct it
      const siteUrl = process.env.CONVEX_SITE_URL || "https://disciplined-wombat-115.convex.site";
      
      const response = await fetch(`${siteUrl}/chat/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: args.messageId,
          authorId: args.authorId,
          authorName: args.authorName,
          content: args.content,
          mentions: args.mentions,
        }),
      });
      
      const result = await response.json();
      console.log("Webhook triggered successfully:", result);
      return { success: true, result };
    } catch (error) {
      console.error("Failed to trigger webhook:", error);
      return { success: false, error: String(error) };
    }
  },
});

// ============ STATS ============

// Get router cost stats
export const routerStats = query({
  args: {
    sinceMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sinceMs = args.sinceMs ?? Date.now() - 24 * 60 * 60 * 1000; // Last 24h
    
    const decisions = await ctx.db
      .query("routerDecisions")
      .withIndex("by_createdAt")
      .filter((d) => d.gte(d.field("createdAt"), sinceMs))
      .collect();
    
    const totalCost = decisions.reduce((sum, d) => sum + d.cost, 0);
    const totalMessages = decisions.length;
    const triggeredCount = decisions.filter(d => d.triggered).length;
    
    return {
      totalCost,
      totalMessages,
      triggeredCount,
      avgCostPerMessage: totalMessages > 0 ? totalCost / totalMessages : 0,
    };
  },
});

// ============ HELPER: Format for Agent Context ============

export const formatContextForAgent = query({
  args: {
    maxMessages: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxMessages = args.maxMessages ?? 10;
    const maxAgeMs = 30 * 60 * 1000;
    const cutoff = Date.now() - maxAgeMs;
    
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_createdAt")
      .order("desc")
      .take(maxMessages);
    
    const filtered = messages
      .filter(m => m.createdAt >= cutoff)
      .reverse();
    
    // Format as readable context
    const formatted = filtered.map(m => {
      const time = new Date(m.createdAt).toLocaleTimeString("pl-PL", { 
        hour: "2-digit", 
        minute: "2-digit" 
      });
      return `[${time}] ${m.authorName}: ${m.content}`;
    }).join("\n");
    
    return {
      messageCount: filtered.length,
      context: formatted,
    };
  },
});
