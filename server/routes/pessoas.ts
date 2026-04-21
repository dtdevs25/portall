import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth/middleware.js';
import { query, queryOne } from '../db.js';

const router = Router();

router.use(requireAuth);

// Helper para calcular o status geral e verificar vencimentos
function calculateStatus(liberadoAte: Date | null, asoVencimento: Date | null, treinamentos: { vencimento: Date }[]): 'liberado' | 'a_vencer' | 'bloqueado' {
  const now = new Date();
  
  if (liberadoAte && liberadoAte < now) return 'bloqueado';
  if (asoVencimento && asoVencimento < now) return 'bloqueado';
  
  for (const t of treinamentos) {
    if (t.vencimento < now) return 'bloqueado';
  }

  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  if (asoVencimento && asoVencimento <= in30Days) return 'a_vencer';
  for (const t of treinamentos) {
    if (t.vencimento <= in30Days) return 'a_vencer';
  }

  return 'liberado';
}

// ============================================================
// GET /api/pessoas - Lista visitantes e prestadores
// Master vê todas. Admin vê de todas as suas unidades vinculadas.
// ============================================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    let pessoasData;
    const baseFields = `
      p.*, e.name as empresa_origem_nome, t.nome as atividade_nome,
      pl.status as last_presence_status, pl.timestamp as last_presence_timestamp
    `;
    const fromClause = `
      FROM pessoas p
      LEFT JOIN empresas_terceiro e ON p.empresa_origem_id = e.id
      LEFT JOIN tipos_atividade t ON p.atividade_id = t.id
      LEFT JOIN LATERAL (
        SELECT status, timestamp 
        FROM presenca_logs 
        WHERE pessoa_id = p.id 
        ORDER BY timestamp DESC 
        LIMIT 1
      ) pl ON true
    `;

    if (req.user?.role === 'master') {
      pessoasData = await query(
        `SELECT ${baseFields} ${fromClause} ORDER BY p.nome_completo ASC`
      );
    } else {
      pessoasData = await query(
        `SELECT ${baseFields} ${fromClause}
         WHERE p.company_id IN (
           SELECT company_id FROM user_companies WHERE user_id = $1
           UNION
           SELECT id FROM companies WHERE parent_id IN (
             SELECT company_id FROM user_companies WHERE user_id = $1
           )
         )
         ORDER BY p.nome_completo ASC`,
        [req.user!.userId]
      );
    }

    // Busca os treinamentos atrelados para calcular os vencimentos reais
    const pessoasIds = pessoasData.map((p: any) => p.id);
    let treinamentosPorPessoa: Record<string, any[]> = {};

    if (pessoasIds.length > 0) {
      const links = await query(
        `SELECT tp.*, t.nome, t.codigo 
         FROM treinamentos_pessoa tp
         JOIN tipos_treinamento t ON tp.treinamento_id = t.id
         WHERE tp.pessoa_id = ANY($1)`,
        [pessoasIds]
      );

      links.forEach((l: any) => {
        if (!treinamentosPorPessoa[l.pessoa_id]) treinamentosPorPessoa[l.pessoa_id] = [];
        treinamentosPorPessoa[l.pessoa_id].push({
           treinamentoId: l.treinamento_id,
           treinamentoNome: l.nome,
           treinamentoCodigo: l.codigo,
           dataRealizacao: l.data_realizacao,
           dataVencimento: l.data_vencimento
        });
      });
    }

    const payload = pessoasData.map((p: any) => {
      // 1 ano para ASO via genérico, se o escopo for esse, senão usa lógica custom
      let asoVencimento = null;
      if (p.aso_data_realizacao) {
         asoVencimento = new Date(p.aso_data_realizacao);
         asoVencimento.setFullYear(asoVencimento.getFullYear() + 1); // Exemplo ASO = 12 meses
      }
      
      const liberadoAteDate = p.liberado_ate ? new Date(p.liberado_ate) : null;
      const tpps = treinamentosPorPessoa[p.id] || [];
      const vencimentos = tpps.map(t => ({ vencimento: new Date(t.dataVencimento) }));

      const statusAcesso = calculateStatus(liberadoAteDate, asoVencimento, vencimentos);

      return {
        id: p.id,
        companyId: p.company_id,
        tipoAcesso: p.tipo_acesso,
        foto: p.foto,
        nomeCompleto: p.nome_completo,
        documento: p.documento,
        empresaOrigemId: p.empresa_origem_id,
        empresaOrigemNome: p.empresa_origem_nome,
        responsavelInterno: p.responsavel_interno,
        celularAutorizado: p.celular_autorizado,
        notebookAutorizado: p.notebook_autorizado,
        liberadoAte: p.liberado_ate,
        descricaoAtividade: p.descricao_atividade,
        atividadeId: p.atividade_id,
        atividadeNome: p.atividade_nome,
        asoDataRealizacao: p.aso_data_realizacao,
        epiObrigatorio: p.epi_obrigatorio,
        epiDescricao: p.epi_descricao,
        statusAcesso,
        treinamentos: tpps,
        lastPresenceStatus: p.last_presence_status,
        lastPresenceTimestamp: p.last_presence_timestamp
      };
    });
    
    res.json(payload);
  } catch (err) {
    console.error('GET /pessoas error:', err);
    res.status(500).json({ error: 'Erro ao buscar pessoas.' });
  }
});

