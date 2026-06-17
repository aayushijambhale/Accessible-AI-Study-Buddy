import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import { v2 as cloudinary } from "cloudinary";

// Import custom application services
import UnifiedDB, { User, Note, Quiz, QuizHistory, ChatSession, Caption, Upload } from "./src/db/mongodb";
import { CoreAIService } from "./src/server/services/ai/provider";
import { NotesService } from "./src/server/services/notesService";
import { QuizService } from "./src/server/services/quizService";
import { PdfService } from "./src/server/services/pdfService";
import { OcrService } from "./src/server/services/ocrService";
import { AuthService } from "./src/server/authService";

// Load Environment Keys
dotenv.config();

const app = express();
const PORT = 3000;

// Hard stop checking on missing JWT key in alignment with strict Phase 4 guidelines
if (!process.env.JWT_SECRET) {
  console.error("❌ FATAL: JWT_SECRET environment variable is missing. Stop server startup.");
  process.exit(1);
}

// -------------------------------------------------------------
// MIDLLEWARE CONFIGURATIONS (Phase 12 Rate Limiting & Hardening)
// -------------------------------------------------------------

// Security context hardening with Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Keep disabled for easy preview iframe loading
  crossOriginEmbedderPolicy: false
}));

// Setup rate limits: 100 requests per 15 minutes limit by default, 20 requests for logins
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: { error: "Too many requests from this address. Please retry after some minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictAuthLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { error: "Too many login/registration queries. Throttled for safety." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Setup static upload directories
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOADS_DIR));

// Configure Cloudinary if active
if (process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
    api_key: process.env.CLOUDINARY_API_KEY || "",
    api_secret: process.env.CLOUDINARY_API_SECRET || ""
  });
  console.info("☁️ Cloudinary file storage provider initialized successfully!");
}

// Global active JWT validation filter
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token missing" });
  }

  const payload = AuthService.verifyToken(token);
  if (!payload) {
    return res.status(403).json({ error: "Signature verification failed, or session expired" });
  }

  req.user = payload;
  next();
}

// -------------------------------------------------------------
// ROUTES: AUTHENTICATION (Phase 4 Access/Refresh Tokens & OTP)
// -------------------------------------------------------------

// Register
app.post("/api/auth/register", strictAuthLimiter, async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "All profile fields are required." });
    }

    const exists = await UnifiedDB.findUserByEmail(email);
    if (exists) {
      return res.status(400).json({ error: "An account already exists under this email address." });
    }

    const hashed = await AuthService.hashPassword(password);
    const newUser = await UnifiedDB.createUser({
      email: email.toLowerCase(),
      passwordHash: hashed,
      fullName,
      studyHours: 0,
      studyLogs: [{ date: new Date().toISOString().split("T")[0], minutes: 10 }],
      refreshTokens: []
    });

    const accessToken = AuthService.generateAccessToken({ id: newUser.id || newUser._id, email: newUser.email });
    const refreshToken = AuthService.generateRefreshToken({ id: newUser.id || newUser._id, email: newUser.email });

    // Store refresh token
    const rTokens = newUser.refreshTokens || [];
    rTokens.push(refreshToken);
    await UnifiedDB.updateUser(newUser.id || newUser._id, { refreshTokens: rTokens });

    res.status(201).json({
      token: accessToken,
      refreshToken,
      user: {
        id: newUser.id || newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        voiceSettings: newUser.voiceSettings
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/api/auth/login", strictAuthLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required credentials." });
    }

    const user = await UnifiedDB.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or matching password." });
    }

    const matches = await AuthService.comparePasswords(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid email or matching password." });
    }

    const accessToken = AuthService.generateAccessToken({ id: user.id || user._id, email: user.email });
    const refreshToken = AuthService.generateRefreshToken({ id: user.id || user._id, email: user.email });

    const rTokens = user.refreshTokens || [];
    rTokens.push(refreshToken);
    await UnifiedDB.updateUser(user.id || user._id, { refreshTokens: rTokens });

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id || user._id,
        email: user.email,
        fullName: user.fullName,
        voiceSettings: user.voiceSettings
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Access Token Refresh Endpoint
app.post("/api/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token is missing" });
  }

  const payload = AuthService.verifyToken(refreshToken);
  if (!payload) {
    return res.status(403).json({ error: "Invalid refresh signature" });
  }

  const user = await UnifiedDB.findUserById(payload.id);
  if (!user || !user.refreshTokens.includes(refreshToken)) {
    return res.status(403).json({ error: "Token has been revoked or is invalid" });
  }

  const newAccessToken = AuthService.generateAccessToken({ id: user.id || user._id, email: user.email });
  res.json({ token: newAccessToken });
});

