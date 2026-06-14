import Tesseract from "tesseract.js";

export class OcrService {
  /**
   * Extracts text from an image using Tesseract OCR.
   * @param imageBase64 Base64 encoded image string. Can include data URI scheme prefix.
   */
  public static async extractTextFromImage(imageBase64: string): Promise<string> {
    try {
      let cleanedBase64 = imageBase64;
      if (imageBase64.includes(";base64,")) {
        cleanedBase64 = imageBase64.split(";base64,")[1];
      }
      
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
