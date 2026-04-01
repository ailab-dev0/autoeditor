/**
 * Neo4j driver wrapper.
 *
 * Provides connect/disconnect lifecycle, query helper, and health check.
 * Neo4j is REQUIRED — the server will NOT start without it.
 */

import neo4j, { type Driver, type Session } from 'neo4j-driver';
import { config } from '../config.js';

let driver: Driver | null = null;
let connected = false;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Initialize the Neo4j driver and verify connectivity.
 * Retries up to 3 times with a 2-second delay between attempts.
 * Throws if all attempts fail.
 */
export async function connect(): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      driver = neo4j.driver(
        config.neo4jUri,
        neo4j.auth.basic(config.neo4jUser, config.neo4jPassword),
        {
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 5000,
          logging: {
            level: 'warn',
            logger: (level, message) => console.log(`[neo4j:${level}] ${message}`),
          },
        }
      );

      const serverInfo = await driver.getServerInfo();
      connected = true;
      console.log(`[neo4j] Connected to ${serverInfo.address} (${serverInfo.protocolVersion})`);
      return;
    } catch (err) {
      lastError = err as Error;
      console.warn(`[neo4j] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`);

      if (driver) {
        try { await driver.close(); } catch { /* ignore cleanup errors */ }
        driver = null;
      }

      if (attempt < MAX_RETRIES) {
        console.log(`[neo4j] Retrying in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  connected = false;
  throw new Error(`Failed to connect to Neo4j after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Close the Neo4j driver and release all connections.
 */
export async function disconnect(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    connected = false;
    console.log('[neo4j] Disconnected');
  }
}

/**
 * Throws if not connected to Neo4j.
 */
export function ensureConnected(): void {
  if (!driver || !connected) {
    throw new Error('Neo4j is not connected');
  }
}

/**
 * Returns true if the driver is connected.
 */
export function isConnected(): boolean {
  return connected;
}

/**
 * Recursively convert Neo4j values to plain JS values.
 */
function toPlainValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (neo4j.isInt(val)) return (val as any).toNumber();
  if (typeof val === 'object' && val !== null && 'properties' in val) {
    // Neo4j Node — extract properties
    const props = (val as any).properties;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      result[key] = toPlainValue(props[key]);
    }
    return result;
  }
  if (Array.isArray(val)) return val.map(toPlainValue);
  if (typeof val === 'object' && val !== null) {
    // Neo4j DateTime or other special types
    if ('toString' in val && typeof (val as any).year === 'object') {
      return (val as any).toString();
    }
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(val)) {
      result[key] = toPlainValue((val as Record<string, unknown>)[key]);
    }
    return result;
  }
  return val;
}

/**
 * Run a Cypher read query and return records as plain objects.
 * Throws on failure — does NOT swallow errors.
 */
export async function query<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  ensureConnected();

  const session: Session = driver!.session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record: any) => {
      const obj: Record<string, unknown> = {};
      for (const key of record.keys) {
        obj[key] = toPlainValue(record.get(key));
      }
      return obj as T;
    });
  } catch (err) {
    throw new Error(`Neo4j query failed: ${(err as Error).message}`);
  } finally {
    await session.close();
  }
}

/**
 * Run a write transaction (for mutations).
 * Returns the records from the write operation.
 * Throws on failure — does NOT swallow errors.
 */
export async function writeQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  ensureConnected();

  const session: Session = driver!.session();
  try {
    const result = await session.executeWrite((tx) => tx.run(cypher, params));
    return result.records.map((record: any) => {
      const obj: Record<string, unknown> = {};
      for (const key of record.keys) {
        obj[key] = toPlainValue(record.get(key));
      }
      return obj as T;
    });
  } catch (err) {
    throw new Error(`Neo4j write query failed: ${(err as Error).message}`);
  } finally {
    await session.close();
  }
}

/**
 * Health check — returns true if the driver can reach the server.
 */
export async function healthCheck(): Promise<boolean> {
  if (!driver) return false;
  try {
    await driver.getServerInfo();
    return true;
  } catch {
    return false;
  }
}
