'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  UserCheck, Users, Clock, Calendar, CreditCard, Search,
  Plus, Edit, Trash2, Check, X, AlertCircle, RefreshCw,
  Printer, CheckSquare, Award, Phone, Mail, FileText, ChevronRight
} from 'lucide-react'

// ==============================
// Types
// ==============================
interface Employee {
  id: string
  email: string
  full_name: string
  phone?: string
  role: string
  is_active: boolean
  bar_number?: string
  specializations: string[]
  created_at: string
}

interface Attendance {
  id: string
  user_id: string
  employee_name: string
  employee_role: string
  date: string
  check_in?: string
  check_out?: string
  status: string  // on_time, late, absent
  notes?: string
}

interface Leave {
  id: string
  user_id: string
  employee_name: string
  leave_type: string  // ลาป่วย, ลากิจ, ลาพักร้อน
  start_date: string
  end_date: string
  reason?: string
  status: string  // pending, approved, rejected
  approver_name?: string
  created_at: string
}

interface Payroll {
  id: string
  user_id: string
  employee_name: string
  employee_role: string
  base_salary: number
  allowance: number
  deductions: number
  net_salary: number
  pay_period: string  // YYYY-MM
  payment_status: string  // pending, paid
  paid_at?: string
  created_at: string
}

// ==============================
// Constants & Config
// ==============================
const BACKEND = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1')
  : 'http://localhost:8000/api/v1'

const ROLE_LABELS: Record<string, string> = {
  'admin': 'ผู้ดูแลระบบ (Admin)',
  'partner': 'หุ้นส่วนอาวุโส (Partner)',
  'lawyer': 'ทนายความ (Lawyer)',
  'clerk': 'เสมียน/เจ้าหน้าที่ (Clerk)'
}

const ROLE_COLORS: Record<string, string> = {
  'admin': 'bg-red-500/20 text-red-300 border-red-500/30',
  'partner': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'lawyer': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'clerk': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
}

