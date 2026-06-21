"""Dashboard Routes — Analytics, KPIs, Reports"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, date

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import (
    Client, Case, Invoice, CalendarEvent,
    CaseStatus, InvoiceStatus
)

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """สถิติภาพรวมสำหรับ Dashboard"""
    # 1. Total Clients
    clients_query = select(func.count(Client.id)).where(Client.is_active == True)
    total_clients_res = await db.execute(clients_query)
    total_clients = total_clients_res.scalar() or 0

    # 2. Active Cases
    active_cases_query = select(func.count(Case.id)).where(Case.status == CaseStatus.ACTIVE)
    active_cases_res = await db.execute(active_cases_query)
    active_cases = active_cases_res.scalar() or 0

    # 3. Pending Invoices
    pending_invoices_query = select(func.count(Invoice.id)).where(
        Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.OVERDUE])
    )
    pending_invoices_res = await db.execute(pending_invoices_query)
    pending_invoices = pending_invoices_res.scalar() or 0

    # 4. Revenue This Month
    today = date.today()
    revenue_query = select(func.sum(Invoice.total)).where(
        and_(
            Invoice.status == InvoiceStatus.PAID,
            Invoice.paid_at >= datetime(today.year, today.month, 1, 0, 0, 0)
        )
    )
    revenue_res = await db.execute(revenue_query)
    revenue_this_month = revenue_res.scalar() or 0.0

    # 5. Cases by Category
    category_query = select(Case.category, func.count(Case.id)).group_by(Case.category)
    category_res = await db.execute(category_query)
    cases_by_category = {cat.value: count for cat, count in category_res.all() if cat is not None}

    # 6. Cases by Status
    status_query = select(Case.status, func.count(Case.id)).group_by(Case.status)
    status_res = await db.execute(status_query)
    cases_by_status = {status.value: count for status, count in status_res.all() if status is not None}

    # 7. Upcoming Deadlines
    now_dt = datetime.now()
    events_query = select(CalendarEvent).where(
        CalendarEvent.start_datetime >= now_dt
    ).order_by(CalendarEvent.start_datetime.asc()).limit(5)
    events_res = await db.execute(events_query)
    upcoming_events = events_res.scalars().all()

    upcoming_deadlines = []
    for ev in upcoming_events:
        case_title = None
        if ev.case_id:
            case_res = await db.execute(select(Case.title).where(Case.id == ev.case_id))
            case_title = case_res.scalar()

        upcoming_deadlines.append({
            "id": str(ev.id),
            "title": ev.title,
            "description": ev.description,
            "event_type": ev.event_type.value if ev.event_type else None,
            "start_datetime": ev.start_datetime.isoformat() if ev.start_datetime else None,
            "case_id": str(ev.case_id) if ev.case_id else None,
            "case_title": case_title,
        })

    # 8. Recent Cases
    recent_cases_query = select(Case).order_by(Case.created_at.desc()).limit(5)
    recent_cases_res = await db.execute(recent_cases_query)
    recent_cases_objs = recent_cases_res.scalars().all()

    recent_cases = []
    for c in recent_cases_objs:
        client_name = ""
        if c.client_id:
            client_res = await db.execute(select(Client.full_name).where(Client.id == c.client_id))
            client_name = client_res.scalar() or ""

        recent_cases.append({
            "id": str(c.id),
            "title": c.title,
            "case_number": c.case_number,
            "client_name": client_name,
            "status": c.status.value if c.status else None,
            "category": c.category.value if c.category else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    return {
        "total_clients": total_clients,
        "active_cases": active_cases,
        "pending_invoices": pending_invoices,
        "revenue_this_month": float(revenue_this_month),
        "cases_by_category": cases_by_category,
        "cases_by_status": cases_by_status,
        "upcoming_deadlines": upcoming_deadlines,
        "recent_cases": recent_cases,
    }
