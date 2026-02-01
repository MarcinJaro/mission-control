import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Send notification to Telegram
export const sendNotification = internalAction({
  args: {
    chatId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN not set");
      return { success: false, error: "Bot token not configured" };
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: args.chatId,
          text: args.message,
          parse_mode: "HTML",
        }),
      });

      const data = await response.json();
      
      if (!data.ok) {
        console.error("Telegram API error:", data);
        return { success: false, error: data.description };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send Telegram notification:", error);
      return { success: false, error: String(error) };
    }
  },
});

// Broadcast to Team HQ
export const broadcastToTeam = internalAction({
  args: {
    message: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const teamChatId = process.env.TELEGRAM_TEAM_CHAT_ID || "-5135833340";
    
    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN not set");
      return { success: false, error: "Bot token not configured" };
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: teamChatId,
          text: args.message,
          parse_mode: "HTML",
        }),
      });

      const data = await response.json();
      
      if (!data.ok) {
        console.error("Telegram API error:", data);
        return { success: false, error: data.description };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send Telegram notification:", error);
      return { success: false, error: String(error) };
    }
  },
});
