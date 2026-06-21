"""Billing & Finance Routes — Invoicing, Time Tracking, Fee Management, Office Expenses, and Finance Dashboards"""

import uuid
from datetime import datetime, date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import (
    User, Client, Case, TimeEntry, Invoice, InvoiceItem,
    Expense, ExpenseCategory, InvoiceStatus, UserRole
)

router = APIRouter()

# ==============================
# Pydantic Payload Schemas
# ==============================

class TimeEntryCreate(BaseModel):
    description: str
    hours: float
    hourly_rate: float = 1000.0
    date: date
    case_id: str
    is_billable: bool = True

class InvoiceItemPayload(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float

class InvoiceCreate(BaseModel):
    client_id: str
    case_id: Optional[str] = None
    due_date: Optional[date] = None
    tax_rate: float = 7.0
    notes: Optional[str] = None
    items: List[InvoiceItemPayload]
    time_entry_ids: Optional[List[str]] = None

class InvoiceUpdateStatus(BaseModel):
    status: str
    payment_slip_url: Optional[str] = None

class ExpenseCreate(BaseModel):
    description: str
    category: str
    amount: float
    date: date
    case_id: Optional[str] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None


# ==============================
# Helper Formatters
# ==============================

def format_time_entry(te: TimeEntry, case_title: str = None, user_name: str = None) -> dict:
    return {
        "id": str(te.id),
        "description": te.description,
        "hours": te.hours,
        "hourly_rate": te.hourly_rate,
        "amount": te.hours * te.hourly_rate,
        "date": te.date.isoformat() if te.date else None,
        "is_billable": te.is_billable,
        "case_id": str(te.case_id),
        "case_title": case_title,
        "user_id": str(te.user_id),
        "user_name": user_name,
        "invoice_id": str(te.invoice_id) if te.invoice_id else None,
        "created_at": te.created_at.isoformat() if te.created_at else None,
    }

def format_invoice_item(item: InvoiceItem) -> dict:
    return {
        "id": str(item.id),
        "invoice_id": str(item.invoice_id),
        "description": item.description,
        "quantity": item.quantity,
        "unit_price": item.unit_price,
        "amount": item.amount,
    }

def format_invoice(inv: Invoice, client_name: str = None, case_title: str = None, items: List[InvoiceItem] = None) -> dict:
    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "status": inv.status.value if inv.status else None,
        "subtotal": inv.subtotal,
        "tax_rate": inv.tax_rate,
        "tax_amount": inv.tax_amount,
        "total": inv.total,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
        "payment_slip_url": inv.payment_slip_url,
        "notes": inv.notes,
        "client_id": str(inv.client_id),
        "client_name": client_name,
        "case_id": str(inv.case_id) if inv.case_id else None,
        "case_title": case_title,
        "items": [format_invoice_item(item) for item in (items or [])],
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
    }

def format_expense(exp: Expense, logged_by_name: str = None, case_title: str = None) -> dict:
    return {
        "id": str(exp.id),
        "description": exp.description,
        "category": exp.category.value if exp.category else None,
        "amount": exp.amount,
        "date": exp.date.isoformat() if exp.date else None,
        "case_id": str(exp.case_id) if exp.case_id else None,
        "case_title": case_title,
        "logged_by": str(exp.logged_by),
        "logged_by_name": logged_by_name,
        "receipt_url": exp.receipt_url,
        "notes": exp.notes,
        "created_at": exp.created_at.isoformat() if exp.created_at else None,
    }


# ==============================
# Custom Helper Actions
# ==============================

async def generate_invoice_number(db: AsyncSession) -> str:
    today_str = date.today().strftime("%Y%m%d")
    count_query = select(func.count(Invoice.id)).where(Invoice.invoice_number.like(f"INV-{today_str}-%"))
    result = await db.execute(count_query)
    count = result.scalar() or 0
    return f"INV-{today_str}-{count + 1:04d}"


# ==============================
# Time Entry Router Endpoints
# ==============================

