/**
 * AlphaAI — AI Chat Tab
 * Full AI analyst chat powered by ChatStore + Groq AI via backend.
 */
import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useChatStore } from '@/src/store/useChatStore';

const QUICK_PROMPTS = [
  'Analyse BTC/USDT 4H setup',
  'What is an Order Block?',
  'ETH bias today?',
  'Explain Fair Value Gaps',
  'Best SOL entry zone?',
];

export default function AIChatScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const messages  = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clearChat   = useChatStore((s) => s.clearChat);

  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;
    setInput('');
    await sendMessage(content);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [input, isLoading, sendMessage]);

  const visibleMessages = messages.filter((m) => m.role !== 'system');

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.aiAvatar, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '40' }]}>
            <Ionicons name="sparkles" size={18} color={theme.accentPrimary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>AlphaAI</Text>
            <Text style={[styles.headerOnline, { color: theme.success, fontFamily: 'Inter-Medium' }]}>● Online</Text>
          </View>
        </View>
        <Pressable
          onPress={clearChat}
          style={[styles.newChatBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
          accessibilityLabel="New chat"
        >
          <Ionicons name="add" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      {/* ── Messages ────────────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={visibleMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Animated.View
              entering={FadeInDown.delay(100).duration(600)}
              style={[styles.emptyIconCircle, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '30' }]}
            >
              <Ionicons name="analytics" size={40} color={theme.accentPrimary} />
            </Animated.View>
            <Animated.Text entering={FadeInDown.delay(200).duration(600)} style={[styles.emptyTitle, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>
              SMC Trading Analyst
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(300).duration(600)} style={[styles.emptySub, { color: theme.textSecondary, fontFamily: 'Inter-Regular' }]}>
              Ask me about any trading pair, Order Blocks, FVGs, or your active signals.
            </Animated.Text>
            <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.quickPromptsGrid}>
              {QUICK_PROMPTS.map((p, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleSend(p)}
                  style={[styles.quickPrompt, { backgroundColor: theme.card, borderColor: theme.border }]}
                >
                  <Text style={[styles.quickPromptText, { color: theme.textSecondary, fontFamily: 'Inter-Medium' }]} numberOfLines={2}>{p}</Text>
                </Pressable>
              ))}
            </Animated.View>
          </View>
        }
        renderItem={({ item, index }) => {
          const isUser = item.role === 'user';
          return (
            <Animated.View
              entering={FadeInUp.delay(index * 20).duration(300)}
              style={[styles.messageRow, isUser && styles.messageRowUser]}
            >
              {!isUser && (
                <View style={[styles.botAvatar, { backgroundColor: theme.accentPrimaryDim }]}>
                  <Ionicons name="sparkles" size={12} color={theme.accentPrimary} />
                </View>
              )}
              <View style={[
                styles.bubble,
                {
                  backgroundColor: isUser ? theme.accentPrimary : theme.card,
                  borderColor: isUser ? 'transparent' : theme.border,
                },
              ]}>
                {item.isStreaming ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <Text style={[styles.bubbleText, { color: isUser ? '#000' : theme.textPrimary, fontFamily: 'Inter-Regular' }]}>
                    {item.content}
                  </Text>
                )}
              </View>
            </Animated.View>
          );
        }}
      />

      {/* ── Inline quick prompts when messages exist ─────────────────── */}
      {visibleMessages.length > 0 && (
        <View style={styles.inlinePromptsRow}>
          <FlatList
            horizontal
            data={QUICK_PROMPTS}
            keyExtractor={(p) => p}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSend(item)}
                style={[styles.inlineChip, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <Text style={[styles.inlineChipText, { color: theme.textSecondary, fontFamily: 'Inter-Medium' }]}>{item}</Text>
              </Pressable>
            )}
          />
        </View>
      )}

      {/* ── Input bar ───────────────────────────────────────────────── */}
      <View style={[styles.inputBar, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[styles.input, { color: theme.textPrimary, fontFamily: 'Inter-Regular', backgroundColor: theme.surface }]}
          placeholder="Ask about any setup or pair…"
          placeholderTextColor={theme.textTertiary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => handleSend()}
        />
        <Pressable
          onPress={() => handleSend()}
          disabled={!input.trim() || isLoading}
          style={[styles.sendBtn, { backgroundColor: input.trim() && !isLoading ? theme.accentPrimary : theme.border }]}
        >
          {isLoading
            ? <ActivityIndicator size="small" color={theme.textPrimary} />
            : <Ionicons name="send" size={16} color={input.trim() ? '#000' : theme.textTertiary} />
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1 },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiAvatar:         { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle:      { fontSize: 18 },
  headerOnline:     { fontSize: 12, marginTop: 1 },
  newChatBtn:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  messagesList:     { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexGrow: 1 },
  messageRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  messageRowUser:   { flexDirection: 'row-reverse' },
  botAvatar:        { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bubble:           { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '82%' },
  bubbleText:       { fontSize: 15, lineHeight: 22 },
  emptyState:       { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIconCircle:  { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 24 },
  emptyTitle:       { fontSize: 22, marginBottom: 10 },
  emptySub:         { fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  quickPromptsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  quickPrompt:      { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '47%' },
  quickPromptText:  { fontSize: 13, lineHeight: 18 },
  inlinePromptsRow: { paddingVertical: 8 },
  inlineChip:       { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  inlineChipText:   { fontSize: 13 },
  inputBar:         { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  input:            { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, maxHeight: 120 },
  sendBtn:          { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
