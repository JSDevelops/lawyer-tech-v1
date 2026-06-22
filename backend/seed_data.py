import asyncio
from datetime import datetime, date, timedelta
from sqlalchemy import select
from app.core.database import Base, engine, AsyncSessionLocal
from app.core.security import hash_password
from app.models.models import (
    User, UserRole, Client, Case, CaseCategory, CaseStatus,
    CalendarEvent, EventType, Invoice, InvoiceStatus,
    SubscriptionPlan, Tenant, TenantSubscription
)

async def seed():
    # 1. Create tables if they do not exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created/verified")

    async with AsyncSessionLocal() as session:
        # Seed Subscription Plans
        result = await session.execute(select(SubscriptionPlan))
        existing_plans = result.scalars().all()
        if not existing_plans:
            plans_data = [
                SubscriptionPlan(
                    name="Standard Plan",
                    price=1990.0,
                    max_users=10,
                    storage_limit_gb=10.0,
                    enable_ai=True,
                    enable_api_access=False
                ),
                SubscriptionPlan(
                    name="Premium Plan",
                    price=4990.0,
                    max_users=999,
                    storage_limit_gb=100.0,
                    enable_ai=True,
                    enable_api_access=True
                )
            ]
            for p in plans_data:
                session.add(p)
            await session.flush()
            print("🌱 2 Subscription Plans seeded")
        else:
            print("✨ Subscription Plans already exist")

        # Fetch standard plan
        result = await session.execute(select(SubscriptionPlan).where(SubscriptionPlan.name == "Standard Plan"))
        standard_plan = result.scalar_one_or_none()
        if not standard_plan:
            result = await session.execute(select(SubscriptionPlan))
            plans = result.scalars().all()
            if plans:
                standard_plan = plans[0]
            else:
                standard_plan = SubscriptionPlan(
                    name="Standard Plan",
                    price=1990.0,
                    max_users=10,
                    storage_limit_gb=10.0,
                    enable_ai=True,
                    enable_api_access=False
                )
                session.add(standard_plan)
                await session.flush()

        # Seed default Tenant
        result = await session.execute(select(Tenant).where(Tenant.subdomain == "demo"))
        tenant = result.scalar_one_or_none()
        if not tenant:
            tenant = Tenant(
                name="สำนักงานกฎหมาย เลเยอร์ เทค (สาขาหลัก)",
                subdomain="demo",
                status="active"
            )
            session.add(tenant)
            await session.flush()

            # Subscribe tenant to Standard Plan
            sub = TenantSubscription(
                tenant_id=tenant.id,
                plan_id=standard_plan.id,
                is_active=True
            )
            session.add(sub)
            await session.flush()
            print("🌱 Default Tenant 'demo' seeded with Standard Plan")
        else:
            print("✨ Default Tenant 'demo' already exists")
        # Check if admin user already exists
        result = await session.execute(select(User).where(User.email == "admin@lawyertech.co.th"))
        admin = result.scalar_one_or_none()
        if not admin:
            admin = User(
                email="admin@lawyertech.co.th",
                hashed_password=hash_password("password123"),
                full_name="ทนายไพศาล ยุติธรรม",
                phone="0812345678",
                role=UserRole.ADMIN,
                bar_number="12345/2560",
                specializations=["คดีอาญา", "คดีแพ่ง", "จัดการมรดก"],
                tenant_id=tenant.id
            )
            session.add(admin)
            await session.flush()
            print("🌱 Admin user seeded (admin@lawyertech.co.th / password123)")
        else:
            # Update existing admin to link to tenant if not set
            if not admin.tenant_id:
                admin.tenant_id = tenant.id
                await session.flush()
                print("🌱 Linked existing Admin user to Tenant 'demo'")
            else:
                print("✨ Admin user already exists and is linked to tenant")

            # Link all other untenanted users to default tenant
            u_result = await session.execute(select(User))
            all_users = u_result.scalars().all()
            linked_users = 0
            for u in all_users:
                if not u.tenant_id:
                    u.tenant_id = tenant.id
                    linked_users += 1
            if linked_users > 0:
                await session.flush()
                print(f"🌱 Linked {linked_users} existing untenanted users to Tenant 'demo'")

        # Seed Clients
        result = await session.execute(select(Client))
        existing_clients = result.scalars().all()
        if not existing_clients:
            clients_data = [
                Client(
                    client_code="CLT-A1B2C3D4",
                    full_name="นายสมชาย ใจดี",
                    id_card="1100123456789",
                    phone="0898765432",
                    email="somchai@email.com",
                    address="123/45 ถนนสีลม แขวงสุริยวงศ์ เขตบางรัก กรุงเทพฯ",
                    kyc_status="verified",
                    service_type="retainer",
                    tags=["VIP", "ลูกความประจำ"]
                ),
                Client(
                    client_code="CLT-E5F6G7H8",
                    full_name="นางสมหญิง รักดี",
                    id_card="1200987654321",
                    phone="0876543210",
                    email="somying@email.com",
                    address="56/7 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพฯ",
                    kyc_status="verified",
                    service_type="private",
                    tags=["ลูกความทั่วไป"]
                ),
                Client(
                    client_code="CLT-I9J0K1L2",
                    full_name="นายประชา มั่นคง",
                    id_card="3100555444332",
                    phone="0855556666",
                    email="pracha@email.com",
                    address="88 ถนนรัชดาภิเษก แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ",
                    kyc_status="pending",
                    service_type="private",
                    tags=["มีข้อสงสัยหนี้สิน"]
                ),
                Client(
                    client_code="CLT-M3N4O5P6",
                    full_name="นางสาวสุดา สวยงาม",
                    id_card="3120199988776",
                    phone="0866667777",
                    email="suda@email.com",
                    address="9/9 ถนนรามคำแหง แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ",
                    kyc_status="verified",
                    service_type="free",
                    tags=["ให้คำปรึกษาเบื้องต้น"]
                )
            ]
            for c in clients_data:
                session.add(c)
            await session.flush()
            print("🌱 4 Clients seeded")
        else:
            print("✨ Clients already exist")

        # Re-fetch clients to link them
        result = await session.execute(select(Client))
        clients = {c.full_name: c for c in result.scalars().all()}

        # Seed Cases
        result = await session.execute(select(Case))
        existing_cases = result.scalars().all()
        if not existing_cases:
            cases_data = [
                Case(
                    case_number="CAS-68001",
                    title="คดีกู้ยืมเงินไม่มีสัญญา",
                    description="ลูกหนี้กู้ยืมเงินไปจำนวน 500,000 บาท มีหลักฐานแชทไลน์แต่ไม่มีสัญญากู้ยืมเงินเป็นลายลักษณ์อักษร",
                    category=CaseCategory.CIVIL,
                    status=CaseStatus.ACTIVE,
                    priority="high",
                    court_name="ศาลแพ่งกรุงเทพใต้",
                    court_case_number="พ.123/2568",
                    court_date=date.today() + timedelta(days=1),
                    opened_at=date.today() - timedelta(days=19),
                    client_id=clients["นายสมชาย ใจดี"].id,
                    tenant_id=tenant.id
                ),
                Case(
                    case_number="CAS-68002",
                    title="พิพาทที่ดินพร้อมโฉนด",
                    description="ข้อพิพาทเรื่องแนวเขตที่ดินทับซ้อนกับเพื่อนบ้านฝั่งตะวันออก เนื้อที่พิพาทประมาณ 2 งาน",
                    category=CaseCategory.LAND,
                    status=CaseStatus.PENDING,
                    priority="medium",
                    court_name="ศาลจังหวัดนนทบุรี",
                    court_case_number="พ.456/2568",
                    court_date=date.today() + timedelta(days=30),
                    opened_at=date.today() - timedelta(days=15),
                    client_id=clients["นางสมหญิง รักดี"].id,
                    tenant_id=tenant.id
                ),
                Case(
                    case_number="CAS-68003",
                    title="จัดการมรดกที่ดิน 50 ไร่",
                    description="ทายาทร้องขอตั้งผู้จัดการมรดกของบิดาที่เสียชีวิต มีมรดกที่ดิน 50 ไร่และบัญชีเงินฝากธนาคาร",
                    category=CaseCategory.INHERITANCE,
                    status=CaseStatus.ACTIVE,
                    priority="medium",
                    court_name="ศาลเยาวชนและครอบครัวกลาง",
                    court_case_number="พ.789/2568",
                    court_date=date.today() + timedelta(days=5),
                    opened_at=date.today() - timedelta(days=10),
                    client_id=clients["นายประชา มั่นคง"].id,
                    tenant_id=tenant.id
                ),
                Case(
                    case_number="CAS-68004",
                    title="คดีรถชนอุบัติเหตุ พ.ร.บ.",
                    description="อุบัติเหตุรถจักรยานยนต์ชนคนเดินเท้า ได้รับบาดเจ็บสาหัส คู่กรณีไม่มีประกันภัยภาคสมัครใจ เรียกร้องค่าเสียหายตาม พ.ร.บ.",
                    category=CaseCategory.ACCIDENT,
                    status=CaseStatus.INTAKE,
                    priority="high",
                    court_name="ศาลตลิ่งชัน",
                    court_case_number="อ.987/2568",
                    court_date=date.today() + timedelta(days=3),
                    opened_at=date.today() - timedelta(days=5),
                    client_id=clients["นางสาวสุดา สวยงาม"].id,
                    tenant_id=tenant.id
                )
            ]
            for c in cases_data:
                session.add(c)
            await session.flush()
            print("🌱 4 Cases seeded")
        else:
            # Update existing cases to link to default tenant if not set
            linked_cases = 0
            for c in existing_cases:
                if not c.tenant_id:
                    c.tenant_id = tenant.id
                    linked_cases += 1
            if linked_cases > 0:
                await session.flush()
                print(f"🌱 Linked {linked_cases} existing untenanted cases to Tenant 'demo'")
            else:
                print("✨ Cases already exist and are linked to tenant")

        # Re-fetch cases to link events
        result = await session.execute(select(Case))
        cases = {c.case_number: c for c in result.scalars().all()}

        # Seed Calendar Events
        result = await session.execute(select(CalendarEvent))
        existing_events = result.scalars().all()
        if not existing_events:
            events_data = [
                CalendarEvent(
                    title="นัดศาลคดีสมชาย",
                    description="นัดสืบพยานโจทก์ปากเอก คดีกู้ยืมเงิน ศาลแพ่งกรุงเทพใต้",
                    event_type=EventType.COURT_DATE,
                    start_datetime=datetime.now() + timedelta(days=1), # tomorrow
                    end_datetime=datetime.now() + timedelta(days=1, hours=4),
                    case_id=cases["CAS-68001"].id,
                    created_by=admin.id
                ),
                CalendarEvent(
                    title="ส่งเอกสารอุทธรณ์",
                    description="กำหนดส่งคำอุทธรณ์ฉบับสมบูรณ์ ยื่นต่อศาลนนทบุรี",
                    event_type=EventType.DEADLINE,
                    start_datetime=datetime.now() + timedelta(days=2),
                    end_datetime=datetime.now() + timedelta(days=2, hours=1),
                    case_id=cases["CAS-68001"].id,
                    created_by=admin.id
                ),
                CalendarEvent(
                    title="นัดปรึกษาลูกความใหม่",
                    description="พบคุณสุดา ปรึกษาข้อเท็จจริงคดี พ.ร.บ. คืบหน้าการเจรจาไกล่เกลี่ย",
                    event_type=EventType.APPOINTMENT,
                    start_datetime=datetime.now() + timedelta(days=3),
                    end_datetime=datetime.now() + timedelta(days=3, hours=2),
                    case_id=cases["CAS-68004"].id,
                    created_by=admin.id
                ),
                CalendarEvent(
                    title="วันนัดไต่สวนมรดก",
                    description="ศาลเยาวชนและครอบครัวกลาง นัดไต่สวนคำร้องขอตั้งผู้จัดการมรดกคุณประชา",
                    event_type=EventType.HEARING,
                    start_datetime=datetime.now() + timedelta(days=5),
                    end_datetime=datetime.now() + timedelta(days=5, hours=3),
                    case_id=cases["CAS-68003"].id,
                    created_by=admin.id
                )
            ]
            for e in events_data:
                session.add(e)
            await session.flush()
            print("🌱 4 Calendar Events seeded")
        else:
            print("✨ Calendar Events already exist")

        # Seed Invoices
        result = await session.execute(select(Invoice))
        existing_invoices = result.scalars().all()
        if not existing_invoices:
            invoices_data = [
                Invoice(
                    invoice_number="INV-20260601",
                    status=InvoiceStatus.PAID,
                    subtotal=172897.20,
                    tax_rate=7.0,
                    tax_amount=12102.80,
                    total=185000.00,
                    due_date=date.today() - timedelta(days=10),
                    paid_at=datetime.now() - timedelta(days=5),
                    client_id=clients["นายสมชาย ใจดี"].id,
                    case_id=cases["CAS-68001"].id,
                    notes="ชำระค่าธรรมเนียมวิชาชีพเต็มจำนวน"
                ),
                Invoice(
                    invoice_number="INV-20260602",
                    status=InvoiceStatus.SENT,
                    subtotal=30000.0,
                    tax_rate=7.0,
                    tax_amount=2100.0,
                    total=32100.0,
                    due_date=date.today() + timedelta(days=30),
                    client_id=clients["นางสมหญิง รักดี"].id,
                    case_id=cases["CAS-68002"].id,
                    notes="มัดจำค่าว่าความงวดที่ 1"
                ),
                Invoice(
                    invoice_number="INV-20260603",
                    status=InvoiceStatus.OVERDUE,
                    subtotal=15000.0,
                    tax_rate=7.0,
                    tax_amount=1050.0,
                    total=16050.0,
                    due_date=date.today() - timedelta(days=5),
                    client_id=clients["นายประชา มั่นคง"].id,
                    case_id=cases["CAS-68003"].id,
                    notes="ค้างชำระค่าขอคัดถ่ายเอกสารราชการ"
                ),
                Invoice(
                    invoice_number="INV-20260604",
                    status=InvoiceStatus.DRAFT,
                    subtotal=10000.0,
                    tax_rate=7.0,
                    tax_amount=700.0,
                    total=10700.0,
                    due_date=date.today() + timedelta(days=15),
                    client_id=clients["นางสาวสุดา สวยงาม"].id,
                    case_id=cases["CAS-68004"].id,
                    notes="ร่างคำร้องขอประนีประนอมยอมความ"
                )
            ]
            for inv in invoices_data:
                session.add(inv)
            await session.flush()
            print("🌱 4 Invoices seeded")
        else:
            print("✨ Invoices already exist")

        await session.commit()
        print("🎉 Database seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
