import { ipcMain } from 'electron'
import { ChapterDraftingService } from '../services/chapterDraftingService'

export function registerChapterDraftingHandlers(draftingService: ChapterDraftingService): void {
  // Generate initial chapter draft
  ipcMain.handle('chapter-drafting:generate-draft', async (_, config) => {
    try {
      return await draftingService.generateChapterDraft(config)
    } catch (error) {
      console.error('Failed to generate draft:', error)
      throw error
    }
  })

  // Generate AI reader feedback
  ipcMain.handle('chapter-drafting:generate-feedback', async (_, chapterId, chapterTitle, chapterContent) => {
    try {
      await draftingService.generateAIReaderFeedback(chapterId, chapterTitle, chapterContent)
      return { success: true }
    } catch (error) {
      console.error('Failed to generate feedback:', error)
      throw error
    }
  })

  // Analyze feedback to determine if redraft is needed
  ipcMain.handle('chapter-drafting:analyze-feedback', async (_, chapterId) => {
    try {
      return await draftingService.analyzeFeedback(chapterId)
    } catch (error) {
      console.error('Failed to analyze feedback:', error)
      throw error
    }
  })

  // Redraft chapter based on feedback
  ipcMain.handle('chapter-drafting:redraft', async (_, config, originalDraft, feedback) => {
    try {
      return await draftingService.redraftChapterWithFeedback(config, originalDraft, feedback)
    } catch (error) {
      console.error('Failed to redraft chapter:', error)
      throw error
    }
  })

  // FULL AI WRITING - Autonomous book generation
  ipcMain.handle('chapter-drafting:full-ai-writing', async (_, bookId, bookTitle, bookDescription) => {
    try {
      await draftingService.fullAIWriting(bookId, bookTitle, bookDescription)
      return { success: true }
    } catch (error) {
      console.error('Failed to complete full AI writing:', error)
      throw error
    }
  })
}
