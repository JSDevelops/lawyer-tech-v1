"""Calendar Routes — Full CRUD, Court Dates, Deadlines, Appointments"""

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from datetime import datetime, date, timedelta
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import CalendarEvent, Case, Client, EventType

router = APIRouter()


# ==============================
# Schemas
# ==============================

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: str  # นัดศาล, กำหนดส่งเอกสาร, นัดประชุม, นัดหมายลูกความ, เตือนความจำ, นัดไต่สวน
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    all_day: bool = False
    location: Optional[str] = None
    reminder_minutes: int = 60
    case_id: Optional[str] = None
    attendees: List[str] = []


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    all_day: Optional[bool] = None
    location: Optional[str] = None
    reminder_minutes: Optional[int] = None
    case_id: Optional[str] = None
    attendees: Optional[List[str]] = None


def format_event(ev: CalendarEvent, case_title: str = None, case_number: str = None) -> dict:
    """Format event to dict for API response"""
    return {
        "id": str(ev.id),
        "title": ev.title,
        "description": ev.description,
        "event_type": ev.event_type.value if ev.event_type else ev.event_type,
        "start_datetime": ev.start_datetime.isoformat() if ev.start_datetime else None,
        "end_datetime": ev.end_datetime.isoformat() if ev.end_datetime else None,
        "all_day": ev.all_day,
        "location": ev.location,
        "reminder_minutes": ev.reminder_minutes,
        "is_reminder_sent": ev.is_reminder_sent,
        "case_id": str(ev.case_id) if ev.case_id else None,
        "case_title": case_title,
        "case_number": case_number,
        "created_by": str(ev.created_by) if ev.created_by else None,
        "attendees": ev.attendees or [],
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
    }


# ==============================
# Endpoints
# ==============================

@router.get("/")
async def list_events(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    event_type: Optional[str] = Query(None),
    case_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    upcoming: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """รายการนัดหมายทั้งหมด - กรองตามเดือน/ประเภท/คดี"""
    query = select(CalendarEvent)

    # Filter by month/year
    if year and month:
        from_date = datetime(year, month, 1)
        if month == 12:
            to_date = datetime(year + 1, 1, 1)
        else:
            to_date = datetime(year, month + 1, 1)
        query = query.where(
            and_(
                CalendarEvent.start_datetime >= from_date,
                CalendarEvent.start_datetime < to_date
            )
        )

    # Filter upcoming (next 30 days)
    if upcoming:
        now = datetime.utcnow()
        future = now + timedelta(days=30)
        query = query.where(
            and_(
                CalendarEvent.start_datetime >= now,
                CalendarEvent.start_datetime <= future
            )
        )

    # Filter by event type
    if event_type:
        query = query.where(CalendarEvent.event_type == event_type)

    # Filter by case
    if case_id:
        query = query.where(CalendarEvent.case_id == uuid.UUID(case_id))

    # Search
    if search:
        query = query.where(
            or_(
                CalendarEvent.title.ilike(f"%{search}%"),
                CalendarEvent.description.ilike(f"%{search}%"),
                CalendarEvent.location.ilike(f"%{search}%"),
            )
        )

    query = query.order_by(CalendarEvent.start_datetime.asc())
    result = await db.execute(query)
    events = result.scalars().all()

    # Enrich with case info
    events_data = []
    for ev in events:
        case_title = None
        case_number = None
        if ev.case_id:
            case_result = await db.execute(select(Case).where(Case.id == ev.case_id))
            case = case_result.scalar_one_or_none()
            if case:
                case_title = case.title
                case_number = case.case_number
        events_data.append(format_event(ev, case_title, case_number))

    return {"data": events_data, "total": len(events_data)}


@router.get("/stats")
async def get_calendar_stats(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """สถิติปฏิทิน — จำนวนตามประเภท, วันนี้, สัปดาห์นี้"""
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)
    week_end = today_start + timedelta(days=7)
    month_end = today_start + timedelta(days=30)

    # Total events
    total_result = await db.execute(select(func.count(CalendarEvent.id)))
    total = total_result.scalar()

    # Today's events
    today_result = await db.execute(
        select(func.count(CalendarEvent.id)).where(
            and_(
                CalendarEvent.start_datetime >= today_start,
                CalendarEvent.start_datetime < today_end
            )
        )
    )
    today_count = today_result.scalar()

    # This week
    week_result = await db.execute(
        select(func.count(CalendarEvent.id)).where(
            and_(
                CalendarEvent.start_datetime >= today_start,
                CalendarEvent.start_datetime < week_end
            )
        )
    )
    week_count = week_result.scalar()

    # Next 30 days
    month_result = await db.execute(
        select(func.count(CalendarEvent.id)).where(
            and_(
                CalendarEvent.start_datetime >= today_start,
                CalendarEvent.start_datetime < month_end
            )
        )
    )
    month_count = month_result.scalar()

    # Court dates upcoming
    court_result = await db.execute(
        select(func.count(CalendarEvent.id)).where(
            and_(
                CalendarEvent.start_datetime >= today_start,
                CalendarEvent.event_type == EventType.COURT_DATE
            )
        )
    )
    court_count = court_result.scalar()

    # Deadlines upcoming
    deadline_result = await db.execute(
        select(func.count(CalendarEvent.id)).where(
            and_(
                CalendarEvent.start_datetime >= today_start,
                CalendarEvent.event_type == EventType.DEADLINE
            )
        )
    )
    deadline_count = deadline_result.scalar()

    return {
        "total": total,
        "today": today_count,
        "this_week": week_count,
        "next_30_days": month_count,
        "court_dates_upcoming": court_count,
        "deadlines_upcoming": deadline_count,
    }


@router.get("/today")
async def get_today_events(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """นัดหมายวันนี้"""
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)

    result = await db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.start_datetime >= today_start,
                CalendarEvent.start_datetime < today_end
            )
        ).order_by(CalendarEvent.start_datetime.asc())
    )
    events = result.scalars().all()

    events_data = []
    for ev in events:
        case_title = None
        case_number = None
        if ev.case_id:
            case_result = await db.execute(select(Case).where(Case.id == ev.case_id))
            case = case_result.scalar_one_or_none()
            if case:
                case_title = case.title
                case_number = case.case_number
        events_data.append(format_event(ev, case_title, case_number))

    return {"data": events_data, "total": len(events_data)}


