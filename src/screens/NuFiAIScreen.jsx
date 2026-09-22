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
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Send, RotateCcw, Bot, CheckCircle2, Sparkles, Menu, Plus, Trash2, MessageSquare, X, Clock } from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import { SHADOWS } from '../theme';

// ── Design tokens matching Diet Dashboard & NuFi theme ────────────────────────
const LIME         = '#C8FF00';
const DARK_BG      = '#1A1A2E';
const BG           = '#F5F5F7';
const CARD         = '#FFFFFF';
const TEXT_PRIMARY = '#1A1A2E';
const TEXT_SEC     = '#64748B';
const TEXT_MUTED   = '#94A3B8';
const BORDER       = '#E8E8EC';

// ── Suggested prompts with direct meal logging ────────────────────────────────
const SUGGESTED_PROMPTS = [
  { emoji: '🥑', text: 'Log 2 scrambled eggs & avocado toast for breakfast' },
  { emoji: '🥗', text: 'Log a grilled chicken salad with olive oil for lunch' },
  { emoji: '📊', text: 'How many calories & protein do I have left today?' },
  { emoji: '💯', text: 'How is my NuFi health score calculated?' },
  { emoji: '📅', text: 'How was my nutrition this week?' },
  { emoji: '🍽️', text: 'What meals have I logged today?' },
];

function getNutriColor(grade) {
  switch (String(grade).toUpperCase()) {
    case 'A': return '#10B981';
    case 'B': return '#34D399';
    case 'C': return '#FBBF24';
    case 'D': return '#F97316';
    case 'E': return '#EF4444';
    default:  return '#10B981';
  }
}

// ── Pulsing online status indicator ───────────────────────────────────────────
function PulsingDot() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={s.dotContainer}>
      <Animated.View style={[s.pulsingGlow, { transform: [{ scale: pulse }], opacity: 0.6 }]} />
      <View style={s.dotCore} />
    </View>
  );
}

