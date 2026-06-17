import { Type } from "@google/genai";
import { CoreAIService } from "./ai/provider";
import { ChunkingService } from "./chunkingService";

export interface IFlashcardData {
  question: string;
  answer: string;
}

export interface IMindMapData {
  topic: string;
  subtopics: Array<{
    title: string;
    items: string[];
  }>;
}

export class NotesService {
  /**
   * Generates advanced structured study notes using the new AI pipeline requirements.
   * If the text is very large, it will chunk the text and process the most important parts.
   */
  public static async generateStudyBuddyNotes(title: string, rawContent: string): Promise<any> {
    const chunks = ChunkingService.chunkText(rawContent, 6000);
    const analysisContent = chunks.slice(0, 2).join("\n\n---\n\n");

    const prompt = `You are an expert professor and educational content creator.

Analyze the study material and create:
1. Chapter-wise Notes
2. Key Concepts
3. Important Definitions
4. Important Formulas
5. Examples
6. One-Day Revision Notes
7. Exam Questions
8. Viva Questions
9. Interview Questions
10. Flashcards
11. Key Takeaways

Format using markdown headings and bullet points where applicable. Make notes concise, exam-focused, and easy to revise. Do not repeat information. Focus only on high-value learning content.

Study Material Title: "${title}"
Content: "${analysisContent.replace(/"/g, '\\"')}"`;

    const schemaDefinition = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        chapter_notes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              chapter: { type: Type.STRING },
              notes: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["chapter", "notes"]
          }
        },
        key_concepts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              concept: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["concept", "explanation"]
          }
        },
        definitions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              definition: { type: Type.STRING }
            },
            required: ["term", "definition"]
          }
        },
        formulas: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              formula_name: { type: Type.STRING },
              equation: { type: Type.STRING }
            },
            required: ["formula_name", "equation"]
          }
        },
        examples: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        revision_notes: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
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
        interview_questions: {
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
        flashcards: {
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
        key_takeaways: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
      required: [
        "title",
        "chapter_notes",
        "key_concepts",
        "definitions",
        "formulas",
        "examples",
        "revision_notes",
        "exam_questions",
        "viva_questions",
        "interview_questions",
        "flashcards",
        "key_takeaways"
      ]
    };

    return CoreAIService.generateStructuredData(prompt, schemaDefinition);
  }

  public static async generateFlashcards(content: string, numCards = 6): Promise<IFlashcardData[]> {
    const prompt = `Formulate ${numCards} study flashcards from textbook material focusing on important keywords, formulas, or concepts.
    Content: "${content.slice(0, 4000).replace(/"/g, '\\"')}"`;

    const schemaDefinition = {
      type: Type.OBJECT,
      properties: {
        flashcards: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING }
            },
            required: ["question", "answer"]
          }
        }
      },
      required: ["flashcards"]
    };

    const data = await CoreAIService.generateStructuredData(prompt, schemaDefinition);
    return data.flashcards || [];
  }

  public static async generateMindMap(title: string, content: string): Promise<IMindMapData> {
    const prompt = `Create a comprehensive conceptual hierarchical structure for a mind map tree about the academic subject "${title}".
    Source Material: "${content.slice(0, 4000).replace(/"/g, '\\"')}"`;

    const schemaDefinition = {
      type: Type.OBJECT,
      properties: {
        topic: { type: Type.STRING },
        subtopics: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              items: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "items"]
          }
        }
      },
      required: ["topic", "subtopics"]
    };

    return CoreAIService.generateStructuredData(prompt, schemaDefinition);
  }
}
