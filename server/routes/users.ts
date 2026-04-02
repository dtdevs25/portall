import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { requireAuth, requireAdmin, AuthRequest } from '../auth/middleware.js';
import { query, queryOne } from '../db.js';

const router = Router();

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: parseInt(process.env.SMTP_PORT || '587') === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

router.use(requireAuth);
router.use(requireAdmin);

// ============================================================
// GET /api/users - Lista todos os usuários
// ============================================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const users = await query<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'vigilante';
      is_active: boolean;
      created_at: string;
    }>(
      `SELECT id, email, display_name, role, is_active, created_at
       FROM users
       ORDER BY display_name ASC`
    );

    res.json(users.map(u => ({
      uid: u.id,
      email: u.email,
      displayName: u.display_name,
      role: u.role,
      isActive: u.is_active,
      createdAt: u.created_at,
    })));
  } catch (err) {
    console.error('GET /users error:', err);
    res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
});

// ============================================================
// POST /api/users - Cria novo usuário
// ============================================================
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { email, displayName, role } = req.body;

    if (!email || !displayName) {
      res.status(400).json({ error: 'Email e nome são obrigatórios.' });
      return;
    }

    const validRoles = ['admin', 'vigilante'];
    const userRole = validRoles.includes(role) ? role : 'vigilante';

    // Verifica se email já existe
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    if (existing) {
      res.status(409).json({ error: 'Já existe um usuário com este e-mail.' });
      return;
    }

    // Gerar uma senha hash dummy aleatória já que ele fará login através do link
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    const user = await queryOne<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'vigilante';
      is_active: boolean;
      created_at: string;
    }>(
      `INSERT INTO users (email, display_name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, role, is_active, created_at`,
      [email.trim().toLowerCase(), displayName.trim(), passwordHash, userRole]
    );

    if (!user) {
      res.status(500).json({ error: 'Erro ao criar usuário.' });
      return;
    }

    // Gera token construtivo de senha (1 hora)
    const resetToken = crypto.randomBytes(64).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); 

    await query(
      `UPDATE users 
       SET reset_token = $1, reset_token_expires = $2
       WHERE id = $3`,
      [resetTokenHash, expiresAt, user.id]
    );

    const appUrl = process.env.APP_URL || 'https://ronda.ehspro.com.br';
    const resetUrl = `${appUrl}/?reset_token=${resetToken}`;

    await mailer.sendMail({
      from: `"RondaDigital" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Convite para ingressar na RondaDigital',
      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 40px 20px;">
          <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              <div style="text-align: center; margin-bottom: 32px;">
                <img src="${process.env.APP_URL || 'https://ronda.ehspro.com.br'}/RondaDigital.png" alt="RondaDigital" style="height: 48px; margin-bottom: 8px; object-fit: contain;">
                <p style="color: #6b7280; margin: 0;">Segurança e Controle em Tempo Real</p>
              </div>
            <h2 style="color: #1f2937; font-size: 18px;">Olá, ${user.display_name}!</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Você foi convidado para acessar e utilizar o sistema RondaDigital. 
              Clique no botão abaixo para concluir o seu cadastro definindo a sua senha inicial de acesso:
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #002b5c; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">
                Cadastrar Minha Senha
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 13px; text-align: center;">
              Este link de cadastro inicial é válido por <strong>1 hora</strong>.<br>
            </p>
          </div>
        </body>
        </html>
      `,
    }).catch(err => console.error('Invite email send error:', err));

    res.status(201).json({
      uid: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
    });
  } catch (err) {
    console.error('POST /users error:', err);
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
});

// ============================================================
// PUT /api/users/:id/role - Altera o role do usuário
// ============================================================
router.put('/:id/role', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['admin', 'vigilante'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Role inválido.' });
      return;
    }

    // Impede que o admin remova seu próprio role de admin
    if (id === req.user?.userId && role !== 'admin') {
      res.status(400).json({ error: 'Você não pode remover seu próprio nível de administrador.' });
      return;
    }

    const user = await queryOne<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'vigilante';
      is_active: boolean;
      created_at: string;
    }>(
      `UPDATE users SET role = $1 WHERE id = $2
       RETURNING id, email, display_name, role, is_active, created_at`,
      [role, id]
    );

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    res.json({
      uid: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
    });
  } catch (err) {
    console.error('PUT /users/:id/role error:', err);
    res.status(500).json({ error: 'Erro ao alterar nível do usuário.' });
  }
});

