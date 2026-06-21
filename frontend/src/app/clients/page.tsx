'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Plus, Search, Phone, Mail, ChevronRight, X, Loader2,
  Edit2, Trash2, MapPin, Shield, Check, AlertCircle, Briefcase,
  Calendar, FileText, ChevronLeft, ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Client {
  id: string
  client_code: string
  full_name: string
  phone: string
  email: string
  service_type: string
  kyc_status: string
  occupation?: string
  company?: string
  tags: string[]
  created_at: string
}

interface ClientDetail extends Client {
  id_card: string
  address: string
  line_id: string
  notes: string
}

interface Case {
  id: string
  case_number: string
  title: string
  category: string
  status: string
  priority: string
  court_date?: string
}

export default function ClientsPage() {
  // Lists and stats
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [search, setSearch] = useState('')
  const [filterService, setFilterService] = useState('all')
  const [loading, setLoading] = useState(true)

  // Drawer (Add / Edit) state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  
  // Drawer form fields
  const [fullName, setFullName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [lineId, setLineId] = useState('')
  const [serviceType, setServiceType] = useState('free')
  const [kycStatus, setKycStatus] = useState('pending')
  const [occupation, setOccupation] = useState('')
  const [company, setCompany] = useState('')
  const [notes, setNotes] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Details Modal state
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null)
  const [clientCases, setClientCases] = useState<Case[]>([])
  const [casesLoading, setCasesLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  // Delete Confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

  // Fetch clients callback
  const fetchClients = useCallback(async () => {
    try {
      setLoading(true)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
      
      let url = `${apiUrl}/clients/?page=${page}&limit=${limit}`
      if (search) url += `&search=${encodeURIComponent(search)}`
      if (filterService !== 'all') url += `&service_type=${filterService}`

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!res.ok) throw new Error('ไม่สามารถโหลดข้อมูลลูกความได้')
      
      const data = await res.json()
      setClients(data.data || [])
      setTotal(data.total || 0)
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, filterService, token])

  useEffect(() => {
    if (token) {
      fetchClients()
    }
  }, [fetchClients, token])

  // Fetch client details & cases
  const handleViewDetails = async (client: Client) => {
    try {
      setDetailOpen(true)
      setDetailLoading(true)
      setCasesLoading(true)
      setSelectedClient(null)
      setClientCases([])

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

      // 1. Fetch full details
      const clientRes = await fetch(`${apiUrl}/clients/${client.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!clientRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลประวัติลูกค้าได้')
      const clientData = await clientRes.json()
      setSelectedClient(clientData)
      setDetailLoading(false)

      // 2. Fetch associated cases
      const casesRes = await fetch(`${apiUrl}/cases/?client_id=${client.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (casesRes.ok) {
        const casesData = await casesRes.json()
        setClientCases(casesData.data || [])
      }
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
      setCasesLoading(false)
    }
  }

  // Open drawer for adding
  const handleOpenAdd = () => {
    setIsEditing(false)
    setEditId(null)
    setFullName('')
    setIdCard('')
    setPhone('')
    setEmail('')
    setAddress('')
    setLineId('')
    setServiceType('free')
    setKycStatus('pending')
    setOccupation('')
    setCompany('')
    setNotes('')
    setTagsInput('')
    setDrawerOpen(true)
  }

  // Open drawer for editing
  const handleOpenEdit = (client: ClientDetail) => {
    setIsEditing(true)
    setEditId(client.id)
    setFullName(client.full_name || '')
    setIdCard(client.id_card || '')
    setPhone(client.phone || '')
    setEmail(client.email || '')
    setAddress(client.address || '')
    setLineId(client.line_id || '')
    setServiceType(client.service_type || 'free')
    setKycStatus(client.kyc_status || 'pending')
    setOccupation(client.occupation || '')
    setCompany(client.company || '')
    setNotes(client.notes || '')
    setTagsInput(client.tags ? client.tags.join(', ') : '')
    setDrawerOpen(true)
    setDetailOpen(false) // Close details modal if open
  }

  // Submit Drawer Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
      const method = isEditing ? 'PUT' : 'POST'
      const url = isEditing ? `${apiUrl}/clients/${editId}` : `${apiUrl}/clients/`
      
      const parsedTags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)

      const body = {
        full_name: fullName,
        id_card: idCard || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        line_id: lineId || null,
        service_type: serviceType,
        kyc_status: kycStatus,
        occupation: occupation || null,
        company: company || null,
        notes: notes || null,
        tags: parsedTags
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

      toast.success(isEditing ? 'แก้ไขข้อมูลลูกความเรียบร้อย' : 'เพิ่มลูกความใหม่เรียบร้อย')
      setDrawerOpen(false)
      fetchClients()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Quick KYC Toggle
  const handleKycToggle = async (client: ClientDetail, status: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
      const res = await fetch(`${apiUrl}/clients/${client.id}/kyc?kyc_status=${status}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!res.ok) throw new Error('ไม่สามารถอัปเดตสถานะ KYC ได้')

      toast.success('อัปเดตสถานะ KYC เรียบร้อย')
      
      // Update local state in view details
      setSelectedClient({ ...client, kyc_status: status })
      fetchClients()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Soft Delete Request
  const handleDeleteRequest = (id: string) => {
    setDeleteId(id)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteId) return
    setDeleteLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
      const res = await fetch(`${apiUrl}/clients/${deleteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!res.ok) throw new Error('ลบข้อมูลลูกความไม่สำเร็จ')

      toast.success('ลบข้อมูลลูกความเรียบร้อย')
      setDeleteConfirmOpen(false)
      setDetailOpen(false)
      fetchClients()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDeleteLoading(false)
      setDeleteId(null)
    }
  }

  // Pagination calculation
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6 animate-fade-in relative min-h-screen pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-400" />
            จัดการลูกความ (CRM)
          </h1>
          <p className="text-slate-400 text-sm mt-1">ลูกความในระบบทั้งหมด {total} ราย</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="btn-primary flex items-center gap-2 self-start hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          เพิ่มลูกความใหม่
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="input-field pl-10 bg-white/5 border-white/10 text-white focus:border-primary-500/50"
            placeholder="ค้นหาชื่อลูกความ, เบอร์โทรศัพท์, อีเมล..."
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(1) // Reset page on search
            }}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            ['all', 'ทั้งหมด'],
            ['private', '⭐ Private'],
            ['retainer', '💼 Retainer'],
            ['free', 'Free']
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => {
                setFilterService(val)
                setPage(1) // Reset page
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap
                ${filterService === val ? 'bg-primary-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Client List */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
            <span className="text-sm text-slate-400">กำลังโหลดรายชื่อลูกความ...</span>
          </div>
        </div>
      ) : clients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map(client => (
            <div
              key={client.id}
              onClick={() => handleViewDetails(client)}
              className="card hover:border-primary-500/30 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary-300">
                        {client.full_name ? client.full_name.charAt(0) : 'U'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-primary-300 transition-colors line-clamp-1">
                        {client.full_name}
                      </h3>
                      <p className="text-xs text-slate-500">{client.client_code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${
                      client.service_type === 'private' ? 'badge-private' :
                      client.service_type === 'retainer' ? 'badge-active bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'badge-free'
                    }`}>
                      {client.service_type === 'private' ? '⭐ Private' :
                       client.service_type === 'retainer' ? '💼 Retainer' : 'Free'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-400">
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {(client.occupation || client.company) && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                      <span className="truncate">
                        {client.occupation || ''} {client.company ? `@ ${client.company}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 flex-wrap">
                {client.tags && client.tags.map(tag => (
                  <span key={tag} className="badge bg-white/5 text-slate-400 border-white/10">{tag}</span>
                ))}
                <span className={`badge ml-auto ${client.kyc_status === 'verified' ? 'badge-active' : 'badge-pending'}`}>
                  {client.kyc_status === 'verified' ? '✓ ยืนยันแล้ว' : '⏳ รอยืนยัน'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white/2 border border-white/5 rounded-2xl">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
          <p className="text-slate-400">ไม่พบลูกความในระบบ</p>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
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

      {/* Drawer: Add / Edit Client */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-dark-surface border-l border-dark-border text-white shadow-2xl flex flex-col justify-between">
              {/* Header */}
              <div className="px-6 py-5 border-b border-dark-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {isEditing ? 'แก้ไขข้อมูลลูกความ' : 'เพิ่มลูกความใหม่'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">กรอกประวัติและข้อมูลประกอบการดำเนินคดี</p>
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
                  <label className="block text-sm text-slate-300 font-medium mb-1.5">ชื่อ-นามสกุล *</label>
                  <input
                    required
                    className="input-field"
                    placeholder="นาย/นาง/นางสาว สมจริง มีสุข"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">เลขบัตรประชาชน (13 หลัก)</label>
                    <input
                      maxLength={13}
                      className="input-field"
                      placeholder="1100123456789"
                      value={idCard}
                      onChange={e => setIdCard(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">เบอร์โทรศัพท์ *</label>
                    <input
                      required
                      className="input-field"
                      placeholder="0812345678"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">อีเมล</label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="client@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">LINE ID</label>
                    <input
                      className="input-field"
                      placeholder="line_id"
                      value={lineId}
                      onChange={e => setLineId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">อาชีพ</label>
                    <input
                      className="input-field"
                      placeholder="ข้าราชการ, ค้าขาย"
                      value={occupation}
                      onChange={e => setOccupation(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">สถานที่ทำงาน / บริษัท</label>
                    <input
                      className="input-field"
                      placeholder="บริษัท จำกัด (มหาชน)"
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-300 font-medium mb-1.5">ที่อยู่ปัจจุบัน</label>
                  <textarea
                    rows={3}
                    className="input-field py-3"
                    placeholder="บ้านเลขที่ ถนน แขวง เขต จังหวัด..."
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">ระดับแพ็คเกจบริการ</label>
                    <select
                      className="input-field focus:bg-dark-surface"
                      value={serviceType}
                      onChange={e => setServiceType(e.target.value)}
                    >
                      <option value="free">Free Account</option>
                      <option value="private">⭐ Private Customer</option>
                      <option value="retainer">💼 Retainer Contract</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 font-medium mb-1.5">สถานะ KYC</label>
                    <select
                      className="input-field focus:bg-dark-surface"
                      value={kycStatus}
                      onChange={e => setKycStatus(e.target.value)}
                    >
                      <option value="pending">⏳ รอยืนยันตน (Pending)</option>
                      <option value="verified">✓ ยืนยันเรียบร้อย (Verified)</option>
                      <option value="rejected">✗ ปฏิเสธ (Rejected)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-300 font-medium mb-1.5">ป้ายกำกับ Tags (คั่นด้วยจุลภาค ",")</label>
                  <input
                    className="input-field"
                    placeholder="ลูกความสำคัญ, หนี้สิน, ที่ดิน"
                    value={tagsInput}
                    onChange={e => setTagsInput(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-300 font-medium mb-1.5">บันทึกเพิ่มเติม</label>
                  <textarea
                    rows={4}
                    className="input-field py-3"
                    placeholder="ระบุโน้ตสำคัญเกี่ยวกับความสัมพันธ์หรือเงื่อนไขพิเศษ..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                {/* Submit button inside overflow */}
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
                      'บันทึกข้อมูล'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDetailOpen(false)} />
          
          <div className="relative w-full max-w-4xl bg-dark-surface border border-dark-border text-white shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-dark-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">รายละเอียดข้อมูลลูกความ</h2>
                  <p className="text-xs text-slate-400 mt-0.5">ข้อมูลประวัติ ประวัติคดีความ และสถานะ KYC</p>
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
              ) : selectedClient ? (
                <>
                  {/* Left Column - Profile Details */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="glass p-5 rounded-2xl border border-white/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl" />
                      
                      <div className="flex items-center gap-4 mb-5">
                        <div className="w-14 h-14 rounded-2xl bg-primary-600/30 border border-primary-500/40 flex items-center justify-center text-2xl font-bold text-primary-300">
                          {selectedClient.full_name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{selectedClient.full_name}</h3>
                          <span className="text-xs text-slate-500 font-mono">{selectedClient.client_code}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-slate-500 text-xs">เลขบัตรประจำตัวประชาชน</p>
                          <p className="text-white font-mono">{selectedClient.id_card || 'ไม่ระบุ'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-500 text-xs">เบอร์โทรศัพท์</p>
                          <p className="text-white">{selectedClient.phone || 'ไม่ระบุ'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-500 text-xs">อีเมล</p>
                          <p className="text-white truncate">{selectedClient.email || 'ไม่ระบุ'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-500 text-xs">LINE ID</p>
                          <p className="text-white font-mono">{selectedClient.line_id || 'ไม่ระบุ'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-500 text-xs">อาชีพ / แหล่งรายได้</p>
                          <p className="text-white">{selectedClient.occupation || 'ไม่ระบุ'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-500 text-xs">สถานที่ทำงาน / บริษัท</p>
                          <p className="text-white">{selectedClient.company || 'ไม่ระบุ'}</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/5 space-y-1">
                        <p className="text-slate-500 text-xs">ที่อยู่ปัจจุบัน</p>
                        <p className="text-white text-sm leading-relaxed">{selectedClient.address || 'ไม่ระบุ'}</p>
                      </div>
                    </div>

                    {/* Notes block */}
                    {selectedClient.notes && (
                      <div className="card border-amber-500/20 bg-amber-500/5">
                        <h4 className="text-sm font-semibold text-amber-300 flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4" />
                          บันทึกสำคัญเกี่ยวกับลูกความ
                        </h4>
                        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                          {selectedClient.notes}
                        </p>
                      </div>
                    )}

                    {/* Associated Cases list */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary-400" />
                        คดีความที่เกี่ยวข้องกับลูกความคนนี้ ({clientCases.length} คดี)
                      </h4>

                      {casesLoading ? (
                        <div className="py-8 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                        </div>
                      ) : clientCases.length > 0 ? (
                        <div className="space-y-2">
                          {clientCases.map(c => (
                            <Link href="/cases" key={c.id}>
                              <div className="flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/5 hover:border-primary-500/20 hover:bg-white/5 transition-all group">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-white truncate group-hover:text-primary-300 transition-colors">
                                    {c.title}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1 font-mono">{c.case_number}</p>
                                </div>
                                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                                  <span className="badge bg-white/5 text-slate-400 border-white/10">
                                    {c.category}
                                  </span>
                                  <span className={`badge ${
                                    c.status === 'กำลังดำเนินการ' || c.status === 'active' ? 'badge-active' :
                                    c.status === 'รอพิจารณา' || c.status === 'pending' ? 'badge-pending' : 'badge-closed'
                                  }`}>
                                    {c.status === 'กำลังดำเนินการ' || c.status === 'active' ? 'กำลังดำเนินการ' :
                                     c.status === 'รอพิจารณา' || c.status === 'pending' ? 'รอพิจารณา' : 'ปิดคดีแล้ว'}
                                  </span>
                                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-transform group-hover:translate-x-1" />
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-white/2 border border-white/5 rounded-xl">
                          <p className="text-xs text-slate-500">ยังไม่มีประวัติคดีความในระบบ</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - Statuses, Admin actions */}
                  <div className="space-y-4">
                    {/* Package Status card */}
                    <div className="card bg-white/2 border-white/5 space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          ประเภทแพ็คเกจและสัญญา
                        </h4>
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">ระดับการบริการ</span>
                          <span className={`badge text-sm ${
                            selectedClient.service_type === 'private' ? 'badge-private' :
                            selectedClient.service_type === 'retainer' ? 'badge-active bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'badge-free'
                          }`}>
                            {selectedClient.service_type === 'private' ? '⭐ Private client' :
                             selectedClient.service_type === 'retainer' ? '💼 Retainer client' : 'Free client'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                          ตรวจสอบยืนยันตัวตน (KYC)
                        </h4>
                        <div className="flex items-center gap-3">
                          <span className={`badge text-sm ${selectedClient.kyc_status === 'verified' ? 'badge-active' : 'badge-pending'}`}>
                            {selectedClient.kyc_status === 'verified' ? '✓ ยืนยันแล้ว' : '⏳ รอการยืนยันตน'}
                          </span>
                        </div>

                        {/* KYC operations */}
                        <div className="grid grid-cols-2 gap-2 mt-4">
                          <button
                            onClick={() => handleKycToggle(selectedClient, 'verified')}
                            className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            ยืนยันตัวตน
                          </button>
                          <button
                            onClick={() => handleKycToggle(selectedClient, 'rejected')}
                            className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            ปฏิเสธ KYC
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Action Panel */}
                    <div className="card bg-white/2 border-white/5 space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        การจัดการลูกความ
                      </h4>
                      <button
                        onClick={() => handleOpenEdit(selectedClient)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 hover:border-primary-500/20 hover:bg-white/5 transition-all text-sm text-slate-300 font-semibold"
                      >
                        <Edit2 className="w-4 h-4 text-blue-400" />
                        แก้ไขข้อมูลประวัติ
                      </button>
                      <button
                        onClick={() => handleDeleteRequest(selectedClient.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 hover:border-red-500/20 hover:bg-red-500/5 transition-all text-sm text-red-400 font-semibold"
                      >
                        <Trash2 className="w-4 h-4" />
                        ลบข้อมูลลูกความ
                      </button>
                    </div>

                    {/* Metadata */}
                    <div className="text-slate-600 text-xs px-2 space-y-1">
                      <p>วันที่ลงทะเบียน: {new Date(selectedClient.created_at).toLocaleDateString('th-TH', { dateStyle: 'long' })}</p>
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
              <h3 className="text-lg font-bold">ยืนยันการลบลูกความ</h3>
            </div>
            
            <p className="text-slate-300 text-sm leading-relaxed">
              การลบข้อมูลจะเป็นการลบแบบ Soft Delete ซึ่งจะปิดการใช้งานโปรไฟล์ของลูกความรายนี้ และยกเลิกการแสดงผล 
              คุณแน่ใจหรือไม่ว่าต้องการดำเนินการต่อ?
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
