import { ipcMain } from 'electron'
import { ChapterRepository, CreateChapterData } from '../database/repositories/chapterRepository'

export function registerChapterHandlers(chapterRepo: ChapterRepository): void {
  ipcMain.handle('chapters:create', async (_, bookId: number, data: CreateChapterData) => {
    return chapterRepo.createChapter(bookId, data)
  })

  ipcMain.handle('chapters:getByBook', async (_, bookId: number) => {
    return chapterRepo.getChaptersByBook(bookId)
  })

  ipcMain.handle('chapters:updateVersion', async (_, chapterId: number, content: string, summary?: string) => {
    return chapterRepo.createVersion(chapterId, content, summary)
  })

  ipcMain.handle('chapters:publish', async (_, versionId: number) => {
    chapterRepo.publishVersion(versionId)
  })

  ipcMain.handle('chapters:getLatestVersion', async (_, chapterId: number) => {
    return chapterRepo.getLatestVersion(chapterId)
  })
}
