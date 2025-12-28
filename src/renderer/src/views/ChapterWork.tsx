import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBookStore } from '../store/bookStore'
import { useChapterStore } from '../store/chapterStore'
import { useDiscussionStore } from '../store/discussionStore'
import { useAppStore } from '../store/appStore'
import { aiService } from '../services/aiService'
import { db } from '../services/database'
import { createBookContextManager } from '../services/bookContext'
import ChapterList from '../components/chapter/ChapterList'
import ChapterEditor from '../components/chapter/ChapterEditor'
import QuestionList from '../components/discussion/QuestionList'
import ResearchPanel from '../components/research/ResearchPanel'
import Spinner from '../components/common/Spinner'

export default function ChapterWork(): JSX.Element {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const [isCreatingChapter, setIsCreatingChapter] = useState(false)
  const [isFullAIWriting, setIsFullAIWriting] = useState(false)
  const [showResearchPanel, setShowResearchPanel] = useState(false)
  const [aiWritingProgress, setAiWritingProgress] = useState<{
    current: number
    total: number
    currentChapter: string
    currentPass?: string
    qualityScore?: string
  } | null>(null)

  const { currentBook, selectBook } = useBookStore()
  const { chapters, currentChapter, fetchChapters, selectChapter, createChapter, updateChapterVersion } = useChapterStore()
  const { questions, fetchQuestions, createQuestion } = useDiscussionStore()
  const { activeProvider, providerConnections } = useAppStore()

  // Initialize
  useEffect(() => {
    if (!bookId) return

    const initializeBook = async () => {
      const id = parseInt(bookId, 10)
      await selectBook(id)
      await fetchChapters(id)
    }

    initializeBook().catch(console.error)
  }, [bookId])

  // Load questions when chapter changes
  useEffect(() => {
    if (currentChapter) {
      fetchQuestions(currentChapter.id).catch(console.error)
    }
  }, [currentChapter?.id])

  const handleCreateChapter = async () => {
    if (!currentBook) return

    setIsCreatingChapter(true)
    try {
      const nextNumber = (chapters.length || 0) + 1
      const outline = JSON.parse(currentBook.outline || '[]')
      const chapterOutline = outline[nextNumber - 1] || {}

      await createChapter(currentBook.id, {
        chapter_number: nextNumber,
        title: chapterOutline.title || `Chapter ${nextNumber}`,
        content: ''
      })
    } catch (error) {
      console.error('Failed to create chapter:', error)
    } finally {
      setIsCreatingChapter(false)
    }
  }

  const handleFullAIWriting = async () => {
    if (!currentBook) return

    // Debug: Log book data
    console.log('📘 Current Book Data:', {
      id: currentBook.id,
      title: currentBook.title,
      niche: currentBook.niche,
      hasNiche: !!currentBook.niche,
      hasTitle: !!currentBook.title
    })

    // Check if AI is connected
    if (!providerConnections[activeProvider]) {
      alert(
        `❌ ${activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'} is not connected!\n\n` +
        `Please make sure ${activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'} is running and try again.\n\n` +
        `You can change the AI provider in Settings.`
      )
      return
    }

    if (chapters.length === 0) {
      alert('Please create an outline with chapters first before using Full AI Writing.')
      return
    }

    const confirmed = confirm(
      `🤖 ENHANCED FULL AI WRITING MODE\n\n` +
      `This will generate content for ALL ${chapters.length} chapters using ${activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'}.\n\n` +
      `ENHANCED MULTI-PASS PROCESS:\n` +
      `🔬 Phase 0: Real-time web research (statistics, trends, data)\n` +
      `📋 Pass 1: Generate chapter skeleton/structure\n` +
      `✍️ Pass 2: Write first draft\n` +
      `🎭 Pass 3: 9 MECE personas critique (each asks 1 question, casts 2 votes)\n` +
      `🔧 Pass 4: Targeted revision based on top feedback\n` +
      `✨ Pass 5: Style polish\n` +
      `🚦 Pass 6: Quality gates assessment\n\n` +
      `QUALITY GATES:\n` +
      `• Length check (600-2000 words)\n` +
      `• Structure check (proper headings)\n` +
      `• Coherence, Clarity, Engagement, Completeness (AI-scored)\n` +
      `• Reader questions addressed\n\n` +
      `CONTEXT MEMORY:\n` +
      `• Global book thesis & style guide\n` +
      `• Chapter summaries & key points\n` +
      `• Concepts introduced & decisions made\n` +
      `• Top 2 reader questions fed to next chapter\n\n` +
      `⏱️ Estimated time: ${Math.ceil(chapters.length * 8)} minutes\n` +
      `(~8 min per chapter with 6-pass writing)\n\n` +
      `Continue?`
    )

    if (!confirmed) return

    setIsFullAIWriting(true)
    setAiWritingProgress({ current: 0, total: chapters.length, currentChapter: 'Initializing...', currentPass: 'setup' })

    try {
      console.log('🤖 Starting Enhanced Full AI Writing with Multi-Pass System...')

      // Initialize Book Context Manager
      const contextManager = createBookContextManager(currentBook.id)

      // Initialize book context if not already set
      if (!contextManager.getContext().thesis) {
        console.log('📚 Initializing book context...')
        setAiWritingProgress({ current: 0, total: chapters.length, currentChapter: 'Analyzing book...', currentPass: 'context' })

        const bookContextInit = await aiService.initializeBookContext(
          currentBook.title,
          currentBook.description || ''
        )

        contextManager.initializeContext({
          thesis: bookContextInit.thesis,
          coreArgument: bookContextInit.coreArgument,
          targetAudience: bookContextInit.targetAudience,
          bookArchetype: bookContextInit.bookArchetype,
          toneMarkers: bookContextInit.toneMarkers
        })

        console.log(`  ✓ Book context initialized:`)
        console.log(`    Thesis: ${bookContextInit.thesis}`)
        console.log(`    Audience: ${bookContextInit.targetAudience}`)
        console.log(`    Archetype: ${bookContextInit.bookArchetype}`)
      }

      // Get book outline
      const outline = currentBook.outline ? JSON.parse(currentBook.outline) : []

      // Track accumulated questions for next chapter
      let accumulatedQuestions: string[] = []

      // Track quality scores
      const qualityScores: Array<{ chapter: string; score: number; maxScore: number; passed: boolean }> = []

      // Write each chapter with multi-pass system
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]
        const chapterOutline = outline[i] || { title: chapter.title, description: '' }
        const nextChapter = i < chapters.length - 1 ? chapters[i + 1] : null

        console.log(`\n${'='.repeat(60)}`)
        console.log(`📝 Chapter ${i + 1}/${chapters.length}: ${chapter.title}`)
        console.log(`${'='.repeat(60)}`)

        try {
          // Get full writing context from tiered memory
          const bookContext = contextManager.getWritingContext()

          // Use multi-pass writing with real-time research
          const result = await aiService.writeChapterMultiPass(
            chapter.chapter_number,
            chapter.title,
            chapterOutline.description || '',
            bookContext,
            accumulatedQuestions,
            (pass, status) => {
              setAiWritingProgress({
                current: i + 1,
                total: chapters.length,
                currentChapter: chapter.title,
                currentPass: `${pass}: ${status}`,
                qualityScore: undefined
              })
            },
            currentBook.niche, // For calibrated personas and research
            currentBook.title, // For research context
            chapter.id, // For caching research
            currentBook.id // For book-level research storage
          )

          // Update progress with quality score
          const qualityPercent = Math.round((result.qualityAssessment.totalScore / result.qualityAssessment.maxPossibleScore) * 100)
          setAiWritingProgress({
            current: i + 1,
            total: chapters.length,
            currentChapter: chapter.title,
            currentPass: 'Saving...',
            qualityScore: `${qualityPercent}% ${result.qualityAssessment.overallPassed ? '✓' : '⚠'}`
          })

          qualityScores.push({
            chapter: chapter.title,
            score: result.qualityAssessment.totalScore,
            maxScore: result.qualityAssessment.maxPossibleScore,
            passed: result.qualityAssessment.overallPassed
          })

          // Save the final content
          await updateChapterVersion(
            chapter.id,
            result.finalContent,
            `AI Generated - Multi-Pass (Quality: ${qualityPercent}%)`
          )
          console.log(`  💾 Chapter saved (Quality: ${qualityPercent}%)`)

          // Update book context with metadata
          for (const concept of result.conceptsIntroduced) {
            contextManager.addConceptIntroduction(concept, chapter.chapter_number, concept)
          }
          for (const decision of result.decisionsStatements) {
            contextManager.addKeyDecision(chapter.id, chapter.chapter_number, decision, 'From chapter content')
          }

          // Add chapter to tiered memory
          contextManager.addChapterToMemory(
            chapter.chapter_number,
            chapter.title,
            result.finalContent,
            result.summary,
            result.keyPoints
          )

          // Generate style guide from first chapter
          if (i === 0) {
            console.log('  🎨 Generating style guide from first chapter...')
            const styleGuide = await aiService.generateStyleGuide(result.finalContent)
            contextManager.updateStyleGuide(styleGuide)
            console.log(`    Voice: ${styleGuide.voiceDescription}`)
          }

          // Get persona feedback for questions (already done in multi-pass, but save to DB)
          const personaQuestions = result.passes.find(p => p.passName === 'persona_critique')?.content || ''
          const questionLines = personaQuestions.split('\n').filter(l => l.includes('['))

          for (const line of questionLines) {
            const match = line.match(/\[([^\]]+)\]\s*\((\d+)\s*votes?\):\s*(.+)/)
            if (match) {
              const [, persona, votes, question] = match
              try {
                const savedQuestion = await createQuestion(chapter.id, question.trim(), persona)
                if (savedQuestion && savedQuestion.id && parseInt(votes) > 0) {
                  for (let v = 0; v < parseInt(votes); v++) {
                    try {
                      await db.addVote(savedQuestion.id, `ai_persona_${v}_${Date.now()}_${savedQuestion.id}`)
                    } catch (err) {
                      // Ignore vote errors
                    }
                  }
                }
              } catch (err) {
                console.warn('Failed to save question:', err)
              }
            }
          }

          // Prepare top 2 questions for next chapter
          if (nextChapter) {
            const topQuestionLines = questionLines.slice(0, 2)
            accumulatedQuestions = topQuestionLines.map(line => {
              const match = line.match(/\[([^\]]+)\]\s*\((\d+)\s*votes?\):\s*(.+)/)
              return match ? `[${match[1]}] (${match[2]} votes): ${match[3]}` : line
            })

            // Analyze feedback for insights
            if (questionLines.length > 0) {
              console.log(`  🔍 Analyzing feedback for next chapter...`)
              // The insights are already incorporated through the multi-pass revision
            }
          }

          console.log(`\n✅ Chapter ${i + 1} complete!`)
          console.log(`   Quality: ${qualityPercent}% (${result.qualityAssessment.overallPassed ? 'PASSED' : 'NEEDS IMPROVEMENT'})`)
          result.qualityAssessment.gates.forEach(g => {
            console.log(`   ${g.passed ? '✓' : '✗'} ${g.gateName}: ${g.score}/${g.maxScore}`)
          })

        } catch (error) {
          console.error(`❌ Failed to process Chapter ${i + 1}:`, error)
          qualityScores.push({
            chapter: chapter.title,
            score: 0,
            maxScore: 100,
            passed: false
          })
          // Continue with next chapter even if one fails
        }

        // Small delay between chapters
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Refresh chapters and questions
      await fetchChapters(currentBook.id)

      // Calculate overall statistics
      const avgQuality = qualityScores.length > 0
        ? Math.round(qualityScores.reduce((sum, q) => sum + (q.score / q.maxScore * 100), 0) / qualityScores.length)
        : 0
      const passedCount = qualityScores.filter(q => q.passed).length

      setAiWritingProgress(null)
      alert(
        `✅ Enhanced Full AI Writing Complete!\n\n` +
        `Generated: ${chapters.length} chapters\n` +
        `Quality Gate Results: ${passedCount}/${chapters.length} passed\n` +
        `Average Quality Score: ${avgQuality}%\n\n` +
        `MULTI-PASS PROCESS USED:\n` +
        `📋 Skeleton → ✍️ Draft → 🎭 9 MECE Persona Critique →\n` +
        `🔧 Revision → ✨ Polish → 🚦 Quality Gates\n\n` +
        `CONTEXT MAINTAINED:\n` +
        `• Book thesis & style guide established\n` +
        `• Chapter summaries stored for reference\n` +
        `• Key concepts tracked across chapters\n` +
        `• Reader questions addressed in each chapter\n\n` +
        `Each chapter was written with full awareness of previous content!`
      )

      console.log('\n' + '='.repeat(60))
      console.log('✅ Enhanced Full AI Writing Complete!')
      console.log(`   Chapters: ${chapters.length}`)
      console.log(`   Passed Quality Gates: ${passedCount}/${chapters.length}`)
      console.log(`   Average Quality: ${avgQuality}%`)
      console.log('='.repeat(60))

    } catch (error) {
      console.error('Full AI Writing failed:', error)
      setAiWritingProgress(null)
      alert('❌ Full AI Writing failed. Check console for details.')
    } finally {
      setIsFullAIWriting(false)
    }
  }

  const handleAIGenerateQuestions = async () => {
    if (!currentChapter) return

    // Check if AI is connected
    if (!providerConnections[activeProvider]) {
      alert(
        `❌ ${activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'} is not connected!\n\n` +
        `Please make sure ${activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'} is running.`
      )
      return
    }

    try {
      console.log('🤖 Generating AI reader questions...')

      // Get the latest chapter content
      const latestVersion = await db.getLatestVersion(currentChapter.id)

      if (!latestVersion || !latestVersion.content || latestVersion.content.trim().length < 50) {
        alert('Chapter content is too short or empty. Write some content first before generating AI questions.')
        return
      }

      // Generate AI reader feedback questions with 9 MECE persona debate and voting
      const feedbackQuestions = await aiService.generateReaderFeedback(
        currentChapter.title,
        latestVersion.content
      )

      // Save feedback questions to database with votes from personas
      for (const questionData of feedbackQuestions) {
        try {
          // Save question with persona label
          const savedQuestion = await createQuestion(
            currentChapter.id,
            questionData.question,
            questionData.persona
          )

          console.log(`  💭 [${questionData.persona}] ${questionData.votes} votes: "${questionData.question.substring(0, 50)}..."`)

          // Add the votes that this question received from other personas
          if (savedQuestion && savedQuestion.id && questionData.votes > 0) {
            for (let v = 0; v < questionData.votes; v++) {
              try {
                await db.addVote(savedQuestion.id, `ai_persona_${v}_${Date.now()}_${savedQuestion.id}`)
              } catch (err) {
                // Vote might already exist, ignore
              }
            }
          }
        } catch (err) {
          console.warn('Failed to save question:', err)
        }
      }

      // Refresh questions to show the AI-generated ones with votes
      await fetchQuestions(currentChapter.id)

      console.log(`✅ Generated ${feedbackQuestions.length} AI reader questions from 9 MECE personas with voting!`)
    } catch (error) {
      console.error('AI generation failed:', error)
      alert('Failed to generate AI questions. Make sure your AI provider is running and try again.')
    }
  }

  if (!currentBook) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Panel: Chapter List */}
      <div className="w-64 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900 text-sm mb-3 truncate">
            {currentBook.title}
          </h3>

          {/* FULL AI WRITING Button */}
          <div className="mb-3">
            <button
              onClick={handleFullAIWriting}
              disabled={isFullAIWriting}
              className="w-full px-3 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-300 transition shadow-lg flex flex-col items-center justify-center gap-1"
              title="Fully autonomous AI writing - all chapters written without human intervention"
            >
              {isFullAIWriting && aiWritingProgress ? (
                <>
                  <div className="flex items-center gap-2">
                    <Spinner /> Multi-Pass Writing
                  </div>
                  <div className="text-xs font-normal">
                    Chapter {aiWritingProgress.current}/{aiWritingProgress.total}
                  </div>
                  {aiWritingProgress.currentChapter && (
                    <div className="text-xs font-normal truncate w-full text-center opacity-90">
                      {aiWritingProgress.currentChapter}
                    </div>
                  )}
                  {aiWritingProgress.currentPass && (
                    <div className="text-xs font-normal truncate w-full text-center opacity-75">
                      {aiWritingProgress.currentPass}
                    </div>
                  )}
                  {aiWritingProgress.qualityScore && (
                    <div className="text-xs font-semibold mt-1 bg-white/20 px-2 py-0.5 rounded">
                      Quality: {aiWritingProgress.qualityScore}
                    </div>
                  )}
                </>
              ) : (
                <>🤖 ENHANCED AI WRITING</>
              )}
            </button>
          </div>

          <button
            onClick={handleCreateChapter}
            disabled={isCreatingChapter}
            className="w-full px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-300 transition flex items-center justify-center gap-2"
          >
            {isCreatingChapter ? (
              <>
                <Spinner /> Creating...
              </>
            ) : (
              <>+ Add Chapter</>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ChapterList
            chapters={chapters}
            currentChapterId={currentChapter?.id}
            onSelectChapter={selectChapter}
          />
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => navigate('/')}
            className="w-full px-3 py-2 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 transition"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {/* Center Panel: Chapter Editor */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {currentChapter ? (
          <ChapterEditor
            chapter={currentChapter}
            onQuestionCreated={() => {
              fetchQuestions(currentChapter.id).catch(console.error)
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>Select a chapter to start writing</p>
          </div>
        )}
      </div>

      {/* Right Panel: Q&A */}
      <div className="w-96 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
        {currentChapter ? (
          <>
            {/* Research Button Header */}
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
              <button
                onClick={() => setShowResearchPanel(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition shadow-lg flex items-center justify-center gap-2 font-semibold"
              >
                <span>🔬</span>
                <span>View Research Data</span>
              </button>
              <p className="text-xs text-gray-600 mt-2 text-center">
                Statistics, trends, and sources used in this chapter
              </p>
            </div>

            <QuestionList
              chapterId={currentChapter.id}
              questions={questions}
              onQuestionCreated={() => {
                fetchQuestions(currentChapter.id).catch(console.error)
              }}
              onAIGenerate={handleAIGenerateQuestions}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>Select a chapter to view questions</p>
          </div>
        )}
      </div>

      {/* Research Panel Modal */}
      {showResearchPanel && currentChapter && (
        <ResearchPanel
          chapterId={currentChapter.id}
          chapterTitle={currentChapter.title}
          onClose={() => setShowResearchPanel(false)}
        />
      )}
    </div>
  )
}
