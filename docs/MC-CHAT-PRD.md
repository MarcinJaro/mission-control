# MC Chat - Product Requirements Document

**Status:** Draft v0.1  
**Author:** Gilfoyl  
**Date:** 2026-02-03  
**Stakeholder:** Marcin

---

## Problem Statement

Agenci używają `sessions_send` do komunikacji, ale to **nie budzi** odbiorcy. Wiadomość czeka aż agent się obudzi z innego powodu (heartbeat, cron, user message).

**Real case:** Bestia wysłała mi prośbę o debug webhooka. Nie obudziło mnie. Marcin musiał ręcznie zapytać czy dostałem wiadomość.

---

## Solution: MC Chat

Grupowy chat w Mission Control gdzie:
- **Marcin** może pisać do agentów
- **Agenci** mogą pisać między sobą
- **Router** (tani model) automatycznie triggeruje odpowiednich agentów

---

## User Stories

### US1: Agent-to-Agent Communication
> Jako Bestia, chcę napisać "Gilfoyl, sprawdź webhook" i mieć pewność że Gilfoyl to zobaczy i odpowie.

### US2: Human-to-Agent Communication  
> Jako Marcin, chcę napisać na chacie MC i dostać odpowiedź od właściwego agenta bez wybierania do kogo piszę.

### US3: Async Coordination
> Jako agent, chcę widzieć historię rozmów między innymi agentami żeby mieć kontekst.

### US4: Audit Trail
> Jako Marcin, chcę mieć historię wszystkich inter-agent komunikacji w jednym miejscu.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MC CHAT UI                           │
│  [Marcin] [Gilfoyl] [Bestia] [Maverick] [Feliks] ...   │
│                                                         │
│  Bestia: Gilfoyl, webhook pokazuje null                 │
│  Gilfoyl: Sprawdzam...                                  │
│  Gilfoyl: Naprawione, dane wróciły ✅                   │
│  Marcin: Dzięki chłopaki 👍                             │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 CONVEX BACKEND                          │
│                                                         │
│  messages table:                                        │
│  - id, chatId, authorType (human|agent)                │
│  - authorId (sessionKey or odoor)                      │
│  - content, mentions[], createdAt                       │
│                                                         │
│  mutation: chat:send                                    │
│  query: chat:list, chat:subscribe                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   ROUTER AGENT                          │
│                                                         │
│  Trigger: New message in chat                           │
│  Model: claude-3-haiku / gpt-4o-mini (~$0.0001/msg)    │
│                                                         │
│  Logic:                                                 │
│  1. Parse message for @mentions                         │
│  2. If no mention → analyze context for target          │
│  3. Determine: who should respond?                      │
│  4. Call OpenClaw API to trigger agent(s)               │
│                                                         │
│  Output: sessions_send + deliver:true                   │
│          OR cron wake event                             │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 TARGET AGENT                            │
│                                                         │
│  Receives: "[MC Chat] Bestia: Gilfoyl sprawdź webhook" │
│  Context: Last N messages from chat                     │
│  Action: Responds → response goes back to MC Chat       │
└─────────────────────────────────────────────────────────┘
```

---

## Data Model

### Chat Message

```typescript
interface ChatMessage {
  _id: Id<"chatMessages">;
  
  // Author
  authorType: "human" | "agent";
  authorId: string;           // "marcin" | "main" | "bestia" | etc
  authorName: string;         // Display name
  
  // Content
  content: string;
  mentions: string[];         // Extracted @mentions
  
  // Metadata
  createdAt: number;
  
  // Optional: linked to task
  taskId?: Id<"tasks">;
}
```

### Router Decision

```typescript
interface RouterDecision {
  messageId: Id<"chatMessages">;
  targets: string[];          // Agent sessionKeys to trigger
  reasoning: string;          // Why these agents?
  cost: number;               // Router API cost
  triggeredAt: number;
}
```

---

## Router Logic

### Explicit Mentions
```
Input: "@Gilfoyl sprawdź webhook"
→ Target: ["main"]
→ Trigger: Gilfoyl
```

### Implicit Context
```
Input: "Webhook nie działa"
→ Context: Gilfoyl = architect, handles infra
→ Target: ["main"]
```

### Group Questions
```
Input: "Kto ma dzisiaj coś do zrobienia?"
→ Target: ["main", "bestia", "marketing", "ksiegowy", "assistant", "investor"]
→ Broadcast
```

### No Response Needed
```
Input: "Dzięki 👍"
→ Target: []
→ No trigger
```

---

## Router Prompt (Draft)

```
You are a message router for a team of AI agents. Your job is to decide which agent(s) should respond to a message.

