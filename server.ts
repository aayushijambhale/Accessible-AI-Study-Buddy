import express from "express";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "accessible_study_buddy_secret_key_13579";

// Ensure data folder exists
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, "db.json");

// Define basic database structure
interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  voiceSettings: {
    enabled: boolean;
    rate: number;
    pitch: number;
    voiceName: string;
    contrastMode: boolean; // Accessibility configuration
    textZoom: "normal" | "large" | "extra-large";
  };
  studyHours: number;
  studyLogs: { date: string; minutes: number }[];
}

interface Note {
  id: string;
  userId: string;
  title: string;
  rawContent: string;
  summary: string;
  bulletPoints: string[];
  easyExplanation: string;
  examNotes: string;
  keyDefinitions: { term: string; definition: string }[];
  createdAt: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  type: "mcq" | "boolean" | "short";
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface Quiz {
  id: string;
  noteId: string;
  userId: string;
  title: string;
  questions: QuizQuestion[];
  createdAt: string;
}

interface QuizHistoryItem {
  id: string;
  quizId: string;
  noteId: string;
  userId: string;
  title: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  completedAt: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  userId: string;
  noteId: string;
  messages: ChatMessage[];
  updatedAt: string;
}

interface ImageCaptionReport {
  id: string;
  userId: string;
  title: string;
  description: string;
  createdAt: string;
}

interface LocalDB {
  users: User[];
  notes: Note[];
  quizzes: Quiz[];
  quizHistory: QuizHistoryItem[];
  chatSessions: ChatSession[];
  captions: ImageCaptionReport[];
}

// Helper to read database
function readDB(): LocalDB {
  if (!fs.existsSync(DB_FILE)) {
    const fresh: LocalDB = {
      users: [],
      notes: [],
      quizzes: [],
      quizHistory: [],
      chatSessions: [],
      captions: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("DB corruption, resetting file storage", err);
    return { users: [], notes: [], quizzes: [], quizHistory: [], chatSessions: [], captions: [] };
  }
}

// Helper to write database
function writeDB(data: LocalDB) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Setup bodies size limits for handling large screenshots/pasted images safely
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini SDK with named client parameter (as demanded by system constraints)
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("⚠️ Warning: GEMINI_API_KEY is not defined. AI components will return demo fallbacks.");
}

// Dynamic authentication middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token missing" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: "Token active check failed or expired" });
    }
    req.user = user;
    next();
  });
}

// ==========================================
// ROUTES: AUTHENTICATION
// ==========================================

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "All profile fields are required." });
    }

    const db = readDB();
    if (db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: "User already exists with this email address." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser: User = {
      id: Math.random().toString(36).substring(2, 11),
      email,
      passwordHash,
      fullName,
      voiceSettings: {
        enabled: false,
        rate: 1.0,
        pitch: 1.0,
        voiceName: "",
        contrastMode: false,
        textZoom: "normal",
      },
      studyHours: 0,
      studyLogs: [{ date: new Date().toISOString().split("T")[0], minutes: 10 }]
    };

    db.users.push(newUser);
    writeDB(db);

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({ token, user: { id: newUser.id, email: newUser.email, fullName: newUser.fullName, voiceSettings: newUser.voiceSettings } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const db = readDB();
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, voiceSettings: user.voiceSettings } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get profile
app.get("/api/auth/profile", authenticateToken, (req: any, res) => {
  const db = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User profile not found." });
  }
  res.json({ id: user.id, email: user.email, fullName: user.fullName, voiceSettings: user.voiceSettings, studyHours: user.studyHours, studyLogs: user.studyLogs });
});

// Update User Profile details (Phase 2 Authenticated Customization)
app.put("/api/auth/profile", authenticateToken, (req: any, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    return res.status(400).json({ error: "Full Name and Email Address are required for updates." });
  }

  const db = readDB();
  const userIdx = db.users.findIndex((u) => u.id === req.user.id);
  if (userIdx === -1) {
    return res.status(404).json({ error: "User profile not found." });
  }

  // Check if email already used by someone else
  const otherUser = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.id !== req.user.id);
  if (otherUser) {
    return res.status(400).json({ error: "Email address is already taken by another account." });
  }

  db.users[userIdx].fullName = fullName;
  db.users[userIdx].email = email;
  writeDB(db);

  res.json({
    success: true,
    user: {
      id: db.users[userIdx].id,
      email: db.users[userIdx].email,
      fullName: db.users[userIdx].fullName,
      voiceSettings: db.users[userIdx].voiceSettings,
      studyHours: db.users[userIdx].studyHours,
      studyLogs: db.users[userIdx].studyLogs
    }
  });
});

