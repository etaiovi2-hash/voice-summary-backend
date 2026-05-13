import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, 
  ScrollView, Share, SafeAreaView, StatusBar, Alert, Dimensions 
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const API_URL = "https://voice-summary-app.vercel.app/api/transcribe";

export default function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [history, setHistory] = useState([]);

  const loadingMessages = ["מנתח את האודיו...", "מתרגם לטקסט...", "ה-AI מנסח סיכום...", "מלטש פרטים אחרונים..."];

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 1500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const loadHistory = async () => {
    const saved = await AsyncStorage.getItem('summary_history');
    if (saved) setHistory(JSON.parse(saved));
  };

  const deleteItem = (id) => {
    Alert.alert("מחיקה", "להסיר את הסיכום מההיסטוריה?", [
      { text: "ביטול", style: "cancel" },
      { text: "מחק", onPress: async () => {
        const updated = history.filter(item => item.id !== id);
        setHistory(updated);
        await AsyncStorage.setItem('summary_history', JSON.stringify(updated));
      }, style: 'destructive' }
    ]);
  };

  const handleUpload = async (file) => {
    setLoading(true);
    try {
      const formData = new FormData();
      
      formData.append('audio', {
        uri: file.uri,
        type: 'audio/mpeg', 
        name: 'recording.mp3', 
      });

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'שגיאת שרת');

      // יצירת האובייקט החדש עם התמלול והסיכום
      const newEntry = {
        id: Date.now().toString(),
        summary: data.summary,
        transcript: data.transcript, 
        fileName: file.name,
        date: new Date().toLocaleDateString(),
        tag: "סיכום חדש"
      };

      // עדכון הסטייט ושמירה בזיכרון המקומי של הטלפון
      const updatedHistory = [newEntry, ...history];
      setHistory(updatedHistory);
      await AsyncStorage.setItem('summary_history', JSON.stringify(updatedHistory));

    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {showWelcome ? (
        <View style={styles.welcomeContainer}>
          <View style={styles.glowCircle}>
            <MaterialCommunityIcons name="robot-outline" size={70} color="#a855f7" />
          </View>
          <Text style={styles.welcomeTitle}>VoiceSummary</Text>
          <Text style={styles.welcomeSubtitle}>בינה מלאכותית בשירות האוזניים שלך</Text>
          <TouchableOpacity style={styles.mainBtn} onPress={() => setShowWelcome(false)}>
            <Text style={styles.mainBtnText}>התחלת עבודה</Text>
            <MaterialCommunityIcons name="chevron-left" size={24} color="white" />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>הסיכומים שלי</Text>
              <Text style={styles.headerSub}>{history.length} הודעות עובדו</Text>
            </View>
            <TouchableOpacity onPress={() => setShowWelcome(true)} style={styles.iconBtn}>
              <MaterialCommunityIcons name="cog-outline" size={26} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <TouchableOpacity 
              style={[styles.uploadBox, loading && styles.uploadBoxDisabled]} 
              onPress={() => !loading && DocumentPicker.getDocumentAsync({type: 'audio/*'}).then(r => !r.canceled && handleUpload(r.assets[0]))}
              disabled={loading}
            >
              {loading ? (
                <View style={{ alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#a855f7" />
                  <Text style={styles.loadingMsg}>{loadingMessages[loadingStep]}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.plusCircle}>
                    <MaterialCommunityIcons name="plus" size={30} color="white" />
                  </View>
                  <Text style={styles.uploadTitle}>העלה הודעה קולית</Text>
                  <Text style={styles.uploadDesc}>MP3, WAV, M4A עד 25MB</Text>
                </>
              )}
            </TouchableOpacity>

            {history.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{item.tag}</Text>
                  </View>
                  <Text style={styles.cardDate}>{item.date}</Text>
                </View>
                          
                <View>
                  <Text style={styles.sectionTitle}>התמלול המלא:</Text>
                  <Text style={styles.transcriptText}>{item.transcript || "אין תמלול זמין"}</Text>
  
                  <Text style={styles.sectionTitle}>הסיכום של AI:</Text>
                  <Text style={styles.cardText}>{item.summary}</Text>
                </View>                    
                
                <View style={styles.cardFooter}>
                  <Text style={styles.fileLabel}>{item.fileName}</Text>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.actionIcon}>
                      <MaterialCommunityIcons name="delete-outline" size={22} color="#ef4444" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Share.share({message: item.summary})} style={styles.actionIcon}>
                      <MaterialCommunityIcons name="share-variant" size={22} color="#a855f7" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  welcomeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  glowCircle: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(168, 85, 247, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#a855f7' },
  welcomeTitle: { color: 'white', fontSize: 36, fontWeight: '900', letterSpacing: 1 },
  welcomeSubtitle: { color: '#94a3b8', fontSize: 16, marginTop: 10, marginBottom: 40 },
  mainBtn: { backgroundColor: '#a855f7', flexDirection: 'row-reverse', paddingVertical: 18, paddingHorizontal: 35, borderRadius: 20, alignItems: 'center', gap: 10 },
  mainBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', padding: 25, alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 28, fontWeight: 'bold' },
  headerSub: { color: '#64748b', fontSize: 14, textAlign: 'right' },
  uploadBox: { backgroundColor: '#0f172a', borderRadius: 24, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b', marginBottom: 30 },
  plusCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#a855f7', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  uploadTitle: { color: 'white', fontSize: 18, fontWeight: '700' },
  uploadDesc: { color: '#475569', fontSize: 12, marginTop: 5 },
  loadingMsg: { color: '#a855f7', marginTop: 15, fontWeight: '600' },
  card: { backgroundColor: '#0f172a', borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#1e293b' },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12 },
  tag: { backgroundColor: 'rgba(168, 85, 247, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { color: '#c084fc', fontSize: 11, fontWeight: 'bold' },
  cardDate: { color: '#475569', fontSize: 12 },
  sectionTitle: { fontWeight: 'bold', color: '#a855f7', marginBottom: 5, textAlign: 'right' },
  transcriptText: { fontSize: 14, color: '#94a3b8', marginBottom: 15, textAlign: 'right', lineHeight: 20 },
  cardText: { color: '#cbd5e1', fontSize: 16, lineHeight: 24, textAlign: 'right' },
  cardFooter: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#1e293b', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  fileLabel: { color: '#475569', fontSize: 11 },
  cardActions: { flexDirection: 'row', gap: 15 },
  actionIcon: { padding: 5 }
});