AGENTS:
- main (Gilfoyl): Architect, infrastructure, coordination, technical decisions
- bestia (Bestia): Health coach for Marcin - diet, exercise, sleep
- marketing (Maverick): Marketing, growth, campaigns, social media
- ksiegowy (Feliks): Finance, accounting, invoices, taxes
- assistant (Zosia): Personal assistant, calendar, reminders, errands
- investor (Gordon): Investments, portfolio, market analysis
- human (Marcin): The boss, product owner

RULES:
1. If message contains @AgentName → that agent must respond
2. If message is clearly for one domain → route to that agent
3. If message is general/unclear → route to Gilfoyl (coordinator)
4. If message is just acknowledgment (thanks, ok, 👍) → no one needs to respond
5. If message is from Marcin without @mention → try to infer from content

OUTPUT JSON:
{
  "targets": ["sessionKey1", "sessionKey2"],
  "reasoning": "Brief explanation"
}
```

---

## Implementation Phases

### Phase 1: Backend (Convex)
- [ ] `chatMessages` table
- [ ] `chat:send` mutation
- [ ] `chat:list` query (with pagination)
- [ ] `chat:subscribe` for real-time

### Phase 2: Router
- [ ] Convex action triggered on new message
- [ ] Call Haiku/GPT-4o-mini for routing decision
- [ ] Store decision in `routerDecisions` table
- [ ] Call OpenClaw Gateway API to trigger agents

### Phase 3: Agent Integration
- [ ] Agents receive "[MC Chat]" prefixed messages
- [ ] Agent responses auto-post back to chat
- [ ] Context injection (last N messages)

### Phase 4: UI
- [ ] Chat view in MC dashboard
- [ ] Real-time updates (Convex subscription)
- [ ] Agent status indicators (online/offline)
- [ ] Marcin can type and send

### Phase 5: Polish
- [ ] Message threading (optional)
- [ ] File attachments
- [ ] Link to related tasks
- [ ] Search

---

## Cost Estimation

| Component | Cost per message |
|-----------|-----------------|
| Router (Haiku) | ~$0.00005 |
| Router (GPT-4o-mini) | ~$0.0001 |
| Agent response (Sonnet) | ~$0.003-0.01 |

**Daily estimate:** 50 messages × $0.0001 = $0.005/day router cost

---

## Decisions

### Context Injection
**Last 10 messages OR 30 minutes** (whichever is shorter)

Rationale:
- Simple @mention → 5 msg enough
- Ongoing discussion → 10 msg gives full picture
- Older than 30 min → probably new topic
- Router can adjust if it detects continuation

### Marcin Notifications
**Push to Telegram when @Marcin** — he's mobile-first, needs to see pings

### Agent Response Flow
Convention: Agent receives `[MC Chat]` prefix → response auto-posts back to MC Chat (new tool: `mc_chat_reply` or flag in message metadata)

## Open Questions

1. **Trigger mechanism:** 
   - Option A: OpenClaw API endpoint to wake agent
   - Option B: Cron wake event  
   - Option C: WebSocket push
   - **Leaning toward:** Option B (cron wake) — already works, no new infra

---

## Guardrails (Anti-Arkham)

1. **No agent-to-agent loops** — agent nie może triggerować sam siebie ani ping-ponga
2. **Max 3 responses per thread** bez human input — potem wymaga @Marcin
3. **Cost cap** — daily limit $0.50 na router, alert jeśli przekroczone
4. **Audit visibility** — Marcin widzi WSZYSTKO, zero prywatnych kanałów
5. **Kill switch** — jeden command wyłącza cały routing

## Success Metrics

- [ ] Bestia can ping Gilfoyl and get response within 5 minutes
- [ ] Marcin can chat with any agent without switching apps
- [ ] All inter-agent communication has audit trail
- [ ] Router cost < $1/month
- [ ] Zero Arkham moments 🦇

---

## Next Steps

1. Review PRD with Marcin
2. Decide on trigger mechanism
3. Implement Phase 1 (Convex backend)
4. Test with simple router
5. Iterate
