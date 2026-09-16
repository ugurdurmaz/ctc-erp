'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { Briefcase, Plus, Trash2, X, Edit3, Search, Building, Home, Globe, AlertTriangle } from 'lucide-react'

type Company = { id: string; name: string; is_personal: boolean }
type ServiceItem = { id: string; name: string; unit_price: number; vat_rate: number; currency: 'TRY' | 'USD' | 'EUR'; company_id?: string | null; company?: { name: string; is_personal: boolean } }

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

export default function ServicesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [vatRate, setVatRate] = useState('20')
  const [currency, setCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [companyId, setCompanyId] = useState('common')

  // Özel Onay Modalı State'i
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; confirmText: string; cancelText: string; isDanger: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmText: '', cancelText: '', isDanger: false, onConfirm: () => {} })

  useEffect(() => { fetchCompanies(); fetchServices() }, [])

  async function fetchCompanies() { const { data } = await supabase.from('companies').select('*').order('name', { ascending: true }); setCompanies(data || []) }
  async function fetchServices() { const { data } = await supabase.from('services').select('*, company:companies(name, is_personal)').order('name', { ascending: true }); setServices(data || []) }

  function openAddModal() { setEditingId(null); setName(''); setUnitPrice(''); setVatRate('20'); setCurrency('TRY'); setCompanyId('common'); setIsModalOpen(true) }
  
  function openEditModal(srv: ServiceItem) {
    setEditingId(srv.id); setName(srv.name); setUnitPrice(srv.unit_price.toString()); setVatRate(srv.vat_rate?.toString() || '0'); setCurrency(srv.currency as any); setCompanyId(srv.company_id || 'common'); setIsModalOpen(true)
  }

  async function handleSaveService(e: React.FormEvent) {
    e.preventDefault()
    if (!name) return
    const finalCompId = companyId === 'common' ? null : companyId
    const payload = { name, unit_price: parseFloat(unitPrice) || 0, vat_rate: parseFloat(vatRate) || 0, currency, company_id: finalCompId }
    
    try {
      if (editingId) {
        const oldService = services.find(s => s.id === editingId)
        const { error } = await supabase.from('services').update(payload).eq('id', editingId)
        if (error) throw error
        
        await logActivity('service', 'UPDATE', `Hizmet kartı güncellendi: ${name}`, editingId, payload.unit_price, currency, oldService, payload, finalCompId)
        toast.success('Hizmet kartı güncellendi.')
      } else {
        const { data, error } = await supabase.from('services').insert([payload]).select().single()
        if (error) throw error
        
        await logActivity('service', 'INSERT', `Yeni hizmet kartı oluşturuldu: ${name}`, data.id, payload.unit_price, currency, null, data, finalCompId)
        toast.success('Yeni hizmet kartı oluşturuldu.')
      }
      setIsModalOpen(false); fetchServices()
    } catch (err: any) { toast.error('Kaydedilemedi: ' + err.message) }
  }

  async function handleDeleteService(id: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Hizmet Kartını Sil',
      message: 'Bu hizmet kartını silmek istediğinize emin misiniz? Eğer geçmişte kesilen bir faturaya bağlıysa silme işlemi reddedilebilir.',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const serviceToDelete = services.find(s => s.id === id)
          const { error } = await supabase.from('services').delete().eq('id', id)
          if (error) throw error
          
          await logActivity('service', 'DELETE', `Hizmet kartı silindi: ${serviceToDelete?.name}`, id, serviceToDelete?.unit_price, serviceToDelete?.currency || 'TRY', serviceToDelete, null, serviceToDelete?.company_id)
          
          toast.success('Hizmet kartı başarıyla silindi.')
          fetchServices()
        } catch (err: any) { 
          toast.error('Silme başarısız! Bu hizmet kartı geçmiş bir faturada kullanılmış olabilir.') 
        }
      }
    })
  }

  const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] relative">
      <Toaster position="top-right" toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px', zIndex: 99999 } }} />

      <div style={{ animation: 'fadeInDown 0.4s both' }} className="flex items-center justify-between gap-4 bg-[#0d1322] border border-slate-800/80 p-4 rounded-xl shadow-md shrink-0 mb-4 transition-colors">
        <div className="flex items-center gap-3 text-white"><div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg"><Briefcase size={24} /></div><div><h2 className="font-bold text-lg leading-none">Hizmet Kartları</h2><p className="text-[10px] text-slate-400 mt-1">Stok dışı hizmet ve operasyon bedellerinin yönetimi</p></div></div>
        <button onClick={openAddModal} className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-lg"><Plus size={16} /> Yeni Hizmet Kartı</button>
      </div>

      <div style={{ animation: 'fadeInUp 0.4s both 0.1s' }} className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col min-w-0 overflow-hidden shadow-lg">
        <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] shrink-0">
          <div className="relative max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="text" placeholder="Hizmet ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-colors" /></div>
        </div>
        <div className="overflow-y-auto flex-1 custom-scrollbar p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredServices.length === 0 ? (
               <div className="col-span-full flex flex-col items-center justify-center p-12 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner mt-4 mx-2">
                 <Briefcase size={36} className="mb-3 opacity-70 text-cyan-400 animate-bounce" />
                 <p className="text-sm font-bold text-slate-400">Kayıtlı hizmet kartı bulunamadı.</p>
                 <p className="text-[10px] mt-1 text-slate-500">Sağ üstten yeni bir hizmet kartı ekleyebilirsiniz.</p>
               </div>
            ) : filteredServices.map((srv, index) => {
              const priceWithVat = srv.unit_price * (1 + srv.vat_rate / 100)
              return (
                <div 
                  key={srv.id} 
                  style={{ animation: 'fadeInUp 0.3s both', animationDelay: `${0.15 + (index * 0.05)}s` }}
                  className="bg-[#070b14] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-cyan-500/30 transition-all hover:-translate-y-0.5 group shadow-inner"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-sm font-bold text-slate-200 leading-tight pr-2">{srv.name}</h3>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal(srv)} className="text-slate-500 hover:text-cyan-400 p-1 transition-colors"><Edit3 size={14}/></button>
                      <button onClick={() => handleDeleteService(srv.id)} className="text-slate-500 hover:text-rose-400 p-1 transition-colors"><Trash2 size={14}/></button>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1">
                      {srv.company ? (srv.company.is_personal ? <Home size={10} className="text-slate-400"/> : <Building size={10} className="text-cyan-400"/>) : <Globe size={10} className="text-emerald-500/70"/>}
                      {srv.company ? srv.company.name : 'Ortak Hizmet'}
                    </div>
                    <div className="flex items-end justify-between font-mono">
                      <div><div className="text-xs text-slate-400">Net: {formatMoney(srv.unit_price, srv.currency).formatted}</div><div className="text-[10px] text-slate-500 mt-0.5">KDV: %{srv.vat_rate}</div></div>
                      <div className="text-sm font-bold text-cyan-400">{formatMoney(priceWithVat, srv.currency).formatted}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* --- ÖZEL ONAY MODALI --- */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 ${confirmDialog.isDanger ? 'bg-rose-500/10 text-rose-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
              <AlertTriangle size={28} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-[11px] text-slate-400 mb-6 leading-relaxed px-2">{confirmDialog.message}</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="flex-1 px-4 py-2.5 rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700 font-medium transition-colors text-xs">
                {confirmDialog.cancelText}
              </button>
              <button onClick={confirmDialog.onConfirm} className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold transition-all active:scale-95 text-xs shadow-lg ${confirmDialog.isDanger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20' : 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-900/20'}`}>
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- HİZMET EKLEME / DÜZENLEME MODALI --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Briefcase size={16} className="text-cyan-500" /> {editingId ? 'Hizmet Kartını Düzenle' : 'Yeni Hizmet Kartı'}</h3>
            <form onSubmit={handleSaveService} className="space-y-3 text-[11px]">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Hizmet Sahibi / Merkez</label>
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500 transition-colors">
                   <option value="common">🌍 Ortak / Bağımsız Hizmet</option>
                   <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                   <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                </select>
              </div>
              <div><label className="block text-slate-400 mb-1">Hizmet Adı *</label><input type="text" required placeholder="Örn: Web Tasarım" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500 transition-colors" /></div>
              <div className="flex gap-2">
                <div className="flex-1"><label className="block text-slate-400 mb-1">Net Fiyat / Bedel</label><input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono" /></div>
                <div className="w-20"><label className="block text-slate-400 mb-1">Döviz</label><select value={currency} onChange={(e) => setCurrency(e.target.value as any)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-2 text-white focus:outline-none focus:border-cyan-500 transition-colors"><option value="TRY">₺</option><option value="USD">$</option><option value="EUR">€</option></select></div>
                <div className="w-20"><label className="block text-slate-400 mb-1">KDV (%)</label><select value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-2 text-white focus:outline-none focus:border-cyan-500 transition-colors"><option value="20">20</option><option value="10">10</option><option value="1">1</option><option value="0">0</option></select></div>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 rounded text-slate-400 hover:bg-slate-800 transition-colors">İptal</button>
                <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-1.5 rounded font-medium transition-all active:scale-95 shadow-lg shadow-cyan-900/20">Kaydet</button>
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