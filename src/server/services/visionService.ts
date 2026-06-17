import { CoreAIService } from "./ai/provider";
import { Type } from "@google/genai";

export class VisionService {
  public static async analyzeDiagram(base64Image: string, mimeType: string): Promise<any> {
    const prompt = `You are an expert AI vision assistant specializing in educational diagrams, flowcharts, and technical drawings.

Analyze the uploaded diagram and extract the following structured information:
1. Diagram Name / Title
2. Components / Parts identified
3. Labels and text found in the image
4. A clear explanation of how it works
5. A simple student-friendly explanation (Explain Like I'm 10)
6. Quick revision notes
7. Potential exam questions based on this diagram
8. Potential viva questions
9. Most important points to remember

Return the data strictly conforming to the requested JSON schema.`;

    const schemaDefinition = {
      type: Type.OBJECT,
      properties: {
        diagram_name: { type: Type.STRING },
        components: { type: Type.ARRAY, items: { type: Type.STRING } },
        labels: { type: Type.ARRAY, items: { type: Type.STRING } },
        working_explanation: { type: Type.STRING },
        student_explanation: { type: Type.STRING },
        quick_revision_notes: { type: Type.ARRAY, items: { type: Type.STRING } },
        exam_questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING }
            },
            required: ["question", "answer"]
          }
        },
        viva_questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING }
            },
            required: ["question", "answer"]
          }
        },
        important_points: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: [
        "diagram_name",
        "components",
        "labels",
        "working_explanation",
        "student_explanation",
        "quick_revision_notes",
        "exam_questions",
        "viva_questions",
        "important_points"
      ]
    };

    // Use Gemini directly for complex Vision + Structured output
    // Assuming executeWithFallback supports passing the schema and inline image.
    // However, CoreAIService.analyzeImageForAccessibility does not return JSON. 
    // We will build a custom fetch to Gemini for Structured Vision, or use CoreAIService.
    
    // CoreAIService executeWithFallback currently doesn't seamlessly support vision + schema in one go.
    // Let's use GeminiProvider directly since we know only Gemini has robust structured vision right now.
    const aiClient = CoreAIService.getAIClient();
    if (!aiClient) throw new Error("Gemini AI is required for structured diagram analysis.");

    console.log("[VisionService] Sending diagram to Gemini Vision");
    const imagePart = { inlineData: { mimeType, data: base64Image } };
    const textPart = { text: prompt };

    const response = await aiClient.models.generateContent({
      model: "gemini-1.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: schemaDefinition
      }
    });

    return JSON.parse((response.text || "{}").trim());
  }
}
