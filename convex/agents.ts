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

// Auto-idle: mark agents as idle/offline based on lastSeenAt TTL
export const refreshStatuses = mutation({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    const now = Date.now();
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    for (const agent of agents) {
      if (!agent.lastSeenAt) continue;
      const age = now - agent.lastSeenAt;

      if (age > TWENTY_FOUR_HOURS && agent.status !== "offline") {
        await ctx.db.patch(agent._id, { status: "offline" });
      } else if (age > SIX_HOURS && agent.status === "active") {
        await ctx.db.patch(agent._id, { status: "idle" });
      }
    }
  },
});

// Auto-assign inbox tasks based on expertise mapping
export const autoAssignInbox = mutation({
  args: {},
  handler: async (ctx) => {
    const inboxTasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "inbox"))
      .collect();

    if (inboxTasks.length === 0) return { assigned: 0 };

    // Expertise mapping: keyword → sessionKey
    const expertiseMap: Record<string, string[]> = {
      // Finance/accounting
      "vat": ["ksiegowy"], "faktur": ["ksiegowy"], "podatek": ["ksiegowy"],
      "invoice": ["ksiegowy"], "płatność": ["ksiegowy"], "us ": ["ksiegowy"],
      "upomnienie": ["ksiegowy"], "rozliczeni": ["ksiegowy"],
      // Marketing
      "seo": ["marketing"], "marketing": ["marketing"], "blog": ["marketing"],
      "content": ["marketing"], "social": ["marketing"], "kampani": ["marketing"],
      "launch": ["marketing"], "pseo": ["marketing"], "gsc": ["marketing"],
      // Investment
      "btc": ["investor"], "crypto": ["investor"], "stock": ["investor"],
      "market": ["investor"], "portfolio": ["investor"], "polymarket": ["investor"],
      // Health
      "trening": ["bestia"], "dieta": ["bestia"], "health": ["bestia"],
      "workout": ["bestia"], "sen": ["bestia"],
      // Assistant
      "kalendarz": ["assistant"], "reminder": ["assistant"], "spotkani": ["assistant"],
      "email": ["assistant"], "monitor": ["assistant"],
      // Technical (Gilfoyl)
      "fix": ["main"], "bug": ["main"], "deploy": ["main"], "api": ["main"],
      "architekt": ["main"], "audit": ["main"], "infra": ["main"],
    };

    // Agent ID cache
    const agentCache: Record<string, string> = {};
    const getAgentId = async (sessionKey: string) => {
      if (!agentCache[sessionKey]) {
        const agent = await ctx.db
          .query("agents")
          .withIndex("by_sessionKey", (q) => q.eq("sessionKey", sessionKey))
          .first();
        if (agent) agentCache[sessionKey] = agent._id;
      }
      return agentCache[sessionKey];
    };

    let assigned = 0;
    const now = Date.now();

    for (const task of inboxTasks) {
      const text = `${task.title} ${task.description || ""}`.toLowerCase();
      const matchedSessions = new Set<string>();

      for (const [keyword, sessions] of Object.entries(expertiseMap)) {
        if (text.includes(keyword)) {
          sessions.forEach((s) => matchedSessions.add(s));
        }
      }

      // Default: assign to Gilfoyl if no match
      if (matchedSessions.size === 0) {
        matchedSessions.add("main");
      }

      const assigneeIds: string[] = [];
      for (const sk of matchedSessions) {
        const aid = await getAgentId(sk);
        if (aid) assigneeIds.push(aid as any);
      }

      if (assigneeIds.length > 0) {
        await ctx.db.patch(task._id, {
          assigneeIds: assigneeIds as any,
          status: "assigned",
          updatedAt: now,
        });

        // Create notifications
        for (const aid of assigneeIds) {
          await ctx.db.insert("notifications", {
            targetAgentId: aid as any,
            type: "assignment",
            title: "Auto-assigned task",
            content: task.title,
            referenceId: task._id,
            referenceType: "task",
            read: false,
            delivered: false,
            createdAt: now,
          });
        }

        assigned++;
      }
    }

    return { assigned, total: inboxTasks.length };
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
