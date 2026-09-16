'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { Building2, Plus, Trash2, Edit3, Building, Home, Info, AlertTriangle, RefreshCw } from 'lucide-react'

type Company = { id: string; name: string; is_personal: boolean; created_at: string }

// Ortak Log Atma Fonksiyonu
async function logActivity(module: string, action: string, description: string, recordId: string | null = null, amount: number = 0, currency: string = '', oldData: any = null, newData: any = null, companyId: string | null = null) {
  try {
    await supabase.from('audit_logs').insert([{
      module, action, description, record_id: recordId, amount, currency, old_data: oldData, new_data: newData, company_id: companyId
    }])
  } catch (err) {
    console.error("Log kaydı atılamadı:", err)
  }
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [isPersonal, setIsPersonal] = useState(false)

  // Özel Onay Modalı State'i
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; confirmText: string; cancelText: string; isDanger: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmText: '', cancelText: '', isDanger: false, onConfirm: () => {} })

  useEffect(() => { fetchCompanies() }, [])

  async function fetchCompanies() {
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: true })
    setCompanies(data || [])
  }

  function openAddModal() { setEditingId(null); setName(''); setIsPersonal(false); setIsModalOpen(true) }
  function openEditModal(comp: Company) { setEditingId(comp.id); setName(comp.name); setIsPersonal(comp.is_personal); setIsModalOpen(true) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); if (!name.trim()) return
    const payload = { name: name.trim(), is_personal: isPersonal }
    
    try {
      if (editingId) {
        const oldCompany = companies.find(c => c.id === editingId)
        const { error } = await supabase.from('companies').update(payload).eq('id', editingId)
        if (error) throw error
        
        // LOG KAYDI
        await logActivity('company', 'UPDATE', `Merkez güncellendi: ${payload.name}`, editingId, 0, '', oldCompany, payload, editingId)
        
        toast.success('Masraf merkezi başarıyla güncellendi.')
      } else {
        const { data, error } = await supabase.from('companies').insert([payload]).select().single()
        if (error) throw error
        
        // LOG KAYDI
        await logActivity('company', 'INSERT', `Yeni merkez oluşturuldu: ${payload.name}`, data.id, 0, '', null, data, data.id)
        
        toast.success('Yeni masraf merkezi oluşturuldu.')
      }
      setIsModalOpen(false); fetchCompanies()
    } catch (err: any) { toast.error("Kaydedilemedi: " + err.message) }
  }

  function handleDelete(id: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Merkezi Sil',
      message: 'Bu merkezi silmek istediğinize emin misiniz? Eğer bu merkeze bağlı kasa, depo veya gider kaydı varsa sistem silmeye izin vermeyecektir.',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try { 
          const companyToDelete = companies.find(c => c.id === id)
          const { error } = await supabase.from('companies').delete().eq('id', id)
          if (error) throw error
          
          // LOG KAYDI
          await logActivity('company', 'DELETE', `Merkez silindi: ${companyToDelete?.name}`, id, 0, '', companyToDelete, null, id)
          
          toast.success('Merkez başarıyla silindi.')
          fetchCompanies() 
        } catch(err:any) { toast.error("Silinemedi! Bu merkeze bağlı hareketler/hesaplar bulunuyor.") }
      }
    })
  }

  const commercialCompanies = companies.filter(c => !c.is_personal)
  const personalCenters = companies.filter(c => c.is_personal)

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] relative">
      <Toaster position="top-right" toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px', zIndex: 99999 } }} />

      <div style={{ animation: 'fadeInDown 0.4s both' }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0d1322] border border-slate-800/80 p-4 rounded-xl shadow-md shrink-0 mb-4 transition-colors">
        <div className="flex items-center gap-3 text-white">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg"><Building2 size={24} /></div>
          <div><h2 className="font-bold text-lg leading-none">Şirketler & Masraf Merkezleri</h2><p className="text-[10px] text-slate-400 mt-1">Sistemdeki tüm işletmelerinizi ve şahsi varlık merkezlerinizi yönetin.</p></div>
        </div>
        <button onClick={openAddModal} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-900/20"><Plus size={16} /> Yeni Merkez Ekle</button>
      </div>

      <div style={{ animation: 'fadeInUp 0.4s both 0.1s' }} className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 flex items-center gap-3 shrink-0">
         <Info size={16} className="text-blue-400 shrink-0" />
         <p className="text-[11px] text-blue-200/80 leading-relaxed"><strong>Mimari Bilgi:</strong> Kasalar, Bankalar, Depolar ve Giderler burada oluşturduğunuz merkezlere bağlanır. Şirketler kendi aralarında karlılık hesabı tutarken, "Şahsi/Ev" olarak işaretlenen merkezler ticari kar-zarar hesaplarına dahil edilmez.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <div style={{ animation: 'fadeInUp 0.4s both 0.2s' }} className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col min-w-0 shadow-lg">
          <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] rounded-t-xl shrink-0"><span className="text-xs font-bold text-slate-300 flex items-center gap-2"><Building size={14} className="text-indigo-400" /> Ticari Şirketler & Departmanlar</span></div>
          <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-2">
             {commercialCompanies.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner mt-4">
                  <Building size={32} className="mb-3 opacity-70 text-indigo-400 animate-bounce" />
                  <p className="text-[11px] font-bold text-slate-400">Henüz ticari şirket eklenmemiş</p>
                  <p className="text-[9px] mt-1 text-slate-500">Sağ üstten yeni bir merkez ekleyebilirsiniz.</p>
                </div>
             ) : commercialCompanies.map((c, index) => (
                <div 
                  key={c.id} 
                  style={{ animation: 'fadeInUp 0.3s both', animationDelay: `${0.25 + (index * 0.05)}s` }}
                  className="flex items-center justify-between p-3 rounded-lg border bg-[#070b14] border-slate-800/50 hover:border-slate-700 transition-colors hover:-translate-y-0.5"
                >
                   <span className="font-bold text-slate-200 text-sm">{c.name}</span>
                   <div className="flex gap-2">
                     <button onClick={() => openEditModal(c)} className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded text-slate-400 hover:text-amber-400 transition-colors" title="Düzenle"><Edit3 size={14} /></button>
                     <button onClick={() => handleDelete(c.id)} className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded text-slate-400 hover:text-rose-400 transition-colors" title="Sil"><Trash2 size={14} /></button>
                   </div>
                </div>
             ))}
          </div>
        </div>

        <div style={{ animation: 'fadeInUp 0.4s both 0.3s' }} className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col min-w-0 shadow-lg">
          <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] rounded-t-xl shrink-0"><span className="text-xs font-bold text-slate-300 flex items-center gap-2"><Home size={14} className="text-slate-400" /> Şahsi / Ev Masraf Merkezleri</span></div>
          <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-2">
             {personalCenters.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner mt-4">
                  <Home size={32} className="mb-3 opacity-70 text-indigo-400 animate-bounce" />
                  <p className="text-[11px] font-bold text-slate-400">Henüz şahsi merkez eklenmemiş</p>
                  <p className="text-[9px] mt-1 text-slate-500">Sağ üstten yeni bir merkez ekleyebilirsiniz.</p>
                </div>
             ) : personalCenters.map((c, index) => (
                <div 
                  key={c.id} 
                  style={{ animation: 'fadeInUp 0.3s both', animationDelay: `${0.35 + (index * 0.05)}s` }}
                  className="flex items-center justify-between p-3 rounded-lg border bg-[#0f172a] border-slate-700/50 hover:border-slate-600 transition-colors hover:-translate-y-0.5"
                >
                   <span className="font-bold text-slate-300 text-sm">{c.name}</span>
                   <div className="flex gap-2">
                     <button onClick={() => openEditModal(c)} className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded text-slate-400 hover:text-amber-400 transition-colors" title="Düzenle"><Edit3 size={14} /></button>
                     <button onClick={() => handleDelete(c.id)} className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded text-slate-400 hover:text-rose-400 transition-colors" title="Sil"><Trash2 size={14} /></button>
                   </div>
                </div>
             ))}
          </div>
        </div>
      </div>

      {/* --- ÖZEL ONAY MODALI --- */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 ${confirmDialog.isDanger ? 'bg-rose-500/10 text-rose-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
              {confirmDialog.isDanger ? <AlertTriangle size={28} /> : <RefreshCw size={28} />}
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-[11px] text-slate-400 mb-6 leading-relaxed px-2">{confirmDialog.message}</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="flex-1 px-4 py-2.5 rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700 font-medium transition-colors text-xs">
                {confirmDialog.cancelText}
              </button>
              <button onClick={confirmDialog.onConfirm} className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold transition-all active:scale-95 text-xs shadow-lg ${confirmDialog.isDanger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20'}`}>
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MERKEZ EKLEME / DÜZENLEME MODALI --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Building2 size={16} className="text-indigo-500" /> {editingId ? 'Merkezi Düzenle' : 'Yeni Merkez Ekle'}</h3>
            <form onSubmit={handleSave} className="space-y-5 text-[11px]">
              <div>
                 <label className="block text-slate-400 mb-2 font-bold">Bu Merkez Ne Tür Bir Yapı? *</label>
                 <div className="flex flex-col gap-2">
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${!isPersonal ? 'bg-indigo-900/20 border-indigo-500 text-indigo-300' : 'bg-[#070b14] border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                      <input type="radio" checked={!isPersonal} onChange={() => setIsPersonal(false)} className="w-4 h-4 accent-indigo-500" />
                      <div className="flex flex-col"><span className="font-bold text-sm">Ticari Şirket / Departman</span><span className="text-[9px] opacity-70 mt-0.5">Kar-zarar raporlarına dahil edilir. (Örn: Reklam Ajansı)</span></div>
                    </label>
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${isPersonal ? 'bg-rose-900/20 border-rose-500 text-rose-300' : 'bg-[#070b14] border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                      <input type="radio" checked={isPersonal} onChange={() => setIsPersonal(true)} className="w-4 h-4 accent-rose-500" />
                      <div className="flex flex-col"><span className="font-bold text-sm">Şahsi / Ev Masraf Merkezi</span><span className="text-[9px] opacity-70 mt-0.5">Ticari karı etkilemez, sadece varlık düşer. (Örn: TR Ev)</span></div>
                    </label>
                 </div>
              </div>
              <div><label className="block text-slate-400 mb-1 font-bold">Merkez / Şirket Adı *</label><input type="text" required placeholder="İsim giriniz..." value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2.5 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors" /></div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors font-bold">İptal</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all active:scale-95 shadow-lg shadow-indigo-900/20">{editingId ? 'Güncelle' : 'Oluştur'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global CSS Animasyon Desteği */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}