import React, { useState, useEffect } from "react";
import { Sparkles, Mic, X, Volume2, ArrowRight } from "lucide-react";
import { VoicePreferences } from "../types";
import { SpeechEngine } from "../utils/speech";

interface MicroHintOverlayProps {
  currentTab: string;
  voicePref: VoicePreferences;
  onOpenCheatSheet: () => void;
}

export default function MicroHintOverlay({ currentTab, voicePref, onOpenCheatSheet }: MicroHintOverlayProps) {
  const [suggestion, setSuggestion] = useState({
    title: "Quick Voice Hint",
    prompt: "Hold Spacebar to command",
    action: "Say 'Go to Quiz'",
    desc: "Speak anytime to instantly navigate"
  });

  const [visible, setVisible] = useState(true);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    // Determine context-based suggestions
    switch (currentTab) {
      case "dashboard":
        setSuggestion({
          title: "Dashboard Hint",
          prompt: "Hold Space to speak",
          action: "Say 'Create notes about DNA'",
          desc: "Or say 'Explain Photosynthesis' to trigger live tutoring."
        });
        break;
      case "notes":
        setSuggestion({
          title: "Study Notes Hint",
          prompt: "Generate textbook guides",
          action: "Say 'Create notes about Mitochondria'",
          desc: "Produces instant rich academic summaries automatically."
        });
        break;
      case "quiz":
        setSuggestion({
          title: "Quiz Center Hint",
          prompt: "Synthesize practice test",
          action: "Say 'Create a quiz about Mitosis'",
          desc: "Creates a dynamic MCQ exam challenge on any subject query."
        });
        break;
      case "tutor":
        setSuggestion({
          title: "AI Chat Tutor Hint",
          prompt: "Instant voice questions",
          action: "Say 'Explain Quantum Physics'",
          desc: "Directs full dialogue, analogies, and mnemonics with conversational AI."
        });
        break;
      case "visual":
        setSuggestion({
          title: "Visual Helper Hint",
          prompt: "Describe diagrams verbally",
          action: "Say 'Go to Accessibility Desk'",
          desc: "Use voice shortcuts to swap profiles or check screen contrast."
        });
        break;
      case "accessibility":
        setSuggestion({
          title: "Sensory Workspace",
          prompt: "System Audio commands",
          action: "Say 'Silence'",
          desc: "Mutes any run-on spoken recitation text feedback immediately."
        });
        break;
      case "voice-history":
        setSuggestion({
          title: "Auditory History Logs",
          prompt: "Read dialogues",
          action: "Say 'Go to Student Dashboard'",
          desc: "Click 'Listen to command' to test synthetic playback speeds."
        });
        break;
      case "profile":
        setSuggestion({
          title: "Academic Progress Desk",
          prompt: "Voice stats lookup",
          action: "Say 'Open study notes'",
          desc: "Quickly hop across your textbook summaries via voice control."
        });
        break;
      default:
        setSuggestion({
          title: "Interactive voice control",
          prompt: "Hold Space to command",
          action: "Say 'Show shortcuts'",
          desc: "Use Alt+K to bring up the full list of study shortcuts."
        });
    }

    // Trigger slight enter animation when tab swaps
    setAnimate(false);
    const t = setTimeout(() => setAnimate(true), 50);
    return () => clearTimeout(t);
  }, [currentTab]);

  if (!visible) return null;

  const handleSpeakSuggestion = () => {
    SpeechEngine.speak(`Here is a helpful tip: you can hold the spacebar down and say "${suggestion.action}"`, voicePref);
  };

  return (
    <div
      id="micro-hint-container"
      className={`fixed bottom-6 right-6 z-40 max-w-sm w-full bg-white/95 backdrop-blur-xs border border-[#14B8A6]/20 rounded-3xl shadow-xl transition-all duration-300 transform ${
        animate ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"
      }`}
    >
      <div className="p-4 relative">
        {/* Dismiss Button */}
        <button
          id="btn-dismiss-micro-hint"
          onClick={() => {
            setVisible(false);
            SpeechEngine.speak("Hint panel dismissed.", voicePref);
          }}
          className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-all cursor-pointer"
          title="Minimize custom hints"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Content Body */}
        <div className="space-y-3">
          
          {/* Header Banner */}
          <div className="flex items-center gap-2">
            <div className="p-1 px-2.5 bg-[#E6F4F1] text-[#0F766E] rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#14B8A6] animate-pulse" />
              <span>{suggestion.title}</span>
            </div>
            <span className="text-[10px] text-gray-400 font-bold">{suggestion.prompt}</span>
          </div>

          {/* Action Callout bubble */}
          <div className="bg-[#FFFBF5] border border-orange-50 p-2.5 rounded-2xl flex items-center justify-between gap-2 shadow-xs group">
            <div className="flex items-center gap-2 min-w-0">
              <Mic className="w-4 h-4 text-[#D97706] shrink-0 animate-bounce" />
              <p className="text-xs font-black text-[#134E4A] truncate">
                {suggestion.action}
              </p>
            </div>
            
            <button
              id="btn-speak-hint-audio"
              onClick={handleSpeakSuggestion}
              title="Speak suggestion out aloud"
              className="p-1 bg-white hover:bg-orange-100/40 text-[#0F766E] hover:text-[#134E4A] rounded-lg transition-all shrink-0 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Hint Details & Navigation help */}
          <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-gray-100 text-[10px]">
            <p className="text-gray-500 font-medium italic truncate max-w-[210px]">{suggestion.desc}</p>
            <button
              id="link-btn-open-manual-shortcuts"
              onClick={onOpenCheatSheet}
              className="text-[#0F766E] hover:text-[#14B8A6] font-black tracking-wide flex items-center gap-0.5 shrink-0 transition-colors cursor-pointer"
            >
              <span>Verify list</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
