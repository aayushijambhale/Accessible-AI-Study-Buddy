import React, { useEffect, useState } from "react";
import { BookOpen, Brain, Clock, Award, ChevronRight, HelpCircle, FileText, Sparkles, Trophy, Users, Star, ArrowDownToLine, Zap } from "lucide-react";
import { SpeechEngine } from "../utils/speech";
import { DashboardAnalytics, VoicePreferences, UserProfile } from "../types";
import { jsPDF } from "jspdf";

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

  useEffect(() => {
    // Fetch analytic summaries
    fetch("/api/analytics", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
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
      .then((r) => r.json())
      .then((data) => {
        setLeaderboard(data.slice(0, 10)); // Extract top 10 positions
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
          
          {/* SVG Study Progress Chart */}
          <div 
            className="bg-white p-6 rounded-3xl border border-[#0F766E]/10"
            onMouseEnter={() => handleMouseEnterCard("Weekly study activity chart", "Showing daily study logs recorded on the application.")}
          >
            <h3 className="text-lg font-extrabold text-[#134E4A] mb-1">Study Logs Progress</h3>
            <p className="text-xs text-[#134E4A]/60 mb-6">Daily minutes recorded during summary conversion and quiz exercises</p>
            
            {/* Simple responsive SVG line chart representation of progress */}
            <div className="relative h-64 w-full">
              <svg viewBox="0 0 500 230" className="w-full h-full text-[#14B8A6]">
                {/* Grid Lines */}
                <line x1="40" y1="20" x2="480" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="80" x2="480" y2="80" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="140" x2="480" y2="140" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="40" y1="190" x2="480" y2="190" stroke="#f1f5f9" strokeWidth="2" />

                {/* Data points line map */}
                <path
                  d="M 60 180 L 130 140 L 205 160 L 280 80 L 350 110 L 420 40 L 470 60"
                  fill="none"
                  stroke="#0F766E"
                  strokeWidth="4"
                  strokeLinecap="round"
                />

                {/* Data points circles */}
                <circle cx="60" cy="180" r="5" fill="#14B8A6" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="130" cy="140" r="5" fill="#14B8A6" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="205" cy="160" r="5" fill="#14B8A6" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="280" cy="80" r="5" fill="#14B8A6" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="350" cy="110" r="5" fill="#14B8A6" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="420" cy="40" r="5" fill="#0F766E" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="470" cy="60" r="5" fill="#14B8A6" stroke="#FFFFFF" strokeWidth="2" />

                {/* Labels */}
                <text x="60" y="210" fontSize="10" fill="#134E4A" textAnchor="middle" fontWeight="bold">Mon</text>
                <text x="130" y="210" fontSize="10" fill="#134E4A" textAnchor="middle" fontWeight="bold">Tue</text>
                <text x="205" y="210" fontSize="10" fill="#134E4A" textAnchor="middle" fontWeight="bold">Wed</text>
                <text x="280" y="210" fontSize="10" fill="#134E4A" textAnchor="middle" fontWeight="bold">Thu</text>
                <text x="350" y="210" fontSize="10" fill="#134E4A" textAnchor="middle" fontWeight="bold">Fri</text>
                <text x="420" y="210" fontSize="10" fill="#134E4A" textAnchor="middle" fontWeight="bold">Sat</text>
                <text x="470" y="210" fontSize="10" fill="#134E4A" textAnchor="middle" fontWeight="bold">Sun</text>

                <text x="25" y="25" fontSize="10" fill="#134E4A" textAnchor="end">60m</text>
                <text x="25" y="85" fontSize="10" fill="#134E4A" textAnchor="end">40m</text>
                <text x="25" y="145" fontSize="10" fill="#134E4A" textAnchor="end">20m</text>
                <text x="25" y="195" fontSize="10" fill="#134E4A" textAnchor="end">0m</text>
              </svg>
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

        {/* Right column widget for gamified Hall of Fame: Quiz Leaderboard */}
        <div className="bg-white p-6 rounded-3xl border border-[#0F766E]/10 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-amber-500 animate-pulse" />
              <h3 className="text-lg font-extrabold text-[#134E4A]">Quiz Leaderboard</h3>
            </div>
            <p className="text-xs text-[#134E4A]/60 mb-5 font-semibold">Top student scores in global evaluation metrics</p>

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
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
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
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isCurUser
                          ? "bg-teal-50/70 border-teal-300 shadow-xs"
                          : "border-slate-50 hover:bg-[#FFFBF5]/60 hover:border-teal-500/20"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Rank Circle Medal badge */}
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-black shrink-0 border ${
                          idx === 0 ? "bg-amber-100 text-amber-700 border-amber-300" :
                          idx === 1 ? "bg-slate-100 text-slate-700 border-slate-300" :
                          idx === 2 ? "bg-orange-100 text-orange-700 border-orange-300" :
                          "bg-slate-50 text-slate-500 border-slate-200"
                        }`}>
                          {idx + 1}
                        </div>

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
                          <span className="text-[10px] text-gray-500 font-semibold block">
                            {student.quizzesCount} {student.quizzesCount === 1 ? "quiz" : "quizzes"} completed
                          </span>
                        </div>
                      </div>

                      {/* Average Score Badge */}
                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg text-xs font-black border border-emerald-100">
                          <Star className="w-3 h-3 fill-emerald-500 text-emerald-500 shrink-0" />
                          <span>{student.averageScore}%</span>
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

      </div>

    </div>
  );
}
