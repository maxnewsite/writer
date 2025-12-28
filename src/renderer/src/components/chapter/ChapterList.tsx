import type { ChapterData } from '../../store/chapterStore'

interface Props {
  chapters: ChapterData[]
  currentChapterId?: number
  onSelectChapter: (chapterId: number) => Promise<void>
}

export default function ChapterList({ chapters, currentChapterId, onSelectChapter }: Props): JSX.Element {
  return (
    <div className="space-y-1 p-2">
      {chapters.length === 0 ? (
        <div className="p-4 text-center text-gray-500 text-sm">
          No chapters yet. Create one to start.
        </div>
      ) : (
        chapters.map((chapter) => (
          <button
            key={chapter.id}
            onClick={() => onSelectChapter(chapter.id)}
            className={`w-full text-left px-4 py-3 rounded-lg transition ${
              currentChapterId === chapter.id
                ? 'bg-blue-100 border-l-4 border-blue-500 text-blue-900'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Ch. {chapter.chapter_number}</span>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  chapter.status === 'published'
                    ? 'bg-green-100 text-green-700'
                    : chapter.status === 'archived'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {chapter.status}
              </span>
            </div>
            <p className="text-sm mt-1 truncate">{chapter.title}</p>
          </button>
        ))
      )}
    </div>
  )
}
