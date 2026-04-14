import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, getStoredUser, saveSession, clearSession } from './api';
import type {
  UserProfile, Company, EmpresaTerceiro, TipoTreinamento,
  TipoAtividade, Pessoa, PresencaLog, TreinamentoPessoa, StatusAcesso
} from './types';
import {
  LogOut, Users, Building2, ShieldCheck, ClipboardList, Settings,
  Plus, Trash2, Pencil, Eye, EyeOff, Search, ChevronLeft, ChevronRight,
  Menu, X, AlertTriangle, CheckCircle2, XCircle, Clock, Camera,
  Upload, ArrowRightCircle, ArrowLeftCircle, RefreshCw, BookOpen,
  Briefcase, UserCog, Bell, Home
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try {
    const parsed = parseISO(d);
    return isValid(parsed) ? format(parsed, 'dd/MM/yyyy', { locale: ptBR }) : '—';
  } catch { return '—'; }
}

function statusLabel(s?: StatusAcesso) {
  if (s === 'liberado') return 'Acesso Liberado';
  if (s === 'a_vencer') return 'A Vencer';
  if (s === 'bloqueado') return 'Acesso Bloqueado';
  return '—';
}

function StatusBadge({ status }: { status?: StatusAcesso }) {
  const cfg = {
    liberado: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Liberado' },
    a_vencer: { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'A Vencer' },
    bloqueado:{ bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500',      label: 'Bloqueado' },
  }[status ?? 'liberado'] ?? { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: '—' };

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold', cfg.bg, cfg.text)}>
      <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ─── UI Primitives ───────────────────────────────────────────────────────────

function Button({ children, onClick, variant = 'primary', className, disabled, type = 'button', size = 'md' }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  className?: string; disabled?: boolean; type?: 'button' | 'submit' | 'reset'; size?: 'sm' | 'md';
}) {
  const v = {
    primary:   'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
    secondary: 'bg-slate-700 text-white hover:bg-slate-800 shadow-sm',
    danger:    'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    success:   'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    ghost:     'bg-transparent text-slate-600 hover:bg-slate-100',
  }[variant];
  const s = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={cn('rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed', v, s, className)}>
      {children}
    </button>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder, required, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; hint?: string;
}) {
  const [show, setShow] = useState(false);
  const inputType = type === 'password' ? (show ? 'text' : 'password') : type;
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <div className="relative">
        <input type={inputType} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400" />
        {type === 'password' && (
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Select({ label, value, onChange, children, required }: {
  label: string; value: string; onChange: (v: string) => void;
  children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <select value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
        {children}
      </select>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer gap-3">
      <span className="text-sm text-slate-700">{label}</span>
      <div onClick={() => onChange(!checked)} className={cn('relative w-10 h-6 rounded-full transition-colors', checked ? 'bg-blue-600' : 'bg-slate-200')}>
        <div className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all', checked ? 'left-5' : 'left-1')} />
      </div>
    </label>
  );
}

function Modal({ title, onClose, children, size = 'md' }: {
  title: string; onClose: () => void; children: React.ReactNode; size?: 'md' | 'lg' | 'xl';
}) {
  const widths = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className={cn('bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto', widths[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </motion.div>
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string; key?: React.Key }) {
  return <div className={cn('bg-white rounded-2xl border border-slate-100 shadow-sm', className)}>{children}</div>;
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon size={24} className="text-slate-400" />
      </div>
      <p className="font-semibold text-slate-600 mb-1">{title}</p>
      {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
    </div>
  );
}

// ─── Login ───────────────────────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMsg('');
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotMsg('Link enviado! Verifique seu e-mail.');
    } catch (err: any) { setForgotMsg(err.error || 'Erro ao enviar.'); }
    finally { setForgotLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.post<{ token: string; user: UserProfile }>('/auth/login', { email, password });
      saveSession(data.token, data.user);
      onLogin(data.user);
    } catch (err: any) {
      setError(err.error || 'E-mail ou senha incorretos.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#001A33]">
      {/* Dark blue background with subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#000d1a] via-[#001A33] to-[#000a14]" />

      {/* Background Decor */}
      <div className="absolute inset-0 bg-grid-tech opacity-30" />
      
      {/* Background glows */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3] 
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] bg-blue-500/20 mix-blend-screen" 
      />
      
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2] 
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[150px] bg-sky-400/10 mix-blend-screen" 
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl p-10 border border-white">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center">
              <img src="/LogoCompleto.png" alt="PortALL" className="h-28 w-auto object-contain" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input label="E-mail" type="email" value={email} onChange={setEmail} placeholder="usuario@empresa.com" required />
            
            <div className="space-y-2">
              <Input label="Senha" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />
              <div className="flex justify-end">
                <button type="button" onClick={() => setShowForgot(true)} className="text-[10px] font-black text-blue-600 hover:text-indigo-700 transition-colors uppercase tracking-widest">
                  Esqueci minha senha
                </button>
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-600 font-medium">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {error}
              </motion.div>
            )}

            <div className="pt-2">
              <button type="submit" disabled={loading}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-60 shadow-xl shadow-blue-500/25 active:scale-95">
                {loading ? 'Autenticando...' : 'Entrar no Sistema'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>


      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgot && (
          <Modal title="Recuperar Senha" onClose={() => setShowForgot(false)}>
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-sm text-slate-500 leading-relaxed">
                Insira seu e-mail cadastrado para receber um link de redefinição de senha.
              </p>
              <Input label="E-mail" value={forgotEmail} onChange={setForgotEmail} placeholder="seu@email.com" required />
              {forgotMsg && (
                <p className={cn('text-xs font-bold text-center', forgotMsg.includes('enviado') ? 'text-emerald-600' : 'text-red-600')}>
                  {forgotMsg}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setShowForgot(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1" disabled={forgotLoading}>
                  {forgotLoading ? 'Enviando...' : 'Enviar Link'}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>

  );
}

function Header({ profile, onLogout }: { profile: UserProfile; onLogout: () => void }) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <img src="/LogoCompleto.png" alt="PortALL Logo" className="h-10 w-auto object-contain" />
      </div>
      
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>
        <div className="h-8 w-[1px] bg-slate-100 mx-1" />
        <button onClick={onLogout} className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all group" title="Sair do sistema">
          <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </header>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

type TabId = 'portaria' | 'pessoas' | 'empresas_terceiro' | 'treinamentos' | 'atividades' | 'companies' | 'usuarios';

function Sidebar({ activeTab, setActiveTab, profile, collapsed, setCollapsed }: {
  activeTab: TabId; setActiveTab: (t: TabId) => void;
  profile: UserProfile; collapsed: boolean; setCollapsed: (v: boolean) => void;
}) {
  const items: { id: TabId; label: string; icon: any; roles: string[]; category: 'NAVEGAÇÃO' | 'CADASTROS' | 'CONFIGURAÇÕES' }[] = [
    { id: 'portaria',        label: 'Portaria',           icon: Home,        roles: ['master','admin','viewer'], category: 'NAVEGAÇÃO' },
    { id: 'pessoas',         label: 'Visitantes e Prestadores', icon: Users, roles: ['master','admin'],          category: 'NAVEGAÇÃO' },
    { id: 'empresas_terceiro',label:'Provedores',           icon: Building2,   roles: ['master','admin'],          category: 'CADASTROS' },
    { id: 'treinamentos',    label: 'Treinamentos',         icon: BookOpen,   roles: ['master','admin'],          category: 'CADASTROS' },
    { id: 'atividades',      label: 'Profissões / Funções', icon: Briefcase,   roles: ['master','admin'],          category: 'CADASTROS' },
    { id: 'companies',       label: 'Empresas',             icon: ShieldCheck, roles: ['master', 'admin'],          category: 'CONFIGURAÇÕES' },
    { id: 'usuarios',        label: 'Usuários do Sistema',  icon: UserCog,     roles: ['master','admin'],          category: 'CONFIGURAÇÕES' },
  ];

  const visible = items.filter(i => i.roles.includes(profile.role));

  const categories = ['NAVEGAÇÃO', 'CADASTROS', 'CONFIGURAÇÕES'] as const;

  return (
    <motion.aside 
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative h-full bg-slate-900 text-white shrink-0 z-20 group border-r border-white/5 shadow-2xl shadow-slate-900/50"
    >
      {/* Collapse toggle (The Bubble) */}
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-10 z-40 w-7 h-7 rounded-full bg-white border-2 border-slate-900 flex items-center justify-center text-slate-900 hover:bg-blue-600 hover:text-white transition-all shadow-xl hover:scale-110 active:scale-90"
      >
        {collapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
      </button>

      <div className="flex flex-col h-full overflow-hidden">
        {/* Nav */}
        <nav className="flex-1 px-3 py-6 space-y-6 overflow-y-auto custom-scrollbar">
          {categories.map(cat => {
            const catItems = visible.filter(i => i.category === cat);
            if (catItems.length === 0) return null;
            
            return (
              <div key={cat} className="space-y-1">
                <p className={cn(
                  "px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] transition-opacity duration-300 mb-2",
                  collapsed ? "opacity-0" : "opacity-100"
                )}>
                  {cat}
                </p>
                {catItems.map(item => (
                  <button key={item.id} onClick={() => setActiveTab(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold transition-all relative group/item',
                      activeTab === item.id
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                      collapsed && 'justify-center'
                    )}>
                    <item.icon size={20} className={cn("transition-transform shrink-0", activeTab === item.id ? "scale-110" : "group-hover/item:scale-110")} />
                    
                    {!collapsed && (
                      <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="truncate">
                        {item.label}
                      </motion.span>
                    )}
                    
                    {collapsed && activeTab === item.id && (
                      <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full" />
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* User Footer - Just the name */}
        <div className="p-4 bg-black/40 border-t border-white/5">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-xs font-black text-blue-400 border border-white/10 shrink-0">
              {profile.displayName?.substring(0,2).toUpperCase()}
            </div>
            {!collapsed && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="flex-1 min-w-0"
              >
                <p className="text-[11px] font-black text-slate-200 truncate uppercase tracking-wider">
                  {profile.displayName}
                </p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                  Conectado
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.aside>

  );
}

// ─── Portaria (Viewer) ────────────────────────────────────────────────────────

function PortariaView({ profile }: { profile: UserProfile }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Pessoa | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { fetchPessoas(); }, []);

  const fetchPessoas = async () => {
    try { setPessoas(await api.get<Pessoa[]>('/pessoas')); } catch {}
  };

  const filtered = pessoas.filter(p =>
    p.nomeCompleto.toLowerCase().includes(search.toLowerCase()) ||
    (p.empresaOrigemNome || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleRegistrar = async (pessoaId: string, status: 'entrada' | 'saida') => {
    setActionLoading(true);
    try {
      await api.post('/presencas', { pessoaId, status });
      setSelected(null);
      fetchPessoas();
    } catch (err: any) {
      alert(err.error || 'Erro ao registrar.');
    } finally { setActionLoading(false); }
  };

  const statusCount = {
    liberado:  pessoas.filter(p => p.statusAcesso === 'liberado').length,
    a_vencer:  pessoas.filter(p => p.statusAcesso === 'a_vencer').length,
    bloqueado: pessoas.filter(p => p.statusAcesso === 'bloqueado').length,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Portaria</h1>
        <p className="text-sm text-slate-500 mt-1">Registre a entrada e saída de visitantes e prestadores.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: 'Liberados', count: statusCount.liberado, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { label: 'A Vencer',  count: statusCount.a_vencer,  color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
          { label: 'Bloqueados',count: statusCount.bloqueado, color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200' },
        ]).map(s => (
          <Card key={s.label} className={cn('p-4 border', s.border, s.bg)}>
            <p className={cn('text-3xl font-black', s.color)}>{s.count}</p>
            <p className={cn('text-sm font-medium mt-0.5', s.color)}>{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou empresa..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => (
          <button key={p.id} onClick={() => setSelected(p)}
            className={cn(
              'bg-white rounded-2xl border-2 p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5',
              p.statusAcesso === 'liberado'  ? 'border-emerald-200 hover:border-emerald-400' :
              p.statusAcesso === 'a_vencer'  ? 'border-amber-200 hover:border-amber-400' :
                                               'border-red-200 hover:border-red-400'
            )}>
            <div className="flex items-center gap-3 mb-3">
              {p.foto ? (
                <img src={p.foto} alt={p.nomeCompleto} className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow" />
              ) : (
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white',
                  p.statusAcesso === 'liberado' ? 'bg-emerald-500' : p.statusAcesso === 'a_vencer' ? 'bg-amber-500' : 'bg-red-500')}>
                  {p.nomeCompleto[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{p.nomeCompleto}</p>
                <p className="text-xs text-slate-500 truncate">{p.empresaOrigemNome || '—'}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <StatusBadge status={p.statusAcesso} />
              <span className="text-xs text-slate-400 capitalize bg-slate-50 px-2 py-0.5 rounded-full">{p.tipoAcesso}</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full">
            <EmptyState icon={Users} title="Nenhum registro encontrado" subtitle="Tente buscar por outro nome ou empresa." />
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <Modal title="Detalhes do Acesso" onClose={() => setSelected(null)} size="lg">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-4">
                {selected.foto ? (
                  <img src={selected.foto} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200" />
                ) : (
                  <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white',
                    selected.statusAcesso === 'liberado' ? 'bg-emerald-500' : selected.statusAcesso === 'a_vencer' ? 'bg-amber-500' : 'bg-red-500')}>
                    {selected.nomeCompleto[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selected.nomeCompleto}</h3>
                  <p className="text-sm text-slate-500">{selected.empresaOrigemNome || 'Empresa não informada'}</p>
                  <div className="mt-2"><StatusBadge status={selected.statusAcesso} /></div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Tipo de Acesso', value: selected.tipoAcesso === 'visitante' ? 'Visitante' : 'Prestador de Serviço' },
                  { label: 'Documento', value: selected.documento },
                  { label: 'Responsável Interno', value: selected.responsavelInterno },
                  { label: 'Liberado Até', value: fmtDate(selected.liberadoAte) },
                  { label: 'Celular Autorizado', value: selected.celularAutorizado ? 'Sim' : 'Não' },
                  { label: 'Notebook Autorizado', value: selected.notebookAutorizado ? 'Sim' : 'Não' },
                  ...(selected.tipoAcesso === 'prestador' ? [
                    { label: 'ASO', value: fmtDate(selected.asoDataRealizacao) },
                    { label: 'EPI Obrigatório', value: selected.epiObrigatorio ? `Sim — ${selected.epiDescricao || ''}` : 'Não' },
                    { label: 'Atividade', value: selected.atividadeNome || '—' },
                  ] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 font-medium">{label}</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {/* Treinamentos */}
              {selected.tipoAcesso === 'prestador' && selected.treinamentos && selected.treinamentos.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Treinamentos</h4>
                  <div className="space-y-2">
                    {selected.treinamentos.map((t, i) => {
                      const st = t.statusTreinamento;
                      const col = st === 'Valido' ? 'text-emerald-600 bg-emerald-50' : st === 'Vencido' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50';
                      return (
                        <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{t.treinamentoNome}</p>
                            <p className="text-xs text-slate-400">Vence em: {fmtDate(t.dataVencimento)}</p>
                          </div>
                          <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', col)}>{st}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-3 pt-2">
                <Button variant="success" className="flex-1" disabled={actionLoading || selected.statusAcesso === 'bloqueado'}
                  onClick={() => handleRegistrar(selected.id, 'entrada')}>
                  <ArrowRightCircle size={18} /> Registrar Entrada
                </Button>
                <Button variant="danger" className="flex-1" disabled={actionLoading}
                  onClick={() => handleRegistrar(selected.id, 'saida')}>
                  <ArrowLeftCircle size={18} /> Registrar Saída
                </Button>
              </div>
              {selected.statusAcesso === 'bloqueado' && (
                <p className="text-xs text-red-600 text-center font-semibold">⚠️ Acesso bloqueado — entrada não permitida.</p>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Foto Uploader ────────────────────────────────────────────────────────────

function PhotoPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Foto</label>
      <div className="flex gap-3 items-end">
        <div className={cn('w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden',
          value ? 'border-blue-400' : 'border-slate-300 bg-slate-50')}>
          {value ? <img src={value} alt="foto" className="w-full h-full object-cover" /> : <Camera size={24} className="text-slate-400" />}
        </div>
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Carregar arquivo
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      </div>
    </div>
  );
}

// ─── Pessoas (Admin) ──────────────────────────────────────────────────────────

type PessoaForm = {
  tipoAcesso: string; foto: string; nomeCompleto: string; documento: string;
  empresaOrigemId: string; responsavelInterno: string; celularAutorizado: boolean;
  notebookAutorizado: boolean; liberadoAte: string; descricaoAtividade: string;
  atividadeId: string; asoDataRealizacao: string; epiObrigatorio: boolean; epiDescricao: string;
  treinamentos: { treinamentoId: string; dataRealizacao: string }[];
  companyId: string;
};

const emptyPessoaForm = (): PessoaForm => ({
  tipoAcesso: 'visitante', foto: '', nomeCompleto: '', documento: '',
  empresaOrigemId: '', responsavelInterno: '', celularAutorizado: false,
  notebookAutorizado: false, liberadoAte: '', descricaoAtividade: '',
  atividadeId: '', asoDataRealizacao: '', epiObrigatorio: false, epiDescricao: '',
  treinamentos: [],
  companyId: '',
});

function PessoasView({ profile }: { profile: UserProfile }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [empresasTerceiro, setEmpresasTerceiro] = useState<EmpresaTerceiro[]>([]);
  const [atividades, setAtividades] = useState<TipoAtividade[]>([]);
  const [treiTipos, setTreiTipos] = useState<TipoTreinamento[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Pessoa | null>(null);
  const [form, setForm] = useState<PessoaForm>(emptyPessoaForm());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [p, e, a, t, c] = await Promise.all([
        api.get<Pessoa[]>('/pessoas'),
        api.get<EmpresaTerceiro[]>('/empresas-terceiro'),
        api.get<TipoAtividade[]>('/treinamentos/atividades'),
        api.get<TipoTreinamento[]>('/treinamentos/tipos'),
        api.get<Company[]>('/companies'),
      ]);
      setPessoas(p || []);
      setEmpresasTerceiro(e || []);
      setAtividades(a || []);
      setTreiTipos(t || []);
      setCompanies(c || []);
    } catch {}
  };

  const openNew = () => { setForm(emptyPessoaForm()); setEditTarget(null); setShowForm(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/pessoas', form);
      setShowForm(false);
      fetchAll();
    } catch (err: any) { alert(err.error || 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este cadastro?')) return;
    try { await api.delete(`/pessoas/${id}`); fetchAll(); } catch (err: any) { alert(err.error || 'Erro.'); }
  };

  const addTreinamento = () => setForm(f => ({ ...f, treinamentos: [...f.treinamentos, { treinamentoId: '', dataRealizacao: '' }] }));
  const updateTreinamento = (i: number, field: string, val: string) => {
    setForm(f => ({ ...f, treinamentos: f.treinamentos.map((t, idx) => idx === i ? { ...t, [field]: val } : t) }));
  };
  const removeTreinamento = (i: number) => setForm(f => ({ ...f, treinamentos: f.treinamentos.filter((_, idx) => idx !== i) }));

  const filtered = pessoas
    .filter(p => !search || p.nomeCompleto.toLowerCase().includes(search.toLowerCase()) || (p.empresaOrigemNome || '').toLowerCase().includes(search.toLowerCase()))
    .filter(p => !filterStatus || p.statusAcesso === filterStatus);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visitantes e Prestadores</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cadastre e gerencie os acessos da sua empresa.</p>
        </div>
        <Button onClick={openNew}><Plus size={16} /> Novo Cadastro</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none">
          <option value="">Todos os status</option>
          <option value="liberado">Liberado</option>
          <option value="a_vencer">A Vencer</option>
          <option value="bloqueado">Bloqueado</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Pessoa</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Empresa Origem</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Liberado Até</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.foto ? <img src={p.foto} className="w-9 h-9 rounded-lg object-cover" alt="" />
                        : <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">{p.nomeCompleto[0]}</div>}
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{p.nomeCompleto}</p>
                        <p className="text-xs text-slate-400">{p.documento}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="text-xs capitalize bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{p.tipoAcesso}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-600">{p.empresaOrigemNome || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{fmtDate(p.liberadoAte)}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.statusAcesso} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={Users} title="Nenhum registro encontrado" />}
        </div>
      </Card>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <Modal title={editTarget ? 'Editar Cadastro' : 'Novo Cadastro'} onClose={() => setShowForm(false)} size="xl">
            <form onSubmit={handleSave} className="space-y-6">
              {/* Tipo + Foto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PhotoPicker value={form.foto} onChange={v => setForm(f => ({ ...f, foto: v }))} />
                <Select label="Tipo de Acesso" value={form.tipoAcesso} onChange={v => setForm(f => ({ ...f, tipoAcesso: v }))} required>
                  <option value="visitante">Visitante</option>
                  <option value="prestador">Prestador de Serviço</option>
                </Select>
              </div>

              {/* Dados Principais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Nome Completo" value={form.nomeCompleto} onChange={v => setForm(f => ({ ...f, nomeCompleto: v }))} required placeholder="Nome completo" />
                <Input label="RG ou CPF" value={form.documento} onChange={v => setForm(f => ({ ...f, documento: v }))} required placeholder="000.000.000-00" />
                <Select label="Empresa de Origem" value={form.empresaOrigemId} onChange={v => setForm(f => ({ ...f, empresaOrigemId: v }))}>
                  <option value="">— Selecione —</option>
                  {empresasTerceiro.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </Select>
                <Input label="Responsável Interno" value={form.responsavelInterno} onChange={v => setForm(f => ({ ...f, responsavelInterno: v }))} required placeholder="Nome do acompanhante" />
                {(profile.role === 'master' || profile.role === 'admin') && (
                  <Select label="Empresa de Acesso (Unidade)" value={form.companyId} onChange={v => setForm(f => ({ ...f, companyId: v }))} required>
                    <option value="">— Selecione —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                )}
                <Input label="Liberado Até" type="date" value={form.liberadoAte} onChange={v => setForm(f => ({ ...f, liberadoAte: v }))} />
                <Input label="Descrição da Atividade / Visita" value={form.descricaoAtividade} onChange={v => setForm(f => ({ ...f, descricaoAtividade: v }))} placeholder="Descreva o motivo do acesso" />
              </div>

              {/* Permissões */}
              <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Permissões de Acesso</h4>
                <Toggle label="Celular autorizado" checked={form.celularAutorizado} onChange={v => setForm(f => ({ ...f, celularAutorizado: v }))} />
                <Toggle label="Notebook autorizado" checked={form.notebookAutorizado} onChange={v => setForm(f => ({ ...f, notebookAutorizado: v }))} />
              </div>

              {/* Prestador específico */}
              {form.tipoAcesso === 'prestador' && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Dados do Prestador</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label="Tipo de Atividade" value={form.atividadeId} onChange={v => setForm(f => ({ ...f, atividadeId: v }))}>
                      <option value="">— Selecione —</option>
                      {atividades.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </Select>
                    <Input label="ASO — Data de Realização" type="date" value={form.asoDataRealizacao} onChange={v => setForm(f => ({ ...f, asoDataRealizacao: v }))} />
                  </div>
                  <Toggle label="EPI obrigatório" checked={form.epiObrigatorio} onChange={v => setForm(f => ({ ...f, epiObrigatorio: v }))} />
                  {form.epiObrigatorio && (
                    <Input label="Descrição do EPI" value={form.epiDescricao} onChange={v => setForm(f => ({ ...f, epiDescricao: v }))} placeholder="Ex: Bota de segurança, capacete..." />
                  )}
                  {/* Treinamentos */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-bold text-blue-600 uppercase tracking-wider">Treinamentos</h5>
                      <Button variant="ghost" size="sm" onClick={addTreinamento}><Plus size={14} /> Adicionar</Button>
                    </div>
                    <div className="space-y-2">
                      {form.treinamentos.map((t, i) => (
                        <div key={i} className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Select label="" value={t.treinamentoId} onChange={v => updateTreinamento(i, 'treinamentoId', v)}>
                              <option value="">— Tipo —</option>
                              {treiTipos.map(tt => <option key={tt.id} value={tt.id}>{tt.codigo} — {tt.nome}</option>)}
                            </Select>
                          </div>
                          <div className="flex-1">
                            <Input label="" type="date" value={t.dataRealizacao} onChange={v => updateTreinamento(i, 'dataRealizacao', v)} />
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeTreinamento(i)}><X size={14} /></Button>
                        </div>
                      ))}
                      {form.treinamentos.length === 0 && <p className="text-xs text-slate-400 italic">Nenhum treinamento adicionado.</p>}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Cadastro'}</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Generic CRUD View ─────────────────────────────────────────────────────────

function SimpleListView<T extends { id: string; name?: string; nome?: string }>({
  title, subtitle, endpoint, columns, renderForm, icon: Icon
}: {
  title: string; subtitle: string; endpoint: string;
  columns: { label: string; render: (item: T) => React.ReactNode }[];
  renderForm: (item: T | null, onSave: () => void, onClose: () => void) => React.ReactNode;
  icon: any;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<T | null>(null);

  useEffect(() => { fetchAll(); }, []);
  const fetchAll = async () => { try { setItems(await api.get<T[]>(endpoint)); } catch {} };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este item?')) return;
    try { await api.delete(`${endpoint}/${id}`); fetchAll(); } catch (err: any) { alert(err.error || 'Erro.'); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <Button onClick={() => { setEditItem(null); setShowForm(true); }}><Plus size={16} /> Novo</Button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {columns.map(c => <th key={c.label} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{c.label}</th>)}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  {columns.map((c, i) => <td key={i} className="px-4 py-3 text-sm text-slate-700">{c.render(item)}</td>)}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditItem(item); setShowForm(true); }}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <EmptyState icon={Icon} title="Nenhum item cadastrado" subtitle="Clique em Novo para adicionar." />}
        </div>
      </Card>
      <AnimatePresence>
        {showForm && (
          <Modal title={editItem ? 'Editar' : 'Novo'} onClose={() => setShowForm(false)}>
            {renderForm(editItem, () => { fetchAll(); setShowForm(false); }, () => setShowForm(false))}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Empresas Terceiro View ──────────────────────────────────────────────────

function EmpresasTerceiroView({ profile }: { profile: UserProfile }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  useEffect(() => { 
    if (profile.role === 'master' || profile.role === 'admin') {
      api.get<Company[]>('/companies').then(setCompanies); 
    }
  }, [profile.role]);

  const maskCNPJ = (v: string) => {
    v = v.replace(/\D/g, '');
    if (v.length > 14) v = v.slice(0, 14);
    if (v.length > 12) return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
    if (v.length > 8) return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4}).*/, '$1.$2.$3/$4');
    if (v.length > 5) return v.replace(/^(\d{2})(\d{3})(\d{3}).*/, '$1.$2.$3');
    if (v.length > 2) return v.replace(/^(\d{2})(\d{3}).*/, '$1.$2');
    return v;
  };

  const EmpresaForm = ({ item, onSave, onClose }: { item: EmpresaTerceiro | null; onSave: () => void; onClose: () => void }) => {
    const [name, setName] = useState(item?.name || '');
    const [cnpj, setCnpj] = useState(item?.cnpj || '');
    const [selectedCompanyId, setSelectedCompanyId] = useState(item?.companyId || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault(); setSaving(true);
      try {
        const payload = { 
          name, 
          cnpj: cnpj.replace(/\D/g, ''), 
          companyId: (profile.role === 'master' || profile.role === 'admin') ? selectedCompanyId : profile.companyId 
        };
        if (item) await api.put(`/empresas-terceiro/${item.id}`, payload);
        else await api.post('/empresas-terceiro', payload);
        onSave();
      } catch (err: any) { alert(err.error || 'Erro.'); } finally { setSaving(false); }
    };
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        {(profile.role === 'master' || profile.role === 'admin') && (
          <Select label="Companhia Mandante" value={selectedCompanyId} onChange={setSelectedCompanyId} required>
            <option value="">— Selecione a Empresa —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        )}
        <Input label="Nome da Empresa de Origem" value={name} onChange={setName} required placeholder="Ex: CTDI, Logística Express..." />
        <Input label="CNPJ" value={cnpj} onChange={v => setCnpj(maskCNPJ(v))} placeholder="00.000.000/0000-00" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Empresa'}</Button>
        </div>
      </form>
    );
  };
  return (
    <SimpleListView<EmpresaTerceiro>
      title="Provedores" subtitle="Gerencie as empresas prestadoras de serviço (terceirizadas)."
      endpoint="/empresas-terceiro" icon={Building2}
      columns={[
        { label: 'Nome / Razão Social', render: e => <span className="font-medium">{e.name}</span> },
        { label: 'CNPJ', render: e => e.cnpj || '—' },
      ]}
      renderForm={(item, onSave, onClose) => <EmpresaForm item={item as any} onSave={onSave} onClose={onClose} />}
    />
  );
}

// ─── Treinamentos View ────────────────────────────────────────────────────────

function TreinamentosView({ profile }: { profile: UserProfile }) {
  const [items, setItems] = useState<TipoTreinamento[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: '', codigo: '', validadeMeses: '12', escopo: 'personalizado', companyId: '' });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);
  const fetchAll = async () => { 
    try {
      const [t, c] = await Promise.all([api.get<TipoTreinamento[]>('/treinamentos/tipos'), api.get<Company[]>('/companies')]);
      setItems(t || []); setCompanies(c || []);
    } catch {} 
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { 
      await api.post('/treinamentos/tipos', form); 
      fetchAll(); setShowForm(false); 
      setForm({ nome: '', codigo: '', validadeMeses: '12', escopo: 'personalizado', companyId: '' }); 
    }
    catch (err: any) { alert(err.error || 'Erro.'); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Treinamentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie os treinamentos obrigatórios.</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={16} /> Novo</Button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {['Código', 'Nome', 'Validade', 'Escopo'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-sm font-bold text-blue-600">{t.codigo}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{t.nome}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{t.validadeMeses} meses</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', t.escopo === 'global' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600')}>
                      {t.escopo === 'global' ? 'Global' : 'Personalizado'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <EmptyState icon={BookOpen} title="Nenhum treinamento cadastrado" />}
        </div>
      </Card>
      <AnimatePresence>
        {showForm && (
          <Modal title="Novo Tipo de Treinamento" onClose={() => setShowForm(false)}>
            <form onSubmit={handleSave} className="space-y-4">
              <Input label="Nome" value={form.nome} onChange={v => setForm(f => ({ ...f, nome: v }))} required placeholder="Ex: Trabalho em Altura" />
              <Input label="Código" value={form.codigo} onChange={v => setForm(f => ({ ...f, codigo: v }))} required placeholder="Ex: NR35" />
              <Input label="Validade (meses)" type="number" value={form.validadeMeses} onChange={v => setForm(f => ({ ...f, validadeMeses: v }))} required />
              {profile.role === 'master' && (
                <Select label="Escopo" value={form.escopo} onChange={v => setForm(f => ({ ...f, escopo: v }))}>
                  <option value="personalizado">Personalizado (apenas esta empresa)</option>
                  <option value="global">Global (todas as empresas)</option>
                </Select>
              )}
              {(profile.role === 'master' || (profile.role === 'admin' && form.escopo === 'personalizado')) && (profile.role === 'admin' || form.escopo === 'personalizado') && (
                <Select label="Empresa Responsável" value={form.companyId} onChange={v => setForm(f => ({ ...f, companyId: v }))} required>
                  <option value="">— Selecione —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Atividades View ──────────────────────────────────────────────────────────

function AtividadesView({ profile }: { profile: UserProfile }) {
  const [items, setItems] = useState<TipoAtividade[]>([]);
  const [treiTipos, setTreiTipos] = useState<TipoTreinamento[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: '', companyId: '', treinamentosObrigatorios: [] as string[] });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);
  const fetchAll = async () => {
    try {
      const [a, t, c] = await Promise.all([
        api.get<TipoAtividade[]>('/treinamentos/atividades'), 
        api.get<TipoTreinamento[]>('/treinamentos/tipos'),
        api.get<Company[]>('/companies')
      ]);
      setItems(a || []); setTreiTipos(t || []); setCompanies(c || []);
    } catch {}
  };

  const toggleTreinamento = (id: string) => {
    setForm(f => ({ ...f, treinamentosObrigatorios: f.treinamentosObrigatorios.includes(id) ? f.treinamentosObrigatorios.filter(x => x !== id) : [...f.treinamentosObrigatorios, id] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { 
      await api.post('/treinamentos/atividades', form); 
      fetchAll(); setShowForm(false); 
      setForm({ nome: '', companyId: '', treinamentosObrigatorios: [] }); 
    }
    catch (err: any) { alert(err.error || 'Erro.'); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tipos de Atividade</h1>
          <p className="text-sm text-slate-500 mt-0.5">Defina quais treinamentos são obrigatórios por atividade.</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={16} /> Nova</Button>
      </div>
      <div className="space-y-3">
        {items.map(a => (
          <Card key={a.id} className="p-4">
            <p className="font-semibold text-slate-900 mb-2">{a.nome}</p>
            {a.treinamentosObrigatorios && a.treinamentosObrigatorios.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {a.treinamentosObrigatorios.map(id => {
                  const t = treiTipos.find(tt => tt.id === id);
                  return t ? <span key={id} className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t.codigo}</span> : null;
                })}
              </div>
            ) : <p className="text-xs text-slate-400 italic">Nenhum treinamento obrigatório vinculado.</p>}
          </Card>
        ))}
        {items.length === 0 && <Card><EmptyState icon={Briefcase} title="Nenhuma atividade cadastrada" /></Card>}
      </div>
      <AnimatePresence>
        {showForm && (
          <Modal title="Nova Atividade" onClose={() => setShowForm(false)}>
            <form onSubmit={handleSave} className="space-y-4">
              <Input label="Nome da Atividade" value={form.nome} onChange={v => setForm(f => ({ ...f, nome: v }))} required placeholder="Ex: Trabalho em Altura" />
              {(profile.role === 'master' || profile.role === 'admin') && (
                <Select label="Empresa" value={form.companyId} onChange={v => setForm(f => ({ ...f, companyId: v }))} required>
                  <option value="">— Selecione —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Treinamentos Obrigatórios</label>
                <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                  {treiTipos.map(t => (
                    <label key={t.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                      <input type="checkbox" checked={form.treinamentosObrigatorios.includes(t.id)} onChange={() => toggleTreinamento(t.id)}
                        className="w-4 h-4 accent-blue-600" />
                      <span className="text-sm text-slate-700"><span className="font-bold text-blue-600 mr-1">{t.codigo}</span>{t.nome}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Companies View (Master + Admin) ─────────────────────────────────────────

function CompaniesView({ profile }: { profile: UserProfile }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allAdmins, setAllAdmins] = useState<UserProfile[]>([]);
  const [linkedAdmins, setLinkedAdmins] = useState<Record<string, UserProfile[]>>({});

  // Modals
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [showBranchFor, setShowBranchFor] = useState<Company | null>(null);   // parent company
  const [showAdminsFor, setShowAdminsFor] = useState<Company | null>(null);   // company managing admins

  // Forms
  const [companyForm, setCompanyForm] = useState({ name: '', cnpj: '' });
  const [branchForm, setBranchForm] = useState({ name: '', cnpj: '' });
  const [saving, setSaving] = useState(false);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const maskCNPJ = (v: string) => {
    v = v.replace(/\D/g, '');
    if (v.length > 14) v = v.slice(0, 14);
    if (v.length > 12) return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
    if (v.length > 8)  return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4}).*/,        '$1.$2.$3/$4');
    if (v.length > 5)  return v.replace(/^(\d{2})(\d{3})(\d{3}).*/,               '$1.$2.$3');
    if (v.length > 2)  return v.replace(/^(\d{2})(\d{3}).*/,                      '$1.$2');
    return v;
  };

  const fetchAll = async () => {
    try {
      const [comps, users] = await Promise.all([
        api.get<Company[]>('/companies'),
        profile.role === 'master' ? api.get<UserProfile[]>('/users') : Promise.resolve<UserProfile[]>([]),
      ]);
      setCompanies(comps || []);
      if (profile.role === 'master') {
        setAllAdmins((users || []).filter(u => u.role === 'admin' || u.role === 'viewer'));
      }
    } catch {}
  };

  const fetchLinkedAdmins = async (companyId: string) => {
    try {
      const admins = await api.get<UserProfile[]>(`/companies/${companyId}/admins`);
      setLinkedAdmins(prev => ({ ...prev, [companyId]: admins || [] }));
    } catch {}
  };

  const openAdminsModal = async (company: Company) => {
    setShowAdminsFor(company);
    await fetchLinkedAdmins(company.id);
  };

  const toggleAdmin = async (companyId: string, userId: string, isLinked: boolean) => {
    setTogglingAdmin(userId);
    try {
      if (isLinked) {
        await api.delete(`/companies/${companyId}/admins/${userId}`);
      } else {
        await api.post(`/companies/${companyId}/admins`, { userId });
      }
      await fetchLinkedAdmins(companyId);
    } catch (err: any) {
      alert(err.error || 'Erro ao alterar vínculo.');
    } finally {
      setTogglingAdmin(null);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/companies', {
        name: companyForm.name,
        cnpj: companyForm.cnpj.replace(/\D/g, ''),
      });
      setCompanyForm({ name: '', cnpj: '' });
      setShowNewCompany(false);
      fetchAll();
    } catch (err: any) { alert(err.error || 'Erro ao criar empresa.'); }
    finally { setSaving(false); }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showBranchFor) return;
    setSaving(true);
    try {
      await api.post('/companies', {
        name: branchForm.name,
        cnpj: branchForm.cnpj.replace(/\D/g, ''),
        parentId: showBranchFor.id,
      });
      setBranchForm({ name: '', cnpj: '' });
      setShowBranchFor(null);
      fetchAll();
    } catch (err: any) { alert(err.error || 'Erro ao criar filial.'); }
    finally { setSaving(false); }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('Excluir esta empresa? Todas as filiais e dados associados serão removidos.')) return;
    try { await api.delete(`/companies/${id}`); fetchAll(); }
    catch (err: any) { alert(err.error || 'Erro ao excluir.'); }
  };

  // Separar matrizes de filiais
  const matrices = companies.filter(c => !c.parentId);
  const branches = companies.filter(c => !!c.parentId);
  const getBranches = (parentId: string) => branches.filter(b => b.parentId === parentId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Empresas Contratantes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {profile.role === 'master'
              ? 'Cadastre empresas, vincule administradores e gerencie filiais.'
              : 'Visualize suas empresas e cadastre filiais.'}
          </p>
        </div>
        {profile.role === 'master' && (
          <Button onClick={() => setShowNewCompany(true)}>
            <Plus size={16} /> Nova Empresa
          </Button>
        )}
      </div>

      {/* Company Cards */}
      <div className="space-y-4">
        {matrices.length === 0 && (
          <Card><EmptyState icon={ShieldCheck} title="Nenhuma empresa cadastrada"
            subtitle={profile.role === 'master' ? 'Clique em "Nova Empresa" para começar.' : 'Aguarde o master vincular você a uma empresa.'} /></Card>
        )}

        {matrices.map(company => {
          const compBranches = getBranches(company.id);
          const linked = linkedAdmins[company.id] || [];

          return (
            <Card key={company.id} className="overflow-hidden">
              {/* Company Header */}
              <div className="p-5 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shrink-0 shadow-lg shadow-blue-200">
                    <ShieldCheck size={22} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{company.name}</h2>
                    {company.cnpj && (
                      <p className="text-xs text-slate-400 font-mono mt-0.5">CNPJ: {company.cnpj}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
                        company.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                        {company.isActive ? 'Ativa' : 'Inativa'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {compBranches.length} {compBranches.length === 1 ? 'filial' : 'filiais'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {profile.role === 'master' && (
                    <button
                      onClick={() => openAdminsModal(company)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-all"
                    >
                      <UserCog size={14} />
                      Administradores
                      {linked.length > 0 && (
                        <span className="ml-1 bg-purple-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                          {linked.length}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => { setBranchForm({ name: '', cnpj: '' }); setShowBranchFor(company); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all"
                  >
                    <Plus size={14} /> Filial
                  </button>
                  {profile.role === 'master' && (
                    <button
                      onClick={() => handleDeleteCompany(company.id)}
                      className="p-1.5 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Branches List */}
              {compBranches.length > 0 && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {compBranches.map(branch => (
                    <div key={branch.id} className="flex items-center justify-between px-5 py-3 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-slate-200 flex items-center justify-center">
                          <Building2 size={12} className="text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{branch.name}</p>
                          {branch.cnpj && <p className="text-xs text-slate-400 font-mono">{branch.cnpj}</p>}
                        </div>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase ml-1">Filial</span>
                      </div>
                      {profile.role === 'master' && (
                        <button
                          onClick={() => handleDeleteCompany(branch.id)}
                          className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* ─── Modal: Nova Empresa (Master only) ─── */}
      <AnimatePresence>
        {showNewCompany && (
          <Modal title="Nova Empresa Contratante" onClose={() => setShowNewCompany(false)}>
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 font-medium">
                ℹ️ Cadastre a empresa que irá receber terceiros e visitantes. Após criá-la, vincule os administradores responsáveis.
              </div>
              <Input label="Razão Social / Nome da Empresa" value={companyForm.name}
                onChange={v => setCompanyForm(f => ({ ...f, name: v }))} required
                placeholder="Ex: Acme Indústria e Comércio Ltda" />
              <Input label="CNPJ" value={companyForm.cnpj}
                onChange={v => setCompanyForm(f => ({ ...f, cnpj: maskCNPJ(v) }))}
                placeholder="00.000.000/0000-00" />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowNewCompany(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Criando...' : 'Criar Empresa'}</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ─── Modal: Nova Filial ─── */}
      <AnimatePresence>
        {showBranchFor && (
          <Modal title={`Nova Filial — ${showBranchFor.name}`} onClose={() => setShowBranchFor(null)}>
            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                <Building2 size={14} className="shrink-0 text-slate-400" />
                Esta filial será vinculada a <strong>{showBranchFor.name}</strong>.
              </div>
              <Input label="Nome da Filial / Unidade" value={branchForm.name}
                onChange={v => setBranchForm(f => ({ ...f, name: v }))} required
                placeholder="Ex: Filial Santos, Unidade Centro..." />
              <Input label="CNPJ" value={branchForm.cnpj}
                onChange={v => setBranchForm(f => ({ ...f, cnpj: maskCNPJ(v) }))}
                placeholder="00.000.000/0000-00" />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowBranchFor(null)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Criando...' : 'Criar Filial'}</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* ─── Modal: Gerenciar Administradores (Master only) ─── */}
      <AnimatePresence>
        {showAdminsFor && (
          <Modal title={`Administradores — ${showAdminsFor.name}`} onClose={() => setShowAdminsFor(null)} size="lg">
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Selecione quais usuários têm acesso a esta empresa. Administradores vinculados poderão cadastrar filiais, terceiros e visitantes.
              </p>

              {allAdmins.length === 0 ? (
                <EmptyState icon={UserCog} title="Nenhum administrador cadastrado"
                  subtitle="Cadastre usuários com nível Administrador primeiro." />
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {allAdmins.map(admin => {
                    const linked = (linkedAdmins[showAdminsFor.id] || []).some(a => (a.uid || a.id) === (admin.uid || admin.id));
                    const isToggling = togglingAdmin === (admin.uid || admin.id);
                    return (
                      <div key={admin.uid || admin.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-xl border-2 transition-all',
                          linked ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 bg-white hover:border-slate-200'
                        )}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold',
                            linked ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                          )}>
                            {admin.displayName?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{admin.displayName}</p>
                            <p className="text-xs text-slate-400">{admin.email}</p>
                          </div>
                          <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full',
                            admin.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600')}>
                            {admin.role === 'admin' ? 'Admin' : 'Viewer'}
                          </span>
                        </div>
                        <button
                          disabled={isToggling}
                          onClick={() => toggleAdmin(showAdminsFor.id, admin.uid || admin.id || '', linked)}
                          className={cn(
                            'relative w-12 h-6 rounded-full transition-all flex-shrink-0',
                            linked ? 'bg-blue-600' : 'bg-slate-200',
                            isToggling && 'opacity-50 cursor-not-allowed'
                          )}>
                          <div className={cn(
                            'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all',
                            linked ? 'left-7' : 'left-1'
                          )} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={() => setShowAdminsFor(null)}>Fechar</Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}



// ─── Usuários View ────────────────────────────────────────────────────────────

function UsuariosView({ profile }: { profile: UserProfile }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', displayName: '', role: 'viewer', companyId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);
  const fetchAll = async () => {
    try {
      const [u, c] = await Promise.all([api.get<UserProfile[]>('/users'), api.get<Company[]>('/companies')]);
      setUsers(u || []); setCompanies(c || []);
    } catch {}
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form };
      // Se for admin, usa o companyId selecionado, se não tiver usa o do perfil como fallback
      if (profile.role === 'admin') {
        payload.companyId = form.companyId || profile.companyId;
      }
      await api.post('/users', payload);
      fetchAll(); setShowForm(false); setForm({ email: '', displayName: '', role: 'viewer', companyId: '' });
    } catch (err: any) { alert(err.error || 'Erro.'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir usuário?')) return;
    try { await api.delete(`/users/${id}`); fetchAll(); } catch (err: any) { alert(err.error || 'Erro.'); }
  };

  const roleLabel = (r: string) => ({ master: 'Master', admin: 'Administrador', viewer: 'Visualizador' }[r] || r);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500 mt-0.5">Convide usuários — eles receberão um e-mail para definir a senha.</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={16} /> Convidar</Button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {['Usuário', 'Nível', 'Empresa', 'Status'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>)}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.uid || u.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">{u.displayName?.[0]?.toUpperCase()}</div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{u.displayName}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full',
                      u.role === 'master' ? 'bg-purple-100 text-purple-700' : u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600')}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{u.companyName || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                      {u.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(u.uid !== profile.uid && u.id !== profile.id) && (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(u.uid || u.id || '')}><Trash2 size={14} /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <EmptyState icon={UserCog} title="Nenhum usuário encontrado" />}
        </div>
      </Card>
      <AnimatePresence>
        {showForm && (
          <Modal title="Convidar Usuário" onClose={() => setShowForm(false)}>
            <form onSubmit={handleSave} className="space-y-4">
              <Input label="Nome" value={form.displayName} onChange={v => setForm(f => ({ ...f, displayName: v }))} required />
              <Input label="E-mail" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} required />
              <Select label="Nível de Acesso" value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))}>
                <option value="viewer">Visualizador (Portaria)</option>
                <option value="admin">Administrador</option>
                {profile.role === 'master' && <option value="master">Master</option>}
              </Select>
              {(profile.role === 'master' || (profile.role === 'admin' && form.role !== 'master')) && (
                <Select label="Empresa" value={form.companyId} onChange={v => setForm(f => ({ ...f, companyId: v }))} required>
                  <option value="">— Selecione —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
              <div className="p-3 bg-blue-50 rounded-xl flex items-start gap-2 text-xs text-blue-700">
                <Bell size={14} className="mt-0.5 shrink-0" />
                O usuário receberá um e-mail com link para definir sua senha de acesso.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Enviando convite...' : 'Convidar'}</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('portaria');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    if (token) { setResetToken(token); window.history.replaceState({}, '', window.location.pathname); }
    checkSession();
  }, []);

  const checkSession = async () => {
    const stored = getStoredUser();
    if (stored) {
      try {
        const fresh = await api.get<UserProfile>('/auth/me');
        setProfile(fresh);
      } catch { clearSession(); }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    try { await api.post('/auth/logout', {}); } catch {}
    clearSession(); setProfile(null);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPw !== resetConfirm) { setResetMsg('As senhas não coincidem.'); return; }
    setResetLoading(true);
    try {
      await api.post('/auth/reset-password', { token: resetToken, newPassword: resetPw });
      setResetMsg('Senha definida com sucesso! Redirecionando...');
      setTimeout(() => { setResetToken(null); setResetMsg(''); setResetPw(''); setResetConfirm(''); }, 2500);
    } catch (err: any) { setResetMsg(err.error || 'Link inválido ou expirado.'); }
    finally { setResetLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (resetToken) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-5">
        <div className="text-center">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Definir Senha</h1>
          <p className="text-sm text-slate-500 mt-1">Crie sua senha de acesso ao sistema.</p>
        </div>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <Input label="Nova Senha" type="password" value={resetPw} onChange={setResetPw} required placeholder="Mínimo 8 caracteres" />
          <Input label="Confirmar Senha" type="password" value={resetConfirm} onChange={setResetConfirm} required placeholder="Repita a senha" />
          {resetMsg && <p className={cn('text-sm text-center font-medium', resetMsg.includes('sucesso') ? 'text-emerald-600' : 'text-red-600')}>{resetMsg}</p>}
          <button type="submit" disabled={resetLoading} className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-all disabled:opacity-60">
            {resetLoading ? 'Salvando...' : 'Confirmar Senha'}
          </button>
        </form>
      </div>
    </div>
  );

  if (!profile) return <LoginPage onLogin={p => setProfile(p)} />;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Header profile={profile} onLogout={handleLogout} />
      
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          profile={profile} 
          collapsed={sidebarCollapsed} 
          setCollapsed={setSidebarCollapsed} 
        />

        <main className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-7xl mx-auto p-4 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeTab} 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }} 
                transition={{ duration: 0.15 }}
              >
                {activeTab === 'portaria'         && <PortariaView profile={profile} />}
                {activeTab === 'pessoas'          && <PessoasView profile={profile} />}
                {activeTab === 'empresas_terceiro' && <EmpresasTerceiroView profile={profile} />}
                {activeTab === 'treinamentos'     && <TreinamentosView profile={profile} />}
                {activeTab === 'atividades'       && <AtividadesView profile={profile} />}
                {activeTab === 'companies'        && (profile.role === 'master' || profile.role === 'admin') && <CompaniesView profile={profile} />}
                {activeTab === 'usuarios'         && <UsuariosView profile={profile} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

