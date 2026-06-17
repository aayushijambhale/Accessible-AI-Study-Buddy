import dotenv from "dotenv";
import { fetchWithTimeout } from "./utils";

dotenv.config();

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

export class OllamaProvider {
  public static isAvailable(): boolean {
    return true; // We always assume Ollama can be hit, it will just fail fetch if offline
  }

  public static async generateStructuredData(prompt: string, schemaDefinition: any): Promise<any> {
    console.log("[AI] Request Sent to Ollama");
    const response = await fetchWithTimeout(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        format: "json",
        prompt: prompt,
        stream: false
      })
    }, 60000);
    
    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
    const data = await response.json();
    console.log("[AI] Response Received from Ollama");
    
    return JSON.parse((data.response || "{}").trim());
  }

  public static async generateText(prompt: string, systemInstruction?: string): Promise<string> {
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

  public static async analyzeImage(base64Image: string, mimeType: string, prompt: string): Promise<string> {
    throw new Error("Ollama vision analysis is not currently supported natively in this integration.");
  }
}
