import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// Wake endpoint URL (Zosia webhook server z tunelem)
const WAKE_ENDPOINT = "https://zosia.creativerebels.pl/mc-chat/wake";

// POST /chat/webhook - wywoływane automatycznie po nowej wiadomości w chacie
http.route({
  path: "/chat/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { messageId, authorId, authorName, content, mentions } = body;
    
    console.log("MC Chat webhook:", { authorId, authorName, content, mentions });
    
    // Nie budź autora wiadomości
    if (!authorId || authorId === "system") {
      return new Response(JSON.stringify({ ok: true, skipped: "system message" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Wywołaj Gemini router żeby zdecydować kogo obudzić
    let targets: string[] = [];
    let reasoning = "";
    
    try {
      const routerResult = await ctx.runAction(api.router.routeMessage, {
        content: content || "",
        authorId: authorId,
        mentions: mentions || [],
      });
      targets = routerResult.targets || [];
      reasoning = routerResult.reasoning || "";
      console.log("Router decision:", { targets, reasoning });
    } catch (err) {
      console.error("Router error:", err);
      // Fallback do main jeśli router zawiedzie
      targets = ["main"];
      reasoning = "Router error, fallback to main";
    }
    
    // Odfiltruj autora z targets
    targets = targets.filter(t => t !== authorId);
    
    if (targets.length === 0) {
      console.log("No agents to wake");
      return new Response(JSON.stringify({ ok: true, targets: [], reasoning }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Budź każdego agenta przez webhook
    const wakePromises = targets.map(async (agentId) => {
      try {
        const mcChatMessage = `[MC Chat] ${authorName} napisał: "${content}"

Odpowiedz na PROD:
cd ~/.openclaw/workspace-main/projects/mission-control && npx convex run --prod chat:send '{"authorType":"agent","authorId":"${agentId}","authorName":"TWOJA_NAZWA","content":"TWOJA ODPOWIEDŹ"}'`;

        const response = await fetch(WAKE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            message: mcChatMessage,
            authorName,
            content,
          }),
        });
        
        const result = await response.json();
        console.log(`Wake ${agentId}:`, result);
        return { agentId, success: true };
      } catch (err) {
        console.error(`Failed to wake ${agentId}:`, err);
        return { agentId, success: false, error: String(err) };
      }
    });
    
    const results = await Promise.all(wakePromises);
    
    return new Response(
      JSON.stringify({ 
        ok: true, 
        targets,
        reasoning,
        wakeResults: results,
        timestamp: Date.now() 
      }), 
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }),
});

// Health check endpoint
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({ 
        status: "ok", 
        service: "mission-control-webhook",
        timestamp: Date.now() 
      }), 
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }),
});

export default http;
