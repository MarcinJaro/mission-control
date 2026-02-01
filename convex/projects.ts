import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List projects
export const list = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("projects")
        .withIndex("by_status", (q) => q.eq("status", args.status as any))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("projects").order("desc").collect();
  },
});

// Get project by ID
export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) return null;
    
    // Get task counts
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    
    const taskCounts = {
      total: tasks.length,
      inbox: tasks.filter((t) => t.status === "inbox").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
    };
    
    return { ...project, taskCounts };
  },
});

// Create project
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    emoji: v.optional(v.string()),
    agentSessionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      color: args.color,
      emoji: args.emoji,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    
    // Find agent for activity log
    let agent;
    if (args.agentSessionKey) {
      agent = await ctx.db
        .query("agents")
        .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.agentSessionKey!))
        .first();
    } else {
      agent = await ctx.db.query("agents").first();
    }
    
    // Log activity
    if (agent) {
      await ctx.db.insert("activities", {
        type: "project_created",
        agentId: agent._id,
        message: `${args.emoji || "📁"} Created project: ${args.name}`,
        targetId: id,
        targetType: "project",
        createdAt: now,
      });
    }
    
    return id;
  },
});

// Update project
export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("archived")
    )),
    color: v.optional(v.string()),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Seed initial projects
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("projects").first();
    if (existing) return "Already seeded";
    
    const projects = [
      { name: "BuzzGen.io", color: "bg-orange-500", emoji: "🎯", description: "SaaS + marketplace UGC" },
      { name: "buzzrank.io", color: "bg-blue-500", emoji: "📈", description: "Content Automation + SEO" },
      { name: "Nature-Solution", color: "bg-green-500", emoji: "🌿", description: "E-commerce D2C" },
      { name: "Platforma edukacyjna", color: "bg-purple-500", emoji: "📚", description: "Marketplace korepetycji" },
      { name: "AutonomyStack", color: "bg-red-500", emoji: "🤖", description: "Autonomiczny silnik biznesowy" },
      { name: "OpenClaw", color: "bg-cyan-500", emoji: "🐾", description: "AI Agent Framework" },
    ];
    
    const now = Date.now();
    for (const project of projects) {
      await ctx.db.insert("projects", {
        ...project,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }
    
    return "Seeded " + projects.length + " projects";
  },
});
