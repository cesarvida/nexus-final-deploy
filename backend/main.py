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

# ReportLab para PDFs
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

# Usamos GEMINI 2.0 FLASH (Esencial para velocidad en bucles)
model = genai.GenerativeModel('gemini-2.0-flash')

def init_db():
    conn = sqlite3.connect('nexus.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS historial (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT, date TEXT, summary TEXT)''')
    conn.commit()
    conn.close()

init_db()

app = FastAPI(title="Nexus AI - Chunking Edition", version="10.0.0")
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
        for page in reader.pages:
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

# --- FUNCIÓN INTELIGENTE: PROCESAR POR TROZOS ---
def analyze_chunk(text_chunk, is_first_chunk=False):
    """
    Analiza una parte del texto. Si es la primera parte, intenta sacar título y asignatura.
    """
    contexto = "Extrae el TÍTULO y ASIGNATURA si aparecen." if is_first_chunk else "Céntrate solo en el temario de esta sección."
    
    prompt = f"""
    Actúa como Catedrático. Tu tarea es generar APUNTES EXTENSOS de este fragmento de texto.
    {contexto}
    
    FRAGMENTO DE TEXTO:
    {text_chunk}

    INSTRUCCIONES:
    1. Detecta los temas y subtemas de ESTE fragmento.
    2. Desarrolla explicaciones MUY DETALLADAS y DENSAS.
    3. NO RESUMAS. Expande la información.
    
    FORMATO JSON:
    {{
        {"\"titulo_documento\": \"...\", \"asignatura\": \"...\", " if is_first_chunk else ""}
        "temario": [
            {{
                "titulo_tema": "Título del Tema detectado",
                "subtemas": [
                    {{
                        "titulo": "Título del apartado",
                        "explicacion_densa": "Explicación larga (mínimo 100 palabras)...",
                        "conceptos_clave": ["A", "B"]
                    }}
                ]
            }}
        ]
    }}
    """
    
    # Configuración JSON Nativo
    generation_config = {"response_mime_type": "application/json"}
    
    try:
        response = model.generate_content(prompt, generation_config=generation_config)
        return json.loads(response.text)
    except Exception as e:
        print(f"⚠️ Error en un chunk: {e}")
        return {"temario": []} # Devolvemos vacío si falla un trozo para no romper todo

@app.post("/analyze-document")
async def analyze_document(file: UploadFile = File(...)):
    print(f"📥 Recibido: {file.filename}")

    try:
        content = await file.read()
        full_text = extract_text_from_pdf(content)

        if len(full_text) < 50:
            return {"error": True, "detail": "PDF vacío."}

        # --- ESTRATEGIA DE CHUNKING (DIVIDE Y VENCERÁS) ---
        # Dividimos el texto en bloques de 30.000 caracteres (aprox 10-15 páginas)
        # Esto evita que la IA se sature y corte la respuesta.
        chunk_size = 30000 
        chunks = [full_text[i:i+chunk_size] for i in range(0, len(full_text), chunk_size)]
        
        print(f"📚 El documento es grande. Dividido en {len(chunks)} partes.")
        
        master_data = {
            "titulo_documento": "Documento Procesado",
            "asignatura": "General",
            "temario": []
        }

        # Procesamos cada trozo secuencialmente
        for i, chunk in enumerate(chunks):
            print(f"⚡ Procesando parte {i+1}/{len(chunks)}...")
            
            # Solo pedimos metadatos (título) en el primer trozo
            chunk_result = analyze_chunk(chunk, is_first_chunk=(i==0))
            
            # Si es el primero, guardamos título y asignatura
            if i == 0:
                master_data["titulo_documento"] = chunk_result.get("titulo_documento", file.filename)
                master_data["asignatura"] = chunk_result.get("asignatura", "Materia")
            
            # Acumulamos el temario
            if "temario" in chunk_result:
                master_data["temario"].extend(chunk_result["temario"])

        print("✅ Análisis completo. Guardando...")

        # Guardar historial
        conn = sqlite3.connect('nexus.db')
        c = conn.cursor()
        c.execute("INSERT INTO historial (filename, date, summary) VALUES (?, ?, ?)", 
                  (file.filename, datetime.now().strftime("%Y-%m-%d"), master_data["titulo_documento"]))
        conn.commit()
        conn.close()
        
        return {"filename": file.filename, "analysis": master_data}

    except Exception as e:
        print(f"❌ ERROR SERVER: {e}")
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
        print(f"Error PDF: {e}")
        return {"error": str(e)}

# --- ENDPOINTS EXTRA ---
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
