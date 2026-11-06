migrate(
  (app) => {
    // Inclusão manual corretiva (caso 1218): recriar na Ref 38 o lançamento de
    // folga dos dias 17 e 18/10 de SILVERO PEDRO DA SILVA, perdido quando a ref 38
    // foi reimportada de 04/11 (o registro pago em 23/10 foi apagado na exclusão em
    // massa e a reimportação não trouxe a linha dele).
    //
    // O colaborador confirmou que NÃO recebeu o valor: o lançamento entra como
    // pendente normal (liberado para o fluxo padrão da câmera), sem vínculo com
    // nenhum pagamento e sem foto.
    //
    // Estrutura replicada das linhas existentes da ref 38:
    //   data_pagamento_v2 = data do dia trabalhado (17/10)
    //   idtipopgto = 3 (tipo "Férias Trabalhada", o usado pelas linhas de folga)
    //   horas/inicio/termino = "00:00" (mesmo padrão das linhas de folga importadas)
    //   filial_id = 4 (código da planilha -> Filial Sapopemba)
    //   liberado_pagamento = true + liberado_por = "Importação (Planilha)"
    //     (estado padrão das linhas da ref 38 — o campo data_liberacao da planilha
    //     não representa a liberação real; a real fica em liberado_por/auditoria)
    //
    // Idempotente: só grava se ainda não existir linha do 1218 na ref 38.
    // Em banco vazio (ou cópia sem a ref 38), é um no-op seguro.

    // 0. Criar a coleção de auditoria se ainda não existir (cópia vazia)
    try {
      app.findCollectionByNameOrId('auditoria_liberacoes')
    } catch (_) {
      const usersCol = app.findCollectionByNameOrId('users')
      const auditCol = new Collection({
        name: 'auditoria_liberacoes',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'user',
            type: 'relation',
            collectionId: usersCol.id,
            maxSelect: 1,
            required: false,
          },
          { name: 'responsavel', type: 'text', required: false },
          { name: 'origem', type: 'text', required: false },
          { name: 'acao', type: 'text', required: false },
          { name: 'colaborador_id', type: 'text', required: false },
          { name: 'registro', type: 'text', required: false },
          { name: 'nome', type: 'text', required: false },
          { name: 'referencia', type: 'number', required: false },
          { name: 'quantidade', type: 'number', required: false },
          { name: 'detalhes', type: 'json', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(auditCol)
    }

    // 1. Verificar se o lançamento já existe (idempotência)
    var existentes = app.findRecordsByFilter(
      'colaboradores',
      "referencia = 38 && registro = '1218'",
      '-created',
      1,
      0,
    )
    if (existentes.length > 0) {
      console.log('[0097] Lançamento do 1218 na ref 38 já existe — nada a fazer (idempotente).')
    } else {
      var col = app.findCollectionByNameOrId('colaboradores')

      var record = new Record(col)
      record.set('registro', '1218')
      record.set('nome', 'SILVERO PEDRO DA SILVA')
      record.set('valor', 288.11)
      record.set('valor_a_receber', 288.11)
      record.set('filial', 'Sapopemba')
      record.set('filial_id', 4)
      record.set('data', '17/10/2026')
      record.set('data_pagamento_v2', '2026-10-17 00:00:00.000Z')
      record.set('idtipopgto', 3)
      record.set('inicio', '00:00')
      record.set('termino', '00:00')
      record.set('horas', '00:00')
      record.set('referencia', 38)
      record.set('periodo_inicio', '2026-10-16 00:00:00.000Z')
      record.set('periodo_fim', '2026-10-31 00:00:00.000Z')
      record.set('liberado_pagamento', true)
      record.set('liberado_por', 'Importação (Planilha)')
      record.set('data_liberacao', '2026-11-05 11:00:00.000Z')
      record.set('foto_confirmacao_url', '')
      record.set('data_pagamento', '')

      app.save(record)
      console.log('[0097] Lançamento corretivo do 1218 criado na ref 38: ' + record.id)

      // 2. Trilha de auditoria da inclusão manual corretiva
      try {
        var auditCol = app.findCollectionByNameOrId('auditoria_liberacoes')
        var auditRecord = new Record(auditCol)
        auditRecord.set('origem', 'migracao_corretiva')
        auditRecord.set('acao', 'incluir_lancamento')
        auditRecord.set('colaborador_id', record.id)
        auditRecord.set('registro', '1218')
        auditRecord.set('nome', 'SILVERO PEDRO DA SILVA')
        auditRecord.set('referencia', 38)
        auditRecord.set('quantidade', 1)
        auditRecord.set('detalhes', {
          motivo:
            'Inclusão manual corretiva: linha de folga dos dias 17 e 18/10 perdida na reimportação da ref 38 de 04/11 (registro 1218 pago em 23/10 foi apagado na exclusão em massa e a reimportação não trouxe a linha).',
          situacao:
            'Colaborador confirmou que NÃO recebeu o valor: lançamento criado como pendente normal, pronto para o fluxo padrão da câmera.',
          aviso:
            'O pagamento original de 23/10 NÃO corresponde a este lançamento — este é novo, pendente.',
          valor: 288.11,
          valor_a_receber: 288.11,
          tipo: 'Férias Trabalhada (idtipopgto 3 — padrão das linhas de folga da ref 38)',
          filial: 'Sapopemba (filial_id 4)',
          dias_folga: '17 e 18/10/2026',
          periodo: '16/10/2026 a 31/10/2026',
          data_pagamento: '',
          foto_confirmacao_url: '',
        })
        app.save(auditRecord)
        console.log('[0097] Auditoria da inclusão corretiva registrada.')
      } catch (auditErr) {
        console.log('[0097] Erro ao gravar auditoria (lançamento já criado): ' + auditErr.message)
      }
    }
  },
  (app) => {
    // Reversão: apaga o lançamento corretivo do 1218 na ref 38 (se existir)
    try {
      var recs = app.findRecordsByFilter(
        'colaboradores',
        "referencia = 38 && registro = '1218'",
        '-created',
        1,
        0,
      )
      if (recs.length > 0) {
        app.delete(recs[0])
      }
    } catch (_) {}

    // Remove a trilha de auditoria correspondente (se existir)
    try {
      var audits = app.findRecordsByFilter(
        'auditoria_liberacoes',
        "acao = 'incluir_lancamento' && registro = '1218' && referencia = 38",
        '-created',
        1,
        0,
      )
      if (audits.length > 0) {
        app.delete(audits[0])
      }
    } catch (_) {}
  },
)
