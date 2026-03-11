'use client';

import Dexie, { type Table } from 'dexie';
import type { Session, Comparison, ResultSnapshot } from '@/types/pillars';

class PillarsDB extends Dexie {
  sessions!: Table<Session>;
  comparisons!: Table<Comparison>;
  results!: Table<ResultSnapshot>;

  constructor() {
    super('pillars-v1');
    this.version(1).stores({
      sessions: 'id, createdAt, updatedAt',
      comparisons: '++id, sessionId, timestamp',
      results: 'id, sessionId, createdAt',
    });
  }
}

let _db: PillarsDB | null = null;

export function getDB(): PillarsDB {
  if (typeof window === 'undefined') {
    throw new Error('DB only available in browser');
  }
  if (!_db) _db = new PillarsDB();
  return _db;
}

export async function saveSession(session: Session): Promise<void> {
  await getDB().sessions.put(session);
}

export async function getSession(id: string): Promise<Session | undefined> {
  return getDB().sessions.get(id);
}

export async function getMostRecentActiveSession(): Promise<Session | undefined> {
  const all = await getDB().sessions.orderBy('updatedAt').reverse().toArray();
  return all.find(s => !s.completedAt);
}

export async function getAllSessions(): Promise<Session[]> {
  return getDB().sessions.orderBy('createdAt').reverse().toArray();
}

export async function appendComparison(comparison: Comparison): Promise<number> {
  return getDB().comparisons.add(comparison);
}

export async function getComparisons(sessionId: string): Promise<Comparison[]> {
  return getDB().comparisons
    .where('sessionId').equals(sessionId)
    .sortBy('timestamp');
}

export async function undoLastComparison(sessionId: string): Promise<boolean> {
  const comparisons = await getDB().comparisons
    .where('sessionId').equals(sessionId)
    .sortBy('timestamp');

  const active = comparisons.filter(c => !c.undone);
  if (active.length === 0) return false;

  const last = active[active.length - 1];
  if (last.id == null) return false;

  await getDB().comparisons.update(last.id, { undone: true });
  return true;
}

export async function saveResult(result: ResultSnapshot): Promise<void> {
  await getDB().results.put(result);
}

export async function getResult(sessionId: string): Promise<ResultSnapshot | undefined> {
  return getDB().results.where('sessionId').equals(sessionId).first();
}
