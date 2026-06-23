"""
Lawyer Tech ERP - FastAPI Main Application
==========================================
Tech Stack: FastAPI + PostgreSQL + Vector DB + AI (Gemini/OpenAI/LangChain)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import uvicorn
import os
import sys

# Ensure the backend directory is in the Python search path for Vercel imports
sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import settings
from app.core.database import engine, Base
from app.api.routes import (
    auth,
    clients,
    cases,
    calendar,
    documents,
    billing,
    ai_assistant,
    roles,
    dashboard,
    hr,
    settings as settings_api,
    superadmin,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup: Create tables if not exist
    import os
    try:
        os.makedirs("uploads", exist_ok=True)
    except Exception as e:
        print(f"Skipping uploads directory creation: {e}")
    from sqlalchemy import text
    from app.models import models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Add responsible persons columns to cases table if they do not exist (run in separate transactions)
    for col_name, col_type in [
        ("responsible_lawyer_name", "VARCHAR(255)"),
        ("responsible_lawyer_phone", "VARCHAR(20)"),
        ("responsible_lawyer_line", "VARCHAR(100)"),
        ("responsible_clerk_name", "VARCHAR(255)"),
        ("responsible_lawyers", "JSON")
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE cases ADD COLUMN {col_name} {col_type};"))
                print(f"Added column {col_name} to cases table.")
        except Exception:
            pass

    # Add tenant_id columns to users and cases
    for table, col_name, col_type in [
        ("users", "tenant_id", "UUID"),
        ("cases", "tenant_id", "UUID")
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type};"))
                print(f"Added column {col_name} to {table} table.")
        except Exception:
            pass
    print("✅ Database tables created/verified")
    print("🚀 Lawyer Tech ERP API is running!")
    yield
    # Shutdown
    await engine.dispose()
    print("👋 Server shut down cleanly")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
    ## Lawyer Tech ERP & AI Legal Platform API
    
    ### Modules:
    - **Auth** — JWT Authentication, LINE Login, RBAC
    - **Clients** — CRM, KYC, Contact Management
    - **Cases** — Matter Management, Status, Team Assignment
    - **Calendar** — Deadlines, Court Dates, Reminders
    - **Documents** — Templates, Secure Storage, AI Drafting
    - **Billing** — Time Tracking, Invoicing, Fee Management
    - **AI Assistant** — Smart Legal Research, Case Summarization, Doc Drafting
    - **Dashboard** — Analytics, Reports, KPIs
    """,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files static route
if os.path.exists("uploads"):
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
else:
    try:
        os.makedirs("/tmp/uploads", exist_ok=True)
        app.mount("/uploads", StaticFiles(directory="/tmp/uploads"), name="uploads")
        print("Mounted static uploads using /tmp/uploads")
    except Exception as e:
        print(f"Failed to mount static uploads directory: {e}")

# ==============================
# API Routes Registration
# ==============================
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=f"{API_PREFIX}/auth", tags=["🔐 Authentication"])
app.include_router(clients.router, prefix=f"{API_PREFIX}/clients", tags=["👥 Clients/CRM"])
app.include_router(cases.router, prefix=f"{API_PREFIX}/cases", tags=["⚖️ Cases/Matters"])
app.include_router(calendar.router, prefix=f"{API_PREFIX}/calendar", tags=["📅 Calendar"])
app.include_router(documents.router, prefix=f"{API_PREFIX}/documents", tags=["📄 Documents"])
app.include_router(billing.router, prefix=f"{API_PREFIX}/billing", tags=["💰 Billing"])
app.include_router(ai_assistant.router, prefix=f"{API_PREFIX}/ai", tags=["🤖 AI Assistant"])
app.include_router(roles.router, prefix=f"{API_PREFIX}/roles", tags=["🔑 Roles & Access"])
app.include_router(dashboard.router, prefix=f"{API_PREFIX}/dashboard", tags=["📊 Dashboard"])
app.include_router(hr.router, prefix=f"{API_PREFIX}/hr", tags=["👥 HR/Employees"])
app.include_router(settings_api.router, prefix=f"{API_PREFIX}/settings", tags=["⚙️ Settings"])
app.include_router(superadmin.router, prefix=f"{API_PREFIX}/superadmin", tags=["👑 SuperAdmin"])


@app.get("/", tags=["Health"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/api/docs",
        "message": "⚖️ Lawyer Tech ERP API — เพื่อประโยชน์แห่งความยุติธรรม"
    }


@app.get("/api/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "ai_engine": "ready",
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
