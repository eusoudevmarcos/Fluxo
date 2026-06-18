import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve("apps/web/.next");
const target = resolve(".next");

if (!existsSync(source)) {
  throw new Error(`Next.js output not found at ${source}`);
}

rmSync(target, { force: true, recursive: true });
cpSync(source, target, { recursive: true });

console.log(`Copied Next.js output from ${source} to ${target}`);
