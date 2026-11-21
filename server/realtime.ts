import type { Response } from 'express';
import type { ChatMessage } from '../shared/types';
import { db } from './db';

interface SseClient {
  id: number;
  userId: number;
  res: Response;
}

let nextClientId = 1;
const clients = new Map<number, SseClient>();

function writeEvent(res: Response, event: string, data: unknown): void {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Client disconnected
  }
}

export function registerSseClient(userId: number, res: Response): () => void {
  const id = nextClientId++;
  clients.set(id, { id, userId, res });
  db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(Date.now(), userId);

  broadcastOnlineCount();

  const heartbeat = setInterval(() => {
    writeEvent(res, 'ping', { t: Date.now() });
  }, 25000);

  return () => {
    clearInterval(heartbeat);
    clients.delete(id);
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(Date.now(), userId);
    broadcastOnlineCount();
  };
}

export function getOnlineUserIds(): Set<number> {
  const online = new Set<number>();
  for (const c of clients.values()) {
    online.add(c.userId);
  }
  return online;
}

export function getOnlineCount(): number {
  return getOnlineUserIds().size;
}

export function isUserOnline(userId: number): boolean {
  for (const c of clients.values()) {
    if (c.userId === userId) return true;
  }
  return false;
}

export function broadcastOnlineCount(): void {
  const count = getOnlineCount();
  for (const c of clients.values()) {
    writeEvent(c.res, 'online', { onlineCount: count });
  }
}

export function notifyUser(userId: number, event: string, payload: unknown): void {
  for (const c of clients.values()) {
    if (c.userId === userId) {
      writeEvent(c.res, event, payload);
    }
  }
}

export function broadcastChatMessage(msg: ChatMessage): void {
  if (msg.channel === 'global') {
    for (const c of clients.values()) {
      writeEvent(c.res, 'chat', msg);
    }
    return;
  }

  if (msg.channel === 'alliance' && msg.allianceId) {
    const members = new Set(
      (
        db
          .prepare('SELECT id FROM users WHERE alliance_id = ?')
          .all(msg.allianceId) as Array<{ id: number }>
      ).map((r) => r.id)
    );
    for (const c of clients.values()) {
      if (members.has(c.userId)) {
        writeEvent(c.res, 'chat', msg);
      }
    }
  }
}
