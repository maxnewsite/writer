import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import { readFileSync } from 'fs'

let db: Database.Database | null = null

export function initDatabase(): Database.Database {
  if (db) return db

  // Get user data directory
  const dbPath = join(app.getPath('userData'), 'books.db')

  // Create/open database
  db = new Database(dbPath)

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run migrations
  runMigrations(db)

  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

function runMigrations(database: Database.Database): void {
  // Get current schema version
  const result = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_schema_version'").all()
  let currentVersion = 0

  if (result.length === 0) {
    // Create version table
    database.prepare(
      'CREATE TABLE _schema_version (version INTEGER PRIMARY KEY)'
    ).run()
  } else {
    const versionResult = database.prepare('SELECT version FROM _schema_version').get() as { version?: number } | undefined
    currentVersion = versionResult?.version || 0
  }

  // Define migrations
  const migrations: { version: number; sql: string }[] = [
    {
      version: 1,
      sql: `
        -- Books table
        CREATE TABLE IF NOT EXISTS books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          niche TEXT NOT NULL,
          description TEXT,
          outline TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'setup',
          ai_model_used TEXT,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );

        -- Chapters table
        CREATE TABLE IF NOT EXISTS chapters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          chapter_number INTEGER NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
          UNIQUE(book_id, chapter_number)
        );

        -- Chapter versions
        CREATE TABLE IF NOT EXISTS chapter_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chapter_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          change_summary TEXT,
          is_published BOOLEAN NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        );

        -- Questions
        CREATE TABLE IF NOT EXISTS questions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chapter_id INTEGER NOT NULL,
          text TEXT NOT NULL,
          author_name TEXT NOT NULL,
          vote_count INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'open',
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        );

        -- Answers
        CREATE TABLE IF NOT EXISTS answers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          question_id INTEGER NOT NULL,
          text TEXT NOT NULL,
          is_from_author BOOLEAN NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
        );

        -- Votes
        CREATE TABLE IF NOT EXISTS votes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          question_id INTEGER NOT NULL,
          voter_identifier TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
          UNIQUE(question_id, voter_identifier)
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id);
        CREATE INDEX IF NOT EXISTS idx_chapter_versions_chapter_id ON chapter_versions(chapter_id);
        CREATE INDEX IF NOT EXISTS idx_questions_chapter_id ON questions(chapter_id);
        CREATE INDEX IF NOT EXISTS idx_questions_vote_count ON questions(vote_count DESC);
        CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
        CREATE INDEX IF NOT EXISTS idx_votes_question_id ON votes(question_id);

        -- Trigger to update book timestamp
        CREATE TRIGGER IF NOT EXISTS update_book_timestamp
        AFTER UPDATE ON chapters
        BEGIN
          UPDATE books SET updated_at = strftime('%s', 'now')
          WHERE id = NEW.book_id;
        END;
      `
    }
  ]

  // Apply pending migrations
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      try {
        // Use exec() to run multiple SQL statements at once (handles triggers correctly)
        database.exec(migration.sql)
        database.prepare('INSERT OR REPLACE INTO _schema_version (version) VALUES (?)').run(migration.version)
        currentVersion = migration.version
        console.log(`✓ Migration ${migration.version} applied`)
      } catch (error) {
        console.error(`✗ Migration ${migration.version} failed:`, error)
        throw error
      }
    }
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
