import { useState } from 'react'
import { Search } from 'lucide-react'
import type { GrammarPoint } from '../content/contentTypes'
import { GrammarLesson } from './GrammarLesson'

interface GrammarListProps {
  grammar: GrammarPoint[]
}

export function GrammarList({ grammar }: GrammarListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGrammar, setSelectedGrammar] = useState<GrammarPoint | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categories = Array.from(new Set(grammar.map(g => g.category).filter(Boolean)))

  const filtered = grammar.filter(g => {
    const matchesSearch =
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.meaning.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || g.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search grammar (title, pattern, meaning)..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === null ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length > 0 ? (
          filtered.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGrammar(g)}
              className="w-full text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-600">{g.title}</h3>
                  <p className="text-sm text-gray-600 font-mono">{g.pattern}</p>
                  <p className="text-sm text-gray-500 mt-1">{g.meaning}</p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded mt-1 flex-shrink-0">
                  {g.category}
                </span>
              </div>
            </button>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">No grammar points found</div>
        )}
      </div>

      {selectedGrammar && <GrammarLesson grammar={selectedGrammar} onBack={() => setSelectedGrammar(null)} />}
    </div>
  )
}
