/**
 * AlphaAI Backend — /chat routes
 * POST /chat/sessions          — Create new chat session
 * GET  /chat/sessions          — List user's sessions
 * POST /chat/sessions/:id      — Send message to session (AI response)
 * GET  /chat/sessions/:id      — Get session message history
 *
 * Auth: Extracts user ID from the Supabase JWT (Authorization: Bearer <token>).
 * Dev tokens (dev_*) are mapped to a stable dev user ID so local dev works.
 *
 * When Supabase env is not set, sessions are stored in-memory (dev only).
 */
import { Router, Request, Response } from 'express';
import { config } from '../config';
import { getSupabaseClient } from '../services/supabaseClient';
import { generateAIResponse, GroqNotConfiguredError, type ChatMessage } from '../services/openaiService';
import {
  memoryAppendMessage,
  memoryCreateSession,
  memoryGetMessages,
  memoryGetSession,
  memoryHistoryForAi,
  memoryListSessions,
} from '../services/chatMemoryStore';

const router = Router();

const DEV_USER_ID = 'dev_user_001';

function isMemoryMode(): boolean {
  return !config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Extract user ID from the request.
 * 1. Tries to verify the Supabase JWT from the Authorization header.
 * 2. If the token starts with "dev_" (local dev session), returns a stable dev ID.
 * 3. Falls back to the x-user-id header (legacy support).
 */
async function getUserId(req: Request): Promise<string | null> {
  const headerUserId = req.headers['x-user-id'] as string | undefined;
  if (headerUserId) return headerUserId;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  if (token.startsWith('dev_')) {
    return DEV_USER_ID;
  }

  try {
    const db = getSupabaseClient();
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

/** Stored in DB as a bootstrap row; Groq uses the canonical prompt in openaiService. */
const SESSION_BOOTSTRAP_MARKDOWN = `AlphaAI chat session — SMC / signals context enabled.`;

/**
 * POST /chat/sessions — Create a new session
 */
router.post('/sessions', async (req: Request, res: Response) => {
  const userId = await getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const { title = 'New Analysis', signalContextId: _signalContextId } = req.body;

  if (isMemoryMode()) {
    const session = memoryCreateSession(userId, title, SESSION_BOOTSTRAP_MARKDOWN);
    res.status(201).json({ success: true, data: session });
    return;
  }

  const db = getSupabaseClient();
  const { data: session, error } = await db
    .from('chat_sessions')
    .insert({ user_id: userId, title })
    .select()
    .single();

  if (error || !session) { res.status(500).json({ success: false, error: error?.message }); return; }

  await db.from('chat_messages').insert({
    session_id: session.id,
    user_id: userId,
    role: 'system',
    content: SESSION_BOOTSTRAP_MARKDOWN,
    signal_context_id: _signalContextId ?? null,
  });

  res.status(201).json({ success: true, data: session });
});

/**
 * GET /chat/sessions — List user sessions
 */
router.get('/sessions', async (req: Request, res: Response) => {
  const userId = await getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  if (isMemoryMode()) {
    res.json({ success: true, data: memoryListSessions(userId) });
    return;
  }

  const db = getSupabaseClient();
  const { data, error } = await db
    .from('chat_sessions')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data: data ?? [] });
});

/**
 * GET /chat/sessions/:id — Get session message history
 */
router.get('/sessions/:id', async (req: Request, res: Response) => {
  const userId = await getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const sessionId = req.params.id;

  if (isMemoryMode()) {
    const sess = memoryGetSession(sessionId);
    if (!sess || sess.user_id !== userId) { res.status(404).json({ success: false, error: 'Not found' }); return; }
    const rows = memoryGetMessages(sessionId, true);
    res.json({
      success: true,
      data: rows.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      })),
    });
    return;
  }

  const db = getSupabaseClient();
  const { data, error } = await db
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('session_id', sessionId)
    .neq('role', 'system')
    .order('created_at', { ascending: true });

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data: data ?? [] });
});

/**
 * POST /chat/sessions/:id — Send message + get AI response
 * Body: { content: string, appContext?: string } — optional appContext = live signals summary from the client
 */
router.post('/sessions/:id', async (req: Request, res: Response) => {
  const userId = await getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const { content, appContext } = req.body as { content?: string; appContext?: string };
  if (!content?.trim()) { res.status(400).json({ success: false, error: 'content is required' }); return; }

  const sessionId = req.params.id;
  const trimmed = content.trim();
  const contextBlock =
    typeof appContext === 'string' && appContext.trim().length > 0 ? appContext.trim() : undefined;

  try {
    if (isMemoryMode()) {
      const sess = memoryGetSession(sessionId);
      if (!sess || sess.user_id !== userId) { res.status(404).json({ success: false, error: 'Not found' }); return; }

      memoryAppendMessage(sessionId, userId, 'user', trimmed);

      const historyRows = memoryHistoryForAi(sessionId, 14);
      const history: ChatMessage[] = historyRows.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      }));

      const { content: aiResponse, tokensUsed } = await generateAIResponse(history, {
        extraSystemContext: contextBlock,
      });

      const aiMsg = memoryAppendMessage(sessionId, userId, 'assistant', aiResponse, tokensUsed);
      if (!aiMsg) {
        res.status(500).json({ success: false, error: 'Failed to save assistant message' });
        return;
      }

      res.json({
        success: true,
        data: {
          message: {
            id: aiMsg.id,
            role: aiMsg.role,
            content: aiMsg.content,
            created_at: aiMsg.created_at,
            tokens_used: aiMsg.tokens_used,
          },
          response: aiResponse,
        },
      });
      return;
    }

    const db = getSupabaseClient();

    await db.from('chat_messages').insert({
      session_id: sessionId,
      user_id: userId,
      role: 'user',
      content: trimmed,
    });

    const { data: history } = await db
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(14);

    const historyMessages: ChatMessage[] = (history ?? []).map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const { content: aiResponse, tokensUsed } = await generateAIResponse(historyMessages, {
      extraSystemContext: contextBlock,
    });

    const { data: aiMsg, error: aiErr } = await db.from('chat_messages').insert({
      session_id: sessionId,
      user_id: userId,
      role: 'assistant',
      content: aiResponse,
      tokens_used: tokensUsed,
    }).select().single();

    if (aiErr || !aiMsg) {
      res.status(500).json({ success: false, error: aiErr?.message ?? 'Failed to save AI message' });
      return;
    }

    await db.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);

    res.json({ success: true, data: { message: aiMsg, response: aiResponse } });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      res.status(503).json({ success: false, error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : 'AI request failed';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
