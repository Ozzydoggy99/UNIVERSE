// server/debug-log.ts
import fs from "fs";
import path from "path";

const logPath = path.resolve("robot-debug.log");

export function appendLog(entry: string) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `[${timestamp}] ${entry}\n`);
}