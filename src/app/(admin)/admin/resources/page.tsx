'use client'

import * as React from 'react'
import { FileText, Folder, Plus, Search, Upload, Download, Eye, Edit, Trash2, File, Video, Link, Image } from 'lucide-react'

export default function ResourcesPage() {
  const folders = [
    { id: '1', name: 'Best Practices Guides', files: 12 },
    { id: '2', name: 'Regulatory Documents', files: 8 },
    { id: '3', name: 'Webinar Recordings', files: 15 },
    { id: '4', name: 'Templates & Forms', files: 6 },
  ]

  const recentFiles = [
    { id: '1', name: '2024 Recycling Guidelines.pdf', type: 'pdf', folder: 'Best Practices Guides', size: '2.4 MB', downloads: 156, date: '2024-03-10' },
    { id: '2', name: 'MRF Safety Training.mp4', type: 'video', folder: 'Webinar Recordings', size: '450 MB', downloads: 89, date: '2024-03-08' },
    { id: '3', name: 'Grant Application Template.docx', type: 'doc', folder: 'Templates & Forms', size: '156 KB', downloads: 234, date: '2024-03-05' },
    { id: '4', name: 'EPA Compliance Checklist.pdf', type: 'pdf', folder: 'Regulatory Documents', size: '890 KB', downloads: 67, date: '2024-03-01' },
  ]

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-5 h-5 text-red-500" />
      case 'video': return <Video className="w-5 h-5 text-purple-500" />
      case 'doc': return <File className="w-5 h-5 text-blue-500" />
      case 'image': return <Image className="w-5 h-5 text-green-500" />
      default: return <File className="w-5 h-5 text-gray-500" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resources Library</h1>
          <p className="text-gray-600 mt-1">Manage documents and files for members</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
            <Folder className="w-4 h-4" />
            New Folder
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Upload className="w-4 h-4" />
            Upload Files
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Total Files</p>
          <p className="text-2xl font-bold">{folders.reduce((sum, f) => sum + f.files, 0)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Folders</p>
          <p className="text-2xl font-bold">{folders.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Total Downloads</p>
          <p className="text-2xl font-bold">{recentFiles.reduce((sum, f) => sum + f.downloads, 0)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-600">Storage Used</p>
          <p className="text-2xl font-bold">2.4 GB</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Folders Sidebar */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Folders</h2>
          </div>
          <div className="p-2">
            {folders.map((folder) => (
              <button key={folder.id} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left">
                <Folder className="w-5 h-5 text-yellow-500" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{folder.name}</div>
                  <div className="text-xs text-gray-500">{folder.files} files</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Files List */}
        <div className="col-span-3 bg-white rounded-lg border">
          <div className="p-4 border-b flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search files..." className="w-full pl-10 pr-4 py-2 border rounded-lg" />
            </div>
            <select className="px-4 py-2 border rounded-lg">
              <option>All Types</option>
              <option>Documents</option>
              <option>Videos</option>
              <option>Images</option>
            </select>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Folder</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Downloads</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentFiles.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.type)}
                      <div>
                        <div className="font-medium text-gray-900">{file.name}</div>
                        <div className="text-sm text-gray-500">{file.date}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{file.folder}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{file.size}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{file.downloads}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-2 hover:bg-gray-100 rounded"><Download className="w-4 h-4 text-gray-400" /></button>
                      <button className="p-2 hover:bg-gray-100 rounded"><Edit className="w-4 h-4 text-gray-400" /></button>
                      <button className="p-2 hover:bg-gray-100 rounded"><Trash2 className="w-4 h-4 text-gray-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
