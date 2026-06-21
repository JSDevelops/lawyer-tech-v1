'use client'

import { useState, useEffect } from 'react'
import {
  Scale, Users, Building, CreditCard, LogOut,
  Plus, Trash2, Edit, Check, X, Loader2, Shield,
  Layers, Settings, BarChart2, Activity, Database, AlertCircle, Sparkles, Key
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
}

interface Plan {
  id: string
  name: string
  price: number
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tenants' | 'plans'>('dashboard')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(false)

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

  // Modal / Form States
  const [showTenantModal, setShowTenantModal] = useState(false)
  const [newTenant, setNewTenant] = useState({ name: '', subdomain: '', plan_id: '' })
  
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [planForm, setPlanForm] = useState({
    name: '',
    price: 0,
    max_users: 3,
    storage_limit_gb: 1.0,
    enable_ai: false,
    enable_api_access: false
  })

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
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลระบบได้')
    } finally {
      setPageLoading(false)
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
        setNewTenant({ name: '', subdomain: '', plan_id: '' })
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
            <div className="w-16 h-16 bg-indigo-600/20 rounded-3xl border border-indigo-500/30 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-indigo-400" />
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
            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl border border-indigo-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-indigo-400" />
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

                      <div className="pb-4 border-b border-white/5">
                        <span className="text-3xl font-extrabold text-white">{p.price.toLocaleString()}</span>
                        <span className="text-xs text-slate-400 ml-1">฿ / เดือน</span>
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
        </main>
      </div>

      {/* MODAL: ADD TENANT */}
      {showTenantModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateTenant} className="card w-full max-w-md space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-lg font-bold text-white">ลงทะเบียนสำนักงานใหม่</h3>
              <button 
                type="button" 
                onClick={() => setShowTenantModal(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">ชื่อสำนักงานกฎหมาย *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="เช่น สำนักงานสิริมงคลการค้า"
                  value={newTenant.name}
                  onChange={e => setNewTenant({ ...newTenant, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">ซับโดเมน *</label>
                <div className="flex items-center bg-dark-bg border border-dark-border rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500/50">
                  <input
                    type="text"
                    className="bg-transparent border-0 outline-none text-white text-sm flex-1"
                    placeholder="sirimongkol"
                    value={newTenant.subdomain}
                    onChange={e => setNewTenant({ ...newTenant, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    required
                  />
                  <span className="text-xs text-slate-500 font-medium">.lawyertech.co.th</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">แพ็กเกจสมาชิกเริ่มต้น</label>
                <select
                  className="input-field"
                  value={newTenant.plan_id}
                  onChange={e => setNewTenant({ ...newTenant, plan_id: e.target.value })}
                >
                  <option value="">เลือกแพ็กเกจสมาชิก</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.price.toLocaleString()} ฿/เดือน)</option>
                  ))}
                </select>
              </div>
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
                สร้างบัญชีสำนักงาน
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

              <div className="space-y-1">
                <label className="text-xs text-slate-400">ราคาต่อเดือน (บาท) *</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="เช่น 1500"
                  value={planForm.price}
                  onChange={e => setPlanForm({ ...planForm, price: parseFloat(e.target.value) || 0 })}
                  required
                />
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
    </div>
  )
}
