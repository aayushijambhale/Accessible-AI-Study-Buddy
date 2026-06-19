import mongoose, { Schema, Document } from "mongoose";
import fs from "fs";
import path from "path";

// -------------------------------------------------------------
// SECURE MONGOOSE SCHEMAS & INTERFACES FOR MONGO ATLAS
// -------------------------------------------------------------

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  fullName: string;
  voiceSettings: {
    enabled: boolean;
    rate: number;
    pitch: number;
    voiceName: string;
    contrastMode: boolean;
    textZoom: "normal" | "large" | "extra-large";
  };
  studyHours: number;
  studyLogs: { date: string; minutes: number }[];
  otp?: string;
  otpExpiry?: Date;
  refreshTokens: string[];
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  fullName: { type: String, required: true },
  voiceSettings: {
    enabled: { type: Boolean, default: false },
    rate: { type: Number, default: 1.0 },
    pitch: { type: Number, default: 1.0 },
    voiceName: { type: String, default: "" },
    contrastMode: { type: Boolean, default: false },
    textZoom: { type: String, enum: ["normal", "large", "extra-large"], default: "normal" }
  },
  studyHours: { type: Number, default: 0 },
  studyLogs: [{ date: String, minutes: Number }],
  otp: { type: String },
  otpExpiry: { type: Date },
  refreshTokens: [{ type: String }]
}, { timestamps: true });

// Note Schema (including custom Flashcard item, MindMap tree, and Embeddings RAG chunk)
export interface IFlashcard {
  id: string;
  question: string;
  answer: string;
  bookmarked: boolean;
  score: number; // For Leitner / progress tracking
}

export interface IMindMapNode {
  topic: string;
  subtopics: Array<{
    title: string;
    items: string[];
  }>;
}

export interface IRagChunk {
  text: string;
  pageNumber: number;
  embedding: number[];
}

export interface INote extends Document {
  userId: string;
  title: string;
  rawContent: string;
  summary: string;
  bulletPoints: string[];
  easyExplanation: string;
  examNotes: string;
  keyDefinitions: Array<{ term: string; definition: string }>;
  flashcards: IFlashcard[];
  mindMap?: IMindMapNode;
  ragChunks: IRagChunk[];
  createdAt: Date;
}

const NoteSchema = new Schema<INote>({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  rawContent: { type: String, required: true },
  summary: { type: String, default: "" },
  bulletPoints: [{ type: String }],
  easyExplanation: { type: String, default: "" },
  examNotes: { type: String, default: "" },
  keyDefinitions: [{ term: String, definition: String }],
  flashcards: [{
    id: String,
    question: String,
    answer: String,
    bookmarked: { type: Boolean, default: false },
    score: { type: Number, default: 0 }
  }],
  mindMap: {
    topic: String,
    subtopics: [{
      title: String,
      items: [String]
    }]
  },
  ragChunks: [{
    text: String,
    pageNumber: Number,
    embedding: [Number]
  }]
}, { timestamps: true });

// Quiz Schemas
export interface IQuizQuestion {
  id: string;
  question: string;
  type: "mcq" | "boolean" | "short";
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface IQuiz extends Document {
  noteId: string;
  userId: string;
  title: string;
  questions: IQuizQuestion[];
  createdAt: Date;
}

const QuizSchema = new Schema<IQuiz>({
  noteId: { type: String, required: true },
  userId: { type: String, required: true },
  title: { type: String, required: true },
  questions: [{
    id: String,
    question: String,
    type: { type: String, enum: ["mcq", "boolean", "short"] },
    options: [String],
    correctAnswer: String,
    explanation: String
  }]
}, { timestamps: true });

// Quiz History Schema
export interface IQuizHistory extends Document {
  quizId: string;
  noteId: string;
  userId: string;
  title: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  completedAt: Date;
}

const QuizHistorySchema = new Schema<IQuizHistory>({
  quizId: { type: String, required: true },
  noteId: { type: String, default: "" },
  userId: { type: String, required: true },
  title: { type: String, default: "" },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  percentage: { type: Number, required: true },
  completedAt: { type: Date, default: Date.now }
});

// Chat Session Schema
export interface IChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
}

