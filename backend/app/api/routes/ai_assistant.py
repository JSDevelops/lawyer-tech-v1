"""AI Assistant Routes — Smart Legal Research, Case Summarization, Document Drafting"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel
from typing import Optional
import google.generativeai as genai
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema.output_parser import StrOutputParser
import io
import pypdf

from app.core.config import settings
from app.core.security import get_current_user

router = APIRouter()

# Configure Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)


# ==============================
# Pydantic Schemas
# ==============================

class LegalResearchRequest(BaseModel):
    question: str
    category: Optional[str] = None
    include_dika: bool = True


class SummarizeRequest(BaseModel):
    text: str
    output_format: str = "brief"  # brief, detailed, bullet


class DocumentDraftRequest(BaseModel):
    template_type: str  # complaint, contract, power_of_attorney
    client_name: str
    case_details: str
    additional_info: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[list] = []


# ==============================
# AI Helper Functions
# ==============================

def get_llm():
    return ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        google_api_key=settings.GEMINI_API_KEY,
        temperature=0.3,
    )


# ==============================
# API Endpoints
# ==============================

@router.post("/chat")
async def ai_chat(request: ChatRequest, current_user=Depends(get_current_user)):
    """🤖 AI Chat Assistant สำหรับทนายและลูกความ"""
    try:
        llm = get_llm()
        
        system_prompt = """คุณคือ AI ผู้ช่วยทางกฎหมายของ Lawyer Tech ERP
คุณช่วยทีมทนายความในการ:
1. วิเคราะห์ข้อเท็จจริงของคดี
2. ค้นหาและอ้างอิงกฎหมายที่เกี่ยวข้อง
3. สรุปเอกสารทางกฎหมาย
4. ร่างเอกสารเบื้องต้น
5. ให้คำแนะนำด้านกระบวนการทางกฎหมายไทย

ตอบเป็นภาษาไทย กระชับ ชัดเจน และเป็นมืออาชีพ"""

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{message}")
        ])
        
        chain = prompt | llm | StrOutputParser()
        response = chain.invoke({"message": request.message})
        
        return {
            "status": "success",
            "response": response,
            "model": "gemini-2.0-flash"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")


@router.post("/legal-research")
async def smart_legal_research(
    request: LegalResearchRequest,
    current_user=Depends(get_current_user)
):
    """🔎 Smart Legal Research — ค้นหากฎหมายและฎีกาที่เกี่ยวข้อง"""
    try:
        llm = get_llm()
        
        prompt_template = """คุณคือผู้เชี่ยวชาญกฎหมายไทย ค้นหาและวิเคราะห์:

คำถาม/ข้อเท็จจริง: {question}
หมวดคดี: {category}

กรุณาให้:
1. **สรุปกฎหมายที่เกี่ยวข้อง** — มาตราและพระราชบัญญัติที่เกี่ยวข้อง
2. **แนวฎีกา** — หลักคำวินิจฉัยที่เกี่ยวข้อง (ถ้ามี)
3. **การวิเคราะห์** — ความเป็นไปได้ทางกฎหมาย
4. **คำแนะนำ** — ขั้นตอนที่ควรดำเนินการ
5. **ข้อควรระวัง** — ความเสี่ยงและข้อจำกัด

ตอบเป็นภาษาไทย อ้างอิงกฎหมายไทยให้ถูกต้อง"""

        prompt = ChatPromptTemplate.from_template(prompt_template)
        chain = prompt | llm | StrOutputParser()
        
        result = chain.invoke({
            "question": request.question,
            "category": request.category or "ทั่วไป"
        })
        
        return {
            "status": "success",
            "research_result": result,
            "question": request.question,
            "category": request.category
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/summarize")
async def summarize_case(
    request: SummarizeRequest,
    current_user=Depends(get_current_user)
):
    """📝 Case Summarization — สรุปข้อเท็จจริงคดีเป็น 1 หน้า"""
    try:
        llm = get_llm()
        
        format_instructions = {
            "brief": "สรุปกระชับใน 3-5 ประโยค",
            "detailed": "สรุปอย่างละเอียด แบ่งเป็นหัวข้อ: ข้อเท็จจริง, ประเด็นทางกฎหมาย, สิ่งที่ต้องดำเนินการ",
            "bullet": "สรุปเป็น bullet points แยกหัวข้อชัดเจน"
        }
        
        prompt_template = """สรุปข้อเท็จจริงทางกฎหมายต่อไปนี้:

{text}

{format_instruction}

