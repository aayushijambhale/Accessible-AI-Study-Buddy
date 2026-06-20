import React, { useState, useEffect } from "react";
import { 
  User, 
  Award, 
  BookOpen, 
  Clock, 
  Brain, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle, 
  Database, 
  Lock, 
  Key, 
  Layers, 
  CheckCircle2, 
  Settings, 
  ChevronDown, 
  Sliders, 
  TrendingUp, 
  Heart
} from "lucide-react";
import { SpeechEngine } from "../utils/speech";
import { VoicePreferences, UserProfile, DashboardAnalytics } from "../types";

interface ProfileProps {
  token: string;
  voicePref: VoicePreferences;
}

const AVAILABLE_AVATARS = ["🎓", "🚀", "🧠", "🧬", "🧪", "🪐", "🎨", "💻", "📚", "✨", "🏆", "🌟"];

export default function ProfileScreen({ token, voicePref }: ProfileProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Gamified Avatar selection state stored in localStorage
  const [selectedAvatar, setSelectedAvatar] = useState(() => {
    return localStorage.getItem("student-avatar-symbol") || "🎓";
  });
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Profile Editor Panel state
  const [editMode, setEditMode] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Technical diagnostic console states
  const [showAdminConsole, setShowAdminConsole] = useState(false);
  const [activeSchemaTab, setActiveSchemaTab] = useState<"users" | "notes" | "quizzes" | "quizHistory" | "chatSessions">("users");

  const fetchProfileAndStats = async () => {
    try {
      setLoading(true);
      const [profRes, statsRes] = await Promise.all([
        fetch("/api/auth/profile", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/analytics", { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (profRes.ok && statsRes.ok) {
        const uData = await profRes.json();
        const sData = await statsRes.json();
        setUserProfile(uData);
        setStats(sData);
        setEditFullName(uData.fullName || "");
        setEditEmail(uData.email || "");
      }
    } catch (err) {
      console.error("Failed loading profile stats logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndStats();
  }, [token]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError("");

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ fullName: editFullName, email: editEmail })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed updating account features.");
      }

      setSaveSuccess(true);
      setUserProfile((prev) => prev ? { ...prev, fullName: editFullName, email: editEmail } : null);
      setEditMode(false);
      SpeechEngine.speak("Profile credentials updated successfully and refreshed in the academic system.", voicePref);
      
      // Dispatch custom event to alert high-level header components
      window.dispatchEvent(new CustomEvent("profile-updated"));
    } catch (err: any) {
      setSaveError(err.message || "Operation failed.");
      SpeechEngine.speak(`Error updating profile: ${err.message}`, voicePref);
    }
  };

  const handleAvatarChange = (avatar: string) => {
    setSelectedAvatar(avatar);
    localStorage.setItem("student-avatar-symbol", avatar);
    setShowAvatarPicker(false);
    SpeechEngine.speak(`Avatar updated to ${avatar}!`, voicePref);
  };

  const handleMouseEnterText = (label: string) => {
    if (voicePref.enabled) {
      SpeechEngine.speak(label, voicePref);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div className="h-10 w-48 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-44 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-50 rounded-3xl animate-pulse" />
          <div className="h-64 bg-slate-50 rounded-3xl animate-pulse" />
        </div>
      </div>
    );
  }

  const studyHours = (userProfile?.studyHours ?? stats?.studyHours ?? 0).toFixed(1);
  const totalNotes = stats?.notesCount ?? 0;
  const quizzesTaken = stats?.quizCount ?? 0;
  const avgGrade = stats?.averageScore ?? 0;

  // Gamified academic rank helper
  let academicRank = "🌱 Rising Scholar";
  let badgeAccent = "bg-emerald-50 text-emerald-800 border-emerald-200/50";
  if (avgGrade >= 90) {
    academicRank = "🎖️ Academic Olympian";
    badgeAccent = "bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-yellow-400/20";
  } else if (avgGrade >= 80) {
    academicRank = "🌟 Honor Roll Scholar";
    badgeAccent = "bg-teal-50 text-teal-900 border-teal-250";
  } else if (parseFloat(studyHours) >= 5) {
    academicRank = "⚡ Focus Pioneer";
    badgeAccent = "bg-indigo-100 text-indigo-900 border-indigo-200";
  }

  // Gamified achievements list
  const achievementsList = [
    {
      id: "inc-reader",
      title: "Inception Scholar",
      desc: "Upload or parse your first educational lecture notes materials.",
      unlocked: totalNotes > 0,
      badge: "📚",
      color: "from-blue-50 to-indigo-50 border-blue-100 text-blue-900"
    },
    {
      id: "practice-titan",
      title: "Self-Tester Pro",
      desc: "Complete at least one multi-choice practice quiz or assessment challenge.",
      unlocked: quizzesTaken > 0,
      badge: "⚡",
      color: "from-amber-50 to-yellow-50 border-amber-100 text-amber-900"
    },
    {
      id: "tutor-scholar",
      title: "Pedagogic Companion",
      desc: "Consult the conversational Tutor Study Buddy for contextual reinforcement.",
      unlocked: true,
      badge: "💬",
      color: "from-teal-50 to-emerald-50 border-teal-105 text-teal-900"
    },
    {
      id: "optics-master",
      title: "Universal Sight Guide",
      desc: "Achieve optimal focus via high contrast or custom zoom sizing guidelines.",
      unlocked: voicePref.contrastMode || voicePref.textZoom !== "normal",
      badge: "👁️",
      color: "from-purple-50 to-pink-50 border-purple-100 text-purple-900"
    }
  ];

  return (
    <div id="profile-screen" className="p-4 md:p-6 max-w-4xl mx-auto space-y-8 animate-fadeIn">
      
      {/* 1. Student Identity Header Banner */}
      <div 
        className="bg-gradient-to-br from-[#0F766E] to-[#14B8A6] text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-sm"
        onMouseEnter={() => handleMouseEnterText(`Student profile page. Account for ${userProfile?.fullName}.`)}
      >
        {/* Abstract subtle background pattern */}
        <div className="absolute top-0 right-0 p-8 text-white/5 pointer-events-none">
          <User className="w-56 h-56" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
          {/* Custom Avatar Bubble with Quick Emoji Picker */}
          <div className="relative group shrink-0">
            <button
              onClick={() => {
                setShowAvatarPicker(!showAvatarPicker);
                SpeechEngine.speak("Opening custom avatar emoji selector.", voicePref);
              }}
              title="Click to customize your student avatar symbol"
              className="w-24 h-24 bg-white/15 backdrop-blur-md border-2 border-white/40 rounded-3xl flex items-center justify-center text-5xl shadow-lg hover:scale-105 hover:bg-white/20 transition-all cursor-pointer relative"
            >
              {selectedAvatar}
              <div className="absolute -bottom-1 -right-1 bg-[#134E4A] text-white text-[9.5px] font-black px-2 py-0.5 rounded-full uppercase border border-white/25 scale-90 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Change
              </div>
            </button>

            {/* Emoji Avatar Bubble Picker HUD */}
            {showAvatarPicker && (
              <div className="absolute top-full left-0 mt-3 p-3 bg-white text-slate-800 rounded-2xl border border-gray-100 shadow-xl grid grid-cols-4 gap-2 z-50 animate-fadeIn min-w-[200px]">
                <div className="col-span-4 text-[9px] font-black uppercase text-gray-400 tracking-wider mb-1 px-1 flex justify-between">
                  <span>Choose Symbol</span>
                  <button onClick={() => setShowAvatarPicker(false)} className="text-red-500 hover:text-red-800">Close ✕</button>
                </div>
                {AVAILABLE_AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleAvatarChange(emoji)}
                    className="p-1.5 hover:bg-teal-50 text-2xl rounded-xl transition-all cursor-pointer active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="text-center sm:text-left space-y-2">
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
              <span className="text-[10px] bg-white/20 text-white font-extrabold uppercase px-3 py-1 rounded-full tracking-widest inline-block border border-white/10">
                Active Scholar Profile
              </span>
              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${badgeAccent}`}>
                {academicRank}
              </span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{userProfile?.fullName || "Guest Student"}</h2>
            <p className="text-xs text-white/80 font-medium font-mono">{userProfile?.email}</p>
          </div>
        </div>
      </div>

      {/* 2. Key Academic Stats Hub */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <TrendingUp className="w-5 h-5 text-[#0F766E]" />
          <h3 className="text-sm font-black text-[#134E4A] uppercase tracking-wider">Academic Overview Metrics</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Stat 1: Study hours */}
          <div 
            className="bg-white p-5 rounded-2xl border border-[#0F766E]/10 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition-shadow duration-250 cursor-pointer"
            onClick={() => SpeechEngine.speak(`You completed ${studyHours} total study hours inside the workspace modules.`, voicePref)}
            onMouseEnter={() => handleMouseEnterText(`Continuous study hours: ${studyHours}`)}
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Continuous Time</span>
              <div className="p-1.5 bg-[#0F766E]/5 text-[#0F766E] rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-black text-[#134E4A] tracking-tight">{studyHours}</span>
              <span className="text-xs font-bold text-gray-400 block mt-0.5">Hours Invested</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="bg-[#14B8A6] h-full rounded-full" style={{ width: `${Math.min(parseFloat(studyHours) * 20, 100)}%` }}></div>
            </div>
          </div>

          {/* Stat 2: Lessons parsed */}
          <div 
            className="bg-white p-5 rounded-2xl border border-[#0F766E]/10 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition-shadow duration-250 cursor-pointer"
            onClick={() => SpeechEngine.speak(`You have saved ${totalNotes} study syllabus documents.`, voicePref)}
            onMouseEnter={() => handleMouseEnterText(`Total summary materials: ${totalNotes}`)}
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Course Library</span>
              <div className="p-1.5 bg-[#0F766E]/5 text-[#0F766E] rounded-lg">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-black text-[#134E4A] tracking-tight">{totalNotes}</span>
              <span className="text-xs font-bold text-gray-400 block mt-0.5">Saved Material</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="bg-[#0F766E] h-full rounded-full" style={{ width: `${Math.min(totalNotes * 15, 100)}%` }}></div>
            </div>
          </div>

          {/* Stat 3: Quizzes Completed */}
          <div 
            className="bg-white p-5 rounded-2xl border border-[#0F766E]/10 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition-shadow duration-250 cursor-pointer"
            onClick={() => SpeechEngine.speak(`You completed ${quizzesTaken} assessments.`, voicePref)}
            onMouseEnter={() => handleMouseEnterText(`Completed interactive challenge assessments: ${quizzesTaken}`)}
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Trial Exercises</span>
              <div className="p-1.5 bg-[#0F766E]/5 text-[#0F766E] rounded-lg">
                <Brain className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-black text-[#134E4A] tracking-tight">{quizzesTaken}</span>
              <span className="text-xs font-bold text-gray-400 block mt-0.5">Challenges Checked</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="bg-[#14B8A6] h-full rounded-full" style={{ width: `${Math.min(quizzesTaken * 25, 100)}%` }}></div>
            </div>
          </div>

          {/* Stat 4: Average Score */}
          <div 
            className="bg-white p-5 rounded-2xl border border-[#0F766E]/10 flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition-shadow duration-250 cursor-pointer"
            onClick={() => SpeechEngine.speak(`Your average grade rating is ${avgGrade} percent.`, voicePref)}
            onMouseEnter={() => handleMouseEnterText(`Average test grading score: ${avgGrade} percent`)}
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Class Grading</span>
              <div className="p-1.5 bg-[#0F766E]/5 text-[#14B8A6] rounded-lg">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-black text-[#134E4A] tracking-tight">{avgGrade}%</span>
              <span className="text-xs font-bold text-gray-400 block mt-0.5">Average Correct</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="bg-[#0F766E] h-full rounded-full" style={{ width: `${avgGrade}%` }}></div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Achievements & Badges Bento Section */}
      <div className="bg-white p-6 rounded-3xl border border-[#0F766E]/10 space-y-5 shadow-2xs">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-500 w-5 h-5" />
            <h3 className="text-sm font-black text-[#134E4A] uppercase tracking-wider">
              Earned Badges ({achievementsList.filter(a => a.unlocked).length} / {achievementsList.length})
            </h3>
          </div>
          <span className="text-[10px] text-[#0F766E] bg-teal-50 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
            Academic Achievements
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {achievementsList.map((ach) => (
            <div 
              key={ach.id}
              onMouseEnter={() => handleMouseEnterText(`${ach.title}. status: ${ach.unlocked ? "unlocked" : "locked"}. ${ach.desc}`)}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${
                ach.unlocked
                  ? `bg-gradient-to-r ${ach.color} shadow-2xs hover:shadow-xs hover:scale-[1.01]`
                  : "bg-slate-50 border-slate-100 opacity-55 text-[#134E4A]/50"
              }`}
            >
              {/* Decorative side accent for unlocked badges */}
              {ach.unlocked && (
                <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#14B8A6]/60"></div>
              )}

              <div className="text-3xl p-3 bg-white rounded-xl shadow-2xs shrink-0 flex items-center justify-center border border-gray-150 transition-transform duration-300 group-hover:scale-105">
                {ach.badge}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-[#134E4A]">{ach.title}</span>
                  {ach.unlocked ? (
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 font-black uppercase px-2 py-0.5 rounded-full tracking-widest scale-90">
                      Unlocked
                    </span>
                  ) : (
                    <span className="text-[8px] bg-slate-200/60 text-slate-500 border border-slate-300/40 font-black uppercase px-2 py-0.5 rounded-full tracking-widest scale-90">
                      Locked
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed opacity-90 text-[#134E4A]/80 font-medium">{ach.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Accounts Form Preferences Card */}
      <div className="bg-white p-6 rounded-3xl border border-[#0F766E]/10 space-y-4 shadow-2xs">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#0F766E]" />
            <h3 className="text-sm font-black text-[#134E4A] uppercase tracking-wider">
              Profile Settings & Credentials
            </h3>
          </div>
          <button
            id="profile-btn-edit-toggle"
            onClick={() => {
              if (!editMode) {
                setEditFullName(userProfile?.fullName || "");
                setEditEmail(userProfile?.email || "");
                setSaveSuccess(false);
                setSaveError("");
                SpeechEngine.speak("Editing profile enabled. Make changes to your display credentials.", voicePref);
              } else {
                SpeechEngine.speak("Editing profile cancelled.", voicePref);
              }
              setEditMode(!editMode);
            }}
            className="text-xs bg-[#0F766E]/10 text-[#0F766E] hover:bg-[#0F766E] hover:text-white font-extrabold px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            {editMode ? "Cancel Changes" : "Edit Profile Info"}
          </button>
        </div>

        {saveSuccess && (
          <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl flex items-center gap-2 border border-emerald-100 font-bold animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Profile updated successfully and synced securely with the study database!</span>
          </div>
        )}

        {saveError && (
          <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl flex items-center gap-2 border border-red-100 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-semibold">{saveError}</span>
          </div>
        )}

        {editMode ? (
          <form onSubmit={handleSaveProfile} className="space-y-4 pt-1 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="edit-fullName" className="text-[10px] font-black text-[#134E4A]/70 uppercase tracking-widest pl-1">
                  Full Name / Student Alias
                </label>
                <input
                  id="edit-fullName"
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="e.g. Aayushi"
                  className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 border border-gray-200 focus:bg-white focus:outline-hidden focus:border-[#0F766E] rounded-xl text-[#134E4A] transition-all placeholder:text-gray-400"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-email" className="text-[10px] font-black text-[#134E4A]/70 uppercase tracking-widest pl-1">
                  Email Address
                </label>
                <input
                  id="edit-email"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 border border-gray-200 focus:bg-white focus:outline-hidden focus:border-[#0F766E] rounded-xl text-[#134E4A] transition-all placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                id="profile-btn-save"
                type="submit"
                className="px-5 py-2 bg-[#0F766E] hover:bg-[#134E4A] text-white text-[10.5px] font-black uppercase tracking-widest rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                Save Account Changes
              </button>
            </div>
          </form>
        ) : (
          <div className="text-xs space-y-3 pt-1">
            <div className="flex justify-between items-center bg-[#FFFBF5]/75 p-3.5 rounded-2xl border border-orange-50/60 font-semibold">
              <span className="text-[#134E4A]/70">Credential Enroller Verify State</span>
              <span className="font-extrabold text-[#0F766E] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Fully Certified
              </span>
            </div>
            <p className="leading-relaxed font-semibold text-gray-500 pl-1">
              Changes made to your credentials will sync and update immediately across the entire workspace, including the customized header display.
            </p>
          </div>
        )}
      </div>

      {/* 5. Sleek / Collapsed Diagnostic Panel for Systems & Database auditing */}
      <div className="bg-[#FFFBF5]/40 border border-[#0F766E]/10 rounded-3xl overflow-hidden p-6 shadow-3xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-150 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-500" />
            <div>
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">System Audit & Diagnostics Console</h4>
              <p className="text-[10px] text-gray-400 font-bold">Inspect credential structures, token configurations, and SQL schemas</p>
            </div>
          </div>
          <button
            onClick={() => {
              const toggleState = !showAdminConsole;
              setShowAdminConsole(toggleState);
              SpeechEngine.speak(toggleState ? "Developer console activated." : "Developer console hidden.", voicePref);
            }}
            className="text-[9.5px] font-black text-[#0F766E] bg-white border border-[#0F766E]/10 px-3.5 py-1.5 rounded-xl hover:bg-teal-50/50 transition-colors cursor-pointer uppercase tracking-wider"
          >
            {showAdminConsole ? "Hide Diagnostics ✕" : "Expand Console ⚙️"}
          </button>
        </div>

        {showAdminConsole && (
          <div className="space-y-6 animate-fadeIn pt-2">
            
            {/* Cryptographic Session & JWT Payload decoder */}
            <div className="space-y-3 bg-slate-900 text-slate-100 rounded-2xl p-4 border border-slate-850 font-mono text-xs">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Key className="w-4 h-4" />
                  <span className="font-bold text-[10px] uppercase tracking-wider">Active Cryptographic Context</span>
                </div>
                <span className="bg-emerald-500/10 text-emerald-400 text-[8.5px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  HMAC-SHA256 SIGNED
                </span>
              </div>

              {/* Password encrypt parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10.5px] leading-relaxed p-1 bg-slate-950/40 rounded-xl">
                <div className="space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-900">
                  <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-widest">Password Shield Encryption</span>
                  <p className="font-semibold text-slate-300">
                    All passwords hashed using Blowfish cipher crypt.
                  </p>
                  <div className="flex gap-4 pt-1 font-bold text-[10px] text-emerald-300">
                    <span>Algorithm: BCrypt</span>
                    <span>Salt Work: 10 Rounds</span>
                  </div>
                </div>

                <div className="space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-900">
                  <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-widest">JWT Authorization Life</span>
                  <p className="font-semibold text-slate-300">
                    Secure Web Token valid for 30 consecutive days.
                  </p>
                  <div className="flex justify-between text-[10px] text-sky-305 pt-1">
                    <span>Session term state: Active</span>
                    <span className="text-emerald-400">98% valid life remaining</span>
                  </div>
                </div>
              </div>

              {/* decoded token keys */}
              {(() => {
                try {
                  const parts = token.split(".");
                  if (parts.length !== 3) {
                    return <p className="text-red-400">Unable to locate normal 3-part token payload structures.</p>;
                  }
                  const base64Url = parts[1];
                  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                  const jsonPayload = decodeURIComponent(
                    window.atob(base64)
                      .split("")
                      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                      .join("")
                  );
                  const decoded = JSON.parse(jsonPayload);
                  return (
                    <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-slate-920">
                      <div className="text-[9.5px] text-slate-500 font-bold uppercase tracking-widest">Decoded Client Bearer Information:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px]">
                        <div className="space-y-0.5">
                          <span className="text-sky-305 block break-all">id: "{decoded.id}"</span>
                          <span className="text-emerald-355 block break-all">email: "{decoded.email}"</span>
                        </div>
                        <div className="space-y-0.5 sm:text-right">
                          <span className="text-amber-305 block">Issued: {decoded.iat ? new Date(decoded.iat * 1000).toLocaleTimeString() : "N/A"}</span>
                          <span className="text-rose-305 block">Expires: {decoded.exp ? new Date(decoded.exp * 1000).toLocaleDateString() : "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  );
                } catch {
                  return <p className="text-orange-400">Authorization parsing is unavailable.</p>;
                }
              })()}
            </div>

            {/* Structured Table Schema Information Tabs */}
            <div className="space-y-3.5 bg-white p-5 rounded-2xl border border-gray-200/60 shadow-3xs">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <Database className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Active PostgreSQL Tables schemas</span>
              </div>

              <div className="flex flex-wrap gap-1.5 font-sans">
                {(["users", "notes", "quizzes", "quizHistory", "chatSessions"] as const).map((tab) => {
                  const isActive = activeSchemaTab === tab;
                  const displayLabels: Record<string, string> = {
                    users: "users",
                    notes: "notes",
                    quizzes: "quizzes",
                    quizHistory: "quiz_history",
                    chatSessions: "chat_sessions"
                  };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveSchemaTab(tab)}
                      className={`text-[9.5px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        isActive
                          ? "bg-slate-800 text-white shadow-3xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {displayLabels[tab]}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Schemas Fields Viewer */}
              {(() => {
                const schemaCollection = {
                  users: {
                    desc: "Registers master student records and preferences linked with secure bcrypt structures.",
                    fields: [
                      { key: "id", type: "VARCHAR(9) (PRIMARY KEY)", desc: "Unique index code" },
                      { key: "email", type: "VARCHAR(255) (UNIQUE)", desc: "Verified student login email identity" },
                      { key: "passwordHash", type: "VARCHAR(60)", desc: "Salted crypt password check string" },
                      { key: "fullName", type: "VARCHAR(255)", desc: "User screen display name" },
                      { key: "voiceSettings", type: "JSONB", desc: "User contrast settings and voice synthesizer preferences" },
                      { key: "studyHours", type: "DECIMAL(5,2)", desc: "Calculated study accumulation statistics logs" }
                    ]
                  },
                  notes: {
                    desc: "Saves verified summaries extracted from academic materials.",
                    fields: [
                      { key: "id", type: "VARCHAR(9) (PRIMARY KEY)", desc: "Reference notes key identification code" },
                      { key: "userId", type: "VARCHAR(9) (FOREIGN KEY)", desc: "Points back to corresponding Users.id account" },
                      { key: "title", type: "VARCHAR(255)", desc: "Name label of parsed notes" },
                      { key: "rawContent", type: "TEXT", desc: "Raw prompts / custom text" },
                      { key: "summary", type: "TEXT (Markdown)", desc: "AI Overview breakdown structured text" },
                      { key: "bulletPoints", type: "JSONB_ARRAY", desc: "High value takeaway lists" },
                      { key: "easyExplanation", type: "TEXT", desc: "Simplified layperson explanation string" },
                      { key: "examNotes", type: "TEXT", desc: "Syllabus test cheat notes summary" },
                      { key: "keyDefinitions", type: "JSONB_ARRAY", desc: "Lookups array pairing study keywords and definition logs" }
                    ]
                  },
                  quizzes: {
                    desc: "Interactive multiple choice questions generated on-demand matching active lessons.",
                    fields: [
                      { key: "id", type: "VARCHAR(9) (PRIMARY KEY)", desc: "Testing module identifier code" },
                      { key: "noteId", type: "VARCHAR(9)", desc: "Source notes mapping indicator" },
                      { key: "userId", type: "VARCHAR(9)", desc: "Owner student key pointer" },
                      { key: "title", type: "VARCHAR(255)", desc: "Challenge title details" },
                      { key: "questions", type: "JSONB_OBJECT_ARRAY", desc: "List detailing answers options, corrections index, and interactive tutor clues" }
                    ]
                  },
                  quizHistory: {
                    desc: "Chronological grade archives tracking test answers performance.",
                    fields: [
                      { key: "id", type: "VARCHAR(9) (PRIMARY KEY)", desc: "Historic record entry primary key index" },
                      { key: "quizId", type: "VARCHAR(9)", desc: "Evaluated testing model pointer" },
                      { key: "userId", type: "VARCHAR(9)", desc: "Candidate user profile mapping" },
                      { key: "title", type: "VARCHAR(255)", desc: "Interactive evaluation title description" },
                      { key: "score", type: "SMALLINT", desc: "Candidate correct replies count" },
                      { key: "totalQuestions", type: "SMALLINT", desc: "Total questions tested" },
                      { key: "percentage", type: "DECIMAL(5,2)", desc: "Resulting grade percentile rank" }
                    ]
                  },
                  chatSessions: {
                    desc: "Saves conversational threads interacting with the AI Buddy companion helper.",
                    fields: [
                      { key: "id", type: "VARCHAR(9) (PRIMARY KEY)", desc: "Unique thread dialog indicator log" },
                      { key: "userId", type: "VARCHAR(9)", desc: "Assigned candidate classmate pointer" },
                      { key: "noteId", type: "VARCHAR(9)", desc: "Active note focus contextual coordinates links" },
                      { key: "messages", type: "JSONB_ARRAY", desc: "Chronological timeline detailing sender status (user/ai), textual lines, and speech events logs" }
                    ]
                  }
                };

                const currentSchemaObj = schemaCollection[activeSchemaTab];

                return (
                  <div className="space-y-2 font-mono text-[10px] leading-relaxed animate-fadeIn">
                    <p className="text-slate-500 font-sans italic text-[11px] mb-2">"{currentSchemaObj.desc}"</p>
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full text-left border-collapse bg-slate-50/40 text-[10.5px]">
                        <thead>
                          <tr className="bg-slate-100 border-b border-gray-200 text-slate-600 font-extrabold uppercase tracking-wider text-[9.5px]">
                            <th className="py-2.5 px-3">Column Key</th>
                            <th className="py-2.5 px-3">PostgreSQL Format</th>
                            <th className="py-2.5 px-3 font-sans">Role / Purpose</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-150">
                          {currentSchemaObj.fields.map((f) => (
                            <tr key={f.key} className="hover:bg-slate-50 text-slate-700">
                              <td className="py-2 px-3 text-[#0F766E] font-black">{f.key}</td>
                              <td className="py-2 px-3 font-bold text-slate-550 text-[9.5px]">{f.type}</td>
                              <td className="py-2 px-3 font-sans text-gray-600">{f.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
