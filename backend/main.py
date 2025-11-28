import os
import io
import json
import pandas as pd
import google.generativeai as genai
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pypdf import PdfReader

# 1. Configuración Inicial
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("⚠️ PELIGRO: No se encontró GEMINI_API_KEY en el archivo .env")

# Configurar Gemini
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.0-flash')

# 2. Inicializar la App
app = FastAPI(title="Nexus AI Engine", version="2.0.0")

# --- CONFIGURACIÓN DE CORS (PERMISOS) ---
# Esto permite que tu Frontend (puerto 3000) hable con el Backend (puerto 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS DE DATOS ---
class ExportRequest(BaseModel):
    data: dict
    filename: str

# --- FUNCIONES AUXILIARES ---
def extract_text_from_pdf(file_bytes):
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        raise Exception(f"Error leyendo PDF: {e}")

# --- ENDPOINTS ---

@app.get("/")
def read_root():
    return {"status": "online", "mode": "PDF Processing Ready"}

@app.post("/analyze-document")
async def analyze_document(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF")

    try:
        content = await file.read()
        pdf_text = extract_text_from_pdf(content)

        # Instrucción Maestra para la IA
        prompt = f"""
        Actúa como un experto analista de datos.
        Analiza el siguiente texto extraído de un documento PDF.
        
        TEXTO DEL DOCUMENTO:
        {pdf_text[:30000]} 

        INSTRUCCIONES:
        Extrae la información más relevante en formato JSON estricto.
        Si es una factura, busca fechas, montos y empresas.
        Si es un contrato, busca nombres y cláusulas.
        Si es un CV, busca experiencia y habilidades.
        Si es un examen o documento académico, extrae estructura, preguntas y respuestas.
        
        Responde SOLO con el JSON.
        """

        response = model.generate_content(prompt)
        
        # Limpieza de la respuesta para asegurar JSON válido
        cleaned_response = response.text.replace("```json", "").replace("```", "")
        start_idx = cleaned_response.find("{")
        end_idx = cleaned_response.rfind("}") + 1
        if start_idx != -1 and end_idx != -1:
             cleaned_response = cleaned_response[start_idx:end_idx]
        
        return {
            "filename": file.filename,
            "analysis": json.loads(cleaned_response)
        }

    except Exception as e:
        # En caso de error, devolvemos info útil
        return {"error": str(e)}

@app.post("/generate-excel")
def generate_excel(request: ExportRequest):
    """
    Generador de Excel Enterprise con formato automático.
    """
    output = io.BytesIO()
    
    # Usamos xlsxwriter como motor
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        workbook = writer.book
        
        # Estilos Profesionales
        header_format = workbook.add_format({
            'bold': True, 'text_wrap': True, 'valign': 'top',
            'fg_color': '#1F4E78', 'font_color': '#FFFFFF', 'border': 1
        })
        cell_format = workbook.add_format({
            'border': 1, 'valign': 'top', 'text_wrap': True
        })

        data = request.data
        
        # Función interna para formatear hojas
        def format_worksheet(df, sheet_name):
            df.to_excel(writer, sheet_name=sheet_name, index=False)
            worksheet = writer.sheets[sheet_name]
            for idx, col in enumerate(df.columns):
                # Auto-ajuste de ancho de columna
                max_len = max(df[col].astype(str).map(len).max(), len(str(col))) + 2
                worksheet.set_column(idx, idx, min(max_len, 60), cell_format)
                worksheet.write(0, idx, col, header_format)

        # Procesar cada clave del JSON como una pestaña
        for key, value in data.items():
            safe_name = key[:30].replace(":", "").replace("/", "-")
            if isinstance(value, list) and len(value) > 0:
                df = pd.DataFrame(value)
                format_worksheet(df, safe_name)
            elif isinstance(value, dict):
                df = pd.json_normalize(value)
                format_worksheet(df, safe_name)

        # Hoja Resumen
        simple_data = {k: v for k, v in data.items() if not isinstance(v, (list, dict))}
        if simple_data:
            df_resumen = pd.DataFrame([simple_data])
            format_worksheet(df_resumen, "RESUMEN_EJECUTIVO")

    output.seek(0)
    filename = request.filename.replace(".pdf", "_Analysis.xlsx")
    headers = {'Content-Disposition': f'attachment; filename="{filename}"'}
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
