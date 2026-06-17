import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
}

export class GeminiProvider {
  public static isAvailable(): boolean {
    return geminiAi !== null;
  }

  public static getClient() {
    if (!geminiAi) throw new Error("Gemini API Key is missing.");
    return geminiAi;
  }

  public static async generateStructuredData(prompt: string, schemaDefinition: any): Promise<any> {
    if (!geminiAi) throw new Error("Gemini API Key is missing.");
    
    console.log("[AI] Request Sent to Gemini");
    const response = await geminiAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schemaDefinition
      }
    });
    console.log("[AI] Response Received from Gemini");
    
    return JSON.parse((response.text || "{}").trim());
  }

  public static async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    if (!geminiAi) throw new Error("Gemini API Key is missing.");
    
    const config: any = {};
    if (systemInstruction) config.systemInstruction = systemInstruction;
    
    const response = await geminiAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config
    });
    
    return response.text || "Unable to formulate a response.";
  }

  public static async analyzeImage(base64Image: string, mimeType: string, prompt: string): Promise<string> {
    if (!geminiAi) throw new Error("Gemini API Key is missing.");
    
    const imagePart = { inlineData: { mimeType, data: base64Image } };
    const textPart = { text: prompt };
    
    const response = await geminiAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [imagePart, textPart] }
    });
    
    return response.text || "No description synthesized.";
  }

  public static async createEmbedding(textSegment: string): Promise<number[]> {
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
  }
}
