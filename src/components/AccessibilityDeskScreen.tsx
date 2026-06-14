import React, { useState, useEffect } from "react";
import { Sliders, Volume2, Type, RefreshCw, Check, Sparkles } from "lucide-react";
import { SpeechEngine } from "../utils/speech";
import { VoicePreferences } from "../types";

interface AccessibilityDeskProps {
  token: string;
  voicePref: VoicePreferences;
  onUpdatePreferences: (pref: Partial<VoicePreferences>) => void;
}

export default function AccessibilityDeskScreen({ token, voicePref, onUpdatePreferences }: AccessibilityDeskProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load native browser synthetic voices
    const loadVoices = () => {
      const list = SpeechEngine.getAvailableVoices();
      setVoices(list);
    };

    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleMouseEnterText = (label: string) => {
    if (voicePref.enabled) {
      SpeechEngine.speak(label, voicePref);
    }
  };

  const handleToggleHoverMode = () => {
    const nextVal = !voicePref.enabled;
    onUpdatePreferences({ enabled: nextVal });
    SpeechEngine.speak(
      nextVal ? "Hover recitation activated." : "Hover recitation deactivated.",
      { ...voicePref, enabled: true }
    );
  };

  const handleRateChange = (rateVal: number) => {
    onUpdatePreferences({ rate: rateVal });
    SpeechEngine.speak(`Rate adjusted to ${rateVal}`, { ...voicePref, rate: rateVal });
  };

  const handlePitchChange = (pitchVal: number) => {
    onUpdatePreferences({ pitch: pitchVal });
    SpeechEngine.speak(`Pitch modified`, { ...voicePref, pitch: pitchVal });
  };

  const handleVoiceChange = (vName: string) => {
    onUpdatePreferences({ voiceName: vName });
    SpeechEngine.speak(`Voice updated.`, { ...voicePref, voiceName: vName });
  };

  const handleToggleContrast = () => {
    const nextVal = !voicePref.contrastMode;
    onUpdatePreferences({ contrastMode: nextVal });
    SpeechEngine.speak(
      nextVal ? "High contrast visual parameters enabled." : "High contrast disabled.",
      voicePref
    );
  };

  const handleZoomChange = (zoom: "normal" | "large" | "extra-large") => {
    onUpdatePreferences({ textZoom: zoom });
    SpeechEngine.speak(`Text size configured to ${zoom}`, { ...voicePref, textZoom: zoom });
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ voiceSettings: voicePref }),
      });
      if (res.ok) {
        SpeechEngine.speak("Voice and sensory guidelines synchronized successfully with cloud workspace.", voicePref);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="accessibility-desk-screen" className="p-6 max-w-4xl mx-auto space-y-8">
      
      {/* Container Card */}
      <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-[#4338CA]/10 p-8 space-y-6 shadow-sm">
        
        {/* Header Title */}
        <div 
          className="flex items-center gap-3 text-[#4338CA]"
          onMouseEnter={() => handleMouseEnterText("Accessibility settings control deck")}
        >
          <div className="p-2.5 bg-[#4338CA]/15 rounded-2xl">
            <Sliders className="w-6 h-6 text-[#4338CA]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#312E81]">Accessibility Desk</h2>
            <p className="text-xs text-gray-400 font-semibold">Fine-tune auditory feedback, high contrast filters, and document display sizes.</p>
          </div>
        </div>

        {/* Configuration settings block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          
          {/* Section 1: Auditory Speech Customisation */}
          <div className="space-y-5 bg-[#F8FAFC]/40 p-6 rounded-2xl border border-orange-50">
            <div className="flex items-center gap-2 text-[#4338CA] border-b border-[#4338CA]/10 pb-2">
              <Volume2 className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Acoustic Speech Reader</h3>
            </div>

            {/* Hover Reader switch */}
            <div className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-gray-100">
              <div>
                <span className="text-xs font-bold block text-[#312E81]">Line Reader Hover Cues</span>
                <span className="text-[10px] text-gray-400 font-medium">Recite paragraphs verbally on mouse-over.</span>
              </div>
              <button
                id="access-btn-toggle-hover"
                onClick={handleToggleHoverMode}
                className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer flex relative items-center ${
                  voicePref.enabled ? "bg-[#6366F1] justify-end" : "bg-gray-200 justify-start"
                }`}
              >
                <span className="w-5.5 h-5.5 bg-white rounded-full shadow-sm block" />
              </button>
            </div>

            {/* Rate Speech slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold text-[#312E81]/80">
                <span>Vocal Reading Speed</span>
                <span>{voicePref.rate.toFixed(1)}x</span>
              </div>
              <input
                id="access-input-rate"
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={voicePref.rate}
                onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                className="w-full accent-[#4338CA] bg-white h-1.5 rounded-full appearance-none cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 border border-[#4338CA]/10"
              />
            </div>

            {/* Pitch Speech slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold text-[#312E81]/80">
                <span>Voice Pitch Level</span>
                <span>{voicePref.pitch.toFixed(1)}</span>
              </div>
              <input
                id="access-input-pitch"
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={voicePref.pitch}
                onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
                className="w-full accent-[#4338CA] bg-white h-1.5 rounded-full appearance-none cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 border border-[#4338CA]/10"
              />
            </div>

            {/* Voice select */}
            {voices.length > 0 && (
              <div className="space-y-1">
                <label htmlFor="access-select-voice" className="block text-[11px] font-extrabold text-[#312E81]/80">
                  Target Speech Voice Name
                </label>
                <select
                  id="access-select-voice"
                  value={voicePref.voiceName}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full p-2 bg-white border border-[#4338CA]/10 text-xs rounded-xl text-[#312E81] focus:outline-none"
                >
                  <option value="">Browser Default Standard</option>
                  {voices.map((v, i) => (
                    <option key={i} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}

          </div>

          {/* Section 2: Visual Sensory Layout */}
          <div className="space-y-5 bg-[#F8FAFC]/40 p-6 rounded-2xl border border-orange-50">
            <div className="flex items-center gap-2 text-[#4338CA] border-b border-[#4338CA]/10 pb-2">
              <Type className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Sensory Optics & Layout</h3>
            </div>

            {/* High Contrast Visual */}
            <div className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-gray-100">
              <div>
                <span className="text-xs font-bold block text-[#312E81]">High Optics Contrast Mode</span>
                <span className="text-[10px] text-gray-400 font-medium">Render visual borders and display outlines clearly.</span>
              </div>
              <button
                id="access-btn-toggle-contrast"
                onClick={handleToggleContrast}
                className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer flex relative items-center ${
                  voicePref.contrastMode ? "bg-[#6366F1] justify-end" : "bg-gray-200 justify-start"
                }`}
              >
                <span className="w-5.5 h-5.5 bg-white rounded-full shadow-sm block" />
              </button>
            </div>

            {/* Text Zoom Segment buttons */}
            <div className="space-y-2">
              <span className="block text-[11px] font-extrabold text-[#312E81]/80">Document Text Font Zoom</span>
              <div className="grid grid-cols-3 gap-2">
                {(["normal", "large", "extra-large"] as const).map((z) => {
                  const isActive = voicePref.textZoom === z;
                  return (
                    <button
                      key={z}
                      id={`access-btn-zoom-${z}`}
                      onClick={() => handleZoomChange(z)}
                      className={`p-2.5 rounded-xl border text-[11.5px] font-black capitalize transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#4338CA] border-[#4338CA] text-white shadow-xs"
                          : "bg-white border-gray-100 hover:bg-[#6366F1]/5 text-[#312E81]"
                      }`}
                    >
                      {z === "normal" ? "Standard" : z === "large" ? "Large (1.2x)" : "Max Zoom (1.4x)"}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

        {/* Action footer button: save config */}
        <div className="flex justify-end pt-4 border-t border-[#4338CA]/10">
          <button
            id="access-btn-save-pref"
            onClick={handleSavePreferences}
            disabled={saving}
            className="px-6 py-3.5 bg-[#4338CA] hover:bg-[#312E81] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Synchronize Preferences to Cloud Database
          </button>
        </div>

      </div>

    </div>
  );
}
