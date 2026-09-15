import React, { useState, useRef, useContext, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  StatusBar,
  Animated,
  Keyboard,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Send, RotateCcw, Bot } from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SHADOWS } from '../theme';

// ── Design tokens matching the rest of the app ────────────────────────────────
const BG           = COLORS.dietBg;          // '#F8FAFC'
const CARD         = COLORS.dietCard;        // '#FFFFFF'
const ACCENT       = COLORS.dietAccent;      // '#16A34A'
const ACCENT_BG    = COLORS.dietAccentBg;    // '#DCFCE7'
const TEXT_PRIMARY = COLORS.dietTextPrimary; // '#0F172A'
const TEXT_SEC     = COLORS.dietTextSecondary;
const TEXT_MUTED   = COLORS.dietTextMuted;
const BORDER       = COLORS.dietCardBorder;  // '#E2E8F0'

// ── Suggested prompts shown in empty state ────────────────────────────────────
const SUGGESTED_PROMPTS = [
  { emoji: '🍽️', text: 'What did I eat today?' },
  { emoji: '💯', text: 'How is my health score calculated?' },
  { emoji: '💪', text: 'Am I hitting my protein goal?' },
  { emoji: '📅', text: 'How was my nutrition this week?' },
  { emoji: '🥗', text: 'What should I eat for dinner?' },
  { emoji: '📊', text: 'Show me my recent meals' },
];

// ── Typing indicator (3 animated dots) ───────────────────────────────────────
function TypingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={s.typingRow}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            s.dot,
            {
              opacity: dot,
              transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

// ── Inline text renderer (handles **bold**, *italic*, `code`) ────────────────
function renderInlineText(text, baseStyle, isUser) {
  if (!text) return null;
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <Text
          key={i}
          style={[
            baseStyle,
            s.mdBold,
            isUser ? { color: '#FFFFFF' } : { color: TEXT_PRIMARY },
          ]}
        >
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <Text
          key={i}
          style={[
            baseStyle,
            s.mdItalic,
            isUser ? { color: 'rgba(255,255,255,0.9)' } : { color: TEXT_SEC },
          ]}
        >
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <Text
          key={i}
          style={[
            baseStyle,
            s.mdCode,
            isUser && { backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF' },
          ]}
        >
          {part.slice(1, -1)}
        </Text>
      );
    }
    return (
      <Text key={i} style={baseStyle}>
        {part}
      </Text>
    );
  });
}

// ── Formatted message renderer for AI responses ──────────────────────────────
function FormattedMessage({ content, isUser }) {
  if (isUser) {
    return <Text style={[s.bubbleText, s.userText]}>{content}</Text>;
  }

  const lines = (content || '').split('\n');
  const baseStyle = [s.bubbleText, s.aiText];

  return (
    <View style={s.formattedWrap}>
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();

        // Empty line separator
        if (!line) {
          return <View key={idx} style={s.mdSpacer} />;
        }

        // Horizontal divider: --- or ***
        if (line === '---' || line === '***' || line === '___') {
          return <View key={idx} style={s.mdDivider} />;
        }

        // Headings: ### Title, ## Title, # Title
        if (line.startsWith('### ')) {
          return (
            <Text key={idx} style={s.mdH3}>
              {renderInlineText(line.slice(4), s.mdH3, false)}
            </Text>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <Text key={idx} style={s.mdH2}>
              {renderInlineText(line.slice(3), s.mdH2, false)}
            </Text>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <Text key={idx} style={s.mdH1}>
              {renderInlineText(line.slice(2), s.mdH1, false)}
            </Text>
          );
        }

        // Bullet point: * Item or - Item or • Item
        const bulletMatch = line.match(/^(\*|-|•)\s+(.*)/);
        if (bulletMatch) {
          return (
            <View key={idx} style={s.bulletRow}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletBody}>
                {renderInlineText(bulletMatch[2], baseStyle, false)}
              </Text>
            </View>
          );
        }

        // Numbered list: 1. Item
        const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (numberedMatch) {
          return (
            <View key={idx} style={s.bulletRow}>
              <Text style={s.numberPrefix}>{numberedMatch[1]}.</Text>
              <Text style={s.bulletBody}>
                {renderInlineText(numberedMatch[2], baseStyle, false)}
              </Text>
            </View>
          );
        }

        // Standard paragraph line
        return (
          <Text key={idx} style={baseStyle}>
            {renderInlineText(line, baseStyle, false)}
          </Text>
        );
      })}
    </View>
  );
}

