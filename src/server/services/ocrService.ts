import Tesseract from "tesseract.js";
import { CoreAIService } from "./ai/provider.js";

export class OcrService {
  /**
   * Extracts text from an image using Gemini Vision if available, falling back to Tesseract OCR.
   * @param imageBase64 Base64 encoded image string. Can include data URI scheme prefix.
   */
  public static async extractTextFromImage(imageBase64: string): Promise<string> {
    let cleanedBase64 = imageBase64;
    let mimeType = "image/png";
    
    if (imageBase64.includes(";base64,")) {
      const parts = imageBase64.split(";base64,");
      mimeType = parts[0].replace("data:", "");
      cleanedBase64 = parts[1];
    }
    
    // Attempt Gemini Vision first
    if (CoreAIService.isGeminiAvailable()) {
      try {
        console.log("Attempting Gemini Vision OCR...");
        const aiClient = CoreAIService.getAIClient();
        
        const text = await CoreAIService.executeWithFallback(
          "extractImageText",
          async () => {
            const prompt = "Please extract all readable text, formulas, or labels from this image exactly as it appears. Do not add conversational text.";
            const response = await aiClient.models.generateContent({
              model: "gemini-1.5-flash",
              contents: { parts: [{ inlineData: { mimeType, data: cleanedBase64 } }, { text: prompt }] }
            });
            return response.text || "";
          }
        );
        
        if (text && text.trim().length > 0) {
          return text;
        }
      } catch (err) {
        console.warn("Gemini Vision OCR failed, falling back to Tesseract:", err);
      }
    }

    // Fallback to Tesseract
    try {
      console.log("Running Tesseract OCR fallback...");
      const buffer = Buffer.from(cleanedBase64, "base64");
      
      const result = await Tesseract.recognize(
        buffer,
        'eng',
        { logger: m => console.log(m) } // Optional: can be disabled for production
      );
      
      return result.data.text;
    } catch (err: any) {
      console.error("OcrService extraction failed:", err);
      throw new Error(`OCR extraction failed: ${err.message}`);
    }
  }
}
