routerAdd(
  'GET',
  '/backend/v1/export-folha',
  (e) => {
    const comp = e.request.url.query().get('competencia')
    if (!comp || !/^\d{2}\/\d{4}$/.test(comp)) {
      return e.badRequestError('Competência inválida. Use o formato MM/YYYY')
    }

    const authRecord = e.auth
    if (!authRecord || authRecord.getString('tipo_usuario') !== 'Administrador') {
      return e.forbiddenError('Acesso negado')
    }

    const viewUrl = $secrets.get('FOLHA_VIEW_URL')
    if (!viewUrl) {
      return e.internalServerError('Configuração da URL da view ausente')
    }

    try {
      const res = $http.send({
        url: viewUrl,
        method: 'GET',
        timeout: 30,
      })

      if (res.statusCode !== 200) {
        return e.internalServerError('Falha ao buscar dados externos')
      }

      const data = res.json
      if (!data || !Array.isArray(data.items)) {
        return e.internalServerError('Formato de dados externo inválido')
      }

      var compItems = data.items.filter(function (item) {
        var itemComp = item.competencia !== undefined ? item.competencia : item.COMPETENCIA
        return itemComp === comp
      })

      if (compItems.length === 0) {
        return e.notFoundError('Nenhum registro encontrado para esta competência')
      }

      var garagemParam = e.request.url.query().get('garagem')
      var items = compItems
      if (garagemParam && garagemParam !== 'ambas' && garagemParam !== 'Ambas Garagens') {
        var normalizeGaragem = function (val) {
          return String(val || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toUpperCase()
        }
        var targetGaragem = normalizeGaragem(garagemParam)
        items = compItems.filter(function (item) {
          var itemGaragem = item.GARAGEM !== undefined ? item.GARAGEM : item.garagem
          if (!itemGaragem) return false
          return normalizeGaragem(itemGaragem) === targetGaragem
        })

        if (items.length === 0) {
          return e.notFoundError(
            'Nenhum registro encontrado para esta competência e garagem selecionada',
          )
        }
      }

      let lines = []
      for (const item of items) {
        // Remove leading zeros, keep at least one '0' if it's all zeros
        let rawReg = item.registro !== undefined ? item.registro : item.REGISTRO
        let reg = String(rawReg || '').replace(/^0+(?!$)/, '')
        // Format number to 2 decimal places with comma
        // Check both lowercase and uppercase property names if present
        let rawVal =
          item.valor_calculado !== undefined ? item.valor_calculado : item.VALOR_CALCULADO
        let val = Number(rawVal || 0)
        let valStr = val.toFixed(2).replace('.', ',')
        // Concatenate directly: registro + exactly 10 spaces + valor
        lines.push(`${reg}          ${valStr}`)
      }

      return e.string(200, lines.join('\n'))
    } catch (err) {
      $app.logger().error('Erro ao exportar folha', 'error', err.message)
      return e.internalServerError('Falha na comunicação com o servidor externo')
    }
  },
  $apis.requireAuth(),
)
