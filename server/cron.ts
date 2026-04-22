import cron from 'node-cron';
import { query } from './db.js';
import { sendMail } from './mailer.js';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Módulo de Tarefas Agendadas (Cron) — PortALL
 * Responsável pelo envio semanal de relatórios de vencimento.
 */

export function initCronJobs() {
  // Configuração: Toda segunda-feira às 08:30 (horário do servidor)
  // Cron: '30 8 * * 1' -> Minuto 30, Hora 8, Dia do Mês *, Mês *, Dia da Semana 1 (Segunda)
  cron.schedule('30 8 * * 1', async () => {
    console.log('⏰ [CRON] Iniciando varredura semanal de vencimentos...');
    await runExpirationAudit();
  });

  console.log('✅ [CRON] Agendamento de notificações ativado (Seg 08:30).');
}

/**
 * Executa a auditoria de vencimentos para todas as empresas configuradas.
 */
export async function runExpirationAudit() {
  try {
    const companies = await query<{ id: string, name: string }>(
      'SELECT DISTINCT c.id, c.name FROM companies c JOIN notification_emails n ON c.id = n.company_id WHERE c.is_active = TRUE'
    );

    for (const company of companies) {
      await processCompanyComplianceReport(company.id, company.name);
    }
  } catch (err) {
    console.error('❌ [CRON] Erro durante auditoria de vencimentos:', err);
  }
}

/**
 * Processa e envia o relatório de conformidade para uma empresa específica.
 * Pode ser chamado via CRON ou manualmente via API.
 */
export async function processCompanyComplianceReport(companyId: string, companyName: string) {
  // 1. Buscar e-mails de destino para esta empresa
  const emailRows = await query<{ email: string }>(
    'SELECT email FROM notification_emails WHERE company_id = $1',
    [companyId]
  );
  const recipients = emailRows.map(r => r.email);
  if (recipients.length === 0) return { success: false, message: 'Nenhum e-mail de notificação configurado.' };

  // 2. Buscar pessoas (prestadores) ativos com documentos vencendo em 45 dias
  const deadline = addDays(new Date(), 45);

  // Busca Pessoas com ASO vencido ou a vencer
  const asoAlerts = await query<any>(
    `SELECT nome_completo, documento, aso_data_realizacao 
     FROM pessoas 
     WHERE company_id = $1 
       AND is_active = TRUE 
       AND tipo_acesso = 'prestador'
       AND aso_data_realizacao IS NOT NULL
       AND (aso_data_realizacao + interval '1 year' <= $2)`,
    [companyId, deadline]
  );

  // Busca Treinamentos vencidos ou a vencer
  const trainingAlerts = await query<any>(
    `SELECT p.nome_completo, p.documento, t.nome as treinamento_nome, tp.data_vencimento
     FROM treinamentos_pessoa tp
     JOIN pessoas p ON tp.pessoa_id = p.id
     JOIN tipos_treinamento t ON tp.treinamento_id = t.id
     WHERE p.company_id = $1
       AND p.is_active = TRUE
       AND tp.data_vencimento <= $2`,
    [companyId, deadline]
  );

  if (asoAlerts.length === 0 && trainingAlerts.length === 0) {
    console.log(`[CRON/API] Empresa ${companyName}: Nada a reportar.`);
    return { success: true, message: 'Nada a reportar para esta empresa.', sent: false };
  }

  // 3. Formatar Relatório HTML
  const reportHtml = generateHtmlReport(companyName, asoAlerts, trainingAlerts);

  // 4. Enviar E-mail
  await sendMail({
    to: recipients,
    subject: `🚨 [PortALL] Relatório de Vencimentos - ${companyName}`,
    html: reportHtml
  });

  return { success: true, message: 'Relatório enviado com sucesso.', sent: true };
}

function generateHtmlReport(companyName: string, asoAlerts: any[], trainingAlerts: any[]) {
  const appUrl = process.env.APP_URL || 'https://portall.ctdibrasil.com.br';
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const rowsAso = asoAlerts.map(a => {
    const venc = addDays(new Date(a.aso_data_realizacao), 365);
    const isVencido = venc < new Date();
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #1a202c;">${a.nome_completo}</td>
        <td style="padding: 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #4a5568;">ASO (Saúde)</td>
        <td style="padding: 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; font-weight: bold; color: ${isVencido ? '#e53e3e' : '#d69e2e'};">
          ${format(venc, 'dd/MM/yyyy')} ${isVencido ? '(VENCIDO)' : '(A VENCER)'}
        </td>
      </tr>
    `;
  }).join('');

  const rowsTrain = trainingAlerts.map(t => {
    const venc = new Date(t.data_vencimento);
    const isVencido = venc < new Date();
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #1a202c;">${t.nome_completo}</td>
        <td style="padding: 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #4a5568;">${t.treinamento_nome}</td>
        <td style="padding: 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; font-weight: bold; color: ${isVencido ? '#e53e3e' : '#d69e2e'};">
          ${format(venc, 'dd/MM/yyyy')} ${isVencido ? '(VENCIDO)' : '(A VENCER)'}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7fafc; padding: 40px 20px;">
      <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 32px 40px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">Relatório de Conformidade</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">${companyName} &bull; ${today}</p>
        </div>
        
        <div style="padding: 40px;">
          <p style="color: #4a5568; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            Olá, equipe de Segurança.<br>
            Identificamos prestadores com documentos vencidos ou próximos do vencimento (45 dias). 
            Por favor, providencie a regularização para evitar bloqueios na portaria.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
            <thead>
              <tr style="background-color: #f8fafc;">
                <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Colaborador</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Documento</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase;">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              ${rowsAso}
              ${rowsTrain}
            </tbody>
          </table>

          <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 32px;">
            <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 600;">
              ⚠️ Documentos vencidos resultam em bloqueio imediato no próximo registro de entrada.
            </p>
          </div>

          <div style="text-align: center;">
            <a href="${appUrl}/terceiros" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);">
              Gerenciar Documentação no Portal
            </a>
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">
            PortALL &bull; Sistema de Gestão de Terceiros e Controle de Acesso<br>
            Este é um e-mail automático. Por favor, não responda.
          </p>
        </div>
      </div>
    </div>
  `;
}
