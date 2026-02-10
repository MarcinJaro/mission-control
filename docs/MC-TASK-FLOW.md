# Mission Control — Task Flow & System Analysis

## 🔄 ZASADA: Task Decomposition Loop

**Po zakończeniu każdego taska agent MUSI:**

1. **Wyekstrahować follow-up taski** — jeśli z deliverable wynikają kolejne kroki, stwórz je przez `tasks:create`
2. **Oznaczyć blocker questions** — pytania wymagające decyzji Marcina → osobny task z priorytetem `urgent` i prefixem `⚠️`
3. **Uploadować deliverable do Convex** — `documents:create` + `tasks:addDeliverable` (NIGDY lokalny plik!)

**Flow:**
```
Task done → Deliverable uploaded → Follow-up tasks created → Submit for review
```

**Bez tego:** praca = raport na półkę. Z tym: pozytywny loop, robota posuwa się dalej.

---

> Autor: Gilfoyl | Data: 2026-02-10
> Status: **🔴 System działa fragmentarycznie — wymaga naprawy**

---

## 1. Stan Obecny — Diagnoza

### 📊 Statystyki tasków
| Status | Ilość | Komentarz |
|--------|-------|-----------|
| inbox | 3 | Nikt ich nie podejmuje |
| assigned | 5 | Przypisane, ale nikt nie rusza |
| in_progress | 4 | Część to duplikaty |
| review | 0 | Nikt nie przechodzi do review |
| done | 10 | Głównie trivialne lub zrobione ręcznie przez Marcina/Gilfoyla |
| blocked | 0 | Nikt nie raportuje blockerów |

### 🔴 Kluczowe Problemy

#### Problem 1: **Agenci nie odbierają tasków**
- `wakeAgent` wysyła webhook do `https://zosia.creativerebels.pl/mc-chat/wake`
- Ten endpoint to **Zosia's webhook**, nie uniwersalny router
- Efekt: tylko Zosia teoretycznie dostaje wake, reszta agentów **nigdy nie jest budzona**
- Nawet Zosia prawdopodobnie nie przetwarza tego poprawnie

#### Problem 2: **Brak pętli feedback — agenci nie mają jak się dowiedzieć o taskach**
- Heartbeat (HEARTBEAT.md) sprawdza `notifications:undelivered` — ale **nie wysyła ich do agentów**
- Jest 12 undelivered notifications — nikt ich nie procesuje
- `mc-chat-process.sh` tylko wypisuje nowe wiadomości — **nie routuje ich**

#### Problem 3: **Brak enforced workflow**
- Task może wiecznie siedzieć w `assigned` — brak timeout/escalation
- Nikt nie zmienia statusu na `in_progress` → agenci nie wiedzą że powinni
- Brak SLA (np. urgent = 4h, high = 24h)
- Brak auto-escalation do Marcina

#### Problem 4: **Duplikaty tasków**
- "🚀 BuzzRank Launch - Marketing Tasks" istnieje DWA RAZY w `in_progress`
- Brak deduplication logic

#### Problem 5: **Agent status nie jest aktualizowany**
- Wszystkie agenty mają status `idle` z `lastSeenAt` sprzed dni
- `agents:heartbeat` istnieje ale nikt go nie woła regularnie
- Brak widoczności kto jest "online"

---

## 2. Poprawny Flow Zadań (TO-BE)

### 2.1 Lifecycle taska

```
 ┌──────────┐     ┌──────────┐     ┌─────────────┐     ┌────────┐     ┌──────┐
 │  INBOX   │────▶│ ASSIGNED │────▶│ IN_PROGRESS │────▶│ REVIEW │────▶│ DONE │
 └──────────┘     └──────────┘     └─────────────┘     └────────┘     └──────┘
                        │                 │                                │
                        │                 ▼                                │
                        │           ┌──────────┐                          │
                        └──────────▶│ BLOCKED  │──────────────────────────┘
                                    └──────────┘
```