// A partir daqui, apenas Master/Admin podem modificar
router.use((req: AuthRequest, res: Response, next) => {
  if (req.user?.role === 'viewer') {
    res.status(403).json({ error: 'Você não tem permissão para esta ação.' });
    return;
  }
  next();
});

// ============================================================
// POST /api/pessoas
// ============================================================
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      companyId, tipoAcesso, foto, nomeCompleto, documento, empresaOrigemId, responsavelInterno,
      celularAutorizado, celularImei, notebookAutorizado, notebookMarca, notebookPatrimonio,
      liberadoAte, descricaoAtividade,
      atividadeId, asoDataRealizacao, epiObrigatorio, epiDescricao,
      treinamentos // ARRAY de treinamentos [{ treinamentoId, dataRealizacao }]
    } = req.body;

    if (!companyId || !nomeCompleto || !documento || !responsavelInterno) {
      res.status(400).json({ error: 'Dados obrigatórios ausentes.' }); return;
    }

    // Validação de acesso para Admin
    if (req.user?.role === 'admin') {
      const hasAccess = await queryOne(
        `SELECT id FROM companies 
         WHERE id = $1 AND (
           id IN (SELECT company_id FROM user_companies WHERE user_id = $2)
           OR 
           parent_id IN (SELECT company_id FROM user_companies WHERE user_id = $2)
         )`,
        [companyId, req.user.userId]
      );
      if (!hasAccess) {
        res.status(403).json({ error: 'Você não tem permissão para cadastrar pessoas nesta unidade.' });
        return;
      }
    }

    // Insere a pessoa
    const pessoa = await queryOne<{ id: string }>(
      `INSERT INTO pessoas (
        company_id, tipo_acesso, foto, nome_completo, documento, empresa_origem_id, responsavel_interno,
        celular_autorizado, celular_imei, notebook_autorizado, notebook_marca, notebook_patrimonio, 
        liberado_ate, descricao_atividade, atividade_id, aso_data_realizacao, epi_obrigatorio, 
        epi_descricao, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id`,
      [
        companyId, tipoAcesso, foto, nomeCompleto, documento, empresaOrigemId || null, responsavelInterno,
        celularAutorizado, celularImei || null, notebookAutorizado, notebookMarca || null, 
        notebookPatrimonio || null, liberadoAte || null, descricaoAtividade,
        tipoAcesso === 'prestador' ? (atividadeId || null) : null,
        asoDataRealizacao || null,
        tipoAcesso === 'prestador' ? epiObrigatorio : false,
        tipoAcesso === 'prestador' ? epiDescricao : null,
        req.user!.userId
      ]
    );

    // Salva os treinamentos e calcula datas de vencimento automaticamente baseada na validade!
    if (pessoa && tipoAcesso === 'prestador' && Array.isArray(treinamentos)) {
      for (const tr of treinamentos) {
         if (!tr.treinamentoId || !tr.dataRealizacao) continue;
         
         const tipo = await queryOne<{ validade_meses: number }>('SELECT validade_meses FROM tipos_treinamento WHERE id = $1', [tr.treinamentoId]);
         if (!tipo) continue;

         const dateR = new Date(tr.dataRealizacao);
         const dateV = new Date(dateR);
         dateV.setMonth(dateV.getMonth() + tipo.validade_meses);

         await query(
           `INSERT INTO treinamentos_pessoa (pessoa_id, treinamento_id, data_realizacao, data_vencimento) 
            VALUES ($1, $2, $3, $4)`,
           [pessoa.id, tr.treinamentoId, tr.dataRealizacao, dateV.toISOString().split('T')[0]]
         );
      }
    }

    res.status(201).json(pessoa);
  } catch (err: any) {
    console.error('POST /pessoas error:', err);
    res.status(500).json({ error: 'Erro ao salvar pessoa.' });
  }
});

