import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434"; // default ollama local URL

let geminiAi: GoogleGenAI | null = null;

if (GEMINI_API_KEY) {
  geminiAi = new GoogleGenAI({
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

const fetchWithTimeout = async (url: string, options: any, timeoutMs = 20000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

export class CoreAIService {
  public static isGeminiAvailable(): boolean {
    return geminiAi !== null;
  }

  public static getAIClient() {
    if (!geminiAi) throw new Error("Gemini AI not initialized.");
    return geminiAi;
  }

  /**
   * Request retry wrapper with fallback logic for resilience.
   * Explicitly handles 429 Quota Exceeded and tries fallback providers.
   */
  public static async executeWithFallback<T>(
    operationName: string,
    geminiFn: () => Promise<T>,
    openaiFn?: () => Promise<T>,
    groqFn?: () => Promise<T>,
    ollamaFn?: () => Promise<T>
  ): Promise<T> {
    const providers = [];
    
    if (geminiAi) providers.push({ name: "Gemini", fn: geminiFn });
    if (OPENAI_API_KEY && openaiFn) providers.push({ name: "OpenAI", fn: openaiFn });
    if (GROQ_API_KEY && groqFn) providers.push({ name: "Groq", fn: groqFn });
    if (ollamaFn) providers.push({ name: "Ollama", fn: ollamaFn });

    if (providers.length === 0) {
      throw new Error("No AI providers configured or available.");
    }

    let lastError: any = null;

    for (const provider of providers) {
      try {
        console.log(`[AI] Attempting ${operationName} with ${provider.name}...`);
        const result = await provider.fn();
        return result;
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI] ${provider.name} failed for ${operationName}:`, err.message || err);
        // We will fallback to the next provider automatically
      }
    }

    console.error("[AI] All fallback providers exhausted.");
    throw new Error(
      JSON.stringify({
        message: "The AI service is currently experiencing high load or quota limits. Please try again later.",
        code: lastError?.status || lastError?.code || 500,
        provider: "FallbackExhausted"
      })
    );
  }

  public static async generateStructuredData(prompt: string, schemaDefinition: any): Promise<any> {
    return this.executeWithFallback(
      "generateStructuredData",
      async () => {
        const response = await geminiAi!.models.generateContent({
          model: "gemini-1.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: schemaDefinition
          }
        });
        return JSON.parse((response.text || "{}").trim());
      },
      async () => {
        // OpenAI Fallback
        const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: "You are a JSON generating assistant. Return valid JSON matching the schema requirements." },
              { role: "user", content: prompt }
            ]
          })
        });
        if (!response.ok) throw new Error(`OpenAI error: ${response.statusText}`);
        const data = await response.json();
        return JSON.parse((data.choices[0].message.content || "{}").trim());
      },
      async () => {
        // Groq Fallback
        const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: "You are a JSON generating assistant. Return valid JSON matching the schema requirements." },
              { role: "user", content: prompt }
            ]
          })
        });
        if (!response.ok) throw new Error(`Groq error: ${response.statusText}`);
        const data = await response.json();
        return JSON.parse((data.choices[0].message.content || "{}").trim());
      },
      async () => {
        // Ollama Fallback
        const response = await fetchWithTimeout(`${OLLAMA_URL}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama3.2",
            format: "json",
            prompt: prompt,
            stream: false
          })
        }, 60000); // give ollama more time
        if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
        const data = await response.json();
        return JSON.parse((data.response || "{}").trim());
      }
    );
  }

  public static async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    return this.executeWithFallback(
      "generateText",
      async () => {
        const config: any = {};
        if (systemInstruction) config.systemInstruction = systemInstruction;
        const response = await geminiAi!.models.generateContent({
          model: "gemini-1.5-flash",
          contents: prompt,
          config
        });
        return response.text || "Unable to formulate a response.";
      },
      async () => {
        const messages = [];
        if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
        messages.push({ role: "user", content: prompt });
        const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify({ model: "gpt-4o-mini", messages })
        });
        if (!response.ok) throw new Error(`OpenAI error: ${response.statusText}`);
        const data = await response.json();
        return data.choices[0].message.content || "Unable to formulate a response.";
      },
      async () => {
        const messages = [];
        if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
        messages.push({ role: "user", content: prompt });
        const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
          body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages })
        });
        if (!response.ok) throw new Error(`Groq error: ${response.statusText}`);
        const data = await response.json();
        return data.choices[0].message.content || "Unable to formulate a response.";
      },
      async () => {
        const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
        const response = await fetchWithTimeout(`${OLLAMA_URL}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "llama3.2", prompt: fullPrompt, stream: false })
        }, 60000);
        if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
        const data = await response.json();
        return data.response || "Unable to formulate a response.";
      }
    );
  }

  // Segment study notes into clean passages of ~500 characters with an overlap for high performance RAG searches
  public static chunkContent(text: string, size = 600, overlap = 100): string[] {
    const cleanText = text.replace(/\s+/g, " ").trim();
    const chunks: string[] = [];
    let start = 0;
    while (start < cleanText.length) {
      const end = start + size;
      if (end >= cleanText.length) {
        chunks.push(cleanText.substring(start));
        break;
      }
      
      let splitIdx = cleanText.lastIndexOf(". ", end);
      if (splitIdx <= start + overlap) {
        splitIdx = cleanText.lastIndexOf(" ", end);
      }
      if (splitIdx <= start + overlap) {
        splitIdx = end;
      }
      
      chunks.push(cleanText.substring(start, splitIdx + 1).trim());
      start = splitIdx + 1 - overlap;
      if (start < 0) start = 0;
      
      // Ensure we always advance
      if (start >= splitIdx + 1) {
        start = splitIdx + 1;
      }
    }
    return chunks;
  }

  public static async createEmbedding(textSegment: string): Promise<number[]> {
    let retries = 3;
    let delay = 1000;
    while (retries > 0) {
      try {
        if (!geminiAi) throw new Error("Gemini AI not initialized for embeddings.");
        const result = await geminiAi.models.embedContent({
          model: "text-embedding-004",
          contents: textSegment
        });
        const res = result as any;
        if (res.embeddings && res.embeddings[0] && res.embeddings[0].values) {
          return res.embeddings[0].values;
        }
        throw new Error("Embedded content returned blank values");
      } catch (err: any) {
        retries--;
        if (retries <= 0) throw err;
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }
    return [];
  }

  public static async analyzeImageForAccessibility(base64Image: string, mimeType = "image/png"): Promise<string> {
    const prompt = `You are an expert accessibility consultant and visual-to-audio study captioner.
        Describe this study image (flowchart, textbook page, formula sheet, or lecture slides) in deep, rich detail.
        
        Requirements:
        - Describe what is visually represented.
        - Transcribe ALL reading texts, formulas, calculations, numbers, or headers completely.
        - Describe colors, visual flow, structures, and charts clearly.
        - Use clean, screen-reader friendly narrative paragraphs.`;

    return this.executeWithFallback(
      "analyzeImage",
      async () => {
        const imagePart = { inlineData: { mimeType, data: base64Image } };
        const textPart = { text: prompt };
        const response = await geminiAi!.models.generateContent({
          model: "gemini-1.5-flash",
          contents: { parts: [imagePart, textPart] }
        });
        return response.text || "No description synthesized.";
      },
      async () => {
        // OpenAI Vision fallback
        const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                ]
              }
            ]
          })
        });
        if (!response.ok) throw new Error(`OpenAI Vision error: ${response.statusText}`);
        const data = await response.json();
        return data.choices[0].message.content || "No description synthesized.";
      }
      // Groq and Ollama vision may not be robustly supported yet, skipping for image analysis fallback
    );
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
