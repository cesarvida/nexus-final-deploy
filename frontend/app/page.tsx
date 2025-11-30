"use client";

import { useState, useEffect } from "react";
import { 
  UploadCloud, FileText, CheckCircle2, Cpu, 
  LayoutDashboard, Settings, LogOut, Clock, Trash2, 
  Zap, Database, BookOpen, GraduationCap, AlertTriangle 
} from "lucide-react";

export default function Home() {
  // --- ESTADO PARA EVITAR ERROR DE HIDRATACIÓN ---
  const [isMounted, setIsMounted] = useState(false);

  const [activeTab, setActiveTab] = useState("dashboard"); 
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [serverStatus, setServerStatus] = useState("checking");

  // CAMBIA ESTO POR TU URL DE RENDER (IMPORTANTE)
  const API_URL = "https://nexus-backend-f7p1.onrender.com"; 

  // --- EFECTO DE MONTAJE (Solución al error #329) ---
  useEffect(() => {
    setIsMounted(true); // Esto confirma que ya estamos en el navegador
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/history`);
      const data = await res.json();
      if(Array.isArray(data)) setHistory(data);
    } catch (e) { console.error("Error historial"); }
  };

  const checkServer = async () => {
    try {
      const res = await fetch(`${API_URL}/`);
      if (res.ok) setServerStatus("online");
      else setServerStatus("offline");
    } catch (e) { setServerStatus("offline"); }
  };

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'settings') checkServer();
  }, [activeTab]);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/analyze-document`, { 
        method: "POST", 
        body: formData 
      });

      const textResponse = await response.text();
      let data;
      
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        throw new Error(`Error crítico del servidor. ¿Es el PDF demasiado grande?`);
      }

      if (!response.ok || data.error) {
        throw new Error(data.detail || data.error || "Error desconocido");
      }
      
      setResult(data);

    } catch (error: any) { 
        console.error("Error:", error);
        alert(`❌ OCURRIÓ UN ERROR: ${error.message}`); 
    } 
    finally { setLoading(false); }
  };

  const handleDownloadPDF = async () => {
    if (!result || !result.analysis) return;
    try {
      const response = await fetch(`${API_URL}/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: result.analysis, filename: result.filename }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (result.filename || "doc").replace(".pdf", "_ApuntesPRO.pdf");
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert("Error generando el PDF.");
      }
    } catch (error) { alert("Error de conexión al descargar PDF"); }
  };

  const handleClearHistory = async () => {
    if(!confirm("¿Estás seguro?")) return;
    try {
        await fetch(`${API_URL}/history`, { method: 'DELETE' });
        fetchHistory();
    } catch(e) { alert("Error borrando historial"); }
  }

  const handleDrag = (e: any) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === "dragenter" || e.type === "dragover"); };
  const handleDrop = (e: any) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]); };

  // --- RENDERIZADO CONDICIONAL (SI NO ESTÁ MONTADO, NO PINTA NADA) ---
  if (!isMounted) {
    return null; // Evita que el servidor pinte algo distinto al cliente
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-slate-900">
      
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col justify-between shadow-sm z-10">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-indigo-200 shadow-md">
                <BookOpen size={18} />
            </div>
            <span className="text-xl font-bold text-slate-800 tracking-tight">NEXUS EDU</span>
          </div>
          
          <nav className="space-y-2">
            <button onClick={() => setActiveTab("dashboard")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-gray-50'}`}>
              <LayoutDashboard size={20} /> Generar Apuntes
            </button>
            <button onClick={() => setActiveTab("history")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'history' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-gray-50'}`}>
              <Clock size={20} /> Mis Documentos
            </button>
            <button onClick={() => setActiveTab("settings")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-gray-50'}`}>
              <Settings size={20} /> Sistema
            </button>
          </nav>
        </div>
        <div className="p-6 border-t border-gray-100">
          <button className="flex items-center gap-2 text-slate-400 hover:text-red-500 text-sm font-medium transition-colors">
            <LogOut size={16} /> Salir
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-8 md:p-12 bg-slate-50/50">
        
        {activeTab === "dashboard" && (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                <GraduationCap className="text-indigo-600" size={32} />
                Generador de Apuntes IA
              </h1>
              <p className="text-slate-500">Sube temarios completos o libros (PDF). La IA generará una guía de estudio densa y estructurada.</p>
            </header>

            <div 
              className={`bg-white border-2 border-dashed rounded-2xl p-12 text-center transition-all ${dragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-400"}`}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            >
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <UploadCloud size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">{file ? file.name : "Arrastra tu Temario o Libro aquí"}</h3>
              <p className="text-slate-400 mb-6">{file ? "Listo para resumir" : "Acepta PDF. Sin límite de páginas."}</p>

              {!file ? (
                 <label className="inline-block px-6 py-3 bg-slate-900 text-white font-medium rounded-lg cursor-pointer hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
                   Buscar PDF
                   <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                 </label>
              ) : (
                <button onClick={handleUpload} disabled={loading} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 mx-auto">
                  {loading ? <Cpu className="animate-spin" /> : <Cpu />} {loading ? "ANALIZANDO A FONDO..." : "CREAR GUÍA DE ESTUDIO"}
                </button>
              )}
            </div>

            {result && result.analysis ? (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                <div className="border-b border-gray-100 p-6 flex justify-between items-center bg-indigo-50/30">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-green-500" />
                    <span className="font-semibold text-slate-700">Resumen Completado</span>
                  </div>
                  <button onClick={handleDownloadPDF} className="flex items-center gap-2 text-sm font-bold text-white bg-red-600 px-6 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-md shadow-red-200">
                    <FileText size={16} /> Descargar PDF PRO
                  </button>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Datos Detectados</h4>
                    <div className="space-y-3">
                        <div className="bg-slate-50 p-4 rounded-lg text-xs font-mono text-slate-600 max-h-60 overflow-y-auto">
                            <pre>
                              {JSON.stringify(
                                result.analysis?.temario ? result.analysis.temario[0] : result.analysis, 
                                null, 
                                2
                              ).substring(0, 400)}...
                            </pre>
                        </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-6 flex flex-col justify-center items-center text-center border border-slate-100">
                     <BookOpen size={48} className="text-slate-300 mb-4" />
                     <h3 className="font-bold text-slate-700 mb-2">Apuntes Listos para Imprimir</h3>
                     <p className="text-sm text-slate-500 mb-4">El PDF generado incluye portada, temario denso, definiciones y marca de agua.</p>
                  </div>
                </div>
              </div>
            ) : (
                result && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-4 text-red-700">
                        <AlertTriangle />
                        <div>
                            <p className="font-bold">Error en el análisis</p>
                            <p className="text-sm">La IA no devolvió un formato válido o hubo un error en el servidor. Inténtalo de nuevo.</p>
                        </div>
                    </div>
                )
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Mis Documentos</h1>
              <p className="text-slate-500">Historial de guías generadas.</p>
            </header>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase font-bold text-slate-400">
                  <tr>
                    <th className="p-4">ID</th>
                    <th className="p-4">Archivo</th>
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {history.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">No tienes apuntes guardados.</td></tr>
                  ) : history.map((item) => (
                    <tr key={item.id} className="hover:bg-indigo-50/50 transition-colors">
                      <td className="p-4 font-mono text-slate-400">#{item.id}</td>
                      <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                        <FileText size={16} className="text-indigo-500" /> {item.filename}
                      </td>
                      <td className="p-4">{item.date}</td>
                      <td className="p-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{item.summary}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Configuración</h1>
              <p className="text-slate-500">Estado del sistema Nexus Edu.</p>
            </header>

            <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Zap className="text-yellow-500" size={20}/> Estado del Motor
                    </h3>
                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg">
                        <span className="text-slate-600 font-medium">Backend Server</span>
                        <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${serverStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                            <span className="text-sm font-bold uppercase text-slate-700">
                                {serverStatus === 'online' ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Database className="text-indigo-500" size={20}/> Base de Datos
                    </h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-slate-700">Eliminar Historial</p>
                            <p className="text-sm text-slate-400">Borra todos los resúmenes de la memoria local.</p>
                        </div>
                        <button 
                            onClick={handleClearHistory}
                            className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 font-bold rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2"
                        >
                            <Trash2 size={16}/> Borrar Todo
                        </button>
                    </div>
                </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
