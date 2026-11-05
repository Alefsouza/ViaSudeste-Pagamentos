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
      // Tamanho do lote usado nas duas formas de paginação suportadas pela fonte:
      // - formato PocketBase (envelope com `items`): page/perPage;
      // - array puro (PostgREST/Supabase, ex.: a view VW): limit/offset.
      var PAGE_SIZE = 500
      var MAX_PAGES = 2000 // guarda de segurança: 2000 * 500 = 1M de linhas
      var MAX_BLOCKS = 200 // guarda de segurança para a paginação limit/offset: 200 * 500 = 100k linhas
      var separator = viewUrl.includes('?') ? '&' : '?'

      var allItems = []

      // Primeira requisição: descobre o formato da fonte.
      var firstRes = $http.send({
        url: viewUrl + separator + 'page=1&perPage=' + PAGE_SIZE,
        method: 'GET',
        timeout: 30,
      })

      if (firstRes.statusCode !== 200) {
        $app
          .logger()
          .error('Erro HTTP ao buscar FOLHA_DETALHES', 'status', firstRes.statusCode, 'page', 1)
        return e.internalServerError('Falha ao buscar dados externos')
      }

      var firstData = firstRes.json

      if (Array.isArray(firstData)) {
        // Array puro: a fonte ignora page/perPage e respeita limit/offset.
        // Pagina por limit/offset (0, 500, 1000, ...) até um bloco parcial ou vazio.
        var offset = 0
        var blocks = 0
        var done = false

        while (!done) {
          if (blocks >= MAX_BLOCKS) {
            $app
              .logger()
              .warn('FOLHA_DETALHES: limite de blocos atingido', 'blocks', blocks, 'offset', offset)
            break
          }

          var blockRes = $http.send({
            url: viewUrl + separator + 'limit=' + PAGE_SIZE + '&offset=' + offset,
            method: 'GET',
            timeout: 30,
          })

          if (blockRes.statusCode !== 200) {
            $app
              .logger()
              .error(
                'Erro HTTP ao buscar FOLHA_DETALHES',
                'status',
                blockRes.statusCode,
                'offset',
                offset,
              )
            return e.internalServerError('Falha ao buscar dados externos')
          }

          var block = blockRes.json
          if (!Array.isArray(block)) {
            return e.internalServerError('Formato de dados externo inválido')
          }

          allItems = allItems.concat(block)
          blocks++

          // Avança pelo tamanho real do bloco (evita duplicar linhas se a fonte
          // devolver menos que o limite pedido).
          if (block.length === 0 || block.length < PAGE_SIZE) {
            done = true
          } else {
            offset += block.length
          }
        }
      } else {
        // Formato PocketBase: mantém a paginação por page/perPage.
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
