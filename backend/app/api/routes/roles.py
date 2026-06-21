"""Roles & Access Routes — RBAC Management"""
from fastapi import APIRouter, Depends
from app.core.security import get_current_user

router = APIRouter()

@router.get("/")
async def list_roles(current_user=Depends(get_current_user)):
    return {"roles": ["admin", "partner", "lawyer", "clerk", "client"]}
