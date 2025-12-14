'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Plus, Image, Video, Quote, Edit, Trash2, Eye, EyeOff, 
  Star, Loader2, Upload, X, Save, Sparkles
} from 'lucide-react'

type Story = {
  id: string
  title: string
  story: string
  quote: string
  beneficiary_name: string
  beneficiary_title: string
  photo_url: string
  video_url: string
  tags: string[]
  metrics: Record<string, number>
  is_featured: boolean
  is_public: boolean
  published_at: string | null
  program: { id: string; title: string } | null
  created_at: string
}

export default function ImpactStoriesPage() {
  const [stories, setStories] = useState<Story[]>([])
  const [programs, setPrograms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStory, setEditingStory] = useState<Story | null>(null)
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [storiesRes, programsRes] = await Promise.all([
      supabase
        .from('impact_stories')
        .select('*, program:programs(id, title)')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('programs').select('id, title').eq('status', 'active'),
    ])

    setStories(storiesRes.data || [])
    setPrograms(programsRes.data || [])
    setLoading(false)
  }

  const togglePublish = async (story: Story) => {
    const newPublished = story.published_at ? null : new Date().toISOString()
    await supabase
      .from('impact_stories')
      .update({ 
        published_at: newPublished,
        is_public: !!newPublished,
      })
      .eq('id', story.id)
    fetchData()
  }

  const toggleFeatured = async (story: Story) => {
    await supabase
      .from('impact_stories')
      .update({ is_featured: !story.is_featured })
      .eq('id', story.id)
    fetchData()
  }

  const deleteStory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this story?')) return
    await supabase.from('impact_stories').delete().eq('id', id)
    fetchData()
  }

  const filteredStories = stories.filter(s => {
    if (filter === 'published') return s.published_at
    if (filter === 'draft') return !s.published_at
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Impact Stories</h1>
          <p className="text-gray-600 mt-1">
            Share compelling stories that showcase your organization's impact
          </p>
        </div>
        <button
          onClick={() => {
            setEditingStory(null)
            setShowModal(true)
          }}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Story
        </button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-3xl font-bold text-gray-900">{stories.length}</p>
          <p className="text-gray-600">Total Stories</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-3xl font-bold text-green-600">
            {stories.filter(s => s.published_at).length}
          </p>
          <p className="text-gray-600">Published</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-3xl font-bold text-yellow-600">
            {stories.filter(s => s.is_featured).length}
          </p>
          <p className="text-gray-600">Featured</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-3xl font-bold text-gray-400">
            {stories.filter(s => !s.published_at).length}
          </p>
          <p className="text-gray-600">Drafts</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'published', 'draft'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Stories Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredStories.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Quote className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No stories yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Create Your First Story
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStories.map(story => (
            <div key={story.id} className="bg-white rounded-xl border overflow-hidden group">
              {/* Image */}
              <div className="relative h-40 bg-gray-100">
                {story.photo_url ? (
                  <img 
                    src={story.photo_url} 
                    alt={story.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-12 h-12 text-gray-300" />
                  </div>
                )}
                
                {/* Status badges */}
                <div className="absolute top-2 left-2 flex gap-2">
                  {story.is_featured && (
                    <span className="px-2 py-1 bg-yellow-500 text-white text-xs rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3" /> Featured
                    </span>
                  )}
                  {story.video_url && (
                    <span className="px-2 py-1 bg-purple-500 text-white text-xs rounded-full flex items-center gap-1">
                      <Video className="w-3 h-3" /> Video
                    </span>
                  )}
                </div>
                
                {/* Publish status */}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    story.published_at 
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {story.published_at ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 line-clamp-1">{story.title}</h3>
                
                {story.quote && (
                  <p className="text-sm text-gray-600 italic mt-2 line-clamp-2">
                    "{story.quote}"
                  </p>
                )}
                
                {story.beneficiary_name && (
                  <p className="text-xs text-gray-500 mt-2">
                    — {story.beneficiary_name}
                  </p>
                )}

                {story.program && (
                  <span className="inline-block mt-3 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                    {story.program.title}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => togglePublish(story)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    title={story.published_at ? 'Unpublish' : 'Publish'}
                  >
                    {story.published_at ? (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-green-500" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleFeatured(story)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    title={story.is_featured ? 'Remove from featured' : 'Feature'}
                  >
                    <Star className={`w-4 h-4 ${
                      story.is_featured ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'
                    }`} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingStory(story)
                      setShowModal(true)
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => deleteStory(story.id)}
                    className="p-2 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <StoryModal
          story={editingStory}
          programs={programs}
          onClose={() => {
            setShowModal(false)
            setEditingStory(null)
          }}
          onSaved={() => {
            setShowModal(false)
            setEditingStory(null)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

function StoryModal({ 
  story, 
  programs,
  onClose, 
  onSaved 
}: { 
  story: Story | null
  programs: any[]
  onClose: () => void
  onSaved: () => void 
}) {
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [form, setForm] = useState({
    title: story?.title || '',
    story: story?.story || '',
    quote: story?.quote || '',
    beneficiary_name: story?.beneficiary_name || '',
    beneficiary_title: story?.beneficiary_title || '',
    photo_url: story?.photo_url || '',
    video_url: story?.video_url || '',
    program_id: story?.program?.id || '',
    tags: story?.tags?.join(', ') || '',
    metrics: JSON.stringify(story?.metrics || {}, null, 2),
  })
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    let metricsJson = {}
    try {
      metricsJson = JSON.parse(form.metrics || '{}')
    } catch {}

    const data = {
      title: form.title,
      story: form.story,
      quote: form.quote,
      beneficiary_name: form.beneficiary_name || null,
      beneficiary_title: form.beneficiary_title || null,
      photo_url: form.photo_url || null,
      video_url: form.video_url || null,
      program_id: form.program_id || null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      metrics: metricsJson,
    }

    if (story) {
      await supabase.from('impact_stories').update(data).eq('id', story.id)
    } else {
      await supabase.from('impact_stories').insert(data)
    }

    setSaving(false)
    onSaved()
  }

  const generateWithAI = async () => {
    if (!form.quote && !form.beneficiary_name) {
      alert('Please add at least a quote or beneficiary name for AI to work with')
      return
    }

    setGenerating(true)

    try {
      const res = await fetch('/api/stories/ai-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote: form.quote,
          beneficiary_name: form.beneficiary_name,
          program_id: form.program_id,
        }),
      })

      const data = await res.json()
      if (data.title) setForm(f => ({ ...f, title: data.title }))
      if (data.story) setForm(f => ({ ...f, story: data.story }))
    } catch (err) {
      console.error('AI generation failed:', err)
    }

    setGenerating(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">
            {story ? 'Edit Story' : 'Create Impact Story'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* AI Generate Button */}
          <button
            type="button"
            onClick={generateWithAI}
            disabled={generating}
            className="w-full py-3 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-100 flex items-center justify-center gap-2"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generating ? 'Generating...' : 'Generate Title & Story with AI'}
          </button>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="A compelling headline..."
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quote (Testimonial)
              </label>
              <textarea
                value={form.quote}
                onChange={e => setForm({ ...form, quote: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                rows={2}
                placeholder="A powerful quote from the beneficiary..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beneficiary Name
              </label>
              <input
                type="text"
                value={form.beneficiary_name}
                onChange={e => setForm({ ...form, beneficiary_name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="Name (or 'Community Member')"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beneficiary Title/Role
              </label>
              <input
                type="text"
                value={form.beneficiary_title}
                onChange={e => setForm({ ...form, beneficiary_title: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="e.g., Small Business Owner"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Story
              </label>
              <textarea
                value={form.story}
                onChange={e => setForm({ ...form, story: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                rows={6}
                placeholder="Tell the full story of impact..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photo URL
              </label>
              <input
                type="url"
                value={form.photo_url}
                onChange={e => setForm({ ...form, photo_url: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video URL (optional)
              </label>
              <input
                type="url"
                value={form.video_url}
                onChange={e => setForm({ ...form, video_url: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="YouTube or Vimeo URL"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Program
              </label>
              <select
                value={form.program_id}
                onChange={e => setForm({ ...form, program_id: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">Select a program...</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="education, recycling, community"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Metrics (JSON)
              </label>
              <textarea
                value={form.metrics}
                onChange={e => setForm({ ...form, metrics: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
                rows={3}
                placeholder='{"people_helped": 50, "tons_recycled": 10}'
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {story ? 'Save Changes' : 'Create Story'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
