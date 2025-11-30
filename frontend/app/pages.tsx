"use client";

import { useState, useEffect } from "react";
import { 
  UploadCloud, FileText, CheckCircle2, Cpu, 
  LayoutDashboard, Settings, LogOut, Clock, Trash2, 
  Zap, Database, BookOpen, GraduationCap, AlertTriangle 
} from "lucide-react";

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); 
  }, []);

  const [activeTab, setActiveTab] = useState("dashboard"); 
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [serverStatus, setServerStatus] = useState("checking");

  const API_URL = "https://nexus-backend-f7p1.onrender.com"; 

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
    if (isMounted && activeTab === 'history') fetchHistory();
    if (isMounted && activeTab === 'settings') checkServer();
  }, [activeTab, isMounted]);

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
        throw new Error("El servidor tardó demasiado. Intenta con un PDF más pequeño.");
      }

      if (data.error) throw new Error(data.detail);
      
      setResult(data);
    } catch (error: any) { 
        alert(`❌ ERROR: ${error.message}`); 
    } 
    finally { setLoading(false); }
  };

  const handleDownloadPDF = async () => {
    if (!result) return;
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
      } else { alert("Error PDF"); }
    } catch (error) { alert("Error red PDF"); }
  };

  const handleClearHistory = async () => {
    if(!confirm("¿Borrar?")) return;
    try {
        await fetch(`${API_URL}/history`, { method: 'DELETE' });
        fetchHistory();
    } catch(e) { alert("Error borrando"); }
  };

  const handleDrag = (e: any) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === "dragenter" || e.type === "dragover"); };
  const handleDrop = (e: any) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]); };

  // --- SOLUCIÓN DEL ERROR: Devolver un div vacío en lugar de null ---
  if (!isMounted) return <div />;

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-slate-900">
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col justify-between shadow-sm z-10">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-indigo-200 shadow-md"><BookOpen size={18} /></div>
            <span className="text-xl font-bold text-slate-800 tracking-tight">NEXUS EDU</span>
          </div>
          <nav className="space-y-2">
            <button onClick={() => setActiveTab("dashboard")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-gray-50'}`}><LayoutDashboard size={20} /> Generar Apuntes</button>
            <button onClick={() => setActiveTab("history")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'history' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-gray-50'}`}><Clock size={20} /> Mis Documentos</button>
            <button onClick={() => setActiveTab("settings")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-gray-50'}`}><Settings size={20} /> Sistema</button>
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-8 md:p-12 bg-slate-50/50">
        {activeTab === "dashboard" && (
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3"><GraduationCap className="text-indigo-600" size={32} /> Generador de Apuntes IA</h1>
              <p className="text-slate-500">Versión Pro: Sube libros completos sin límite.</p>
            </header>

            <div className={`bg-white border-2 border-dashed rounded-2xl p-12 text-center transition-all ${dragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-400"}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
              <UploadCloud className="mx-auto text-indigo-400 mb-6" size={48} />
              <h3 className="text-xl font-semibold mb-2">{file ? file.name : "Arrastra tu Temario o Libro"}</h3>
              <p className="text-slate-400 mb-6">Soporta PDF grandes. Modo Flash activado.</p>
              {!file ? (
                 <label className="inline-block px-6 py-3 bg-slate-900 text-white font-medium rounded-lg cursor-pointer hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
                   Buscar Archivo <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                 </label>
              ) : (
                <button onClick={handleUpload} disabled={loading} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 mx-auto">
                  {loading ? <Cpu className="animate-spin" /> : <Zap />} {loading ? "PROCESANDO..." : "GENERAR APUNTES"}
                </button>
              )}
            </div>

            {result && result.analysis && (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                <div className="border-b border-gray-100 p-6 flex justify-between items-center bg-indigo-50/30">
                  <div className="flex items-center gap-3"><CheckCircle2 className="text-green-500" /><span className="font-semibold text-slate-700">Completado</span></div>
                  <button onClick={handleDownloadPDF} className="flex items-center gap-2 text-sm font-bold text-white bg-red-600 px-6 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-md shadow-red-200"><FileText size={16} /> Descargar PDF</button>
                </div>
                <div className="p-8">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Vista Previa</h4>
                    <div className="bg-slate-50 p-4 rounded-lg text-xs font-mono text-slate-600 max-h-60 overflow-y-auto">
                        <pre>{JSON.stringify(result.analysis.temario?.[0] || result.analysis, null, 2).substring(0, 500)}...</pre>
                    </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold text-slate-900 mb-6">Historial</h1>
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase font-bold text-slate-400"><tr><th className="p-4">ID</th><th className="p-4">Archivo</th><th className="p-4">Fecha</th><th className="p-4">Resumen</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-indigo-50/50"><td className="p-4">#{item.id}</td><td className="p-4 font-bold text-slate-800">{item.filename}</td><td className="p-4">{item.date}</td><td className="p-4">{item.summary}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-3xl mx-auto animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold text-slate-900 mb-6">Sistema</h1>
            <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex justify-between items-center">
                    <div><h3 className="font-bold text-slate-800">Estado Backend</h3><p className="text-sm text-slate-400">{API_URL}</p></div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${serverStatus === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{serverStatus.toUpperCase()}</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex justify-between items-center">
                    <div><h3 className="font-bold text-slate-800">Datos Locales</h3><p className="text-sm text-slate-400">Borrar historial</p></div>
                    <button onClick={handleClearHistory} className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 font-bold rounded-lg hover:bg-red-100 flex items-center gap-2"><Trash2 size={16}/> Borrar</button>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}