import { ipcMain } from 'electron'
import { AIAudienceService, type AutoGenerationConfig } from '../services/aiAudienceService'
import { AIPersonaService } from '../services/aiPersonaService'

export function registerAIAudienceHandlers(aiAudienceService: AIAudienceService, personaService: AIPersonaService): void {
  /**
   * Trigger automated AI audience interaction for a chapter
   */
  ipcMain.handle(
    'ai-audience:generate-interaction',
    async (
      _,
      chapterId: number,
      chapterTitle: string,
      chapterContent: string,
      config?: Partial<AutoGenerationConfig>
    ) => {
      try {
        await aiAudienceService.generateAutomaticQuestions(
          chapterId,
          chapterTitle,
          chapterContent,
          config
        )
        return { success: true }
      } catch (error) {
        console.error('Error in automated audience generation:', error)
        throw error
      }
    }
  )

  /**
   * Get all available AI personas
   */
  ipcMain.handle('ai-audience:get-personas', async () => {
    return personaService.getAllPersonas()
  })

  /**
   * Get a specific persona by ID
   */
  ipcMain.handle('ai-audience:get-persona', async (_, personaId: string) => {
    return personaService.getPersona(personaId)
  })
}
