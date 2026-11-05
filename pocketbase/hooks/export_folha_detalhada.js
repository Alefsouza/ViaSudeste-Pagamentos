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
      // Busca PAGINADA: o servidor externo (PocketBase) limita cada consulta a
      // ~500 itens por página, então registros com 10k+ linhas saíam cortados
      // quando pedíamos tudo em uma única requisição. Agora acumulamos todas
      // as páginas até esgotar (para quando a página vier com menos itens que
      // o tamanho do lote, ou nenhum).
      var PAGE_SIZE = 500
      var MAX_PAGES = 2000 // guarda de segurança: 2000 * 500 = 1M de linhas
      var separator = viewUrl.includes('?') ? '&' : '?'

      var allItems = []
      var page = 1
      var totalPages = MAX_PAGES

      while (page <= totalPages) {
        var pageUrl = viewUrl + separator + 'page=' + page + '&perPage=' + PAGE_SIZE

        var res = $http.send({
          url: pageUrl,
          method: 'GET',
          timeout: 30,
        })

        if (res.statusCode !== 200) {
          $app
            .logger()
            .error('Erro HTTP ao buscar FOLHA_DETALHES', 'status', res.statusCode, 'page', page)
          return e.internalServerError('Falha ao buscar dados externos')
        }

        var data = res.json
        var pageItems = null
        if (Array.isArray(data)) {
          pageItems = data
        } else if (data && Array.isArray(data.items)) {
          pageItems = data.items
        } else {
          return e.internalServerError('Formato de dados externo inválido')
        }

        allItems = allItems.concat(pageItems)

        // Resposta em array puro: a fonte não suporta paginação, uma única
        // requisição já trouxe tudo.
        if (Array.isArray(data)) break

        if (pageItems.length < PAGE_SIZE) break

        if (data.totalPages && Number(data.totalPages) > 0) {
          totalPages = Math.min(Number(data.totalPages), MAX_PAGES)
        }
        // Sem totalPages: continua enquanto a página vier cheia (o laço para
        // sozinho na primeira página parcial ou vazia).

        page++
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
        // Responde 200 com lista vazia em vez de 404: o runtime de preview
        // reporta qualquer resposta não-OK como erro de runtime na tela.
        // O frontend trata lista vazia com mensagem amigável.
        return e.json(200, { items: [], total: 0, registro: cleanRegistro, nome: '' })
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
