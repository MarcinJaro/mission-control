import { action } from "./_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

export const routeMessage = action({
  args: {
    content: v.string(),
    authorId: v.string(),
    mentions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Jeśli są explicit mentions, użyj ich
    if (args.mentions.length > 0) {
      return { targets: args.mentions, reasoning: "Explicit mentions", cost: 0 };
    }
    
    // Wywołaj Haiku dla smart routing
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `Route this message to the right agent(s).

AGENTS:
- main (Gilfoyl): Architect, tech, coordination
- bestia (Bestia): Health, diet, exercise
- marketing (Maverick): Marketing, growth, SEO
- ksiegowy (Feliks): Finance, accounting, taxes
- assistant (Zosia): Calendar, reminders, errands
- investor (Gordon): Investments, portfolio

MESSAGE from ${args.authorId}:
"${args.content}"

If message is general like "hi" or "are you there?" → route to ALL agents.
If message is acknowledgment like "thanks" "ok" → route to NONE.
Otherwise route to the most relevant agent(s).

Return JSON: {"targets": ["sessionKey1"], "reasoning": "why"}`
      }]
    });
    
    // Parse response
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return { targets: ["main"], reasoning: "Parse error, fallback to main", cost: 0 };
    }
    
    const decision = JSON.parse(match[0]);
    const cost = (response.usage.input_tokens * 0.25 + response.usage.output_tokens * 1.25) / 1_000_000;
    
    return { ...decision, cost };
  },
});
