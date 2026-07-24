import React, { useState } from 'react';
import { UserPlus, User, Lock, Tag, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const API_URL = 'https://script.google.com/macros/s/AKfycbzMwxW890Mi5oRsk17lk28q1TBz07Tika-hozU5lRPIdWTJXcLDAxTjaIEVPrXu9LlVcA/exec';

export default function UserManagement() {
  const [formData, setFormData] = useState({
    nama_lengkap: '',
    username: '',
    password: '',
    role: 'User'
  });
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'tambah_user',
          nama_lengkap: formData.nama_lengkap,
          username: formData.username,
          password: formData.password,
          role: formData.role
        })
      });

      const result = await response.json();
      
      if (result.success || result.status === 'success') {
        setStatus('success');
        setMessage('User berhasil ditambahkan!');
        setFormData({ nama_lengkap: '', username: '', password: '', role: 'User' });
      } else {
        setStatus('error');
        setMessage(result.message || 'Gagal menambahkan user.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Terjadi kesalahan saat menghubungi server.');
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8 w-full max-w-lg mx-auto">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <UserPlus className="w-6 h-6" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Manajemen User</h2>
          <p className="text-sm text-gray-500 font-medium">Tambah user baru ke dalam sistem</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-gray-700">Nama Lengkap</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input 
              type="text" 
              required
              value={formData.nama_lengkap}
              onChange={(e) => setFormData({...formData, nama_lengkap: e.target.value})}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all"
              placeholder="Masukkan nama lengkap"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-gray-700">Username</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input 
              type="text" 
              required
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all"
              placeholder="Masukkan username"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-gray-700">Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input 
              type="password" 
              required
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all"
              placeholder="Masukkan password"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-gray-700">Role</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Tag className="h-5 w-5 text-gray-400" />
            </div>
            <select 
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all appearance-none"
            >
              <option value="Admin">Admin</option>
              <option value="User">User</option>
            </select>
          </div>
        </div>

        {status === 'success' && (
          <div className="flex items-center p-3 text-sm text-green-800 bg-green-50 rounded-xl font-semibold">
            <CheckCircle2 className="w-5 h-5 mr-2" />
            {message}
          </div>
        )}
        
        {status === 'error' && (
          <div className="flex items-center p-3 text-sm text-red-800 bg-red-50 rounded-xl font-semibold">
            <XCircle className="w-5 h-5 mr-2" />
            {message}
          </div>
        )}

        <button 
          type="submit"
          disabled={status === 'loading'}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mt-2"
        >
          {status === 'loading' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              <span>Simpan User</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
