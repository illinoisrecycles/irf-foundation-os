'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { 
  Sparkles, Heart, Users, Zap, Settings, CheckCircle,
  ArrowLeft, Play, Clock, Search, Filter
} from 'lucide-react'

type Recipe = {
  id: string
  name: string
  description: string
  category: 'retention' | 'fundraising' | 'engagement' | 'operations' | 'onboarding'
  icon: string
  tags: string[]
}

const CATEGORY_INFO = {
  retention: { label: 'Retention', icon: Users, color: 'blue' },
  fundraising: { label: 'Fundraising', icon: Heart, color: 'pink' },
  engagement: { label: 'Engagement', icon: Zap, color: 'yellow' },
  operations: { label: 'Operations', icon: Settings, color: 'gray' },
  onboarding: { label: 'Onboarding', icon: Sparkles, color: 'green' },
}

export default function AutomationRecipesPage() {
  const router = useRouter()
  const [recipes, setRecipes] = React.useState<Recipe[]>([])
  const [installing, setInstalling] = React.useState<string | null>(null)
  const [installed, setInstalled] = React.useState<Set<string>>(new Set())
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')

  React.useEffect(() => {
    // Fetch recipes from API
    fetch('/api/automation/recipes')
      .then(res => res.json())
      .then(data => setRecipes(data))
  }, [])

  const handleInstall = async (recipeId: string) => {
    setInstalling(recipeId)
    try {
      const response = await fetch('/api/automation/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: recipeId, organization_id: 'demo-org' }),
      })
      
      if (response.ok) {
        setInstalled(prev => new Set([...prev, recipeId]))
      }
    } finally {
      setInstalling(null)
    }
  }

  const filteredRecipes = recipes.filter(r => {
    if (selectedCategory && r.category !== selectedCategory) return false
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const categories = Object.entries(CATEGORY_INFO)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/admin/automation')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Automation Recipes</h1>
          <p className="text-gray-600">Pre-built automations ready to use in one click</p>
        </div>
      </div>

      {/* Featured Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Sparkles className="w-10 h-10" />
          <div>
            <h2 className="text-2xl font-bold">Save 10+ Hours/Week</h2>
            <p className="text-indigo-200">These recipes replace $10k+ Salesforce consultant setups</p>
          </div>
        </div>
        <button
          onClick={() => {/* Install all */}}
          className="px-6 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50"
        >
          Install All High-Impact Recipes
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              !selectedCategory ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {categories.map(([key, info]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                selectedCategory === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <info.icon className="w-4 h-4" />
              {info.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes.map(recipe => {
          const category = CATEGORY_INFO[recipe.category]
          const isInstalled = installed.has(recipe.id)
          const isInstalling = installing === recipe.id

          return (
            <div key={recipe.id} className="bg-white rounded-xl border hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl">{recipe.icon}</div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${category.color}-100 text-${category.color}-700`}>
                    {category.label}
                  </span>
                </div>
                <h3 className="font-semibold text-lg text-gray-900 mb-2">{recipe.name}</h3>
                <p className="text-gray-500 text-sm mb-4">{recipe.description}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {recipe.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 rounded-b-xl border-t">
                {isInstalled ? (
                  <button disabled className="w-full py-2 bg-green-100 text-green-700 rounded-lg font-medium flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Installed
                  </button>
                ) : (
                  <button
                    onClick={() => handleInstall(recipe.id)}
                    disabled={isInstalling}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isInstalling ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        Installing...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Install
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
