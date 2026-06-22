import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from sqlalchemy import select
from app.models.models import SystemSetting

async def send_invoice_email(
    db, 
    recipient_email: str, 
    tenant_name: str, 
    plan_name: str, 
    amount: float, 
    billing_cycle: str, 
    end_date, 
    invoice_number: str
):
    # Query SMTP settings from DB
    result = await db.execute(select(SystemSetting))
    setting = result.scalars().first()
    if not setting:
        print("❌ No SMTP settings found in database")
        return False
    
    smtp_password = setting.smtp_password
    # Handle masked password fallback
    if not smtp_password or "••" in smtp_password:
        import os
        from app.core.config import settings
        smtp_password = os.getenv("MAIL_PASSWORD", settings.MAIL_PASSWORD)
        
    smtp_user = setting.smtp_user
    if not smtp_user:
        import os
        from app.core.config import settings
        smtp_user = os.getenv("MAIL_USERNAME", settings.MAIL_USERNAME)
        
    smtp_host = setting.smtp_host or "smtp.gmail.com"
    smtp_port = setting.smtp_port or 587

    if not smtp_user or not smtp_password:
        print("❌ SMTP credentials are not configured")
        return False

    # Format dates
    payment_date_str = datetime.now().strftime("%d/%m/%Y %H:%M")
    if end_date:
        if isinstance(end_date, datetime):
            end_date_str = end_date.strftime("%d/%m/%Y")
        else:
            end_date_str = str(end_date)
    else:
        end_date_str = "ไม่มีกำหนด (ตลอดชีพ)"

    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = f"Lawyer Tech ERP <{smtp_user}>"
        msg['To'] = recipient_email
        msg['Subject'] = f"ใบเสร็จรับเงิน/ยืนยันการทำรายการแพ็กเกจ {plan_name} - {tenant_name}"

        billing_cycle_text = "รายปี (Yearly)" if billing_cycle == "yearly" else "รายเดือน (Monthly)"
        
        # HTML template
        html = f"""
        <html>
        <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 40px; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 40px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #6366f1; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">Lawyer Tech <span style="color: #ffffff;">ERP</span></h1>
                    <p style="color: #94a3b8; font-size: 13px; margin-top: 5px;">ระบบบริหารงานสำนักงานกฎหมายครบวงจร</p>
                </div>
                
                <hr style="border: 0; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 30px 0;">
                
                <!-- Welcome -->
                <div style="margin-bottom: 25px;">
                    <h2 style="color: #ffffff; font-size: 20px; font-weight: 600; margin-bottom: 10px;">แจ้งยืนยันการชำระเงินและสมัครแพ็กเกจสำเร็จ</h2>
                    <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">เรียน ผู้ดูแลระบบสำนักงาน <strong>{tenant_name}</strong>,</p>
                    <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">ระบบได้ดำเนินการบันทึกธุรกรรม สิทธิ์การใช้งานระบบ และปรับปรุงสิทธิ์การใช้งานสำหรับสำนักงานของท่านเรียบร้อยแล้ว รายละเอียดมีดังนี้:</p>
                </div>
                
                <!-- Transaction Info Table -->
                <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                            <td style="color: #94a3b8; padding: 8px 0; font-weight: 500;">เลขที่ธุรกรรม / ใบเสร็จ:</td>
                            <td style="color: #ffffff; padding: 8px 0; text-align: right; font-family: monospace; font-weight: 600;">{invoice_number}</td>
                        </tr>
                        <tr>
                            <td style="color: #94a3b8; padding: 8px 0; font-weight: 500;">แพ็กเกจสมาชิก:</td>
                            <td style="color: #6366f1; padding: 8px 0; text-align: right; font-weight: 600;">{plan_name}</td>
                        </tr>
                        <tr>
                            <td style="color: #94a3b8; padding: 8px 0; font-weight: 500;">รอบการเรียกเก็บเงิน:</td>
                            <td style="color: #ffffff; padding: 8px 0; text-align: right;">{billing_cycle_text}</td>
                        </tr>
                        <tr>
                            <td style="color: #94a3b8; padding: 8px 0; font-weight: 500;">จำนวนเงินชำระแล้ว:</td>
                            <td style="color: #10b981; padding: 8px 0; text-align: right; font-weight: 700; font-size: 16px;">{amount:,.2f} บาท</td>
                        </tr>
                        <tr>
                            <td style="color: #94a3b8; padding: 8px 0; font-weight: 500;">วันที่ทำธุรกรรม:</td>
                            <td style="color: #ffffff; padding: 8px 0; text-align: right;">{payment_date_str}</td>
                        </tr>
                        <tr>
                            <td style="color: #94a3b8; padding: 8px 0; font-weight: 500;">วันที่หมดอายุแพ็กเกจ:</td>
                            <td style="color: #f59e0b; padding: 8px 0; text-align: right; font-weight: 600;">{end_date_str}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="margin-bottom: 30px;">
                    <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; text-align: center;">
                        * สิทธิ์การใช้งานระบบรวมถึงขีดจำกัดผู้ใช้และขนาดพื้นที่เก็บข้อมูลได้รับการปรับปรุงในระบบโดยอัตโนมัติเรียบร้อยแล้ว
                    </p>
                </div>
                
                <hr style="border: 0; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 30px 0;">
                
                <!-- Footer -->
                <div style="text-align: center; color: #64748b; font-size: 12px;">
                    <p style="margin: 5px 0;">© 2026 Lawyer Tech ERP Co., Ltd. สงวนลิขสิทธิ์</p>
                    <p style="margin: 5px 0;">หากท่านพบปัญหาหรือต้องการความช่วยเหลือเพิ่มเติม สามารถติดต่อ support@lawyertech.co.th</p>
                </div>
            </div>
        </body>
        </html>
        """

        msg.attach(MIMEText(html, 'html', 'utf-8'))

        # Connect and send
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, recipient_email, msg.as_string())
        server.quit()
        print(f"✅ Invoice email sent successfully to {recipient_email}")
        return True
    except Exception as e:
        print(f"❌ Error sending invoice email: {e}")
        return False
