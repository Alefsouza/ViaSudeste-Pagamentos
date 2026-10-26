routerAdd(
  'GET',
  '/backend/v1/pagamentos/totals',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.unauthorizedError('Authentication required')
    }

    try {
      // 1. Obter maxRef
      let maxRef = 0
      try {
        const maxRefPlaceholder = new DynamicModel({ max_ref: 0 })
        $app
          .db()
          .newQuery(
            'SELECT COALESCE(MAX(referencia), 0) AS max_ref FROM colaboradores WHERE referencia > 0',
          )
          .one(maxRefPlaceholder)
        maxRef = Number(maxRefPlaceholder.max_ref) || 0
      } catch (errMaxRef) {
        maxRef = 0
      }

      // 2. Consulta de Pagos agrupados por tipo (do histórico completo de pagamentos confirmados)
      const queryPagos = `
        SELECT
          COALESCE(idtipopgto, 0) AS idtipopgto,
          COALESCE(tipo_pagamento, '') AS tipo_pagamento,
          SUM(COALESCE(valor_pago, 0)) AS total_pago,
          COUNT(*) AS total_count
        FROM pagamentos
        WHERE status = 'Confirmado'
        GROUP BY idtipopgto, tipo_pagamento
      `
      const rowsPagos = arrayOf(
        new DynamicModel({
          idtipopgto: 0,
          tipo_pagamento: '',
          total_pago: -0,
          total_count: 0,
        }),
      )
      $app.db().newQuery(queryPagos).all(rowsPagos)

      // 3. Consulta de Pendentes agrupados por tipo (da tabela colaboradores onde ainda não foi confirmado)
      // Critério: pendências da janela ativa (6 referências mais recentes)
      // MAIS pendências de qualquer colaborador com liberado_pagamento = 1 fora da janela.
      // Otimização: substituição do NOT EXISTS por LEFT JOIN ... IS NULL para usar os índices compostos
      const minJanelaRef = maxRef > 5 ? maxRef - 5 : 1
      const queryPendentes = `
        SELECT
          COALESCE(c.idtipopgto, 0) AS idtipopgto,
          SUM(COALESCE(c.valor_a_receber, c.valor, 0)) AS total_pendente,
          COUNT(*) AS total_count
        FROM colaboradores c
        LEFT JOIN pagamentos p ON p.colaborador_id = c.id AND p.status = 'Confirmado'
        WHERE (c.foto_confirmacao_url IS NULL OR c.foto_confirmacao_url = '')
          AND (c.referencia >= {:minRef} OR c.liberado_pagamento = 1)
          AND p.id IS NULL
        GROUP BY c.idtipopgto
      `
      const rowsPendentes = arrayOf(
        new DynamicModel({
          idtipopgto: 0,
          total_pendente: -0,
          total_count: 0,
        }),
      )
      $app.db().newQuery(queryPendentes).bind({ minRef: minJanelaRef }).all(rowsPendentes)

      // 4. Contagem de colaboradores distintos no histórico completo:
      // - Colaboradores com pagamento Confirmado (histórico completo de pagamentos confirmados)
      // - UNION com colaboradores pendentes válidos (janela ativa OU liberado_pagamento = 1 fora da janela, sem confirmação)
      const queryColaboradoresCount = `
        SELECT COUNT(DISTINCT registro) AS total_colaboradores FROM (
          SELECT registro
          FROM pagamentos
          WHERE status = 'Confirmado' AND registro IS NOT NULL AND registro != ''
          UNION
          SELECT c.registro
          FROM colaboradores c
          LEFT JOIN pagamentos p ON p.colaborador_id = c.id AND p.status = 'Confirmado'
          WHERE (c.foto_confirmacao_url IS NULL OR c.foto_confirmacao_url = '')
            AND (c.referencia >= {:minRef} OR c.liberado_pagamento = 1)
            AND p.id IS NULL
            AND c.registro IS NOT NULL
            AND c.registro != ''
        ) AS distinct_colabs
      `
      let totalColaboradores = 0
      try {
        const colabCountModel = new DynamicModel({ total_colaboradores: 0 })
        $app
          .db()
          .newQuery(queryColaboradoresCount)
          .bind({ minRef: minJanelaRef })
          .one(colabCountModel)
        totalColaboradores = Number(colabCountModel.total_colaboradores) || 0
      } catch (errColabCount) {
        console.log(
          'HOOK_WARN_COLAB_COUNT:',
          errColabCount && errColabCount.message ? errColabCount.message : String(errColabCount),
        )
        totalColaboradores = 0
      }

      // 5. Totais por Referência (histórico completo para gráficos de referência)
      const queryRefPagos = `
        SELECT
          COALESCE(c.referencia, 0) AS referencia,
          SUM(COALESCE(p.valor_pago, 0)) AS total_pago,
          COALESCE(MIN(c.periodo_inicio), '') AS periodo_inicio,
          COALESCE(MAX(c.periodo_fim), '') AS periodo_fim
        FROM pagamentos p
        JOIN colaboradores c ON p.colaborador_id = c.id
        WHERE p.status = 'Confirmado' AND c.referencia > 0
        GROUP BY c.referencia
        ORDER BY c.referencia DESC
      `
      const rowsRef = arrayOf(
        new DynamicModel({
          referencia: 0,
          total_pago: -0,
          periodo_inicio: '',
          periodo_fim: '',
        }),
      )
      $app.db().newQuery(queryRefPagos).all(rowsRef)

      // 6. Nomes distintos de tipo_pagamento para alimentar filtros do app sem varredura em pagamentos
      const queryTiposDistintos = `
        SELECT DISTINCT tipo_pagamento
        FROM pagamentos
        WHERE tipo_pagamento IS NOT NULL AND tipo_pagamento != ''
        UNION
        SELECT DISTINCT CASE
          WHEN idtipopgto = 1 THEN 'Hora Extra'
          WHEN idtipopgto = 2 THEN 'Vale Refeição'
          WHEN idtipopgto = 3 THEN 'Férias Trabalhada'
          WHEN idtipopgto = 4 THEN 'Vale Refeição'
          WHEN idtipopgto = 5 THEN 'Adicional Periculosidade'
          ELSE ''
        END AS tipo_pagamento
        FROM colaboradores
        WHERE idtipopgto IS NOT NULL AND idtipopgto > 0
      `
      let tiposPagamento = []
      try {
        const rowsTipos = arrayOf(new DynamicModel({ tipo_pagamento: '' }))
        $app.db().newQuery(queryTiposDistintos).all(rowsTipos)
        tiposPagamento = rowsTipos
          .map((r) => String(r.tipo_pagamento || '').trim())
          .filter((t) => t.length > 0)
          .filter((t, idx, arr) => arr.indexOf(t) === idx)
      } catch (err) {
        tiposPagamento = [
          'Hora Extra',
          'Vale Refeição',
          'Férias Trabalhada',
          'Adicional Periculosidade',
        ]
      }

      // Mapear acumuladores por tipo (1=HE, 3=FT, 4=VR, 5=AP)
      let pago = 0
      let pagoHE = 0
      let pagoVR = 0
      let pagoFT = 0
      let pagoAP = 0
      let confirmadoCount = 0

      for (let i = 0; i < rowsPagos.length; i++) {
        const row = rowsPagos[i]
        const idtipo = Number(row.idtipopgto) || 0
        const tipoNome = String(row.tipo_pagamento || '').toLowerCase()
        const val = Number(row.total_pago) || 0
        const count = Number(row.total_count) || 0

        pago += val
        confirmadoCount += count

        if (idtipo === 1 || tipoNome.includes('hora') || tipoNome.includes('he')) {
          pagoHE += val
        } else if (
          idtipo === 4 ||
          idtipo === 2 ||
          tipoNome.includes('vale') ||
          tipoNome.includes('vr') ||
          tipoNome.includes('refeição') ||
          tipoNome.includes('refeicao')
        ) {
          pagoVR += val
        } else if (
          idtipo === 3 ||
          tipoNome.includes('férias') ||
          tipoNome.includes('ferias') ||
          tipoNome.includes('ft')
        ) {
          pagoFT += val
        } else if (idtipo === 5 || tipoNome.includes('periculosidade') || tipoNome.includes('ap')) {
          pagoAP += val
        }
      }

      let pendente = 0
      let pendenteHE = 0
      let pendenteVR = 0
      let pendenteFT = 0
      let pendenteAP = 0
      let pendenteCount = 0

      for (let j = 0; j < rowsPendentes.length; j++) {
        const row = rowsPendentes[j]
        const idtipo = Number(row.idtipopgto) || 0
        const val = Number(row.total_pendente) || 0
        const count = Number(row.total_count) || 0

        pendente += val
        pendenteCount += count

        if (idtipo === 1) {
          pendenteHE += val
        } else if (idtipo === 4 || idtipo === 2) {
          pendenteVR += val
        } else if (idtipo === 3) {
          pendenteFT += val
        } else if (idtipo === 5) {
          pendenteAP += val
        }
      }

      // 7. Distribuição por Filial (histórico completo de pagamentos confirmados)
      const queryFilialPagos = `
        SELECT
          CASE
            WHEN p.filial = 2 THEN 'Cursino'
            WHEN p.filial = 4 THEN 'Sapopemba'
            WHEN c.filial = 'Cursino' OR c.filial_id = 2 THEN 'Cursino'
            WHEN c.filial = 'Sapopemba' OR c.filial_id = 4 THEN 'Sapopemba'
            ELSE 'Outra'
          END AS filial_nome,
          SUM(COALESCE(p.valor_pago, 0)) AS total_pago
        FROM pagamentos p
        LEFT JOIN colaboradores c ON p.colaborador_id = c.id
        WHERE p.status = 'Confirmado'
        GROUP BY filial_nome
      `
      let filialTotals = []
      try {
        const rowsFilial = arrayOf(
          new DynamicModel({
            filial_nome: '',
            total_pago: -0,
          }),
        )
        $app.db().newQuery(queryFilialPagos).all(rowsFilial)
        filialTotals = rowsFilial.map((r) => ({
          name: String(r.filial_nome || 'Outra'),
          value: Number(r.total_pago) || 0,
        }))
      } catch (errFilial) {
        filialTotals = []
      }

      // 8. Distribuição por Dia (histórico completo de pagamentos confirmados, horário de Brasília UTC-3)
      const queryDailyPagos = `
        SELECT
          strftime('%Y-%m-%d', datetime(
            COALESCE(
              NULLIF(p.updated, ''),
              NULLIF(p.data_pagamento, ''),
              p.created
            ),
            '-3 hours'
          )) AS data_brasilia,
          SUM(COALESCE(p.valor_pago, 0)) AS total_pago
        FROM pagamentos p
        WHERE p.status = 'Confirmado'
        GROUP BY data_brasilia
        HAVING data_brasilia IS NOT NULL
        ORDER BY data_brasilia ASC
      `
      let dailyTotals = []
      try {
        const rowsDaily = arrayOf(
          new DynamicModel({
            data_brasilia: '',
            total_pago: -0,
          }),
        )
        $app.db().newQuery(queryDailyPagos).all(rowsDaily)
        dailyTotals = rowsDaily.map((r) => {
          const dateStr = String(r.data_brasilia || '')
          const parts = dateStr.split('-')
          const formattedDate = parts.length >= 3 ? parts[2] + '/' + parts[1] : dateStr
          return {
            date: dateStr,
            formattedDate: formattedDate,
            total: Number(r.total_pago) || 0,
          }
        })
      } catch (errDaily) {
        dailyTotals = []
      }

      const referencias = rowsRef.map((r) => ({
        referencia: Number(r.referencia),
        total_pago: Number(r.total_pago) || 0,
        periodo_inicio: r.periodo_inicio || null,
        periodo_fim: r.periodo_fim || null,
      }))

      return e.json(200, {
        totals: {
          pago,
          pendente,
          pagoVR,
          pagoHE,
          pagoFT,
          pagoAP,
          pendenteVR,
          pendenteHE,
          pendenteFT,
          pendenteAP,
          confirmadoCount,
          pendenteCount,
          totalColaboradores,
        },
        maxRef,
        referencias,
        filiais: filialTotals,
        dias: dailyTotals,
        tiposPagamento,
      })
    } catch (err) {
      console.log('HOOK_ERROR_PAGAMENTOS_TOTALS:', err && err.message ? err.message : String(err))
      $app
        .logger()
        .error(
          'Erro ao calcular totais de pagamentos',
          'error',
          err && err.message ? err.message : String(err),
        )
      return e.internalServerError(
        'Erro ao calcular totais: ' + (err && err.message ? err.message : String(err)),
      )
    }
  },
  $apis.requireAuth(),
)