// Update voice and Accessibility preference settings
app.put("/api/auth/preferences", authenticateToken, (req: any, res) => {
  const { voiceSettings } = req.body;
  if (!voiceSettings) {
    return res.status(400).json({ error: "Preferences payload is required." });
  }

  const db = readDB();
  const userIdx = db.users.findIndex((u) => u.id === req.user.id);
  if (userIdx === -1) {
    return res.status(404).json({ error: "User profile not encountered." });
  }

  db.users[userIdx].voiceSettings = {
    ...db.users[userIdx].voiceSettings,
    ...voiceSettings
  };
  writeDB(db);
  res.json({ success: true, voiceSettings: db.users[userIdx].voiceSettings });
});


// ==========================================
// ROUTES: PDF TO NOTES CONVERTER
// ==========================================

// Create / Process Study Material Notes
app.post("/api/notes/generate", authenticateToken, async (req: any, res) => {
  const { title, content } = req.body;
  if (!content || !title) {
    return res.status(400).json({ error: "Title and study material text are required." });
  }

  try {
    let summaryData = {
      summary: "This is a fallback summary since Gemini API was offline or is currently provisioning.",
      bulletPoints: ["Keep study sessions consistent.", "Break content down visually.", "Read aloud definitions."],
      easyExplanation: "A super simple explanation describing core concepts under 5-year-old terms.",
      examNotes: "Quick reminder definitions to study before the evaluation.",
      keyDefinitions: [{ term: "Study material", definition: "Information and text reviewed for a class" }]
    };

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Create structured study assistants and complete comprehensive summaries.
          Target content to summarize: "${content.replace(/"/g, '\\"')}"
          
          You must generate standard JSON conforming perfectly to this scheme:
          {
            "summary": "a beautiful summary of the content in 2-3 paragraphs",
            "bulletPoints": ["important point 1", "important point 2", "important point 3"],
            "easyExplanation": "a simplified explanation of these same concepts using robust real-world metaphors and easy conversational English language to support people with learning disabilities or screen readers",
            "examNotes": "specific crucial points, formulas, high-yield items or bullet cues critical for scoring well in an exam",
            "keyDefinitions": [
               { "term": "first concept", "definition": "exact visual or clear definition" }
            ]
          }`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                bulletPoints: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                easyExplanation: { type: Type.STRING },
                examNotes: { type: Type.STRING },
                keyDefinitions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      term: { type: Type.STRING },
                      definition: { type: Type.STRING }
                    },
                    required: ["term", "definition"]
                  }
                }
              },
              required: ["summary", "bulletPoints", "easyExplanation", "examNotes", "keyDefinitions"]
            }
          }
        });

        const rawText = response.text || "{}";
        summaryData = JSON.parse(rawText.trim());
      } catch (geminiErr: any) {
        console.error("Gemini failed during summarizing: ", geminiErr);
        // Fall back gracefully to keep system testable
      }
    }

    const db = readDB();
    const newNote: Note = {
      id: "note_" + Math.random().toString(36).substring(2, 11),
      userId: req.user.id,
      title,
      rawContent: content,
      ...summaryData,
      createdAt: new Date().toISOString()
    };

    db.notes.push(newNote);
    
    // Add study logs progress
    const uIdx = db.users.findIndex(u => u.id === req.user.id);
    if (uIdx !== -1) {
      db.users[uIdx].studyHours = (db.users[uIdx].studyHours || 0) + 0.5;
      const today = new Date().toISOString().split("T")[0];
      const logIdx = db.users[uIdx].studyLogs.findIndex(l => l.date === today);
      if (logIdx !== -1) {
        db.users[uIdx].studyLogs[logIdx].minutes += 15;
      } else {
        db.users[uIdx].studyLogs.push({ date: today, minutes: 15 });
      }
    }
    
    writeDB(db);
    res.status(201).json(newNote);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch all notes
app.get("/api/notes", authenticateToken, (req: any, res) => {
  const db = readDB();
  const userNotes = db.notes.filter((n) => n.userId === req.user.id);
  res.json(userNotes);
});

// Fetch single note details
app.get("/api/notes/:id", authenticateToken, (req: any, res) => {
  const db = readDB();
  const note = db.notes.find((n) => n.id === req.params.id && n.userId === req.user.id);
  if (!note) {
    return res.status(404).json({ error: "Study note not located." });
  }
  res.json(note);
});

// Delete note
app.delete("/api/notes/:id", authenticateToken, (req: any, res) => {
  const db = readDB();
  const noteIdx = db.notes.findIndex((n) => n.id === req.params.id && n.userId === req.user.id);
  if (noteIdx === -1) {
    return res.status(404).json({ error: "Study note not located." });
  }
  db.notes.splice(noteIdx, 1);
  writeDB(db);
  res.json({ success: true, message: "Note deleted successfully." });
});


// ==========================================
// ROUTES: QUIZ GENERATOR
// ==========================================

// Generate dynamic quiz from note ID
app.post("/api/quiz/generate", authenticateToken, async (req: any, res) => {
  const { noteId, quizType = "mix", numQuestions = 5 } = req.body;
  if (!noteId) {
    return res.status(400).json({ error: "Note ID is required to generate quiz." });
  }

  const db = readDB();
  const note = db.notes.find((n) => n.id === noteId && n.userId === req.user.id);
  if (!note) {
    return res.status(404).json({ error: "Associated note resource not found." });
  }

  try {
    let quizQuestions: QuizQuestion[] = [
      {
        id: "q1",
        question: `Based on your note '${note.title}', what is one core concept?`,
        type: "mcq",
        options: ["Core definition", "Unrelated option A", "Unrelated option B", "Incorrect Answer"],
        correctAnswer: "Core definition",
        explanation: "This is a general reinforcement item generated automatically."
      },
      {
        id: "q2",
        question: "Active learning improves academic memory retention. True or false?",
        type: "boolean",
        options: ["True", "False"],
        correctAnswer: "True",
        explanation: "Research confirms that active retrieval-practice yields better memory encoding."
      }
    ];

    if (ai) {
      try {
        const typeInstruction = 
          quizType === "mcq" 
            ? "Create ONLY multiple choice (mcq) questions, each with exactly 4 distinct choices in options."
            : quizType === "boolean"
            ? "Create ONLY True or False (boolean) questions, with options array containing exactly ['True', 'False']."
            : quizType === "short"
            ? "Create ONLY Short Answer questions (short) where we test the student's direct knowledge recall. Options array must be empty []. The correctAnswer should be a precise single word or short phrase."
            : "Create a mix of MCQ, True/False, and short answer questions.";

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Create a set of ${numQuestions} educational quiz questions derived from the following study note.
          Title: "${note.title}"
          Content: "${note.rawContent.slice(0, 3000).replace(/"/g, '\\"')}"
          
          Specific constraint: ${typeInstruction}
          
          You must generate a standard JSON array of questions, conforming exactly to this schema:
          {
            "questions": [
              {
                "id": "string_unique_hash",
                "question": "The question text, perfect for screen readers to spell out",
                "type": "mcq" or "boolean" or "short",
                "options": ["Option A", "Option B", "Option C", "Option D"] (MUST be exactly ['True', 'False'] for boolean, and empty [] for short answer),
                "correctAnswer": "Exact text matching the correct option or exact direct answer keyword",
                "explanation": "Clear educational explanation describing why this choice is correct."
              }
            ]
          }`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      question: { type: Type.STRING },
                      type: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                      },
                      correctAnswer: { type: Type.STRING },
                      explanation: { type: Type.STRING }
                    },
                    required: ["id", "question", "type", "options", "correctAnswer", "explanation"]
                  }
                }
              },
              required: ["questions"]
            }
          }
        });

        const rawText = response.text || "{}";
        const parsed = JSON.parse(rawText.trim());
        if (parsed.questions && parsed.questions.length > 0) {
          quizQuestions = parsed.questions;
        }
      } catch (gemErr) {
        console.error("Gemini failed during quiz formulation: ", gemErr);
      }
    }

    const newQuiz: Quiz = {
      id: "quiz_" + Math.random().toString(36).substring(2, 11),
      noteId,
      userId: req.user.id,
      title: `Practice Evaluation: ${note.title} (${quizType.toUpperCase()})`,
      questions: quizQuestions,
      createdAt: new Date().toISOString()
    };

    db.quizzes.push(newQuiz);
    writeDB(db);
    res.status(201).json(newQuiz);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch active quizzes for a note
