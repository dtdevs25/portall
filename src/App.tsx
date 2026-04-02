/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserProfile, Location, ScanLog, UserRole } from './types';
import { cn } from './lib/utils';
import { api, getStoredUser, saveSession, clearSession } from './api';
import { 
  LogOut, 
  QrCode, 
  Users, 
  MapPin, 
  History, 
  Plus, 
  Trash2, 
  Download, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Search,
  Filter,
  Calendar as CalendarIcon,
  UserPlus,
  LayoutGrid,
  List,
  Edit2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

// --- Components ---

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className, 
  disabled,
  type = 'button'
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; 
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}) => {
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20',
    secondary: 'bg-secondary text-white hover:bg-secondary/90 shadow-md shadow-secondary/20',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className }: { children: React.ReactNode; className?: string; key?: React.Key }) => (
  <div className={cn('bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden', className)}>
    {children}
  </div>
);

const Input = ({ 
  label, 
  value, 
  onChange, 
  type = 'text', 
  placeholder,
  required = false,
  theme = 'light'
}: { 
  label: string; 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  type?: string;
  placeholder?: string;
  required?: boolean;
  theme?: 'light' | 'glass';
}) => (
  <div className="space-y-1.5">
    <label className={cn("text-sm font-bold ml-1", theme === 'glass' ? "text-white/90" : "text-gray-700")}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className={cn(
        "w-full px-4 py-3 rounded-2xl outline-none transition-all font-medium",
        theme === 'glass' 
          ? "bg-white/5 border border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-white/30 focus:border-white/40"
          : "bg-gray-50 border border-gray-100 text-gray-900 focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-gray-400"
      )}
    />
  </div>
);

