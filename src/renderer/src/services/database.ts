import { openDB, DBSchema, IDBPDatabase } from 'idb'

// Database schema
interface BookWriterDB extends DBSchema {
  books: {
    key: number
    value: {
      id: number
      title: string
      description: string
      niche: string
      outline: string
      status: 'setup' | 'in_progress' | 'completed'
      created_at: string
      updated_at: string
    }
    indexes: { 'by-updated': string }
  }
  chapters: {
    key: number
    value: {
      id: number
      book_id: number
      title: string
      order_index: number
      created_at: string
      updated_at: string
    }
    indexes: { 'by-book': number }
  }
  chapter_versions: {
    key: number
    value: {
      id: number
      chapter_id: number
      content: string
      summary: string | null
      is_published: number
      version_number: number
      created_at: string
    }
    indexes: { 'by-chapter': number; 'by-published': [number, number] }
  }
  questions: {
    key: number
    value: {
      id: number
      chapter_id: number
      text: string
      author_name: string
      vote_count: number
      created_at: string
    }
    indexes: { 'by-chapter': number }
  }
  answers: {
    key: number
    value: {
      id: number
      question_id: number
      text: string
      is_from_author: number
      created_at: string
    }
    indexes: { 'by-question': number }
  }
  votes: {
    key: number
    value: {
      id: number
      question_id: number
      voter_identifier: string
      created_at: string
    }
    indexes: { 'by-question': number; 'by-voter-question': [string, number] }
  }
  chapter_research: {
    key: number
    value: {
      id: number
      chapter_id: number
      book_id: number
      chapter_title: string
      book_niche: string
      book_title: string
      summary: string
      key_statistics: string // JSON array
      recent_trends: string // JSON array
      notable_quotes: string // JSON array
      suggested_citations: string // JSON array
      raw_research: string // JSON full research data
      researched_at: string
      expires_at: string
    }
    indexes: { 'by-chapter': number; 'by-book': number }
  }
}

let dbInstance: IDBPDatabase<BookWriterDB> | null = null

export async function initDatabase(): Promise<IDBPDatabase<BookWriterDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<BookWriterDB>('book-writer', 2, {
    upgrade(db, oldVersion) {
      // Books table
      if (!db.objectStoreNames.contains('books')) {
        const booksStore = db.createObjectStore('books', {
          keyPath: 'id',
          autoIncrement: true
        })
        booksStore.createIndex('by-updated', 'updated_at')
      }

      // Chapters table
      if (!db.objectStoreNames.contains('chapters')) {
        const chaptersStore = db.createObjectStore('chapters', {
          keyPath: 'id',
          autoIncrement: true
        })
        chaptersStore.createIndex('by-book', 'book_id')
      }

      // Chapter versions table
      if (!db.objectStoreNames.contains('chapter_versions')) {
        const versionsStore = db.createObjectStore('chapter_versions', {
          keyPath: 'id',
          autoIncrement: true
        })
        versionsStore.createIndex('by-chapter', 'chapter_id')
        versionsStore.createIndex('by-published', ['chapter_id', 'is_published'])
      }

      // Questions table
      if (!db.objectStoreNames.contains('questions')) {
        const questionsStore = db.createObjectStore('questions', {
          keyPath: 'id',
          autoIncrement: true
        })
        questionsStore.createIndex('by-chapter', 'chapter_id')
      }

      // Answers table
      if (!db.objectStoreNames.contains('answers')) {
        const answersStore = db.createObjectStore('answers', {
          keyPath: 'id',
          autoIncrement: true
        })
        answersStore.createIndex('by-question', 'question_id')
      }

      // Votes table
      if (!db.objectStoreNames.contains('votes')) {
        const votesStore = db.createObjectStore('votes', {
          keyPath: 'id',
          autoIncrement: true
        })
        votesStore.createIndex('by-question', 'question_id')
        votesStore.createIndex('by-voter-question', ['voter_identifier', 'question_id'])
      }

      // Chapter Research table (added in version 2)
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('chapter_research')) {
          const researchStore = db.createObjectStore('chapter_research', {
            keyPath: 'id',
            autoIncrement: true
          })
          researchStore.createIndex('by-chapter', 'chapter_id')
          researchStore.createIndex('by-book', 'book_id')
        }
      }
    }
  })

  return dbInstance
}

export async function getDatabase(): Promise<IDBPDatabase<BookWriterDB>> {
  if (!dbInstance) {
    return initDatabase()
  }
  return dbInstance
}