// Clear Session / Logout
app.post("/api/auth/logout", async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const payload = AuthService.verifyToken(refreshToken);
    if (payload) {
      const user = await UnifiedDB.findUserById(payload.id);
      if (user) {
        const remaining = user.refreshTokens.filter((rt: string) => rt !== refreshToken);
        await UnifiedDB.updateUser(user.id || user._id, { refreshTokens: remaining });
      }
    }
  }
  res.json({ success: true });
});

// Forgot Password - Send OTP (Phase 4)
app.post("/api/auth/forgot-password", strictAuthLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email address is required." });
  }

  const user = await UnifiedDB.findUserByEmail(email);
  if (!user) {
    // Return friendly generic success response to prevent emails enumeration scans
    return res.json({ success: true, message: "A test verification OTP was simulated/sent successfully if the address matches." });
  }

  const otp = AuthService.generateOTP(email);
  res.json({
    success: true,
    message: `OTP issued successfully. In a real system, this goes to email. Click Console to read your safe active test code!`,
    testOTP: otp // Return OTP directly in response for immediate testing comfort
  });
});

// Reset Password with OTP Code (Phase 4)
app.post("/api/auth/reset-password", strictAuthLimiter, async (req, res) => {
  const { email, otpCode, newPassword } = req.body;
  if (!email || !otpCode || !newPassword) {
    return res.status(400).json({ error: "Email, OTP Code and New Password are required." });
  }

  const verified = AuthService.verifyOTP(email, otpCode);
  if (!verified) {
    return res.status(400).json({ error: "Invalid OTP code, or OTP expired." });
  }

  const user = await UnifiedDB.findUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: "User accounts not resolved." });
  }

  const hashed = await AuthService.hashPassword(newPassword);
  await UnifiedDB.updateUser(user.id || user._id, { passwordHash: hashed });

  res.json({ success: true, message: "Credential reset successful. Please login now with your new password." });
});

// Get User Profile
app.get("/api/auth/profile", authenticateToken, async (req: any, res) => {
  const user = await UnifiedDB.findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User accounts profile not located." });
  }
  res.json({
    id: user.id || user._id,
    email: user.email,
    fullName: user.fullName,
    voiceSettings: user.voiceSettings,
    studyHours: user.studyHours,
    studyLogs: user.studyLogs
  });
});

// Update Profile Detail Attributes
app.put("/api/auth/profile", authenticateToken, async (req: any, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    return res.status(400).json({ error: "Full Name and Email Address are required fields." });
  }

  const otherUser = await UnifiedDB.findUserByEmail(email);
  if (otherUser && String(otherUser._id || otherUser.id) !== String(req.user.id)) {
    return res.status(400).json({ error: "Email address is already in use by another user." });
  }

  const updated = await UnifiedDB.updateUser(req.user.id, { fullName, email: email.toLowerCase() });
  if (!updated) {
    return res.status(404).json({ error: "Account profile was not updated." });
  }

  res.json({ success: true, user: updated });
});

// Update Accessibility Preferences
app.put("/api/auth/preferences", authenticateToken, async (req: any, res) => {
  const { voiceSettings } = req.body;
  if (!voiceSettings) {
    return res.status(400).json({ error: "Settings payload is empty." });
  }

  const updated = await UnifiedDB.updateUser(req.user.id, { voiceSettings });
  res.json({ success: true, voiceSettings: updated.voiceSettings });
});


// -------------------------------------------------------------
// ROUTES: PDF PROCESSING & STORAGE MANAGEMENT (Phase 1 & 5)
// -------------------------------------------------------------

