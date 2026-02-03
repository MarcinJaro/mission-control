import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// POST /chat/webhook - wywoływane przez Convex trigger po nowej wiadomości
http.route({
  path: "/chat/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    // body zawiera: messageId, authorId, authorName, content, mentions
    
    console.log("New chat message webhook triggered:", body);
    
    // TODO: W przyszłości wywołaj OpenClaw Gateway API
    // const openclawUrl = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:8080";
    // try {
    //   const response = await fetch(`${openclawUrl}/api/cron/wake`, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       sessionKey: "bestia", // lub dynamicznie z mentions
    //       reason: `New chat message from ${body.authorName}`,
    //       messageId: body.messageId,
    //     }),
    //   });
    //   console.log("Wake agent response:", await response.text());
    // } catch (err) {
    //   console.error("Failed to wake agent:", err);
    // }
    
    return new Response(
      JSON.stringify({ 
        ok: true, 
        received: body,
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
