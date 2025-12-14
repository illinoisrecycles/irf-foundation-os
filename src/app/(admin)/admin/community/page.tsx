'use client'

import * as React from 'react'
import { MessageSquare, Plus, Users, MessageCircle, Eye, Settings, TrendingUp, Clock } from 'lucide-react'

export default function CommunityPage() {
  const forums = [
    { id: '1', name: 'General Discussion', description: 'General topics and announcements', topics: 45, posts: 312, lastPost: '2 hours ago' },
    { id: '2', name: 'Best Practices', description: 'Share and learn recycling best practices', topics: 28, posts: 156, lastPost: '5 hours ago' },
    { id: '3', name: 'Legislation & Policy', description: 'Discuss regulatory changes and policy', topics: 15, posts: 89, lastPost: '1 day ago' },
    { id: '4', name: 'Equipment & Technology', description: 'Equipment reviews and tech discussions', topics: 22, posts: 134, lastPost: '3 hours ago' },
  ]

  const recentTopics = [
    { id: '1', title: 'New EPA guidelines for contamination rates', forum: 'Legislation & Policy', author: 'John Smith', replies: 12, views: 156 },
    { id: '2', title: 'Best sorting equipment for small MRFs?', forum: 'Equipment & Technology', author: 'Jane Doe', replies: 8, views: 89 },
    { id: '3', title: 'Welcome new members - March 2024', forum: 'General Discussion', author: 'Admin', replies: 24, views: 342 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Community Forums</h1>
          <p className="text-gray-600 mt-1">Manage discussion forums for members</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            New Forum
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Topics</p>
              <p className="text-2xl font-bold">{forums.reduce((sum, f) => sum + f.topics, 0)}</p>
            </div>
            <MessageSquare className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Posts</p>
              <p className="text-2xl font-bold">{forums.reduce((sum, f) => sum + f.posts, 0)}</p>
            </div>
            <MessageCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-2xl font-bold">156</p>
            </div>
            <Users className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Posts Today</p>
              <p className="text-2xl font-bold">23</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Forums List */}
        <div className="col-span-2 bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Forums</h2>
          </div>
          <div className="divide-y">
            {forums.map((forum) => (
              <div key={forum.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{forum.name}</h3>
                    <p className="text-sm text-gray-500">{forum.description}</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-gray-900">{forum.topics} topics · {forum.posts} posts</div>
                  <div className="text-gray-500">Last post: {forum.lastPost}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Topics */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Recent Topics</h2>
          </div>
          <div className="divide-y">
            {recentTopics.map((topic) => (
              <div key={topic.id} className="p-4">
                <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{topic.title}</h4>
                <p className="text-xs text-gray-500 mt-1">in {topic.forum} by {topic.author}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{topic.replies}</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{topic.views}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
