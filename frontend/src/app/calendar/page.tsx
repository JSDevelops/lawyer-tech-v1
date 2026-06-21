'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Calendar, Clock, Plus, ChevronLeft, ChevronRight,
  AlertCircle, MapPin, FileText, Users, Bell, X,
  Edit2, Trash2, Check, Briefcase, Filter,
  CalendarDays, List, LayoutGrid, RefreshCw
} from 'lucide-react'

// ==============================
// Types
// ==============================
interface CalendarEvent {
  id: string
  title: string
  description?: string
  event_type: string
  start_datetime: string
  end_datetime?: string
  all_day: boolean
  location?: string
  reminder_minutes: number
  is_reminder_sent: boolean
  case_id?: string
  case_title?: string
  case_number?: string
  created_by?: string
  attendees: string[]
  created_at: string
}

interface Case {
  id: string
  case_number: string
  title: string
  status: string
}

interface CalendarStats {
  total: number
  today: number
  this_week: number
  next_30_days: number
  court_dates_upcoming: number
  deadlines_upcoming: number
}

// ==============================
// Constants
// ==============================
const EVENT_TYPES = [
  'นัดศาล', 'กำหนดส่งเอกสาร', 'นัดประชุม',
  'นัดหมายลูกความ', 'เตือนความจำ', 'นัดไต่สวน'
]

const EVENT_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; badge: string }> = {
  'นัดศาล':            { color: 'text-red-300',    bg: 'bg-red-500/20',    border: 'border-red-500/40',    icon: '⚖️', badge: 'bg-red-500/30 text-red-300' },
  'กำหนดส่งเอกสาร':   { color: 'text-orange-300', bg: 'bg-orange-500/20', border: 'border-orange-500/40', icon: '📋', badge: 'bg-orange-500/30 text-orange-300' },
  'นัดประชุม':         { color: 'text-blue-300',   bg: 'bg-blue-500/20',   border: 'border-blue-500/40',   icon: '🤝', badge: 'bg-blue-500/30 text-blue-300' },
  'นัดหมายลูกความ':   { color: 'text-green-300',  bg: 'bg-green-500/20',  border: 'border-green-500/40',  icon: '👤', badge: 'bg-green-500/30 text-green-300' },
  'เตือนความจำ':       { color: 'text-yellow-300', bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', icon: '🔔', badge: 'bg-yellow-500/30 text-yellow-300' },
  'นัดไต่สวน':        { color: 'text-purple-300', bg: 'bg-purple-500/20', border: 'border-purple-500/40', icon: '🏛️', badge: 'bg-purple-500/30 text-purple-300' },
}

const THAI_MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
]
const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

