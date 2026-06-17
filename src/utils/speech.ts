// Client-side HTML5 Web Speech Synthesis & Recognition helpers

import { VoicePreferences } from "../types";

// Standardize browser differences for SpeechRecognition
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export class SpeechEngine {
  private static synth = window.speechSynthesis;
  private static recognitionInstance: any = null;

  // READ ALOUD ASSISTANT (Phase 8 Text-to-Speech)
  public static speak(text: string, preferences: VoicePreferences, onEndCallback?: () => void) {
    if (!this.synth) return;
    this.synth.cancel(); // Stop any pending utterance first

    // Clean up markdown markers or complex symbols before recitation for screen readers
    const cleanedText = text
      .replace(/[*#_`~]/g, "")
      .replace(/\[.*?\]/g, "")
      .slice(0, 1500);

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.rate = preferences.rate || 1.0;
    utterance.pitch = preferences.pitch || 1.0;

    if (preferences.voiceName) {
      const voices = this.synth.getVoices();
      const matched = voices.find((v) => v.name === preferences.voiceName);
      if (matched) utterance.voice = matched;
    }

    if (onEndCallback) {
      utterance.onend = () => {
        onEndCallback();
      };
    }

    this.synth.speak(utterance);
  }

  public static stop() {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  public static isSpeaking(): boolean {
    return this.synth ? this.synth.speaking || this.synth.pending : false;
  }

  // SPEECH RECOGNITION (Phase 7 Speech-to-Text)
  public static startListening(
    onResult: (text: string, confidence: number, isFinal: boolean) => void,
    onEnd: () => void,
    onError: (err: any) => void,
    lang: string = "en-US"
  ) {
    if (!SpeechRecognition) {
      onError("Speech recognition not supported in this browser environment.");
      return;
    }

    try {
      this.stopListening();

      const instance = new SpeechRecognition();
      instance.continuous = true;
      instance.interimResults = true;
      instance.lang = lang;

      instance.onresult = (event: any) => {
        let transcript = "";
        let confidence = 0.95;
        let isFinal = false;

        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
          if (event.results[i][0].confidence > 0) {
            confidence = event.results[i][0].confidence;
          }
          if (event.results[i].isFinal) {
            isFinal = true;
          }
        }
        onResult(transcript, confidence, isFinal);
      };

      instance.onerror = (event: any) => {
        onError(event.error);
      };

      instance.onend = () => {
        onEnd();
      };

      instance.start();
      this.recognitionInstance = instance;
    } catch (e) {
      onError(e);
    }
  }

  public static stopListening() {
    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.abort();
      } catch (err) {
        // Safe catch
      }
      this.recognitionInstance = null;
    }
  }

  // Fetch standard matching voices
  public static getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }
}
