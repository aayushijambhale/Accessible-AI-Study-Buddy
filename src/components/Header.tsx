import React, { useState } from "react";
import { LogIn, Mic, Volume2, VolumeX, Type, HelpCircle, StopCircle, Keyboard } from "lucide-react";
import { SpeechEngine } from "../utils/speech";
import { UserProfile, VoicePreferences } from "../types";

interface HeaderProps {
  user: UserProfile | null;
  voicePref: VoicePreferences;
  onUpdatePreferences: (pref: Partial<VoicePreferences>) => void;
  onChangeTab: (tab: string) => void;
  onAddVoiceLog: (command: string, response: string, source: "voice_control" | "ai_tutor") => void;
  onOpenCheatSheet: () => void;
}

export default function Header({ 
  user, 
  voicePref, 
  onUpdatePreferences, 
  onChangeTab,
  onAddVoiceLog,
  onOpenCheatSheet 
}: HeaderProps) {
  const [isListeningForCommands, setIsListeningForCommands] = useState(false);
  const [voiceCommandFeedback, setVoiceCommandFeedback] = useState("");

  // Hover screen reader helper
  const handleMouseEnterText = (text: string) => {
    if (voicePref.enabled) {
      SpeechEngine.speak(text, voicePref);
    }
  };

  // Toggle Read Aloud
  const toggleReadAloud = () => {
    const nextVal = !voicePref.enabled;
    onUpdatePreferences({ enabled: nextVal });
    
    // Explicitly confirm change verbally
    setTimeout(() => {
      SpeechEngine.speak(
        nextVal ? "Screen reader hover simulation is now enabled." : "Hover audio disabled.",
        { ...voicePref, enabled: true }
      );
    }, 150);
  };

  // Rotate text dimensions
  const rotateFontSize = () => {
    let nextSize: "normal" | "large" | "extra-large" = "normal";
    if (voicePref.textZoom === "normal") nextSize = "large";
    else if (voicePref.textZoom === "large") nextSize = "extra-large";
    
    onUpdatePreferences({ textZoom: nextSize });
    
    setTimeout(() => {
      SpeechEngine.speak(`Font size adjusted to ${nextSize} display.`, voicePref);
    }, 150);
  };

  // Handle active voice commands routing (Phase 7 & 10 voice assistant workflow)
  const handleVoiceCommandStart = () => {
    if (isListeningForCommands) {
      SpeechEngine.stopListening();
      setIsListeningForCommands(false);
      return;
    }

    setIsListeningForCommands(true);
    setVoiceCommandFeedback("Listening for command...");
    SpeechEngine.speak("Voice interaction active. Speak system command like notes, quiz, chat, profile, or stop.", voicePref);

    SpeechEngine.startListening(
      (text) => {
        const cleaned = text.toLowerCase().trim();
        setVoiceCommandFeedback(`Transcribed: "${cleaned}"`);
        
        // Command routers
        if (cleaned.includes("note") || cleaned.includes("material")) {
          onChangeTab("notes");
          const resp = "Opening study notes.";
          SpeechEngine.speak(resp, voicePref);
          onAddVoiceLog(cleaned, resp, "voice_control");
          SpeechEngine.stopListening();
          setIsListeningForCommands(false);
        } else if (cleaned.includes("quiz") || cleaned.includes("test") || cleaned.includes("challenge")) {
          onChangeTab("quiz");
          const resp = "Opening practice evaluation center.";
          SpeechEngine.speak(resp, voicePref);
          onAddVoiceLog(cleaned, resp, "voice_control");
          SpeechEngine.stopListening();
          setIsListeningForCommands(false);
        } else if (cleaned.includes("chat") || cleaned.includes("tutor") || cleaned.includes("buddy")) {
          onChangeTab("tutor");
          const resp = "Opening conversational tutor.";
          SpeechEngine.speak(resp, voicePref);
          onAddVoiceLog(cleaned, resp, "voice_control");
          SpeechEngine.stopListening();
          setIsListeningForCommands(false);
        } else if (cleaned.includes("visual") || cleaned.includes("image") || cleaned.includes("caption")) {
          onChangeTab("visual");
          const resp = "Opening image caption helper.";
          SpeechEngine.speak(resp, voicePref);
          onAddVoiceLog(cleaned, resp, "voice_control");
          SpeechEngine.stopListening();
          setIsListeningForCommands(false);
        } else if (cleaned.includes("access") || cleaned.includes("setting") || cleaned.includes("desk")) {
          onChangeTab("accessibility");
          const resp = "Opening accessibility configuration console.";
          SpeechEngine.speak(resp, voicePref);
          onAddVoiceLog(cleaned, resp, "voice_control");
          SpeechEngine.stopListening();
          setIsListeningForCommands(false);
        } else if (cleaned.includes("profile") || cleaned.includes("stat")) {
          onChangeTab("profile");
          const resp = "Opening study hour logs.";
          SpeechEngine.speak(resp, voicePref);
          onAddVoiceLog(cleaned, resp, "voice_control");
          SpeechEngine.stopListening();
          setIsListeningForCommands(false);
        } else if (cleaned.includes("stop") || cleaned.includes("quiet") || cleaned.includes("shut")) {
          SpeechEngine.stop();
          setVoiceCommandFeedback("Silenced.");
          onAddVoiceLog(cleaned, "Audio reading silenced.", "voice_control");
          SpeechEngine.stopListening();
          setIsListeningForCommands(false);
        }
      },
      () => {
        setIsListeningForCommands(false);
      },
      (err) => {
        if (err === "no-speech") {
          console.log("Speech recognition ended: no speech detected.");
          setVoiceCommandFeedback("No speech heard.");
        } else {
          console.error("Mic error:", err);
          setVoiceCommandFeedback("Access failed.");
        }
        setIsListeningForCommands(false);
      }
    );
  };

  return (
    <header className="bg-white border-b border-[#0F766E]/10 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
      
      {/* Greetings Block */}
      <div 
        className="text-center sm:text-left"
        onMouseEnter={() => handleMouseEnterText(`Welcome, ${user ? user.fullName : "Student"}. Explore your dashboard workspace.`)}
      >
        <span className="text-xs uppercase font-extrabold text-[#14B8A6] tracking-wider">AI STUDY COMPANION</span>
        <h2 className="text-xl font-black text-[#134E4A]">
          Hello, {user ? user.fullName : "Guest Learner"} 👋
        </h2>
      </div>

      {/* Accessibility Interactive Header Controls */}
      <div className="flex flex-wrap justify-center items-center gap-2.5">
        
        {/* Dynamic Voice feedback notification bubble */}
        {voiceCommandFeedback && (
          <span className="text-xs bg-[#14B8A6]/10 px-3 py-1.5 rounded-full font-bold text-[#0F766E] animate-pulse">
            {voiceCommandFeedback}
          </span>
        )}

        {/* Global Instant Mute Indicator */}
        <button
          id="header-btn-stop"
          onClick={() => {
            SpeechEngine.stop();
            setVoiceCommandFeedback("Audio cleared.");
          }}
          title="Stop reading current text"
          className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 transition-all cursor-pointer"
        >
          <StopCircle className="w-5 h-5" />
        </button>

        {/* Voice Command Mic Trigger (Phase 7 & 10) */}
        <button
          id="header-btn-mic"
          onClick={handleVoiceCommandStart}
          title="Verbal command helper"
          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
            isListeningForCommands
              ? "bg-[#14B8A6] border-[#14B8A6] text-white animate-bounce"
              : "bg-[#FFFBF5] border-[#0F766E]/15 text-[#0F766E] hover:bg-[#14B8A6]/15"
          }`}
        >
          <Mic className="w-5 h-5 animate-pulse" />
          <span className="text-xs font-bold">🎤 Start Speaking</span>
        </button>

        {/* Screen Reader Hover Mode toggle */}
        <button
          id="header-btn-toggle-read"
          onClick={toggleReadAloud}
          title={voicePref.enabled ? "Disable screen hover recitation" : "Enable screen hover recitation"}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
            voicePref.enabled
              ? "bg-[#0F766E] border-[#0F766E] text-white"
              : "bg-[#FFFBF5] border-[#0F766E]/15 text-[#0F766E] hover:bg-[#14B8A6]/15"
          }`}
        >
          {voicePref.enabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
          <span className="text-xs font-bold hidden md:inline">
            {voicePref.enabled ? "Read Aloud: ON" : "Read Aloud: OFF"}
          </span>
        </button>

        {/* Scalable Text Zoom Selector */}
        <button
          id="header-btn-text-zoom"
          onClick={rotateFontSize}
          title={`Text Font Zoom: currently ${voicePref.textZoom}`}
          className="p-3 bg-[#FFFBF5] border border-[#0F766E]/15 text-[#0F766E] hover:bg-[#14B8A6]/15 rounded-xl transition-all cursor-pointer flex items-center gap-2"
        >
          <Type className="w-5 h-5" />
          <span className="text-xs font-bold uppercase">{voicePref.textZoom}</span>
        </button>

        {/* Keyboard Shortcuts Cheat Sheet trigger button */}
        <button
          id="header-btn-shortcuts"
          onClick={onOpenCheatSheet}
          title="Show interactive keyboard shortcuts cheat sheet (Alt+K)"
          className="p-3 bg-[#FFFBF5] border border-[#0F766E]/15 text-[#0F766E] hover:bg-[#14B8A6]/15 rounded-xl transition-all cursor-pointer flex items-center gap-2"
        >
          <Keyboard className="w-5 h-5" />
          <span className="text-xs font-bold hidden md:inline">Shortcuts</span>
        </button>

      </div>

    </header>
  );
}