// ============================================================
// PUT /api/users/:id/toggle - Ativa/desativa usuário
// ============================================================
router.put('/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Não permite desativar o próprio usuário
    if (id === req.user?.userId) {
      res.status(400).json({ error: 'Você não pode desativar sua própria conta.' });
      return;
    }

    const user = await queryOne<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'vigilante';
      is_active: boolean;
    }>(
      `UPDATE users SET is_active = NOT is_active WHERE id = $1
       RETURNING id, email, display_name, role, is_active`,
      [id]
    );

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    res.json({
      uid: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      isActive: user.is_active,
    });
  } catch (err) {
    console.error('PUT /users/:id/toggle error:', err);
    res.status(500).json({ error: 'Erro ao alterar status do usuário.' });
  }
});

// ============================================================
// PUT /api/users/:id/reset-password - Admin redefine senha de um usuário
// ============================================================
router.put('/:id/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'A nova senha deve ter no mínimo 8 caracteres.' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 12);

    const user = await queryOne<{ id: string }>(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id`,
      [hash, id]
    );

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    res.json({ message: 'Senha redefinida com sucesso.' });
  } catch (err) {
    console.error('PUT /users/:id/reset-password error:', err);
    res.status(500).json({ error: 'Erro ao redefinir senha.' });
  }
});

// ============================================================
// PUT /api/users/:id - Atualiza dados do usuário
// ============================================================
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email, displayName } = req.body;

    if (!email || !displayName) {
      res.status(400).json({ error: 'Email e nome são obrigatórios.' });
      return;
    }

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2',
      [email.trim(), id]
    );

    if (existing) {
      res.status(409).json({ error: 'Já existe outro usuário com este e-mail.' });
      return;
    }

    const user = await queryOne<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'vigilante';
      is_active: boolean;
      created_at: string;
    }>(
      `UPDATE users SET email = $1, display_name = $2 
       WHERE id = $3 
       RETURNING id, email, display_name, role, is_active, created_at`,
      [email.trim().toLowerCase(), displayName.trim(), id]
    );

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    res.json({
      uid: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
    });
  } catch (err) {
    console.error('PUT /users/:id error:', err);
    res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
});

// ============================================================
// DELETE /api/users/:id - Exclui usuário
// ============================================================
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (id === req.user?.userId) {
      res.status(400).json({ error: 'Você não pode excluir sua própria conta.' });
      return;
    }

    const deleted = await queryOne<{ id: string }>(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );

    if (!deleted) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    res.json({ message: 'Usuário excluído com sucesso.' });
  } catch (err) {
    console.error('DELETE /users/:id error:', err);
    res.status(500).json({ error: 'Erro ao excluir usuário.' });
  }
});

// ============================================================
// POST /api/users/:id/resend-invite - Reenvia link de senha
// ============================================================
router.post('/:id/resend-invite', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await queryOne<{ id: string; email: string; display_name: string; role: string }>(
      'SELECT id, email, display_name, role FROM users WHERE id = $1',
      [id]
    );

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const resetToken = crypto.randomBytes(64).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); 

    await query(
      `UPDATE users 
       SET reset_token = $1, reset_token_expires = $2
       WHERE id = $3`,
      [resetTokenHash, expiresAt, user.id]
    );

    const appUrl = process.env.APP_URL || 'https://ronda.ehspro.com.br';
    const resetUrl = `${appUrl}/?reset_token=${resetToken}`;

    await mailer.sendMail({
      from: `"RondaDigital" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Recuperação/Convite para RondaDigital',
      html: `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 40px 20px;">
          <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 32px;">
              <img src="${process.env.APP_URL || 'https://ronda.ehspro.com.br'}/RondaDigital.png" alt="RondaDigital" style="height: 48px; margin-bottom: 8px; object-fit: contain;">
              <p style="color: #6b7280; margin: 0;">Segurança e Controle em Tempo Real</p>
            </div>
            <h2 style="color: #1f2937; font-size: 18px;">Olá, ${user.display_name}!</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              Foi solicitado um novo link para você acessar o sistema RondaDigital. 
              Clique no botão abaixo para definir sua senha de acesso inicial ou acompanhá-la:
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #002b5c; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">
                Cadastrar Nova Senha
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 13px; text-align: center;">
              Este link é válido por <strong>1 hora</strong>.<br>
            </p>
          </div>
        </body>
        </html>
      `,
    }).catch(err => console.error('Invite email send error:', err));

    res.json({ message: 'E-mail enviado com sucesso.' });
  } catch (err) {
    console.error('POST /users/:id/resend-invite error:', err);
    res.status(500).json({ error: 'Erro ao reenviar link.' });
  }
});

export default router;
