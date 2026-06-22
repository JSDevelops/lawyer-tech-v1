'use client'

import { useState, useEffect } from 'react'
import {
  Scale, Users, Building, CreditCard, LogOut,
  Plus, Trash2, Edit, Check, X, Loader2, Shield,
  Layers, Settings, BarChart2, Activity, Database, AlertCircle, Sparkles, Key, Mail
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

interface Tenant {
  id: string
  name: string
  subdomain: string
  status: 'active' | 'suspended' | 'trial_expired'
  created_at: string
  user_count: number
  case_count: number
  plan_name: string
  plan_price: number
  plan_price_yearly?: number
  billing_cycle?: 'monthly' | 'yearly'
  end_date?: string | null
}

interface Plan {
  id: string
  name: string
  price: number
  price_yearly: number
  max_users: number
  storage_limit_gb: number
  enable_ai: boolean
  enable_api_access: boolean
  created_at: string
}

interface SystemStats {
  total_tenants: number
  active_tenants: number
  total_users: number
  total_cases: number
  total_plans: number
  database_connections: number
  revenue_thb: number
}

export default function SuperAdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tenants' | 'plans' | 'billing' | 'transactions' | 'settings' | 'logs'>('dashboard')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(false)

  // Transaction States
  const [transactions, setTransactions] = useState<any[]>([])
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [newTransaction, setNewTransaction] = useState({
    tenant_id: '',
    plan_id: '',
    amount: 0,
    billing_cycle: 'monthly',
    payment_status: 'paid',
    payment_method: 'manual_override'
  })

  // Auth States
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Data States
  const [stats, setStats] = useState<SystemStats>({
    total_tenants: 0,
    active_tenants: 0,
    total_users: 0,
    total_cases: 0,
    total_plans: 0,
    database_connections: 0,
    revenue_thb: 0
  })
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])

  // System Settings State
  const [sysSettings, setSysSettings] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    
    gemini_api_key_override: '',
    gemini_model: 'gemini-1.5-pro',
    openai_api_key: '',
    openai_model: 'gpt-4o',
    
    bank_name: 'ธนาคารกสิกรไทย',
    bank_account_name: 'บริษัท เลเยอร์ เทค จำกัด',
    bank_account_number: '',
    promptpay_id: '',
    enable_bank_transfer: true,
    
    stripe_publishable_key: '',
    stripe_secret_key: '',
    stripe_webhook_secret: '',
    enable_stripe: false,
    
    maintenance_mode: false,
    allow_new_registrations: true
  })

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  // Modal / Form States
  const [showTenantModal, setShowTenantModal] = useState(false)
  const [newTenant, setNewTenant] = useState({
    name: '',
    subdomain: '',
    plan_id: '',
    billing_cycle: 'monthly',
    admin_email: '',
    admin_password: '',
    admin_full_name: '',
    admin_phone: ''
  })
  
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [planForm, setPlanForm] = useState({
    name: '',
    price: 0,
    price_yearly: 0,
    max_users: 3,
    storage_limit_gb: 1.0,
    enable_ai: false,
    enable_api_access: false
  })

  // Subscription Edit States
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [subSelectedTenant, setSubSelectedTenant] = useState<Tenant | null>(null)
  const [subPlanId, setSubPlanId] = useState('')
  const [subBillingCycle, setSubBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  // Get Auth Headers
  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('superadmin_token') : null
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }

  // Check login on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('superadmin_token')
      if (token) {
        setIsLoggedIn(true)
        loadData()
      }
    }
  }, [isLoggedIn])

  const loadData = async () => {
    setPageLoading(true)
    try {
      const token = localStorage.getItem('superadmin_token')
      if (!token) return

      // Fetch Stats
      const statsRes = await fetch(`${API}/superadmin/stats`, { headers: getHeaders() })
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      // Fetch Tenants
      const tenantsRes = await fetch(`${API}/superadmin/tenants`, { headers: getHeaders() })
      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json()
        setTenants(tenantsData)
      }

      // Fetch Plans
      const plansRes = await fetch(`${API}/superadmin/plans`, { headers: getHeaders() })
      if (plansRes.ok) {
        const plansData = await plansRes.json()
        setPlans(plansData)
      }

      // Fetch Global SaaS Settings
      const settingsRes = await fetch(`${API}/superadmin/settings`, { headers: getHeaders() })
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        setSysSettings(settingsData)
      }

      // Fetch Audit Logs
      const logsRes = await fetch(`${API}/superadmin/logs`, { headers: getHeaders() })
      if (logsRes.ok) {
        const logsData = await logsRes.json()
        setAuditLogs(logsData)
      }

      // Fetch SaaS Transactions
      try {
        const txRes = await fetch(`${API}/superadmin/transactions`, { headers: getHeaders() })
        if (txRes.ok) {
          const txData = await txRes.json()
          setTransactions(txData)
        }
      } catch (e) {
        console.error("Error loading transactions:", e)
      }
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลระบบได้')
    } finally {
      setPageLoading(false)
    }
  }

  // Handle Save Global Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API}/superadmin/settings`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(sysSettings)
      })
      if (res.ok) {
        toast.success('บันทึกการตั้งค่าระบบส่วนกลางสำเร็จ')
        loadData()
      } else {
        const err = await res.json()
        toast.error(err.detail || 'เกิดข้อผิดพลาดในการบันทึก')
      }
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว')
    } finally {
      setLoading(false)
    }
  }

  // Handle Manual Tenant Subscription Plan Assignment
  const handleUpdateTenantSubscription = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subSelectedTenant || !subPlanId) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/superadmin/tenants/${subSelectedTenant.id}/subscription`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ 
          plan_id: subPlanId, 
          billing_cycle: subBillingCycle 
        })
      })
      if (res.ok) {
        toast.success(`เปลี่ยนแผนสมาชิกให้ ${subSelectedTenant.name} สำเร็จ`)
        setShowSubscriptionModal(false)
        setSubSelectedTenant(null)
        setSubPlanId('')
        loadData()
      } else {
        const err = await res.json()
        toast.error(err.detail || 'เกิดข้อผิดพลาด')
      }
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว')
    } finally {
      setLoading(false)
    }
  }

  // Handle Create SaaS Transaction manually
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTransaction.tenant_id || !newTransaction.plan_id) {
      toast.error('กรุณาเลือกสำนักงานและแผนสมาชิก')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API}/superadmin/transactions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newTransaction)
      })
      if (res.ok) {
        const data = await res.json()
        if (data.email_sent) {
          toast.success(`บันทึกธุรกรรมสำเร็จและส่งอีเมลใบเสร็จแล้ว`)
        } else {
          toast.success(`บันทึกธุรกรรมสำเร็จ (ไม่ได้ส่งเมล/ส่งเมลล้มเหลว)`)
        }
        setShowTransactionModal(false)
        setNewTransaction({
          tenant_id: '',
          plan_id: '',
          amount: 0,
          billing_cycle: 'monthly',
          payment_status: 'paid',
          payment_method: 'manual_override'
        })
        loadData()
      } else {
        const err = await res.json()
        toast.error(err.detail || 'เกิดข้อผิดพลาดในการบันทึกธุรกรรม')
      }
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว')
    } finally {
      setLoading(false)
    }
  }

  // Handle Resend Email
  const handleResendEmail = async (txId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/superadmin/transactions/${txId}/resend-email`, {
        method: 'POST',
        headers: getHeaders()
      })
      if (res.ok) {
        toast.success('ส่งอีเมลใบเสร็จ/แจ้งหนี้อีกครั้งสำเร็จ')
      } else {
        const err = await res.json()
        toast.error(err.detail || 'ส่งอีเมลล้มเหลว')
      }
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว')
    } finally {
      setLoading(false)
    }
  }

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'การเข้าสู่ระบบล้มเหลว')

      // Validate Admin/Partner role before granting superadmin access
      if (data.user.role !== 'admin' && data.user.role !== 'partner') {
        throw new Error('คุณไม่มีสิทธิ์ผู้ดูแลระบบส่วนกลาง (SuperAdmin)')
      }

      localStorage.setItem('superadmin_token', data.access_token)
      localStorage.setItem('superadmin_user', JSON.stringify(data.user))
      setIsLoggedIn(true)
      toast.success('ยินดีต้อนรับเข้าสู่ระบบจัดการ SaaS SuperAdmin')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('superadmin_token')
    localStorage.removeItem('superadmin_user')
    setIsLoggedIn(false)
    toast.success('ออกจากระบบเรียบร้อยแล้ว')
  }

  // Create Tenant
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTenant.name.trim()) return

    setLoading(true)
    try {
      const res = await fetch(`${API}/superadmin/tenants`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newTenant)
      })

      if (res.ok) {
        toast.success('ลงทะเบียนสำนักงานใหม่สำเร็จ')
        setShowTenantModal(false)
        setNewTenant({
          name: '',
          subdomain: '',
          plan_id: '',
          billing_cycle: 'monthly',
          admin_email: '',
          admin_password: '',
          admin_full_name: '',
          admin_phone: ''
        })
        loadData()
      } else {
        const err = await res.json()
        toast.error(err.detail || 'เกิดข้อผิดพลาด')
      }
    } catch {
      toast.error('ล้มเหลวในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
    }
  }

  // Toggle Tenant Status (Active / Suspended)
  const handleToggleTenantStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active'
    
    setLoading(true)
    try {
      const res = await fetch(`${API}/superadmin/tenants/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus })
      })

      if (res.ok) {
        toast.success(`เปลี่ยนสถานะสำนักงานเป็น ${nextStatus} เรียบร้อย`)
        loadData()
      } else {
        toast.error('ไม่สามารถเปลี่ยนสถานะได้')
      }
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว')
    } finally {
      setLoading(false)
    }
  }

  // Create/Edit Plan
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!planForm.name.trim()) return

    setLoading(true)
    try {
      const url = editingPlanId 
        ? `${API}/superadmin/plans/${editingPlanId}` 
        : `${API}/superadmin/plans`
      
      const method = editingPlanId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(planForm)
      })

      if (res.ok) {
        toast.success(editingPlanId ? 'อัปเดตแพ็กเกจสมาชิกเรียบร้อย' : 'สร้างแพ็กเกจใหม่เรียบร้อย')
        setShowPlanModal(false)
        setEditingPlanId(null)
        setPlanForm({
          name: '',
          price: 0,
          price_yearly: 0,
          max_users: 3,
          storage_limit_gb: 1.0,
          enable_ai: false,
          enable_api_access: false
        })
        loadData()
      } else {
        toast.error('เกิดข้อผิดพลาดในการบันทึกแพ็กเกจ')
      }
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว')
    } finally {
      setLoading(false)
    }
  }

  // Delete Plan
  const handleDeletePlan = async (id: string) => {
    if (!confirm('คุณแน่ใจว่าต้องการลบแพ็กเกจสมาชิกนี้หรือไม่?')) return

    try {
      const res = await fetch(`${API}/superadmin/plans/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      })

      if (res.ok) {
        toast.success('ลบแพ็กเกจสมาชิกสำเร็จ')
        loadData()
      } else {
        toast.error('ลบแพ็กเกจไม่สำเร็จ')
      }
    } catch {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว')
    }
  }

  // Load Form for Plan Editing
  const startEditPlan = (plan: Plan) => {
    setEditingPlanId(plan.id)
    setPlanForm({
      name: plan.name,
      price: plan.price,
      price_yearly: plan.price_yearly || 0,
      max_users: plan.max_users,
      storage_limit_gb: plan.storage_limit_gb,
      enable_ai: plan.enable_ai,
      enable_api_access: plan.enable_api_access
    })
    setShowPlanModal(true)
  }

  // Render Login view if not authenticated
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
        <Toaster />
        <div className="w-full max-w-md">
          {/* Logo Title */}
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="w-16 h-16 flex items-center justify-center mb-4">
              <img src="/images/logo.png" alt="Lawyer Tech Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-wider flex items-center gap-2">
              SaaS <span className="gradient-text">SuperAdmin</span>
            </h1>
            <p className="text-slate-400 text-xs mt-1">ระบบจัดการแผนสมาชิกและสำนักงานกลาง</p>
          </div>

          <div className="thai-flag-accent w-20 mx-auto mb-6" />

          {/* Login Card */}
          <form onSubmit={handleLogin} className="card space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">ผู้ควบคุมระบบหลังบ้าน</h2>
              <p className="text-xs text-slate-500">กรอกรหัสพนักงาน Admin เพื่อลงชื่อใช้งาน</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 block">อีเมลผู้ควบคุมระบบ</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="admin@lawyertech.co.th"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 block">รหัสผ่าน</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex justify-center items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              เข้าสู่ระบบการตั้งค่ากลาง
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg flex overflow-hidden">
      <Toaster />

      {/* Sidebar Panel */}
      <aside className="w-64 bg-dark-surface border-r border-dark-border flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-8">
          {/* Logo Section */}
          <div className="flex items-center gap-3 py-2 border-b border-white/5">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src="/images/logo.png" alt="Lawyer Tech Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">SuperAdmin</h2>
              <p className="text-[10px] text-slate-500">Lawyer Tech SaaS</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`sidebar-link w-full text-left ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <BarChart2 className="w-4 h-4" />
              แดชบอร์ดข้อมูลหลัก
            </button>
            <button
              onClick={() => setActiveTab('tenants')}
              className={`sidebar-link w-full text-left ${activeTab === 'tenants' ? 'active' : ''}`}
            >
              <Building className="w-4 h-4" />
              จัดการสำนักงาน (Tenants)
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`sidebar-link w-full text-left ${activeTab === 'plans' ? 'active' : ''}`}
            >
              <Layers className="w-4 h-4" />
              จัดการแพ็กเกจ (Plans)
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`sidebar-link w-full text-left ${activeTab === 'billing' ? 'active' : ''}`}
            >
              <CreditCard className="w-4 h-4" />
              จัดการแผนสมาชิก
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`sidebar-link w-full text-left ${activeTab === 'transactions' ? 'active' : ''}`}
            >
              <Database className="w-4 h-4" />
              ประวัติธุรกรรม & ใบเสร็จ
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`sidebar-link w-full text-left ${activeTab === 'settings' ? 'active' : ''}`}
            >
              <Settings className="w-4 h-4" />
              ตั้งค่าระบบส่วนกลาง
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`sidebar-link w-full text-left ${activeTab === 'logs' ? 'active' : ''}`}
            >
              <Activity className="w-4 h-4" />
              ประวัติการใช้งานระบบ (Logs)
            </button>
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-4">
          <div className="thai-flag-accent" />
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/5"
          >
            <LogOut className="w-4 h-4" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-dark-border bg-dark-surface/50 backdrop-blur-md">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {activeTab === 'dashboard' && 'แดชบอร์ดกลางการควบคุม'}
            {activeTab === 'tenants' && 'จัดการสำนักงานทนายความ'}
            {activeTab === 'plans' && 'จัดการแพ็กเกจสมาชิกและโควตา'}
            {activeTab === 'billing' && 'จัดการธุรกรรมและการต่ออายุสมาชิก'}
            {activeTab === 'transactions' && 'ประวัติธุรกรรม SaaS & ส่งอีเมลใบเสร็จ'}
            {activeTab === 'settings' && 'การตั้งค่าระบบส่วนกลาง (Global Config)'}
            {activeTab === 'logs' && 'ประวัติกิจกรรมการทำงานของระบบ (Audit Logs)'}
          </h2>
          <button 
            onClick={loadData}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
            disabled={pageLoading}
          >
            <Activity className={`w-3.5 h-3.5 ${pageLoading ? 'animate-spin' : ''}`} />
            รีเฟรชข้อมูลล่าสุด
          </button>
        </header>

        {/* Dynamic Panel Views */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {pageLoading && (
            <div className="flex items-center justify-center p-8 bg-white/5 rounded-xl border border-white/5">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs text-slate-400 ml-2">กำลังอัปเดตข้อมูลล่าสด...</span>
            </div>
          )}

          {/* VIEW: DASHBOARD STATS */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              {/* Stats Widgets */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card flex items-center gap-4">
                  <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl">
                    <Building className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">จำนวนสำนักงานทั้งหมด</p>
                    <p className="text-2xl font-bold text-white mt-0.5">{stats.total_tenants} แห่ง</p>
                  </div>
                </div>

                <div className="card flex items-center gap-4">
                  <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-xl">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">จำนวนผู้ใช้งานรวม</p>
                    <p className="text-2xl font-bold text-white mt-0.5">{stats.total_users} คน</p>
                  </div>
                </div>

                <div className="card flex items-center gap-4">
                  <div className="p-3 bg-amber-600/20 text-amber-400 rounded-xl">
                    <Scale className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">คดีที่จัดการในระบบ</p>
                    <p className="text-2xl font-bold text-white mt-0.5">{stats.total_cases} คดี</p>
                  </div>
                </div>

                <div className="card flex items-center gap-4">
                  <div className="p-3 bg-purple-600/20 text-purple-400 rounded-xl">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">รายได้เดือนปัจจุบัน (ประมาณการ)</p>
                    <p className="text-2xl font-bold text-white mt-0.5">{stats.revenue_thb.toLocaleString()} ฿</p>
                  </div>
                </div>
              </div>

              {/* System Infrastructure Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card md:col-span-2 space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    สถานะการทำงานของโครงสร้างระบบย่อย
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-300">ความเชื่อมโยงฐานข้อมูลหลัก (PostgreSQL DB Pool)</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400">เสถียร (Active: {stats.database_connections} open)</span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-300">ฐานข้อมูลเวกเตอร์กฎหมาย (Vector DB & PGVector Index)</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400">เชื่อมต่อแล้ว (1,245 ฎีกาที่ฝัง)</span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-300">ตัวประมวลผล Gemini AI API Token</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400">พร้อมใช้งาน (Gemini Pro Enabled)</span>
                    </div>
                  </div>
                </div>

                <div className="card space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-indigo-400" />
                    หมายเหตุโควตากลาง
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    ระบบ SuperAdmin ควบคุมปริมาณ API และขอบเขตการเก็บข้อมูล (Storage) ของแต่ละสำนักงานทนายความ 
                    เพื่อป้องกันการใช้งานทรัพยากรส่วนกลางเกินขีดจำกัด การปรับเปลี่ยนสิทธิ์ของแพ็กเกจจะมีผลกับการสมัครใช้งานใหม่และการต่ออายุในทันที
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: TENANTS MANAGEMENT */}
          {activeTab === 'tenants' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-400">รายชื่อบริษัทและสำนักงานกฎหมายที่ใช้บริการในระบบ ERP</p>
                <button
                  onClick={() => setShowTenantModal(true)}
                  className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  ลงทะเบียนสำนักงานใหม่
                </button>
              </div>

              {/* Tenants Table */}
              <div className="card overflow-x-auto p-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ชื่อสำนักงาน</th>
                      <th>ซับโดเมน</th>
                      <th>แพ็กเกจสมาชิก</th>
                      <th>รอบบิล</th>
                      <th>วันหมดอายุ</th>
                      <th>จำนวนบุคลากร</th>
                      <th>คดีทั้งหมด</th>
                      <th>สถานะบริการ</th>
                      <th>การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map(t => (
                      <tr key={t.id}>
                        <td className="font-semibold text-white">{t.name}</td>
                        <td>
                          <code className="text-xs bg-indigo-500/10 px-2 py-0.5 rounded text-indigo-300 border border-indigo-500/20">
                            {t.subdomain}.lawyertech.co.th
                          </code>
                        </td>
                        <td>{t.plan_name}</td>
                        <td>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.billing_cycle === 'yearly' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                            {t.billing_cycle === 'yearly' ? 'รายปี' : 'รายเดือน'}
                          </span>
                        </td>
                        <td className="text-xs text-slate-400">
                          {t.end_date ? new Date(t.end_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'ไม่มีกำหนด'}
                        </td>
                        <td>{t.user_count} คน</td>
                        <td>{t.case_count} คดี</td>
                        <td>
                          <span className={`badge ${t.status === 'active' ? 'badge-active' : 'badge-suspended'}`}>
                            {t.status === 'active' ? 'เปิดใช้งาน' : 'ระงับบริการ'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => handleToggleTenantStatus(t.id, t.status)}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-all
                              ${t.status === 'active' 
                                ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}`}
                          >
                            {t.status === 'active' ? 'ระงับชั่วคราว' : 'ปลดระงับ'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {tenants.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-slate-500 italic">
                          ยังไม่มีสำนักงานทนายความลงทะเบียนสมัครสมาชิก
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: PLANS MANAGEMENT */}
          {activeTab === 'plans' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-400">จัดการแพ็กเกจสมาชิกโควตาในการคุมระบบ ERP ทนายความ</p>
                <button
                  onClick={() => {
                    setEditingPlanId(null)
                    setPlanForm({
                      name: '',
                      price: 0,
                      price_yearly: 0,
                      max_users: 3,
                      storage_limit_gb: 1.0,
                      enable_ai: false,
                      enable_api_access: false
                    })
                    setShowPlanModal(true)
                  }}
                  className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  เพิ่มแพ็กเกจสมาชิกใหม่
                </button>
              </div>

              {/* Grid of Plans */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map(p => (
                  <div key={p.id} className="card flex flex-col justify-between border border-white/5 hover:border-indigo-500/20 transition-all">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <h4 className="text-lg font-bold text-white">{p.name}</h4>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => startEditPlan(p)} 
                            className="p-1 hover:text-indigo-400 text-slate-500 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeletePlan(p.id)} 
                            className="p-1 hover:text-red-400 text-slate-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="pb-4 border-b border-white/5 space-y-1">
                        <div>
                          <span className="text-2xl font-extrabold text-white">{p.price.toLocaleString()}</span>
                          <span className="text-xs text-slate-400 ml-1">฿ / เดือน</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          หรือ <span className="font-semibold text-slate-400">{(p.price_yearly || 0).toLocaleString()}</span> ฿ / ปี
                        </div>
                      </div>

                      <ul className="space-y-2.5 text-xs text-slate-300">
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>รองรับบุคลากรสูงสุด {p.max_users} บัญชี</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>จำกัดการเก็บไฟล์เอกสาร {p.storage_limit_gb} GB</span>
                        </li>
                        <li className="flex items-center gap-2">
                          {p.enable_ai ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span className={p.enable_ai ? 'text-slate-300' : 'text-slate-500 line-through'}>
                            เปิดใช้งาน AI วิเคราะห์และสรุปคดี
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          {p.enable_api_access ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span className={p.enable_api_access ? 'text-slate-300' : 'text-slate-500 line-through'}>
                            การเชื่อมโยงระบบภายนอก (External API Keys)
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                ))}
                {plans.length === 0 && (
                  <div className="card col-span-3 text-center py-8 text-slate-500 italic">
                    ยังไม่ได้มีการเพิ่มแพ็กเกจสมาชิกในขณะนี้
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW: BILLING & SUBSCRIPTIONS */}
          {activeTab === 'billing' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-400">ควบคุมสิทธิ์และตรวจสอบการต่ออายุแผนสมาชิกของสำนักงานทนายความ</p>
              </div>

              <div className="card overflow-x-auto p-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ชื่อสำนักงาน</th>
                      <th>ซับโดเมน</th>
                      <th>แพ็กเกจปัจจุบัน</th>
                      <th>รอบบิล</th>
                      <th>ค่าบริการ</th>
                      <th>วันหมดอายุ</th>
                      <th>ผู้ใช้งาน</th>
                      <th>สถานะ</th>
                      <th>จัดการสิทธิ์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map(t => (
                      <tr key={t.id}>
                        <td className="font-semibold text-white">{t.name}</td>
                        <td>
                          <code className="text-xs bg-indigo-500/10 px-2 py-0.5 rounded text-indigo-300 border border-indigo-500/20">
                            {t.subdomain}
                          </code>
                        </td>
                        <td>
                          <span className="font-medium text-slate-200">{t.plan_name}</span>
                        </td>
                        <td>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.billing_cycle === 'yearly' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                            {t.billing_cycle === 'yearly' ? 'รายปี' : 'รายเดือน'}
                          </span>
                        </td>
                        <td className="text-indigo-400 font-semibold">
                          {t.billing_cycle === 'yearly' 
                            ? `${(t.plan_price_yearly || 0).toLocaleString()} ฿` 
                            : `${(t.plan_price || 0).toLocaleString()} ฿`
                          }
                        </td>
                        <td className="text-xs text-slate-400">
                          {t.end_date ? new Date(t.end_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'ไม่มีกำหนด'}
                        </td>
                        <td>{t.user_count} คน</td>
                        <td>
                          <span className={`badge ${t.status === 'active' ? 'badge-active' : 'badge-suspended'}`}>
                            {t.status === 'active' ? 'กำลังใช้งาน' : 'ระงับบริการ'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              setSubSelectedTenant(t)
                              const matchedPlan = plans.find(p => p.name === t.plan_name)
                              setSubPlanId(matchedPlan ? matchedPlan.id : '')
                              setSubBillingCycle(t.billing_cycle || 'monthly')
                              setShowSubscriptionModal(true)
                            }}
                            className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 hover:border-indigo-500/40 hover:text-white"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            ปรับเปลี่ยนแผน
                          </button>
                        </td>
                      </tr>
                    ))}
                    {tenants.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-slate-500 italic">
                          ยังไม่มีข้อมูลสำนักงานในระบบ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* VIEW: SaaS TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-400">ประวัติการชำระเงินและธุรกรรมของระบบ SaaS ทั้งหมด</p>
                <button
                  onClick={() => setShowTransactionModal(true)}
                  className="btn-primary flex items-center gap-1.5 text-xs font-semibold py-2"
                >
                  <Plus className="w-4 h-4" />
                  บันทึกธุรกรรมแบบกำหนดเอง
                </button>
              </div>

              <div className="card p-0 overflow-hidden border border-white/5 bg-slate-950/40">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>เลขที่ใบเสร็จ</th>
                        <th>สำนักงาน (Tenant)</th>
                        <th>แพ็กเกจ</th>
                        <th>ค่าบริการ</th>
                        <th>รอบบิล</th>
                        <th>ช่องทางชำระเงิน</th>
                        <th>สถานะการชำระ</th>
                        <th>วันที่ชำระเงิน</th>
                        <th>การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-white/[0.02]">
                          <td className="font-mono text-xs text-white">{tx.invoice_number}</td>
                          <td className="font-semibold text-white">
                            {tx.tenant_name} <span className="text-slate-500 font-normal">({tx.tenant_subdomain})</span>
                          </td>
                          <td>{tx.plan_name}</td>
                          <td className="text-emerald-400 font-semibold">{tx.amount.toLocaleString()} ฿</td>
                          <td>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tx.billing_cycle === 'yearly' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                              {tx.billing_cycle === 'yearly' ? 'รายปี' : 'รายเดือน'}
                            </span>
                          </td>
                          <td className="text-slate-300 text-xs">
                            {tx.payment_method === 'bank_transfer' ? 'โอนเงินธนาคาร' :
                             tx.payment_method === 'credit_card' ? 'บัตรเครดิต/เดบิต' :
                             'ปรับระดับระบบส่วนกลาง (Manual)'}
                          </td>
                          <td>
                            <span className={`badge ${tx.payment_status === 'paid' ? 'badge-active' : tx.payment_status === 'pending' ? 'badge-pending' : 'badge-suspended'}`}>
                              {tx.payment_status === 'paid' ? 'ชำระแล้ว' :
                               tx.payment_status === 'pending' ? 'รอตรวจสอบ' : 'ล้มเหลว'}
                            </span>
                          </td>
                          <td className="text-slate-400 text-xs">
                            {tx.payment_date ? new Date(tx.payment_date).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td>
                            <button
                              onClick={() => handleResendEmail(tx.id)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                              disabled={loading}
                            >
                              <Mail className="w-3.5 h-3.5" />
                              ส่งเมลอีกครั้ง
                            </button>
                          </td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan={9} className="text-center py-8 text-slate-500 italic text-xs">
                            ยังไม่มีรายการธุรกรรมบันทึกในระบบ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: GLOBAL SaaS CONFIG */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-6 animate-fade-in max-w-5xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. SMTP configuration */}
                <div className="card space-y-4 border border-white/5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                    <Settings className="w-4 h-4 text-indigo-400" />
                    1. ตั้งค่าเมลเซิร์ฟเวอร์ระบบ (SMTP Settings)
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1">
                        <label className="text-xs text-slate-400">SMTP Host</label>
                        <input
                          type="text"
                          className="input-field"
                          value={sysSettings.smtp_host}
                          onChange={e => setSysSettings({ ...sysSettings, smtp_host: e.target.value })}
                          placeholder="smtp.gmail.com"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Port</label>
                        <input
                          type="number"
                          className="input-field"
                          value={sysSettings.smtp_port}
                          onChange={e => setSysSettings({ ...sysSettings, smtp_port: parseInt(e.target.value) || 587 })}
                          placeholder="587"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">SMTP User / Email Address</label>
                      <input
                        type="email"
                        className="input-field"
                        value={sysSettings.smtp_user}
                        onChange={e => setSysSettings({ ...sysSettings, smtp_user: e.target.value })}
                        placeholder="noreply@lawyertech.co.th"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">SMTP Password</label>
                      <input
                        type="password"
                        className="input-field"
                        value={sysSettings.smtp_password}
                        onChange={e => setSysSettings({ ...sysSettings, smtp_password: e.target.value })}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* 2. AI Chat Engine APIs */}
                <div className="card space-y-4 border border-white/5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    2. การตั้งค่าปัญญาประดิษฐ์ (AI Chat APIs)
                  </h3>
                  <div className="space-y-3">
                    <div className="space-y-2 pb-2 border-b border-white/5">
                      <h4 className="text-xs font-semibold text-indigo-300">Google Gemini API</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] text-slate-400">Gemini API Key</label>
                          <input
                            type="password"
                            className="input-field py-1 text-xs"
                            value={sysSettings.gemini_api_key_override}
                            onChange={e => setSysSettings({ ...sysSettings, gemini_api_key_override: e.target.value })}
                            placeholder="ปล่อยว่างเพื่อใช้คีย์เริ่มต้นระบบ"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400">โมเดลประมวลผล</label>
                          <select
                            className="input-field py-1 text-xs"
                            value={sysSettings.gemini_model}
                            onChange={e => setSysSettings({ ...sysSettings, gemini_model: e.target.value })}
                          >
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                            <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-emerald-400">OpenAI ChatGPT API</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] text-slate-400">OpenAI API Key</label>
                          <input
                            type="password"
                            className="input-field py-1 text-xs"
                            value={sysSettings.openai_api_key}
                            onChange={e => setSysSettings({ ...sysSettings, openai_api_key: e.target.value })}
                            placeholder="sk-proj-••••••••"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400">โมเดลประมวลผล</label>
                          <select
                            className="input-field py-1 text-xs"
                            value={sysSettings.openai_model}
                            onChange={e => setSysSettings({ ...sysSettings, openai_model: e.target.value })}
                          >
                            <option value="gpt-4o">GPT-4o (ดีที่สุด)</option>
                            <option value="gpt-4o-mini">GPT-4o mini (เร็ว/ประหยัด)</option>
                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Bank Account for Manual Transfer */}
                <div className="card space-y-4 border border-white/5">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-indigo-400" />
                      3. บัญชีรับชำระเงินโอนธนาคาร (Bank Transfer)
                    </h3>
                    <input
                      type="checkbox"
                      className="rounded text-indigo-600 bg-slate-800 border-slate-600"
                      checked={sysSettings.enable_bank_transfer}
                      onChange={e => setSysSettings({ ...sysSettings, enable_bank_transfer: e.target.checked })}
                    />
                  </div>
                  
                  <div className="space-y-3 opacity-90">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">ชื่อธนาคาร</label>
                        <select
                          className="input-field"
                          value={sysSettings.bank_name}
                          onChange={e => setSysSettings({ ...sysSettings, bank_name: e.target.value })}
                        >
                          <option value="ธนาคารกสิกรไทย">ธนาคารกสิกรไทย (KBANK)</option>
                          <option value="ธนาคารไทยพาณิชย์">ธนาคารไทยพาณิชย์ (SCB)</option>
                          <option value="ธนาคารกรุงเทพ">ธนาคารกรุงเทพ (BBL)</option>
                          <option value="ธนาคารกรุงไทย">ธนาคารกรุงไทย (KTB)</option>
                          <option value="ธนาคารกรุงศรีอยุธยา">ธนาคารกรุงศรีอยุธยา (BAY)</option>
                          <option value="ธนาคารทหารไทยธนชาต">ธนาคารทหารไทยธนชาต (TTB)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">เลขที่บัญชี</label>
                        <input
                          type="text"
                          className="input-field"
                          value={sysSettings.bank_account_number}
                          onChange={e => setSysSettings({ ...sysSettings, bank_account_number: e.target.value })}
                          placeholder="เช่น 123-4-56789-0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">ชื่อบัญชีรับเงิน</label>
                        <input
                          type="text"
                          className="input-field"
                          value={sysSettings.bank_account_name}
                          onChange={e => setSysSettings({ ...sysSettings, bank_account_name: e.target.value })}
                          placeholder="ชื่อบริษัท หรือ ชื่อบัญชีผู้รับเงิน"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">เลขพร้อมเพย์ (PromptPay ID)</label>
                        <input
                          type="text"
                          className="input-field"
                          value={sysSettings.promptpay_id}
                          onChange={e => setSysSettings({ ...sysSettings, promptpay_id: e.target.value })}
                          placeholder="เลขประจำตัวผู้เสียภาษี หรือ เบอร์โทร"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Credit/Debit Card via Stripe */}
                <div className="card space-y-4 border border-white/5">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-indigo-400" />
                      4. บัญชีรับบัตรเครดิต & เดบิต (Stripe API Config)
                    </h3>
                    <input
                      type="checkbox"
                      className="rounded text-indigo-600 bg-slate-800 border-slate-600"
                      checked={sysSettings.enable_stripe}
                      onChange={e => setSysSettings({ ...sysSettings, enable_stripe: e.target.checked })}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Stripe Publishable Key</label>
                      <input
                        type="text"
                        className="input-field text-xs"
                        value={sysSettings.stripe_publishable_key}
                        onChange={e => setSysSettings({ ...sysSettings, stripe_publishable_key: e.target.value })}
                        placeholder="pk_test_••••••••"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Stripe Secret Key</label>
                        <input
                          type="password"
                          className="input-field text-xs"
                          value={sysSettings.stripe_secret_key}
                          onChange={e => setSysSettings({ ...sysSettings, stripe_secret_key: e.target.value })}
                          placeholder="sk_test_••••••••"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Webhook Secret</label>
                        <input
                          type="password"
                          className="input-field text-xs"
                          value={sysSettings.stripe_webhook_secret}
                          onChange={e => setSysSettings({ ...sysSettings, stripe_webhook_secret: e.target.value })}
                          placeholder="whsec_••••••••"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Global Policies Mode */}
                <div className="card space-y-4 md:col-span-2 border border-white/5 bg-indigo-950/10">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                    นโยบายสถานะและการบริการระบบส่วนกลาง
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                      <div>
                        <p className="text-xs font-semibold text-white">โหมดปิดปรับปรุงระบบชั่วคราว (Maintenance Mode)</p>
                        <p className="text-[10px] text-slate-500">บล็อกผู้ใช้นอกเหนือจาก SuperAdmin</p>
                      </div>
                      <input
                        type="checkbox"
                        className="rounded text-indigo-600 bg-slate-800 border-slate-600"
                        checked={sysSettings.maintenance_mode}
                        onChange={e => setSysSettings({ ...sysSettings, maintenance_mode: e.target.checked })}
                      />
                    </div>

                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                      <div>
                        <p className="text-xs font-semibold text-white">เปิดรับการลงทะเบียนสำนักงานใหม่ (Self-Registration)</p>
                        <p className="text-[10px] text-slate-500">อนุญาตให้ผู้สนใจสมัครบริการ ERP ทนายความทางหน้าหลัก</p>
                      </div>
                      <input
                        type="checkbox"
                        className="rounded text-indigo-600 bg-slate-800 border-slate-600"
                        checked={sysSettings.allow_new_registrations}
                        onChange={e => setSysSettings({ ...sysSettings, allow_new_registrations: e.target.checked })}
                      />
                    </div>
                  </div>
                </div>

              </div>

              <div className="flex justify-end pt-4 border-t border-white/5">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary px-8 py-3 flex items-center justify-center gap-2 font-semibold text-sm shadow-lg shadow-indigo-600/25"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  บันทึกโครงสร้างระบบและการตั้งค่าทั้งหมด
                </button>
              </div>
            </form>
          )}

          {/* VIEW: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-400">ประวัติการปฏิบัติงานย้อนหลังของผู้ดูแลระบบและระบบหลังบ้าน</p>
              </div>

              <div className="card p-0 overflow-hidden border border-white/5">
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>เหตุการณ์ (Action)</th>
                        <th>รายละเอียด</th>
                        <th>ดำเนินการโดย</th>
                        <th>IP Address</th>
                        <th>วัน-เวลา</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-white/[0.02]">
                          <td>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border
                              ${log.action.includes('CREATE') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                              ${log.action.includes('UPDATE') ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : ''}
                              ${log.action.includes('DELETE') ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                              ${!log.action.includes('CREATE') && !log.action.includes('UPDATE') && !log.action.includes('DELETE') ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : ''}
                            `}>
                              {log.action}
                            </span>
                          </td>
                          <td className="text-slate-300 text-xs">{log.details}</td>
                          <td className="text-slate-400 text-xs">{log.performed_by_email}</td>
                          <td>
                            <code className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">
                              {log.ip_address}
                            </code>
                          </td>
                          <td className="text-slate-500 text-[11px]">
                            {new Date(log.created_at).toLocaleString('th-TH')}
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-500 italic text-xs">
                            ยังไม่มีประวัติกิจกรรมบันทึกในระบบหลังบ้านขณะนี้
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: ADD TENANT */}
      {showTenantModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form 
            onSubmit={handleCreateTenant} 
            className="card w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">ลงทะเบียนสำนักงานกฎหมายใหม่</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowTenantModal(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left Column: Office Details */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-1.5 pb-1 border-b border-white/5">
                  <Building className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">รายละเอียดสำนักงาน (Office)</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">ชื่อสำนักงานกฎหมาย *</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="เช่น สำนักงาน ทวีศักดิ์แอนด์พาร์ทเนอร์"
                    value={newTenant.name}
                    onChange={e => setNewTenant({ ...newTenant, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">ซับโดเมนเข้าใช้งาน *</label>
                  <div className="flex items-center bg-dark-bg border border-dark-border rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500/50">
                    <input
                      type="text"
                      className="bg-transparent border-0 outline-none text-white text-sm flex-1"
                      placeholder="taweesak"
                      value={newTenant.subdomain}
                      onChange={e => setNewTenant({ ...newTenant, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      required
                    />
                    <span className="text-xs text-slate-500 font-medium">.lawyertech.co.th</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">แพ็กเกจสมาชิกเริ่มต้น *</label>
                  <select
                    className="input-field"
                    value={newTenant.plan_id}
                    onChange={e => setNewTenant({ ...newTenant, plan_id: e.target.value })}
                    required
                  >
                    <option value="">เลือกแพ็กเกจสมาชิก</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.price.toLocaleString()} ฿/เดือน)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 block">รอบบิลชำระเงิน *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${newTenant.billing_cycle === 'monthly' ? 'bg-indigo-500/10 border-indigo-500 text-white' : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/5'}`}>
                      <input
                        type="radio"
                        name="billing_cycle"
                        value="monthly"
                        checked={newTenant.billing_cycle === 'monthly'}
                        onChange={() => setNewTenant({ ...newTenant, billing_cycle: 'monthly' })}
                        className="sr-only"
                      />
                      <span className="text-xs font-semibold">รายเดือน (Monthly)</span>
                    </label>
                    <label className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${newTenant.billing_cycle === 'yearly' ? 'bg-indigo-500/10 border-indigo-500 text-white' : 'border-white/5 bg-white/[0.02] text-slate-400 hover:bg-white/5'}`}>
                      <input
                        type="radio"
                        name="billing_cycle"
                        value="yearly"
                        checked={newTenant.billing_cycle === 'yearly'}
                        onChange={() => setNewTenant({ ...newTenant, billing_cycle: 'yearly' })}
                        className="sr-only"
                      />
                      <span className="text-xs font-semibold">รายปี (Yearly)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Admin details */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-1.5 pb-1 border-b border-white/5">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">ผู้ดูแลระบบหลัก (Super Administrator)</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">ชื่อ-นามสกุล *</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="input-field"
                      placeholder="เช่น ทนายสมศักดิ์ รักความยุติธรรม"
                      value={newTenant.admin_full_name}
                      onChange={e => setNewTenant({ ...newTenant, admin_full_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">อีเมลเข้าสู่ระบบ *</label>
                  <div className="relative">
                    <input
                      type="email"
                      className="input-field"
                      placeholder="admin@domain.com"
                      value={newTenant.admin_email}
                      onChange={e => setNewTenant({ ...newTenant, admin_email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">รหัสผ่านเริ่มต้น *</label>
                  <div className="relative">
                    <input
                      type="password"
                      className="input-field"
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      value={newTenant.admin_password}
                      onChange={e => setNewTenant({ ...newTenant, admin_password: e.target.value })}
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">เบอร์โทรศัพท์ติดต่อ</label>
                  <div className="relative">
                    <input
                      type="tel"
                      className="input-field"
                      placeholder="เช่น 0891234567"
                      value={newTenant.admin_phone}
                      onChange={e => setNewTenant({ ...newTenant, admin_phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Price summary block if plan is selected */}
              {newTenant.plan_id && (
                <div className="col-span-1 md:col-span-2 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                      <span className="text-slate-400 font-medium">สรุปค่าบริการเริ่มต้นของสำนักงานใหม่:</span>
                    </div>
                    <div className="text-sm font-bold text-white ml-3.5">
                      {plans.find(p => p.id === newTenant.plan_id)?.name} — {newTenant.billing_cycle === 'yearly' ? 'รอบบิลรายปี (ใช้งาน 365 วัน)' : 'รอบบิลรายเดือน (ใช้งาน 30 วัน)'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block font-medium">ยอดชำระเงินที่บันทึกเข้าระบบ:</span>
                    <span className="text-xl font-black text-indigo-400">
                      {newTenant.billing_cycle === 'yearly'
                        ? `${(plans.find(p => p.id === newTenant.plan_id)?.price_yearly || 0).toLocaleString()} ฿`
                        : `${(plans.find(p => p.id === newTenant.plan_id)?.price || 0).toLocaleString()} ฿`
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <button 
                type="button" 
                onClick={() => setShowTenantModal(false)}
                className="btn-secondary text-xs"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                className="btn-primary text-xs flex items-center gap-1.5"
                disabled={loading}
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                ลงทะเบียนและเปิดใช้งานระบบ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD/EDIT PLAN */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSavePlan} className="card w-full max-w-md space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-lg font-bold text-white">
                {editingPlanId ? 'แก้ไขแพ็กเกจสมาชิก' : 'เพิ่มแพ็กเกจสมาชิกใหม่'}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowPlanModal(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">ชื่อแพ็กเกจ *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="เช่น Standard, Professional"
                  value={planForm.name}
                  onChange={e => setPlanForm({ ...planForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">ราคาต่อเดือน (บาท) *</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="เช่น 1990"
                    value={planForm.price}
                    onChange={e => setPlanForm({ ...planForm, price: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">ราคาต่อปี (บาท) *</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="เช่น 19900"
                    value={planForm.price_yearly}
                    onChange={e => setPlanForm({ ...planForm, price_yearly: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">จำนวนบัญชีผู้ใช้งานสูงสุด</label>
                  <input
                    type="number"
                    className="input-field"
                    value={planForm.max_users}
                    onChange={e => setPlanForm({ ...planForm, max_users: parseInt(e.target.value) || 3 })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">จำกัดขนาดจัดเก็บไฟล์ (GB)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    value={planForm.storage_limit_gb}
                    onChange={e => setPlanForm({ ...planForm, storage_limit_gb: parseFloat(e.target.value) || 1 })}
                    required
                  />
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <label className="text-xs text-slate-400 block">เปิดใช้งานฟังก์ชันพิเศษ</label>
                
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      className="rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500/50"
                      checked={planForm.enable_ai}
                      onChange={e => setPlanForm({ ...planForm, enable_ai: e.target.checked })}
                    />
                    <span>เปิดใช้งานวิเคราะห์ด้วย AI</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      className="rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500/50"
                      checked={planForm.enable_api_access}
                      onChange={e => setPlanForm({ ...planForm, enable_api_access: e.target.checked })}
                    />
                    <span>เปิดสิทธิ์พัฒนา API ภายนอก</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <button 
                type="button" 
                onClick={() => setShowPlanModal(false)}
                className="btn-secondary text-xs"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                className="btn-primary text-xs flex items-center gap-1.5"
                disabled={loading}
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                บันทึกแพ็กเกจ
              </button>
            </div>
          </form>
        </div>
      )}
      {/* MODAL: MANUAL SUBSCRIPTION ADJUSTMENT */}
      {showSubscriptionModal && subSelectedTenant && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleUpdateTenantSubscription} className="card w-full max-w-md space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-lg font-bold text-white">ปรับเปลี่ยนแผนสมาชิกสำนักงาน</h3>
              <button 
                type="button" 
                onClick={() => {
                  setShowSubscriptionModal(false)
                  setSubSelectedTenant(null)
                }}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs space-y-1">
                <p className="text-slate-400">สำนักงานทนายความ:</p>
                <p className="text-sm font-semibold text-white">{subSelectedTenant.name}</p>
                <p className="text-slate-500 mt-1">ซับโดเมน: {subSelectedTenant.subdomain}</p>
                <p className="text-slate-500">แผนปัจจุบัน: {subSelectedTenant.plan_name}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 block">เลือกแผนสมาชิกใหม่ *</label>
                <select
                  className="input-field"
                  value={subPlanId}
                  onChange={e => setSubPlanId(e.target.value)}
                  required
                >
                  <option value="">-- เลือกแผนสมาชิก --</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.price.toLocaleString()} ฿/เดือน)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 block">เลือกรอบการเรียกเก็บเงิน (Billing Cycle)</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="radio"
                      name="subBillingCycle"
                      value="monthly"
                      checked={subBillingCycle === 'monthly'}
                      onChange={() => setSubBillingCycle('monthly')}
                      className="text-indigo-600 bg-slate-800 border-slate-600 focus:ring-indigo-500/50"
                    />
                    <span>รายเดือน (Monthly)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="radio"
                      name="subBillingCycle"
                      value="yearly"
                      checked={subBillingCycle === 'yearly'}
                      onChange={() => setSubBillingCycle('yearly')}
                      className="text-indigo-600 bg-slate-800 border-slate-600 focus:ring-indigo-500/50"
                    />
                    <span>รายปี (Yearly)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <button 
                type="button" 
                onClick={() => {
                  setShowSubscriptionModal(false)
                  setSubSelectedTenant(null)
                }}
                className="btn-secondary text-xs"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                className="btn-primary text-xs flex items-center gap-1.5"
                disabled={loading}
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                บันทึกการเปลี่ยนแผน
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: RECORD MANUAL TRANSACTION */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateTransaction} className="card w-full max-w-md space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-lg font-bold text-white">บันทึกธุรกรรมค่าแพ็กเกจด้วยมือ</h3>
              <button 
                type="button" 
                onClick={() => setShowTransactionModal(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">สำนักงานทนายความ *</label>
                <select
                  className="input-field"
                  value={newTransaction.tenant_id}
                  onChange={e => setNewTransaction({ ...newTransaction, tenant_id: e.target.value })}
                  required
                >
                  <option value="">เลือกสำนักงาน</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.subdomain})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">แพ็กเกจสมาชิก *</label>
                <select
                  className="input-field"
                  value={newTransaction.plan_id}
                  onChange={e => {
                    const planId = e.target.value
                    const matchedPlan = plans.find(p => p.id === planId)
                    const cyclePrice = matchedPlan 
                      ? (newTransaction.billing_cycle === 'yearly' ? matchedPlan.price_yearly : matchedPlan.price) 
                      : 0
                    setNewTransaction({ 
                      ...newTransaction, 
                      plan_id: planId,
                      amount: cyclePrice
                    })
                  }}
                  required
                >
                  <option value="">เลือกแพ็กเกจ</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">รอบบิลการใช้งาน</label>
                  <select
                    className="input-field"
                    value={newTransaction.billing_cycle}
                    onChange={e => {
                      const cycle = e.target.value
                      const matchedPlan = plans.find(p => p.id === newTransaction.plan_id)
                      const cyclePrice = matchedPlan 
                        ? (cycle === 'yearly' ? matchedPlan.price_yearly : matchedPlan.price) 
                        : 0
                      setNewTransaction({ 
                        ...newTransaction, 
                        billing_cycle: cycle,
                        amount: cyclePrice
                      })
                    }}
                    required
                  >
                    <option value="monthly">รายเดือน (Monthly)</option>
                    <option value="yearly">รายปี (Yearly)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">ยอดเงินชำระ (บาท) *</label>
                  <input
                    type="number"
                    className="input-field"
                    value={newTransaction.amount}
                    onChange={e => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">วิธีการชำระเงิน</label>
                  <select
                    className="input-field"
                    value={newTransaction.payment_method}
                    onChange={e => setNewTransaction({ ...newTransaction, payment_method: e.target.value })}
                    required
                  >
                    <option value="manual_override">ปรับเปลี่ยนสิทธิ์โดยแอดมิน</option>
                    <option value="bank_transfer">โอนเงินผ่านบัญชีธนาคาร</option>
                    <option value="credit_card">ชำระผ่านบัตรเครดิต</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">สถานะรายการ</label>
                  <select
                    className="input-field"
                    value={newTransaction.payment_status}
                    onChange={e => setNewTransaction({ ...newTransaction, payment_status: e.target.value })}
                    required
                  >
                    <option value="paid">ชำระเงินแล้วสำเร็จ</option>
                    <option value="pending">รอตรวจสอบความถูกต้อง</option>
                    <option value="failed">ชำระเงินไม่สำเร็จ</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <button 
                type="button" 
                onClick={() => setShowTransactionModal(false)}
                className="btn-secondary text-xs"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                className="btn-primary text-xs flex items-center gap-1.5"
                disabled={loading}
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                บันทึกธุรกรรม & ส่งเมล
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
