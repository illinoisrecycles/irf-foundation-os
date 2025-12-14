'use client'

import * as React from 'react'
import { Share2, Plus, Calendar, Send, Clock, CheckCircle, Facebook, Twitter, Linkedin, Instagram, Image, Link } from 'lucide-react'

export default function SocialPage() {
  const [activeTab, setActiveTab] = React.useState<'posts' | 'accounts' | 'schedule'>('posts')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Media</h1>
          <p className="text-gray-600 mt-1">Manage and schedule social posts</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Create Post
        </button>
      </div>

      {/* Connected Accounts */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { platform: 'Facebook', icon: Facebook, connected: true, color: 'blue' },
          { platform: 'Twitter', icon: Twitter, connected: true, color: 'sky' },
          { platform: 'LinkedIn', icon: Linkedin, connected: true, color: 'blue' },
          { platform: 'Instagram', icon: Instagram, connected: false, color: 'pink' },
        ].map((account) => (
          <div key={account.platform} className="bg-white p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 bg-${account.color}-100 rounded-lg`}>
                  <account.icon className={`w-5 h-5 text-${account.color}-600`} />
                </div>
                <div>
                  <div className="font-medium">{account.platform}</div>
                  <div className="text-xs text-gray-500">{account.connected ? 'Connected' : 'Not connected'}</div>
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${account.connected ? 'bg-green-500' : 'bg-gray-300'}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-8">
          {[
            { id: 'posts', label: 'Posts', icon: Share2 },
            { id: 'schedule', label: 'Schedule', icon: Calendar },
            { id: 'accounts', label: 'Accounts', icon: Link },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm ${
                activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Posts List */}
      {activeTab === 'posts' && (
        <div className="bg-white rounded-lg border">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Post</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platforms</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {([
                { id: '1', content: 'Excited to announce our 2024 conference dates!', platforms: ['facebook', 'twitter', 'linkedin'] as string[], status: 'published', date: '2024-03-10' },
                { id: '2', content: 'New member spotlight coming tomorrow...', platforms: ['facebook', 'linkedin'] as string[], status: 'scheduled', date: '2024-03-15' },
                { id: '3', content: 'Draft post about recycling tips', platforms: [] as string[], status: 'draft', date: null },
              ]).map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="max-w-md truncate text-gray-900">{post.content}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {post.platforms.includes('facebook') && <Facebook className="w-4 h-4 text-blue-600" />}
                      {post.platforms.includes('twitter') && <Twitter className="w-4 h-4 text-sky-500" />}
                      {post.platforms.includes('linkedin') && <Linkedin className="w-4 h-4 text-blue-700" />}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      post.status === 'published' ? 'bg-green-100 text-green-800' :
                      post.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {post.status === 'published' && <CheckCircle className="w-3 h-3" />}
                      {post.status === 'scheduled' && <Clock className="w-3 h-3" />}
                      {post.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{post.date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
