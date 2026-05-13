import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ScrollView, 
  ActivityIndicator, Alert, Share, TextInput, KeyboardAvoidingView, Platform 
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// הכתובת המעודכנת מהדפלוימנט האחרון שלך
const API_URL = "https://voice-summary-backend.vercel.app/api/transcribe";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); 
  const [status, setStatus] = useState('');
  const [agentTask, setAgentTask] = useState(''); 
  const [agentResult, setAgentResult] = useState(''); 

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'video/*'],
        copyToCacheDirectory: true
      });
      if (!res.canceled) uploadFile(res.assets[0]);
    } catch (err) {
      Alert.alert('שגיאה', 'לא הצלחנו לבחור קובץ');
    }
  };

  const uploadFile = async (file) => {
    setLoading(true);
    setStatus('מעבד את האודיו...');
    const formData = new FormData();
    formData.append('audio', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'audio/mpeg',
    });

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' },
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      Alert.alert('שגיאה בעיבוד', err.message);
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const runAgentTask = async () => {
    if (!agentTask || !result?.transcript) return;

    setLoading(true);
    setStatus('הסוכן AI מעבד את הבקשה...');
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: result.transcript,
          task: agentTask
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setAgentResult(data.answer);
      setAgentTask(''); 
    } catch (err) {
      Alert.alert('שגיאה', 'הסוכן לא הצליח להשלים את המשימה');
    } finally {
      setLoading(false);
    }
  };

  const shareText = async (text) => {
    try {
      await Share.share({ message: text });
    } catch (error) {
      console.log(error.message);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <Text style={styles.title}>Voice AI Agent</Text>
      
      {!result && !loading && (
        <TouchableOpacity style={styles.uploadCard} onPress={pickDocument}>
          <MaterialCommunityIcons name="microphone-outline" size={80} color="#6C63FF" />
          <Text style={styles.uploadText}>העלה הקלטה להתחלה</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}

      {result && !loading && (
        <ScrollView style={styles.resultContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => {setResult(null); setAgentResult('');}}>
              <MaterialCommunityIcons name="refresh" size={20} color="#FFF" />
              <Text style={styles.btnText}>חדש</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={() => shareText(`*סיכום:*\n${result.summary}\n\n*תמלול:*\n${result.transcript}`)}>
              <MaterialCommunityIcons name="share-variant" size={20} color="#FFF" />
              <Text style={styles.btnText}>שתף הכל</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>סיכום חכם</Text>
            <Text style={styles.text}>{result.summary}</Text>
          </View>

          <View style={[styles.card, {borderColor: '#6C63FF', borderWidth: 1}]}>
            <Text style={[styles.cardTitle, {color: '#6C63FF'}]}>AI Agent - פקודות</Text>
            <View style={styles.agentInputContainer}>
              <TextInput 
                style={styles.input}
                placeholder="למשל: תרגם לאנגלית..."
                value={agentTask}
                onChangeText={setAgentTask}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={runAgentTask}>
                <MaterialCommunityIcons name="send" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            {agentResult ? (
              <View style={styles.agentResponse}>
                <Text style={styles.agentResponseText}>{agentResult}</Text>
                <TouchableOpacity onPress={() => shareText(agentResult)} style={styles.smallShare}>
                   <MaterialCommunityIcons name="share-variant" size={16} color="#6C63FF" />
                   <Text style={{color: '#6C63FF', fontSize: 13, marginRight: 5}}>שתף תשובה</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>תמלול מלא</Text>
            <Text style={styles.transcriptText}>{result.transcript}</Text>
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5', paddingTop: 60, paddingHorizontal: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1A1A2E', textAlign: 'center', marginBottom: 20 },
  uploadCard: { backgroundColor: '#FFF', borderRadius: 25, padding: 50, alignItems: 'center', elevation: 4 },
  uploadText: { marginTop: 15, fontSize: 18, color: '#6C63FF', fontWeight: '600' },
  loadingContainer: { marginTop: 40, alignItems: 'center' },
  statusText: { marginTop: 15, fontSize: 16, color: '#555' },
  resultContainer: { flex: 1 },
  topActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15 },
  refreshBtn: { flexDirection: 'row-reverse', backgroundColor: '#FF4D4D', padding: 10, borderRadius: 10, alignItems: 'center', width: '45%', justifyContent: 'center' },
  shareBtn: { flexDirection: 'row-reverse', backgroundColor: '#6C63FF', padding: 10, borderRadius: 10, alignItems: 'center', width: '45%', justifyContent: 'center' },
  btnText: { color: '#FFF', marginRight: 8, fontWeight: '600' },
  card: { backgroundColor: '#FFF', borderRadius: 15, padding: 15, marginBottom: 15, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8, textAlign: 'right' },
  text: { fontSize: 15, color: '#444', textAlign: 'right', lineHeight: 22 },
  transcriptText: { fontSize: 13, color: '#777', textAlign: 'right' },
  agentInputContainer: { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 10 },
  input: { flex: 1, backgroundColor: '#F8F9FA', borderRadius: 10, padding: 12, textAlign: 'right', marginLeft: 10 },
  sendBtn: { backgroundColor: '#6C63FF', padding: 12, borderRadius: 10 },
  agentResponse: { marginTop: 15, padding: 10, backgroundColor: '#F0EFFF', borderRadius: 10 },
  agentResponseText: { fontSize: 15, color: '#333', textAlign: 'right' },
  smallShare: { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 10 }
});