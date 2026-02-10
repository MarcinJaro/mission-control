import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// Wake endpoint disabled — agents now poll via per-agent cron jobs
// Old endpoint was broken (pointed to Zosia's webhook, not a universal router)
const WAKE_ENDPOINT = ""; // kept for reference

// Wake an agent via webhook (called from scheduler)
export const wakeAgent = internalAction({
  args: {
    agentSessionKey: v.string(),
    agentName: v.string(),
    taskTitle: v.string(),
    taskId: v.string(),
    assignerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = `📋 **Nowy task przypisany do Ciebie!**

**Task:** ${args.taskTitle}
**Od:** ${args.assignerName || "System"}

Zacznij pracę nad tym taskiem. Jak skończysz, zaktualizuj status:
\`\`\`bash
cd ~/.openclaw/workspace-main/projects/mission-control
npx convex run --prod tasks:updateStatus '{"id": "${args.taskId}", "status": "done", "agentSessionKey": "${args.agentSessionKey}"}'
\`\`\`

Jak potrzebujesz pomocy lub masz pytania, użyj MC Chat lub @mention odpowiednią osobę.`;

    // Agents now pick up tasks via per-agent cron polling (every ~30min)
    // No HTTP wake needed — notification is created in DB, agent polls it
    console.log(`Task notification created for ${args.agentSessionKey}: ${args.taskTitle}`);
    console.log(`Agent will pick it up on next cron poll.`);
    return { success: true, result: "notification_created_polling_mode" };
  },
});

// Notify Marcin when task is completed or needs input
export const notifyMarcin = internalAction({
  args: {
    type: v.union(v.literal("completed"), v.literal("blocked"), v.literal("mention")),
    taskTitle: v.string(),
    agentName: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const MARCIN_CHAT_ID = "1521027574";

    if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN not set");
      return { success: false, error: "No bot token" };
    }

    let text = "";
    if (args.type === "completed") {
      text = `✅ <b>Task ukończony!</b>\n\n${args.agentName} skończył: <b>${args.taskTitle}</b>`;
    } else if (args.type === "blocked") {
      text = `🚫 <b>Task zablokowany</b>\n\n${args.agentName} potrzebuje pomocy z: <b>${args.taskTitle}</b>\n\n${args.message || ""}`;
    } else if (args.type === "mention") {
      text = `👋 <b>${args.agentName}</b> wspomniał Cię w MC\n\n${args.message || ""}`;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: MARCIN_CHAT_ID,
            text,
            parse_mode: "HTML",
          }),
        }
      );
      const result = await response.json();
      return { success: result.ok, result };
    } catch (error) {
      console.error("Failed to notify Marcin:", error);
      return { success: false, error: String(error) };
    }
  },
});
