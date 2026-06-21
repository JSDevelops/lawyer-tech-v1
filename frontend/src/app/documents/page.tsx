'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  FolderOpen, Upload, Plus, FileText, Search, Filter,
  BookOpen, Edit, Trash2, Cpu, Download, Eye, X, Check,
  AlertCircle, ChevronRight, RefreshCw, LayoutGrid, List, FileCode,
  FileCheck, HelpCircle, User, Briefcase, Calendar, CheckSquare
} from 'lucide-react'

// ==============================
// Types
// ==============================
interface DocumentItem {
  id: string
  file_name: string
  original_name: string
  file_type: string
  mime_type: string
  file_size: number
  storage_url: string
  storage_key: string
  is_template: boolean
  template_name?: string
  ai_summary?: string
  extracted_text?: string
  client_id?: string
  client_name?: string
  case_id?: string
  case_title?: string
  case_number?: string
  uploaded_by_id?: string
  created_at: string
}

interface ClientItem {
  id: string
  full_name: string
  email?: string
}

interface CaseItem {
  id: string
  title: string
  case_number: string
}

interface TemplateItem {
  id: string
  name: string
  type: string
  icon: string
}

// ==============================
// Constants & Config
// ==============================
const BACKEND = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1')
  : 'http://localhost:8000/api/v1'

const DOC_TYPES = [
  'คำฟ้อง', 'สัญญา', 'หนังสือมอบอำนาจ', 'หลักฐาน',
  'คำสั่งศาล', 'ใบแจ้งหนี้', 'แม่แบบ', 'อื่นๆ'
]

