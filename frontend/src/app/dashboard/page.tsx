'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Scale, FileText, CreditCard, TrendingUp,
  AlertCircle, Calendar, Bot, ArrowUpRight, Loader2,
  ChevronRight, Clock, CheckCircle2
} from 'lucide-react'
import Link from 'next/link'

interface StatsData {
  total_clients: number
  active_cases: number
  pending_invoices: number
  revenue_this_month: number
  cases_by_category?: Record<string, number>
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<StatsData>({
    total_clients: 0,
    active_cases: 0,
    pending_invoices: 0,
    revenue_this_month: 0,
  })
  const [recentCases, setRecentCases] = useState<any[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('access_token')
        if (!token) {
          router.push('/login')
          return
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
        const res = await fetch(`${apiUrl}/dashboard/stats`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (res.status === 401) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('user')
          router.push('/login')
          return
        }

        if (!res.ok) {
          throw new Error('Failed to fetch dashboard stats')
        }

        const data = await res.json()
        setStats(data)

        // Process recent cases
        if (data.recent_cases) {
          const formattedCases = data.recent_cases.map((c: any) => ({
            id: c.id,
            title: c.title,
            client: c.client_name || 'ไม่ระบุ',
            status: c.status === 'กำลังดำเนินคดี' || c.status === 'active' ? 'active' :
                    c.status === 'รอพิจารณา' || c.status === 'pending' ? 'pending' :
                    c.status === 'รับเรื่องใหม่' || c.status === 'intake' ? 'intake' : 'closed',
            category: c.category || 'อื่นๆ',
            date: c.created_at ? new Date(c.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : ''
          }))
          setRecentCases(formattedCases)
        }

        // Process upcoming events
        if (data.upcoming_deadlines) {
          const formattedEvents = data.upcoming_deadlines.map((ev: any) => {
            const startDt = ev.start_datetime ? new Date(ev.start_datetime) : new Date()
            const timeStr = startDt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
            
            // Format nice human dates like "พรุ่งนี้" or day/month
            const today = new Date()
            const tomorrow = new Date()
            tomorrow.setDate(today.getDate() + 1)
            
            let dateStr = startDt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
            if (startDt.toDateString() === today.toDateString()) {
              dateStr = 'วันนี้'
            } else if (startDt.toDateString() === tomorrow.toDateString()) {
              dateStr = 'พรุ่งนี้'
            }

            const isUrgent = ev.event_type === 'COURT_DATE' || ev.event_type === 'DEADLINE'

            return {
              title: ev.title,
              time: timeStr,
              date: dateStr,
              type: ev.event_type === 'COURT_DATE' ? 'court' :
                    ev.event_type === 'DEADLINE' ? 'deadline' :
                    ev.event_type === 'MEETING' ? 'meeting' : 'hearing',
              urgent: isUrgent
            }
          })
          setUpcomingEvents(formattedEvents)
        }
      } catch (error) {
        console.error('Error loading dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [router])

  const statCards = [
    {
      label: 'ลูกความทั้งหมด',
      value: stats.total_clients.toLocaleString(),
      icon: Users,
      change: stats.total_clients > 0 ? `ลงทะเบียนพร้อมดูแล` : `ไม่มีลูกความในระบบ`,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      href: '/clients'
    },
    {
      label: 'คดีที่กำลังดำเนินการ',
      value: stats.active_cases.toLocaleString(),
      icon: Scale,
      change: stats.active_cases > 0 ? `${stats.active_cases} คดีเปิดทำการ` : `ยังไม่มีคดีเปิดทำการ`,
      color: 'text-primary-400',
      bg: 'bg-primary-500/10',
      border: 'border-primary-500/20',
      href: '/cases'
    },
    {
      label: 'ใบแจ้งหนี้รอชำระ',
      value: stats.pending_invoices.toLocaleString(),
      icon: CreditCard,
      change: stats.pending_invoices > 0 ? `${stats.pending_invoices} ใบแจ้งหนี้รอชำระ` : `ชำระครบถ้วนแล้ว`,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      href: '/billing'
    },
    {
      label: 'รายได้เดือนนี้',
      value: `฿${stats.revenue_this_month.toLocaleString()}`,
      icon: TrendingUp,
      change: `คำนวณจากยอดชำระแล้ว`,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      href: '/billing'
    },
  ]

  const statusConfig: Record<string, { label: string; cls: string }> = {
    active: { label: 'กำลังดำเนินการ', cls: 'badge-active' },
    pending: { label: 'รอพิจารณา', cls: 'badge-pending' },
    intake: { label: 'รับเรื่องใหม่', cls: 'badge-free' },
    closed: { label: 'ปิดคดี', cls: 'badge-closed' },
  }

  const eventTypeIcon: Record<string, string> = {
    court: '⚖️',
    deadline: '📋',
    meeting: '🤝',
    hearing: '🏛️',
  }

  const categoryColors: Record<string, string> = {
    'คดีอาญา': 'bg-red-500',
    'คดีแพ่ง': 'bg-blue-500',
    'ที่ดิน': 'bg-emerald-500',
    'จัดการมรดก': 'bg-purple-500',
    'คดีผิดสัญญา': 'bg-amber-500',
  }

  const caseCategories = Object.keys(categoryColors).map(catName => ({
    name: catName,
    count: stats?.cases_by_category?.[catName] || 0,
    color: categoryColors[catName]
  }))

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
          <span className="text-sm text-slate-400 font-medium">กำลังโหลดข้อมูลแดชบอร์ด...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            ภาพรวมระบบ Lawyer Tech ERP — {new Date().toLocaleDateString('th-TH', { dateStyle: 'full' })}
          </p>
        </div>
        <Link href="/ai" className="btn-gold flex items-center gap-2 self-start">
          <Bot className="w-4 h-4" />
          AI Assistant
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href}>
            <div className={`stat-card group cursor-pointer border ${card.border}`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 ${card.bg} rounded-xl flex items-center justify-center border ${card.border}`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{card.value}</div>
              <div className="text-slate-400 text-sm">{card.label}</div>
              <div className={`text-xs ${card.color} mt-2`}>{card.change}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Recent Cases */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary-400" />
              คดีล่าสุด
            </h2>
            <Link href="/cases" className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
              ดูทั้งหมด <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>คดี</th>
                  <th>ลูกความ</th>
                  <th>หมวด</th>
                  <th>สถานะ</th>
                  <th>วันที่</th>
                </tr>
              </thead>
              <tbody>
                {recentCases.map((c) => (
                  <tr key={c.id} className="hover:bg-white/2 cursor-pointer transition-colors">
                    <td>
                      <span className="text-white font-medium hover:text-primary-300 transition-colors line-clamp-1">
                        {c.title}
                      </span>
                    </td>
                    <td className="text-slate-400">{c.client}</td>
                    <td>
                      <span className="badge bg-white/5 text-slate-400 border-white/10">{c.category}</span>
                    </td>
                    <td>
                      <span className={`badge ${statusConfig[c.status]?.cls}`}>
                        {statusConfig[c.status]?.label}
                      </span>
                    </td>
                    <td className="text-slate-500 text-xs">{c.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              นัดหมายใกล้ถึง
            </h2>
            <Link href="/calendar" className="text-xs text-primary-400 hover:text-primary-300">
              ดูปฏิทิน
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingEvents.map((ev, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors
                ${ev.urgent ? 'bg-red-500/5 border-red-500/20' : 'bg-white/3 border-white/5'}`}>
                <span className="text-xl">{eventTypeIcon[ev.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${ev.urgent ? 'text-red-300' : 'text-white'}`}>
                    {ev.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-xs text-slate-500">{ev.date} — {ev.time} น.</span>
                  </div>
                </div>
                {ev.urgent && (
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Case Categories Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-white flex items-center gap-2 mb-5">
            <FileText className="w-5 h-5 text-purple-400" />
            คดีแยกตามหมวดหมู่
          </h2>
          <div className="space-y-3">
            {caseCategories.map((cat) => {
              const total = caseCategories.reduce((s, c) => s + c.count, 0)
              const pct = Math.round((cat.count / total) * 100)
              return (
                <div key={cat.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{cat.name}</span>
                    <span className="text-slate-400">{cat.count} คดี ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${cat.color} rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick AI Actions */}
        <div className="card">
          <h2 className="font-semibold text-white flex items-center gap-2 mb-5">
            <Bot className="w-5 h-5 text-amber-400" />
            AI Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'ค้นหาฎีกา', icon: '🔎', href: '/ai?tab=research', color: 'border-primary-500/20 hover:border-primary-500/40' },
              { label: 'สรุปคดี', icon: '📝', href: '/ai?tab=summarize', color: 'border-blue-500/20 hover:border-blue-500/40' },
              { label: 'ร่างเอกสาร', icon: '📃', href: '/documents?tab=ai_draft', color: 'border-emerald-500/20 hover:border-emerald-500/40' },
              { label: 'จัดหมวดหมู่', icon: '🏷️', href: '/ai?tab=categorize', color: 'border-purple-500/20 hover:border-purple-500/40' },
              { label: 'อัปโหลด PDF', icon: '📄', href: '/documents', color: 'border-amber-500/20 hover:border-amber-500/40' },
              { label: 'ถามกฎหมาย', icon: '⚖️', href: '/ai', color: 'border-red-500/20 hover:border-red-500/40' },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-white/3 border ${action.color} transition-all hover:bg-white/5 cursor-pointer`}
              >
                <span className="text-2xl">{action.icon}</span>
                <span className="text-xs text-slate-300 text-center font-medium">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
