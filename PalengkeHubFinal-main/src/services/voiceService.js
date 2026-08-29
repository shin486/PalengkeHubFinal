// Voice service — speech-to-text (voice search) + text-to-speech (read aloud).
// Both web and native (Android/iOS) speech recognition are driven through the
// same Web Speech API shape: the real browser API on web, and
// expo-speech-recognition's ExpoWebSpeechRecognition polyfill on native — so
// there's exactly one consumer code path instead of three drifting ones.
import { Platform } from 'react-native';

// ── Text-to-speech ──
let ExpoSpeech = null;
try {
  ExpoSpeech = require('expo-speech');
} catch (e) {
  ExpoSpeech = null;
}

export const speak = (text, options = {}) => {
  const { language = 'fil-PH', rate = 0.9, onDone, onError } = options;
  if (!text) return false;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;
        utterance.rate = rate; // slightly slower for elderly users
        if (onDone) utterance.onend = onDone;
        if (onError) utterance.onerror = onError;
        window.speechSynthesis.speak(utterance);
        return true;
      }
      return false;
    }
    if (ExpoSpeech) {
      ExpoSpeech.speak(text, { language, rate, onDone, onError });
      return true;
    }
    return false;
  } catch (e) {
    console.warn('speak failed:', e);
    return false;
  }
};

export const stopSpeaking = () => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return;
    }
    if (ExpoSpeech) ExpoSpeech.stop();
  } catch (e) {
    // ignore
  }
};

// ── Voice input (speech-to-text) ──
let ExpoWebSpeechRecognition = null;
let ExpoSpeechRecognitionModule = null;
try {
  const mod = require('expo-speech-recognition');
  ExpoWebSpeechRecognition = mod.ExpoWebSpeechRecognition;
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
} catch (e) {
  ExpoWebSpeechRecognition = null;
  ExpoSpeechRecognitionModule = null;
}

let activeRecognition = null;

// Returns a Web Speech API-shaped recognizer object regardless of platform —
// the real browser implementation on web, expo-speech-recognition's polyfill
// on native. `null` means voice input is genuinely unavailable here.
const getRecognizer = () => {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    try {
      return new SR();
    } catch (e) {
      return null;
    }
  }
  if (!ExpoWebSpeechRecognition) return null;
  try {
    return new ExpoWebSpeechRecognition();
  } catch (e) {
    return null;
  }
};

export const isVoiceInputSupported = () => {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  return !!ExpoWebSpeechRecognition;
};

/**
 * Start listening for speech.
 * onResult(text, isFinal) is called as the user speaks.
 */
export const startListening = async ({ language = 'tl-PH', onResult, onEnd, onError } = {}) => {
  const rec = getRecognizer();
  if (!rec) {
    if (onError) onError(new Error('not-supported'));
    return false;
  }

  // Native needs the OS mic/speech-recognizer permission granted before
  // start() will actually produce audio — request it up front so a denial
  // surfaces as a clear error instead of a silent no-op.
  if (Platform.OS !== 'web' && ExpoSpeechRecognitionModule) {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm?.granted) {
        if (onError) onError(new Error('not-allowed'));
        return false;
      }
    } catch (e) {
      if (onError) onError(e);
      return false;
    }
  }

  try {
    activeRecognition = rec;
    rec.lang = language;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (finalText && onResult) onResult(finalText, true);
      else if (interim && onResult) onResult(interim, false);
    };
    rec.onend = () => {
      activeRecognition = null;
      if (onEnd) onEnd();
    };
    rec.onerror = (event) => {
      activeRecognition = null;
      // 'no-speech' and 'aborted' are benign; only report real errors
      const code = event.error || 'recognition-error';
      if (code !== 'aborted' && onError) onError(new Error(code));
      if (onEnd) onEnd();
    };
    rec.start();
    return true;
  } catch (e) {
    activeRecognition = null;
    if (onError) onError(e);
    return false;
  }
};

export const stopListening = () => {
  try {
    if (activeRecognition) activeRecognition.stop();
  } catch (e) {
    // ignore
  }
};
