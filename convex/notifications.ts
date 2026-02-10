import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get notifications for an agent
export const forAgent = query({
  args: {
    agentSessionKey: v.string(),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.agentSessionKey))
      .first();
    
    if (!agent) return [];
    
    let notifications = await ctx.db
      .query("notifications")
      .withIndex("by_target", (q) => q.eq("targetAgentId", agent._id))
      .order("desc")
      .take(50);
    
    if (args.unreadOnly) {
      notifications = notifications.filter((n) => !n.read);
    }
    
    // Enrich with sender info
    return await Promise.all(
      notifications.map(async (n) => {
        const fromAgent = n.fromAgentId ? await ctx.db.get(n.fromAgentId) : null;
        return { ...n, fromAgent };
      })
    );
  },
});

// Mark notification as read
export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      read: true,
      readAt: Date.now(),
    });
  },
});

// Mark all as read for agent
export const markAllRead = mutation({
  args: { agentSessionKey: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.agentSessionKey))
      .first();
    
    if (!agent) return;
    
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_target", (q) => q.eq("targetAgentId", agent._id))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();
    
    const now = Date.now();
    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true, readAt: now });
    }
  },
});

// Mark as delivered (for integration with OpenClaw)
export const markDelivered = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { delivered: true });
  },
});

// Get undelivered notifications (for OpenClaw polling)
export const undelivered = query({
  args: { agentSessionKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let notifications;
    
    if (args.agentSessionKey) {
      const agent = await ctx.db
        .query("agents")
        .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.agentSessionKey!))
        .first();
      
      if (!agent) return [];
      
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_target", (q) => q.eq("targetAgentId", agent._id))
        .filter((q) => q.eq(q.field("delivered"), false))
        .collect();
    } else {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_delivered", (q) => q.eq("delivered", false))
        .collect();
    }
    
    return await Promise.all(
      notifications.map(async (n) => {
        const targetAgent = await ctx.db.get(n.targetAgentId);
        const fromAgent = n.fromAgentId ? await ctx.db.get(n.fromAgentId) : null;
        return { ...n, targetAgent, fromAgent };
      })
    );
  },
});

// Acknowledge notification (agent confirms receipt)
export const acknowledge = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      acknowledgedAt: Date.now(),
      read: true,
      readAt: Date.now(),
    });
  },
});

// Record delivery attempt (for retry tracking)
export const recordDeliveryAttempt = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const notif = await ctx.db.get(args.id);
    if (!notif) return;
    await ctx.db.patch(args.id, {
      deliveryAttempts: (notif.deliveryAttempts || 0) + 1,
      lastPingAt: Date.now(),
      delivered: true,
    });
  },
});

// Count unread for agent
export const countUnread = query({
  args: { agentSessionKey: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.agentSessionKey))
      .first();
    
    if (!agent) return 0;
    
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_target", (q) => q.eq("targetAgentId", agent._id))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();
    
    return unread.length;
  },
});
