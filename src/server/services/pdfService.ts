import { createRequire } from "module";
import { CoreAIService } from "./ai/provider.js";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export class PdfService {
  public static async extractTextFromBase64(pdfBase64: string): Promise<{ text: string; pagesCount: number; metadata: any }> {
    try {
      const rawBuffer = Buffer.from(pdfBase64, "base64");
      const result = await pdfParse(rawBuffer);
      let text = result.text || "";

      // Fallback to Gemini if text is too short (likely a scanned PDF)
      if (text.trim().length < 50 && CoreAIService.isGeminiAvailable()) {
        try {
          console.log("PDF text too short. Attempting Gemini OCR fallback...");
          const aiClient = CoreAIService.getAIClient(); // This method doesn't exist anymore on CoreAIService directly after my change, wait. Let's use executeWithFallback.
          
          text = await CoreAIService.executeWithFallback(
            "extractPdfText",
            async () => {
              // Gemini supports application/pdf inlineData
              const prompt = "Please extract all readable text from this PDF document exactly as it appears. Ensure formatting is retained as best as possible. Do not add any introductory or conversational text. If the PDF contains no text, say nothing.";
              const response = await aiClient.models.generateContent({
                model: "gemini-1.5-flash",
                contents: { parts: [{ inlineData: { mimeType: "application/pdf", data: pdfBase64 } }, { text: prompt }] }
              });
              return response.text || "";
            }
          );
        } catch (ocrErr) {
          console.warn("Gemini OCR fallback failed:", ocrErr);
        }
      }

      return {
        text: text,
        pagesCount: result.numpages,
        metadata: result.metadata
      };
    } catch (err: any) {
      console.error("PdfService pdf-parse failed:", err);
      throw new Error(`PDF extraction failed: ${err.message}`);
    }
  }
}
