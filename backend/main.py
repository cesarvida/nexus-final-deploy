import os
import io
import json
import sqlite3
import google.generativeai as genai
from datetime import datetime
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pypdf import PdfReader

# ReportLab
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Flowable, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER

# --- CONFIGURACIÓN ---
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key: print("⚠️ FALTA API KEY")

genai.configure(api_key=api_key)

# Usamos GEMINI 2.0 FLASH (Capaz de leer 1 millón de tokens de golpe)
model = genai.GenerativeModel('gemini-2.0-flash')

def init_db():
    conn = sqlite3.connect('nexus.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS historial (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT, date TEXT, summary TEXT)''')
    conn.commit()
    conn.close()

init_db()

app = FastAPI(title="Nexus AI - Turbo Mode", version="11.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExportRequest(BaseModel):
    data: dict
    filename: str

def extract_text_from_pdf(file_bytes):
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        # Limitamos a las primeras 100 páginas para evitar timeouts extremos en el plan gratuito
        # Si pagaras, podrías quitar este límite.
        for i, page in enumerate(reader.pages):
            if i > 100: break 
            t = page.extract_text()
            if t: text += t + "\n"
        return text
    except: return ""

class FinalWatermark(Flowable):
    def draw(self):
        canvas = self.canv
        canvas.saveState()
        canvas.setFont("Helvetica-Bold", 60)
        canvas.setFillColorRGB(0.8, 0.8, 0.8, 0.3)
        canvas.translate(A4[0]/2.0, A4[1]/2.0)
        canvas.rotate(45)
        canvas.drawCentredString(0, 0, "GENERADO POR NEXUS AI")
        canvas.restoreState()

@app.post("/analyze-document")
async def analyze_document(file: UploadFile = File(...)):
    print(f"📥 Recibido (Turbo Mode): {file.filename}")

    try:
        content = await file.read()
        pdf_text = extract_text_from_pdf(content)

        if len(pdf_text) < 50:
            return {"error": True, "detail": "PDF vacío o ilegible."}

        # --- ESTRATEGIA TURBO: ENVIAR TODO DE GOLPE ---
        # Gemini Flash aguanta hasta 1 millón de tokens (cientos de páginas).
        # Lo enviamos todo junto para que responda en una sola petición rápida.
        
        prompt = f"""
        Actúa como Catedrático. Genera unos APUNTES DE ESTUDIO COMPLETOS Y ESTRUCTURADOS.
        
        DOCUMENTO:
        {pdf_text[:800000]} 

        INSTRUCCIONES:
        1. Analiza el documento completo.
        2. Extrae los temas principales y subtemas.
        3. Para cada apartado, escribe una explicación detallada y pedagógica.
        
        FORMATO JSON (NO OLVIDES CERRARLO BIEN):
        {{
            "titulo_documento": "Título",
            "asignatura": "Materia",
            "temario": [
                {{
                    "titulo_tema": "1. Tema Principal",
                    "subtemas": [
                        {{
                            "titulo": "1.1 Subtema",
                            "explicacion_densa": "Explicación larga...",
                            "conceptos_clave": ["A", "B"]
                        }}
                    ]
                }}
            ]
        }}
        """
        
        # Seguridad desactivada
        safety = [{"category": cat, "threshold": "BLOCK_NONE"} for cat in ["HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"]]
        
        # Forzar JSON (Esto evita errores de sintaxis)
        generation_config = {"response_mime_type": "application/json"}

        # LLAMADA ÚNICA (Mucho más rápida que el bucle)
        response = model.generate_content(prompt, safety_settings=safety, generation_config=generation_config)
        
        data = json.loads(response.text)

        # Guardar historial
        conn = sqlite3.connect('nexus.db')
        c = conn.cursor()
        c.execute("INSERT INTO historial (filename, date, summary) VALUES (?, ?, ?)", 
                  (file.filename, datetime.now().strftime("%Y-%m-%d"), data.get("titulo_documento", "Doc")))
        conn.commit()
        conn.close()
        
        return {"filename": file.filename, "analysis": data}

    except Exception as e:
        print(f"❌ ERROR: {e}")
        return {"error": True, "detail": str(e)}

@app.post("/generate-pdf")
def generate_pdf(request: ExportRequest):
    try:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        
        styles = getSampleStyleSheet()
        style_normal = ParagraphStyle(name='Justify', parent=styles['Normal'], alignment=TA_JUSTIFY, fontSize=11, leading=14, spaceAfter=10)
        style_title = ParagraphStyle(name='MainTitle', parent=styles['Title'], fontSize=24, textColor=colors.darkblue, spaceAfter=20)
        style_h1 = ParagraphStyle(name='Heading1_Custom', parent=styles['Heading1'], fontSize=16, textColor=colors.darkblue, spaceBefore=15, spaceAfter=10, borderPadding=5, borderColor=colors.gray, borderWidth=0, borderBottomWidth=1)
        style_h2 = ParagraphStyle(name='Heading2_Custom', parent=styles['Heading2'], fontSize=13, textColor=colors.black, spaceBefore=10, spaceAfter=5)
        style_bullet = ParagraphStyle(name='Bullet', parent=styles['Normal'], fontSize=10, textColor=colors.darkgreen, leftIndent=20)

        story = []
        
        story.append(Paragraph(str(request.data.get("titulo_documento", "Apuntes")).upper(), style_title))
        story.append(Paragraph(f"ASIGNATURA: {str(request.data.get('asignatura', 'General')).upper()}", styles['Normal']))
        story.append(Spacer(1, 30))

        if "temario" in request.data:
            for tema in request.data["temario"]:
                story.append(Paragraph(str(tema.get("titulo_tema","Tema")), style_h1))
                for sub in tema.get("subtemas", []):
                    story.append(Paragraph(str(sub.get("titulo","Apartado")), style_h2))
                    texto = str(sub.get("explicacion_densa","")).replace("\n", "<br/>")
                    story.append(Paragraph(texto, style_normal))
                    if sub.get("conceptos_clave"):
                        story.append(Paragraph("<b>Conceptos Clave:</b>", style_normal))
                        for p in sub.get("conceptos_clave", []):
                            story.append(Paragraph(f"• {str(p)}", style_bullet))
                        story.append(Spacer(1, 10))
                story.append(Spacer(1, 15))

        story.append(PageBreak())
        story.append(FinalWatermark())

        doc.build(story)
        buffer.seek(0)
        return StreamingResponse(buffer, headers={'Content-Disposition': 'attachment; filename="Apuntes_Completos.pdf"'}, media_type='application/pdf')
    except Exception as e:
        return {"error": str(e)}

@app.get("/")
def read_root(): return {"status": "online"}

@app.get("/history")
def get_history():
    conn = sqlite3.connect('nexus.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM historial ORDER BY id DESC")
    return [dict(r) for r in c.fetchall()]

@app.delete("/history")
def clear_history():
    conn = sqlite3.connect('nexus.db')
    conn.execute("DELETE FROM historial")
    conn.commit()
    return {"status": "ok"}
