/**
 * AlphaAI — Chat Store (Zustand)
 * Manages AI chat session and message history.
 */
import { create } from 'zustand';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  isStreaming?: boolean;
}

interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;

  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  clearError: () => void;
}

// Canned responses for dev phase
const AI_RESPONSES: Record<string, string> = {
  default: "I'm analysing your query. The signal detection engine is scanning 24 pairs across 4H and 1H timeframes. Would you like me to explain the current BTC/USDT setup or run a confluence check on another pair?",
  btc: "**BTC/USDT 4H Analysis:**\n\nCurrent price is approaching the 4H Demand OB at $42,100–$42,400. Confluence score: **84/100**.\n\n✅ 4H Order Block\n✅ Nested FVG\n✅ Price in Discount Zone\n✅ 1D trend bullish\n\nWith a score above the 70-point threshold, this setup qualifies as high probability. Stop loss at $41,774 gives a clean 1:3.2 RR to TP2.",
  signal: "Currently tracking **6 signals**:\n\n• 2 Approaching (BTC, ETH)\n• 1 Active (SOL — +4.8%)\n• 1 TP1 Hit (DOGE)\n• 2 Pending (LINK, AVAX)\n\nThe highest scoring setup right now is **SOL/USDT at 91/100** — already in the demand zone.",
};

function getAIResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  if (lower.includes('btc') || lower.includes('bitcoin')) return AI_RESPONSES.btc;
  if (lower.includes('signal') || lower.includes('setup')) return AI_RESPONSES.signal;
  return AI_RESPONSES.default;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [
    {
      id: 'msg_sys_001',
      role: 'assistant',
      content: "👋 Welcome to **AlphaAI**. I'm your institutional signal analyst.\n\nI can help you:\n• Explain current signals and setups\n• Run confluence checks on specific pairs\n• Analyse your journal performance\n• Scan for new SMC structures\n\nWhat would you like to explore?",
      createdAt: new Date().toISOString(),
    },
  ],
  isLoading: false,
  error: null,
  sessionId: `session_${Date.now()}`,

  sendMessage: async (content) => {
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    const placeholder: ChatMessage = {
      id: `msg_ai_${Date.now()}`,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      isStreaming: true,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, placeholder],
      isLoading: true,
    }));

    try {
      // TODO: Replace with real streaming API → POST /chat/message
      await new Promise((r) => setTimeout(r, 1200));
      const aiContent = getAIResponse(content);

      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === placeholder.id ? { ...m, content: aiContent, isStreaming: false } : m
        ),
        isLoading: false,
      }));
    } catch {
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== placeholder.id),
        isLoading: false,
        error: 'Message failed. Please check your connection.',
      }));
    }
  },

  clearChat: () =>
    set({
      messages: [],
      sessionId: `session_${Date.now()}`,
    }),

  clearError: () => set({ error: null }),
}));
