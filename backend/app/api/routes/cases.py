"""Cases, Calendar, Documents, Billing, Roles, Dashboard Routes"""

# ==================== CASES ====================
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid, random, string
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Client, Case, CaseStatus, CaseCategory, CalendarEvent, Invoice, InvoiceStatus, TimeEntry

router = APIRouter()


class LawyerSchema(BaseModel):
    name: str
    phone: Optional[str] = None
    line: Optional[str] = None


class CaseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: CaseCategory
    client_id: str
    priority: str = "medium"
    status: CaseStatus = CaseStatus.INTAKE
    court_name: Optional[str] = None
    court_case_number: Optional[str] = None
    court_date: Optional[date] = None
    responsible_lawyer_name: Optional[str] = None
    responsible_lawyer_phone: Optional[str] = None
    responsible_lawyer_line: Optional[str] = None
    responsible_clerk_name: Optional[str] = None
    responsible_lawyers: Optional[List[LawyerSchema]] = None


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[CaseCategory] = None
    client_id: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[CaseStatus] = None
    court_name: Optional[str] = None
    court_case_number: Optional[str] = None
    court_date: Optional[date] = None
    responsible_lawyer_name: Optional[str] = None
    responsible_lawyer_phone: Optional[str] = None
    responsible_lawyer_line: Optional[str] = None
    responsible_clerk_name: Optional[str] = None
    responsible_lawyers: Optional[List[LawyerSchema]] = None


def gen_case_number():
    year = date.today().year + 543  # พ.ศ.
    rand = ''.join(random.choices(string.digits, k=5))
    return f"LT-{year}-{rand}"


@router.get("/")
async def list_cases(
    status: Optional[str] = None,
    category: Optional[str] = None,
    client_id: Optional[str] = None,
    page: int = Query(1, ge=1), 
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = select(Case)
    if status:
        query = query.where(Case.status == status)
    if category:
        query = query.where(Case.category == category)
    if client_id:
        query = query.where(Case.client_id == client_id)
    
    # Order by created_at desc to show latest cases first
    query = query.order_by(Case.created_at.desc())
    
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    cases = (await db.execute(query.offset((page-1)*limit).limit(limit))).scalars().all()
    
    data = []
    for c in cases:
        client_name = ""
        if c.client_id:
            client_res = await db.execute(select(Client.full_name).where(Client.id == c.client_id))
            client_name = client_res.scalar() or ""
        
        # backward compatibility: if responsible_lawyers is empty, use the individual columns
        lawyers_list = c.responsible_lawyers or []
        if not lawyers_list and c.responsible_lawyer_name:
            lawyers_list = [{
                "name": c.responsible_lawyer_name,
                "phone": c.responsible_lawyer_phone,
                "line": c.responsible_lawyer_line
            }]
        
        data.append({
            "id": str(c.id), 
            "case_number": c.case_number, 
            "title": c.title,
            "category": c.category.value if c.category else None,
            "status": c.status.value if c.status else None,
            "priority": c.priority,
            "court_name": c.court_name,
            "client_id": str(c.client_id) if c.client_id else None,
            "client_name": client_name,
            "court_date": c.court_date.isoformat() if c.court_date else None,
            "responsible_lawyer_name": c.responsible_lawyer_name,
            "responsible_lawyer_phone": c.responsible_lawyer_phone,
            "responsible_lawyer_line": c.responsible_lawyer_line,
            "responsible_clerk_name": c.responsible_clerk_name,
            "responsible_lawyers": lawyers_list,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })
        
    return {
        "total": total,
        "data": data
    }


@router.post("/")
async def create_case(req: CaseCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    data_dict = req.model_dump()
    if req.responsible_lawyers is not None:
        data_dict["responsible_lawyers"] = [l.model_dump() for l in req.responsible_lawyers]
        # sync legacy fields
        if req.responsible_lawyers:
            data_dict["responsible_lawyer_name"] = req.responsible_lawyers[0].name
            data_dict["responsible_lawyer_phone"] = req.responsible_lawyers[0].phone
            data_dict["responsible_lawyer_line"] = req.responsible_lawyers[0].line
            
    case = Case(case_number=gen_case_number(), **data_dict)
    db.add(case)
    await db.flush()
    return {"status": "success", "id": str(case.id), "case_number": case.case_number}


@router.get("/{case_id}")
async def get_case(case_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(404, "ไม่พบคดี")
    
    client_name = ""
    if case.client_id:
        client_res = await db.execute(select(Client.full_name).where(Client.id == case.client_id))
        client_name = client_res.scalar() or ""

    lawyers_list = case.responsible_lawyers or []
    if not lawyers_list and case.responsible_lawyer_name:
        lawyers_list = [{
            "name": case.responsible_lawyer_name,
            "phone": case.responsible_lawyer_phone,
            "line": case.responsible_lawyer_line
        }]

    return {
        "id": str(case.id), 
        "case_number": case.case_number, 
        "title": case.title,
        "description": case.description, 
        "category": case.category.value if case.category else None,
        "status": case.status.value if case.status else None, 
        "priority": case.priority,
        "court_name": case.court_name, 
        "court_case_number": case.court_case_number,
        "court_date": case.court_date.isoformat() if case.court_date else None,
        "ai_summary": case.ai_summary, 
        "client_id": str(case.client_id),
        "client_name": client_name,
        "responsible_lawyer_name": case.responsible_lawyer_name,
        "responsible_lawyer_phone": case.responsible_lawyer_phone,
        "responsible_lawyer_line": case.responsible_lawyer_line,
        "responsible_clerk_name": case.responsible_clerk_name,
        "responsible_lawyers": lawyers_list
    }


@router.put("/{case_id}")
async def update_case(
    case_id: str,
    req: CaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """แก้ไขรายละเอียดคดีทั้งหมด"""
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(404, "ไม่พบคดี")
    
    for key, value in req.model_dump(exclude_unset=True).items():
        if key == "responsible_lawyers" and value is not None:
            serialized_list = [l.model_dump() if hasattr(l, 'model_dump') else l for l in value]
            setattr(case, "responsible_lawyers", serialized_list)
            # sync legacy flat columns from the first lawyer
            if value:
                first_lawyer = value[0]
                if isinstance(first_lawyer, dict):
                    case.responsible_lawyer_name = first_lawyer.get("name")
                    case.responsible_lawyer_phone = first_lawyer.get("phone")
                    case.responsible_lawyer_line = first_lawyer.get("line")
                else:
                    case.responsible_lawyer_name = getattr(first_lawyer, "name", None)
                    case.responsible_lawyer_phone = getattr(first_lawyer, "phone", None)
                    case.responsible_lawyer_line = getattr(first_lawyer, "line", None)
            else:
                case.responsible_lawyer_name = None
                case.responsible_lawyer_phone = None
                case.responsible_lawyer_line = None
        else:
            setattr(case, key, value)
        
    return {"status": "success", "message": "อัปเดตข้อมูลคดีความสำเร็จ"}


@router.patch("/{case_id}/status")
async def update_case_status(
    case_id: str, 
    status: CaseStatus,
    db: AsyncSession = Depends(get_db), 
    current_user=Depends(get_current_user)
):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(404, "ไม่พบคดี")
    case.status = status
    return {"status": "success"}


@router.delete("/{case_id}")
async def delete_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """ลบคดีออกจากระบบ"""
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(404, "ไม่พบคดี")
    
    # We can do hard delete or soft delete. Since Case does not have is_active, we do hard delete.
    # But wait, let's delete safely. We'll delete the case object.
    await db.delete(case)
    return {"status": "success", "message": "ลบคดีความสำเร็จ"}