export interface IChatSession extends Document {
  userId: string;
  noteId: string;
  messages: IChatMessage[];
  updatedAt: Date;
}

const ChatSessionSchema = new Schema<IChatSession>({
  userId: { type: String, required: true },
  noteId: { type: String, default: "" },
  messages: [{
    id: String,
    sender: { type: String, enum: ["user", "ai"] },
    text: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Visual Helper Image Caption Schema
export interface ICaption extends Document {
  userId: string;
  title: string;
  description: string;
  imageUrl?: string; // Phase 5 file store link
  createdAt: Date;
}

const CaptionSchema = new Schema<ICaption>({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: { type: String, default: "" }
}, { timestamps: true });

// Upload File Schema
export interface IUpload extends Document {
  userId: string;
  fileName: string;
  fileUrl: string;
  fileSize: string;
  fileType: string;
  createdAt: Date;
}

const UploadSchema = new Schema<IUpload>({
  userId: { type: String, required: true },
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileSize: { type: String, default: "" },
  fileType: { type: String, default: "" }
}, { timestamps: true });

// Register models if using Mongoose
export const User: any = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export const Note: any = mongoose.models.Note || mongoose.model<INote>("Note", NoteSchema);
export const Quiz: any = mongoose.models.Quiz || mongoose.model<IQuiz>("Quiz", QuizSchema);
export const QuizHistory: any = mongoose.models.QuizHistory || mongoose.model<IQuizHistory>("QuizHistory", QuizHistorySchema);
export const ChatSession: any = mongoose.models.ChatSession || mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);
export const Caption: any = mongoose.models.Caption || mongoose.model<ICaption>("Caption", CaptionSchema);
export const Upload: any = mongoose.models.Upload || mongoose.model<IUpload>("Upload", UploadSchema);


// -------------------------------------------------------------
// DUAL ENGINE UNIFIED ACCESSIBLE DATABASE INTEGRATOR
// -------------------------------------------------------------

const DB_FILE = path.join(process.cwd(), "data", "db.json");

// Define a local database structure in memory / local storage file for development safety
class UnifiedDB {
  private static useMongo = false;

  public static async init(): Promise<boolean> {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.warn("⚠️ Warning: MONGODB_URI environment variable is missing. Running in local high-density JSON file engine mode.");
      this.useMongo = false;
      return false;
    }
    
    // Support safe pre-connection scheme validation (fixes Phase 4 MongoParseErrors)
    if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
      console.warn("⚠️ Warning: Invalid MONGODB_URI connection scheme. It must start with 'mongodb://' or 'mongodb+srv://' - defaulting to local high-density JSON file engine mode.");
      this.useMongo = false;
      return false;
    }

    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000
      });
      console.info("⚡ Success: Successfully connected to real MongoDB Atlas Cluster!");
      this.useMongo = true;
      return true;
    } catch (err) {
      console.error("❌ MongoDB Atlas connection failed, defaulting to local high-density JSON file engine mode:", err);
      this.useMongo = false;
      return false;
    }
  }

  private static loadLocalJSON(): any {
    const dbDir = path.dirname(DB_FILE);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const fresh = { users: [], notes: [], quizzes: [], quizHistory: [], chatSessions: [], captions: [], uploads: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
      return fresh;
    }
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    } catch (err) {
      return { users: [], notes: [], quizzes: [], quizHistory: [], chatSessions: [], captions: [], uploads: [] };
    }
  }

  private static saveLocalJSON(data: any) {
    const dbDir = path.dirname(DB_FILE);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  }

  // ----------------------------------------
  // USERS SERVICES
  // ----------------------------------------
  public static async findUserByEmail(email: string): Promise<any | null> {
    if (this.useMongo) {
      return await User.findOne({ email: email.toLowerCase() });
    } else {
      const db = this.loadLocalJSON();
      return db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase()) || null;
    }
  }

  public static async findUserById(id: string): Promise<any | null> {
    if (this.useMongo) {
      return await User.findById(id);
    } else {
      const db = this.loadLocalJSON();
      return db.users.find((u: any) => u.id === id || u._id === id) || null;
    }
  }

  public static async createUser(data: Partial<IUser>): Promise<any> {
    if (this.useMongo) {
      return await User.create(data);
    } else {
      const db = this.loadLocalJSON();
      const newUser = {
        _id: Math.random().toString(36).substring(2, 11),
        id: Math.random().toString(36).substring(2, 11),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      db.users.push(newUser);
      this.saveLocalJSON(db);
      return newUser;
    }
  }

  public static async updateUser(id: string, updates: Partial<IUser>): Promise<any> {
    if (this.useMongo) {
      return await User.findByIdAndUpdate(id, { $set: updates }, { new: true });
    } else {
      const db = this.loadLocalJSON();
      const idx = db.users.findIndex((u: any) => u.id === id || u._id === id);
      if (idx !== -1) {
        db.users[idx] = { ...db.users[idx], ...updates, updatedAt: new Date() };
        this.saveLocalJSON(db);
        return db.users[idx];
      }
      return null;
    }
  }

  // ----------------------------------------
  // NOTES SERVICES
  // ----------------------------------------
  public static async findNotesByUser(userId: string): Promise<any[]> {
    if (this.useMongo) {
      return await Note.find({ userId });
    } else {
      const db = this.loadLocalJSON();
      return db.notes.filter((n: any) => n.userId === userId);
    }
  }

  public static async findNoteById(id: string): Promise<any | null> {
    if (this.useMongo) {
      return await Note.findById(id);
    } else {
      const db = this.loadLocalJSON();
      return db.notes.find((n: any) => n.id === id || n._id === id) || null;
    }
  }

  public static async createNote(data: Partial<INote>): Promise<any> {
    if (this.useMongo) {
      return await Note.create(data);
    } else {
      const db = this.loadLocalJSON();
      const newNote = {
        _id: Math.random().toString(36).substring(2, 11),
        id: "note_" + Math.random().toString(36).substring(2, 11),
        flashcards: [],
        ragChunks: [],
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      db.notes.push(newNote);
      this.saveLocalJSON(db);
      return newNote;
    }
  }

  public static async updateNote(id: string, updates: Partial<INote>): Promise<any> {
    if (this.useMongo) {
      return await Note.findByIdAndUpdate(id, { $set: updates }, { new: true });
    } else {
      const db = this.loadLocalJSON();
      const idx = db.notes.findIndex((n: any) => n.id === id || n._id === id);
      if (idx !== -1) {
        db.notes[idx] = { ...db.notes[idx], ...updates, updatedAt: new Date() };
        this.saveLocalJSON(db);
        return db.notes[idx];
      }
      return null;
    }
  }

  public static async deleteNote(id: string, userId: string): Promise<boolean> {
    if (this.useMongo) {
      const result = await Note.deleteOne({ _id: id, userId });
      return result.deletedCount > 0;
    } else {
      const db = this.loadLocalJSON();
      const lengthBefore = db.notes.length;
      db.notes = db.notes.filter((n: any) => !( (n.id === id || n._id === id) && n.userId === userId));
      this.saveLocalJSON(db);
      return db.notes.length < lengthBefore;
    }
  }

  // ----------------------------------------
  // QUIZZES SERVICES
  // ----------------------------------------
  public static async findQuizzesByNote(noteId: string, userId: string): Promise<any[]> {
    if (this.useMongo) {
      return await Quiz.find({ noteId, userId });
    } else {
      const db = this.loadLocalJSON();
      return db.quizzes.filter((q: any) => q.noteId === noteId && q.userId === userId);
    }
  }

  public static async createQuiz(data: Partial<IQuiz>): Promise<any> {
    if (this.useMongo) {
      return await Quiz.create(data);
    } else {
      const db = this.loadLocalJSON();
      const newQuiz = {
        _id: Math.random().toString(36).substring(2, 11),
        id: "quiz_" + Math.random().toString(36).substring(2, 11),
        ...data,
        createdAt: new Date()
      };
      db.quizzes.push(newQuiz);
      this.saveLocalJSON(db);
      return newQuiz;
    }
  }

  // ----------------------------------------
  // QUIZ HISTORY SERVICES
  // ----------------------------------------
  public static async findQuizHistoryByUser(userId: string): Promise<any[]> {
    if (this.useMongo) {
      return await QuizHistory.find({ userId });
    } else {
      const db = this.loadLocalJSON();
      return db.quizHistory.filter((h: any) => h.userId === userId);
    }
  }

  public static async createQuizHistory(data: Partial<IQuizHistory>): Promise<any> {
    if (this.useMongo) {
      return await QuizHistory.create(data);
    } else {
      const db = this.loadLocalJSON();
      const newH = {
        _id: Math.random().toString(36).substring(2, 11),
        id: "history_" + Math.random().toString(36).substring(2, 11),
        completedAt: new Date(),
        ...data
      };
      db.quizHistory.push(newH);
      this.saveLocalJSON(db);
      return newH;
    }
  }

  // ----------------------------------------
  // CHAT SYSTEM SERVICES
  // ----------------------------------------
  public static async findChatSessionsByUser(userId: string): Promise<any[]> {
    if (this.useMongo) {
      return await ChatSession.find({ userId });
    } else {
      const db = this.loadLocalJSON();
      return db.chatSessions.filter((s: any) => s.userId === userId);
    }
  }

  public static async findChatSessionById(id: string, userId: string): Promise<any | null> {
    if (this.useMongo) {
      return await ChatSession.findOne({ _id: id, userId });
    } else {
      const db = this.loadLocalJSON();
      return db.chatSessions.find((s: any) => (s.id === id || s._id === id) && s.userId === userId) || null;
    }
  }

  public static async findOrCreateChatSession(noteId: string, userId: string, chatSessionId?: string): Promise<any> {
    if (this.useMongo) {
      if (chatSessionId) {
        const found = await ChatSession.findOne({ _id: chatSessionId, userId });
        if (found) return found;
      } else if (noteId) {
        const found = await ChatSession.findOne({ noteId, userId });
        if (found) return found;
      }
      return await ChatSession.create({ noteId, userId, messages: [] });
    } else {
      const db = this.loadLocalJSON();
      let found = db.chatSessions.find((s: any) => s.userId === userId && (chatSessionId ? (s.id === chatSessionId || s._id === chatSessionId) : (noteId ? s.noteId === noteId : false)));
      if (!found) {
        found = {
          _id: chatSessionId || "chat_" + Math.random().toString(36).substring(2, 11),
          id: chatSessionId || "chat_" + Math.random().toString(36).substring(2, 11),
          userId,
          noteId: noteId || "",
          messages: [],
          updatedAt: new Date()
        };
        db.chatSessions.push(found);
        this.saveLocalJSON(db);
      }
      return found;
    }
  }

  public static async pushChatMessage(sessionId: string, userId: string, message: Partial<IChatMessage>): Promise<any> {
    if (this.useMongo) {
      const session = await ChatSession.findOneAndUpdate(
        { _id: sessionId, userId },
        { $push: { messages: message }, $set: { updatedAt: new Date() } },
        { new: true }
      );
      if (!session && mongoose.Types.ObjectId.isValid(sessionId)) {
        return null;
      }
      return session;
    } else {
      const db = this.loadLocalJSON();
      const idx = db.chatSessions.findIndex((s: any) => (s.id === sessionId || s._id === sessionId) && s.userId === userId);
      if (idx !== -1) {
        db.chatSessions[idx].messages.push({
          id: "msg_" + Math.random().toString(36).substring(2, 11),
          timestamp: new Date(),
          ...message
        });
        db.chatSessions[idx].updatedAt = new Date();
        this.saveLocalJSON(db);
        return db.chatSessions[idx];
      }
      return null;
    }
  }

  // ----------------------------------------
  // CAPTION/VISION HELPER SERVICES
  // ----------------------------------------
  public static async findCaptionsByUser(userId: string): Promise<any[]> {
    if (this.useMongo) {
      return await Caption.find({ userId });
    } else {
      const db = this.loadLocalJSON();
      return db.captions.filter((c: any) => c.userId === userId);
    }
  }

  public static async createCaption(data: Partial<ICaption>): Promise<any> {
    if (this.useMongo) {
      return await Caption.create(data);
    } else {
      const db = this.loadLocalJSON();
      const newCap = {
        _id: Math.random().toString(36).substring(2, 11),
        id: "caption_" + Math.random().toString(36).substring(2, 11),
        createdAt: new Date(),
        ...data
      };
      db.captions.push(newCap);
      this.saveLocalJSON(db);
      return newCap;
    }
  }

  // ----------------------------------------
  // FILE FILES/UPLOADS SERVICES
  // ----------------------------------------
  public static async findUploadsByUser(userId: string): Promise<any[]> {
    if (this.useMongo) {
      return await Upload.find({ userId });
    } else {
      const db = this.loadLocalJSON();
      return db.uploads.filter((u: any) => u.userId === userId);
    }
  }

  public static async createUpload(data: Partial<IUpload>): Promise<any> {
    if (this.useMongo) {
      return await Upload.create(data);
    } else {
      const db = this.loadLocalJSON();
      const newUp = {
        _id: Math.random().toString(36).substring(2, 11),
        id: "upload_" + Math.random().toString(36).substring(2, 11),
        createdAt: new Date(),
        ...data
      };
      db.uploads.push(newUp);
      this.saveLocalJSON(db);
      return newUp;
    }
  }

  // ----------------------------------------
  // OVERALL MULTI-USER STATISTICS
  // ----------------------------------------
  public static async getLeaderboard(): Promise<any[]> {
    if (this.useMongo) {
      const users = await User.find({});
      const leaderboard = [];
      for (const u of users) {
        const histories = await QuizHistory.find({ userId: u._id.toString() });
        const avgScore = histories.length > 0
          ? Math.round(histories.reduce((acc, curr) => acc + curr.percentage, 0) / histories.length)
          : 0;
        leaderboard.push({
          userId: u._id,
          fullName: u.fullName || "Anonymous Student",
          email: u.email,
          quizzesCount: histories.length,
          averageScore: avgScore,
          studyHours: Math.round((u.studyHours || 0) * 10) / 10
        });
      }
      return leaderboard.sort((a, b) => b.averageScore - a.averageScore || b.quizzesCount - a.quizzesCount);
    } else {
      const db = this.loadLocalJSON();
      return db.users.map((user: any) => {
        const userQuizzes = db.quizHistory.filter((h: any) => h.userId === user.id || h.userId === user._id);
        const avgScore = userQuizzes.length > 0
          ? Math.round(userQuizzes.reduce((acc, curr) => acc + curr.percentage, 0) / userQuizzes.length)
          : 0;
        return {
          userId: user.id || user._id,
          fullName: user.fullName || "Anonymous Student",
          email: user.email,
          quizzesCount: userQuizzes.length,
          averageScore: avgScore,
          studyHours: Math.round((user.studyHours || 0) * 10) / 10
        };
      }).sort((a: any, b: any) => b.averageScore - a.averageScore || b.quizzesCount - a.quizzesCount);
    }
  }
}

export default UnifiedDB;
