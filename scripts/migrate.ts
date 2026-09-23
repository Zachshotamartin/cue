import { initializeDatabase, db } from "../packages/storage/client";
await initializeDatabase();
console.log("Cue database migrations applied.");
await db.close();
