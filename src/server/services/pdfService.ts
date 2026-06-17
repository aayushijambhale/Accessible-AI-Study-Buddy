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
