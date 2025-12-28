import { Outlet } from 'react-router-dom'
import Header from './Header'

export default function AppLayout(): JSX.Element {
  return (
    <div className="flex flex-col w-full h-screen bg-gray-50">
      <Header />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
