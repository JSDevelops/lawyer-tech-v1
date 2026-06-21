'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CreditCard, Clock, Plus, Trash2, Check, X,
  TrendingUp, TrendingDown, DollarSign, Search,
  FileText, Calendar, Printer, Upload, Link2,
  RefreshCw, CheckSquare, ChevronRight, Briefcase
} from 'lucide-react'

// ==============================
// TypeScript Interfaces
// ==============================

interface Client {
  id: string
  full_name: string
  client_code: string
}

interface Case {
  id: string
  title: string
  case_number: string
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
}

interface Invoice {
  id: string
  invoice_number: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  due_date?: string
  paid_at?: string
  payment_slip_url?: string
  notes?: string
  client_id: string
  client_name?: string
  case_id?: string
  case_title?: string
  items: InvoiceItem[]
  created_at: string
}

interface TimeEntry {
  id: string
  description: string
  hours: number
  hourly_rate: number
  amount: number
  date: string
  is_billable: boolean
  case_id: string
  case_title?: string
  user_id: string
  user_name?: string
  invoice_id?: string
}

interface Expense {
  id: string
  description: string
  category: string
  amount: number
  date: string
  case_id?: string
  case_title?: string
  logged_by: string
  logged_by_name?: string
  receipt_url?: string
  notes?: string
}

interface DashboardStats {
  summary: {
    total_revenue: number
    monthly_revenue: number
    total_outstanding: number
    total_expenses: number
    monthly_expenses: number
    net_profit: number
  }
  recent_ledger: Array<{
    type: 'income' | 'expense'
    title: string
    reference: string
    amount: number
    date: string
  }>
  trends: Array<{
    month: string
    revenue: number
    expense: number
    profit: number
  }>
}

const BACKEND = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1')
  : 'http://localhost:8000/api/v1'

const STATUS_LABELS: Record<string, string> = {
  'draft': 'ฉบับร่าง (Draft)',
  'sent': 'ส่งแล้ว (Sent)',
  'paid': 'ชำระแล้ว (Paid)',
  'overdue': 'เกินกำหนด (Overdue)',
  'cancelled': 'ยกเลิก (Cancelled)'
}

