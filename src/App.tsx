import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Briefcase, UserCog, Bell, Home, Mail
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

// Custom CSS for Modal scrollbar
const modalStyles = `
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;

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
  
  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" 
      onMouseDown={(e) => {
        // Only close if clicking directly on the backdrop (not dragging from inside)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.95, opacity: 0 }}
        onMouseDown={e => e.stopPropagation()}
        className={cn('bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto no-scrollbar', widths[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </motion.div>
    </div>,
    document.body
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string; key?: React.Key }) {
  return <div className={cn('bg-white rounded-2xl border border-slate-100 shadow-sm', className)}>{children}</div>;
}

function ConfirmModal({ title, message, onConfirm, onCancel, loading }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel} size="md">
      <div className="space-y-6">
        <div className="flex items-center gap-4 p-4 bg-red-50 rounded-2xl border border-red-100 text-left">
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="text-red-600" size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-red-900">Ação Irreversível</p>
            <p className="text-xs text-red-600 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={onConfirm} disabled={loading}>
            {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
          </Button>
        </div>
      </div>
    </Modal>
  );
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
      const data = await api.post<{ message: string }>('/auth/forgot-password', { email: forgotEmail });
      setForgotMsg(data.message);
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
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] bg-blue-500/20 mix-blend-screen pointer-events-none" 
      />
      
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2] 
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[150px] bg-sky-400/10 mix-blend-screen pointer-events-none" 
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

type TabId = 'portaria' | 'pessoas' | 'empresas_terceiro' | 'treinamentos' | 'companies' | 'usuarios';

function Sidebar({ activeTab, setActiveTab, profile, collapsed, setCollapsed }: {
  activeTab: TabId; setActiveTab: (t: TabId) => void;
  profile: UserProfile; collapsed: boolean; setCollapsed: (v: boolean) => void;
}) {
  const items: { id: TabId; label: string; icon: any; roles: string[] }[] = [
    { id: 'portaria',        label: 'Portaria',           icon: Home,        roles: ['master','admin','viewer'] },
    { id: 'pessoas',         label: 'Visitantes e Prestadores', icon: Users, roles: ['master','admin'] },
    { id: 'empresas_terceiro',label:'Provedores',           icon: Building2,   roles: ['master','admin'] },
    { id: 'treinamentos',    label: 'Treinamentos',         icon: BookOpen,   roles: ['master','admin'] },
    { id: 'companies',       label: 'Empresas',             icon: ShieldCheck, roles: ['master', 'admin'] },
    { id: 'usuarios',        label: 'Usuários do Sistema',  icon: UserCog,     roles: ['master','admin'] },
  ];

  const visible = items.filter(i => i.roles.includes(profile.role));

  return (
    <motion.aside 
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative h-full bg-slate-900 text-white shrink-0 z-50 group border-r border-white/5 shadow-2xl shadow-slate-900/50"
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
          {visible.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold transition-all relative group/item',
                activeTab === item.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                collapsed && 'justify-center'
              )}>
              <item.icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
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
  atividadeId: '',
  asoDataRealizacao: '', epiObrigatorio: false, epiDescricao: '',
  treinamentos: [],
  companyId: '',
});

function CompanySelectOptions({ companies }: { companies: Company[] }) {
  const matrices = companies.filter(c => !c.parentId);
  const filiais = companies.filter(c => c.parentId);

  return (
    <>
      <option value="">— Selecione —</option>
      {matrices.map(m => (
        <optgroup key={m.id} label={m.name}>
          <option value={m.id}>{m.name} (Matriz)</option>
          {filiais.filter(f => f.parentId === m.id).map(f => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </optgroup>
      ))}
      {/* Fallback para filiais cujas matrizes não foram carregadas ou não existem */}
      {filiais.filter(f => !matrices.some(m => m.id === f.parentId)).map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </>
  );
}

function PessoasView({ profile }: { profile: UserProfile }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [empresasTerceiro, setEmpresasTerceiro] = useState<EmpresaTerceiro[]>([]);
  const [treiTipos, setTreiTipos] = useState<TipoTreinamento[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Pessoa | null>(null);
  const [form, setForm] = useState<PessoaForm>(emptyPessoaForm());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [docType, setDocType] = useState<'CPF' | 'RG'>('CPF');
  const [coSearch, setCoSearch] = useState('');
  const [origSearch, setOrigSearch] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const maskCPF = (v: string) => {
    v = v.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleDocChange = (v: string) => {
    if (docType === 'CPF') {
      const numeric = v.replace(/\D/g, '');
      if (numeric.length <= 11) setForm(f => ({ ...f, documento: maskCPF(v) }));
    } else {
      setForm(f => ({ ...f, documento: v }));
    }
  };

  const handleAsoUpdate = (date: string) => {
    setForm(f => {
      const newF = { ...f, asoDataRealizacao: date };
      if (date) {
        const d = new Date(date + 'T12:00:00'); // avoid timezone shifts
        d.setFullYear(d.getFullYear() + 1);
        newF.liberadoAte = d.toISOString().split('T')[0];
      }
      return newF;
    });
  };

  const fetchAll = async () => {
    try {
      const [p, e, t, c] = await Promise.all([
        api.get<Pessoa[]>('/pessoas'),
        api.get<EmpresaTerceiro[]>('/empresas-terceiro'),
        api.get<TipoTreinamento[]>('/treinamentos/tipos'),
        api.get<Company[]>('/companies'),
      ]);
      setPessoas(p || []);
      setEmpresasTerceiro(e || []);
      setTreiTipos(t || []);
      setCompanies(c || []);
    } catch {}
  };

  const openNew = () => { setForm(emptyPessoaForm()); setEditTarget(null); setShowForm(true); };
  
  const openEdit = (p: Pessoa) => {
    setEditTarget(p);
    setForm({
      tipoAcesso: p.tipoAcesso,
      foto: p.foto || '',
      nomeCompleto: p.nomeCompleto,
      documento: p.documento,
      empresaOrigemId: p.empresaOrigemId || '',
      responsavelInterno: p.responsavelInterno,
      celularAutorizado: p.celularAutorizado,
      notebookAutorizado: p.notebookAutorizado,
      liberadoAte: p.liberadoAte ? p.liberadoAte.split('T')[0] : '',
      descricaoAtividade: p.descricaoAtividade || '',
      asoDataRealizacao: p.asoDataRealizacao || '',
      epiObrigatorio: p.epiObrigatorio,
      epiDescricao: p.epiDescricao || '',
      treinamentos: p.treinamentos ? p.treinamentos.map(t => ({ treinamentoId: t.treinamentoId, dataRealizacao: t.dataRealizacao })) : [],
      companyId: p.companyId
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (editTarget) await api.put(`/pessoas/${editTarget.id}`, payload);
      else await api.post('/pessoas', payload);
      fetchAll();
      setShowForm(false);
    } catch (err: any) { alert(err.error || 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try { 
      await api.delete(`/pessoas/${deleteId}`); 
      fetchAll(); 
      setDeleteId(null);
    } catch (err: any) { alert(err.error || 'Erro.'); } 
    finally { setSaving(false); }
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
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(p.id)}><Trash2 size={14} /></Button>
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
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Documento</label>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg">
                      <button type="button" onClick={() => setDocType('CPF')} className={cn('px-2 py-0.5 text-[10px] rounded-md font-bold transition-all', docType === 'CPF' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400')}>CPF</button>
                      <button type="button" onClick={() => setDocType('RG')} className={cn('px-2 py-0.5 text-[10px] rounded-md font-bold transition-all', docType === 'RG' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400')}>RG</button>
                    </div>
                  </div>
                  <input 
                    value={form.documento} 
                    onChange={e => handleDocChange(e.target.value)} 
                    required 
                    placeholder={docType === 'CPF' ? '000.000.000-00' : 'Número do RG'}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Empresa de Origem</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      placeholder="Pesquisar empresa..."
                      value={origSearch}
                      onChange={e => setOrigSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-100 bg-slate-50 text-[11px] outline-none mb-1"
                    />
                    <select 
                      value={form.empresaOrigemId} 
                      onChange={e => setForm(f => ({ ...f, empresaOrigemId: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none"
                    >
                      <option value="">— Selecione —</option>
                      {empresasTerceiro
                        .filter(e => !origSearch || e.name.toLowerCase().includes(origSearch.toLowerCase()))
                        .map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                </div>

                <Input label="Responsável Interno" value={form.responsavelInterno} onChange={v => setForm(f => ({ ...f, responsavelInterno: v }))} required placeholder="Nome do acompanhante" />
                
                {(profile.role === 'master' || profile.role === 'admin') && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Empresa de Acesso (Unidade)</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        placeholder="Pesquisar unidade..."
                        value={coSearch}
                        onChange={e => setCoSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-100 bg-slate-50 text-[11px] outline-none mb-1"
                      />
                      <select 
                        value={form.companyId} 
                        onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))} 
                        required
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none"
                      >
                        <CompanySelectOptions companies={companies.filter(c => !coSearch || c.name.toLowerCase().includes(coSearch.toLowerCase()))} />
                      </select>
                    </div>
                  </div>
                )}
                <Input label="Liberado Até" type="date" value={form.liberadoAte} onChange={v => setForm(f => ({ ...f, liberadoAte: v }))} hint="Definido automaticamente pelo ASO" />
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
                    <Input label="ASO — Data de Realização" type="date" value={form.asoDataRealizacao} onChange={handleAsoUpdate} hint="Expira em 1 ano" />
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

      <AnimatePresence>
        {deleteId && (
          <ConfirmModal 
            title="Excluir Cadastro"
            message="Esta ação excluirá permanentemente os dados desta pessoa e seu histórico de acessos. Deseja continuar?"
            onConfirm={confirmDelete}
            onCancel={() => setDeleteId(null)}
            loading={saving}
          />
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
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchAll(); }, []);
  const fetchAll = async () => { try { setItems(await api.get<T[]>(endpoint)); } catch {} };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try { 
      await api.delete(`${endpoint}/${deleteId}`); 
      fetchAll(); 
      setDeleteId(null);
    } catch (err: any) { alert(err.error || 'Erro.'); } 
    finally { setDeleting(false); }
  };

  const filtered = items.filter(item => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (item.name?.toLowerCase().includes(s) || item.nome?.toLowerCase().includes(s));
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <Button onClick={() => { setEditItem(null); setShowForm(true); }}><Plus size={16} /> Novo</Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Buscar nesta lista..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
        />
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
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  {columns.map((c, i) => <td key={i} className="px-4 py-3 text-sm text-slate-700">{c.render(item)}</td>)}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditItem(item); setShowForm(true); }}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(item.id)}><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={Icon} title="Nenhum item encontrado" subtitle={search ? "Tente buscar por outro termo." : "Clique em Novo para adicionar."} />}
        </div>
      </Card>
      <AnimatePresence>
        {showForm && (
          <Modal title={editItem ? 'Editar' : 'Novo'} onClose={() => setShowForm(false)}>
            {renderForm(editItem, () => { fetchAll(); setShowForm(false); }, () => setShowForm(false))}
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteId && (
          <ConfirmModal 
            title="Confirmar Exclusão"
            message="Tem certeza que deseja excluir este item? Esta ação não poderá ser desfeita."
            onConfirm={confirmDelete}
            onCancel={() => setDeleteId(null)}
            loading={deleting}
          />
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
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<TipoTreinamento | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', validadeMeses: '12', escopo: 'personalizado', companyId: '' });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchAll(); }, []);
  const fetchAll = async () => { 
    try {
      const [t, c] = await Promise.all([api.get<TipoTreinamento[]>('/treinamentos/tipos'), api.get<Company[]>('/companies')]);
      const sorted = (t || []).sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }));
      setItems(sorted); setCompanies(c || []);
    } catch {} 
  };

  const openNew = () => {
    setEditTarget(null);
    setForm({ nome: '', validadeMeses: '12', escopo: 'personalizado', companyId: '' });
    setShowForm(true);
  };

  const openEdit = (t: TipoTreinamento) => {
    setEditTarget(t);
    setForm({ 
      nome: t.nome, 
      validadeMeses: String(t.validadeMeses), 
      escopo: t.escopo, 
      companyId: t.companyId || '' 
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { 
      if (editTarget) {
        await api.put(`/treinamentos/tipos/${editTarget.id}`, form);
      } else {
        await api.post('/treinamentos/tipos', form); 
      }
      fetchAll(); setShowForm(false); 
      setForm({ nome: '', validadeMeses: '12', escopo: 'personalizado', companyId: '' }); 
    }
    catch (err: any) { alert(err.error || 'Erro.'); } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/treinamentos/tipos/${deleteId}`);
      fetchAll();
      setDeleteId(null);
    } catch (err: any) { alert(err.error || 'Erro ao excluir treinamento.'); }
    finally { setDeleting(false); }
  };

  const filtered = items.filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return t.nome.toLowerCase().includes(s) || t.codigo.toLowerCase().includes(s);
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Treinamentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie os treinamentos obrigatórios.</p>
        </div>
        <Button onClick={openNew}><Plus size={16} /> Novo</Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Buscar por código ou descrição de treinamento..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {['Código', 'Nome', 'Validade', 'Escopo', ''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-sm font-bold text-blue-600">{t.codigo}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{t.nome}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{t.validadeMeses} meses</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', t.escopo === 'global' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600')}>
                      {t.escopo === 'global' ? 'Global' : 'Personalizado'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(t.id)}><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={BookOpen} title={search ? "Nenhum treinamento encontrado" : "Nenhum treinamento cadastrado"} subtitle={search ? "Tente buscar por outro código ou nome." : ""} />}
        </div>
      </Card>
      <AnimatePresence>
        {showForm && (
          <Modal title={editTarget ? 'Editar Treinamento' : 'Novo Tipo de Treinamento'} onClose={() => setShowForm(false)}>
            <form onSubmit={handleSave} className="space-y-4">
              <Input label="Descrição do Treinamento" value={form.nome} onChange={v => setForm(f => ({ ...f, nome: v }))} required placeholder="Ex: NR 10 - Segurança em Eletricidade" />
              <Input label="Validade (meses)" type="number" value={form.validadeMeses} onChange={v => setForm(f => ({ ...f, validadeMeses: v }))} required />
              {profile.role === 'master' && (
                <Select label="Escopo" value={form.escopo} onChange={v => setForm(f => ({ ...f, escopo: v }))}>
                  <option value="personalizado">Personalizado (apenas esta empresa)</option>
                  <option value="global">Global (todas as empresas)</option>
                </Select>
              )}
              {(profile.role === 'master' || (profile.role === 'admin' && form.escopo === 'personalizado')) && (profile.role === 'admin' || form.escopo === 'personalizado') && (
                <Select label="Empresa Responsável" value={form.companyId} onChange={v => setForm(f => ({ ...f, companyId: v }))} required>
                  <CompanySelectOptions companies={companies} />
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

      <AnimatePresence>
        {deleteId && (
          <ConfirmModal 
            title="Excluir Treinamento"
            message="Esta ação excluirá este tipo de treinamento do sistema. Isso não afetará históricos já registrados, mas impedirá novos registros com este tipo. Deseja continuar?"
            onConfirm={confirmDelete}
            onCancel={() => setDeleteId(null)}
            loading={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}




// ─── Companies View (Master + Admin) ─────────────────────────────────────────

function CompaniesView({ profile }: { profile: UserProfile }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allAdmins, setAllAdmins] = useState<UserProfile[]>([]);
  const [linkedAdmins, setLinkedAdmins] = useState<Record<string, UserProfile>>({});
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);

  // Modals
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [showBranchFor, setShowBranchFor] = useState<Company | null>(null);   // parent company
  const [showAdminsFor, setShowAdminsFor] = useState<Company | null>(null);   // company managing admins
  const [editTarget, setEditTarget] = useState<Company | null>(null);         // company/branch being edited

  // Forms
  const [companyForm, setCompanyForm] = useState({ name: '', cnpj: '' });
  const [branchForm, setBranchForm] = useState({ name: '', cnpj: '' });
  const [saving, setSaving] = useState(false);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);

  // Auto-fill CNPJ se o nome for 'Matriz'
  useEffect(() => {
    if (showBranchFor && branchForm.name.toLowerCase() === 'matriz') {
      setBranchForm(f => ({ ...f, cnpj: maskCNPJ(showBranchFor.cnpj || '') }));
    }
  }, [branchForm.name, showBranchFor]);

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

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    try {
      await api.put(`/companies/${editTarget.id}`, {
        name: companyForm.name,
        cnpj: companyForm.cnpj.replace(/\D/g, ''),
      });
      setCompanyForm({ name: '', cnpj: '' });
      setEditTarget(null);
      fetchAll();
    } catch (err: any) { alert(err.error || 'Erro ao atualizar.'); }
    finally { setSaving(false); }
  };

  const confirmDeleteCompany = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { 
      await api.delete(`/companies/${deleteTarget.id}`); 
      fetchAll(); 
      setDeleteTarget(null);
    } catch (err: any) { alert(err.error || 'Erro ao excluir.'); } 
    finally { setSaving(false); }
  };

  // Separar matrizes de filiais
  const matrices = companies
    .filter(c => !c.parentId)
    .filter(c => profile.role === 'master' || c.id === profile.companyId)
    .filter(c => {
      if (!search) return true;
      const s = search.toLowerCase();
      return c.name.toLowerCase().includes(s) || (c.cnpj || '').includes(s);
    });

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
        {(profile.role === 'master' || profile.role === 'admin') && (
          <Button onClick={() => setShowNewCompany(true)}>
            <Plus size={16} /> Nova Empresa
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Buscar por nome da empresa ou CNPJ..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
        />
      </div>

      {/* Company Cards */}
      <div className="space-y-4">
        {matrices.length === 0 && (
          <Card className="p-8">
            <EmptyState icon={ShieldCheck} title="Nenhuma empresa cadastrada"
              subtitle={profile.role === 'master' ? 'Você ainda não cadastrou nenhuma empresa contratante.' : 'Aguarde o master vincular você a uma empresa.'} />
            {(profile.role === 'master' || profile.role === 'admin') && (
              <div className="flex justify-center pt-4">
                <Button onClick={() => setShowNewCompany(true)} size="md">
                  <Plus size={18} /> Cadastrar Minha Primeira Empresa
                </Button>
              </div>
            )}
          </Card>
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
                  <button
                    onClick={() => { setCompanyForm({ name: company.name, cnpj: company.cnpj || '' }); setEditTarget(company); }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                    title="Editar Empresa"
                  >
                    <UserCog size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(company)}
                    className="p-1.5 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Excluir Empresa"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Branches List */}
              <div className="border-t border-slate-100 divide-y divide-slate-50">
                {/* Always show the Matrix/Headquarters row first */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-5 bg-blue-50/40 border-l-4 border-blue-500 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">Unidade Sede Principal</p>
                        <span className="text-[9px] font-black bg-blue-600 text-white px-2 py-0.5 rounded shadow-sm tracking-wide uppercase">
                          Matriz
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5 tracking-tight">
                        CNPJ da Sede: {maskCNPJ(company.cnpj || '')}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-blue-600 bg-white border border-blue-100 hover:bg-blue-50 shadow-sm"
                    onClick={() => { setBranchForm({ name: '', cnpj: '' }); setShowBranchFor(company); }}>
                    <Plus size={14} /> Cadastrar Nova Filial
                  </Button>
                </div>

                {/* List registered branches */}
                {compBranches.map(branch => {
                  const isMatriz = branch.name.toLowerCase() === 'matriz';
                  return (
                    <div key={branch.id} className={cn(
                      "flex items-center justify-between px-5 py-4 transition-all border-l-4",
                      isMatriz ? "bg-blue-50/30 border-blue-500" : "bg-slate-50/40 border-slate-100 hover:bg-slate-50"
                    )}>
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-transform hover:scale-105",
                          isMatriz ? "bg-blue-600 text-white" : "bg-white text-slate-400 border border-slate-200"
                        )}>
                          {isMatriz ? <ShieldCheck size={18} /> : <Building2 size={18} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-800">{branch.name}</p>
                            {isMatriz ? (
                              <span className="text-[9px] font-black bg-blue-600 text-white px-2 py-0.5 rounded shadow-sm tracking-wide">
                                UNIDADE SEDE
                              </span>
                            ) : (
                              <span className="text-[9px] font-black text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded uppercase">
                                Filial
                              </span>
                            )}
                          </div>
                          {branch.cnpj && (
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5 tracking-tight">
                              CNPJ: {maskCNPJ(branch.cnpj)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1 group">
                        <button
                          onClick={() => { setBranchForm({ name: branch.name, cnpj: branch.cnpj || '' }); setEditTarget(branch); }}
                          className="p-2 rounded-xl text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100"
                          title="Editar Unidade"
                        >
                          <UserCog size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(branch)}
                          className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                          title="Excluir Unidade"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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

      {/* ─── Modal: Editar Empresa / Unidade ─── */}
      <AnimatePresence>
        {editTarget && (
          <Modal title={`Editar — ${editTarget.name}`} onClose={() => setEditTarget(null)}>
            <form onSubmit={handleUpdateCompany} className="space-y-4">
              <Input label="Nome" value={companyForm.name}
                onChange={v => setCompanyForm(f => ({ ...f, name: v }))} required />
              <Input label="CNPJ" value={companyForm.cnpj}
                onChange={v => setCompanyForm(f => ({ ...f, cnpj: maskCNPJ(v) }))}
                placeholder="00.000.000/0000-00" />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Atualizando...' : 'Salvar Alterações'}</Button>
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

      <AnimatePresence>
        {deleteTarget && (
          <ConfirmModal 
            title="Excluir Empresa"
            message={`Deseja realmente excluir "${deleteTarget.name}"? Todas as filiais e dados associados a esta unidade serão removidos permanentemente.`}
            onConfirm={confirmDeleteCompany}
            onCancel={() => setDeleteTarget(null)}
            loading={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Atividades View ──────────────────────────────────────────────────────────

function AtividadesView({ profile }: { profile: UserProfile }) {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-slate-900">Atividades</h1>
      <p className="text-sm text-slate-500 mt-2">Esta é a página de atividades. Em breve, mais funcionalidades serão adicionadas aqui.</p>
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
    const style = document.createElement('style');
    style.textContent = modalStyles;
    document.head.append(style);
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#001A33]">
      {/* Dark blue background with subtle gradient and glows to match login */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#000d1a] via-[#001A33] to-[#000a14]" />
      <div className="absolute inset-0 bg-grid-tech opacity-20" />
      
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.4, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] bg-blue-500/10 mix-blend-screen pointer-events-none" 
      />

      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[150px] bg-sky-400/5 mix-blend-screen pointer-events-none" 
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl p-10 border border-white">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-6">
              <img src="/LogoCompleto.png" alt="PortALL" className="h-24 w-auto object-contain" />
            </div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Definir Senha</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Crie sua nova senha de acesso.</p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-5">
            <div className="space-y-4">
              <Input label="Nova Senha" type="password" value={resetPw} onChange={setResetPw} required placeholder="Mínimo 8 caracteres" />
              <Input label="Confirmar Senha" type="password" value={resetConfirm} onChange={setResetConfirm} required placeholder="Repita a senha" />
            </div>

            {resetMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'p-3 rounded-xl text-xs font-bold text-center border',
                  resetMsg.includes('sucesso') 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                    : 'bg-red-50 text-red-600 border-red-100'
                )}
              >
                {resetMsg}
              </motion.div>
            )}

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={resetLoading} 
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-60 shadow-xl shadow-blue-500/25 active:scale-95"
              >
                {resetLoading ? 'Salvando...' : 'Confirmar Nova Senha'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
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

function UsuariosView({ profile }: { profile: UserProfile }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ 
    email: '', 
    displayName: '', 
    role: 'viewer', 
    companyId: '', 
    managedCompanyIds: [] as string[], 
    manageAllBranches: false 
  });

  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);

  useEffect(() => { fetchAll(); }, []);
  
  const fetchAll = async () => {
    try {
      const [u, c] = await Promise.all([
        api.get<UserProfile[]>('/users'),
        api.get<Company[]>('/companies'),
      ]);
      setUsers(u || []);
      setCompanies(c || []);
    } catch {}
  };

  const openNew = () => {
    setEditTarget(null);
    setForm({ 
      email: '', 
      displayName: '', 
      role: 'viewer', 
      companyId: profile.role === 'admin' ? (profile.companyId || '') : '', 
      managedCompanyIds: [], 
      manageAllBranches: false 
    });
    setShowForm(true);
  };

  const openEdit = (user: UserProfile) => {
    setEditTarget(user);
    setForm({ 
      email: user.email || '', 
      displayName: user.displayName || '', 
      role: user.role || 'viewer', 
      companyId: user.companyId || '',
      managedCompanyIds: user.managedCompanyIds || [],
      manageAllBranches: user.manageAllBranches || false
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (profile.role === 'admin') {
        payload.role = 'viewer';
        payload.companyId = profile.companyId || form.companyId;
      }
      if (editTarget) {
        await api.put(`/users/${editTarget.uid || editTarget.id}`, payload);
      } else {
        await api.post('/users', payload);
      }
      fetchAll();
      setShowForm(false);
    } catch (err: any) { alert(err.error || 'Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/users/${deleteTarget.uid || deleteTarget.id}`);
      fetchAll();
      setDeleteTarget(null);
    } catch (err: any) { alert(err.error || 'Erro ao excluir.'); }
    finally { setSaving(false); }
  };

  const roleLabel = (role: string) => {
    if (role === 'master') return 'Master';
    if (role === 'admin') return 'Administrador';
    return 'Visualizador';
  };

  const roleColor = (role: string) => {
    if (role === 'master') return 'bg-purple-100 text-purple-700';
    if (role === 'admin') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-600';
  };

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return '—';
    return companies.find(c => c.id === companyId)?.name || '—';
  };

  const filtered = users.filter(u =>
    !search ||
    (u.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const canInvite = profile.role === 'master' || profile.role === 'admin';
  const canEditRole = profile.role === 'master';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários do Sistema</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie os usuários e suas permissões de acesso.</p>
        </div>
        {canInvite && (
          <Button onClick={openNew}><Plus size={16} /> Convidar Usuário</Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {['Usuário', 'E-mail', 'Perfil', 'Empresa', 'Unidades', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(user => (
                <tr key={user.uid || user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${roleColor(user.role || 'viewer')}`}>
                        {(user.displayName || user.email || '?')[0].toUpperCase()}
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{user.displayName || '—'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-slate-500">
                      <Mail size={13} className="text-slate-300" />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${roleColor(user.role || 'viewer')}`}>
                      {roleLabel(user.role || 'viewer')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {getCompanyName(user.companyId)}
                  </td>
                  <td className="px-4 py-3">
                    {user.manageAllBranches ? (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">Todas</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(user.managedCompanyIds || []).length > 0 ? (
                          user.managedCompanyIds?.map(id => {
                            const name = companies.find(c => c.id === id)?.name;
                            return name ? (
                              <span key={id} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                {name}
                              </span>
                            ) : null;
                          })
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Nenhuma</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canInvite && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)}><Pencil size={14} /></Button>
                      )}
                      {profile.role === 'master' && (user.uid || user.id) !== (profile.uid || profile.id) && (
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(user)}><Trash2 size={14} /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState icon={UserCog} title="Nenhum usuário encontrado" subtitle="Convide usuários clicando em 'Convidar Usuário'." />}
        </div>
      </Card>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <Modal title={editTarget ? 'Editar Usuário' : 'Convidar Usuário'} onClose={() => setShowForm(false)}>
            <form onSubmit={handleSave} className="space-y-4">
              {!editTarget && (
                <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 font-medium">
                  ℹ️ Um e-mail de convite será enviado para o usuário definir sua senha.
                </div>
              )}
              <Input label="Nome Completo" value={form.displayName} onChange={v => setForm(f => ({ ...f, displayName: v }))} required placeholder="Nome do usuário" />
              <Input label="E-mail" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} required placeholder="usuario@empresa.com" />
              {canEditRole && (
                <Select label="Perfil de Acesso" value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} required>
                  <option value="viewer">Visualizador (Portaria)</option>
                  <option value="admin">Administrador</option>
                  {profile.role === 'master' && <option value="master">Master</option>}
                </Select>
              )}
              {(profile.role === 'master' && form.role !== 'master') && (
                <div className="space-y-4">
                  <Select label="Empresa Responsável" value={form.companyId} onChange={v => setForm(f => ({ ...f, companyId: v }))} required>
                    <CompanySelectOptions companies={companies} />
                  </Select>
                  {form.role === 'admin' && (
                    <div className="space-y-3">
                      <Toggle label="Gerenciar todas as filiais desta empresa?" checked={form.manageAllBranches} onChange={v => setForm(f => ({ ...f, manageAllBranches: v }))} />
                      
                      {!form.manageAllBranches && (
                        <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Selecionar Unidades Autorizadas</label>
                          <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {companies.filter(c => c.parentId === form.companyId || c.id === form.companyId).map(site => (
                              <label key={site.id} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-100 hover:border-blue-200 transition-colors cursor-pointer group">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  checked={form.managedCompanyIds.includes(site.id)}
                                  onChange={e => {
                                    const ids = e.target.checked 
                                      ? [...form.managedCompanyIds, site.id]
                                      : form.managedCompanyIds.filter(id => id !== site.id);
                                    setForm(f => ({ ...f, managedCompanyIds: ids }));
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-700 truncate">{site.name}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{site.parentId ? 'Filial' : 'Matriz'}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {profile.role === 'admin' && form.role === 'viewer' && (
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Unidades Autorizadas para Visualizador</label>
                  <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-2 custom-scrollbar p-3 bg-slate-50 rounded-2xl">
                    {/* Admin só pode dar acesso às unidades que ele mesmo gerencia */}
                    {companies.filter(c => 
                      profile.manageAllBranches 
                        ? (c.id === profile.companyId || c.parentId === profile.companyId)
                        : (profile.managedCompanyIds || []).includes(c.id)
                    ).map(site => (
                      <label key={site.id} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-100 hover:border-blue-200 transition-colors cursor-pointer group">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={form.managedCompanyIds.includes(site.id)}
                          onChange={e => {
                            const ids = e.target.checked 
                              ? [...form.managedCompanyIds, site.id]
                              : form.managedCompanyIds.filter(id => id !== site.id);
                            setForm(f => ({ ...f, managedCompanyIds: ids }));
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{site.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{site.parentId ? 'Filial' : 'Matriz'}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editTarget ? 'Salvar Alterações' : 'Enviar Convite'}</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <ConfirmModal 
            title="Excluir Usuário"
            message={`Deseja realmente remover o acesso de "${deleteTarget.displayName || deleteTarget.email}"? Esta ação não poderá ser desfeita.`}
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTarget(null)}
            loading={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

