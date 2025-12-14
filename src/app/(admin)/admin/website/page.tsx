'use client'

import * as React from 'react'
import { Globe, FileText, Layout, Plus, Edit, Eye, Trash2, GripVertical, CheckCircle, Clock } from 'lucide-react'

export default function WebsitePage() {
  const [activeTab, setActiveTab] = React.useState<'pages' | 'posts' | 'menus'>('pages')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Website Content</h1>
          <p className="text-gray-600 mt-1">Manage pages, blog posts, and navigation</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          {activeTab === 'pages' ? 'New Page' : activeTab === 'posts' ? 'New Post' : 'Add Menu Item'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-8">
          {[
            { id: 'pages', label: 'Pages', icon: Layout },
            { id: 'posts', label: 'Blog Posts', icon: FileText },
            { id: 'menus', label: 'Navigation', icon: Globe },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm ${
                activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'pages' && <PagesTab />}
      {activeTab === 'posts' && <PostsTab />}
      {activeTab === 'menus' && <MenusTab />}
    </div>
  )
}

function PagesTab() {
  const pages = [
    { id: '1', title: 'Home', slug: '/', status: 'published', modified: '2024-03-10' },
    { id: '2', title: 'About Us', slug: '/about', status: 'published', modified: '2024-03-08' },
    { id: '3', title: 'Membership Benefits', slug: '/membership', status: 'published', modified: '2024-03-05' },
    { id: '4', title: 'Contact', slug: '/contact', status: 'published', modified: '2024-03-01' },
    { id: '5', title: 'Conference 2024', slug: '/conference', status: 'draft', modified: '2024-03-12' },
  ]

  return (
    <div className="bg-white rounded-lg border">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Page</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modified</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {pages.map((page) => (
            <tr key={page.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 font-medium text-gray-900">{page.title}</td>
              <td className="px-6 py-4 text-sm text-gray-500 font-mono">{page.slug}</td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  page.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {page.status === 'published' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {page.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">{page.modified}</td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button className="p-2 hover:bg-gray-100 rounded"><Eye className="w-4 h-4 text-gray-400" /></button>
                  <button className="p-2 hover:bg-gray-100 rounded"><Edit className="w-4 h-4 text-gray-400" /></button>
                  <button className="p-2 hover:bg-gray-100 rounded"><Trash2 className="w-4 h-4 text-gray-400" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PostsTab() {
  const posts = [
    { id: '1', title: 'New EPA Guidelines Released', status: 'published', author: 'Admin', date: '2024-03-10', views: 245 },
    { id: '2', title: 'Conference 2024 Speakers Announced', status: 'published', author: 'Admin', date: '2024-03-08', views: 189 },
    { id: '3', title: 'Member Spotlight: Green Recycling Co', status: 'draft', author: 'Admin', date: '2024-03-12', views: 0 },
  ]

  return (
    <div className="bg-white rounded-lg border">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Post</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Views</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {posts.map((post) => (
            <tr key={post.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">{post.title}</div>
                <div className="text-sm text-gray-500">{post.date}</div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">{post.author}</td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  post.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {post.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">{post.views}</td>
              <td className="px-6 py-4 text-right">
                <button className="text-blue-600 text-sm">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MenusTab() {
  const menuItems = [
    { id: '1', label: 'Home', url: '/' },
    { id: '2', label: 'About', url: '/about' },
    { id: '3', label: 'Membership', url: '/membership' },
    { id: '4', label: 'Events', url: '/events' },
    { id: '5', label: 'Directory', url: '/directory' },
    { id: '6', label: 'Resources', url: '/resources' },
    { id: '7', label: 'Contact', url: '/contact' },
  ]

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Main Navigation</h3>
        </div>
        <div className="p-4 space-y-2">
          {menuItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
              <div className="flex-1">
                <div className="font-medium text-sm">{item.label}</div>
                <div className="text-xs text-gray-500">{item.url}</div>
              </div>
              <button className="p-1 hover:bg-gray-200 rounded"><Edit className="w-4 h-4 text-gray-400" /></button>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Footer Links</h3>
        </div>
        <div className="p-4 text-gray-500 text-sm">
          Drag and drop menu items to reorder them.
        </div>
      </div>
    </div>
  )
}
