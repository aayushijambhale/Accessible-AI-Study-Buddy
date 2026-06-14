import { Type } from "@google/genai";
import { CoreAIService } from "./aiService";
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
    // 1. Chunk Text
    // Split large PDFs into manageable chunks to preserve context
    const chunks = ChunkingService.chunkText(rawContent, 6000);
    
    // We'll analyze the first 2 chunks for the core summary to save tokens, but RAG can still use the full text
    const analysisContent = chunks.slice(0, 2).join("\n\n---\n\n");

    const prompt = `You are an expert teacher.
Analyze the provided study material.
Create:
1. Short summary (100-200 words)
2. Important Notes (Bullet points, max 15 points, exam oriented)
3. Key Concepts (Explain simply, student friendly)
4. Definitions (Short and precise)
5. Frequently Asked Questions
6. Revision Sheet (One-page quick revision)
7. Most Important Topics (Rank by importance)

Do not repeat information. Focus only on high-value learning content.

Study Material Title: "${title}"
Content: "${analysisContent.replace(/"/g, '\\"')}"`;

    const schemaDefinition = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        summary: { type: Type.STRING, description: "100-200 word summary" },
        important_notes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Max 15 bullet points"
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
        exam_points: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        revision_sheet: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        frequently_asked_questions: {
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
        most_important_topics: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              rank: { type: Type.INTEGER }
            },
            required: ["topic", "rank"]
          }
        }
      },
      required: [
        "title",
        "summary",
        "important_notes",
        "key_concepts",
        "definitions",
        "exam_points",
        "revision_sheet",
        "frequently_asked_questions",
        "most_important_topics"
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
