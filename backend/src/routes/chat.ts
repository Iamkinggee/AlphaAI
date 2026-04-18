/**
 * AlphaAI Backend — /chat routes
 * POST /chat/sessions          — Create new chat session
 * GET  /chat/sessions          — List user's sessions
 * POST /chat/sessions/:id      — Send message to session (AI response)
 * GET  /chat/sessions/:id      — Get session message history
 *
 * Auth: Extracts user ID from the Supabase JWT (Authorization: Bearer <token>).
 * Dev tokens (dev_*) are mapped to a stable dev user ID so local dev works.
 */
import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabaseClient';
import { generateAIResponse } from '../services/openaiService';

const router = Router();

const DEV_USER_ID = 'dev_user_001';

/**
 * Extract user ID from the request.
 * 1. Tries to verify the Supabase JWT from the Authorization header.
 * 2. If the token starts with "dev_" (local dev session), returns a stable dev ID.
 * 3. Falls back to the x-user-id header (legacy support).
 */
async function getUserId(req: Request): Promise<string | null> {
  // Legacy header support
  const headerUserId = req.headers['x-user-id'] as string | undefined;
  if (headerUserId) return headerUserId;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  // Dev mode tokens — return a stable dev user ID
  if (token.startsWith('dev_')) {
    return DEV_USER_ID;
  }

  // Validate real Supabase token
  try {
    const db = getSupabaseClient();
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// System prompt for the AI trading analyst
const SYSTEM_PROMPT = `You are AlphaAI, an institutional-grade crypto trading analyst specialising in Smart Money Concepts (SMC).

Your expertise includes:
- Order Blocks (OB): Identifying institutional candles before significant moves
- Fair Value Gaps (FVG): Imbalances price is likely to return to fill
- Supply & Demand Zones (S&D): Institutional accumulation/distribution areas
- Liquidity Pools: Equal highs/lows where stop hunts occur (BSL/SSL)
- Market Structure: HH, HL, LH, LL, CHoCH, BOS analysis
- Confluence scoring: Weighting multiple factors for high-probability setups

RESPONSE RULES — follow these strictly:
- NEVER start a response with phrases like "I'm analysing your query", "Let me analyse", "I'll now", "Certainly!", or any preamble. Jump straight into the answer.
- NEVER narrate what you are about to do. Just do it.
- Be concise, structured, and data-driven.
- Use markdown headers (**bold**) for structure.
- Always end an analysis with: "⚠️ Not financial advice. Manage risk appropriately."
- Never give financial advice or make guarantees about price movements.

When analysing a signal or chart, always:
1. Identify the dominant trend on the higher timeframe (HTF)
2. Look for a structural shift (CHoCH or BOS)
3. Find the nearest OB/FVG/S&D zone in the trade direction
4. Calculate R:R before entry (minimum 1:2)
5. State clear invalidation level`;

/**
 * POST /chat/sessions — Create a new session
 */
router.post('/sessions', async (req: Request, res: Response) => {
  const userId = await getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const { title = 'New Analysis', signalContextId } = req.body;
  const db = getSupabaseClient();

  const { data: session, error } = await db
    .from('chat_sessions')
    .insert({ user_id: userId, title })
    .select()
    .single();

  if (error || !session) { res.status(500).json({ success: false, error: error?.message }); return; }

  // Insert system message to bootstrap context
  await db.from('chat_messages').insert({
    session_id: session.id,
    user_id: userId,
    role: 'system',
    content: SYSTEM_PROMPT,
    signal_context_id: signalContextId ?? null,
  });

  res.status(201).json({ success: true, data: session });
});

/**
 * GET /chat/sessions — List user sessions
 */
router.get('/sessions', async (req: Request, res: Response) => {
  const userId = await getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

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

  const db = getSupabaseClient();
  const { data, error } = await db
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('session_id', req.params.id)
    .neq('role', 'system') // don't expose system prompt
    .order('created_at', { ascending: true });

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data: data ?? [] });
});

/**
 * POST /chat/sessions/:id — Send message + get AI response
 */
router.post('/sessions/:id', async (req: Request, res: Response) => {
  const userId = await getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const { content } = req.body;
  if (!content?.trim()) { res.status(400).json({ success: false, error: 'content is required' }); return; }

  const db = getSupabaseClient();
  const sessionId = req.params.id;

  // Save user message
  await db.from('chat_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: 'user',
    content: content.trim(),
  });

  // Load conversation history for context
  const { data: history } = await db
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(12);

  const { content: aiResponse, tokensUsed } = await generateAIResponse(
    (history ?? []).map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
    content.trim()
  );

  const { data: aiMsg } = await db.from('chat_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: 'assistant',
    content: aiResponse,
    tokens_used: tokensUsed,
  }).select().single();

  // Update session timestamp
  await db.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);

  res.json({ success: true, data: { message: aiMsg, response: aiResponse } });
});


export default router;
