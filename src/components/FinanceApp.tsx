import React, { useState, useMemo, useEffect } from 'react';
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
  RefreshCw
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
export default function FinanceApp() {
  // State: Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);
  
  // State: Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // '' means "Pilih Bulan"
  const [typeFilter, setTypeFilter] = useState<'All' | 'Pemasukan' | 'Pengeluaran'>('All');

  // State: Modal Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [formData, setFormData] = useState<Partial<Transaction & { nominal: string }>>({});
  const [formError, setFormError] = useState<string>('');

  // State: Delete Confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // --- Fetch Data on Mount ---
  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setIsLoading(true);
    setGlobalError(null);
    setIsUsingFallback(false);
    
    // Fail-safe timeout to ensure loading spinner doesn't get stuck forever
    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 15000);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(API_URL, { 
        signal: controller.signal,
        redirect: 'follow'
      });
      clearTimeout(timeoutId);
      
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
      console.error("Error fetching data:", error);
      const errorMsg = error.name === 'AbortError' 
        ? "Koneksi timeout. Server terlalu lama merespons." 
        : error.message || "Gagal terhubung ke server.";
      
      setGlobalError(errorMsg);
      setTransactions(fallbackData);
      setIsUsingFallback(true);
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
    }
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

    // Jika sedang menggunakan fallback (API error), simpan ke local state saja
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
    
    // Fail-safe timeout to ensure loading spinner doesn't get stuck forever
    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 15000);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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
      clearTimeout(timeoutId);
      
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
      console.error("Error saving:", error);
      const errorMsg = error.name === 'AbortError' 
        ? "Koneksi timeout. Server terlalu lama merespons saat menyimpan." 
        : 'Terjadi kesalahan jaringan saat menyimpan data';
      setFormError(errorMsg);
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
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
    
    // Fail-safe timeout
    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 15000);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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
      clearTimeout(timeoutId);
      
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
      console.error("Error deleting:", error);
      const errorMsg = error.name === 'AbortError' 
        ? "Koneksi timeout. Server terlalu lama merespons saat menghapus." 
        : 'Terjadi kesalahan jaringan saat menghapus data';
      setGlobalError(errorMsg);
      setDeleteId(null);
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false);
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-900 relative">
      
      {/* Global Loading Overlay - Made less intrusive */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/10 backdrop-blur-[2px] transition-all">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-xl flex items-center space-x-3 border border-gray-100">
            <Loader2 className="animate-spin text-blue-600" size={24} />
            <span className="text-sm font-semibold text-gray-700">Memproses data...</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        {/* Error Banner */}
        {globalError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
            <div className="flex items-start md:items-center space-x-3">
              <AlertTriangle className="text-red-600 shrink-0 mt-0.5 md:mt-0" size={24} />
              <div>
                <h3 className="text-sm font-bold text-red-800">Gagal terhubung ke Google Sheet</h3>
                <p className="text-sm text-red-600 mt-1">{globalError}</p>
                {isUsingFallback && (
                  <p className="text-xs font-medium text-red-500 mt-1 bg-red-100 inline-block px-2 py-1 rounded">
                    Menampilkan data offline sementara. Perubahan tidak akan tersimpan ke server.
                  </p>
                )}
              </div>
            </div>
            <button 
              onClick={fetchTransactions}
              className="flex items-center space-x-2 bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors w-full md:w-auto justify-center"
            >
              <RefreshCw size={16} />
              <span>Coba Lagi</span>
            </button>
          </div>
        )}

        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-600 rounded-lg text-white shadow-sm">
              <FileText size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Sistem Pencatatan Kas</h1>
              <p className="text-sm text-gray-500 font-medium">Laporan Operasional Keuangan</p>
            </div>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Card: Total Pemasukan */}
          <div 
            onClick={() => selectedMonth && setTypeFilter('Pemasukan')}
            className={`bg-white rounded-2xl p-6 shadow-sm border transition-all cursor-pointer hover:scale-[1.02] ${
              typeFilter === 'Pemasukan' ? 'border-green-500 ring-2 ring-green-100' : 'border-gray-100 hover:border-green-200'
            } ${!selectedMonth && 'opacity-50 pointer-events-none'}`}
          >
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-green-50 text-green-600 rounded-full">
                <ArrowDownCircle size={32} strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Pemasukan</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatRupiah(summary.totalIn)}</p>
              </div>
            </div>
          </div>

          {/* Card: Total Pengeluaran */}
          <div 
            onClick={() => selectedMonth && setTypeFilter('Pengeluaran')}
            className={`bg-white rounded-2xl p-6 shadow-sm border transition-all cursor-pointer hover:scale-[1.02] ${
              typeFilter === 'Pengeluaran' ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-100 hover:border-red-200'
            } ${!selectedMonth && 'opacity-50 pointer-events-none'}`}
          >
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-red-50 text-red-600 rounded-full">
                <ArrowUpCircle size={32} strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Pengeluaran</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatRupiah(summary.totalOut)}</p>
              </div>
            </div>
          </div>

          {/* Card: Saldo Saat Ini */}
          <div 
            onClick={() => selectedMonth && setTypeFilter('All')}
            className={`bg-white rounded-2xl p-6 shadow-sm border transition-all cursor-pointer hover:scale-[1.02] ${
              typeFilter === 'All' && selectedMonth ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100 hover:border-blue-200'
            } ${!selectedMonth && 'opacity-50 pointer-events-none'}`}
          >
            <div className="flex items-center space-x-4">
              <div className={`p-4 rounded-full ${summary.balance >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                <Wallet size={32} strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Saldo Saat Ini</p>
                <p className={`text-2xl font-bold mt-1 ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatRupiah(summary.balance)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls: Filter & Add Buttons */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <div className="p-2 bg-gray-100 rounded-lg text-gray-500">
              <Calendar size={20} />
            </div>
            <select 
              value={selectedMonth} 
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setTypeFilter('All');
              }}
              className="flex-1 md:w-64 bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors"
            >
              <option value="" disabled>-- Pilih Bulan --</option>
              <option value="all">Semua Bulan</option>
              {availableMonths.map(month => (
                <option key={month} value={month}>{formatMonthLabel(month)}</option>
              ))}
            </select>
          </div>

          <div className="flex space-x-3 w-full md:w-auto">
            <button 
              onClick={() => handleOpenAdd('Pemasukan')}
              className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={18} />
              <span>Pemasukan</span>
            </button>
            <button 
              onClick={() => handleOpenAdd('Pengeluaran')}
              className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={18} />
              <span>Pengeluaran</span>
            </button>
          </div>
        </div>

        {/* Transaction Table Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
          {!selectedMonth ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-gray-400 space-y-4">
              <Calendar size={64} className="opacity-20" />
              <p className="text-lg font-medium">Silakan pilih bulan untuk melihat data transaksi</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-5 border-b border-gray-100 bg-white flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">
                  Data Transaksi {typeFilter !== 'All' ? `- ${typeFilter}` : ''}
                </h2>
                <span className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
                  {displayedTransactions.length} Data
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-500 text-sm uppercase tracking-wider">
                      <th className="px-6 py-4 font-semibold border-b border-gray-100">Tanggal</th>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100">Tipe</th>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100">Keterangan</th>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100 text-right">Pemasukan</th>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100 text-right">Pengeluaran</th>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100 text-right">Saldo Berjalan</th>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100">Catatan</th>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedTransactions.map((tx) => (
                      <tr key={tx.id} className={`hover:bg-gray-50/80 transition-colors group ${!tx.isIncluded ? 'bg-gray-50/50 opacity-75' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDateDisplay(tx.tanggal)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            tx.tipe === 'Pemasukan' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {tx.tipe}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                          <div className="flex items-center space-x-2">
                            <span>{tx.keterangan}</span>
                            {!tx.isIncluded && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-600 uppercase tracking-wider">
                                Dikecualikan
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                          {tx.pemasukan > 0 ? formatRupiah(tx.pemasukan) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                          {tx.pengeluaran > 0 ? formatRupiah(tx.pengeluaran) : '-'}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                          tx.saldoBerjalan >= 0 ? 'text-gray-900' : 'text-red-600'
                        }`}>
                          {tx.isIncluded ? formatRupiah(tx.saldoBerjalan) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 italic max-w-[200px] truncate">
                          {tx.catatan || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <div className="flex items-center justify-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleOpenEdit(tx)}
                              className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => setDeleteId(tx.id)}
                              className="text-red-600 hover:text-red-800 transition-colors p-1"
                              title="Hapus"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {displayedTransactions.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                          Tidak ada data transaksi yang sesuai dengan filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

      </div>

      {/* --- Modal Form (Add/Edit) --- */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">
                {formMode === 'add' ? 'Tambah Transaksi' : 'Edit Transaksi'} {formData.tipe}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center space-x-2">
                  <AlertTriangle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Tanggal</label>
                  <input 
                    type="date" 
                    value={formData.tanggal || ''}
                    onChange={(e) => setFormData({...formData, tanggal: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Tipe</label>
                  <select 
                    value={formData.tipe || 'Pemasukan'}
                    onChange={(e) => setFormData({...formData, tipe: e.target.value as 'Pemasukan' | 'Pengeluaran'})}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors"
                    disabled={formMode === 'add'} 
                  >
                    <option value="Pemasukan">Pemasukan</option>
                    <option value="Pengeluaran">Pengeluaran</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Keterangan</label>
                <input 
                  type="text" 
                  placeholder="Contoh: Pembelian ATK"
                  value={formData.keterangan || ''}
                  onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Jumlah Nominal (Rp)</label>
                <input 
                  type="number" 
                  placeholder="0"
                  min="0"
                  value={formData.nominal || ''}
                  onChange={(e) => setFormData({...formData, nominal: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Catatan (Opsional)</label>
                <textarea 
                  rows={2}
                  placeholder="Tambahkan catatan jika perlu..."
                  value={formData.catatan || ''}
                  onChange={(e) => setFormData({...formData, catatan: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors resize-none"
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
                    <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                    Masuk Hitungan Saldo (isIncluded)
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-13">
                  Jika dimatikan, transaksi ini tidak akan menambah/mengurangi saldo berjalan.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end space-x-3">
              <button 
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                Batal
              </button>
              <button 
                onClick={handleSaveTransaction}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                Simpan Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Delete Confirmation Modal --- */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Hapus Transaksi?</h3>
              <p className="text-sm text-gray-500">
                Apakah Anda yakin ingin menghapus data transaksi ini? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex space-x-3">
              <button 
                onClick={() => setDeleteId(null)}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
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
