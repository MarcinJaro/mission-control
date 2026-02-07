import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Policy table for runtime configuration without redeploy
// Stores JSON policies keyed by name

export const get = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const policy = await ctx.db
      .query("policies")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    return policy?.value ?? null;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("policies").collect();
  },
});

export const set = mutation({
  args: {
    name: v.string(),
    value: v.any(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("policies")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        description: args.description ?? existing.description,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("policies", {
        name: args.name,
        value: args.value,
        description: args.description,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const remove = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const policy = await ctx.db
      .query("policies")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (policy) {
      await ctx.db.delete(policy._id);
      return true;
    }
    return false;
  },
});
