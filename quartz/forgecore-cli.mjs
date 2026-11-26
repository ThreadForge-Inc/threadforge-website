#!/usr/bin/env node
/**
 * Forgecore Sovereign Terminal CLI v1.3.1
 * Powered by © 2026 Threadforge Inc.
 *
 * Works immediately in Windows PowerShell, CMD, macOS, Linux & IDE Terminals
 * against the local Forgecore 5-Size Gateway (http://127.0.0.1:4173/v1).
 */

import readline from 'node:readline';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.FORGECORE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');

const SIZES = {
  '1': 'forgecore-spark-1',
  '2': 'forgecore-thor-1',
  '3': 'forgecore-ronin-1',
  '4': 'forgecore-genesis-1',
  '5': 'forgecore-titan-1',
};

async function ensureGatewayRunning() {
  try {
    const r = await fetch(`${BASE_URL}/api/health`);
    if (r.ok) return true;
  } catch {}

  try {
    const gwPath = path.join(__dirname, 'forgecore-universal-gateway.mjs');
    const child = spawn(process.execPath, [gwPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    await new Promise((r) => setTimeout(r, 900));
    return true;
  } catch {
    return false;
  }
}

async function askForgecore(model, prompt) {
  await ensureGatewayRunning();
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer tfq-sovereign-local',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Gateway HTTP ${res.status}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '(empty response)';
}

async function main() {
  const args = process.argv.slice(2);
  let activeModel = process.env.FORGECORE_MODEL || 'forgecore-genesis-1';
  const promptParts = [];

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--model' || args[i] === '-m') && args[i + 1]) {
      activeModel = SIZES[args[i + 1]] || args[i + 1];
      i++;
    } else {
      promptParts.push(args[i]);
    }
  }

  if (promptParts.length > 0) {
    const out = await askForgecore(activeModel, promptParts.join(' '));
    console.log(`\n${out}\n`);
    return;
  }

  await ensureGatewayRunning();
  console.log('====================================================================');
  console.log(' FORGECORE × QUARTZ SOVEREIGN TERMINAL CLI (v1.3.1)');
  console.log(' Powered by © 2026 Threadforge Inc. · Owner Sovereign Ready');
  console.log(` Active Model : ${activeModel}  |  Gateway : ${BASE_URL}`);
  console.log(' Commands     : /model <1..5> (Spark, Thor, Ronin, Genesis, Titan) | /exit');
  console.log('====================================================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `[${activeModel}] > `,
  });
  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }
    if (trimmed === '/exit' || trimmed === 'exit' || trimmed === 'quit') {
      rl.close();
      process.exit(0);
    }
    if (trimmed.startsWith('/model ')) {
      const arg = trimmed.slice(7).trim();
      activeModel = SIZES[arg] || arg;
      console.log(`Switched active model to: ${activeModel}\n`);
      rl.setPrompt(`[${activeModel}] > `);
      rl.prompt();
      return;
    }
    try {
      const reply = await askForgecore(activeModel, trimmed);
      console.log(`\n${reply}\n`);
    } catch (err) {
      console.error(`Error: ${err.message}\n`);
    }
    rl.prompt();
  });
}

main();
