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

// Clean and translate cluttered JSON-wrapped errors from Gemini/GenAI API to friendly notices (Phase 6)
function getCleanErrorMessage(error: any): string {
  if (!error) return "Unknown Gemini error occurred.";
  let msg = error.message || String(error);
  if (typeof msg === "string" && msg.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) {
        msg = parsed.error.message;
      }
    } catch {
      // Keep original message if parsing failed
    }
  }
  
  if (msg.includes("Quota exceeded") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
    return "The Gemini API call failed because the current model quota has been exceeded. Please check your billing/request caps or switch/update your API key in Settings > Secrets.";
  }
  if (msg.includes("UNAVAILABLE") || msg.includes("503") || msg.includes("high demand") || msg.includes("experiencing high demand")) {
    return "The Gemini API is currently experiencing unusually high demand. Retrying or trying again shortly represents the best recovery.";
  }
  return msg;
}

// Request retry wrapper with exponential backoff and fallback capability for extreme resilience (Phase 6)
async function callGeminiWithRetry<T>(
  fn: (model: string) => Promise<T>,
  retries = 3,
  delay = 1000,
  currentModel = "gemini-3.5-flash"
): Promise<T> {
  try {
    return await fn(currentModel);
  } catch (error: any) {
    const cleanMsg = getCleanErrorMessage(error);
    const isHardError =
      cleanMsg.toLowerCase().includes("quota") ||
      cleanMsg.toLowerCase().includes("limit") ||
      cleanMsg.toLowerCase().includes("exhausted") ||
      cleanMsg.toLowerCase().includes("429") ||
      cleanMsg.toLowerCase().includes("api key") ||
      cleanMsg.toLowerCase().includes("unauthorized") ||
      cleanMsg.toLowerCase().includes("billing");

    if (retries <= 0 || isHardError) {
      throw new Error(cleanMsg);
    }

    // Check if the model failed or is unavailable/experiencing spikes, and fallback immediately
    let nextModel = currentModel;
    if (currentModel === "gemini-3.5-flash") {
      nextModel = "gemini-3.1-flash-lite";
      console.info(`🔄 Gemini 3.5 Flash unavailable or busy. Falling back to "${nextModel}" for resilience...`);
    } else if (currentModel === "gemini-3.1-flash-lite") {
      nextModel = "gemini-3.5-flash"; // retry original if backoff has completed
    }

    console.warn(`Gemini call failed on ${currentModel}. Retrying in ${delay}ms... (${retries} attempts left). Error: ${cleanMsg}`);
    await new Promise((res) => setTimeout(res, delay));
    return callGeminiWithRetry(fn, retries - 1, delay * 2, nextModel);
  }
}

export class AIService {
  public static isGeminiAvailable(): boolean {
    return ai !== null;
  }

  // --- LOCAL FALLBACK GENERATORS FOR FAULT-TOLERANCE ---
  private static generateOfflineNotesFallback(title: string, content: string): any {
    const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
    const summary = (sentences.slice(0, Math.min(3, sentences.length)).join(". ") + ".").replace(/\s+/g, " ");
    
    const bulletPoints = sentences.slice(Math.min(3, sentences.length), Math.min(10, sentences.length));
    if (bulletPoints.length === 0) {
      bulletPoints.push(
        "Ensure comprehensive review of all terminology highlighted throughout the curriculum.",
        "Focus on core conceptual outlines specified in the syllabus."
      );
    }

    const easyExplanation = `Here is a simplified explanation of the ${title} material: This text covers the fundamental mechanics, key relationships, and conceptual ideas of ${title}. In plain English, the primary aim here is understanding how these concepts fit together to build a complete foundation. Imagine this topic like a puzzle: each individual definition and note represents a single piece, and when they are connected, they reveal the complete picture. This helps make the study guide highly accessible for all learners.`;

    const examNotes = `Key Exam Takeaways:\n- Be absolutely certain to memorize all definitions listed for ${title}.\n- Understand the relational dependencies between key variables.\n- Prioritize review of chapters matching these summary notes.`;

    const keyDefinitions: Array<{ term: string; definition: string }> = [];
    const definitionSentences = sentences.filter(s => s.toLowerCase().includes(" is ") || s.toLowerCase().includes(" refers to ") || s.includes(":"));
    
    for (const s of definitionSentences.slice(0, 5)) {
      const parts = s.split(/ is | refers to |:/i);
      if (parts.length >= 2) {
        const term = parts[0].trim().substring(0, 50);
        const def = parts.slice(1).join(" ").trim();
        if (term && def) {
          keyDefinitions.push({ term, definition: def });
        }
      }
    }

    if (keyDefinitions.length === 0) {
      keyDefinitions.push({
        term: title,
        definition: "The primary study material subject under consideration in this custom lesson guide."
      }, {
        term: "Core Concept",
        definition: "A fundamental building block or idea central to understanding the broader curriculum."
      });
    }

    return {
      summary,
      bulletPoints,
      easyExplanation,
      examNotes,
      keyDefinitions
    };
  }

