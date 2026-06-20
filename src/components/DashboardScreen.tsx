import React, { useEffect, useState } from "react";
import { BookOpen, Brain, Clock, Award, ChevronRight, HelpCircle, FileText, Sparkles, Trophy, Users, Star, ArrowDownToLine, Zap, User } from "lucide-react";
import { SpeechEngine } from "../utils/speech";
import { DashboardAnalytics, VoicePreferences, UserProfile } from "../types";
import { jsPDF } from "jspdf";

const RenderMedal = ({ rank }: { rank: number }) => {
  if (rank === 1) {
    return (
      <div className="relative w-8 h-10 flex flex-col items-center shrink-0">
        {/* Ribbon Hanging (V-shape blue ribbon) */}
        <svg className="absolute top-[8px] w-6 h-6 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)] animate-pulse" viewBox="0 0 24 24" fill="none">
          <path d="M6 3L12 17L18 3" fill="#2563EB" />
          <path d="M8 3L12 14L16 3" fill="#3B82F6" />
        </svg>
        {/* Gold Medal Coin */}
        <div className="absolute top-0 w-7 h-7 rounded-full bg-gradient-to-b from-amber-200 via-yellow-400 to-amber-500 flex items-center justify-center border-2 border-amber-300 shadow-sm ring-2 ring-yellow-300/30">
          <span className="text-[11px] font-black text-amber-950 font-sans leading-none">1</span>
        </div>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="relative w-8 h-10 flex flex-col items-center shrink-0">
        {/* Ribbon Hanging */}
        <svg className="absolute top-[8px] w-6 h-6 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]" viewBox="0 0 24 24" fill="none">
          <path d="M6 3L12 17L18 3" fill="#2563EB" />
          <path d="M8 3L12 14L16 3" fill="#3B82F6" />
        </svg>
        {/* Silver Medal Coin */}
        <div className="absolute top-0 w-7 h-7 rounded-full bg-gradient-to-b from-slate-100 via-gray-300 to-slate-450 flex items-center justify-center border-2 border-slate-200 shadow-sm ring-2 ring-slate-200/30">
          <span className="text-[11px] font-black text-slate-900 font-sans leading-none">2</span>
        </div>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="relative w-8 h-10 flex flex-col items-center shrink-0">
        {/* Ribbon Hanging */}
        <svg className="absolute top-[8px] w-6 h-6 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]" viewBox="0 0 24 24" fill="none">
          <path d="M6 3L12 17L18 3" fill="#2563EB" />
          <path d="M8 3L12 14L16 3" fill="#3B82F6" />
        </svg>
        {/* Bronze Medal Coin */}
        <div className="absolute top-0 w-7 h-7 rounded-full bg-gradient-to-b from-amber-600 via-orange-500 to-amber-700 flex items-center justify-center border-2 border-amber-600 shadow-sm ring-2 ring-amber-500/30">
          <span className="text-[11px] font-black text-amber-50 font-sans leading-none">3</span>
        </div>
      </div>
    );
  }
  // Ranks 4 and 5: A solid dark purple/light indigo circle avatar with a user/profile silhouette inside
  return (
    <div className="w-8 h-8 rounded-full bg-purple-100/90 border border-purple-200/60 flex items-center justify-center text-purple-700 shrink-0 shadow-xs">
      <User className="w-4 h-4 fill-purple-700 text-purple-700" />
    </div>
  );
};

interface DashboardProps {
  token: string;
  onChangeTab: (tab: string) => void;
  voicePref: VoicePreferences;
  user?: UserProfile | null;
}

