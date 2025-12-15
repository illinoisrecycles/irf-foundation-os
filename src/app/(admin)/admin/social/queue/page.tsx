'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Sparkles, Linkedin, Twitter, Facebook, Instagram,
  Edit2, Check, X, Calendar, Trash2, Eye, RefreshCw, Loader2
} from 'lucide-react'

type SocialPost = {
  id: string
  content_type: string
  platform: string
  headline: string
  body: string
  hashtags: string[]
  ai_generated: boolean
  status: string
  scheduled_for: string | null
  posted_at: string | null
  created_at: string
  source_type: string
  source_id: string
}

const PLATFORM_ICONS: Record<string, any> = {
  linkedin: Linkedin,
  twitter: Twitter,
  facebook: Facebook,
  instagram: Instagram,
}

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: 'bg-blue-100 text-blue-700',
  twitter: 'bg-sky-100 text-sky-700',
  facebook: 'bg-indigo-100 text-indigo-700',
  instagram: 'bg-pink-100 text-pink-700',
}

export default function SocialQueuePage() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null)
  const [generating, setGenerating] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchPosts()
  }, [filter])

  const fetchPosts = async () => {
    let query = supabase
      .from('social_queue')
      .select('*')
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data, error } = await query.limit(50)
    if (!error) {
      setPosts(data || [])
    }
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase
      .from('social_queue')
      .update({ 
        status, 
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
    fetchPosts()
  }

  const schedulePost = async (id: string, date: string) => {
    await supabase
      .from('social_queue')
      .update({ 
        status: 'scheduled',
        scheduled_for: date,
      })
      .eq('id', id)
    fetchPosts()
  }

  const deletePost = async (id: string) => {
    if (!confirm('Delete this post?')) return
    await supabase.from('social_queue').delete().eq('id', id)
    fetchPosts()
  }

  const generateNewSpotlight = async () => {
    setGenerating(true)
    try {
      await fetch('/api/cron/social-spotlight', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'manual'}` }
      })
      await fetchPosts()
    } catch (err) {
      console.error('Generation failed:', err)
    }
    setGenerating(false)
  }

  const statusCounts = posts.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Social Autopilot</h1>
          <p className="text-gray-600 mt-1">AI-generated social content for review and scheduling</p>
        </div>
        <button
          onClick={generateNewSpotlight}
          disabled={generating}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Generate Member Spotlight
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { key: 'all', label: 'All', count: posts.length },
          { key: 'draft', label: 'Drafts', count: statusCounts.draft || 0 },
          { key: 'approved', label: 'Approved', count: statusCounts.approved || 0 },
          { key: 'scheduled', label: 'Scheduled', count: statusCounts.scheduled || 0 },
          { key: 'posted', label: 'Posted', count: statusCounts.posted || 0 },
        ].map(stat => (
          <button
            key={stat.key}
            onClick={() => setFilter(stat.key)}
            className={`p-4 rounded-xl border transition-colors ${
              filter === stat.key 
                ? 'bg-primary text-white border-primary' 
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <p className="text-2xl font-bold">{stat.count}</p>
            <p className={`text-sm ${filter === stat.key ? 'text-white/80' : 'text-gray-600'}`}>
              {stat.label}
            </p>
          </button>
        ))}
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No posts in queue</p>
          <button
            onClick={generateNewSpotlight}
            disabled={generating}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Generate First Spotlight
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {posts.map(post => {
            const PlatformIcon = PLATFORM_ICONS[post.platform] || Sparkles
            
            return (
              <div key={post.id} className="bg-white rounded-xl border overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${PLATFORM_COLORS[post.platform]}`}>
                      <PlatformIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{post.platform}</p>
                      <p className="text-sm text-gray-500">{post.content_type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {post.ai_generated && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> AI
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      post.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                      post.status === 'approved' ? 'bg-green-100 text-green-700' :
                      post.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                      post.status === 'posted' ? 'bg-purple-100 text-purple-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {post.status}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  {post.headline && (
                    <p className="font-semibold text-gray-900 mb-2">{post.headline}</p>
                  )}
                  <p className="text-gray-700 whitespace-pre-wrap">{post.body}</p>
                  {post.hashtags?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {post.hashtags.map((tag, i) => (
                        <span key={i} className="text-sm text-primary">#{tag}</span>
                      ))}
                    </div>
                  )}
                  {post.scheduled_for && (
                    <p className="text-sm text-gray-500 mt-3">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Scheduled for {new Date(post.scheduled_for).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {post.status === 'draft' && (
                  <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(post.id, 'approved')}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-1"
                      >
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => setEditingPost(post)}
                        className="px-3 py-1.5 border rounded-lg text-sm font-medium hover:bg-gray-100 flex items-center gap-1"
                      >
                        <Edit2 className="w-4 h-4" /> Edit
                      </button>
                    </div>
                    <button
                      onClick={() => deletePost(post.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {post.status === 'approved' && (
                  <div className="p-4 border-t bg-gray-50">
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                        onChange={e => schedulePost(post.id, e.target.value)}
                      />
                      <button
                        onClick={() => schedulePost(post.id, new Date().toISOString())}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                      >
                        Post Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={() => {
            setEditingPost(null)
            fetchPosts()
          }}
        />
      )}
    </div>
  )
}

function EditPostModal({ 
  post, 
  onClose, 
  onSaved 
}: { 
  post: SocialPost
  onClose: () => void
  onSaved: () => void 
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    headline: post.headline || '',
    body: post.body || '',
    hashtags: post.hashtags?.join(', ') || '',
  })
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    await supabase.from('social_queue').update({
      headline: form.headline || null,
      body: form.body,
      hashtags: form.hashtags.split(',').map(t => t.trim()).filter(Boolean),
    }).eq('id', post.id)

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">Edit Post</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {post.platform === 'linkedin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Headline
              </label>
              <input
                type="text"
                value={form.headline}
                onChange={e => setForm({ ...form, headline: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content
            </label>
            <textarea
              value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })}
              rows={6}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
            {post.platform === 'twitter' && (
              <p className={`text-sm mt-1 ${form.body.length > 280 ? 'text-red-600' : 'text-gray-500'}`}>
                {form.body.length}/280 characters
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hashtags (comma-separated)
            </label>
            <input
              type="text"
              value={form.hashtags}
              onChange={e => setForm({ ...form, hashtags: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="MemberSpotlight, Community"
            />
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
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
