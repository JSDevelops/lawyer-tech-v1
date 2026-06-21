"""Human Resources (HR) Routes — Staff Management, Time Attendance, Leave requests, and Payroll"""

import uuid
from datetime import datetime, date, time
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_

from app.core.database import get_db
from app.core.security import get_current_user, hash_password
from app.models.models import User, UserRole, EmployeeAttendance, EmployeeLeave, EmployeeSalary

router = APIRouter()

# ==============================
# Pydantic Schemas
# ==============================

class EmployeeCreate(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    role: str = "clerk"  # admin, partner, lawyer, clerk
    bar_number: Optional[str] = None
    specializations: List[str] = []

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    bar_number: Optional[str] = None
    specializations: Optional[List[str]] = None
    is_active: Optional[bool] = None

class LeaveCreate(BaseModel):
    leave_type: str  # ลาป่วย, ลากิจ, ลาพักร้อน
    start_date: date
    end_date: date
    reason: Optional[str] = None

class LeaveApprove(BaseModel):
    status: str  # approved, rejected

class PayrollCreate(BaseModel):
    user_id: str
    base_salary: float
    allowance: float = 0.0
    deductions: float = 0.0
    pay_period: str  # "YYYY-MM"


# ==============================
# Helpers
# ==============================

def format_user_employee(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "phone": u.phone,
        "role": u.role.value if u.role else None,
        "is_active": u.is_active,
        "bar_number": u.bar_number,
        "specializations": u.specializations or [],
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }

def format_attendance(att: EmployeeAttendance, emp_name: str = None, emp_role: str = None) -> dict:
    return {
        "id": str(att.id),
        "user_id": str(att.user_id),
        "employee_name": emp_name,
        "employee_role": emp_role,
        "date": att.date.isoformat() if att.date else None,
        "check_in": att.check_in.isoformat() if att.check_in else None,
        "check_out": att.check_out.isoformat() if att.check_out else None,
        "status": att.status,
        "notes": att.notes,
    }

def format_leave(lv: EmployeeLeave, emp_name: str = None, approver_name: str = None) -> dict:
    return {
        "id": str(lv.id),
        "user_id": str(lv.user_id),
        "employee_name": emp_name,
        "leave_type": lv.leave_type,
        "start_date": lv.start_date.isoformat() if lv.start_date else None,
        "end_date": lv.end_date.isoformat() if lv.end_date else None,
        "reason": lv.reason,
        "status": lv.status,
        "approved_by": str(lv.approved_by) if lv.approved_by else None,
        "approver_name": approver_name,
        "created_at": lv.created_at.isoformat() if lv.created_at else None,
    }

def format_payroll(sal: EmployeeSalary, emp_name: str = None, emp_role: str = None) -> dict:
    return {
        "id": str(sal.id),
        "user_id": str(sal.user_id),
        "employee_name": emp_name,
        "employee_role": emp_role,
        "base_salary": sal.base_salary,
        "allowance": sal.allowance,
        "deductions": sal.deductions,
        "net_salary": sal.base_salary + sal.allowance - sal.deductions,
        "pay_period": sal.pay_period,
        "payment_status": sal.payment_status,
        "paid_at": sal.paid_at.isoformat() if sal.paid_at else None,
        "created_at": sal.created_at.isoformat() if sal.created_at else None,
    }


# ==============================
# Staff Directory CRUD Endpoints
# ==============================

@router.get("/employees")
async def list_employees(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """รายการพนักงานทั้งหมดของสำนักงาน (ทนายความ เสมียน ผู้บริหาร)"""
    query = select(User).where(User.role != UserRole.CLIENT)
    
    if search:
        query = query.where(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.phone.ilike(f"%{search}%")
            )
        )
    if role:
        query = query.where(User.role == role)
        
    query = query.order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()
    
    return {"status": "success", "data": [format_user_employee(u) for u in users]}


@router.post("/employees")
async def create_employee(
    payload: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """เพิ่มพนักงานคนใหม่เข้าระบบ"""
    # Verify current user is admin/partner
    role_str = current_user.get("role")
    if role_str not in ["admin", "partner"]:
        raise HTTPException(status_code=403, detail="สิทธิ์ของคุณไม่สามารถจัดการพนักงานได้")
        
    # Check duplicate email
    email_check = await db.execute(select(User).where(User.email == payload.email))
    if email_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="อีเมลนี้มีในระบบแล้ว")
        
    role_map = {
        "admin": UserRole.ADMIN,
        "partner": UserRole.PARTNER,
        "lawyer": UserRole.LAWYER,
        "clerk": UserRole.CLERK
    }
    user_role = role_map.get(payload.role.lower(), UserRole.CLERK)
    
    hashed = hash_password(payload.password)
    
    new_emp = User(
        email=payload.email,
        hashed_password=hashed,
        full_name=payload.full_name,
        phone=payload.phone,
        role=user_role,
        is_active=True,
        bar_number=payload.bar_number,
        specializations=payload.specializations
    )
    
    db.add(new_emp)
    await db.commit()
    await db.refresh(new_emp)
    
    return {"status": "success", "message": "เพิ่มพนักงานสำเร็จ", "data": format_user_employee(new_emp)}


@router.put("/employees/{user_id}")
async def update_employee(
    user_id: str,
    payload: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """แก้ไขข้อมูลพนักงาน"""
    # Verify current user is admin/partner
    role_str = current_user.get("role")
    if role_str not in ["admin", "partner"]:
        raise HTTPException(status_code=403, detail="สิทธิ์ของคุณไม่สามารถแก้ไขข้อมูลพนักงานได้")
        
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="ไม่พบพนักงาน")
        
    if payload.full_name is not None:
        u.full_name = payload.full_name
    if payload.phone is not None:
        u.phone = payload.phone
    if payload.role is not None:
        role_map = {
            "admin": UserRole.ADMIN,
            "partner": UserRole.PARTNER,
            "lawyer": UserRole.LAWYER,
            "clerk": UserRole.CLERK
        }
        u.role = role_map.get(payload.role.lower(), u.role)
    if payload.bar_number is not None:
        u.bar_number = payload.bar_number
    if payload.specializations is not None:
        u.specializations = payload.specializations
    if payload.is_active is not None:
        u.is_active = payload.is_active
        
    await db.commit()
    await db.refresh(u)
    return {"status": "success", "message": "แก้ไขข้อมูลพนักงานสำเร็จ", "data": format_user_employee(u)}


# ==============================
# Time Attendance Endpoints
# ==============================

@router.get("/attendance")
async def list_attendance(
    user_id: Optional[str] = Query(None),
    date_filter: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ประวัติการลงเวลาเข้า-ออกงาน"""
    query = select(EmployeeAttendance)
    
    if user_id:
        query = query.where(EmployeeAttendance.user_id == uuid.UUID(user_id))
    if date_filter:
        query = query.where(EmployeeAttendance.date == date_filter)
        
    query = query.order_by(EmployeeAttendance.date.desc(), EmployeeAttendance.check_in.desc())
    result = await db.execute(query)
    records = result.scalars().all()
    
    formatted_data = []
    for r in records:
        emp_res = await db.execute(select(User).where(User.id == r.user_id))
        emp = emp_res.scalar_one_or_none()
        emp_name = emp.full_name if emp else "ไม่ทราบชื่อ"
        emp_role = emp.role.value if emp and emp.role else "พนักงาน"
        formatted_data.append(format_attendance(r, emp_name, emp_role))
        
    return {"status": "success", "data": formatted_data}


@router.post("/attendance/check-in")
async def check_in_attendance(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ลงบันทึกเวลาเช็คอินเข้าทำงานประจำวัน"""
    user_id_str = current_user.get("sub")
    user_uuid = uuid.UUID(user_id_str)
    today = date.today()
    
    # Check duplicate
    dup = await db.execute(
        select(EmployeeAttendance).where(
            and_(
                EmployeeAttendance.user_id == user_uuid,
                EmployeeAttendance.date == today
            )
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="คุณได้ทำการเช็คอินเข้างานของวันนี้แล้ว")
        
    now = datetime.now()
    
    # 9:00 AM target
    target_time = time(9, 0)
    check_in_status = "on_time"
    if now.time() > target_time:
        check_in_status = "late"
        
    new_att = EmployeeAttendance(
        user_id=user_uuid,
        date=today,
        check_in=now,
        status=check_in_status
    )
    
    db.add(new_att)
    await db.commit()
    await db.refresh(new_att)
    
    # Fetch details
    u_res = await db.execute(select(User).where(User.id == user_uuid))
    u = u_res.scalar_one_or_none()
    
    return {
        "status": "success",
        "message": "เช็คอินเข้างานสำเร็จ",
        "data": format_attendance(new_att, u.full_name if u else None, u.role.value if u and u.role else None)
    }


@router.post("/attendance/check-out")
async def check_out_attendance(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ลงเวลาเช็คเอาท์ออกงานประจำวัน"""
    user_id_str = current_user.get("sub")
    user_uuid = uuid.UUID(user_id_str)
    today = date.today()
    
    result = await db.execute(
        select(EmployeeAttendance).where(
            and_(
                EmployeeAttendance.user_id == user_uuid,
                EmployeeAttendance.date == today
            )
        )
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=400, detail="กรุณาลงเวลาเช็คอินเข้างานก่อนในวันนี้")
        
    att.check_out = datetime.now()
    await db.commit()
    await db.refresh(att)
    
    u_res = await db.execute(select(User).where(User.id == user_uuid))
    u = u_res.scalar_one_or_none()
    
    return {
        "status": "success",
        "message": "เช็คเอาท์ออกงานสำเร็จ",
        "data": format_attendance(att, u.full_name if u else None, u.role.value if u and u.role else None)
    }


# ==============================
# Leave Requests Endpoints
# ==============================

@router.get("/leaves")
async def list_leaves(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """คำขอลาหยุดทั้งหมด (แอดมินดูได้หมด พนักงานดูเฉพาะของตนเอง)"""
    user_id_str = current_user.get("sub")
    user_uuid = uuid.UUID(user_id_str)
    role_str = current_user.get("role")
    
    if role_str in ["admin", "partner"]:
        query = select(EmployeeLeave)
    else:
        query = select(EmployeeLeave).where(EmployeeLeave.user_id == user_uuid)
        
    query = query.order_by(EmployeeLeave.created_at.desc())
    result = await db.execute(query)
    leaves = result.scalars().all()
    
    formatted_leaves = []
    for lv in leaves:
        emp_res = await db.execute(select(User).where(User.id == lv.user_id))
        emp = emp_res.scalar_one_or_none()
        emp_name = emp.full_name if emp else "ไม่ระบุชื่อ"
        
        app_name = None
        if lv.approved_by:
            app_res = await db.execute(select(User).where(User.id == lv.approved_by))
            approver = app_res.scalar_one_or_none()
            if approver: app_name = approver.full_name
            
        formatted_leaves.append(format_leave(lv, emp_name, app_name))
        
    return {"status": "success", "data": formatted_leaves}


@router.post("/leaves")
async def request_leave(
    payload: LeaveCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ส่งคำขอลาหยุดพักร้อน ลาป่วย หรือลากิจ"""
    user_id_str = current_user.get("sub")
    user_uuid = uuid.UUID(user_id_str)
    
    new_leave = EmployeeLeave(
        user_id=user_uuid,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
        status="pending"
    )
    
    db.add(new_leave)
    await db.commit()
    await db.refresh(new_leave)
    
    u_res = await db.execute(select(User).where(User.id == user_uuid))
    u = u_res.scalar_one_or_none()
    
    return {
        "status": "success",
        "message": "ส่งคำขอลาสำเร็จ รอผู้บริหารพิจารณาอนุมัติ",
        "data": format_leave(new_leave, u.full_name if u else None)
    }


@router.put("/leaves/{leave_id}/approve")
async def approve_leave(
    leave_id: str,
    payload: LeaveApprove,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """อนุมัติหรือปฏิเสธคำขอลาหยุด (สำหรับแอดมินและพาร์ตเนอร์)"""
    role_str = current_user.get("role")
    if role_str not in ["admin", "partner"]:
        raise HTTPException(status_code=403, detail="สิทธิ์ของคุณไม่สามารถดำเนินการอนุมัติได้")
        
    approver_id_str = current_user.get("sub")
    approver_uuid = uuid.UUID(approver_id_str)
    
    result = await db.execute(
        select(EmployeeLeave).where(EmployeeLeave.id == uuid.UUID(leave_id))
    )
    lv = result.scalar_one_or_none()
    if not lv:
        raise HTTPException(status_code=404, detail="ไม่พบใบคำขอลาหยุด")
        
    lv.status = payload.status
    lv.approved_by = approver_uuid
    await db.commit()
    await db.refresh(lv)
    
    # Details
    emp_res = await db.execute(select(User).where(User.id == lv.user_id))
    emp = emp_res.scalar_one_or_none()
    
    app_res = await db.execute(select(User).where(User.id == approver_uuid))
    approver = app_res.scalar_one_or_none()
    
    return {
        "status": "success",
        "message": "บันทึกผลการพิจารณาคำขอลาสำเร็จ",
        "data": format_leave(lv, emp.full_name if emp else None, approver.full_name if approver else None)
    }


# ==============================
# Payroll & Salary Endpoints
# ==============================

@router.get("/payroll")
async def list_payroll(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """รายการใบจ่ายเงินเดือน (แอดมินดูทั้งหมด พนักงานดูเฉพาะของตนเอง)"""
    user_id_str = current_user.get("sub")
    user_uuid = uuid.UUID(user_id_str)
    role_str = current_user.get("role")
    
    if role_str in ["admin", "partner"]:
        query = select(EmployeeSalary)
    else:
        query = select(EmployeeSalary).where(EmployeeSalary.user_id == user_uuid)
        
    query = query.order_by(EmployeeSalary.pay_period.desc(), EmployeeSalary.created_at.desc())
    result = await db.execute(query)
    payroll_slips = result.scalars().all()
    
    formatted_payroll = []
    for slip in payroll_slips:
        emp_res = await db.execute(select(User).where(User.id == slip.user_id))
        emp = emp_res.scalar_one_or_none()
        emp_name = emp.full_name if emp else "ไม่พบชื่อ"
        emp_role = emp.role.value if emp and emp.role else "พนักงาน"
        
        formatted_payroll.append(format_payroll(slip, emp_name, emp_role))
        
    return {"status": "success", "data": formatted_payroll}


@router.post("/payroll")
async def generate_payroll(
    payload: PayrollCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ทำเรื่องเบิกจ่ายเงินเดือนสำหรับพนักงาน"""
    role_str = current_user.get("role")
    if role_str not in ["admin", "partner"]:
        raise HTTPException(status_code=403, detail="สิทธิ์ของคุณไม่สามารถจัดทำเงินเดือนได้")
        
    target_uuid = uuid.UUID(payload.user_id)
    
    # Check duplicate period
    dup = await db.execute(
        select(EmployeeSalary).where(
            and_(
                EmployeeSalary.user_id == target_uuid,
                EmployeeSalary.pay_period == payload.pay_period
            )
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"พนักงานรายนี้ได้รับสลิปเงินเดือนประจำรอบ {payload.pay_period} แล้ว")
        
    new_payroll = EmployeeSalary(
        user_id=target_uuid,
        base_salary=payload.base_salary,
        allowance=payload.allowance,
        deductions=payload.deductions,
        pay_period=payload.pay_period,
        payment_status="pending"
    )
    
    db.add(new_payroll)
    await db.commit()
    await db.refresh(new_payroll)
    
    emp_res = await db.execute(select(User).where(User.id == target_uuid))
    emp = emp_res.scalar_one_or_none()
    
    return {
        "status": "success",
        "message": "สร้างสลิปเงินเดือนสำเร็จ",
        "data": format_payroll(new_payroll, emp.full_name if emp else None, emp.role.value if emp and emp.role else None)
    }


@router.put("/payroll/{payroll_id}/pay")
async def pay_salary(
    payroll_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """บันทึกยืนยันการจ่ายเงินพนักงาน"""
    role_str = current_user.get("role")
    if role_str not in ["admin", "partner"]:
        raise HTTPException(status_code=403, detail="สิทธิ์ของคุณไม่สามารถยืนยันยอดจ่ายเงินเดือนได้")
        
    result = await db.execute(
        select(EmployeeSalary).where(EmployeeSalary.id == uuid.UUID(payroll_id))
    )
    sal = result.scalar_one_or_none()
    if not sal:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลสลิปเงินเดือนดังกล่าว")
        
    sal.payment_status = "paid"
    sal.paid_at = datetime.utcnow()
    await db.commit()
    await db.refresh(sal)
    
    emp_res = await db.execute(select(User).where(User.id == sal.user_id))
    emp = emp_res.scalar_one_or_none()
    
    return {
        "status": "success",
        "message": "บันทึกข้อมูลการโอนเงินสำเร็จ",
        "data": format_payroll(sal, emp.full_name if emp else None, emp.role.value if emp and emp.role else None)
    }
