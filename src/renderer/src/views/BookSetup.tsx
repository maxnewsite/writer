import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { useBookStore, type OutlineNode } from '../store/bookStore'
import { aiService } from '../services/aiService'
import Spinner from '../components/common/Spinner'

type Step = 'niche' | 'ideas' | 'outline'

export default function BookSetup(): JSX.Element {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('niche')
  const [niche, setNiche] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [ideas, setIdeas] = useState<any[]>([])
  const [selectedIdea, setSelectedIdea] = useState<any>(null)
  const [outline, setOutline] = useState<OutlineNode[]>([])

  const { activeProvider, providerConnections } = useAppStore()
  const { createBook } = useBookStore()

  const isConnected = providerConnections[activeProvider]

  const handleGenerateIdeas = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!niche.trim()) return

    setIsGenerating(true)
    try {
      const generatedIdeas = await aiService.generateBookIdeas(niche, 5)
      setIdeas(Array.isArray(generatedIdeas) ? generatedIdeas : [])
      if (generatedIdeas.length > 0) {
        setSelectedIdea(generatedIdeas[0])
      }
      setStep('ideas')
    } catch (error) {
      console.error('Failed to generate ideas:', error)
      setIdeas([])
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateOutline = async () => {
    if (!selectedIdea) return

    setIsGenerating(true)
    try {
      const generatedOutline = await aiService.generateOutline(
        selectedIdea.title,
        selectedIdea.hook,
        10  // target chapters
      )

      // generateOutline always returns an array
      setOutline(generatedOutline)
      setStep('outline')
    } catch (error) {
      console.error('Failed to generate outline:', error)
      setOutline([])
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateBook = async () => {
    if (!selectedIdea || outline.length === 0) return

    try {
      await createBook({
        title: selectedIdea.title,
        niche: niche,
        description: selectedIdea.hook,
        outline: outline
      })

      navigate('/')
    } catch (error) {
      console.error('Failed to create book:', error)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Step Indicator */}
      <div className="mb-12">
        <div className="flex gap-4">
          <div
            className={`flex-1 p-4 rounded-lg text-center font-semibold transition ${
              step === 'niche'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            1. Define Niche
          </div>
          <div
            className={`flex-1 p-4 rounded-lg text-center font-semibold transition ${
              step === 'ideas'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            2. Select Idea
          </div>
          <div
            className={`flex-1 p-4 rounded-lg text-center font-semibold transition ${
              step === 'outline'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            3. Build Outline
          </div>
        </div>
      </div>

      {/* AI Provider Connection Status */}
      {!isConnected && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">
            ⚠️ {activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'} is not connected. Make sure it's running on{' '}
            <code className="bg-white px-2 py-1 rounded">
              {activeProvider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234'}
            </code>
          </p>
        </div>
      )}

      {/* Step 1: Niche Input */}
      {step === 'niche' && (
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            What's your book's niche?
          </h2>
          <p className="text-gray-600 mb-6">
            Tell the AI what topic or niche you want to write a book about.
            Examples: "productivity for developers", "vegan cooking", "startup
            scaling"
          </p>

          <form onSubmit={handleGenerateIdeas} className="space-y-4">
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Enter your book niche..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isGenerating || !isConnected}
            />

            <button
              type="submit"
              disabled={!niche.trim() || isGenerating || !isConnected}
              className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 transition"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> Generating Ideas...
                </span>
              ) : (
                '✨ Generate Book Ideas'
              )}
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Idea Selection */}
      {step === 'ideas' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Choose your book idea
          </h2>

          <div className="space-y-4">
            {ideas.length > 0 ? (
              ideas.map((idea, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedIdea(idea)}
                  className={`p-6 rounded-lg border-2 cursor-pointer transition ${
                    selectedIdea?.title === idea.title
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {idea.title}
                  </h3>
                  <p className="text-gray-600 mb-3">{idea.hook}</p>
                  <p className="text-sm text-gray-500">
                    <strong>Target Audience:</strong> {idea.audience}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    <strong>Key Themes:</strong> {idea.themes?.join(', ')}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-gray-600">
                No ideas generated. Please try again.
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep('niche')}
              className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition"
            >
              ← Back
            </button>
            <button
              onClick={handleGenerateOutline}
              disabled={!selectedIdea || isGenerating}
              className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 transition flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Spinner /> Generating Outline...
                </>
              ) : (
                '📚 Generate Outline'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Outline Review */}
      {step === 'outline' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Review your book outline
          </h2>

          <div className="bg-white rounded-lg shadow-md p-6 max-h-96 overflow-y-auto">
            {outline.length > 0 ? (
              <div className="space-y-4">
                {outline.map((chapter, idx) => (
                  <div key={idx} className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-bold text-gray-900">
                      {chapter.title}
                    </h4>
                    {chapter.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {chapter.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No outline generated.</p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep('ideas')}
              className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition"
            >
              ← Back
            </button>
            <button
              onClick={handleCreateBook}
              className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition"
            >
              ✅ Create Book & Start Writing
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
