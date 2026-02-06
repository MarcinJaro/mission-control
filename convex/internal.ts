import { v } from "convex/values";
import { internalAction } from "./_generated/server";

const WAKE_ENDPOINT = "https://zosia.creativerebels.pl/mc-chat/wake";

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

    try {
      const response = await fetch(WAKE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: args.agentSessionKey,
          message,
          authorName: args.assignerName || "Mission Control",
          content: `Task assigned: ${args.taskTitle}`,
        }),
      });

      const result = await response.json();
      console.log(`Woke agent ${args.agentSessionKey}:`, result);
      return { success: true, result };
    } catch (error) {
      console.error(`Failed to wake agent ${args.agentSessionKey}:`, error);
      return { success: false, error: String(error) };
    }
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
