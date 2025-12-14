'use client'

import { useState, useEffect } from 'react'
import { 
  Calendar, Users, FileText, Video, MapPin,
  Plus, ChevronRight, Download, CheckCircle,
  Clock, Vote, Eye
} from 'lucide-react'

type BoardMeeting = {
  id: string
  title: string
  meeting_date: string
  location: string | null
  is_virtual: boolean
  virtual_link: string | null
  status: string
  quorum_required: number | null
  attendees: any[]
  packet_generated_at: string | null
  minutes_approved_at: string | null
  agenda_items: Array<{
    id: string
    item_order: number
    title: string
    item_type: string
    requires_vote: boolean
    vote_result: string | null
  }>
}

export default function BoardMeetingsPage() {
  const [meetings, setMeetings] = useState<BoardMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewMeeting, setShowNewMeeting] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<BoardMeeting | null>(null)

  // New meeting form state
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    meeting_date: '',
    meeting_time: '10:00',
    location: '',
    is_virtual: false,
    virtual_link: '',
    quorum_required: 5,
  })

  useEffect(() => {
    fetchMeetings()
  }, [])

  const fetchMeetings = async () => {
    setLoading(true)
    const res = await fetch('/api/board/meetings?organization_id=ORG_ID')
    const data = await res.json()
    setMeetings(data.meetings || [])
    setLoading(false)
  }

  const handleCreateMeeting = async () => {
    const dateTime = `${newMeeting.meeting_date}T${newMeeting.meeting_time}:00`
    
    await fetch('/api/board/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: 'ORG_ID',
        title: newMeeting.title,
        meeting_date: dateTime,
        location: newMeeting.location || null,
        is_virtual: newMeeting.is_virtual,
        virtual_link: newMeeting.virtual_link || null,
        quorum_required: newMeeting.quorum_required,
      }),
    })

    setShowNewMeeting(false)
    setNewMeeting({
      title: '',
      meeting_date: '',
      meeting_time: '10:00',
      location: '',
      is_virtual: false,
      virtual_link: '',
      quorum_required: 5,
    })
    fetchMeetings()
  }

  const handleGeneratePacket = async (meetingId: string) => {
    await fetch(`/api/board/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_packet' }),
    })
    fetchMeetings()
  }

  const upcomingMeetings = meetings.filter(m => new Date(m.meeting_date) >= new Date())
  const pastMeetings = meetings.filter(m => new Date(m.meeting_date) < new Date())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Board Meetings</h1>
          <p className="text-gray-600 mt-1">Schedule meetings, manage agendas, and record minutes</p>
        </div>
        <button
          onClick={() => setShowNewMeeting(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Schedule Meeting
        </button>
      </div>

      {/* Upcoming Meetings */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Meetings</h2>
        {upcomingMeetings.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No upcoming meetings scheduled</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {upcomingMeetings.map(meeting => (
              <div key={meeting.id} className="bg-white rounded-xl border p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">{meeting.title}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(meeting.meeting_date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        {meeting.is_virtual ? (
                          <span className="flex items-center gap-1">
                            <Video className="w-4 h-4" />
                            Virtual
                          </span>
                        ) : meeting.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {meeting.location}
                          </span>
                        )}
                      </div>
                      {meeting.agenda_items && (
                        <p className="text-sm text-gray-500 mt-2">
                          {meeting.agenda_items.length} agenda items • 
                          {meeting.agenda_items.filter(i => i.requires_vote).length} requiring vote
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {meeting.packet_generated_at ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Packet Ready
                      </span>
                    ) : (
                      <button
                        onClick={() => handleGeneratePacket(meeting.id)}
                        className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm flex items-center gap-1 hover:bg-orange-200"
                      >
                        <FileText className="w-4 h-4" />
                        Generate Packet
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedMeeting(meeting)}
                      className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Meetings */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Past Meetings</h2>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meeting</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Minutes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pastMeetings.slice(0, 10).map(meeting => (
                <tr key={meeting.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{meeting.title}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(meeting.meeting_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1 text-sm">
                      <Users className="w-4 h-4 text-gray-400" />
                      {meeting.attendees?.length || 0} attended
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {meeting.minutes_approved_at ? (
                      <span className="text-green-600 text-sm flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Approved
                      </span>
                    ) : (
                      <span className="text-orange-600 text-sm">Pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedMeeting(meeting)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Meeting Modal */}
      {showNewMeeting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Schedule Board Meeting</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Q1 2026 Board Meeting"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={newMeeting.meeting_date}
                    onChange={(e) => setNewMeeting({ ...newMeeting, meeting_date: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={newMeeting.meeting_time}
                    onChange={(e) => setNewMeeting({ ...newMeeting, meeting_time: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={newMeeting.is_virtual}
                    onChange={(e) => setNewMeeting({ ...newMeeting, is_virtual: e.target.checked })}
                    className="rounded"
                  />
                  Virtual Meeting
                </label>
              </div>
              {newMeeting.is_virtual ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
                  <input
                    type="url"
                    value={newMeeting.virtual_link}
                    onChange={(e) => setNewMeeting({ ...newMeeting, virtual_link: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={newMeeting.location}
                    onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="Conference Room A"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quorum Required</label>
                <input
                  type="number"
                  value={newMeeting.quorum_required}
                  onChange={(e) => setNewMeeting({ ...newMeeting, quorum_required: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg"
                  min={1}
                />
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowNewMeeting(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMeeting}
                disabled={!newMeeting.title || !newMeeting.meeting_date}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Schedule Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Detail Modal */}
      {selectedMeeting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedMeeting.title}</h2>
              <button
                onClick={() => setSelectedMeeting(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Meeting Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Date & Time</label>
                  <p className="font-medium">
                    {new Date(selectedMeeting.meeting_date).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Location</label>
                  <p className="font-medium">
                    {selectedMeeting.is_virtual ? 'Virtual' : selectedMeeting.location || '—'}
                  </p>
                </div>
              </div>

              {/* Agenda Items */}
              <div>
                <h3 className="font-semibold mb-3">Agenda</h3>
                {selectedMeeting.agenda_items?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedMeeting.agenda_items
                      .sort((a, b) => a.item_order - b.item_order)
                      .map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-sm">
                            {item.item_order}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium">{item.title}</p>
                            <p className="text-sm text-gray-500">{item.item_type}</p>
                          </div>
                          {item.requires_vote && (
                            <span className="flex items-center gap-1 text-sm text-blue-600">
                              <Vote className="w-4 h-4" />
                              Vote Required
                            </span>
                          )}
                          {item.vote_result && (
                            <span className={`px-2 py-1 rounded text-xs ${
                              item.vote_result === 'approved' 
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {item.vote_result}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No agenda items yet</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                {!selectedMeeting.packet_generated_at && (
                  <button
                    onClick={() => {
                      handleGeneratePacket(selectedMeeting.id)
                      setSelectedMeeting(null)
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Generate Board Packet
                  </button>
                )}
                {selectedMeeting.packet_generated_at && (
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Download Packet
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
