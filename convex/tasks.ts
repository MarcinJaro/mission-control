import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// List tasks with optional filters
export const list = query({
  args: {
    status: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("tasks").order("desc");
    
    if (args.status) {
      query = ctx.db
        .query("tasks")
        .withIndex("by_status", (q) => q.eq("status", args.status as any))
        .order("desc");
    }
    
    const tasks = await query.take(args.limit || 100);
    
    // Enrich with assignee info
    const enriched = await Promise.all(
      tasks.map(async (task) => {
        const assignees = await Promise.all(
          task.assigneeIds.map((id) => ctx.db.get(id))
        );
        const project = task.projectId ? await ctx.db.get(task.projectId) : null;
        return { ...task, assignees, project };
      })
    );
    
    return enriched;
  },
});

// Get task by ID with full details
export const get = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) return null;
    
    const assignees = await Promise.all(
      task.assigneeIds.map((id) => ctx.db.get(id))
    );
    const project = task.projectId ? await ctx.db.get(task.projectId) : null;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_task", (q) => q.eq("taskId", args.id))
      .order("asc")
      .collect();
    
    // Enrich messages with agent info
    const enrichedMessages = await Promise.all(
      messages.map(async (msg) => {
        const fromAgent = await ctx.db.get(msg.fromAgentId);
        return { ...msg, fromAgent };
      })
    );
    
    return { ...task, assignees, project, messages: enrichedMessages };
  },
});

// Create task
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    )),
    projectId: v.optional(v.id("projects")),
    assigneeIds: v.optional(v.array(v.id("agents"))),
    createdBySessionKey: v.optional(v.string()),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find creator agent
    let createdBy;
    if (args.createdBySessionKey) {
      const agent = await ctx.db
        .query("agents")
        .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.createdBySessionKey!))
        .first();
      createdBy = agent?._id;
    }
    
    const now = Date.now();
    const id = await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: args.assigneeIds?.length ? "assigned" : "inbox",
      priority: args.priority || "medium",
      projectId: args.projectId,
      assigneeIds: args.assigneeIds || [],
      createdBy,
      dueAt: args.dueAt,
      createdAt: now,
      updatedAt: now,
    });
    
    // Log activity
    const creator = createdBy ? await ctx.db.get(createdBy) : null;
    await ctx.db.insert("activities", {
      type: "task_created",
      agentId: createdBy || (await ctx.db.query("agents").first())?._id!,
      message: `${creator?.emoji || "📋"} Created task: ${args.title}`,
      targetId: id,
      targetType: "task",
      createdAt: now,
    });
    
    // Notify assignees
    if (args.assigneeIds?.length) {
      const assignees = await Promise.all(args.assigneeIds.map((aid) => ctx.db.get(aid)));
      
      for (const assigneeId of args.assigneeIds) {
        await ctx.db.insert("notifications", {
          targetAgentId: assigneeId,
          fromAgentId: createdBy,
          type: "assignment",
          title: "New task assigned",
          content: args.title,
          referenceId: id,
          referenceType: "task",
          read: false,
          delivered: false,
          createdAt: now,
        });
      }
      
      // Wake each assignee via webhook (instant notification)
      for (const assignee of assignees) {
        if (assignee && assignee.sessionKey) {
          await ctx.scheduler.runAfter(0, internal.internal.wakeAgent, {
            agentSessionKey: assignee.sessionKey,
            agentName: assignee.name || "Agent",
            taskTitle: args.title,
            taskId: id,
            assignerName: creator?.name,
          });
        }
      }
    }
    
    return id;
  },
});

// Update task status
export const updateStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
      v.literal("blocked")
    ),
    agentSessionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");
    
    const now = Date.now();
    const updates: any = {
      status: args.status,
      updatedAt: now,
    };
    
    if (args.status === "done") {
      updates.completedAt = now;
    }
    
    await ctx.db.patch(args.id, updates);
    
    // Find agent
    let agent;
    if (args.agentSessionKey) {
      agent = await ctx.db
        .query("agents")
        .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.agentSessionKey!))
        .first();
    }
    
    // Log activity
    await ctx.db.insert("activities", {
      type: args.status === "done" ? "task_completed" : "task_updated",
      agentId: agent?._id || task.assigneeIds[0] || (await ctx.db.query("agents").first())?._id!,
      message: `${args.status === "done" ? "✅" : "📝"} Task "${task.title}" → ${args.status}`,
      targetId: args.id,
      targetType: "task",
      createdAt: now,
    });
    
    // Notify Marcin when task is done or blocked
    if (args.status === "done" || args.status === "blocked") {
      await ctx.scheduler.runAfter(0, internal.internal.notifyMarcin, {
        type: args.status === "done" ? "completed" : "blocked",
        taskTitle: task.title,
        agentName: agent?.name || "Agent",
      });
    }
  },
});

