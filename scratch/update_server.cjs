const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf-8');

// 1. Replace imports
content = content.replace(
  'import { AIService } from "./src/server/aiService";',
  `import { CoreAIService } from "./src/server/services/aiService";
import { NotesService } from "./src/server/services/notesService";
import { QuizService } from "./src/server/services/quizService";
import { PdfService } from "./src/server/services/pdfService";
import { OcrService } from "./src/server/services/ocrService";`
);

// 2. Replace AIService calls
content = content.replace(/AIService\.generateStudyBuddyNotes/g, 'NotesService.generateStudyBuddyNotes');
content = content.replace(/AIService\.generateFlashcards/g, 'NotesService.generateFlashcards');
content = content.replace(/AIService\.generateMindMap/g, 'NotesService.generateMindMap');
content = content.replace(/AIService\.isGeminiAvailable/g, 'CoreAIService.isGeminiAvailable');
content = content.replace(/AIService\.createEmbedding/g, 'CoreAIService.createEmbedding');
content = content.replace(/AIService\.chunkContent/g, 'CoreAIService.chunkContent');
content = content.replace(/AIService\.generateStudyQuiz/g, 'QuizService.generateStudyQuiz');
content = content.replace(/AIService\.analyzeImageForAccessibility/g, 'CoreAIService.analyzeImageForAccessibility');
content = content.replace(/AIService\.generateTutorChatResponse/g, 'CoreAIService.generateTutorChatResponse');

// 3. Fix /api/notes/parse-pdf to use PdfService
content = content.replace(
  `    const rawBuffer = Buffer.from(pdfBase64, "base64");\n    const result = await pdfParse(rawBuffer);\n    res.json({\n      text: result.text || "",\n      pagesCount: result.numpages,\n      metadata: result.metadata\n    });`,
  `    const result = await PdfService.extractTextFromBase64(pdfBase64);\n    res.json(result);`
);

// 4. Add /process-document endpoint
const processDocEndpoint = `
// -------------------------------------------------------------
// ROUTES: PROCESS DOCUMENT ORCHESTRATOR (Phase 2)
// -------------------------------------------------------------

app.post("/api/process-document", authenticateToken, async (req: any, res) => {
  const { fileBase64, fileName, fileType, title, extractMethod } = req.body;
  if (!fileBase64 || !title) {
    return res.status(400).json({ error: "Missing required fields for document processing." });
  }

  try {
    let extractedText = "";

    // 1. & 2. & 3. File Upload & Text Extraction & OCR
    if (fileType === "application/pdf") {
      const pdfResult = await PdfService.extractTextFromBase64(fileBase64);
      extractedText = pdfResult.text;
    } else if (fileType.startsWith("image/") && extractMethod === "ocr") {
      extractedText = await OcrService.extractTextFromImage(fileBase64);
    } else {
      // Fallback if plain text or other
      extractedText = Buffer.from(fileBase64, "base64").toString("utf-8");
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: "Could not extract any text from the provided document." });
    }

    // 4. Summarization / Notes Gen
    const notesResult = await NotesService.generateStudyBuddyNotes(title, extractedText);

    // 5. Quiz Generation (Generate 5 MCQ questions by default)
    const quizQuestions = await QuizService.generateStudyQuiz(title, extractedText, "mcq", 5);

    // 6. Flashcard Generation
    const flashcardsData = await NotesService.generateFlashcards(extractedText);
    const flashcards = flashcardsData.map((f, i) => ({
      id: \`fc_\${Math.random().toString(36).substring(2, 9)}\`,
      question: f.question,
      answer: f.answer,
      bookmarked: false,
      score: 0
    }));

    // Generate Mind Map
    const mindmapData = await NotesService.generateMindMap(title, extractedText);

    // Compute vectors
    const rawChunks = CoreAIService.chunkContent(extractedText);
    const ragChunks = [];
    for (let i = 0; i < rawChunks.length; i++) {
      try {
        const textSegment = rawChunks[i];
        let vector: number[] = [];
        if (CoreAIService.isGeminiAvailable()) {
          vector = await CoreAIService.createEmbedding(textSegment);
        }
        ragChunks.push({
          text: textSegment,
          pageNumber: Math.floor(i / 2) + 1,
          embedding: vector
        });
      } catch (err) {
        console.warn(\`Vector embeddings failed on chunk \${i}\`);
      }
    }

    // 7. Save to DB
    const newNote = await UnifiedDB.createNote({
      userId: req.user.id,
      title,
      rawContent: extractedText,
      ...notesResult,
      flashcards,
      mindMap: mindmapData,
      ragChunks
    });

    const newQuiz = await UnifiedDB.createQuiz({
      noteId: newNote.id || newNote._id,
      userId: req.user.id,
      title: \`Practice Evaluation: \${title} (MCQ)\`,
      questions: quizQuestions
    });

    res.status(201).json({
      success: true,
      note: newNote,
      quiz: newQuiz,
      extractedTextSize: extractedText.length
    });
  } catch (err: any) {
    console.error("Document processing failed:", err);
    res.status(500).json({ error: err.message });
  }
});
`;

content = content.replace(
  '// -------------------------------------------------------------\n// ROUTES: STUDY GUIDES & GENERATION SERVICES (Phase 6, 7, 8, 9)\n// -------------------------------------------------------------',
  processDocEndpoint + '\n\n// -------------------------------------------------------------\n// ROUTES: STUDY GUIDES & GENERATION SERVICES (Phase 6, 7, 8, 9)\n// -------------------------------------------------------------'
);

fs.writeFileSync('server.ts', content, 'utf-8');
console.log('Successfully updated server.ts');
