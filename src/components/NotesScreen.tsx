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
import { useToast } from "./ui/Toast";
import { Skeleton } from "./ui/Skeleton";
import { EmptyState } from "./ui/EmptyState";

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

  // Note detail tab
  const [detailTab, setDetailTab] = useState<"summary" | "detailed" | "revision" | "formulas" | "questions" | "flashcards" | "mindmap">("summary");

  // Interactive note items mastery checklist state (Phase 4 interactivity additions)
  const [masteredBullets, setMasteredBullets] = useState<Record<string, boolean>>({});

  const { addToast } = useToast();

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
        addToast("Failed to load notes", "error");
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
      addToast(`Extraction failed: ${err.message}`, "error");
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
      addToast("Failed to read file", "error");
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

  const startNotesGeneration = async (targetTitle: string, targetContent: string, fileData?: File) => {
    setError("");
    setLoadingGenerate(true);
    setGenerateProgress(10);
    setProgressStatus("Connecting to pipeline...");

    try {
      // Setup FormData
      const formData = new FormData();
      formData.append("title", targetTitle);
      if (fileData) {
        formData.append("file", fileData);
      } else {
        formData.append("content", targetContent);
      }

      // Fetch with SSE wrapper
      const response = await fetch("/api/notes/generate-advanced", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok || !response.body) {
        throw new Error("Pipeline connection failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let finalNote = null;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          
          let eventIndex;
          while ((eventIndex = buffer.indexOf("\n\n")) !== -1) {
            const eventBlock = buffer.slice(0, eventIndex);
            buffer = buffer.slice(eventIndex + 2);
            
            let currentEvent = "";
            let currentData = "";
            
            const lines = eventBlock.split("\n");
            for (const line of lines) {
              if (line.startsWith("event: ")) {
                currentEvent = line.substring(7).trim();
              } else if (line.startsWith("data: ")) {
                currentData += line.substring(6);
              }
            }
            
            if (currentEvent && currentData) {
              try {
                const payload = JSON.parse(currentData);
                if (currentEvent === "progress") {
                  setGenerateProgress(payload.progress);
                  setProgressStatus(payload.stage);
                } else if (currentEvent === "complete") {
                  finalNote = payload.note;
                } else if (currentEvent === "error") {
                  throw new Error(payload.message);
                }
              } catch (e: any) {
                if (currentEvent === "error") throw e; // Rethrow actual errors
                // Ignore JSON parse errors for incomplete data if any
              }
            }
          }
        }
      }

      if (finalNote) {
        setTimeout(() => {
          SpeechEngine.speak(`Notes generated successfully. ${finalNote.title} ready for study review.`, voicePref);
          setTitle("");
          setContent("");
          setUploadedPdf(null);
          setActiveNote(finalNote);
          fetchNotes();
          setLoadingGenerate(false);
          setGenerateProgress(0);

          window.dispatchEvent(new CustomEvent("voice-create-notes-completed", { detail: { note: finalNote } }));
        }, 500);
      } else {
        throw new Error("Pipeline did not return final structure.");
      }

    } catch (err: any) {
      console.warn("Advanced generation failed, attempting fallback:", err);
      try {
        const res = await fetch("/api/notes/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: targetTitle, content: targetContent }),
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Fallback generation also failed.");
        }
        
        const finalNote = await res.json();
        
        setTimeout(() => {
          SpeechEngine.speak(`Notes generated successfully. ${finalNote.title} ready for study review.`, voicePref);
          setTitle("");
          setContent("");
          setUploadedPdf(null);
          setActiveNote(finalNote);
          fetchNotes();
          setLoadingGenerate(false);
          setGenerateProgress(0);
          window.dispatchEvent(new CustomEvent("voice-create-notes-completed", { detail: { note: finalNote } }));
        }, 500);
      } catch (fallbackErr: any) {
        console.error("Fallback error:", fallbackErr);
        setError(err.message || fallbackErr.message || "Failed to generate notes");
        addToast("Failed to generate notes", "error");
        setLoadingGenerate(false);
        setGenerateProgress(0);
      }
    }
  };

  // Submit parsed note block to database
  const handleGenerateNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    
    // We can extract the file directly from an input or use the uploadedPdf state
    // But since the actual file object is lost in uploadedPdf, we will just pass the extracted text.
    // If the user pastes text, we pass that.
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

  // Export DOCX File format
  const handleDownloadDocx = async () => {
    if (!activeNote) return;

    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({ text: activeNote.title, heading: HeadingLevel.HEADING_1 }),
              new Paragraph({ text: "SUMMARY", heading: HeadingLevel.HEADING_2 }),
              new Paragraph({ text: activeNote.summary || "" }),
              new Paragraph({ text: "IMPORTANT NOTES", heading: HeadingLevel.HEADING_2 }),
              ...(activeNote.important_notes || activeNote.bulletPoints || []).map(b => new Paragraph({ text: `• ${b}` })),
              new Paragraph({ text: "KEY CONCEPTS", heading: HeadingLevel.HEADING_2 }),
              ...(activeNote.key_concepts || []).map(c => new Paragraph({ children: [new TextRun({ text: `${c.concept}: `, bold: true }), new TextRun({ text: c.explanation })] })),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${activeNote.title.replace(/\s+/g, "_")}_lesson.docx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      SpeechEngine.speak(`Notes downloaded as DOCX file.`, voicePref);
    } catch (err) {
      console.error("DOCX export failed", err);
      addToast("Failed to export DOCX", "error");
      SpeechEngine.speak("DOCX export failed.", voicePref);
    }
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
        <div className="bg-white rounded-3xl p-6 border border-[#4338CA]/10 space-y-4 shadow-sm relative overflow-hidden">
          
          <div className="flex items-center justify-between border-b border-[#4338CA]/15 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#4338CA]/10 rounded-lg text-[#4338CA]">
                <Upload className="w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-[#312E81] uppercase tracking-wider">
                Upload & Convert (Phase 4)
              </h3>
            </div>
            <span className="bg-indigo-500/10 text-indigo-700 text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
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
                ? "border-[#6366F1] bg-[#6366F1]/10 scale-95" 
                : "border-[#4338CA]/20 hover:border-[#4338CA] bg-[#F8FAFC]/90 hover:bg-[#6366F1]/5"
            }`}
          >
            <input
              type="file"
              accept=".pdf,.txt,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
            <div className="space-y-2 pointer-events-none">
              <div className="p-3 bg-white/80 rounded-full inline-block shadow-xs">
                <FileText className={`w-8 h-8 ${isDragging ? "text-[#6366F1] animate-bounce" : "text-[#4338CA]"}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#312E81]">
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
            <div className="border border-[#4338CA]/15 bg-white/80 backdrop-blur-md rounded-2xl p-4 space-y-3 animate-fadeIn">
              
              {/* Document bar */}
              <div className="flex justify-between items-center bg-[#F8FAFC] p-2.5 rounded-xl border border-tan/30 text-xs">
                <div>
                  <h4 className="font-black text-[#312E81] truncate max-w-[180px]">{uploadedPdf.name}</h4>
                  <span className="text-[9px] text-[#4338CA]/80 font-bold uppercase">{uploadedPdf.size} • {uploadedPdf.pagesCount} Pages</span>
                </div>
                <button
                  id="btn-remove-pdf"
                  onClick={() => {
                    setUploadedPdf(null);
                    setTitle("");
                    setContent("");
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                  title="Remove document file context"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* View options and Scaling controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#4338CA]/5 pb-2 text-[11px] font-bold">
                
                {/* View switcher code */}
                <div className="flex bg-[#F8FAFC] rounded-lg p-0.5 border border-tan/30">
                  <button
                    id="btn-pdf-view-visual"
                    type="button"
                    onClick={() => setPdfViewMode("visual")}
                    className={`px-2 py-1 rounded-md cursor-pointer transition-all ${pdfViewMode === "visual" ? "bg-[#4338CA] text-white" : "text-[#312E81]/80 hover:bg-[#4338CA]/5"}`}
                  >
                    Visual PDF
                  </button>
                  <button
                    id="btn-pdf-view-raw"
                    type="button"
                    onClick={() => setPdfViewMode("raw")}
                    className={`px-2 py-1 rounded-md cursor-pointer transition-all ${pdfViewMode === "raw" ? "bg-[#4338CA] text-white" : "text-[#312E81]/80 hover:bg-[#4338CA]/5"}`}
                  >
                    Plain Extract
                  </button>
                </div>

                {/* Scaling */}
                <div className="flex items-center gap-1.5 bg-[#F8FAFC] rounded-lg p-1 px-2 border border-tan/30">
                  <button 
                    id="btn-pdf-zoom-out"
                    type="button" 
                    onClick={() => setPdfZoom(Math.max(80, pdfZoom - 10))} 
                    className="p-0.5 hover:bg-gray-200 rounded-md cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] w-8 text-center">{pdfZoom}%</span>
                  <button 
                    id="btn-pdf-zoom-in"
                    type="button" 
                    onClick={() => setPdfZoom(Math.min(150, pdfZoom + 10))} 
                    className="p-0.5 hover:bg-gray-200 rounded-md cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

              {/* Highlighter Tool Select Palette (Excellent support for accessibility!) */}
              <div className="flex items-center gap-2 text-xs bg-amber-500/5 p-2 rounded-xl border border-amber-200/40">
                <span className="font-extrabold text-[#312E81]">Highlighter Pen:</span>
                <div className="flex items-center gap-1.5">
                  {[
                    { color: "bg-yellow-200", label: "Yellow", value: "yellow" },
                    { color: "bg-indigo-200", label: "Green", value: "green" },
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
              <div className="bg-[#F8FAFC] border border-orange-50 rounded-xl p-3 max-h-56 overflow-y-auto relative shadow-inner">
                {pdfViewMode === "visual" ? (
                  <div 
                    className="space-y-3 p-1 font-sans text-xs leading-relaxed text-[#312E81]/95"
                    style={{ fontSize: `${pdfZoom}%` }}
                  >
                    {/* Dynamic Textbook visual columns render pages based on uploadedPdf */}
                    <div className="border-b border-[#4338CA]/10 pb-1 mb-2 flex justify-between items-center text-[10px] font-mono text-[#4338CA]/70 uppercase tracking-widest font-bold">
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
                              className={`cursor-pointer select-none rounded p-1.5 transition-all text-justify hover:bg-[#4338CA]/5 ${
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
                  <pre className="text-[10px] leading-relaxed select-text font-mono text-[#312E81] whitespace-pre-wrap">
                    {uploadedPdf.text}
                  </pre>
                )}
              </div>

              {/* PDF Paginate Bottom Control panel */}
              <div className="flex justify-between items-center text-xs text-[#4338CA] font-bold">
                <button
                  id="btn-pdf-prev-page"
                  type="button"
                  disabled={uploadedPdf.currentPage <= 1}
                  onClick={() => {
                    const nextPage = uploadedPdf.currentPage - 1;
                    setUploadedPdf({ ...uploadedPdf, currentPage: nextPage });
                    SpeechEngine.speak(`Navigated to page ${nextPage}.`, voicePref);
                  }}
                  className="px-2.5 py-1.5 bg-[#F8FAFC] hover:bg-[#4338CA]/10 border border-[#4338CA]/10 rounded-xl flex items-center gap-1 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
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
                  className="px-2.5 py-1.5 bg-[#F8FAFC] hover:bg-[#4338CA]/10 border border-[#4338CA]/10 rounded-xl flex items-center gap-1 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
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
              <label htmlFor="notes-title" className="block text-xs font-bold text-[#312E81]/70 uppercase tracking-wider mb-1">
                Lesson / Textbook Title
              </label>
              <input
                id="notes-title"
                type="text"
                required
                placeholder="e.g. Biology Unit 3: Human Circulation"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-[#F8FAFC] border border-[#4338CA]/10 focus:outline-none focus:border-[#4338CA] rounded-xl text-[#312E81]"
              />
            </div>

            {/* Paste content key text area */}
            <div>
              <label htmlFor="notes-content" className="block text-xs font-bold text-[#312E81]/70 uppercase tracking-wider mb-1">
                Extracted Lesson content
              </label>
              <textarea
                id="notes-content"
                required
                rows={5}
                placeholder="Paste paragraph curriculum, textbook content, or notes here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-4 text-xs bg-[#F8FAFC] border border-[#4338CA]/10 focus:outline-none focus:border-[#4338CA] rounded-xl text-[#312E81] leading-relaxed resize-none"
              />
            </div>

            {/* Simulated Stage progress indicators bar during notes transformation */}
            {loadingGenerate && (
              <div className="space-y-2 p-3 bg-indigo-500/5 rounded-[24px] border border-indigo-200/30 animate-pulse">
                <div className="flex justify-between text-xs font-bold text-[#4338CA]">
                  <span>{progressStatus}</span>
                  <span>{generateProgress}%</span>
                </div>
                <div className="w-full bg-[#F8FAFC] h-2.5 rounded-full overflow-hidden border border-[#4338CA]/10 shadow-inner">
                  <div className="bg-[#6366F1] h-full transition-all duration-300" style={{ width: `${generateProgress}%` }} />
                </div>
                <div className="flex items-center gap-1.5 text-[9.5px] text-indigo-700 font-extrabold uppercase">
                  <Info className="w-3 h-3 text-[#4338CA]" /> Generative AI model is compiling interactive learning materials.
                </div>
              </div>
            )}

            {/* Submit study notes button */}
            <button
              id="notes-btn-generate"
              type="submit"
              disabled={loadingGenerate || isUploadingFile}
              className="w-full py-3 bg-[#4338CA] text-white font-extrabold rounded-xl text-xs shadow-xs hover:bg-[#312E81] transition-all disabled:opacity-50 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 flex justify-center items-center gap-2 uppercase tracking-wide focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Sparkles className="w-4.5 h-4.5" />
              {loadingGenerate ? "Synthesizing AI study package..." : "Generate Custom AI Study Pack"}
            </button>

          </form>

        </div>

        {/* SAVED NOTES CATALOGUE PANEL */}
        <div className="card-soft p-6 rounded-3xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#312E81] uppercase tracking-wider">
              Saved Lesson units ({notes.length})
            </h3>
            <span className="bg-indigo-500/10 text-indigo-800 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase">
              Relational DB
            </span>
          </div>
          
          {loadingList ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-2xl" />
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
                        ? "bg-[#6366F1]/10 border-[#6366F1] text-[#4338CA] font-extrabold"
                        : "border-[#4338CA]/5 hover:bg-[#F8FAFC] text-[#312E81]/80 font-bold"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FileText className={`w-4 h-4 shrink-0 ${isActive ? "text-[#4338CA]" : "text-gray-400"}`} />
                      <span className="text-xs truncate">{note.title}</span>
                    </div>
                    {isActive && <Check className="w-3.5 h-3.5 text-[#4338CA] shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen className="w-6 h-6" />}
              title="No Notes"
              description="Your study catalogue is empty."
            />
          )}
        </div>

      </div>

      {/* RIGHT COLUMN - Generated Study buddy notes details tab pane */}
      <div className="lg:col-span-7">
        
        {activeNote ? (
          <div className="bg-white rounded-3xl border border-[#4338CA]/10 overflow-hidden shadow-sm">
            
            {/* Header detail bar */}
            <div className="p-6 bg-[#F8FAFC] border-b border-[#4338CA]/5 flex flex-col sm:flex-row sm:items-center sm:justify-between justify-center gap-4">
              <div>
                <span className="text-[10px] font-bold text-[#6366F1] uppercase tracking-wider block">Generated Material Package</span>
                <h2 className="text-lg font-black text-[#312E81] line-clamp-2">{activeNote.title}</h2>
              </div>
              
              {/* Core Recitation & Print/Export actions controls */}
              <div className="flex gap-1.5 shrink-0">
                
                {/* Speech Synthesis play trigger */}
                <button
                  id="notes-btn-recite"
                  onClick={handleReadActiveSegment}
                  className="p-2.5 bg-[#4338CA] text-white hover:bg-[#312E81] rounded-xl flex items-center gap-1 text-[11px] font-black cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 uppercase tracking-wider shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                  title="Speak out active slide info"
                >
                  <Volume2 className="w-4 h-4" /> Recite Aloud
                </button>
                
                {/* Stop Speech */}
                <button
                  id="notes-btn-stop"
                  onClick={() => SpeechEngine.stop()}
                  className="p-2.5 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl flex items-center justify-center cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                  title="Mute current voice speaker"
                >
                  <StopCircle className="w-4.5 h-4.5" />
                </button>

                {/* Print standard visual (PDF format generator) */}
                <button
                  id="notes-btn-print"
                  onClick={handlePrintPdf}
                  className="p-2.5 border border-[#4338CA]/25 text-[#4338CA] hover:bg-[#6366F1]/10 rounded-xl cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                  title="Print custom notes page perfectly"
                >
                  <Printer className="w-4.5 h-4.5" />
                </button>

                {/* DOCX Download file block */}
                <button
                  id="notes-btn-download-docx"
                  onClick={handleDownloadDocx}
                  className="p-2.5 border border-gray-200 text-gray-700 hover:bg-[#F8FAFC] rounded-xl cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 font-bold text-[11px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                  title="Download unit notes to local DOCX format"
                >
                  DOCX
                </button>

              </div>
            </div>

            {/* Navigation tabs row */}
            <div className="flex border-b border-[#4338CA]/10 overflow-x-auto bg-[#F8FAFC]/30">
              {[
                { id: "summary", label: "1. Summary" },
                { id: "detailed", label: "2. Detailed Notes" },
                { id: "revision", label: "3. Revision Notes" },
                { id: "formulas", label: "4. Formulas" },
                { id: "questions", label: "5. Questions" },
                { id: "flashcards", label: "6. Flashcards" },
                { id: "mindmap", label: "7. Mind Map" },
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
                        ? "border-[#4338CA] text-[#4338CA] bg-white font-black"
                        : "border-transparent text-[#312E81]/60 hover:text-[#4338CA] hover:bg-[#F8FAFC]/20"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content display frame */}
            <div className="p-6 md:p-8 min-h-96 text-[#312E81]/90">
              
              {/* PRINT ELEMENT STYLING - Hidden on screen, visible during printing */}
              <div className="hidden print:block space-y-6 text-[#312E81]">
                <div className="border-b-2 border-[#4338CA] pb-2 mb-6">
                  <h1 className="text-2xl font-black">{activeNote.title}</h1>
                  <p className="text-xs font-bold text-[#4338CA] uppercase tracking-widest">Study Guide Lesson Workbook</p>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-bold border-b border-[#4338CA]/20 uppercase">I. Chapter Summary Outline</h3>
                  <p className="text-xs leading-relaxed">{activeNote.summary}</p>
                  
                  <h3 className="text-sm font-bold border-b border-[#4338CA]/20 mt-6 uppercase">II. Important Highlight Points</h3>
                  <ul className="list-disc pl-5 text-xs space-y-1">
                    {activeNote.bulletPoints.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>

                  <h3 className="text-sm font-bold border-b border-[#4338CA]/20 mt-6 uppercase">III. Simplified Metaphorical Analogy</h3>
                  <p className="text-xs leading-relaxed italic">{activeNote.easyExplanation}</p>

                  <h3 className="text-sm font-bold border-b border-[#4338CA]/20 mt-6 uppercase">IV. Exam Cheat Sheet Cues</h3>
                  <p className="text-xs leading-relaxed">{activeNote.examNotes}</p>

                  <h3 className="text-sm font-bold border-b border-[#4338CA]/20 mt-6 uppercase">V. Active Definitions Dictionary</h3>
                  <div className="space-y-4">
                    {activeNote.keyDefinitions.map((d, i) => (
                      <div key={i} className="text-xs"><strong className="text-[#4338CA]">{d.term}:</strong> {d.definition}</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* SCREEN-ONLY VIEW INTERACTIVE LAYOUTS */}
              <div className="print:hidden">
                
                {/* 1. Summary overview page */}
                {detailTab === "summary" && (
                  <div className="space-y-6 animate-fadeIn" onMouseEnter={() => handleMouseEnterText(activeNote.summary)}>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-[#0F766E]" />
                        <h3 className="text-sm font-extrabold text-[#0F766E] uppercase tracking-wider">Chapter Summary Outline</h3>
                      </div>
                      <div className="h-0.5 bg-gradient-to-r from-[#0F766E]/10 to-transparent w-full" />
                      <p className="text-xs leading-relaxed font-semibold text-gray-700 whitespace-pre-line bg-[#FFFBF5]/40 p-4 rounded-2xl border border-teal-50">
                        {activeNote.summary}
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. Detailed Notes */}
                {detailTab === "detailed" && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-[#0F766E]" />
                      <h3 className="text-sm font-extrabold text-[#0F766E] uppercase tracking-wider">Detailed Chapter Notes</h3>
                    </div>
                    <div className="h-0.5 bg-gradient-to-r from-[#0F766E]/10 to-transparent w-full" />
                    <div className="space-y-4">
                      {(activeNote.chapter_notes || []).map((chapter, idx) => (
                        <div key={idx} className="p-4 rounded-2xl border border-[#0F766E]/10 bg-[#FFFBF5]">
                          <h4 className="font-bold text-[#0F766E] mb-2">{chapter.chapter}</h4>
                          <ul className="list-disc pl-5 space-y-1 text-xs text-gray-700">
                            {chapter.notes.map((note, nIdx) => <li key={nIdx}>{note}</li>)}
                          </ul>
                        </div>
                      ))}
                      {(activeNote.key_concepts || []).map((concept, idx) => (
                        <div key={idx} className="p-4 rounded-2xl border border-[#0F766E]/10 bg-[#FFFBF5] space-y-2">
                          <h4 className="text-xs uppercase font-black text-[#0F766E]">{concept.concept}</h4>
                          <p className="text-xs text-gray-700 font-semibold">{concept.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Revision Notes */}
                {detailTab === "revision" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#0F766E]" />
                      <h3 className="text-sm font-extrabold text-[#0F766E] uppercase tracking-wider">Quick Revision Sheet</h3>
                    </div>
                    <div className="h-0.5 bg-gradient-to-r from-[#0F766E]/10 to-transparent w-full" />
                    
                    <div className="p-5 rounded-2xl bg-[#14B8A6]/5 border border-[#14B8A6]/20 space-y-4">
                      {(activeNote.revision_notes || []).map((point, idx) => (
                        <p key={idx} className="text-xs leading-relaxed text-[#134E4A] font-bold">
                          • {point}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Formulas */}
                {detailTab === "formulas" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <span className="p-1 px-1.5 bg-teal-100 text-teal-700 rounded-lg text-xs">🧮</span>
                      <h3 className="text-sm font-extrabold text-[#0F766E] uppercase tracking-wider">Important Formulas</h3>
                    </div>
                    <div className="h-0.5 bg-gradient-to-r from-[#0F766E]/10 to-transparent w-full" />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(activeNote.formulas || []).map((formula, idx) => (
                        <div key={idx} className="p-4 rounded-2xl border border-teal-200 bg-white shadow-sm space-y-2 text-center">
                          <h4 className="text-xs font-black text-[#134E4A]">{formula.formula_name}</h4>
                          <div className="p-3 bg-teal-50 rounded-xl font-mono text-[#0F766E] font-bold text-sm">
                            {formula.equation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Questions */}
                {detailTab === "questions" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Info className="w-5 h-5 text-[#0F766E]" />
                        <h3 className="text-sm font-extrabold text-[#0F766E] uppercase tracking-wider">Exam & Viva Questions</h3>
                      </div>
                    </div>
                    <div className="h-0.5 bg-gradient-to-r from-[#0F766E]/10 to-transparent w-full" />

                    <div className="space-y-3">
                      {(activeNote.exam_questions || activeNote.viva_questions || []).map((faq, idx) => (
                        <div key={idx} className="p-4 rounded-2xl border border-gray-200 bg-white shadow-sm space-y-2">
                          <h4 className="text-xs font-black text-[#134E4A] flex gap-2"><span className="text-[#14B8A6]">Q:</span> {faq.question}</h4>
                          <div className="h-px w-full bg-gray-100" />
                          <p className="text-xs text-gray-600 font-semibold flex gap-2"><span className="text-teal-600 font-black">A:</span> {faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Flashcards & Mind Map tabs skipped for brevity, handle later or show empty */}
                {(detailTab === "flashcards" || detailTab === "mindmap") && (
                  <div className="p-10 text-center text-gray-500">
                    <p>Select this mode from the dedicated study tools panel coming in the next update!</p>
                  </div>
                )}

              </div>

            </div>

          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#4338CA]/10 p-4 shadow-sm h-full flex flex-col justify-center">
            <EmptyState
              icon={<BookOpen className="w-12 h-12" />}
              title="No active converted unit"
              description="Select or drop an academic textbook unit file inside the left uploader panel. The generative API will synthesize a comprehensive workspace containing summaries, metaphors, practice exams, and definitions."
            />
          </div>
        )}

      </div>

    </div>
  );
}
