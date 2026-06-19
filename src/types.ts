export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  voiceSettings: VoicePreferences;
  studyHours?: number;
  studyLogs?: { date: string; minutes: number }[];
}

export interface VoicePreferences {
  enabled: boolean;
  rate: number;
  pitch: number;
  voiceName: string;
  contrastMode: boolean; // Custom high-contrast theme toggle
  textZoom: "normal" | "large" | "extra-large";
}

export interface NoteItem {
  id: string;
  title: string;
  rawContent: string;
  summary: string;
  bulletPoints: string[];
  easyExplanation: string;
  examNotes: string;
  keyDefinitions: { term: string; definition: string }[];
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: "mcq" | "boolean" | "short";
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizItem {
  id: string;
  noteId: string;
  title: string;
  questions: QuizQuestion[];
  createdAt: string;
}

export interface QuizHistory {
  id: string;
  quizId: string;
  noteId: string;
  title: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  completedAt: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  noteId: string;
  messages: ChatMessage[];
  updatedAt: string;
}

export interface ImageCaptionItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface VoiceLog {
  id: string;
  timestamp: string;
  command: string;
  response: string;
  source: "voice_control" | "ai_tutor";
}

export interface DashboardAnalytics {
  notesCount: number;
  quizCount: number;
  averageScore: number;
  studyHours: number;
  studyLogs: { date: string; minutes: number }[];
  recentScores: { name: string; score: number }[];
}
