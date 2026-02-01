import { v } from "convex/values";
import { query } from "./_generated/server";

// Get recent activities (feed)
export const feed = query({
  args: {
    limit: v.optional(v.number()),
    agentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    let activities;
    
    if (args.agentId) {
      activities = await ctx.db
        .query("activities")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId!))
        .order("desc")
        .take(args.limit || 50);
    } else {
      activities = await ctx.db
        .query("activities")
        .withIndex("by_createdAt")
        .order("desc")
        .take(args.limit || 50);
    }
    
    // Enrich with agent info
    return await Promise.all(
      activities.map(async (activity) => {
        const agent = await ctx.db.get(activity.agentId);
        return { ...activity, agent };
      })
    );
  },
});

// Get activities by type
export const byType = query({
  args: {
    type: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_type", (q) => q.eq("type", args.type as any))
      .order("desc")
      .take(args.limit || 50);
    
    return await Promise.all(
      activities.map(async (activity) => {
        const agent = await ctx.db.get(activity.agentId);
        return { ...activity, agent };
      })
    );
  },
});

// Get stats
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    const allActivities = await ctx.db.query("activities").collect();
    const allTasks = await ctx.db.query("tasks").collect();
    
    return {
      activitiesToday: allActivities.filter((a) => a.createdAt > dayAgo).length,
      activitiesThisWeek: allActivities.filter((a) => a.createdAt > weekAgo).length,
      tasksCompleted: allTasks.filter((t) => t.status === "done").length,
      tasksInProgress: allTasks.filter((t) => t.status === "in_progress").length,
      tasksInbox: allTasks.filter((t) => t.status === "inbox").length,
    };
  },
});
