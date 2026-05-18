import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Alert, TextInput, Share, KeyboardAvoidingView, Platform,
  Keyboard, Animated, StatusBar, Dimensions, Modal, Easing,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');
const API_URL = 'https://voice-summary-backend.vercel.app/api/transcribe';

const C = {
  bg: '#080a0f', bgPanel: '#0e1018', bgCard: '#111420',
  bgCardBorder: '#1e2235', accent: '#ff2d4e', accentGlow: 'rgba(255,45,78,0.28)',
  accentSoft: 'rgba(255,45,78,0.12)', gold: '#f5c842', goldSoft: 'rgba(245,200,66,0.12)',
  cyan: '#00e5ff', cyanSoft: 'rgba(0,229,255,0.10)', textPrimary: '#e8eaf6',
  textSecondary: '#7a7f99', textMuted: '#3a3f55', success: '#39ff14',
  divider: '#1a1d2e',
};

const T = {
  he: {
    appName: 'VOICE.AI', sub: 'מנוע תמלול וסיכום',
    uploadTitle: 'שחרר את הקול', uploadSub: 'לחץ לטעינת קובץ שמע',
    shareHint: 'או שתף ישירות מוואטסאפ',
    transcribing: 'מתמלל...', summarizing: 'מסכם...',
    summary: '// סיכום', transcript: '// תמלול',
    askPlaceholder: 'שאל את הסוכן...', history: 'לוג', noHistory: 'אין רשומות',
    share: 'שתף', copy: 'העתק', close: 'סגור', errorTitle: 'שגיאה',
    copied: 'הועתק ✓', agentThinking: 'מחשב תגובה', clearHistory: 'מחק לוג',
    noTranscript: 'אין תמלול זמין', tabMain: 'סורק', tabLog: 'לוג',
    iosNote: 'iOS: שמור קובץ ופתח מכאן',
  },
  en: {
    appName: 'VOICE.AI', sub: 'Transcription & Summary Engine',
    uploadTitle: 'Release The Voice', uploadSub: 'Tap to load audio file',
    shareHint: 'Or share directly from WhatsApp',
    transcribing: 'Transcribing...', summarizing: 'Summarizing...',
    summary: '// Summary', transcript: '// Transcript',
    askPlaceholder: 'Query the agent...', history: 'Log', noHistory: 'No records',
    share: 'Share', copy: 'Copy', close: 'Close', errorTitle: 'Error',
    copied: 'Copied ✓', agentThinking: 'Computing response', clearHistory: 'Purge Log',
    noTranscript: 'No transcript available', tabMain: 'Scanner', tabLog: 'Log',
    iosNote: 'iOS: Save file first, then open from here',
  },
};

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