// ── Single message bubble ─────────────────────────────────────────────────────
function MessageBubble({ item }) {
  const isUser = item.role === 'user';
  return (
    <View style={[s.bubbleWrap, isUser ? s.bubbleRight : s.bubbleLeft]}>
      {!isUser && (
        <View style={s.aiBadge}>
          <Bot size={14} color={ACCENT} strokeWidth={2.5} />
        </View>
      )}
      <View style={[s.bubble, isUser ? s.userBubble : s.aiBubble]}>
        {item.isTyping ? (
          <TypingDots />
        ) : (
          <FormattedMessage content={item.content} isUser={isUser} />
        )}
        {item.error && <Text style={s.errorLabel}>⚠️ Failed to send</Text>}
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NuFiAIScreen() {
  const navigation  = useNavigation();
  const insets      = useSafeAreaInsets();
  const { apiClient } = useContext(AuthContext);

  const [messages, setMessages]   = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef               = useRef(null);

  // Deterministic animated keyboard height displacement
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;
  const isKeyboardOpenRef  = useRef(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      isKeyboardOpenRef.current = true;
      const h = e?.endCoordinates?.height || 0;
      // On Android, use the full keyboard height + 10px breathing room so it comfortably clears the keyboard and suggestion strip
      const targetOffset = Platform.OS === 'android' ? h + 10 : Math.max(h - Math.max(insets.bottom, 0), 0);

      Animated.timing(keyboardHeightAnim, {
        toValue: targetOffset,
        duration: Platform.OS === 'ios' ? (e?.duration || 250) : 150,
        useNativeDriver: false,
      }).start();

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      isKeyboardOpenRef.current = false;
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e?.duration || 250) : 150,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom, keyboardHeightAnim]);

  // Handle hardware Back button on Android: cleanly dismiss keyboard if open
  useEffect(() => {
    const onBackPress = () => {
      if (isKeyboardOpenRef.current) {
        Keyboard.dismiss();
        Animated.timing(keyboardHeightAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }).start();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [keyboardHeightAnim]);

  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  // Build history for the API from committed messages only
  const conversationHistory = messages
    .filter(m => !m.isTyping && !m.error)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || inputText).trim();
    if (!trimmed || isLoading) return;

    setInputText('');
    const typingId = `typing-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: String(Date.now()), role: 'user', content: trimmed },
      { id: typingId, role: 'assistant', isTyping: true },
    ]);
    setIsLoading(true);
    scrollToBottom();

    try {
      const response = await apiClient.post('/api/chat', {
        message: trimmed,
        history: conversationHistory,
      });
      const reply = response?.data?.reply || 'I received your message but had trouble forming a response. Please try again.';
      setMessages(prev => [
        ...prev.filter(m => m.id !== typingId),
        { id: `ai-${Date.now()}`, role: 'assistant', content: reply },
      ]);
    } catch (err) {
      const errMsg = err?.response?.data?.error || 'Unable to reach NuFi AI. Please check your connection.';
      setMessages(prev => [
        ...prev.filter(m => m.id !== typingId),
        { id: `err-${Date.now()}`, role: 'assistant', content: errMsg, error: true },
      ]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  }, [inputText, isLoading, apiClient, conversationHistory, scrollToBottom]);

  const retryLast = useCallback(() => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser) {
      setMessages(prev => prev.filter(m => !m.error));
      sendMessage(lastUser.content);
    }
  }, [messages, sendMessage]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: BG }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={TEXT_PRIMARY} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.headerIcon}>
            <Bot size={18} color={ACCENT} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={s.headerTitle}>NuFi AI</Text>
            <Text style={s.headerSub}>Your nutrition assistant</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Chat Content ── */}
      <View style={s.contentArea}>
        {messages.length === 0 ? (
          <ScrollView
            contentContainerStyle={s.emptyScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.emptyWrap}>
              <View style={s.emptyIcon}>
                <Bot size={32} color={ACCENT} strokeWidth={2} />
              </View>
              <Text style={s.emptyTitle}>How can I help you?</Text>
              <Text style={s.emptySub}>Ask me about your nutrition, meals, or health score.</Text>
              <View style={s.promptsGrid}>
                {SUGGESTED_PROMPTS.map((p, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.promptChip}
                    onPress={() => sendMessage(p.text)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.promptEmoji}>{p.emoji}</Text>
                    <Text style={s.promptText}>{p.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <MessageBubble item={item} />}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onContentSizeChange={scrollToBottom}
          />
        )}

        {/* ── Retry button ── */}
        {messages.some(m => m.error) && !isLoading && (
          <TouchableOpacity style={s.retryBtn} onPress={retryLast} activeOpacity={0.8}>
            <RotateCcw size={13} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Normal input row layout with safe-area bottom padding ── */}
      <View style={[s.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={s.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask NuFi AI anything…"
          placeholderTextColor={TEXT_MUTED}
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage()}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!inputText.trim() || isLoading) && s.sendBtnDisabled]}
          onPress={() => sendMessage()}
          activeOpacity={0.8}
          disabled={!inputText.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={17} color="#FFFFFF" strokeWidth={2.5} />
          )}
        </TouchableOpacity>
      </View>

      {/* ── Deterministic animated keyboard spacer ── */}
      <Animated.View style={{ height: keyboardHeightAnim }} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  contentArea: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    ...SHADOWS.soft,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ACCENT_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: TEXT_PRIMARY },
  headerSub:   { fontSize: 11, color: TEXT_MUTED, marginTop: 1 },

  // Empty / suggestions
  emptyScroll: { flexGrow: 1, justifyContent: 'center' },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: ACCENT_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    ...SHADOWS.card,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 8 },
  emptySub:   { fontSize: 14, color: TEXT_SEC, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  promptsGrid: { width: '100%', gap: 8 },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: BORDER,
    ...SHADOWS.soft,
  },
  promptEmoji: { fontSize: 16 },
  promptText:  { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '500', flex: 1 },

  // Message list
  listContent: { paddingHorizontal: 12, paddingVertical: 16, gap: 12 },

  // Bubbles
  bubbleWrap:  { flexDirection: 'row', alignItems: 'flex-end', maxWidth: '88%' },
  bubbleRight: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubbleLeft:  { alignSelf: 'flex-start' },
  aiBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: BORDER,
  },
  bubble: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  userBubble: { backgroundColor: ACCENT, borderBottomRightRadius: 4 },
  aiBubble: {
    backgroundColor: CARD,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
    ...SHADOWS.soft,
  },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  userText:   { color: '#FFFFFF', fontWeight: '600' },
  aiText:     { color: TEXT_PRIMARY },
  errorLabel: { fontSize: 11, color: COLORS.error, marginTop: 4 },

  // Formatted markdown styles
  formattedWrap: { gap: 4 },
  mdH1: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY, marginVertical: 6 },
  mdH2: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY, marginVertical: 4 },
  mdH3: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, marginVertical: 4 },
  mdBold: { fontWeight: '700' },
  mdItalic: { fontStyle: 'italic' },
  mdCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    color: '#0F172A',
  },
  mdDivider: { height: 1, backgroundColor: BORDER, marginVertical: 8 },
  mdSpacer:  { height: 6 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2 },
  bulletDot: { fontSize: 16, lineHeight: 21, color: ACCENT, marginRight: 8, fontWeight: '700' },
  numberPrefix: { fontSize: 14, lineHeight: 21, color: ACCENT, marginRight: 6, fontWeight: '700' },
  bulletBody: { flex: 1, fontSize: 14, lineHeight: 21, color: TEXT_PRIMARY },

  // Typing dots
  typingRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  dot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT },

  // Retry
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    ...SHADOWS.soft,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: BG,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: TEXT_PRIMARY,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.button,
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.accentLight,
    shadowOpacity: 0,
    elevation: 0,
  },
});
