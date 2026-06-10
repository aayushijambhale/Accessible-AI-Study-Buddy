import React, { useState } from "react";
import { History, Search, Trash2, Volume2, Mic, Sparkles, HelpCircle, AlertCircle } from "lucide-react";
import { VoiceLog, VoicePreferences } from "../types";
import { SpeechEngine } from "../utils/speech";

interface VoiceHistoryProps {
  voiceLogs: VoiceLog[];
  onClearLogs: () => void;
  voicePref: VoicePreferences;
}

export default function VoiceHistoryScreen({ voiceLogs, onClearLogs, voicePref }: VoiceHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLogs = voiceLogs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      log.command.toLowerCase().includes(term) ||
      log.response.toLowerCase().includes(term)
    );
  });

  const handleSpeakText = (text: string) => {
    SpeechEngine.speak(text, voicePref);
  };

  const handleMouseEnterText = (text: string) => {
    if (voicePref.enabled) {
      SpeechEngine.speak(text, voicePref);
    }
  };

  return (
    <div id="voice-history-viewport" className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 font-sans">
      
      {/* Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#0F766E]/10 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#E6F4F1] text-[#0F766E] rounded-2xl">
            <History className="w-6 h-6 animate-spin-slow" />
          </div>
          <div onMouseEnter={() => handleMouseEnterText("Voice Command and Auditory Response History logs")}>
            <h2 className="text-lg font-black text-[#134E4A]">Auditory History Logs</h2>
            <p className="text-xs text-[#134E4A]/70 font-semibold leading-relaxed">
              Timeline recording all interpreted voice commands, conversation transcripts, and automated speaking feedbacks.
            </p>
          </div>
        </div>

        {voiceLogs.length > 0 && (
          <button
            id="btn-voice-clear-logs"
            onClick={() => {
              if (confirm("Are you sure you want to clear your local voice interaction history logs? This cannot be undone.")) {
                onClearLogs();
                SpeechEngine.speak("Cleared voice logs.", voicePref);
              }
            }}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            Clear Vocal History
          </button>
        )}
      </div>

      {/* Filter panel & Search state */}
      {voiceLogs.length > 0 && (
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
          <input
            id="vocal-history-search"
            type="text"
            placeholder="Search voice commands, transcripts, or tutor responses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-[#0F766E]/10 rounded-2xl text-xs focus:ring-2 focus:ring-[#0F766E]/20 focus:outline-none text-[#134E4A] font-semibold"
          />
        </div>
      )}

      {/* Timeline logs block */}
      {filteredLogs.length > 0 ? (
        <div className="space-y-4">
          {filteredLogs.map((log) => {
            const isTutor = log.source === "ai_tutor";
            return (
              <div 
                key={log.id} 
                className="bg-white rounded-3xl border border-[#0F766E]/10 hover:border-[#14B8A6]/30 overflow-hidden shadow-xs hover:shadow-md transition-all p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                
                {/* Content info wrapper */}
                <div className="space-y-3 flex-1">
                  
                  {/* Badge & Timestamp bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {isTutor ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black bg-[#E6F4F1] text-[#0F766E] px-2.5 py-1 rounded-full border border-[#0F766E]/10">
                        <Sparkles className="w-3 h-3 text-[#14B8A6]" />
                        AI Tutor Chat
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black bg-[#FFEFCF] text-[#B45309] px-2.5 py-1 rounded-full border border-[#B45309]/10">
                        <Mic className="w-3 h-3 text-[#D97706]" />
                        Global voice command
                      </span>
                    )}

                    <span className="text-[10px] text-gray-400 font-semibold">
                      {new Date(log.timestamp).toLocaleDateString()} at {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  {/* Main dialogues */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    
                    {/* User Command / User voice */}
                    <div className="bg-[#FFFBF5] border border-orange-50/75 p-3 rounded-2xl space-y-1">
                      <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">Interpreted Speech:</span>
                      <p className="text-xs text-[#134E4A] font-black italic">
                        "{log.command || "[No text captured]"}"
                      </p>
                    </div>

                    {/* AI Spoken Response */}
                    <div className="bg-teal-50/20 border border-teal-50/40 p-3 rounded-2xl space-y-1">
                      <span className="text-[9px] uppercase font-bold text-gray-400 block tracking-wider">Verbal feedback response:</span>
                      <p className="text-xs text-[#134E4A] font-semibold leading-relaxed">
                        {log.response || "[Voice notification triggered]"}
                      </p>
                    </div>

                  </div>

                </div>

                {/* Speech audio utilities */}
                <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-gray-100 items-end justify-end">
                  <button
                    id={`btn-play-voice-log-resp-${log.id}`}
                    onClick={() => handleSpeakText(log.response)}
                    title="Read response aloud again"
                    className="flex-1 md:flex-none px-3.5 py-2.5 bg-[#0F766E]/10 hover:bg-[#0F766E] text-[#0F766E] hover:text-white rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[11px] font-black"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Speak Response</span>
                  </button>
                  {log.command && (
                    <button
                      id={`btn-play-voice-log-cmd-${log.id}`}
                      onClick={() => handleSpeakText(log.command)}
                      title="Read spoken command aloud"
                      className="flex-grow md:flex-grow-0 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-[#134E4A]/80 hover:text-gray-900 rounded-xl transition-all cursor-pointer text-[10px] font-bold flex items-center justify-center gap-1 shrink-0"
                    >
                      <span>Listen to command</span>
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* Empty States block */
        <div className="text-center bg-white rounded-3xl p-12 border border-[#0F766E]/10 space-y-4">
          <div className="inline-flex p-4 bg-[#FFFBF5] text-[#0F766E]/40 rounded-full border border-orange-50">
            <Mic className="w-12 h-12" />
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h3 className="text-sm font-black text-[#134E4A] uppercase tracking-wider">No vocal logs captured yet</h3>
            <p className="text-xs text-[#134E4A]/70 font-bold leading-relaxed">
              {searchTerm 
                ? "Could not find any recorded interactions matching your keyword request." 
                : "Active commands will list here as soon as you record or speak voice directives on the application header or conversational tutor."}
            </p>
          </div>
          {!searchTerm && (
            <div className="bg-[#FFFBF5]/70 p-4 rounded-2xl border border-orange-50 max-w-lg mx-auto text-left space-y-2">
              <span className="text-[10px] font-extrabold text-[#0F766E] uppercase block tracking-wider">💡 How to start voice commands:</span>
              <ul className="text-[11px] font-medium text-[#134E4A]/70 list-disc list-inside space-y-1">
                <li>Click 🎤 <strong className="text-[#134E4A]">Voice Control</strong> above, wait for the chime, and say "Go to Quiz Center" or "Open study notes".</li>
                <li>Ask the 🎓 <strong className="text-[#134E4A]">AI Tutor Chat</strong> dynamic questions using its microphone recorder.</li>
                <li>Your voice input will instantly be logged here for subsequent inspection.</li>
              </ul>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
