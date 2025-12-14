'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Users, Recycle, Calendar, Clock, Heart, Share2, 
  ChevronRight, Play, Quote, TrendingUp
} from 'lucide-react'
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import Link from 'next/link'

type ImpactMetrics = {
  peopleServed: number
  tonsRecycled: number
  volunteerHours: number
  eventsHeld: number
  communitiesReached: number
  programsActive: number
}

type ImpactStory = {
  id: string
  title: string
  story: string
  quote: string
  beneficiary_name: string
  beneficiary_title: string
  photo_url: string
  video_url: string
  program: { title: string }
  metrics: Record<string, number>
  tags: string[]
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']

export default function PublicImpactPage() {
  const [metrics, setMetrics] = useState<ImpactMetrics | null>(null)
  const [stories, setStories] = useState<ImpactStory[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [programBreakdown, setProgramBreakdown] = useState<any[]>([])
  const [selectedStory, setSelectedStory] = useState<ImpactStory | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchImpactData()
  }, [])

  const fetchImpactData = async () => {
    // Fetch aggregate metrics
    const [beneficiaries, outcomes, volunteer, events, programs] = await Promise.all([
      supabase.from('beneficiaries').select('id', { count: 'exact' }),
      supabase.from('outcome_data').select('value, indicator:outcome_indicators(name)'),
      supabase.from('volunteer_hours').select('hours').eq('status', 'approved'),
      supabase.from('events').select('id', { count: 'exact' }).lt('date_start', new Date().toISOString()),
      supabase.from('programs').select('id, title').eq('status', 'active'),
    ])

    // Calculate metrics
    const tonsRecycled = outcomes.data
      ?.filter((o: any) => o.indicator?.name?.toLowerCase().includes('recycl'))
      .reduce((sum, o) => sum + (o.value || 0), 0) || 0

    setMetrics({
      peopleServed: beneficiaries.count || 0,
      tonsRecycled: Math.round(tonsRecycled),
      volunteerHours: volunteer.data?.reduce((sum, v) => sum + (v.hours || 0), 0) || 0,
      eventsHeld: events.count || 0,
      communitiesReached: 47, // Could calculate from beneficiary locations
      programsActive: programs.data?.length || 0,
    })

    // Fetch impact stories
    const { data: storiesData } = await supabase
      .from('impact_stories')
      .select('*, program:programs(title)')
      .eq('is_public', true)
      .not('published_at', 'is', null)
      .order('is_featured', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(6)

    setStories(storiesData || [])

    // Generate trend data (mock - would come from time-series aggregation)
    setTrendData([
      { month: 'Jan', served: 820, recycled: 210 },
      { month: 'Feb', served: 950, recycled: 245 },
      { month: 'Mar', served: 1100, recycled: 280 },
      { month: 'Apr', served: 980, recycled: 310 },
      { month: 'May', served: 1250, recycled: 340 },
      { month: 'Jun', served: 1400, recycled: 380 },
      { month: 'Jul', served: 1350, recycled: 420 },
      { month: 'Aug', served: 1500, recycled: 450 },
      { month: 'Sep', served: 1280, recycled: 390 },
      { month: 'Oct', served: 1450, recycled: 410 },
      { month: 'Nov', served: 1600, recycled: 480 },
      { month: 'Dec', served: 1320, recycled: 285 },
    ])

    // Program breakdown
    setProgramBreakdown([
      { name: 'Recycling Education', value: 35, color: COLORS[0] },
      { name: 'Community Cleanups', value: 25, color: COLORS[1] },
      { name: 'Policy Advocacy', value: 20, color: COLORS[2] },
      { name: 'Business Outreach', value: 12, color: COLORS[3] },
      { name: 'Research', value: 8, color: COLORS[4] },
    ])
  }

  const shareStory = async (story: ImpactStory) => {
    const url = `${window.location.origin}/impact/stories/${story.id}`
    if (navigator.share) {
      await navigator.share({
        title: story.title,
        text: story.quote,
        url,
      })
    } else {
      navigator.clipboard.writeText(url)
      alert('Link copied to clipboard!')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-600 to-emerald-700" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-6xl mx-auto text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            Our Impact in 2025
          </h1>
          <p className="text-xl md:text-2xl opacity-90 max-w-3xl mx-auto">
            Together, we're building a more sustainable future through education, 
            community action, and policy advocacy
          </p>
        </div>
      </section>

      {/* Live Metrics Counter */}
      {metrics && (
        <section className="relative -mt-16 px-4 z-10">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
              <MetricCard
                icon={Users}
                value={metrics.peopleServed}
                label="People Educated"
                color="green"
              />
              <MetricCard
                icon={Recycle}
                value={metrics.tonsRecycled}
                label="Tons Recycled"
                color="blue"
                suffix=" tons"
              />
              <MetricCard
                icon={Clock}
                value={metrics.volunteerHours}
                label="Volunteer Hours"
                color="purple"
              />
              <MetricCard
                icon={Calendar}
                value={metrics.eventsHeld}
                label="Events Held"
                color="orange"
              />
              <MetricCard
                icon={Heart}
                value={metrics.communitiesReached}
                label="Communities"
                color="pink"
              />
              <MetricCard
                icon={TrendingUp}
                value={metrics.programsActive}
                label="Active Programs"
                color="teal"
              />
            </div>
          </div>
        </section>
      )}

      {/* Interactive Charts */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-12">
            Impact Over Time
          </h2>
          
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Trend Line Chart */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-xl font-semibold mb-6">Monthly Progress</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="served" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', r: 4 }}
                    name="People Served"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="recycled" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    name="Tons Recycled"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Program Breakdown Pie */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-xl font-semibold mb-6">Impact by Program</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={programBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {programBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Stories */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900">Stories of Change</h2>
            <p className="text-xl text-gray-600 mt-4">
              Real people, real impact. See how our work transforms communities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {stories.map(story => (
              <StoryCard 
                key={story.id} 
                story={story} 
                onShare={() => shareStory(story)}
                onExpand={() => setSelectedStory(story)}
              />
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/impact/stories"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white border-2 border-green-600 text-green-600 rounded-full font-semibold hover:bg-green-50 transition-colors"
            >
              View All Stories
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-3xl p-12 text-center text-white">
            <h2 className="text-4xl font-bold mb-4">Be Part of Our Impact</h2>
            <p className="text-xl opacity-90 mb-8">
              Your support helps us reach more communities and create lasting change
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/donate"
                className="px-8 py-4 bg-white text-green-600 rounded-full font-bold text-lg hover:bg-gray-100 transition-colors"
              >
                Donate Now
              </Link>
              <Link
                href="/volunteer"
                className="px-8 py-4 bg-green-700 text-white rounded-full font-bold text-lg hover:bg-green-800 transition-colors"
              >
                Volunteer With Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Embed Widget Promo */}
      <section className="py-12 px-4 bg-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-600">
            Want to show our impact on your website?{' '}
            <Link href="/embed" className="text-green-600 hover:underline font-medium">
              Get an embeddable widget →
            </Link>
          </p>
        </div>
      </section>

      {/* Story Modal */}
      {selectedStory && (
        <StoryModal 
          story={selectedStory} 
          onClose={() => setSelectedStory(null)}
          onShare={() => shareStory(selectedStory)}
        />
      )}
    </div>
  )
}

function MetricCard({ 
  icon: Icon, 
  value, 
  label, 
  color,
  suffix = ''
}: { 
  icon: any
  value: number
  label: string
  color: string
  suffix?: string
}) {
  const colorClasses: Record<string, string> = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    pink: 'bg-pink-50 text-pink-600',
    teal: 'bg-teal-50 text-teal-600',
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 text-center hover:shadow-xl transition-shadow">
      <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${colorClasses[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className={`text-3xl font-bold mt-4 ${colorClasses[color].split(' ')[1]}`}>
        {value.toLocaleString()}{suffix}
      </p>
      <p className="text-gray-600 mt-1 text-sm">{label}</p>
    </div>
  )
}

function StoryCard({ 
  story, 
  onShare,
  onExpand,
}: { 
  story: ImpactStory
  onShare: () => void
  onExpand: () => void
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all group">
      {story.photo_url ? (
        <div className="relative h-48 overflow-hidden">
          <img 
            src={story.photo_url} 
            alt={story.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {story.video_url && (
            <button className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                <Play className="w-8 h-8 text-green-600 ml-1" />
              </div>
            </button>
          )}
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center">
          <Quote className="w-16 h-16 text-green-300" />
        </div>
      )}
      
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            {story.program?.title || 'Community'}
          </span>
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 mb-3">{story.title}</h3>
        
        {story.quote && (
          <blockquote className="text-gray-600 italic mb-4 line-clamp-3">
            "{story.quote}"
          </blockquote>
        )}
        
        {story.beneficiary_name && (
          <p className="text-sm text-gray-500">
            — {story.beneficiary_name}
            {story.beneficiary_title && `, ${story.beneficiary_title}`}
          </p>
        )}

        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <button
            onClick={onExpand}
            className="text-green-600 hover:text-green-700 font-medium text-sm flex items-center gap-1"
          >
            Read More
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={onShare}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Share this story"
          >
            <Share2 className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

function StoryModal({ 
  story, 
  onClose,
  onShare,
}: { 
  story: ImpactStory
  onClose: () => void
  onShare: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {story.photo_url && (
          <img 
            src={story.photo_url} 
            alt={story.title}
            className="w-full h-64 object-cover"
          />
        )}
        
        <div className="p-8">
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            {story.program?.title}
          </span>
          
          <h2 className="text-3xl font-bold text-gray-900 mt-4 mb-6">{story.title}</h2>
          
          {story.quote && (
            <blockquote className="text-xl text-gray-700 italic border-l-4 border-green-500 pl-6 mb-6">
              "{story.quote}"
            </blockquote>
          )}
          
          <div className="prose prose-lg max-w-none">
            <p>{story.story}</p>
          </div>
          
          {story.beneficiary_name && (
            <p className="mt-6 text-gray-600">
              — <strong>{story.beneficiary_name}</strong>
              {story.beneficiary_title && `, ${story.beneficiary_title}`}
            </p>
          )}

          {story.metrics && Object.keys(story.metrics).length > 0 && (
            <div className="mt-8 p-6 bg-green-50 rounded-xl">
              <h4 className="font-semibold text-green-900 mb-4">Impact Metrics</h4>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(story.metrics).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-2xl font-bold text-green-600">{value.toLocaleString()}</p>
                    <p className="text-sm text-gray-600 capitalize">{key.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4 mt-8">
            <button
              onClick={onShare}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" />
              Share This Story
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
