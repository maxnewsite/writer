import Database from 'better-sqlite3'

export interface Book {
  id: number
  title: string
  niche: string
  description?: string
  outline: string // JSON string
  status: 'setup' | 'in_progress' | 'completed'
  ai_model_used?: string
  created_at: number
  updated_at: number
}

export interface CreateBookData {
  title: string
  niche: string
  description?: string
  outline: string // JSON string
}

export class BookRepository {
  constructor(private db: Database.Database) {}

  create(data: CreateBookData): Book {
    const stmt = this.db.prepare(`
      INSERT INTO books (title, niche, description, outline, status)
      VALUES (?, ?, ?, ?, 'setup')
    `)
    const result = stmt.run(data.title, data.niche, data.description || null, data.outline)
    return this.getById(Number(result.lastInsertRowid))!
  }

  getAll(): Book[] {
    const stmt = this.db.prepare('SELECT * FROM books ORDER BY updated_at DESC')
    return stmt.all() as Book[]
  }

  getById(id: number): Book | null {
    const stmt = this.db.prepare('SELECT * FROM books WHERE id = ?')
    return (stmt.get(id) as Book | undefined) || null
  }

  update(id: number, data: Partial<Book>): void {
    const fields: string[] = []
    const values: any[] = []

    if (data.title !== undefined) {
      fields.push('title = ?')
      values.push(data.title)
    }
    if (data.outline !== undefined) {
      fields.push('outline = ?')
      values.push(data.outline)
    }
    if (data.status !== undefined) {
      fields.push('status = ?')
      values.push(data.status)
    }
    if (data.description !== undefined) {
      fields.push('description = ?')
      values.push(data.description)
    }
    if (data.ai_model_used !== undefined) {
      fields.push('ai_model_used = ?')
      values.push(data.ai_model_used)
    }

    if (fields.length === 0) return

    fields.push('updated_at = strftime("%s", "now")')
    values.push(id)

    const stmt = this.db.prepare(`UPDATE books SET ${fields.join(', ')} WHERE id = ?`)
    stmt.run(...values)
  }

  delete(id: number): void {
    const stmt = this.db.prepare('DELETE FROM books WHERE id = ?')
    stmt.run(id)
  }
}
