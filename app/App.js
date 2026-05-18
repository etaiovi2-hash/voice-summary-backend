import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Share,
  KeyboardAvoidingView, Platform, Keyboard, Animated,
  StatusBar, Dimensions, FlatList, Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');
const API_URL = 'https://voice-summary-backend.vercel.app/api/transcribe';

// ─── Translations ─────────────────────────────────────────────────────────────
const T = {
  he: {
    appName: 'סוכן קול AI',
    tagline: 'תמלול וסיכום חכם',
    uploadTitle: 'העלה קובץ שמע',
    uploadSub: 'לחץ לבחירת קובץ אודיו',
    shareHint: 'או שתף ישירות מוואטסאפ',
    processing: 'מעבד את הקובץ...',
    transcribing: 'מתמלל...',
    summarizing: 'מסכם...',
    transcript: 'תמלול',
    summary: 'סיכום',
    askPlaceholder: 'שאל שאלה על התמלול...',
    askBtn: 'שאל',
    history: 'היסטוריה',
    noHistory: 'אין היסטוריה עדיין',
    share: 'שתף',
    copy: 'העתק',
    close: 'סגור',
    errorTitle: 'שגיאה',
    incomingAudio: 'קובץ שמע נכנס',
    incomingMsg: 'מעבד קובץ שמע שהתקבל...',
    copied: 'הועתק!',
    agentThinking: 'הסוכן חושב...',
    clearHistory: 'נקה היסטוריה',
    noTranscript: 'אין תמלול זמין לשאילה',
  },
  en: {
    appName: 'Voice AI Agent',
    tagline: 'Smart Transcription & Summary',
    uploadTitle: 'Upload Audio File',
    uploadSub: 'Tap to select an audio file',
    shareHint: 'Or share directly from WhatsApp',
    processing: 'Processing file...',
    transcribing: 'Transcribing...',
    summarizing: 'Summarizing...',
    transcript: 'Transcript',
    summary: 'Summary',
    askPlaceholder: 'Ask a question about the transcript...',
    askBtn: 'Ask',
    history: 'History',
    noHistory: 'No history yet',
    share: 'Share',
    copy: 'Copy',
    close: 'Close',
    errorTitle: 'Error',
    incomingAudio: 'Incoming Audio',
    incomingMsg: 'Processing received audio file...',
    copied: 'Copied!',
    agentThinking: 'Agent is thinking...',
    clearHistory: 'Clear History',
    noTranscript: 'No transcript available to query',
  },
};

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#0d0f1a',
  bgCard: 'rgba(255,255,255,0.06)',
  bgCardBorder: 'rgba(255,255,255,0.12)',
  bgCardStrong: 'rgba(255,255,255,0.10)',
  accent: '#818cf8',
  accentSoft: 'rgba(129,140,248,0.18)',
  accentGlow: 'rgba(129,140,248,0.35)',
  teal: '#2dd4bf',
  tealSoft: 'rgba(45,212,191,0.15)',
  pink: '#f472b6',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#475569',
  success: '#34d399',
  error: '#f87171',
  divider: 'rgba(255,255,255,0.07)',
};

// ─── Skeleton Loader ───────────────────────────────────────────────────────────
const SkeletonLine = ({ width: w = '100%', height: h = 14, style }) => {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={[{
        width: w, height: h, borderRadius: 6,
        backgroundColor: 'rgba(129,140,248,0.2)',
        opacity: anim, marginBottom: 8,
      }, style]}
    />
  );
};

const SkeletonCard = () => (
  <View style={styles.card}>
    <SkeletonLine width="40%" height={12} />
    <SkeletonLine width="100%" />
    <SkeletonLine width="90%" />
    <SkeletonLine width="75%" />
    <SkeletonLine width="85%" />
    <SkeletonLine width="60%" />
  </View>
);

// ─── Thinking Dots ─────────────────────────────────────────────────────────────
const ThinkingDots = ({ label }) => {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - i * 150),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={{ color: C.textSecondary, fontSize: 13 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 4, marginLeft: 4 }}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent, opacity: d }} />
        ))}
      </View>
    </View>
  );
};

