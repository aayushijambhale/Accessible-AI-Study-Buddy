import React, { useState, useEffect, useRef } from "react";
import { Sparkles, MessageCircle, Send, Volume2, StopCircle, Mic, MicOff, AlertCircle, FileText } from "lucide-react";
import { SpeechEngine } from "../utils/speech";
import { NoteItem, ChatMessage, VoicePreferences } from "../types";

interface TutorProps {
  token: string;
  voicePref: VoicePreferences;
  onAddVoiceLog: (command: string, response: string, source: "voice_control" | "ai_tutor") => void;
}

export default function TutorScreen({ token, voicePref, onAddVoiceLog }: TutorProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Pedagogical Mode: "normal" | "easy" (Metaphors) | "exam_prep" (Testing Terms)
  const [mode, setMode] = useState<"normal" | "easy" | "exam_prep">("normal");

  // Mic recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");

  const wasTranscribedByVoice = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load baseline resources
  useEffect(() => {
    fetch("/api/notes", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setNotes(data);
        if (data.length > 0) {
          setSelectedNoteId(data[0].id);
        }
      });
  }, [token]);

  // Scroll to bottom on updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handleVoiceTutorAsk = (e: Event) => {
      const customEvent = e as CustomEvent;
      const question = customEvent.detail.question;
      wasTranscribedByVoice.current = true;
      handleSendMessage(question);
    };

    window.addEventListener("trigger-voice-tutor-ask", handleVoiceTutorAsk);
    return () => window.removeEventListener("trigger-voice-tutor-ask", handleVoiceTutorAsk);
  }, [token, selectedNoteId, mode, voicePref, messages]);

  const handleMouseEnterText = (text: string) => {
    if (voicePref.enabled) {
      SpeechEngine.speak(text, voicePref);
    }
  };

  // Submit text input to chatbot
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputVal;
    if (!textToSend.trim()) return;

    if (!customText) setInputVal("");

    // Append visual user message
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 11),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSendingMessage(true);

    try {
      const res = await fetch("/api/tutor/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          noteId: selectedNoteId || null,
          userMessage: textToSend,
          mode,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Tutor server error.");
      }

      const aiMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 11),
        sender: "ai",
        text: data.aiResponse,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      // If text was populated verbally via Speech-to-text mic, log the interaction
      if (wasTranscribedByVoice.current) {
        onAddVoiceLog(textToSend, data.aiResponse, "ai_tutor");
        wasTranscribedByVoice.current = false;
      }

      // Read AI Response out aloud automatically
      setTimeout(() => {
        SpeechEngine.speak(data.aiResponse, voicePref);
      }, 200);
    } catch (err) {
      console.error(err);
      const errMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 11),
        sender: "ai",
        text: "I experienced difficulty connecting to study files. Please ensure study noted sections are selected on the dashboard.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSendingMessage(false);
    }
  };

  // Speaks complete historical log message
  const handleReadResponse = (text: string) => {
    SpeechEngine.speak(text, voicePref);
  };

  // Speech to Text audio capture (Phase 7 dynamic microphone recording)
  const handleToggleRecord = () => {
    if (isRecording) {
      SpeechEngine.stopListening();
      setIsRecording(false);
      return;
    }

    setRecordingError("");
    setIsRecording(true);

    SpeechEngine.startListening(
      (transcript) => {
        setInputVal(transcript);
        if (transcript.trim().length > 0) {
          wasTranscribedByVoice.current = true;
        }
      },
      () => {
        setIsRecording(false);
      },
      (err) => {
        console.error("STT capture failure: ", err);
        setRecordingError("Could not access microphone.");
        setIsRecording(false);
      }
    );
  };

  return (
    <div id="tutor-screen" className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto h-[calc(100vh-140px)]">
      
      {/* LEFT COLUMN: Chat config dashboard widgets */}
      <div className="lg:col-span-4 space-y-6 flex flex-col justify-start">
        
        {/* Context Picker */}
        <div className="bg-white p-6 rounded-2xl border border-[#0F766E]/10 space-y-4">
          <div className="flex items-center gap-2 text-[#0F766E]">
            <Sparkles className="w-5 h-5" />
            <h3 className="text-md font-bold text-[#134E4A]">Tutoring Context</h3>
          </div>

          <p className="text-xs text-[#134E4A]/70 leading-relaxed font-semibold">
            Point or attach your Study Buddy chatbot to an uploaded lesson note. Buddy will read notes to answer queries accurately. If none selected, Buddy utilizes scientific general education databases.
          </p>

          <div>
            <label htmlFor="tutor-select-note" className="block text-xs font-bold text-[#134E4A]/70 uppercase tracking-wider mb-1">
              Active Context Study Note
            </label>
            <select
              id="tutor-select-note"
              value={selectedNoteId}
              onChange={(e) => {
                setSelectedNoteId(e.target.value);
                SpeechEngine.speak(`Switched tutor context to note.`, voicePref);
              }}
              className="w-full px-3 py-2 text-xs bg-[#FFFBF5] border border-[#0F766E]/15 rounded-xl block text-[#134E4A] focus:outline-none"
            >
              <option value="">No note chosen (General knowledge mode)</option>
              {notes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pedagogical mode selection boxes (Phase 6 requirements) */}
        <div className="bg-white p-6 rounded-2xl border border-[#0F766E]/10 space-y-4 shadow-xs">
          <span className="text-xs font-bold text-[#134E4A]/60 block uppercase">Pedagogical Buddy Mode</span>
          
          <div className="grid grid-cols-1 gap-2.5">
            
            {/* Normal mode */}
            <button
              id="tutor-mode-normal"
              onClick={() => {
                setMode("normal");
                SpeechEngine.speak("Switched to Standard academic tutor mode.", voicePref);
              }}
              className={`p-3 text-left border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === "normal"
                  ? "bg-[#0F766E] text-white border-[#0F766E]"
                  : "bg-[#FFFBF5] border-[#0F766E]/10 hover:bg-[#14B8A6]/5 text-[#134E4A]"
              }`}
            >
              🎓 Standard Academic Mode
            </button>

            {/* Easy mode (Metaphor master) */}
            <button
              id="tutor-mode-easy"
              onClick={() => {
                setMode("easy");
                SpeechEngine.speak("Switched to Easy explanation mode, deploying simplified analogies.", voicePref);
              }}
              className={`p-3 text-left border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === "easy"
                  ? "bg-[#14B8A6] text-white border-[#14B8A6] shadow-xs"
                  : "bg-[#FFFBF5] border-[#0F766E]/10 hover:bg-[#14B8A6]/5 text-[#134E4A]"
              }`}
            >
              💡 Easy Explanation Mode (Analogy Metaphors)
            </button>

            {/* Exam prep vocabulary mode */}
            <button
              id="tutor-mode-exam"
              onClick={() => {
                setMode("exam_prep");
                SpeechEngine.speak("Switched to Exam preparation mode, focused on mnemonics and formulas.", voicePref);
              }}
              className={`p-3 text-left border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === "exam_prep"
                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                  : "bg-[#FFFBF5] border-[#0F766E]/10 hover:bg-[#14B8A6]/5 text-[#134E4A]"
              }`}
            >
              📝 Exam Prep Mode (Testing Terms)
            </button>

          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Chat box window panel */}
      <div className="lg:col-span-8 bg-white rounded-3xl border border-[#0F766E]/10 flex flex-col justify-between overflow-hidden shadow-xs h-full">
        
        {/* Chat Header */}
        <div className="p-4 bg-[#FFFBF5] border-b border-[#0F766E]/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#0F766E]/10 rounded-full text-[#0F766E]">
              <MessageCircle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#14B8A6] uppercase block">Interactive Classroom</span>
              <h4 className="text-sm font-bold text-[#134E4A]">Active Chat Session</h4>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              id="tutor-btn-stop-audio"
              onClick={() => SpeechEngine.stop()}
              title="Silence Tutor Audio"
              className="p-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl cursor-pointer"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chat logs messages list area */}
        <div ref={scrollRef} className="p-6 overflow-y-auto space-y-4 flex-1">
          {messages.length > 0 ? (
            messages.map((m) => {
              const isAi = m.sender === "ai";
              return (
                <div key={m.id} className={`flex ${isAi ? "justify-start" : "justify-end"} items-start gap-3`}>
                  
                  {isAi && (
                    <div className="p-1.5 bg-[#0F766E]/10 rounded-full shrink-0">
                      <Sparkles className="w-4 h-4 text-[#0F766E]" />
                    </div>
                  )}

                  <div className={`max-w-lg p-4 rounded-2xl relative ${
                    isAi
                      ? "bg-[#FFFBF5] border border-[#0F766E]/10 rounded-tl-none text-[#134E4A]"
                      : "bg-[#0F766E] text-white rounded-tr-none font-medium"
                  }`}>
                    
                    <p className="text-xs leading-relaxed break-words">{m.text}</p>
                    
                    {/* Speak help button for each message */}
                    {isAi && (
                      <button
                        id={`tutor-msg-speak-${m.id}`}
                        onClick={() => handleReadResponse(m.text)}
                        title="Read aloud"
                        className="mt-2.5 p-1 text-[#0F766E] hover:text-[#134E4A] hover:bg-teal-50 rounded-sm cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                      >
                        <Volume2 className="w-3.5 h-3.5" /> Read Aloud
                      </button>
                    )}

                  </div>

                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col justify-center items-center text-center p-8 text-[#134E4A]/50">
              <Sparkles className="w-12 h-12 text-[#134E4A]/15 mb-3" />
              <h4 className="text-sm font-bold">Ask anything about your Lesson note</h4>
              <p className="text-xs text-[#134E4A]/70 max-w-xs mt-1">
                Say "What is the key takeaway?", "Explain formulas using metaphors", or ask about any definitions.
              </p>
            </div>
          )}
        </div>

        {/* Chat input form */}
        <div className="p-4 bg-[#FFFBF5] border-t border-[#0F766E]/10 shrink-0 space-y-2">
          
          {recordingError && (
            <div className="p-2 text-[10px] text-red-800 bg-red-50 border border-red-200 rounded-lg flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{recordingError}</span>
            </div>
          )}

          <div className="flex gap-2.5">
            
            {/* Speech to text input mic button */}
            <button
              id="tutor-btn-record"
              onClick={handleToggleRecord}
              title={isRecording ? "Stop voice capture" : "Record your question verbally"}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                isRecording
                  ? "bg-[#14B8A6] border-[#14B8A6] text-white animate-pulse"
                  : "bg-white border-gray-200 text-[#0F766E] hover:bg-[#14B8A6]/10"
              }`}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Content text */}
            <input
              id="tutor-chat-input"
              type="text"
              placeholder={isRecording ? "Listening to your voice..." : "Enter query or message..."}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !sendingMessage) handleSendMessage();
              }}
              className="flex-1 px-4 py-2 text-xs bg-white border border-gray-200 focus:outline-none focus:border-[#0F766E] rounded-xl text-[#134E4A]"
            />

            {/* Send content */}
            <button
              id="tutor-btn-send"
              disabled={sendingMessage || !inputVal.trim()}
              onClick={() => handleSendMessage()}
              className="p-3.5 bg-[#0F766E] text-white rounded-xl shadow-xs hover:bg-[#134E4A] disabled:opacity-50 transition-all cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>

          </div>
        </div>

      </div>

    </div>
  );
}