// ==============================
// API Helper
// ==============================
// API base URL — use backend directly to avoid Next.js proxy trailing-slash issues
const BACKEND = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1')
  : 'http://localhost:8000/api/v1'

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem('access_token')
  const url = `${BACKEND}/calendar${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'เกิดข้อผิดพลาด')
  }
  return res.json()
}


// ==============================
// Modal Component
// ==============================
function EventModal({
  event, cases, onClose, onSave
}: {
  event: CalendarEvent | null
  cases: Case[]
  onClose: () => void
  onSave: (data: Partial<CalendarEvent>) => Promise<void>
}) {
  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0)

  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    event_type: event?.event_type || 'นัดหมายลูกความ',
    start_datetime: event?.start_datetime
      ? new Date(event.start_datetime).toISOString().slice(0, 16)
      : defaultStart.toISOString().slice(0, 16),
    end_datetime: event?.end_datetime
      ? new Date(event.end_datetime).toISOString().slice(0, 16)
      : '',
    all_day: event?.all_day || false,
    location: event?.location || '',
    reminder_minutes: event?.reminder_minutes || 60,
    case_id: event?.case_id || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('กรุณากรอกชื่อนัดหมาย'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        ...form,
        start_datetime: new Date(form.start_datetime).toISOString(),
        end_datetime: form.end_datetime ? new Date(form.end_datetime).toISOString() : undefined,
        case_id: form.case_id || undefined,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const cfg = EVENT_CONFIG[form.event_type] || EVENT_CONFIG['นัดหมายลูกความ']

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in overflow-hidden">
        {/* Header */}
        <div className={`${cfg.bg} border-b ${cfg.border} px-6 py-4 flex justify-between items-center`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{cfg.icon}</span>
            <h2 className={`text-lg font-bold ${cfg.color}`}>
              {event ? 'แก้ไขนัดหมาย' : 'เพิ่มนัดหมายใหม่'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
              ชื่อนัดหมาย *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="เช่น นัดศาลคดีสมชาย วันที่..."
              className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 text-sm"
            />
          </div>

          {/* Event Type */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
              ประเภทนัดหมาย
            </label>
            <div className="grid grid-cols-3 gap-2">
              {EVENT_TYPES.map(type => {
                const c = EVENT_CONFIG[type]
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, event_type: type }))}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      form.event_type === type
                        ? `${c.bg} ${c.border} ${c.color}`
                        : 'bg-slate-700/30 border-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <span>{c.icon}</span>
                    <span className="truncate">{type}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                วันและเวลาเริ่ม *
              </label>
              <input
                type="datetime-local"
                value={form.start_datetime}
                onChange={e => setForm(f => ({ ...f, start_datetime: e.target.value }))}
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                วันและเวลาสิ้นสุด
              </label>
              <input
                type="datetime-local"
                value={form.end_datetime}
                onChange={e => setForm(f => ({ ...f, end_datetime: e.target.value }))}
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 text-sm"
              />
            </div>
          </div>

          {/* All Day */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setForm(f => ({ ...f, all_day: !f.all_day }))}
              className={`w-10 h-5 rounded-full transition-colors relative ${form.all_day ? 'bg-blue-500' : 'bg-slate-600'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.all_day ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-slate-300">ทั้งวัน (All Day)</span>
          </label>

          {/* Location */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
              สถานที่
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="เช่น ศาลแพ่งกรุงเทพใต้ ห้อง 10"
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 text-sm"
              />
            </div>
          </div>

          {/* Link to Case */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
              เชื่อมโยงกับคดี
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={form.case_id}
                onChange={e => setForm(f => ({ ...f, case_id: e.target.value }))}
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 text-sm appearance-none"
              >
                <option value="">— ไม่เชื่อมโยงคดี —</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.title.substring(0, 40)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reminder */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
              แจ้งเตือนล่วงหน้า
            </label>
            <div className="relative">
              <Bell className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={form.reminder_minutes}
                onChange={e => setForm(f => ({ ...f, reminder_minutes: Number(e.target.value) }))}
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-blue-500/50 text-sm appearance-none"
              >
                <option value={15}>15 นาทีก่อน</option>
                <option value={30}>30 นาทีก่อน</option>
                <option value={60}>1 ชั่วโมงก่อน</option>
                <option value={120}>2 ชั่วโมงก่อน</option>
                <option value={1440}>1 วันก่อน</option>
                <option value={2880}>2 วันก่อน</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
              บันทึกเพิ่มเติม
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="รายละเอียดเพิ่มเติม..."
              rows={3}
              className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 text-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-700/50 hover:bg-slate-700 border border-white/10 rounded-lg text-slate-300 text-sm font-medium transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> กำลังบันทึก...</>
              ) : (
                <><Check className="w-4 h-4" /> บันทึกนัดหมาย</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================
// Detail Modal Component
// ==============================
function EventDetailModal({
  event, onClose, onEdit, onDelete
}: {
  event: CalendarEvent
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const cfg = EVENT_CONFIG[event.event_type] || EVENT_CONFIG['นัดหมายลูกความ']
  const start = new Date(event.start_datetime)
  const end = event.end_datetime ? new Date(event.end_datetime) : null
  const now = new Date()
  const isPast = start < now
  const isToday = start.toDateString() === now.toDateString()

  const formatDateTime = (dt: Date) => {
    return dt.toLocaleString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in overflow-hidden">
        {/* Header */}
        <div className={`${cfg.bg} border-b ${cfg.border} px-6 py-5`}>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-3xl flex-shrink-0">{cfg.icon}</span>
              <div className="min-w-0">
                <h2 className={`text-lg font-bold ${cfg.color} leading-snug`}>{event.title}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.badge} mt-1 inline-block`}>
                  {event.event_type}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
          {isToday && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-green-400 font-medium">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              วันนี้
            </div>
          )}
          {isPast && !isToday && (
            <div className="mt-3 text-xs text-slate-500">ผ่านไปแล้ว</div>
          )}
        </div>

        <div className="p-6 space-y-4">
          {/* Date/Time */}
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-white font-medium">{formatDateTime(start)}</p>
              {end && (
                <p className="text-xs text-slate-400 mt-0.5">ถึง {formatDateTime(end)}</p>
              )}
              {event.all_day && <span className="text-xs text-blue-400 mt-0.5 block">ทั้งวัน</span>}
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-300">{event.location}</p>
            </div>
          )}

          {/* Case Link */}
          {event.case_title && (
            <div className="flex items-start gap-3">
              <Briefcase className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500">เชื่อมโยงคดี</p>
                <p className="text-sm text-blue-400 font-medium">{event.case_number}</p>
                <p className="text-xs text-slate-400">{event.case_title}</p>
              </div>
            </div>
          )}

          {/* Reminder */}
          <div className="flex items-start gap-3">
            <Bell className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500">แจ้งเตือนล่วงหน้า</p>
              <p className="text-sm text-slate-300">
                {event.reminder_minutes >= 1440
                  ? `${event.reminder_minutes / 1440} วัน`
                  : event.reminder_minutes >= 60
                  ? `${event.reminder_minutes / 60} ชั่วโมง`
                  : `${event.reminder_minutes} นาที`}
              </p>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="bg-slate-700/30 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">บันทึก</p>
              <p className="text-sm text-slate-300">{event.description}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-300 text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              ลบ
            </button>
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-medium transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              แก้ไขนัดหมาย
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==============================
// Main Page Component
// ==============================
export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [stats, setStats] = useState<CalendarStats | null>(null)
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'month' | 'list' | 'upcoming'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const headers = { Authorization: `Bearer ${token}` }

      // Fetch events
      const params = new URLSearchParams({
        year: currentDate.getFullYear().toString(),
        month: (currentDate.getMonth() + 1).toString(),
      })
      const evRes = await fetch(`${BACKEND}/calendar/?${params}`, { headers })
      if (evRes.ok) {
        const data = await evRes.json()
        setEvents(data.data)
      }

      // Fetch stats
      const statsRes = await fetch(`${BACKEND}/calendar/stats`, { headers })
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }

      // Fetch cases for dropdown
      const casesRes = await fetch(`${BACKEND}/cases/?limit=100`, { headers })
      if (casesRes.ok) {
        const data = await casesRes.json()
        setCases(data.data || [])
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [currentDate])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchAllForSearch = useCallback(async () => {
    if (!searchQuery) return
    try {
      const token = localStorage.getItem('access_token')
      const params = new URLSearchParams({ search: searchQuery })
      const res = await fetch(`${BACKEND}/calendar/?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setEvents(data.data)
      }
    } catch {}
  }, [searchQuery])

  useEffect(() => {
    if (searchQuery) {
      const t = setTimeout(fetchAllForSearch, 300)
      return () => clearTimeout(t)
    } else {
      fetchData()
    }
  }, [searchQuery, fetchAllForSearch, fetchData])

  const handleSave = async (data: Partial<CalendarEvent>) => {
    if (editingEvent) {
      await apiFetch(`/${editingEvent.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      showToast('แก้ไขนัดหมายสำเร็จ ✅')
    } else {
      await apiFetch('/', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      showToast('สร้างนัดหมายใหม่สำเร็จ ✅')
    }
    setShowModal(false)
    setEditingEvent(null)
    setSelectedEvent(null)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบนัดหมายนี้?')) return
    try {
      await apiFetch(`/${id}`, { method: 'DELETE' })
      showToast('ลบนัดหมายสำเร็จ', 'success')
      setSelectedEvent(null)
      fetchData()
    } catch (err: any) {
      showToast(err.message, 'error')
    }
  }

  // ---- Calendar Grid Logic ----
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay()

  const getEventsForDate = (dateStr: string) => {
    return events.filter(ev => {
      const evDate = new Date(ev.start_datetime).toLocaleDateString('en-CA')
      return evDate === dateStr
    })
  }

  const filteredEvents = events.filter(ev => {
    if (filterType !== 'all' && ev.event_type !== filterType) return false
    return true
  })

  // Navigate months
  const prevMonth = () => {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() - 1)
    setCurrentDate(d)
  }
  const nextMonth = () => {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() + 1)
    setCurrentDate(d)
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date()

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2 animate-fade-in ${
          toast.type === 'success' ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-blue-400" />
            ปฏิทิน & นัดหมาย
          </h1>
          <p className="text-slate-400 text-sm mt-1">จัดการนัดหมาย วันศาล และ Deadline ทั้งหมด</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-slate-800 border border-white/10 rounded-lg p-1 gap-1">
            {[
              { mode: 'month', icon: <LayoutGrid className="w-4 h-4" />, label: 'เดือน' },
              { mode: 'upcoming', icon: <CalendarDays className="w-4 h-4" />, label: 'กำลังมา' },
              { mode: 'list', icon: <List className="w-4 h-4" />, label: 'รายการ' },
            ].map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {icon}
                <span className="hidden sm:block">{label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => { setEditingEvent(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
          >
            <Plus className="w-4 h-4" />
            เพิ่มนัดหมาย
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'ทั้งหมด', value: stats.total, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: <Calendar className="w-4 h-4" /> },
            { label: 'วันนี้', value: stats.today, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: <CalendarDays className="w-4 h-4" /> },
            { label: 'สัปดาห์นี้', value: stats.this_week, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: <Clock className="w-4 h-4" /> },
            { label: '30 วัน', value: stats.next_30_days, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', icon: <Bell className="w-4 h-4" /> },
            { label: 'นัดศาล', value: stats.court_dates_upcoming, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: <span className="text-base">⚖️</span> },
            { label: 'กำหนดส่ง', value: stats.deadlines_upcoming, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: <span className="text-base">📋</span> },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} border rounded-xl p-3 flex flex-col gap-1`}>
              <div className={`${s.color} flex items-center gap-1.5`}>
                {s.icon}
                <span className="text-xs font-medium text-slate-400">{s.label}</span>
              </div>
              <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-slate-500" />
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
            filterType === 'all' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-white/10 hover:border-white/20'
          }`}
        >
          ทั้งหมด
        </button>
        {EVENT_TYPES.map(type => {
          const c = EVENT_CONFIG[type]
          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                filterType === type ? `${c.bg} ${c.color} ${c.border}` : 'bg-slate-800 text-slate-400 border-white/10 hover:border-white/20'
              }`}
            >
              <span>{c.icon}</span>
              {type}
            </button>
          )
        })}
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 ค้นหานัดหมาย..."
          className="ml-auto bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      {/* ============ MONTH VIEW ============ */}
      {viewMode === 'month' && (
        <div className="bg-slate-800/50 border border-white/10 rounded-2xl overflow-hidden">
          {/* Month Navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-bold text-white">
                {THAI_MONTHS[month]} {year + 543}
              </h2>
              <p className="text-xs text-slate-500">{filteredEvents.length} นัดหมายในเดือนนี้</p>
            </div>
            <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-white/5">
            {THAI_DAYS_SHORT.map(day => (
              <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {/* Empty cells before month start */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-white/5 bg-slate-900/20" />
            ))}

            {/* Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = getEventsForDate(dateStr).filter(ev =>
                filterType === 'all' || ev.event_type === filterType
              )
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
              const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())

              return (
                <div
                  key={day}
                  className={`min-h-[100px] border-b border-r border-white/5 p-1.5 transition-colors ${
                    isToday ? 'bg-blue-600/10' : isPast ? 'bg-slate-900/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1 ${
                    isToday ? 'bg-blue-500 text-white' : isPast ? 'text-slate-600' : 'text-slate-300'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => {
                      const c = EVENT_CONFIG[ev.event_type] || EVENT_CONFIG['นัดหมายลูกความ']
                      return (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-xs ${c.bg} ${c.color} truncate flex items-center gap-1 hover:opacity-90 transition-opacity`}
                        >
                          <span className="text-xs leading-none">{c.icon}</span>
                          <span className="truncate">{ev.title}</span>
                        </button>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <p className="text-xs text-slate-500 pl-1">+{dayEvents.length - 3} อีก</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ============ UPCOMING VIEW ============ */}
      {viewMode === 'upcoming' && (
        <UpcomingView
          onSelect={setSelectedEvent}
          onAdd={() => { setEditingEvent(null); setShowModal(true) }}
        />
      )}

      {/* ============ LIST VIEW ============ */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">ไม่มีนัดหมายในเดือนนี้</p>
              <button
                onClick={() => { setEditingEvent(null); setShowModal(true) }}
                className="mt-3 text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                + เพิ่มนัดหมายใหม่
              </button>
            </div>
          ) : (
            filteredEvents.map(ev => {
              const cfg = EVENT_CONFIG[ev.event_type] || EVENT_CONFIG['นัดหมายลูกความ']
              const start = new Date(ev.start_datetime)
              const isToday = start.toDateString() === today.toDateString()
              const isPast = start < today

              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className={`bg-slate-800/50 border ${cfg.border} rounded-xl p-4 cursor-pointer hover:bg-slate-700/50 transition-all group ${
                    isPast && !isToday ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Date Badge */}
                    <div className={`flex-shrink-0 w-14 h-14 ${cfg.bg} rounded-xl flex flex-col items-center justify-center border ${cfg.border}`}>
                      <span className="text-xs text-slate-400 leading-none">
                        {start.toLocaleString('th-TH', { month: 'short' })}
                      </span>
                      <span className={`text-xl font-bold ${cfg.color} leading-tight`}>
                        {start.getDate()}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base">{cfg.icon}</span>
                          <h3 className={`font-semibold ${cfg.color} leading-snug`}>{ev.title}</h3>
                          {isToday && (
                            <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full">
                              วันนี้
                            </span>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.badge} flex-shrink-0`}>
                          {ev.event_type}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                        </span>
                        {ev.location && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {ev.location}
                          </span>
                        )}
                        {ev.case_number && (
                          <span className="text-xs text-blue-400 flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            {ev.case_number}
                          </span>
                        )}
                      </div>

                      {ev.description && (
                        <p className="text-xs text-slate-500 mt-1.5 line-clamp-1">{ev.description}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setEditingEvent(ev); setShowModal(true) }}
                        className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-400 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(ev.id) }}
                        className="p-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <EventModal
          event={editingEvent}
          cases={cases}
          onClose={() => { setShowModal(false); setEditingEvent(null) }}
          onSave={handleSave}
        />
      )}

      {selectedEvent && !showModal && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => {
            setEditingEvent(selectedEvent)
            setSelectedEvent(null)
            setShowModal(true)
          }}
          onDelete={() => handleDelete(selectedEvent.id)}
        />
      )}
    </div>
  )
}

