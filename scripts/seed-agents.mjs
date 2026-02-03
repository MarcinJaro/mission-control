#!/usr/bin/env node
/**
 * Seed agents to Convex database
 * Usage: CONVEX_URL=https://xxx.convex.cloud node scripts/seed-agents.mjs
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = process.env.CONVEX_URL || "https://disciplined-wombat-115.convex.cloud";

const agents = [
  {
    name: "Gilfoyl",
    emoji: "🤖",
    role: "Architect & Coordinator",
    description: "Main agent - infrastructure, technical decisions, coordination",
    sessionKey: "main",
  },
  {
    name: "Bestia",
    emoji: "🦁",
    role: "Health Coach",
    description: "Diet, exercise, sleep, wellness tracking",
    sessionKey: "bestia",
  },
  {
    name: "Maverick",
    emoji: "🎯",
    role: "Marketing Black Ops",
    description: "Marketing, growth, campaigns, social media, SEO",
    sessionKey: "marketing",
  },
  {
    name: "Feliks",
    emoji: "📊",
    role: "CFO",
    description: "Finance, accounting, invoices, taxes, bookkeeping",
    sessionKey: "ksiegowy",
  },
  {
    name: "Zosia",
    emoji: "✨",
    role: "Personal Assistant",
    description: "Calendar, reminders, errands, phone calls",
    sessionKey: "assistant",
  },
  {
    name: "Gordon",
    emoji: "🐺",
    role: "Investment Advisor",
    description: "Investments, portfolio, market analysis",
    sessionKey: "investor",
  },
];

async function seed() {
  console.log(`Seeding agents to ${CONVEX_URL}...`);
  
  const client = new ConvexHttpClient(CONVEX_URL);
  
  for (const agent of agents) {
    try {
      // Check if agent already exists
      const existing = await client.query(api.agents.getBySessionKey, { 
        sessionKey: agent.sessionKey 
      });
      
      if (existing) {
        console.log(`⏭️  ${agent.name} already exists`);
        continue;
      }
      
      await client.mutation(api.agents.create, agent);
      console.log(`✅ Created ${agent.emoji} ${agent.name}`);
    } catch (error) {
      // If getBySessionKey doesn't exist, try creating anyway
      try {
        await client.mutation(api.agents.create, agent);
        console.log(`✅ Created ${agent.emoji} ${agent.name}`);
      } catch (e) {
        console.log(`⚠️  ${agent.name}: ${e.message}`);
      }
    }
  }
  
  console.log("\nDone! 🎉");
}

seed().catch(console.error);
