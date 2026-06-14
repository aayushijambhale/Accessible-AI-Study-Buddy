import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Provider options from environment variables
const AI_PROVIDER = process.env.AI_PROVIDER || "gemini"; // "gemini" | "openai" | "groq" | "openrouter"
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Initialize named Gemini API client
let ai: GoogleGenAI | null = null;

if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("⚠️ warning: GEMINI_API_KEY is not defined in this environment.");
}

export class CoreAIService {
  public static isGeminiAvailable(): boolean {
    return ai !== null;
  }

  public static getAIClient(): GoogleGenAI {
    if (!ai) {
      throw new Error("GEMINI_API_KEY_MISSING");
    }
    return ai;
  }

  /**
   * Request retry wrapper with exponential backoff for resilience.
   * Explicitly handles 429 Quota Exceeded and guarantees non-crash behavior.
   */
  public static async callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (retries <= 0) {
        console.error("AI Service failed after maximum retries. Error:", error);
        throw new Error(
          JSON.stringify({
            message: "The AI service is currently experiencing high load or quota limits. Please try again later.",
            code: error?.status || error?.code || 500,
            provider: AI_PROVIDER
          })
        );
      }
      
      console.warn(`AI provider call failed. Retrying in ${delay}ms... (${retries} attempts left). Error:`, error.message || error);
      await new Promise((res) => setTimeout(res, delay));
      return this.callWithRetry(fn, retries - 1, delay * 2);
    }
  }

  /**
   * Universal provider wrapper for structured data generation
   */
  public static async generateStructuredData(prompt: string, schemaDefinition: any): Promise<any> {
    return this.callWithRetry(async () => {
      // In a real multi-provider setup, we would route to OpenAI/Groq here using their respective SDKs
      // We will default to Gemini if AI_PROVIDER is gemini, else we mock/throw unsupported for now
      if (AI_PROVIDER !== "gemini") {
        console.warn(`Provider ${AI_PROVIDER} is selected but not fully wired with SDKs yet. Falling back to Gemini.`);
      }

      const response = await this.getAIClient().models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schemaDefinition
        }
      });
      
      const text = response.text || "{}";
      return JSON.parse(text.trim());
    });
  }

  /**
   * Universal provider wrapper for generic text generation
   */
  public static async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    return this.callWithRetry(async () => {
      const config: any = {};
      if (systemInstruction) config.systemInstruction = systemInstruction;

      const response = await this.getAIClient().models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config
      });

      return response.text || "Unable to formulate a response.";
    });
  }

  // Segment study notes into clean passages of ~500 characters for high performance RAG searches
  public static chunkContent(text: string, size = 600): string[] {
    const cleanText = text.replace(/\s+/g, " ").trim();
    const chunks: string[] = [];
    let start = 0;
    while (start < cleanText.length) {
      const end = start + size;
      if (end >= cleanText.length) {
        chunks.push(cleanText.substring(start));
        break;
      }
      // Backtrack to find closest period or space boundary
      let spaceIdx = cleanText.lastIndexOf(" ", end);
      if (spaceIdx > start && spaceIdx < end + 50) {
        chunks.push(cleanText.substring(start, spaceIdx));
        start = spaceIdx + 1;
      } else {
        chunks.push(cleanText.substring(start, end));
        start = end;
      }
    }
    return chunks;
  }

  public static async createEmbedding(textSegment: string): Promise<number[]> {
    return this.callWithRetry(async () => {
      const result = await this.getAIClient().models.embedContent({
        model: "text-embedding-004",
        contents: textSegment
      });

      const res = result as any;
      if (res.embeddings && res.embeddings[0] && res.embeddings[0].values) {
        return res.embeddings[0].values;
      }
      throw new Error("Embedded content returned blank values");
    });
  }

  public static async analyzeImageForAccessibility(base64Image: string, mimeType = "image/png"): Promise<string> {
    return this.callWithRetry(async () => {
      const imagePart = {
        inlineData: {
          mimeType,
          data: base64Image
        }
      };

      const textPart = {
        text: `You are an expert accessibility consultant and visual-to-audio study captioner.
        Describe this study image (flowchart, textbook page, formula sheet, or lecture slides) in deep, rich detail.
        
        Requirements:
        - Describe what is visually represented.
        - Transcribe ALL reading texts, formulas, calculations, numbers, or headers completely.
        - Describe colors, visual flow, structures, and charts clearly.
        - Use clean, screen-reader friendly narrative paragraphs.`
      };

      const response = await this.getAIClient().models.generateContent({
        model: "gemini-1.5-flash",
        contents: { parts: [imagePart, textPart] }
      });

      return response.text || "No description synthesized.";
    });
  }

  public static async generateTutorChatResponse(userMessage: string, noteTitle: string, retrievedContext: string, mode: string, conversationHistory: string[]): Promise<string> {
    let modeInstruction = "Explain academic terms clearly, maintaining a rich, supportive tone.";
    if (mode === "easy") {
      modeInstruction = "Use Easy Explanation Mode. Act like a highly empathetic, brilliant mentor explaining topics using everyday household analogies, simple vocabulary, and short conversational terms. This promotes extreme accessibility for auditory, visual, or dynamic learning styles.";
    } else if (mode === "exam_prep") {
      modeInstruction = "Use Exam Preparation Mode. Focus heavily on technical terminology, test formulas, practice recall challenges, memory mnemonics, and strategic exam-passing techniques.";
    }

    const historyStr = conversationHistory.slice(-6).join("\n");

    const systemPrompt = `You are "Buddy", the brilliant, warm AI Tutor of the Accessible AI Study Buddy.
    Your task is to provide supportive, high-contrast, screen-reader friendly instruction.
    
    CRITICAL RAG RULE: Draw your answers first and foremost from this extracted reference context:
    Title: "${noteTitle}"
    Retrieved Relevant Context: "${retrievedContext.replace(/"/g, '\\"')}"
    
    If the user's question cannot be answered using the retrieved context, answer truthfully based on general knowledge but clearly indicate that the information is not in the uploaded document.
    
    Pedagogical settings:
    ${modeInstruction}
    
    Recent Chat History:
    ${historyStr}
    
    Core Rules:
    - Keep responses fully structured, using readable paragraphs.
    - Highlight definitions or list them cleanly.
    - Be highly descriptive of concepts for students using read-aloud functionality.
    - Encourage active recollection.`;

    return this.generateText(userMessage, systemPrompt);
  }
}
