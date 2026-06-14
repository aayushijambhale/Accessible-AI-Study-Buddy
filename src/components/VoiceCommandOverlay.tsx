import React, { useEffect, useState } from "react";
import { Mic, Speech, Sparkles, Volume2, HelpCircle, X, ChevronRight, Activity } from "lucide-react";
import { VoicePreferences } from "../types";
import { SpeechEngine } from "../utils/speech";

interface VoiceCommandOverlayProps {
  isOpen: boolean;
  transcript: string;
  confidence: number;
  isListening: boolean;
  onClose: () => void;
  onExecuteCommand?: (command: string) => void;
  voicePref: VoicePreferences;
}

export default function VoiceCommandOverlay({
  isOpen,
  transcript,
  confidence,
  isListening,
  onClose,
  onExecuteCommand,
  voicePref,
}: VoiceCommandOverlayProps) {
  const [interimType, setInterimType] = useState<string>("Analyzing your intent...");
  const [colorAccent, setColorAccent] = useState<string>("from-[#4338CA] to-[#6366F1]");

  // Parse natural language commands in real-time
  useEffect(() => {
    if (!transcript) {
      setInterimType("Say something like 'Create notes about DNA' or 'Go to quiz'");
      setColorAccent("from-[#4338CA] to-[#6366F1]");
      return;
    }

    const text = transcript.toLowerCase();

    // 1. Quizzes
    if (text.includes("quiz") && (text.includes("create") || text.includes("make") || text.includes("generate") || text.includes("me on"))) {
      setInterimType("🔥 Command recognized: Generate Quiz");
      setColorAccent("from-orange-500 to-amber-500");
    }
    // 2. Notes
    else if (text.includes("note") && (text.includes("create") || text.includes("make") || text.includes("generate") || text.includes("study"))) {
      setInterimType("📚 Command recognized: Create Lesson Notes");
      setColorAccent("from-indigo-600 to-indigo-500");
    }
    // 3. Tutor Question
    else if (text.includes("ask") || text.includes("tutor") || text.includes("explain")) {
      setInterimType("🎓 Command recognized: Ask AI Tutor");
      setColorAccent("from-indigo-500 to-purple-500");
    }
    // 4. Navigations
    else if (text.includes("go to") || text.includes("open") || text.includes("show")) {
      setInterimType("🚀 Command recognized: App Navigation");
      setColorAccent("from-blue-500 to-indigo-500");
    }
    // Default
    else {
      setInterimType("Checking voice input commands...");
      setColorAccent("from-[#4338CA] to-[#2DD4BF]");
    }
  }, [transcript]);

  if (!isOpen) return null;

  return (
    <div
      id="voice-command-overlay"
      className="fixed inset-0 bg-[#312E81]/30 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white/95 border border-[#6366F1]/25 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden p-6 relative space-y-6 animate-scaleIn">
        
        {/* Decorative close button */}
        <button
          id="btn-close-voice-overlay"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-gray-900 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Outer Circular Pulse Wave */}
        <div className="flex flex-col items-center justify-center text-center space-y-2 pt-2">
          <div className="relative flex items-center justify-center">
            
            {/* Pulsing Ripple circles */}
            {isListening && (
              <>
                <span className="absolute inline-flex h-20 h-20 w-20 w-20 rounded-full bg-[#6366F1]/10 animate-ping" />
                <span className="absolute inline-flex h-24 h-24 w-24 w-24 rounded-full bg-[#6366F1]/5 animate-pulse" />
              </>
            )}

            {/* Glowing Center Microphone */}
            <div className={`p-4 bg-gradient-to-br ${colorAccent} text-white rounded-full shadow-lg relative z-10 transition-all duration-300`}>
              <Mic className={`w-8 h-8 ${isListening ? "animate-bounce" : ""}`} />
            </div>
          </div>

          <div className="pt-2">
            <span className="text-[10px] tracking-widest font-black text-[#6366F1] uppercase">
              {isListening ? "AI IS LISTENING ACTIVE" : "VOICE CONTROL STANDBY"}
            </span>
            <h3 className="text-sm font-black text-[#312E81]">Voice Command HUD</h3>
          </div>
        </div>

        {/* Live Audio Transcript Box */}
        <div className="bg-[#F8FAFC]/90 border border-orange-50 rounded-2xl p-4 min-h-[96px] flex flex-col justify-between space-y-3 relative overflow-hidden">
          
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#6366F1]/10">
            {isListening && (
              <div className="h-full bg-gradient-to-r from-indigo-500 to-[#6366F1] w-full animate-marquee" />
            )}
          </div>

          <div>
            <span className="text-[9px] font-extrabold uppercase text-gray-400 block tracking-wider">Live Speech Transcript:</span>
            <p className="text-xs font-black text-[#312E81] italic leading-relaxed pt-1">
              {transcript ? `"${transcript}"` : "Speak clearly holding spacebar..."}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[10px] font-bold text-[#312E81]/70">
            <span>{interimType}</span>
            {transcript && (
              <span className="bg-[#E6F4F1] text-[#4338CA] px-2 py-0.5 rounded-md font-extrabold">
                {(confidence * 100).toFixed(0)}% accuracy
              </span>
            )}
          </div>

        </div>

        {/* Live Confidence Metric Slider/Gauges */}
        {transcript && (
          <div className="space-y-1.5 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
            <div className="flex justify-between items-center text-[10px] font-black text-[#312E81]">
              <span className="uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-[#6366F1]" />
                Cognitive Confidence Score
              </span>
              <span className="text-[#4338CA]">{(confidence * 100).toFixed(0)}%</span>
            </div>
            
            {/* Visual accuracy progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-[#6366F1] h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(15, confidence * 100))}%` }}
              />
            </div>
          </div>
        )}

        {/* Instruction Guidance Quick reference cheapsheet */}
        <div className="bg-[#E6F4F1]/30 border border-[#4338CA]/5 rounded-2xl p-4 space-y-2">
          <span className="text-[10px] font-extrabold text-[#4338CA] uppercase block tracking-wider">💡 Power Voice Syntaxes:</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-medium text-[#312E81]/85">
            <div className="space-y-1">
              <div className="flex items-start gap-1">
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-[#6366F1]" />
                <span>"Create a quiz about <strong className="text-[#312E81] font-extrabold">DNA</strong>"</span>
              </div>
              <div className="flex items-start gap-1">
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-[#6366F1]" />
                <span>"Create notes about <strong className="text-[#312E81] font-extrabold">mitosis</strong>"</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-start gap-1">
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-[#6366F1]" />
                <span>"Ask tutor <strong className="text-[#312E81] font-extrabold">what is RNA?</strong>"</span>
              </div>
              <div className="flex items-start gap-1">
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-[#6366F1]" />
                <span>"Go to <strong className="text-[#312E81] font-extrabold">quiz center</strong>"</span>
              </div>
            </div>
          </div>
        </div>

        {/* Release instruction foot */}
        <div className="text-center text-[10px] font-bold text-gray-400 capitalize">
          Release space bar to dispatch command instantly
        </div>

      </div>
    </div>
  );
}