  private static generateOfflineQuizFallback(title: string, content: string, quizType: string, numQuestions: number): any[] {
    const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
    const questions: any[] = [];
    
    for (let i = 0; i < numQuestions; i++) {
      const sentence = sentences[i % sentences.length] || `Review details about ${title}`;
      const questionId = `quiz_offline_${Date.now()}_${i}`;
      
      if (quizType === "boolean" || (quizType !== "mcq" && i % 2 === 0)) {
        questions.push({
          id: questionId,
          question: `True or False: According to the study guide, "${sentence.substring(0, 150)}"?`,
          type: "boolean",
          options: ["True", "False"],
          correctAnswer: "True",
          explanation: `The study material explicitly confirms or supports the statement: "${sentence}".`
        });
      } else {
        const options = [
          `Confirming: ${sentence.substring(0, 80)}`,
          `Unlinked context statement about ${title}`,
          `Random unrelated concept distractor`,
          `Opposite statement or misconception`
        ];
        const correctAnswer = options[0];
        const shuffled = [...options].sort(() => 0.5 - Math.random());
        
        questions.push({
          id: questionId,
          question: `In reference to "${title}", which of the following is correct?`,
          type: "mcq",
          options: shuffled,
          correctAnswer: correctAnswer,
          explanation: `The textbook context explicitly states or implies that: "${sentence}".`
        });
      }
    }
    return questions;
  }

  private static generateOfflineFlashcardsFallback(content: string, numCards: number): IFlashcardData[] {
    const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
    const cards: IFlashcardData[] = [];
    for (let i = 0; i < numCards; i++) {
      const sentence = sentences[i % sentences.length] || "General course syllabus outline details";
      cards.push({
        question: `Define/Explain the concept: "${sentence.substring(0, 60)}..."`,
        answer: sentence
      });
    }
    return cards;
  }

  private static generateOfflineMindMapFallback(title: string, content: string): IMindMapData {
    const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
    const subtopics = [
      {
        title: "Introduction and core foundations",
        items: sentences.slice(0, 3)
      },
      {
        title: "Key relationships and methods",
        items: sentences.slice(3, 6)
      },
      {
        title: "Exam details and review notes",
        items: sentences.slice(6, 9)
      }
    ].filter(s => s.items.length > 0);

    if (subtopics.length === 0) {
      subtopics.push({
        title: "General Curriculum",
        items: ["Core lesson notes", "Comprehensive workbook references"]
      });
    }

    return {
      topic: title,
      subtopics
    };
  }

  private static generateOfflineAccessibilityVisionFallback(base64Image: string): string {
    return `[OFFLINE TRANSCRIPTION OUTLINE] This image represents a supplementary visual study slide or document upload. Due to temporary network or API key request constraints, the live vision analyzer served a local structural placeholder description. Visual elements appear clustered cleanly, supporting textbook illustrations and curriculum figures suited for direct screen readouts. No major standalone text items could be extracted dynamically outside the main study notes body. Please review the adjacent textual notes for the full course material.`;
  }

  private static generateOfflineTutorResponseFallback(userMessage: string, noteTitle: string, retrievedContext: string): string {
    const msgLower = userMessage.toLowerCase();
    const sentences = retrievedContext.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
    const matchingSentences = sentences.filter(s => {
      const words = msgLower.split(/\s+/).filter(w => w.length > 3);
      return words.some(w => s.toLowerCase().includes(w));
    });

    let answer = "";
    if (matchingSentences.length > 0) {
      answer = `Based on the study guide "${noteTitle}", here is what I found:\n\n` + 
               matchingSentences.slice(0, 3).map(s => `• ${s}`).join("\n\n");
    } else {
      answer = `I am currently operating in resilient tutor mode. I scanned the study guide "${noteTitle}" for keywords related to your question.\n\n` +
               `Although I could not find an exact visual match for your query, the study materials cover fundamental principles of "${noteTitle}".\n\n` +
               `Here is a core textbook takeaway to guide your review:\n` +
               (sentences[0] ? `• ${sentences[0]}` : `• Focus your study on the key concepts outlined in this workbook section.`);
    }
    return answer;
  }

