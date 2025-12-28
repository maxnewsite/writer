import { ipcMain } from 'electron'
import { DiscussionRepository } from '../database/repositories/discussionRepository'

export function registerDiscussionHandlers(discussionRepo: DiscussionRepository): void {
  ipcMain.handle(
    'discussions:createQuestion',
    async (_, chapterId: number, text: string, authorName: string) => {
      return discussionRepo.createQuestion(chapterId, text, authorName)
    }
  )

  ipcMain.handle('discussions:getQuestions', async (_, chapterId: number, sortBy?: 'recent' | 'votes') => {
    return discussionRepo.getQuestionsByChapter(chapterId, sortBy || 'votes')
  })

  ipcMain.handle('discussions:addAnswer', async (_, questionId: number, text: string, isFromAuthor: boolean) => {
    return discussionRepo.createAnswer(questionId, text, isFromAuthor)
  })

  ipcMain.handle('discussions:vote', async (_, questionId: number, voterIdentifier: string) => {
    // Toggle vote - if already voted, remove; otherwise add
    if (discussionRepo.hasVoted(questionId, voterIdentifier)) {
      discussionRepo.removeVote(questionId, voterIdentifier)
    } else {
      discussionRepo.addVote(questionId, voterIdentifier)
    }
  })
}