### 2.2 Kto robi co

| Akcja | Kto | Trigger |
|-------|-----|---------|
| Tworzenie taska | Marcin / Agent / System | Telegram, MC Chat, cron |
| Przypisanie | Gilfoyl (koordynator) | Automatycznie lub manualnie |
| **Wake agenta** | System | `sessions_send` do agenta via OpenClaw |
| Start pracy | Agent (assignee) | Po odebraniu notyfikacji |
| Status → in_progress | Agent | Na początku pracy |
| Status → review | Agent | Po zakończeniu, przed merge/delivery |
| Status → done | Marcin / Dredd | Po review |
| Status → blocked | Agent | Gdy nie może kontynuować |
| Escalation | System | Timeout na assigned/in_progress |

### 2.3 Mechanizm Wake (KRYTYCZNY)

**Obecny (broken):**
```
Task created → Convex scheduler → HTTP POST to zosia.creativerebels.pl → ??? → nic
```

**Poprawny:**
```
Task created/assigned
  → Gilfoyl heartbeat picks up undelivered notifications
  → Gilfoyl uses `sessions_send(sessionKey, message)` to wake agent
  → Agent receives message in their OpenClaw session
  → Agent reads task, starts work
  → Agent updates status via convex CLI
```

Alternatywnie (lepiej):
```
Task created/assigned
  → Cron job per agent (co 10-15 min) sprawdza `notifications:forAgent`
  → Agent sam odbiera swoje taski
  → Nie zależy od Gilfoyla jako single point of failure
```

### 2.4 SLA & Escalation

| Priorytet | Max czas na `assigned` | Max czas na `in_progress` | Escalation |
|-----------|----------------------|--------------------------|------------|
| urgent | 1h | 4h | Ping Marcin |
| high | 4h | 24h | Ping Marcin |
| medium | 24h | 72h | Auto-reassign |
| low | 72h | 1 tydzień | Archive |

---

## 3. Co Trzeba Naprawić

### 🔧 Priorytet 1: Wake System (KRYTYCZNE)

**Opcja A: Gilfoyl jako router (quick fix)**
- W heartbeat: pobierz undelivered notifications
- Dla każdej: `sessions_send(agent.sessionKey, taskMessage)`
- Oznacz jako delivered

**Opcja B: Per-agent cron (lepsze, niezależne)**
- Każdy agent ma swój cron job (isolated + agentTurn)
- Co 15 min sprawdza swoje notyfikacje
- Sam odbiera i procesuje taski

**Rekomendacja: Opcja A teraz, Opcja B docelowo**

### 🔧 Priorytet 2: Agent Task Processing

Każdy agent musi mieć w swoim AGENTS.md/HEARTBEAT.md:
```
1. Sprawdź notifications:forAgent
2. Dla nowych tasków:
   a. Przeczytaj task (tasks:get)
   b. Zmień status → in_progress
   c. Wykonaj zadanie
   d. Zmień status → done (lub review/blocked)
   e. Dodaj deliverable jeśli jest output
3. Ping Marcin na Telegram gdy done/blocked
```

### 🔧 Priorytet 3: Heartbeat Task Monitoring

Dodać do heartbeat (Gilfoyl):
```
1. Sprawdź taski assigned > 24h → ping agent lub escalate
2. Sprawdź taski in_progress > 72h → escalate do Marcina
3. Sprawdź undelivered notifications → doręcz
4. Sprawdź duplikaty → merge/delete
```

### 🔧 Priorytet 4: Fix wakeAgent endpoint

Zmienić z `zosia.creativerebels.pl` na:
- Albo: OpenClaw API endpoint (jeśli istnieje)
- Albo: usunąć HTTP webhook i polegać na polling (Opcja B)

---

## 4. Natychmiastowe Akcje (do zrobienia TERAZ)

