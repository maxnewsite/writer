import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-red-50">
            <div className="max-w-md p-8 bg-white rounded-lg shadow-lg border-2 border-red-200">
              <h1 className="text-2xl font-bold text-red-600 mb-4">
                ⚠️ Something went wrong
              </h1>
              <p className="text-gray-600 mb-4">
                An unexpected error occurred. Please try refreshing the page or restarting the application.
              </p>
              <details className="mb-6 p-3 bg-gray-50 rounded border border-gray-200">
                <summary className="cursor-pointer font-semibold text-gray-700 text-sm">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-40">
                  {this.state.error?.message}
                  {'\n\n'}
                  {this.state.error?.stack}
                </pre>
              </details>
              <button
                onClick={this.handleReset}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition"
              >
                Try Again
              </button>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