// Read real PDF bytes in background (Phase 1)
app.post("/api/notes/parse-pdf", authenticateToken, async (req: any, res) => {
  const { pdfBase64 } = req.body;
  if (!pdfBase64) {
    return res.status(400).json({ error: "No PDF data base64 string provided." });
  }

  try {
    const rawBuffer = Buffer.from(pdfBase64, "base64");
    const result = await pdfParse(rawBuffer);
    res.json({
      text: result.text || "",
      pagesCount: result.numpages,
      metadata: result.metadata
    });
  } catch (err: any) {
    console.error("Backend pdf-parse failed:", err);
    res.status(500).json({ error: `PDF extraction failed: ${err.message}` });
  }
});

// Secure Cloudinary or Local uploads pipeline (Phase 5)
app.post("/api/upload", authenticateToken, async (req: any, res) => {
  const { fileBase64, fileName, fileType } = req.body;
  if (!fileBase64 || !fileName || !fileType) {
    return res.status(400).json({ error: "fileBase64, fileName and fileType parameters are required." });
  }

  try {
    let fileUrl = "";

    // Upload to Cloudinary if configured
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      const resp = await cloudinary.uploader.upload(
        `data:${fileType};base64,${fileBase64}`,
        { resource_type: "auto" }
      );
      fileUrl = resp.secure_url;
    } else {
      // Local fallback mapping
      const cleanName = `${Date.now()}_${fileName.replace(/\s+/g, "_")}`;
      const savePath = path.join(UPLOADS_DIR, cleanName);
      fs.writeFileSync(savePath, Buffer.from(fileBase64, "base64"));
      
      const hostUrl = process.env.APP_URL || `http://0.0.0.0:${PORT}`;
      fileUrl = `${hostUrl}/uploads/${cleanName}`;
    }

    // Register Upload session under user ownership in database
    const newUpload = await UnifiedDB.createUpload({
      userId: req.user.id,
      fileName,
      fileUrl,
      fileType,
      fileSize: `${Math.round(fileBase64.length * 0.75 / 1024)} KB`
    });

    res.json({ url: fileUrl, upload: newUpload });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// ROUTES: STUDY GUIDES & GENERATION SERVICES (Phase 6, 7, 8, 9)
// -------------------------------------------------------------

// Create New Note With Vector Embeddings (Phase 7 RAG)
app.post("/api/notes/generate", authenticateToken, async (req: any, res) => {
  const { title, content } = req.body;
  if (!content || !title) {
    return res.status(400).json({ error: "A title and study material content are required." });
  }

  try {
    // Generate summaries, explanations, exam points and key glossary using high performance Gemini (Phase 6)
    const notesResult = await NotesService.generateStudyBuddyNotes(title, content);

    // Formulate 6 flashcards by default under standard Note template (Phase 8)
    const flashcardsData = await NotesService.generateFlashcards(content);
    const flashcards = flashcardsData.map((f, i) => ({
      id: `fc_${Math.random().toString(36).substring(2, 9)}`,
      question: f.question,
      answer: f.answer,
      bookmarked: false,
      score: 0
    }));

    // Formulate clean MindMap hierarchy (Phase 9)
    const mindmapData = await NotesService.generateMindMap(title, content);

    // Compute text segment vectors for real RAG embeddings mapping (Phase 7)
    const rawChunks = CoreAIService.chunkContent(content);
    const ragChunks = [];
    
    // Generate text vectors asynchronously
    for (let i = 0; i < rawChunks.length; i++) {
      try {
        const textSegment = rawChunks[i];
        let vector: number[] = [];
        if (CoreAIService.isGeminiAvailable()) {
          vector = await CoreAIService.createEmbedding(textSegment);
        }
        ragChunks.push({
          text: textSegment,
          pageNumber: Math.floor(i / 2) + 1,
          embedding: vector
        });
      } catch (err) {
        console.warn(`Vector embeddings formulation failed on chunk ${i}:`, err);
      }
    }

    // Save notes to database
    const newNote = await UnifiedDB.createNote({
      userId: req.user.id,
      title,
      rawContent: content,
      ...notesResult,
      flashcards,
      mindMap: mindmapData,
      ragChunks
    });

    // Credit study hours for notes creation
    const user = await UnifiedDB.findUserById(req.user.id);
    if (user) {
      const todayString = new Date().toISOString().split("T")[0];
      const logs = user.studyLogs || [];
      const index = logs.findIndex((l: any) => l.date === todayString);
      if (index !== -1) {
        logs[index].minutes += 15;
      } else {
        logs.push({ date: todayString, minutes: 15 });
      }
      await UnifiedDB.updateUser(req.user.id, {
        studyHours: (user.studyHours || 0) + 0.5,
        studyLogs: logs
      });
    }

    res.status(201).json(newNote);
  } catch (err: any) {
    console.error("Notes creation process failed:", err);
    if (err.message === "GEMINI_API_KEY_MISSING") {
      res.status(403).json({ error: "GEMINI_API_KEY_MISSING" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

// Advanced PDF Processing Pipeline (Standardized JSON)
app.post("/api/notes/generate-advanced", authenticateToken, upload.single("file"), async (req: any, res) => {
  console.log("Generate Notes Request Received");
  
  try {
    const file = req.file;
    const title = req.body.title || "Untitled Lesson";
    let extractedText = req.body.content || "";
    
    if (file) console.log("PDF Uploaded Successfully");

    // Stage 1: Uploading & Extracting
    console.log("PDF Parsing Started");
    
    if (file) {
      const rawBuffer = file.buffer;
      try {
        const result = await PdfService.extractTextFromBase64(rawBuffer.toString("base64"));
        extractedText = result.text || "";
      } catch (e) {
        console.warn("pdf-parse failed:", e);
      }
    }

    // Stage 2: OCR Fallback
    if (extractedText.trim().length < 50 && file && file.mimetype.includes("image")) {
       extractedText = await OcrService.extractTextFromImage(file.buffer.toString("base64"));
    } else if (extractedText.trim().length < 50) {
      extractedText = "OCR fallback triggered. Note: Node.js server requires Ghostscript/Imagemagick for true PDF->Image OCR. Please ensure your PDF has an embedded text layer, or paste the text directly.";
    }

    console.log("PDF Parsing Completed");
    console.log("Extracted Text Length:", extractedText.length);

    if (!extractedText.trim()) {
      throw new Error("No readable text extracted from PDF");
    }

    // Stage 3: AI Analysis
    console.log("Sending Request To AI");
    
    // Fallback block if NotesService.generateStudyBuddyNotes fails
    let notesResult;
    try {
      notesResult = await NotesService.generateStudyBuddyNotes(title, extractedText);
      console.log("AI Response Received");
    } catch (aiErr: any) {
      console.error("AI Generation Failed:", aiErr);
      // Fail-Safe System (Step 9)
      notesResult = {
        title: title,
        chapter_notes: [],
        key_concepts: [],
        definitions: [],
        formulas: [],
        examples: [],
        revision_notes: ["AI Failed. Fallback Summary Generated."],
        exam_questions: [],
        viva_questions: [],
        interview_questions: [],
        flashcards: [],
        key_takeaways: [extractedText.substring(0, 500) + "..."]
      };
      console.log("Fail-Safe Summary Generated");
    }
    
    // Default flashcards & mindmap
    let flashcards = [];
    try {
      const flashcardsData = await NotesService.generateFlashcards(extractedText);
      flashcards = flashcardsData.map((f, i) => ({
        id: `fc_${Math.random().toString(36).substring(2, 9)}`,
        question: f.question,
        answer: f.answer,
        bookmarked: false,
        score: 0
      }));
    } catch (e) { console.error("Flashcards fallback failed", e); }

    let mindmapData = { topic: title, subtopics: [] };
    try {
      mindmapData = await NotesService.generateMindMap(title, extractedText);
    } catch (e) { console.error("Mindmap fallback failed", e); }

    console.log("Saving Notes");
    // Save notes to database
    const newNote = await UnifiedDB.createNote({
      userId: req.user.id,
      title,
      rawContent: extractedText,
      // Map new schema fields
      chapter_notes: notesResult.chapter_notes || [],
      key_concepts: notesResult.key_concepts || [],
      definitions: notesResult.definitions || [],
      formulas: notesResult.formulas || [],
      examples: notesResult.examples || [],
      revision_notes: notesResult.revision_notes || [],
      exam_questions: notesResult.exam_questions || [],
      viva_questions: notesResult.viva_questions || [],
      interview_questions: notesResult.interview_questions || [],
      key_takeaways: notesResult.key_takeaways || [],
      // Compatibility fields
      summary: notesResult.title || title,
      bulletPoints: (notesResult.key_takeaways || []).slice(0, 15),
      easyExplanation: (notesResult.key_concepts || []).map((k: any) => k.explanation).join(" ") || "",
      examNotes: (notesResult.revision_notes || []).join(" ") || "",
      keyDefinitions: notesResult.definitions || [],
      flashcards,
      mindMap: mindmapData,
      ragChunks: []
    });

    console.log("Notes Saved");
    
    console.log("Response Sent To Frontend");
    return res.status(200).json({ success: true, notes: newNote });

  } catch (err: any) {
    let errorMessage = err.message || "Unknown Error";
    
    // Handle AI provider JSON errors if parsed
    try {
      const parsedErr = JSON.parse(err.message);
      if (parsedErr.message) errorMessage = parsedErr.message;
    } catch (e) {}

    console.error("Advanced generation failed:", errorMessage);
    console.log("Response Sent To Frontend");
    return res.status(400).json({ success: false, error: errorMessage });
  }
});

// Diagram Analysis Endpoint
app.post("/api/notes/analyze-diagram", authenticateToken, upload.single("file"), async (req: any, res) => {
  try {
    const file = req.file;
    if (!file || !file.mimetype.includes("image")) {
      return res.status(400).json({ error: "An image file is required for diagram analysis." });
    }
    
    const base64Image = file.buffer.toString("base64");
    const mimeType = file.mimetype;
    
    // Dynamically import to avoid top-level load errors if not implemented
    const { VisionService } = require("./src/server/services/visionService");
    const result = await VisionService.analyzeDiagram(base64Image, mimeType);
    
    res.json(result);
  } catch (err: any) {
    console.error("Diagram analysis failed:", err);
    res.status(500).json({ error: err.message || "Failed to analyze diagram." });
  }
});

// Fetch All Notes
app.get("/api/notes", authenticateToken, async (req: any, res) => {
  try {
    const list = await UnifiedDB.findNotesByUser(req.user.id);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch Single Note details
app.get("/api/notes/:id", authenticateToken, async (req: any, res) => {
  try {
    const note = await UnifiedDB.findNoteById(req.params.id);
    if (!note || String(note.userId) !== String(req.user.id)) {
      return res.status(404).json({ error: "Study materials not located." });
    }
    res.json(note);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Note
app.delete("/api/notes/:id", authenticateToken, async (req: any, res) => {
  try {
    const success = await UnifiedDB.deleteNote(req.params.id, req.user.id);
    if (!success) {
      return res.status(404).json({ error: "Could not delete note." });
    }
    res.json({ success: true, message: "Note completed and archived." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// ROUTES: FLASHCARD BOOKMARK & SHUFFLING ACTIONS (Phase 8)
// -------------------------------------------------------------

// Toggle Flashcard Bookmark
app.put("/api/notes/:id/flashcards/:cardId", authenticateToken, async (req: any, res) => {
  try {
    const note = await UnifiedDB.findNoteById(req.params.id);
    if (!note || String(note.userId) !== String(req.user.id)) {
      return res.status(404).json({ error: "Note not located." });
    }

    const cards = note.flashcards || [];
    const editIdx = cards.findIndex((fc: any) => fc.id === req.params.cardId);
    if (editIdx !== -1) {
      cards[editIdx].bookmarked = !cards[editIdx].bookmarked;
      await UnifiedDB.updateNote(note.id || note._id, { flashcards: cards });
      return res.json({ success: true, flashcard: cards[editIdx] });
    }
    res.status(404).json({ error: "Flashcard item not located in study workbook." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// ROUTES: PRACTICAL QUIZZES CENTER (Phase 2 & 13)
// -------------------------------------------------------------

// Formulate Quiz Questions
app.post("/api/quiz/generate", authenticateToken, async (req: any, res) => {
  const { noteId, quizType = "mcq", numQuestions = 5 } = req.body;
  if (!noteId) {
    return res.status(400).json({ error: "A valid note ID reference is required." });
  }

  try {
    const note = await UnifiedDB.findNoteById(noteId);
    if (!note || String(note.userId) !== String(req.user.id)) {
      return res.status(404).json({ error: "Notes reference is invalid or unlinked." });
    }

    const questions = await QuizService.generateStudyQuiz(note.title, note.rawContent, quizType, numQuestions);
    const newQuiz = await UnifiedDB.createQuiz({
      noteId,
      userId: req.user.id,
      title: `Practice Evaluation: ${note.title} (${quizType.toUpperCase()})`,
      questions
    });

    res.status(201).json(newQuiz);
  } catch (err: any) {
    console.error("Quiz creation failed:", err);
    if (err.message === "GEMINI_API_KEY_MISSING") {
      res.status(403).json({ error: "GEMINI_API_KEY_MISSING" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Fetch Note Quiz Set
app.get("/api/quiz/note/:noteId", authenticateToken, async (req: any, res) => {
  try {
    const list = await UnifiedDB.findQuizzesByNote(req.params.noteId, req.user.id);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Submit Quiz and Track Evaluation Scoring
app.post("/api/quiz/submit", authenticateToken, async (req: any, res) => {
  const { quizId, score, totalQuestions, title, noteId } = req.body;
  if (!quizId || score === undefined || !totalQuestions) {
    return res.status(400).json({ error: "Quiz submission coordinates are incomplete." });
  }

  try {
    const historyItem = await UnifiedDB.createQuizHistory({
      quizId,
      noteId,
      userId: req.user.id,
      title: title || "Completed Assessment",
      score,
      totalQuestions,
      percentage: Math.round((score / totalQuestions) * 100)
    });

    // Credit study hours for evaluation participation
    const user = await UnifiedDB.findUserById(req.user.id);
    if (user) {
      const today = new Date().toISOString().split("T")[0];
      const logs = user.studyLogs || [];
      const logIdx = logs.findIndex((l: any) => l.date === today);
      if (logIdx !== -1) {
        logs[logIdx].minutes += 12;
      } else {
        logs.push({ date: today, minutes: 12 });
      }
      await UnifiedDB.updateUser(req.user.id, {
        studyHours: (user.studyHours || 0) + 0.2,
        studyLogs: logs
      });
    }

    res.status(201).json(historyItem);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Quiz Scoring Records
app.get("/api/quiz/history", authenticateToken, async (req: any, res) => {
  try {
    const list = await UnifiedDB.findQuizHistoryByUser(req.user.id);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Quiz Leaderboard Scores (Phase 2 & 13)
app.get("/api/quiz/leaderboard", authenticateToken, async (req: any, res) => {
  try {
    const leaderboard = await UnifiedDB.getLeaderboard();
    res.json(leaderboard.slice(0, 10)); // Top 10 users as demanded in instructions
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// ROUTES: CONTEXT-AWARE TUTOR COGNITIVE RAG SYSTEM (Phase 7)
// -------------------------------------------------------------

// Post message into AI Conversational Tutor thread with exact Cosine Vector RAG Retrieve
app.post("/api/tutor/chat", authenticateToken, async (req: any, res) => {
  const { noteId, userMessage, mode = "normal", chatSessionId } = req.body;
  if (!userMessage) {
    return res.status(400).json({ error: "Your chat query content is empty." });
  }

  try {
    let noteTitle = "General Knowledge Helpdesk";
    let retrievedContext = "General assistance instruction guidelines.";

    // Process exact Cosine similarity matching if note context reference exists
    if (noteId) {
      const note = await UnifiedDB.findNoteById(noteId);
      if (note && note.ragChunks && note.ragChunks.length > 0) {
        noteTitle = note.title;

        try {
          if (CoreAIService.isGeminiAvailable()) {
            const queryEmbedding = await CoreAIService.createEmbedding(userMessage);

            // Compute cosine similarities to identify top relevant vectors (RAG)
            const matches = note.ragChunks.map((chunk: any) => {
              if (!chunk.embedding || chunk.embedding.length === 0) return { chunk, similarity: 0 };
              
              // Direct dot calculations
              let dotProduct = 0;
              let normA = 0;
              let normB = 0;
              for (let i = 0; i < queryEmbedding.length; i++) {
                const elementB = chunk.embedding[i] || 0;
                dotProduct += queryEmbedding[i] * elementB;
                normA += queryEmbedding[i] * queryEmbedding[i];
                normB += elementB * elementB;
              }
              const similarity = normA === 0 || normB === 0 ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
              return { chunk, similarity };
            });

            // Sort matches to find top 3 matches
            matches.sort((a: any, b: any) => b.similarity - a.similarity);
            const topPassages = matches.slice(0, 3).map((item: any) => item.chunk.text);
            retrievedContext = topPassages.join(" \n\n ");
          } else {
            retrievedContext = note.rawContent.substring(0, 3000);
          }
        } catch (embeddingError) {
          console.warn("Cosine search failed, fallback to raw passage:", embeddingError);
          retrievedContext = note.rawContent.substring(0, 3500);
        }
      }
    }

    // Connect to Chat Session
    const session = await UnifiedDB.findOrCreateChatSession(noteId, req.user.id, chatSessionId);

    // Save User Voice transcription or query string
    await UnifiedDB.pushChatMessage(session._id || session.id, req.user.id, {
      sender: "user",
      text: userMessage
    });

    // Formulate final AI prompt
    const chatHistoryStrings = session.messages.slice(-8).map((msg: any) => `${msg.sender}: ${msg.text}`);
    const finalAnswer = await CoreAIService.generateTutorChatResponse(
      userMessage,
      noteTitle,
      retrievedContext,
      mode,
      chatHistoryStrings
    );

    // Save final response in database
    const updatedSession = await UnifiedDB.pushChatMessage(session._id || session.id, req.user.id, {
      sender: "ai",
      text: finalAnswer
    });

    res.json({ aiResponse: finalAnswer, session: updatedSession });
  } catch (err: any) {
    console.error("Tutoring flow failure: ", err);
    if (err.message === "GEMINI_API_KEY_MISSING") {
      res.status(403).json({ error: "GEMINI_API_KEY_MISSING" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Fetch Conversational Tutor Sessions list
app.get("/api/tutor/sessions", authenticateToken, async (req: any, res) => {
  try {
    const list = await UnifiedDB.findChatSessionsByUser(req.user.id);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch Conversational Session Messages
app.get("/api/tutor/sessions/:id", authenticateToken, async (req: any, res) => {
  try {
    const session = await UnifiedDB.findOrCreateChatSession("", req.user.id, req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session thread not encountered." });
    }
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// ROUTES: IMAGE ANALYSIS HELPDESK (Phase 11)
// -------------------------------------------------------------

// Use Gemini Multimodal Vision to explain charts
app.post("/api/image-caption", authenticateToken, async (req: any, res) => {
  const { imageBase64, title } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: "An image data payload is required." });
  }

  let cleanedBase64 = imageBase64;
  let typeFormat = "image/png";

  if (imageBase64.includes(";base64,")) {
    const splitArr = imageBase64.split(";base64,");
    cleanedBase64 = splitArr[1];
    typeFormat = splitArr[0].replace("data:", "");
  }

  try {
    const captionText = await CoreAIService.analyzeImageForAccessibility(cleanedBase64, typeFormat);
    const newReport = await UnifiedDB.createCaption({
      userId: req.user.id,
      title: title || `Visual Outline description: ${new Date().toLocaleDateString()}`,
      description: captionText,
      imageUrl: imageBase64.startsWith("http") ? imageBase64 : "" // If already uploaded to Cloudinary, store URL
    });

    res.status(201).json(newReport);
  } catch (err: any) {
    console.error("Visual helper processing failed:", err);
    if (err.message === "GEMINI_API_KEY_MISSING") {
      res.status(403).json({ error: "GEMINI_API_KEY_MISSING" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Get Captions Histories
app.get("/api/image-caption", authenticateToken, async (req: any, res) => {
  try {
    const list = await UnifiedDB.findCaptionsByUser(req.user.id);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// ROUTES: WHISPER STT & ELEVENLABS TTS PROXIES (Phase 10)
// -------------------------------------------------------------

// OpenAI Whisper STT Proxy
app.post("/api/speech/stt", authenticateToken, async (req: any, res) => {
  const { audioBase64 } = req.body;
  if (!audioBase64) {
    return res.status(400).json({ error: "audioBase64 parameter is required." });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(400).json({ error: "OPENAI_API_KEY_MISSING" });
  }

  try {
    const buffer = Buffer.from(audioBase64, "base64");
    const formData = new FormData();
    const soundBlob = new Blob([buffer], { type: "audio/wav" });
    
    formData.append("file", soundBlob, "speech.wav");
    formData.append("model", "whisper-1");

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`
      },
      body: formData
    });

    if (!resp.ok) {
      throw new Error(`OpenAI Whisper request failed: ${resp.statusText}`);
    }

    const json = await resp.json();
    res.json({ text: json.text || "" });
  } catch (err: any) {
    console.error("STT transcription relay failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ElevenLabs TTS Proxy
app.post("/api/speech/tts", authenticateToken, async (req: any, res) => {
  const { text, voiceId = "21m0aTcmDWmsqK71tcGf" } = req.body; // Default of Rachel voice, highly melodic
  if (!text) {
    return res.status(400).json({ error: "Recitation text is required." });
  }

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return res.status(400).json({ error: "ELEVENLABS_API_KEY_MISSING" });
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": key
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs speech conversion failed: ${response.statusText}`);
    }

    const soundBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(soundBuffer));
  } catch (err: any) {
    console.error("ElevenLabs proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// ROUTES: DETAILED COGNITIVE ANALYTICS REPORT (Phase 13)
// -------------------------------------------------------------

app.get("/api/analytics", authenticateToken, async (req: any, res) => {
  try {
    const notes = await UnifiedDB.findNotesByUser(req.user.id);
    const histories = await UnifiedDB.findQuizHistoryByUser(req.user.id);
    const user = await UnifiedDB.findUserById(req.user.id);

    const notesCount = notes.length;
    const quizCount = histories.length;

    let averageScore = 0;
    if (quizCount > 0) {
      const sum = histories.reduce((acc, curr) => acc + curr.percentage, 0);
      averageScore = Math.round(sum / quizCount);
    }

    // Compute Study Streak (consecutive active dates in studyLogs)
    const logs = user?.studyLogs || [];
    let consecutiveStreak = 0;
    
    if (logs.length > 0) {
      const sortedDates = logs
        .map((l: any) => l.date)
        .filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime()); // Descending

      const uniqueDates = Array.from(new Set(sortedDates));
      if (uniqueDates.length > 0) {
        let currentStreak = 0;
        let expectedDate = new Date(); // Start comparison with local today
        expectedDate.setHours(12, 0, 0, 0);

        for (let i = 0; i < uniqueDates.length; i++) {
          const entryDate = new Date(String(uniqueDates[i]));
          entryDate.setHours(12, 0, 0, 0);

          const daysDiff = Math.round((expectedDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === 0 || (i === 0 && daysDiff === 1)) {
            // First item could be yesterday or today, thereafter must be sequential with diff 1
            currentStreak++;
            expectedDate = entryDate;
            expectedDate.setDate(expectedDate.getDate() - 1);
          } else if (daysDiff === 1) {
            currentStreak++;
            expectedDate.setDate(expectedDate.getDate() - 1);
          } else {
            break;
          }
        }
        consecutiveStreak = currentStreak;
      }
    }

    // Compile recent accuracy trends
    const recentScores = histories.slice(-6).map((h, i) => ({
      name: `Quiz ${i + 1}`,
      score: h.percentage,
      accuracy: h.percentage
    }));

    // Formulate strength topics vs weakness topics
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    histories.forEach((h) => {
      const name = h.title.split(":").slice(-1)[0] || "General";
      if (h.percentage >= 75) {
        if (!strengths.includes(name)) strengths.push(name);
      } else {
        if (!weaknesses.includes(name)) weaknesses.push(name);
      }
    });

    if (strengths.length === 0) strengths.push("Retrieval Recall Practice");
    if (weaknesses.length === 0) weaknesses.push("Focus Endurance Exercises");

    res.json({
      notesCount,
      quizCount,
      averageScore,
      studyHours: Math.round((user?.studyHours || 0) * 10) / 10,
      studyLogs: logs.slice(-7), // Last 7 days
      consecutiveStreak,
      recentScores,
      strengths: strengths.slice(0, 3),
      weaknesses: weaknesses.slice(0, 3)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// VITE CLIENT INTEGRATION & INGRESS ROUTING
// -------------------------------------------------------------

UnifiedDB.init().then((success) => {
  if (success) {
    console.info("⚡ Success: Relational MongoDB collection cluster online.");
  } else {
    console.info("⚠️ warning: Local high-density fallback activated.");
  }

  if (process.env.NODE_ENV !== "production") {
    createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    }).then((vite) => {
      app.use(vite.middlewares);
      console.log("⚡ Vite development middleware bound to port 3000.");
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "localhost", () => {
    console.log(`🚀 Production server launched at http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error("FATAL: Database engine initialization failed:", err);
  process.exit(1);
});
