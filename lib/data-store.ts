import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  BusinessRecord,
  ConversationRecord,
  LeadNotificationRecord
} from "@/lib/types";

export interface LocalDatabase {
  businesses: BusinessRecord[];
  conversations: ConversationRecord[];
  notifications: LeadNotificationRecord[];
}

const DATA_PATH = path.join(process.cwd(), ".data", "agentdrop.json");
const EMPTY_DB: LocalDatabase = {
  businesses: [],
  conversations: [],
  notifications: []
};

let writeQueue = Promise.resolve();

async function ensureDataFile() {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  try {
    await readFile(DATA_PATH, "utf8");
  } catch {
    await writeFile(DATA_PATH, JSON.stringify(EMPTY_DB, null, 2), "utf8");
  }
}

export async function readLocalDatabase(): Promise<LocalDatabase> {
  await ensureDataFile();
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    return { ...EMPTY_DB, ...(JSON.parse(raw) as LocalDatabase) };
  } catch {
    return EMPTY_DB;
  }
}

async function writeLocalDatabase(db: LocalDatabase) {
  await ensureDataFile();
  await writeFile(DATA_PATH, JSON.stringify(db, null, 2), "utf8");
}

export async function mutateLocalDatabase<T>(
  updater: (db: LocalDatabase) => Promise<T> | T
): Promise<T> {
  let result!: T;

  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const db = await readLocalDatabase();
    result = await updater(db);
    await writeLocalDatabase(db);
  });

  await writeQueue;
  return result;
}
