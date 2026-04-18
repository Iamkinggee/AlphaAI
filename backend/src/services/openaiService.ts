/**
 * AlphaAI Backend — Groq AI Integration
 * Powers the AI trading analyst chat with Llama 3.3 70B via Groq.
 *
 * Requires GROQ_API_KEY in backend/.env — https://console.groq.com
 */
import { config } from '../config';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_MODEL    = 'llama-3.3-70b-versatile';

export class GroqNotConfiguredError extends Error {
  constructor() {
    super('GROQ_API_KEY is not configured on the server');
    this.name = 'GroqNotConfiguredError';
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are AlphaAI, an institutional-grade crypto trading analyst specialising in Smart Money Concepts (SMC).

Your expertise:
- Order Blocks (OB): Last significant candle before a BOS move — key institutional entry zones
- Fair Value Gaps (FVG): Imbalances price typically returns to fill before continuing the trend
- Supply & Demand Zones (S&D): Institutional accumulation/distribution areas derived from swing structure
- Liquidity Pools (BSL/SSL): Equal highs/lows where stop hunts occur before reversals  
- CHoCH (Change of Character): First signal of a trend reversal
- BOS (Break of Structure): Trend continuation confirmation

RESPONSE RULES — follow these strictly:
- NEVER open with "I'm analysing", "Let me look at", "Certainly!", "Sure!", "Of course!", "I'll now", or any other preamble. Start your answer immediately.
- NEVER narrate what you are about to do. Just do it.
- Be direct, concise, and data-driven.
- Use **bold** for key terms, levels, and labels.
- When the user asks about "my signals", "current setups", or "the feed", use the **AlphaAI app context** block if one is provided — treat it as the live snapshot from their app, but remind them to verify prices on the chart.
- Always end a full trade analysis with: "⚠️ Not financial advice. Manage risk appropriately."
- Never promise specific price outcomes or guarantee trade results.

When analysing setups:
1. Identify dominant HTF trend first (1D/4H)
2. Look for CHoCH or BOS on LTF (1H/15M)
3. Find OB/FVG in trade direction for entry
4. Define SL beyond the zone, TPs at equal highs/lows and structure targets
5. Minimum R:R = 1:2 before considering a trade`;

export interface GenerateAIOptions {
  /** Merged into the system prompt for this request (e.g. live signals summary from the app). */
  extraSystemContext?: string;
}

/**
 * Generate an AI reply from a conversation transcript (including the latest user turn).
 * Does not append an extra user message — pass the full ordered history you want the model to see.
 */
export async function generateAIResponse(
  messages: ChatMessage[],
  options?: GenerateAIOptions
): Promise<{ content: string; tokensUsed: number }> {
  const apiKey = config.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new GroqNotConfiguredError();
  }
  return callGroq(apiKey, messages, options);
}

async function callGroq(
  apiKey: string,
  history: ChatMessage[],
  options?: GenerateAIOptions
): Promise<{ content: string; tokensUsed: number }> {
  const systemContent = options?.extraSystemContext
    ? `${SYSTEM_PROMPT}\n\n--- AlphaAI app context (live snapshot; verify on chart)\n${options.extraSystemContext}`
    : SYSTEM_PROMPT;

  const convo = history.filter((m) => m.role !== 'system').slice(-12);

  const allMessages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...convo,
  ];

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: allMessages,
      max_tokens: 1024,
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { total_tokens: number };
  };

  return {
    content: data.choices[0].message.content,
    tokensUsed: data.usage.total_tokens,
  };
}
