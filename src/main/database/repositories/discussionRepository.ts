import Database from 'better-sqlite3'

export interface Question {
  id: number
  chapter_id: number
  text: string
  author_name: string
  vote_count: number
  status: 'open' | 'answered' | 'incorporated'
  created_at: number
}

export interface Answer {
  id: number
  question_id: number
  text: string
  is_from_author: boolean
  created_at: number
}

export interface Vote {
  id: number
  question_id: number
  voter_identifier: string
  created_at: number
}

export interface QuestionWithAnswers extends Question {
  answers?: Answer[]
}

export class DiscussionRepository {
  constructor(private db: Database.Database) {}

  // Question methods
  createQuestion(chapterId: number, text: string, authorName: string): Question {
    const stmt = this.db.prepare(`
      INSERT INTO questions (chapter_id, text, author_name, status)
      VALUES (?, ?, ?, 'open')
    `)
    const result = stmt.run(chapterId, text, authorName)
    return this.getQuestionById(Number(result.lastInsertRowid))!
  }

  getQuestionById(id: number): Question | null {
    const stmt = this.db.prepare('SELECT * FROM questions WHERE id = ?')
    return (stmt.get(id) as Question | undefined) || null
  }

  getQuestionsByChapter(chapterId: number, sortBy: 'recent' | 'votes' = 'votes'): QuestionWithAnswers[] {
    const orderBy = sortBy === 'votes' ? 'vote_count DESC, created_at DESC' : 'created_at DESC'
    const stmt = this.db.prepare(`
      SELECT * FROM questions
      WHERE chapter_id = ?
      ORDER BY ${orderBy}
    `)
    const questions = stmt.all(chapterId) as Question[]

    // Attach answers to each question
    return questions.map(q => ({
      ...q,
      answers: this.getAnswersByQuestion(q.id)
    }))
  }

  updateQuestion(id: number, data: Partial<Question>): void {
    const fields: string[] = []
    const values: any[] = []

    if (data.status !== undefined) {
      fields.push('status = ?')
      values.push(data.status)
    }

    if (fields.length === 0) return

    values.push(id)
    const stmt = this.db.prepare(`UPDATE questions SET ${fields.join(', ')} WHERE id = ?`)
    stmt.run(...values)
  }

  deleteQuestion(id: number): void {
    const stmt = this.db.prepare('DELETE FROM questions WHERE id = ?')
    stmt.run(id)
  }

  // Answer methods
  createAnswer(questionId: number, text: string, isFromAuthor: boolean): Answer {
    const stmt = this.db.prepare(`
      INSERT INTO answers (question_id, text, is_from_author)
      VALUES (?, ?, ?)
    `)
    const result = stmt.run(questionId, text, isFromAuthor ? 1 : 0)
    return this.getAnswerById(Number(result.lastInsertRowid))!
  }

  getAnswerById(id: number): Answer | null {
    const stmt = this.db.prepare('SELECT * FROM answers WHERE id = ?')
    const row = stmt.get(id) as any
    if (!row) return null
    return {
      ...row,
      is_from_author: Boolean(row.is_from_author)
    } as Answer
  }

  getAnswersByQuestion(questionId: number): Answer[] {
    const stmt = this.db.prepare('SELECT * FROM answers WHERE question_id = ? ORDER BY created_at ASC')
    const rows = stmt.all(questionId) as any[]
    return rows.map(row => ({
      ...row,
      is_from_author: Boolean(row.is_from_author)
    }))
  }

  deleteAnswer(id: number): void {
    const stmt = this.db.prepare('DELETE FROM answers WHERE id = ?')
    stmt.run(id)
  }

  // Vote methods
  addVote(questionId: number, voterIdentifier: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO votes (question_id, voter_identifier)
      VALUES (?, ?)
    `)
    stmt.run(questionId, voterIdentifier)

    // Update vote count
    this.updateVoteCount(questionId)
  }

  removeVote(questionId: number, voterIdentifier: string): void {
    const stmt = this.db.prepare('DELETE FROM votes WHERE question_id = ? AND voter_identifier = ?')
    stmt.run(questionId, voterIdentifier)

    // Update vote count
    this.updateVoteCount(questionId)
  }

  hasVoted(questionId: number, voterIdentifier: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM votes WHERE question_id = ? AND voter_identifier = ? LIMIT 1')
    return stmt.get(questionId, voterIdentifier) !== undefined
  }

  private updateVoteCount(questionId: number): void {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM votes WHERE question_id = ?')
    const result = countStmt.get(questionId) as { count: number }
    const voteCount = result.count

    const updateStmt = this.db.prepare('UPDATE questions SET vote_count = ? WHERE id = ?')
    updateStmt.run(voteCount, questionId)
  }

  getTopQuestions(chapterId: number, limit: number = 5): QuestionWithAnswers[] {
    const stmt = this.db.prepare(`
      SELECT * FROM questions
      WHERE chapter_id = ?
      ORDER BY vote_count DESC
      LIMIT ?
    `)
    const questions = stmt.all(chapterId, limit) as Question[]

    return questions.map(q => ({
      ...q,
      answers: this.getAnswersByQuestion(q.id)
    }))
  }
}
