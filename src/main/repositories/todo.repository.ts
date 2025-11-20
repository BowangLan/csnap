import { getConnection } from '../database/connection';
import { RunResult } from 'better-sqlite3';

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt?: string;
}

export class TodoRepository {
  private get db() {
    return getConnection();
  }

  findAll(): Todo[] {
    const stmt = this.db.prepare('SELECT * FROM todos ORDER BY id DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      text: row.text,
      completed: !!row.completed,
      createdAt: row.created_at
    }));
  }

  create(text: string): Todo {
    const stmt = this.db.prepare('INSERT INTO todos (text) VALUES (@text)');
    const info: RunResult = stmt.run({ text });
    return {
      id: info.lastInsertRowid as number,
      text,
      completed: false
    };
  }

  toggle(id: number): void {
    const stmt = this.db.prepare('UPDATE todos SET completed = NOT completed WHERE id = @id');
    stmt.run({ id });
  }

  delete(id: number): void {
    const stmt = this.db.prepare('DELETE FROM todos WHERE id = @id');
    stmt.run({ id });
  }
}

export const todoRepository = new TodoRepository();

