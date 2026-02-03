import { action } from "./_generated/server";
import { v } from "convex/values";

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
    
    // Wywołaj Gemini 2.0 Flash dla smart routing
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { targets: ["main"], reasoning: "No API key, fallback to main", cost: 0 };
    }

    const prompt = `Route this message to the right agent(s).

AGENTS:
- main (Gilfoyl): Architect, tech, coordination, infrastructure
- bestia (Bestia): Health coach, diet, exercise, sleep, wellness
- marketing (Maverick): Marketing, growth, SEO, campaigns
- ksiegowy (Feliks): Finance, accounting, taxes, invoices
- assistant (Zosia): Calendar, reminders, errands, personal tasks
- investor (Gordon): Investments, portfolio, market analysis

MESSAGE from ${args.authorId}:
"${args.content}"

RULES:
- If message is general greeting like "hi", "hello", "are you there?", "jesteście?" → route to ["main", "bestia", "marketing", "ksiegowy", "assistant", "investor"] (ALL)
- If message is acknowledgment like "thanks", "ok", "dzięki", "👍" → route to [] (NONE)
- If message mentions health/diet/exercise → route to ["bestia"]
- If message mentions money/invoice/tax → route to ["ksiegowy"]
- If message mentions marketing/seo/growth → route to ["marketing"]
- If message mentions calendar/reminder/errand → route to ["assistant"]
- If message mentions investment/stocks/portfolio → route to ["investor"]
- Otherwise route to ["main"] as coordinator

Return ONLY valid JSON (no markdown): {"targets": ["sessionKey1"], "reasoning": "brief reason"}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 150,
            },
          }),
        }
      );

      const data = await response.json();
      
      if (!response.ok || !data.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.error("Gemini error:", data);
        return { targets: ["main"], reasoning: "API error, fallback to main", cost: 0 };
      }

      const text = data.candidates[0].content.parts[0].text;
      const match = text.match(/\{[\s\S]*\}/);
      
      if (!match) {
        return { targets: ["main"], reasoning: "Parse error, fallback to main", cost: 0 };
      }
      
      const decision = JSON.parse(match[0]);
      
      // Gemini 2.0 Flash: ~$0.10/M input, ~$0.40/M output (bardzo tanie!)
      const inputTokens = prompt.length / 4; // rough estimate
      const outputTokens = text.length / 4;
      const cost = (inputTokens * 0.10 + outputTokens * 0.40) / 1_000_000;
      
      return { ...decision, cost };
    } catch (error) {
      console.error("Router error:", error);
      return { targets: ["main"], reasoning: "Exception, fallback to main", cost: 0 };
    }
  },
});
