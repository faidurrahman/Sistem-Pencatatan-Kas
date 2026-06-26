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
  LogOut,
  Image as ImageIcon,
  Upload,
  Link,
  Eye
} from 'lucide-react';

// --- API URL ---
const API_URL = 'https://script.google.com/macros/s/AKfycbwyl_yBbToMVqlSQ4zAoNphKEtLkPyzYAng3I87pPnPbC8bPog46WrpAouNBgYfIgWqug/exec?sheet=Kas_Lain_Lain';

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
  notaUrl?: string;
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
    if (typeof dateVal === 'string') {
      const isoMatch = dateVal.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) return isoMatch[1];
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return String(dateVal);
  }
};

const getRenderableImageUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.startsWith('data:image')) return url;
  
  // Format Drive URL to direct view URL
  // Matches https://drive.google.com/file/d/FILE_ID/view
  const dMatch = url.match(/\/d\/([^/]+)/);
  if (dMatch && dMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${dMatch[1]}&sz=w1000`;
  }
  
  // Matches https://drive.google.com/open?id=FILE_ID
  const idMatch = url.match(/[?&]id=([^&]+)/);
  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1000`;
  }
  
  return url;
};

// --- Main Component ---
export default function LainApp({ onLogout }: FinanceAppProps) {
  // State: Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);
  
  // State: Filters
  const [startDate, setStartDate] = useState<string>(''); 
  const [endDate, setEndDate] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Pemasukan' | 'Pengeluaran'>('All');

  // State: Modal Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [formData, setFormData] = useState<Partial<Transaction & { nominal: string }>>({});
  const [displayNominal, setDisplayNominal] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // State: Image Upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');

  // State: Delete Confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // State: View Transaction
  const [viewTransaction, setViewTransaction] = useState<Transaction | null>(null);

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
            catatan: item.catatan || '',
            notaUrl: item.notaUrl || ''
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
  
  // 1. Get unique months for dropdown (Not needed for date range, kept for reference or removed)
  
  // 2. Filter and calculate data
  const { displayedTransactions, summary } = useMemo(() => {
    let dateFiltered = transactions;
    
    // Filter by date range
    if (startDate) {
      dateFiltered = dateFiltered.filter(t => t.tanggal >= startDate);
    }
    if (endDate) {
      dateFiltered = dateFiltered.filter(t => t.tanggal <= endDate);
    }

    let totalIn = 0;
    let totalOut = 0;
    dateFiltered.forEach(t => {
      if (t.isIncluded) {
        if (t.tipe === 'Pemasukan') totalIn += t.pemasukan;
        if (t.tipe === 'Pengeluaran') totalOut += t.pengeluaran;
      }
    });
    const balance = totalIn - totalOut;

    let typeFiltered = dateFiltered;
    if (typeFilter !== 'All') {
      typeFiltered = dateFiltered.filter(t => t.tipe === typeFilter);
    }

    const sorted = [...typeFiltered].sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    let currentBalance = 0;
    const processed = sorted.map(t => {
      if (t.isIncluded) {
        currentBalance += t.pemasukan - t.pengeluaran;
      }
      return { ...t, balance: currentBalance };
    });

    return {
      displayedTransactions: processed,
      summary: { totalIn, totalOut, balance }
    };
  }, [transactions, startDate, endDate, typeFilter]);

  // --- Handlers ---

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const MAX_DIMENSION = 600;
          if (width > height) {
            if (width > MAX_DIMENSION) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            }
          } else {
            if (height > MAX_DIMENSION) {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
            const base64 = dataUrl.split(',')[1];
            
            if (base64.length > 45000) {
                 const dataUrlSmaller = canvas.toDataURL('image/jpeg', 0.3);
                 resolve(dataUrlSmaller.split(',')[1]);
                 return;
            }
            resolve(base64);
          } else {
            resolve(event.target?.result?.toString().split(',')[1] || '');
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setFormError("Ukuran file maksimal 5MB");
        return;
      }
      setImageFile(file);
      const base64String = await compressImage(file);
      setImageBase64(base64String);
    } else {
      setImageFile(null);
      setImageBase64('');
    }
  };

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
    setDisplayNominal('');
    setImageFile(null);
    setImageBase64('');
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (t: Transaction) => {
    setFormMode('edit');
    const rawNominal = (t.tipe === 'Pemasukan' ? t.pemasukan : t.pengeluaran).toString();
    setFormData({
      ...t,
      nominal: rawNominal
    });
    setDisplayNominal(rawNominal ? parseInt(rawNominal, 10).toLocaleString('id-ID') : '');
    setImageFile(null);
    setImageBase64('');
    setFormError('');
    setIsFormOpen(true);
  };

  const handleNominalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setFormData({ ...formData, nominal: rawValue });
    if (rawValue) {
      setDisplayNominal(parseInt(rawValue, 10).toLocaleString('id-ID'));
    } else {
      setDisplayNominal('');
    }
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
      catatan: formData.catatan || '',
      notaUrl: formMode === 'edit' ? formData.notaUrl : ''
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

    const payloadData = {
      ...newTransaction,
      imageBase64: imageBase64 || undefined,
      imageMimeType: imageFile?.type || undefined,
      imageFileName: imageFile?.name || undefined
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: formMode === 'add' ? 'create' : 'update',
          data: payloadData
        }),
        signal: controller.signal,
        redirect: 'follow'
      });
      
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (json.status === 'success') {
          let updatedTransaction = { ...newTransaction };
          const responseNotaUrl = json.notaUrl || (json.data && json.data.notaUrl);
          if (responseNotaUrl) {
            updatedTransaction.notaUrl = responseNotaUrl;
          }

          if (formMode === 'add') {
            setTransactions([...transactions, updatedTransaction]);
          } else {
            setTransactions(transactions.map(t => t.id === updatedTransaction.id ? updatedTransaction : t));
          }
          setIsFormOpen(false);
          setImageFile(null);
          setImageBase64('');
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
      
      {/* 1. Optimized Desktop Header/Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm h-20 flex items-center px-4 sm:px-6 lg:px-12">
        <div className="w-full flex items-center justify-between gap-2">
          {/* Navbar Left: Logo and Titles aligned far left */}
          <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4 overflow-hidden">
            <div className="p-1.5 sm:p-2 lg:p-2.5 bg-blue-600 rounded-lg lg:rounded-xl text-white shadow-md flex-shrink-0">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" />
            </div>
            <div className="flex flex-col justify-center overflow-hidden">
              <h1 className="text-xs min-[360px]:text-sm sm:text-lg lg:text-2xl font-bold tracking-tight text-gray-900 leading-tight truncate">
                Laporan Kas <span className="hidden min-[480px]:inline">Lain-Lain</span>
              </h1>
              <p className="text-[9px] min-[360px]:text-xs lg:text-sm text-gray-500 font-medium truncate">
                Laporan Keuangan Ekstra
              </p>
            </div>
          </div>
          
          {/* Navbar Right: Logout button aligned far right */}
          {onLogout && (
            <button 
              onClick={onLogout}
              className="flex items-center space-x-1.5 sm:space-x-2 bg-white hover:bg-red-50 text-gray-700 hover:text-red-600 px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border border-gray-200 hover:border-red-200 shadow-sm shrink-0"
              title="Keluar dari sistem"
            >
              <LogOut size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="hidden min-[400px]:inline">Logout</span>
            </button>
          )}
        </div>
      </nav>

      {/* Global Loading Overlay with Glassmorphism and Escape Hatch */}
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md transition-all">
          <div className="bg-white px-8 py-8 rounded-3xl shadow-2xl flex flex-col items-center space-y-6 border border-gray-100 max-w-sm w-full mx-4 text-center">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <Loader2 className="animate-spin text-blue-600 relative z-10" size={48} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Memproses data...</h3>
              <p className="text-sm text-gray-500 mt-1">Mohon tunggu sebentar</p>
            </div>
            <button 
              onClick={() => handleCancelLoading()}
              className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold transition-colors border border-gray-200 shadow-sm"
            >
              Batal & Gunakan Data Simulasi
            </button>
          </div>
        </div>
      )}

      {/* 5. Desktop Content Container (with pt-36 to clear the h-20 navbar + tab bar) */}
      <main className="pt-36 pb-8 px-3 sm:px-6 lg:px-12">
        
        {/* Error Banner */}
        {globalError && (
          <div className="max-w-7xl mx-auto mb-6 bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-4">
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
              className="flex items-center space-x-2 bg-white border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors shadow-sm"
            >
              <RefreshCw size={16} />
              <span>Coba Hubungkan Ulang</span>
            </button>
          </div>
        )}

        {/* The Main White Card Wrapper */}
        <div className="max-w-7xl mx-auto bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100 p-4 sm:p-8 space-y-6 sm:space-y-8">
          
          {/* 2. Horizontal Summary Cards Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Card: Total Pengeluaran */}
            <div 
              onClick={() => setTypeFilter('Pengeluaran')}
              className={`bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-6 shadow-sm border transition-all cursor-pointer hover:shadow-md hover:-translate-y-1 ${
                typeFilter === 'Pengeluaran' ? 'border-red-500 ring-4 ring-red-50' : 'border-gray-100 hover:border-red-200'
              }`}
            >
              <div className="flex items-center space-x-3 sm:space-x-5">
                <div className="p-2.5 sm:p-4 bg-red-50 text-red-600 rounded-xl sm:rounded-2xl shadow-inner shrink-0">
                  <ArrowUpCircle className="w-6 h-6 sm:w-9 sm:h-9" strokeWidth={2.5} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] min-[360px]:text-xs md:text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 truncate">Total Pengeluaran Lainya</p>
                  <p className="text-sm min-[360px]:text-base min-[400px]:text-lg sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight truncate">{formatRupiah(summary.totalOut)}</p>
                </div>
              </div>
            </div>

            {/* Card: Saldo Saat Ini */}
            <div 
              onClick={() => setTypeFilter('All')}
              className={`bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-6 shadow-sm border transition-all cursor-pointer hover:shadow-md hover:-translate-y-1 ${
                typeFilter === 'All' ? 'border-blue-500 ring-4 ring-blue-50' : 'border-gray-100 hover:border-blue-200'
              }`}
            >
              <div className="flex items-center space-x-3 sm:space-x-5">
                <div className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-inner shrink-0 ${summary.balance >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                  <Wallet className="w-6 h-6 sm:w-9 sm:h-9" strokeWidth={2.5} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] min-[360px]:text-xs md:text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 truncate">Total Nominal Saldo</p>
                  <p className={`text-sm min-[360px]:text-base min-[400px]:text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight truncate ${summary.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {formatRupiah(summary.balance)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Streamlined Controls Container */}
          <div className="flex flex-col lg:flex-row justify-between items-center gap-3 bg-gray-50/80 p-2 sm:p-3 rounded-2xl border border-gray-200">
            {/* Left: Date Range Filter */}
            <div className="flex items-center space-x-2 sm:space-x-3 w-full lg:w-auto">
               <div className="p-2 sm:p-3 bg-white shadow-sm border border-gray-200 rounded-xl text-gray-500 shrink-0">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
              </div>
              <div className="flex items-center space-x-2 w-full">
                <input 
                  type="date"
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 lg:w-40 bg-white border border-gray-200 text-gray-900 text-xs sm:text-sm font-semibold rounded-xl focus:ring-4 focus:ring-red-50 focus:border-red-500 block p-2.5 sm:p-3.5 outline-none transition-all shadow-sm cursor-pointer"
                  placeholder="Mulai"
                />
                <span className="text-gray-400 font-medium">s/d</span>
                <input 
                  type="date"
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 lg:w-40 bg-white border border-gray-200 text-gray-900 text-xs sm:text-sm font-semibold rounded-xl focus:ring-4 focus:ring-red-50 focus:border-red-500 block p-2.5 sm:p-3.5 outline-none transition-all shadow-sm cursor-pointer"
                  placeholder="Sampai"
                />
              </div>
            </div>

            {/* Right: Add Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full lg:w-auto">
              <button 
                onClick={() => handleOpenAdd('Pengeluaran')}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 sm:space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />
                <span>Tambah Pengeluaran</span>
              </button>
            </div>
          </div>

          {/* 4. Wide-Screen Table Layout (CRUD Features) */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-2.5 justify-between sm:items-center">
              <h2 className="text-sm sm:text-lg font-extrabold text-gray-900 tracking-tight flex flex-wrap items-center gap-2">
                <span>Data Transaksi Khusus</span>
                {typeFilter !== 'All' && (
                  <span className={`text-[10px] sm:text-xs px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg ${typeFilter === 'Pemasukan' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    Filter: {typeFilter}
                  </span>
                )}
              </h2>
              <span className="self-start sm:self-auto text-xs sm:text-sm text-gray-600 font-bold bg-white border border-gray-200 px-3 py-1 sm:px-4 sm:py-1.5 rounded-xl shadow-sm">
                {displayedTransactions.length} Data Ditemukan
              </span>
            </div>

            {displayedTransactions.length === 0 && (startDate || endDate) ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-gray-400 space-y-4 bg-gray-50/30">
                <Calendar size={64} className="opacity-20" />
                <p className="text-lg font-semibold">Tidak ada data untuk filter tersebut</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-gray-500 text-[10px] sm:text-xs uppercase tracking-widest border-b border-gray-200">
                      <th className="px-3 py-3 sm:px-6 sm:py-4 font-bold whitespace-nowrap">Tanggal</th>
                      <th className="px-3 py-3 sm:px-6 sm:py-4 font-bold min-w-[200px]">Keterangan</th>
                      <th className="px-3 py-3 sm:px-6 sm:py-4 font-bold text-right whitespace-nowrap">Pengeluaran</th>
                      <th className="px-3 py-3 sm:px-6 sm:py-4 font-bold text-right whitespace-nowrap">Total Kas Guna</th>
                      <th className="px-3 py-3 sm:px-6 sm:py-4 font-bold min-w-[200px]">Catatan</th>
                      <th className="px-3 py-3 sm:px-6 sm:py-4 font-bold text-center whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedTransactions.map((tx: any) => (
                      <tr key={tx.id} className={`even:bg-gray-50/50 hover:bg-blue-50/50 transition-colors group ${!tx.isIncluded ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-600">
                          {formatDateDisplay(tx.tanggal)}
                        </td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-gray-900 font-bold">
                          <div className="flex items-center space-x-2">
                            <span>{tx.keterangan}</span>
                            {!tx.isIncluded && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[8px] sm:text-[10px] font-bold bg-gray-200 text-gray-500 uppercase tracking-wider shrink-0">
                                Dikecualikan
                              </span>
                            )}
                            {tx.notaUrl && (
                              <a href={tx.notaUrl} target="_blank" rel="noopener noreferrer" title="Lihat Foto Nota">
                                <ImageIcon className="w-4 h-4 text-blue-500 hover:text-blue-700 transition-colors" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right font-bold text-red-600">
                          {tx.pengeluaran > 0 ? formatRupiah(tx.pengeluaran) : '-'}
                        </td>
                        <td className={`px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right font-extrabold ${
                          tx.balance >= 0 ? 'text-gray-900' : 'text-red-600'
                        }`}>
                          {tx.isIncluded ? formatRupiah(tx.balance) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-gray-500 italic">
                          {tx.catatan || '-'}
                        </td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-center min-w-[120px]">
                          <div className="flex items-center justify-center space-x-2 sm:space-x-3">
                            <button 
                              onClick={() => setViewTransaction(tx)}
                              className="p-1.5 sm:p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                              title="Lihat Detail Transaksi"
                            >
                              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
                            </button>
                            <button 
                              onClick={() => handleOpenEdit(tx)}
                              className="p-1.5 sm:p-2 bg-white border border-gray-200 rounded-lg text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm"
                              title="Edit Transaksi"
                            >
                              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
                            </button>
                            <button 
                              onClick={() => setDeleteId(tx.id)}
                              className="p-1.5 sm:p-2 bg-white border border-gray-200 rounded-lg text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {displayedTransactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-16 text-center text-gray-400">
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
            <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-base sm:text-xl font-extrabold text-gray-900 tracking-tight">
                {formMode === 'add' ? 'Tambah Pengeluaran' : 'Edit Pengeluaran'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 sm:p-2 rounded-full hover:bg-gray-200"
                title="Tutup"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              {formError && (
                <div className="p-3 sm:p-4 bg-red-50 border border-red-100 text-red-700 text-xs sm:text-sm font-semibold rounded-xl flex items-center space-x-2.5 sm:space-x-3">
                  <AlertTriangle className="w-4 h-4 sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-bold text-gray-700">Tanggal</label>
                  <input 
                    type="date" 
                    value={formData.tanggal || ''}
                    onChange={(e) => setFormData({...formData, tanggal: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs sm:text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 block p-2.5 sm:p-3 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-gray-700">Keterangan</label>
                <input 
                  type="text" 
                  placeholder="Contoh: Pembelian ATK"
                  value={formData.keterangan || ''}
                  onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs sm:text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 block p-2.5 sm:p-3 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-gray-700">Jumlah Nominal (Rp)</label>
                <input 
                  type="text" 
                  placeholder="0"
                  value={displayNominal}
                  onChange={handleNominalChange}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs sm:text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 block p-2.5 sm:p-3 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-gray-700">Foto Nota (Opsional)</label>
                <div className="flex items-center space-x-3">
                  <label className="flex items-center justify-center space-x-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-600 px-4 py-2.5 rounded-xl cursor-pointer transition-colors shadow-sm w-full sm:w-auto">
                    <Upload className="w-4 h-4 text-gray-500" />
                    <span className="text-xs sm:text-sm font-semibold truncate">
                      {imageFile ? imageFile.name : 'Pilih Foto...'}
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange}
                      className="hidden" 
                    />
                  </label>
                  {imageBase64 && (
                    <div className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-lg overflow-hidden border border-gray-200 shadow-sm relative group">
                       <img src={`data:${imageFile?.type};base64,${imageBase64}`} alt="Preview" className="w-full h-full object-cover" />
                       <button onClick={() => { setImageFile(null); setImageBase64(''); }} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <X className="w-4 h-4" />
                       </button>
                    </div>
                  )}
                  {!imageBase64 && formMode === 'edit' && formData.notaUrl && (
                     <a href={formData.notaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 text-xs text-blue-600 hover:underline">
                        <Link className="w-3 h-3" />
                        <span>Lihat Nota Tersimpan</span>
                     </a>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-bold text-gray-700">Catatan (Opsional)</label>
                <textarea 
                  rows={2}
                  placeholder="Tambahkan catatan jika perlu..."
                  value={formData.catatan || ''}
                  onChange={(e) => setFormData({...formData, catatan: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs sm:text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 block p-2.5 sm:p-3 outline-none transition-all resize-none"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={formData.isIncluded ?? true}
                      onChange={(e) => setFormData({...formData, isIncluded: e.target.checked})}
                      className="peer sr-only"
                    />
                    <div className="w-10 h-5.5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-gray-700 group-hover:text-gray-900 transition-colors">
                    Masuk Hitungan Saldo (isIncluded)
                  </span>
                </label>
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 mt-1 ml-12 sm:ml-14">
                  Jika dimatikan, transaksi ini tidak akan menambah/mengurangi saldo berjalan.
                </p>
              </div>
            </div>

            <div className="px-4 py-4 sm:px-6 sm:py-5 border-t border-gray-100 bg-gray-50/50 flex justify-end space-x-2.5 sm:space-x-3">
              <button 
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                disabled={isLoading}
              >
                Batal
              </button>
              <button 
                onClick={handleSaveTransaction}
                disabled={isLoading}
                className="px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                Simpan Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- View Detail Modal --- */}
      {viewTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight flex items-center space-x-2">
                <FileText className="w-5 h-5 text-gray-500" />
                <span>Detail Transaksi</span>
              </h3>
              <button 
                onClick={() => setViewTransaction(null)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 sm:p-2 rounded-full hover:bg-gray-200"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500 font-bold mb-1">Keterangan</p>
                    <p className="font-semibold text-gray-900">{viewTransaction.keterangan}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500 font-bold mb-1">Tanggal</p>
                    <p className="font-semibold text-gray-900">{viewTransaction.tanggal}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                    <p className="text-xs text-red-600 font-bold mb-1">Pengeluaran</p>
                    <p className="font-bold text-red-700 text-lg">Rp {viewTransaction.pengeluaran.toLocaleString('id-ID')}</p>
                  </div>
                </div>

                {viewTransaction.catatan && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500 font-bold mb-1">Catatan</p>
                    <p className="font-medium text-gray-800 whitespace-pre-wrap">{viewTransaction.catatan}</p>
                  </div>
                )}

                {viewTransaction.notaUrl && (
                  <div className="space-y-2 mt-4">
                    <p className="text-xs text-gray-500 font-bold flex items-center">
                      <ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Foto Nota
                    </p>
                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 text-center relative group">
                      <img 
                        src={getRenderableImageUrl(viewTransaction.notaUrl)} 
                        alt="Nota" 
                        referrerPolicy="no-referrer"
                        className="w-full h-auto max-h-[50vh] object-contain transition-transform duration-300 mx-auto"
                      />
                      <a 
                        href={viewTransaction.notaUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Buka Gambar Resolusi Penuh"
                      >
                         <div className="bg-white text-gray-900 px-4 py-2 font-bold text-sm rounded-lg shadow-lg hover:scale-105 transition-transform flex items-center space-x-2">
                           <Link className="w-4 h-4"/>
                           <span>Buka Gambar Penuh</span>
                         </div>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-4 py-4 sm:px-6 sm:py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end shrink-0">
              <button 
                onClick={() => setViewTransaction(null)}
                className="px-5 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
              >
                Tutup
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
