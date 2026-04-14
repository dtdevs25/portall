import { Pool } from 'pg';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// Pool de conexão PostgreSQL
// ============================================================
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' 
    ? { rejectUnauthorized: false } 
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ============================================================
// Inicialização do banco de dados
// ============================================================
export async function initDB(): Promise<void> {
  const client = await pool.connect();
  
  try {
    console.log('📦 Inicializando banco de dados...');
    
    // Executa o schema SQL
    const schemaPath = join(process.cwd(), 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await client.query(schema);
      console.log('✅ Schema PostgreSQL aplicado com sucesso.');
    }

    // Cria admin inicial se não existir nenhum usuário
    const { rows } = await client.query(
      'SELECT COUNT(*) as count FROM users'
    );
    
    if (parseInt(rows[0].count) === 0) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@portall.ehspro.com.br';
      const adminPassword = process.env.ADMIN_PASSWORD || 'PortALLAdmin@2026!';
      const adminName = process.env.ADMIN_NAME || 'Master';
      
      const hash = await bcrypt.hash(adminPassword, 12);
      
      await client.query(
        `INSERT INTO users (email, display_name, password_hash, role)
         VALUES ($1, $2, $3, 'master')`,
        [adminEmail, adminName, hash]
      );
      
      console.log('');
      console.log('🔐 ================================================');
      console.log('   ADMIN INICIAL CRIADO:');
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Senha: ${adminPassword}`);
      console.log('   ⚠️  MUDE A SENHA APÓS O PRIMEIRO LOGIN!');
      console.log('🔐 ================================================');
      console.log('');
    } else {
      console.log('✅ Banco de dados já inicializado.');
    }

    // Limpa tokens expirados da blacklist
    await client.query(
      'DELETE FROM token_blacklist WHERE expires_at < NOW()'
    );

  } finally {
    client.release();
  }
}

// ============================================================
// Helper para queries seguras (parametrizadas)
// ============================================================
export async function query<T = Record<string, unknown>>(
  text: string, 
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await pool.query(text, params);
  return result.rows[0] as T || null;
}
