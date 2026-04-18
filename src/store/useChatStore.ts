/**
 * AlphaAI — Chat Store (Zustand)
 * Persists conversation via backend /api/chat (Groq). Injects live signal context each turn.
 */
import { create } from 'zustand';
import { apiClient, ApiError } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';
import { useSignalStore } from '@/src/store/useSignalStore';
import { buildSignalsAppContext } from '@/src/utils/chatSignalContext';

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

const WELCOME_ID = 'msg_welcome_static';

const welcomeMessage: ChatMessage = {
  id: WELCOME_ID,
  role: 'assistant',
  content:
    '👋 Welcome to **AlphaAI**. Ask about SMC concepts, a specific pair, or your **current signals** — each reply uses Groq on the server and includes a snapshot of what is loaded in your Signals tab.',
  createdAt: new Date().toISOString(),
};

let sessionCreatePromise: Promise<string> | null = null;

async function ensureChatSession(get: () => ChatStore, set: (partial: Partial<ChatStore>) => void): Promise<string> {
  const existing = get().sessionId;
  if (existing) return existing;
  if (sessionCreatePromise) return sessionCreatePromise;

  sessionCreatePromise = (async () => {
    const res = await apiClient.post<{ success?: boolean; data?: { id: string } }>(
      API.CHAT.NEW_SESSION,
      { title: 'AlphaAI Chat' }
    );
    const id = res?.data?.id;
    if (!id) throw new Error('Could not create chat session');
    set({ sessionId: id });
    return id;
  })();

  try {
    return await sessionCreatePromise;
  } finally {
    sessionCreatePromise = null;
  }
}

function chatErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { error?: string } | undefined;
    if (err.statusCode === 401) {
      return 'Sign in required for AI chat (or use dev mode with a dev session token).';
    }
    if (err.statusCode === 503) {
      return body?.error ?? 'AI is unavailable — set GROQ_API_KEY on the backend.';
    }
    return body?.error ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Message failed. Please check your connection.';
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [welcomeMessage],
  isLoading: false,
  error: null,
  sessionId: null,

  sendMessage: async (content) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: trimmed,
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
      error: null,
    }));

    try {
      const sessionId = await ensureChatSession(get, set);
      const appContext = buildSignalsAppContext(useSignalStore.getState().signals);

      const res = await apiClient.post<{
        success?: boolean;
        data?: { message?: { content?: string }; response?: string };
      }>(API.CHAT.SESSION_DETAIL(sessionId), {
        content: trimmed,
        appContext,
      });

      const text =
        res?.data?.message?.content?.trim() ||
        (typeof res?.data?.response === 'string' ? res.data.response.trim() : '') ||
        '';

      if (!text) throw new Error('Empty AI response');

      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === placeholder.id ? { ...m, content: text, isStreaming: false } : m
        ),
        isLoading: false,
      }));
    } catch (err) {
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== placeholder.id),
        isLoading: false,
        error: chatErrorMessage(err),
      }));
    }
  },

  clearChat: () =>
    set({
      messages: [welcomeMessage],
      sessionId: null,
      error: null,
    }),

  clearError: () => set({ error: null }),
}));
