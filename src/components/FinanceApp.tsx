import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Wallet, 
  FileText, 
  Edit2, 
  Trash2, 
  Plus, 
  X, 
  AlertTriangle,
  Calendar,
  Loader2,
  RefreshCw,
  LogOut
} from 'lucide-react';

// --- API URL ---
const API_URL = 'https://script.google.com/macros/s/AKfycbwjA-bjz03XXd6YCjNOEx0UlaSEz5ojzZ_FUgF13Cqq-q3vR02gAR4uL7awiYGLsWyGaA/exec';

// --- Types ---
interface Transaction {
  id: string;
  tanggal: string; // Format: YYYY-MM-DD
  tipe: 'Pemasukan' | 'Pengeluaran';
  keterangan: string;
  pemasukan: number;
  pengeluaran: number;
  isIncluded: boolean;
  catatan?: string;
}

interface FinanceAppProps {
  onLogout?: () => void;
}

// --- Fallback Data (Jika API Gagal) ---
const fallbackData: Transaction[] = [
  { id: '1', tanggal: "2026-04-01", tipe: "Pemasukan", keterangan: "Kontribusi: Camat Sangkarrang", pemasukan: 2000000, pengeluaran: 0, isIncluded: true },
  { id: '2', tanggal: "2026-04-01", tipe: "Pemasukan", keterangan: "Kontribusi: Camat Tamalate", pemasukan: 1000000, pengeluaran: 0, isIncluded: true },
  { id: '3', tanggal: "2026-04-02", tipe: "Pengeluaran", keterangan: "Warkop Lakopi Hertasning", pemasukan: 0, pengeluaran: 825000, isIncluded: true },
  { id: '4', tanggal: "2026-04-03", tipe: "Pengeluaran", keterangan: "Warkop Turatea", pemasukan: 0, pengeluaran: 570900, isIncluded: true },
  { id: '5', tanggal: "2026-04-06", tipe: "Pengeluaran", keterangan: "Rumah Makan Kayu Bangkoa", pemasukan: 0, pengeluaran: 2125000, isIncluded: true },
  { id: '6', tanggal: "2026-04-10", tipe: "Pengeluaran", keterangan: "Benz Cafe Resto (Nanin)", pemasukan: 0, pengeluaran: 883000, isIncluded: false, catatan: "Tdk masuk list" },
];

// --- Helpers ---
const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatMonthLabel = (yyyyMM: string): string => {
  if (!yyyyMM) return 'Bulan Tidak Diketahui';
  if (yyyyMM === 'all') return 'Semua Bulan';
  try {
    const parts = yyyyMM.split('-');
    if (parts.length < 2) return yyyyMM;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    if (isNaN(year) || isNaN(month)) return yyyyMM;
    const date = new Date(year, month - 1);
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
  } catch (e) {
    return yyyyMM;
  }
};

const formatDateDisplay = (yyyyMMDD: string): string => {
  if (!yyyyMMDD) return '-';
  try {
    const date = new Date(yyyyMMDD);
    if (isNaN(date.getTime())) return yyyyMMDD;
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  } catch (e) {
    return yyyyMMDD;
  }
};

const parseDateFromAPI = (dateVal: any): string => {
  if (!dateVal) return '';
  try {
    if (typeof dateVal === 'string' && dateVal.includes('T')) {
      return dateVal.split('T')[0];
    }
    const d = new Date(dateVal);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return String(dateVal);
  }
};

