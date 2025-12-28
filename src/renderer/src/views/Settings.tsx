import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import Spinner from '../components/common/Spinner'

export default function Settings(): JSX.Element {
  const navigate = useNavigate()
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'failed'>('idle')

  const {
    availableModels,
    selectedModel,
    isCheckingConnection,
    listModels,
    setSelectedModel,
    activeProvider,
    providerConnections,
    checkAllConnections,
    switchProvider
  } = useAppStore()

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult('idle')
    try {
      await checkAllConnections()
      const activeProviderConnected = providerConnections[activeProvider]
      if (activeProviderConnected) {
        await listModels()
        setTestResult('success')
      } else {
        setTestResult('failed')
      }
    } catch (error) {
      console.error('Connection test failed:', error)
      setTestResult('failed')
    } finally {
      setIsTesting(false)
    }
  }

  const handleModelSelect = (model: string) => {
    setSelectedModel(model)
  }

  const handleProviderSwitch = async (provider: 'ollama' | 'lmstudio') => {
    setTestResult('idle')
    await switchProvider(provider)
  }

  const isActiveProviderConnected = providerConnections[activeProvider]

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:text-blue-700 mb-4 text-sm font-semibold"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">⚙️ Settings</h1>
        <p className="text-gray-600 mt-2">Configure AI providers and application preferences</p>
      </div>

      {/* AI Provider Selection */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">AI Provider</h2>
        <p className="text-sm text-gray-600 mb-4">
          Choose between Ollama and LM Studio for local AI model inference
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Ollama Option */}
          <button
            onClick={() => handleProviderSwitch('ollama')}
            className={`p-4 border-2 rounded-lg transition ${
              activeProvider === 'ollama'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900">Ollama</h3>
              {activeProvider === 'ollama' && (
                <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">Active</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`w-3 h-3 rounded-full ${
                  providerConnections.ollama ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-gray-600">
                {providerConnections.ollama ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">localhost:11434</p>
          </button>

          {/* LM Studio Option */}
          <button
            onClick={() => handleProviderSwitch('lmstudio')}
            className={`p-4 border-2 rounded-lg transition ${
              activeProvider === 'lmstudio'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900">LM Studio</h3>
              {activeProvider === 'lmstudio' && (
                <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">Active</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`w-3 h-3 rounded-full ${
                  providerConnections.lmstudio ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-gray-600">
                {providerConnections.lmstudio ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">localhost:1234</p>
          </button>
        </div>
      </div>

      {/* Active Provider Configuration */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          {activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'} Configuration
        </h2>

        {/* Connection Status */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full ${
                  isActiveProviderConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="font-semibold text-gray-900">
                {isActiveProviderConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <span className="text-sm text-gray-500">
              {isActiveProviderConnected
                ? `✅ ${activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'} is running`
                : `❌ ${activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'} is not running`}
            </span>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            {activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'} should be running at{' '}
            <code className="bg-gray-100 px-2 py-1 rounded font-mono text-gray-900">
              {activeProvider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234'}
            </code>
          </p>

          <button
            onClick={handleTestConnection}
            disabled={isTesting || isCheckingConnection}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 transition flex items-center gap-2"
          >
            {isTesting || isCheckingConnection ? (
              <>
                <Spinner /> Testing Connection...
              </>
            ) : (
              '🔗 Test Connection'
            )}
          </button>

          {testResult === 'success' && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 text-sm font-semibold">
                ✅ Connection successful! Models loaded.
              </p>
            </div>
          )}

          {testResult === 'failed' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm font-semibold">
                ❌ Connection failed. Make sure Ollama is running.
              </p>
              <p className="text-red-600 text-xs mt-2">
                Install from: <a href="https://ollama.ai" className="underline">ollama.ai</a>
              </p>
            </div>
          )}
        </div>

        {/* Model Selection */}
        {availableModels.length > 0 && (
          <div className="border-t border-gray-200 pt-8">
            <h3 className="font-bold text-gray-900 mb-4">Select AI Model</h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose which Ollama model to use for idea generation and prompts
            </p>

            <div className="space-y-3">
              {availableModels.map((model) => (
                <label
                  key={model}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition"
                >
                  <input
                    type="radio"
                    name="model"
                    value={model}
                    checked={selectedModel === model}
                    onChange={() => handleModelSelect(model)}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">{model}</p>
                    <p className="text-xs text-gray-500">
                      {selectedModel === model && '✓ Currently active'}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-700 text-sm">
                💡 Tip: Larger models (13B+) produce better results but are slower.
                Start with a smaller model for faster iteration.
              </p>
            </div>
          </div>
        )}

        {!isActiveProviderConnected && (
          <div className="border-t border-gray-200 pt-8">
            <h3 className="font-bold text-gray-900 mb-3 text-red-600">
              ⚠️ {activeProvider === 'ollama' ? 'Ollama' : 'LM Studio'} Not Connected
            </h3>
            <div className="space-y-3 text-sm text-gray-700">
              <p>To use this app, you need to:</p>
              {activeProvider === 'ollama' ? (
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>
                    <strong>Install Ollama:</strong> Download from{' '}
                    <a href="https://ollama.ai" className="text-blue-600 hover:underline">
                      ollama.ai
                    </a>
                  </li>
                  <li>
                    <strong>Start Ollama:</strong> Run Ollama application
                  </li>
                  <li>
                    <strong>Pull a model:</strong> In Ollama terminal, run{' '}
                    <code className="bg-gray-100 px-2 py-1 rounded font-mono">
                      ollama pull mistral
                    </code>
                  </li>
                  <li>
                    <strong>Test connection:</strong> Click "Test Connection" above
                  </li>
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>
                    <strong>Install LM Studio:</strong> Download from{' '}
                    <a href="https://lmstudio.ai" className="text-blue-600 hover:underline">
                      lmstudio.ai
                    </a>
                  </li>
                  <li>
                    <strong>Download a model:</strong> Open LM Studio and download a model from the Discover tab
                  </li>
                  <li>
                    <strong>Start local server:</strong> Go to Local Server tab, load a model, and click "Start Server"
                  </li>
                  <li>
                    <strong>Test connection:</strong> Click "Test Connection" above
                  </li>
                </ol>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="font-bold text-gray-900 mb-3">
          {activeProvider === 'ollama' ? 'Recommended Ollama Models' : 'About LM Studio'}
        </h3>
        {activeProvider === 'ollama' ? (
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <strong>mistral:</strong> Fast, good quality (recommended for MVP)
            </p>
            <p>
              <strong>neural-chat:</strong> Optimized for conversations
            </p>
            <p>
              <strong>llama2:</strong> Well-known, good for general tasks
            </p>
            <p className="text-xs text-gray-500 mt-3">
              Pull any model with: <code className="bg-white px-1 py-0.5 rounded">ollama pull [model-name]</code>
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <strong>LM Studio</strong> provides a user-friendly interface for running local LLMs with an OpenAI-compatible API.
            </p>
            <p className="mt-3">
              <strong>Popular models:</strong>
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Mistral 7B - Fast and efficient</li>
              <li>Llama 2 - Good general performance</li>
              <li>Phi-2 - Compact but capable</li>
            </ul>
            <p className="text-xs text-gray-500 mt-3">
              Download models through LM Studio's Discover tab
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