// Assign task to agents
export const assign = mutation({
  args: {
    id: v.id("tasks"),
    assigneeIds: v.array(v.id("agents")),
    agentSessionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");
    
    const now = Date.now();
    await ctx.db.patch(args.id, {
      assigneeIds: args.assigneeIds,
      status: args.assigneeIds.length ? "assigned" : "inbox",
      updatedAt: now,
    });
    
    // Notify new assignees
    for (const assigneeId of args.assigneeIds) {
      if (!task.assigneeIds.includes(assigneeId)) {
        await ctx.db.insert("notifications", {
          targetAgentId: assigneeId,
          type: "assignment",
          title: "Task assigned to you",
          content: task.title,
          referenceId: args.id,
          referenceType: "task",
          read: false,
          delivered: false,
          createdAt: now,
        });
      }
    }
    
    // Find assigner
    let agent;
    if (args.agentSessionKey) {
      agent = await ctx.db
        .query("agents")
        .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.agentSessionKey!))
        .first();
    }
    
    // Log activity
    const assignees = await Promise.all(args.assigneeIds.map((id) => ctx.db.get(id)));
    const names = assignees.map((a) => a?.name).filter(Boolean).join(", ");
    const emojis = assignees.map((a) => a?.emoji).filter(Boolean).join(" ");
    await ctx.db.insert("activities", {
      type: "task_assigned",
      agentId: agent?._id || (await ctx.db.query("agents").first())?._id!,
      message: `📌 Assigned "${task.title}" to ${names}`,
      targetId: args.id,
      targetType: "task",
      createdAt: now,
    });
    
    // Send Telegram notification for new assignments
    const newAssignees = args.assigneeIds.filter(id => !task.assigneeIds.includes(id));
    if (newAssignees.length > 0) {
      const newAssigneeAgents = assignees.filter(a => a && newAssignees.includes(a._id));
      const assignerName = agent?.name || "Someone";
      const assignerEmoji = agent?.emoji || "👤";
      
      const telegramMsg = `📌 <b>Mission Control - Task Assigned</b>\n\n` +
        `${assignerEmoji} <b>${assignerName}</b> assigned a task to:\n` +
        `${newAssigneeAgents.map(a => `${a?.emoji} ${a?.name}`).join(", ")}\n\n` +
        `📋 <b>${task.title}</b>\n` +
        `${task.description ? task.description.substring(0, 200) + (task.description.length > 200 ? '...' : '') : ''}`;
      
      await ctx.scheduler.runAfter(0, internal.telegram.broadcastToTeam, {
        message: telegramMsg,
      });
      
      // Wake each new assignee via webhook (instant notification)
      for (const assignee of newAssigneeAgents) {
        if (assignee && assignee.sessionKey) {
          await ctx.scheduler.runAfter(0, internal.internal.wakeAgent, {
            agentSessionKey: assignee.sessionKey,
            agentName: assignee.name || "Agent",
            taskTitle: task.title,
            taskId: args.id,
            assignerName: agent?.name,
          });
        }
      }
    }
  },
});

// Auto-transition: evaluate if task should move to next status
// Based on policies: auto_approve (inbox → assigned for low/medium priority)
export const autoTransition = mutation({
  args: {
    id: v.id("tasks"),
    agentSessionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");

    // Get auto_approve policy
    const policy = await ctx.db
      .query("policies")
      .withIndex("by_name", (q) => q.eq("name", "auto_approve"))
      .first();

    const autoApproveConfig = policy?.value ?? {
      enabled: true,
      allowedPriorities: ["low", "medium"],
    };

    if (!autoApproveConfig.enabled) return { transitioned: false, reason: "auto_approve disabled" };

    const now = Date.now();
    const transitions: Array<{ from: string; to: string; condition: () => boolean }> = [
      {
        // inbox → assigned (when has assignees and priority is auto-approvable)
        from: "inbox",
        to: "assigned",
        condition: () =>
          task.assigneeIds.length > 0 &&
          autoApproveConfig.allowedPriorities.includes(task.priority),
      },
      {
        // assigned → in_progress (when agent starts working)
        from: "assigned",
        to: "in_progress",
        condition: () => true, // Agent explicitly triggers this
      },
    ];

    for (const t of transitions) {
      if (task.status === t.from && t.condition()) {
        await ctx.db.patch(args.id, { status: t.to as any, updatedAt: now });

        // Log activity
        let agent;
        if (args.agentSessionKey) {
          agent = await ctx.db
            .query("agents")
            .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.agentSessionKey!))
            .first();
        }

        await ctx.db.insert("activities", {
          type: "task_updated",
          agentId: agent?._id || task.assigneeIds[0] || (await ctx.db.query("agents").first())?._id!,
          message: `⚡ Auto-transition: "${task.title}" ${t.from} → ${t.to}`,
          targetId: args.id,
          targetType: "task",
          createdAt: now,
        });

        return { transitioned: true, from: t.from, to: t.to };
      }
    }

    return { transitioned: false, reason: "no matching transition" };
  },
});

// Delete a task
export const deleteTask = mutation({
  args: { 
    id: v.id("tasks"),
    agentSessionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found");
    }
    
    // Delete associated messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_task", (q) => q.eq("taskId", args.id))
      .collect();
    
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    
    // Delete associated notifications (if they reference this task)
    const notifications = await ctx.db
      .query("notifications")
      .filter((q) => q.eq(q.field("referenceId"), args.id.toString()))
      .collect();
    
    for (const notif of notifications) {
      await ctx.db.delete(notif._id);
    }
    
    // Delete the task
    await ctx.db.delete(args.id);
    
    return { deleted: true, title: task.title };
  },
});

// Get tasks by status (for Kanban)
export const byStatus = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").order("desc").collect();
    
    // Group by status
    const grouped: Record<string, typeof tasks> = {
      inbox: [],
      assigned: [],
      in_progress: [],
      review: [],
      done: [],
      blocked: [],
    };
    
    for (const task of tasks) {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    }
    
    // Enrich with assignees
    const enriched: Record<string, any[]> = {};
    for (const [status, statusTasks] of Object.entries(grouped)) {
      enriched[status] = await Promise.all(
        statusTasks.map(async (task) => {
          const assignees = await Promise.all(
            task.assigneeIds.map((id) => ctx.db.get(id))
          );
          return { ...task, assignees };
        })
      );
    }
    
    return enriched;
  },
});
