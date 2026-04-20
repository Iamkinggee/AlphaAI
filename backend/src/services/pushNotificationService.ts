import { getSupabaseClient } from './supabaseClient';

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'high';
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isExpoToken(token: string): boolean {
  return /^ExponentPushToken\[[\w-]+\]$/.test(token) || /^ExpoPushToken\[[\w-]+\]$/.test(token);
}

async function loadActiveTokens(): Promise<string[]> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from('push_tokens')
    .select('token')
    .eq('is_active', true);

  if (error) {
    console.error('[PushService] Failed to load push tokens:', error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => row.token as string)
    .filter((token): token is string => typeof token === 'string' && isExpoToken(token));
}

async function deactivateTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const db = getSupabaseClient();
  const { error } = await db
    .from('push_tokens')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in('token', tokens);

  if (error) {
    console.warn('[PushService] Failed to deactivate invalid tokens:', error.message);
  }
}

export async function sendPushToAllDevices(message: PushMessage): Promise<void> {
  const tokens = await loadActiveTokens();
  if (tokens.length === 0) return;

  const badTokens: string[] = [];
  const tokenChunks = chunk(tokens, 100);

  for (const tokenBatch of tokenChunks) {
    const payload = tokenBatch.map((to) => ({
      to,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      sound: message.sound ?? 'default',
      priority: message.priority ?? 'high',
      channelId: 'signals',
    }));

    try {
      const resp = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.warn(`[PushService] Expo push request failed (${resp.status}): ${text}`);
        continue;
      }

      const json = await resp.json() as { data?: ExpoPushTicket[] };
      const tickets = Array.isArray(json.data) ? json.data : [];

      tickets.forEach((ticket, i) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          const token = tokenBatch[i];
          if (token) badTokens.push(token);
        }
      });
    } catch (err) {
      console.warn('[PushService] Push send failed:', err);
    }
  }

  if (badTokens.length > 0) {
    await deactivateTokens(Array.from(new Set(badTokens)));
  }
}

