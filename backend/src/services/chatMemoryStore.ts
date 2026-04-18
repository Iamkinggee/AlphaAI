/**
 * In-process chat persistence when Supabase is not configured (local dev).
 * Mirrors the subset of behaviour needed by /api/chat routes.
 */
import { randomUUID } from 'crypto';

export type MemChatMessage = {
  id: string;
  session_id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: string;
  tokens_used?: number;
};

export type MemChatSession = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

const sessions = new Map<string, MemChatSession>();
const messages = new Map<string, MemChatMessage[]>();

export function memoryGetSession(sessionId: string): MemChatSession | undefined {
  return sessions.get(sessionId);
}

export function memoryCreateSession(userId: string, title: string, systemContent: string): MemChatSession {
  const id = randomUUID();
  const now = new Date().toISOString();
  const session: MemChatSession = { id, user_id: userId, title, created_at: now, updated_at: now };
  sessions.set(id, session);
  messages.set(id, [
    {
      id: randomUUID(),
      session_id: id,
      user_id: userId,
      role: 'system',
      content: systemContent,
      created_at: now,
    },
  ]);
  return session;
}

export function memoryListSessions(userId: string): MemChatSession[] {
  return [...sessions.values()]
    .filter((s) => s.user_id === userId)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 20);
}

export function memoryGetMessages(sessionId: string, excludeSystem: boolean): MemChatMessage[] {
  const list = messages.get(sessionId) ?? [];
  const filtered = excludeSystem ? list.filter((m) => m.role !== 'system') : list;
  return filtered.map((m) => ({ ...m }));
}

export function memoryAppendMessage(
  sessionId: string,
  userId: string,
  role: string,
  content: string,
  tokensUsed?: number
): MemChatMessage | null {
  const sess = sessions.get(sessionId);
  if (!sess || sess.user_id !== userId) return null;
  const now = new Date().toISOString();
  const row: MemChatMessage = {
    id: randomUUID(),
    session_id: sessionId,
    user_id: userId,
    role,
    content,
    created_at: now,
    ...(tokensUsed !== undefined ? { tokens_used: tokensUsed } : {}),
  };
  const list = messages.get(sessionId) ?? [];
  list.push(row);
  messages.set(sessionId, list);
  sess.updated_at = now;
  return row;
}

export function memoryHistoryForAi(sessionId: string, limit: number): { role: string; content: string }[] {
  const list = messages.get(sessionId) ?? [];
  return list.slice(-limit).map((m) => ({ role: m.role, content: m.content }));
}
