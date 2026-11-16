'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import toast from 'react-hot-toast'
import {
  StickyNote,
  CheckSquare,
  Plus,
  Trash2,
  Pin,
  Copy,
  Check,
  X,
  Flame,
  ChevronUp,
  ChevronDown,
  Cloud,
  RefreshCw,
  Search,
  Sparkles,
  Minimize2,
  Maximize2
} from 'lucide-react'

export type StickyColor = 'yellow' | 'blue' | 'emerald' | 'purple' | 'rose'

export interface TodoItem {
  id: string
  text: string
  completed: boolean
  isUrgent: boolean
  createdAt: string
}

export interface StickyNoteItem {
  id: string
  title: string
  content: string
  color: StickyColor
  isPinned: boolean
  updatedAt: string
}

export interface UserStickyWorkspace {
  todos: TodoItem[]
  notes: StickyNoteItem[]
  updatedAt: number
}

const POSTIT_COLORS: Record<
  StickyColor,
  {
    name: string
    dot: string
    cardBg: string
    cardBorder: string
    headerBg: string
    titleText: string
    bodyText: string
    placeholder: string
  }
> = {
  yellow: {
    name: 'Sarı Post-it',
    dot: 'bg-amber-400',
    cardBg: 'bg-gradient-to-br from-amber-500/20 via-yellow-500/15 to-amber-900/20',
    cardBorder: 'border-amber-400/40 hover:border-amber-400/70',
    headerBg: 'bg-amber-500/15 border-b border-amber-400/25',
    titleText: 'text-amber-200',
    bodyText: 'text-amber-50/95',
    placeholder: 'placeholder-amber-300/40'
  },
  blue: {
    name: 'Mavi Post-it',
    dot: 'bg-sky-400',
    cardBg: 'bg-gradient-to-br from-sky-500/20 via-blue-500/15 to-sky-900/20',
    cardBorder: 'border-sky-400/40 hover:border-sky-400/70',
    headerBg: 'bg-sky-500/15 border-b border-sky-400/25',
    titleText: 'text-sky-200',
    bodyText: 'text-sky-50/95',
    placeholder: 'placeholder-sky-300/40'
  },
  emerald: {
    name: 'Yeşil Post-it',
    dot: 'bg-emerald-400',
    cardBg: 'bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-emerald-900/20',
    cardBorder: 'border-emerald-400/40 hover:border-emerald-400/70',
    headerBg: 'bg-emerald-500/15 border-b border-emerald-400/25',
    titleText: 'text-emerald-200',
    bodyText: 'text-emerald-50/95',
    placeholder: 'placeholder-emerald-300/40'
  },
  purple: {
    name: 'Mor Post-it',
    dot: 'bg-purple-400',
    cardBg: 'bg-gradient-to-br from-purple-500/20 via-indigo-500/15 to-purple-900/20',
    cardBorder: 'border-purple-400/40 hover:border-purple-400/70',
    headerBg: 'bg-purple-500/15 border-b border-purple-400/25',
    titleText: 'text-purple-200',
    bodyText: 'text-purple-50/95',
    placeholder: 'placeholder-purple-300/40'
  },
  rose: {
    name: 'Pembe Post-it',
    dot: 'bg-rose-400',
    cardBg: 'bg-gradient-to-br from-rose-500/20 via-pink-500/15 to-rose-900/20',
    cardBorder: 'border-rose-400/40 hover:border-rose-400/70',
    headerBg: 'bg-rose-500/15 border-b border-rose-400/25',
    titleText: 'text-rose-200',
    bodyText: 'text-rose-50/95',
    placeholder: 'placeholder-rose-300/40'
  }
}

function formatDateTimeShortTR(iso: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
}