export default function HRPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [payroll, setPayroll] = useState<Payroll[]>([])

  // UI tabs and controls
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'leaves' | 'payroll'>('employees')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUserRole, setCurrentUserRole] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentTime, setCurrentTime] = useState('')

  // Modals
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false)
  const [editEmployeeModalOpen, setEditEmployeeModalOpen] = useState(false)
  const [payrollModalOpen, setPayrollModalOpen] = useState(false)
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null)

  // Forms
  const [employeeForm, setEmployeeForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'clerk',
    bar_number: '',
    specializations: ''
  })

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [editEmployeeForm, setEditEmployeeForm] = useState({
    full_name: '',
    phone: '',
    role: 'clerk',
    bar_number: '',
    specializations: '',
    is_active: true
  })

  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'ลาป่วย',
    start_date: '',
    end_date: '',
    reason: ''
  })

  const [payrollForm, setPayrollForm] = useState({
    user_id: '',
    base_salary: 0,
    allowance: 0,
    deductions: 0,
    pay_period: new Date().toISOString().slice(0, 7) // "YYYY-MM"
  })

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('th-TH'))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // ------------------------------------------
  // Data Fetching
  // ------------------------------------------
  const fetchData = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    const token = localStorage.getItem('access_token')
    if (!token) {
      setErrorMsg('กรุณาเข้าสู่ระบบก่อน')
      setLoading(false)
      return
    }

    // Set current user profiles
    try {
      const userProfileStr = localStorage.getItem('user')
      if (userProfileStr) {
        const profile = JSON.parse(userProfileStr)
        setCurrentUserRole(profile.role || 'clerk')
        setCurrentUserId(profile.id || '')
      }
    } catch (e) {
      console.error(e)
    }

    try {
      // 1. Fetch Employees
      const empRes = await fetch(`${BACKEND}/hr/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (empRes.ok) {
        const resJson = await empRes.json()
        setEmployees(resJson.data || [])
      }

      // 2. Fetch Attendance
      const attRes = await fetch(`${BACKEND}/hr/attendance`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (attRes.ok) {
        const resJson = await attRes.json()
        setAttendance(resJson.data || [])
      }

      // 3. Fetch Leaves
      const leaveRes = await fetch(`${BACKEND}/hr/leaves`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (leaveRes.ok) {
        const resJson = await leaveRes.json()
        setLeaves(resJson.data || [])
      }

      // 4. Fetch Payroll
      const payrollRes = await fetch(`${BACKEND}/hr/payroll`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (payrollRes.ok) {
        const resJson = await payrollRes.json()
        setPayroll(resJson.data || [])
      }

    } catch (err: any) {
      setErrorMsg('ไม่สามารถติดต่อเซิร์ฟเวอร์ระบบ HR ได้')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Check role helper
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'partner'

  // ------------------------------------------
  // Employee Actions
  // ------------------------------------------
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')
    
    try {
      const specsList = employeeForm.specializations
        ? employeeForm.specializations.split(',').map(s => s.trim())
        : []

      const res = await fetch(`${BACKEND}/hr/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...employeeForm,
          specializations: specsList
        })
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg('เพิ่มข้อมูลพนักงานเข้าระบบสำเร็จ!')
        setEmployees(prev => [data.data, ...prev])
        setEmployeeModalOpen(false)
        setEmployeeForm({
          email: '', password: '', full_name: '', phone: '',
          role: 'clerk', bar_number: '', specializations: ''
        })
      } else {
        setErrorMsg(data.detail || 'เกิดข้อผิดพลาด')
      }
    } catch {
      setErrorMsg('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว')
    }
  }

  const handleEditEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEmployee) return
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const specsList = editEmployeeForm.specializations
        ? editEmployeeForm.specializations.split(',').map(s => s.trim())
        : []

      const res = await fetch(`${BACKEND}/hr/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...editEmployeeForm,
          specializations: specsList
        })
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg('แก้ไขข้อมูลพนักงานสำเร็จ!')
        setEmployees(prev => prev.map(emp => emp.id === editingEmployee.id ? data.data : emp))
        setEditEmployeeModalOpen(false)
        setEditingEmployee(null)
      } else {
        setErrorMsg(data.detail || 'เกิดข้อผิดพลาด')
      }
    } catch {
      setErrorMsg('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว')
    }
  }

  // ------------------------------------------
  // Attendance Check-In / Out
  // ------------------------------------------
  const handleCheckIn = async () => {
    setCheckingIn(true)
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/hr/attendance/check-in`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(data.message)
        setAttendance(prev => [data.data, ...prev])
      } else {
        setErrorMsg(data.detail || 'ลงเวลาเข้างานล้มเหลว')
      }
    } catch {
      setErrorMsg('ข้อผิดพลาดเครือข่าย')
    } finally {
      setCheckingIn(false)
    }
  }

  const handleCheckOut = async () => {
    setCheckingIn(true)
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/hr/attendance/check-out`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(data.message)
        setAttendance(prev => prev.map(a => a.id === data.data.id ? data.data : a))
      } else {
        setErrorMsg(data.detail || 'ลงเวลาออกงานล้มเหลว')
      }
    } catch {
      setErrorMsg('ข้อผิดพลาดเครือข่าย')
    } finally {
      setCheckingIn(false)
    }
  }

  // ------------------------------------------
  // Leave Requests
  // ------------------------------------------
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leaveForm.start_date || !leaveForm.end_date) {
      setErrorMsg('กรุณากรอกวันที่ลาหยุด')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/hr/leaves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(leaveForm)
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg('ยื่นใบลาหยุดสำเร็จแล้ว!')
        setLeaves(prev => [data.data, ...prev])
        setLeaveForm({ leave_type: 'ลาป่วย', start_date: '', end_date: '', reason: '' })
      } else {
        setErrorMsg(data.detail || 'ยื่นใบลาล้มเหลว')
      }
    } catch {
      setErrorMsg('ข้อผิดพลาดการเชื่อมต่อ')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveLeave = async (id: string, status: 'approved' | 'rejected') => {
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/hr/leaves/${id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(status === 'approved' ? 'อนุมัติใบลาเรียบร้อยแล้ว' : 'ปฏิเสธใบลาเรียบร้อยแล้ว')
        setLeaves(prev => prev.map(lv => lv.id === id ? data.data : lv))
      } else {
        setErrorMsg(data.detail || 'ดำเนินการล้มเหลว')
      }
    } catch {
      setErrorMsg('ข้อผิดพลาดการอนุมัติ')
    } finally {
      setLoading(false)
    }
  }

  // ------------------------------------------
  // Payroll / Salary Payouts
  // ------------------------------------------
  const handleGeneratePayroll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payrollForm.user_id || !payrollForm.base_salary) {
      setErrorMsg('กรุณาระบุข้อมูลการจ่ายเงินเดือนให้ครบถ้วน')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/hr/payroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payrollForm)
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg('จัดทำเงินเดือนของพนักงานสำเร็จ!')
        setPayroll(prev => [data.data, ...prev])
        setPayrollModalOpen(false)
        setPayrollForm({ user_id: '', base_salary: 0, allowance: 0, deductions: 0, pay_period: new Date().toISOString().slice(0, 7) })
      } else {
        setErrorMsg(data.detail || 'สร้างสลิปเงินเดือนล้มเหลว')
      }
    } catch {
      setErrorMsg('ข้อผิดพลาดการเชื่อมต่อเครือข่าย')
    } finally {
      setLoading(false)
    }
  }

  const handlePayPayroll = async (id: string) => {
    if (!confirm('ยืนยันบันทึกประวัติการโอนชำระเงินเดือนเรียบร้อยแล้ว?')) return

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    const token = localStorage.getItem('access_token')

    try {
      const res = await fetch(`${BACKEND}/hr/payroll/${id}/pay`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg('ทำเรื่องชำระเงินเดือนสำเร็จ!')
        setPayroll(prev => prev.map(p => p.id === id ? data.data : p))
        if (selectedPayroll?.id === id) {
          setSelectedPayroll(data.data)
        }
      } else {
        setErrorMsg(data.detail || 'ชำระเงินล้มเหลว')
      }
    } catch {
      setErrorMsg('ข้อผิดพลาดชำระเงิน')
    } finally {
      setLoading(false)
    }
  }

  // ------------------------------------------
  // Filters
  // ------------------------------------------
  const filteredEmployees = employees.filter(emp =>
    searchQuery === '' ||
    emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.phone && emp.phone.includes(searchQuery))
  )

  // Clock widget info
  const checkInRecord = attendance.find(a => a.user_id === currentUserId && a.date === new Date().toISOString().slice(0, 10))

  return (
    <div className="space-y-6 animate-fade-in relative min-h-[85vh]">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-indigo-400" /> ระบบบริหารจัดการงานบุคคล (HRMS)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            ศูนย์กลางสิทธิ์การใช้งานพนักงาน สมุดเข้าเวรประจำวัน คำขอลา และสลิปจ่ายเงินเดือน
          </p>
        </div>

        {isAdmin && activeTab === 'employees' && (
          <button
            onClick={() => setEmployeeModalOpen(true)}
            className="btn-primary bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> เพิ่มบัญชีพนักงานใหม่
          </button>
        )}

        {isAdmin && activeTab === 'payroll' && (
          <button
            onClick={() => setPayrollModalOpen(true)}
            className="btn-primary bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> จัดทำเงินเดือนพนักงาน
          </button>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-white/5 space-x-2">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'employees'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" /> รายชื่อพนักงาน ({employees.length})
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'attendance'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" /> ลงเวลาเข้างาน
        </button>

        <button
          onClick={() => setActiveTab('leaves')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'leaves'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" /> ประวัติการลาหยุด ({leaves.length})
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'payroll'
              ? 'border-pink-500 text-pink-400 bg-pink-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" /> เงินเดือน & สลิป
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

      {/* Loading overlay */}
      {loading && (
        <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-sm text-slate-400">กำลังประมวลผลข้อมูลการบริหารงานบุคคล...</p>
        </div>
      )}

      {/* Tab 1: Employees Directory */}
      {!loading && activeTab === 'employees' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="ค้นหาชื่อพนักงาน, อีเมล, เบอร์โทร..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/60 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500/50"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmployees.map(emp => (
              <div
                key={emp.id}
                className={`glass rounded-2xl p-5 border border-white/5 space-y-4 hover:border-indigo-500/30 transition-all hover:shadow-lg ${
                  !emp.is_active ? 'opacity-50' : ''
                }`}
              >
                {/* Profile Header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300">
                      {emp.full_name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-sm">{emp.full_name}</h4>
                      <span className={`px-2 py-0.5 text-3xs font-semibold rounded-full border inline-block mt-1 ${ROLE_COLORS[emp.role] || 'bg-slate-500/20 border-white/10'}`}>
                        {ROLE_LABELS[emp.role] || emp.role}
                      </span>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setEditingEmployee(emp)
                        setEditEmployeeForm({
                          full_name: emp.full_name,
                          phone: emp.phone || '',
                          role: emp.role,
                          bar_number: emp.bar_number || '',
                          specializations: emp.specializations.join(', '),
                          is_active: emp.is_active
                        })
                        setEditEmployeeModalOpen(true)
                      }}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 rounded hover:bg-white/5 transition-colors"
                      title="แก้ไขข้อมูลพนักงาน"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Details info */}
                <div className="text-xs space-y-2 border-t border-white/5 pt-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-300 font-mono">{emp.email}</span>
                  </div>

                  {emp.phone && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-300 font-mono">{emp.phone}</span>
                    </div>
                  )}

                  {emp.bar_number && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Award className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-slate-300">เลขใบอนุญาตทนาย: {emp.bar_number}</span>
                    </div>
                  )}
                </div>

                {/* Specializations list */}
                {emp.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
                    {emp.specializations.map((spec, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-3xs font-medium bg-slate-800 text-slate-300">
                        {spec}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Daily Attendance Time Logs */}
      {!loading && activeTab === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Interactive Check-In/Out Card */}
          <div className="lg:col-span-1 glass rounded-2xl p-6 border border-white/5 text-center space-y-6">
            <div>
              <Clock className="w-12 h-12 text-emerald-400 mx-auto animate-pulse" />
              <h3 className="text-white font-bold text-lg mt-3">ลงเวลาเข้างาน / ออกงาน</h3>
              <p className="text-slate-400 text-xs mt-1">เวลาเข้างานปกติ: 09:00 น.</p>
            </div>

            {/* Time display */}
            <div className="bg-slate-900/60 rounded-2xl py-5 border border-white/10">
              <span className="text-3xl font-mono font-bold text-white tracking-widest block">
                {currentTime || '--:--:--'}
              </span>
              <span className="text-3xs text-slate-500 mt-1 block">เวลาปัจจุบันเซิร์ฟเวอร์ประเทศไทย</span>
            </div>

            {/* Attendance Status slip */}
            <div className="text-left text-xs p-4 bg-slate-900/30 rounded-xl space-y-2 border border-white/5">
              <div className="flex justify-between">
                <span className="text-slate-400">เช็คอินเข้างาน:</span>
                <span className={`font-semibold ${checkInRecord?.check_in ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {checkInRecord?.check_in ? new Date(checkInRecord.check_in).toLocaleTimeString('th-TH') : 'ยังไม่ได้ลงเวลา'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">สถานะ:</span>
                <span className={`font-semibold ${
                  checkInRecord?.status === 'on_time' ? 'text-emerald-400' : 
                  checkInRecord?.status === 'late' ? 'text-amber-400' : 'text-slate-500'
                }`}>
                  {checkInRecord?.status === 'on_time' ? 'ตรงเวลา' : 
                   checkInRecord?.status === 'late' ? 'เข้างานสาย' : '-'}
                </span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-2">
                <span className="text-slate-400">เช็คเอาท์ออกงาน:</span>
                <span className={`font-semibold ${checkInRecord?.check_out ? 'text-blue-400' : 'text-slate-500'}`}>
                  {checkInRecord?.check_out ? new Date(checkInRecord.check_out).toLocaleTimeString('th-TH') : 'ยังไม่ได้ลงเวลา'}
                </span>
              </div>
            </div>

            {/* Check-in Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleCheckIn}
                disabled={checkingIn || !!checkInRecord?.check_in}
                className="flex-1 btn-primary bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
              >
                เช็คอิน (In)
              </button>
              <button
                onClick={handleCheckOut}
                disabled={checkingIn || !checkInRecord?.check_in || !!checkInRecord?.check_out}
                className="flex-1 btn-primary bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
              >
                เช็คเอาท์ (Out)
              </button>
            </div>
          </div>

          {/* Time Attendance logs table */}
          <div className="lg:col-span-2 glass rounded-2xl p-5 border border-white/5 space-y-4">
            <h3 className="text-white font-bold text-sm border-b border-white/5 pb-3">
              ประวัติลงบันทึกเวลาทำงานทั้งหมด
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-slate-800/20 text-slate-400 text-xs font-semibold">
                    <th className="p-3">วันที่</th>
                    <th className="p-3">ชื่อพนักงาน</th>
                    <th className="p-3">เช็คอิน (In)</th>
                    <th className="p-3">เช็คเอาท์ (Out)</th>
                    <th className="p-3">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300 text-xs font-mono">
                  {attendance.map(att => (
                    <tr key={att.id} className="hover:bg-white/5">
                      <td className="p-3">
                        {att.date ? new Date(att.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : ''}
                      </td>
                      <td className="p-3 font-sans font-semibold text-white">
                        {att.employee_name}
                      </td>
                      <td className="p-3 text-emerald-400">
                        {att.check_in ? new Date(att.check_in).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="p-3 text-blue-400">
                        {att.check_out ? new Date(att.check_out).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="p-3 font-sans">
                        <span className={`px-2 py-0.5 text-3xs font-semibold rounded-full border ${
                          att.status === 'on_time' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                          att.status === 'late' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'
                        }`}>
                          {att.status === 'on_time' ? 'ตรงเวลา' : 'เข้าสาย'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Leaves approval dashboard */}
      {!loading && activeTab === 'leaves' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left panel: Leave Request Form */}
          <div className="lg:col-span-1 glass rounded-2xl p-6 border border-white/5 space-y-4">
            <h3 className="text-white font-bold text-base border-b border-white/5 pb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" /> เขียนใบคำขอลาหยุด
            </h3>

            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  ประเภทการลา
                </label>
                <select
                  value={leaveForm.leave_type}
                  onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
                >
                  <option value="ลาป่วย">ลาป่วย (Sick Leave)</option>
                  <option value="ลากิจ">ลากิจ (Personal Leave)</option>
                  <option value="ลาพักร้อน">ลาพักร้อน (Vacation Leave)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    วันเริ่มลา
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveForm.start_date}
                    onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    วันสิ้นสุดลา
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveForm.end_date}
                    onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  เหตุผลการลา
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="เช่น มีไข้สูง ปวดศีรษะ หรือมีธุระจัดการครอบครัว..."
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <button type="submit" className="w-full btn-primary bg-amber-600 hover:bg-amber-500">
                ส่งคำลาหยุดพักผ่อน
              </button>
            </form>
          </div>

          {/* Right panel: Leave approval & history */}
          <div className="lg:col-span-2 glass rounded-2xl p-5 border border-white/5 space-y-4">
            <h3 className="text-white font-bold text-sm border-b border-white/5 pb-3">
              รายการคำขอลาและสถานะใบลา
            </h3>

            <div className="space-y-3.5">
              {leaves.map(lv => (
                <div key={lv.id} className="p-4 bg-slate-900/30 border border-white/5 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold text-sm">{lv.employee_name}</span>
                      <span className="px-2 py-0.5 rounded text-3xs font-semibold bg-slate-800 text-slate-300">
                        {lv.leave_type}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-3xs font-bold border ${
                        lv.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                        lv.status === 'rejected' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {lv.status === 'approved' ? 'อนุมัติแล้ว' :
                         lv.status === 'rejected' ? 'ปฏิเสธ' : 'รอการพิจารณา'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">เหตุผล: {lv.reason || 'ไม่ได้ระบุ'}</p>
                    <p className="text-3xs text-slate-500 font-mono">
                      ช่วงเวลา: {new Date(lv.start_date).toLocaleDateString('th-TH')} - {new Date(lv.end_date).toLocaleDateString('th-TH')}
                    </p>
                    {lv.approver_name && (
                      <p className="text-3xs text-emerald-400">พิจารณาโดย: {lv.approver_name}</p>
                    )}
                  </div>

                  {isAdmin && lv.status === 'pending' && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleApproveLeave(lv.id, 'approved')}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-2xs font-semibold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> อนุมัติ
                      </button>
                      <button
                        onClick={() => handleApproveLeave(lv.id, 'rejected')}
                        className="px-2.5 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded-lg text-2xs font-semibold flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> ปฏิเสธ
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Salary slips & Payroll logs */}
      {!loading && activeTab === 'payroll' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* List of payroll slips */}
          <div className="lg:col-span-2 glass rounded-2xl p-5 border border-white/5 space-y-4">
            <h3 className="text-white font-bold text-sm border-b border-white/5 pb-3">
              ประวัติการจ่ายเงินเดือนและสลิปพนักงาน
            </h3>

            <div className="space-y-3">
              {payroll.map(p => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPayroll(p)}
                  className={`p-4 bg-slate-900/40 border border-white/5 rounded-xl flex items-center justify-between hover:border-pink-500/20 cursor-pointer transition-all ${
                    selectedPayroll?.id === p.id ? 'ring-2 ring-pink-500/30 bg-slate-800/60 border-pink-500/30' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <h4 className="text-white font-bold text-sm">{p.employee_name}</h4>
                    <p className="text-3xs text-slate-500 font-mono">รอบรอบการจ่าย: {p.pay_period}</p>
                    <span className={`px-2 py-0.5 text-3xs font-semibold rounded-full border inline-block ${
                      p.payment_status === 'paid'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {p.payment_status === 'paid' ? 'จ่ายโอนสำเร็จ' : 'ค้างชำระ'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-white font-mono font-bold text-sm block">
                      ฿{(p.net_salary).toLocaleString()}
                    </span>
                    <span className="text-3xs text-slate-500 font-mono">ยอดรับสุทธิ</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Printable Slip card */}
          <div className="lg:col-span-1 space-y-4">
            {selectedPayroll ? (
              <div className="glass rounded-2xl p-6 border border-white/5 space-y-5 relative">
                <div className="text-center border-b border-white/5 pb-3">
                  <Award className="w-8 h-8 text-pink-400 mx-auto" />
                  <h3 className="text-white font-bold text-base mt-2">สลิปเงินเดือนพนักงาน</h3>
                  <span className="text-3xs text-slate-500 font-mono">ID: {selectedPayroll.id.slice(0, 8)}</span>
                </div>

                <div className="space-y-3.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">ชื่อพนักงาน:</span>
                    <span className="font-semibold text-white">{selectedPayroll.employee_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ตำแหน่ง:</span>
                    <span>{ROLE_LABELS[selectedPayroll.employee_role] || selectedPayroll.employee_role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">รอบบัญชีการจ่าย:</span>
                    <span className="font-mono">{selectedPayroll.pay_period}</span>
                  </div>

                  {/* Calculations slip */}
                  <div className="border-t border-dashed border-white/10 pt-3 space-y-2 font-mono">
                    <div className="flex justify-between">
                      <span>เงินเดือนฐาน (Base):</span>
                      <span className="text-white">฿{selectedPayroll.base_salary.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>เงินสวัสดิการ (Allowance):</span>
                      <span>+฿{selectedPayroll.allowance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-red-400">
                      <span>หักขาด/ภาษี (Deductions):</span>
                      <span>-฿{selectedPayroll.deductions.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Total Net pay */}
                  <div className="border-t border-white/10 pt-3 flex justify-between font-bold text-sm text-white">
                    <span>ยอดรับสุทธิ (Net Payout):</span>
                    <span className="text-pink-400 font-mono">฿{selectedPayroll.net_salary.toLocaleString()}</span>
                  </div>
                </div>

                {/* Status controls */}
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="flex justify-between text-3xs font-mono text-slate-500">
                    <span>สถานะการจ่ายเงิน:</span>
                    <span className={selectedPayroll.payment_status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}>
                      {selectedPayroll.payment_status === 'paid' ? 'จ่ายแล้ว' : 'รอชำระ'}
                    </span>
                  </div>

                  {isAdmin && selectedPayroll.payment_status === 'pending' && (
                    <button
                      onClick={() => handlePayPayroll(selectedPayroll.id)}
                      className="w-full btn-primary bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center gap-1 py-2 text-xs font-semibold"
                    >
                      <Check className="w-4 h-4" /> บันทึกการโอนเงินเดือน
                    </button>
                  )}

                  <button
                    onClick={() => window.print()}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Printer className="w-4 h-4" /> พิมพ์ใบสลิปเงินเดือน
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass rounded-2xl p-8 border border-white/5 text-center text-slate-500 py-16 space-y-3">
                <FileText className="w-12 h-12 text-slate-700 mx-auto" />
                <h4 className="text-slate-400 font-semibold text-xs">รายละเอียดการชำระเงิน</h4>
                <p className="text-3xs text-slate-500 max-w-xs mx-auto">
                  เลือกสลิปรายชื่อทางซ้ายมือ เพื่อดึงรายละเอียดการคิดเงินเดือน ภาษี และสวัสดิการแบบพิมพ์ได้
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Create Employee Modal */}
      {employeeModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-850 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center border-b border-white/5">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" /> เพิ่มบัญชีพนักงานใหม่เข้าระบบ
              </h2>
              <button onClick={() => setEmployeeModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateEmployee} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    ชื่อ-นามสกุล *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น สมศักดิ์ มีดี"
                    value={employeeForm.full_name}
                    onChange={e => setEmployeeForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น 0891234567"
                    value={employeeForm.phone}
                    onChange={e => setEmployeeForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    อีเมลประจำบัญชี *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="somsak@lawyertech.th"
                    value={employeeForm.email}
                    onChange={e => setEmployeeForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    รหัสผ่านบัญชี *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="ความยาวขั้นต่ำ 6 หลัก"
                    value={employeeForm.password}
                    onChange={e => setEmployeeForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    บทบาท/ตำแหน่งงาน
                  </label>
                  <select
                    value={employeeForm.role}
                    onChange={e => setEmployeeForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                    <option value="partner">Partner (หุ้นส่วนอาวุโส)</option>
                    <option value="lawyer">Lawyer (ทนายความคดี)</option>
                    <option value="clerk">Clerk (เสมียนสำนักงาน)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    เลขใบอนุญาตทนาย (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น 1234/2560"
                    value={employeeForm.bar_number}
                    onChange={e => setEmployeeForm(f => ({ ...f, bar_number: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  ความเชี่ยวชาญพิเศษ (คั่นด้วยเครื่องหมายจุลภาค ,)
                </label>
                <input
                  type="text"
                  placeholder="เช่น กฎหมายที่ดิน, กฎหมายภาษีอากร, คดีอาญา"
                  value={employeeForm.specializations}
                  onChange={e => setEmployeeForm(f => ({ ...f, specializations: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEmployeeModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-white/10 transition-colors"
                >
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary bg-indigo-600 hover:bg-indigo-500">
                  เพิ่มพนักงานใหม่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Employee Modal */}
      {editEmployeeModalOpen && editingEmployee && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-850 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center border-b border-white/5">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-400" /> แก้ไขประวัติและสิทธิ์พนักงาน
              </h2>
              <button onClick={() => setEditEmployeeModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditEmployeeSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    ชื่อ-นามสกุล *
                  </label>
                  <input
                    type="text"
                    required
                    value={editEmployeeForm.full_name}
                    onChange={e => setEditEmployeeForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="text"
                    value={editEmployeeForm.phone}
                    onChange={e => setEditEmployeeForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    บทบาท/ตำแหน่งงาน
                  </label>
                  <select
                    value={editEmployeeForm.role}
                    onChange={e => setEditEmployeeForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                    <option value="partner">Partner (หุ้นส่วนอาวุโส)</option>
                    <option value="lawyer">Lawyer (ทนายความคดี)</option>
                    <option value="clerk">Clerk (เสมียนสำนักงาน)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    เลขใบอนุญาตทนาย (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    value={editEmployeeForm.bar_number}
                    onChange={e => setEditEmployeeForm(f => ({ ...f, bar_number: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  ความเชี่ยวชาญพิเศษ (คั่นด้วยเครื่องหมายจุลภาค ,)
                </label>
                <input
                  type="text"
                  value={editEmployeeForm.specializations}
                  onChange={e => setEditEmployeeForm(f => ({ ...f, specializations: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editEmployeeForm.is_active}
                  onChange={e => setEditEmployeeForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded border-white/10 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="is_active" className="text-xs font-semibold text-slate-300">
                  อนุญาตให้ล็อกอินและใช้งานระบบได้ (Active Account)
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditEmployeeModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-white/10 transition-colors"
                >
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary bg-indigo-600 hover:bg-indigo-500">
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Generate Payroll Modal */}
      {payrollModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-850 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center border-b border-white/5">
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" /> จัดทำเงินเดือนและสลิปพนักงาน
              </h2>
              <button onClick={() => setPayrollModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleGeneratePayroll} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  เลือกพนักงานหลัก *
                </label>
                <select
                  required
                  value={payrollForm.user_id}
                  onChange={e => setPayrollForm(f => ({ ...f, user_id: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">-- กรุณาเลือกพนักงาน --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} ({ROLE_LABELS[emp.role] || emp.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    เงินเดือนฐาน (Base Salary) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="เช่น 30000"
                    value={payrollForm.base_salary || ''}
                    onChange={e => setPayrollForm(f => ({ ...f, base_salary: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    รอบประเมินจ่ายเงิน (Period) *
                  </label>
                  <input
                    type="month"
                    required
                    value={payrollForm.pay_period}
                    onChange={e => setPayrollForm(f => ({ ...f, pay_period: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    ค่าเบี้ยเลี้ยง / สวัสดิการพิเศษ
                  </label>
                  <input
                    type="number"
                    placeholder="เช่น 5000"
                    value={payrollForm.allowance || ''}
                    onChange={e => setPayrollForm(f => ({ ...f, allowance: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    ภาษีหัก ณ ที่จ่าย / หักขาดลาสาย
                  </label>
                  <input
                    type="number"
                    placeholder="เช่น 1500"
                    value={payrollForm.deductions || ''}
                    onChange={e => setPayrollForm(f => ({ ...f, deductions: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayrollModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-white/10 transition-colors"
                >
                  ยกเลิก
                </button>
                <button type="submit" className="btn-primary bg-emerald-600 hover:bg-emerald-500">
                  อนุมัติจัดทำรายการเงินเดือน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