เน้น: ข้อเท็จจริงสำคัญ, ประเด็นทางกฎหมาย, สิทธิและหน้าที่ของคู่กรณี"""

        prompt = ChatPromptTemplate.from_template(prompt_template)
        chain = prompt | llm | StrOutputParser()
        
        result = chain.invoke({
            "text": request.text,
            "format_instruction": format_instructions.get(request.output_format, format_instructions["brief"])
        })
        
        return {
            "status": "success",
            "summary": result,
            "format": request.output_format,
            "original_length": len(request.text),
            "summary_length": len(result)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/summarize-pdf")
async def summarize_pdf(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    """📄 PDF Summarization — อัปโหลด PDF และให้ AI สรุป"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="รองรับเฉพาะไฟล์ PDF")
    
    try:
        contents = await file.read()
        pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
        
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="ไม่สามารถอ่านข้อความจาก PDF ได้")
        
        llm = get_llm()
        
        prompt_template = """สรุปเนื้อหาเอกสารทางกฎหมายต่อไปนี้เป็น 1 หน้า A4:

{text}

สรุปโดย:
1. ชื่อ/ประเภทเอกสาร
2. คู่กรณี (ถ้ามี)
3. ประเด็นหลักสำคัญ
4. ข้อกำหนด/เงื่อนไขสำคัญ
5. วันที่และกำหนดเวลาสำคัญ
6. ข้อควรระวัง"""

        prompt = ChatPromptTemplate.from_template(prompt_template)
        chain = prompt | llm | StrOutputParser()
        
        # ถ้าข้อความยาวเกินไป ใช้แค่ 10,000 ตัวอักษรแรก
        text_to_analyze = text[:10000] if len(text) > 10000 else text
        
        result = chain.invoke({"text": text_to_analyze})
        
        return {
            "status": "success",
            "filename": file.filename,
            "pages": len(pdf_reader.pages),
            "summary": result,
            "extracted_chars": len(text)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/draft-document")
async def draft_document(
    request: DocumentDraftRequest,
    current_user=Depends(get_current_user)
):
    """📃 Document Drafting — ร่างเอกสารทางกฎหมายด้วย AI"""
    try:
        llm = get_llm()
        
        templates = {
            "complaint": "คำฟ้องต่อศาล",
            "contract": "สัญญา",
            "power_of_attorney": "หนังสือมอบอำนาจ",
            "demand_letter": "จดหมายทวงถาม",
            "appeal": "อุทธรณ์",
        }
        
        doc_type = templates.get(request.template_type, request.template_type)
        
        prompt_template = """ร่าง{doc_type}สำหรับ:

ชื่อลูกความ: {client_name}
ข้อเท็จจริงคดี: {case_details}
ข้อมูลเพิ่มเติม: {additional_info}

กรุณาร่างเอกสารในรูปแบบทางการ ถูกต้องตามกฎหมายไทย มีหัวข้อและโครงสร้างที่เหมาะสม
หมายเหตุ: นี่เป็นเพียงร่างเบื้องต้น ทนายความต้องตรวจสอบและแก้ไขก่อนใช้งานจริง"""

        prompt = ChatPromptTemplate.from_template(prompt_template)
        chain = prompt | llm | StrOutputParser()
        
        result = chain.invoke({
            "doc_type": doc_type,
            "client_name": request.client_name,
            "case_details": request.case_details,
            "additional_info": request.additional_info or "-"
        })
        
        return {
            "status": "success",
            "document_type": doc_type,
            "client_name": request.client_name,
            "draft_content": result,
            "disclaimer": "เอกสารนี้เป็นเพียงร่างเบื้องต้น ต้องผ่านการตรวจสอบจากทนายความก่อนใช้งาน"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/categorize-case")
async def categorize_case(
    request: ChatRequest,
    current_user=Depends(get_current_user)
):
    """🏷️ จัดหมวดหมู่คดีอัตโนมัติด้วย AI"""
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        
        prompt = f"""จากข้อความต่อไปนี้ จัดหมวดหมู่คดีความให้ตรงที่สุด โดยเลือกจาก:
- คดีอาญา
- คดีแพ่ง  
- จัดการมรดก
- ที่ดิน
- คดี พ.ร.บ. และอุบัติเหตุ
- คดียึดทรัพย์
- คดีผิดสัญญา
- คดีครอบครัว
- คดีแรงงาน
- คดีธุรกิจ

ตอบเฉพาะชื่อหมวดหมู่เท่านั้น ไม่ต้องอธิบาย

ข้อความ: {request.message}"""

        response = model.generate_content(prompt)
        category = response.text.strip()
        
        return {
            "status": "success",
            "category": category,
            "input": request.message
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