// --- Main App ---

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rondas' | 'locais' | 'usuarios' | 'logs'>('rondas');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Auth States
  const [authMode, setAuthMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    setLoading(true);
    const user = getStoredUser();
    if (user) {
      try {
        const freshUser = await api.get<UserProfile>('/auth/me');
        if (freshUser) {
          setProfile(freshUser);
        } else {
          clearSession();
          setProfile(null);
        }
      } catch (err) {
        clearSession();
        setProfile(null);
      }
    } else {
      setProfile(null);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const data = await api.post<{ token: string; user: UserProfile }>('/auth/login', {
        email,
        password,
      });
      saveSession(data.token, data.user);
      setProfile(data.user);
    } catch (error: any) {
      console.error('Erro no login:', error);
      setAuthError(error.error || 'E-mail ou senha incorretos.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setAuthSuccess('Se este e-mail estiver cadastrado, você receberá um link em instantes.');
    } catch (error: any) {
      console.error('Erro ao recuperar senha:', error);
      setAuthError('Erro ao enviar e-mail. Tente novamente mais tarde.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (err) {
      // ignore
    }
    clearSession();
    setProfile(null);
    setIsMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #010d1f 0%, #021833 40%, #042d5a 70%, #063a72 100%)' }}
      >
        {/* Animated orbs */}
        <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-30 animate-pulse"
          style={{ background: 'radial-gradient(circle, #1d6db5 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)' }} />
        <div className="absolute top-[30%] right-[5%] w-[300px] h-[300px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)' }} />

        {/* Grid overlay texture */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-sm"
        >
          {/* Glass card */}
          <div className="rounded-[2rem] p-8 space-y-7"
            style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)'
            }}
          >
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <img src="/logo.png" alt="RondaDigital" className="h-20 object-contain drop-shadow-[0_0_24px_rgba(56,189,248,0.5)]" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Bem-vindo</h1>
                <p className="text-sm text-sky-300/80 font-medium mt-0.5">Segurança e Controle em Tempo Real</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {authMode === 'login' && (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  onSubmit={handleLogin}
                  className="space-y-5"
                >
                  <Input label="E-mail" type="email" theme="glass" value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />

                  <div className="space-y-1">
                    <Input label="Senha" type="password" theme="glass" value={password}
                      onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                    <div className="flex justify-end pt-1">
                      <button type="button" onClick={() => setAuthMode('forgot')}
                        className="text-xs text-sky-300 font-medium hover:text-white transition-colors hover:underline">
                        Esqueceu a senha?
                      </button>
                    </div>
                  </div>

                  {authError && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl flex items-center gap-2 text-xs font-medium text-red-200"
                      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <AlertCircle size={14} className="text-red-400 shrink-0" />
                      {authError}
                    </motion.div>
                  )}

                  <button type="submit" disabled={authLoading}
                    className="w-full py-4 rounded-2xl text-sm font-bold text-white tracking-wide transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: authLoading ? 'rgba(37,99,235,0.5)' : 'linear-gradient(135deg, #1d6db5 0%, #0ea5e9 100%)',
                      boxShadow: authLoading ? 'none' : '0 8px 24px rgba(14,165,233,0.35)'
                    }}>
                    {authLoading ? 'Entrando...' : 'Entrar no Sistema'}
                  </button>
                </motion.form>
              )}

              {authMode === 'forgot' && (
                <motion.form
                  key="forgot"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  onSubmit={handleForgotPassword}
                  className="space-y-5"
                >
                  <div className="text-center space-y-1">
                    <h2 className="text-lg font-bold text-white">Recuperar Senha</h2>
                    <p className="text-sm text-sky-300/80">Insira seu e-mail para receber as instruções.</p>
                  </div>

                  <Input label="E-mail" type="email" theme="glass" value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />

                  {authError && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl flex items-center gap-2 text-xs font-medium text-red-200"
                      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <AlertCircle size={14} className="text-red-400 shrink-0" />
                      {authError}
                    </motion.div>
                  )}

                  {authSuccess && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl flex items-center gap-2 text-xs font-medium text-green-200"
                      style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                      {authSuccess}
                    </motion.div>
                  )}

                  <button type="submit" disabled={authLoading}
                    className="w-full py-4 rounded-2xl text-sm font-bold text-white tracking-wide transition-all disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #1d6db5 0%, #0ea5e9 100%)', boxShadow: '0 8px 24px rgba(14,165,233,0.35)' }}>
                    {authLoading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                  </button>

                  <button type="button" onClick={() => setAuthMode('login')}
                    className="w-full text-center text-sm text-sky-300 font-medium hover:text-white transition-colors">
                    ← Voltar para o Login
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }


  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Header - Full Width */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 md:px-6 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <img src="https://storage.googleapis.com/static.antigravity.dev/0656e3d7-6399-4bbe-b236-1adaac3acdfc/attachment/66736c5d-352b-4029-8736-235b3644f77c.png" alt="RondaDigital" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold text-gray-900 tracking-tight">RondaDigital</span>
          </div>
          <div className="hidden md:block h-6 w-px bg-gray-200 mx-2" />
          <div className="hidden md:block text-sm text-gray-500 font-medium">
            Painel de Controle de Rondas
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleLogout} className="flex items-center gap-2 text-gray-500 hover:text-red-600 hover:bg-red-50 px-3">
            <span className="hidden sm:inline text-sm font-medium">Sair</span>
            <LogOut size={20} />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Desktop */}
        <motion.aside
          initial={false}
          animate={{ width: isSidebarCollapsed ? 80 : 260 }}
          className="hidden md:flex flex-col bg-[#002b5c] text-white transition-all duration-300 ease-in-out relative z-40 border-r border-white/10"
        >
          {/* Collapse Toggle Button - Edge */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3 top-8 h-6 w-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-600 shadow-sm hover:bg-gray-50 z-50 flex"
          >
            {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          <nav className="flex-1 px-3 space-y-2 mt-6">
            <NavItems 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              role={profile?.role} 
              collapsed={isSidebarCollapsed}
            />
          </nav>

        <div className="p-4 border-t border-white/10 bg-black/10 relative">
          <div className="flex flex-col gap-4">
            <div className={cn("flex items-center gap-3", isSidebarCollapsed ? "justify-center" : "px-2")}>
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold shrink-0 border border-white/20 shadow-inner">
                {profile?.displayName?.[0]}
              </div>
              {!isSidebarCollapsed && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-sm font-bold truncate text-white">{profile?.displayName}</p>
                  <p className="text-xs text-blue-200 capitalize truncate">{profile?.role}</p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
        </motion.aside>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                className="fixed top-0 left-0 bottom-0 w-72 bg-[#002b5c] text-white z-50 md:hidden p-6 flex flex-col"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <img src="https://storage.googleapis.com/static.antigravity.dev/0656e3d7-6399-4bbe-b236-1adaac3acdfc/attachment/66736c5d-352b-4029-8736-235b3644f77c.png" alt="RondaDigital" className="w-8 h-8 object-contain" />
                    <span className="text-xl font-bold">RondaDigital</span>
                  </div>
                  <button onClick={() => setIsMenuOpen(false)}>
                    <X size={24} />
                  </button>
                </div>
                <nav className="flex-1 space-y-2">
                  <NavItems 
                    activeTab={activeTab} 
                    setActiveTab={(tab) => { setActiveTab(tab); setIsMenuOpen(false); }} 
                    role={profile?.role} 
                    mobile 
                  />
                </nav>
                <div className="pt-6 border-t border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                      {profile?.displayName?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{profile?.displayName}</p>
                      <p className="text-xs text-blue-200 capitalize">{profile?.role}</p>
                    </div>
                  </div>
                  <Button variant="secondary" onClick={handleLogout} className="w-full bg-white/10 border-none text-white hover:bg-white/20">
                    Sair do Sistema
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'rondas' && <RondasView profile={profile} />}
            {activeTab === 'locais' && profile?.role === 'admin' && <LocaisView />}
            {activeTab === 'usuarios' && profile?.role === 'admin' && <UsuariosView />}
            {activeTab === 'logs' && profile?.role === 'admin' && <LogsView />}
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItems({ activeTab, setActiveTab, role, mobile, collapsed }: { 
  activeTab: string; 
  setActiveTab: (tab: any) => void; 
  role?: UserRole;
  mobile?: boolean;
  collapsed?: boolean;
}) {
  const items = [
    { id: 'rondas', label: 'Rondas', icon: QrCode },
    ...(role === 'admin' ? [
      { id: 'locais', label: 'Locais', icon: MapPin },
      { id: 'usuarios', label: 'Usuários', icon: Users },
      { id: 'logs', label: 'Relatórios', icon: History },
    ] : [])
  ];

  return (
    <div className={cn("flex flex-col gap-2")}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={cn(
            "flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all group relative overflow-hidden",
            activeTab === item.id 
              ? "bg-primary text-white shadow-lg shadow-primary/30" 
              : "text-blue-100 hover:bg-white/10",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? item.label : undefined}
        >
          {activeTab === item.id && (
            <motion.div 
              layoutId="activeTab"
              className="absolute inset-0 bg-primary"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          <item.icon size={22} className={cn("shrink-0 relative z-10", activeTab === item.id ? "text-white" : "text-blue-300 group-hover:text-white")} />
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="whitespace-nowrap relative z-10"
            >
              {item.label}
            </motion.span>
          )}
        </button>
      ))}
    </div>
  );
}

