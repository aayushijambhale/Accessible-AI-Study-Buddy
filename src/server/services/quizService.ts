import { Type } from "@google/genai";
import { CoreAIService } from "./ai/provider";

export class QuizService {
  public static async generateStudyQuiz(title: string, content: string, quizType: string, numQuestions: number): Promise<any[]> {
    const typeInstruction = 
      quizType === "mcq" 
        ? "Create ONLY multiple choice (mcq) questions, each with exactly 4 distinct choices in options."
        : quizType === "boolean"
        ? "Create ONLY True or False (boolean) questions, with options array containing exactly ['True', 'False']."
        : "Create a mix of MCQ, True/False, and short answer questions.";

    const prompt = `Create structured study quiz questions from context:
        Title: "${title}"
        Text: "${content.replace(/"/g, '\\"')}"
        
        Rule limits: ${typeInstruction}
        Construct a JSON array of ${numQuestions} questions matching this structure:
        {
          "questions": [
            {
              "id": "string",
              "question": "question text",
              "type": "mcq" | "boolean" | "short",
              "options": ["Option A", "Option B", "Option C"] (MUST be exactly ['True', 'False'] for boolean, and empty [] for short),
              "correctAnswer": "text of answer",
              "explanation": "educational rationale details"
            }
          ]
        }`;

    const schemaDefinition = {
      type: Type.OBJECT,
      properties: {
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              type: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["id", "question", "type", "options", "correctAnswer", "explanation"]
          }
        }
      },
      required: ["questions"]
    };

    const parsed = await CoreAIService.generateStructuredData(prompt, schemaDefinition);
    return parsed.questions || [];
  }
}
