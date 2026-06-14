import React, { useState } from "react";
import { BookOpen, Mic, Volume2, Shield, Eye, HelpCircle, ArrowRight } from "lucide-react";
import { SpeechEngine } from "../utils/speech";
import { VoicePreferences } from "../types";

interface LandingPageProps {
  onStart: () => void;
  voicePref: VoicePreferences;
}

export default function LandingPage({ onStart, voicePref }: LandingPageProps) {
  const [isPlayingWelcome, setIsPlayingWelcome] = useState(false);

  const handlePlayIntro = () => {
    if (isPlayingWelcome) {
      SpeechEngine.stop();
      setIsPlayingWelcome(false);
    } else {
      setIsPlayingWelcome(true);
      const text = "Welcome to Accessible AI Study Buddy. We are an inclusive learning assistant that converts notes, designs practice quizzes, provides helpful live tutoring, and reads aloud study pages for visually and hearing impaired students. Select Get Started to begin your learning journey.";
      SpeechEngine.speak(text, voicePref);
      // Wait for speech to complete
      const checkSpeech = setInterval(() => {
        if (!SpeechEngine.isSpeaking()) {
          setIsPlayingWelcome(false);
          clearInterval(checkSpeech);
        }
      }, 500);
    }
  };

  return (
    <div id="landing-page" className="min-h-screen bg-[#F8FAFC] text-[#312E81] flex flex-col items-center justify-center p-4">
      {/* Premium Hero Container */}
      <div className="max-w-4xl w-full text-center space-y-8 py-12 px-6 card-soft rounded-3xl">
        
        {/* Decorative Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#6366F1]/10 text-[#4338CA] text-xs font-semibold uppercase tracking-wider">
          <Volume2 className="w-3.5 h-3.5 animate-pulse" /> Accessible Education for Everyone
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#312E81] tracking-tight leading-tight">
          Accessible <span className="text-[#4338CA]">AI Study Buddy</span>
        </h1>

        <p className="text-lg text-[#312E81]/80 max-w-2xl mx-auto leading-relaxed">
          Unlock learning with a personalized companion. Instantly analyze study materials, generate structured notes, challenge yourself with quizzes, and utilize speech recognition, screen recitation, and visual captions.
        </p>

        {/* Interaction Buttons Grid */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <button
            id="lnd-btn-start"
            onClick={onStart}
            className="w-full sm:w-auto px-8 py-4 bg-[#4338CA] hover:bg-[#312E81] text-white font-semibold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 text-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Get Started <ArrowRight className="w-5 h-5" />
          </button>
          
          <button
            id="lnd-btn-play"
            onClick={handlePlayIntro}
            className={`w-full sm:w-auto px-6 py-4 rounded-2xl font-semibold border-2 border-[#4338CA]/30 hover:border-[#4338CA] transition-all flex items-center justify-center gap-2 cursor-pointer bg-white text-[#4338CA] ${
              isPlayingWelcome ? "bg-indigo-50" : ""
            }`}
          >
            <Volume2 className={`w-5 h-5 ${isPlayingWelcome ? "animate-bounce" : ""}`} />
            {isPlayingWelcome ? "Stop Introduction" : "Listen to Introduction"}
          </button>
        </div>

        {/* Dynamic Bento Accessibility Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10 text-left">
          
          <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#4338CA]/5 hover:shadow-xs transition-shadow">
            <div className="p-3 w-fit rounded-xl bg-[#4338CA]/10 text-[#4338CA] mb-4">
              <Eye className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#312E81] mb-2">Visual Accessibility</h3>
            <p className="text-sm text-[#312E81]/70 leading-relaxed">
              Equipped with our screen-reader hover technology, adjustable font scaling, high contrast parameters, and multimodal layout descriptions for charts and slides.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#4338CA]/5 hover:shadow-xs transition-shadow">
            <div className="p-3 w-fit rounded-xl bg-[#4338CA]/10 text-[#4338CA] mb-4">
              <Mic className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#312E81] mb-2">Speech & Verbal AI</h3>
            <p className="text-sm text-[#312E81]/70 leading-relaxed">
              Includes interactive Voice-to-Text conversion, real-time voice command routing, and custom chat tutoring speaking support.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#4338CA]/5 hover:shadow-xs transition-shadow">
            <div className="p-3 w-fit rounded-xl bg-[#4338CA]/10 text-[#4338CA] mb-4">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#312E81] mb-2">Summaries & Quizzes</h3>
            <p className="text-sm text-[#312E81]/70 leading-relaxed">
              Upload textbook sections and get immediate bullet notes, simple explanations, test crams, and practice True/False or MCQ quizzes!
            </p>
          </div>

        </div>

        {/* Bottom micro-info */}
        <div className="pt-6 text-xs text-[#312E81]/60 flex justify-center items-center gap-4">
          <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-[#6366F1]" /> Secure JWT Authorization</span>
          <span className="flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5 text-[#6366F1]" /> WCAG 2.1 Compliant</span>
        </div>

      </div>
    </div>
  );
}