app.get("/api/quiz/note/:noteId", authenticateToken, (req: any, res) => {
  const db = readDB();
  const quizzes = db.quizzes.filter((q) => q.noteId === req.params.noteId && q.userId === req.user.id);
  res.json(quizzes);
});

// Save a completed quiz history item
app.post("/api/quiz/submit", authenticateToken, (req: any, res) => {
  const { quizId, score, totalQuestions, title, noteId } = req.body;
  if (!quizId || score === undefined || !totalQuestions) {
    return res.status(400).json({ error: "Incomplete quiz report attributes." });
  }

  const db = readDB();
  const historyItem: QuizHistoryItem = {
    id: "history_" + Math.random().toString(36).substring(2, 11),
    quizId,
    noteId: noteId || "",
    userId: req.user.id,
    title: title || "Completed Study Evaluation",
    score,
    totalQuestions,
    percentage: Math.round((score / totalQuestions) * 100),
    completedAt: new Date().toISOString()
  };

  db.quizHistory.push(historyItem);
  
  // Log study analytics
  const uIdx = db.users.findIndex(u => u.id === req.user.id);
  if (uIdx !== -1) {
    db.users[uIdx].studyHours = (db.users[uIdx].studyHours || 0) + 0.2;
  }

  writeDB(db);
  res.status(201).json(historyItem);
});

