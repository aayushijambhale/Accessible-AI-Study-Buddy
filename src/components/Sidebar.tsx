import React from "react";
import { LayoutDashboard, BookOpen, Brain, Sparkles, Sliders, User, LogOut, Eye, History } from "lucide-react";
import { SpeechEngine } from "../utils/speech";
import { VoicePreferences } from "../types";

interface SidebarProps {
  currentTab: string;
  onChangeTab: (tab: string) => void;
  onLogout: () => void;
  voicePref: VoicePreferences;
}

export default function Sidebar({ currentTab, onChangeTab, onLogout, voicePref }: SidebarProps) {
  
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Go to student dashboard statistics" },
    { id: "notes", label: "Study Notes", icon: BookOpen, desc: "Convert text or files into structured notes summaries" },
    { id: "quiz", label: "Quiz Center", icon: Brain, desc: "Generate and review practice quiz exams" },
    { id: "tutor", label: "AI Tutor Chat", icon: Sparkles, desc: "Interact with context-aware learning chatbot" },
    { id: "visual", label: "Visual Helper", icon: Eye, desc: "Describe diagrams or textbook screenshots verbally" },
    { id: "accessibility", label: "Accessibility Desk", icon: Sliders, desc: "Configure high contrast, text zoom and voice speed parameters" },
    { id: "voice-history", label: "Voice History", icon: History, desc: "Review logs of all interpreted voice commands and student voice answers" },
    { id: "profile", label: "Student Profile", icon: User, desc: "View study progress tracker and settings" },
  ];

  // Hover screen-reader mode
  const handleMouseEnterItem = (label: string, desc: string) => {
    if (voicePref.enabled) {
      SpeechEngine.speak(`${label}. ${desc}.`, voicePref);
    }
  };

  return (
    <aside id="app-sidebar" className="w-full md:w-64 bg-white border-r border-[#0F766E]/10 flex flex-col justify-between shrink-0 h-auto md:h-screen sticky top-0">
      
      <div className="p-6 space-y-6">
        {/* Workspace Brand Title */}
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onMouseEnter={() => handleMouseEnterItem("AA-I Study Buddy Brand", "Welcome to Accessible AI Study Buddy Hub")}
        >
          <div className="p-2 bg-[#0F766E] text-white rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-md font-extrabold text-[#134E4A] leading-tight tracking-tight">AI Study Buddy</h1>
            <span className="text-[10px] font-bold text-[#14B8A6] uppercase tracking-wider">Inclusive Studio</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1" aria-label="Main Navigation">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                id={`sidebar-tab-${item.id}`}
                key={item.id}
                onClick={() => {
                  onChangeTab(item.id);
                  if (voicePref.enabled) {
                    SpeechEngine.speak(`Opened ${item.label}`, voicePref);
                  }
                }}
                onMouseEnter={() => handleMouseEnterItem(item.label, item.desc)}
                className={`w-full text-left px-4 py-3 rounded-xl font-semibold flex items-center gap-3 transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#0F766E] text-white shadow-xs"
                    : "text-[#134E4A]/80 hover:bg-[#14B8A6]/10 hover:text-[#0F766E]"
                }`}
              >
                <IconComponent className={`w-5 h-5 ${isActive ? "text-white" : "text-[#0F766E]"}`} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout Action Bar */}
      <div className="p-4 border-t border-[#0F766E]/10">
        <button
          id="sidebar-btn-logout"
          onClick={() => {
            onLogout();
            if (voicePref.enabled) {
              SpeechEngine.speak("Logged out successfully.", voicePref);
            }
          }}
          onMouseEnter={() => handleMouseEnterItem("Log Out", "Exit your student session safely")}
          className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl font-semibold flex items-center gap-3 transition-all cursor-pointer"
        >
          <LogOut className="w-5 h-5 text-red-500" />
          <span className="text-sm">Sign Out</span>
        </button>
      </div>

    </aside>
  );
}
