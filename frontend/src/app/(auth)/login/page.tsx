'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Scale, Eye, EyeOff, Loader2, Shield, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'เข้าสู่ระบบไม่สำเร็จ')
      
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      toast.success(`ยินดีต้อนรับ, ${data.user.full_name}`)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-bg flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/80 via-dark-bg to-dark-bg" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-center">
          {/* Logo */}
          <div className="flex items-center justify-center w-24 h-24 mb-8">
            <img src="/images/logo.png" alt="Lawyer Tech Logo" className="w-full h-full object-contain" />
          </div>
          
          <div className="thai-flag-accent w-24 mb-6" />
          
          <h1 className="text-4xl font-bold gradient-text mb-4">
            Lawyer Tech ERP
          </h1>
          <p className="text-slate-400 text-lg mb-2">ระบบบริหารสำนักงานกฎหมาย</p>
          <p className="text-amber-400/80 text-sm italic mb-12">
            "เพื่อประโยชน์แห่งความยุติธรรม"
          </p>

          {/* Feature list */}
          <div className="space-y-4 text-left max-w-sm w-full">
            {[
              { icon: '👥', text: 'จัดการลูกความ CRM + KYC' },
              { icon: '⚖️', text: 'ระบบจัดการคดีครบวงจร' },
              { icon: '🤖', text: 'AI ค้นหาฎีกาและร่างเอกสาร' },
              { icon: '💰', text: 'Billing & Time Tracking' },
              { icon: '🔐', text: 'RBAC Security System' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 glass-lighter rounded-xl px-4 py-3">
                <span className="text-xl">{item.icon}</span>
                <span className="text-slate-300 text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src="/images/logo.png" alt="Lawyer Tech Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="font-bold text-white leading-tight">Lawyer Tech ERP</h2>
              <p className="text-xs text-slate-500">ระบบบริหารสำนักงานกฎหมาย</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-8 border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-2">เข้าสู่ระบบ</h2>
            <p className="text-slate-400 text-sm mb-8">กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งาน</p>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">อีเมล</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="lawyer@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm text-slate-300 mb-2">รหัสผ่าน</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input-field pr-12"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> กำลังเข้าสู่ระบบ...</>
                ) : (
                  <><Shield className="w-4 h-4" /> เข้าสู่ระบบ</>
                )}
              </button>
            </form>

            {/* Security note */}
            <div className="mt-6 pt-6 border-t border-white/5 flex items-center gap-2 text-xs text-slate-500">
              <Zap className="w-3 h-3 text-primary-500" />
              <span>ระบบรักษาความปลอดภัยด้วย JWT + HTTPS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