// Fetch Quiz history
app.get("/api/quiz/history", authenticateToken, (req: any, res) => {
  const db = readDB();
  const userHistory = db.quizHistory.filter((h) => h.userId === req.user.id);
  res.json(userHistory);
});

// Fetch Quiz Leaderboard based on real users active scores
app.get("/api/quiz/leaderboard", authenticateToken, (req: any, res) => {
  const db = readDB();
  const leaderboard = db.users.map((user) => {
    const userQuizzes = db.quizHistory.filter((h) => h.userId === user.id);
    const avgScore = userQuizzes.length > 0
      ? Math.round(userQuizzes.reduce((acc, curr) => acc + curr.percentage, 0) / userQuizzes.length)
      : 0;
    return {
      userId: user.id,
      fullName: user.fullName || "Anonymous Student",
      email: user.email,
      quizzesCount: userQuizzes.length,
      averageScore: avgScore,
      studyHours: Math.round((user.studyHours || 0) * 10) / 10
    };
  });

  // Sort: highest average score first, then most quizzes taken, then studyHours
  leaderboard.sort((a, b) => b.averageScore - a.averageScore || b.quizzesCount - a.quizzesCount || b.studyHours - a.studyHours);

  res.json(leaderboard);
});


// ==========================================
// ROUTES: AI TUTOR CHATBOT
// ==========================================

