import React, { useState } from "react";
import { LogIn, UserPlus, Mail, Lock, User, AlertCircle, Volume2, Eye, EyeOff } from "lucide-react";
import { SpeechEngine } from "../utils/speech";
import { VoicePreferences } from "../types";

interface AuthProps {
  onSuccess: (token: string, user: any) => void;
  voicePref: VoicePreferences;
}

export default function AuthPage({ onSuccess, voicePref }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Audio helper to read page actions
  const readPageAction = (text: string) => {
    SpeechEngine.speak(text, voicePref);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = isLogin ? { email, password } : { email, password, fullName };
    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something failed during credentials transfer.");
      }

      readPageAction(`Login successful. Welcome back ${data.user.fullName}`);
      onSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "Credential matching failed.");
      readPageAction(`Authentication error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-page" className="min-h-screen bg-[#FFFBF5] text-[#134E4A] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-[#0F766E]/10 overflow-hidden">
        
        {/* Toggle tabs */}
        <div className="flex border-b border-[#0F766E]/10">
          <button
            id="auth-tab-login"
            onClick={() => {
              setIsLogin(true);
              setError("");
              readPageAction("Switched to Login tab.");
            }}
            className={`flex-1 py-4 text-center font-bold flex justify-center items-center gap-2 transition-all cursor-pointer ${
              isLogin ? "bg-[#FFFBF5] text-[#0F766E] border-b-2 border-[#0F766E]" : "text-[#134E4A]/60 hover:text-[#0F766E]"
            }`}
          >
            <LogIn className="w-4 h-4" /> Sign In
          </button>
          
          <button
            id="auth-tab-register"
            onClick={() => {
              setIsLogin(false);
              setError("");
              readPageAction("Switched to Register Account tab.");
            }}
            className={`flex-1 py-4 text-center font-bold flex justify-center items-center gap-2 transition-all cursor-pointer ${
              !isLogin ? "bg-[#FFFBF5] text-[#0F766E] border-b-2 border-[#0F766E]" : "text-[#134E4A]/60 hover:text-[#0F766E]"
            }`}
          >
            <UserPlus className="w-4 h-4" /> Join Buddy
          </button>
        </div>

        {/* Content Box */}
        <div className="p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[#134E4A]">
              {isLogin ? "Welcome Back Student" : "Create Study Space"}
            </h2>
            <p className="text-sm text-[#134E4A]/70 mt-1">
              {isLogin ? "Sign in to access study notes and practice tests" : "Join us to convert PDFs, audio logs and more into structured AI notes"}
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 text-red-800 text-sm flex items-start gap-2.5 border border-red-100" role="alert">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Full Name for Registration */}
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#134E4A]/70" htmlFor="auth-fullName">
                  Full Name / Student Alias
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-4 h-4 text-[#0F766E]/50" />
                  <input
                    id="auth-fullName"
                    type="text"
                    required
                    placeholder="Enter full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#FFFBF5] border border-[#0F766E]/10 rounded-xl focus:outline-none focus:border-[#0F766E] transition-all text-[#134E4A]"
                  />
                </div>
              </div>
            )}

            {/* Email Field with explicit accessibility tag */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#134E4A]/70" htmlFor="auth-email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-[#0F766E]/50" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  placeholder="name@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#FFFBF5] border border-[#0F766E]/10 rounded-xl focus:outline-none focus:border-[#0F766E] transition-all text-[#134E4A]"
                />
              </div>
            </div>

            {/* Password Field with focus outline (Phase 2 Secure Authentication & Accessibility check) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#134E4A]/70" htmlFor="auth-password">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-[#0F766E]/50 pointer-events-none" />
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-[#FFFBF5] border border-[#0F766E]/10 rounded-xl focus:outline-none focus:border-[#0F766E] transition-all text-[#134E4A]"
                />
                <button
                  id="auth-btn-toggle-pass"
                  type="button"
                  onClick={() => {
                    const nextVal = !showPassword;
                    setShowPassword(nextVal);
                    readPageAction(nextVal ? "Password revealed." : "Password concealed.");
                  }}
                  className="absolute right-3.5 text-[#0F766E]/50 hover:text-[#0F766E] transition-all cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="auth-btn-submit"
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#0F766E] mt-4 text-white font-bold rounded-xl shadow-md hover:bg-[#134E4A] transition-all disabled:opacity-50 cursor-pointer flex justify-center items-center gap-2"
            >
              {loading ? "Authenticating..." : isLogin ? "Access Study Buddy" : "Create Account"}
            </button>

          </form>

          {/* Quick Speak Assistance button */}
          <button
            id="auth-btn-hear"
            type="button"
            onClick={() => readPageAction(isLogin ? "This is the Login page. Please fill in your Email Address and Password, then click Access Study Buddy." : "This is the Register page. Please fill in your Full Name, Email, and Password, then click Create Account.")}
            className="w-full py-2 border border-[#0F766E]/10 text-xs font-semibold text-[#0F766E] flex justify-center items-center gap-2.5 rounded-lg bg-[#FFFBF5] hover:bg-[#14B8A6]/10 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" /> Read sign-in instructions aloud
          </button>
        </div>

      </div>
    </div>
  );
}
