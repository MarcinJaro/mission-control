#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';

function runConvex(prod, fn, args) {
  const flag = prod ? '--prod' : '';
  const escaped = JSON.stringify(args).replace(/'/g, "'\\''");
  const cmd = `npx convex run ${flag} ${fn} '${escaped}'`;
  try {
    const result = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(result.trim());
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('🚀 Migracja Tasks: DEV → PROD\n');

  // 1. Seed agents on PROD
  console.log('1. Seeding agents na PROD...');
  runConvex(true, 'agents:seed', {});
  console.log('   ✓ Done\n');

  // 2. Get tasks from DEV
  console.log('2. Pobieranie tasków z DEV...');
  const tasks = runConvex(false, 'tasks:list', {});
  console.log(`   Found ${tasks.length} tasks\n`);

  // 3. Create tasks on PROD
  console.log('3. Tworzenie tasków na PROD...');
  let created = 0;
  let skipped = 0;
  
  for (const task of tasks) {
    // Skip junk
    if (!task.title || task.title.includes('cvfnghmj') || task.title.trim() === '') {
      skipped++;
      continue;
    }
    
    // Create on PROD
    const result = runConvex(true, 'tasks:create', {
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'medium'
    });
    
    if (result) {
      created++;
      
      // Update status if not inbox
      if (task.status && task.status !== 'inbox') {
        runConvex(true, 'tasks:updateStatus', {
          id: result,
          status: task.status,
          agentSessionKey: 'main'
        });
      }
      process.stdout.write('.');
    }
  }
  
  console.log(`\n   ✓ Created: ${created}, Skipped: ${skipped}\n`);

  console.log('✅ Migracja zakończona!');
  console.log('\nNastępne kroki:');
  console.log('1. Zmień .env.local na PROD');
  console.log('2. Update skryptów na --prod');
}

main().catch(console.error);
