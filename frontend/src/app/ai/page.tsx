'use client'

import { useState } from 'react'
import { Bot, Send, Loader2, Search, FileText, FilePlus2, Tag, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

const API = process.env.NEXT_PUBLIC_API_URL

const tabs = [
  { id: 'chat', label: 'AI Chat', icon: Bot },
  { id: 'research', label: 'ค้นหาฎีกา', icon: Search },
  { id: 'summarize', label: 'สรุปคดี', icon: FileText },
  { id: 'draft', label: 'ร่างเอกสาร', icon: FilePlus2 },
]

export default function AiPage() {
  const [activeTab, setActiveTab] = useState('chat')
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'สวัสดีครับ ผมคือ AI ผู้ช่วยกฎหมายของ Lawyer Tech\nผมสามารถช่วยท่านได้ในเรื่อง:\n• ค้นหากฎหมายและฎีกา\n• สรุปข้อเท็จจริงคดี\n• ร่างเอกสารทางกฎหมาย\n• ให้คำแนะนำทั่วไปด้านกฎหมายไทย' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Listen to search params for direct tab routing
  useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab && ['chat', 'research', 'summarize', 'draft'].includes(tab)) {
        setActiveTab(tab)
      }
    }
  })

  // Research
  const [researchQ, setResearchQ] = useState('')
  const [researchResult, setResearchResult] = useState('')

  // Summarize
  const [summarizeText, setSummarizeText] = useState('')
  const [summary, setSummary] = useState('')

  // Draft
  const [draftType, setDraftType] = useState('complaint')
  const [draftClient, setDraftClient] = useState('')
  const [draftDetails, setDraftDetails] = useState('')
  const [draftResult, setDraftResult] = useState('')

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  })

  const sendChat = async () => {
    if (!input.trim()) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)
    try {
      const res = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: userMsg })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'ai', text: data.response || 'ขออภัย ไม่สามารถตอบได้ในขณะนี้' }])
    } catch {
      toast.error('ไม่สามารถเชื่อมต่อ AI ได้')
    } finally {
      setLoading(false)
    }
  }

  const doResearch = async () => {
    if (!researchQ.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/ai/legal-research`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ question: researchQ })
      })
      const data = await res.json()
      setResearchResult(data.research_result || '')
    } catch { toast.error('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  const doSummarize = async () => {
    if (!summarizeText.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/ai/summarize`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ text: summarizeText, output_format: 'detailed' })
      })
      const data = await res.json()
      setSummary(data.summary || '')
    } catch { toast.error('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  const doDraft = async () => {
    if (!draftClient || !draftDetails) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/ai/draft-document`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ template_type: draftType, client_name: draftClient, case_details: draftDetails })
      })
      const data = await res.json()
      setDraftResult(data.draft_content || '')
    } catch { toast.error('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in h-full">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Bot className="w-7 h-7 text-amber-400" />
          AI Legal Assistant
        </h1>
        <p className="text-slate-400 text-sm mt-1">ผู้ช่วย AI สำหรับงานกฎหมาย — ขับเคลื่อนด้วย Gemini + LangChain</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px
              ${activeTab === id
                ? 'border-primary-500 text-primary-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' && (
        <div className="card flex flex-col h-[calc(100vh-300px)]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="chat-bubble-ai flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary-400" />
                  <span className="text-slate-400">กำลังคิด...</span>
                </div>
              </div>
            )}
          </div>
          {/* Input */}
          <div className="pt-4 border-t border-white/5 flex gap-3">
            <input
              className="input-field flex-1"
              placeholder="ถามเรื่องกฎหมาย, วิเคราะห์คดี, หรือขอคำแนะนำ..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
            />
            <button onClick={sendChat} disabled={loading} className="btn-primary px-4">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'research' && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-white">🔎 ค้นหาฎีกาและกฎหมายที่เกี่ยวข้อง</h3>
          <textarea
            className="input-field h-28 resize-none"
            placeholder="อธิบายข้อเท็จจริงของคดีหรือประเด็นที่ต้องการค้นหา..."
            value={researchQ}
            onChange={e => setResearchQ(e.target.value)}
          />
          <button onClick={doResearch} disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            ค้นหา
          </button>
          {researchResult && (
            <div className="glass-lighter rounded-xl p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {researchResult}
            </div>
          )}
        </div>
      )}

      {activeTab === 'summarize' && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-white">📝 สรุปข้อเท็จจริงคดีเป็น 1 หน้า</h3>
          <textarea
            className="input-field h-40 resize-none"
            placeholder="วางข้อเท็จจริงหรือเนื้อหาคดีที่ต้องการให้ AI สรุป..."
            value={summarizeText}
            onChange={e => setSummarizeText(e.target.value)}
          />
          <button onClick={doSummarize} disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            สรุปคดี
          </button>
          {summary && (
            <div className="glass-lighter rounded-xl p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {summary}
            </div>
          )}
        </div>
      )}

      {activeTab === 'draft' && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-white">📃 ร่างเอกสารทางกฎหมาย</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">ประเภทเอกสาร</label>
              <select
                className="input-field"
                value={draftType}
                onChange={e => setDraftType(e.target.value)}
              >
                <option value="complaint">คำฟ้อง</option>
                <option value="contract">สัญญา</option>
                <option value="power_of_attorney">หนังสือมอบอำนาจ</option>
                <option value="demand_letter">จดหมายทวงถาม</option>
                <option value="appeal">คำอุทธรณ์</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">ชื่อลูกความ</label>
              <input
                className="input-field"
                placeholder="นาย/นาง/นางสาว..."
                value={draftClient}
                onChange={e => setDraftClient(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2">รายละเอียดคดี</label>
            <textarea
              className="input-field h-32 resize-none"
              placeholder="อธิบายข้อเท็จจริง ประเด็น และสิ่งที่ต้องการในเอกสาร..."
              value={draftDetails}
              onChange={e => setDraftDetails(e.target.value)}
            />
          </div>
          <button onClick={doDraft} disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
            ร่างเอกสาร
          </button>
          {draftResult && (
            <div className="glass-lighter rounded-xl p-4">
              <div className="flex justify-between mb-2">
                <span className="text-xs text-amber-400 font-medium">⚠️ ร่างเบื้องต้น — ต้องผ่านการตรวจสอบจากทนายก่อนใช้งาน</span>
                <button
                  onClick={() => navigator.clipboard.writeText(draftResult).then(() => toast.success('คัดลอกแล้ว'))}
                  className="text-xs text-primary-400 hover:text-primary-300"
                >
                  คัดลอก
                </button>
              </div>
              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {draftResult}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
