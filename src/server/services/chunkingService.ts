export class ChunkingService {
  /**
   * Semantically chunks large texts into manageable payloads.
   * Attempts to preserve natural chapter boundaries, paragraphs, or sentence structures.
   * @param text The full raw extracted text.
   * @param maxChunkSize The maximum character length of a chunk (e.g. 5000 characters).
   */
  public static chunkText(text: string, maxChunkSize = 5000): string[] {
    const chunks: string[] = [];
    const cleanedText = text.replace(/\r\n/g, "\n");
    let currentPos = 0;

    while (currentPos < cleanedText.length) {
      if (cleanedText.length - currentPos <= maxChunkSize) {
        chunks.push(cleanedText.substring(currentPos));
        break;
      }

      let endPos = currentPos + maxChunkSize;
      let foundBoundary = false;

      // Try to find a logical boundary (double newline / chapter boundary) within the last 1000 chars of the window
      const boundaryWindow = cleanedText.substring(endPos - 1000, endPos);
      const paragraphBreak = boundaryWindow.lastIndexOf("\n\n");
      
      if (paragraphBreak !== -1) {
        endPos = (endPos - 1000) + paragraphBreak + 2;
        foundBoundary = true;
      }

      // If no paragraph boundary, try to find a sentence boundary
      if (!foundBoundary) {
        const sentenceBreak = boundaryWindow.lastIndexOf(". ");
        if (sentenceBreak !== -1) {
          endPos = (endPos - 1000) + sentenceBreak + 2;
          foundBoundary = true;
        }
      }

      // If still no boundary, fallback to the nearest space
      if (!foundBoundary) {
        const spaceBreak = boundaryWindow.lastIndexOf(" ");
        if (spaceBreak !== -1) {
          endPos = (endPos - 1000) + spaceBreak + 1;
        }
      }

      chunks.push(cleanedText.substring(currentPos, endPos).trim());
      currentPos = endPos;
    }

    return chunks;
  }
}