// --- Views ---

function RondasView({ profile }: { profile: UserProfile | null }) {
  const [locais, setLocais] = useState<Location[]>([]);
  const [scannedToday, setScannedToday] = useState<string[]>([]);
  const [userLogs, setUserLogs] = useState<ScanLog[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Filters for the table
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const fetchData = async () => {
    try {
      const fetchedLocais = await api.get<Location[]>('/locais');
      setLocais(fetchedLocais || []);
    } catch (err) {
      console.error('Erro ao buscar locais:', err);
    }

    if (!profile?.uid) return;

    try {
      const [todayIds, logs] = await Promise.all([
        api.get<string[]>('/logs/today'),
        api.get<ScanLog[]>('/logs/my')
      ]);
      setScannedToday(todayIds || []);
      setUserLogs(logs || []);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    }
  };

  const filteredLogs = userLogs.filter(log => {
    const matchesSearch = log.locationName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !dateFilter || log.timestamp.startsWith(dateFilter);
    const matchesLocation = !locationFilter || log.locationName === locationFilter;
    return matchesSearch && matchesDate && matchesLocation;
  });

  const onScanSuccess = async (decodedText: string) => {
    setScanStatus('scanning');
    
    try {
      const log = await api.post<ScanLog>('/logs', { qrValue: decodedText });
      setScanStatus('success');
      setSuccessMsg(`Ronda registrada em: ${log.locationName}`);
      setTimeout(() => {
        setScanning(false);
        setScanStatus('idle');
        setSuccessMsg(null);
        fetchData(); // atualiza a lista após escanear
      }, 2000);
    } catch (err: any) {
      setScanStatus('error');
      setErrorMsg(err.error || 'QR Code inválido ou local não cadastrado.');
      setTimeout(() => setScanStatus('idle'), 3000);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Minhas Rondas</h2>
          <p className="text-gray-500 font-medium">Gerencie suas atividades e consulte seu histórico.</p>
        </div>
        <Button onClick={() => setScanning(true)} className="py-4 px-6 rounded-2xl text-lg">
          <Camera size={24} />
          Escanear QR Code
        </Button>
      </div>

      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-secondary text-white px-6 py-4 rounded-3xl flex items-center gap-3 font-bold shadow-xl shadow-secondary/20"
        >
          <CheckCircle2 size={24} />
          {successMsg}
        </motion.div>
      )}

      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-600 text-white px-6 py-4 rounded-3xl flex items-center gap-3 font-bold shadow-xl shadow-red-600/20"
        >
          <AlertCircle size={24} />
          {errorMsg}
        </motion.div>
      )}

      {/* Histórico de Rondas do Usuário */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-xl font-black text-gray-900 tracking-tight">Meu Histórico de Rondas</h3>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                placeholder="Buscar local..." 
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button 
              variant="ghost" 
              onClick={() => setShowFilters(!showFilters)}
              className={cn("gap-2 border border-gray-200", showFilters && "bg-primary/5 border-primary text-primary")}
            >
              <Filter size={18} />
              Filtros
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Card className="p-4 bg-gray-50/50 border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Data</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="date" 
                      className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Local</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select 
                      className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                    >
                      <option value="">Todos os locais</option>
                      {locais.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="overflow-hidden border-none shadow-sm rounded-3xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Local</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Data/Hora</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-16 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-4">
                        <History size={48} className="opacity-20" />
                        <p className="font-medium">Nenhum registro de ronda encontrado.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/30 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-2xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                            <MapPin size={20} />
                          </div>
                          <span className="font-bold text-gray-900">{log.locationName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-gray-900 tracking-tight">
                            {format(new Date(log.timestamp), "dd/MM/yyyy")}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            {format(new Date(log.timestamp), "HH:mm:ss")}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-secondary bg-secondary/10 px-3 py-1 rounded-full border border-secondary/20">
                          <CheckCircle2 size={12} />
                          Realizada
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {scanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setScanning(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white rounded-[2rem] p-6 w-full max-w-[380px] relative z-10 shadow-2xl overflow-hidden mx-auto"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-accent to-secondary" />
            
            <button 
              onClick={() => setScanning(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex p-3 bg-primary/5 rounded-2xl text-primary mb-3">
                <Camera size={24} />
              </div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Escanear Local</h3>
              <p className="text-sm text-gray-500 font-medium">Aponte para o QR Code do local.</p>
            </div>

            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-[1.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000 group-hover:duration-200"></div>
              <div id="reader" className={cn(
                "relative overflow-hidden rounded-[1.2rem] border-2 border-gray-100 shadow-lg bg-gray-900 aspect-square transition-all duration-500",
                scanStatus === 'success' && "border-secondary shadow-secondary/10",
                scanStatus === 'error' && "border-red-500 shadow-red-500/10"
              )}>
                {/* Scanner will be rendered here */}
                <AnimatePresence>
                  {scanStatus === 'success' && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 z-30 bg-secondary/95 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 text-center"
                    >
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="bg-white text-secondary rounded-full p-3 mb-3"
                      >
                        <CheckCircle2 size={40} />
                      </motion.div>
                      <h4 className="text-lg font-black tracking-tight">Sucesso!</h4>
                      <p className="text-xs font-medium opacity-90">{successMsg}</p>
                    </motion.div>
                  )}
                  {scanStatus === 'error' && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 z-30 bg-red-600/95 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 text-center"
                    >
                      <motion.div
                        initial={{ scale: 0, rotate: 45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="bg-white text-red-600 rounded-full p-3 mb-3"
                      >
                        <AlertCircle size={40} />
                      </motion.div>
                      <h4 className="text-lg font-black tracking-tight">Erro</h4>
                      <p className="text-xs font-medium opacity-90">{errorMsg}</p>
                      <Button 
                        variant="ghost" 
                        onClick={() => setScanStatus('idle')}
                        className="mt-3 text-white hover:bg-white/20 border border-white/30 h-8 text-xs"
                      >
                        Tentar Novamente
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Scanning Line Animation */}
              {scanStatus === 'idle' && (
                <motion.div 
                  animate={{ top: ['15%', '85%', '15%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                  className="absolute left-3 right-3 h-0.5 bg-primary/40 shadow-[0_0_10px_rgba(0,43,92,0.6)] z-20 pointer-events-none"
                />
              )}
            </div>

            <div className="mt-6 flex items-center justify-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <div className="flex items-center gap-1">
                <ShieldCheck size={12} className="text-secondary" />
                Seguro
              </div>
              <div className="w-1 h-1 rounded-full bg-gray-200" />
              <div className="flex items-center gap-1">
                <QrCode size={12} className="text-primary" />
                RondaDigital
              </div>
            </div>

            <Scanner onScanSuccess={onScanSuccess} />
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Scanner({ onScanSuccess }: { onScanSuccess: (text: string) => void }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    }, false);

    scanner.render(onScanSuccess, (err) => {});

    return () => {
      scanner.clear().catch(error => console.error("Failed to clear scanner", error));
    };
  }, []);

  return null;
}

function LocaisView() {
  const [locais, setLocais] = useState<Location[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<Location | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedLocal, setSelectedLocal] = useState<Location | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchLocais();
  }, []);

  const fetchLocais = async () => {
    try {
      const data = await api.get<Location[]>('/locais');
      setLocais(data || []);
    } catch (err) {
      console.error('Erro ao buscar locais:', err);
    }
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const qrValue = `vigi-${Math.random().toString(36).substr(2, 9)}`;
    try {
      await api.post('/locais', {
        name,
        description: desc,
        qrValue
      });
      setName('');
      setDesc('');
      setIsAdding(false);
      showFeedback('success', 'Local cadastrado com sucesso!');
      fetchLocais();
    } catch (err) {
      console.error('Erro ao cadastrar local:', err);
      showFeedback('error', 'Erro ao cadastrar local.');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;
    try {
      await api.put(`/locais/${isEditing.id}`, {
        name,
        description: desc
      });
      setIsEditing(null);
      setName('');
      setDesc('');
      showFeedback('success', 'Local atualizado com sucesso!');
      fetchLocais();
    } catch (err) {
      console.error('Erro ao atualizar local:', err);
      showFeedback('error', 'Erro ao atualizar local.');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/locais/${confirmDelete}`);
      setConfirmDelete(null);
      showFeedback('success', 'Local excluído com sucesso!');
      fetchLocais();
    } catch (err) {
      console.error('Erro ao excluir local:', err);
      showFeedback('error', 'Erro ao excluir local.');
    }
  };

  const handleDownloadQR = (local: Location) => {
    const svg = document.getElementById(`qr-${local.id}`);
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 500;
      canvas.height = 500;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 50, 50, 400, 400);
        
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `QRCode-${local.name}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Gestão de Locais</h2>
          <p className="text-gray-500 font-medium">Cadastre e gerencie os pontos de ronda.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-2xl border border-gray-100 flex shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-xl transition-all",
                viewMode === 'grid' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <LayoutGrid size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-xl transition-all",
                viewMode === 'list' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <List size={20} />
            </button>
          </div>
          <Button onClick={() => { setName(''); setDesc(''); setIsAdding(true); }} className="py-3 px-6 rounded-2xl">
            <Plus size={20} />
            Novo Local
          </Button>
        </div>
      </div>

      {feedback && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "p-4 rounded-3xl flex items-center gap-3 border shadow-lg font-bold",
            feedback.type === 'success' ? "bg-secondary text-white border-none" : "bg-red-600 text-white border-none"
          )}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          <span>{feedback.message}</span>
        </motion.div>
      )}

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locais.map((local) => (
            <Card key={local.id} className="p-6 space-y-4 hover:shadow-xl transition-all group border-none bg-white rounded-3xl relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="text-xl font-black text-gray-900 truncate tracking-tight">{local.name}</h3>
                  <p className="text-sm text-gray-500 font-medium line-clamp-2 mt-1">{local.description}</p>
                </div>
                <Button variant="ghost" onClick={() => setSelectedLocal(local)} className="h-12 w-12 shrink-0 bg-primary/5 text-primary hover:bg-primary/10 rounded-2xl border border-primary/10">
                  <QrCode size={24} />
                </Button>
              </div>
              
              <div className="pt-6 border-t border-gray-50 flex justify-between items-center">
                <div className="flex gap-2">
                  <button 
                    className="h-10 w-10 flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors border border-blue-100"
                    onClick={() => {
                      setName(local.name);
                      setDesc(local.description);
                      setIsEditing(local);
                    }}
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    className="h-10 w-10 flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors border border-red-100"
                    onClick={() => setConfirmDelete(local.id)}
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">ID: {local.id.slice(0, 6)}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden border-none shadow-sm rounded-3xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Local</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Descrição</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {locais.map((local) => (
                  <tr key={local.id} className="hover:bg-gray-50/30 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                          <MapPin size={20} />
                        </div>
                        <span className="font-bold text-gray-900">{local.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm text-gray-500 font-medium line-clamp-1">{local.description}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          className="p-2 bg-primary/5 text-primary hover:bg-primary/10 rounded-xl transition-colors border border-primary/10"
                          onClick={() => setSelectedLocal(local)}
                          title="Ver QR Code"
                        >
                          <QrCode size={18} />
                        </button>
                        <button 
                          className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors border border-blue-100"
                          onClick={() => {
                            setName(local.name);
                            setDesc(local.description);
                            setIsEditing(local);
                          }}
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors border border-red-100"
                          onClick={() => setConfirmDelete(local.id)}
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {locais.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">Nenhum local cadastrado.</p>
            <p className="text-sm text-gray-400">Clique em "Novo Local" para começar.</p>
          </div>
        )}

      {/* Add/Edit Modal */}
      {(isAdding || isEditing) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md w-full"
          >
            <Card className="p-6 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {isAdding ? 'Cadastrar Novo Local' : 'Editar Local'}
                </h3>
                <button onClick={() => { setIsAdding(false); setIsEditing(null); }} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={isAdding ? handleAdd : handleEdit} className="space-y-4">
                <Input 
                  label="Nome do Local" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                  placeholder="Ex: Portaria Norte" 
                />
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Descrição</label>
                  <textarea 
                    value={desc} 
                    onChange={e => setDesc(e.target.value)} 
                    placeholder="Ex: Entrada principal de veículos"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all min-h-[100px] resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" className="flex-1" type="button" onClick={() => { setIsAdding(false); setIsEditing(null); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    {isAdding ? 'Salvar Local' : 'Atualizar'}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-sm w-full"
          >
            <Card className="p-6 text-center space-y-6 shadow-2xl">
              <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900">Confirmar Exclusão</h3>
                <p className="text-gray-500">Tem certeza que deseja excluir este local? Esta ação não pode ser desfeita.</p>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                <Button variant="danger" className="flex-1" onClick={handleDelete}>Excluir</Button>
              </div>
            </Card>
          </motion.div>
        </div>
      )}

      {/* QR Modal */}
      {selectedLocal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-sm w-full"
          >
            <Card className="p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div id="print-section" className="space-y-6">
                <button 
                  onClick={() => setSelectedLocal(null)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 no-print"
                >
                  <X size={24} />
                </button>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-gray-900">{selectedLocal.name}</h3>
                  <p className="text-sm text-gray-500">QR Code de Identificação</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border-2 border-gray-50 inline-block shadow-inner">
                  <QRCodeSVG id={`qr-${selectedLocal.id}`} value={selectedLocal.qrValue} size={200} level="H" includeMargin={true} />
                </div>
                <div className="bg-gray-50 p-2 rounded-lg">
                  <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">{selectedLocal.qrValue}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 no-print">
                <Button onClick={() => handleDownloadQR(selectedLocal)} className="w-full bg-indigo-600 hover:bg-indigo-700">
                  <Download size={18} />
                  Baixar Imagem (PNG)
                </Button>
                <Button variant="secondary" onClick={() => window.print()} className="w-full">
                  Imprimir
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function UsuariosView() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('vigilante');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await api.get<UserProfile[]>('/users');
      setUsers(data || []);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    }
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', {
        email: newEmail,
        displayName: newName,
        role: newRole
      });
      showFeedback('success', 'Usuário pré-cadastrado! Ele deve entrar com este email.');
      setIsAdding(false);
      setNewName('');
      setNewEmail('');
      fetchUsers();
    } catch (err: any) {
      console.error('Erro ao cadastrar usuário:', err);
      showFeedback('error', err.error || 'Erro ao cadastrar usuário.');
    }
  };

  const toggleRole = async (user: UserProfile) => {
    const newRole: UserRole = user.role === 'admin' ? 'vigilante' : 'admin';
    try {
      await api.put(`/users/${user.uid}/role`, { role: newRole });
      showFeedback('success', `Nível de ${user.displayName} alterado para ${newRole}.`);
      fetchUsers();
    } catch (err: any) {
      console.error('Erro ao alterar nível:', err);
      showFeedback('error', err.error || 'Erro ao alterar nível.');
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Gestão de Usuários</h2>
          <p className="text-gray-500 font-medium">Cadastre e gerencie a equipe do sistema.</p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="py-3 px-6 rounded-2xl">
          <UserPlus size={20} />
          Novo Usuário
        </Button>
      </div>

      {feedback && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "p-4 rounded-3xl flex items-center gap-3 border shadow-lg font-bold",
            feedback.type === 'success' ? "bg-secondary text-white border-none" : "bg-red-600 text-white border-none"
          )}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          <span>{feedback.message}</span>
        </motion.div>
      )}

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
        <input 
          type="text"
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-3xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm font-medium placeholder:text-gray-400"
        />
      </div>

      <Card className="overflow-hidden border-none shadow-sm rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nome</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Email</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nível</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {filteredUsers.map((u) => (
                <tr key={u.uid} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="h-11 w-11 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-lg border border-primary/10 shadow-sm">
                        {u.displayName?.[0]}
                      </div>
                      <div>
                        <span className="font-black text-gray-900 block tracking-tight">{u.displayName}</span>
                        {(u as any).isPending && (
                          <span className="text-[9px] text-amber-600 font-black uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            Pendente
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-500 font-medium">{u.email}</td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-black capitalize inline-flex items-center gap-2 border",
                      u.role === 'admin' ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary/10 text-secondary border-secondary/20"
                    )}>
                      <div className={cn("h-1.5 w-1.5 rounded-full", u.role === 'admin' ? "bg-primary" : "bg-secondary")} />
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Button 
                      variant="ghost" 
                      className="text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl px-4 py-2" 
                      onClick={() => toggleRole(u)}
                    >
                      Alterar Nível
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add User Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md w-full"
          >
            <Card className="p-6 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Novo Usuário</h3>
                <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="space-y-4">
                <Input 
                  label="Nome Completo" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  required 
                  placeholder="Ex: João Silva" 
                />
                <Input 
                  label="Email" 
                  type="email"
                  value={newEmail} 
                  onChange={e => setNewEmail(e.target.value)} 
                  required 
                  placeholder="Ex: joao@empresa.com" 
                />
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Nível de Acesso</label>
                  <select 
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-primary transition-all bg-white"
                  >
                    <option value="vigilante">Vigilante</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" className="flex-1" type="button" onClick={() => setIsAdding(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Cadastrar
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function LogsView() {
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVigilante, setSelectedVigilante] = useState<string>('all');
  const [selectedLocal, setSelectedLocal] = useState<string>('all');
  const [uniqueVigilantes, setUniqueVigilantes] = useState<{id: string, name: string}[]>([]);
  const [uniqueLocais, setUniqueLocais] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      try {
        const url = `/logs?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
        const logsData = await api.get<ScanLog[]>(url) || [];
        setLogs(logsData);

        // Extract unique vigilantes and locations for filters
        const vMap = new Map();
        const lMap = new Map();
        logsData.forEach(log => {
          vMap.set(log.userId, log.userName);
          lMap.set(log.locationId, log.locationName);
        });
        setUniqueVigilantes(Array.from(vMap.entries()).map(([id, name]) => ({ id, name })));
        setUniqueLocais(Array.from(lMap.entries()).map(([id, name]) => ({ id, name })));
      } catch (err) {
        console.error('Erro ao buscar logs:', err);
      }
    };
    
    fetchLogs();
  }, [startDate, endDate]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userName?.toLowerCase().includes(search.toLowerCase()) || 
      log.locationName?.toLowerCase().includes(search.toLowerCase());
    const matchesVigilante = selectedVigilante === 'all' || log.userId === selectedVigilante;
    const matchesLocal = selectedLocal === 'all' || log.locationId === selectedLocal;
    return matchesSearch && matchesVigilante && matchesLocal;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Relatórios de Rondas</h2>
          <p className="text-gray-500 font-medium">Consulte relatórios e exporte dados históricos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="secondary" 
            onClick={() => setShowFilters(!showFilters)}
            className={cn("py-3 px-6 rounded-2xl gap-2", showFilters && "bg-indigo-50 text-indigo-600 border-indigo-200")}
          >
            <Filter size={18} />
            {showFilters ? 'Ocultar Filtros' : 'Filtros Avançados'}
          </Button>
          <Button onClick={() => window.print()} variant="ghost" className="py-3 px-6 rounded-2xl text-gray-500">
            <Download size={18} />
            Exportar
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text"
            placeholder="Buscar por vigilante ou local..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-3xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm font-medium placeholder:text-gray-400"
          />
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Card className="p-6 bg-primary/5 border-primary/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 rounded-3xl">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 ml-1">
                    <CalendarIcon size={12} /> Início
                  </label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-primary/10 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 ml-1">
                    <CalendarIcon size={12} /> Fim
                  </label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-primary/10 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 ml-1">
                    <Users size={12} /> Vigilante
                  </label>
                  <select 
                    value={selectedVigilante}
                    onChange={e => setSelectedVigilante(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-primary/10 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all font-medium appearance-none"
                  >
                    <option value="all">Todos os Vigilantes</option>
                    {uniqueVigilantes.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 ml-1">
                    <MapPin size={12} /> Local
                  </label>
                  <select 
                    value={selectedLocal}
                    onChange={e => setSelectedLocal(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-primary/10 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all font-medium appearance-none"
                  >
                    <option value="all">Todos os Locais</option>
                    {uniqueLocais.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Card className="overflow-hidden border-none shadow-sm rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Vigilante</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Local</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Data/Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-4">
                      <Search size={48} className="opacity-20" />
                      <p className="font-medium">Nenhum registro encontrado para os filtros selecionados.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/30 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-11 w-11 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-lg border border-primary/10 shadow-sm">
                          {log.userName?.[0]}
                        </div>
                        <div>
                          <p className="font-black text-gray-900 tracking-tight">{log.userName}</p>
                          <p className="text-[10px] text-gray-400 font-medium">{log.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-secondary" />
                        <span className="font-bold text-gray-700">{log.locationName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-900 tracking-tight">
                          {format(new Date(log.timestamp), "dd/MM/yyyy")}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          {format(new Date(log.timestamp), "HH:mm:ss")}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
