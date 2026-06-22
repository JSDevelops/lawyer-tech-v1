"""Database Models — All Tables for Lawyer Tech ERP"""

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text,
    DateTime, Date, Enum, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.core.database import Base


# ==============================
# Enums
# ==============================

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PARTNER = "partner"
    LAWYER = "lawyer"
    CLERK = "clerk"
    CLIENT = "client"


class CaseStatus(str, enum.Enum):
    INTAKE = "intake"           # รับเรื่องเบื้องต้น
    ACTIVE = "active"           # กำลังดำเนินคดี
    PENDING = "pending"         # รอการพิจารณา
    ON_HOLD = "on_hold"         # พักการดำเนินคดี
    CLOSED = "closed"           # ปิดคดี
    WON = "won"                 # ชนะคดี
    LOST = "lost"               # แพ้คดี
    SETTLED = "settled"         # ไกล่เกลี่ย


class CaseCategory(str, enum.Enum):
    CRIMINAL = "คดีอาญา"
    CIVIL = "คดีแพ่ง"
    INHERITANCE = "จัดการมรดก"
    LAND = "ที่ดิน"
    ACCIDENT = "คดี พ.ร.บ. และอุบัติเหตุ"
    SEIZURE = "คดียึดทรัพย์"
    CONTRACT = "คดีผิดสัญญา"
    FAMILY = "คดีครอบครัว"
    LABOR = "คดีแรงงาน"
    CORPORATE = "คดีธุรกิจ"


class DocumentType(str, enum.Enum):
    COMPLAINT = "คำฟ้อง"
    CONTRACT = "สัญญา"
    POWER_OF_ATTORNEY = "หนังสือมอบอำนาจ"
    EVIDENCE = "หลักฐาน"
    COURT_ORDER = "คำสั่งศาล"
    INVOICE = "ใบแจ้งหนี้"
    TEMPLATE = "แม่แบบ"
    OTHER = "อื่นๆ"


class EventType(str, enum.Enum):
    COURT_DATE = "นัดศาล"
    DEADLINE = "กำหนดส่งเอกสาร"
    MEETING = "นัดประชุม"
    APPOINTMENT = "นัดหมายลูกความ"
    REMINDER = "เตือนความจำ"
    HEARING = "นัดไต่สวน"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


# ==============================
# Models
# ==============================

