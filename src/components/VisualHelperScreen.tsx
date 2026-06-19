import React, { useState, useEffect } from "react";
import { Eye, Upload, Volume2, StopCircle, Sparkles, AlertCircle, FileText, Check } from "lucide-react";
import { SpeechEngine } from "../utils/speech";
import { VoicePreferences, ImageCaptionItem } from "../types";

interface VisualHelperProps {
  token: string;
  voicePref: VoicePreferences;
}

export default function VisualHelperScreen({ token, voicePref }: VisualHelperProps) {
  const [captions, setCaptions] = useState<ImageCaptionItem[]>([]);
  const [activeCaption, setActiveCaption] = useState<ImageCaptionItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fetchCaptions = () => {
    setLoadingList(true);
    fetch("/api/image-caption", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setCaptions(data);
        if (data.length > 0 && !activeCaption) {
          setActiveCaption(data[0]);
        }
        setLoadingList(false);
      })
      .catch((err) => {
        console.error("Caption logs failed", err);
        setLoadingList(false);
      });
  };

  useEffect(() => {
    fetchCaptions();
  }, [token]);

  const handleMouseEnterText = (label: string) => {
    if (voicePref.enabled) {
      SpeechEngine.speak(label, voicePref);
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
      SpeechEngine.speak(`Selected image ${file.name}. Title set automatically.`, voicePref);
    };
    reader.onerror = () => {
      setError("Failed to process image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleDescribeImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview) return;

    setLoading(true);
    setError("");
    SpeechEngine.speak("Analyzing study image structures. Generating accessibility audio guides.", voicePref);

    try {
      const res = await fetch("/api/image-caption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageBase64: imagePreview,
          title: title || "Lecture Diagram Helper",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Image parsing failed on server.");
      }

      SpeechEngine.speak("AI analysis complete. Description ready and displayed.", voicePref);
      setActiveCaption(data);
      setImagePreview(null);
      setTitle("");
      fetchCaptions();
    } catch (err: any) {
      setError(err.message || "Failed image description compilation.");
      SpeechEngine.speak(`Analysis error: ${err.message}`, voicePref);
    } finally {
      setLoading(false);
    }
  };

  const handleReciteDescription = () => {
    if (!activeCaption) return;
    SpeechEngine.speak(`Description of ${activeCaption.title}: ${activeCaption.description}`, voicePref);
  };

  return (
    <div id="visual-helper-screen" className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
      {/* LEFT: Creator upload Form */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-[#0F766E]/10 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#0F766E]">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <h3 className="text-md font-bold text-[#134E4A]">Explain Study Diagram</h3>
          </div>

          <p className="text-xs text-[#134E4A]/70 leading-relaxed font-semibold">
            Upload or snap textbook pages, charts, or slides. Our AI assistant will transcribe text and describe diagrams visually.
          </p>

          {error && (
            <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleDescribeImage} className="space-y-4">
            <div>
              <span className="block text-xs font-bold text-[#134E4A]/70 uppercase tracking-wider mb-2">
                Snap or Upload lecture image
              </span>
              <label
                onMouseEnter={() => handleMouseEnterText("Click to choose study diagram or textbook page screenshot")}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#0F766E]/15 hover:border-[#0F766E] bg-[#FFFBF5]/40 hover:bg-[#14B8A6]/5 rounded-2xl cursor-pointer transition-all text-center relative overflow-hidden min-h-[140px]"
              >
                {imagePreview ? (
                  <div className="space-y-2">
                    <img src={imagePreview} alt="Preview" className="max-h-24 mx-auto rounded-lg object-contain" />
                    <span className="text-[10px] text-[#0F766E] font-bold block bg-teal-50 px-2 py-0.5 rounded-full">
                      Image Loaded
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="w-8 h-8 text-[#0F766E]/70 mx-auto" />
                    <span className="text-xs font-bold text-[#134E4A]/80 block">Select Diagram Screenshot</span>
                    <span className="text-[10px] text-gray-400 block">Supports PNG, JPG, GIF</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  className="hidden"
                />
              </label>
            </div>

            {imagePreview && (
              <div>
                <label htmlFor="visual-title" className="block text-xs font-bold text-[#134E4A]/70 uppercase tracking-wider mb-1">
                  Diagram Title
                </label>
                <input
                  id="visual-title"
                  type="text"
                  required
                  placeholder="e.g., Biology Mitosis Cycle Chart"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 text-sm bg-white border border-[#0F766E]/10 rounded-xl text-[#134E4A] focus:outline-none focus:border-[#0F766E]"
                />
              </div>
            )}

            <button
              id="visual-btn-describe"
              type="submit"
              disabled={loading || !imagePreview}
              className="w-full py-3.5 bg-gradient-to-br from-[#0F766E] to-[#14B8A6] text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer flex justify-center items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              {loading ? "Analyzing visual slides..." : "Describe Graphic Element"}
            </button>
          </form>
        </div>

        {/* History Catalog */}
        <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-[#0F766E]/10">
          <h3 className="text-sm font-bold text-[#134E4A] mb-3">Previous Diagram Analyses ({captions.length})</h3>
          {loadingList ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg" />
              ))}
            </div>
          ) : captions.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {captions.map((cap) => {
                const isActive = activeCaption?.id === cap.id;
                return (
                  <button
                    key={cap.id}
                    onClick={() => {
                      setActiveCaption(cap);
                      SpeechEngine.speak(`Viewing description for ${cap.title}`, voicePref);
                    }}
                    onMouseEnter={() => handleMouseEnterText(`Diagram: ${cap.title}`)}
                    className={`w-full text-left p-3 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#14B8A6]/10 border-[#14B8A6] text-[#0F766E] font-bold"
                        : "border-transparent hover:bg-[#FFFBF5]/20 text-[#134E4A]/80"
                    }`}
                  >
                    <FileText className="w-4 h-4 text-[#0F766E] shrink-0" />
                    <span className="text-xs truncate">{cap.title}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-xs font-semibold">
              No graphics processed yet.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Display screen */}
      <div className="lg:col-span-7">
        {activeCaption ? (
          <div className="bg-white/70 backdrop-blur-md rounded-3xl border border-[#0F766E]/10 overflow-hidden shadow-sm flex flex-col min-h-[400px]">
            <div className="p-6 bg-[#FFFBF5]/60 border-b border-[#0F766E]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-[#14B8A6] uppercase tracking-wider block">Visual description report</span>
                <h4 className="text-lg font-black text-[#134E4A]">{activeCaption.title}</h4>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReciteDescription}
                  className="px-3.5 py-2 bg-[#0F766E] text-white hover:bg-[#134E4A] rounded-xl flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-all"
                >
                  <Volume2 className="w-4 h-4" /> Recite Aloud
                </button>
                <button
                  onClick={() => SpeechEngine.stop()}
                  className="p-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl cursor-pointer"
                >
                  <StopCircle className="w-4 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 flex-1 space-y-4">
              <h4 className="text-xs font-bold text-[#0F766E] uppercase tracking-widest">Accessibility Transcriptions & Cues</h4>
              <p
                onMouseEnter={() => handleMouseEnterText(activeCaption.description)}
                className="text-sm text-[#134E4A]/90 leading-relaxed font-medium whitespace-pre-line bg-[#FFFBF5]/40 p-5 rounded-2xl border border-teal-50"
              >
                {activeCaption.description}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-[#0F766E]/10 p-12 text-center shadow-sm">
            <Eye className="w-16 h-16 text-[#134E4A]/25 mx-auto mb-4" />
            <h4 className="text-md font-bold text-[#134E4A]">Graphic helper unoccupied</h4>
            <p className="text-xs text-[#134E4A]/60 max-w-xs mx-auto mt-1">
              Select or drop any study textbook element, graph matrix, or flow-chart diagram to receive screen-reader transcribing blocks here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
