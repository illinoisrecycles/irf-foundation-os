'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Send, Save, Eye, Clock, Users, Image, Link as LinkIcon,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List,
  Type, Palette, Layout, Smartphone, Monitor, Undo, Redo, Code,
  Plus, Trash2, GripVertical, ChevronDown, Settings, Sparkles
} from 'lucide-react'

type Block = {
  id: string
  type: 'header' | 'text' | 'image' | 'button' | 'divider' | 'columns' | 'spacer'
  content: any
}

export default function EmailComposePage() {
  const [subject, setSubject] = React.useState('')
  const [previewMode, setPreviewMode] = React.useState<'desktop' | 'mobile'>('desktop')
  const [showPreview, setShowPreview] = React.useState(false)
  const [selectedBlock, setSelectedBlock] = React.useState<string | null>(null)
  
  const [blocks, setBlocks] = React.useState<Block[]>([
    { id: '1', type: 'header', content: { text: 'Your Newsletter Title', level: 1 } },
    { id: '2', type: 'text', content: { text: 'Welcome to our newsletter! We have exciting updates to share with you this month.' } },
    { id: '3', type: 'image', content: { url: '', alt: 'Featured image' } },
    { id: '4', type: 'text', content: { text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' } },
    { id: '5', type: 'button', content: { text: 'Learn More', url: '#', align: 'center' } },
  ])

  const blockTypes = [
    { type: 'header', label: 'Heading', icon: Type },
    { type: 'text', label: 'Text', icon: AlignLeft },
    { type: 'image', label: 'Image', icon: Image },
    { type: 'button', label: 'Button', icon: Layout },
    { type: 'divider', label: 'Divider', icon: Layout },
    { type: 'spacer', label: 'Spacer', icon: Layout },
  ]

  const addBlock = (type: string) => {
    const newBlock: Block = {
      id: Date.now().toString(),
      type: type as Block['type'],
      content: type === 'header' ? { text: 'New Heading', level: 2 } :
               type === 'text' ? { text: 'Enter your text here...' } :
               type === 'image' ? { url: '', alt: '' } :
               type === 'button' ? { text: 'Click Here', url: '#', align: 'center' } :
               {}
    }
    setBlocks([...blocks, newBlock])
  }

  const updateBlock = (id: string, content: any) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, content: { ...b.content, ...content } } : b))
  }

  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id))
  }

  const renderBlock = (block: Block, isPreview = false) => {
    const isSelected = selectedBlock === block.id && !isPreview

    switch (block.type) {
      case 'header':
        const HeadingTag = `h${block.content.level}` as keyof JSX.IntrinsicElements
        return (
          <div className={`p-4 ${isSelected ? 'ring-2 ring-blue-500 rounded-lg' : ''}`} onClick={() => !isPreview && setSelectedBlock(block.id)}>
            {isPreview ? (
              <HeadingTag className={`font-bold ${block.content.level === 1 ? 'text-3xl' : block.content.level === 2 ? 'text-2xl' : 'text-xl'}`}>
                {block.content.text}
              </HeadingTag>
            ) : (
              <input
                type="text"
                value={block.content.text}
                onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                className={`w-full bg-transparent font-bold focus:outline-none ${block.content.level === 1 ? 'text-3xl' : block.content.level === 2 ? 'text-2xl' : 'text-xl'}`}
              />
            )}
          </div>
        )
      
      case 'text':
        return (
          <div className={`p-4 ${isSelected ? 'ring-2 ring-blue-500 rounded-lg' : ''}`} onClick={() => !isPreview && setSelectedBlock(block.id)}>
            {isPreview ? (
              <p className="text-gray-700">{block.content.text}</p>
            ) : (
              <textarea
                value={block.content.text}
                onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                className="w-full bg-transparent focus:outline-none resize-none text-gray-700"
                rows={3}
              />
            )}
          </div>
        )
      
      case 'image':
        return (
          <div className={`p-4 ${isSelected ? 'ring-2 ring-blue-500 rounded-lg' : ''}`} onClick={() => !isPreview && setSelectedBlock(block.id)}>
            {block.content.url ? (
              <img src={block.content.url} alt={block.content.alt} className="max-w-full rounded-lg" />
            ) : (
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <Image className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Click to add an image</p>
              </div>
            )}
          </div>
        )
      
      case 'button':
        return (
          <div className={`p-4 ${isSelected ? 'ring-2 ring-blue-500 rounded-lg' : ''} text-${block.content.align || 'center'}`} onClick={() => !isPreview && setSelectedBlock(block.id)}>
            <a
              href={isPreview ? block.content.url : '#'}
              className="inline-block px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
            >
              {block.content.text}
            </a>
          </div>
        )
      
      case 'divider':
        return (
          <div className={`p-4 ${isSelected ? 'ring-2 ring-blue-500 rounded-lg' : ''}`} onClick={() => !isPreview && setSelectedBlock(block.id)}>
            <hr className="border-gray-200" />
          </div>
        )
      
      case 'spacer':
        return (
          <div className={`p-2 ${isSelected ? 'ring-2 ring-blue-500 rounded-lg' : ''}`} onClick={() => !isPreview && setSelectedBlock(block.id)}>
            <div className="h-8" />
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 -m-8">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/email" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line..."
                className="text-lg font-semibold bg-transparent focus:outline-none w-96"
              />
              <div className="text-sm text-gray-500">Draft · Not sent</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
              <Sparkles className="w-4 h-4" /> AI Assist
            </button>
            <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
              <Eye className="w-4 h-4" /> Preview
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
              <Clock className="w-4 h-4" /> Schedule
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg">
              <Save className="w-4 h-4" /> Save
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700">
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 px-4 flex gap-6">
        {/* Sidebar - Block Types */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border p-4 sticky top-20">
            <h3 className="font-semibold text-gray-900 mb-4">Add Block</h3>
            <div className="grid grid-cols-2 gap-2">
              {blockTypes.map((bt) => (
                <button
                  key={bt.type}
                  onClick={() => addBlock(bt.type)}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:border-green-500 hover:bg-green-50 transition-colors"
                >
                  <bt.icon className="w-5 h-5 text-gray-600" />
                  <span className="text-xs text-gray-700">{bt.label}</span>
                </button>
              ))}
            </div>

            {selectedBlock && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold text-gray-900 mb-4">Block Settings</h3>
                <div className="space-y-4">
                  {blocks.find(b => b.id === selectedBlock)?.type === 'header' && (
                    <div>
                      <label className="text-sm text-gray-600">Heading Level</label>
                      <select
                        value={blocks.find(b => b.id === selectedBlock)?.content.level}
                        onChange={(e) => updateBlock(selectedBlock, { level: parseInt(e.target.value) })}
                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                      >
                        <option value={1}>H1 - Large</option>
                        <option value={2}>H2 - Medium</option>
                        <option value={3}>H3 - Small</option>
                      </select>
                    </div>
                  )}
                  {blocks.find(b => b.id === selectedBlock)?.type === 'button' && (
                    <>
                      <div>
                        <label className="text-sm text-gray-600">Button Text</label>
                        <input
                          type="text"
                          value={blocks.find(b => b.id === selectedBlock)?.content.text}
                          onChange={(e) => updateBlock(selectedBlock, { text: e.target.value })}
                          className="w-full mt-1 px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Button URL</label>
                        <input
                          type="text"
                          value={blocks.find(b => b.id === selectedBlock)?.content.url}
                          onChange={(e) => updateBlock(selectedBlock, { url: e.target.value })}
                          className="w-full mt-1 px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </>
                  )}
                  <button
                    onClick={() => { deleteBlock(selectedBlock); setSelectedBlock(null) }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Block
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Email Canvas */}
        <div className="flex-1">
          <div className={`bg-white rounded-xl border shadow-sm ${previewMode === 'mobile' ? 'max-w-[375px] mx-auto' : ''}`}>
            {/* Email Header */}
            <div className="p-6 border-b bg-green-700 rounded-t-xl">
              <div className="text-white font-bold text-xl">Illinois Recycling Foundation</div>
            </div>
            
            {/* Email Body */}
            <div className="p-6">
              {blocks.map((block) => (
                <div key={block.id} className="relative group">
                  {!showPreview && (
                    <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                    </div>
                  )}
                  {renderBlock(block, showPreview)}
                </div>
              ))}
            </div>

            {/* Email Footer */}
            <div className="p-6 border-t bg-gray-50 rounded-b-xl text-center text-sm text-gray-500">
              <p>Illinois Recycling Foundation</p>
              <p>Springfield, IL</p>
              <p className="mt-2">
                <a href="#" className="text-green-600 hover:underline">Unsubscribe</a> · 
                <a href="#" className="text-green-600 hover:underline ml-2">View in browser</a>
              </p>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Recipients */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border p-4 sticky top-20">
            <h3 className="font-semibold text-gray-900 mb-4">Recipients</h3>
            <select className="w-full px-3 py-2 border rounded-lg mb-4">
              <option>All Members (284)</option>
              <option>Active Members (256)</option>
              <option>New This Year (32)</option>
              <option>Conference Registrants (156)</option>
              <option>At-Risk Members (40)</option>
            </select>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
              <Users className="w-4 h-4" />
              <span>284 recipients selected</span>
            </div>

            <h3 className="font-semibold text-gray-900 mb-4">Merge Tags</h3>
            <div className="space-y-2 text-sm">
              {['{{first_name}}', '{{organization}}', '{{membership_plan}}', '{{expiry_date}}'].map(tag => (
                <button key={tag} className="w-full text-left px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 font-mono text-xs">
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
