from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Case, Tenant, SubscriptionPlan, TenantSubscription, UserRole

router = APIRouter()

# ==============================
# Pydantic Schemas
# ==============================

class TenantCreateRequest(BaseModel):
    name: str
    subdomain: Optional[str] = None
    plan_id: Optional[str] = None # Optional initial subscription plan

class TenantStatusUpdateRequest(BaseModel):
    status: str # active, suspended, trial_expired

class PlanCreateRequest(BaseModel):
    name: str
    price: float
    max_users: int = 3
    storage_limit_gb: float = 1.0
    enable_ai: bool = False
    enable_api_access: bool = False

# ==============================
# Dependency for Auth Checks
# ==============================

def require_admin(current_user=Depends(get_current_user)):
    """ความปลอดภัย: อนุญาตเฉพาะผู้ใช้ที่มีบทบาทเป็น admin หรือ partner เท่านั้น"""
    if current_user["role"] not in [UserRole.ADMIN.value, UserRole.PARTNER.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="คุณไม่มีสิทธิ์เข้าถึงฟังก์ชันผู้ดูแลระบบส่วนกลาง"
        )
    return current_user

# ==============================
# SuperAdmin Endpoints
# ==============================

@router.get("/stats")
async def get_superadmin_stats(db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """ดึงข้อมูลสถิติภาพรวมของระบบทั้งหมด (SaaS Dashboard)"""
    # 1. Total Tenants
    result = await db.execute(select(func.count(Tenant.id)))
    total_tenants = result.scalar() or 0

    # 2. Active Tenants
    result = await db.execute(select(func.count(Tenant.id)).where(Tenant.status == "active"))
    active_tenants = result.scalar() or 0

    # 3. Total Users (Lawyers/Clerks)
    result = await db.execute(select(func.count(User.id)))
    total_users = result.scalar() or 0

    # 4. Total Cases
    result = await db.execute(select(func.count(Case.id)))
    total_cases = result.scalar() or 0

    # 5. Total Subscription Plans
    result = await db.execute(select(func.count(SubscriptionPlan.id)))
    total_plans = result.scalar() or 0

    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "total_users": total_users,
        "total_cases": total_cases,
        "total_plans": total_plans,
        "database_connections": 12, # mock pool connection
        "revenue_thb": 49000.0 # mock monthly subscription revenue
    }

@router.get("/tenants")
async def get_tenants(db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """ดึงข้อมูลรายชื่อสำนักงานกฎหมายทั้งหมดที่สมัครใช้งานระบบ"""
    result = await db.execute(select(Tenant))
    tenants = result.scalars().all()
    
    tenant_list = []
    for tenant in tenants:
        # Get user count for this tenant
        u_res = await db.execute(select(func.count(User.id)).where(User.tenant_id == tenant.id))
        user_count = u_res.scalar() or 0
        
        # Get case count for this tenant
        c_res = await db.execute(select(func.count(Case.id)).where(Case.tenant_id == tenant.id))
        case_count = c_res.scalar() or 0

        # Get active subscription plan name
        sub_res = await db.execute(
            select(TenantSubscription, SubscriptionPlan)
            .join(SubscriptionPlan, TenantSubscription.plan_id == SubscriptionPlan.id)
            .where(TenantSubscription.tenant_id == tenant.id, TenantSubscription.is_active == True)
        )
        sub_row = sub_res.first()
        plan_name = "ไม่ได้สมัครสมาชิก"
        plan_price = 0.0
        if sub_row:
            plan_name = sub_row[1].name
            plan_price = sub_row[1].price

        tenant_list.append({
            "id": str(tenant.id),
            "name": tenant.name,
            "subdomain": tenant.subdomain or "N/A",
            "status": tenant.status,
            "created_at": tenant.created_at,
            "user_count": user_count,
            "case_count": case_count,
            "plan_name": plan_name,
            "plan_price": plan_price
        })
        
    return tenant_list

@router.post("/tenants")
async def create_tenant(req: TenantCreateRequest, db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """ลงทะเบียนสำนักงานใหม่ (Tenant)"""
    # Check subdomain uniqueness
    if req.subdomain:
        existing_res = await db.execute(select(Tenant).where(Tenant.subdomain == req.subdomain))
        if existing_res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="ซับโดเมนนี้ถูกใช้งานแล้ว")
            
    tenant = Tenant(
        name=req.name,
        subdomain=req.subdomain,
        status="active"
    )
    db.add(tenant)
    await db.flush()

    # Assign default subscription if provided
    if req.plan_id:
        try:
            plan_uuid = uuid.UUID(req.plan_id)
            plan_res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_uuid))
            plan = plan_res.scalar_one_or_none()
            if plan:
                sub = TenantSubscription(
                    tenant_id=tenant.id,
                    plan_id=plan.id,
                    is_active=True
                )
                db.add(sub)
        except ValueError:
            pass
            
    return {"status": "success", "tenant_id": str(tenant.id), "message": f"สร้าง Tenant: {tenant.name} สำเร็จ"}

@router.put("/tenants/{tenant_id}/status")
async def update_tenant_status(tenant_id: str, req: TenantStatusUpdateRequest, db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """ระงับการเข้าใช้งาน หรือเปลี่ยนสถานะของ Tenant"""
    try:
        t_uuid = uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID ไม่ถูกต้อง")

    result = await db.execute(select(Tenant).where(Tenant.id == t_uuid))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="ไม่พบ Tenant")
        
    tenant.status = req.status
    return {"status": "success", "message": f"เปลี่ยนสถานะ Tenant เป็น {req.status} สำเร็จ"}

# ==============================
# Plan Endpoints (CRUD)
# ==============================

@router.get("/plans")
async def get_plans(db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """ดึงข้อมูลแพ็กเกจสมาชิกทั้งหมด"""
    result = await db.execute(select(SubscriptionPlan))
    plans = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "price": p.price,
            "max_users": p.max_users,
            "storage_limit_gb": p.storage_limit_gb,
            "enable_ai": p.enable_ai,
            "enable_api_access": p.enable_api_access,
            "created_at": p.created_at
        } for p in plans
    ]

@router.post("/plans")
async def create_plan(req: PlanCreateRequest, db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """สร้างแพ็กเกจสมาชิกใหม่"""
    plan = SubscriptionPlan(
        name=req.name,
        price=req.price,
        max_users=req.max_users,
        storage_limit_gb=req.storage_limit_gb,
        enable_ai=req.enable_ai,
        enable_api_access=req.enable_api_access
    )
    db.add(plan)
    await db.flush()
    return {"status": "success", "plan_id": str(plan.id), "message": f"สร้างแพ็กเกจ {plan.name} สำเร็จ"}

@router.put("/plans/{plan_id}")
async def update_plan(plan_id: str, req: PlanCreateRequest, db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """แก้ไขแพ็กเกจสมาชิก"""
    try:
        p_uuid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID ไม่ถูกต้อง")

    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == p_uuid))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="ไม่พบแพ็กเกจสมาชิก")
        
    plan.name = req.name
    plan.price = req.price
    plan.max_users = req.max_users
    plan.storage_limit_gb = req.storage_limit_gb
    plan.enable_ai = req.enable_ai
    plan.enable_api_access = req.enable_api_access
    
    return {"status": "success", "message": "อัปเดตแพ็กเกจสำเร็จ"}

@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """ลบแพ็กเกจสมาชิก"""
    try:
        p_uuid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID ไม่ถูกต้อง")

    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == p_uuid))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="ไม่พบแพ็กเกจสมาชิก")
        
    await db.delete(plan)
    return {"status": "success", "message": "ลบแพ็กเกจสำเร็จ"}
