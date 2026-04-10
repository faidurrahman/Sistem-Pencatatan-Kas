import React, { useState, useEffect } from 'react';
import { Lock, Key, User } from 'lucide-react';
import FinanceApp from './components/FinanceApp';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const auth = localStorage.getItem('isAuth');
    if (auth === 'true') {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'samiun15') {
      localStorage.setItem('isAuth', 'true');
      setIsLoggedIn(true);
      setError('');
    } else {
      setError('Username atau password salah!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuth');
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Subtle Geometric Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        {/* Decorative Blurred Shapes (Glassmorphism Background) */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>

        {/* Login Card */}
        <div className="relative w-full max-w-md p-8 sm:p-12 bg-white/80 backdrop-blur-2xl rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-white/60 z-10 mx-4">
          
          {/* Decorative corner lines (Premium feel) */}
          <div className="absolute top-0 left-0 w-20 h-20 border-t-2 border-l-2 border-blue-100 rounded-tl-[32px] opacity-60"></div>
          <div className="absolute bottom-0 right-0 w-20 h-20 border-b-2 border-r-2 border-blue-100 rounded-br-[32px] opacity-60"></div>

          <div className="flex flex-col items-center mb-10">
            {/* Key Emblem */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center shadow-xl shadow-blue-500/30 mb-6 relative group">
              <div className="absolute inset-0 rounded-full border-2 border-white/20"></div>
              <Key className="text-white w-9 h-9 group-hover:scale-110 transition-transform duration-300" strokeWidth={2.5} />
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight text-center">
              Sistem Pencatatan Kas
            </h1>
            <p className="text-slate-500 font-medium mt-2.5 text-center text-sm sm:text-base">
              Silakan masuk untuk melanjutkan
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 ml-1">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all text-slate-700 font-semibold"
                  placeholder="Masukkan username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 ml-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all text-slate-700 font-semibold"
                  placeholder="Masukkan password"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50/80 border border-red-100 rounded-xl text-red-600 text-sm font-bold text-center animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white py-4 rounded-2xl font-bold text-lg hover:from-blue-700 hover:to-blue-900 transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0"
            >
              Masuk
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <FinanceApp onLogout={handleLogout} />
  );
}