// ─── Pulse Ring (upload idle animation) ───────────────────────────────────────
const PulseRing = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.3, duration: 1200, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', width: 90, height: 90, borderRadius: 45,
      borderWidth: 2, borderColor: C.accent,
      transform: [{ scale }], opacity,
    }} />
  );
};

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useState('he');
  const t = T[lang];
  const isRTL = lang === 'he';

  const [loadingStep, setLoadingStep] = useState(null); // null | 'transcribing' | 'summarizing'
  const [agentLoading, setAgentLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [agentAnswer, setAgentAnswer] = useState('');
  const [agentTask, setAgentTask] = useState('');
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('main'); // 'main' | 'history'
  const [historyModal, setHistoryModal] = useState(null);
  const [toast, setToast] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true }),
      Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    loadHistory();
    const sub = Linking.addEventListener('url', (e) => handleIncomingFile(e.url));
    Linking.getInitialURL().then(url => { if (url) handleIncomingFile(url); });
    return () => sub.remove();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setToast(''));
  };

  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem('voiceHistory');
      if (saved) setHistory(JSON.parse(saved));
    } catch (_) {}
  };

  const saveHistory = async (newHist) => {
    setHistory(newHist);
    await AsyncStorage.setItem('voiceHistory', JSON.stringify(newHist));
  };

  const clearHistory = async () => {
    Alert.alert(t.clearHistory, isRTL ? 'האם למחוק את כל ההיסטוריה?' : 'Delete all history?', [
      { text: t.close, style: 'cancel' },
      { text: isRTL ? 'מחק' : 'Delete', style: 'destructive', onPress: async () => { await saveHistory([]); } },
    ]);
  };

  const handleIncomingFile = async (url) => {
    if (!url) return;
    Alert.alert(t.incomingAudio, t.incomingMsg);
    try {
      let fileUri = url;
      // Handle content:// URIs on Android
      if (Platform.OS === 'android' && url.startsWith('content://')) {
        const dest = FileSystem.cacheDirectory + 'shared_audio_' + Date.now() + '.m4a';
        await FileSystem.copyAsync({ from: url, to: dest });
        fileUri = dest;
      }
      const fileName = fileUri.split('/').pop() || 'shared_audio.m4a';
      processFile({ uri: fileUri, name: fileName, mimeType: 'audio/m4a' });
    } catch (e) {
      Alert.alert(t.errorTitle, e.message);
    }
  };

  const handleUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.length > 0) {
      processFile(result.assets[0]);
    }
  };

  const processFile = async (file) => {
    setTranscript('');
    setSummary('');
    setAgentAnswer('');
    setLoadingStep('transcribing');
    const formData = new FormData();
    formData.append('audio', { uri: file.uri, name: file.name || 'audio.mp3', type: file.mimeType || 'audio/mpeg' });
    try {
      setLoadingStep('transcribing');
      const res = await fetch(API_URL, { method: 'POST', body: formData });
      setLoadingStep('summarizing');
      const data = await res.json();
      if (res.ok) {
        setTranscript(data.transcript || '');
        setSummary(data.summary || '');
        const newHist = [
          { id: Date.now(), summary: data.summary, transcript: data.transcript, date: new Date().toLocaleDateString() },
          ...history,
        ].slice(0, 50);
        await saveHistory(newHist);
      } else {
        Alert.alert(t.errorTitle, data.error || 'Unknown error');
      }
    } catch (e) {
      Alert.alert(t.errorTitle, e.message);
    } finally {
      setLoadingStep(null);
    }
  };

  const askAgent = async () => {
    if (!agentTask.trim()) return;
    if (!transcript) { Alert.alert(t.errorTitle, t.noTranscript); return; }
    Keyboard.dismiss();
    setAgentLoading(true);
    setAgentAnswer('');
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, question: agentTask }),
      });
      const data = await res.json();
      setAgentAnswer(data.answer || data.summary || '');
    } catch (e) {
      Alert.alert(t.errorTitle, e.message);
    } finally {
      setAgentLoading(false);
    }
  };

  const copyText = (text) => {
    // Clipboard from RN core
    const { Clipboard } = require('react-native');
    Clipboard.setString(text);
    showToast(t.copied);
  };

  const shareText = async (text) => {
    await Share.share({ message: text });
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderUploadZone = () => (
    <TouchableOpacity onPress={handleUpload} activeOpacity={0.85}>
      <Animated.View style={[styles.uploadZone, {
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }]}>
        <View style={styles.uploadIconWrap}>
          <PulseRing />
          <View style={styles.uploadIconInner}>
            <MaterialCommunityIcons name="waveform" size={32} color={C.accent} />
          </View>
        </View>
        <Text style={styles.uploadTitle}>{t.uploadTitle}</Text>
        <Text style={styles.uploadSub}>{t.uploadSub}</Text>
        <View style={styles.shareHintRow}>
          <MaterialCommunityIcons name="whatsapp" size={14} color={C.teal} />
          <Text style={styles.shareHint}>{t.shareHint}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );

  const renderLoadingCards = () => (
    <View style={{ gap: 14 }}>
      <View style={[styles.card, { paddingBottom: 18 }]}>
        <ThinkingDots label={loadingStep === 'transcribing' ? t.transcribing : t.summarizing} />
        <View style={{ height: 14 }} />
        <SkeletonLine width="100%" />
        <SkeletonLine width="88%" />
        <SkeletonLine width="72%" />
        <SkeletonLine width="95%" />
        <SkeletonLine width="65%" />
      </View>
      <SkeletonCard />
    </View>
  );

  const renderResultCards = () => (
    <Animated.View style={{
      gap: 14,
      opacity: cardAnim,
      transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
    }}>
      {/* Summary */}
      {summary ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.dot, { backgroundColor: C.teal }]} />
              <Text style={styles.cardTitle}>{t.summary}</Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => copyText(summary)} style={styles.actionBtn}>
                <MaterialCommunityIcons name="content-copy" size={16} color={C.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => shareText(summary)} style={styles.actionBtn}>
                <MaterialCommunityIcons name="share-variant" size={16} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.cardText, isRTL && styles.rtlText]}>{summary}</Text>
        </View>
      ) : null}

      {/* Transcript */}
      {transcript ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.dot, { backgroundColor: C.accent }]} />
              <Text style={styles.cardTitle}>{t.transcript}</Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => copyText(transcript)} style={styles.actionBtn}>
                <MaterialCommunityIcons name="content-copy" size={16} color={C.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.cardText, { color: C.textSecondary, fontSize: 13 }, isRTL && styles.rtlText]}>{transcript}</Text>
        </View>
      ) : null}

      {/* Agent Q&A */}
      {transcript ? (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.dot, { backgroundColor: C.pink }]} />
            <Text style={styles.cardTitle}>AI Agent</Text>
          </View>
          <View style={{ height: 12 }} />
          <View style={styles.agentInputRow}>
            <TextInput
              style={[styles.agentInput, isRTL && styles.rtlText]}
              placeholder={t.askPlaceholder}
              placeholderTextColor={C.textMuted}
              value={agentTask}
              onChangeText={setAgentTask}
              multiline
              textAlign={isRTL ? 'right' : 'left'}
            />
            <TouchableOpacity onPress={askAgent} style={styles.askBtn} disabled={agentLoading}>
              {agentLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <MaterialCommunityIcons name="send" size={18} color="#fff" />
              }
            </TouchableOpacity>
          </View>
          {agentLoading && (
            <View style={{ marginTop: 12 }}>
              <ThinkingDots label={t.agentThinking} />
            </View>
          )}
          {agentAnswer ? (
            <View style={styles.agentAnswer}>
              <MaterialCommunityIcons name="robot-outline" size={15} color={C.pink} style={{ marginBottom: 6 }} />
              <Text style={[styles.cardText, isRTL && styles.rtlText]}>{agentAnswer}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );

  const renderHistory = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>{t.history}</Text>
        {history.length > 0 && (
          <TouchableOpacity onPress={clearHistory}>
            <Text style={{ color: C.error, fontSize: 13 }}>{t.clearHistory}</Text>
          </TouchableOpacity>
        )}
      </View>
      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="history" size={48} color={C.textMuted} />
          <Text style={styles.emptyText}>{t.noHistory}</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setHistoryModal(item)} activeOpacity={0.85}>
              <View style={[styles.historyItem]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyText, isRTL && styles.rtlText]} numberOfLines={3}>
                    {item.summary}
                  </Text>
                  <Text style={styles.historyDate}>{item.date}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={C.textMuted} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );

  // History detail modal
  const renderHistoryModal = () => (
    <Modal visible={!!historyModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.cardTitle}>{t.summary}</Text>
            <Text style={[styles.cardText, { marginBottom: 20 }, isRTL && styles.rtlText]}>
              {historyModal?.summary}
            </Text>
            <Text style={styles.cardTitle}>{t.transcript}</Text>
            <Text style={[styles.cardText, { color: C.textSecondary, fontSize: 13 }, isRTL && styles.rtlText]}>
              {historyModal?.transcript}
            </Text>
          </ScrollView>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtn} onPress={() => copyText(historyModal?.summary)}>
              <MaterialCommunityIcons name="content-copy" size={16} color={C.accent} />
              <Text style={styles.modalBtnText}>{t.copy}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtn} onPress={() => shareText(historyModal?.summary)}>
              <MaterialCommunityIcons name="share-variant" size={16} color={C.teal} />
              <Text style={styles.modalBtnText}>{t.share}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, styles.modalClose]} onPress={() => setHistoryModal(null)}>
              <Text style={{ color: C.textSecondary, fontSize: 14 }}>{t.close}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Background decoration */}
      <View style={styles.bgBlob1} />
      <View style={styles.bgBlob2} />

      {/* Header */}
      <Animated.View style={[styles.header, {
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
      }]}>
        <View>
          <Text style={styles.appName}>{t.appName}</Text>
          <Text style={styles.tagline}>{t.tagline}</Text>
        </View>
        <TouchableOpacity onPress={() => setLang(l => l === 'he' ? 'en' : 'he')} style={styles.langBtn}>
          <Text style={styles.langBtnText}>{lang === 'he' ? 'EN' : 'עב'}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['main', 'history'].map(tab => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.tabActive]}>
            <MaterialCommunityIcons
              name={tab === 'main' ? 'waveform' : 'history'}
              size={16}
              color={activeTab === tab ? C.accent : C.textMuted}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'main' ? t.appName : t.history}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'main' ? (
            <>
              {renderUploadZone()}
              <View style={{ height: 20 }} />
              {loadingStep ? renderLoadingCards() : renderResultCards()}
            </>
          ) : renderHistory()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Toast */}
      {toast ? (
        <Animated.View style={[styles.toast, { opacity: toastAnim }]}>
          <MaterialCommunityIcons name="check-circle" size={16} color={C.success} />
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}

      {renderHistoryModal()}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  bgBlob1: {
    position: 'absolute', top: -80, left: -60,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(99,102,241,0.12)',
  },
  bgBlob2: {
    position: 'absolute', bottom: 100, right: -80,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(45,212,191,0.08)',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: 58, paddingHorizontal: 22, paddingBottom: 8,
  },
  appName: {
    fontSize: 26, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 12, color: C.textMuted, marginTop: 2, letterSpacing: 0.3,
  },
  langBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: C.bgCardBorder,
    backgroundColor: C.bgCard,
  },
  langBtnText: {
    color: C.accent, fontSize: 13, fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row', marginHorizontal: 20, marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 4, gap: 4,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, gap: 6, borderRadius: 10,
  },
  tabActive: {
    backgroundColor: C.accentSoft,
  },
  tabText: {
    fontSize: 13, color: C.textMuted, fontWeight: '500',
  },
  tabTextActive: {
    color: C.accent, fontWeight: '700',
  },
  scroll: {
    padding: 18, paddingBottom: 60,
  },

  // Upload zone
  uploadZone: {
    borderRadius: 24,
    borderWidth: 1, borderStyle: 'dashed', borderColor: C.accentGlow,
    backgroundColor: C.bgCard,
    alignItems: 'center', paddingVertical: 38, paddingHorizontal: 24,
    overflow: 'hidden',
  },
  uploadIconWrap: {
    width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  uploadIconInner: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  uploadTitle: {
    fontSize: 18, fontWeight: '700', color: C.textPrimary, marginBottom: 6,
  },
  uploadSub: {
    fontSize: 13, color: C.textSecondary,
  },
  shareHintRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14,
    backgroundColor: C.tealSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  shareHint: {
    fontSize: 12, color: C.teal,
  },

  // Cards
  card: {
    backgroundColor: C.bgCard,
    borderRadius: 20, borderWidth: 1, borderColor: C.bgCardBorder,
    padding: 18, marginBottom: 2,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
  },
  cardTitle: {
    fontSize: 13, fontWeight: '700', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  cardActions: {
    flexDirection: 'row', gap: 4,
  },
  actionBtn: {
    padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardText: {
    fontSize: 14, color: C.textPrimary, lineHeight: 22,
  },
  rtlText: {
    textAlign: 'right', writingDirection: 'rtl',
  },

  // Agent
  agentInputRow: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-end',
  },
  agentInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, borderWidth: 1, borderColor: C.bgCardBorder,
    paddingHorizontal: 14, paddingVertical: 10,
    color: C.textPrimary, fontSize: 14, maxHeight: 90,
  },
  askBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  agentAnswer: {
    marginTop: 14, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(244,114,182,0.08)',
    borderWidth: 1, borderColor: 'rgba(244,114,182,0.18)',
  },

  // History
  historyHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: C.textPrimary,
  },
  historyItem: {
    backgroundColor: C.bgCard, borderRadius: 16,
    borderWidth: 1, borderColor: C.bgCardBorder,
    padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  historyText: {
    fontSize: 14, color: C.textPrimary, lineHeight: 20, marginBottom: 6,
  },
  historyDate: {
    fontSize: 11, color: C.textMuted,
  },
  emptyState: {
    alignItems: 'center', marginTop: 60, gap: 12,
  },
  emptyText: {
    color: C.textMuted, fontSize: 15,
  },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#161827', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, maxHeight: height * 0.75,
    borderTopWidth: 1, borderColor: C.bgCardBorder,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row', gap: 10, marginTop: 20, paddingTop: 16,
    borderTopWidth: 1, borderColor: C.divider,
  },
  modalBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.bgCardBorder,
  },
  modalBtnText: {
    color: C.textPrimary, fontSize: 14, fontWeight: '600',
  },
  modalClose: {
    backgroundColor: 'transparent', borderColor: 'transparent',
  },

  // Toast
  toast: {
    position: 'absolute', bottom: 30, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(15,20,40,0.95)', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 24, borderWidth: 1, borderColor: C.bgCardBorder,
  },
  toastText: {
    color: C.textPrimary, fontSize: 14, fontWeight: '600',
  },
});