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
  const logoUrl = `${appUrl}/LogoCompleto.png`;
  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  // Agrupar pendências por pessoa (usando documento como chave)
  const peopleMap: Record<string, { name: string; docs: { type: string; venc: Date; isVencido: boolean }[] }> = {};

  asoAlerts.forEach(a => {
    const doc = a.documento;
    if (!peopleMap[doc]) peopleMap[doc] = { name: a.nome_completo, docs: [] };
    const venc = addDays(new Date(a.aso_data_realizacao), 365);
    peopleMap[doc].docs.push({ type: 'ASO', venc, isVencido: venc < new Date() });
  });

  trainingAlerts.forEach(t => {
    const doc = t.documento;
    if (!peopleMap[doc]) peopleMap[doc] = { name: t.nome_completo, docs: [] };
    const venc = new Date(t.data_vencimento);
    peopleMap[doc].docs.push({ type: t.treinamento_nome, venc, isVencido: venc < new Date() });
  });

  const rowsHtml = Object.values(peopleMap).map(p => {
    const docList = p.docs.map(d => {
      const color = d.isVencido ? '#e53e3e' : '#d69e2e';
      const statusText = d.isVencido ? 'VENCIDO' : 'A VENCER';
      return `<div style="margin-bottom: 4px;"><span style="color: ${color}; font-weight: bold;">[${statusText}]</span> ${d.type} (${format(d.venc, 'dd/MM/yyyy')})</div>`;
    }).join('');

    return `
      <tr>
        <td style="padding: 16px 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; vertical-align: top;">
          <div style="font-weight: 700; color: #1a202c;">${p.name}</div>
        </td>
        <td style="padding: 16px 12px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #4a5568; line-height: 1.5;">
          ${docList}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f4f8; padding: 40px 10px;">
      <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; box-shadow: 0 15px 35px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <div style="background-color: #001A33; padding: 30px; text-align: center;">
          <img src="${logoUrl}" alt="PortALL" style="max-height: 60px; margin-bottom: 20px;" />
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.01em; text-transform: uppercase;">Relatório de Auditoria</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 13px; font-weight: 600;">UNIDADE: ${companyName.toUpperCase()}</p>
        </div>

        <div style="padding: 35px;">
          <div style="margin-bottom: 30px;">
            <p style="color: #2d3748; font-size: 16px; font-weight: 700; margin-bottom: 8px;">Equipe de Segurança,</p>
            <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0;">
              Abaixo listamos os prestadores de serviço com documentos vencidos ou com vencimento próximo (45 dias). 
              <strong>Atenção:</strong> Pendências de documentos resultam no bloqueio automático do acesso na portaria.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead style="background-color: #f8fafc;">
              <tr>
                <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Colaborador</th>
                <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Documentos e Prazos</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="text-align: center; margin-bottom: 35px;">
            <a href="${appUrl}/terceiros" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 15px 35px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.35);">
              Regularizar no Portal PortALL
            </a>
          </div>

          <div style="background-color: #f1f5f9; border-radius: 12px; padding: 15px; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.4;">
              Relatório gerado em <strong>${today}</strong> pelo sistema PortALL.<br>
              Este é um aviso preventivo para garantir a continuidade operacional.
            </p>
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">
            PortALL &bull; Gestão de Acessos e Conformidade
          </p>
        </div>
      </div>
    </div>
  `;
}
