import Database from 'better-sqlite3'

export interface Chapter {
  id: number
  book_id: number
  chapter_number: number
  title: string
  status: 'draft' | 'published' | 'archived'
  created_at: number
  updated_at: number
}

export interface ChapterVersion {
  id: number
  chapter_id: number
  content: string
  version_number: number
  change_summary?: string
  is_published: boolean
  created_at: number
}

export interface CreateChapterData {
  chapter_number: number
  title: string
  content?: string
}

export class ChapterRepository {
  constructor(private db: Database.Database) {}

  createChapter(bookId: number, data: CreateChapterData): Chapter {
    const stmt = this.db.prepare(`
      INSERT INTO chapters (book_id, chapter_number, title, status)
      VALUES (?, ?, ?, 'draft')
    `)
    const result = stmt.run(bookId, data.chapter_number, data.title)
    const chapterId = Number(result.lastInsertRowid)

    // Create initial version if content provided
    if (data.content) {
      this.createVersion(chapterId, data.content, 'Initial version')
    }

    return this.getChapterById(chapterId)!
  }

  getChapterById(id: number): Chapter | null {
    const stmt = this.db.prepare('SELECT * FROM chapters WHERE id = ?')
    return (stmt.get(id) as Chapter | undefined) || null
  }

  getChaptersByBook(bookId: number): Chapter[] {
    const stmt = this.db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY chapter_number ASC')
    return stmt.all(bookId) as Chapter[]
  }

  updateChapter(id: number, data: Partial<Chapter>): void {
    const fields: string[] = []
    const values: any[] = []

    if (data.title !== undefined) {
      fields.push('title = ?')
      values.push(data.title)
    }
    if (data.status !== undefined) {
      fields.push('status = ?')
      values.push(data.status)
    }

    if (fields.length === 0) return

    fields.push("updated_at = strftime('%s', 'now')")
    values.push(id)

    const stmt = this.db.prepare(`UPDATE chapters SET ${fields.join(', ')} WHERE id = ?`)
    stmt.run(...values)
  }

  deleteChapter(id: number): void {
    const stmt = this.db.prepare('DELETE FROM chapters WHERE id = ?')
    stmt.run(id)
  }

  // Version management
  createVersion(chapterId: number, content: string, changeSummary?: string): ChapterVersion {
    // Get next version number
    const maxVersionStmt = this.db.prepare(
      'SELECT MAX(version_number) as max_version FROM chapter_versions WHERE chapter_id = ?'
    )
    const result = maxVersionStmt.get(chapterId) as { max_version: number | null }
    const nextVersion = (result.max_version || 0) + 1

    const stmt = this.db.prepare(`
      INSERT INTO chapter_versions (chapter_id, content, version_number, change_summary, is_published)
      VALUES (?, ?, ?, ?, 0)
    `)
    const insertResult = stmt.run(chapterId, content, nextVersion, changeSummary || null)
    return this.getVersionById(Number(insertResult.lastInsertRowid))!
  }

  getVersionById(id: number): ChapterVersion | null {
    const stmt = this.db.prepare('SELECT * FROM chapter_versions WHERE id = ?')
    return (stmt.get(id) as ChapterVersion | undefined) || null
  }

  getVersionsByChapter(chapterId: number): ChapterVersion[] {
    const stmt = this.db.prepare(
      'SELECT * FROM chapter_versions WHERE chapter_id = ? ORDER BY version_number DESC'
    )
    return stmt.all(chapterId) as ChapterVersion[]
  }

  getLatestVersion(chapterId: number): ChapterVersion | null {
    const stmt = this.db.prepare(
      'SELECT * FROM chapter_versions WHERE chapter_id = ? ORDER BY version_number DESC LIMIT 1'
    )
    return (stmt.get(chapterId) as ChapterVersion | undefined) || null
  }

  getPublishedVersion(chapterId: number): ChapterVersion | null {
    const stmt = this.db.prepare(
      'SELECT * FROM chapter_versions WHERE chapter_id = ? AND is_published = 1 LIMIT 1'
    )
    return (stmt.get(chapterId) as ChapterVersion | undefined) || null
  }

  publishVersion(versionId: number): void {
    const version = this.getVersionById(versionId)
    if (!version) throw new Error('Version not found')

    // Unpublish all other versions for this chapter
    const unpublishStmt = this.db.prepare(
      'UPDATE chapter_versions SET is_published = 0 WHERE chapter_id = ?'
    )
    unpublishStmt.run(version.chapter_id)

    // Publish the specified version
    const publishStmt = this.db.prepare('UPDATE chapter_versions SET is_published = 1 WHERE id = ?')
    publishStmt.run(versionId)
  }
}
