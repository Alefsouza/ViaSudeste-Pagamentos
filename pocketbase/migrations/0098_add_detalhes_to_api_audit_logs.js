migrate(
  (app) => {
    // Diagnóstico do facial-recognition: a auditoria de hoje só grava status 400,
    // sem a mensagem devolvida pela AWS Rekognition ("Rate exceeded", "not
    // authorized", "InvalidImageFormatException"), o que impede saber a causa real.
    //
    // Este migration só cria o campo de texto "detalhes" em api_audit_logs, para o
    // hook gravar a mensagem exata do erro. Nenhum dado operacional é alterado.
    // Idempotente: se o campo já existe, é um no-op seguro.
    const col = app.findCollectionByNameOrId('api_audit_logs')
    if (!col.fields.getByName('detalhes')) {
      col.fields.add(new TextField({ name: 'detalhes', required: false, maxSize: 2000 }))
      app.save(col)
      console.log('[0098] Campo "detalhes" adicionado a api_audit_logs.')
    } else {
      console.log('[0098] Campo "detalhes" já existe em api_audit_logs — nada a fazer.')
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('api_audit_logs')
    if (col.fields.getByName('detalhes')) {
      col.fields.removeByName('detalhes')
      app.save(col)
    }
  },
)
