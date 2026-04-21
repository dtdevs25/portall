-- ============================================================
-- Terceirizacao - Schema PostgreSQL (Gestão Corporativa/Visitantes)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABELA: companies (Contratantes / Sistema Multi-Empresa)
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- Hierarquia (Matriz -> Filial)
  name VARCHAR(255) UNIQUE NOT NULL,
  cnpj VARCHAR(20) UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('master', 'admin', 'viewer')),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- Master pode ser nulo
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: empresas_terceiro (Origem do Visitante/Prestador)
-- ============================================================
CREATE TABLE IF NOT EXISTS empresas_terceiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE, -- Isolamento
  name VARCHAR(255) NOT NULL,
  cnpj VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- ============================================================
-- TABELA: tipos_treinamento (Global e Personalizado)
-- ============================================================
CREATE TABLE IF NOT EXISTS tipos_treinamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  codigo VARCHAR(100) NOT NULL,
  validade_meses INT NOT NULL DEFAULT 12,
  escopo VARCHAR(20) NOT NULL DEFAULT 'personalizado' CHECK (escopo IN ('global', 'personalizado')),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- Nulo se for global
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: tipos_atividade (Profissões/Cargos do Terceirizado)
-- ============================================================
CREATE TABLE IF NOT EXISTS tipos_atividade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, nome)
);

-- ============================================================
-- TABELA: atividade_treinamentos (Obrigatoriedades)
-- ============================================================
CREATE TABLE IF NOT EXISTS atividade_treinamentos (
  atividade_id UUID NOT NULL REFERENCES tipos_atividade(id) ON DELETE CASCADE,
  treinamento_id UUID NOT NULL REFERENCES tipos_treinamento(id) ON DELETE CASCADE,
  PRIMARY KEY (atividade_id, treinamento_id)
);

-- ============================================================
-- TABELA: pessoas (Visitantes e Prestadores)
-- ============================================================
CREATE TABLE IF NOT EXISTS pessoas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tipo_acesso VARCHAR(50) NOT NULL CHECK (tipo_acesso IN ('visitante', 'prestador')),
  
  -- Dados Obrigatórios Base
  foto TEXT, -- base64 ou URL path
  nome_completo VARCHAR(255) NOT NULL,
  documento VARCHAR(20) NOT NULL, -- RG ou CPF
  empresa_origem_id UUID REFERENCES empresas_terceiro(id) ON DELETE SET NULL,
  responsavel_interno VARCHAR(255) NOT NULL,
  
  -- Permissões
  celular_autorizado BOOLEAN NOT NULL DEFAULT FALSE,
  notebook_autorizado BOOLEAN NOT NULL DEFAULT FALSE,
  liberado_ate TIMESTAMPTZ,
  descricao_atividade TEXT,

  -- Dados Prestador (ASO e EPI)
  atividade_id UUID REFERENCES tipos_atividade(id) ON DELETE SET NULL,
  aso_data_realizacao DATE,
  epi_obrigatorio BOOLEAN DEFAULT FALSE,
  epi_descricao TEXT,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: treinamentos_pessoa
-- ============================================================
CREATE TABLE IF NOT EXISTS treinamentos_pessoa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  treinamento_id UUID NOT NULL REFERENCES tipos_treinamento(id) ON DELETE CASCADE,
  data_realizacao DATE NOT NULL,
  data_vencimento DATE NOT NULL, -- Calculado e armazenado
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: presenca_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS presenca_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('entrada', 'saida')),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: token_blacklist
-- ============================================================
CREATE TABLE IF NOT EXISTS token_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: system_logs (Auditoria do Sistema)
-- ============================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Quem executou a ação
  action VARCHAR(50) NOT NULL, -- Ex: PESSOA_CRIADA, ENTRADA, SAIDA, PESSOA_EXCLUIDA
  entity_type VARCHAR(50) NOT NULL, -- Ex: pessoa, empresa
  entity_id UUID,
  details JSONB, -- Informações textuais/estruturadas (nome, documento, duração de permanência)
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_pessoas_company ON pessoas(company_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_documento ON pessoas(documento);
CREATE INDEX IF NOT EXISTS idx_treinamentos_vencimento ON treinamentos_pessoa(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_presenca_timestamp ON presenca_logs(timestamp DESC);

-- ============================================================
-- ATUALIZAÇÃO AUTOMÁTICA DE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_companies_timestamp BEFORE UPDATE ON companies FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE OR REPLACE TRIGGER update_users_timestamp BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE OR REPLACE TRIGGER update_empresas_terceiro_timestamp BEFORE UPDATE ON empresas_terceiro FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE OR REPLACE TRIGGER update_tipos_treinamento_timestamp BEFORE UPDATE ON tipos_treinamento FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE OR REPLACE TRIGGER update_tipos_atividade_timestamp BEFORE UPDATE ON tipos_atividade FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE OR REPLACE TRIGGER update_pessoas_timestamp BEFORE UPDATE ON pessoas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- MIGRAÇÕES / AJUSTES POST-INITIALIZATION
-- ============================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- ============================================================
-- TABELA: user_companies (Vínculo N:N Usuário ↔ Empresa)
-- Permite que um administrador gerencie múltiplas empresas
-- ============================================================
CREATE TABLE IF NOT EXISTS user_companies (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);

-- Migração: popula vínculos de admins/viewers existentes a partir do company_id atual
INSERT INTO user_companies (user_id, company_id)
SELECT id, company_id
FROM users
WHERE company_id IS NOT NULL
  AND role IN ('admin', 'viewer')
ON CONFLICT DO NOTHING;