@router.get("/time-entries")
async def list_time_entries(
    case_id: Optional[str] = Query(None),
    uninvoiced: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """รายการชั่วโมงทำงานคิดเงิน (Time entries)"""
    query = select(TimeEntry)
    if case_id:
        query = query.where(TimeEntry.case_id == uuid.UUID(case_id))
    if uninvoiced is True:
        query = query.where(TimeEntry.invoice_id == None)
    elif uninvoiced is False:
        query = query.where(TimeEntry.invoice_id != None)
        
    query = query.order_by(TimeEntry.date.desc())
    result = await db.execute(query)
    entries = result.scalars().all()
    
    formatted = []
    for te in entries:
        case_res = await db.execute(select(Case).where(Case.id == te.case_id))
        case_obj = case_res.scalar_one_or_none()
        user_res = await db.execute(select(User).where(User.id == te.user_id))
        user_obj = user_res.scalar_one_or_none()
        formatted.append(
            format_time_entry(
                te, 
                case_title=case_obj.title if case_obj else None,
                user_name=user_obj.full_name if user_obj else None
            )
        )
    return {"status": "success", "data": formatted}


@router.post("/time-entries")
async def create_time_entry(
    payload: TimeEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """บันทึกชั่วโมงทำงานเพื่อนำไปออกบิลคิดเงิน"""
    user_id_str = current_user.get("sub")
    user_uuid = uuid.UUID(user_id_str)
    case_uuid = uuid.UUID(payload.case_id)
    
    # Verify case exists
    case_res = await db.execute(select(Case).where(Case.id == case_uuid))
    case_obj = case_res.scalar_one_or_none()
    if not case_obj:
        raise HTTPException(status_code=404, detail="ไม่พบแฟ้มคดีดังกล่าว")
    case_title = case_obj.title
        
    new_entry = TimeEntry(
        description=payload.description,
        hours=payload.hours,
        hourly_rate=payload.hourly_rate,
        date=payload.date,
        is_billable=payload.is_billable,
        case_id=case_uuid,
        user_id=user_uuid
    )
    
    db.add(new_entry)
    await db.commit()
    await db.refresh(new_entry)
    
    user_res = await db.execute(select(User).where(User.id == user_uuid))
    user_obj = user_res.scalar_one_or_none()
    
    return {
        "status": "success",
        "message": "บันทึกเวลาสำเร็จ",
        "data": format_time_entry(new_entry, case_title, user_obj.full_name if user_obj else None)
    }


# ==============================
# Expenses Router Endpoints
# ==============================

@router.get("/expenses")
async def list_expenses(
    category: Optional[str] = Query(None),
    case_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """รายการรายจ่ายสำนักงาน"""
    query = select(Expense)
    if category:
        query = query.where(Expense.category == category)
    if case_id:
        query = query.where(Expense.case_id == uuid.UUID(case_id))
        
    query = query.order_by(Expense.date.desc())
    result = await db.execute(query)
    expenses = result.scalars().all()
    
    formatted = []
    for exp in expenses:
        case_title = None
        if exp.case_id:
            case_res = await db.execute(select(Case).where(Case.id == exp.case_id))
            case_obj = case_res.scalar_one_or_none()
            if case_obj: case_title = case_obj.title
            
        user_res = await db.execute(select(User).where(User.id == exp.logged_by))
        user_obj = user_res.scalar_one_or_none()
        logged_name = user_obj.full_name if user_obj else "ไม่ระบุชื่อ"
        
        formatted.append(format_expense(exp, logged_name, case_title))
        
    return {"status": "success", "data": formatted}


@router.post("/expenses")
async def create_expense(
    payload: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """บันทึกค่าใช้จ่ายสำนักงาน"""
    user_uuid = uuid.UUID(current_user.get("sub"))
    
    case_uuid = None
    if payload.case_id:
        case_uuid = uuid.UUID(payload.case_id)
        case_res = await db.execute(select(Case).where(Case.id == case_uuid))
        if not case_res.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="ไม่พบคดีอ้างอิงรายจ่าย")
            
    # Map category to enum
    try:
        category_enum = ExpenseCategory(payload.category)
    except ValueError:
        category_enum = ExpenseCategory.OTHER
        
    new_expense = Expense(
        description=payload.description,
        category=category_enum,
        amount=payload.amount,
        date=payload.date,
        case_id=case_uuid,
        logged_by=user_uuid,
        receipt_url=payload.receipt_url,
        notes=payload.notes
    )
    
    db.add(new_expense)
    await db.commit()
    await db.refresh(new_expense)
    
    user_res = await db.execute(select(User).where(User.id == user_uuid))
    user_obj = user_res.scalar_one_or_none()
    
    case_title = None
    if case_uuid:
        c_res = await db.execute(select(Case).where(Case.id == case_uuid))
        c_obj = c_res.scalar_one_or_none()
        if c_obj: case_title = c_obj.title
        
    return {
        "status": "success",
        "message": "ลงบันทึกรายจ่ายสำเร็จ",
        "data": format_expense(new_expense, user_obj.full_name if user_obj else None, case_title)
    }


# ==============================
# Invoices Router Endpoints
# ==============================

@router.get("/invoices")
async def list_invoices(
    client_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """รายการใบแจ้งหนี้ทั้งหมด"""
    query = select(Invoice)
    if client_id:
        query = query.where(Invoice.client_id == uuid.UUID(client_id))
    if status:
        query = query.where(Invoice.status == status)
        
    query = query.order_by(Invoice.created_at.desc())
    result = await db.execute(query)
    invoices = result.scalars().all()
    
    formatted = []
    for inv in invoices:
        client_res = await db.execute(select(Client).where(Client.id == inv.client_id))
        client_obj = client_res.scalar_one_or_none()
        
        case_title = None
        if inv.case_id:
            case_res = await db.execute(select(Case).where(Case.id == inv.case_id))
            case_obj = case_res.scalar_one_or_none()
            if case_obj: case_title = case_obj.title
            
        # Make sure items are loaded
        items_res = await db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == inv.id))
        items_list = items_res.scalars().all()
        
        formatted.append(format_invoice(inv, client_obj.full_name if client_obj else None, case_title, items_list))
        
    return {"status": "success", "data": formatted}


@router.get("/invoices/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ดึงรายละเอียดใบแจ้งหนี้รายฉบับ"""
    inv_uuid = uuid.UUID(invoice_id)
    result = await db.execute(select(Invoice).where(Invoice.id == inv_uuid))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="ไม่พบใบแจ้งหนี้")
        
    client_res = await db.execute(select(Client).where(Client.id == inv.client_id))
    client_obj = client_res.scalar_one_or_none()
    
    case_title = None
    if inv.case_id:
        case_res = await db.execute(select(Case).where(Case.id == inv.case_id))
        case_obj = case_res.scalar_one_or_none()
        if case_obj: case_title = case_obj.title
        
    items_res = await db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == inv.id))
    items_list = items_res.scalars().all()
    
    return {"status": "success", "data": format_invoice(inv, client_obj.full_name if client_obj else None, case_title, items_list)}