// Database operations
export const db = {
  // Books
  async createBook(data: Omit<BookWriterDB['books']['value'], 'id'>) {
    const database = await getDatabase()
    const id = await database.add('books', data as any)
    return database.get('books', id)
  },

  async getAllBooks() {
    const database = await getDatabase()
    return database.getAllFromIndex('books', 'by-updated')
  },

  async getBookById(id: number) {
    const database = await getDatabase()
    return database.get('books', id)
  },

  async updateBook(id: number, data: Partial<BookWriterDB['books']['value']>) {
    const database = await getDatabase()
    const book = await database.get('books', id)
    if (!book) throw new Error('Book not found')
    const updated = { ...book, ...data, updated_at: new Date().toISOString() }
    await database.put('books', updated)
    return updated
  },

  async deleteBook(id: number) {
    const database = await getDatabase()
    await database.delete('books', id)
  },

  // Chapters
  async createChapter(data: Omit<BookWriterDB['chapters']['value'], 'id'>) {
    const database = await getDatabase()
    const id = await database.add('chapters', data as any)
    return database.get('chapters', id)
  },

  async getChaptersByBook(bookId: number) {
    const database = await getDatabase()
    return database.getAllFromIndex('chapters', 'by-book', bookId)
  },

  async getChapterById(id: number) {
    const database = await getDatabase()
    return database.get('chapters', id)
  },

  // Chapter versions
  async createChapterVersion(data: Omit<BookWriterDB['chapter_versions']['value'], 'id'>) {
    const database = await getDatabase()
    const id = await database.add('chapter_versions', data as any)
    return database.get('chapter_versions', id)
  },

  async getLatestVersion(chapterId: number) {
    const database = await getDatabase()
    const versions = await database.getAllFromIndex('chapter_versions', 'by-chapter', chapterId)
    return versions.sort((a, b) => b.version_number - a.version_number)[0] || null
  },

  async publishVersion(versionId: number) {
    const database = await getDatabase()
    const version = await database.get('chapter_versions', versionId)
    if (!version) throw new Error('Version not found')

    // Unpublish other versions of the same chapter
    const allVersions = await database.getAllFromIndex('chapter_versions', 'by-chapter', version.chapter_id)
    for (const v of allVersions) {
      if (v.is_published === 1) {
        await database.put('chapter_versions', { ...v, is_published: 0 })
      }
    }

    // Publish this version
    await database.put('chapter_versions', { ...version, is_published: 1 })
  },

  // Questions
  async createQuestion(data: Omit<BookWriterDB['questions']['value'], 'id'>) {
    const database = await getDatabase()
    const id = await database.add('questions', data as any)
    return database.get('questions', id)
  },

  async getQuestionsByChapter(chapterId: number, sortBy: 'recent' | 'votes' = 'recent') {
    const database = await getDatabase()
    const questions = await database.getAllFromIndex('questions', 'by-chapter', chapterId)

    if (sortBy === 'votes') {
      return questions.sort((a, b) => b.vote_count - a.vote_count)
    }
    return questions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  },

  // Answers
  async createAnswer(data: Omit<BookWriterDB['answers']['value'], 'id'>) {
    const database = await getDatabase()
    const id = await database.add('answers', data as any)
    return database.get('answers', id)
  },

  async getAnswersByQuestion(questionId: number) {
    const database = await getDatabase()
    return database.getAllFromIndex('answers', 'by-question', questionId)
  },

  // Votes
  async addVote(questionId: number, voterIdentifier: string) {
    const database = await getDatabase()

    // Check if already voted
    const existingVotes = await database.getAllFromIndex('votes', 'by-voter-question', [voterIdentifier, questionId])
    if (existingVotes.length > 0) {
      throw new Error('Already voted')
    }

    // Add vote
    await database.add('votes', {
      question_id: questionId,
      voter_identifier: voterIdentifier,
      created_at: new Date().toISOString()
    } as any)

    // Update question vote count
    const question = await database.get('questions', questionId)
    if (question) {
      await database.put('questions', { ...question, vote_count: question.vote_count + 1 })
    }
  },

  // Chapter Research
  async saveChapterResearch(data: Omit<BookWriterDB['chapter_research']['value'], 'id'>) {
    const database = await getDatabase()
    // Check if research already exists for this chapter
    const existing = await database.getAllFromIndex('chapter_research', 'by-chapter', data.chapter_id)
    if (existing.length > 0) {
      // Update existing research
      const updated = { ...existing[0], ...data }
      await database.put('chapter_research', updated)
      return updated
    }
    // Create new research
    const id = await database.add('chapter_research', data as any)
    return database.get('chapter_research', id)
  },

  async getChapterResearch(chapterId: number) {
    const database = await getDatabase()
    const results = await database.getAllFromIndex('chapter_research', 'by-chapter', chapterId)
    if (results.length === 0) return null

    const research = results[0]
    // Check if expired (24 hours)
    if (new Date(research.expires_at) < new Date()) {
      return null // Research is stale
    }
    return research
  },

  async getBookResearch(bookId: number) {
    const database = await getDatabase()
    return database.getAllFromIndex('chapter_research', 'by-book', bookId)
  },

  async deleteChapterResearch(chapterId: number) {
    const database = await getDatabase()
    const results = await database.getAllFromIndex('chapter_research', 'by-chapter', chapterId)
    for (const r of results) {
      await database.delete('chapter_research', r.id)
    }
  }
}
