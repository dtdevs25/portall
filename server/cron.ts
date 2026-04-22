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

  // Busca Pessoas com ASO vencido ou a vencer + Empresa Terceira
  const asoAlerts = await query<any>(
    `SELECT p.nome_completo, p.documento, p.aso_data_realizacao, et.name as empresa_nome
     FROM pessoas p
     LEFT JOIN empresas_terceiro et ON p.empresa_origem_id = et.id
     WHERE p.company_id = $1 
       AND p.is_active = TRUE 
       AND p.tipo_acesso = 'prestador'
       AND p.aso_data_realizacao IS NOT NULL
       AND (p.aso_data_realizacao + interval '1 year' <= $2)`,
    [companyId, deadline]
  );

  // Busca Treinamentos vencidos ou a vencer + Empresa Terceira
  const trainingAlerts = await query<any>(
    `SELECT p.nome_completo, p.documento, t.nome as treinamento_nome, tp.data_vencimento, et.name as empresa_nome
     FROM treinamentos_pessoa tp
     JOIN pessoas p ON tp.pessoa_id = p.id
     JOIN tipos_treinamento t ON tp.treinamento_id = t.id
     LEFT JOIN empresas_terceiro et ON p.empresa_origem_id = et.id
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
  const peopleMap: Record<string, { name: string; empresa: string; docs: { type: string; venc: Date; isVencido: boolean }[] }> = {};

  asoAlerts.forEach(a => {
    const doc = a.documento;
    if (!peopleMap[doc]) peopleMap[doc] = { name: a.nome_completo, empresa: a.empresa_nome || 'N/A', docs: [] };
    const venc = addDays(new Date(a.aso_data_realizacao), 365);
    peopleMap[doc].docs.push({ type: 'ASO', venc, isVencido: venc < new Date() });
  });

  trainingAlerts.forEach(t => {
    const doc = t.documento;
    if (!peopleMap[doc]) peopleMap[doc] = { name: t.nome_completo, empresa: t.empresa_nome || 'N/A', docs: [] };
    const venc = new Date(t.data_vencimento);
    peopleMap[doc].docs.push({ type: t.treinamento_nome, venc, isVencido: venc < new Date() });
  });

  const rowsHtml = Object.values(peopleMap).map((p, idx) => {
    const docList = p.docs.map(d => {
      const color = d.isVencido ? '#d91e18' : '#e67e22';
      const statusText = d.isVencido ? 'VENCIDO' : 'A VENCER';
      return `<div style="margin-bottom: 2px;">• <span style="color: ${color}; font-weight: bold;">[${statusText}]</span> ${d.type} (${format(d.venc, 'dd/MM/yyyy')})</div>`;
    }).join('');

    return `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
        <td style="padding: 12px; border: 1px solid #d1d5db; font-size: 13px; color: #111827; font-weight: 600;">${p.name}</td>
        <td style="padding: 12px; border: 1px solid #d1d5db; font-size: 13px; color: #374151;">${p.empresa}</td>
        <td style="padding: 12px; border: 1px solid #d1d5db; font-size: 12px; color: #4b5563; line-height: 1.4;">
          ${docList}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 30px 10px;">
      <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #e5e7eb;">
        
        <!-- Header -->
        <div style="background-color: #ffffff; padding: 20px; border-bottom: 3px solid #001A33; text-align: left; display: flex; align-items: center; gap: 20px;">
           <img src="${logoUrl}" alt="PortALL" style="height: 50px; display: block;" />
           <div style="margin-left: 20px;">
             <h1 style="color: #001A33; margin: 0; font-size: 18px; font-weight: bold;">RELATÓRIO DE CONFORMIDADE DE TERCEIROS</h1>
             <p style="color: #6b7280; margin: 2px 0 0; font-size: 12px;">UNIDADE: <strong>${companyName.toUpperCase()}</strong> | DATA: ${today}</p>
           </div>
        </div>

        <div style="padding: 25px;">
          <p style="color: #1f2937; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
            Prezados,<br><br>
            Segue a listagem detalhada de prestadores de serviço com pendências de documentação (vencidos ou próximos ao vencimento). 
            A falta de regularização impedirá o acesso às dependências da unidade.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 1px solid #d1d5db;">
            <thead style="background-color: #f3f4f6;">
              <tr>
                <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: bold; color: #374151; border: 1px solid #d1d5db; text-transform: uppercase;">Colaborador</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: bold; color: #374151; border: 1px solid #d1d5db; text-transform: uppercase;">Empresa Terceira</th>
                <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: bold; color: #374151; border: 1px solid #d1d5db; text-transform: uppercase;">Pendências e Vencimentos</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="text-align: center; margin-bottom: 25px;">
            <a href="${appUrl}/terceiros" style="display: inline-block; background-color: #001A33; color: #ffffff; padding: 12px 25px; border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 14px; text-transform: uppercase;">
              Acessar Portal de Gestão
            </a>
          </div>

          <div style="background-color: #fffbeb; border: 1px solid #fde68a; padding: 15px; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px; color: #92400e; font-weight: bold;">
              ⚠️ IMPORTANTE: Documentos vencidos bloqueiam o acesso automaticamente. Por favor, regularize com antecedência.
            </p>
          </div>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 11px; color: #9ca3af;">
            PortALL &bull; Sistema de Gestão de Acessos e Conformidade<br>
            Este é um e-mail automático gerado pelo sistema.
          </p>
        </div>
      </div>
    </div>
  `;
}