// Send Chat Message to Context-Aware AI Tutor
app.post("/api/tutor/chat", authenticateToken, async (req: any, res) => {
  const { noteId, userMessage, mode, chatSessionId } = req.body; // mode: "normal" | "easy" | "exam_prep"
  if (!userMessage) {
    return res.status(400).json({ error: "Your query message content is blank." });
  }

  const db = readDB();
  let noteContext = "";
  let noteTitle = "General Knowledge";
  if (noteId) {
    const note = db.notes.find((n) => n.id === noteId && n.userId === req.user.id);
    if (note) {
      noteContext = note.rawContent;
      noteTitle = note.title;
    }
  }

  // Find or create session
  let session = db.chatSessions.find(
    (s) => s.userId === req.user.id && (chatSessionId ? s.id === chatSessionId : (noteId ? s.noteId === noteId : true))
  );

  if (!session) {
    session = {
      id: chatSessionId || "chat_" + Math.random().toString(36).substring(2, 11),
      userId: req.user.id,
      noteId: noteId || "",
      messages: [],
      updatedAt: new Date().toISOString()
    };
    db.chatSessions.push(session);
  }

  // Push user message
  session.messages.push({
    id: "msg_" + Math.random().toString(36).substring(2, 11),
    sender: "user",
    text: userMessage,
    timestamp: new Date().toISOString()
  });

  try {
    let aiResponseText = "Yes, I understand what you represent. Currently checking detailed files for study buddy prompts.";
    
    // Choose specific system instruction depending on pedagogical mode (Phase 6 requirements)
    let modeInstruction = "Explain academic terms clearly, maintaining a rich, supportive tone.";
    if (mode === "easy") {
      modeInstruction = "Use Easy Explanation Mode. Act like a highly empathetic, brilliant mentor explaining topics using everyday household analogies, simple vocabulary, and short conversational terms. This promotes extreme accessibility for auditory, visual, or dynamic learning styles.";
    } else if (mode === "exam_prep") {
      modeInstruction = "Use Exam Preparation Mode. Focus heavily on technical terminology, test formulas, practice recall challenges, memory mnemonics, and strategic exam-passing techniques.";
    }

    if (ai) {
      try {
        const historyContext = session.messages.slice(-6, -1).map(m => `${m.sender.toUpperCase()}: ${m.text}`).join("\n");
        const systemPrompt = `You are "Buddy", the brilliant, warm AI Tutor of the Accessible AI Study Buddy.
        Your task is to provide supportive, high-contrast, screen-reader friendly instruction.
        
        Note Context to draw answers from:
        Title: "${noteTitle}"
        Notes content: "${noteContext.slice(0, 4000).replace(/"/g, '\\"')}"
        
        Pedagogical settings:
        ${modeInstruction}
        
        Recent interaction logs:
        ${historyContext}
        
        Instruction guidelines:
        - Keep responses fully structured, using readable paragraphs.
        - Underline definitions or list them cleanly.
        - Be highly descriptive of concepts for students using read-aloud functionality.
        - Encourage active recollection.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: userMessage,
          config: {
            systemInstruction: systemPrompt,
          }
        });

        aiResponseText = response.text || "I was unable to synthesize the content correctly.";
      } catch (gemErr) {
        console.error("Gemini failed during active tutoring: ", gemErr);
      }
    }

    // Push AI response message
    session.messages.push({
      id: "msg_" + Math.random().toString(36).substring(2, 11),
      sender: "ai",
      text: aiResponseText,
      timestamp: new Date().toISOString()
    });

    session.updatedAt = new Date().toISOString();
    writeDB(db);

    res.json({ aiResponse: aiResponseText, session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch tutoring chats
app.get("/api/tutor/sessions", authenticateToken, (req: any, res) => {
  const db = readDB();
  const userSessions = db.chatSessions.filter((s) => s.userId === req.user.id);
  res.json(userSessions);
});

// Fetch detailed session message thread
app.get("/api/tutor/sessions/:id", authenticateToken, (req: any, res) => {
  const db = readDB();
  const session = db.chatSessions.find((s) => s.id === req.params.id && s.userId === req.user.id);
  if (!session) {
    return res.status(404).json({ error: "Session thread was not located." });
  }
  res.json(session);
});


// ==========================================
// ROUTES: IMAGE DESCRIPTION (ACCESSIBILITY)
// ==========================================

// Multimodal image captioning
app.post("/api/image-caption", authenticateToken, async (req: any, res) => {
  const { imageBase64, title } = req.body; // base64 string starting like data:image/png;base64,...
  if (!imageBase64) {
    return res.status(400).json({ error: "An image data payload is required." });
  }

  // Extract base64 segment
  let cleanedBase64 = imageBase64;
  let mimeType = "image/png";
  if (imageBase64.includes(";base64,")) {
    const parts = imageBase64.split(";base64,");
    cleanedBase64 = parts[1];
    mimeType = parts[0].replace("data:", "");
  }

  try {
    let captionText = "A high contrast illustration depicting classroom diagrams. Safe labels read 'A', 'B' and 'C'. Text at lower-margin reads study guidelines.";

    if (ai) {
      try {
        const imagePart = {
          inlineData: {
            mimeType: mimeType,
            data: cleanedBase64
          }
        };
        const textPart = {
          text: `You are an expert accessibility consultant and visual-to-audio study captioner.
          Describe this study image (could be a snapshot of a lecture, a textbook page, a flowchart, mathematical formulas, or lecture slides) in rich text detail.
          
          Guidelines targeting visually impaired students:
          - Detail exactly what is represented.
          - Transcribe ALL reading texts, titles, formulas, numbers, or headers completely.
          - Describe colors, shapes, charts, and structural hierarchy cleanly and logically.
          - Use readable paragraphs. Keep the layout optimized for screen readers.`
        };

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: { parts: [imagePart, textPart] }
        });

        captionText = response.text || "An image loaded onto the workspace.";
      } catch (gemErr) {
        console.error("Gemini failed during image description: ", gemErr);
      }
    }

    const db = readDB();
    const newReport: ImageCaptionReport = {
      id: "caption_" + Math.random().toString(36).substring(2, 11),
      userId: req.user.id,
      title: title || `Visual Helper Description ${new Date().toLocaleDateString()}`,
      description: captionText,
      createdAt: new Date().toISOString()
    };

    db.captions.push(newReport);
    writeDB(db);

    res.status(201).json(newReport);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch all caption histories
app.get("/api/image-caption", authenticateToken, (req: any, res) => {
  const db = readDB();
  const reports = db.captions.filter((c) => c.userId === req.user.id);
  res.json(reports);
});


// ==========================================
// ROUTES: OVERALL DASHBOARD ANALYTICS
// ==========================================

app.get("/api/analytics", authenticateToken, (req: any, res) => {
  const db = readDB();
  const userId = req.user.id;

  const notesCount = db.notes.filter((n) => n.userId === userId).length;
  const quizHistory = db.quizHistory.filter((h) => h.userId === userId);
  const quizCount = quizHistory.length;

  let averageScore = 0;
  if (quizCount > 0) {
    const totalPercentage = quizHistory.reduce((acc, curr) => acc + curr.percentage, 0);
    averageScore = Math.round(totalPercentage / quizCount);
  }

  const user = db.users.find((u) => u.id === userId);
  const studyHours = user?.studyHours || 0;
  const studyLogs = user?.studyLogs || [{ date: new Date().toISOString().split("T")[0], minutes: 12 }];

  res.json({
    notesCount,
    quizCount,
    averageScore,
    studyHours,
    studyLogs,
    recentScores: quizHistory.slice(-5).map(h => ({ name: h.title.split(":")[0], score: h.percentage }))
  });
});


// ==========================================
// VITE CLIENT INTEGRATION
// ==========================================

if (process.env.NODE_ENV !== "production") {
  // Integrate Vite Dev Middleware in Development setup (running hot reload equivalent checks)
  createViteServer({
    server: { middlewareMode: true },
    appType: "spa"
  }).then((vite) => {
    app.use(vite.middlewares);
    console.log("Vite dev server middleware integrated successfully.");
  });
} else {
  // Serve static assets in Production
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Start Server binding to host '0.0.0.0' on hardcoded port 3000
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server starting happily on http://0.0.0.0:${PORT}`);
});