  // 1. NOTES MATERIAL SUMMARIZATION (Phase 6 & 1)
  public static async generateStudyBuddyNotes(title: string, content: string): Promise<any> {
    try {
      if (!ai) {
        throw new Error("GEMINI_API_KEY_MISSING");
      }

      return await callGeminiWithRetry(async (model) => {
        const response = await ai!.models.generateContent({
          model: model,
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
    } catch (err) {
      console.warn("⚠️ generateStudyBuddyNotes failed or rate-limited. Serving intelligent offline fallback.", err);
      return this.generateOfflineNotesFallback(title, content);
    }
  }

  // 2. QUIZ QUESTIONS FORMULATION
  public static async generateStudyQuiz(title: string, content: string, quizType: string, numQuestions: number): Promise<any[]> {
    try {
      if (!ai) {
        throw new Error("GEMINI_API_KEY_MISSING");
      }

      const typeInstruction = 
        quizType === "mcq" 
          ? "Create ONLY multiple choice (mcq) questions, each with exactly 4 distinct choices in options."
          : quizType === "boolean"
          ? "Create ONLY True or False (boolean) questions, with options array containing exactly ['True', 'False']."
          : "Create a mix of MCQ, True/False, and short answer questions.";

      return await callGeminiWithRetry(async (model) => {
        const response = await ai!.models.generateContent({
          model: model,
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
    } catch (err) {
      console.warn("⚠️ generateStudyQuiz failed or rate-limited. Serving intelligent offline fallback.", err);
      return this.generateOfflineQuizFallback(title, content, quizType, numQuestions);
    }
  }

  // 3. PHASE 8: FLASHCARD FORGER
  public static async generateFlashcards(content: string, numCards = 6): Promise<IFlashcardData[]> {
    try {
      if (!ai) {
        throw new Error("GEMINI_API_KEY_MISSING");
      }

      return await callGeminiWithRetry(async (model) => {
        const response = await ai!.models.generateContent({
          model: model,
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
    } catch (err) {
      console.warn("⚠️ generateFlashcards failed or rate-limited. Serving intelligent offline fallback.", err);
      return this.generateOfflineFlashcardsFallback(content, numCards);
    }
  }

  // 4. PHASE 9: MIND MAP TREE CONSTRUCT
  public static async generateMindMap(title: string, content: string): Promise<IMindMapData> {
    try {
      if (!ai) {
        throw new Error("GEMINI_API_KEY_MISSING");
      }

      return await callGeminiWithRetry(async (model) => {
        const response = await ai!.models.generateContent({
          model: model,
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
    } catch (err) {
      console.warn("⚠️ generateMindMap failed or rate-limited. Serving intelligent offline fallback.", err);
      return this.generateOfflineMindMapFallback(title, content);
    }
  }

  // 5. PHASE 7: RAG EMBEDDINGS (Chunks & Embed Vector)
  public static async createEmbedding(textSegment: string): Promise<number[]> {
    try {
      if (!ai) {
        throw new Error("GEMINI_API_KEY_MISSING");
      }

      return await callGeminiWithRetry(async (model) => {
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
    } catch (err) {
      console.warn("⚠️ createEmbedding failed or rate-limited. Returning dummy array.", err);
      return Array(768).fill(0);
    }
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
    try {
      if (!ai) {
        throw new Error("GEMINI_API_KEY_MISSING");
      }

      return await callGeminiWithRetry(async (model) => {
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
          model: model,
          contents: { parts: [imagePart, textPart] }
        });

        return response.text || "No description synthesized.";
      });
    } catch (err) {
      console.warn("⚠️ analyzeImageForAccessibility failed or rate-limited. Serving intelligent offline description.", err);
      return this.generateOfflineAccessibilityVisionFallback(base64Image);
    }
  }

  // 7. CONTEXT-AWARE CHAT TUTOR (RAG INSPIRED response formulation)
  public static async generateTutorChatResponse(userMessage: string, noteTitle: string, retrievedContext: string, mode: string, conversationHistory: string[]): Promise<string> {
    try {
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

      return await callGeminiWithRetry(async (model) => {
        const response = await ai!.models.generateContent({
          model: model,
          contents: userMessage,
          config: {
            systemInstruction: systemPrompt
          }
        });

        return response.text || "Unable to formulate a response.";
      });
    } catch (err) {
      console.warn("⚠️ generateTutorChatResponse failed or rate-limited. Serving intelligent offline callback response.", err);
      return this.generateOfflineTutorResponseFallback(userMessage, noteTitle, retrievedContext);
    }
  }
}

