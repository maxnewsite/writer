import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './views/Dashboard'
import BookSetup from './views/BookSetup'
import ChapterWork from './views/ChapterWork'
import Settings from './views/Settings'
import { useAppStore } from './store/appStore'

export default function App(): JSX.Element {
  const { initializeApp } = useAppStore()

  useEffect(() => {
    initializeApp().catch(console.error)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/books/new" element={<BookSetup />} />
          <Route path="/books/:bookId" element={<ChapterWork />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
