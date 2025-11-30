"use client";
import { useState, useEffect } from "react";
import { UploadCloud, FileText, CheckCircle2, LayoutDashboard, Settings, LogOut, Clock, Trash2, Zap, Database, BookOpen, GraduationCap, AlertTriangle, Cpu } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  
  const API_URL = "https://nexus-backend-xyz.onrender.com";

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/history`);
      const data = await res.json();
      if(Array.isArray(data)) setHistory(data);
    } catch (e) {}
  };

  useEffect(() => { if (activeTab === 'history') fetchHistory(); }, [activeTab]);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null); // Limpiar anterior
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/analyze-document`, { method: "POST", body: formData });
      
      // 🛡️ AQUÍ ESTÁ EL BLINDAJE ANTI-ERROR ROJO
      const text = await response.text();
      let data;
      try {
          data = JSON.parse(text);
      } catch(e) {
          throw new Error("El servidor falló (Timeout o Error 500). Intenta con un PDF más pequeño.");
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
    const res = await fetch(`${API_URL}/generate-pdf`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({data: result.analysis, filename: result.filename})
    });
    if(res.ok){
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "Apuntes_Nexus.pdf";
        document.body.appendChild(a); a.click(); a.remove();
    } else { alert("Error generando PDF"); }
  };

  const handleClear = async () => {
      if(confirm("¿Borrar historial?")) {
          await fetch(`${API_URL}/history`, { method: 'DELETE' });
          fetchHistory();
      }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-slate-900">
      <aside className="w-64 bg-white border-r hidden md:flex flex-col p-6 justify-between">
        <div>
            <div className="flex items-center gap-2 mb-10 text-indigo-700 font-bold text-xl"><BookOpen/> NEXUS EDU</div>
            <nav className="space-y-2">
                <button onClick={()=>setActiveTab("dashboard")} className={`w-full flex gap-3 p-3 rounded ${activeTab==='dashboard'?'bg-indigo-50 text-indigo-700':''}`}><LayoutDashboard size={20}/> Generar</button>
                <button onClick={()=>setActiveTab("history")} className={`w-full flex gap-3 p-3 rounded ${activeTab==='history'?'bg-indigo-50 text-indigo-700':''}`}><Clock size={20}/> Historial</button>
                <button onClick={()=>setActiveTab("settings")} className={`w-full flex gap-3 p-3 rounded ${activeTab==='settings'?'bg-indigo-50 text-indigo-700':''}`}><Settings size={20}/> Sistema</button>
            </nav>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">
        {activeTab === 'dashboard' && (
            <div className="max-w-4xl mx-auto space-y-8">
                <header><h1 className="text-3xl font-bold text-indigo-900">Generador de Apuntes</h1></header>
                
                <div className="bg-white border-2 border-dashed border-indigo-200 rounded-2xl p-12 text-center">
                    <UploadCloud className="mx-auto text-indigo-400 mb-4" size={48}/>
                    <h3 className="text-xl font-bold mb-2">{file ? file.name : "Sube tu PDF"}</h3>
                    <input type="file" onChange={(e)=>setFile(e.target.files?.[0]||null)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 mx-auto max-w-xs mb-4"/>
                    
                    {file && (
                        <button onClick={handleUpload} disabled={loading} className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 transition-all flex gap-2 mx-auto">
                            {loading ? <Cpu className="animate-spin"/> : <Zap/>} {loading ? "ANALIZANDO..." : "GENERAR APUNTES"}
                        </button>
                    )}
                </div>

                {result && (
                    <div className="bg-white border border-green-200 rounded-2xl p-8 shadow-lg animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2 text-green-600 font-bold"><CheckCircle2/> ¡Apuntes Listos!</div>
                            <button onClick={handleDownloadPDF} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 flex gap-2"><FileText size={18}/> Descargar PDF</button>
                        </div>
                        <div className="bg-slate-50 p-4 rounded text-xs font-mono max-h-40 overflow-auto border">
                            {JSON.stringify(result.analysis.temario?.[0] || result.analysis, null, 2)}
                        </div>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'history' && (
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">Historial</h1>
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 uppercase text-xs text-gray-500"><tr><th className="p-4">Archivo</th><th className="p-4">Fecha</th><th className="p-4">Tipo</th></tr></thead>
                        <tbody>
                            {history.map(h => (
                                <tr key={h.id} className="border-t"><td className="p-4 font-bold">{h.filename}</td><td className="p-4">{h.date}</td><td className="p-4">{h.summary}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'settings' && (
            <div className="max-w-xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">Sistema</h1>
                <div className="bg-white p-6 rounded-xl border flex justify-between items-center">
                    <div><h3 className="font-bold">Base de Datos</h3><p className="text-sm text-gray-500">Borrar historial local</p></div>
                    <button onClick={handleClear} className="text-red-600 border border-red-200 px-4 py-2 rounded hover:bg-red-50 flex gap-2"><Trash2 size={16}/> Borrar</button>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}
