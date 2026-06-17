import dotenv from "dotenv";
import { fetchWithTimeout } from "./utils";

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export class GroqProvider {
  public static isAvailable(): boolean {
    return !!GROQ_API_KEY;
  }

  public static async generateStructuredData(prompt: string, schemaDefinition: any): Promise<any> {
    if (!GROQ_API_KEY) throw new Error("Groq API Key missing.");
    
    console.log("[AI] Request Sent to Groq");
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
    console.log("[AI] Response Received from Groq");
    
    return JSON.parse((data.choices[0].message.content || "{}").trim());
  }

  public static async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    if (!GROQ_API_KEY) throw new Error("Groq API Key missing.");
    
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
  }

  public static async analyzeImage(base64Image: string, mimeType: string, prompt: string): Promise<string> {
    throw new Error("Groq vision analysis is not currently supported natively in this integration.");
  }
}
