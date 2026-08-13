// Voice service — speech-to-text (voice search) + text-to-speech (read aloud).
// Works on web (browser SpeechRecognition / SpeechSynthesis) and falls back
// gracefully on native (expo-speech for TTS; expo-speech-recognition if installed).
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
let NativeVoice = null;
try {
  NativeVoice = require('expo-speech-recognition');
} catch (e) {
  NativeVoice = null;
}

let webRecognition = null;

const getWebRecognition = () => {
  if (typeof window === 'undefined') return null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  try {
    return new SR();
  } catch (e) {
    return null;
  }
};

export const isVoiceInputSupported = () => {
  if (Platform.OS === 'web') return !!getWebRecognition();
  return !!NativeVoice;
};

/**
 * Start listening for speech.
 * onResult(text, isFinal) is called as the user speaks.
 */
export const startListening = ({ language = 'tl-PH', onResult, onEnd, onError } = {}) => {
  if (Platform.OS === 'web') {
    const rec = getWebRecognition();
    if (!rec) {
      if (onError) onError(new Error('not-supported'));
      return false;
    }
    try {
      webRecognition = rec;
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
        webRecognition = null;
        if (onEnd) onEnd();
      };
      rec.onerror = (event) => {
        webRecognition = null;
        // 'no-speech' and 'aborted' are benign; only report real errors
        const code = event.error || 'recognition-error';
        if (code !== 'aborted' && onError) onError(new Error(code));
        if (onEnd) onEnd();
      };
      rec.start();
      return true;
    } catch (e) {
      if (onError) onError(e);
      return false;
    }
  }

  if (NativeVoice) {
    try {
      NativeVoice.start({
        lang: language,
        interimResults: true,
        onResult: (e) => {
          const text = e?.results?.[0];
          if (text && onResult) onResult(text, !!e?.isFinal);
        },
        onError: (e) => onError && onError(e),
        onEnd: () => onEnd && onEnd(),
      });
      return true;
    } catch (e) {
      if (onError) onError(e);
      return false;
    }
  }

  return false;
};

export const stopListening = () => {
  if (Platform.OS === 'web') {
    try {
      if (webRecognition) webRecognition.stop();
    } catch (e) {
      // ignore
    }
    return;
  }
  try {
    if (NativeVoice) NativeVoice.stop();
  } catch (e) {
    // ignore
  }
};
