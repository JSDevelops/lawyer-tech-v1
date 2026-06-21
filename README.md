# Lawyer Tech ERP & AI Legal Platform
# =====================================
# ระบบบริหารสำนักงานกฎหมาย + AI

## 🏗️ โครงสร้างโปรเจค

```
lawyer tech/
├── 📁 backend/                    # FastAPI (Python)
│   ├── main.py                    # Entry point
│   ├── requirements.txt           # Python deps
│   ├── .env                       # Environment vars
│   └── app/
│       ├── core/
│       │   ├── config.py          # Settings
│       │   ├── database.py        # PostgreSQL + PGVector
│       │   └── security.py        # JWT Auth
│       ├── models/
│       │   └── models.py          # All DB models
│       └── api/routes/
│           ├── auth.py            # Login/Register
│           ├── clients.py         # CRM
│           ├── cases.py           # Matter Management
│           ├── calendar.py        # Events
│           ├── documents.py       # Files
│           ├── billing.py         # Invoicing
│           ├── ai_assistant.py    # AI Engine
│           ├── roles.py           # RBAC
│           └── dashboard.py       # Stats
│
├── 📁 frontend/                   # Next.js 14
│   ├── src/app/
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Redirect
│   │   ├── globals.css            # Global styles
│   │   ├── (auth)/login/          # Login page
│   │   ├── dashboard/             # Dashboard
│   │   ├── clients/               # CRM module
│   │   ├── cases/                 # Case management
│   │   ├── calendar/              # Calendar
│   │   ├── documents/             # Documents
│   │   ├── billing/               # Billing
│   │   └── ai/                    # AI Assistant
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
│
└── docker-compose.yml             # Full stack Docker
```

## 🚀 วิธีติดตั้งและรัน

### 1. ติดตั้ง Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### 2. ติดตั้ง Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → http://localhost:8000/api/docs
```

### 3. รันด้วย Docker (ครบทั้งระบบ)
```bash
docker-compose up -d
```

## 📋 Development Phases

| Phase | สิ่งที่พัฒนา | Status |
|-------|-------------|--------|
| Phase 1 | Foundation: Auth, CRM, Case CRUD | ✅ Ready |
| Phase 2 | Workflow: Calendar, Docs, Templates | 🔧 In Progress |
| Phase 3 | AI Injection: LLM, RAG, Summarize | ✅ Ready |
| Phase 4 | Billing: Invoicing, Time Tracking | 🔧 In Progress |

## 🤖 AI Features (Phase 3)

- **AI Chat** — Gemini 2.0 Flash สำหรับตอบคำถามกฎหมาย
- **Legal Research** — ค้นหาฎีกาและกฎหมายที่เกี่ยวข้อง
- **Case Summarization** — สรุปคดีเป็น 1 หน้า A4
- **Document Drafting** — ร่างเอกสาร: คำฟ้อง, สัญญา, มอบอำนาจ
- **PDF Analysis** — อัปโหลด PDF และให้ AI วิเคราะห์

## 🔐 Security

- JWT Authentication + Refresh Token
- RBAC: Admin, Partner, Lawyer, Clerk, Client
- HTTPS (Production)
- bcrypt password hashing

## 📞 Contact

สำนักกฎหมายตรีเทพทนายความ
โทร: 086-362-4188
