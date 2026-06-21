"""Documents Routes — File Management, Templates, AI Drafting & Analysis"""

import os
import uuid
import pypdf
import io
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
import google.generativeai as genai
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema.output_parser import StrOutputParser

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Document, DocumentType, Client, Case
from app.core.config import settings

router = APIRouter()

# UPLOAD_DIR
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Helper function to get Gemini LLM
def get_llm():
    return ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        google_api_key=settings.GEMINI_API_KEY,
        temperature=0.3,
    )

# Document formatting helper
def format_document(doc: Document, client_name: str = None, case_title: str = None, case_number: str = None) -> dict:
    return {
        "id": str(doc.id),
        "file_name": doc.file_name,
        "original_name": doc.original_name,
        "file_type": doc.file_type.value if doc.file_type else None,
        "mime_type": doc.mime_type,
        "file_size": doc.file_size,
        "storage_url": doc.storage_url,
        "storage_key": doc.storage_key,
        "is_template": doc.is_template,
        "template_name": doc.template_name,
        "ai_summary": doc.ai_summary,
        "extracted_text": doc.extracted_text[:1000] + "..." if doc.extracted_text and len(doc.extracted_text) > 1000 else doc.extracted_text,
        "client_id": str(doc.client_id) if doc.client_id else None,
        "client_name": client_name,
        "case_id": str(doc.case_id) if doc.case_id else None,
        "case_title": case_title,
        "case_number": case_number,
        "uploaded_by_id": str(doc.uploaded_by_id) if doc.uploaded_by_id else None,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }

class DocumentUpdatePayload(BaseModel):
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    client_id: Optional[str] = None
    case_id: Optional[str] = None

class AIDraftPayload(BaseModel):
    template_type: str  # complaint, contract, power_of_attorney, demand_letter
    client_name: str
    case_details: str
    additional_info: Optional[str] = None
    client_id: Optional[str] = None
    case_id: Optional[str] = None


# ==========================================
# Endpoints
# ==========================================

@router.get("/")
async def list_documents(
    search: Optional[str] = Query(None),
    file_type: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    case_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """รายการเอกสารทั้งหมดพร้อมตัวกรอง"""
    query = select(Document)
    
    if search:
        query = query.where(
            or_(
                Document.file_name.ilike(f"%{search}%"),
                Document.original_name.ilike(f"%{search}%"),
                Document.ai_summary.ilike(f"%{search}%"),
            )
        )
    
    if file_type:
        query = query.where(Document.file_type == file_type)
        
    if client_id:
        query = query.where(Document.client_id == uuid.UUID(client_id))
        
    if case_id:
        query = query.where(Document.case_id == uuid.UUID(case_id))
        
    query = query.order_by(Document.created_at.desc())
    result = await db.execute(query)
    docs = result.scalars().all()
    
    docs_data = []
    for doc in docs:
        client_name = None
        case_title = None
        case_number = None
        
        if doc.client_id:
            client_res = await db.execute(select(Client).where(Client.id == doc.client_id))
            cl = client_res.scalar_one_or_none()
            if cl:
                client_name = cl.full_name
                
        if doc.case_id:
            case_res = await db.execute(select(Case).where(Case.id == doc.case_id))
            cs = case_res.scalar_one_or_none()
            if cs:
                case_title = cs.title
                case_number = cs.case_number
                
        docs_data.append(format_document(doc, client_name, case_title, case_number))
        
    return {"status": "success", "data": docs_data, "total": len(docs_data)}


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    file_type: str = Form("อื่นๆ"),
    client_id: Optional[str] = Form(None),
    case_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """อัปโหลดเอกสารใหม่และบันทึกลงระบบ"""
    # 1. Map type
    type_map = {
        "คำฟ้อง": DocumentType.COMPLAINT,
        "สัญญา": DocumentType.CONTRACT,
        "หนังสือมอบอำนาจ": DocumentType.POWER_OF_ATTORNEY,
        "หลักฐาน": DocumentType.EVIDENCE,
        "คำสั่งศาล": DocumentType.COURT_ORDER,
        "ใบแจ้งหนี้": DocumentType.INVOICE,
        "แม่แบบ": DocumentType.TEMPLATE,
        "อื่นๆ": DocumentType.OTHER
    }
    doc_type = type_map.get(file_type, DocumentType.OTHER)
    
    # 2. Save file locally
    file_id = uuid.uuid4()
    extension = os.path.splitext(file.filename)[1]
    safe_filename = f"{file_id}{extension}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
        
    # 3. Text Extraction (if PDF)
    extracted_text = ""
    if file.filename.lower().endswith('.pdf'):
        try:
            pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
        except Exception as e:
            print(f"Error extracting PDF text: {e}")
    elif file.filename.lower().endswith(('.txt', '.csv')):
        try:
            extracted_text = contents.decode("utf-8")
        except Exception:
            try:
                extracted_text = contents.decode("tis-620")
            except Exception:
                pass
                
    # 4. Save to Database
    user_id_str = current_user.get("sub")
    user_uuid = uuid.UUID(user_id_str) if user_id_str else None
    
    cl_id = uuid.UUID(client_id) if client_id and client_id != "null" and client_id != "undefined" else None
    cs_id = uuid.UUID(case_id) if case_id and case_id != "null" and case_id != "undefined" else None
    
    new_doc = Document(
        id=file_id,
        file_name=file.filename,
        original_name=file.filename,
        file_type=doc_type,
        mime_type=file.content_type,
        file_size=len(contents),
        storage_url=f"/uploads/{safe_filename}",
        storage_key=safe_filename,
        extracted_text=extracted_text,
        client_id=cl_id,
        case_id=cs_id,
        uploaded_by_id=user_uuid
    )
    
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)
    
    # Fetch details
    client_name = None
    case_title = None
    case_number = None
    if new_doc.client_id:
        c_res = await db.execute(select(Client).where(Client.id == new_doc.client_id))
        cl = c_res.scalar_one_or_none()
        if cl: client_name = cl.full_name
    if new_doc.case_id:
        cs_res = await db.execute(select(Case).where(Case.id == new_doc.case_id))
        cs = cs_res.scalar_one_or_none()
        if cs:
            case_title = cs.title
            case_number = cs.case_number
            
    return {
        "status": "success",
        "message": "อัปโหลดเอกสารสำเร็จ",
        "data": format_document(new_doc, client_name, case_title, case_number)
    }