class User(Base):
    """ผู้ใช้ระบบ: ทนาย, เสมียน, Partner, Admin"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20))
    avatar_url = Column(String(500))
    role = Column(Enum(UserRole), default=UserRole.CLERK, nullable=False)
    is_active = Column(Boolean, default=True)
    line_user_id = Column(String(100), index=True)
    bar_number = Column(String(50))  # เลขใบอนุญาตทนาย
    specializations = Column(JSON, default=list)  # ความเชี่ยวชาญ
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    assigned_cases = relationship("CaseTeamMember", back_populates="user")
    time_entries = relationship("TimeEntry", back_populates="user")
    calendar_events = relationship("CalendarEvent", back_populates="created_by_user")


class Client(Base):
    """ลูกความ (CRM)"""
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_code = Column(String(20), unique=True, index=True)  # รหัสลูกค้า
    full_name = Column(String(255), nullable=False)
    id_card = Column(String(13))  # เลขบัตรประชาชน
    phone = Column(String(20))
    email = Column(String(255))
    address = Column(Text)
    line_user_id = Column(String(100), index=True)
    line_id = Column(String(100))
    
    # KYC Fields
    kyc_status = Column(String(20), default="pending")  # pending, verified, rejected
    kyc_documents = Column(JSON, default=list)
    occupation = Column(String(200))
    company = Column(String(200))
    
    # Service Type
    service_type = Column(String(20), default="free")  # free, private, retainer
    
    # Tags & Notes
    tags = Column(JSON, default=list)
    notes = Column(Text)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    cases = relationship("Case", back_populates="client")
    documents = relationship("Document", back_populates="client")
    invoices = relationship("Invoice", back_populates="client")


class Case(Base):
    """คดี / Matter"""
    __tablename__ = "cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    case_number = Column(String(30), unique=True, index=True)  # เลขคดี
    title = Column(String(500), nullable=False)
    description = Column(Text)
    category = Column(Enum(CaseCategory), nullable=False)
    status = Column(Enum(CaseStatus), default=CaseStatus.INTAKE)
    priority = Column(String(10), default="medium")  # low, medium, high, urgent
    
    # Court Information
    court_name = Column(String(300))
    court_case_number = Column(String(100))  # เลขคดีศาล
    court_date = Column(Date)
    
    # Dates
    opened_at = Column(Date)
    closed_at = Column(Date)
    
    # AI Analysis
    ai_summary = Column(Text)
    ai_category_confidence = Column(Float)
    
    # Responsible Persons
    responsible_lawyer_name = Column(String(255))
    responsible_lawyer_phone = Column(String(20))
    responsible_lawyer_line = Column(String(100))
    responsible_clerk_name = Column(String(255))
    responsible_lawyers = Column(JSON, default=list)
    
    # Relations
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    client = relationship("Client", back_populates="cases")
    team_members = relationship("CaseTeamMember", back_populates="case")
    documents = relationship("Document", back_populates="case")
    calendar_events = relationship("CalendarEvent", back_populates="case")
    time_entries = relationship("TimeEntry", back_populates="case")
    invoices = relationship("Invoice", back_populates="case")


class CaseTeamMember(Base):
    """สมาชิกทีมในคดี"""
    __tablename__ = "case_team_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role_in_case = Column(String(100))  # lead_lawyer, associate, clerk
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("Case", back_populates="team_members")
    user = relationship("User", back_populates="assigned_cases")


class Document(Base):
    """เอกสารและไฟล์"""
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_name = Column(String(500), nullable=False)
    original_name = Column(String(500))
    file_type = Column(Enum(DocumentType), default=DocumentType.OTHER)
    mime_type = Column(String(100))
    file_size = Column(Integer)  # bytes
    storage_url = Column(String(1000))  # S3/GCS URL
    storage_key = Column(String(500))  # S3 key
    
    is_template = Column(Boolean, default=False)
    template_name = Column(String(200))
    
    # AI Features
    ai_summary = Column(Text)
    extracted_text = Column(Text)  # สำหรับ RAG
    
    # Relations
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"))
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"))
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("Client", back_populates="documents")
    case = relationship("Case", back_populates="documents")


class CalendarEvent(Base):
    """นัดหมาย, วันนัดศาล, Deadline"""
    __tablename__ = "calendar_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    event_type = Column(Enum(EventType), nullable=False)
    
    start_datetime = Column(DateTime(timezone=True), nullable=False)
    end_datetime = Column(DateTime(timezone=True))
    all_day = Column(Boolean, default=False)
    
    location = Column(String(500))
    is_reminder_sent = Column(Boolean, default=False)
    reminder_minutes = Column(Integer, default=60)  # แจ้งเตือนก่อนกี่นาที
    
    # Relations
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    attendees = Column(JSON, default=list)  # list of user IDs
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("Case", back_populates="calendar_events")
    created_by_user = relationship("User", back_populates="calendar_events")


class TimeEntry(Base):
    """บันทึกเวลา (Time Tracking)"""
    __tablename__ = "time_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    description = Column(String(500), nullable=False)
    hours = Column(Float, nullable=False)
    hourly_rate = Column(Float, default=1000.0)  # อัตราต่อชั่วโมง (บาท)
    date = Column(Date, nullable=False)
    is_billable = Column(Boolean, default=True)
    
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("Case", back_populates="time_entries")
    user = relationship("User", back_populates="time_entries")


class Invoice(Base):
    """ใบแจ้งหนี้ / Invoice"""
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String(30), unique=True, index=True)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    
    subtotal = Column(Float, default=0.0)
    tax_rate = Column(Float, default=7.0)  # VAT 7%
    tax_amount = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    
    due_date = Column(Date)
    paid_at = Column(DateTime(timezone=True))
    payment_slip_url = Column(String(1000))
    
    notes = Column(Text)
    
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    client = relationship("Client", back_populates="invoices")
    case = relationship("Case", back_populates="invoices")
    time_entries = relationship("TimeEntry")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")



class LegalReference(Base):
    """ฎีกา / กฎหมาย สำหรับ Vector Search"""
    __tablename__ = "legal_references"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dika_number = Column(String(50), index=True)  # เลขฎีกา
    title = Column(String(1000))
    content = Column(Text)
    category = Column(String(100))
    year = Column(Integer)
    court_level = Column(String(50))  # ศาลฎีกา, ศาลอุทธรณ์
    tags = Column(JSON, default=list)
    source_url = Column(String(500))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EmployeeAttendance(Base):
    """บันทึกเวลาทำงานของทนายและเจ้าหน้าที่"""
    __tablename__ = "employee_attendance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    check_in = Column(DateTime)
    check_out = Column(DateTime)
    status = Column(String(50), default="on_time")  # on_time, late, absent
    notes = Column(String(500))

    user = relationship("User")


class EmployeeLeave(Base):
    """การขออนุมัติลางาน"""
    __tablename__ = "employee_leaves"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    leave_type = Column(String(50), nullable=False)  # sick, personal, vacation
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(String(1000))
    status = Column(String(50), default="pending")  # pending, approved, rejected
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
    approver = relationship("User", foreign_keys=[approved_by])


class EmployeeSalary(Base):
    """เงินเดือนและรายการจ่ายเงินสำหรับทนายความและเสมียน"""
    __tablename__ = "employee_salaries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    base_salary = Column(Float, default=0.0)
    allowance = Column(Float, default=0.0)
    deductions = Column(Float, default=0.0)
    pay_period = Column(String(50), nullable=False)  # e.g., "2026-06"
    payment_status = Column(String(50), default="pending")  # pending, paid
    paid_at = Column(DateTime)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


class InvoiceItem(Base):
    """รายการย่อยในใบแจ้งหนี้ / Invoice Item"""
    __tablename__ = "invoice_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    description = Column(String(500), nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)

    invoice = relationship("Invoice", back_populates="items")


class ExpenseCategory(str, enum.Enum):
    COURT_FEE = "ค่าธรรมเนียมศาล"
    TRAVEL = "ค่าเดินทาง/พาหนะ"
    OFFICE_SUPPLIES = "อุปกรณ์สำนักงาน"
    UTILITIES = "ค่าน้ำ/ค่าไฟ/ค่าเน็ต"
    MARKETING = "ค่าโฆษณา/การตลาด"
    SALARY = "เงินเดือนพนักงาน"
    OTHER = "อื่นๆ"


class Expense(Base):
    """บันทึกค่าใช้จ่ายสำนักงาน (Expenses)"""
    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    description = Column(String(500), nullable=False)
    category = Column(Enum(ExpenseCategory), nullable=False, default=ExpenseCategory.OTHER)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)

    # Optional case association
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=True)
    logged_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    receipt_url = Column(String(1000), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("Case")
    user = relationship("User")


class FirmSetting(Base):
    """การตั้งค่าสำนักงานและระบบ (Firm & System Settings)"""
    __tablename__ = "firm_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_name = Column(String(255), default="สำนักงานกฎหมาย เลเยอร์ เทค")
    address = Column(Text, default="เลขที่ 123/45 ถนนราชดำเนิน แขวงพระนคร เขตพระนคร กรุงเทพมหานคร 10200")
    phone = Column(String(50), default="02-123-4567")
    tax_id = Column(String(50), default="0105563000000")
    default_tax_rate = Column(Float, default=7.0)
    logo_url = Column(String(500), default="https://picsum.photos/100/100")
    
    # System settings
    enable_ai_summary = Column(Boolean, default=True)
    enable_line_notify = Column(Boolean, default=True)
    default_case_priority = Column(String(10), default="medium")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Tenant(Base):
    """โมเดลข้อมูลสำนักงานกฎหมายที่เป็นสมาชิก (Tenants)"""
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    subdomain = Column(String(100), unique=True, index=True, nullable=True)
    status = Column(String(50), default="active") # active, suspended, trial_expired
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SubscriptionPlan(Base):
    """โมเดลแพ็กเกจการใช้งานระบบ (Subscription Plans)"""
    __tablename__ = "subscription_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    price = Column(Float, default=0.0)
    max_users = Column(Integer, default=3)
    storage_limit_gb = Column(Float, default=1.0)
    enable_ai = Column(Boolean, default=False)
    enable_api_access = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TenantSubscription(Base):
    """โมเดลการสมัครสมาชิกของ Tenant"""
    __tablename__ = "tenant_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=False)
    start_date = Column(DateTime(timezone=True), server_default=func.now())
    end_date = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)

    tenant = relationship("Tenant")
    plan = relationship("SubscriptionPlan")


class SystemSetting(Base):
    """การตั้งค่าระบบส่วนกลาง (SaaS Global Settings)"""
    __tablename__ = "system_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    smtp_host = Column(String(255), default="smtp.gmail.com")
    smtp_port = Column(Integer, default=587)
    smtp_user = Column(String(255), default="noreply@lawyertech.co.th")
    smtp_password = Column(String(255), default="••••••••")
    gemini_api_key_override = Column(String(255), default="")
    maintenance_mode = Column(Boolean, default=False)
    allow_new_registrations = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SystemAuditLog(Base):
    """บันทึกประวัติการทำงานของระบบหลังบ้าน (SaaS Audit Logs)"""
    __tablename__ = "system_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action = Column(String(255), nullable=False)
    details = Column(Text)
    performed_by_email = Column(String(255))
    ip_address = Column(String(50), default="127.0.0.1")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