const STATUS_COLORS: Record<string, string> = {
  'draft': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  'sent': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'paid': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'overdue': 'bg-red-500/20 text-red-300 border-red-500/30',
  'cancelled': 'bg-red-950/40 text-red-400 border-red-950/50'
}

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'time-entries' | 'expenses'>('dashboard')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Database lists
  const [clients, setClients] = useState<Client[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null)

  // Filters
  const [invoiceFilter, setInvoiceFilter] = useState('')
  const [expenseFilter, setExpenseFilter] = useState('')

  // Modals
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [timeEntryModalOpen, setTimeEntryModalOpen] = useState(false)
  const [invoiceViewModalOpen, setInvoiceViewModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  
  // Slip attachment state
  const [slipModalOpen, setSlipModalOpen] = useState(false)
  const [slipUrlInput, setSlipUrlInput] = useState('')
  const [slipInvoiceId, setSlipInvoiceId] = useState('')
  const [slipEvidenceType, setSlipEvidenceType] = useState<'upload' | 'link'>('link')
  const [expenseEvidenceType, setExpenseEvidenceType] = useState<'upload' | 'link'>('link')
  const [uploadingFile, setUploadingFile] = useState(false)

  // Time-entry selector for invoice bundling
  const [selectedTimeEntries, setSelectedTimeEntries] = useState<string[]>([])

  // ==============================
  // Forms states
  // ==============================
  const [invoiceForm, setInvoiceForm] = useState({
    client_id: '',
    case_id: '',
    due_date: '',
    tax_rate: 7.0,
    notes: '',
    items: [{ description: '', quantity: 1.0, unit_price: 0.0 }]
  })

  const [expenseForm, setExpenseForm] = useState({
    description: '',
    category: 'ค่าธรรมเนียมศาล',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    case_id: '',
    receipt_url: '',
    notes: ''
  })

  const [timeEntryForm, setTimeEntryForm] = useState({
    description: '',
    hours: 1.0,
    hourly_rate: 1000.0,
    date: new Date().toISOString().slice(0, 10),
    case_id: '',
    is_billable: true
  })

  // ==============================
  // API Fetching Operations
  // ==============================
  const fetchAllData = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    const token = localStorage.getItem('access_token')
    if (!token) {
      setErrorMsg('กรุณาเข้าสู่ระบบก่อนการใช้งาน')
      setLoading(false)
      return
    }

    const headers = { Authorization: `Bearer ${token}` }

    try {
      // 1. Clients
      const clientRes = await fetch(`${BACKEND}/clients/`, { headers })
      if (clientRes.ok) {
        const json = await clientRes.json()
        setClients(json.data || [])
      }

      // 2. Cases
      const casesRes = await fetch(`${BACKEND}/cases/?limit=100`, { headers })
      if (casesRes.ok) {
        const json = await casesRes.json()
        setCases(json.data || [])
      }

      // 3. Invoices
      const invoiceRes = await fetch(`${BACKEND}/billing/invoices`, { headers })
      if (invoiceRes.ok) {
        const json = await invoiceRes.json()
        setInvoices(json.data || [])
      }

      // 4. Time entries
      const timeRes = await fetch(`${BACKEND}/billing/time-entries`, { headers })
      if (timeRes.ok) {
        const json = await timeRes.json()
        setTimeEntries(json.data || [])
      }

      // 5. Expenses
      const expRes = await fetch(`${BACKEND}/billing/expenses`, { headers })
      if (expRes.ok) {
        const json = await expRes.json()
        setExpenses(json.data || [])
      }

      // 6. Financial Dashboard Stats
      const dashRes = await fetch(`${BACKEND}/billing/dashboard`, { headers })
      if (dashRes.ok) {
        const json = await dashRes.json()
        setDashboardData(json.data || null)
      }

    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการดึงข้อมูลทางการเงินจากเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  // ==============================
  // Action Handlers
  // ==============================
  
  // 1. Invoice Creation
  const handleAddItemRow = () => {
    setInvoiceForm(f => ({
      ...f,
      items: [...f.items, { description: '', quantity: 1.0, unit_price: 0.0 }]
    }))
  }

  const handleRemoveItemRow = (index: number) => {
    setInvoiceForm(f => ({
      ...f,
      items: f.items.filter((_, idx) => idx !== index)
    }))
  }

  const handleItemChange = (index: number, field: string, value: string | number) => {
    setInvoiceForm(f => {
      const updatedItems = [...f.items]
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value
      }
      return { ...f, items: updatedItems }
    })
  }

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    // Clean inputs
    if (!invoiceForm.client_id) {
      setErrorMsg('กรุณาเลือกข้อมูลลูกความ')
      return
    }

    try {
      const payload = {
        client_id: invoiceForm.client_id,
        case_id: invoiceForm.case_id || null,
        due_date: invoiceForm.due_date || null,
        tax_rate: Number(invoiceForm.tax_rate),
        notes: invoiceForm.notes || null,
        items: invoiceForm.items.map(it => ({
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price)
        })),
        time_entry_ids: selectedTimeEntries.length > 0 ? selectedTimeEntries : null
      }

      const res = await fetch(`${BACKEND}/billing/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(`สร้างใบแจ้งหนี้ ${data.data.invoice_number} สำเร็จแล้ว!`)
        setInvoices(prev => [data.data, ...prev])
        setInvoiceModalOpen(false)
        setSelectedTimeEntries([]) // clear selection
        setInvoiceForm({
          client_id: '',
          case_id: '',
          due_date: '',
          tax_rate: 7.0,
          notes: '',
          items: [{ description: '', quantity: 1.0, unit_price: 0.0 }]
        })
        // Refresh dashboard statistics
        const dashRes = await fetch(`${BACKEND}/billing/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
        if (dashRes.ok) {
          const dashJson = await dashRes.json()
          setDashboardData(dashJson.data)
        }
      } else {
        setErrorMsg(data.detail || 'ไม่สามารถออกใบแจ้งหนี้ได้')
      }
    } catch {
      setErrorMsg('ล้มเหลวในการเชื่อมต่อระบบออกบิล')
    }
  }

  // 2. Invoice Status Updates
  const handleUpdateInvoiceStatus = async (id: string, status: string, slipUrl?: string) => {
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/billing/invoices/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          payment_slip_url: slipUrl || null
        })
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg('อัปเดตใบแจ้งหนี้สำเร็จ')
        setInvoices(prev => prev.map(inv => inv.id === id ? data.data : inv))
        if (selectedInvoice?.id === id) {
          setSelectedInvoice(data.data)
        }
        // Refresh stats
        const dashRes = await fetch(`${BACKEND}/billing/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
        if (dashRes.ok) {
          const dashJson = await dashRes.json()
          setDashboardData(dashJson.data)
        }
      } else {
        setErrorMsg(data.detail || 'อัปเดตไม่สำเร็จ')
      }
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการติดต่อ API')
    }
  }

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('ยืนยันลบใบแจ้งหนี้นี้ออกจากระบบ? (การลบจะเป็นแบบถาวรและไม่สามารถเรียกคืนได้)')) return
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/billing/invoices/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(data.message)
        setInvoices(prev => prev.filter(inv => inv.id !== id))
        // Refresh statistics
        const dashRes = await fetch(`${BACKEND}/billing/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
        if (dashRes.ok) {
          const dashJson = await dashRes.json()
          setDashboardData(dashJson.data)
        }
      } else {
        setErrorMsg(data.detail || 'ไม่สามารถลบใบแจ้งหนี้ได้')
      }
    } catch {
      setErrorMsg('ไม่สามารถลบข้อมูลเนื่องจากปัญหาเครือข่าย')
    }
  }

  // 3. Time Entry log submission
  const handleTimeEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!timeEntryForm.case_id) {
      setErrorMsg('กรุณาเลือกแฟ้มคดีอ้างอิง')
      return
    }

    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/billing/time-entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(timeEntryForm)
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg('บันทึกเวลาทำงานคิดเงินสำเร็จ!')
        setTimeEntries(prev => [data.data, ...prev])
        setTimeEntryModalOpen(false)
        setTimeEntryForm({
          description: '',
          hours: 1.0,
          hourly_rate: 1000.0,
          date: new Date().toISOString().slice(0, 10),
          case_id: '',
          is_billable: true
        })
      } else {
        setErrorMsg(data.detail || 'บันทึกเวลาล้มเหลว')
      }
    } catch {
      setErrorMsg('เชื่อมต่อเซิร์ฟเวอร์บันทึกเวลาล้มเหลว')
    }
  }

  // 4. Expense Submission
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/billing/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...expenseForm,
          case_id: expenseForm.case_id || null,
          receipt_url: expenseForm.receipt_url || null,
          notes: expenseForm.notes || null
        })
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg('ลงบันทึกรายจ่ายสำเร็จ!')
        setExpenses(prev => [data.data, ...prev])
        setExpenseModalOpen(false)
        setExpenseForm({
          description: '',
          category: 'ค่าธรรมเนียมศาล',
          amount: 0,
          date: new Date().toISOString().slice(0, 10),
          case_id: '',
          receipt_url: '',
          notes: ''
        })
        // Refresh dashboard
        const dashRes = await fetch(`${BACKEND}/billing/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
        if (dashRes.ok) {
          const dashJson = await dashRes.json()
          setDashboardData(dashJson.data)
        }
      } else {
        setErrorMsg(data.detail || 'บันทึกรายจ่ายล้มเหลว')
      }
    } catch {
      setErrorMsg('เชื่อมต่อเครือข่ายล้มเหลว')
    }
  }

  // Time entries selection handling
  const handleToggleSelectTimeEntry = (id: string) => {
    setSelectedTimeEntries(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleCreateInvoiceFromSelected = () => {
    if (selectedTimeEntries.length === 0) return

    // Prepopulate invoice line items from chosen entries
    const items = selectedTimeEntries.map(id => {
      const entry = timeEntries.find(te => te.id === id)
      return {
        description: entry ? `บันทึกเวลา: ${entry.description}` : 'ค่าชั่วโมงทำงานทนายความ',
        quantity: entry ? entry.hours : 1.0,
        unit_price: entry ? entry.hourly_rate : 1000.0
      }
    })

    // Auto-detect case id and client id from first entry if possible
    const firstEntry = timeEntries.find(te => te.id === selectedTimeEntries[0])
    const matchedCase = cases.find(c => c.id === firstEntry?.case_id)
    
    // Find client from matched case
    const matchedInvoiceCase = invoices.find(inv => inv.case_id === firstEntry?.case_id)
    const clientId = matchedInvoiceCase?.client_id || ''

    setInvoiceForm({
      client_id: clientId,
      case_id: firstEntry?.case_id || '',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // +30 days
      tax_rate: 7.0,
      notes: 'เรียกเก็บเงินอ้างอิงบันทึกรายงานเวลางานของทนายความประจำคดี',
      items
    })

    setInvoiceModalOpen(true)
  }

  return (
    <div className="space-y-6 animate-fade-in relative min-h-[85vh]">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-amber-500" /> ระบบบัญชีและการเงิน (Accounting & Finance)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            รายงานรายรับ-รายจ่ายของสำนักงาน บริหารจัดการบิลใบแจ้งหนี้ ใบเสร็จรับเงิน และบันทึกเวลาทำงานสะสม
          </p>
        </div>

        <div className="flex gap-2">
          {activeTab === 'invoices' && (
            <button
              onClick={() => setInvoiceModalOpen(true)}
              className="btn-primary bg-amber-600 hover:bg-amber-500 shadow-amber-600/20 flex items-center gap-2 text-xs font-semibold py-2.5"
            >
              <Plus className="w-4 h-4" /> สร้างใบแจ้งหนี้
            </button>
          )}

          {activeTab === 'expenses' && (
            <button
              onClick={() => setExpenseModalOpen(true)}
              className="btn-primary bg-red-600 hover:bg-red-500 shadow-red-600/20 flex items-center gap-2 text-xs font-semibold py-2.5"
            >
              <Plus className="w-4 h-4" /> บันทึกรายจ่ายใหม่
            </button>
          )}

          {activeTab === 'time-entries' && (
            <button
              onClick={() => setTimeEntryModalOpen(true)}
              className="btn-primary bg-blue-600 hover:bg-blue-500 shadow-blue-600/20 flex items-center gap-2 text-xs font-semibold py-2.5"
            >
              <Plus className="w-4 h-4" /> เพิ่มรายงานชั่วโมงคิดเงิน
            </button>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-white/5 space-x-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'dashboard'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> ภาพรวม & ผลกำไรขาดทุน
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'invoices'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" /> ใบแจ้งหนี้ & บิล ({invoices.length})
        </button>

        <button
          onClick={() => setActiveTab('time-entries')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'time-entries'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" /> รายงานเวลาคิดเงิน ({timeEntries.length})
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'expenses'
              ? 'border-red-500 text-red-400 bg-red-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingDown className="w-4 h-4" /> บันทึกรายจ่ายสะสม ({expenses.length})
        </button>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 text-red-300 text-sm">
          <Check className="w-5 h-5 text-red-400 flex-shrink-0" />
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

      {/* Loading Overlay */}
      {loading && (
        <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-sm text-slate-400">กำลังประมวลผลข้อมูลทางบัญชีและการเงิน...</p>
        </div>
      )}

      {/* ==============================
          TAB 1: Dashboard ภาพรวมการเงิน
          ============================== */}
      {!loading && activeTab === 'dashboard' && dashboardData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass rounded-2xl p-5 border border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">รายรับรวมโอนชำระเงินแล้ว</span>
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white font-mono">
                ฿{dashboardData.summary.total_revenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-emerald-400">
                เดือนนี้: ฿{dashboardData.summary.monthly_revenue.toLocaleString('th-TH')}
              </p>
            </div>

            <div className="glass rounded-2xl p-5 border border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">รายจ่ายรวมสำนักงาน</span>
                <TrendingDown className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white font-mono">
                ฿{dashboardData.summary.total_expenses.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-red-400">
                เดือนนี้: ฿{dashboardData.summary.monthly_expenses.toLocaleString('th-TH')}
              </p>
            </div>

            <div className="glass rounded-2xl p-5 border border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">ยอดดุลกำไรสุทธิ (Net profit)</span>
                <DollarSign className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className={`text-xl font-bold font-mono ${dashboardData.summary.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ฿{dashboardData.summary.net_profit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </h3>
              <span className="text-[9px] text-slate-500 block">ยอดสะสมสะท้อนตามฐานข้อมูลจริง</span>
            </div>

            <div className="glass rounded-2xl p-5 border border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">ยอดค้างจ่ายจากลูกความ</span>
                <CreditCard className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-amber-400 font-mono">
                ฿{dashboardData.summary.total_outstanding.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </h3>
              <span className="text-[9px] text-slate-500 block">จากใบแจ้งหนี้รอชำระทั้งหมด</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Financial Trends / Chart mock table */}
            <div className="lg:col-span-2 glass rounded-2xl p-5 border border-white/5 space-y-4">
              <h3 className="text-white font-bold text-sm border-b border-white/5 pb-3">
                แนวโน้มผลประกอบการประจำรอบเดือน (Financial Trends)
              </h3>
              
              <div className="space-y-3.5">
                {dashboardData.trends.map((t, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-900/40 border border-white/5 rounded-xl space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-white">
                      <span>รอบเดือน: {t.month}</span>
                      <span className={t.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        กำไรสุทธิ: ฿{t.profit.toLocaleString()}
                      </span>
                    </div>

                    {/* Progress bars to visualize comparison */}
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-slate-400">รายรับ:</span>
                        <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full" 
                            style={{ width: `${Math.min(100, (t.revenue / Math.max(1, t.revenue + t.expense)) * 100)}%` }}
                          />
                        </div>
                        <span className="w-20 text-right text-emerald-400 font-mono">฿{t.revenue.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-12 text-slate-400">รายจ่าย:</span>
                        <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-red-500 h-full" 
                            style={{ width: `${Math.min(100, (t.expense / Math.max(1, t.revenue + t.expense)) * 100)}%` }}
                          />
                        </div>
                        <span className="w-20 text-right text-red-400 font-mono">฿{t.expense.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Ledger List */}
            <div className="lg:col-span-1 glass rounded-2xl p-5 border border-white/5 space-y-4">
              <h3 className="text-white font-bold text-sm border-b border-white/5 pb-3">
                ประวัติรายรับ-รายจ่ายล่าสุด (Transactions Log)
              </h3>

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {dashboardData.recent_ledger.map((ledger, i) => (
                  <div key={i} className="p-3 bg-slate-900/30 border border-white/5 rounded-xl flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-xs truncate">{ledger.title}</p>
                      <p className="text-[10px] text-slate-500 truncate">{ledger.reference}</p>
                      <p className="text-[9px] text-slate-600 font-mono mt-0.5">{ledger.date}</p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className={`font-mono text-xs font-bold ${ledger.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {ledger.type === 'income' ? '+' : '-'}฿{ledger.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}

                {dashboardData.recent_ledger.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-6">ไม่มีประวัติการทำธุรกรรมทางการเงิน</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================
          TAB 2: Invoice Management (จัดการบิล & ใบแจ้งหนี้)
          ============================== */}
      {!loading && activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="ค้นหาเลขบิล, ชื่อลูกความ หรือคดี..."
              value={invoiceFilter}
              onChange={e => setInvoiceFilter(e.target.value)}
              className="w-full bg-slate-800/60 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/50"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>

          {/* Invoices list table */}
          <div className="glass rounded-2xl p-5 border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-slate-800/20 text-slate-400 text-xs font-semibold">
                    <th className="p-3">เลขใบแจ้งหนี้</th>
                    <th className="p-3">ลูกความ</th>
                    <th className="p-3">คดีอ้างอิง</th>
                    <th className="p-3">วันครบกำหนด</th>
                    <th className="p-3 text-right">ยอดรวมสุทธิ</th>
                    <th className="p-3">สถานะ</th>
                    <th className="p-3 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300 text-xs">
                  {invoices
                    .filter(inv => 
                      invoiceFilter === '' ||
                      inv.invoice_number.toLowerCase().includes(invoiceFilter.toLowerCase()) ||
                      (inv.client_name && inv.client_name.toLowerCase().includes(invoiceFilter.toLowerCase())) ||
                      (inv.case_title && inv.case_title.toLowerCase().includes(invoiceFilter.toLowerCase()))
                    )
                    .map(inv => (
                      <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                        <td 
                          onClick={() => { setSelectedInvoice(inv); setInvoiceViewModalOpen(true) }}
                          className="p-3 font-mono font-bold text-amber-400 cursor-pointer hover:underline"
                        >
                          {inv.invoice_number}
                        </td>
                        <td className="p-3 font-semibold text-white">{inv.client_name || 'ไม่ทราบชื่อ'}</td>
                        <td className="p-3 max-w-[200px] truncate">{inv.case_title || '-'}</td>
                        <td className="p-3 font-mono">{inv.due_date ? new Date(inv.due_date).toLocaleDateString('th-TH') : '-'}</td>
                        <td className="p-3 text-right font-mono font-bold text-white">
                          ฿{inv.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-3xs font-semibold rounded-full border ${STATUS_COLORS[inv.status] || 'bg-slate-500/20 border-white/10'}`}>
                            {STATUS_LABELS[inv.status] || inv.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => { setSelectedInvoice(inv); setInvoiceViewModalOpen(true) }}
                              className="px-2 py-1 bg-slate-800 text-slate-300 hover:text-white rounded hover:bg-slate-700 transition-colors"
                              title="ดูรายละเอียด/พิมพ์บิล"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            {inv.status !== 'paid' && (
                              <button
                                onClick={() => {
                                  setSlipInvoiceId(inv.id)
                                  setSlipUrlInput(inv.payment_slip_url || '')
                                  setSlipModalOpen(true)
                                }}
                                className="px-2 py-1 bg-emerald-950/40 text-emerald-400 hover:text-white hover:bg-emerald-900/60 rounded border border-emerald-500/20 transition-colors"
                                title="แนบหลักฐานชำระเงิน"
                              >
                                <Upload className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {inv.status === 'draft' && (
                              <button
                                onClick={() => handleUpdateInvoiceStatus(inv.id, 'sent')}
                                className="px-2 py-1 bg-blue-950/40 text-blue-400 hover:text-white hover:bg-blue-900/60 rounded border border-blue-500/20 transition-colors"
                                title="ส่งใบแจ้งหนี้ให้ลูกค้า"
                              >
                                ส่งบิล
                              </button>
                            )}

                            {inv.status !== 'paid' && (
                              <button
                                onClick={() => handleDeleteInvoice(inv.id)}
                                className="px-2 py-1 bg-red-950/40 text-red-400 hover:text-white hover:bg-red-900/60 rounded border border-red-500/20 transition-colors"
                                title="ลบใบแจ้งหนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {invoices.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-12">ไม่มีข้อมูลใบแจ้งหนี้ในระบบ</p>
            )}
          </div>
        </div>
      )}

      {/* ==============================
          TAB 3: Time Billing (สะสมบันทึกเวลาทำงาน)
          ============================== */}
      {!loading && activeTab === 'time-entries' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* List of Time entries */}
          <div className="lg:col-span-2 glass rounded-2xl p-5 border border-white/5 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-white font-bold text-sm">
                บันทึกชั่วโมงเวลางานของทนายความคดี
              </h3>
              
              {selectedTimeEntries.length > 0 && (
                <button
                  onClick={handleCreateInvoiceFromSelected}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-900 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all animate-bounce"
                >
                  <Link2 className="w-3.5 h-3.5" /> ออกใบแจ้งหนี้จากที่เลือก ({selectedTimeEntries.length})
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-slate-800/20 text-slate-400 text-xs font-semibold">
                    <th className="p-3 w-10">เลือก</th>
                    <th className="p-3">วันที่</th>
                    <th className="p-3">คดี</th>
                    <th className="p-3">รายละเอียดบันทึกงาน</th>
                    <th className="p-3">ทนายผู้บันทึก</th>
                    <th className="p-3 text-right">จำนวน ชม.</th>
                    <th className="p-3 text-right">ยอดรวมคิดบิล</th>
                    <th className="p-3 text-center">สถานะการออกบิล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300 text-xs font-mono">
                  {timeEntries.map(te => (
                    <tr key={te.id} className="hover:bg-white/5">
                      <td className="p-3 text-center">
                        {!te.invoice_id && te.is_billable ? (
                          <input
                            type="checkbox"
                            checked={selectedTimeEntries.includes(te.id)}
                            onChange={() => handleToggleSelectTimeEntry(te.id)}
                            className="w-4 h-4 rounded border-white/10 bg-slate-800 text-amber-500 focus:ring-amber-500"
                          />
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {te.date ? new Date(te.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : ''}
                      </td>
                      <td className="p-3 font-sans font-semibold text-white max-w-[150px] truncate">
                        {te.case_title || 'ไม่พบแฟ้มคดี'}
                      </td>
                      <td className="p-3 font-sans max-w-[200px] truncate">{te.description}</td>
                      <td className="p-3 font-sans">{te.user_name || '-'}</td>
                      <td className="p-3 text-right">{te.hours} ชม.</td>
                      <td className="p-3 text-right text-emerald-400">฿{te.amount.toLocaleString()}</td>
                      <td className="p-3 text-center font-sans">
                        {te.invoice_id ? (
                          <span className="text-emerald-400 font-semibold flex items-center justify-center gap-1">
                            <Check className="w-3 h-3" /> ออกบิลแล้ว
                          </span>
                        ) : te.is_billable ? (
                          <span className="text-amber-400">ค้างออกบิล</span>
                        ) : (
                          <span className="text-slate-500">Non-billable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {timeEntries.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-12">ไม่มีบันทึกเวลาทำงานของทนายความในฐานข้อมูล</p>
            )}
          </div>

          {/* Quick instructions panel */}
          <div className="lg:col-span-1 glass rounded-2xl p-6 border border-white/5 space-y-4">
            <h4 className="text-white font-bold text-sm flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" /> การสร้างบิลจากบันทึกเวลางาน
            </h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              สิทธิพิเศษสำหรับทนายความและผู้บริหารสำนักงานกฎหมาย:
            </p>
            <ol className="text-xs text-slate-300 list-decimal pl-4 space-y-2.5">
              <li>ใช้ฟอร์มสร้างบันทึกเวลาเพื่อลงประวัติกิจกรรมที่ทำในคดีพร้อมระบุอัตราค่าวิชาชีพต่อชั่วโมง</li>
              <li>ระบบจะคำนวณจำนวนชั่วโมงและค่าวิชาชีพสะสมอัตโนมัติ</li>
              <li>เลือกกล่องติ๊กถูกทางซ้ายมือในตารางเพื่อมัดรวมรายการเวลางานของลูกความในคดีเดียวกัน</li>
              <li>คลิกปุ่มสีส้ม <span className="text-amber-400 font-semibold">"ออกใบแจ้งหนี้จากที่เลือก"</span> เพื่อแปลงรายการเวลางานเหล่านั้นให้เป็นบิลส่งเรียกเก็บเงินลูกความทันที</li>
            </ol>
          </div>
        </div>
      )}

      {/* ==============================
          TAB 4: Expense Management (บันทึกรายจ่ายบริษัท)
          ============================== */}
      {!loading && activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            {/* Search bar */}
            <div className="relative max-w-md w-full">
              <input
                type="text"
                placeholder="ค้นหารายการใช้จ่ายสำนักงาน..."
                value={expenseFilter}
                onChange={e => setExpenseFilter(e.target.value)}
                className="w-full bg-slate-800/60 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500/50"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>

            <div className="text-right">
              <span className="text-3xs text-slate-500 block uppercase tracking-wider">รายจ่ายสะสมในฐานข้อมูล</span>
              <span className="text-white font-mono font-bold text-base">
                ฿{expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-slate-800/20 text-slate-400 text-xs font-semibold">
                    <th className="p-3">วันที่ใช้จ่าย</th>
                    <th className="p-3">รายการ/รายละเอียด</th>
                    <th className="p-3">หมวดหมู่</th>
                    <th className="p-3">คดีที่เกี่ยวข้อง</th>
                    <th className="p-3">ผู้บันทึก</th>
                    <th className="p-3 text-right">จำนวนเงิน</th>
                    <th className="p-3 text-center">หลักฐาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300 text-xs font-mono">
                  {expenses
                    .filter(exp => 
                      expenseFilter === '' ||
                      exp.description.toLowerCase().includes(expenseFilter.toLowerCase()) ||
                      exp.category.toLowerCase().includes(expenseFilter.toLowerCase())
                    )
                    .map(exp => (
                      <tr key={exp.id} className="hover:bg-white/5">
                        <td className="p-3">
                          {exp.date ? new Date(exp.date).toLocaleDateString('th-TH') : '-'}
                        </td>
                        <td className="p-3 font-sans text-white font-semibold">{exp.description}</td>
                        <td className="p-3 font-sans">
                          <span className="px-2 py-0.5 rounded-full bg-red-950/40 text-red-400 border border-red-950/50">
                            {exp.category}
                          </span>
                        </td>
                        <td className="p-3 font-sans max-w-[200px] truncate">{exp.case_title || '-'}</td>
                        <td className="p-3 font-sans">{exp.logged_by_name || '-'}</td>
                        <td className="p-3 text-right text-red-400 font-bold">
                          ฿{exp.amount.toLocaleString()}
                        </td>
                        <td className="p-3 text-center font-sans">
                          {exp.receipt_url ? (
                            <a
                              href={exp.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-400 hover:underline inline-flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" /> ดูกลักฐาน
                            </a>
                          ) : (
                            <span className="text-slate-600">ไม่มี</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {expenses.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-12">ไม่มีบันทึกรายจ่ายสำนักงานในฐานข้อมูล</p>
            )}
          </div>
        </div>
      )}

      {/* ==============================
          MODAL 1: Create Invoice Modal
          ============================== */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-850 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center border-b border-white/5 flex-shrink-0">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" /> จัดทำใบแจ้งหนี้ฉบับใหม่
              </h2>
              <button onClick={() => setInvoiceModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateInvoiceSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-slate-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    เลือกข้อมูลลูกความ *
                  </label>
                  <select
                    required
                    value={invoiceForm.client_id}
                    onChange={e => setInvoiceForm(f => ({ ...f, client_id: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">-- กรุณาเลือก --</option>
                    {clients.map(cl => (
                      <option key={cl.id} value={cl.id}>{cl.full_name} ({cl.client_code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    คดีที่เกี่ยวข้อง (ถ้ามี)
                  </label>
                  <select
                    value={invoiceForm.case_id}
                    onChange={e => setInvoiceForm(f => ({ ...f, case_id: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>{c.title} ({c.case_number})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    วันครบกำหนดชำระบิล
                  </label>
                  <input
                    type="date"
                    value={invoiceForm.due_date}
                    onChange={e => setInvoiceForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    อัตราภาษีมูลค่าเพิ่ม (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={invoiceForm.tax_rate}
                    onChange={e => setInvoiceForm(f => ({ ...f, tax_rate: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              {/* Invoice line items section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-t border-white/5 pt-3">
                  <span className="text-xs font-bold text-white">รายการเรียกเก็บเงิน (Invoice Items)</span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-semibold text-amber-500 hover:text-amber-400 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มรายการย่อย
                  </button>
                </div>

                {invoiceForm.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2.5 items-end">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 block mb-1">คำอธิบายรายการ</label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น ค่าเดินทางไปไต่สวนมูลฟ้อง, ค่าสืบพยาน..."
                        value={item.description}
                        onChange={e => handleItemChange(idx, 'description', e.target.value)}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div className="w-20">
                      <label className="text-[10px] text-slate-500 block mb-1">จำนวน</label>
                      <input
                        type="number"
                        required
                        step="0.1"
                        value={item.quantity}
                        onChange={e => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs text-right focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div className="w-28">
                      <label className="text-[10px] text-slate-500 block mb-1">ราคา/หน่วย (บาท)</label>
                      <input
                        type="number"
                        required
                        step="1"
                        value={item.unit_price}
                        onChange={e => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs text-right focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    {invoiceForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded-xl transition-colors mb-0.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  หมายเหตุเพิ่มเติม / ข้อตกลงชำระเงิน
                </label>
                <textarea
                  rows={2}
                  placeholder="รายละเอียดธนาคาร หรือข้อตกลงการแบ่งจ่ายชำระเงินตามงวดคดี..."
                  value={invoiceForm.notes}
                  onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* Associated time entries helper */}
              {selectedTimeEntries.length > 0 && (
                <div className="p-3 bg-blue-950/20 border border-blue-500/20 text-blue-300 text-xs rounded-xl flex items-center gap-2">
                  <Clock className="w-4 h-4" /> บิลนี้จะรวมและปิดสถานะบันทึกชั่วโมงการทำงานที่เลือก {selectedTimeEntries.length} รายการโดยอัตโนมัติ
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2 border-t border-white/5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-white/10 transition-colors"
                >
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary bg-amber-600 hover:bg-amber-500">
                  อนุมัติสร้างใบแจ้งหนี้
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================
          MODAL 2: Create Expense Modal
          ============================== */}
      {expenseModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-850 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center border-b border-white/5">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-red-400" /> ลงบันทึกรายจ่ายสำนักงาน
              </h2>
              <button onClick={() => setExpenseModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4 text-slate-300">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    หมวดหมู่รายจ่าย *
                  </label>
                  <select
                    value={expenseForm.category}
                    onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/50"
                  >
                    <option value="ค่าธรรมเนียมศาล">ค่าธรรมเนียมศาล</option>
                    <option value="ค่าเดินทาง/พาหนะ">ค่าเดินทาง/พาหนะ</option>
                    <option value="อุปกรณ์สำนักงาน">อุปกรณ์สำนักงาน</option>
                    <option value="ค่าน้ำ/ค่าไฟ/ค่าเน็ต">ค่าน้ำ/ค่าไฟ/ค่าเน็ต</option>
                    <option value="ค่าโฆษณา/การตลาด">ค่าโฆษณา/การตลาด</option>
                    <option value="เงินเดือนพนักงาน">เงินเดือนพนักงาน</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    จำนวนเงินจ่าย (บาท) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="เช่น 1500"
                    value={expenseForm.amount || ''}
                    onChange={e => setExpenseForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  รายละเอียด/กิจกรรมที่จ่าย *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ซื้อกระดาษและหมึกเครื่องถ่ายเอกสาร A4"
                  value={expenseForm.description}
                  onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    วันที่ทำรายการจ่าย
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseForm.date}
                    onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    คดีที่เกี่ยวข้อง (ถ้ามี)
                  </label>
                  <select
                    value={expenseForm.case_id}
                    onChange={e => setExpenseForm(f => ({ ...f, case_id: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/50"
                  >
                    <option value="">-- ไม่เกี่ยวข้องกับคดี --</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  หลักฐานใบเสร็จ
                </label>
                <div className="flex gap-4 mb-2 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="expense_evidence_type"
                      checked={expenseEvidenceType === 'link'}
                      onChange={() => setExpenseEvidenceType('link')}
                      className="accent-red-500"
                    />
                    ระบุลิงก์เว็บ (Link URL)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="expense_evidence_type"
                      checked={expenseEvidenceType === 'upload'}
                      onChange={() => setExpenseEvidenceType('upload')}
                      className="accent-red-500"
                    />
                    อัปโหลดรูปภาพ/ไฟล์ (Upload File)
                  </label>
                </div>

                {expenseEvidenceType === 'link' ? (
                  <input
                    type="text"
                    placeholder="เช่น https://drive.google.com/receipt.png"
                    value={expenseForm.receipt_url}
                    onChange={e => setExpenseForm(f => ({ ...f, receipt_url: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500/50"
                  />
                ) : (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setUploadingFile(true)
                          setErrorMsg('')
                          try {
                            const formData = new FormData()
                            formData.append('file', file)
                            formData.append('file_type', 'หลักฐาน')
                            if (expenseForm.case_id) {
                              formData.append('case_id', expenseForm.case_id)
                            }
                            const token = localStorage.getItem('access_token')
                            const res = await fetch(`${BACKEND}/documents/upload`, {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${token}` },
                              body: formData
                            })
                            const result = await res.json()
                            if (res.ok) {
                              setExpenseForm(f => ({ ...f, receipt_url: result.data.storage_url }))
                              setSuccessMsg('อัปโหลดไฟล์หลักฐานสำเร็จ!')
                            } else {
                              setErrorMsg(result.detail || 'อัปโหลดหลักฐานล้มเหลว')
                            }
                          } catch (err) {
                            setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์เพื่ออัปโหลด')
                          } finally {
                            setUploadingFile(false)
                          }
                        }
                      }}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-slate-400 text-xs focus:outline-none focus:border-red-500/50"
                    />
                    {uploadingFile && (
                      <p className="text-[10px] text-amber-400 flex items-center gap-1.5 animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> กำลังอัปโหลดไฟล์...
                      </p>
                    )}
                    {expenseForm.receipt_url && !uploadingFile && (
                      <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> ไฟล์อัปโหลดเรียบร้อย: {expenseForm.receipt_url}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  หมายเหตุเพิ่มเติม
                </label>
                <textarea
                  rows={2}
                  placeholder="หมายเหตุเพิ่มเติมสำหรับการหักภาษีปลายปี..."
                  value={expenseForm.notes}
                  onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-red-500/50"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-white/10 transition-colors"
                >
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary bg-red-600 hover:bg-red-500">
                  บันทึกรายจ่าย
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================
          MODAL 3: Create Time Entry Modal
          ============================== */}
      {timeEntryModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-850 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center border-b border-white/5">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" /> บันทึกเวลาปฏิบัติงานทนายความ
              </h2>
              <button onClick={() => setTimeEntryModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleTimeEntrySubmit} className="p-6 space-y-4 text-slate-300">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  เลือกแฟ้มคดีอ้างอิง *
                </label>
                <select
                  required
                  value={timeEntryForm.case_id}
                  onChange={e => setTimeEntryForm(f => ({ ...f, case_id: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">-- กรุณาเลือกแฟ้มคดี --</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>{c.title} ({c.case_number})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    จำนวนชั่วโมงทำงาน (ชม.) *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.5"
                    value={timeEntryForm.hours || ''}
                    onChange={e => setTimeEntryForm(f => ({ ...f, hours: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    อัตราค่าชั่วโมงต่อหน่วย (บาท) *
                  </label>
                  <input
                    type="number"
                    required
                    value={timeEntryForm.hourly_rate || ''}
                    onChange={e => setTimeEntryForm(f => ({ ...f, hourly_rate: parseFloat(e.target.value) || 1000.0 }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  กิจกรรมทนายความคดี *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ร่างคำร้องยื่นขอปล่อยชั่วคราว, ศึกษาประเด็นกฎหมายพยานหลักฐาน..."
                  value={timeEntryForm.description}
                  onChange={e => setTimeEntryForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    วันที่ปฏิบัติกิจกรรม
                  </label>
                  <input
                    type="date"
                    required
                    value={timeEntryForm.date}
                    onChange={e => setTimeEntryForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="is_billable"
                    checked={timeEntryForm.is_billable}
                    onChange={e => setTimeEntryForm(f => ({ ...f, is_billable: e.target.checked }))}
                    className="w-4 h-4 rounded border-white/10 bg-slate-800 text-blue-500 focus:ring-blue-500"
                  />
                  <label htmlFor="is_billable" className="text-xs font-semibold text-slate-300">
                    เรียกเก็บเงินได้ (Billable)
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTimeEntryModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-white/10 transition-colors"
                >
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary bg-blue-600 hover:bg-blue-500">
                  บันทึกข้อมูลเวลา
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================
          MODAL 4: Invoice PDF Print View Modal
          ============================== */}
      {invoiceViewModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 animate-fade-in flex flex-col">
            {/* Header controls (Screen-only) */}
            <div className="bg-slate-850 px-6 py-4 flex justify-between items-center border-b border-white/5 print:hidden">
              <h3 className="text-white font-bold text-sm">
                ตัวอย่างพิมพ์เอกสาร: {selectedInvoice.invoice_number}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Printer className="w-4 h-4" /> พิมพ์บิลเอกสาร
                </button>
                <button onClick={() => setInvoiceViewModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Invoice Printable Sheet */}
            <div className="p-10 bg-white text-slate-800 text-sm font-sans relative print:p-0 min-h-[700px]">
              {/* Logo / Office Stamp header */}
              <div className="flex justify-between items-start border-b-2 border-slate-300 pb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                     สำนักงานกฎหมาย ทรีเทพ ดีเวลล็อปเม้นท์
                  </h2>
                  <p className="text-slate-500 text-xs mt-1 max-w-sm">
                    เลขที่ 123/456 ถ.มิตรภาพ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000<br/>
                    โทรศัพท์: 043-123456 | อีเมล: support@treetep-law.com
                  </p>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-bold text-slate-800">ใบแจ้งหนี้ / ใบเสร็จรับเงิน</h3>
                  <p className="text-slate-500 font-mono text-xs mt-1">INVOICE / RECEIPT</p>
                </div>
              </div>

              {/* Client & Invoice Meta Info */}
              <div className="grid grid-cols-2 gap-6 my-6 text-xs leading-relaxed">
                <div className="space-y-1">
                  <p className="text-slate-400 font-bold uppercase tracking-wider">เรียกเก็บเงินถึง (Client):</p>
                  <p className="text-slate-900 font-bold text-sm">{selectedInvoice.client_name}</p>
                  <p className="text-slate-500">คดีอ้างอิง: {selectedInvoice.case_title || 'ค่าบริการที่ปรึกษากฎหมายทั่วไป'}</p>
                </div>

                <div className="space-y-1 text-right">
                  <p><span className="text-slate-400 font-bold">เลขที่เอกสาร (No.):</span> <span className="font-mono font-bold text-slate-900">{selectedInvoice.invoice_number}</span></p>
                  <p><span className="text-slate-400 font-bold">วันที่สร้าง (Date):</span> {selectedInvoice.created_at ? new Date(selectedInvoice.created_at).toLocaleDateString('th-TH') : '-'}</p>
                  <p><span className="text-slate-400 font-bold">วันครบชำระ (Due Date):</span> {selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString('th-TH') : '-'}</p>
                  <p><span className="text-slate-400 font-bold">สถานะ (Status):</span> <span className="font-bold text-indigo-600">{selectedInvoice.status.toUpperCase()}</span></p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs border-collapse mt-8">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-700 font-bold">
                    <th className="p-3 w-8 text-center">ลำดับ</th>
                    <th className="p-3">รายละเอียดคำชี้แจงรายได้</th>
                    <th className="p-3 text-right w-16">จำนวน</th>
                    <th className="p-3 text-right w-24">ราคา/หน่วย</th>
                    <th className="p-3 text-right w-28">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {selectedInvoice.items.map((it, idx) => (
                    <tr key={it.id} className="hover:bg-slate-50">
                      <td className="p-3 text-center">{idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-900">{it.description}</td>
                      <td className="p-3 text-right font-mono">{it.quantity}</td>
                      <td className="p-3 text-right font-mono">฿{it.unit_price.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-semibold">฿{it.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Section */}
              <div className="flex justify-end mt-8">
                <div className="w-64 space-y-2 text-xs border-t border-slate-200 pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">ยอดรวมก่อนภาษี (Subtotal):</span>
                    <span className="font-mono text-slate-900">฿{selectedInvoice.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ภาษีมูลค่าเพิ่ม VAT ({selectedInvoice.tax_rate}%):</span>
                    <span className="font-mono text-slate-900">฿{selectedInvoice.tax_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm border-t border-slate-300 pt-2 text-slate-900">
                    <span>ยอดสุทธิรวม (Total):</span>
                    <span className="font-mono text-indigo-700">฿{selectedInvoice.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Footer Bank accounts / Terms details */}
              <div className="mt-16 pt-10 border-t border-slate-200 text-slate-500 text-[10px] grid grid-cols-2 gap-6 leading-relaxed">
                <div>
                  <h4 className="font-bold text-slate-700 mb-1">เงื่อนไขและการชำระเงิน (Payment Terms)</h4>
                  <p>
                    กรุณาโอนเงินผ่านบัญชีธนาคารเพื่อทำธุรกรรมทางการเงิน:<br/>
                    ธนาคารกสิกรไทย สาขาถนนมิตรภาพ ขอนแก่น<br/>
                    บัญชีกระแสรายวัน เลขที่บัญชี: <span className="font-mono font-bold text-slate-700">123-1-45678-9</span><br/>
                    ชื่อบัญชี: บจก. สำนักงานกฎหมาย ทรีเทพ ดีเวลล็อปเม้นท์
                  </p>
                </div>
                <div className="text-center flex flex-col justify-end items-center h-full">
                  <div className="w-40 border-b border-slate-400 h-10" />
                  <p className="mt-2 text-slate-600 font-semibold">( ลงชื่อผู้มีอำนาจลงนาม / ฝ่ายการเงิน )</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================
          MODAL 5: Attachment slip modal
          ============================== */}
      {slipModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-850 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in text-slate-300">
            {/* Header */}
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center border-b border-white/5">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" /> อัปเดตสลิปหลักฐานโอนเงิน
              </h2>
              <button onClick={() => setSlipModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  หลักฐานการโอนเงิน (Payment Slip)
                </label>
                <div className="flex gap-4 mb-2 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="slip_evidence_type"
                      checked={slipEvidenceType === 'link'}
                      onChange={() => setSlipEvidenceType('link')}
                      className="accent-emerald-500"
                    />
                    ระบุลิงก์เว็บ (Link URL)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="slip_evidence_type"
                      checked={slipEvidenceType === 'upload'}
                      onChange={() => setSlipEvidenceType('upload')}
                      className="accent-emerald-500"
                    />
                    อัปโหลดรูปภาพ/ไฟล์ (Upload File)
                  </label>
                </div>

                {slipEvidenceType === 'link' ? (
                  <input
                    type="text"
                    required
                    placeholder="เช่น http://localhost:8000/uploads/slip.jpg"
                    value={slipUrlInput}
                    onChange={e => setSlipUrlInput(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                ) : (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setUploadingFile(true)
                          setErrorMsg('')
                          try {
                            const formData = new FormData()
                            formData.append('file', file)
                            formData.append('file_type', 'หลักฐาน')
                            const token = localStorage.getItem('access_token')
                            const res = await fetch(`${BACKEND}/documents/upload`, {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${token}` },
                              body: formData
                            })
                            const result = await res.json()
                            if (res.ok) {
                              setSlipUrlInput(result.data.storage_url)
                              setSuccessMsg('อัปโหลดสลิปสำเร็จ!')
                            } else {
                              setErrorMsg(result.detail || 'อัปโหลดสลิปล้มเหลว')
                            }
                          } catch (err) {
                            setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์เพื่ออัปโหลด')
                          } finally {
                            setUploadingFile(false)
                          }
                        }
                      }}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-slate-400 text-xs focus:outline-none focus:border-emerald-500/50"
                    />
                    {uploadingFile && (
                      <p className="text-[10px] text-amber-400 flex items-center gap-1.5 animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> กำลังอัปโหลดไฟล์...
                      </p>
                    )}
                    {slipUrlInput && !uploadingFile && (
                      <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> สลิปอัปโหลดเรียบร้อย: {slipUrlInput}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSlipModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-white/10 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => {
                    handleUpdateInvoiceStatus(slipInvoiceId, 'paid', slipUrlInput)
                    setSlipModalOpen(false)
                  }}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-500"
                >
                  บันทึกการชำระเงินโอน
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