- [ ] Doręczyć 12 undelivered notifications via `sessions_send`
- [ ] Wyczyścić duplikat taska "BuzzRank Launch Marketing"
- [ ] Zaktualizować taski inbox → przypisać lub zamknąć
- [ ] Dodać task monitoring do HEARTBEAT.md
- [ ] Ustawić cron per-agent lub naprawić routing w heartbeat

---

## 5. Architektura Docelowa

```
┌─────────────────────────────────────────────────┐
│                  MISSION CONTROL                 │
│              (Convex — disciplined-wombat-115)   │
├─────────────────────────────────────────────────┤
│  tasks · notifications · chat · agents · docs   │
└──────────────────┬──────────────────────────────┘
                   │
          ┌────────┼────────┐
          │        │        │
    ┌─────▼──┐ ┌───▼────┐ ┌▼────────┐
    │Gilfoyl │ │ Agents │ │Dashboard│
    │(router)│ │(cron)  │ │(Next.js)│
    └────────┘ └────────┘ └─────────┘
       │            │
       │  sessions_send / poll
       │            │
    ┌──▼────────────▼──┐
    │   OpenClaw Host   │
    │  (Mac Mini 24/7)  │
    └───────────────────┘
```

**Flow:**
1. Task tworzony (Marcin/agent/system) → Convex
2. Notification generowana → Convex
3. Gilfoyl heartbeat LUB agent cron → poll notifications
4. `sessions_send` budzi agenta
5. Agent pracuje, updateuje status
6. Done → Marcin dostaje ping na Telegram
7. Dashboard pokazuje real-time stan

---

---

## 6. Implemented Features (2026-02-10)

### Convex Mutations/Queries
| Function | Opis |
|----------|------|
| `tasks:create` | Deduplication via titleHash, effort estimation |
| `tasks:submitForReview` | Auto-wysyłka do Dredda |
| `tasks:reject` | Max 2 rejecty → escalacja do Marcina |
| `tasks:weeklyStats` | Completion rate, avg time, per-agent stats, bottlenecki |
| `notifications:acknowledge` | Agent potwierdza odbiór |
| `notifications:recordDeliveryAttempt` | Retry tracking |
| `agents:refreshStatuses` | TTL: active→idle po 6h, →offline po 24h |
| `agents:autoAssignInbox` | Keyword-based auto-assign (expertise map) |

### Cron Jobs (per-agent MC polling)
| Agent | Schedule | Typ |
|-------|----------|-----|
| Dredd | 10:00, 16:00 | Review duty |
| Feliks | 08:30, 14:00 | Task check |
| Zosia | 09:00, 15:00 | Task check |
| Gordon | 07:30, 15:00 | Task check |
| Maverick | 09:30, 15:30 | Task check |
| Maintenance | co 2h | TTL refresh + auto-assign |
| Weekly Report | niedz 20:00 | Stats + raport |

### Review Process
```
Agent kończy task
  → tasks:submitForReview (auto → Dredd)
  → Dredd review
    → APPROVE → tasks:updateStatus → done → ping Marcin
    → REJECT (1st) → back to in_progress + powód
    → REJECT (2nd) → blocked → escalacja do Marcina
```

### Dredd's Rating Checklist
- [x] Fix 1: Duplikaty inbox
- [x] Fix 2: Inbox cleanup + assign
- [x] Fix 3: SLA violations escalation
- [x] Fix 4: Delivery confirmation (acknowledge + retry)
- [x] Fix 5: Deduplication (titleHash)
- [x] Fix 6: Review process (submitForReview + reject + max 2x)
- [x] Fix 7: Per-agent cron (SPOF eliminated)
- [x] Nice-to-have: Auto-assign inbox (keyword expertise map)
- [x] Nice-to-have: Agent status TTL (6h idle, 24h offline)
- [x] Nice-to-have: Task effort estimation (xs/s/m/l/xl)
- [x] Nice-to-have: Weekly report (stats + bottlenecks)

*Ten dokument jest źródłem prawdy dla task flow w MC. Aktualizuj po zmianach.*
