import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { commandStatus, runCommand, withDeadline } from "./server.mjs";

const tempDir = await mkdtemp(join(tmpdir(), "paper-os-runtime-"));
const hangingScript = join(tempDir, "hang.mjs");
await writeFile(hangingScript, "setTimeout(() => {}, 10000);\n", "utf-8");

const started = Date.now();
const result = await runCommand(process.execPath, [hangingScript], { timeoutMs: 300 });
const elapsed = Date.now() - started;

if (!result.timedOut) {
  throw new Error(`expected runCommand to time out, got ${JSON.stringify(result)}`);
}
if (elapsed > 8000) {
  throw new Error(`timeout guard took too long: ${elapsed}ms`);
}

const status = await commandStatus(process.execPath, [hangingScript], { timeoutMs: 300 });
if (status.ok || !status.detail.toLowerCase().includes("timed out")) {
  throw new Error(`expected commandStatus timeout detail, got ${JSON.stringify(status)}`);
}

const fallback = { ok: false, detail: "deadline fallback" };
const deadlineResult = await withDeadline(new Promise(() => {}), 300, fallback);
if (deadlineResult !== fallback) {
  throw new Error(`expected withDeadline fallback, got ${JSON.stringify(deadlineResult)}`);
}

console.log("Runtime timeout smoke OK");
