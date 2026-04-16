/**
 * AlphaAI Backend — Groq AI Integration
 * Powers the AI trading analyst chat with Llama 3.3 70B via Groq.
 * Groq offers extremely fast inference (< 1s responses) with a free tier.
 * Falls back to structured mock responses if API key is not set.
 *
 * To activate: set GROQ_API_KEY in backend/.env
 * Get a free key at: https://console.groq.com
 */
import { config } from '../config';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_MODEL    = 'llama-3.3-70b-versatile';  // Best quality on Groq free tier

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

When analysing setups:
1. Identify dominant HTF trend first (1D/4H)
2. Look for CHoCH or BOS on LTF (1H/15M)
3. Find OB/FVG in trade direction for entry
4. Define SL beyond the zone, TPs at equal highs/lows and structure targets
5. Minimum R:R = 1:2 before considering a trade

Always be concise and data-driven. State your bias, key levels, and invalidation clearly.
End every analysis with: "⚠️ Not financial advice. Manage risk appropriately."`;

/**
 * Generate an AI response to a trading analysis question.
 * Uses OpenAI GPT-4o if OPENAI_API_KEY is set, else returns a mock response.
 */
export async function generateAIResponse(
  messages: ChatMessage[],
  userMessage: string
): Promise<{ content: string; tokensUsed: number }> {
  const apiKey = config.GROQ_API_KEY;

  if (apiKey) {
    return callGroq(apiKey, messages, userMessage);
  }

  // Structured mock response for development
  console.log('[Groq] No GROQ_API_KEY set — using mock response');
  return { content: generateMockAnalysis(userMessage), tokensUsed: 0 };
}

async function callGroq(
  apiKey: string,
  history: ChatMessage[],
  userMessage: string
): Promise<{ content: string; tokensUsed: number }> {
  const allMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.filter(m => m.role !== 'system').slice(-10), // last 10 messages for context
    { role: 'user', content: userMessage },
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
      temperature: 0.3,  // Low temp for consistent, data-driven trading analysis
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
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

function generateMockAnalysis(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('btc') || lower.includes('bitcoin')) {
    return `**BTC/USDT — SMC Analysis** 📊

**HTF Structure (1D):** Bullish — HH/HL sequence intact above $38,000.

**Current Context (4H):**
• Price printing a pullback after a CHoCH at $43,800
• Approaching unmitigated **4H OB Demand** at $42,200–$42,800
• **FVG** overlaps OB at $42,500–$42,750 (high confluence zone)
• **SSL** (equal lows) visible at $41,900 — likely sweep target before reversal

**Bias:** Bullish above $41,900 SL zone.

**Setup:**
• Entry: $42,200–$42,800 (OB+FVG confluence)
• SL: $41,700 (below OB + SSL sweep target)
• TP1: $44,200 | TP2: $46,000 | TP3: $48,500
• R:R: 1:2.8 minimum from entry midpoint

**Invalidation:** Daily close below $41,700.

⚠️ Not financial advice. Manage risk appropriately.`;
  }

  if (lower.includes('eth') || lower.includes('ethereum')) {
    return `**ETH/USDT — SMC Analysis** 📊

**HTF Structure (4H):** Bearish retracement — LH printed at $2,490.

**Key Zones:**
• **4H Supply OB:** $2,440–$2,490 (strong rejection wick)
• **Bullish FVG:** $2,250–$2,310 (unfilled imbalance)
• **Demand Zone:** $2,180–$2,240 (HTF origin)

**Bias:** Neutral-bearish between $2,390–$2,490. Bullish below $2,310 for LTF buys.

**Setup (SHORT from supply):**
• Entry: $2,440–$2,490
• SL: $2,520 (above supply OB)
• TP1: $2,350 | TP2: $2,280 | TP3: $2,180

⚠️ Not financial advice. Manage risk appropriately.`;
  }

  if (lower.includes('what is') || lower.includes('explain') || lower.includes('define')) {
    if (lower.includes('order block')) {
      return `**Order Block (OB)** — SMC Explained 📚

An **Order Block** is the last bullish or bearish candle *before* a significant **Break of Structure (BOS)**.

It represents a zone where institutional (smart money) orders were placed — when price returns to this area, remaining unfilled orders act as a magnet.

**Types:**
• **Bullish OB** — Last bearish candle before a bullish BOS (demand zone)
• **Bearish OB** — Last bullish candle before a bearish BOS (supply zone)

**Validity rules:**
1. Must precede a BOS/CHoCH on the same timeframe
2. Should be unmitigated (price hasn't returned since)
3. Higher timeframe OBs carry more weight

**How to trade:**
• Wait for price to return to the OB
• Look for 5M entry confirmation (engulfing, pin bar)
• SL below OB low (bullish) or above OB high (bearish)

⚠️ Not financial advice. Manage risk appropriately.`;
    }
    if (lower.includes('fvg') || lower.includes('fair value')) {
      return `**Fair Value Gap (FVG)** — SMC Explained 📚

A **Fair Value Gap** is a 3-candle imbalance where candle[n-1].high < candle[n+1].low (bullish FVG) or candle[n-1].low > candle[n+1].high (bearish FVG).

Markets tend to return to fill these gaps before resuming the impulse direction.

**Why it matters:**
• Institutional algorithms leave footprints in imbalances
• FVGs at OB confluences create the highest-probability setups
• Unfilled FVGs on H4/1D act as price magnets

⚠️ Not financial advice. Manage risk appropriately.`;
    }
  }

  return `**Market Analysis** 📊

I can help you analyse any crypto trading pair using SMC methodology.

**Try asking me:**
• "Analyse BTC/USDT 4H setup"
• "What is the ETH/USDT bias today?"  
• "Explain Fair Value Gaps"
• "Where are the key SOL/USDT zones?"

I'll identify Order Blocks, FVGs, S&D zones, and liquidity targets for high-probability setups.

⚠️ Not financial advice. Manage risk appropriately.`;
}
