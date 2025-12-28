import { Link } from 'react-router-dom'

export default function Header(): JSX.Element {
  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <div className="px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold text-gray-900">
          📚 Book Writer
        </Link>
        <div className="flex gap-4">
          <Link
            to="/settings"
            className="text-gray-600 hover:text-gray-900 transition font-semibold"
          >
            ⚙️ Settings
          </Link>
        </div>
      </div>
    </header>
  )
}