// ── Typing indicator (3 animated dots) ───────────────────────────────────────
function TypingDots() {
  const dot0 = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dots = [dot0, dot1, dot2];
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
  }, [dot0, dot1, dot2]);

  const dots = [dot0, dot1, dot2];

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

  return (
    <View style={s.aiTextContainer}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        const baseStyle = [s.bubbleText, s.aiText];

        if (!trimmed) {
          return <View key={idx} style={{ height: 6 }} />;
        }

        // Bullet point: * Item or - Item
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const bulletText = trimmed.slice(2);
          return (
            <View key={idx} style={s.bulletRow}>
              <View style={s.bulletDot} />
              <Text style={s.bulletBody}>
                {renderInlineText(bulletText, baseStyle, false)}
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

// ── Single message bubble with animated entrance ──────────────────────────────
function MessageBubble({ item }) {
  const isUser = item.role === 'user';
  const animOpacity = useRef(new Animated.Value(0)).current;
  const animTranslateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(animTranslateY, { toValue: 0, friction: 6, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [animOpacity, animTranslateY]);

  return (
    <Animated.View
      style={[
        s.bubbleWrap,
        isUser ? s.bubbleRight : s.bubbleLeft,
        { opacity: animOpacity, transform: [{ translateY: animTranslateY }] },
      ]}
    >
      {!isUser && (
        <View style={s.aiBadge}>
          <Bot size={14} color={DARK_BG} strokeWidth={2.5} />
        </View>
      )}
      <View style={[s.bubble, isUser ? s.userBubble : s.aiBubble]}>
        {item.isTyping ? (
          <TypingDots />
        ) : (
          <>
            <FormattedMessage content={item.content} isUser={isUser} />

            {/* Direct meal logged card confirmation */}
            {item.loggedMeal && (
              <View style={s.mealCard}>
                <View style={s.mealCardTop}>
                  <View style={s.mealCardTag}>
                    <CheckCircle2 size={13} color="#10B981" strokeWidth={2.5} />
                    <Text style={s.mealCardTagText}>SAVED TO DIET LOG</Text>
                  </View>
                  <View style={[s.nutriBadge, { backgroundColor: getNutriColor(item.loggedMeal.nutriScore) }]}>
                    <Text style={s.nutriBadgeText}>Score {item.loggedMeal.nutriScore}</Text>
                  </View>
                </View>

                <Text style={s.mealCardName}>{item.loggedMeal.name}</Text>

                <View style={s.mealStatsGrid}>
                  <View style={s.mealStatBox}>
                    <Text style={s.mealStatVal}>{item.loggedMeal.calories}</Text>
                    <Text style={s.mealStatLbl}>kcal</Text>
                  </View>
                  <View style={s.mealStatBox}>
                    <Text style={s.mealStatVal}>{item.loggedMeal.protein}g</Text>
                    <Text style={s.mealStatLbl}>protein</Text>
                  </View>
                  <View style={s.mealStatBox}>
                    <Text style={s.mealStatVal}>{item.loggedMeal.carbs}g</Text>
                    <Text style={s.mealStatLbl}>carbs</Text>
                  </View>
                  <View style={s.mealStatBox}>
                    <Text style={s.mealStatVal}>{item.loggedMeal.fat}g</Text>
                    <Text style={s.mealStatLbl}>fat</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
        {item.error && <Text style={s.errorLabel}>⚠️ Failed to send</Text>}
      </View>
    </Animated.View>
  );
}

// ── Helper to format session relative time ────────────────────────────────────
function formatSessionTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - Number(timestamp)) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NuFiAIScreen() {
  const insets      = useSafeAreaInsets();
  const { apiClient, user } = useContext(AuthContext);

  const [messages, setMessages]             = useState([]);
  const [inputText, setInputText]           = useState('');
  const [isLoading, setIsLoading]           = useState(false);
  const [showDrawer, setShowDrawer]         = useState(false);
  const [sessions, setSessions]             = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(() => 'session_' + Date.now());
  const flatListRef                         = useRef(null);

  const storageKey = `@nufi_chat_sessions_${user?._id || user?.id || 'guest'}`;

  // Load saved sessions on mount or when user changes
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSessions(parsed);
            // Resume most recent session if current is fresh and empty
            const mostRecent = parsed[0];
            if (mostRecent && mostRecent.messages && mostRecent.messages.length > 0) {
              setCurrentSessionId(mostRecent.id);
              setMessages(mostRecent.messages);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load chat sessions:', e);
      }
    })();
  }, [storageKey]);

  // Persist session to AsyncStorage
  const persistSession = useCallback(async (sid, msgs, promptSnippet) => {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === sid);
      let updated;
      if (idx >= 0) {
        const existing = prev[idx];
        const newTitle = existing.title && existing.title !== 'New Conversation'
          ? existing.title
          : (promptSnippet ? promptSnippet.slice(0, 32) : 'Conversation');
        const updatedItem = {
          ...existing,
          title: newTitle,
          updatedAt: Date.now(),
          messages: msgs,
        };
        updated = [updatedItem, ...prev.filter(s => s.id !== sid)];
      } else {
        const title = promptSnippet ? promptSnippet.slice(0, 32) : 'New Conversation';
        const newItem = {
          id: sid,
          title,
          updatedAt: Date.now(),
          messages: msgs,
        };
        updated = [newItem, ...prev];
      }
      AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(e =>
        console.warn('Failed to save session:', e)
      );
      return updated;
    });
  }, [storageKey]);

  // Base resting spacing so the input bar comfortably sits above the floating BottomNavBar (pill + insets)
  const restingSpacer = Math.max(insets.bottom, 8) + 68 + 12;
  const keyboardSpacerAnim = useRef(new Animated.Value(restingSpacer)).current;
  const isKeyboardOpenRef = useRef(false);

  // Keep spacer in sync if insets change and keyboard is closed
  useEffect(() => {
    if (!isKeyboardOpenRef.current) {
      keyboardSpacerAnim.setValue(restingSpacer);
    }
  }, [restingSpacer, keyboardSpacerAnim]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      isKeyboardOpenRef.current = true;
      const h = e?.endCoordinates?.height || 0;
      // On Android: add navigation bar and keyboard candidate bar buffer (+40px) so input bar comfortably clears the keyboard
      const extraOffset = Platform.OS === 'android' ? Math.max(insets.bottom, 0) + 15 : Math.max(insets.bottom, 0) + 12;
      const targetHeight = Math.max(h + extraOffset, restingSpacer);
      const duration = Platform.OS === 'ios' ? (e?.duration || 250) : 150;

      Animated.timing(keyboardSpacerAnim, {
        toValue: targetHeight,
        duration,
        useNativeDriver: false,
      }).start();

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      isKeyboardOpenRef.current = false;
      const duration = Platform.OS === 'ios' ? (e?.duration || 250) : 150;

      Animated.timing(keyboardSpacerAnim, {
        toValue: restingSpacer,
        duration,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [restingSpacer, keyboardSpacerAnim, insets.bottom]);

  useEffect(() => {
    const onBackPress = () => {
      if (showDrawer) {
        setShowDrawer(false);
        return true;
      }
      if (isKeyboardOpenRef.current) {
        Keyboard.dismiss();
        Animated.timing(keyboardSpacerAnim, {
          toValue: restingSpacer,
          duration: 150,
          useNativeDriver: false,
        }).start();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [showDrawer, keyboardSpacerAnim, restingSpacer]);

  const handleNewChat = useCallback(() => {
    Keyboard.dismiss();
    const newId = 'session_' + Date.now();
    setCurrentSessionId(newId);
    setMessages([]);
    setShowDrawer(false);
  }, []);

  const handleSelectSession = useCallback((session) => {
    Keyboard.dismiss();
    setCurrentSessionId(session.id);
    setMessages(session.messages || []);
    setShowDrawer(false);
  }, []);

  const handleDeleteSession = useCallback((sid) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sid);
      AsyncStorage.setItem(storageKey, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    if (currentSessionId === sid) {
      const newId = 'session_' + Date.now();
      setCurrentSessionId(newId);
      setMessages([]);
    }
  }, [storageKey, currentSessionId]);

  const handleClearAllSessions = useCallback(() => {
    Alert.alert(
      'Clear All History',
      'Are you sure you want to delete all saved conversations?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            setSessions([]);
            AsyncStorage.removeItem(storageKey).catch(() => {});
            handleNewChat();
          },
        },
      ]
    );
  }, [storageKey, handleNewChat]);

  const handleClearChat = useCallback(() => {
    Keyboard.dismiss();
    setMessages([]);
    persistSession(currentSessionId, [], '');
  }, [currentSessionId, persistSession]);

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

    const userMsg = { id: String(Date.now()), role: 'user', content: trimmed };
    const initialWithUser = [...messages, userMsg];

    setMessages([...initialWithUser, { id: typingId, role: 'assistant', isTyping: true }]);
    setIsLoading(true);
    scrollToBottom();

    try {
      const response = await apiClient.post('/api/chat', {
        message: trimmed,
        history: conversationHistory,
      });

      const reply = response?.data?.reply || 'I processed your request!';
      const loggedMeal = response?.data?.loggedMeal || null;
      const aiMsg = { id: `ai-${Date.now()}`, role: 'assistant', content: reply, loggedMeal };

      const finalMessages = [...initialWithUser, aiMsg];
      setMessages(finalMessages);
      persistSession(currentSessionId, finalMessages, trimmed);
    } catch (err) {
      const errMsg = err?.response?.data?.error || 'Unable to reach NuFi. Please check your connection.';
      const errMsgObj = { id: `err-${Date.now()}`, role: 'assistant', content: errMsg, error: true };
      const finalMessages = [...initialWithUser, errMsgObj];
      setMessages(finalMessages);
      persistSession(currentSessionId, finalMessages, trimmed);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  }, [inputText, isLoading, apiClient, conversationHistory, messages, currentSessionId, persistSession, scrollToBottom]);

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
      <View style={[s.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={s.headerLeftWrap}>
          {/* Hamburger Menu Button */}
          <TouchableOpacity
            style={s.hamburgerBtn}
            onPress={() => {
              Keyboard.dismiss();
              setShowDrawer(true);
            }}
            activeOpacity={0.7}
          >
            <Menu size={22} color={DARK_BG} strokeWidth={2.3} />
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <View style={s.headerIcon}>
              <Bot size={20} color={DARK_BG} strokeWidth={2.5} />
            </View>
            <View style={s.headerTextWrap}>
              <View style={s.titleRow}>
                <Text style={s.headerTitle}>NuFi</Text>
                <View style={s.aiPill}>
                  <Sparkles size={10} color={DARK_BG} strokeWidth={3} />
                  <Text style={s.aiPillText}>AGENT</Text>
                </View>
              </View>
              <Text style={s.headerSub} numberOfLines={1} ellipsizeMode="tail">Personal Health & Nutrition Coach</Text>
            </View>
          </View>
        </View>

        {/* Header Right Actions */}
        {messages.length > 0 && (
          <View style={s.headerRightActions}>
            <TouchableOpacity style={s.clearBtn} onPress={handleClearChat} activeOpacity={0.7}>
              <RotateCcw size={16} color={TEXT_SEC} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        )}
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
                <Bot size={36} color={DARK_BG} strokeWidth={2.2} />
                <View style={s.sparkleBadge}>
                  <Sparkles size={14} color={DARK_BG} strokeWidth={2.5} />
                </View>
              </View>
              <Text style={s.emptyTitle}>Meet NuFi</Text>
              <Text style={s.emptySub}>
                Your autonomous health companion. Tell me what you ate to log meals automatically, or ask anything about your diet.
              </Text>
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
            onContentSizeChange={scrollToBottom}
          />
        )}

        {/* ── Retry button ── */}
        {messages.some(m => m.error) && !isLoading && (
          <TouchableOpacity style={s.retryBtn} onPress={retryLast} activeOpacity={0.8}>
            <RotateCcw size={13} color={LIME} strokeWidth={2.5} />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Input bar ── */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Log a meal or ask NuFi anything…"
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
            <ActivityIndicator size="small" color={DARK_BG} />
          ) : (
            <Send size={16} color={(!inputText.trim() || isLoading) ? '#94A3B8' : DARK_BG} strokeWidth={2.5} />
          )}
        </TouchableOpacity>
      </View>

      {/* ── Deterministic animated spacer: rests above BottomNavBar, lifts smoothly above keyboard ── */}
      <Animated.View style={{ height: keyboardSpacerAnim }} />

      {/* ── Hamburger Menu / Chat Sessions Drawer ── */}
      <Modal
        visible={showDrawer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDrawer(false)}
      >
        <View style={s.drawerOverlay}>
          <TouchableOpacity
            style={s.drawerBackdrop}
            activeOpacity={1}
            onPress={() => setShowDrawer(false)}
          />
          <View style={[s.drawerContent, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 20) }]}>
            {/* Drawer Header */}
            <View style={s.drawerHeader}>
              <View style={s.drawerHeaderTitleRow}>
                <View style={s.drawerHeaderIcon}>
                  <Bot size={20} color={DARK_BG} strokeWidth={2.5} />
                </View>
                <Text style={s.drawerTitle}>Chat Sessions</Text>
              </View>
              <TouchableOpacity
                style={s.drawerCloseBtn}
                onPress={() => setShowDrawer(false)}
                activeOpacity={0.7}
              >
                <X size={18} color={TEXT_SEC} />
              </TouchableOpacity>
            </View>

            {/* New Conversation Button */}
            <TouchableOpacity
              style={s.drawerNewBtn}
              onPress={handleNewChat}
              activeOpacity={0.85}
            >
              <Plus size={18} color={DARK_BG} strokeWidth={3} />
              <Text style={s.drawerNewBtnText}>New Conversation</Text>
            </TouchableOpacity>

            <Text style={s.drawerSectionLabel}>PAST CONVERSATIONS</Text>

            {/* Sessions List */}
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
              ListEmptyComponent={
                <View style={s.drawerEmpty}>
                  <MessageSquare size={32} color={BORDER} />
                  <Text style={s.drawerEmptyTitle}>No Past Sessions</Text>
                  <Text style={s.drawerEmptySub}>Start chatting with NuFi to save conversations here.</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = item.id === currentSessionId;
                return (
                  <TouchableOpacity
                    style={[s.sessionItem, isSelected && s.sessionItemActive]}
                    onPress={() => handleSelectSession(item)}
                    activeOpacity={0.75}
                  >
                    <View style={[s.sessionIconWrap, isSelected && s.sessionIconWrapActive]}>
                      <MessageSquare size={16} color={isSelected ? DARK_BG : TEXT_SEC} strokeWidth={2} />
                    </View>
                    <View style={s.sessionInfo}>
                      <Text style={[s.sessionTitle, isSelected && s.sessionTitleActive]} numberOfLines={1}>
                        {item.title || 'Conversation'}
                      </Text>
                      <View style={s.sessionMetaRow}>
                        <Clock size={11} color={TEXT_MUTED} />
                        <Text style={s.sessionMeta}>
                          {formatSessionTime(item.updatedAt)} · {item.messages?.length || 0} msgs
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={s.sessionDeleteBtn}
                      onPress={() => handleDeleteSession(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={15} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Clear All Sessions Option */}
            {sessions.length > 0 && (
              <TouchableOpacity
                style={s.clearAllBtn}
                onPress={handleClearAllSessions}
                activeOpacity={0.7}
              >
                <Trash2 size={14} color="#EF4444" />
                <Text style={s.clearAllBtnText}>Clear All History</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    ...SHADOWS.soft,
  },
  headerLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  hamburgerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newChatHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LIME,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: LIME,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dotContainer: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulsingGlow: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  dotCore: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: TEXT_PRIMARY, letterSpacing: -0.3 },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: LIME,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  aiPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: DARK_BG,
    letterSpacing: 0.5,
  },
  headerSub:   { fontSize: 11, color: TEXT_MUTED, marginTop: 2, fontWeight: '500' },
  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },

  // Empty / suggestions
  emptyScroll: { flexGrow: 1, justifyContent: 'center' },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: LIME,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  sparkleBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1.5,
    borderColor: LIME,
  },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: TEXT_PRIMARY, marginBottom: 6, letterSpacing: -0.4 },
  emptySub:   { fontSize: 13, color: TEXT_SEC, textAlign: 'center', marginBottom: 20, lineHeight: 19, paddingHorizontal: 12 },
  promptsGrid: { width: '100%', gap: 8 },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BORDER,
    ...SHADOWS.soft,
  },
  promptEmoji: { fontSize: 18 },
  promptText:  { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY, flex: 1 },

  // Message list
  listContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16 },
  bubbleWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    gap: 8,
  },
  bubbleLeft:  { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  aiBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: LIME,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: DARK_BG,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: CARD,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
    ...SHADOWS.soft,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText:   { color: '#FFFFFF', fontWeight: '500' },
  aiText:     { color: TEXT_PRIMARY },

  // Direct meal card inside chat
  mealCard: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mealCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mealCardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mealCardTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  nutriBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nutriBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mealCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  mealStatsGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  mealStatBox: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 8,
    paddingVertical: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  mealStatVal: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  mealStatLbl: {
    fontSize: 9,
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginTop: 1,
  },

  // Formatting styles
  aiTextContainer: { gap: 4 },
  mdBold:          { fontWeight: '800' },
  mdItalic:        { fontStyle: 'italic' },
  mdCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    backgroundColor: '#F1F5F9',
    color: '#0F172A',
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 2,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: DARK_BG,
    marginTop: 8,
    flexShrink: 0,
  },
  bulletBody:   { flex: 1, fontSize: 14, lineHeight: 20 },
  numberPrefix: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY, minWidth: 18 },

  // Typing dots
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: DARK_BG,
  },

  // Retry
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: DARK_BG,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  retryText: { fontSize: 12, fontWeight: '700', color: LIME },
  errorLabel: { fontSize: 11, color: '#EF4444', marginTop: 4, fontWeight: '600' },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: CARD,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: TEXT_PRIMARY,
    borderWidth: 1,
    borderColor: BORDER,
    ...SHADOWS.soft,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LIME,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  sendBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },

  // ── Drawer Styles ─────────────────────────────────────────────────────────────
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawerContent: {
    width: '82%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    height: '100%',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  drawerHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  drawerHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: LIME,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: DARK_BG,
    letterSpacing: -0.3,
  },
  drawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LIME,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    ...SHADOWS.soft,
  },
  drawerNewBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: DARK_BG,
  },
  drawerSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_MUTED,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sessionItemActive: {
    backgroundColor: '#F0FDF4',
    borderColor: LIME,
    borderLeftWidth: 4,
  },
  sessionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sessionIconWrapActive: {
    backgroundColor: LIME,
  },
  sessionInfo: {
    flex: 1,
    marginRight: 8,
  },
  sessionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 3,
  },
  sessionTitleActive: {
    color: DARK_BG,
    fontWeight: '800',
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionMeta: {
    fontSize: 11,
    color: TEXT_MUTED,
  },
  sessionDeleteBtn: {
    padding: 6,
  },
  drawerEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  drawerEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_SEC,
    marginTop: 12,
  },
  drawerEmptySub: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 8,
  },
  clearAllBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
});
