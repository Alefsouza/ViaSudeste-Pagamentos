routerAdd(
  'POST',
  '/backend/v1/purge-reference',
  (e) => {
    const body = e.requestInfo().body || {}
    const referencia = body.referencia

    if (referencia === undefined || referencia === null || referencia === '') {
      return e.badRequestError('Referência é obrigatória')
    }

    const authRecord = e.auth
    if (!authRecord) {
      return e.unauthorizedError('Authentication required')
    }

    const email = authRecord.getString('email')
    if (email !== 'ti@viasudeste.com' && email !== 'alcimara.cabral@viasudeste.com') {
      return e.forbiddenError('Acesso negado')
    }

    const refNumber = Number(referencia)
    if (isNaN(refNumber)) {
      return e.badRequestError('Referência inválida')
    }

    try {
      $app.runInTransaction(function (txApp) {
        var colabs = txApp.findRecordsByFilter(
          'colaboradores',
          'referencia = ' + refNumber,
          '',
          0,
          0,
        )

        for (var i = 0; i < colabs.length; i++) {
          var colabId = colabs[i].id

          var pags = txApp.findRecordsByFilter(
            'pagamentos',
            'colaborador_id = "' + colabId + '"',
            '',
            0,
            0,
          )

          for (var j = 0; j < pags.length; j++) {
            txApp.delete(pags[j])
          }

          txApp.delete(colabs[i])
        }
      })

      return e.json(200, { success: true })
    } catch (err) {
      $app
        .logger()
        .error('Erro ao purgar referência', 'error', err.message, 'referencia', refNumber)
      return e.internalServerError('Erro ao excluir referência')
    }
  },
  $apis.requireAuth(),
)
