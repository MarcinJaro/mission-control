#!/bin/bash
# MC Chat Router Runner
# Runs the router and processes trigger commands

cd "$(dirname "$0")/.."

# Run router and capture output
OUTPUT=$(ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" node scripts/mc-chat-router.mjs 2>&1)

# Log output
echo "$OUTPUT"

# Parse and execute triggers
echo "$OUTPUT" | while IFS= read -r line; do
  # Check if line is JSON with action
  ACTION=$(echo "$line" | jq -r '.action // empty' 2>/dev/null)
  
  if [ "$ACTION" = "trigger" ]; then
    SESSION_KEY=$(echo "$line" | jq -r '.sessionKey')
    MESSAGE=$(echo "$line" | jq -r '.message')
    
    echo "Triggering agent: $SESSION_KEY"
    
    # Send message to agent session
    # The message will be delivered when the agent wakes up
    # For now, we use cron wake to nudge the session
    openclaw cron wake --text "$MESSAGE" --mode now 2>/dev/null || true
  fi
  
  if [ "$ACTION" = "notify_marcin" ]; then
    CONTENT=$(echo "$line" | jq -r '.content')
    echo "Notifying Marcin: $CONTENT"
    # This would send to Telegram - for now just log
    # The main agent's session will handle Telegram delivery
  fi
done