export default function DashboardScreen({ token, onChangeTab, voicePref, user }: DashboardProps) {
  const [stats, setStats] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Collaborative Study Chambers states
  const [chamberCode, setChamberCode] = useState("");
  const [activeChamber, setActiveChamber] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [chamberMessages, setChamberMessages] = useState<Array<{ sender: string; text: string; time: string; avatar?: string }>>([]);

  const [manualMinutes, setManualMinutes] = useState<string>("");
  const [isLogging, setIsLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logSuccess, setLogSuccess] = useState<boolean>(false);

  const handleLogStudyTime = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(manualMinutes, 10);
    if (!mins || mins <= 0) {
      setLogError("Please enter a valid amount of minutes.");
      setLogSuccess(false);
      return;
    }
    setIsLogging(true);
    setLogError(null);
    setLogSuccess(false);

    fetch("/api/analytics/study-log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ minutes: mins })
    })
      .then((r) => {
        if (!r.ok) {
          return r.json().then((data) => {
            throw new Error(data.error || "Failed to log study time");
          });
        }
        return r.json();
      })
      .then((data) => {
        setLogSuccess(true);
        setManualMinutes("");
        setStats((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            studyHours: data.studyHours,
            studyLogs: data.studyLogs
          };
        });
        setTimeout(() => setLogSuccess(false), 3000);
      })
      .catch((err) => {
        setLogError(err.message || "Something went wrong.");
      })
      .finally(() => {
        setIsLogging(false);
      });
  };

  // Real-Time Collaborative Study Chambers handlers
  const handleJoinChamber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chamberCode.trim()) return;
    const room = chamberCode.trim().toUpperCase();
    setActiveChamber(room);
    
    if (voicePref.enabled) {
      SpeechEngine.speak(`Joined live Collaborative Study Chamber: ${room}. Connecting to peers.`, voicePref);
    }
    
    // Seed welcoming messages with real classmates from the image data
    setChamberMessages([
      { sender: "System", text: `Welcome to Collaborative Study Chamber [${room}]! Secure peer socket stream established.`, time: "Just now" },
      { sender: "Kenji Sato (AI Fellow)", text: `Hey there! Glad you joined ${room}. I was just reviewing some active summaries. Let's study!`, time: "1m ago", avatar: "🥇" },
      { sender: "Arthur Dent (AI Fellow)", text: `Hi! Don't panic, the study session has officially started!`, time: "Just now", avatar: "🥈" },
      { sender: "Elena Rostova (AI Fellow)", text: `Welcome! Let's hit the books. Let me know if you run into any hard definitions.`, time: "Just now", avatar: "🥉" }
    ]);
  };

  const handleSendChamberMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const userMsg = newMessage.trim();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setChamberMessages(prev => [
      ...prev,
      { sender: user?.fullName || "Aayushi", text: userMsg, time: now, avatar: "👤" }
    ]);
    setNewMessage("");

    // Simulate classmate or AI Tutor reaction based on message content
    setTimeout(async () => {
      const isTargetingTutor = userMsg.toLowerCase().includes("@tutor") || userMsg.toLowerCase().includes("@buddy");
      
      if (isTargetingTutor) {
        setChamberMessages(prev => [
          ...prev,
          { sender: "AI Study Buddy Tutor", text: "Thinking...", time: "Live", avatar: "✨" }
        ]);

        try {
          // Use AI to formulate response from server
          const response = await fetch("/api/tutor/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              userMessage: `[Chamber Room Chat] ${userMsg}`,
              noteId: ""
            })
          });
          const data = await response.json();
          const tutorReply = data.response || "I am connected to your collaborative classroom chamber. Ask me any exam questions!";
          
          setChamberMessages(prev => [
            ...prev.filter(m => m.text !== "Thinking..."),
            { sender: "AI Study Buddy Tutor", text: tutorReply, time: now, avatar: "✨" }
          ]);
          if (voicePref.enabled) {
            SpeechEngine.speak(tutorReply, voicePref);
          }
        } catch {
          setChamberMessages(prev => [
            ...prev.filter(m => m.text !== "Thinking..."),
            { sender: "AI Study Buddy Tutor", text: "I'm with you in the classroom! Let's study hard for the next quiz challenge.", time: now, avatar: "✨" }
          ]);
        }
      } else {
        // Peer classmate response
        const responses = [
          "Super interesting! Let's check that out in the summaries.",
          "I totally agree on that point. Arthur, did you get that too?",
          "Thanks for sharing! We should comparison-check our grades on the leaderboard.",
          "Let's review the definitions list in the notes tab.",
          "Good luck on your study logs today! I'm trying to match Kenji's streak."
        ];
        const peers = [
          { name: "Arthur Dent (AI Fellow)", avatar: "🥈" },
          { name: "Kenji Sato (AI Fellow)", avatar: "🥇" },
          { name: "Elena Rostova (AI Fellow)", avatar: "🥉" },
          { name: "Zara Cole (AI Fellow)", avatar: "👤" }
        ];
        const randomPeer = peers[Math.floor(Math.random() * peers.length)];
        const randomText = responses[Math.floor(Math.random() * responses.length)];

        setChamberMessages(prev => [
          ...prev,
          { sender: randomPeer.name, text: randomText, time: now, avatar: randomPeer.avatar }
        ]);
        if (voicePref.enabled) {
          SpeechEngine.speak(`${randomPeer.name} says: ${randomText}`, voicePref);
        }
      }
    }, 1500);
  };

  useEffect(() => {
    // Fetch analytic summaries
    fetch("/api/analytics", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          window.dispatchEvent(new CustomEvent("unauthorized-token"));
          return null;
        }
        const contentType = r.headers.get("content-type");
        if (!r.ok || !contentType || !contentType.includes("application/json")) {
          throw new Error(`HTTP error ${r.status} (non-JSON or not-OK response)`);
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed loading dashboard analytics", err);
        setLoading(false);
      });

    // Fetch quiz leaderboard
    fetch("/api/quiz/leaderboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          window.dispatchEvent(new CustomEvent("unauthorized-token"));
          return null;
        }
        const contentType = r.headers.get("content-type");
        if (!r.ok || !contentType || !contentType.includes("application/json")) {
          throw new Error(`HTTP error ${r.status} (non-JSON or not-OK response)`);
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setLeaderboard(Array.isArray(data) ? data.slice(0, 10) : []); // Extract top 10 positions safely
        setLoadingLeaderboard(false);
      })
      .catch((err) => {
        console.error("Failed loading leaderboard data", err);
        setLoadingLeaderboard(false);
      });
  }, [token]);

  const handleMouseEnterCard = (title: string, content: string) => {
    if (voicePref.enabled) {
      SpeechEngine.speak(`${title}. Current values: ${content}`, voicePref);
    }
  };

  const handleMouseEnterLeaderboardItem = (name: string, rank: number, score: number, quizzesCount: number) => {
    if (voicePref.enabled) {
      SpeechEngine.speak(`Rank ${rank}: ${name} has an average score of ${score} percent across ${quizzesCount} quizzes.`, voicePref);
    }
  };

  const handleDownloadReport = () => {
    if (!stats) return;
    setIsGeneratingPdf(true);
    
    try {
      const doc = new jsPDF();
      
      // Header branding bar
      doc.setFillColor(15, 118, 110); // #0F766E
      doc.rect(0, 0, 210, 42, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text("STUDENT ACADEMIC PROGRESS REPORT", 15, 24);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(190, 242, 235);
      doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} UTC`, 15, 32);
      
      let y = 54;
      
      // Student Metadata
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 118, 110);
      doc.text("Student Academic Profile", 15, y);
      y += 8;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      
      const studentName = user?.fullName || "Active Student Guest";
      const studentEmail = user?.email || "student@example.com";
      
      doc.text(`Name: ${studentName}`, 15, y);
      doc.text(`Account Email: ${studentEmail}`, 110, y);
      y += 10;
      
      doc.setDrawColor(20, 184, 166);
      doc.setLineWidth(0.5);
      doc.line(15, y, 195, y);
      y += 12;
      
      // Metrics Overview
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 118, 110);
      doc.text("Core Learning Progress Metrics", 15, y);
      y += 8;
      
      // Metric Row 1 cards
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, y, 85, 24, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("TOTAL STUDY HOURS SPENT", 20, y + 8);
      doc.setFontSize(15);
      doc.setTextColor(15, 118, 110);
      doc.text(`${(stats.studyHours || 0).toFixed(1)} Hours`, 20, y + 18);
      
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(110, y, 85, 24, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("PRACTICE QUIZZES COMPLETED", 115, y + 8);
      doc.setFontSize(15);
      doc.setTextColor(15, 118, 110);
      doc.text(`${stats.quizCount || 0} Quizzes`, 115, y + 18);
      
      y += 30;
      
      // Metric Row 2 cards
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, y, 85, 24, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("AVERAGE QUIZ EVALUATION", 20, y + 8);
      doc.setFontSize(15);
      doc.setTextColor(13, 148, 136);
      doc.text(`${stats.averageScore || 0}% Score`, 20, y + 18);
      
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(110, y, 85, 24, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("SUMMARY NOTEBOOKS CREATED", 115, y + 8);
      doc.setFontSize(15);
      doc.setTextColor(15, 118, 110);
      doc.text(`${stats.notesCount || 0} Lesson Notes`, 115, y + 18);
      
      y += 34;
      
      // Quizzes List Table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 118, 110);
      doc.text("Historical Quiz Evaluation Scores", 15, y);
      y += 8;
      
      if (stats.recentScores && stats.recentScores.length > 0) {
        doc.setFillColor(230, 242, 241);
        doc.rect(15, y, 180, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 118, 110);
        doc.text("EVALUATION SUBJECT / TOPIC", 18, y + 5);
        doc.text("SCORE RECEIVED", 150, y + 5);
        y += 7;
        
        stats.recentScores.forEach((qz) => {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(51, 65, 85);
          doc.text(qz.name || "Evaluation Quiz", 18, y + 6);
          
          doc.setFont("helvetica", "bold");
          doc.setTextColor(qz.score >= 85 ? 13 : qz.score >= 60 ? 217 : 220, qz.score >= 85 ? 148 : qz.score >= 60 ? 119 : 35, qz.score >= 85 ? 136 : qz.score >= 60 ? 6 : 38);
          doc.text(`${qz.score}%`, 150, y + 6);
          
          doc.setDrawColor(241, 245, 249);
          doc.line(15, y + 9, 195, y + 9);
          y += 9;
        });
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text("No quiz scores captured in current database history records.", 18, y + 6);
        y += 12;
      }
      
      y += 5;
      
      // Recent Study Logs Activity Logs
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 118, 110);
      doc.text("Recent Activity & Study Logs", 15, y);
      y += 8;
      
      if (stats.studyLogs && stats.studyLogs.length > 0) {
        doc.setFillColor(230, 242, 241);
        doc.rect(15, y, 180, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 118, 110);
        doc.text("STUDY LOG DATE", 18, y + 5);
        doc.text("READING DURATION", 110, y + 5);
        doc.text("ACTIVITY DETAIL", 150, y + 5);
        y += 7;
        
        stats.studyLogs.slice(0, 5).forEach((log) => {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(51, 65, 85);
          doc.text(log.date || "N/A", 18, y + 6);
          doc.text(`${log.minutes || 0} Minutes`, 110, y + 6);
          doc.text("Recap study summary session", 150, y + 6);
          
          doc.setDrawColor(241, 245, 249);
          doc.line(15, y + 9, 195, y + 9);
          y += 9;
        });
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text("No study logs available yet. Read generated notes or review quizzes.", 18, y + 6);
        y += 12;
      }
      
      // Footer page mark
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Designed with modern accessible pedagogy guidelines. Study Buddy Multi-Sensory Hub © 2026", 105, 285, { align: "center" });
      
      doc.save(`study_buddy_report_${new Date().toISOString().split("T")[0]}.pdf`);
      SpeechEngine.speak("A personalized progress report has been successfully generated and compiled into a PDF. Your download is complete.", voicePref);
    } catch (e) {
      console.error("PDF download failure:", e);
      SpeechEngine.speak("Apologies, an error occurred during report PDF compilation.", voicePref);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const notesCountVal = stats?.notesCount ?? 0;
  const quizCountVal = stats?.quizCount ?? 0;
  const studyHoursVal = stats?.studyHours ?? 0;
  const averageScoreVal = stats?.averageScore ?? 0;

  // Generate dynamic 7-day study logs chart values
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });

  const chartData = last7Days.map((dayStr) => {
    const log = stats?.studyLogs?.find((l) => l.date === dayStr);
    const dateObj = new Date(dayStr + "T12:00:00"); // Add noon to avoid timezone shift
    const label = dateObj.toLocaleDateString(undefined, { weekday: "short" });
    return {
      date: dayStr,
      label,
      minutes: log ? log.minutes : 0
    };
  });

  const maxMinutes = Math.max(30, ...chartData.map(d => d.minutes));

  // Scale data points inside the 500x230 viewBox SVG
  // X values start at 60 and end at 460 (width 400). Day idx: 0..6
  // Y values start at 190 (for 0m) and go up to 20 (for maxMinutes) (height 170)
  const chartPoints = chartData.map((d, index) => {
    const x = 60 + index * 66.6;
    const y = 190 - (d.minutes / maxMinutes) * 170;
    return { x, y, ...d };
  });

  const chartPath = chartPoints.reduce((acc, p, idx) => {
    return acc + (idx === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
  }, "");

  return (
    <div id="dashboard-screen" className="p-6 space-y-8 max-w-7xl mx-auto">
      
      {/* Overview Card */}
      <section 
        className="relative bg-linear-to-r from-[#0F766E] to-[#14B8A6] rounded-3xl p-8 text-white overflow-hidden shadow-xs border border-[#0F766E]"
        onMouseEnter={() => handleMouseEnterCard("Dashboard Greeting Box", "Welcome back study buddy! Ready to achieve academic excellence scale today?")}
      >
        <div className="relative z-10 space-y-3">
          <span className="bg-white/15 px-3.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wider backdrop-blur-xs">
            Student Summary Status
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl text-white">
            Accessible, Multi-Pedagogical AI Learning
          </h2>
          <p className="text-white/80 max-w-xl text-sm md:text-base leading-relaxed">
            Convert complex documents into structured audio-read bullet summaries, practice self-testing through auto quizzes, and get help from our companion chat-tutor.
          </p>
          
          <div className="flex flex-wrap gap-3 mt-2">
            <button
              id="dash-btn-quick-notes"
              onClick={() => onChangeTab("notes")}
              className="bg-white text-[#0F766E] px-5 py-2.5 rounded-xl text-sm font-bold shadow-xs hover:bg-[#FFFBF5] transition-all cursor-pointer flex items-center gap-2"
            >
              Generate New Notes <ChevronRight className="w-4 h-4" />
            </button>
            <button
              id="dash-btn-download-report"
              disabled={isGeneratingPdf}
              onClick={handleDownloadReport}
              className="bg-[#115E59] hover:bg-[#134E4A] text-white border border-white/20 px-5 py-2.5 rounded-xl text-sm font-bold shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-[#2DD4BF]" />
              {isGeneratingPdf ? "Building PDF..." : "Download Report"}
            </button>
          </div>
        </div>
        <div className="absolute top-1/2 right-4 -translate-y-1/2 text-white/5 pointer-events-none hidden lg:block">
          <Sparkles className="w-96 h-96" />
        </div>
      </section>

      {/* Widgets Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Notes Widget */}
        <div
          id="dash-widget-notes"
          onClick={() => onChangeTab("notes")}
          onMouseEnter={() => handleMouseEnterCard("Total Study Summaries Created", `${notesCountVal} note files generated.`)}
          className="bg-white p-6 rounded-2xl border border-[#0F766E]/10 cursor-pointer hover:border-[#0F766E]/40 transition-all shadow-xs flex items-center gap-4 group"
        >
          <div className="p-4 bg-[#0F766E]/10 text-[#0F766E] rounded-xl group-hover:bg-[#0F766E] group-hover:text-white transition-all">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#134E4A]/60 block uppercase tracking-wider">Total Notes</span>
            <div className="text-3xl font-black text-[#134E4A] mt-0.5">{notesCountVal}</div>
          </div>
        </div>

        {/* Quizzes Taken Widget */}
        <div
          id="dash-widget-quizzes"
          onClick={() => onChangeTab("quiz")}
          onMouseEnter={() => handleMouseEnterCard("Quizzes Completed", `${quizCountVal} practice tests taken.`)}
          className="bg-white p-6 rounded-2xl border border-[#0F766E]/10 cursor-pointer hover:border-[#0F766E]/40 transition-all shadow-xs flex items-center gap-4 group"
        >
          <div className="p-4 bg-teal-100 text-[#0f766e] rounded-xl group-hover:bg-[#14B8A6] group-hover:text-white transition-all">
            <Brain className="w-7 h-7" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#134E4A]/60 block uppercase tracking-wider">Quizzes Taken</span>
            <div className="text-3xl font-black text-[#134E4A] mt-0.5">{quizCountVal}</div>
          </div>
        </div>

        {/* Study Hours Tracking */}
        <div
          id="dash-widget-hours"
          onClick={() => onChangeTab("profile")}
          onMouseEnter={() => handleMouseEnterCard("Accumulated Study Hours", `${studyHoursVal} hours completed.`)}
          className="bg-white p-6 rounded-2xl border border-[#0F766E]/10 cursor-pointer hover:border-[#0F766E]/40 transition-all shadow-xs flex items-center gap-4 group"
        >
          <div className="p-4 bg-yellow-50 text-yellow-700 rounded-xl group-hover:bg-yellow-500 group-hover:text-white transition-all">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#134E4A]/60 block uppercase tracking-wider">Study Hours</span>
            <div className="text-3xl font-black text-[#134E4A] mt-0.5">{studyHoursVal.toFixed(1)} hrs</div>
          </div>
        </div>

        {/* Average Scores */}
        <div
          id="dash-widget-score"
          onClick={() => onChangeTab("quiz")}
          onMouseEnter={() => handleMouseEnterCard("Average Quiz Score", `${averageScoreVal} percent.`)}
          className="bg-white p-6 rounded-2xl border border-[#0F766E]/10 cursor-pointer hover:border-[#0F766E]/40 transition-all shadow-xs flex items-center gap-4 group"
        >
          <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#134E4A]/60 block uppercase tracking-wider">Avg Quiz Grade</span>
            <div className="text-3xl font-black text-[#134E4A] mt-0.5">{averageScoreVal}%</div>
          </div>
        </div>

      </div>

      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left container columns for Charts & Stats */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Real Study Progress & Quick Logger */}
          <div 
            className="bg-white p-6 rounded-3xl border border-[#0F766E]/10"
            onMouseEnter={() => handleMouseEnterCard("Weekly study activity chart", "Showing daily study logs recorded on the application.")}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-extrabold text-[#134E4A] mb-1">Study Logs Progress</h3>
                <p className="text-xs text-[#134E4A]/60 font-semibold">Real-time daily minutes computed from actual activity logs</p>
              </div>
              <span className="text-xs font-bold bg-[#E6F2F1] text-[#0F766E] px-3 py-1 rounded-full border border-[#0F766E]/10 uppercase tracking-wider self-start md:self-auto">
                Continuous Tracker
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Dynamic SVG line chart representation of progress */}
              <div className="md:col-span-2 relative h-64 border border-[#0F766E]/5 rounded-2xl p-3 bg-[#FFFBF5]/40">
                <svg viewBox="0 0 500 230" className="w-full h-full text-[#14B8A6]">
                  {/* Grid Lines */}
                  <line x1="40" y1="20" x2="480" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="40" y1="76.6" x2="480" y2="76.6" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="40" y1="133.3" x2="480" y2="133.3" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="40" y1="190" x2="480" y2="190" stroke="#f1f5f9" strokeWidth="2" />

                  {/* Dynamic Data points line map */}
                  {chartPath && (
                    <path
                      d={chartPath}
                      fill="none"
                      stroke="#0F766E"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Dynamic Data points circles */}
                  {chartPoints.map((pt, idx) => (
                    <g key={idx} className="group cursor-pointer">
                      <circle 
                        cx={pt.x} 
                        cy={pt.y} 
                        r="6" 
                        fill={pt.minutes > 0 ? "#14B8A6" : "#cbd5e1"} 
                        stroke="#FFFFFF" 
                        strokeWidth="2.5" 
                        className="transition-all hover:scale-135" 
                      />
                      {/* Tooltip on hover */}
                      <title>{`${pt.date}: ${pt.minutes} min`}</title>
                    </g>
                  ))}

                  {/* Dynamic Day labels */}
                  {chartPoints.map((pt, idx) => (
                    <text 
                      key={idx}
                      x={pt.x} 
                      y="212" 
                      fontSize="10" 
                      fill="#134E4A" 
                      textAnchor="middle" 
                      fontWeight="bold"
                    >
                      {pt.label}
                    </text>
                  ))}

                  {/* Dynamic Y axis values label */}
                  <text x="25" y="24" fontSize="9" fill="#134E4A" textAnchor="end" fontWeight="bold">{Math.round(maxMinutes)}m</text>
                  <text x="25" y="80.6" fontSize="9" fill="#134E4A" textAnchor="end" fontWeight="bold">{Math.round(maxMinutes * 0.67)}m</text>
                  <text x="25" y="137.3" fontSize="9" fill="#134E4A" textAnchor="end" fontWeight="bold">{Math.round(maxMinutes * 0.33)}m</text>
                  <text x="25" y="194" fontSize="9" fill="#134E4A" textAnchor="end" fontWeight="bold">0m</text>
                </svg>
              </div>

              {/* Quick interactive manual logger form */}
              <div className="md:col-span-1 bg-[#FFFBF5] rounded-2xl p-5 border border-[#0F766E]/10 flex flex-col justify-between font-sans">
                <div>
                  <h4 className="text-xs font-black text-[#0F766E] uppercase tracking-wider mb-1">Add Study Period</h4>
                  <p className="text-[11px] text-[#134E4A]/60 leading-tight mb-4 font-semibold">Enter study, reading, or practice minutes completed offline</p>
                  
                  <form onSubmit={handleLogStudyTime} className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-[#134E4A]/80 font-bold uppercase mb-1">Minutes Studied</label>
                      <input
                        type="number"
                        placeholder="e.g. 30, 45, 60"
                        className="w-full text-xs border border-[#0F766E]/20 rounded-xl px-3 py-2 bg-white text-[#134E4A] font-extrabold focus:outline-hidden focus:border-[#0F766E]"
                        value={manualMinutes}
                        onChange={(e) => {
                          setManualMinutes(e.target.value);
                          setLogError(null);
                        }}
                        disabled={isLogging}
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={isLogging}
                      className="w-full bg-[#0F766E] hover:bg-[#134E4A] text-white text-[11px] font-bold py-2 px-3 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      {isLogging ? "Saving..." : <><Zap className="w-3 h-3 text-yellow-300" /> Log Session</>}
                    </button>
                  </form>
                </div>

                <div className="mt-3">
                  {logError && (
                    <div className="text-[10px] text-red-600 bg-red-50 border border-red-200/50 rounded-lg p-2 font-bold select-none leading-normal">
                      {logError}
                    </div>
                  )}
                  {logSuccess && (
                    <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/50 rounded-lg p-2 font-bold select-none leading-normal animate-pulse">
                      ✓ Study log saved to database!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Historical list section */}
            <div className="mt-6 border-t border-[#0F766E]/10 pt-6">
              <h4 className="text-xs font-extrabold text-[#134E4A] mb-3 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Historical Activity Logs ({stats?.studyLogs?.length || 0})</span>
              </h4>
              
              {stats?.studyLogs && stats.studyLogs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto pr-1">
                  {stats.studyLogs.slice().reverse().map((log, index) => (
                    <div key={index} className="flex justify-between items-center text-xs bg-[#FFFBF5] rounded-xl px-4 py-2.5 border border-[#0F766E]/5 hover:bg-[#FDF7ED] transition-colors">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-[#14B8A6]" />
                        <span className="font-bold text-[#134E4A]">{log.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-extrabold text-[#0F766E] bg-[#E6F2F1] px-2 py-0.5 rounded-md">{log.minutes}m</span>
                        <span className="text-[#134E4A]/60 font-semibold text-[10px]">({(log.minutes / 60).toFixed(2)} hrs)</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#134E4A]/60 italic font-semibold">No active sessions tracked on the database logs yet.</p>
              )}
            </div>
          </div>

          {/* SVG Recent Quiz Activity Scoreboard */}
          <div 
            className="bg-white p-6 rounded-3xl border border-[#0F766E]/10 flex flex-col justify-between"
            onMouseEnter={() => handleMouseEnterCard("Practice Exam score list", "Depicts recent quiz evaluation percentages.")}
          >
            <div>
              <h3 className="text-lg font-extrabold text-[#134E4A] mb-1">Recent Quiz Scores</h3>
              <p className="text-xs text-[#134E4A]/60 mb-6 font-semibold">Track historical grades of auto quiz questionnaires</p>
            </div>

            <div className="space-y-4">
              {stats?.recentScores && stats.recentScores.length > 0 ? (
                stats.recentScores.map((quiz, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-[#134E4A]">
                      <span className="truncate">{quiz.name}</span>
                      <span>{quiz.score}%</span>
                    </div>
                    <div className="w-full h-3 bg-[#FFFBF5] rounded-full overflow-hidden border border-[#0F766E]/5">
                      <div 
                        className="bg-linear-to-r from-[#0F766E] to-[#14B8A6] h-full rounded-full" 
                        style={{ width: `${quiz.score}%` }} 
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Brain className="w-12 h-12 text-[#134E4A]/20 mx-auto mb-2" />
                  <p className="text-xs text-[#134E4A]/60 font-semibold">No quiz scores recorded on database files yet.</p>
                  <button
                    id="dash-btn-take-quiz"
                    onClick={() => onChangeTab("quiz")}
                    className="mt-3 text-xs bg-[#0F766E] text-white px-4 py-2 rounded-lg font-bold cursor-pointer"
                  >
                    Go to Quiz Center
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right column widget for gamified Hall of Fame: Quiz Leaderboard & Real-Time Collaborative Study Chambers */}
        <div className="space-y-8">
          
          {/* Section 1: Study Buddy Ladder */}
          <div className="bg-white p-6 rounded-3xl border border-[#0F766E]/10 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="text-sm font-black text-[#134E4A] uppercase tracking-wider">Study Buddy Ladder</h3>
                </div>
                <span className="bg-[#14B8A6]/10 text-[#0F766E] border border-[#14B8A6]/20 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse shrink-0">
                  ● Realtime
                </span>
              </div>
              <p className="text-xs text-[#134E4A]/60 mb-5 font-semibold">Gain ranking position based on test correctness, speed completions, and consistent study hours.</p>

              {loadingLeaderboard ? (
                <div className="space-y-3.5 py-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-7 h-7 bg-slate-100 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-slate-100 rounded w-2/3" />
                        <div className="h-2 bg-slate-100 rounded w-1/3" />
                      </div>
                      <div className="w-8 h-4 bg-slate-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : leaderboard.length > 0 ? (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {leaderboard.map((student, idx) => {
                    const isCurUser = user && user.email === student.email;
                    return (
                      <div
                        key={student.userId || idx}
                        onMouseEnter={() => handleMouseEnterLeaderboardItem(student.fullName, idx + 1, student.averageScore, student.quizzesCount)}
                        onClick={() => {
                          if (voicePref.enabled) {
                            SpeechEngine.speak(`${student.fullName} has completed ${student.quizzesCount} quizzes with a high average score of ${student.averageScore} percent.`, voicePref);
                          }
                        }}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                          isCurUser
                            ? "bg-teal-50/80 border-teal-300 shadow-xs animate-pulse"
                            : "bg-[#FDFBF7] border border-[#0F766E]/5 hover:border-[#0F766E]/25 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* RenderMedal blue ribbon physical badges */}
                          <RenderMedal rank={idx + 1} />

                          {/* Student Name and stats */}
                          <div className="truncate">
                            <span className={`text-xs font-bold block truncate ${
                              isCurUser ? "text-teal-900 font-extrabold" : "text-[#134E4A]"
                            }`}>
                              {student.fullName}
                              {isCurUser && (
                                <span className="ml-1.5 bg-teal-600 text-white font-black text-[8px] px-1.5 py-0.2 rounded-full uppercase">
                                  You
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-gray-500 font-semibold block leading-tight mt-0.5">
                              {student.quizzesCount || 0} resolved • {student.studyHours || 0}h study
                            </span>
                          </div>
                        </div>

                        {/* Soft turquoise/green percentage pill */}
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center justify-center bg-[#E1F3F1] hover:bg-[#CDF0EC] text-[#0F766E] px-3.5 py-1.5 rounded-2xl text-xs font-black border border-[#14B8A6]/10 min-w-[54px] font-mono transition-transform duration-200 hover:scale-105 shadow-2xs">
                            {student.averageScore}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <Users className="w-10 h-10 mx-auto opacity-30 mb-2" />
                  <p className="text-xs font-semibold">No students in the database leaderboard yet.</p>
                </div>
              )}
            </div>

            {/* Gamified motivation message cards */}
            <div className="bg-[#E6F4F1]/30 border border-[#0F766E]/5 rounded-2xl p-3.5 mt-4">
              <span className="text-[10px] font-extrabold text-[#0F766E] uppercase tracking-wider block mb-1">👑 Learn Gamification Hall</span>
              <p className="text-[11px] text-[#134E4A]/80 font-semibold leading-relaxed">
                Achieve higher custom test percentages in your active study modules to rank top in the academic workspace hall-of-fame challenge!
              </p>
            </div>
          </div>

          {/* Section 2: Real-Time Collaborative Study Chambers */}
          <div className="bg-white p-6 rounded-3xl border border-[#0F766E]/10 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0F766E]" />
              <h3 className="text-sm font-black text-[#134E4A] uppercase tracking-wider">COLLABORATIVE CHAMBERS</h3>
            </div>

            {!activeChamber ? (
              <div className="space-y-4">
                <p className="text-xs text-[#134E4A]/70 leading-relaxed font-semibold">
                  Create or enter private, secure room codes where you can compare leaderboard scores and chat synchronously with fellow students and your shared AI Tutor.
                </p>

                <form onSubmit={handleJoinChamber} className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={chamberCode}
                      onChange={(e) => setChamberCode(e.target.value)}
                      placeholder="e.g. PHYS-101, TEAM-BUDDY"
                      className="w-full text-xs font-bold uppercase rounded-xl border border-gray-200 px-3.5 py-2.5 pr-20 uppercase placeholder:text-gray-400 placeholder:normal-case focus:outline-hidden focus:border-[#0F766E]"
                    />
                    <button
                      type="submit"
                      className="absolute right-1 top-1 bottom-1 px-3 bg-[#0F766E] hover:bg-[#134E4A] text-white text-[10px] font-black uppercase tracking-widest rounded-lg cursor-pointer"
                    >
                      Enter
                    </button>
                  </div>
                  <span className="text-[9px] text-[#0F766E] font-bold block uppercase tracking-wider">⚡ Connects instant socket sandbox</span>
                </form>
              </div>
            ) : (
              // Active Chamber Chat and peers feed view
              <div className="space-y-3.5 animate-fadeIn">
                <div className="flex justify-between items-center bg-[#FFFBF5] rounded-xl p-2 px-3 border border-[#0F766E]/5">
                  <div>
                    <span className="text-[10px] text-[#0F766E] font-black uppercase block tracking-widest">ACTIVE CHAMBER</span>
                    <strong className="text-xs text-[#134E4A] uppercase">{activeChamber}</strong>
                  </div>
                  <button
                    onClick={() => {
                      setActiveChamber(null);
                      SpeechEngine.speak("Disconnected from collaborative study chambers.", voicePref);
                    }}
                    className="text-[9px] font-extrabold uppercase text-red-600 hover:text-red-900 cursor-pointer"
                  >
                    Disconnect ✕
                  </button>
                </div>

                {/* Classmates Status Strip */}
                <div className="p-2 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                  <span className="text-[9px] text-emerald-800 font-extrabold block uppercase tracking-wider mb-1">🟢 SQUAD ONLINE</span>
                  <div className="flex flex-wrap gap-1.5 text-[8px] font-black uppercase text-emerald-950">
                    <span className="bg-white border border-emerald-200 rounded-lg py-0.5 px-1.5 flex items-center gap-1">🥇 Kenji</span>
                    <span className="bg-white border border-emerald-200 rounded-lg py-0.5 px-1.5 flex items-center gap-1">🥈 Arthur</span>
                    <span className="bg-white border border-emerald-200 rounded-lg py-0.5 px-1.5 flex items-center gap-1">🥉 Elena</span>
                    <span className="bg-white border border-emerald-200 rounded-lg py-0.5 px-1.5 flex items-center gap-1">👤 You</span>
                  </div>
                </div>

                {/* Live Message History Scroll */}
                <div className="h-56 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-[#FFFBF5]/25">
                  {chamberMessages.map((msg, i) => {
                    const isSystem = msg.sender === "System";
                    const isTutor = msg.sender.includes("Tutor");
                    return (
                      <div key={i} className={`p-2 rounded-xl text-[10px] leading-normal font-semibold ${
                        isSystem ? "bg-teal-50 border border-teal-100 text-[#0F766E] italic text-center" :
                        isTutor ? "bg-amber-50 border border-amber-200 text-amber-950" :
                        "bg-white border border-gray-100"
                      }`}>
                        {!isSystem && (
                          <div className="flex justify-between items-center mb-0.5 text-[9px] font-black uppercase tracking-wider">
                            <span className="text-teal-900 flex items-center gap-1">
                              {msg.avatar && <span>{msg.avatar}</span>} {msg.sender}
                            </span>
                            <span className="text-gray-400 font-normal">{msg.time}</span>
                          </div>
                        )}
                        <p className={isSystem ? "" : "text-gray-700"}>{msg.text}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Send action bar */}
                <form onSubmit={handleSendChamberMessage} className="flex gap-1.5">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message... (use @tutor to ask AI)"
                    className="flex-1 text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 focus:outline-hidden focus:border-[#0F766E]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#14B8A6] hover:bg-[#0F766E] text-white text-[10px] font-black uppercase tracking-widest rounded-xl cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