@router.get("/templates")
async def list_templates(current_user=Depends(get_current_user)):
    """รายการแม่แบบเอกสารสำเร็จรูป"""
    return {
        "status": "success",
        "data": [
            {"id": "complaint", "name": "คำฟ้องคดีอาญา (หมิ่นประมาท/ทำร้ายร่างกาย)", "type": "complaint", "icon": "📋"},
            {"id": "contract", "name": "สัญญากู้ยืมเงิน/ค้ำประกัน", "type": "contract", "icon": "📝"},
            {"id": "power_of_attorney", "name": "หนังสือมอบอำนาจทั่วไป/ศาล", "type": "power_of_attorney", "icon": "📜"},
            {"id": "demand_letter", "name": "จดหมายทวงถามหนี้ (Notice)", "type": "demand_letter", "icon": "✉️"},
        ]
    }


@router.post("/draft")
async def draft_document_ai(
    payload: AIDraftPayload,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ร่างเอกสารกฎหมายด้วย AI และบันทึกเข้าระบบอัตโนมัติ"""
    try:
        llm = get_llm()
        
        type_titles = {
            "complaint": "คำฟ้องต่อศาล",
            "contract": "สัญญาทางกฎหมาย",
            "power_of_attorney": "หนังสือมอบอำนาจ",
            "demand_letter": "โนติสจดหมายทวงถาม"
        }
        doc_type_str = type_titles.get(payload.template_type, "เอกสารทางกฎหมาย")
        
        prompt_template = """คุณคือที่ปรึกษากฎหมายและทนายความผู้เชี่ยวชาญในประเทศไทย 
โปรดเขียนร่าง {doc_type_str} อย่างเป็นทางการในรูปแบบสมบูรณ์และถูกต้องตามประมวลกฎหมายไทยสำหรับกรณีต่อไปนี้:

ชื่อลูกความ/คู่สัญญาหลัก: {client_name}
รายละเอียดข้อเท็จจริงและเจตนารมณ์: {case_details}
ข้อกำหนดเพิ่มเติม: {additional_info}

**คำแนะนำในการจัดรูปแบบโครงสร้าง**:
1. ให้เขียนหัวข้อเรื่อง วันที่เขียน และสถานที่เขียนให้ชัดเจน
2. ระบุชื่อคู่สัญญา ฝ่ายโจทก์ หรือฝ่ายจำเลยให้ครบถ้วน
3. ข้อตกลง/รายละเอียดแห่งคดี แบ่งเป็นข้อๆ (ข้อ 1, ข้อ 2, ข้อ 3)
4. ส่วนท้ายของเอกสารสำหรับลงลายมือชื่อและพยาน
5. ตอบเป็นภาษาไทยทั้งหมดด้วยภาษาทางการและรัดกุมมากที่สุด"""

        prompt = ChatPromptTemplate.from_template(prompt_template)
        chain = prompt | llm | StrOutputParser()
        
        draft_text = await chain.ainvoke({
            "doc_type_str": doc_type_str,
            "client_name": payload.client_name,
            "case_details": payload.case_details,
            "additional_info": payload.additional_info or "ไม่มี"
        })
        
        # Save the draft to a local txt file in uploads
        file_id = uuid.uuid4()
        safe_filename = f"draft_{file_id}.txt"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(draft_text)
            
        # Map template type to DocumentType Enum
        type_mapping = {
            "complaint": DocumentType.COMPLAINT,
            "contract": DocumentType.CONTRACT,
            "power_of_attorney": DocumentType.POWER_OF_ATTORNEY,
            "demand_letter": DocumentType.OTHER
        }
        
        # Save metadata to db
        user_id_str = current_user.get("sub")
        user_uuid = uuid.UUID(user_id_str) if user_id_str else None
        
        cl_id = uuid.UUID(payload.client_id) if payload.client_id else None
        cs_id = uuid.UUID(payload.case_id) if payload.case_id else None
        
        new_doc = Document(
            id=file_id,
            file_name=f"ร่าง_{doc_type_str}_{payload.client_name}.txt",
            original_name=f"draft_{payload.template_type}.txt",
            file_type=type_mapping.get(payload.template_type, DocumentType.OTHER),
            mime_type="text/plain",
            file_size=len(draft_text.encode("utf-8")),
            storage_url=f"/uploads/{safe_filename}",
            storage_key=safe_filename,
            extracted_text=draft_text,
            ai_summary=f"ร่างเอกสาร {doc_type_str} สำหรับ {payload.client_name} สร้างโดย AI เมื่อ {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            client_id=cl_id,
            case_id=cs_id,
            uploaded_by_id=user_uuid
        )
        
        db.add(new_doc)
        await db.commit()
        await db.refresh(new_doc)
        
        return {
            "status": "success",
            "message": "ร่างเอกสารด้วย AI สำเร็จและบันทึกลงระบบแล้ว",
            "draft_content": draft_text,
            "document": format_document(new_doc, payload.client_name)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Drafting Error: {str(e)}")


@router.post("/{document_id}/analyze")
async def analyze_document_ai(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ให้ AI วิเคราะห์ ค้นหาจุดเสี่ยง หรือสรุปเนื้อหาสำคัญในเอกสาร"""
    result = await db.execute(
        select(Document).where(Document.id == uuid.UUID(document_id))
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารนี้ในระบบ")
        
    text_content = doc.extracted_text
    if not text_content or not text_content.strip():
        # Try reading file content
        file_path = os.path.join(UPLOAD_DIR, doc.storage_key)
        if os.path.exists(file_path):
            try:
                with open(file_path, "rb") as f:
                    content = f.read()
                if doc.file_name.lower().endswith('.pdf'):
                    pdf_reader = pypdf.PdfReader(io.BytesIO(content))
                    text_content = ""
                    for page in pdf_reader.pages:
                        t = page.extract_text()
                        if t: text_content += t + "\n"
                else:
                    text_content = content.decode("utf-8", errors="ignore")
                
                doc.extracted_text = text_content
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"ไม่สามารถอ่านเนื้อหาไฟล์เพื่อวิเคราะห์ได้: {e}")
        else:
            raise HTTPException(status_code=400, detail="ไม่พบเนื้อหาไฟล์ในระบบ")
            
    if not text_content or not text_content.strip():
        raise HTTPException(status_code=400, detail="เอกสารว่างเปล่า หรือไม่สามารถดึงข้อความมาวิเคราะห์ได้")
        
    try:
        llm = get_llm()
        
        prompt_template = """วิเคราะห์และสรุปเนื้อหาเอกสารทางกฎหมายต่อไปนี้อย่างเป็นมืออาชีพ:

{text}

โปรดให้วิเคราะห์แยกเป็นหัวข้อเหล่านี้ให้ครบถ้วนในภาษาไทย:
1. **ประเภทและเนื้อหาโดยสรุป**
2. **คู่กรณีและสาระสำคัญของภาระผูกพัน**
3. **กำหนดระยะเวลาและเดดไลน์สำคัญ** (ถ้ามี)
4. **จุดเสี่ยงทางกฎหมาย/ข้อเสียเปรียบ** ที่ทนายหรือลูกความควรระมัดระวังเป็นพิเศษ
5. **คำแนะนำเพิ่มเติมในการดำเนินการต่อไป**"""

        prompt = ChatPromptTemplate.from_template(prompt_template)
        chain = prompt | llm | StrOutputParser()
        
        # Limit text content to avoid context limit
        limited_text = text_content[:15000] if len(text_content) > 15000 else text_content
        
        summary = await chain.ainvoke({"text": limited_text})
        
        doc.ai_summary = summary
        await db.commit()
        await db.refresh(doc)
        
        return {
            "status": "success",
            "message": "วิเคราะห์เอกสารสำเร็จ",
            "ai_summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Analysis Error: {str(e)}")


@router.put("/{document_id}")
async def update_document(
    document_id: str,
    payload: DocumentUpdatePayload,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """แก้ไขข้อมูลเมทาดาต้าของเอกสาร"""
    result = await db.execute(
        select(Document).where(Document.id == uuid.UUID(document_id))
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารนี้")
        
    if payload.file_name is not None:
        doc.file_name = payload.file_name
        
    if payload.file_type is not None:
        type_map = {
            "คำฟ้อง": DocumentType.COMPLAINT,
            "สัญญา": DocumentType.CONTRACT,
            "หนังสือมอบอำนาจ": DocumentType.POWER_OF_ATTORNEY,
            "หลักฐาน": DocumentType.EVIDENCE,
            "คำสั่งศาล": DocumentType.COURT_ORDER,
            "ใบแจ้งหนี้": DocumentType.INVOICE,
            "แม่แบบ": DocumentType.TEMPLATE,
            "อื่นๆ": DocumentType.OTHER
        }
        doc.file_type = type_map.get(payload.file_type, doc.file_type)
        
    if payload.client_id is not None:
        if payload.client_id == "" or payload.client_id == "null":
            doc.client_id = None
        else:
            doc.client_id = uuid.UUID(payload.client_id)
            
    if payload.case_id is not None:
        if payload.case_id == "" or payload.case_id == "null":
            doc.case_id = None
        else:
            doc.case_id = uuid.UUID(payload.case_id)
            
    await db.commit()
    await db.refresh(doc)
    
    # Format details
    client_name = None
    case_title = None
    case_number = None
    if doc.client_id:
        c_res = await db.execute(select(Client).where(Client.id == doc.client_id))
        cl = c_res.scalar_one_or_none()
        if cl: client_name = cl.full_name
    if doc.case_id:
        cs_res = await db.execute(select(Case).where(Case.id == doc.case_id))
        cs = cs_res.scalar_one_or_none()
        if cs:
            case_title = cs.title
            case_number = cs.case_number
            
    return {
        "status": "success",
        "message": "แก้ไขข้อมูลสำเร็จ",
        "data": format_document(doc, client_name, case_title, case_number)
    }


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ลบเอกสารออกจากระบบและลบไฟล์จริงออกจากเซิร์ฟเวอร์"""
    result = await db.execute(
        select(Document).where(Document.id == uuid.UUID(document_id))
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารนี้")
        
    # Delete local file if exists
    file_path = os.path.join(UPLOAD_DIR, doc.storage_key)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Error removing local file: {e}")
            
    await db.delete(doc)
    await db.commit()
    
    return {"status": "success", "message": "ลบเอกสารออกจากระบบสำเร็จ"}
