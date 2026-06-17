import { NotesService } from "./src/server/services/notesService";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  try {
    const res = await NotesService.generateStudyBuddyNotes("Mitochondria", "Mitochondria is the powerhouse of the cell.");
    console.log("SUCCESS:", JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error("ERROR:", err.message);
    if (err.stack) console.error(err.stack);
  }
}

run();
