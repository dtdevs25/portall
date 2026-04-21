export type UserRole = 'master' | 'admin' | 'viewer';
export type TipoAcesso = 'visitante' | 'prestador';
export type StatusAcesso = 'liberado' | 'a_vencer' | 'bloqueado';

export interface Company {
  id: string;
  parentId?: string | null;
  name: string;
  cnpj?: string;
  isActive: boolean;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  uid?: string; // para compatibilidade de firebase caso reutilizado, ou id real do banco
  email: string;
  displayName: string;
  role: UserRole;
  companyId?: string;
  managedCompanyIds?: string[];
  manageAllBranches?: boolean;
  companyName?: string;
  isActive: boolean;
  createdAt: string;
}

export interface EmpresaTerceiro {
  id: string;
  companyId: string;
  name: string;
  cnpj?: string;
  createdAt: string;
}

export interface TipoTreinamento {
  id: string;
  nome: string;
  codigo: string;
  validadeMeses: number;
  escopo: 'global' | 'personalizado';
  companyId?: string; // Null se for global
  createdAt: string;
}

export interface TipoAtividade {
  id: string;
  companyId: string;
  nome: string;
  treinamentosObrigatorios?: string[]; // IDs dos treinamentos retornados na API
}

export interface TreinamentoPessoa {
  id?: string;
  pessoaId: string;
  treinamentoId: string;
  treinamentoNome?: string;
  treinamentoCodigo?: string;
  dataRealizacao: string; // YYYY-MM-DD
  dataVencimento: string; // YYYY-MM-DD
  statusTreinamento?: 'Valido' | 'A Vencer' | 'Vencido';
}

export interface Pessoa {
  id: string;
  companyId: string;
  tipoAcesso: TipoAcesso;
  
  foto?: string; // base64
  nomeCompleto: string;
  documento: string;
  empresaOrigemId?: string;
  empresaOrigemNome?: string;
  responsavelInterno: string;
  
  celularAutorizado: boolean;
  celularImei?: string;
  notebookAutorizado: boolean;
  notebookMarca?: string;
  notebookPatrimonio?: string;
  liberadoAte?: string; // Data ISO
  descricaoAtividade?: string;
  
  // Apenas prestador
  atividadeId?: string;
  atividadeNome?: string;
  asoDataRealizacao?: string; // YYYY-MM-DD
  epiObrigatorio: boolean;
  epiDescricao?: string;

  // Calculado dinamicamente via back-end
  statusAcesso?: StatusAcesso;
  motivoBloqueio?: string[];
  
  treinamentos?: TreinamentoPessoa[]; // Arrays agrupados na leitura

  lastPresenceStatus?: 'entrada' | 'saida' | null;
  lastPresenceTimestamp?: string | null;

  createdBy?: string;
  createdAt: string;
}

export interface PresencaLog {
  id: string;
  pessoaId: string;
  pessoaNome?: string;
  empresaOrigem?: string;
  companyId?: string;
  viewerId: string;
  viewerNome?: string;
  status: 'entrada' | 'saida';
  armario?: string;
  timestamp: string;
}

export interface NotificationEmail {
  id: string;
  companyId: string;
  email: string;
  createdAt: string;
}

export interface SystemLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  timestamp: string;
}
