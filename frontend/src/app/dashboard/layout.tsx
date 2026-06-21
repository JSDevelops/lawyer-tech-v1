'use client'

import { useState, useEffect, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Scale, LayoutDashboard, Users, FileText, Calendar,
  FolderOpen, CreditCard, Bot, Settings, LogOut,
  Bell, Search, Menu, X, ChevronRight, UserCheck
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', phase: 1 },
  { href: '/clients', icon: Users, label: 'ลูกความ (CRM)', phase: 1 },
  { href: '/cases', icon: Scale, label: 'จัดการคดี', phase: 1 },
  { href: '/calendar', icon: Calendar, label: 'ปฏิทิน & นัดหมาย', phase: 2 },
  { href: '/documents', icon: FolderOpen, label: 'เอกสาร', phase: 2 },
  { href: '/hr', icon: UserCheck, label: 'บริหารงานบุคคล', phase: 3 },
  { href: '/billing', icon: CreditCard, label: 'บัญชีและการเงิน', phase: 4 },
  { href: '/ai', icon: Bot, label: 'AI Assistant', phase: 3 },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<any>({})

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUser(JSON.parse(localStorage.getItem('user') || '{}'))
    }
    
    const handleStorageChange = () => {
      const stored = localStorage.getItem('user')
      if (stored) {
        setUser(JSON.parse(stored))
      }
    }
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('user-profile-updated', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('user-profile-updated', handleStorageChange)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const phaseColors: Record<number, string> = {
    1: 'text-emerald-400',
    2: 'text-blue-400',
    3: 'text-purple-400',
    4: 'text-amber-400',
  }

  return (
    <div className="flex h-screen bg-dark-bg overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative z-50 h-full flex flex-col
        bg-dark-surface border-r border-dark-border
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'w-64' : 'w-[72px]'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-dark-border">
          <div className="flex-shrink-0 w-10 h-10 bg-primary-600/20 rounded-xl border border-primary-500/30 flex items-center justify-center">
            <Scale className="w-5 h-5 text-primary-400" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <h1 className="font-bold text-white text-sm leading-tight">Lawyer Tech</h1>
              <p className="text-xs text-slate-500 truncate">ERP & AI Platform</p>
            </div>
          )}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto text-slate-500 hover:text-white p-1 rounded-lg hover:bg-white/5"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Thai flag accent */}
        <div className="px-4 py-2">
          <div className="thai-flag-accent" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label, phase }) => {
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                title={!sidebarOpen ? label : undefined}
              >
                <Icon className={`sidebar-icon w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 truncate">{label}</span>
                    <span className={`text-[10px] font-bold ${phaseColors[phase]} opacity-60`}>
                      P{phase}
                    </span>
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: User + Settings */}
        <div className="border-t border-dark-border p-3 space-y-1">
          <Link
            href="/settings"
            className={`sidebar-link w-full ${pathname.startsWith('/settings') ? 'active' : ''}`}
            title={!sidebarOpen ? 'ตั้งค่า' : undefined}
          >
            <Settings className={`w-5 h-5 ${pathname.startsWith('/settings') ? 'text-primary-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
            {sidebarOpen && <span>ตั้งค่า</span>}
          </Link>
          <button onClick={handleLogout} className="sidebar-link w-full text-red-400/70 hover:text-red-400 hover:bg-red-500/5">
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>ออกจากระบบ</span>}
          </button>
        </div>

        {/* Expand button when collapsed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center shadow-lg"
          >
            <ChevronRight className="w-3 h-3 text-white rotate-180" />
          </button>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 flex items-center gap-4 px-6 border-b border-dark-border bg-dark-surface/50 backdrop-blur">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="ค้นหาลูกความ, คดี, เอกสาร..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
            />
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-3">
            <button className="relative p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            
            <div className="flex items-center gap-2 pl-3 border-l border-white/10">
              <div className="w-8 h-8 rounded-full bg-primary-600/30 border border-primary-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-primary-300">
                  {user?.full_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium text-white leading-tight">{user?.full_name || 'User'}</p>
                <p className="text-[10px] text-slate-500 capitalize">{user?.role || 'lawyer'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