const GlitchText = ({ text, style }) => {
  const shift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(3000),
      Animated.timing(shift, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(shift, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.timing(shift, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shift, { toValue: 0, duration: 120, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View>
      <Animated.Text style={[style, { transform: [{ translateX: shift.interpolate({ inputRange: [0,1], outputRange: [0,3] }) }], opacity: 0.3, color: C.cyan, position: 'absolute' }]}>{text}</Animated.Text>
      <Animated.Text style={[style, { transform: [{ translateX: shift.interpolate({ inputRange: [0,1], outputRange: [0,-2] }) }], opacity: 0.3, color: C.accent, position: 'absolute' }]}>{text}</Animated.Text>
      <Text style={style}>{text}</Text>
    </View>
  );
};

const WaveForm = ({ active }) => {
  const b0=useRef(new Animated.Value(0.15)).current,b1=useRef(new Animated.Value(0.15)).current,b2=useRef(new Animated.Value(0.15)).current,b3=useRef(new Animated.Value(0.15)).current,b4=useRef(new Animated.Value(0.15)).current,b5=useRef(new Animated.Value(0.15)).current,b6=useRef(new Animated.Value(0.15)).current,b7=useRef(new Animated.Value(0.15)).current,b8=useRef(new Animated.Value(0.15)).current,b9=useRef(new Animated.Value(0.15)).current,b10=useRef(new Animated.Value(0.15)).current,b11=useRef(new Animated.Value(0.15)).current,b12=useRef(new Animated.Value(0.15)).current,b13=useRef(new Animated.Value(0.15)).current,b14=useRef(new Animated.Value(0.15)).current,b15=useRef(new Animated.Value(0.15)).current,b16=useRef(new Animated.Value(0.15)).current,b17=useRef(new Animated.Value(0.15)).current,b18=useRef(new Animated.Value(0.15)).current,b19=useRef(new Animated.Value(0.15)).current;
  const bars = [b0,b1,b2,b3,b4,b5,b6,b7,b8,b9,b10,b11,b12,b13,b14,b15,b16,b17,b18,b19];
  useEffect(() => {
    if (!active) { bars.forEach(b => b.setValue(0.15)); return; }
    const anims = bars.map((b, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 60),
      Animated.timing(b, { toValue: Math.random() * 0.7 + 0.3, duration: 200 + Math.random() * 300, useNativeDriver: false }),
      Animated.timing(b, { toValue: 0.15, duration: 200 + Math.random() * 300, useNativeDriver: false }),
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [active]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 50 }}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{
          width: 3, borderRadius: 2,
          height: b.interpolate({ inputRange: [0,1], outputRange: [4,46] }),
          backgroundColor: i % 3 === 0 ? C.accent : i % 3 === 1 ? C.cyan : C.gold,
          opacity: active ? 1 : 0.2,
        }} />
      ))}
    </View>
  );
};
const SkeletonLine = ({ w = '100%', h = 10 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ width: w, height: h, borderRadius: 2, backgroundColor: '#ff2d4e', opacity: anim.interpolate({ inputRange: [0,1], outputRange: [0.08, 0.25] }), marginBottom: 7 }} />;
};

const ThinkingDots = ({ label }) => {
 const d0=useRef(new Animated.Value(0)).current, d1=useRef(new Animated.Value(0)).current, d2=useRef(new Animated.Value(0)).current;
 const dots = [d0, d1, d2];
  useEffect(() => {
    const anims = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 180),
      Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(540 - i * 180),
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ color: C.gold, fontFamily: MONO, fontSize: 12 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {dots.map((d, i) => <Animated.View key={i} style={{ width: 5, height: 5, borderRadius: 1, backgroundColor: C.accent, opacity: d }} />)}
      </View>
    </View>
  );
};

const Corners = ({ color = C.accent, size = 12, t = 1.5 }) => (
  <>
    <View style={{ position:'absolute', top:0, left:0, width:size, height:size, borderTopWidth:t, borderLeftWidth:t, borderColor:color }} />
    <View style={{ position:'absolute', top:0, right:0, width:size, height:size, borderTopWidth:t, borderRightWidth:t, borderColor:color }} />
    <View style={{ position:'absolute', bottom:0, left:0, width:size, height:size, borderBottomWidth:t, borderLeftWidth:t, borderColor:color }} />
    <View style={{ position:'absolute', bottom:0, right:0, width:size, height:size, borderBottomWidth:t, borderRightWidth:t, borderColor:color }} />
  </>
);

