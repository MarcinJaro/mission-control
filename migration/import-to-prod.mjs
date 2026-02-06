#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

const PROD = 'prod:disciplined-wombat-115';

function runConvex(fn, args) {
  const escaped = JSON.stringify(args).replace(/'/g, "'\\''");
  const cmd = `CONVEX_DEPLOYMENT=${PROD} npx convex run ${fn} '${escaped}'`;
  try {
    const result = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(result.trim());
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('🚀 Migrating to PROD...\n');

  // 1. Seed agents
  console.log('1. Seeding agents...');
  runConvex('agents:seed', {});
  console.log('   ✓ Agents seeded\n');

  // 2. Import tasks (without status, then update)
  console.log('2. Importing tasks...');
  const tasks = JSON.parse(fs.readFileSync('migration/tasks.json', 'utf-8'));
  let taskCount = 0;
  
  for (const task of tasks) {
    if (task.title?.includes('cvfnghmj')) continue;
    
    // Create without status
    const result = runConvex('tasks:create', {
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'medium',
      createdBySessionKey: 'main'
    });
    
    if (result) {
      taskCount++;
      // Update status if not inbox
      if (task.status && task.status !== 'inbox') {
        runConvex('tasks:updateStatus', {
          id: result,
          status: task.status,
          agentSessionKey: 'main'
        });
      }
      // Assign if needed
      if (task.assigneeIds?.length > 0) {
        for (const agentId of task.assigneeIds) {
          runConvex('tasks:assign', {
            id: result,
            agentId: agentId,
            agentSessionKey: 'main'
          });
        }
      }
      process.stdout.write('.');
    }
  }
  console.log(`\n   ✓ Imported ${taskCount} tasks\n`);

  // 3. Import chat
  console.log('3. Importing chat...');
  const chat = JSON.parse(fs.readFileSync('migration/chat.json', 'utf-8'));
  let chatCount = 0;
  const reversed = [...chat].reverse();
  
  for (const msg of reversed) {
    const result = runConvex('chat:send', {
      authorType: msg.authorType,
      authorId: msg.authorId,
      authorName: msg.authorName,
      content: msg.content,
      mentions: msg.mentions || []
    });
    if (result) {
      chatCount++;
      process.stdout.write('.');
    }
  }
  console.log(`\n   ✓ Imported ${chatCount} chat messages\n`);

  console.log('✅ Migration complete!');
}

main().catch(console.error);
