'use client'

import { useState, useEffect } from 'react'
import { 
  FileText, Folder, Upload, Search, Filter, Download, Eye, Trash2,
  Loader2, Plus, Grid, List, File, Image, FileSpreadsheet, Presentation
} from 'lucide-react'
import { format } from 'date-fns'

type Document = {
  id: string
  title: string
  description: string | null
  file_name: string
  file_url: string
  file_size_bytes: number
  mime_type: string
  document_type: string | null
  visibility: string
  tags: string[]
  download_count: number
  created_at: string
  folder?: { id: string; name: string }
}

type Folder = {
  id: string
  name: string
  description: string | null
  visibility: string
}

const getFileIcon = (mimeType: string) => {
  if (mimeType?.includes('image')) return Image
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return FileSpreadsheet
  if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) return Presentation
  return FileText
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)

  useEffect(() => {
    fetchDocuments()
  }, [selectedFolder])

  const fetchDocuments = async () => {
    const params = new URLSearchParams()
    if (selectedFolder) params.set('folder_id', selectedFolder)
    
    const res = await fetch(`/api/documents?${params}`)
    const data = await res.json()
    setDocuments(data.documents || [])
    setFolders(data.folders || [])
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return
    await fetch(`/api/documents?id=${id}`, { method: 'DELETE' })
    fetchDocuments()
  }

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Document Library</h1>
          <p className="text-gray-600 mt-1">Manage organization documents and files</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <select
            value={selectedFolder || ''}
            onChange={(e) => setSelectedFolder(e.target.value || null)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Folders</option>
            {folders.map(folder => (
              <option key={folder.id} value={folder.id}>{folder.name}</option>
            ))}
          </select>
          <div className="flex border rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Folders Row */}
      {folders.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedFolder(null)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border whitespace-nowrap ${
              !selectedFolder ? 'bg-primary text-white border-primary' : 'bg-white hover:bg-gray-50'
            }`}
          >
            <Folder className="w-5 h-5" />
            All Documents
          </button>
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => setSelectedFolder(folder.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border whitespace-nowrap ${
                selectedFolder === folder.id ? 'bg-primary text-white border-primary' : 'bg-white hover:bg-gray-50'
              }`}
            >
              <Folder className="w-5 h-5" />
              {folder.name}
            </button>
          ))}
        </div>
      )}

      {/* Documents */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No documents found</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            Upload Your First Document
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredDocuments.map(doc => {
            const Icon = getFileIcon(doc.mime_type)
            return (
              <div key={doc.id} className="bg-white rounded-xl border p-6 hover:shadow-lg transition-shadow group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <Eye className="w-4 h-4 text-gray-600" />
                    </a>
                    <a
                      href={doc.file_url}
                      download
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <Download className="w-4 h-4 text-gray-600" />
                    </a>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 truncate">{doc.title}</h3>
                <p className="text-sm text-gray-500 mt-1 truncate">{doc.file_name}</p>
                <div className="flex items-center justify-between mt-4 text-xs text-gray-400">
                  <span>{formatFileSize(doc.file_size_bytes)}</span>
                  <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                </div>
                {doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {doc.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredDocuments.map(doc => {
                const Icon = getFileIcon(doc.mime_type)
                return (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.title}</p>
                          <p className="text-sm text-gray-500">{doc.file_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{doc.document_type || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{formatFileSize(doc.file_size_bytes)}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {format(new Date(doc.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <a href={doc.file_url} target="_blank" className="p-2 hover:bg-gray-100 rounded-lg">
                          <Eye className="w-4 h-4 text-gray-600" />
                        </a>
                        <a href={doc.file_url} download className="p-2 hover:bg-gray-100 rounded-lg">
                          <Download className="w-4 h-4 text-gray-600" />
                        </a>
                        <button onClick={() => handleDelete(doc.id)} className="p-2 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          folders={folders}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => {
            setShowUploadModal(false)
            fetchDocuments()
          }}
        />
      )}
    </div>
  )
}

function UploadModal({ 
  folders, 
  onClose, 
  onUploaded 
}: { 
  folders: Folder[]
  onClose: () => void
  onUploaded: () => void 
}) {
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!file) return
    
    setUploading(true)

    // In production, upload to Supabase Storage first
    // For now, mock the URL
    const formData = new FormData(e.currentTarget)
    
    const data = {
      title: formData.get('title') || file.name,
      description: formData.get('description'),
      file_name: file.name,
      file_url: `https://storage.example.com/documents/${file.name}`,
      file_size_bytes: file.size,
      mime_type: file.type,
      document_type: formData.get('document_type'),
      folder_id: formData.get('folder_id') || null,
      visibility: formData.get('visibility'),
      tags: (formData.get('tags') as string)?.split(',').map(t => t.trim()).filter(Boolean) || []
    }

    await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    setUploading(false)
    onUploaded()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">Upload Document</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* File Drop Zone */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOC, XLS, PPT up to 50MB</p>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input
              type="text"
              name="title"
              defaultValue={file?.name.replace(/\.[^/.]+$/, '')}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              name="description"
              rows={2}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Folder</label>
              <select name="folder_id" className="w-full px-4 py-2 border rounded-lg">
                <option value="">No Folder</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
              <select name="visibility" defaultValue="members" className="w-full px-4 py-2 border rounded-lg">
                <option value="public">Public</option>
                <option value="members">Members Only</option>
                <option value="admin">Admins Only</option>
                <option value="board">Board Only</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
            <input
              type="text"
              name="tags"
              placeholder="policy, 2024, annual"
              className="w-full px-4 py-2 border rounded-lg"
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
              disabled={!file || uploading}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