@router.get("/upcoming")
async def get_upcoming_events(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """นัดหมายที่กำลังจะมาถึง"""
    now = datetime.utcnow()
    future = now + timedelta(days=days)

    result = await db.execute(
        select(CalendarEvent).where(
            and_(
                CalendarEvent.start_datetime >= now,
                CalendarEvent.start_datetime <= future
            )
        ).order_by(CalendarEvent.start_datetime.asc())
    )
    events = result.scalars().all()

    events_data = []
    for ev in events:
        case_title = None
        case_number = None
        if ev.case_id:
            case_result = await db.execute(select(Case).where(Case.id == ev.case_id))
            case = case_result.scalar_one_or_none()
            if case:
                case_title = case.title
                case_number = case.case_number
        events_data.append(format_event(ev, case_title, case_number))

    return {"data": events_data, "total": len(events_data)}


@router.get("/{event_id}")
async def get_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """ดูรายละเอียดนัดหมาย"""
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.id == uuid.UUID(event_id))
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="ไม่พบนัดหมายนี้")

    case_title = None
    case_number = None
    if ev.case_id:
        case_result = await db.execute(select(Case).where(Case.id == ev.case_id))
        case = case_result.scalar_one_or_none()
        if case:
            case_title = case.title
            case_number = case.case_number

    return {"data": format_event(ev, case_title, case_number)}


@router.post("/")
async def create_event(
    payload: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """สร้างนัดหมายใหม่"""
    # Map event_type string to Enum
    event_type_map = {
        "นัดศาล": EventType.COURT_DATE,
        "กำหนดส่งเอกสาร": EventType.DEADLINE,
        "นัดประชุม": EventType.MEETING,
        "นัดหมายลูกความ": EventType.APPOINTMENT,
        "เตือนความจำ": EventType.REMINDER,
        "นัดไต่สวน": EventType.HEARING,
    }
    event_type = event_type_map.get(payload.event_type, EventType.MEETING)

    # Validate case exists
    case_id = None
    if payload.case_id:
        case_result = await db.execute(
            select(Case).where(Case.id == uuid.UUID(payload.case_id))
        )
        case = case_result.scalar_one_or_none()
        if not case:
            raise HTTPException(status_code=404, detail="ไม่พบคดีที่ระบุ")
        case_id = case.id

    # current_user is a JWT payload dict with 'sub' = user_id string
    user_id_str = current_user.get("sub")
    user_uuid = uuid.UUID(user_id_str) if user_id_str else None

    event = CalendarEvent(
        title=payload.title,
        description=payload.description,
        event_type=event_type,
        start_datetime=payload.start_datetime,
        end_datetime=payload.end_datetime,
        all_day=payload.all_day,
        location=payload.location,
        reminder_minutes=payload.reminder_minutes,
        case_id=case_id,
        created_by=user_uuid,
        attendees=payload.attendees,
    )

    db.add(event)
    await db.commit()
    await db.refresh(event)

    return {"status": "success", "message": "สร้างนัดหมายสำเร็จ", "data": format_event(event)}


@router.put("/{event_id}")
async def update_event(
    event_id: str,
    payload: EventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """แก้ไขนัดหมาย"""
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.id == uuid.UUID(event_id))
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="ไม่พบนัดหมายนี้")

    event_type_map = {
        "นัดศาล": EventType.COURT_DATE,
        "กำหนดส่งเอกสาร": EventType.DEADLINE,
        "นัดประชุม": EventType.MEETING,
        "นัดหมายลูกความ": EventType.APPOINTMENT,
        "เตือนความจำ": EventType.REMINDER,
        "นัดไต่สวน": EventType.HEARING,
    }

    if payload.title is not None:
        ev.title = payload.title
    if payload.description is not None:
        ev.description = payload.description
    if payload.event_type is not None:
        ev.event_type = event_type_map.get(payload.event_type, ev.event_type)
    if payload.start_datetime is not None:
        ev.start_datetime = payload.start_datetime
    if payload.end_datetime is not None:
        ev.end_datetime = payload.end_datetime
    if payload.all_day is not None:
        ev.all_day = payload.all_day
    if payload.location is not None:
        ev.location = payload.location
    if payload.reminder_minutes is not None:
        ev.reminder_minutes = payload.reminder_minutes
    if payload.attendees is not None:
        ev.attendees = payload.attendees
    if payload.case_id is not None:
        case_result = await db.execute(
            select(Case).where(Case.id == uuid.UUID(payload.case_id))
        )
        case = case_result.scalar_one_or_none()
        if not case:
            raise HTTPException(status_code=404, detail="ไม่พบคดีที่ระบุ")
        ev.case_id = case.id

    await db.commit()
    await db.refresh(ev)
    return {"status": "success", "message": "แก้ไขนัดหมายสำเร็จ", "data": format_event(ev)}


@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """ลบนัดหมาย"""
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.id == uuid.UUID(event_id))
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="ไม่พบนัดหมายนี้")

    await db.delete(ev)
    await db.commit()
    return {"status": "success", "message": "ลบนัดหมายสำเร็จ"}