export default function PersonalStickyNotesPopover() {
  const { user, profile } = useAuth()
  const userId = user?.id || profile?.id || null

  const [isOpen, setIsOpen] = useState(false)
  const [isPinnedWindow, setIsPinnedWindow] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [activeTab, setActiveTab] = useState<'todos' | 'notes'>('todos')

  const [todos, setTodos] = useState<TodoItem[]>([])
  const [notes, setNotes] = useState<StickyNoteItem[]>([])
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'loading'>('synced')

  // Yeni Yapılacak Ekleme State'leri
  const [newTodoText, setNewTodoText] = useState('')
  const [newTodoUrgent, setNewTodoUrgent] = useState(false)

  // Post-it Arama & Yeni Renk Seçimi
  const [noteSearch, setNoteSearch] = useState('')
  const [selectedNewColor, setSelectedNewColor] = useState<StickyColor>('yellow')
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null)

  const popoverRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitializedRef = useRef<boolean>(false)

  const getLocalKey = useCallback((uid: string) => `ctc_sticky_workspace_v1_${uid}`, [])

  // Buluttan ve Yerel Önbellekten Yükleme
  const loadWorkspace = useCallback(async (uid: string) => {
    setSyncStatus('loading')
    let localData: UserStickyWorkspace | null = null

    try {
      const raw = localStorage.getItem(getLocalKey(uid))
      if (raw) {
        localData = JSON.parse(raw)
      }
    } catch (e) {
      console.warn('Yerel notlar okunamadı:', e)
    }

    if (localData) {
      setTodos(Array.isArray(localData.todos) ? localData.todos : [])
      setNotes(Array.isArray(localData.notes) ? localData.notes : [])
    }

    try {
      const { data: authData } = await supabase.auth.getUser()
      const cloudWorkspace = authData?.user?.user_metadata?.sticky_notes_v1 as UserStickyWorkspace | undefined

      if (cloudWorkspace && typeof cloudWorkspace === 'object') {
        const cloudTime = Number(cloudWorkspace.updatedAt || 0)
        const localTime = Number(localData?.updatedAt || 0)

        if (!localData || cloudTime >= localTime) {
          const cTodos = Array.isArray(cloudWorkspace.todos) ? cloudWorkspace.todos : []
          const cNotes = Array.isArray(cloudWorkspace.notes) ? cloudWorkspace.notes : []
          setTodos(cTodos)
          setNotes(cNotes)
          try {
            localStorage.setItem(
              getLocalKey(uid),
              JSON.stringify({ todos: cTodos, notes: cNotes, updatedAt: cloudTime })
            )
          } catch {}
        } else if (localData && localTime > cloudTime) {
          // Yerel veri daha güncelse buluta gönder
          await supabase.auth.updateUser({
            data: { sticky_notes_v1: localData }
          })
        }
      } else if (!localData) {
        // İlk kez kullanan kullanıcı için örnek karşılama Post-it'i
        const welcomeNote: StickyNoteItem = {
          id: `note-welcome`,
          title: '📌 Kişisel Post-it & Not Defteriniz',
          content: 'Buraya önemli hesap numaralarını, telefonları, hatırlatmaları veya hızlı notlarınızı yazabilirsiniz.\n\nYazdığınız her şey otomatik kaydedilir ve tüm bilgisayarlarınızda senkronize görünür.',
          color: 'yellow',
          isPinned: true,
          updatedAt: new Date().toISOString()
        }
        setNotes([welcomeNote])
        setTodos([])
      }
    } catch (err) {
      console.warn('Bulut not senkronizasyonu kontrol edilemedi:', err)
    } finally {
      isInitializedRef.current = true
      setSyncStatus('synced')
    }
  }, [getLocalKey])

  useEffect(() => {
    if (!userId) {
      setTodos([])
      setNotes([])
      isInitializedRef.current = false
      return
    }
    loadWorkspace(userId)
  }, [userId, loadWorkspace])

  // Değişiklikleri hem anında localStorage'a hem de debounced olarak Supabase'e kaydet
  const persistWorkspace = useCallback(
    (nextTodos: TodoItem[], nextNotes: StickyNoteItem[]) => {
      if (!userId) return
      const payload: UserStickyWorkspace = {
        todos: nextTodos,
        notes: nextNotes,
        updatedAt: Date.now()
      }

      try {
        localStorage.setItem(getLocalKey(userId), JSON.stringify(payload))
      } catch (e) {
        console.warn('Yerel kayıt hatası:', e)
      }

      setSyncStatus('saving')
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        try {
          await supabase.auth.updateUser({
            data: { sticky_notes_v1: payload }
          })
          setSyncStatus('synced')
        } catch (err) {
          console.error('Notlar buluta kaydedilemedi:', err)
          setSyncStatus('synced')
        }
      }, 650)
    },
    [userId, getLocalKey]
  )

  // Sabitlenmemişse dışarı tıklandığında kapat
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isPinnedWindow) return
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, isPinnedWindow])

  // ============================================================================
  // YAPILACAKLAR (TO-DO) İŞLEMLERİ
  // ============================================================================
  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newTodoText.trim()
    if (!trimmed) return
    const newItem: TodoItem = {
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      completed: false,
      isUrgent: newTodoUrgent,
      createdAt: new Date().toISOString()
    }
    const updated = [newItem, ...todos]
    setTodos(updated)
    setNewTodoText('')
    setNewTodoUrgent(false)
    persistWorkspace(updated, notes)
  }

  const toggleTodoCompleted = (id: string) => {
    const updated = todos.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    // Tamamlanmayanlar üstte, tamamlananlar altta sıralansın
    const sorted = [
      ...updated.filter(t => !t.completed),
      ...updated.filter(t => t.completed)
    ]
    setTodos(sorted)
    persistWorkspace(sorted, notes)
  }

  const toggleTodoUrgent = (id: string) => {
    const updated = todos.map(t => (t.id === id ? { ...t, isUrgent: !t.isUrgent } : t))
    setTodos(updated)
    persistWorkspace(updated, notes)
  }

  const updateTodoText = (id: string, text: string) => {
    const updated = todos.map(t => (t.id === id ? { ...t, text } : t))
    setTodos(updated)
    persistWorkspace(updated, notes)
  }

  const moveTodoStep = (id: string, dir: 'up' | 'down') => {
    const idx = todos.findIndex(t => t.id === id)
    if (idx === -1) return
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= todos.length) return
    const copy = [...todos]
    const [moved] = copy.splice(idx, 1)
    copy.splice(targetIdx, 0, moved)
    setTodos(copy)
    persistWorkspace(copy, notes)
  }

  const deleteTodo = (id: string) => {
    const updated = todos.filter(t => t.id !== id)
    setTodos(updated)
    persistWorkspace(updated, notes)
  }

  const clearCompletedTodos = () => {
    const updated = todos.filter(t => !t.completed)
    setTodos(updated)
    persistWorkspace(updated, notes)
    toast.success('Tamamlanan maddeler temizlendi')
  }

  // ============================================================================
  // POST-IT NOT İŞLEMLERİ
  // ============================================================================
  const handleAddNote = () => {
    const newNote: StickyNoteItem = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: '',
      content: '',
      color: selectedNewColor,
      isPinned: false,
      updatedAt: new Date().toISOString()
    }
    const updated = [newNote, ...notes]
    setNotes(updated)
    persistWorkspace(todos, updated)
  }

  const updateNoteField = (id: string, field: 'title' | 'content' | 'color', value: string) => {
    const updated = notes.map(n =>
      n.id === id
        ? { ...n, [field]: value, updatedAt: new Date().toISOString() }
        : n
    )
    setNotes(updated)
    persistWorkspace(todos, updated)
  }

  const toggleNotePin = (id: string) => {
    const updated = notes.map(n =>
      n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: new Date().toISOString() } : n
    )
    const sorted = [
      ...updated.filter(n => n.isPinned),
      ...updated.filter(n => !n.isPinned)
    ]
    setNotes(sorted)
    persistWorkspace(todos, sorted)
  }

  const deleteNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id)
    setNotes(updated)
    persistWorkspace(todos, updated)
    toast.success('Post-it notu silindi')
  }

  const copyNoteToClipboard = (note: StickyNoteItem) => {
    const fullText = [note.title, note.content].filter(Boolean).join('\n')
    if (!fullText.trim()) {
      toast.error('Kopyalanacak metin yok')
      return
    }
    navigator.clipboard.writeText(fullText)
    setCopiedNoteId(note.id)
    toast.success('Not panoya kopyalandı')
    setTimeout(() => setCopiedNoteId(null), 1800)
  }

  const pendingTodosCount = todos.filter(t => !t.completed).length
  const completedTodosCount = todos.filter(t => t.completed).length
  const urgentPendingCount = todos.filter(t => !t.completed && t.isUrgent).length

  const filteredNotes = notes.filter(n => {
    if (!noteSearch.trim()) return true
    const q = noteSearch.toLowerCase()
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q)
    )
  })

  return (
    <div className="relative" ref={popoverRef}>
      {/* ÜST BAR POST-IT BUTONU */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev)
          setIsMinimized(false)
        }}
        className={`relative p-2 rounded-full transition-all cursor-pointer flex items-center justify-center group ${
          isOpen
            ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/50 shadow-lg shadow-amber-500/10'
            : 'text-amber-400/85 hover:text-amber-300 hover:bg-amber-500/10'
        }`}
        title="Kişisel Post-it Notlarım & Yapılacaklar Listesi"
      >
        <StickyNote size={18} className="transition-transform group-hover:scale-110" />

        {/* Bekleyen Yapılacak Sayısı Rozeti */}
        {pendingTodosCount > 0 ? (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-black flex items-center justify-center border border-[#070b14] shadow ${
              urgentPendingCount > 0
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-amber-400 text-slate-950'
            }`}
          >
            {pendingTodosCount}
          </span>
        ) : notes.length > 0 ? (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full border border-[#070b14]" />
        ) : null}
      </button>

      {/* ÜZERİNE AÇILAN POST-IT & YAPILACAKLAR PENCERESİ */}
      {isOpen && (
        <div
          className={`fixed sm:absolute right-2 sm:right-0 top-14 sm:top-12 w-[calc(100vw-16px)] sm:w-[410px] bg-[#0b1120]/95 backdrop-blur-xl border rounded-2xl shadow-2xl overflow-hidden z-[9999] transition-all duration-200 ${
            isPinnedWindow
              ? 'border-amber-400/60 ring-1 ring-amber-400/30 shadow-amber-950/50'
              : 'border-slate-700/90 shadow-black/80'
          }`}
        >
          {/* ÜST BAŞLIK ÇUBUĞU (POST-IT ŞERİDİ) */}
          <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-slate-900 px-3.5 py-2.5 border-b border-amber-500/25 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 shrink-0">
                <StickyNote size={15} />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-black text-white flex items-center gap-1.5 truncate">
                  <span>Post-it & Yapılacaklar</span>
                  {isPinnedWindow && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold">
                      Sabit
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-400 truncate">
                  {profile?.full_name || user?.email?.split('@')[0] || 'Kişisel Alan'} •{' '}
                  {syncStatus === 'saving' ? (
                    <span className="text-amber-300">Kaydediliyor...</span>
                  ) : syncStatus === 'loading' ? (
                    <span className="text-sky-300">Yükleniyor...</span>
                  ) : (
                    <span className="text-emerald-400 inline-flex items-center gap-0.5">
                      <Cloud size={10} /> Senkronize
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* SAĞ KONTROL İKONLARI: YENİLE, SABİTLE, KÜÇÜLT, KAPAT */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => userId && loadWorkspace(userId)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition cursor-pointer"
                title="Buluttan Yenile"
              >
                <RefreshCw size={13} className={syncStatus === 'loading' ? 'animate-spin text-amber-300' : ''} />
              </button>

              <button
                type="button"
                onClick={() => setIsPinnedWindow(prev => !prev)}
                className={`p-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 text-[10px] font-bold ${
                  isPinnedWindow
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/70'
                }`}
                title={
                  isPinnedWindow
                    ? 'Ekrana Sabitlendi (Sayfada işlem yaparken kapanmaz)'
                    : 'Pencereyi Ekrana Sabitle (Arka planda çalışırken açık kalsın)'
                }
              >
                <Pin size={13} className={isPinnedWindow ? 'fill-slate-950' : ''} />
              </button>

              <button
                type="button"
                onClick={() => setIsMinimized(prev => !prev)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition cursor-pointer"
                title={isMinimized ? 'Genişlet' : 'Küçült'}
              >
                {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-rose-500/80 transition cursor-pointer"
                title="Kapat"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* SEKME GEÇİŞ ÇUBUĞU: YAPILACAKLAR vs POST-IT NOTLARIM */}
              <div className="grid grid-cols-2 gap-1.5 p-2 bg-[#070b14] border-b border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setActiveTab('todos')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeTab === 'todos'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-950/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <CheckSquare size={14} />
                  <span>Yapılacaklar</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-extrabold ${
                      activeTab === 'todos'
                        ? 'bg-black/20 text-slate-950'
                        : pendingTodosCount > 0
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {pendingTodosCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('notes')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeTab === 'notes'
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md shadow-amber-950/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <StickyNote size={14} />
                  <span>Post-it Notlar</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-extrabold ${
                      activeTab === 'notes'
                        ? 'bg-black/20 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {notes.length}
                  </span>
                </button>
              </div>

              {/* ============================================================ */}
              {/* SEKME 1: YAPILACAKLAR LİSTESİ (TO-DO)                         */}
              {/* ============================================================ */}
              {activeTab === 'todos' ? (
                <div className="flex flex-col max-h-[460px]">
                  {/* Hızlı Madde Ekleme Formu */}
                  <form
                    onSubmit={handleAddTodo}
                    className="p-3 bg-[#090e1a] border-b border-slate-800/80 flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={newTodoText}
                      onChange={e => setNewTodoText(e.target.value)}
                      placeholder="Yapılacak bir iş yazıp Enter'a basın..."
                      className="flex-1 bg-[#0f172a] border border-slate-700/80 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setNewTodoUrgent(prev => !prev)}
                      className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 ${
                        newTodoUrgent
                          ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 shadow-sm shadow-rose-950'
                          : 'bg-[#0f172a] border-slate-700/80 text-slate-500 hover:text-rose-300'
                      }`}
                      title="Acil / Öncelikli İşaretle"
                    >
                      <Flame size={15} className={newTodoUrgent ? 'fill-rose-400' : ''} />
                    </button>
                    <button
                      type="submit"
                      className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-3 py-2 rounded-xl text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                      <Plus size={15} />
                      <span>Ekle</span>
                    </button>
                  </form>

                  {/* İlerleme Çubuğu (Varsa) */}
                  {todos.length > 0 && (
                    <div className="px-3.5 py-2 bg-[#070b14] border-b border-slate-800/60 flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                          <span>Tamamlanma Durumu</span>
                          <span className="text-amber-300 font-mono">
                            {completedTodosCount} / {todos.length} (%
                            {Math.round((completedTodosCount / todos.length) * 100)})
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
                            style={{ width: `${(completedTodosCount / todos.length) * 100}%` }}
                          />
                        </div>
                      </div>
                      {completedTodosCount > 0 && (
                        <button
                          type="button"
                          onClick={clearCompletedTodos}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 px-2 py-1 rounded-lg transition cursor-pointer shrink-0"
                        >
                          Bitenleri Sil ({completedTodosCount})
                        </button>
                      )}
                    </div>
                  )}

                  {/* Yapılacaklar Maddeleri */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-1.5">
                    {todos.length === 0 ? (
                      <div className="py-10 px-4 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300/70">
                          <CheckSquare size={26} />
                        </div>
                        <p className="text-xs font-bold text-slate-300">Yapılacaklar listeniz tertemiz!</p>
                        <p className="text-[11px] text-slate-500 max-w-[260px]">
                          Gün içinde unutmak istemediğiniz ödemeleri, aramaları veya işleri yukarıdan ekleyebilirsiniz.
                        </p>
                      </div>
                    ) : (
                      todos.map((item, idx) => (
                        <div
                          key={item.id}
                          className={`group flex items-start gap-2 p-2.5 rounded-xl border transition-all ${
                            item.completed
                              ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                              : item.isUrgent
                                ? 'bg-gradient-to-r from-rose-950/35 via-amber-950/20 to-slate-900/90 border-rose-500/40'
                                : 'bg-[#0f172a]/90 border-slate-800 hover:border-amber-500/40'
                          }`}
                        >
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleTodoCompleted(item.id)}
                            className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                              item.completed
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                                : item.isUrgent
                                  ? 'border-rose-400 hover:bg-rose-500/20'
                                  : 'border-amber-400/70 hover:bg-amber-400/20'
                            }`}
                            title={item.completed ? 'Tamamlandı işaretini kaldır' : 'Tamamlandı olarak işaretle'}
                          >
                            {item.completed && <Check size={11} strokeWidth={3.5} />}
                          </button>

                          {/* Düzenlenebilir Metin */}
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={item.text}
                              onChange={e => updateTodoText(item.id, e.target.value)}
                              className={`w-full bg-transparent text-xs focus:outline-none ${
                                item.completed
                                  ? 'line-through text-slate-500'
                                  : 'text-slate-100 font-medium'
                              }`}
                            />
                            {item.isUrgent && !item.completed && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-300 mt-0.5">
                                <Flame size={10} className="fill-rose-400" /> Acil / Öncelikli
                              </span>
                            )}
                          </div>

                          {/* Aksiyon Butonları (Acil, Yukarı/Aşağı, Sil) */}
                          <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleTodoUrgent(item.id)}
                              className={`p-1 rounded hover:bg-slate-800 transition cursor-pointer ${
                                item.isUrgent ? 'text-rose-400' : 'text-slate-500 hover:text-rose-300'
                              }`}
                              title="Acil İşareti"
                            >
                              <Flame size={12} className={item.isUrgent ? 'fill-rose-400' : ''} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveTodoStep(item.id, 'up')}
                              className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-20 hover:bg-slate-800 transition cursor-pointer"
                              title="Yukarı Taşı"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === todos.length - 1}
                              onClick={() => moveTodoStep(item.id, 'down')}
                              className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-20 hover:bg-slate-800 transition cursor-pointer"
                              title="Aşağı Taşı"
                            >
                              <ChevronDown size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTodo(item.id)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                              title="Sil"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* ============================================================ */
                /* SEKME 2: RENKLİ POST-IT NOTLARIM                             */
                /* ============================================================ */
                <div className="flex flex-col max-h-[460px]">
                  {/* Üst Post-it Kontrol & Yeni Ekleme Çubuğu */}
                  <div className="p-2.5 bg-[#090e1a] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                    {/* Arama */}
                    <div className="relative flex-1 min-w-[140px]">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={noteSearch}
                        onChange={e => setNoteSearch(e.target.value)}
                        placeholder="Notlarda ara..."
                        className="w-full bg-[#0f172a] border border-slate-700/80 focus:border-amber-400 rounded-xl pl-7 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                    </div>

                    {/* Renk Seçici Noktalar + Yeni Post-it Butonu */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 bg-[#0f172a] border border-slate-800 px-2 py-1 rounded-xl">
                        {(Object.keys(POSTIT_COLORS) as StickyColor[]).map(cKey => (
                          <button
                            key={cKey}
                            type="button"
                            onClick={() => setSelectedNewColor(cKey)}
                            className={`w-3.5 h-3.5 rounded-full transition-transform cursor-pointer ${POSTIT_COLORS[cKey].dot} ${
                              selectedNewColor === cKey
                                ? 'scale-125 ring-2 ring-white'
                                : 'opacity-60 hover:opacity-100'
                            }`}
                            title={POSTIT_COLORS[cKey].name}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleAddNote}
                        className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0 shadow-sm"
                      >
                        <Plus size={14} />
                        <span>Yeni Post-it</span>
                      </button>
                    </div>
                  </div>

                  {/* Post-it Kartları Listesi */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                    {filteredNotes.length === 0 ? (
                      <div className="py-10 px-4 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300/70">
                          <StickyNote size={26} />
                        </div>
                        <p className="text-xs font-bold text-slate-300">Henüz Post-it notu bulunmuyor</p>
                        <p className="text-[11px] text-slate-500 max-w-[260px]">
                          Sağ üstteki &ldquo;+ Yeni Post-it&rdquo; butonuna tıklayarak istediğiniz renkte yapışkan not açabilirsiniz.
                        </p>
                      </div>
                    ) : (
                      filteredNotes.map(note => {
                        const theme = POSTIT_COLORS[note.color] || POSTIT_COLORS.yellow
                        return (
                          <div
                            key={note.id}
                            className={`rounded-xl border transition-all shadow-md overflow-hidden ${theme.cardBg} ${theme.cardBorder}`}
                          >
                            {/* Post-it Kart Üst Şeridi */}
                            <div className={`px-3 py-1.5 flex items-center justify-between gap-2 ${theme.headerBg}`}>
                              <input
                                type="text"
                                value={note.title}
                                onChange={e => updateNoteField(note.id, 'title', e.target.value)}
                                placeholder="Not Başlığı..."
                                className={`flex-1 bg-transparent text-xs font-black focus:outline-none ${theme.titleText} ${theme.placeholder}`}
                              />

                              <div className="flex items-center gap-1 shrink-0">
                                {/* Mini Renk Değiştirici */}
                                <div className="flex items-center gap-1 mr-1">
                                  {(Object.keys(POSTIT_COLORS) as StickyColor[]).map(cKey => (
                                    <button
                                      key={cKey}
                                      type="button"
                                      onClick={() => updateNoteField(note.id, 'color', cKey)}
                                      className={`w-2.5 h-2.5 rounded-full transition-transform cursor-pointer ${POSTIT_COLORS[cKey].dot} ${
                                        note.color === cKey ? 'scale-125 ring-1 ring-white' : 'opacity-45 hover:opacity-100'
                                      }`}
                                      title={POSTIT_COLORS[cKey].name}
                                    />
                                  ))}
                                </div>

                                {/* En Üste İğnele */}
                                <button
                                  type="button"
                                  onClick={() => toggleNotePin(note.id)}
                                  className={`p-1 rounded transition cursor-pointer ${
                                    note.isPinned
                                      ? 'text-amber-300 bg-amber-400/20'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                  title={note.isPinned ? 'Sabitlemeyi Kaldır' : 'Bu Notu En Üste Sabitle'}
                                >
                                  <Pin size={12} className={note.isPinned ? 'fill-amber-300' : ''} />
                                </button>

                                {/* Panoya Kopyala */}
                                <button
                                  type="button"
                                  onClick={() => copyNoteToClipboard(note)}
                                  className="p-1 rounded text-slate-300 hover:text-white transition cursor-pointer"
                                  title="Notu Kopyala"
                                >
                                  {copiedNoteId === note.id ? (
                                    <Check size={12} className="text-emerald-400" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                </button>

                                {/* Notu Sil */}
                                <button
                                  type="button"
                                  onClick={() => deleteNote(note.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                  title="Notu Sil"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Post-it Not Gövdesi */}
                            <div className="p-3">
                              <textarea
                                rows={4}
                                value={note.content}
                                onChange={e => updateNoteField(note.id, 'content', e.target.value)}
                                placeholder="Notunuzu buraya yazın (otomatik kaydedilir)..."
                                className={`w-full bg-transparent text-xs leading-relaxed resize-y focus:outline-none ${theme.bodyText} ${theme.placeholder}`}
                              />
                              <div className="flex items-center justify-between text-[9px] text-slate-400/80 mt-1 pt-1 border-t border-white/5 font-mono">
                                <span>{note.isPinned ? '📌 Üste Sabitli' : '📝 Post-it'}</span>
                                <span>Son kayıt: {formatDateTimeShortTR(note.updatedAt)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
