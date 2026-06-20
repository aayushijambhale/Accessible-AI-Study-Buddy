import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, 
  FileText, 
  Plus, 
  Download, 
  Volume2, 
  StopCircle, 
  CornerDownRight, 
  Upload, 
  AlertCircle, 
  Sparkles, 
  Check, 
  Eye, 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  Compass, 
  Layers, 
  CheckCircle, 
  X, 
  Printer, 
  Info, 
  Settings 
} from "lucide-react";
import { SpeechEngine } from "../utils/speech";
import { NoteItem, VoicePreferences } from "../types";

interface NotesProps {
  token: string;
  voicePref: VoicePreferences;
}

export default function NotesScreen({ token, voicePref }: NotesProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  // Drag and drop / file states
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedPdf, setUploadedPdf] = useState<{
    name: string;
    size: string;
    text: string;
    pagesCount: number;
    pages: string[];
    currentPage: number;
  } | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [error, setError] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Interactive PDF controls
  const [pdfZoom, setPdfZoom] = useState(100);
  const [pdfActiveHighlightColor, setPdfActiveHighlightColor] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Record<number, string[]>>({}); // pageIndex: Array of text segments
  const [pdfViewMode, setPdfViewMode] = useState<"visual" | "raw">("visual");

  // Note detail tab: "summary" | "bullets" | "exam" | "easy" | "definitions"
  const [detailTab, setDetailTab] = useState<"summary" | "bullets" | "exam" | "easy" | "definitions">("summary");

  // Interactive note items mastery checklist state (Phase 4 interactivity additions)
  const [masteredBullets, setMasteredBullets] = useState<Record<string, boolean>>({});

  // Multilingual translation state
  const [translating, setTranslating] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState("Spanish");
  const [translatedTextPopup, setTranslatedTextPopup] = useState<string | null>(null);

  // Leitner spaced repetition flashcard states
  const [isLeitnerMode, setIsLeitnerMode] = useState(false);
  const [leitnerBoxes, setLeitnerBoxes] = useState<Record<string, number>>(() => {
    const cached = localStorage.getItem("buddy_leitner_boxes");
    return cached ? JSON.parse(cached) : {};
  });
  const [currentLeitnerBox, setCurrentLeitnerBox] = useState<number>(1);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isDefinitionVisible, setIsDefinitionVisible] = useState(false);

  // Trigger feedback hover audio
  const handleMouseEnterText = (label: string) => {
    if (voicePref.enabled) {
      SpeechEngine.speak(label, voicePref);
    }
  };

  // Fetch list of notes
  const fetchNotes = () => {
    setLoadingList(true);
    fetch("/api/notes", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setNotes(data);
        if (data.length > 0 && !activeNote) {
          setActiveNote(data[0]);
        }
        setLoadingList(false);
      })
      .catch((err) => {
        console.error("Notes load failed", err);
        setLoadingList(false);
      });
  };

  useEffect(() => {
    fetchNotes();
  }, [token]);

  useEffect(() => {
    const handleNewNoteMode = () => {
      setActiveNote(null);
      setTitle("");
      setContent("");
      setUploadedPdf(null);
      SpeechEngine.speak("Notes creator form activated. Enter a custom lesson title or upload your PDF guidelines.", voicePref);
      
      // Focus on the title input
      setTimeout(() => {
        const titleInput = document.getElementById("notes-title");
        if (titleInput) {
          titleInput.focus();
        }
      }, 200);
    };

    window.addEventListener("activate-new-note-mode", handleNewNoteMode);
    return () => window.removeEventListener("activate-new-note-mode", handleNewNoteMode);
  }, [voicePref]);

  useEffect(() => {
    const handleVoiceCreateNotes = (e: Event) => {
      const customEvent = e as CustomEvent;
      const topic = customEvent.detail.topic;
      const contentPrompt = `Provide a comprehensive master textbook summary, academic definitions, and critical learning guides about "${topic}", illustrating all fundamental structures and principles deeply.`;
      
      setTitle(topic);
      setContent(contentPrompt);
      startNotesGeneration(topic, contentPrompt);
    };

    window.addEventListener("trigger-voice-create-notes", handleVoiceCreateNotes);
    return () => window.removeEventListener("trigger-voice-create-notes", handleVoiceCreateNotes);
  }, [token, voicePref]);

  // Real PDF extraction with multi-page pdfjs-dist layers & Tesseract OCR analytics fallback (Phase 1 & 2)
  const extractPdfContent = async (file: File, arrayBuffer: ArrayBuffer) => {
    setIsUploadingFile(true);
    setError("");
    setProgressStatus("Extracting document bytes...");
    setGenerateProgress(10);
    
    try {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      const finalTitleInput = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      setTitle(finalTitleInput);

      // Check if it is a simple plain text note
      if (file.name.endsWith(".txt")) {
        const textDecoder = new TextDecoder("utf-8");
        const parsedText = textDecoder.decode(arrayBuffer);
        setUploadedPdf({
          name: file.name,
          size: (file.size / 1024).toFixed(1) + " KB",
          text: parsedText,
          pagesCount: 1,
          pages: [parsedText],
          currentPage: 1
        });
        setContent(parsedText);
        SpeechEngine.speak("Plaintext notebook guidelines parsed safely.", voicePref);
        setIsUploadingFile(false);
        return;
      }

      // Read real layers via window.pdfjsLib (Phase 1)
      const pdfjs = (window as any).pdfjsLib;
      if (!pdfjs) {
        throw new Error("PDF processing engine is offline. Please check network hooks.");
      }

      const uint8 = new Uint8Array(arrayBuffer);
      const loadingTask = pdfjs.getDocument({ data: uint8 });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      let fullText = "";
      const pdfPagesTextList: string[] = [];

      setProgressStatus("Scanning PDF text characters...");
      setGenerateProgress(30);

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        pdfPagesTextList.push(pageText);
        fullText += pageText + "\n";
      }

      // Check if document requires Tesseract.js OCR (Scanned / Image PDF detection)
      let isOcrTriggered = false;
      const tesseractInstance = (window as any).Tesseract;
      if (fullText.trim().length < 50 && tesseractInstance) {
        isOcrTriggered = true;
        setProgressStatus("OCR fallback triggered: Digitizing scanned layouts...");
        setGenerateProgress(50);
        
        let ocrFullText = "";
        const ocrPagesTextList: string[] = [];

        // Scan first 3 pages of scanned files to keep visual performance responsive
        for (let pageNum = 1; pageNum <= Math.min(numPages, 3); pageNum++) {
          setProgressStatus(`Digitizing page layout index ${pageNum}...`);
          try {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (context) {
              await page.render({ canvasContext: context, viewport }).promise;
              const result = await tesseractInstance.recognize(canvas, "eng");
              const ocrText = result.data.text || "";
              ocrPagesTextList.push(ocrText);
              ocrFullText += ocrText + "\n";
            }
          } catch (ocrErr) {
            console.error(`OCR analysis failed on page ${pageNum}:`, ocrErr);
          }
        }
        
        if (ocrFullText.trim().length > 10) {
          fullText = ocrFullText;
          pdfPagesTextList.splice(0, pdfPagesTextList.length, ...ocrPagesTextList);
        }
      }

      if (fullText.trim().length < 10) {
        throw new Error("No readable text nodes located in academic file.");
      }

      setUploadedPdf({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        text: fullText,
        pagesCount: pdfPagesTextList.length,
        pages: pdfPagesTextList,
        currentPage: 1
      });

      setContent(fullText);
      setGenerateProgress(100);
      setProgressStatus(isOcrTriggered ? "Scanned OCR digitizer success!" : "PDF characters extracted successfully!");
      SpeechEngine.speak(isOcrTriggered ? "Scanned document digitized via OCR." : "PDF text layer extracted.", voicePref);

    } catch (err: any) {
      console.error("PDF engine failure:", err);
      setError(`Extraction failed: ${err.message}`);
      SpeechEngine.speak(`Error: ${err.message}`, voicePref);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleFileUpload = (file: File) => {
    setIsUploadingFile(true);
    setError("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      await extractPdfContent(file, buffer);
    };

    reader.onerror = () => {
      setError("File reader failed to read standard bytes.");
      setIsUploadingFile(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const startNotesGeneration = async (targetTitle: string, targetContent: string) => {
    setError("");
    setLoadingGenerate(true);
    setGenerateProgress(10);
    setProgressStatus("Scanning file stream...");

    const progressMilestones = [
      { p: 25, label: "Scanning file stream..." },
      { p: 50, label: "Extracting textbook layout & PDF vectors..." },
      { p: 75, label: "Converting chapters under Easy-Explanation schemas..." },
      { p: 90, label: "Summarizing with pedagogical standards..." }
    ];

    let milestoneIdx = 0;
    const interval = setInterval(() => {
      if (milestoneIdx < progressMilestones.length) {
        setGenerateProgress(progressMilestones[milestoneIdx].p);
        setProgressStatus(progressMilestones[milestoneIdx].label);
        milestoneIdx++;
      } else {
        clearInterval(interval);
      }
    }, 600);

    try {
      const res = await fetch("/api/notes/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: targetTitle, content: targetContent }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Material parsing failed on backend.");
      }

      clearInterval(interval);
      setGenerateProgress(100);
      setProgressStatus("Workspace created successfully!");

      setTimeout(() => {
        SpeechEngine.speak(`Notes generated successfully. ${data.title} ready for study review.`, voicePref);
        setTitle("");
        setContent("");
        setUploadedPdf(null);
        setActiveNote(data);
        fetchNotes();
        setLoadingGenerate(false);
        setGenerateProgress(0);

        // Dispatch completed event to let any waiting quiz generation triggers run!
        window.dispatchEvent(new CustomEvent("voice-create-notes-completed", { detail: { note: data } }));
      }, 500);

    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || "Failed notes compilation.");
      SpeechEngine.speak(`Error: ${err.message}`, voicePref);
      setLoadingGenerate(false);
      setGenerateProgress(0);
    }
  };

  // Submit parsed note block to database
  const handleGenerateNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    await startNotesGeneration(title, content);
  };

  // Text Selection Highlight Helper
  const toggleTextHighlight = (textSegment: string) => {
    if (!uploadedPdf) return;
    const pageNum = uploadedPdf.currentPage;
    const currentHighlights = highlights[pageNum] || [];
    
    if (currentHighlights.includes(textSegment)) {
      setHighlights({
        ...highlights,
        [pageNum]: currentHighlights.filter((t) => t !== textSegment)
      });
      SpeechEngine.speak("Highlight removed.", voicePref);
    } else if (pdfActiveHighlightColor) {
      setHighlights({
        ...highlights,
        [pageNum]: [...currentHighlights, textSegment]
      });
      SpeechEngine.speak("Text marked with highlighter.", voicePref);
    } else {
      // If no highlighter tool selected, speak clicked paragraph
      SpeechEngine.speak(textSegment, voicePref);
    }
  };

  // Speaks current active segment block allowed
  const handleReadActiveSegment = () => {
    if (!activeNote) return;
    let textToRead = "";
    if (detailTab === "summary") {
      textToRead = `Summary section. ${activeNote.summary}`;
    } else if (detailTab === "bullets") {
      textToRead = `Important bullet points. ${activeNote.bulletPoints.join(". ")}`;
    } else if (detailTab === "exam") {
      textToRead = `Exam preparation tips. ${activeNote.examNotes}`;
    } else if (detailTab === "easy") {
      textToRead = `Easy Metaphorical explanation. ${activeNote.easyExplanation}`;
    } else if (detailTab === "definitions") {
      textToRead = `Definitions included. ${activeNote.keyDefinitions
        .map((k) => `${k.term}, defined as: ${k.definition}`)
        .join(". ")}`;
    }
    SpeechEngine.speak(textToRead, voicePref);
  };

  // Multilingual translation & speech recitation engine
  const handleTranslateAndRecite = async () => {
    if (!activeNote) return;
    let textToTranslate = "";
    if (detailTab === "summary") {
      textToTranslate = activeNote.summary;
    } else if (detailTab === "bullets") {
      textToTranslate = activeNote.bulletPoints.join(". ");
    } else if (detailTab === "exam") {
      textToTranslate = activeNote.examNotes;
    } else if (detailTab === "easy") {
      textToTranslate = activeNote.easyExplanation;
    } else if (detailTab === "definitions") {
      textToTranslate = activeNote.keyDefinitions.map((k) => `${k.term}: ${k.definition}`).join(". ");
    }

    setTranslating(true);
    setTranslatedTextPopup(null);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: textToTranslate, targetLanguage: translationLanguage })
      });
      if (!response.ok) {
        throw new Error("Failed to translate via API");
      }
      const data = await response.json();
      const translation = data.translatedText;
      
      setTranslatedTextPopup(translation);
      
      // Select appropriate browser voice flag if available
      const voices = SpeechEngine.getAvailableVoices();
      let matchedVoice = "";
      const langLower = translationLanguage.toLowerCase();
      if (langLower.includes("spanish") || langLower.includes("es")) {
        matchedVoice = voices.find(v => v.lang.startsWith("es"))?.name || "";
      } else if (langLower.includes("french") || langLower.includes("fr")) {
        matchedVoice = voices.find(v => v.lang.startsWith("fr"))?.name || "";
      } else if (langLower.includes("japanese") || langLower.includes("ja")) {
        matchedVoice = voices.find(v => v.lang.startsWith("ja") || v.lang.startsWith("jp"))?.name || "";
      } else if (langLower.includes("german") || langLower.includes("de")) {
        matchedVoice = voices.find(v => v.lang.startsWith("de"))?.name || "";
      }

      SpeechEngine.speak(translation, {
        ...voicePref,
        voiceName: matchedVoice || voicePref.voiceName
      });
    } catch (err: any) {
      console.error("Translation failed:", err);
      SpeechEngine.speak("Sorry, translation encountered an issue. Let's study in primary english as default.", voicePref);
    } finally {
      setTranslating(false);
    }
  };

  // Helper to get cards currently scheduled in specific Leitner box
  const getLeitnerCardsForBox = (boxNum: number) => {
    if (!activeNote || !activeNote.keyDefinitions) return [];
    return activeNote.keyDefinitions.filter(def => {
      const b = leitnerBoxes[def.term] || 1;
      return b === boxNum;
    });
  };

  // Helper to record easy / forgot progress on Leitner quiz cards
  const handleLeitnerAnswer = (term: string, understood: boolean) => {
    const currentBox = leitnerBoxes[term] || 1;
    let nextBox = currentBox;
    if (understood) {
      nextBox = currentBox === 3 ? 3 : currentBox + 1;
      SpeechEngine.speak(`Excellent! Promoted ${term} to Box ${nextBox}.`, voicePref);
    } else {
      nextBox = 1;
      SpeechEngine.speak(`Returned ${term} to daily practice review Box 1.`, voicePref);
    }

    const updatedBoxes = { ...leitnerBoxes, [term]: nextBox };
    setLeitnerBoxes(updatedBoxes);
    localStorage.setItem("buddy_leitner_boxes", JSON.stringify(updatedBoxes));

    // Shift to next flashcard element
    setIsDefinitionVisible(false);
    setCurrentFlashcardIndex((prev) => prev + 1);
  };

  // Export File format
  const handleDownloadTxt = () => {
    if (!activeNote) return;

    const fileText = `
=========================================
ACCESSIBLE STUDY BUDDY UNIT LESSON
Title: ${activeNote.title}
=========================================

1. SUMMARY OVERVIEW:
${activeNote.summary}

2. DETAILED EXAM CHEAT NOTES:
${activeNote.examNotes}

3. SIMPLIFIED ANALOGY:
${activeNote.easyExplanation}

4. INCLUDED DEFINITIONS:
${activeNote.keyDefinitions.map((d) => `* ${d.term}: ${d.definition}`).join("\n")}
    `;

    const blob = new Blob([fileText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${activeNote.title.replace(/\s+/g, "_")}_lesson.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    SpeechEngine.speak(`Notes downloaded as raw text sheet file.`, voicePref);
  };

  const handlePrintPdf = () => {
    if (!activeNote) return;
    window.print();
    SpeechEngine.speak("Opening native printer utility. Let's export your study guides as a physical document or PDF.", voicePref);
  };

  return (
    <div id="notes-module" className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
      
      {/* LEFT FORM COLUMN - Lesson submission with full Drag & Drop & PDF viewer integration */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Unit Submission & Parser Form */}
        <div className="bg-white rounded-3xl p-6 border border-[#0F766E]/10 space-y-4 shadow-sm relative overflow-hidden">
          
          <div className="flex items-center justify-between border-b border-[#0F766E]/15 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#0F766E]/10 rounded-lg text-[#0F766E]">
                <Upload className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-[#134E4A] uppercase tracking-wider">
                Upload & Convert (Phase 4)
              </h3>
            </div>
            <span className="bg-emerald-500/10 text-emerald-700 text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
              PDF/Text Engine Ready
            </span>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl flex items-center gap-2 border border-red-100 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {/* DRAG AND DROP ZONE */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragging 
                ? "border-[#14B8A6] bg-[#14B8A6]/10 scale-95" 
                : "border-[#0F766E]/20 hover:border-[#0F766E] bg-[#FFFBF5]/90 hover:bg-[#14B8A6]/5"
            }`}
          >
            <input
              type="file"
              accept=".pdf,.txt,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="space-y-2 pointer-events-none">
              <div className="p-3 bg-white/80 rounded-full inline-block shadow-xs">
                <FileText className={`w-8 h-8 ${isDragging ? "text-[#14B8A6] animate-bounce" : "text-[#0F766E]"}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#134E4A]">
                  Drag and drop academic PDF or Text here
                </p>
                <p className="text-[10px] text-gray-400 font-semibold mt-1">
                  Supports .pdf, .txt formats — Max 10MB
                </p>
              </div>
            </div>
          </div>

          {/* DYNAMIC COMPREHENSIVE PDF TEXTBOOK PREVIEW PANE (Phase 4 interactive requirement) */}
          {uploadedPdf && (
            <div className="border border-[#0F766E]/15 bg-white/80 backdrop-blur-md rounded-2xl p-4 space-y-3 animate-fadeIn">
              
              {/* Document bar */}
              <div className="flex justify-between items-center bg-[#FFFBF5] p-2.5 rounded-xl border border-tan/30 text-xs">
                <div>
                  <h4 className="font-black text-[#134E4A] truncate max-w-[180px]">{uploadedPdf.name}</h4>
                  <span className="text-[9px] text-[#0F766E]/80 font-bold uppercase">{uploadedPdf.size} • {uploadedPdf.pagesCount} Pages</span>
                </div>
                <button
                  id="btn-remove-pdf"
                  onClick={() => {
                    setUploadedPdf(null);
                    setTitle("");
                    setContent("");
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 cursor-pointer"
                  title="Remove document file context"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* View options and Scaling controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0F766E]/5 pb-2 text-[11px] font-bold">
                
                {/* View switcher code */}
                <div className="flex bg-[#FFFBF5] rounded-lg p-0.5 border border-tan/30">
                  <button
                    id="btn-pdf-view-visual"
                    type="button"
                    onClick={() => setPdfViewMode("visual")}
                    className={`px-2 py-1 rounded-md cursor-pointer transition-all ${pdfViewMode === "visual" ? "bg-[#0F766E] text-white" : "text-[#134E4A]/80 hover:bg-[#0F766E]/5"}`}
                  >
                    Visual PDF
                  </button>
                  <button
                    id="btn-pdf-view-raw"
                    type="button"
                    onClick={() => setPdfViewMode("raw")}
                    className={`px-2 py-1 rounded-md cursor-pointer transition-all ${pdfViewMode === "raw" ? "bg-[#0F766E] text-white" : "text-[#134E4A]/80 hover:bg-[#0F766E]/5"}`}
                  >
                    Plain Extract
                  </button>
                </div>

                {/* Scaling */}
                <div className="flex items-center gap-1.5 bg-[#FFFBF5] rounded-lg p-1 px-2 border border-tan/30">
                  <button 
                    id="btn-pdf-zoom-out"
                    type="button" 
                    onClick={() => setPdfZoom(Math.max(80, pdfZoom - 10))} 
                    className="p-0.5 hover:bg-gray-200 rounded-md cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] w-8 text-center">{pdfZoom}%</span>
                  <button 
                    id="btn-pdf-zoom-in"
                    type="button" 
                    onClick={() => setPdfZoom(Math.min(150, pdfZoom + 10))} 
                    className="p-0.5 hover:bg-gray-200 rounded-md cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

              {/* Highlighter Tool Select Palette (Excellent support for accessibility!) */}
              <div className="flex items-center gap-2 text-xs bg-amber-500/5 p-2 rounded-xl border border-amber-200/40">
                <span className="font-extrabold text-[#134E4A]">Highlighter Pen:</span>
                <div className="flex items-center gap-1.5">
                  {[
                    { color: "bg-yellow-200", label: "Yellow", value: "yellow" },
                    { color: "bg-emerald-200", label: "Green", value: "green" },
                    { color: "bg-pink-300", label: "Pink", value: "pink" }
                  ].map((colorObj) => {
                    const isSelected = pdfActiveHighlightColor === colorObj.value;
                    return (
                      <button
                        id={`btn-highlighter-${colorObj.value}`}
                        key={colorObj.value}
                        type="button"
                        onClick={() => {
                          const nextVal = isSelected ? null : colorObj.value;
                          setPdfActiveHighlightColor(nextVal);
                          SpeechEngine.speak(nextVal ? `${colorObj.label} highlighter activated.` : "Highlighter disabled.", voicePref);
                        }}
                        className={`w-5 h-5 rounded-full ${colorObj.color} border transition-all cursor-pointer ${
                          isSelected ? "border-amber-600 scale-120 ring-2 ring-amber-400/20" : "border-slate-300"
                        }`}
                        title={`${colorObj.label} highlighter tool`}
                      />
                    );
                  })}
                </div>
                {pdfActiveHighlightColor && (
                  <span className="text-[10px] text-amber-700 font-extrabold blink">Active</span>
                )}
              </div>

              {/* TEXTBOOK VISUAL PAGE CONTENT CARRIER CONTAINER */}
              <div className="bg-[#FFFBF5] border border-orange-50 rounded-xl p-3 max-h-56 overflow-y-auto relative shadow-inner">
                {pdfViewMode === "visual" ? (
                  <div 
                    className="space-y-3 p-1 font-sans text-xs leading-relaxed text-[#134E4A]/95"
                    style={{ fontSize: `${pdfZoom}%` }}
                  >
                    {/* Dynamic Textbook visual columns render pages based on uploadedPdf */}
                    <div className="border-b border-[#0F766E]/10 pb-1 mb-2 flex justify-between items-center text-[10px] font-mono text-[#0F766E]/70 uppercase tracking-widest font-bold">
                      <span>TEXTBOOK PREVIEW CHAPTER</span>
                      <span>PAGE {uploadedPdf.currentPage} OF {uploadedPdf.pagesCount}</span>
                    </div>

                    <div className="space-y-2">
                      {(() => {
                        const pageText = uploadedPdf.pages?.[uploadedPdf.currentPage - 1] || uploadedPdf.text || "";
                        // Split page text into sentences/paragraphs dynamically for highlighting
                        const sentences = pageText.match(/[^.!?]+[.!?]+(\s+|$)/g) || [pageText];
                        
                        const paragraphsList: string[] = [];
                        for (let i = 0; i < sentences.length; i += 2) {
                          const combo = (sentences[i] || "") + (sentences[i+1] || "");
                          if (combo.trim()) {
                            paragraphsList.push(combo.trim());
                          }
                        }

                        if (paragraphsList.length === 0) {
                          return <p className="text-gray-400 italic">No readable character nodes on this page.</p>;
                        }

                        return paragraphsList.map((paraVal, idx) => {
                          const isHighlighted = (highlights[uploadedPdf.currentPage] || []).includes(paraVal);
                          return (
                            <p
                              key={idx}
                              onClick={() => toggleTextHighlight(paraVal)}
                              className={`cursor-pointer select-none rounded p-1.5 transition-all text-justify hover:bg-[#0F766E]/5 ${
                                isHighlighted ? "bg-yellow-200/90 shadow-2xs border border-yellow-300" : ""
                              }`}
                            >
                              {paraVal}
                            </p>
                          );
                        });
                      })()}
                    </div>

                  </div>
                ) : (
                  <pre className="text-[10px] leading-relaxed select-text font-mono text-[#134E4A] whitespace-pre-wrap">
                    {uploadedPdf.text}
                  </pre>
                )}
              </div>

              {/* PDF Paginate Bottom Control panel */}
              <div className="flex justify-between items-center text-xs text-[#0F766E] font-bold">
                <button
                  id="btn-pdf-prev-page"
                  type="button"
                  disabled={uploadedPdf.currentPage <= 1}
                  onClick={() => {
                    const nextPage = uploadedPdf.currentPage - 1;
                    setUploadedPdf({ ...uploadedPdf, currentPage: nextPage });
                    SpeechEngine.speak(`Navigated to page ${nextPage}.`, voicePref);
                  }}
                  className="px-2.5 py-1.5 bg-[#FFFBF5] hover:bg-[#0F766E]/10 border border-[#0F766E]/10 rounded-xl flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <span className="font-black">Page {uploadedPdf.currentPage} / {uploadedPdf.pagesCount}</span>
                <button
                  id="btn-pdf-next-page"
                  type="button"
                  disabled={uploadedPdf.currentPage >= uploadedPdf.pagesCount}
                  onClick={() => {
                    const nextPage = uploadedPdf.currentPage + 1;
                    setUploadedPdf({ ...uploadedPdf, currentPage: nextPage });
                    SpeechEngine.speak(`Navigated to page ${nextPage}.`, voicePref);
                  }}
                  className="px-2.5 py-1.5 bg-[#FFFBF5] hover:bg-[#0F766E]/10 border border-[#0F766E]/10 rounded-xl flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          )}

          {/* Core Notes Generation Inputs Form */}
          <form onSubmit={handleGenerateNotes} className="space-y-4">
            
            {/* Title text input */}
            <div>
              <label htmlFor="notes-title" className="block text-xs font-bold text-[#134E4A]/70 uppercase tracking-wider mb-1">
                Lesson / Textbook Title
              </label>
              <input
                id="notes-title"
                type="text"
                required
                placeholder="e.g. Biology Unit 3: Human Circulation"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-[#FFFBF5] border border-[#0F766E]/10 focus:outline-none focus:border-[#0F766E] rounded-xl text-[#134E4A]"
              />
            </div>

            {/* Paste content key text area */}
            <div>
              <label htmlFor="notes-content" className="block text-xs font-bold text-[#134E4A]/70 uppercase tracking-wider mb-1">
                Extracted Lesson content
              </label>
              <textarea
                id="notes-content"
                required
                rows={5}
                placeholder="Paste paragraph curriculum, textbook content, or notes here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-4 text-xs bg-[#FFFBF5] border border-[#0F766E]/10 focus:outline-none focus:border-[#0F766E] rounded-xl text-[#134E4A] leading-relaxed resize-none"
              />
            </div>

            {/* Simulated Stage progress indicators bar during notes transformation */}
            {loadingGenerate && (
              <div className="space-y-2 p-3 bg-teal-500/5 rounded-2xl border border-teal-200/30 animate-pulse">
                <div className="flex justify-between text-xs font-bold text-[#0F766E]">
                  <span>{progressStatus}</span>
                  <span>{generateProgress}%</span>
                </div>
                <div className="w-full bg-[#FFFBF5] h-2.5 rounded-full overflow-hidden border border-[#0F766E]/10 shadow-inner">
                  <div className="bg-[#14B8A6] h-full transition-all duration-300" style={{ width: `${generateProgress}%` }} />
                </div>
                <div className="flex items-center gap-1.5 text-[9.5px] text-teal-700 font-extrabold uppercase">
                  <Info className="w-3 h-3 text-[#0F766E]" /> Generative AI model is compiling interactive learning materials.
                </div>
              </div>
            )}

            {/* Submit study notes button */}
            <button
              id="notes-btn-generate"
              type="submit"
              disabled={loadingGenerate || isUploadingFile}
              className="w-full py-3 bg-[#0F766E] text-white font-extrabold rounded-xl text-xs shadow-xs hover:bg-[#134E4A] transition-all disabled:opacity-50 cursor-pointer flex justify-center items-center gap-2 uppercase tracking-wide"
            >
              <Sparkles className="w-4.5 h-4.5" />
              {loadingGenerate ? "Synthesizing AI study package..." : "Generate Custom AI Study Pack"}
            </button>

          </form>

        </div>

        {/* SAVED NOTES CATALOGUE PANEL */}
        <div className="bg-white p-6 rounded-3xl border border-[#0F766E]/10 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#134E4A] uppercase tracking-wider">
              Saved Lesson units ({notes.length})
            </h3>
            <span className="bg-emerald-500/10 text-emerald-800 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase">
              Relational DB
            </span>
          </div>
          
          {loadingList ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : notes.length > 0 ? (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {notes.map((note) => {
                const isActive = activeNote?.id === note.id;
                return (
                  <button
                    id={`notes-catalog-item-${note.id}`}
                    key={note.id}
                    onClick={() => {
                      setActiveNote(note);
                      if (voicePref.enabled) {
                        SpeechEngine.speak(`Viewing ${note.title} note.`, voicePref);
                      }
                    }}
                    onMouseEnter={() => handleMouseEnterText(`Note: ${note.title}`)}
                    className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer border flex items-center justify-between gap-2.5 truncate ${
                      isActive
                        ? "bg-[#14B8A6]/10 border-[#14B8A6] text-[#0F766E] font-extrabold"
                        : "border-[#0F766E]/5 hover:bg-[#FFFBF5] text-[#134E4A]/80 font-bold"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FileText className={`w-4 h-4 shrink-0 ${isActive ? "text-[#0F766E]" : "text-gray-400"}`} />
                      <span className="text-xs truncate">{note.title}</span>
                    </div>
                    {isActive && <Check className="w-3.5 h-3.5 text-[#0F766E] shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 bg-slate-500/5 rounded-2xl">
              <BookOpen className="w-8 h-8 text-[#134E4A]/25 mx-auto mb-1.5" />
              <p className="text-xs text-[#134E4A]/60 font-semibold">Your study catalogue is empty.</p>
            </div>
          )}
        </div>

      </div>

      {/* RIGHT COLUMN - Generated Study buddy notes details tab pane */}
      <div className="lg:col-span-7">
        
        {activeNote ? (
          <div className="bg-white rounded-3xl border border-[#0F766E]/10 overflow-hidden shadow-sm">
            
            {/* Header detail bar */}
            <div className="p-6 bg-[#FFFBF5] border-b border-[#0F766E]/5 flex flex-col sm:flex-row sm:items-center sm:justify-between justify-center gap-4">
              <div>
                <span className="text-[10px] font-bold text-[#14B8A6] uppercase tracking-wider block">Generated Material Package</span>
                <h2 className="text-lg font-black text-[#134E4A] line-clamp-2">{activeNote.title}</h2>
              </div>
              
              {/* Core Recitation & Print/Export actions controls */}
              <div className="flex gap-1.5 shrink-0">
                
                {/* Speech Synthesis play trigger */}
                <button
                  id="notes-btn-recite"
                  onClick={handleReadActiveSegment}
                  className="p-2.5 bg-[#0F766E] text-white hover:bg-[#134E4A] rounded-xl flex items-center gap-1 text-[11px] font-black cursor-pointer uppercase tracking-wider shadow-xs"
                  title="Speak out active slide info"
                >
                  <Volume2 className="w-4 h-4" /> Recite Aloud
                </button>
                
                {/* Stop Speech */}
                <button
                  id="notes-btn-stop"
                  onClick={() => SpeechEngine.stop()}
                  className="p-2.5 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl flex items-center justify-center cursor-pointer"
                  title="Mute current voice speaker"
                >
                  <StopCircle className="w-4.5 h-4.5" />
                </button>

                {/* Custom Multilingual Audio Translation Selector */}
                <div className="flex items-center gap-1 border border-[#0F766E]/20 bg-[#FFFBF5] rounded-xl px-2 py-0.5">
                  <select
                    value={translationLanguage}
                    onChange={(e) => setTranslationLanguage(e.target.value)}
                    className="text-[10px] font-bold bg-transparent border-none text-[#134E4A] focus:outline-none cursor-pointer"
                    title="Select translation language"
                  >
                    <option value="Spanish">Spanish 🇪🇸</option>
                    <option value="French">French 🇫🇷</option>
                    <option value="Japanese">Japanese 🇯🇵</option>
                    <option value="German">German 🇩🇪</option>
                  </select>
                  <button
                    onClick={handleTranslateAndRecite}
                    disabled={translating}
                    className="px-2.5 py-1 bg-[#14B8A6] hover:bg-[#0F766E] disabled:opacity-50 text-white rounded-lg text-[10px] font-extrabold uppercase shrink-0 transition-colors cursor-pointer"
                    title="Translate and Recite aloud in chosen language"
                  >
                    {translating ? "..." : "🔊 Translate"}
                  </button>
                </div>

                {/* Print standard visual (PDF format generator) */}
                <button
                  id="notes-btn-print"
                  onClick={handlePrintPdf}
                  className="p-2.5 border border-[#0F766E]/25 text-[#0F766E] hover:bg-[#14B8A6]/10 rounded-xl cursor-pointer"
                  title="Print custom notes page perfectly"
                >
                  <Printer className="w-4.5 h-4.5" />
                </button>

                {/* TXT Download file block */}
                <button
                  id="notes-btn-download-txt"
                  onClick={handleDownloadTxt}
                  className="p-2.5 border border-gray-200 text-gray-700 hover:bg-[#FFFBF5] rounded-xl cursor-pointer font-bold text-[11px]"
                  title="Download unit notes to local TXT format"
                >
                  TXT
                </button>

              </div>
            </div>

            {/* Navigation tabs row */}
            <div className="flex border-b border-[#0F766E]/10 overflow-x-auto bg-[#FFFBF5]/30">
              {[
                { id: "summary", label: "1. Summary" },
                { id: "bullets", label: "2. Key Points" },
                { id: "exam", label: "3. Exam Cheat" },
                { id: "easy", label: "4. Easy Explanation" },
                { id: "definitions", label: "5. Definitions Dictionary" },
              ].map((tab) => {
                const isActive = detailTab === tab.id;
                return (
                  <button
                    id={`notes-detail-tab-${tab.id}`}
                    key={tab.id}
                    onClick={() => {
                      setDetailTab(tab.id as any);
                      if (voicePref.enabled) {
                        SpeechEngine.speak(`Viewing ${tab.label}.`, voicePref);
                      }
                    }}
                    className={`py-3 px-5 text-xs font-extrabold border-b-2 whitespace-nowrap cursor-pointer transition-all ${
                      isActive
                        ? "border-[#0F766E] text-[#0F766E] bg-white font-black"
                        : "border-transparent text-[#134E4A]/60 hover:text-[#0F766E] hover:bg-[#FFFBF5]/20"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content display frame */}
            <div className="p-6 md:p-8 min-h-96 text-[#134E4A]/90">
              
              {/* PRINT ELEMENT STYLING - Hidden on screen, visible during printing */}
              <div className="hidden print:block space-y-6 text-[#134E4A]">
                <div className="border-b-2 border-[#0F766E] pb-2 mb-6">
                  <h1 className="text-2xl font-black">{activeNote.title}</h1>
                  <p className="text-xs font-bold text-[#0F766E] uppercase tracking-widest">Study Guide Lesson Workbook</p>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-bold border-b border-[#0F766E]/20 uppercase">I. Chapter Summary Outline</h3>
                  <p className="text-xs leading-relaxed">{activeNote.summary}</p>
                  
                  <h3 className="text-sm font-bold border-b border-[#0F766E]/20 mt-6 uppercase">II. Important Highlight Points</h3>
                  <ul className="list-disc pl-5 text-xs space-y-1">
                    {activeNote.bulletPoints.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>

                  <h3 className="text-sm font-bold border-b border-[#0F766E]/20 mt-6 uppercase">III. Simplified Metaphorical Analogy</h3>
                  <p className="text-xs leading-relaxed italic">{activeNote.easyExplanation}</p>

                  <h3 className="text-sm font-bold border-b border-[#0F766E]/20 mt-6 uppercase">IV. Exam Cheat Sheet Cues</h3>
                  <p className="text-xs leading-relaxed">{activeNote.examNotes}</p>

                  <h3 className="text-sm font-bold border-b border-[#0F766E]/20 mt-6 uppercase">V. Active Definitions Dictionary</h3>
                  <div className="space-y-4">
                    {activeNote.keyDefinitions.map((d, i) => (
                      <div key={i} className="text-xs"><strong className="text-[#0F766E]">{d.term}:</strong> {d.definition}</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* SCREEN-ONLY VIEW INTERACTIVE LAYOUTS */}
              <div className="print:hidden">

                {translatedTextPopup && (
                  <div className="mb-6 p-4 rounded-2xl bg-teal-50 border border-teal-200 text-[#134E4A] relative animate-fadeIn">
                    <button
                      onClick={() => setTranslatedTextPopup(null)}
                      className="absolute top-2 right-2 text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
                    >
                      Dismiss ✕
                    </button>
                    <span className="text-[10px] font-bold text-[#0F766E] uppercase tracking-wider block mb-1">
                      🗣️ AI Audio Guide Translation ({translationLanguage})
                    </span>
                    <p className="text-xs leading-relaxed font-semibold">
                      {translatedTextPopup}
                    </p>
                  </div>
                )}
                
                {/* 1. Summary overview page */}
                {detailTab === "summary" && (
                  <div className="space-y-4 animate-fadeIn" onMouseEnter={() => handleMouseEnterText(activeNote.summary)}>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-[#0F766E]" />
                      <h3 className="text-sm font-extrabold text-[#0F766E] uppercase tracking-wider">Chapter Summary Outline</h3>
                    </div>
                    <div className="h-0.5 bg-gradient-to-r from-[#0F766E]/10 to-transparent w-full" />
                    <p className="text-xs leading-relaxed font-semibold text-gray-700 whitespace-pre-line bg-[#FFFBF5]/40 p-4 rounded-2xl border border-orange-50">
                      {activeNote.summary}
                    </p>
                  </div>
                )}

                {/* 2. Interactive Key highlight points (with Mastery checklist tracker checks) */}
                {detailTab === "bullets" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-[#0F766E]" />
                        <h3 className="text-sm font-extrabold text-[#0F766E] uppercase tracking-wider">Interactive Study Highlights</h3>
                      </div>
                      <span className="text-[10px] text-[#0F766E] font-black uppercase tracking-wider">Click row to mark mastered</span>
                    </div>
                    <div className="h-0.5 bg-gradient-to-r from-[#0F766E]/10 to-transparent w-full" />
                    
                    <ul className="space-y-3">
                      {activeNote.bulletPoints.map((point, index) => {
                        const isMastered = !!masteredBullets[point];
                        return (
                          <li 
                            key={index} 
                            onClick={() => {
                              const nextState = !isMastered;
                              setMasteredBullets({ ...masteredBullets, [point]: nextState });
                              SpeechEngine.speak(nextState ? "Marked highlight point as mastered." : "Highlight point marked for review study.", voicePref);
                            }}
                            className={`flex items-start gap-3 text-xs font-semibold p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                              isMastered 
                                ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-900" 
                                : "bg-[#FFFBF5] border-[#0F766E]/5 text-gray-700 hover:bg-teal-50/10"
                            }`}
                            onMouseEnter={() => handleMouseEnterText(point)}
                          >
                            <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center border shrink-0 mt-0.5 transition-all ${
                              isMastered ? "bg-emerald-600 border-emerald-700 text-white" : "border-gray-400 bg-white"
                            }`}>
                              {isMastered && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={isMastered ? "line-through opacity-75" : ""}>{point}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* 3. Detailed exam cheat sheet notes */}
                {detailTab === "exam" && (
                  <div className="space-y-4 animate-fadeIn" onMouseEnter={() => handleMouseEnterText(activeNote.examNotes)}>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <h3 className="text-sm font-extrabold text-[#0F766E] uppercase tracking-wider">Exam Cues & Takeaways Cheat Sheet</h3>
                    </div>
                    <div className="h-0.5 bg-gradient-to-r from-[#0F766E]/10 to-transparent w-full" />
                    
                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 relative">
                      <p className="text-xs leading-relaxed text-[#134E4A] font-bold whitespace-pre-line">
                        {activeNote.examNotes}
                      </p>
                    </div>
                  </div>
                )}

                {/* 4. Easy metaphors block for accessibility learning needs */}
                {detailTab === "easy" && (
                  <div className="space-y-4 animate-fadeIn" onMouseEnter={() => handleMouseEnterText(activeNote.easyExplanation)}>
                    <div className="flex items-center gap-2">
                      <span className="p-1 px-1.5 bg-sky-100 text-sky-700 rounded-lg text-xs">💡</span>
                      <h3 className="text-sm font-extrabold text-[#0F766E] uppercase tracking-wider">Conversational Explanation metamodel</h3>
                    </div>
                    <span className="text-[10px] text-[#0F766E] block font-extrabold uppercase mt-0.5">Perfect for screen readers or simplified study sessions</span>
                    <div className="h-0.5 bg-gradient-to-r from-[#0F766E]/10 to-transparent w-full" />
                    
                    <div className="p-5 rounded-2xl bg-sky-500/5 border border-sky-400/20">
                      <p className="text-xs leading-relaxed text-sky-950 font-bold italic">
                        "{activeNote.easyExplanation}"
                      </p>
                    </div>
                    {/* 5. Key definitions dynamic flash dictionaries / Leitner flashcards */}
                {detailTab === "definitions" && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-[#0F766E]" />
                        <h3 className="text-sm font-extrabold text-[#0F766E] uppercase tracking-wider font-sans">
                          Definitions Dictionary
                        </h3>
                      </div>
                      
                      {/* Active Leitner Toggles */}
                      <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
                        <button
                          onClick={() => {
                            setIsLeitnerMode(false);
                            SpeechEngine.speak("Switched to standard definition dictionary mode.", voicePref);
                          }}
                          className={`px-3 py-1.5 text-[10px] uppercase font-black tracking-widest rounded-lg cursor-pointer transition-colors ${
                            !isLeitnerMode
                              ? "bg-white text-[#0F766E] shadow-xs cursor-pointer"
                              : "text-gray-500 hover:text-[#0F766E]"
                          }`}
                        >
                          📚 Dictionary List
                        </button>
                        <button
                          onClick={() => {
                            setIsLeitnerMode(true);
                            setCurrentFlashcardIndex(0);
                            setIsDefinitionVisible(false);
                            SpeechEngine.speak("Welcome to your Leitner Spaced Repetition flashcard trainer! Review daily cards in Box 1.", voicePref);
                          }}
                          className={`px-3 py-1.5 text-[10px] uppercase font-black tracking-widest rounded-lg cursor-pointer transition-colors ${
                            isLeitnerMode
                              ? "bg-white text-[#0F766E] shadow-xs cursor-pointer"
                              : "text-gray-500 hover:text-[#0F766E]"
                          }`}
                        >
                          🧠 Leitner Trainer
                        </button>
                      </div>
                    </div>

                    {!isLeitnerMode ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeNote.keyDefinitions.map((def, idx) => (
                          <div
                            key={idx}
                            onMouseEnter={() => handleMouseEnterText(`${def.term}: ${def.definition}`)}
                            className="p-4 rounded-2xl border border-[#0F766E]/10 bg-[#FFFBF5] hover:border-[#0F766E] hover:bg-white transition-all space-y-1.5 relative group"
                          >
                            <span className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-widest font-mono">TERM DEFINED</span>
                            <h4 className="text-xs uppercase tracking-widest font-black text-[#0F766E]">
                              {def.term}
                            </h4>
                            <p className="text-xs text-[#134E4A]/80 leading-relaxed font-semibold">
                              {def.definition}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Leitner Spaced Repetition Workspace view
                      <div className="space-y-6">
                        {/* Leitner Box Selectors Tabs */}
                        <div className="grid grid-cols-3 gap-2">
                          {[1, 2, 3].map((boxNum) => {
                            const count = getLeitnerCardsForBox(boxNum).length;
                            const isActive = currentLeitnerBox === boxNum;
                            return (
                              <button
                                key={boxNum}
                                onClick={() => {
                                  setCurrentLeitnerBox(boxNum);
                                  setCurrentFlashcardIndex(0);
                                  setIsDefinitionVisible(false);
                                  SpeechEngine.speak(`Viewing Leitner Box ${boxNum}. It contains ${count} study cards to recall.`, voicePref);
                                }}
                                className={`p-2.5 rounded-2xl border text-center cursor-pointer transition-all ${
                                  isActive
                                    ? "bg-[#0F766E] text-white border-[#0F766E] font-black shadow-xs cursor-pointer"
                                    : "bg-[#FFFBF5] hover:bg-amber-50 text-[#134E4A] border-[#0F766E]/10"
                                }`}
                              >
                                <span className="block text-[10px] font-black uppercase tracking-wider">
                                  Box {boxNum === 1 ? "1 (Daily)" : boxNum === 2 ? "2 (3 Days)" : "3 (Mastered)"}
                                </span>
                                <span className="text-[11px] font-bold block mt-0.5">
                                  {count} {count === 1 ? "card" : "cards"}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Flashcard Active Panel Card */}
                        {(() => {
                          const activeBoxCards = getLeitnerCardsForBox(currentLeitnerBox);
                          if (activeBoxCards.length === 0) {
                            return (
                              <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-8 text-center space-y-2 animate-fadeIn">
                                <span className="text-2xl">🎉</span>
                                <h4 className="text-sm font-black text-emerald-900 uppercase">Box {currentLeitnerBox} Empty!</h4>
                                <p className="text-xs text-emerald-800 font-semibold max-w-sm mx-auto">
                                  No cards scheduled in this box. Keep testing your memory recall to build permanent neural pathways!
                                </p>
                              </div>
                            );
                          }

                          const safeIndex = currentFlashcardIndex % activeBoxCards.length;
                          const card = activeBoxCards[safeIndex];

                          return (
                            <div className="bg-[#FFFBF5] border border-[#0F766E]/15 rounded-3xl p-6 md:p-8 hover:border-[#0F766E] transition-all space-y-6">
                              <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                <span>Playing Leitner Flashcards</span>
                                <span>Card {safeIndex + 1} of {activeBoxCards.length}</span>
                              </div>

                              <div className="space-y-4 text-center py-6">
                                <span className="text-[10px] text-teal-800 font-extrabold uppercase tracking-widest block">FRONT OF FLASHCARD</span>
                                <h3 className="text-md font-black text-[#134E4A] tracking-wider uppercase">
                                  {card.term}
                                </h3>

                                <div className="h-px bg-dashed border-gray-200/60 my-6" />

                                {isDefinitionVisible ? (
                                  <div className="space-y-1 animate-fadeIn">
                                    <span className="text-[10px] text-emerald-700 font-black uppercase tracking-widest block">REVEALED DEFINITION</span>
                                    <p className="text-xs text-[#134E4A] font-semibold leading-relaxed max-w-xl mx-auto">
                                      {card.definition}
                                    </p>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setIsDefinitionVisible(true);
                                      SpeechEngine.speak(card.term + ", defined as: " + card.definition, voicePref);
                                    }}
                                    className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-colors cursor-pointer"
                                  >
                                    🔍 Reveal Definition
                                  </button>
                                )}
                              </div>

                              {isDefinitionVisible && (
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                  <button
                                    onClick={() => handleLeitnerAnswer(card.term, false)}
                                    className="p-3 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer transition-colors border border-red-200 text-center"
                                  >
                                    ❌ Forgot / Hard (To Box 1)
                                  </button>
                                  <button
                                    onClick={() => handleLeitnerAnswer(card.term, true)}
                                    className="p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer transition-colors border border-emerald-200 text-center"
                                  >
                                    ✓ Remembered / Easy (Box +1)
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Leitner boxes global stats summary */}
                        <div className="p-4 rounded-2xl bg-[#FFFBF5]/40 border border-slate-100 space-y-3">
                          <h4 className="text-[10px] font-black text-[#0F766E] uppercase tracking-widest">
                            🧠 Spaced Repetition Neural Mastery Dashboard
                          </h4>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-red-50 border border-red-100 rounded-xl p-2">
                              <span className="text-[9px] uppercase font-bold text-red-600 tracking-wider">Box 1 (Daily)</span>
                              <strong className="block text-[#134E4A] font-black mt-0.5">{getLeitnerCardsForBox(1).length}</strong>
                            </div>
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-2">
                              <span className="text-[9px] uppercase font-bold text-blue-600 tracking-wider">Box 2 (3 Days)</span>
                              <strong className="block text-[#134E4A] font-black mt-0.5">{getLeitnerCardsForBox(2).length}</strong>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2">
                              <span className="text-[9px] uppercase font-bold text-emerald-600 tracking-wider">Box 3 (Mastered)</span>
                              <strong className="block text-[#134E4A] font-black mt-0.5">{getLeitnerCardsForBox(3).length}</strong>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                )}                </div>
                )}

              </div>

            </div>

          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#0F766E]/10 p-12 text-center shadow-sm">
            <BookOpen className="w-16 h-16 text-[#134E4A]/25 mx-auto mb-4 animate-bounce" />
            <h3 className="text-sm font-extrabold text-[#134E4A] uppercase tracking-wider">No active converted unit</h3>
            <p className="text-xs text-[#134E4A]/60 max-w-sm mx-auto font-semibold leading-relaxed mt-1">
              Select or drop an academic textbook unit file inside the left uploader panel. The generative API will synthesize a comprehensive workspace containing summaries, metaphors, practice exams, and definitions.
            </p>
          </div>
        )}

      </div>

    </div>
  );
}