// ==============================
// Upcoming Events Sub-Component
// ==============================
function UpcomingView({ onSelect, onAdd }: { onSelect: (ev: CalendarEvent) => void; onAdd: () => void }) {
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl = (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_API_URL)
          || (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1')
        const res = await window.fetch(`${backendUrl}/calendar/upcoming?days=30`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setUpcomingEvents(data.data)
        }
      } catch {}
      setLoading(false)
    }
    fetch()
  }, [])

  const today = new Date()
  const grouped: Record<string, CalendarEvent[]> = {}

  upcomingEvents.forEach(ev => {
    const evDate = new Date(ev.start_datetime)
    const isToday = evDate.toDateString() === today.toDateString()
    const isTomorrow = evDate.toDateString() === new Date(today.getTime() + 86400000).toDateString()

    let key = evDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    if (isToday) key = `📅 วันนี้ — ${key}`
    else if (isTomorrow) key = `⏭️ พรุ่งนี้ — ${key}`

    if (!grouped[key]) grouped[key] = []
    grouped[key].push(ev)
  })

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
    </div>
  )

  if (upcomingEvents.length === 0) return (
    <div className="text-center py-16 bg-slate-800/30 border border-white/5 rounded-2xl">
      <CalendarDays className="w-12 h-12 text-slate-600 mx-auto mb-3" />
      <p className="text-slate-400 text-sm font-medium">ไม่มีนัดหมายใน 30 วันข้างหน้า</p>
      <button onClick={onAdd} className="mt-3 text-blue-400 hover:text-blue-300 text-sm font-medium">
        + เพิ่มนัดหมายใหม่
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, evs]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <h3 className="text-sm font-semibold text-slate-300">{date}</h3>
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-xs text-slate-500">{evs.length} รายการ</span>
          </div>
          <div className="space-y-2 pl-4">
            {evs.map(ev => {
              const cfg = EVENT_CONFIG[ev.event_type] || EVENT_CONFIG['นัดหมายลูกความ']
              const start = new Date(ev.start_datetime)
              return (
                <button
                  key={ev.id}
                  onClick={() => onSelect(ev)}
                  className={`w-full text-left ${cfg.bg} border ${cfg.border} rounded-xl p-4 hover:opacity-90 transition-all`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${cfg.color}`}>{ev.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-400">
                          {start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                        </span>
                        {ev.location && (
                          <span className="text-xs text-slate-500 flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" />{ev.location}
                          </span>
                        )}
                        {ev.case_number && (
                          <span className="text-xs text-blue-400 flex items-center gap-0.5">
                            <Briefcase className="w-3 h-3" />{ev.case_number}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.badge} flex-shrink-0`}>
                      {ev.event_type}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
