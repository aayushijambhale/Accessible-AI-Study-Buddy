import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import { GroqProvider } from "./groq";
import { OllamaProvider } from "./ollama";

export class CoreAIService {
  public static isGeminiAvailable(): boolean {
    return GeminiProvider.isAvailable();
  }

  public static getAIClient() {
    return GeminiProvider.getClient();
  }

  public static async executeWithFallback<T>(
    operationName: string,
    operationType: "structured" | "text" | "vision",
    prompt: string,
    extraArgs?: any
  ): Promise<T> {
    const providers = [];
    
    // Priority sequence as requested
    if (GeminiProvider.isAvailable()) providers.push({ name: "Gemini", provider: GeminiProvider });
    if (OpenAIProvider.isAvailable()) providers.push({ name: "OpenAI", provider: OpenAIProvider });
    if (GroqProvider.isAvailable()) providers.push({ name: "Groq", provider: GroqProvider });
    providers.push({ name: "Ollama", provider: OllamaProvider });

    let lastError: any = null;

    for (const { name, provider } of providers) {
      try {
        console.log(`[AI] Attempting ${operationName} with ${name}...`);
        
        let result;
        if (operationType === "structured") {
          result = await provider.generateStructuredData(prompt, extraArgs);
        } else if (operationType === "text") {
          result = await provider.generateText(prompt, extraArgs);
        } else if (operationType === "vision") {
          result = await provider.analyzeImage(extraArgs.base64Image, extraArgs.mimeType, prompt);
        }
        
        return result as T;
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI] ${name} failed for ${operationName}:`, err.message || err);
        // Fallback to next provider...
      }
    }

    console.error(`[AI] All fallback providers exhausted for ${operationName}.`);
    
    // Map standard HTTP errors to friendly messages
    let friendlyMessage = "The AI service is currently experiencing high load or quota limits. Please try again later.";
    const errCode = lastError?.status || lastError?.code;
    
    if (errCode === 429) friendlyMessage = "Quota exceeded. The AI service has reached its request limit.";
    else if (errCode === 401) friendlyMessage = "Invalid AI service API key.";
    else if (errCode === 403) friendlyMessage = "Forbidden access. Check your API key permissions.";
    else if (errCode === 500) friendlyMessage = "AI service internal error. Please try again.";
    else if (lastError?.message?.toLowerCase().includes("timeout")) friendlyMessage = "Network timeout. The AI service took too long to respond.";

    throw new Error(
      JSON.stringify({
        message: friendlyMessage,
        code: errCode || 500,
        provider: "FallbackExhausted",
        details: lastError?.message || String(lastError)
      })
    );
  }

  public static async generateStructuredData(prompt: string, schemaDefinition: any): Promise<any> {
    return this.executeWithFallback("generateStructuredData", "structured", prompt, schemaDefinition);
  }

  public static async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    return this.executeWithFallback("generateText", "text", prompt, systemInstruction);
  }

  public static async analyzeImageForAccessibility(base64Image: string, mimeType = "image/png"): Promise<string> {
    const prompt = `You are an expert accessibility consultant and visual-to-audio study captioner.
        Describe this study image (flowchart, textbook page, formula sheet, or lecture slides) in deep, rich detail.
        
        Requirements:
        - Describe what is visually represented.
        - Transcribe ALL reading texts, formulas, calculations, numbers, or headers completely.
        - Describe colors, visual flow, structures, and charts clearly.
        - Use clean, screen-reader friendly narrative paragraphs.`;

    return this.executeWithFallback("analyzeImage", "vision", prompt, { base64Image, mimeType });
  }

  public static async createEmbedding(textSegment: string): Promise<number[]> {
    // Embeddings specifically usually need one consistent provider model for RAG mapping
    // We enforce Gemini for now since they generated the existing DB vectors
    return GeminiProvider.createEmbedding(textSegment);
  }

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
      if (splitIdx <= start + overlap) splitIdx = cleanText.lastIndexOf(" ", end);
      if (splitIdx <= start + overlap) splitIdx = end;
      
      chunks.push(cleanText.substring(start, splitIdx + 1).trim());
      start = splitIdx + 1 - overlap;
      if (start < 0) start = 0;
      if (start >= splitIdx + 1) start = splitIdx + 1;
    }
    return chunks;
  }
}
