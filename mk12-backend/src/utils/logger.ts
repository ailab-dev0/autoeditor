/**
 * Persistent file logger + console.
 * Logs to logs/error.log and logs/access.log.
 * Auto-rotates when files exceed 50MB.
 */

import { createWriteStream, mkdirSync, existsSync, statSync, renameSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const LOG_DIR = join(process.cwd(), 'logs');
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

const MAX_LOG_SIZE = 50 * 1024 * 1024; // 50 MB per file
const MAX_LOG_FILES = 5; // keep 5 rotated files

function rotateIfNeeded(filePath: string): void {
  try {
    if (!existsSync(filePath)) return;
    const size = statSync(filePath).size;
    if (size < MAX_LOG_SIZE) return;

    // Rotate: .log → .log.1 → .log.2 → ... → .log.5 (delete oldest)
    for (let i = MAX_LOG_FILES; i >= 1; i--) {
      const from = i === 1 ? filePath : `${filePath}.${i - 1}`;
      const to = `${filePath}.${i}`;
      if (existsSync(from)) {
        if (i === MAX_LOG_FILES && existsSync(to)) unlinkSync(to);
        renameSync(from, to);
      }
    }
  } catch { /* rotation is best-effort */ }
}

let errorStream = createWriteStream(join(LOG_DIR, 'error.log'), { flags: 'a' });
let accessStream = createWriteStream(join(LOG_DIR, 'access.log'), { flags: 'a' });
let lineCount = 0;

function checkRotation(): void {
  lineCount++;
  if (lineCount % 500 !== 0) return; // check every 500 lines
  try {
    const errorPath = join(LOG_DIR, 'error.log');
    const accessPath = join(LOG_DIR, 'access.log');

    if (existsSync(errorPath) && statSync(errorPath).size > MAX_LOG_SIZE) {
      errorStream.end();
      rotateIfNeeded(errorPath);
      errorStream = createWriteStream(errorPath, { flags: 'a' });
    }
    if (existsSync(accessPath) && statSync(accessPath).size > MAX_LOG_SIZE) {
      accessStream.end();
      rotateIfNeeded(accessPath);
      accessStream = createWriteStream(accessPath, { flags: 'a' });
    }
  } catch { /* rotation is best-effort */ }
}

function ts(): string {
  return new Date().toISOString();
}

export const logger = {
  info(msg: string, meta?: Record<string, unknown>) {
    const line = `[${ts()}] INFO  ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`;
    console.log(line);
    accessStream.write(line + '\n');
    checkRotation();
  },

  warn(msg: string, meta?: Record<string, unknown>) {
    const line = `[${ts()}] WARN  ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`;
    console.warn(line);
    errorStream.write(line + '\n');
    checkRotation();
  },

  error(msg: string, err?: unknown, meta?: Record<string, unknown>) {
    const stack = err instanceof Error ? `\n${err.stack}` : '';
    const line = `[${ts()}] ERROR ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}${stack}`;
    console.error(line);
    errorStream.write(line + '\n');
    checkRotation();
  },

  fatal(msg: string, err?: unknown) {
    const stack = err instanceof Error ? `\n${err.stack}` : '';
    const line = `[${ts()}] FATAL ${msg}${stack}`;
    console.error(line);
    errorStream.write(line + '\n');
  },
};

export function closeLogger(): void {
  errorStream.end();
  accessStream.end();
}

/**
 * Check disk space for logs directory (returns bytes free, -1 if unknown).
 */
export function getLogDiskUsage(): { totalBytes: number; fileCount: number } {
  try {
    const files = readdirSync(LOG_DIR);
    let totalBytes = 0;
    for (const f of files) {
      try { totalBytes += statSync(join(LOG_DIR, f)).size; } catch { /* skip */ }
    }
    return { totalBytes, fileCount: files.length };
  } catch {
    return { totalBytes: -1, fileCount: 0 };
  }
}
