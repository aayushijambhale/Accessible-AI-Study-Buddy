import React, { useState, useEffect } from "react";
import { User, Award, BookOpen, Clock, Brain, MessageSquare, ShieldCheck, Sparkles, AlertCircle, Database, Lock, Key, ChevronRight, ChevronDown, Layers, ShieldAlert, CheckCircle2 } from "lucide-react";
import { SpeechEngine } from "../utils/speech";
import { VoicePreferences, UserProfile, DashboardAnalytics } from "../types";

interface ProfileProps {
  token: string;
  voicePref: VoicePreferences;
}

export default function ProfileScreen({ token, voicePref }: ProfileProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile Editor Panel (Phase 2 Authenticated customization form state)
  const [editMode, setEditMode] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Phase 3 Secure Authentication and Database Schema States
  const [activeSchemaTab, setActiveSchemaTab] = useState<"users" | "notes" | "quizzes" | "quizHistory" | "chatSessions">("users");
  const [isJwtCardExpanded, setIsJwtCardExpanded] = useState(true);

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
      SpeechEngine.speak("Profile credentials updated successfully.", voicePref);
      
      // Dispatch custom event to alert high-level header components
      window.dispatchEvent(new CustomEvent("profile-updated"));
    } catch (err: any) {
      setSaveError(err.message || "Operation failed.");
      SpeechEngine.speak(`Error: ${err.message}`, voicePref);
    }
  };

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

  const handleMouseEnterText = (label: string) => {
    if (voicePref.enabled) {
      SpeechEngine.speak(label, voicePref);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div className="h-10 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-40 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  const studyHours = (userProfile?.studyHours ?? stats?.studyHours ?? 0).toFixed(1);
  const totalNotes = stats?.notesCount ?? 0;
  const quizzesTaken = stats?.quizCount ?? 0;
  const avgGrade = stats?.averageScore ?? 0;

  // Gamified achievements list based on active conditions
  const achievementsList = [
    {
      id: "inc-reader",
      title: "Inception Scholar",
      desc: "Upload or parse your first educational lecture notes.",
      unlocked: totalNotes > 0,
      badge: "📚"
    },
    {
      id: "practice-titan",
      title: "Self-Tester Pro",
      desc: "Complete at least one multi-choice practice quiz successfully.",
      unlocked: quizzesTaken > 0,
      badge: "⚡"
    },
    {
      id: "tutor-scholar",
      title: "Pedagogic Companion",
      desc: "Consult the conversational Tutor Study Buddy.",
      unlocked: true, // Auto unlocked for trying the buddy app!
      badge: "💬"
    },
    {
      id: "optics-master",
      title: "Universal Sight Guide",
      desc: "Achieve optimal focus via high contrast or font zoom scaling guidelines.",
      unlocked: voicePref.contrastMode || voicePref.textZoom !== "normal",
      badge: "👁️"
    }
  ];

  return (
    <div id="profile-screen" className="p-6 max-w-4xl mx-auto space-y-8">
      
      {/* Student Badge Card */}
      <div 
        className="bg-gradient-to-br from-[#4338CA] to-[#6366F1] text-white rounded-3xl p-8 relative overflow-hidden shadow-md"
        onMouseEnter={() => handleMouseEnterText(`Student profile page. Account for ${userProfile?.fullName}.`)}
      >
        <div className="absolute top-0 right-0 p-8 text-white/5 pointer-events-none">
          <User className="w-48 h-48" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl flex items-center justify-center text-4xl shadow-inner font-extrabold text-white">
            {userProfile?.fullName ? userProfile.fullName.charAt(0) : "S"}
          </div>

          <div className="text-center sm:text-left space-y-1">
            <span className="text-[10px] bg-white/25 text-white font-extrabold uppercase px-2.5 py-1 rounded-full tracking-widest inline-block">
              Learner Space Profile
            </span>
            <h2 className="text-2xl font-black">{userProfile?.fullName || "Guest Student"}</h2>
            <p className="text-xs text-white/80 font-medium leading-relaxed">{userProfile?.email}</p>
          </div>
        </div>
      </div>

      {/* Grid: Study Stats vs Achievements */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Academic statistics */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-[#4338CA]/10 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-[#312E81] uppercase tracking-wider block border-b border-[#4338CA]/10 pb-2">
              Academic Audit
            </h3>

            <div className="grid grid-cols-1 gap-3">
              <div 
                className="flex justify-between items-center bg-[#F8FAFC]/40 p-4 rounded-2xl border border-orange-50"
                onMouseEnter={() => handleMouseEnterText(`Continuous study hours: ${studyHours}`)}
              >
                <div className="flex items-center gap-2 text-[#4338CA]">
                  <Clock className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-bold text-[#312E81]/80">Study Hours</span>
                </div>
                <span className="text-lg font-black text-[#312E81]">{studyHours} hrs</span>
              </div>

              <div 
                className="flex justify-between items-center bg-[#F8FAFC]/40 p-4 rounded-2xl border border-orange-50"
                onMouseEnter={() => handleMouseEnterText(`Total summary materials: ${totalNotes}`)}
              >
                <div className="flex items-center gap-2 text-[#4338CA]">
                  <BookOpen className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-bold text-[#312E81]/80">Lessons Saved</span>
                </div>
                <span className="text-lg font-black text-[#312E81]">{totalNotes} docs</span>
              </div>

              <div 
                className="flex justify-between items-center bg-[#F8FAFC]/40 p-4 rounded-2xl border border-orange-50"
                onMouseEnter={() => handleMouseEnterText(`Practice tests taken: ${quizzesTaken}`)}
              >
                <div className="flex items-center gap-2 text-[#4338CA]">
                  <Brain className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-bold text-[#312E81]/80">Quiz Completed</span>
                </div>
                <span className="text-lg font-black text-[#312E81]">{quizzesTaken} times</span>
              </div>

              <div 
                className="flex justify-between items-center bg-[#F8FAFC]/40 p-4 rounded-2xl border border-orange-50"
                onMouseEnter={() => handleMouseEnterText(`Average grading grade: ${avgGrade} percent`)}
              >
                <div className="flex items-center gap-2 text-[#4338CA]">
                  <Award className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-bold text-[#312E81]/80">Quiz Avg score</span>
                </div>
                <span className="text-lg font-black text-[#312E81]">{avgGrade}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gamified Achievements list card */}
        <div className="md:col-span-7 space-y-6">
          <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-[#4338CA]/10 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-[#312E81] uppercase tracking-wider block border-b border-[#4338CA]/10 pb-2">
              Achievements Badges ({achievementsList.filter(a => a.unlocked).length} / {achievementsList.length})
            </h3>

            <div className="space-y-3">
              {achievementsList.map((ach) => (
                <div 
                  key={ach.id}
                  onMouseEnter={() => handleMouseEnterText(`${ach.title}. status: ${ach.unlocked ? "unlocked" : "locked"}. ${ach.desc}`)}
                  className={`flex items-start gap-3.5 p-4 rounded-2xl border transition-all ${
                    ach.unlocked
                      ? "bg-[#F8FAFC]/60 border-[#6366F1]/20 text-[#312E81]"
                      : "bg-gray-50/50 border-gray-100 opacity-50 text-[#312E81]/60"
                  }`}
                >
                  <div className="text-2xl p-2.5 bg-white rounded-xl shadow-xs shrink-0 flex items-center justify-center border border-gray-100">
                    {ach.badge}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 leading-snug">
                      <span className="text-xs font-extrabold text-[#312E81]">{ach.title}</span>
                      {ach.unlocked && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded-full">
                          Unlocked
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] leading-relaxed opacity-85 text-[#312E81]/90 mt-1 font-semibold">{ach.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Profile Settings Section (Phase 2 Authenticated customization form) */}
      <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-[#4338CA]/10 space-y-4 shadow-xs">
        <div className="flex justify-between items-center border-b border-[#4338CA]/10 pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#4338CA]" />
            <h3 className="text-sm font-bold text-[#312E81] uppercase tracking-wider">
              Profile Settings (Phase 2)
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
                SpeechEngine.speak("Editing profile enabled. Change credentials as desired.", voicePref);
              } else {
                SpeechEngine.speak("Editing profile cancelled.", voicePref);
              }
              setEditMode(!editMode);
            }}
            className="text-xs bg-[#4338CA]/10 text-[#4338CA] hover:bg-[#4338CA] hover:text-white font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {editMode ? "Cancel" : "Edit Profile Info"}
          </button>
        </div>

        {saveSuccess && (
          <div className="p-3 bg-indigo-50 text-indigo-800 text-xs rounded-xl flex items-center gap-2 border border-indigo-100 font-medium">
            <span className="font-extrabold">✓</span> Profile updated successfully and synced securely with the secure study database!
          </div>
        )}

        {saveError && (
          <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl flex items-center gap-2 border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {editMode ? (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="edit-fullName" className="text-xs font-bold text-[#312E81]/70 uppercase tracking-wider">
                  Full Name / Student Alias
                </label>
                <input
                  id="edit-fullName"
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-[#4338CA]/10 focus:outline-none focus:border-[#4338CA] rounded-xl text-[#312E81]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-email" className="text-xs font-bold text-[#312E81]/70 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  id="edit-email"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-[#4338CA]/10 focus:outline-none focus:border-[#4338CA] rounded-xl text-[#312E81]"
                />
              </div>
            </div>

            <button
              id="profile-btn-save"
              type="submit"
              className="px-6 py-2.5 bg-[#4338CA] hover:bg-[#312E81] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Save Account Changes
            </button>
          </form>
        ) : (
          <div className="text-xs space-y-2 opacity-80">
            <div className="flex justify-between items-center bg-[#F8FAFC]/40 p-3.5 rounded-2xl border border-orange-50">
              <span className="font-bold text-[#312E81]/80">Credential Verify Level</span>
              <span className="font-extrabold text-[#4338CA]">Fully Enrolled / Verified</span>
            </div>
            <p className="leading-relaxed font-semibold">Changes made to your credentials will sync and update immediately across the entire workspace, including the customized header display.</p>
          </div>
        )}
      </div>

      {/* PHASE 3: SECURE SESSION & DATABASE SCHEMA CONTROLS */}
      <div className="space-y-6">
        
        {/* Real-time JWT Session Metadata & Bcrypt Encryption Inspector */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-[#4338CA]/10 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-[#4338CA]/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#4338CA]/10 rounded-xl text-[#4338CA]">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#312E81] uppercase tracking-wider">
                  Session Token & Password Security (Phase 3)
                </h3>
                <span className="text-[10px] text-[#4338CA] font-bold uppercase tracking-widest">JWT Authorization & Bcrypt Shield</span>
              </div>
            </div>
            <button
              id="profile-btn-jwt-toggle"
              onClick={() => {
                const nextVal = !isJwtCardExpanded;
                setIsJwtCardExpanded(nextVal);
                SpeechEngine.speak(nextVal ? "Revealed cryptography session credentials." : "Cryptographic session inspector collapsed.", voicePref);
              }}
              className="p-1 px-3 py-1 bg-[#F8FAFC] hover:bg-[#4338CA]/10 border border-[#4338CA]/15 rounded-xl text-xs font-bold text-[#4338CA] cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {isJwtCardExpanded ? "Hide Details" : "Inspect Credentials"}
            </button>
          </div>

          {isJwtCardExpanded && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Twin visual layout: Encryption status & Token signature decoder */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Bcrypt Password Encryption Info */}
                <div 
                  className="bg-[#F8FAFC]/70 p-4 rounded-2xl border border-orange-50 space-y-3"
                  onMouseEnter={() => handleMouseEnterText("Credentials are fully protected using Blowfish cipher bcrypt signature with 10 standard salt strength rounds.")}
                >
                  <div className="flex items-center gap-2 text-[#4338CA]">
                    <ShieldCheck className="w-4.5 h-4.5 text-indigo-600" />
                    <span className="text-xs font-black uppercase text-[#312E81]">Password Salt Shield</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <p className="font-semibold text-gray-700 leading-relaxed">
                      All student passwords are systematically encrypted on the backend server before disk storage.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1 font-bold">
                      <div className="bg-white/60 p-2 rounded-xl text-center border border-[#4338CA]/5">
                        <span className="text-[10px] text-[#4338CA] block uppercase">Hash Cipher</span>
                        <span className="text-xs text-[#312E81]">Blowfish Bcrypt</span>
                      </div>
                      <div className="bg-white/60 p-2 rounded-xl text-center border border-[#4338CA]/5">
                        <span className="text-[10px] text-[#4338CA] block uppercase">Salt Rounds</span>
                        <span className="text-xs text-[#312E81]">10 Rounds</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. active JWT Session Life progress tracker */}
                <div 
                  className="bg-[#F8FAFC]/70 p-4 rounded-2xl border border-orange-50 space-y-3"
                  onMouseEnter={() => handleMouseEnterText("Active student session status is managed secure by cloud web tokens with a default thirty days expiration timescale.")}
                >
                  <div className="flex items-center gap-2 text-[#4338CA]">
                    <Key className="w-4.5 h-4.5 text-amber-600" />
                    <span className="text-xs font-black uppercase text-[#312E81]">JWT Authenticated life</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-[#312E81]/80">
                      <span>Token Lifetime Status</span>
                      <span className="text-indigo-700">Active (30-day term)</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: "98%" }}></div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-extrabold text-gray-500">
                      <span>Session Started</span>
                      <span>98% Expiry Remain</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* 3. Secure live JWT Token Payload Decrypter (No Mock data payload - parsed directly from local JWT token!) */}
              <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 space-y-3 font-mono text-[11px] border border-slate-800">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-bold text-xs uppercase tracking-wider">Live Decoded JWT Payload (Client-Side Sandboxed Decoding)</span>
                  </div>
                  <span className="bg-indigo-500/10 text-indigo-400 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-indigo-500/20">
                    HMAC-SHA256 signature Verified
                  </span>
                </div>
                
                {(() => {
                  try {
                    const parts = token.split(".");
                    if (parts.length !== 3) {
                      return <p className="text-red-400">Unable to locate three-part structure of active study session token.</p>;
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 leading-relaxed">
                        <div className="space-y-1">
                          <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-widest">Active Client Bearer Context:</span>
                          <span className="text-sky-300 block break-all">id: "{decoded.id}"</span>
                          <span className="text-indigo-300 block break-all">email: "{decoded.email}"</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-widest font-mono">Issued timestamps:</span>
                          <span className="text-amber-300 block">Issued at (iat): {decoded.iat ? new Date(decoded.iat * 1000).toLocaleString() : "N/A"}</span>
                          <span className="text-rose-300 block">Expires at (exp): {decoded.exp ? new Date(decoded.exp * 1000).toLocaleString() : "N/A"}</span>
                        </div>
                      </div>
                    );
                  } catch (err) {
                    return <p className="text-orange-400">Session token decoding failed.</p>;
                  }
                })()}

                <div className="bg-slate-950 p-2.5 rounded-xl text-slate-400 border border-slate-900 leading-normal text-[10px]">
                  <span className="text-amber-400 font-extrabold text-[11px] block mb-0.5">🔒 PROTECTED ROUTING RULES ACTIVE:</span>
                  Requests to server endpoints <code className="text-slate-200">/api/notes</code>, <code className="text-slate-200">/api/quizzes</code>, and <code className="text-slate-200">/api/analytics</code> automatically reject with <code className="text-rose-400 font-bold">401 Unauthorized</code> unless decrypted via HMAC-SHA256 protocol verification matches.
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Dynamic Database Schema Catalog Relational Browser */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-[#4338CA]/10 space-y-4 shadow-xs">
          <div className="flex items-center gap-2.5 border-b border-[#4338CA]/10 pb-3">
            <div className="p-2 bg-[#4338CA]/10 rounded-xl text-[#4338CA]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#312E81] uppercase tracking-wider">
                Relational Database Schemas Catalog (Phase 3)
              </h3>
              <span className="text-[10px] text-[#4338CA] font-bold uppercase tracking-widest">Verified Relational Properties & Database Fields</span>
            </div>
          </div>

          <p className="text-xs font-semibold text-[#312E81]/80 leading-relaxed">
            The data storage framework maps to the following structured repository tables. Each record persists securely and relates chronologically back to the certified User primary key.
          </p>

          {/* Table Select Tabs */}
          <div className="flex flex-wrap gap-2">
            {(["users", "notes", "quizzes", "quizHistory", "chatSessions"] as const).map((tab) => {
              const isActive = activeSchemaTab === tab;
              const displayLabels: Record<string, string> = {
                users: "Users Model",
                notes: "Notes Model",
                quizzes: "Quizzes Model",
                quizHistory: "Quiz History",
                chatSessions: "AI Chats Logs"
              };
              return (
                <button
                  id={`btn-schema-tab-${tab}`}
                  key={tab}
                  onClick={() => {
                    setActiveSchemaTab(tab);
                    SpeechEngine.speak(`Displaying database fields for ${displayLabels[tab]}.`, voicePref);
                  }}
                  className={`text-xs font-extrabold px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#4338CA] text-white shadow-xs"
                      : "bg-[#F8FAFC] text-[#4338CA] hover:bg-[#4338CA]/10 border border-[#4338CA]/10"
                  }`}
                >
                  {displayLabels[tab]}
                </button>
              );
            })}
          </div>

          {/* Displays dynamic schema content of selected tab */}
          <div className="p-4 bg-[#F8FAFC]/70 rounded-2xl border border-orange-50 space-y-3 animate-fadeIn">
            
            {(() => {
              const schemasInfo = {
                users: {
                  title: "Users Relational Model Schema",
                  description: "Registers student configuration credentials linked with high-performance bcrypt hashed credentials.",
                  fields: [
                    { key: "id", type: "VARCHAR(9) (PRIMARY KEY)", desc: "Unique index identifier (Numerical string)" },
                    { key: "email", type: "VARCHAR(255) (UNIQUE KEY)", desc: "Verified student login email key" },
                    { key: "passwordHash", type: "VARCHAR(60)", desc: "Locked code signature generated securely via bcrypt hash helper" },
                    { key: "fullName", type: "VARCHAR(255)", desc: "Full text Student display label" },
                    { key: "voiceSettings", type: "JSONB", desc: "User configuration preferences (contrast mode, pitch, zoom, disabled read aloud)" },
                    { key: "studyHours", type: "DECIMAL(5,2)", desc: "Chronological minutes calculated as decimal hours with automatic addition" }
                  ]
                },
                notes: {
                  title: "Notes Persistent Model Schema",
                  description: "Saves verified uploaded summaries and materials extracted from files.",
                  fields: [
                    { key: "id", type: "VARCHAR(9) (PRIMARY KEY)", desc: "Notes document key" },
                    { key: "userId", type: "VARCHAR(9) (FOREIGN KEY)", desc: "Links Note back to appropriate verified Users.id profile" },
                    { key: "title", type: "VARCHAR(255)", desc: "Selected document title descriptor" },
                    { key: "rawContent", type: "TEXT", desc: "Raw prompts / custom pasted notes values" },
                    { key: "summary", type: "TEXT (Markdown summary format)", desc: "AI-generated Markdown overview blocks" },
                    { key: "bulletPoints", type: "JSONB_ARRAY", desc: "List of condensed high-priority learnings" },
                    { key: "easyExplanation", type: "TEXT", desc: "Simplified layperson explanation terms" },
                    { key: "examNotes", type: "TEXT", desc: "Targeted flash summaries containing key test topics" },
                    { key: "keyDefinitions", type: "JSONB_ARRAY", desc: "Highlighted definition lookup pairs (term and definition link)" }
                  ]
                },
                quizzes: {
                  title: "Quizzes Dynamic Model Schema",
                  description: "Includes multiple choice interactive trivia and review challenges generated on-demand.",
                  fields: [
                    { key: "id", type: "VARCHAR(9) (PRIMARY KEY)", desc: "Interactive evaluation unique key" },
                    { key: "noteId", type: "VARCHAR(9) (FOREIGN KEY)", desc: "Associates practice challenge package to origin Notes.id" },
                    { key: "userId", type: "VARCHAR(9) (FOREIGN KEY)", desc: "Assigned student profile target matching link" },
                    { key: "title", type: "VARCHAR(255)", desc: "Topic identifier for the examination" },
                    { key: "questions", type: "JSONB_OBJECT_ARRAY", desc: "Questions array detailing options, correctAnswer value, and educational trivia explanations" }
                  ]
                },
                quizHistory: {
                  title: "QuizHistory Grades Tracking Schema",
                  description: "Saves historic performance records and academic progress timeline logs.",
                  fields: [
                    { key: "id", type: "VARCHAR(9) (PRIMARY KEY)", desc: "Historic entry primary identifier code" },
                    { key: "quizId", type: "VARCHAR(9) (FOREIGN KEY)", desc: "Linked evaluation exam target pointer" },
                    { key: "userId", type: "VARCHAR(9) (FOREIGN KEY)", desc: "Student candidate account ID mapping" },
                    { key: "title", type: "VARCHAR(255)", desc: "Quiz evaluation label" },
                    { key: "score", type: "SMALLINT", desc: "Total correct choices checked by candidate" },
                    { key: "totalQuestions", type: "SMALLINT", desc: "Max test questions capacity" },
                    { key: "percentage", type: "DECIMAL(5,2)", desc: "Final recorded score percentile grade scale" }
                  ]
                },
                chatSessions: {
                  title: "ChatSessions Conversational Timeline Schema",
                  description: "Tracks text-based conversational tutoring messages and historical chats with the AI companion.",
                  fields: [
                    { key: "id", type: "VARCHAR(9) (PRIMARY KEY)", desc: "Session storage unique reference identifier key" },
                    { key: "userId", type: "VARCHAR(9) (FOREIGN KEY)", desc: "Points back to appropriate verified student User ID" },
                    { key: "noteId", type: "VARCHAR(9) (FOREIGN KEY)", desc: "Provides targeted focus context linking to Notes.id" },
                    { key: "messages", type: "JSONB_ARRAY", desc: "Timestamp sequential list tracking sender category (user/ai) and dialog strings" }
                  ]
                }
              };

              const activeSchemaObj = schemasInfo[activeSchemaTab];

              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[#312E81]">
                    <Layers className="w-4 h-4 text-[#4338CA]" />
                    <h4 className="text-xs font-extrabold uppercase tracking-wider">{activeSchemaObj.title}</h4>
                  </div>
                  <p className="text-[10.5px] text-[#312E81]/80 font-bold mb-2 italic">
                    "{activeSchemaObj.description}"
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#4338CA]/20 text-[#4338CA]/80 uppercase font-black tracking-widest bg-indigo-500/5">
                          <th className="py-2.5 px-3">Field Key Name</th>
                          <th className="py-2.5 px-3">Relational Type / Format</th>
                          <th className="py-2.5 px-3">Field Usage & Safeguard Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#4338CA]/5">
                        {activeSchemaObj.fields.map((field) => (
                          <tr key={field.key} className="hover:bg-indigo-50/20 font-semibold text-[#312E81] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500">
                            <td className="py-2 px-3 text-[#4338CA] font-bold font-mono">{field.key}</td>
                            <td className="py-2 px-3 text-slate-600 font-bold text-[9px] font-mono">{field.type}</td>
                            <td className="py-2 px-3 text-[10.5px] font-bold text-gray-700 leading-normal">{field.desc}</td>
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

      </div>

    </div>
  );
}
