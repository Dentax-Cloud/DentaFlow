/**
 * Minimal background worker for Docker dev.
 * Replace this with a real queue/cron scheduler later.
 */

import { db } from "@/lib/db";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function tick() {
  // Example: emit a lightweight DB check to prove connectivity
  await db.tenant.count();
  // Place reminder dispatch / AI batch tasks here
}

async function main() {
  // eslint-disable-next-line no-console
  console.log("[worker] started");

  // Simple loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await tick();
      // eslint-disable-next-line no-console
      console.log("[worker] tick ok");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[worker] tick failed", e);
    }
    await sleep(30_000);
  }
}

void main();