@router.post("/invoices")
async def create_invoice(
    payload: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """สร้างใบแจ้งหนี้ฉบับใหม่พร้อมรายการย่อย"""
    client_uuid = uuid.UUID(payload.client_id)
    case_uuid = uuid.UUID(payload.case_id) if payload.case_id else None
    
    # 1. Verify client exists
    client_res = await db.execute(select(Client).where(Client.id == client_uuid))
    client_obj = client_res.scalar_one_or_none()
    if not client_obj:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลลูกความ")
    client_full_name = client_obj.full_name
        
    # 2. Verify case exists if provided
    case_title = None
    if case_uuid:
        case_res = await db.execute(select(Case).where(Case.id == case_uuid))
        case_obj = case_res.scalar_one_or_none()
        if not case_obj:
            raise HTTPException(status_code=404, detail="ไม่พบคดีอ้างอิง")
        case_title = case_obj.title
        
    # 3. Calculate math
    subtotal = sum(item.quantity * item.unit_price for item in payload.items)
    tax_amount = subtotal * (payload.tax_rate / 100.0)
    total = subtotal + tax_amount
    
    # 4. Generate invoice number
    inv_number = await generate_invoice_number(db)
    
    # 5. Create line items first in memory
    created_items = []
    for item in payload.items:
        new_item = InvoiceItem(
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            amount=item.quantity * item.unit_price
        )
        created_items.append(new_item)
        
    # 6. Create invoice record with items relationship pre-populated
    new_inv = Invoice(
        invoice_number=inv_number,
        status=InvoiceStatus.DRAFT,
        subtotal=subtotal,
        tax_rate=payload.tax_rate,
        tax_amount=tax_amount,
        total=total,
        due_date=payload.due_date or (date.today() + timedelta(days=30)),
        notes=payload.notes,
        client_id=client_uuid,
        case_id=case_uuid,
        items=created_items
    )
    db.add(new_inv)
    await db.flush()  # Generate UUIDs
    
    # 7. Relate Time Entries if supplied
    if payload.time_entry_ids:
        for te_id_str in payload.time_entry_ids:
            te_res = await db.execute(select(TimeEntry).where(TimeEntry.id == uuid.UUID(te_id_str)))
            te_obj = te_res.scalar_one_or_none()
            if te_obj:
                te_obj.invoice_id = new_inv.id
                
    await db.commit()
    await db.refresh(new_inv)
    
    # Query items after commit to avoid expired state lazy-load issue
    items_res = await db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == new_inv.id))
    items_list = items_res.scalars().all()
    
    return {
        "status": "success",
        "message": "สร้างใบแจ้งหนี้สำเร็จ",
        "data": format_invoice(new_inv, client_full_name, case_title, items_list)
    }