const TYPE_COLORS: Record<string, { badge: string; text: string; bg: string }> = {
  'คำฟ้อง':           { badge: 'bg-red-500/20 text-red-300 border-red-500/30', text: 'text-red-400', bg: 'bg-red-500/10' },
  'สัญญา':           { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  'หนังสือมอบอำนาจ': { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  'หลักฐาน':          { badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30', text: 'text-blue-400', bg: 'bg-blue-500/10' },
  'คำสั่งศาล':         { badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30', text: 'text-purple-400', bg: 'bg-purple-500/10' },
  'ใบแจ้งหนี้':         { badge: 'bg-pink-500/20 text-pink-300 border-pink-500/30', text: 'text-pink-400', bg: 'bg-pink-500/10' },
  'แม่แบบ':          { badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', text: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  'อื่นๆ':            { badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30', text: 'text-slate-400', bg: 'bg-slate-500/10' }
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [clients, setClients] = useState<ClientItem[]>([])
  const [cases, setCases] = useState<CaseItem[]>([])
  const [templates, setTemplates] = useState<TemplateItem[]>([])

  // UI States
  const [activeTab, setActiveTab] = useState<'all_docs' | 'ai_draft' | 'templates'>('all_docs')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterCase, setFilterCase] = useState('')

  // Selected details sidebar
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null)

  // Modals
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null)

  // Form states
  const [uploadForm, setUploadForm] = useState<{
    file: File | null
    file_type: string
    client_id: string
    case_id: string
  }>({
    file: null,
    file_type: 'อื่นๆ',
    client_id: '',
    case_id: ''
  })

  const [editForm, setEditForm] = useState({
    file_name: '',
    file_type: 'อื่นๆ',
    client_id: '',
    case_id: ''
  })

  const [draftForm, setDraftForm] = useState({
    template_type: 'contract',
    client_name: '',
    case_details: '',
    additional_info: '',
    client_id: '',
    case_id: ''
  })

  const [draftResult, setDraftResult] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // ------------------------------------------
  // API Fetch wrappers
  // ------------------------------------------
  const fetchAllData = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    const token = localStorage.getItem('access_token')
    if (!token) {
      setErrorMsg('กรุณาเข้าสู่ระบบก่อนดำเนินการ')
      setLoading(false)
      return
    }

    try {
      // 1. Fetch Documents
      const docRes = await fetch(`${BACKEND}/documents/`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (docRes.ok) {
        const dJson = await docRes.json()
        setDocuments(dJson.data || [])
      }

      // 2. Fetch Clients (CRM)
      const clientRes = await fetch(`${BACKEND}/clients/?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (clientRes.ok) {
        const cJson = await clientRes.json()
        setClients(cJson.data || [])
      }

      // 3. Fetch Cases
      const caseRes = await fetch(`${BACKEND}/cases/?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (caseRes.ok) {
        const csJson = await caseRes.json()
        setCases(csJson.data || [])
      }

      // 4. Fetch Templates
      const templateRes = await fetch(`${BACKEND}/documents/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (templateRes.ok) {
        const tJson = await templateRes.json()
        setTemplates(tJson.data || [])
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg('ไม่สามารถดึงข้อมูลระบบเอกสารได้')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab === 'ai_draft' || tab === 'templates' || tab === 'all_docs') {
        setActiveTab(tab as any)
      }
    }
  }, [])

  // File formatting helper
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  // ------------------------------------------
  // Document Operations
  // ------------------------------------------
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadForm.file) {
      setErrorMsg('กรุณาเลือกไฟล์ที่ต้องการอัปโหลด')
      return
    }

    setUploading(true)
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const formData = new FormData()
      formData.append('file', uploadForm.file)
      formData.append('file_type', uploadForm.file_type)
      if (uploadForm.client_id) formData.append('client_id', uploadForm.client_id)
      if (uploadForm.case_id) formData.append('case_id', uploadForm.case_id)

      const res = await fetch(`${BACKEND}/documents/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      const result = await res.json()
      if (res.ok) {
        setSuccessMsg('อัปโหลดไฟล์สำเร็จ!')
        setDocuments(prev => [result.data, ...prev])
        setUploadOpen(false)
        setUploadForm({ file: null, file_type: 'อื่นๆ', client_id: '', case_id: '' })
      } else {
        setErrorMsg(result.detail || 'อัปโหลดล้มเหลว')
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setUploading(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDoc) return

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/documents/${editingDoc.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      })

      const result = await res.json()
      if (res.ok) {
        setSuccessMsg('แก้ไขข้อมูลเอกสารสำเร็จ!')
        setDocuments(prev => prev.map(d => d.id === editingDoc.id ? result.data : d))
        if (selectedDoc?.id === editingDoc.id) {
          setSelectedDoc(result.data)
        }
        setEditOpen(false)
        setEditingDoc(null)
      } else {
        setErrorMsg(result.detail || 'แก้ไขข้อมูลล้มเหลว')
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบเอกสารนี้ออกจากระบบ?')) return

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        setSuccessMsg('ลบเอกสารออกจากระบบสำเร็จ')
        setDocuments(prev => prev.filter(d => d.id !== id))
        if (selectedDoc?.id === id) {
          setSelectedDoc(null)
        }
      } else {
        const errJson = await res.json()
        setErrorMsg(errJson.detail || 'ลบข้อมูลล้มเหลว')
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการลบข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async (id: string) => {
    setAnalyzing(true)
    setErrorMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/documents/${id}/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const result = await res.json()
      if (res.ok) {
        setDocuments(prev => prev.map(d => d.id === id ? { ...d, ai_summary: result.ai_summary } : d))
        if (selectedDoc?.id === id) {
          setSelectedDoc(prev => prev ? { ...prev, ai_summary: result.ai_summary } : null)
        }
        setSuccessMsg('วิเคราะห์สรุปเอกสารด้วย AI สำเร็จ!')
      } else {
        setErrorMsg(result.detail || 'วิเคราะห์ล้มเหลว')
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการวิเคราะห์เอกสาร')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDraftAI = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draftForm.client_name || !draftForm.case_details) {
      setErrorMsg('กรุณากรอกข้อมูลเพื่อใช้ร่างเอกสารให้ครบถ้วน')
      return
    }

    setDrafting(true)
    setErrorMsg('')
    setDraftResult(null)
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/documents/draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(draftForm)
      })

      const result = await res.json()
      if (res.ok) {
        setDraftResult(result.draft_content)
        // Add new document to state
        if (result.document) {
          setDocuments(prev => [result.document, ...prev])
        }
        setSuccessMsg('ร่างเอกสารสำเร็จและบันทึกลงระบบแล้ว!')
      } else {
        setErrorMsg(result.detail || 'การร่างเอกสารด้วย AI ล้มเหลว')
      }
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ร่างเอกสาร')
    } finally {
      setDrafting(false)
    }
  }

  // ------------------------------------------
  // Filters & Search
  // ------------------------------------------
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = searchQuery === '' || 
      doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.original_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.ai_summary && doc.ai_summary.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesType = filterType === '' || doc.file_type === filterType
    const matchesClient = filterClient === '' || doc.client_id === filterClient
    const matchesCase = filterCase === '' || doc.case_id === filterCase

    return matchesSearch && matchesType && matchesClient && matchesCase
  })

  return (
    <div className="space-y-6 animate-fade-in relative min-h-[85vh]">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-emerald-400" /> ระบบจัดเก็บและจัดการเอกสาร
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            คลังเอกสารกฎหมายความปลอดภัยสูง พร้อมระบบร่างสัญญานัดศาลและวิเคราะห์สรุปความเสี่ยงด้วย AI
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab('ai_draft')
              setDraftResult(null)
            }}
            className="btn-primary bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20 flex items-center gap-2"
          >
            <Cpu className="w-4 h-4" /> ร่างเอกสารด้วย AI
          </button>
          <button
            onClick={() => setUploadOpen(true)}
            className="btn-primary bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> อัปโหลดเอกสาร
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-white/5 space-x-2">
        <button
          onClick={() => { setActiveTab('all_docs'); setSelectedDoc(null) }}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'all_docs'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderOpen className="w-4 h-4" /> เอกสารทั้งหมด ({filteredDocuments.length})
        </button>

        <button
          onClick={() => { setActiveTab('ai_draft'); setDraftResult(null) }}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'ai_draft'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" /> ร่างเอกสารด้วย AI
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" /> แม่แบบเอกสาร
        </button>
      </div>

      {/* Message Notifications */}
      {errorMsg && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between gap-3 text-emerald-300 text-sm">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 flex-shrink-0" />
            {successMsg}
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab 1: All Documents */}
      {activeTab === 'all_docs' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          {/* Left Filter Sidebar */}
          <div className="xl:col-span-1 glass rounded-2xl p-5 border border-white/5 space-y-5">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2 border-b border-white/5 pb-3">
              <Filter className="w-4 h-4 text-emerald-400" /> ตัวกรองข้อมูล
            </h3>

            {/* Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                ค้นหาเอกสาร
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="ชื่อไฟล์, สรุป..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800/80 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>

            {/* File type filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                ประเภทเอกสาร
              </label>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              >
                <option value="">ทั้งหมด</option>
                {DOC_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Client filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                คัดกรองตามลูกความ
              </label>
              <select
                value={filterClient}
                onChange={e => setFilterClient(e.target.value)}
                className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              >
                <option value="">ทั้งหมด</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>

            {/* Case filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                คัดกรองตามคดีความ
              </label>
              <select
                value={filterCase}
                onChange={e => setFilterCase(e.target.value)}
                className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              >
                <option value="">ทั้งหมด</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>
                ))}
              </select>
            </div>

            {/* Clear Button */}
            {(filterType || filterClient || filterCase || searchQuery) && (
              <button
                onClick={() => {
                  setFilterType('')
                  setFilterClient('')
                  setFilterCase('')
                  setSearchQuery('')
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-slate-300 text-xs font-medium transition-all"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>

          {/* Main Area: Files List/Grid */}
          <div className="xl:col-span-3 space-y-4">
            {/* View Mode & Header */}
            <div className="flex justify-between items-center bg-slate-800/20 px-4 py-2 border border-white/5 rounded-xl">
              <div className="text-slate-400 text-xs font-medium">
                ผลลัพธ์การคัดกรอง: {filteredDocuments.length} รายการ
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === 'list' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {loading ? (
              // Loading Skeleton
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="glass rounded-2xl p-6 space-y-3 animate-pulse border border-white/5">
                    <div className="h-4 bg-slate-700/50 rounded w-2/3"></div>
                    <div className="h-3 bg-slate-700/50 rounded w-1/2"></div>
                    <div className="h-8 bg-slate-700/50 rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : filteredDocuments.length === 0 ? (
              // Empty State
              <div className="glass rounded-2xl p-12 text-center border border-white/5 flex flex-col items-center justify-center space-y-4">
                <FolderOpen className="w-16 h-16 text-slate-600 animate-bounce" />
                <h3 className="text-white font-semibold text-lg">ไม่พบเอกสารในระบบ</h3>
                <p className="text-slate-500 text-sm max-w-md">
                  ไม่มีไฟล์ใดๆ ที่ตรงตามตัวกรองที่เลือกไว้ คุณสามารถอัปโหลดไฟล์ใหม่ หรือร่างเอกสารด้วย AI ได้ทันที
                </p>
                <button onClick={() => setUploadOpen(true)} className="btn-primary bg-emerald-600/80">
                  <Upload className="w-4 h-4 inline mr-2" /> อัปโหลดเอกสารชิ้นแรก
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              // Grid View
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDocuments.map(doc => {
                  const cfg = TYPE_COLORS[doc.file_type] || TYPE_COLORS['อื่นๆ']
                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc)}
                      className={`glass-lighter rounded-2xl p-5 border border-white/5 hover:border-emerald-500/30 transition-all duration-300 hover:shadow-lg cursor-pointer flex flex-col justify-between space-y-4 group ${
                        selectedDoc?.id === doc.id ? 'ring-2 ring-emerald-500/40 border-emerald-500/30 bg-slate-800/60' : ''
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Type Badge & Actions */}
                        <div className="flex justify-between items-center">
                          <span className={`px-2 py-0.5 text-2xs rounded-full border ${cfg.badge}`}>
                            {doc.file_type}
                          </span>
                          <span className="text-slate-500 text-2xs font-mono">{formatBytes(doc.file_size)}</span>
                        </div>

                        {/* Title */}
                        <h4 className="text-white font-bold text-sm leading-snug group-hover:text-emerald-300 transition-colors line-clamp-2">
                          {doc.file_name}
                        </h4>

                        {/* Case & Client labels */}
                        {(doc.case_title || doc.client_name) && (
                          <div className="space-y-1 py-1 border-t border-white/5">
                            {doc.client_name && (
                              <div className="text-2xs text-slate-400 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-slate-300">{doc.client_name}</span>
                              </div>
                            )}
                            {doc.case_title && (
                              <div className="text-2xs text-slate-400 flex items-center gap-1.5 line-clamp-1">
                                <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-slate-300">คดี: {doc.case_number || ''} {doc.case_title}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <div className="text-3xs text-slate-500 font-mono">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : ''}
                        </div>
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          {/* Quick download */}
                          <a
                            href={`http://localhost:8000${doc.storage_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-emerald-400 transition-colors rounded hover:bg-white/5"
                            title="ดาวน์โหลด/ดูไฟล์"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          {/* Edit details */}
                          <button
                            onClick={() => {
                              setEditingDoc(doc)
                              setEditForm({
                                file_name: doc.file_name,
                                file_type: doc.file_type || 'อื่นๆ',
                                client_id: doc.client_id || '',
                                case_id: doc.case_id || ''
                              })
                              setEditOpen(true)
                            }}
                            className="p-1 text-slate-400 hover:text-blue-400 transition-colors rounded hover:bg-white/5"
                            title="แก้ไขรายละเอียด"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-1 text-slate-400 hover:text-red-400 transition-colors rounded hover:bg-white/5"
                            title="ลบเอกสาร"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              // List View
              <div className="glass rounded-2xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-slate-800/20 text-slate-400 text-xs font-semibold">
                        <th className="p-4">ชื่อเอกสาร</th>
                        <th className="p-4">ประเภท</th>
                        <th className="p-4">ลูกความ / คดีความ</th>
                        <th className="p-4">ขนาดไฟล์</th>
                        <th className="p-4">อัปโหลดเมื่อ</th>
                        <th className="p-4 text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300 text-xs">
                      {filteredDocuments.map(doc => {
                        const cfg = TYPE_COLORS[doc.file_type] || TYPE_COLORS['อื่นๆ']
                        return (
                          <tr
                            key={doc.id}
                            onClick={() => setSelectedDoc(doc)}
                            className={`hover:bg-white/5 transition-all cursor-pointer ${
                              selectedDoc?.id === doc.id ? 'bg-slate-850/80 text-white border-l-2 border-emerald-500' : ''
                            }`}
                          >
                            <td className="p-4 font-semibold text-white max-w-[200px] truncate">
                              {doc.file_name}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                                {doc.file_type}
                              </span>
                            </td>
                            <td className="p-4 space-y-1">
                              {doc.client_name && (
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-emerald-400" />
                                  <span>{doc.client_name}</span>
                                </div>
                              )}
                              {doc.case_title && (
                                <div className="flex items-center gap-1 text-slate-400 text-2xs truncate max-w-[200px]">
                                  <Briefcase className="w-3 h-3 text-indigo-400" />
                                  <span>คดี: {doc.case_title}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-4 font-mono text-slate-500">{formatBytes(doc.file_size)}</td>
                            <td className="p-4 font-mono text-slate-500">
                              {doc.created_at ? new Date(doc.created_at).toLocaleDateString('th-TH') : ''}
                            </td>
                            <td className="p-4 text-right space-x-1" onClick={e => e.stopPropagation()}>
                              <a
                                href={`http://localhost:8000${doc.storage_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 inline-block"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => {
                                  setEditingDoc(doc)
                                  setEditForm({
                                    file_name: doc.file_name,
                                    file_type: doc.file_type || 'อื่นๆ',
                                    client_id: doc.client_id || '',
                                    case_id: doc.case_id || ''
                                  })
                                  setEditOpen(true)
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-400 rounded hover:bg-slate-800"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(doc.id)}
                                className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: AI Drafting Assistant */}
      {activeTab === 'ai_draft' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Input Panel */}
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-5">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <Cpu className="w-7 h-7 text-indigo-400" />
              <div>
                <h3 className="text-white font-bold text-base">ระบบร่างเอกสารกฎหมายความเร็วสูง</h3>
                <p className="text-xs text-slate-400">ป้อนข้อมูลข้อเท็จจริงเพื่อให้ Gemini AI ร่างเอกสารที่ถูกต้องรัดกุม</p>
              </div>
            </div>

            <form onSubmit={handleDraftAI} className="space-y-4">
              {/* Template selection */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  เลือกหัวข้อเอกสารที่ต้องการร่าง
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'contract', name: 'สัญญาสำคัญ', icon: '📝' },
                    { id: 'complaint', name: 'คำฟ้องร้องศาล', icon: '📋' },
                    { id: 'power_of_attorney', name: 'หนังสือมอบอำนาจ', icon: '📜' },
                    { id: 'demand_letter', name: 'จดหมายทวงถาม (Notice)', icon: '✉️' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDraftForm(f => ({ ...f, template_type: t.id }))}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                        draftForm.template_type === t.id
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-white/5 bg-slate-800/30 text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <span className="text-xs font-semibold">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Client field */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  ชื่อลูกความ / คู่สัญญาหลัก *
                </label>
                <input
                  type="text"
                  placeholder="เช่น บริษัท สมยศ คอนสตรัคชั่น จำกัด"
                  value={draftForm.client_name}
                  onChange={e => setDraftForm(f => ({ ...f, client_name: e.target.value }))}
                  className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500/50"
                  required
                />
              </div>

              {/* Case linkage dropdown (Optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    เชื่อมกับประวัติลูกความ (CRM)
                  </label>
                  <select
                    value={draftForm.client_id}
                    onChange={e => setDraftForm(f => ({ ...f, client_id: e.target.value }))}
                    className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="">-- ไม่เชื่อมโยง --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    เชื่อมกับคดีความ (Cases)
                  </label>
                  <select
                    value={draftForm.case_id}
                    onChange={e => setDraftForm(f => ({ ...f, case_id: e.target.value }))}
                    className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="">-- ไม่เชื่อมโยง --</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>{c.case_number} {c.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Case details */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  รายละเอียดข้อเท็จจริงและเจตนารมณ์สำคัญ *
                </label>
                <textarea
                  rows={5}
                  placeholder="เช่น กู้ยืมเงินจำนวน 500,000 บาท ดอกเบี้ยร้อยละ 15 ต่อปี ผ่อนจ่ายรายเดือนภายใน 2 ปี หากผิดนัดชำระยินยอมจ่ายเบี้ยปรับ..."
                  value={draftForm.case_details}
                  onChange={e => setDraftForm(f => ({ ...f, case_details: e.target.value }))}
                  className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500/50"
                  required
                />
              </div>

              {/* Additional details */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  ข้อกำหนดและเงื่อนไขเพิ่มเติม
                </label>
                <textarea
                  rows={2}
                  placeholder="เช่น การบอกกล่าวส่งทางอีเมล, การยินยอมรับเขตอำนาจศาลแพ่งกรุงเทพ..."
                  value={draftForm.additional_info}
                  onChange={e => setDraftForm(f => ({ ...f, additional_info: e.target.value }))}
                  className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Submit btn */}
              <button
                type="submit"
                disabled={drafting}
                className="w-full btn-primary bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center gap-2 py-3"
              >
                {drafting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" /> กำลังประมวลผลการร่างเอกสาร...
                  </>
                ) : (
                  <>
                    <Cpu className="w-5 h-5" /> สร้างร่างเอกสารทางกฎหมายด้วย AI
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results Output Panel */}
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-4 min-h-[60vh] flex flex-col">
            <h3 className="text-white font-bold text-base border-b border-white/5 pb-3 flex items-center justify-between">
              <span>ผลลัพธ์การร่างเอกสาร</span>
              {draftResult && (
                <span className="px-2.5 py-1 rounded-full text-3xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5" /> บันทึกลงคลังเรียบร้อยแล้ว
                </span>
              )}
            </h3>

            {drafting ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-12">
                <RefreshCw className="w-12 h-12 text-indigo-400 animate-spin" />
                <h4 className="text-white font-medium text-sm">Gemini AI กำลังร่างเอกสารอย่างประณีต...</h4>
                <p className="text-2xs text-slate-500 text-center max-w-xs">
                  ระบบจะวิเคราะห์ประมวลกฎหมายและข้อเท็จจริงของคุณเพื่อความถูกต้องเป็นลายลักษณ์อักษรของศาลไทย
                </p>
              </div>
            ) : draftResult ? (
              <div className="flex-1 flex flex-col justify-between space-y-4">
                {/* Draft Content container */}
                <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5 overflow-y-auto max-h-[55vh] text-slate-200 text-xs leading-relaxed font-sans font-mono whitespace-pre-wrap">
                  {draftResult}
                </div>

                {/* Disclaimer & next step */}
                <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-2">
                  <div className="text-2xs font-bold text-indigo-300 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> ข้อแนะนำการใช้งาน
                  </div>
                  <p className="text-3xs text-indigo-200 leading-normal">
                    เอกสารนี้ได้รับการบันทึกไปยัง คลังเอกสารทั้งหมด เรียบร้อยแล้ว (ในรูปแบบไฟล์ข้อความ)
                    ทนายความและสำนักงานกฎหมายควรตรวจสอบความถูกต้องของเงื่อนไขสำคัญก่อนลงนามใช้จริง
                  </p>
                  <button
                    onClick={() => {
                      setActiveTab('all_docs')
                      fetchAllData()
                    }}
                    className="w-full text-center text-xs font-semibold text-white py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg mt-1 transition-all"
                  >
                    ดูเอกสารที่สร้างขึ้นในคลังทั้งหมด →
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-12">
                <FileCode className="w-16 h-16 text-slate-700 animate-pulse" />
                <h4 className="text-slate-400 font-semibold text-sm">พร้อมเริ่มการร่างเอกสาร</h4>
                <p className="text-3xs text-slate-500 max-w-xs">
                  กรอกข้อมูลประวัติลูกความ เงื่อนไขคดี และหัวข้อทางกฎหมายทางซ้ายมือ จากนั้นกดเริ่มกระบวนการร่าง
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Templates Library */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="bg-slate-800/10 p-5 border border-white/5 rounded-2xl">
            <h3 className="text-white font-bold text-base mb-1">คลังแม่แบบสำเร็จรูป</h3>
            <p className="text-xs text-slate-400">เลือกแม่แบบเพื่อป้อนข้อมูลให้ AI ร่างสัญญาหรือฟ้องร้องคดีเบื้องต้นได้ทันที</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {templates.map(t => (
              <div
                key={t.id}
                onClick={() => {
                  setDraftForm(f => ({ ...f, template_type: t.id }))
                  setActiveTab('ai_draft')
                  setDraftResult(null)
                }}
                className="glass hover:border-amber-500/30 cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-amber-500/5 group text-center p-6 flex flex-col items-center space-y-4"
              >
                <div className="text-5xl group-hover:scale-110 transition-transform">{t.icon}</div>
                <div>
                  <h4 className="text-white font-bold text-sm leading-snug group-hover:text-amber-400 transition-colors">
                    {t.name}
                  </h4>
                  <p className="text-3xs text-slate-500 mt-1">AI Template สำหรับร่างเอกสาร</p>
                </div>
                <button className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1">
                  เลือกใช้แม่แบบ <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Right Sidebar Detail view */}
      {selectedDoc && activeTab === 'all_docs' && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-850 border-l border-white/10 z-50 shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-slide-in">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" /> รายละเอียดเอกสาร
              </h3>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Grid */}
            <div className="space-y-3.5">
              <div>
                <span className="text-3xs font-semibold text-slate-500 uppercase tracking-wider block">ชื่อไฟล์</span>
                <span className="text-white text-xs font-semibold break-all">{selectedDoc.file_name}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-3xs font-semibold text-slate-500 uppercase tracking-wider block">ประเภทเอกสาร</span>
                  <span className="text-emerald-300 text-xs font-semibold block mt-0.5">{selectedDoc.file_type}</span>
                </div>
                <div>
                  <span className="text-3xs font-semibold text-slate-500 uppercase tracking-wider block">ขนาดไฟล์</span>
                  <span className="text-slate-300 text-xs font-mono block mt-0.5">{formatBytes(selectedDoc.file_size)}</span>
                </div>
              </div>

              {selectedDoc.client_name && (
                <div>
                  <span className="text-3xs font-semibold text-slate-500 uppercase tracking-wider block">ลูกความหลัก (CRM)</span>
                  <div className="text-slate-300 text-xs font-semibold flex items-center gap-1.5 mt-0.5">
                    <User className="w-4 h-4 text-emerald-400" />
                    <span>{selectedDoc.client_name}</span>
                  </div>
                </div>
              )}

              {selectedDoc.case_title && (
                <div>
                  <span className="text-3xs font-semibold text-slate-500 uppercase tracking-wider block">คดีความที่เกี่ยวข้อง</span>
                  <div className="text-slate-300 text-xs font-semibold flex items-center gap-1.5 mt-0.5">
                    <Briefcase className="w-4 h-4 text-indigo-400" />
                    <span className="truncate">({selectedDoc.case_number}) {selectedDoc.case_title}</span>
                  </div>
                </div>
              )}

              <div>
                <span className="text-3xs font-semibold text-slate-500 uppercase tracking-wider block">วันที่นำเข้าระบบ</span>
                <div className="text-slate-300 text-xs font-semibold flex items-center gap-1.5 mt-0.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{selectedDoc.created_at ? new Date(selectedDoc.created_at).toLocaleString('th-TH') : ''}</span>
                </div>
              </div>
            </div>

            {/* AI Summary Panel */}
            <div className="pt-4 border-t border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-3xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-indigo-400" /> บทวิเคราะห์และความเสี่ยงด้วย AI
                </span>
                {!selectedDoc.ai_summary && (
                  <button
                    onClick={() => handleAnalyze(selectedDoc.id)}
                    disabled={analyzing}
                    className="text-3xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 border border-indigo-500/30 px-2 py-0.5 rounded-lg bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors"
                  >
                    {analyzing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> กำลังประมวลผล...
                      </>
                    ) : (
                      <>วิเคราะห์ตอนนี้</>
                    )}
                  </button>
                )}
              </div>

              {analyzing ? (
                <div className="bg-slate-900/40 p-4 border border-white/5 rounded-xl animate-pulse space-y-2 text-center py-6">
                  <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin mx-auto mb-2" />
                  <span className="text-2xs text-slate-400">กำลังวิเคราะห์ความเสี่ยง สรุปความ ได้แก่ วันนัด และประเด็นสำคัญ...</span>
                </div>
              ) : selectedDoc.ai_summary ? (
                <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4 overflow-y-auto max-h-[35vh] text-slate-200 text-xs leading-relaxed whitespace-pre-wrap select-text">
                  {selectedDoc.ai_summary}
                </div>
              ) : (
                <div className="bg-slate-900/30 border border-dashed border-white/10 rounded-xl p-4 text-center py-8 space-y-2">
                  <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
                  <h4 className="text-slate-400 font-semibold text-xs">ยังไม่มีบทวิเคราะห์ด้วย AI</h4>
                  <p className="text-3xs text-slate-500 max-w-xs mx-auto">
                    คลิกวิเคราะห์ด้านบนเพื่อให้ Gemini สแกนค้นหาเงื่อนไข สิทธิ และจุดเสียเปรียบทางกฎหมายในตัวเอกสาร
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-white/5 flex gap-2">
            <a
              href={`http://localhost:8000${selectedDoc.storage_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-white/10 flex items-center justify-center gap-1.5 transition-all"
            >
              <Eye className="w-4 h-4" /> ดูเอกสารเต็มรูปแบบ
            </a>
            <button
              onClick={() => handleDelete(selectedDoc.id)}
              className="px-3.5 py-2.5 bg-red-950/20 text-red-400 hover:bg-red-900/20 hover:text-white rounded-xl border border-red-500/20 transition-all"
              title="ลบเอกสาร"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-850 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center border-b border-white/5">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" /> อัปโหลดเอกสารชิ้นใหม่
              </h2>
              <button onClick={() => setUploadOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              {/* File dropzone */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  เลือกไฟล์เอกสาร (PDF, TXT, DOCX, IMG)
                </label>
                <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-emerald-500/40 transition-colors relative cursor-pointer bg-slate-900/30">
                  <input
                    type="file"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadForm(f => ({ ...f, file: e.target.files![0] }))
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2">
                    <Upload className="w-9 h-9 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-300 font-semibold">
                      {uploadForm.file ? uploadForm.file.name : 'คลิกเพื่อเลือกไฟล์ หรือลากวางที่นี่'}
                    </p>
                    <p className="text-3xs text-slate-500">
                      {uploadForm.file ? `${formatBytes(uploadForm.file.size)}` : 'รองรับขนาดสูงสุด 50MB'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid 2-col inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    ประเภทเอกสาร
                  </label>
                  <select
                    value={uploadForm.file_type}
                    onChange={e => setUploadForm(f => ({ ...f, file_type: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    {DOC_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    เชื่อมกับลูกความ (CRM)
                  </label>
                  <select
                    value={uploadForm.client_id}
                    onChange={e => setUploadForm(f => ({ ...f, client_id: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="">-- ไม่เชื่อมโยง --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Case association */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  คดีความหลักที่เกี่ยวข้อง
                </label>
                <select
                  value={uploadForm.case_id}
                  onChange={e => setUploadForm(f => ({ ...f, case_id: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">-- ไม่เชื่อมโยง --</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>
                  ))}
                </select>
              </div>

              {/* Submit */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-white/10 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-xs font-semibold flex items-center gap-1.5"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> เริ่มอัปโหลด
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Metadata Modal */}
      {editOpen && editingDoc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-850 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center border-b border-white/5">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-400" /> แก้ไขเมทาดาต้าและข้อมูลเอกสาร
              </h2>
              <button onClick={() => setEditOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {/* File name */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  ชื่อไฟล์เอกสาร *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.file_name}
                  onChange={e => setEditForm(f => ({ ...f, file_name: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {/* Grid type/client */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    ประเภทเอกสาร
                  </label>
                  <select
                    value={editForm.file_type}
                    onChange={e => setEditForm(f => ({ ...f, file_type: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                  >
                    {DOC_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    เชื่อมกับลูกความ (CRM)
                  </label>
                  <select
                    value={editForm.client_id}
                    onChange={e => setEditForm(f => ({ ...f, client_id: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                  >
                    <option value="">-- ไม่เชื่อมโยง --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Case */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  คดีความหลักที่เกี่ยวข้อง
                </label>
                <select
                  value={editForm.case_id}
                  onChange={e => setEditForm(f => ({ ...f, case_id: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">-- ไม่เชื่อมโยง --</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>
                  ))}
                </select>
              </div>

              {/* Submit / Cancel */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-white/10 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn-primary bg-blue-600 hover:bg-blue-500 px-5 py-2 text-xs font-semibold flex items-center gap-1.5 animate-pulse"
                >
                  <Check className="w-4 h-4" /> บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
