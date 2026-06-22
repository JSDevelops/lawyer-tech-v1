from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Case, Tenant, SubscriptionPlan, TenantSubscription, UserRole, SystemSetting, SystemAuditLog, SaaSTransaction
from app.core.email import send_invoice_email
from datetime import datetime, timedelta

async def log_action(db: AsyncSession, action: str, details: str, email: str):
    log = SystemAuditLog(
        action=action,
        details=details,
        performed_by_email=email
    )
    db.add(log)
    await db.flush()

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
    price_yearly: float = 0.0
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
        plan_price_yearly = 0.0
        billing_cycle = "monthly"
        end_date = None
        if sub_row:
            plan_name = sub_row[1].name
            plan_price = sub_row[1].price
            plan_price_yearly = sub_row[1].price_yearly
            billing_cycle = sub_row[0].billing_cycle
            end_date = sub_row[0].end_date

        tenant_list.append({
            "id": str(tenant.id),
            "name": tenant.name,
            "subdomain": tenant.subdomain or "N/A",
            "status": tenant.status,
            "created_at": tenant.created_at,
            "user_count": user_count,
            "case_count": case_count,
            "plan_name": plan_name,
            "plan_price": plan_price,
            "plan_price_yearly": plan_price_yearly,
            "billing_cycle": billing_cycle,
            "end_date": end_date
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
            
    await log_action(db, "CREATE_TENANT", f"Created tenant '{tenant.name}' with subdomain '{tenant.subdomain}'", current_user["email"])
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
    await log_action(db, "UPDATE_TENANT_STATUS", f"Changed tenant '{tenant.name}' status to '{req.status}'", current_user["email"])
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
            "price_yearly": p.price_yearly,
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
        price_yearly=req.price_yearly,
        max_users=req.max_users,
        storage_limit_gb=req.storage_limit_gb,
        enable_ai=req.enable_ai,
        enable_api_access=req.enable_api_access
    )
    db.add(plan)
    await db.flush()
    await log_action(db, "CREATE_PLAN", f"Created subscription plan '{plan.name}' for {plan.price} THB/mo / {plan.price_yearly} THB/yr", current_user["email"])
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
    plan.price_yearly = req.price_yearly
    plan.max_users = req.max_users
    plan.storage_limit_gb = req.storage_limit_gb
    plan.enable_ai = req.enable_ai
    plan.enable_api_access = req.enable_api_access
    
    await log_action(db, "UPDATE_PLAN", f"Updated subscription plan '{plan.name}' settings", current_user["email"])
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
        
    plan_name = plan.name
    await db.delete(plan)
    await log_action(db, "DELETE_PLAN", f"Deleted subscription plan '{plan_name}'", current_user["email"])
    return {"status": "success", "message": "ลบแพ็กเกจสำเร็จ"}


# ==============================
# New Schemas for SaaS
# ==============================

class SettingsUpdateRequest(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    gemini_api_key_override: Optional[str] = ""
    maintenance_mode: bool
    allow_new_registrations: bool

class TenantSubscriptionUpdateRequest(BaseModel):
    plan_id: str
    billing_cycle: str = "monthly" # monthly, yearly


# ==============================
# Settings Endpoints
# ==============================

@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """ดึงข้อมูลการตั้งค่าระบบส่วนกลาง"""
    result = await db.execute(select(SystemSetting))
    setting = result.scalar_one_or_none()
    if not setting:
        setting = SystemSetting()
        db.add(setting)
        await db.commit()
        # Refetch
        result = await db.execute(select(SystemSetting))
        setting = result.scalar_one()
        
    return {
        "smtp_host": setting.smtp_host,
        "smtp_port": setting.smtp_port,
        "smtp_user": setting.smtp_user,
        "smtp_password": setting.smtp_password,
        "gemini_api_key_override": setting.gemini_api_key_override,
        "maintenance_mode": setting.maintenance_mode,
        "allow_new_registrations": setting.allow_new_registrations
    }

@router.put("/settings")
async def update_settings(req: SettingsUpdateRequest, db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """อัปเดตการตั้งค่าระบบส่วนกลาง"""
    result = await db.execute(select(SystemSetting))
    setting = result.scalar_one_or_none()
    if not setting:
        setting = SystemSetting()
        db.add(setting)
    
    setting.smtp_host = req.smtp_host
    setting.smtp_port = req.smtp_port
    setting.smtp_user = req.smtp_user
    setting.smtp_password = req.smtp_password
    setting.gemini_api_key_override = req.gemini_api_key_override
    setting.maintenance_mode = req.maintenance_mode
    setting.allow_new_registrations = req.allow_new_registrations
    
    await log_action(db, "UPDATE_SETTINGS", "Updated global system configurations", current_user["email"])
    return {"status": "success", "message": "บันทึกการตั้งค่าระบบสำเร็จ"}


# ==============================
# Audit Logs Endpoints
# ==============================

@router.get("/logs")
async def get_audit_logs(db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """ดึงบันทึกประวัติการทำงานของระบบ"""
    result = await db.execute(select(SystemAuditLog).order_by(SystemAuditLog.created_at.desc()).limit(100))
    logs = result.scalars().all()
    return [
        {
            "id": str(log.id),
            "action": log.action,
            "details": log.details,
            "performed_by_email": log.performed_by_email,
            "ip_address": log.ip_address,
            "created_at": log.created_at
        } for log in logs
    ]


# ==============================
# Tenant Subscription Update
# ==============================

@router.put("/tenants/{tenant_id}/subscription")
async def update_tenant_subscription(tenant_id: str, req: TenantSubscriptionUpdateRequest, db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """แก้ไขหรือต่ออายุแพ็กเกจสมาชิกของ Tenant ด้วยตนเอง"""
    try:
        t_uuid = uuid.UUID(tenant_id)
        p_uuid = uuid.UUID(req.plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID ไม่ถูกต้อง")

    # Verify tenant
    t_res = await db.execute(select(Tenant).where(Tenant.id == t_uuid))
    tenant = t_res.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลสำนักงาน")

    # Verify plan
    p_res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == p_uuid))
    plan = p_res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="ไม่พบแพ็กเกจสมาชิก")

    # Deactivate current subscriptions
    await db.execute(
        update(TenantSubscription)
        .where(TenantSubscription.tenant_id == t_uuid, TenantSubscription.is_active == True)
        .values(is_active=False)
    )

    # Create new subscription
    price_paid = plan.price if req.billing_cycle == "monthly" else plan.price_yearly
    end_date = None
    if req.billing_cycle == "monthly":
        end_date = datetime.now() + timedelta(days=30)
    elif req.billing_cycle == "yearly":
        end_date = datetime.now() + timedelta(days=365)

    sub = TenantSubscription(
        tenant_id=t_uuid,
        plan_id=p_uuid,
        billing_cycle=req.billing_cycle,
        price_paid=price_paid,
        end_date=end_date,
        is_active=True
    )
    db.add(sub)
    await db.flush()

    # Create SaaS Transaction record
    invoice_num = f"INV-SAAS-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    tx = SaaSTransaction(
        invoice_number=invoice_num,
        tenant_id=t_uuid,
        plan_id=p_uuid,
        amount=price_paid,
        billing_cycle=req.billing_cycle,
        payment_status="paid",
        payment_method="manual_override",
        payment_date=datetime.now()
    )
    db.add(tx)
    await db.flush()

    # Log action
    await log_action(db, "UPDATE_TENANT_SUBSCRIPTION", f"Manually assigned plan '{plan.name}' ({req.billing_cycle}) to tenant '{tenant.name}'", current_user["email"])

    # Find tenant admin email to send invoice/receipt notification
    admin_res = await db.execute(
        select(User.email).where(User.tenant_id == t_uuid, User.role == UserRole.ADMIN)
    )
    admin_email = admin_res.scalar_one_or_none()
    
    # If no admin, default to the oldest registered user of the tenant
    if not admin_email:
        user_res = await db.execute(
            select(User.email).where(User.tenant_id == t_uuid).order_by(User.created_at.asc())
        )
        admin_email = user_res.scalars().first()

    email_sent = False
    if admin_email:
        try:
            email_sent = await send_invoice_email(
                db=db,
                recipient_email=admin_email,
                tenant_name=tenant.name,
                plan_name=plan.name,
                amount=price_paid,
                billing_cycle=req.billing_cycle,
                end_date=end_date,
                invoice_number=invoice_num
            )
        except Exception as email_err:
            print(f"Error sending automatic subscription email: {email_err}")

    return {
        "status": "success", 
        "message": f"เปลี่ยนแพ็กเกจสมาชิกให้สำนักงาน {tenant.name} สำเร็จ",
        "invoice_number": invoice_num,
        "email_sent": email_sent
    }


# ==============================
# SaaS Billing Transactions
# ==============================

class SaaSTransactionCreateRequest(BaseModel):
    tenant_id: str
    plan_id: str
    amount: float
    billing_cycle: str # monthly, yearly
    payment_status: str # paid, pending, failed
    payment_method: str # bank_transfer, credit_card, manual_override

@router.get("/transactions")
async def get_saas_transactions(db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """ดึงข้อมูลรายการธุรกรรมการชำระเงินค่าแพ็กเกจทั้งหมด"""
    result = await db.execute(
        select(SaaSTransaction, Tenant.name, Tenant.subdomain, SubscriptionPlan.name)
        .join(Tenant, SaaSTransaction.tenant_id == Tenant.id)
        .join(SubscriptionPlan, SaaSTransaction.plan_id == SubscriptionPlan.id)
        .order_by(SaaSTransaction.created_at.desc())
    )
    
    tx_list = []
    for row in result.all():
        tx, t_name, t_subdomain, p_name = row
        tx_list.append({
            "id": str(tx.id),
            "invoice_number": tx.invoice_number,
            "tenant_name": t_name,
            "tenant_subdomain": t_subdomain,
            "plan_name": p_name,
            "amount": tx.amount,
            "billing_cycle": tx.billing_cycle,
            "payment_status": tx.payment_status,
            "payment_method": tx.payment_method,
            "payment_date": tx.payment_date.isoformat() if tx.payment_date else None,
            "created_at": tx.created_at.isoformat() if tx.created_at else None
        })
    return tx_list

@router.post("/transactions")
async def create_saas_transaction(req: SaaSTransactionCreateRequest, db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """บันทึกธุรกรรมการชำระเงินใหม่ด้วยมือ (Manual Transaction Record)"""
    try:
        t_uuid = uuid.UUID(req.tenant_id)
        p_uuid = uuid.UUID(req.plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID ไม่ถูกต้อง")

    # Verify tenant
    t_res = await db.execute(select(Tenant).where(Tenant.id == t_uuid))
    tenant = t_res.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลสำนักงาน")

    # Verify plan
    p_res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == p_uuid))
    plan = p_res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="ไม่พบแพ็กเกจสมาชิก")

    invoice_num = f"INV-SAAS-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    tx = SaaSTransaction(
        invoice_number=invoice_num,
        tenant_id=t_uuid,
        plan_id=p_uuid,
        amount=req.amount,
        billing_cycle=req.billing_cycle,
        payment_status=req.payment_status,
        payment_method=req.payment_method,
        payment_date=datetime.now()
    )
    db.add(tx)
    await db.flush()

    # Log action
    await log_action(db, "CREATE_SAAS_TRANSACTION", f"Manually recorded transaction '{invoice_num}' for tenant '{tenant.name}'", current_user["email"])

    # Attempt to send email if status is paid
    email_sent = False
    if req.payment_status == "paid":
        # Find tenant admin email
        admin_res = await db.execute(
            select(User.email).where(User.tenant_id == t_uuid, User.role == UserRole.ADMIN)
        )
        admin_email = admin_res.scalar_one_or_none()
        
        if not admin_email:
            user_res = await db.execute(
                select(User.email).where(User.tenant_id == t_uuid).order_by(User.created_at.asc())
            )
            admin_email = user_res.scalars().first()

        if admin_email:
            # Check end_date of active sub
            sub_res = await db.execute(
                select(TenantSubscription.end_date)
                .where(TenantSubscription.tenant_id == t_uuid, TenantSubscription.plan_id == p_uuid, TenantSubscription.is_active == True)
            )
            end_date = sub_res.scalar_one_or_none()
            
            try:
                email_sent = await send_invoice_email(
                    db=db,
                    recipient_email=admin_email,
                    tenant_name=tenant.name,
                    plan_name=plan.name,
                    amount=req.amount,
                    billing_cycle=req.billing_cycle,
                    end_date=end_date,
                    invoice_number=invoice_num
                )
            except Exception as e:
                print(f"Error sending manual transaction email: {e}")

    return {
        "status": "success", 
        "message": f"บันทึกธุรกรรม {invoice_num} สำเร็จ",
        "invoice_number": invoice_num,
        "email_sent": email_sent
    }

@router.post("/transactions/{tx_id}/resend-email")
async def resend_transaction_email(tx_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(require_admin)):
    """ส่งอีเมลใบแจ้งหนี้/ยืนยันการทำธุรกรรมอีกครั้ง"""
    try:
        tx_uuid = uuid.UUID(tx_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID ไม่ถูกต้อง")

    # Fetch transaction with details
    res = await db.execute(
        select(SaaSTransaction, Tenant, SubscriptionPlan)
        .join(Tenant, SaaSTransaction.tenant_id == Tenant.id)
        .join(SubscriptionPlan, SaaSTransaction.plan_id == SubscriptionPlan.id)
        .where(SaaSTransaction.id == tx_uuid)
    )
    row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลธุรกรรม")

    tx, tenant, plan = row

    # Find tenant admin email
    admin_res = await db.execute(
        select(User.email).where(User.tenant_id == tenant.id, User.role == UserRole.ADMIN)
    )
    admin_email = admin_res.scalar_one_or_none()
    
    if not admin_email:
        user_res = await db.execute(
            select(User.email).where(User.tenant_id == tenant.id).order_by(User.created_at.asc())
        )
        admin_email = user_res.scalars().first()

    if not admin_email:
        raise HTTPException(status_code=404, detail="ไม่พบอีเมลผู้ใช้งานในสำนักงานสำหรับส่งการแจ้งเตือน")

    # Get active subscription to see current end_date
    sub_res = await db.execute(
        select(TenantSubscription.end_date)
        .where(TenantSubscription.tenant_id == tenant.id, TenantSubscription.plan_id == plan.id, TenantSubscription.is_active == True)
    )
    end_date = sub_res.scalar_one_or_none()

    email_sent = await send_invoice_email(
        db=db,
        recipient_email=admin_email,
        tenant_name=tenant.name,
        plan_name=plan.name,
        amount=tx.amount,
        billing_cycle=tx.billing_cycle,
        end_date=end_date,
        invoice_number=tx.invoice_number
    )

    if not email_sent:
        raise HTTPException(status_code=500, detail="ไม่สามารถส่งอีเมลได้ กรุณาตรวจสอบการตั้งค่าเมลเซิร์ฟเวอร์ระบบ (SMTP) ในการตั้งค่า")

    return {"status": "success", "message": f"ส่งอีเมลใบเสร็จเลขที่ {tx.invoice_number} ไปยัง {admin_email} สำเร็จ"}