@router.put("/invoices/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    payload: InvoiceUpdateStatus,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """อัปเดตสถานะใบแจ้งหนี้หรือหลักฐานการชำระเงิน"""
    inv_uuid = uuid.UUID(invoice_id)
    result = await db.execute(select(Invoice).where(Invoice.id == inv_uuid))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="ไม่พบใบแจ้งหนี้")
        
    # Translate status to enum
    status_map = {
        "draft": InvoiceStatus.DRAFT,
        "sent": InvoiceStatus.SENT,
        "paid": InvoiceStatus.PAID,
        "overdue": InvoiceStatus.OVERDUE,
        "cancelled": InvoiceStatus.CANCELLED
    }
    
    new_status = status_map.get(payload.status.lower())
    if not new_status:
        raise HTTPException(status_code=400, detail="สถานะไม่ถูกต้อง")
        
    inv.status = new_status
    if new_status == InvoiceStatus.PAID:
        inv.paid_at = datetime.utcnow()
        
    if payload.payment_slip_url is not None:
        inv.payment_slip_url = payload.payment_slip_url
        
    await db.commit()
    await db.refresh(inv)
    
    # Load relationships for output formatter
    client_res = await db.execute(select(Client).where(Client.id == inv.client_id))
    client_obj = client_res.scalar_one_or_none()
    
    case_title = None
    if inv.case_id:
        case_res = await db.execute(select(Case).where(Case.id == inv.case_id))
        case_obj = case_res.scalar_one_or_none()
        if case_obj: case_title = case_obj.title
        
    items_res = await db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == inv.id))
    items_list = items_res.scalars().all()
    
    return {
        "status": "success",
        "message": "บันทึกอัปเดตใบแจ้งหนี้สำเร็จ",
        "data": format_invoice(inv, client_obj.full_name if client_obj else None, case_title, items_list)
    }


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ลบใบแจ้งหนี้ที่ยังไม่ได้ชำระเงิน"""
    role_str = current_user.get("role")
    if role_str not in ["admin", "partner"]:
        raise HTTPException(status_code=403, detail="สิทธิ์ของคุณไม่สามารถลบใบแจ้งหนี้ได้")
        
    inv_uuid = uuid.UUID(invoice_id)
    result = await db.execute(select(Invoice).where(Invoice.id == inv_uuid))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="ไม่พบใบแจ้งหนี้")
        
    if inv.status == InvoiceStatus.PAID:
        raise HTTPException(status_code=400, detail="ไม่สามารถลบใบแจ้งหนี้ที่จ่ายชำระเงินเรียบร้อยแล้วได้")
        
    # Free up time entries
    te_res = await db.execute(select(TimeEntry).where(TimeEntry.invoice_id == inv.id))
    entries = te_res.scalars().all()
    for te in entries:
        te.invoice_id = None
        
    await db.delete(inv)
    await db.commit()
    return {"status": "success", "message": "ลบใบแจ้งหนี้สำเร็จ"}


# ==============================
# Financial Dashboard Reports
# ==============================

