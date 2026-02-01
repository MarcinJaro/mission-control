import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all agents
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agents").collect();
  },
});

// Get agent by session key
export const getBySessionKey = query({
  args: { sessionKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .first();
  },
});

// Get agent by ID
export const get = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create new agent
export const create = mutation({
  args: {
    name: v.string(),
    emoji: v.string(),
    role: v.string(),
    description: v.optional(v.string()),
    sessionKey: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("agents", {
      ...args,
      status: "idle",
      lastSeenAt: Date.now(),
    });
    
    // Log activity
    await ctx.db.insert("activities", {
      type: "agent_status_changed",
      agentId: id,
      message: `${args.emoji} ${args.name} joined the team`,
      createdAt: Date.now(),
    });
    
    return id;
  },
});

// Update agent
export const update = mutation({
  args: {
    id: v.id("agents"),
    name: v.optional(v.string()),
    emoji: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered);
    }
  },
});

// Update agent status
export const updateStatus = mutation({
  args: {
    id: v.id("agents"),
    status: v.union(
      v.literal("idle"),
      v.literal("active"),
      v.literal("blocked"),
      v.literal("offline")
    ),
    currentTaskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) throw new Error("Agent not found");
    
    await ctx.db.patch(args.id, {
      status: args.status,
      currentTaskId: args.currentTaskId,
      lastSeenAt: Date.now(),
    });
    
    // Log activity
    await ctx.db.insert("activities", {
      type: "agent_status_changed",
      agentId: args.id,
      message: `${agent.emoji} ${agent.name} is now ${args.status}`,
      createdAt: Date.now(),
    });
  },
});

// Heartbeat - update last seen
export const heartbeat = mutation({
  args: { sessionKey: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .first();
    
    if (agent) {
      await ctx.db.patch(agent._id, {
        lastSeenAt: Date.now(),
      });
    }
  },
});

// Seed initial agents (run once)
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("agents").first();
    if (existing) return "Already seeded";
    
    const agents = [
      { name: "Gilfoyl", emoji: "🤖", role: "Architekt, główny", sessionKey: "main" },
      { name: "Bestia", emoji: "🦁", role: "Health coach", sessionKey: "bestia" },
      { name: "Feliks", emoji: "📊", role: "CFO, księgowość", sessionKey: "ksiegowy" },
      { name: "Maverick", emoji: "🎯", role: "Marketing black ops", sessionKey: "marketing" },
      { name: "Gordon", emoji: "🐺", role: "Inwestycje", sessionKey: "investor" },
      { name: "Zosia", emoji: "✨", role: "Asystentka osobista", sessionKey: "assistant" },
    ];
    
    for (const agent of agents) {
      await ctx.db.insert("agents", {
        ...agent,
        status: "idle",
        lastSeenAt: Date.now(),
      });
    }
    
    return "Seeded " + agents.length + " agents";
  },
});
