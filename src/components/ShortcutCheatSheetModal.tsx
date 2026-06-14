import React from "react";
import { X, HelpCircle, CornerDownRight, Volume2, Sliders, Brain, FileText, LayoutDashboard, History } from "lucide-react";

interface CheatSheetProps {
  onClose: () => void;
}

export default function ShortcutCheatSheetModal({ onClose }: CheatSheetProps) {
  const categories = [
    {
      title: "Audio & Speech Operations",
      items: [
        { keys: ["Spacebar"], description: "Pause / Resume TTS voice recitation (or toggle microphone if idle)", icon: Volume2 },
        { keys: ["Alt", "K"], description: "Open Keyboard Shortcuts cheat sheet modal", icon: HelpCircle },
      ]
    },
    {
      title: "Navigation & Tabs",
      items: [
        { keys: ["Alt", "D"], description: "Go to Student Dashboard & daily metrics", icon: LayoutDashboard },
        { keys: ["Alt", "N"], description: "Go to Study Notes & activate note creator", icon: FileText },
        { keys: ["Alt", "Q"], description: "Go to interactive Quiz Center", icon: Brain },
        { keys: ["Alt", "A"], description: "Go to sensory Accessibility Desk config", icon: Sliders },
        { keys: ["Alt", "H"], description: "Go directly to Voice History logs", icon: History },
      ]
    }
  ];

  return (
    <div id="cheat-sheet-modal" className="fixed inset-0 bg-[#312E81]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl border border-[#4338CA]/15 shadow-2xl max-w-lg w-full overflow-hidden animate-scaleIn">
        
        {/* Header decoration */}
        <div className="bg-[#F8FAFC] px-6 py-5 border-b border-[#4338CA]/10 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#E6F4F1] text-[#4338CA] rounded-xl">
              <HelpCircle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#312E81] uppercase tracking-wide">Interactive Shortcuts</h3>
              <span className="text-[10px] text-[#4338CA]/80 font-bold block">Inclusive study help helper</span>
            </div>
          </div>
          <button
            id="close-cheat-sheet-btn"
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-gray-900 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content lists */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {categories.map((cat, ci) => (
            <div key={ci} className="space-y-3">
              <h4 className="text-[10px] font-black uppercase text-[#6366F1] tracking-widest pl-1">{cat.title}</h4>
              <div className="space-y-2">
                {cat.items.map((item, ii) => {
                  const Icon = item.icon;
                  return (
                    <div key={ii} className="flex justify-between items-start gap-4 p-3 bg-[#F8FAFC] rounded-2xl border border-[#4338CA]/5 hover:bg-white hover:border-[#6366F1]/20 hover:scale-[1.01] transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-[#FFF] border border-orange-50/70 text-[#4338CA] rounded-lg shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-[#312E81] leading-tight">{item.description}</span>
                      </div>
                      
                      {/* Keyboard pill rendering */}
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((key, ki) => (
                          <span 
                            key={ki} 
                            className="bg-white border-b-2 border-r-2 border-gray-200 px-2 py-0.5 rounded-lg text-[10px] font-extrabold text-[#312E81] shadow-xs uppercase tracking-wide font-mono shrink-0"
                          >
                            {key}
                          </span>
                        ))}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Actions Footer */}
        <div className="bg-[#F8FAFC]/60 hover:bg-[#F8FAFC] p-4 border-t border-[#4338CA]/10 flex justify-end gap-2.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500">
          <button
            id="btn-close-shortcut-cheat-sheet"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#4338CA] hover:bg-[#312E81] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-xs transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Dismiss Help Guide
          </button>
        </div>

      </div>
    </div>
  );
}
