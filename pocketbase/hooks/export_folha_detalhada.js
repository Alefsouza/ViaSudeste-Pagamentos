routerAdd(
  'GET',
  '/backend/v1/export-folha-detalhada',
  (e) => {
    const registro = e.request.url.query().get('registro')
    const dataInicio = e.request.url.query().get('dataInicio')
    const dataFinal = e.request.url.query().get('dataFinal')

    if (!registro) {
      return e.badRequestError('Registro é obrigatório')
    }
    if (!dataInicio || !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
      return e.badRequestError('Data inicial inválida. Use o formato YYYY-MM-DD')
    }
    if (!dataFinal || !/^\d{4}-\d{2}-\d{2}$/.test(dataFinal)) {
      return e.badRequestError('Data final inválida. Use o formato YYYY-MM-DD')
    }

    const authRecord = e.auth
    if (!authRecord || authRecord.getString('tipo_usuario') !== 'Administrador') {
      return e.forbiddenError('Acesso negado')
    }

    const viewUrl = $secrets.get('FOLHA_DETALHES')
    if (!viewUrl) {
      return e.internalServerError('Configuração da URL detalhada ausente')
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
        $app.logger().error('Erro HTTP ao buscar FOLHA_DETALHES', 'status', res.statusCode)
        return e.internalServerError('Falha ao buscar dados externos')
      }

      const data = res.json
      let allItems = []
      if (Array.isArray(data)) {
        allItems = data
      } else if (data && Array.isArray(data.items)) {
        allItems = data.items
      } else {
        return e.internalServerError('Formato de dados externo inválido')
      }

      var normalizeReg = function (val) {
        return String(val || '').replace(/^0+(?!$)/, '')
      }
      var cleanRegistro = normalizeReg(registro)

      var startParts = dataInicio.split('-')
      var startY = parseInt(startParts[0], 10)
      var startM = parseInt(startParts[1], 10)
      var startD = parseInt(startParts[2], 10)

      var endParts = dataFinal.split('-')
      var endY = parseInt(endParts[0], 10)
      var endM = parseInt(endParts[1], 10)
      var endD = parseInt(endParts[2], 10)

      var filteredItems = allItems.filter(function (item) {
        var itemReg = normalizeReg(item.REGISTRO || item.registro)
        if (itemReg !== cleanRegistro) return false

        var comp = String(item.COMPETENCIA || item.competencia || '')
        var match = comp.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        if (!match) return false

        var compDay = parseInt(match[1], 10)
        var compM = parseInt(match[2], 10)
        var compY = parseInt(match[3], 10)

        if (compY < startY || compY > endY) return false
        if (compY === startY && compM < startM) return false
        if (compY === startY && compM === startM && compDay < startD) return false
        if (compY === endY && compM > endM) return false
        if (compY === endY && compM === endM && compDay > endD) return false

        return true
      })

      if (filteredItems.length === 0) {
        return e.notFoundError('Nenhum registro para os critérios informados.')
      }

      filteredItems.sort(function (a, b) {
        var compA = String(a.COMPETENCIA || a.competencia || '')
        var compB = String(b.COMPETENCIA || b.competencia || '')
        var matchA = compA.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        var matchB = compB.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        if (matchA && matchB) {
          var yA = parseInt(matchA[3], 10)
          var yB = parseInt(matchB[3], 10)
          if (yA !== yB) return yA - yB
          var mA = parseInt(matchA[2], 10)
          var mB = parseInt(matchB[2], 10)
          if (mA !== mB) return mA - mB
          return parseInt(matchA[1], 10) - parseInt(matchB[1], 10)
        }
        return compA.localeCompare(compB)
      })

      var items = filteredItems.map(function (item) {
        return {
          competencia: String(item.COMPETENCIA || item.competencia || ''),
          valor_calculado: Number(item.VALOR_CALCULADO || item.valor_calculado || 0),
        }
      })

      var total = items.reduce(function (sum, item) {
        return sum + item.valor_calculado
      }, 0)

      var nome = ''
      var firstItem = filteredItems[0]
      if (firstItem) {
        nome = String(firstItem.NOME || firstItem.nome || '')
      }

      return e.json(200, { items: items, total: total, registro: cleanRegistro, nome: nome })
    } catch (err) {
      $app.logger().error('Erro ao exportar folha detalhada', 'error', err.message)
      return e.internalServerError('Falha na comunicação com o servidor externo')
    }
  },
  $apis.requireAuth(),
)
