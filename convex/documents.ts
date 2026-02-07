import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List documents
export const list = query({
  args: {
    type: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    taskId: v.optional(v.id("tasks")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let docs;
    
    if (args.taskId) {
      docs = await ctx.db
        .query("documents")
        .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
        .order("desc")
        .take(args.limit || 50);
    } else if (args.projectId) {
      docs = await ctx.db
        .query("documents")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .order("desc")
        .take(args.limit || 50);
    } else if (args.type) {
      docs = await ctx.db
        .query("documents")
        .withIndex("by_type", (q) => q.eq("type", args.type as any))
        .order("desc")
        .take(args.limit || 50);
    } else {
      docs = await ctx.db
        .query("documents")
        .order("desc")
        .take(args.limit || 50);
    }
    
    // Enrich with creator info and file URLs
    return await Promise.all(
      docs.map(async (doc) => {
        const createdBy = await ctx.db.get(doc.createdBy);
        const fileUrl = doc.storageId ? await ctx.storage.getUrl(doc.storageId) : null;
        return { ...doc, createdByAgent: createdBy, fileUrl };
      })
    );
  },
});

// Get document by ID
export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return null;
    
    const createdBy = await ctx.db.get(doc.createdBy);
    const task = doc.taskId ? await ctx.db.get(doc.taskId) : null;
    const project = doc.projectId ? await ctx.db.get(doc.projectId) : null;
    const fileUrl = doc.storageId ? await ctx.storage.getUrl(doc.storageId) : null;
    
    return { ...doc, createdByAgent: createdBy, task, project, fileUrl };
  },
});

// Create document
export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
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
    agentSessionKey: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.agentSessionKey))
      .first();
    
    if (!agent) throw new Error("Agent not found");
    
    const now = Date.now();
    const id = await ctx.db.insert("documents", {
      title: args.title,
      content: args.content,
      type: args.type,
      taskId: args.taskId,
      projectId: args.projectId,
      createdBy: agent._id,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    
    // Log activity
    await ctx.db.insert("activities", {
      type: "document_created",
      agentId: agent._id,
      message: `📄 ${agent.name} created document: ${args.title}`,
      targetId: id,
      targetType: "document",
      createdAt: now,
    });
    
    return id;
  },
});

// Update document
export const update = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    agentSessionKey: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.agentSessionKey))
      .first();
    
    if (!agent) throw new Error("Agent not found");
    
    const now = Date.now();
    await ctx.db.patch(args.id, {
      ...(args.title && { title: args.title }),
      ...(args.content && { content: args.content }),
      updatedAt: now,
      version: doc.version + 1,
    });
    
    // Log activity
    await ctx.db.insert("activities", {
      type: "document_updated",
      agentId: agent._id,
      message: `📝 ${agent.name} updated document: ${doc.title}`,
      targetId: args.id,
      targetType: "document",
      createdAt: now,
    });
  },
});

// Generate upload URL for file storage
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Create a file-based document (after uploading to storage)
export const createFile = mutation({
  args: {
    title: v.string(),
    type: v.union(
      v.literal("deliverable"),
      v.literal("research"),
      v.literal("protocol"),
      v.literal("note"),
      v.literal("spec"),
      v.literal("other")
    ),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    fileName: v.string(),
    fileSize: v.optional(v.number()),
    taskId: v.optional(v.id("tasks")),
    projectId: v.optional(v.id("projects")),
    agentSessionKey: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.agentSessionKey))
      .first();

    if (!agent) throw new Error("Agent not found");

    const now = Date.now();
    const id = await ctx.db.insert("documents", {
      title: args.title,
      type: args.type,
      storageId: args.storageId,
      mimeType: args.mimeType,
      fileName: args.fileName,
      fileSize: args.fileSize,
      taskId: args.taskId,
      projectId: args.projectId,
      createdBy: agent._id,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    // Log activity
    await ctx.db.insert("activities", {
      type: "document_created",
      agentId: agent._id,
      message: `📎 ${agent.name} uploaded file: ${args.title}`,
      targetId: id,
      targetType: "document",
      createdAt: now,
    });

    return id;
  },
});

// Get file URL from storage
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
