"""Clients Routes — CRM, KYC, Contact Management"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Client

router = APIRouter()


class ClientCreate(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    id_card: Optional[str] = None
    address: Optional[str] = None
    line_id: Optional[str] = None
    service_type: str = "free"
    kyc_status: str = "pending"
    occupation: Optional[str] = None
    company: Optional[str] = None
    notes: Optional[str] = None
    tags: List[str] = []


class ClientUpdate(ClientCreate):
    pass


def generate_client_code():
    return f"CLT-{str(uuid.uuid4())[:8].upper()}"


@router.get("/")
async def list_clients(
    search: Optional[str] = Query(None),
    service_type: Optional[str] = Query(None),
    kyc_status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """รายชื่อลูกความทั้งหมด"""
    query = select(Client).where(Client.is_active == True)
    
    if search:
        query = query.where(
            or_(
                Client.full_name.ilike(f"%{search}%"),
                Client.phone.ilike(f"%{search}%"),
                Client.email.ilike(f"%{search}%"),
            )
        )
    if service_type:
        query = query.where(Client.service_type == service_type)
    if kyc_status:
        query = query.where(Client.kyc_status == kyc_status)
    
    # Sort by created_at desc to show newest first
    query = query.order_by(Client.created_at.desc())
    
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()
    
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    clients = result.scalars().all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": [
            {
                "id": str(c.id),
                "client_code": c.client_code,
                "full_name": c.full_name,
                "phone": c.phone,
                "email": c.email,
                "service_type": c.service_type,
                "kyc_status": c.kyc_status,
                "occupation": c.occupation,
                "company": c.company,
                "tags": c.tags,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in clients
        ]
    }


@router.post("/")
async def create_client(
    request: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """เพิ่มลูกความใหม่"""
    client = Client(
        client_code=generate_client_code(),
        **request.model_dump()
    )
    db.add(client)
    await db.flush()
    return {"status": "success", "id": str(client.id), "client_code": client.client_code}


@router.get("/{client_id}")
async def get_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """ดูรายละเอียดลูกความ"""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="ไม่พบลูกความ")
    return {
        "id": str(client.id),
        "client_code": client.client_code,
        "full_name": client.full_name,
        "id_card": client.id_card,
        "phone": client.phone,
        "email": client.email,
        "address": client.address,
        "line_id": client.line_id,
        "service_type": client.service_type,
        "kyc_status": client.kyc_status,
        "occupation": client.occupation,
        "company": client.company,
        "tags": client.tags,
        "notes": client.notes,
        "created_at": client.created_at.isoformat() if client.created_at else None,
    }


@router.put("/{client_id}")
async def update_client(
    client_id: str,
    request: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """แก้ไขข้อมูลลูกความ"""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="ไม่พบลูกความ")
    
    for key, value in request.model_dump(exclude_unset=True).items():
        setattr(client, key, value)
    
    return {"status": "success", "message": "อัปเดตข้อมูลสำเร็จ"}


@router.patch("/{client_id}/kyc")
async def update_client_kyc(
    client_id: str,
    kyc_status: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """อัปเดตสถานะ KYC"""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="ไม่พบลูกความ")
    client.kyc_status = kyc_status
    return {"status": "success", "message": "อัปเดตสถานะ KYC สำเร็จ"}


@router.delete("/{client_id}")
async def delete_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """ลบลูกความ (Soft Delete)"""
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="ไม่พบลูกความ")
    client.is_active = False
    return {"status": "success", "message": "ลบลูกความสำเร็จ"}
