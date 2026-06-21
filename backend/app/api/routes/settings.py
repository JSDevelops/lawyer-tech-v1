from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user, hash_password, verify_password
from app.models.models import User, FirmSetting, UserRole

router = APIRouter()


class ProfileUpdateRequest(BaseModel):
    full_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    bar_number: Optional[str] = None
    specializations: Optional[List[str]] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class FirmSettingsUpdateRequest(BaseModel):
    firm_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    tax_id: Optional[str] = None
    default_tax_rate: Optional[float] = None
    logo_url: Optional[str] = None
    enable_ai_summary: Optional[bool] = None
    enable_line_notify: Optional[bool] = None
    default_case_priority: Optional[str] = None


@router.get("/profile")
async def get_profile(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน"""
    result = await db.execute(select(User).where(User.id == current_user["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "role": user.role.value,
        "bar_number": user.bar_number,
        "specializations": user.specializations or [],
    }


@router.put("/profile")
async def update_profile(req: ProfileUpdateRequest, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """แก้ไขข้อมูลส่วนตัว"""
    result = await db.execute(select(User).where(User.id == current_user["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")
    
    user.full_name = req.full_name
    user.phone = req.phone
    user.avatar_url = req.avatar_url
    user.bar_number = req.bar_number
    user.specializations = req.specializations
    
    return {"status": "success", "message": "อัปเดตข้อมูลส่วนตัวสำเร็จ"}


@router.put("/profile/change-password")
async def change_password(req: ChangePasswordRequest, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """เปลี่ยนรหัสผ่าน"""
    result = await db.execute(select(User).where(User.id == current_user["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้")
        
    if not verify_password(req.old_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="รหัสผ่านเดิมไม่ถูกต้อง")
        
    user.hashed_password = hash_password(req.new_password)
    return {"status": "success", "message": "เปลี่ยนรหัสผ่านสำเร็จ"}


@router.get("/firm")
async def get_firm_settings(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """ดึงข้อมูลการตั้งค่าสำนักงานกฎหมาย"""
    result = await db.execute(select(FirmSetting))
    setting = result.scalars().first()
    
    if not setting:
        # Create a default one
        setting = FirmSetting()
        db.add(setting)
        await db.flush()
        
    return {
        "id": str(setting.id),
        "firm_name": setting.firm_name,
        "address": setting.address,
        "phone": setting.phone,
        "tax_id": setting.tax_id,
        "default_tax_rate": setting.default_tax_rate,
        "logo_url": setting.logo_url,
        "enable_ai_summary": setting.enable_ai_summary,
        "enable_line_notify": setting.enable_line_notify,
        "default_case_priority": setting.default_case_priority
    }


@router.put("/firm")
async def update_firm_settings(req: FirmSettingsUpdateRequest, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """แก้ไขการตั้งค่าสำนักงานกฎหมาย (สิทธิ์เฉพาะ admin หรือ partner)"""
    if current_user["role"] not in [UserRole.ADMIN.value, UserRole.PARTNER.value]:
        raise HTTPException(status_code=403, detail="คุณไม่มีสิทธิ์แก้ไขการตั้งค่าสำนักงาน")
        
    result = await db.execute(select(FirmSetting))
    setting = result.scalars().first()
    
    if not setting:
        setting = FirmSetting()
        db.add(setting)
        await db.flush()
        
    for key, val in req.model_dump(exclude_unset=True).items():
        setattr(setting, key, val)
        
    return {"status": "success", "message": "บันทึกการตั้งค่าสำนักงานกฎหมายสำเร็จ"}
