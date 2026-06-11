import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Define response structures
export interface IFlashcardData {
  question: string;
  answer: string;
}

export interface IMindMapData {
  topic: string;
  subtopics: Array<{
    title: string;
    items: string[];
  }>;
}

// Initialize named Gemini API client with User-Agent
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("⚠️ warning: GEMINI_API_KEY is not defined in this environment. Prompting the system to provide proper alerts on the dashboard.");
}

// Request retry wrapper with exponential backoff for resilience (Phase 6)
async function callGeminiWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    console.warn(`Gemini call failed. Retrying in ${delay}ms... (${retries} attempts left). Error:`, error);
    await new Promise((res) => setTimeout(res, delay));
    return callGeminiWithRetry(fn, retries - 1, delay * 2);
  }
}

export class AIService {
  public static isGeminiAvailable(): boolean {
    return ai !== null;
  }

  // 1. NOTES MATERIAL SUMMARIZATION (Phase 6 & 1)
  public static async generateStudyBuddyNotes(title: string, content: string): Promise<any> {
    if (!ai) {
      throw new Error("GEMINI_API_KEY_MISSING");
    }

    return callGeminiWithRetry(async () => {
      const response = await ai!.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Analyze this educational text: "${content.replace(/"/g, '\\"')}" to build standard, high-contrast, screen-reader friendly study guides.
        
        Generate a conforming JSON object that strictly adheres to the following layout:
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

      const text = response.text || "{}";
      return JSON.parse(text.trim());
    });
  }

  // 2. QUIZ QUESTIONS FORMULATION
  public static async generateStudyQuiz(title: string, content: string, quizType: string, numQuestions: number): Promise<any[]> {
    if (!ai) {
      throw new Error("GEMINI_API_KEY_MISSING");
    }

    const typeInstruction = 
      quizType === "mcq" 
        ? "Create ONLY multiple choice (mcq) questions, each with exactly 4 distinct choices in options."
        : quizType === "boolean"
        ? "Create ONLY True or False (boolean) questions, with options array containing exactly ['True', 'False']."
        : "Create a mix of MCQ, True/False, and short answer questions.";

    return callGeminiWithRetry(async () => {
      const response = await ai!.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Create structured study quiz questions from context:
        Title: "${title}"
        Text: "${content.replace(/"/g, '\\"')}"
        
        Rule limits: ${typeInstruction}
        Construct a JSON array of ${numQuestions} questions matching this structure:
        {
          "questions": [
            {
              "id": "string",
              "question": "question text",
              "type": "mcq" | "boolean" | "short",
              "options": ["Option A", "Option B", "Option C"] (MUST be exactly ['True', 'False'] for boolean, and empty [] for short),
              "correctAnswer": "text of answer",
              "explanation": "educational rationale details"
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
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
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

      const text = response.text || "{}";
      const parsed = JSON.parse(text.trim());
      return parsed.questions || [];
    });
  }

  // 3. PHASE 8: FLASHCARD FORGER
  public static async generateFlashcards(content: string, numCards = 6): Promise<IFlashcardData[]> {
    if (!ai) {
      throw new Error("GEMINI_API_KEY_MISSING");
    }

    return callGeminiWithRetry(async () => {
      const response = await ai!.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Formulate ${numCards} study flashcards from textbook material focusing on important keywords, formulas, or concepts.
        Content: "${content.replace(/"/g, '\\"')}"
        
        Generate a JSON array of study flashcards matching the following scheme:
        {
          "flashcards": [
            {
              "question": "The question or vocabulary term",
              "answer": "The simplified correct definition/answer"
            }
          ]
        }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              flashcards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    answer: { type: Type.STRING }
                  },
                  required: ["question", "answer"]
                }
              }
            },
            required: ["flashcards"]
          }
        }
      });

      const text = response.text || "{}";
      const parsed = JSON.parse(text.trim());
      return parsed.flashcards || [];
    });
  }

  // 4. PHASE 9: MIND MAP TREE CONSTRUCT
  public static async generateMindMap(title: string, content: string): Promise<IMindMapData> {
    if (!ai) {
      throw new Error("GEMINI_API_KEY_MISSING");
    }

    return callGeminiWithRetry(async () => {
      const response = await ai!.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Create a comprehensive conceptual hierarchical structure for a mind map tree about the academic subject "${title}".
        Source Material: "${content.slice(0, 4000).replace(/"/g, '\\"')}"
        
        Generate a conforming JSON object following exactly this schema:
        {
          "topic": "The main topic/chapter title",
          "subtopics": [
            {
              "title": "Subtopic heading, e.g. Core mechanics, history",
              "items": ["Concept/formula 1", "Concept/formula 2"]
            }
          ]
        }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              subtopics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    items: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["title", "items"]
                }
              }
            },
            required: ["topic", "subtopics"]
          }
        }
      });

      const text = response.text || "{}";
      return JSON.parse(text.trim());
    });
  }

  // 5. PHASE 7: RAG EMBEDDINGS (Chunks & Embed Vector)
  public static async createEmbedding(textSegment: string): Promise<number[]> {
    if (!ai) {
      throw new Error("GEMINI_API_KEY_MISSING");
    }

    return callGeminiWithRetry(async () => {
      const result = await ai!.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: textSegment
      });

      const res = result as any;
      if (res.embeddings && res.embeddings[0] && res.embeddings[0].values) {
        return res.embeddings[0].values;
      }
      throw new Error("Embedded content returned blank values");
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

  // 6. PHASE 11: ACCESSIBLE GEMINI VISION
  public static async analyzeImageForAccessibility(base64Image: string, mimeType = "image/png"): Promise<string> {
    if (!ai) {
      throw new Error("GEMINI_API_KEY_MISSING");
    }

    return callGeminiWithRetry(async () => {
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

      const response = await ai!.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, textPart] }
      });

      return response.text || "No description synthesized.";
    });
  }

  // 7. CONTEXT-AWARE CHAT TUTOR (RAG INSPIRED response formulation)
  public static async generateTutorChatResponse(userMessage: string, noteTitle: string, retrievedContext: string, mode: string, conversationHistory: string[]): Promise<string> {
    if (!ai) {
      throw new Error("GEMINI_API_KEY_MISSING");
    }

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

    return callGeminiWithRetry(async () => {
      const response = await ai!.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userMessage,
        config: {
          systemInstruction: systemPrompt
        }
      });

      return response.text || "Unable to formulate a response.";
    });
  }
}