// ============================================================
// PUT /api/pessoas/:id
// ============================================================
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      companyId, tipoAcesso, foto, nomeCompleto, documento, empresaOrigemId, responsavelInterno,
      celularAutorizado, celularImei, notebookAutorizado, notebookMarca, notebookPatrimonio,
      liberadoAte, descricaoAtividade,
      atividadeId, asoDataRealizacao, epiObrigatorio, epiDescricao,
      treinamentos
    } = req.body;

    // Atualiza dados da pessoa
    await query(
      `UPDATE pessoas SET 
        company_id = $1, tipo_acesso = $2, foto = $3, nome_completo = $4, documento = $5, 
        empresa_origem_id = $6, responsavel_interno = $7, celular_autorizado = $8, 
        celular_imei = $9, notebook_autorizado = $10, notebook_marca = $11, 
        notebook_patrimonio = $12, liberado_ate = $13, descricao_atividade = $14, 
        atividade_id = $15, aso_data_realizacao = $16, epi_obrigatorio = $17, 
        epi_descricao = $18, updated_at = NOW()
       WHERE id = $19`,
      [
        companyId, tipoAcesso, foto, nomeCompleto, documento, empresaOrigemId || null, responsavelInterno,
        celularAutorizado, celularImei || null, notebookAutorizado, notebookMarca || null, 
        notebookPatrimonio || null, liberadoAte || null, descricaoAtividade,
        tipoAcesso === 'prestador' ? (atividadeId || null) : null,
        asoDataRealizacao || null, 
        tipoAcesso === 'prestador' ? epiObrigatorio : false,
        tipoAcesso === 'prestador' ? epiDescricao : null,
        id
      ]
    );

    // Atualiza treinamentos (Remove antigos e insere novos)
    if (tipoAcesso === 'prestador' && Array.isArray(treinamentos)) {
      await query('DELETE FROM treinamentos_pessoa WHERE pessoa_id = $1', [id]);
      for (const tr of treinamentos) {
        if (!tr.treinamentoId || !tr.dataRealizacao) continue;
        
        const tipo = await queryOne<{ validade_meses: number }>('SELECT validade_meses FROM tipos_treinamento WHERE id = $1', [tr.treinamentoId]);
        if (!tipo) continue;

        const dateR = new Date(tr.dataRealizacao);
        const dateV = new Date(dateR);
        dateV.setMonth(dateV.getMonth() + tipo.validade_meses);

        await query(
          `INSERT INTO treinamentos_pessoa (pessoa_id, treinamento_id, data_realizacao, data_vencimento) 
           VALUES ($1, $2, $3, $4)`,
          [id, tr.treinamentoId, tr.dataRealizacao, dateV.toISOString().split('T')[0]]
        );
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('PUT /pessoas error:', err);
    res.status(500).json({ error: 'Erro ao atualizar pessoa.' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
   // apenas soft/hard delete
   res.json({ message: 'delete here' });
});

export default router;