export default function App() {
  const [lang, setLang] = useState('he');
  const t = T[lang];
  const isRTL = lang === 'he';

  const [loadingStep, setLoadingStep] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [agentAnswer, setAgentAnswer] = useState('');
  const [agentTask, setAgentTask] = useState('');
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('main');
  const [historyModal, setHistoryModal] = useState(null);
  const [toast, setToast] = useState('');

  const toastAnim = useRef(new Animated.Value(0)).current;
  const bootAnim  = useRef(new Animated.Value(0)).current;
  const redlineW  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(redlineW, { toValue: 1, duration: 600, easing: Easing.out(Easing.expo), useNativeDriver: false }),
      Animated.timing(bootAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    loadHistory();
    const sub = Linking.addEventListener('url', e => handleIncomingURL(e.url));
    Linking.getInitialURL().then(url => { if (url) handleIncomingURL(url); });
    return () => sub.remove();
  }, []);

  const showToast = msg => {
    setToast(msg);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(''));
  };

  const loadHistory = async () => {
    try { const s = await AsyncStorage.getItem('vaiHistory'); if (s) setHistory(JSON.parse(s)); } catch (_) {}
  };

  const saveHistory = async h => {
    setHistory(h);
    await AsyncStorage.setItem('vaiHistory', JSON.stringify(h));
  };

  const clearHistory = () => {
    Alert.alert(t.clearHistory, isRTL ? 'למחוק הכל?' : 'Delete all?', [
      { text: t.close, style: 'cancel' },
      { text: isRTL ? 'מחק' : 'Delete', style: 'destructive', onPress: () => saveHistory([]) },
    ]);
  };

  const handleIncomingURL = async url => {
    if (!url) return;
    try {
      let fileUri = url, fileName = 'shared_audio', mimeType = 'audio/mpeg';
      if (Platform.OS === 'android') {
        if (url.startsWith('content://')) {
          const ext = url.includes('.ogg') ? 'ogg' : url.includes('.m4a') ? 'm4a' : url.includes('.mp3') ? 'mp3' : 'mp4';
          const dest = `${FileSystem.cacheDirectory}shared_${Date.now()}.${ext}`;
          await FileSystem.copyAsync({ from: url, to: dest });
          fileUri = dest; fileName = `audio.${ext}`;
          mimeType = ext === 'ogg' ? 'audio/ogg' : ext === 'm4a' ? 'audio/m4a' : 'audio/mpeg';
        } else if (url.startsWith('file://')) {
          fileUri = url; fileName = url.split('/').pop() || 'audio.mp3';
        }
      } else {
        const decoded = decodeURIComponent(url.replace(/^.*?:\/\//, ''));
        fileUri = decoded.startsWith('/') ? `file://${decoded}` : url;
        fileName = fileUri.split('/').pop() || 'audio.m4a';
        const ext = fileName.split('.').pop()?.toLowerCase() || 'm4a';
        const mm = { m4a:'audio/m4a', mp3:'audio/mpeg', ogg:'audio/ogg', mp4:'audio/mp4', aac:'audio/aac', wav:'audio/wav' };
        mimeType = mm[ext] || 'audio/mpeg';
      }
      processFile({ uri: fileUri, name: fileName, mimeType });
    } catch (e) { Alert.alert(t.errorTitle, e.message); }
  };

  const handleUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.length > 0) processFile(result.assets[0]);
  };

  const processFile = async file => {
    setTranscript(''); setSummary(''); setAgentAnswer('');
    setActiveTab('main'); setLoadingStep('transcribing');
    const formData = new FormData();
    formData.append('audio', { uri: file.uri, name: file.name || 'audio.mp3', type: file.mimeType || 'audio/mpeg' });
    try {
      const res = await fetch(API_URL, { method: 'POST', body: formData });
      setLoadingStep('summarizing');
      const data = await res.json();
      if (res.ok) {
        setTranscript(data.transcript || ''); setSummary(data.summary || '');
        const newHist = [{ id: Date.now(), summary: data.summary, transcript: data.transcript, date: new Date().toLocaleDateString() }, ...history].slice(0, 50);
        await saveHistory(newHist);
      } else { Alert.alert(t.errorTitle, data.error || 'Server error'); }
    } catch (e) { Alert.alert(t.errorTitle, e.message); }
    finally { setLoadingStep(null); }
  };

  const askAgent = async () => {
    if (!agentTask.trim()) return;
    if (!transcript) { Alert.alert(t.errorTitle, t.noTranscript); return; }
    Keyboard.dismiss(); setAgentLoading(true); setAgentAnswer('');
    try {
      const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, question: agentTask }) });
      const data = await res.json();
      setAgentAnswer(data.answer || data.summary || '');
    } catch (e) { Alert.alert(t.errorTitle, e.message); }
    finally { setAgentLoading(false); }
  };

  const copyText = text => {
    const { Clipboard } = require('react-native');
    Clipboard.setString(text);
    showToast(t.copied);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Boot red line */}
      <Animated.View style={{ height: 2, backgroundColor: C.accent, width: redlineW.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }), position:'absolute', top:0, left:0, zIndex:99 }} />

      <Animated.View style={{ flex: 1, opacity: bootAnim }}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <GlitchText text={t.appName} style={styles.appName} />
            <Text style={styles.appSub}>{`> ${t.sub}`}</Text>
          </View>
          <TouchableOpacity onPress={() => setLang(l => l === 'he' ? 'en' : 'he')} style={styles.langBtn}>
            <Text style={styles.langBtnText}>{lang === 'he' ? 'EN' : 'עב'}</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:20, marginBottom:6 }}>
          <View style={{ flex:1, height:1, backgroundColor:C.divider }} />
          <View style={{ width:4, height:4, borderRadius:2, backgroundColor:C.accent, marginHorizontal:8 }} />
          <View style={{ flex:1, height:1, backgroundColor:C.divider }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {[{ key:'main', label:t.tabMain, icon:'radar', color:C.accent }, { key:'history', label:t.tabLog, icon:'database', color:C.gold }].map(tab => (
            <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && { borderBottomColor: tab.color, borderBottomWidth: 2 }]} onPress={() => setActiveTab(tab.key)}>
              <MaterialCommunityIcons name={tab.icon} size={14} color={activeTab === tab.key ? tab.color : C.textMuted} />
              <Text style={[styles.tabText, { color: activeTab === tab.key ? tab.color : C.textMuted }]}>{tab.label.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {activeTab === 'main' ? (
              <>
                {/* Upload */}
                <TouchableOpacity onPress={handleUpload} activeOpacity={0.8}>
                  <View style={styles.uploadZone}>
                    <Corners color={C.accent} size={16} t={2} />
                    <WaveForm active={false} />
                    <Text style={styles.uploadTitle}>{t.uploadTitle}</Text>
                    <Text style={styles.uploadSub}>{t.uploadSub}</Text>
                    <View style={styles.shareHintRow}>
                      <MaterialCommunityIcons name="whatsapp" size={13} color={C.success} />
                      <Text style={styles.shareHint}>{t.shareHint}</Text>
                    </View>
                    {Platform.OS === 'ios' && <Text style={styles.iosNote}>{t.iosNote}</Text>}
                  </View>
                </TouchableOpacity>

                <View style={{ height: 16 }} />

                {/* Loading */}
                {loadingStep ? (
                  <View style={{ gap: 12 }}>
                    <View style={styles.card}>
                      <Corners color={C.gold} size={10} />
                      <WaveForm active={true} />
                      <View style={{ height: 12 }} />
                      <ThinkingDots label={loadingStep === 'transcribing' ? t.transcribing : t.summarizing} />
                      <View style={{ height: 12 }} />
                      {[100,88,72,94,60].map((w,i) => <SkeletonLine key={i} w={`${w}%`} />)}
                    </View>
                    <View style={styles.card}>
                      <Corners color={C.textMuted} size={10} />
                      {[50,90,75].map((w,i) => <SkeletonLine key={i} w={`${w}%`} />)}
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    {summary ? (
                      <View style={styles.card}>
                        <Corners color={C.gold} size={10} />
                        <View style={styles.cardHeader}>
                          <Text style={[styles.cardLabel, { color: C.gold }]}>{t.summary}</Text>
                          <View style={{ flexDirection:'row', gap:4 }}>
                            <TouchableOpacity onPress={() => copyText(summary)} style={styles.actionBtn}><MaterialCommunityIcons name="content-copy" size={15} color={C.textSecondary} /></TouchableOpacity>
                            <TouchableOpacity onPress={() => Share.share({ message: summary })} style={styles.actionBtn}><MaterialCommunityIcons name="share-variant" size={15} color={C.textSecondary} /></TouchableOpacity>
                          </View>
                        </View>
                        <Text style={[styles.cardText, isRTL && styles.rtl]}>{summary}</Text>
                      </View>
                    ) : null}

                    {transcript ? (
                      <View style={styles.card}>
                        <Corners color={C.cyan} size={10} />
                        <View style={styles.cardHeader}>
                          <Text style={[styles.cardLabel, { color: C.cyan }]}>{t.transcript}</Text>
                          <TouchableOpacity onPress={() => copyText(transcript)} style={styles.actionBtn}><MaterialCommunityIcons name="content-copy" size={15} color={C.textSecondary} /></TouchableOpacity>
                        </View>
                        <Text style={[styles.cardText, { color: C.textSecondary, fontSize: 12 }, isRTL && styles.rtl]}>{transcript}</Text>
                      </View>
                    ) : null}

                    {transcript ? (
                      <View style={styles.card}>
                        <Corners color={C.accent} size={10} />
                        <Text style={[styles.cardLabel, { color: C.accent, marginBottom: 12 }]}>// AGENT</Text>
                        <View style={{ flexDirection:'row', gap:8, alignItems:'flex-end' }}>
                          <TextInput
                            style={[styles.agentInput, isRTL && styles.rtl]}
                            placeholder={t.askPlaceholder} placeholderTextColor={C.textMuted}
                            value={agentTask} onChangeText={setAgentTask}
                            multiline textAlign={isRTL ? 'right' : 'left'}
                          />
                          <TouchableOpacity onPress={askAgent} style={styles.askBtn} disabled={agentLoading}>
                            <MaterialCommunityIcons name="send" size={18} color={C.bg} />
                          </TouchableOpacity>
                        </View>
                        {agentLoading && <View style={{ marginTop: 10 }}><ThinkingDots label={t.agentThinking} /></View>}
                        {agentAnswer ? (
                          <View style={styles.agentAnswer}>
                            <Text style={[styles.cardLabel, { color: C.accent, marginBottom: 6, fontSize: 10 }]}>{'> OUTPUT'}</Text>
                            <Text style={[styles.cardText, isRTL && styles.rtl]}>{agentAnswer}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                )}
              </>
            ) : (
              /* History */
              <View>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <Text style={[styles.cardLabel, { color: C.gold, fontSize: 13 }]}>{`// ${t.history.toUpperCase()}`}</Text>
                  {history.length > 0 && <TouchableOpacity onPress={clearHistory}><Text style={[styles.cardLabel, { color: C.accent }]}>{t.clearHistory}</Text></TouchableOpacity>}
                </View>
                {history.length === 0 ? (
                  <View style={{ alignItems:'center', paddingVertical:60, gap:10 }}>
                    <MaterialCommunityIcons name="database-off" size={40} color={C.textMuted} />
                    <Text style={[styles.cardLabel, { color: C.textMuted }]}>{t.noHistory}</Text>
                  </View>
                ) : history.map(item => (
                  <TouchableOpacity key={item.id} onPress={() => setHistoryModal(item)}>
                    <View style={[styles.card, { flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 }]}>
                      <Corners color={C.textMuted} size={8} t={1} />
                      <View style={{ flex:1 }}>
                        <Text style={[styles.cardText, isRTL && styles.rtl]} numberOfLines={2}>{item.summary}</Text>
                        <Text style={[styles.cardLabel, { color: C.accent, fontSize: 10, marginTop: 5 }]}>{`> ${item.date}`}</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={18} color={C.textMuted} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Toast */}
      {toast ? (
        <Animated.View style={[styles.toast, { opacity: toastAnim }]}>
          <MaterialCommunityIcons name="check" size={14} color={C.success} />
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}

      {/* History Modal */}
      <Modal visible={!!historyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Corners color={C.gold} size={14} t={2} />
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.cardLabel, { color: C.gold, marginBottom: 8 }]}>{t.summary}</Text>
              <Text style={[styles.cardText, { marginBottom: 20 }, isRTL && styles.rtl]}>{historyModal?.summary}</Text>
              <Text style={[styles.cardLabel, { color: C.cyan, marginBottom: 8 }]}>{t.transcript}</Text>
              <Text style={[styles.cardText, { color: C.textSecondary, fontSize: 12 }, isRTL && styles.rtl]}>{historyModal?.transcript}</Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => copyText(historyModal?.summary)}>
                <MaterialCommunityIcons name="content-copy" size={14} color={C.gold} />
                <Text style={[styles.cardLabel, { color: C.gold }]}>{t.copy}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={() => Share.share({ message: historyModal?.summary })}>
                <MaterialCommunityIcons name="share-variant" size={14} color={C.cyan} />
                <Text style={[styles.cardLabel, { color: C.cyan }]}>{t.share}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { borderColor:'transparent' }]} onPress={() => setHistoryModal(null)}>
                <Text style={[styles.cardLabel, { color: C.textSecondary }]}>{t.close}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex:1, backgroundColor: C.bg },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', paddingTop: Platform.OS === 'ios' ? 58 : 42, paddingHorizontal:20, paddingBottom:10 },
  appName: { fontSize:32, fontWeight:'900', color: C.textPrimary, letterSpacing:4, fontFamily: MONO },
  appSub: { fontSize:11, color: C.textSecondary, marginTop:2, letterSpacing:1, fontFamily: MONO },
  langBtn: { borderWidth:1, borderColor: C.accent, paddingHorizontal:12, paddingVertical:6, borderRadius:2, backgroundColor: C.accentSoft },
  langBtnText: { color: C.accent, fontSize:12, fontWeight:'700', fontFamily: MONO },
  tabs: { flexDirection:'row', paddingHorizontal:20, gap:24, marginBottom:4 },
  tab: { flexDirection:'row', alignItems:'center', gap:6, paddingVertical:8, paddingBottom:6, borderBottomWidth:2, borderBottomColor:'transparent' },
  tabText: { fontSize:11, letterSpacing:1.5, fontFamily: MONO },
  scroll: { padding:18, paddingBottom:60 },
  uploadZone: { borderWidth:1, borderColor: C.accentGlow, borderStyle:'dashed', backgroundColor: C.accentSoft, borderRadius:4, alignItems:'center', paddingVertical:32, paddingHorizontal:20, gap:8, position:'relative', overflow:'hidden' },
  uploadTitle: { fontSize:20, fontWeight:'900', color: C.textPrimary, letterSpacing:3, marginTop:8, fontFamily: MONO },
  uploadSub: { fontSize:12, color: C.textSecondary, letterSpacing:0.5 },
  shareHintRow: { flexDirection:'row', alignItems:'center', gap:5, marginTop:8, backgroundColor:'rgba(57,255,20,0.08)', paddingHorizontal:12, paddingVertical:5, borderRadius:2 },
  shareHint: { fontSize:11, color: C.success },
  iosNote: { fontSize:10, color: C.gold, marginTop:6, textAlign:'center', opacity:0.7, fontFamily: MONO },
  card: { backgroundColor: C.bgCard, borderWidth:1, borderColor: C.bgCardBorder, borderRadius:4, padding:16, position:'relative', overflow:'hidden' },
  cardHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  cardLabel: { fontSize:11, letterSpacing:1.5, fontWeight:'700', fontFamily: MONO },
  cardText: { fontSize:14, color: C.textPrimary, lineHeight:22 },
  actionBtn: { padding:7, backgroundColor:'rgba(255,255,255,0.04)', borderRadius:2 },
  rtl: { textAlign:'right', writingDirection:'rtl' },
  agentInput: { flex:1, backgroundColor: C.bgPanel, borderWidth:1, borderColor: C.bgCardBorder, borderRadius:2, paddingHorizontal:12, paddingVertical:9, color: C.textPrimary, fontSize:13, maxHeight:80, fontFamily: MONO },
  askBtn: { width:42, height:42, borderRadius:2, backgroundColor: C.accent, alignItems:'center', justifyContent:'center' },
  agentAnswer: { marginTop:12, padding:12, borderRadius:2, backgroundColor:'rgba(255,45,78,0.07)', borderWidth:1, borderColor:'rgba(255,45,78,0.2)' },
  toast: { position:'absolute', bottom:32, alignSelf:'center', flexDirection:'row', alignItems:'center', gap:7, backgroundColor: C.bgCard, paddingHorizontal:18, paddingVertical:10, borderRadius:2, borderWidth:1, borderColor: C.success },
  toastText: { color: C.success, fontSize:13, fontFamily: MONO },
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.85)', justifyContent:'flex-end' },
  modalCard: { backgroundColor:'#0e1018', borderTopLeftRadius:6, borderTopRightRadius:6, padding:22, maxHeight: height * 0.75, borderTopWidth:2, borderColor: C.accent, position:'relative' },
  modalHandle: { width:32, height:3, backgroundColor: C.accent, alignSelf:'center', marginBottom:18 },
  modalActions: { flexDirection:'row', gap:8, marginTop:18, paddingTop:14, borderTopWidth:1, borderColor: C.divider },
  modalBtn: { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:5, paddingVertical:11, borderRadius:2, backgroundColor:'rgba(255,255,255,0.04)', borderWidth:1, borderColor: C.bgCardBorder },
});