@router.get("/dashboard")
async def get_financial_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """วิเคราะห์ผลการดำเนินงานทางการเงิน กำไรขาดทุน (P&L Dashboard)"""
    # 1. Total revenues (All paid invoices total sum)
    rev_query = select(func.sum(Invoice.total)).where(Invoice.status == InvoiceStatus.PAID)
    rev_res = await db.execute(rev_query)
    total_revenue = rev_res.scalar() or 0.0
    
    # 2. Monthly revenue (This month)
    today = date.today()
    start_of_month = datetime(today.year, today.month, 1)
    rev_month_query = select(func.sum(Invoice.total)).where(
        and_(
            Invoice.status == InvoiceStatus.PAID,
            Invoice.paid_at >= start_of_month
        )
    )
    rev_month_res = await db.execute(rev_month_query)
    monthly_revenue = rev_month_res.scalar() or 0.0
    
    # 3. Total outstanding (Pending: Sent & Overdue invoices)
    outstanding_query = select(func.sum(Invoice.total)).where(
        or_(
            Invoice.status == InvoiceStatus.SENT,
            Invoice.status == InvoiceStatus.OVERDUE
        )
    )
    outstanding_res = await db.execute(outstanding_query)
    total_outstanding = outstanding_res.scalar() or 0.0
    
    # 4. Total expenses
    exp_query = select(func.sum(Expense.amount))
    exp_res = await db.execute(exp_query)
    total_expenses = exp_res.scalar() or 0.0
    
    # 5. Monthly expenses
    exp_month_query = select(func.sum(Expense.amount)).where(
        Expense.date >= start_of_month.date()
    )
    exp_month_res = await db.execute(exp_month_query)
    monthly_expenses = exp_month_res.scalar() or 0.0
    
    # 6. Fetch recent transactions ledger (Union simulation sorted by date)
    recent_transactions = []
    
    # Fetch 5 recent paid invoices
    recent_invs_query = select(Invoice).where(Invoice.status == InvoiceStatus.PAID).order_by(Invoice.paid_at.desc()).limit(5)
    recent_invs_res = await db.execute(recent_invs_query)
    for inv in recent_invs_res.scalars().all():
        client_res = await db.execute(select(Client).where(Client.id == inv.client_id))
        client_obj = client_res.scalar_one_or_none()
        recent_transactions.append({
            "type": "income",
            "title": f"รับชำระบิล {inv.invoice_number}",
            "reference": client_obj.full_name if client_obj else "ไม่ทราบชื่อลูกความ",
            "amount": inv.total,
            "date": inv.paid_at.date().isoformat() if inv.paid_at else None
        })
        
    # Fetch 5 recent expenses
    recent_exps_query = select(Expense).order_by(Expense.date.desc()).limit(5)
    recent_exps_res = await db.execute(recent_exps_query)
    for exp in recent_exps_res.scalars().all():
        recent_transactions.append({
            "type": "expense",
            "title": exp.description,
            "reference": exp.category.value,
            "amount": exp.amount,
            "date": exp.date.isoformat()
        })
        
    # Sort unified ledger desc by date
    recent_transactions.sort(key=lambda x: x["date"] or "", reverse=True)
    recent_transactions = recent_transactions[:10]
    
    # 7. Generate monthly breakdown trend (Revenue vs Expense last 6 months)
    trends = []
    for m in range(5, -1, -1):
        target_date = today - timedelta(days=m*30)
        m_start = datetime(target_date.year, target_date.month, 1)
        # End of month helper
        if target_date.month == 12:
            m_end = datetime(target_date.year + 1, 1, 1)
        else:
            m_end = datetime(target_date.year, target_date.month + 1, 1)
            
        m_rev_query = select(func.sum(Invoice.total)).where(
            and_(
                Invoice.status == InvoiceStatus.PAID,
                Invoice.paid_at >= m_start,
                Invoice.paid_at < m_end
            )
        )
        m_rev_res = await db.execute(m_rev_query)
        m_rev = m_rev_res.scalar() or 0.0
        
        m_exp_query = select(func.sum(Expense.amount)).where(
            and_(
                Expense.date >= m_start.date(),
                Expense.date < m_end.date()
            )
        )
        m_exp_res = await db.execute(m_exp_query)
        m_exp = m_exp_res.scalar() or 0.0
        
        trends.append({
            "month": m_start.strftime("%Y-%m"),
            "revenue": m_rev,
            "expense": m_exp,
            "profit": m_rev - m_exp
        })
        
    return {
        "status": "success",
        "data": {
            "summary": {
                "total_revenue": total_revenue,
                "monthly_revenue": monthly_revenue,
                "total_outstanding": total_outstanding,
                "total_expenses": total_expenses,
                "monthly_expenses": monthly_expenses,
                "net_profit": total_revenue - total_expenses
            },
            "recent_ledger": recent_transactions,
            "trends": trends
        }
    }
