import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';

let db: Database.Database | null = null;

export const getConnection = (): Database.Database => {
  if (db) return db;

  const dbPath = join(app.getPath('userData'), 'app.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  return db;
};

