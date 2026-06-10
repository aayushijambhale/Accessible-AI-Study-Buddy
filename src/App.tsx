import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import LandingPage from "./components/LandingPage";
import AuthPage from "./components/AuthPage";
import DashboardScreen from "./components/DashboardScreen";
import NotesScreen from "./components/NotesScreen";
import QuizScreen from "./components/QuizScreen";
import TutorScreen from "./components/TutorScreen";
import VisualHelperScreen from "./components/VisualHelperScreen";
import AccessibilityDeskScreen from "./components/AccessibilityDeskScreen";
import ProfileScreen from "./components/ProfileScreen";
import VoiceHistoryScreen from "./components/VoiceHistoryScreen";
import ShortcutCheatSheetModal from "./components/ShortcutCheatSheetModal";
import VoiceCommandOverlay from "./components/VoiceCommandOverlay";
import MicroHintOverlay from "./components/MicroHintOverlay";
import { VoicePreferences, UserProfile, VoiceLog } from "./types";
import { SpeechEngine } from "./utils/speech";

export default function App() {
  // Persistence layers
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("buddy_auth_token"));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const cached = localStorage.getItem("buddy_user_profile");
    return cached ? JSON.parse(cached) : null;
  });
  const [isStarted, setIsStarted] = useState<boolean>(() => {
    return localStorage.getItem("buddy_app_started") === "true";
  });

  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [showCheatSheet, setShowCheatSheet] = useState<boolean>(false);
  const [voiceLogs, setVoiceLogs] = useState<VoiceLog[]>(() => {
    const cached = localStorage.getItem("buddy_voice_logs");
    return cached ? JSON.parse(cached) : [];
  });

  // Voice overlay state controls & walkie-talkie mode refs
  const [isVoiceOverlayOpen, setIsVoiceOverlayOpen] = useState(false);
  const [voiceOverlayTranscript, setVoiceOverlayTranscript] = useState("");
  const [voiceOverlayConfidence, setVoiceOverlayConfidence] = useState(0.95);
  const [isVoiceOverlayListening, setIsVoiceOverlayListening] = useState(false);

  const isSpaceHeldRef = useRef(false);
  const overlayTranscriptRef = useRef("");

  // Default accessible priorities
  const [voicePref, setVoicePref] = useState<VoicePreferences>(() => {
    const cached = localStorage.getItem("buddy_voice_preferences");
    if (cached) return JSON.parse(cached);
    return {
      enabled: false,
      rate: 1.0,
      pitch: 1.0,
      voiceName: "",
      contrastMode: false,
      textZoom: "normal",
    };
  });

  // Watch Voice preferences state changes to update document CSS variables and localStorage
  useEffect(() => {
    localStorage.setItem("buddy_voice_preferences", JSON.stringify(voicePref));

    // Dynamic classes calculation for text zoom and high contrast values
    const classList: string[] = ["min-h-screen", "bg-[#FFFBF5]"];
    if (voicePref.contrastMode) {
      classList.push("high-contrast-active");
    }
    if (voicePref.textZoom === "large") {
      classList.push("text-zoom-large");
    } else if (voicePref.textZoom === "extra-large") {
      classList.push("text-zoom-extra-large");
    }

    document.documentElement.className = classList.join(" ");
  }, [voicePref]);

  // Sync profile details upon mount or token change
  useEffect(() => {
    if (token) {
      fetch("/api/auth/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Stale token");
        })
        .then((data) => {
          setUser({
            id: data.id,
            email: data.email,
            fullName: data.fullName,
            voiceSettings: data.voiceSettings,
          });
          if (data.voiceSettings) {
            setVoicePref(data.voiceSettings);
          }
        })
        .catch((err) => {
          console.warn("Auth token checks failed:", err);
          handleLogout();
        });
    }
  }, [token]);

  // Handle live global profile updates from Phase 2 settings panel
  useEffect(() => {
    const handleProfileReload = () => {
      if (token) {
        fetch("/api/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => {
            if (res.ok) return res.json();
          })
          .then((data) => {
            if (data) {
              const updatedUser = {
                id: data.id,
                email: data.email,
                fullName: data.fullName,
                voiceSettings: data.voiceSettings,
                studyHours: data.studyHours,
                studyLogs: data.studyLogs
              };
              setUser(updatedUser);
              localStorage.setItem("buddy_user_profile", JSON.stringify(updatedUser));
            }
          })
          .catch((err) => console.error("Event reload profile error: ", err));
      }
    };

    window.addEventListener("profile-updated", handleProfileReload);
    return () => window.removeEventListener("profile-updated", handleProfileReload);
  }, [token]);

  const handleAddVoiceLog = (command: string, response: string, source: "voice_control" | "ai_tutor") => {
    const newLog: VoiceLog = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      command: command,
      response: response,
      source: source
    };
    setVoiceLogs((prev) => {
      const nextLogs = [newLog, ...prev].slice(0, 500);
      localStorage.setItem("buddy_voice_logs", JSON.stringify(nextLogs));
      return nextLogs;
    });
  };

  const handleClearVoiceLogs = () => {
    setVoiceLogs([]);
    localStorage.removeItem("buddy_voice_logs");
  };

  const handleExecuteVoiceCommand = (commandText: string) => {
    const text = commandText.trim().toLowerCase();
    if (!text) {
      SpeechEngine.speak("Voice processing cancelled.", voicePref);
      return;
    }

    let processedFeedback = "";

    // 1. "Create a quiz about [Topic]" or "test me on [Topic]" or "quiz me on [Topic]"
    const quizRegex = /(?:create|make|generate|start|do)\s+(?:a\s+)?quiz\s+(?:about|on|for)\s+(.+)/i;
    const quizRegexAlt = /quiz\s+me\s+(?:on|about)\s+(.+)/i;
    const quizMatch = text.match(quizRegex) || text.match(quizRegexAlt);

    if (quizMatch) {
      const topic = quizMatch[1].trim();
      setCurrentTab("quiz");
      processedFeedback = `Formulating practice quiz and concept notes about "${topic}". One moment please...`;
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("trigger-voice-create-quiz", { detail: { topic } }));
      }, 500);
      return;
    }

    // 2. "Create notes about [Topic]" or "study [Topic]" or "make study notes on [Topic]"
    const notesRegex = /(?:create|make|generate|study|author|write)\s+(?:study\s+)?notes?\s+(?:about|on|for|of)\s+(.+)/i;
    const notesMatch = text.match(notesRegex);
    if (notesMatch) {
      const topic = notesMatch[1].trim();
      setCurrentTab("notes");
      processedFeedback = `Formulating textbook study materials about "${topic}". One moment please...`;
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("trigger-voice-create-notes", { detail: { topic } }));
      }, 500);
      return;
    }

    // 3. "Ask tutor [Question]" or "tutor [Question]" or "explain [Concept]"
    const tutorRegex = /(?:ask|tell|question)\s+(?:the\s+)?tutor\s+(?:to\s+|that\s+|about\s+|on\s+)?(.+)/i;
    const explainRegex = /explain\s+(.+)/i;
    const tutorMatch = text.match(tutorRegex) || text.match(explainRegex);
    if (tutorMatch) {
      const question = tutorMatch[1].trim();
      setCurrentTab("tutor");
      processedFeedback = `Passing "${question}" to the AI conversational desk.`;
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("trigger-voice-tutor-ask", { detail: { question } }));
      }, 500);
      return;
    }

    // 4. Standard Navigations:
    if (text.includes("dashboard") || text.includes("home") || text.includes("overview") || text.includes("metric") || text.includes("stats")) {
      setCurrentTab("dashboard");
      processedFeedback = "Opening Student Dashboard.";
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
    } else if (text.includes("notes") || text.includes("material") || text.includes("textbook") || text.includes("p d f") || text.includes("pdf")) {
      setCurrentTab("notes");
      processedFeedback = "Opening Study Notes.";
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
    } else if (text.includes("quiz") || text.includes("test") || text.includes("challenge") || text.includes("score")) {
      setCurrentTab("quiz");
      processedFeedback = "Opening Practice Quiz Center.";
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
    } else if (text.includes("tutor") || text.includes("chat") || text.includes("chatbox") || text.includes("buddy") || text.includes("conversation") || text.includes("ask")) {
      setCurrentTab("tutor");
      processedFeedback = "Opening AI conversational tutor.";
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
    } else if (text.includes("visual") || text.includes("image") || text.includes("screenshot") || text.includes("diagram") || text.includes("caption")) {
      setCurrentTab("visual");
      processedFeedback = "Opening visual outline describer helpdesk.";
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
    } else if (text.includes("access") || text.includes("sensory") || text.includes("contrast") || text.includes("zoom") || text.includes("settings") || text.includes("desk")) {
      setCurrentTab("accessibility");
      processedFeedback = "Opening Accessibility configuration console.";
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
    } else if (text.includes("history") || text.includes("voice log") || text.includes("transcript") || text.includes("recordings")) {
      setCurrentTab("voice-history");
      processedFeedback = "Opening Vocal recordings history logs.";
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
    } else if (text.includes("profile") || text.includes("progress") || text.includes("award") || text.includes("credential")) {
      setCurrentTab("profile");
      processedFeedback = "Opening study hour logs student profile.";
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
    } else if (text.includes("cheat") || text.includes("shortcut") || text.includes("help") || text.includes("keyboard")) {
      setShowCheatSheet(true);
      processedFeedback = "Opening interactive keyboard shortcuts.";
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
    } else if (text.includes("stop") || text.includes("quiet") || text.includes("hush") || text.includes("silence") || text.includes("mute")) {
      SpeechEngine.stop();
      processedFeedback = "Audio recitation silenced.";
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
    } else {
      // Default: Feed general question to chat tutor
      setCurrentTab("tutor");
      processedFeedback = `Let's discuss "${commandText}" with the AI Study Tutor.`;
      handleAddVoiceLog(commandText, processedFeedback, "voice_control");
      SpeechEngine.speak(processedFeedback, voicePref);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("trigger-voice-tutor-ask", { detail: { question: commandText } }));
      }, 500);
    }
  };

  // Global Keyboard Shortcut Manager & Space Walkie-Talkie capture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInput = activeTag === "input" || activeTag === "textarea" || document.activeElement?.getAttribute("contenteditable") === "true";
      
      if (isInput) {
        return; 
      }

      // Space -> Start global speech overlay hold-to-speak mode
      if (e.code === "Space") {
        e.preventDefault();
        
        // Stop current text synthesis so the recording is clear
        SpeechEngine.stop();

        if (isSpaceHeldRef.current) return; // Prevent repeated triggers from auto-repeat keydown
        isSpaceHeldRef.current = true;

        setIsVoiceOverlayOpen(true);
        setIsVoiceOverlayListening(true);
        setVoiceOverlayTranscript("");
        overlayTranscriptRef.current = "";
        setVoiceOverlayConfidence(0.95);

        SpeechEngine.startListening(
          (text, confidence) => {
            setVoiceOverlayTranscript(text);
            overlayTranscriptRef.current = text;
            if (confidence) {
              setVoiceOverlayConfidence(confidence);
            }
          },
          () => {
            setIsVoiceOverlayListening(false);
          },
          (err) => {
            console.error("Mic overlay error:", err);
            setIsVoiceOverlayListening(false);
          }
        );
      }

      // Alt+Q -> Navigate to Quiz Center
      if (e.altKey && e.key.toLowerCase() === "q") {
        e.preventDefault();
        setCurrentTab("quiz");
        SpeechEngine.speak("Opening Practice Quiz Center.", voicePref);
      }

      // Alt+N -> Navigate to Study Notes and trigger note creator form reset
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCurrentTab("notes");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("activate-new-note-mode"));
        }, 150);
      }

      // Alt+D -> Navigate to Dashboard
      if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setCurrentTab("dashboard");
        SpeechEngine.speak("Opening Student Dashboard.", voicePref);
      }

      // Alt+T -> Navigate to AI Tutor Chat
      if (e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setCurrentTab("tutor");
        SpeechEngine.speak("Opening conversational AI tutor chat.", voicePref);
      }

      // Alt+V -> Navigate to Visual Helper
      if (e.altKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        setCurrentTab("visual");
        SpeechEngine.speak("Opening visual image outline describer.", voicePref);
      }

      // Alt+A -> Navigate to Accessibility Desk
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setCurrentTab("accessibility");
        SpeechEngine.speak("Opening accessibility config console.", voicePref);
      }

      // Alt+H -> Navigate to Voice History Logs
      if (e.altKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setCurrentTab("voice-history");
        SpeechEngine.speak("Opening vocal history recordings logs.", voicePref);
      }

      // Alt+P -> Navigate to Profile
      if (e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setCurrentTab("profile");
        SpeechEngine.speak("Opening educational student profile progress tracker.", voicePref);
      }

      // Alt+K -> Toggle Shortcuts Cheat Sheet modal
      if (e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCheatSheet((prev) => !prev);
        SpeechEngine.speak("Toggle keyboard shortcuts cheat sheet.", voicePref);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        const isInput = activeTag === "input" || activeTag === "textarea" || document.activeElement?.getAttribute("contenteditable") === "true";
        if (isInput) return;

        if (isSpaceHeldRef.current) {
          isSpaceHeldRef.current = false;
          e.preventDefault();

          SpeechEngine.stopListening();
          setIsVoiceOverlayListening(false);

          const capturedCommand = overlayTranscriptRef.current;
          handleExecuteVoiceCommand(capturedCommand);

          setTimeout(() => {
            setIsVoiceOverlayOpen(false);
          }, 850);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [voicePref]);

  const handleStartOnboarding = () => {
    setIsStarted(true);
    localStorage.setItem("buddy_app_started", "true");
    SpeechEngine.speak("Starting learning workspace. Please sign in or register to join.", voicePref);
  };

  const handleAuthSuccess = (newToken: string, authenticatedUser: any) => {
    setToken(newToken);
    setUser(authenticatedUser);
    localStorage.setItem("buddy_auth_token", newToken);
    localStorage.setItem("buddy_user_profile", JSON.stringify(authenticatedUser));
    if (authenticatedUser.voiceSettings) {
      setVoicePref(authenticatedUser.voiceSettings);
    }
    setCurrentTab("dashboard");
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("buddy_auth_token");
    localStorage.removeItem("buddy_user_profile");
    SpeechEngine.stop();
    setCurrentTab("dashboard");
  };

  const handleUpdatePreferences = (updated: Partial<VoicePreferences>) => {
    setVoicePref((prev) => {
      const next = { ...prev, ...updated };
      // Sync preferred settings changes to database asynchronously
      if (token) {
        fetch("/api/auth/preferences", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ voiceSettings: next }),
        }).catch((err) => console.error("Could not sync preference settings", err));
      }
      return next;
    });
  };

  // Rendering Routing Manager
  if (!isStarted) {
    return <LandingPage onStart={handleStartOnboarding} voicePref={voicePref} />;
  }

  if (!token) {
    return <AuthPage onSuccess={handleAuthSuccess} voicePref={voicePref} />;
  }

  return (
    <div id="app-root-container" className="min-h-screen bg-[#FFFBF5] text-[#134E4A] flex flex-col md:flex-row transition-all">
      {/* Sidebar navigation left-aligned */}
      <Sidebar
        currentTab={currentTab}
        onChangeTab={setCurrentTab}
        onLogout={handleLogout}
        voicePref={voicePref}
      />

      {/* Main viewport frame */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <Header
          user={user}
          voicePref={voicePref}
          onUpdatePreferences={handleUpdatePreferences}
          onChangeTab={setCurrentTab}
          onAddVoiceLog={handleAddVoiceLog}
          onOpenCheatSheet={() => setShowCheatSheet(true)}
        />

        {/* Content Portal */}
        <main className="flex-1 bg-teal-50/10 p-2 md:p-4 transition-all">
          <div className="animate-fadeIn p-4">
            {currentTab === "dashboard" && (
              <DashboardScreen
                token={token}
                onChangeTab={setCurrentTab}
                voicePref={voicePref}
                user={user}
              />
            )}
            {currentTab === "notes" && (
              <NotesScreen
                token={token}
                voicePref={voicePref}
              />
            )}
            {currentTab === "quiz" && (
              <QuizScreen
                token={token}
                voicePref={voicePref}
              />
            )}
            {currentTab === "tutor" && (
              <TutorScreen
                token={token}
                voicePref={voicePref}
                onAddVoiceLog={handleAddVoiceLog}
              />
            )}
            {currentTab === "visual" && (
              <VisualHelperScreen
                token={token}
                voicePref={voicePref}
              />
            )}
            {currentTab === "accessibility" && (
              <AccessibilityDeskScreen
                token={token}
                voicePref={voicePref}
                onUpdatePreferences={handleUpdatePreferences}
              />
            )}
            {currentTab === "voice-history" && (
              <VoiceHistoryScreen
                voiceLogs={voiceLogs}
                onClearLogs={handleClearVoiceLogs}
                voicePref={voicePref}
              />
            )}
            {currentTab === "profile" && (
              <ProfileScreen
                token={token}
                voicePref={voicePref}
              />
            )}
          </div>
        </main>
      </div>

      {/* Shortcuts Cheat Sheet overlay HUD/modal */}
      {showCheatSheet && (
        <ShortcutCheatSheetModal onClose={() => setShowCheatSheet(false)} />
      )}

      {/* Voice Assistant HUD overlay */}
      <VoiceCommandOverlay
        isOpen={isVoiceOverlayOpen}
        transcript={voiceOverlayTranscript}
        confidence={voiceOverlayConfidence}
        isListening={isVoiceOverlayListening}
        onClose={() => {
          setIsVoiceOverlayOpen(false);
          SpeechEngine.stopListening();
        }}
        onExecuteCommand={handleExecuteVoiceCommand}
        voicePref={voicePref}
      />

      {/* Context-aware micro suggestions corner hint card */}
      <MicroHintOverlay
        currentTab={currentTab}
        voicePref={voicePref}
        onOpenCheatSheet={() => setShowCheatSheet(true)}
      />
    </div>
  );
}
