routerAdd(
  'GET',
  '/backend/v1/get-colaborador-by-registro',
  (e) => {
    const registro = e.request.url.query().get('registro')
    if (!registro) {
      return e.badRequestError('Registro é obrigatório')
    }

    const authRecord = e.auth
    if (!authRecord) {
      return e.forbiddenError('Acesso negado')
    }

    const tipoUsuario = authRecord.getString('tipo_usuario')
    const email = authRecord.getString('email')
    const isAuthorized =
      ['DP', 'Administrador', 'recebedoria'].includes(tipoUsuario) ||
      email === 'clayton.souza@viasudeste.com'

    if (!isAuthorized) {
      return e.forbiddenError('Acesso negado')
    }

    const viewUrl = $secrets.get('REGISTROS')
    if (!viewUrl) {
      $app.logger().error('Secret REGISTROS ausente')
      return e.internalServerError('Serviço temporariamente indisponível')
    }

    try {
      let finalUrl = viewUrl
      if (finalUrl.includes('?')) {
        finalUrl += '&perPage=10000&limit=10000'
      } else {
        finalUrl += '?perPage=10000&limit=10000'
      }

      const res = $http.send({
        url: finalUrl,
        method: 'GET',
        timeout: 30,
      })

      if (res.statusCode !== 200) {
        $app.logger().error('Erro HTTP ao buscar view REGISTROS', 'status', res.statusCode)
        return e.internalServerError('Serviço temporariamente indisponível')
      }

      const data = res.json
      let items = []
      if (Array.isArray(data)) {
        items = data
      } else if (data && Array.isArray(data.items)) {
        items = data.items
      } else {
        $app.logger().error('Formato de dados externo inválido')
        return e.internalServerError('Serviço temporariamente indisponível')
      }

      const normalizeReg = (val) => String(val || '').replace(/^0{1,2}/, '')
      const cleanRegistro = normalizeReg(registro)

      const item = items.find((i) => {
        const itemReg = normalizeReg(i.REGISTRO || i.registro)
        const strictMatch = itemReg === cleanRegistro
        const looseMatch =
          String(i.REGISTRO || i.registro || '').replace(/^0+(?!$)/, '') ===
          String(registro).replace(/^0+(?!$)/, '')

        return strictMatch || looseMatch
      })

      if (!item) {
        return e.notFoundError('Registro não encontrado')
      }

      return e.json(200, { nome: item.NOME || item.nome || '' })
    } catch (err) {
      $app.logger().error('Erro ao buscar colaborador by registro', 'error', err.message)
      return e.internalServerError('Serviço temporariamente indisponível')
    }
  },
  $apis.requireAuth(),
)
