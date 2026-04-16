import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Colors } from '@/src/constants/colors';
import { FontSizes } from '@/src/constants/fonts';
import { Spacing, BorderRadius } from '@/src/constants/spacing';
import { apiClient } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

// Seed the chat with a welcome message before the first API call
const WELCOME: Message = {
  id: 'msg_welcome',
  role: 'assistant',
  content: `👋 **Welcome to AlphaAI Analyst**\n\nI'm your institutional-grade trading assistant specialising in Smart Money Concepts.\n\nAsk me about:\n• **Signal analysis** — OBs, FVGs, S&D zones\n• **Trade setups** — Entry, SL, TP levels\n• **Market structure** — BOS, CHoCH, HH/HL/LH/LL\n• **Specific pairs** — e.g. "Analyse BTC/USDT 4H"\n\nWhat would you like to analyse?`,
  createdAt: new Date().toISOString(),
};

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  // Create a session on first mount
  useEffect(() => {
    apiClient.post<{ success: boolean; data: { id: string } }>(API.CHAT.NEW_SESSION, {
      title: 'Market Analysis',
    }).then((res) => {
      if (res.success) setSessionId(res.data.id);
    }).catch(() => {
      // Dev fallback — generate a local session ID
      setSessionId(`local_${Date.now()}`);
    });
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    setInput('');
    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Scroll to bottom
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const endpoint = sessionId
        ? API.CHAT.SESSION_DETAIL(sessionId)
        : API.CHAT.SEND;

      const res = await apiClient.post<{ success: boolean; data: { response: string } }>(
        endpoint, { content: text }
      );

      const aiMsg: Message = {
        id: `msg_ai_${Date.now()}`,
        role: 'assistant',
        content: res.data?.response ?? 'I encountered an error. Please try again.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: Message = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: '⚠️ I\'m temporarily unavailable. Please check your connection and try again.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const QUICK_PROMPTS = [
    'Analyse BTC/USDT 4H',
    'What is an Order Block?',
    'Explain FVG confluence',
    'Scan for best setups',
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>AI Analyst</Text>
          <View style={styles.statusDot} />
        </View>
        <Pressable style={styles.newChatBtn} onPress={() => setMessages([WELCOME])} accessibilityLabel="New chat">
          <Text style={styles.newChatText}>New</Text>
        </Pressable>
      </View>

      {/* ── Message List ─────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index < 3 ? index * 80 : 0).duration(350)}>
            <MessageBubble message={item} />
          </Animated.View>
        )}
        ListFooterComponent={
          isTyping ? (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.typingBubble}>
              <ActivityIndicator size="small" color={Colors.accentPrimary} />
              <Text style={styles.typingText}>AlphaAI is thinking...</Text>
            </Animated.View>
          ) : null
        }
      />

      {/* ── Quick Prompts ────────────────────────────────────────── */}
      {messages.length <= 1 && (
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.quickPromptsRow}>
          {QUICK_PROMPTS.map((prompt) => (
            <Pressable
              key={prompt}
              style={styles.quickPromptChip}
              onPress={() => { setInput(prompt); }}
              accessibilityLabel={prompt}
            >
              <Text style={styles.quickPromptText}>{prompt}</Text>
            </Pressable>
          ))}
        </Animated.View>
      )}

      {/* ── Input Bar ────────────────────────────────────────────── */}
      <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Ask about market structure, signals..."
          placeholderTextColor={Colors.textTertiary}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          multiline
          maxLength={500}
          accessibilityLabel="Chat input"
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || isTyping}
          accessibilityLabel="Send message"
        >
          <Text style={styles.sendIcon}>↑</Text>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>α</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        <MarkdownText text={message.content} isUser={isUser} />
      </View>
    </View>
  );
}

/** Simple inline markdown renderer — bold (**text**) and line breaks */
function MarkdownText({ text, isUser }: { text: string; isUser: boolean }) {
  const lines = text.split('\n');
  return (
    <View>
      {lines.map((line, i) => {
        const parts = line.split(/\*\*(.+?)\*\*/g);
        return (
          <Text key={i} style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {parts.map((part, j) =>
              j % 2 === 1
                ? <Text key={j} style={styles.boldText}>{part}</Text>
                : part
            )}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing['5xl'], paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: Colors.textSecondary },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: FontSizes.lg, fontFamily: 'Inter-SemiBold', color: Colors.textPrimary },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.bullish },
  newChatBtn: { paddingVertical: 6, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.sm, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  newChatText: { fontSize: FontSizes.xs, fontFamily: 'Inter-Medium', color: Colors.textTertiary },
  messageList: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.xl },
  bubbleRow: { flexDirection: 'row', marginBottom: Spacing.lg, alignItems: 'flex-end', gap: Spacing.sm },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  aiAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.accentPrimaryDim, borderWidth: 1, borderColor: Colors.accentPrimary + '40', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  aiAvatarText: { fontSize: 14, fontFamily: 'Inter-Bold', color: Colors.accentPrimary },
  bubble: { maxWidth: '82%', padding: Spacing.md, borderRadius: BorderRadius.lg },
  bubbleAI: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: Colors.accentPrimary + '20', borderWidth: 1, borderColor: Colors.accentPrimary + '40', borderBottomRightRadius: 4 },
  bubbleText: { fontSize: FontSizes.sm, fontFamily: 'Inter-Regular', color: Colors.textPrimary, lineHeight: 20 },
  bubbleTextUser: { color: Colors.textPrimary },
  boldText: { fontFamily: 'Inter-SemiBold', color: Colors.accentPrimary },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: Spacing['3xl'], paddingBottom: Spacing.lg },
  typingText: { fontSize: FontSizes.xs, fontFamily: 'Inter-Regular', color: Colors.textTertiary },
  quickPromptsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  quickPromptChip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  quickPromptText: { fontSize: FontSizes.xs, fontFamily: 'Inter-Medium', color: Colors.accentPrimary },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider, gap: Spacing.sm, backgroundColor: Colors.background },
  input: { flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: FontSizes.sm, fontFamily: 'Inter-Regular', color: Colors.textPrimary, maxHeight: 120 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.accentPrimary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  sendIcon: { fontSize: 18, color: Colors.background, fontWeight: '700' },
});