// --- Main Component ---
export default function FinanceApp({ onLogout }: FinanceAppProps) {
  // State: Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);
  
  // State: Filters
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // Default to 'Semua Bulan'
  const [typeFilter, setTypeFilter] = useState<'All' | 'Pemasukan' | 'Pengeluaran'>('All');

  // State: Modal Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [formData, setFormData] = useState<Partial<Transaction & { nominal: string }>>({});
  const [formError, setFormError] = useState<string>('');

  // State: Delete Confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Refs for aborting requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Fetch Data on Mount ---
  useEffect(() => {
    fetchTransactions();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchTransactions = async () => {
    setIsLoading(true);
    setGlobalError(null);
    setIsUsingFallback(false);
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Fail-safe timeout to ensure loading spinner doesn't get stuck forever
    const safetyTimeout = setTimeout(() => {
      if (isLoading) {
        handleCancelLoading("Koneksi timeout. Menggunakan data simulasi.");
      }
    }, 15000);

    try {
      const response = await fetch(API_URL, { 
        signal: controller.signal,
        redirect: 'follow'
      });
      
      const text = await response.text();
      
      try {
        const json = JSON.parse(text);
        if (json.status === 'success' && Array.isArray(json.data)) {
          const formattedData: Transaction[] = json.data.map((item: any, index: number) => ({
            id: item.id || `TRX-${index}-${Date.now()}`,
            tanggal: parseDateFromAPI(item.tanggal) || new Date().toISOString().split('T')[0],
            tipe: item.tipe === 'Pemasukan' || item.tipe === 'Pengeluaran' ? item.tipe : 'Pengeluaran',
            keterangan: item.keterangan || 'Tanpa Keterangan',
            pemasukan: Number(item.pemasukan) || 0,
            pengeluaran: Number(item.pengeluaran) || 0,
            isIncluded: item.isIncluded === true || item.isIncluded === 'true' || item.isIncluded === 'TRUE',
            catatan: item.catatan || ''
          }));
          setTransactions(formattedData);
        } else {
          throw new Error(json.message || "Format data tidak valid");
        }
      } catch (parseError) {
        console.error("Parse error:", text);
        throw new Error("Gagal membaca data dari server. Pastikan Apps Script di-deploy dengan akses 'Anyone'.");
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted');
        return; // Handled by handleCancelLoading
      }
      console.error("Error fetching data:", error);
      const errorMsg = error.message || "Gagal terhubung ke server.";
      
      setGlobalError(errorMsg);
      setTransactions(fallbackData);
      setIsUsingFallback(true);
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelLoading = (customMessage?: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    setIsUsingFallback(true);
    setTransactions(fallbackData);
    setGlobalError(customMessage || "Koneksi dibatalkan oleh pengguna. Menggunakan data simulasi.");
  };

  // --- Derived Data (useMemo) ---
  
  // 1. Get unique months for dropdown
  const availableMonths = useMemo(() => {
    const months = new Set(
      transactions
        .map(t => t.tanggal ? t.tanggal.substring(0, 7) : '')
        .filter(m => m.length >= 7)
    );
    return Array.from(months).sort().reverse();
  }, [transactions]);

  // 2. Filter and calculate data
  const { displayedTransactions, summary } = useMemo(() => {
    let monthFiltered = transactions;
    if (selectedMonth && selectedMonth !== 'all') {
      monthFiltered = transactions.filter(t => t.tanggal.startsWith(selectedMonth));
    } else if (!selectedMonth) {
      monthFiltered = []; 
    }

    let totalIn = 0;
    let totalOut = 0;
    monthFiltered.forEach(t => {
      if (t.isIncluded) {
        totalIn += t.pemasukan;
        totalOut += t.pengeluaran;
      }
    });
    const balance = totalIn - totalOut;

    let typeFiltered = monthFiltered;
    if (typeFilter !== 'All') {
      typeFiltered = monthFiltered.filter(t => t.tipe === typeFilter);
    }

    const sorted = [...typeFiltered].sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    let currentBalance = 0;
    const processed = sorted.map(t => {
      if (t.isIncluded) {
        currentBalance += t.pemasukan - t.pengeluaran;
      }
      return { ...t, saldoBerjalan: currentBalance };
    });

    return {
      displayedTransactions: processed,
      summary: { totalIn, totalOut, balance }
    };
  }, [transactions, selectedMonth, typeFilter]);

  // --- Handlers ---

  const handleOpenAdd = (tipe: 'Pemasukan' | 'Pengeluaran') => {
    setFormMode('add');
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      tipe,
      keterangan: '',
      nominal: '',
      isIncluded: true,
      catatan: ''
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (t: Transaction) => {
    setFormMode('edit');
    setFormData({
      ...t,
      nominal: (t.tipe === 'Pemasukan' ? t.pemasukan : t.pengeluaran).toString()
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSaveTransaction = async () => {
    if (!formData.tanggal) return setFormError('Tanggal harus diisi');
    if (!formData.keterangan?.trim()) return setFormError('Keterangan harus diisi');
    if (!formData.nominal || isNaN(Number(formData.nominal)) || Number(formData.nominal) <= 0) {
      return setFormError('Nominal harus berupa angka lebih dari 0');
    }

    const nominalNum = Number(formData.nominal);
    const isPemasukan = formData.tipe === 'Pemasukan';

    const newTransaction: Transaction = {
      id: formMode === 'edit' && formData.id ? formData.id : `TRX-${Date.now()}`,
      tanggal: formData.tanggal,
      tipe: formData.tipe as 'Pemasukan' | 'Pengeluaran',
      keterangan: formData.keterangan,
      pemasukan: isPemasukan ? nominalNum : 0,
      pengeluaran: !isPemasukan ? nominalNum : 0,
      isIncluded: formData.isIncluded ?? true,
      catatan: formData.catatan || ''
    };

    if (isUsingFallback) {
      if (formMode === 'add') {
        setTransactions([...transactions, newTransaction]);
      } else {
        setTransactions(transactions.map(t => t.id === newTransaction.id ? newTransaction : t));
      }
      setIsFormOpen(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const safetyTimeout = setTimeout(() => {
      if (isLoading) {
        handleCancelLoading("Koneksi timeout saat menyimpan. Beralih ke mode simulasi.");
      }
    }, 15000);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: formMode === 'add' ? 'create' : 'update',
          data: newTransaction
        }),
        signal: controller.signal,
        redirect: 'follow'
      });
      
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (json.status === 'success') {
          if (formMode === 'add') {
            setTransactions([...transactions, newTransaction]);
          } else {
            setTransactions(transactions.map(t => t.id === newTransaction.id ? newTransaction : t));
          }
          setIsFormOpen(false);
        } else {
          setFormError(json.message || 'Gagal menyimpan data ke server');
        }
      } catch (e) {
        setFormError('Respons server tidak valid. Pastikan Apps Script berjalan dengan benar.');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error("Error saving:", error);
      setFormError('Terjadi kesalahan jaringan saat menyimpan data');
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    
    if (isUsingFallback) {
      setTransactions(transactions.filter(t => t.id !== deleteId));
      setDeleteId(null);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const safetyTimeout = setTimeout(() => {
      if (isLoading) {
        handleCancelLoading("Koneksi timeout saat menghapus. Beralih ke mode simulasi.");
      }
    }, 15000);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'delete',
          data: { id: deleteId }
        }),
        signal: controller.signal,
        redirect: 'follow'
      });
      
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (json.status === 'success') {
          setTransactions(transactions.filter(t => t.id !== deleteId));
          setDeleteId(null);
        } else {
          setGlobalError(json.message || 'Gagal menghapus data');
          setDeleteId(null);
        }
      } catch (e) {
        setGlobalError('Respons server tidak valid saat menghapus.');
        setDeleteId(null);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error("Error deleting:", error);
      setGlobalError('Terjadi kesalahan jaringan saat menghapus data');
      setDeleteId(null);
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFormOpen(false);
        setDeleteId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      
      {/* 1. Dedicated, Non-Overlapping Responsive Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm h-16 md:h-20 flex items-center px-4 md:px-8">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          {/* Navbar Left */}
          <div className="flex items-center space-x-3 md:space-x-4">
            <div className="p-2 md:p-2.5 bg-blue-600 rounded-xl text-white shadow-md flex-shrink-0">
              <FileText size={24} className="md:w-7 md:h-7" />
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-lg md:text-2xl font-bold tracking-tight text-gray-900 leading-tight">
                Sistem Pencatatan Kas <span className="hidden sm:inline">Operasional</span>
              </h1>
              <p className="hidden md:block text-sm text-gray-500 font-medium">
                Laporan Operasional Keuangan
              </p>
            </div>
          </div>
          
          {/* Navbar Right */}
          {onLogout && (
            <button 
              onClick={onLogout}
              className="flex items-center space-x-2 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-sm font-semibold transition-all border border-transparent hover:border-red-100"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </nav>

      {/* Global Loading Overlay with Glassmorphism and Escape Hatch */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md transition-all">
          <div className="bg-white px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center space-y-6 border border-gray-100 max-w-sm w-full mx-4 text-center">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <Loader2 className="animate-spin text-blue-600 relative z-10" size={48} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Memproses Data</h3>
              <p className="text-sm text-gray-500 mt-1">Mohon tunggu sebentar...</p>
            </div>
            <button 
              onClick={() => handleCancelLoading()}
              className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors border border-gray-200"
            >
              Batal & Gunakan Data Simulasi
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Content Area */}
      <main className="pt-24 md:pt-32 pb-12 px-4 md:px-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        {/* Error Banner */}
        {globalError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 md:p-5 flex items-start md:items-center justify-between gap-4 flex-col md:flex-row shadow-sm">
            <div className="flex items-start md:items-center space-x-3 md:space-x-4">
              <div className="p-2 bg-red-100 rounded-full shrink-0">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-800">Pemberitahuan Sistem</h3>
                <p className="text-sm text-red-600 mt-0.5">{globalError}</p>
                {isUsingFallback && (
                  <p className="text-xs font-semibold text-red-500 mt-2 bg-red-100/50 inline-block px-2.5 py-1 rounded-md border border-red-100">
                    Mode Offline: Perubahan tidak akan tersimpan ke server.
                  </p>
                )}
              </div>
            </div>
            <button 
              onClick={fetchTransactions}
              className="flex items-center space-x-2 bg-white border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors w-full md:w-auto justify-center shadow-sm"
            >
              <RefreshCw size={16} />
              <span>Coba Hubungkan Ulang</span>
            </button>
          </div>
        )}

        {/* The Main Body Wrapper */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-5 md:p-8 space-y-8">
          
          {/* 3. Redesigned Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* Card: Total Pemasukan */}
            <div 
              onClick={() => selectedMonth && setTypeFilter('Pemasukan')}
              className={`bg-white rounded-3xl p-6 shadow-sm border transition-all cursor-pointer hover:shadow-md hover:-translate-y-1 ${
                typeFilter === 'Pemasukan' ? 'border-green-500 ring-4 ring-green-50' : 'border-gray-100 hover:border-green-200'
              } ${!selectedMonth && 'opacity-50 pointer-events-none'}`}
            >
              <div className="flex items-center space-x-5">
                <div className="p-4 bg-green-50 text-green-600 rounded-2xl shadow-inner">
                  <ArrowDownCircle size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Pemasukan</p>
                  <p className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">{formatRupiah(summary.totalIn)}</p>
                </div>
              </div>
            </div>

            {/* Card: Total Pengeluaran */}
            <div 
              onClick={() => selectedMonth && setTypeFilter('Pengeluaran')}
              className={`bg-white rounded-3xl p-6 shadow-sm border transition-all cursor-pointer hover:shadow-md hover:-translate-y-1 ${
                typeFilter === 'Pengeluaran' ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100 hover:border-red-200'
              } ${!selectedMonth && 'opacity-50 pointer-events-none'}`}
            >
              <div className="flex items-center space-x-5">
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl shadow-inner">
                  <ArrowUpCircle size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Pengeluaran</p>
                  <p className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">{formatRupiah(summary.totalOut)}</p>
                </div>
              </div>
            </div>

            {/* Card: Saldo Saat Ini */}
            <div 
              onClick={() => selectedMonth && setTypeFilter('All')}
              className={`bg-white rounded-3xl p-6 shadow-sm border transition-all cursor-pointer hover:shadow-md hover:-translate-y-1 ${
                typeFilter === 'All' && selectedMonth ? 'border-blue-500 ring-4 ring-blue-50' : 'border-gray-100 hover:border-blue-200'
              } ${!selectedMonth && 'opacity-50 pointer-events-none'}`}
            >
              <div className="flex items-center space-x-5">
                <div className={`p-4 rounded-2xl shadow-inner ${summary.balance >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                  <Wallet size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Saldo Saat Ini</p>
                  <p className={`text-2xl md:text-3xl font-extrabold tracking-tight ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatRupiah(summary.balance)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Redesigned Controls and Filters */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-50/50 p-2 rounded-2xl border border-gray-100">
            <div className="flex items-center space-x-3 w-full lg:w-auto p-2">
              <div className="p-2.5 bg-white shadow-sm border border-gray-200 rounded-xl text-gray-500">
                <Calendar size={20} strokeWidth={2.5} />
              </div>
              <select 
                value={selectedMonth} 
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setTypeFilter('All');
                }}
                className="flex-1 lg:w-64 bg-white border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 block p-3 outline-none transition-all shadow-sm cursor-pointer"
              >
                <option value="" disabled>-- Pilih Bulan --</option>
                <option value="all">Semua Bulan</option>
                {availableMonths.map(month => (
                  <option key={month} value={month}>{formatMonthLabel(month)}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full lg:w-auto p-2">
              <button 
                onClick={() => handleOpenAdd('Pemasukan')}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                <Plus size={18} strokeWidth={2.5} />
                <span>Tambah Data Pemasukan</span>
              </button>
              <button 
                onClick={() => handleOpenAdd('Pengeluaran')}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                <Plus size={18} strokeWidth={2.5} />
                <span>Tambah Data Pengeluaran</span>
              </button>
            </div>
          </div>

          {/* 5. Redesigned Table Area (CRUD Features) */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/80 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <h2 className="text-lg font-extrabold text-gray-900 tracking-tight flex items-center space-x-2">
                <span>Data Transaksi Keuangan (CRUD)</span>
                {typeFilter !== 'All' && (
                  <span className={`text-xs px-2.5 py-1 rounded-lg ${typeFilter === 'Pemasukan' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {typeFilter}
                  </span>
                )}
              </h2>
              <span className="text-sm text-gray-600 font-bold bg-white border border-gray-200 px-4 py-1.5 rounded-xl shadow-sm inline-block w-fit">
                {displayedTransactions.length} Data Ditemukan
              </span>
            </div>

            {!selectedMonth ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-gray-400 space-y-4 bg-gray-50/30">
                <Calendar size={64} className="opacity-20" />
                <p className="text-lg font-semibold">Silakan pilih bulan untuk melihat data transaksi</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-gray-400 text-xs uppercase tracking-widest border-b border-gray-200">
                      <th className="px-6 py-4 font-bold">Tanggal</th>
                      <th className="px-6 py-4 font-bold">Tipe</th>
                      <th className="px-6 py-4 font-bold">Keterangan</th>
                      <th className="px-6 py-4 font-bold text-right">Pemasukan</th>
                      <th className="px-6 py-4 font-bold text-right">Pengeluaran</th>
                      <th className="px-6 py-4 font-bold text-right">Saldo Berjalan</th>
                      <th className="px-6 py-4 font-bold">Catatan</th>
                      <th className="px-6 py-4 font-bold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedTransactions.map((tx) => (
                      <tr key={tx.id} className={`even:bg-gray-50/50 hover:bg-blue-50/50 transition-colors group ${!tx.isIncluded ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600">
                          {formatDateDisplay(tx.tanggal)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold ${
                            tx.tipe === 'Pemasukan' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {tx.tipe}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-bold">
                          <div className="flex items-center space-x-2">
                            <span>{tx.keterangan}</span>
                            {!tx.isIncluded && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-200 text-gray-500 uppercase tracking-wider">
                                Dikecualikan
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-green-600">
                          {tx.pemasukan > 0 ? formatRupiah(tx.pemasukan) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-red-600">
                          {tx.pengeluaran > 0 ? formatRupiah(tx.pengeluaran) : '-'}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-extrabold ${
                          tx.saldoBerjalan >= 0 ? 'text-gray-900' : 'text-red-600'
                        }`}>
                          {tx.isIncluded ? formatRupiah(tx.saldoBerjalan) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 italic max-w-[200px] truncate">
                          {tx.catatan || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <div className="flex items-center justify-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleOpenEdit(tx)}
                              className="p-2 bg-white border border-gray-200 rounded-lg text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm"
                              title="Edit"
                            >
                              <Edit2 size={16} strokeWidth={2.5} />
                            </button>
                            <button 
                              onClick={() => setDeleteId(tx.id)}
                              className="p-2 bg-white border border-gray-200 rounded-lg text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
                              title="Hapus"
                            >
                              <Trash2 size={16} strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {displayedTransactions.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-16 text-center text-gray-400">
                          <div className="flex flex-col items-center space-y-3">
                            <FileText size={48} className="opacity-20" />
                            <p className="text-base font-semibold">Tidak ada data transaksi yang sesuai dengan filter.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* --- Modal Form (Add/Edit) --- */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                {formMode === 'add' ? 'Tambah Transaksi' : 'Edit Transaksi'} <span className={formData.tipe === 'Pemasukan' ? 'text-green-600' : 'text-red-600'}>{formData.tipe}</span>
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-200"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {formError && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-700 text-sm font-semibold rounded-xl flex items-center space-x-3">
                  <AlertTriangle size={18} strokeWidth={2.5} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Tanggal</label>
                  <input 
                    type="date" 
                    value={formData.tanggal || ''}
                    onChange={(e) => setFormData({...formData, tanggal: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 block p-3 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Tipe</label>
                  <select 
                    value={formData.tipe || 'Pemasukan'}
                    onChange={(e) => setFormData({...formData, tipe: e.target.value as 'Pemasukan' | 'Pengeluaran'})}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 block p-3 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={formMode === 'add'} 
                  >
                    <option value="Pemasukan">Pemasukan</option>
                    <option value="Pengeluaran">Pengeluaran</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Keterangan</label>
                <input 
                  type="text" 
                  placeholder="Contoh: Pembelian ATK"
                  value={formData.keterangan || ''}
                  onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 block p-3 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Jumlah Nominal (Rp)</label>
                <input 
                  type="number" 
                  placeholder="0"
                  min="0"
                  value={formData.nominal || ''}
                  onChange={(e) => setFormData({...formData, nominal: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 block p-3 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Catatan (Opsional)</label>
                <textarea 
                  rows={2}
                  placeholder="Tambahkan catatan jika perlu..."
                  value={formData.catatan || ''}
                  onChange={(e) => setFormData({...formData, catatan: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 block p-3 outline-none transition-all resize-none"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={formData.isIncluded ?? true}
                      onChange={(e) => setFormData({...formData, isIncluded: e.target.checked})}
                      className="peer sr-only"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                  <span className="text-sm font-bold text-gray-700 group-hover:text-gray-900 transition-colors">
                    Masuk Hitungan Saldo (isIncluded)
                  </span>
                </label>
                <p className="text-xs font-medium text-gray-500 mt-1.5 ml-14">
                  Jika dimatikan, transaksi ini tidak akan menambah/mengurangi saldo berjalan.
                </p>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-gray-100 bg-gray-50/50 flex justify-end space-x-3">
              <button 
                onClick={() => setIsFormOpen(false)}
                className="px-5 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                disabled={isLoading}
              >
                Batal
              </button>
              <button 
                onClick={handleSaveTransaction}
                disabled={isLoading}
                className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                Simpan Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Delete Confirmation Modal --- */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
            <div className="p-8 text-center space-y-5">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <AlertTriangle size={40} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Hapus Transaksi?</h3>
                <p className="text-sm text-gray-500 font-medium mt-2">
                  Data yang dihapus tidak dapat dikembalikan. Apakah Anda yakin?
                </p>
              </div>
            </div>
            <div className="px-6 py-5 border-t border-gray-100 bg-gray-50/50 flex space-x-3">
              <button 
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                disabled={isLoading}
              >
                Batal
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
