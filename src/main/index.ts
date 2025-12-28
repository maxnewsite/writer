import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { initDatabase, closeDatabase } from './database/db'
import { BookRepository } from './database/repositories/bookRepository'
import { ChapterRepository } from './database/repositories/chapterRepository'
import { DiscussionRepository } from './database/repositories/discussionRepository'
import { registerBookHandlers } from './ipc/bookHandlers'
import { registerChapterHandlers } from './ipc/chapterHandlers'
import { registerDiscussionHandlers } from './ipc/discussionHandlers'
import { registerOllamaHandlers } from './ipc/ollamaHandlers'
import { registerAIAudienceHandlers } from './ipc/aiAudienceHandlers'
import { registerChapterDraftingHandlers } from './ipc/chapterDraftingHandlers'
import { OllamaService } from './services/ollamaService'
import { AIPersonaService } from './services/aiPersonaService'
import { AIAudienceService } from './services/aiAudienceService'
import { ChapterDraftingService } from './services/chapterDraftingService'

// Disable hardware acceleration to prevent GPU errors on Windows
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // Initialize database
  const db = initDatabase()
  console.log('✓ Database initialized')

  // Initialize repositories
  const bookRepo = new BookRepository(db)
  const chapterRepo = new ChapterRepository(db)
  const discussionRepo = new DiscussionRepository(db)

  // Initialize AI services
  const ollamaService = new OllamaService()
  const personaService = new AIPersonaService()
  const aiAudienceService = new AIAudienceService(ollamaService, personaService, discussionRepo)
  const draftingService = new ChapterDraftingService(ollamaService, aiAudienceService, chapterRepo, discussionRepo)
  console.log('✓ AI services initialized')

  // Register IPC handlers
  registerBookHandlers(bookRepo)
  registerChapterHandlers(chapterRepo)
  registerDiscussionHandlers(discussionRepo)
  registerOllamaHandlers()
  registerAIAudienceHandlers(aiAudienceService, personaService)
  registerChapterDraftingHandlers(draftingService)
  console.log('✓ IPC handlers registered')

  // Create window
  createWindow()
})
