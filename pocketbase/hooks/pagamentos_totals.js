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
        const maxRefRow = $app
          .db()
          .newQuery('SELECT MAX(referencia) AS max_ref FROM colaboradores WHERE referencia > 0')
          .one()
        if (maxRefRow && maxRefRow.max_ref != null) {
          maxRef = Number(maxRefRow.max_ref) || 0
        }
      } catch (err) {
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
      const rowsPagos = $app.db().newQuery(queryPagos).all()

      // 3. Consulta de Pendentes agrupados por tipo (da tabela colaboradores onde ainda não foi confirmado)
      const queryPendentes = `
        SELECT
          COALESCE(c.idtipopgto, 0) AS idtipopgto,
          SUM(COALESCE(c.valor_a_receber, c.valor, 0)) AS total_pendente,
          COUNT(*) AS total_count
        FROM colaboradores c
        WHERE (c.foto_confirmacao_url IS NULL OR c.foto_confirmacao_url = '')
          AND NOT EXISTS (
            SELECT 1 FROM pagamentos p
            WHERE p.colaborador_id = c.id AND p.status = 'Confirmado'
          )
        GROUP BY c.idtipopgto
      `
      const rowsPendentes = $app.db().newQuery(queryPendentes).all()

      // 4. Totais por Referência (histórico completo para gráficos de referência)
      const queryRefPagos = `
        SELECT
          COALESCE(c.referencia, 0) AS referencia,
          SUM(COALESCE(p.valor_pago, 0)) AS total_pago,
          MIN(c.periodo_inicio) AS periodo_inicio,
          MAX(c.periodo_fim) AS periodo_fim
        FROM pagamentos p
        JOIN colaboradores c ON p.colaborador_id = c.id
        WHERE p.status = 'Confirmado' AND c.referencia > 0
        GROUP BY c.referencia
        ORDER BY c.referencia DESC
      `
      const rowsRef = $app.db().newQuery(queryRefPagos).all()

      // 5. Nomes distintos de tipo_pagamento para alimentar filtros do app sem varredura em pagamentos
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
        const rowsTipos = $app.db().newQuery(queryTiposDistintos).all()
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

      // 6. Distribuição por Filial (histórico completo de pagamentos confirmados)
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
        const rowsFilial = $app.db().newQuery(queryFilialPagos).all()
        filialTotals = rowsFilial.map((r) => ({
          name: String(r.filial_nome || 'Outra'),
          value: Number(r.total_pago) || 0,
        }))
      } catch (errFilial) {
        filialTotals = []
      }

      // 7. Distribuição por Dia (histórico completo de pagamentos confirmados, horário de Brasília UTC-3)
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
        const rowsDaily = $app.db().newQuery(queryDailyPagos).all()
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
        },
        maxRef,
        referencias,
        filiais: filialTotals,
        dias: dailyTotals,
        tiposPagamento,
      })
    } catch (err) {
      $app.logger().error('Erro ao calcular totais de pagamentos', 'error', err.message)
      return e.internalServerError('Erro ao calcular totais')
    }
  },
  $apis.requireAuth(),
)
