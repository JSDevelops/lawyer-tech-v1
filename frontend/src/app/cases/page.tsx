'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Scale, Plus, Search, ChevronRight, AlertCircle, Clock, X,
  Loader2, Edit2, Trash2, Shield, Calendar, User, Briefcase,
  FileText, Link as LinkIcon, CheckCircle2, ChevronLeft, ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface ResponsibleLawyer {
  name: string
  phone?: string
  line?: string
}

interface Case {
  id: string
  case_number: string
  title: string
  category: string
  status: string
  priority: string
  court_name?: string
  client_id?: string
  client_name?: string
  court_date?: string
  responsible_lawyer_name?: string
  responsible_lawyer_phone?: string
  responsible_lawyer_line?: string
  responsible_clerk_name?: string
  responsible_lawyers?: ResponsibleLawyer[]
  created_at: string
}

interface CaseDetail extends Case {
  description: string
  court_case_number?: string
  ai_summary?: string
}

interface Client {
  id: string
  full_name: string
  client_code: string
}

const statusMap: Record<string, { label: string; cls: string }> = {
  intake: { label: 'รับเรื่องใหม่', cls: 'badge-free' },
  active: { label: 'กำลังดำเนินการ', cls: 'badge-active' },
  pending: { label: 'รอพิจารณา', cls: 'badge-pending' },
  closed: { label: 'ปิดคดี', cls: 'badge-closed' },
  won: { label: 'ชนะคดี', cls: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' },
  lost: { label: 'แพ้คดี', cls: 'bg-red-500/20 border-red-500/30 text-red-400' },
  settled: { label: 'ไกล่เกลี่ยสำเร็จ', cls: 'bg-purple-500/20 border-purple-500/30 text-purple-400' },
}

const priorityMap: Record<string, { label: string; cls: string }> = {
  urgent: { label: '🔴 เร่งด่วนมาก', cls: 'bg-red-500/10 border-red-500/20 text-red-400' },
  high: { label: '🟠 สูง', cls: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
  medium: { label: '🟡 ปานกลาง', cls: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
  low: { label: '🟢 ต่ำ', cls: 'bg-slate-500/10 border-white/10 text-slate-400' },
}

const categoryOptions = [
  'คดีอาญา',
  'คดีแพ่ง',
  'จัดการมรดก',
  'ที่ดิน',
  'คดี พ.ร.บ. และอุบัติเหตุ',
  'คดียึดทรัพย์',
  'คดีผิดสัญญา',
  'คดีครอบครัว',
  'คดีแรงงาน',
  'คดีธุรกิจ'
]

export default function CasesPage() {
  // Data loading states
  const [cases, setCases] = useState<Case[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [dashboardStats, setDashboardStats] = useState<any>(null)

  // Drawer (Add / Edit) state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('คดีแพ่ง')
  const [clientId, setClientId] = useState('')
  const [priority, setPriority] = useState('medium')
  const [status, setStatus] = useState('intake')
  const [courtName, setCourtName] = useState('')
  const [courtCaseNumber, setCourtCaseNumber] = useState('')
  const [courtDate, setCourtDate] = useState('')
  const [responsibleLawyers, setResponsibleLawyers] = useState<ResponsibleLawyer[]>([{ name: '', phone: '', line: '' }])
  const [responsibleClerkName, setResponsibleClerkName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Detail Modal state
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Delete Confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

  // Fetch clients to populate dropdown
  const fetchClients = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
      const res = await fetch(`${apiUrl}/clients/?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setClients(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching clients:', err)
    }
  }, [token])

  // Fetch cases and stats
  const fetchCases = useCallback(async () => {
    try {
      setLoading(true)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
      
      let url = `${apiUrl}/cases/?page=${page}&limit=${limit}`
      if (search) url += `&search=${encodeURIComponent(search)}`
      if (filterStatus !== 'all') url += `&status=${filterStatus}`

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!res.ok) throw new Error('ไม่สามารถโหลดข้อมูลคดีได้')
      
      const data = await res.json()
      setCases(data.data || [])
      setTotal(data.total || 0)

      // Fetch dashboard stats for upper summaries
      const statsRes = await fetch(`${apiUrl}/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setDashboardStats(statsData)
      }
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, filterStatus, token])

  useEffect(() => {
    if (token) {
      fetchCases()
      fetchClients()
    }
  }, [fetchCases, fetchClients, token])

  // View details
  const handleViewDetails = async (c: Case) => {
    try {
      setDetailOpen(true)
      setDetailLoading(true)
      setSelectedCase(null)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
      const res = await fetch(`${apiUrl}/cases/${c.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!res.ok) throw new Error('ไม่สามารถโหลดรายละเอียดคดีความได้')
      const data = await res.json()
      setSelectedCase(data)
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  // Open drawer for adding
  const handleOpenAdd = () => {
    setIsEditing(false)
    setEditId(null)
    setTitle('')
    setDescription('')
    setCategory('คดีแพ่ง')
    setClientId(clients.length > 0 ? clients[0].id : '')
    setPriority('medium')
    setStatus('intake')
    setCourtName('')
    setCourtCaseNumber('')
    setCourtDate('')
    setResponsibleLawyers([{ name: '', phone: '', line: '' }])
    setResponsibleClerkName('')
    setDrawerOpen(true)
  }

  // Open drawer for editing
  const handleOpenEdit = (c: CaseDetail) => {
    setIsEditing(true)
    setEditId(c.id)
    setTitle(c.title || '')
    setDescription(c.description || '')
    setCategory(c.category || 'คดีแพ่ง')
    setClientId(c.client_id || '')
    setPriority(c.priority || 'medium')
    setStatus(c.status || 'intake')
    setCourtName(c.court_name || '')
    setCourtCaseNumber(c.court_case_number || '')
    setCourtDate(c.court_date ? c.court_date.substring(0, 10) : '')
    if (c.responsible_lawyers && c.responsible_lawyers.length > 0) {
      setResponsibleLawyers(c.responsible_lawyers)
    } else if (c.responsible_lawyer_name) {
      setResponsibleLawyers([{
        name: c.responsible_lawyer_name || '',
        phone: c.responsible_lawyer_phone || '',
        line: c.responsible_lawyer_line || ''
      }])
    } else {
      setResponsibleLawyers([{ name: '', phone: '', line: '' }])
    }
    setResponsibleClerkName(c.responsible_clerk_name || '')
    setDrawerOpen(true)
    setDetailOpen(false) // Close modal if open
  }

  // Submit Add / Edit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) {
      toast.error('กรุณาเลือกหรือเพิ่มลูกความก่อนสร้างคดี')
      return
    }
    const activeLawyers = responsibleLawyers.filter(l => l.name.trim() !== '')
    if (activeLawyers.length === 0) {
      toast.error('กรุณาระบุทนายความผู้รับผิดชอบคดีอย่างน้อย 1 ท่าน')
      return
    }
    setSubmitting(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
      const method = isEditing ? 'PUT' : 'POST'
      const url = isEditing ? `${apiUrl}/cases/${editId}` : `${apiUrl}/cases/`

      const body = {
        title,
        description: description || null,
        category,
        client_id: clientId,
        priority,
        status,
        court_name: courtName || null,
        court_case_number: courtCaseNumber || null,
        court_date: courtDate || null,
        responsible_clerk_name: responsibleClerkName || null,
        responsible_lawyers: activeLawyers
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || 'บันทึกข้อมูลไม่สำเร็จ')
      }

      toast.success(isEditing ? 'แก้ไขข้อมูลคดีความสำเร็จ' : 'เปิดคดีความใหม่สำเร็จ')
      setDrawerOpen(false)
      fetchCases()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Quick Status Patch
  const handleStatusPatch = async (caseId: string, newStatus: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
      const res = await fetch(`${apiUrl}/cases/${caseId}/status?status=${newStatus}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!res.ok) throw new Error('ไม่สามารถอัปเดตสถานะคดีได้')

      toast.success('อัปเดตสถานะคดีเรียบร้อย')
      if (selectedCase && selectedCase.id === caseId) {
        setSelectedCase({ ...selectedCase, status: newStatus })
      }
      fetchCases()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Delete Request
  const handleDeleteRequest = (id: string) => {
    setDeleteId(id)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteId) return
    setDeleteLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
      const res = await fetch(`${apiUrl}/cases/${deleteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!res.ok) throw new Error('ลบคดีออกจากระบบไม่สำเร็จ')

      toast.success('ลบประวัติคดีความเรียบร้อย')
      setDeleteConfirmOpen(false)
      setDetailOpen(false)
      fetchCases()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDeleteLoading(false)
      setDeleteId(null)
    }
  }

  const totalPages = Math.ceil(total / limit)

  // Status summaries mapping
  const statsSummary = [
    { label: 'กำลังดำเนินการ', count: dashboardStats?.cases_by_status?.['กำลังดำเนินการ'] || 0, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'รอพิจารณา', count: dashboardStats?.cases_by_status?.['รอพิจารณา'] || 0, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { label: 'รับเรื่องใหม่', count: dashboardStats?.cases_by_status?.['รับเรื่องใหม่'] || 0, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { label: 'เร่งด่วน', count: cases.filter(c => c.priority === 'urgent').length, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  ]

  return (
    <div className="space-y-6 animate-fade-in relative min-h-screen pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Scale className="w-7 h-7 text-primary-400" />
            จัดการคดี (Case Management)
          </h1>
          <p className="text-slate-400 text-sm mt-1">คดีทั้งหมด {total} คดี</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="btn-primary flex items-center gap-2 self-start hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          เปิดคดีใหม่
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statsSummary.map(s => (
          <div key={s.label} className={`${s.color} rounded-xl p-4 text-center border`}>
            <div className="text-3xl font-bold">{s.count}</div>
            <div className="text-xs text-slate-400 mt-1.5 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="input-field pl-10"
            placeholder="ค้นหาคดี, เลขคดี, ชื่อศาล, ชื่อลูกความ..."
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            ['all', 'ทั้งหมด'],
            ['intake', 'รับเรื่องใหม่'],
            ['active', 'กำลังดำเนินการ'],
            ['pending', 'รอพิจารณา'],
            ['closed', 'ปิดคดี']
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => {
                setFilterStatus(val)
                setPage(1)
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap
                ${filterStatus === val ? 'bg-primary-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table grid */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
            <span className="text-sm text-slate-400">กำลังโหลดรายชื่อคดี...</span>
          </div>
        </div>
      ) : cases.length > 0 ? (
        <div className="card overflow-x-auto border-white/5 bg-dark-surface">
          <table className="data-table">
            <thead>
              <tr>
                <th>เลขคดี</th>
                <th>ชื่อคดี</th>
                <th>ลูกความ</th>
                <th>หมวด</th>
                <th>ความสำคัญ</th>
                <th>สถานะ</th>
                <th>ผู้รับผิดชอบ</th>
                <th>วันนัดศาล</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr
                  key={c.id}
                  onClick={() => handleViewDetails(c)}
                  className="cursor-pointer hover:bg-white/2 transition-colors"
                >
                  <td className="font-mono text-xs text-slate-400">{c.case_number}</td>
                  <td>
                    <span className="text-white font-medium hover:text-primary-300 transition-colors line-clamp-1">
                      {c.title}
                    </span>
                  </td>
                  <td className="text-slate-400 text-sm whitespace-nowrap">{c.client_name || 'ไม่ระบุ'}</td>
                  <td>
                    <span className="badge bg-white/5 text-slate-400 border-white/10 text-xs">{c.category || 'อื่นๆ'}</span>
                  </td>
                  <td>
                    <span className={`badge text-xs ${priorityMap[c.priority]?.cls || 'bg-white/5 text-slate-400'}`}>
                      {priorityMap[c.priority]?.label || 'ปานกลาง'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge text-xs ${statusMap[c.status]?.cls || 'bg-white/5 text-slate-400'}`}>
                      {statusMap[c.status]?.label || 'รับเรื่องใหม่'}
                    </span>
                  </td>
                  <td>
                    <span className="text-slate-300 text-xs truncate max-w-[130px] block" title={
                      c.responsible_lawyers && c.responsible_lawyers.length > 0
                        ? c.responsible_lawyers.map(l => l.name).join(', ')
                        : c.responsible_lawyer_name || '-'
                    }>
                      {c.responsible_lawyers && c.responsible_lawyers.length > 0
                        ? c.responsible_lawyers.map(l => l.name).join(', ')
                        : c.responsible_lawyer_name || '-'}
                    </span>
                  </td>
                  <td>
                    {c.court_date ? (
                      <div className="flex items-center gap-1.5 text-xs text-amber-400 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(c.court_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-20 bg-white/2 border border-white/5 rounded-2xl">
          <Scale className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
          <p className="text-slate-400">ไม่พบคดีความในระบบ</p>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-slate-400 text-sm px-4">
            หน้า {page} จากทั้งหมด {totalPages} หน้า
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Drawer: Add / Edit Case */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-dark-surface border-l border-dark-border text-white shadow-2xl flex flex-col justify-between">
              {/* Header */}
              <div className="px-6 py-5 border-b border-dark-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {isEditing ? 'แก้ไขข้อมูลคดีความ' : 'เปิดคดีความใหม่'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">กรอกรายละเอียดพยานหลักฐาน ข้อกล่าวหา และข้อมูลชั้นศาล</p>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <label className="block text-sm text-slate-300 font-medium mb-1.5">ชื่อเรื่องคดีความ *</label>
                  <input
                    required
                    className="input-field"
                    placeholder="ระบุชื่อเรื่อง เช่น ฟ้องผิดสัญญาเงินกู้, พิพาทโฉนดที่ดินทับซ้อน"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-300 font-medium mb-1.5">เลือกหรือเชื่อมโยงลูกความ (CRM) *</label>
                  <select
                    required
                    className="input-field focus:bg-dark-surface"
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                  >
                    <option value="" disabled>-- เลือกรายชื่อลูกความ --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.client_code})
                      </option>
                    ))}
                  </select>
                  {clients.length === 0 && (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      กรุณาไปลงทะเบียนสร้างประวัติลูกความใน CRM ก่อนเชื่อมโยงคดี
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">หมวดหมู่คดีความ</label>
                    <select
                      className="input-field focus:bg-dark-surface"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                    >
                      {categoryOptions.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">ลำดับความสำคัญ</label>
                    <select
                      className="input-field focus:bg-dark-surface"
                      value={priority}
                      onChange={e => setPriority(e.target.value)}
                    >
                      <option value="low">🟢 ต่ำ (Low)</option>
                      <option value="medium">🟡 ปานกลาง (Medium)</option>
                      <option value="high">🟠 สูง (High)</option>
                      <option value="urgent">🔴 เร่งด่วนมาก (Urgent)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">สถานะคดีความ</label>
                    <select
                      className="input-field focus:bg-dark-surface"
                      value={status}
                      onChange={e => setStatus(e.target.value)}
                    >
                      <option value="intake">📁 รับเรื่องใหม่ (Intake)</option>
                      <option value="active">⚖️ กำลังดำเนินคดี (Active)</option>
                      <option value="pending">⏳ รอพิจารณาคดี (Pending)</option>
                      <option value="closed">💼 ปิดคดีความแล้ว (Closed)</option>
                      <option value="won">🏆 ชนะคดี (Won)</option>
                      <option value="lost">💔 แพ้คดี (Lost)</option>
                      <option value="settled">🤝 ไกล่เกลี่ยเรียบร้อย (Settled)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">วันนัดสืบพยาน/ไต่สวนศาล</label>
                    <input
                      type="date"
                      className="input-field"
                      value={courtDate}
                      onChange={e => setCourtDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">สถานที่ยื่นฟ้อง / ศาล</label>
                    <input
                      className="input-field"
                      placeholder="ศาลแพ่งกรุงเทพใต้, ศาลตลิ่งชัน"
                      value={courtName}
                      onChange={e => setCourtName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">เลขคดีดำ / คดีแดง</label>
                    <input
                      className="input-field"
                      placeholder="พ.123/2568, อ.456/2568"
                      value={courtCaseNumber}
                      onChange={e => setCourtCaseNumber(e.target.value)}
                    />
                  </div>
                </div>

                {/* Responsible Persons */}
                <div className="border border-white/5 bg-white/2 rounded-2xl p-4 space-y-4">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary-400" /> ผู้รับผิดชอบคดี (Assigned Team)
                    </span>
                    <button
                      type="button"
                      onClick={() => setResponsibleLawyers([...responsibleLawyers, { name: '', phone: '', line: '' }])}
                      className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> เพิ่มทนายความ
                    </button>
                  </h3>

                  <div className="space-y-4">
                    {responsibleLawyers.map((lawyer, idx) => (
                      <div key={idx} className="p-3 bg-white/3 border border-white/5 rounded-xl space-y-3 relative group/lawyer">
                        {responsibleLawyers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setResponsibleLawyers(responsibleLawyers.filter((_, i) => i !== idx))}
                            className="absolute top-2 right-2 text-slate-500 hover:text-red-400 p-1 rounded-lg hover:bg-white/5 transition-all opacity-0 group-hover/lawyer:opacity-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <div className="text-[10px] font-semibold text-primary-400/80">ทนายความท่านที่ {idx + 1}</div>
                        <div>
                          <label className="block text-xs text-slate-300 font-medium mb-1">ชื่อ-นามสกุลทนายความ *</label>
                          <input
                            required
                            className="input-field py-1.5 text-sm"
                            placeholder="ชื่อ-นามสกุลทนายความ"
                            value={lawyer.name}
                            onChange={e => {
                              const updated = [...responsibleLawyers]
                              updated[idx].name = e.target.value
                              setResponsibleLawyers(updated)
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-300 font-medium mb-1">เบอร์โทรศัพท์ติดต่อ</label>
                            <input
                              className="input-field py-1.5 text-sm"
                              placeholder="เช่น 081-XXXXXXX"
                              value={lawyer.phone || ''}
                              onChange={e => {
                                const updated = [...responsibleLawyers]
                                updated[idx].phone = e.target.value
                                setResponsibleLawyers(updated)
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-300 font-medium mb-1">Line ID สำหรับติดต่อ</label>
                            <input
                              className="input-field py-1.5 text-sm"
                              placeholder="เช่น @lawyer_line"
                              value={lawyer.line || ''}
                              onChange={e => {
                                const updated = [...responsibleLawyers]
                                updated[idx].line = e.target.value
                                setResponsibleLawyers(updated)
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="pt-2 border-t border-white/5">
                      <label className="block text-xs text-slate-300 font-medium mb-1">เสมียน / ผู้ช่วยทนายรับผิดชอบ</label>
                      <input
                        className="input-field py-1.5 text-sm"
                        placeholder="ชื่อเสมียนหรือผู้ช่วยทนายความประจำคดี"
                        value={responsibleClerkName}
                        onChange={e => setResponsibleClerkName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-300 font-medium mb-1.5">รายละเอียดคำร้องพยานและคดีความ</label>
                  <textarea
                    rows={6}
                    className="input-field py-3"
                    placeholder="ระบุข้อเท็จจริง ข้อกฎหมาย ประเด็นพิพาท และรายการพยานหลักฐาน..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>

                {/* Form Buttons */}
                <div className="pt-4 border-t border-white/5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5 font-medium transition-all text-center text-slate-300"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 btn-primary py-3 font-semibold flex items-center justify-center gap-2 hover:scale-[1.01]"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'บันทึกข้อมูลคดี'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Case Details Modal */}
      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDetailOpen(false)} />
          
          <div className="relative w-full max-w-4xl bg-dark-surface border border-dark-border text-white shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-dark-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">รายละเอียดคดีความเชิงลึก</h2>
                  <p className="text-xs text-slate-400 mt-0.5">ข้อมูลชั้นศาล สรุปสำนวนคดีความ และสถานะการพิจารณา</p>
                </div>
              </div>
              <button
                onClick={() => setDetailOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {detailLoading ? (
                <div className="lg:col-span-3 py-20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                </div>
              ) : selectedCase ? (
                <>
                  {/* Left Column - Case Details */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="glass p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl" />
                      
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <span className="text-xs text-slate-500 font-mono tracking-wide uppercase">หมายเลขสำนวนคดี</span>
                          <h3 className="text-xl font-bold text-white mt-0.5">{selectedCase.title}</h3>
                          <span className="text-xs text-primary-300 font-mono font-medium">{selectedCase.case_number}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mt-5">
                        <div className="space-y-1">
                          <p className="text-slate-500 text-xs">หมวดหมู่ประเภทคดี</p>
                          <p className="text-white">{selectedCase.category || 'ไม่ระบุ'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-500 text-xs">วันนัดสืบพยาน / ศาลนัด</p>
                          <p className="text-white">
                            {selectedCase.court_date ? (
                              new Date(selectedCase.court_date).toLocaleDateString('th-TH', { dateStyle: 'long' })
                            ) : (
                              'ยังไม่มีกำหนดวันนัดหมาย'
                            )}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-500 text-xs">ศาลยื่นฟ้อง</p>
                          <p className="text-white">{selectedCase.court_name || 'ยังไม่ระบุ'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-500 text-xs">เลขคดีดำ / คดีแดง</p>
                          <p className="text-white font-mono">{selectedCase.court_case_number || 'ยังไม่ระบุ'}</p>
                        </div>
                      </div>

                      {selectedCase.description && (
                        <div className="mt-5 pt-4 border-t border-white/5 space-y-1.5">
                          <p className="text-slate-500 text-xs">รายละเอียดเหตุการณ์และสำนวนฟ้อง</p>
                          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                            {selectedCase.description}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* AI Case Summary block */}
                    {selectedCase.ai_summary && (
                      <div className="card border-purple-500/20 bg-purple-500/5 relative overflow-hidden">
                        <div className="absolute -top-6 -right-6 w-16 h-16 bg-purple-500/10 rounded-full blur" />
                        <h4 className="text-sm font-semibold text-purple-300 flex items-center gap-2 mb-2">
                          <Briefcase className="w-4 h-4 text-purple-400" />
                          AI สรุปสำนวนคดีอัตโนมัติ (AI Legal Summary)
                        </h4>
                        <p className="text-slate-300 text-sm leading-relaxed">
                          {selectedCase.ai_summary}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Client context & Actions */}
                  <div className="space-y-4">
                    {/* Linked Client profile summary */}
                    <div className="card bg-white/2 border-white/5 space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        ลูกความเจ้าของคดี (Client CRM)
                      </h4>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400">
                          {selectedCase.client_name ? selectedCase.client_name.charAt(0) : 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">{selectedCase.client_name || 'ไม่ระบุ'}</p>
                          <p className="text-[10px] text-slate-500">รหัสลูกความในระบบ</p>
                        </div>
                      </div>
                      
                      <Link href="/clients" className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-white/5 hover:border-blue-500/20 hover:bg-blue-500/5 text-xs text-blue-400 font-semibold transition-all">
                        <LinkIcon className="w-3.5 h-3.5" />
                        เปิดโปรไฟล์ลูกความ CRM
                      </Link>
                    </div>

                    {/* Responsible Case Team Card */}
                    <div className="card bg-white/2 border-white/5 space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-4 h-4 text-primary-400" />
                        ผู้รับผิดชอบคดี (Case Team)
                      </h4>

                      <div className="space-y-3.5 divide-y divide-white/5">
                        {/* Lawyer info */}
                        <div className="space-y-3">
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">ทนายความผู้รับผิดชอบ</p>
                          {selectedCase.responsible_lawyers && selectedCase.responsible_lawyers.length > 0 ? (
                            <div className="space-y-2">
                              {selectedCase.responsible_lawyers.map((lawyer, lIdx) => (
                                <div key={lIdx} className="flex items-start gap-2.5 bg-white/3 p-2.5 rounded-xl border border-white/5 relative">
                                  <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-xs font-bold text-red-400 flex-shrink-0 mt-0.5">
                                    ท{lIdx + 1}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-white leading-tight">
                                      {lawyer.name}
                                    </p>
                                    {lawyer.phone && (
                                      <p className="text-[10px] text-slate-400 font-mono mt-1">
                                        📞 โทร: {lawyer.phone}
                                      </p>
                                    )}
                                    {lawyer.line && (
                                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                        💬 Line: {lawyer.line}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-start gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-xs font-bold text-red-400 flex-shrink-0 mt-0.5">
                                ท
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-white leading-tight">
                                  {selectedCase.responsible_lawyer_name || 'ไม่ได้ระบุ'}
                                </p>
                                {selectedCase.responsible_lawyer_phone && (
                                  <p className="text-[10px] text-slate-400 font-mono mt-1">
                                    โทร: {selectedCase.responsible_lawyer_phone}
                                  </p>
                                )}
                                {selectedCase.responsible_lawyer_line && (
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    Line: {selectedCase.responsible_lawyer_line}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Clerk info */}
                        <div className="space-y-2 pt-3">
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">เสมียน / ผู้ช่วยทนาย</p>
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0 mt-0.5">
                              ส
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-white leading-tight">
                                {selectedCase.responsible_clerk_name || 'ไม่ได้ระบุ'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status Actions */}
                    <div className="card bg-white/2 border-white/5 space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          สถานะคดีและประเด็น
                        </h4>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 text-sm">สถานะคดีความ</span>
                          <span className={`badge text-sm ${statusMap[selectedCase.status]?.cls || 'bg-white/5 text-slate-400'}`}>
                            {statusMap[selectedCase.status]?.label || 'รับเรื่องใหม่'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/5">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          อัปเดตสถานะคดีความด่วน
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleStatusPatch(selectedCase.id, 'active')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-center"
                          >
                            เริ่มดำเนินการ
                          </button>
                          <button
                            onClick={() => handleStatusPatch(selectedCase.id, 'pending')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all text-center"
                          >
                            รอการพิจารณา
                          </button>
                          <button
                            onClick={() => handleStatusPatch(selectedCase.id, 'won')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-center"
                          >
                            ชนะคดี (Won)
                          </button>
                          <button
                            onClick={() => handleStatusPatch(selectedCase.id, 'closed')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-500/10 border border-white/10 text-slate-300 hover:bg-white/5 transition-all text-center"
                          >
                            ปิดคดีความ (Closed)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Admin management */}
                    <div className="card bg-white/2 border-white/5 space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        การจัดการข้อมูลคดี
                      </h4>
                      <button
                        onClick={() => handleOpenEdit(selectedCase)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 hover:border-primary-500/20 hover:bg-white/5 transition-all text-sm text-slate-300 font-semibold"
                      >
                        <Edit2 className="w-4 h-4 text-blue-400" />
                        แก้ไขสำนวนและพยาน
                      </button>
                      <button
                        onClick={() => handleDeleteRequest(selectedCase.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 hover:border-red-500/20 hover:bg-red-500/5 transition-all text-sm text-red-400 font-semibold"
                      >
                        <Trash2 className="w-4 h-4" />
                        ลบคดีความนี้
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-dark-border bg-white/2 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setDetailOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 font-semibold transition-all text-slate-300 text-sm"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirmOpen(false)} />
          
          <div className="relative w-full max-w-md bg-dark-surface border border-dark-border text-white shadow-2xl rounded-2xl overflow-hidden p-6 space-y-6">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold">ยืนยันการลบคดีความ</h3>
            </div>
            
            <p className="text-slate-300 text-sm leading-relaxed">
              การลบคดีความนี้จะลบข้อมูลออกจากระบบอย่างถาวร (รวมถึงรายละเอียดสำนวนศาลที่เกี่ยวข้อง) 
              คุณแน่ใจหรือไม่ว่าต้องการดำเนินต่อ?
            </p>
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 font-semibold transition-all text-slate-300 text-sm text-center"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-all text-sm flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'ยืนยันการลบ'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
