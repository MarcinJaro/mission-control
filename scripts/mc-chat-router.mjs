#!/usr/bin/env node
/**
 * MC Chat Router
 * 
 * Polls MC Chat for new messages and routes them to appropriate agents.
 * Uses Haiku for cheap, fast routing decisions.
 * 
 * Usage: node mc-chat-router.mjs
 * 
 * Env vars:
 *   ANTHROPIC_API_KEY - for Haiku routing
 *   CONVEX_URL - Convex deployment URL
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

// Config
const CONVEX_URL = process.env.CONVEX_URL || "https://friendly-falcon-885.convex.cloud";
const STATE_FILE = path.join(process.env.HOME, ".openclaw/workspace-main/projects/mission-control/data/router-state.json");
const ROUTER_MODEL = "claude-3-haiku-20240307";
const MAX_COST_PER_DAY = 0.50; // USD

// Agent definitions for router
const AGENTS = {
  main: { name: "Gilfoyl", role: "Architect, infrastructure, coordination, technical decisions" },
  bestia: { name: "Bestia", role: "Health coach - diet, exercise, sleep, wellness" },
  marketing: { name: "Maverick", role: "Marketing, growth, campaigns, social media, SEO" },
  ksiegowy: { name: "Feliks", role: "Finance, accounting, invoices, taxes, bookkeeping" },
  assistant: { name: "Zosia", role: "Personal assistant, calendar, reminders, errands" },
  investor: { name: "Gordon", role: "Investments, portfolio, market analysis" },
  marcin: { name: "Marcin", role: "Boss, product owner - notify on Telegram" },
};

const ROUTER_PROMPT = `You are a message router for a team of AI agents. Decide which agent(s) should respond to a message.

AGENTS:
${Object.entries(AGENTS).map(([id, a]) => `- ${id} (${a.name}): ${a.role}`).join("\n")}

RULES:
1. If message contains @AgentName → that agent must respond
2. If message is clearly for one domain → route to that agent
3. If message is general/unclear → route to main (Gilfoyl, coordinator)
4. If message is just acknowledgment (thanks, ok, 👍, emoji only) → respond with empty targets
5. If author is same as likely target → don't route to self
6. "marcin" means notify Marcin on Telegram (special handling)

Respond with JSON only:
{"targets": ["sessionKey1"], "reasoning": "brief explanation"}`;

// Initialize clients
const convex = new ConvexHttpClient(CONVEX_URL);
let anthropic;

// State management
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Error loading state:", e);
  }
  return { lastProcessedAt: 0, dailyCost: 0, dailyCostDate: new Date().toISOString().split("T")[0] };
}

function saveState(state) {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Reset daily cost if new day
function resetDailyCostIfNeeded(state) {
  const today = new Date().toISOString().split("T")[0];
  if (state.dailyCostDate !== today) {
    state.dailyCost = 0;
    state.dailyCostDate = today;
  }
  return state;
}

// Route a single message
async function routeMessage(message, context) {
  const contextStr = context.length > 0 
    ? `\nRECENT CONTEXT:\n${context.map(m => `${m.authorName}: ${m.content}`).join("\n")}\n`
    : "";
  
  const userPrompt = `${contextStr}
NEW MESSAGE to route:
From: ${message.authorName} (${message.authorId})
Content: ${message.content}

Who should respond?`;

  const response = await anthropic.messages.create({
    model: ROUTER_MODEL,
    max_tokens: 150,
    messages: [
      { role: "user", content: ROUTER_PROMPT + "\n\n" + userPrompt }
    ],
  });

  // Parse response
  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("Failed to parse router response:", text);
    return { targets: [], reasoning: "Parse error", cost: 0 };
  }

  const decision = JSON.parse(jsonMatch[0]);
  
  // Calculate cost (Haiku: $0.25/M input, $1.25/M output)
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const cost = (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000;

  return { ...decision, cost };
}

// Trigger agent via OpenClaw
async function triggerAgent(sessionKey, message, context) {
  // Format context for agent
  const contextLines = context.slice(-5).map(m => 
    `[${new Date(m.createdAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}] ${m.authorName}: ${m.content}`
  ).join("\n");

  const payload = `[MC Chat] Nowa wiadomość wymaga Twojej odpowiedzi:

${contextLines ? `--- Kontekst ---\n${contextLines}\n--- Koniec kontekstu ---\n\n` : ""}Wiadomość od ${message.authorName}:
${message.content}

Odpowiedz używając: npx convex run chat:send '{"authorType":"agent","authorId":"${sessionKey}","authorName":"TWOJA_NAZWA","content":"TWOJA_ODPOWIEDŹ"}'`;

  // Use cron wake to trigger the agent
  // This writes to stdout which will be captured by the cron system
  console.log(JSON.stringify({
    action: "trigger",
    sessionKey,
    message: payload,
  }));

  return true;
}

// Special handling for Marcin mentions
async function notifyMarcin(message, context) {
  console.log(JSON.stringify({
    action: "notify_marcin",
    content: `[MC Chat] ${message.authorName}: ${message.content}`,
  }));
}

// Main router logic
async function run() {
  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set");
    process.exit(1);
  }
  
  anthropic = new Anthropic();
  
  let state = loadState();
  state = resetDailyCostIfNeeded(state);

  // Check daily cost limit
  if (state.dailyCost >= MAX_COST_PER_DAY) {
    console.log(JSON.stringify({ 
      action: "skip", 
      reason: `Daily cost limit reached: $${state.dailyCost.toFixed(4)}` 
    }));
    return;
  }

  // Get new messages since last check
  const messages = await convex.query(api.chat.since, {
    sinceMs: state.lastProcessedAt + 1,
    limit: 20,
  });

  if (messages.length === 0) {
    console.log(JSON.stringify({ action: "no_new_messages" }));
    return;
  }

  console.log(JSON.stringify({ action: "processing", count: messages.length }));

  // Get context
  const context = await convex.query(api.chat.contextForAgent, {
    maxMessages: 10,
    maxAgeMs: 30 * 60 * 1000,
  });

  // Process each message
  for (const message of messages) {
    // Skip if author is human "marcin" - don't route his own messages back to him
    // But DO process them to route to agents
    
    // Route the message
    const decision = await routeMessage(message, context);
    state.dailyCost += decision.cost;

    // Log decision to Convex
    await convex.mutation(api.chat.logRouterDecision, {
      messageId: message._id,
      targets: decision.targets,
      reasoning: decision.reasoning,
      model: ROUTER_MODEL,
      cost: decision.cost,
      triggered: decision.targets.length > 0,
    });

    console.log(JSON.stringify({
      action: "routed",
      messageId: message._id,
      from: message.authorName,
      targets: decision.targets,
      reasoning: decision.reasoning,
      cost: decision.cost,
    }));

    // Trigger each target agent
    for (const target of decision.targets) {
      if (target === "marcin") {
        await notifyMarcin(message, context);
      } else if (target !== message.authorId) {
        // Don't trigger the author of the message
        await triggerAgent(target, message, context);
      }
    }

    // Update last processed
    state.lastProcessedAt = Math.max(state.lastProcessedAt, message.createdAt);
  }

  // Save state
  saveState(state);

  console.log(JSON.stringify({
    action: "complete",
    processed: messages.length,
    dailyCost: state.dailyCost,
  }));
}

run().catch(e => {
  console.error("Router error:", e);
  process.exit(1);
});
