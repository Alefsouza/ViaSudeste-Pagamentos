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
        // Formato da linha conforme especificação:
        // 1. Número do registro do colaborador preenchido com zeros à esquerda até 6 dígitos (ex: 6853 -> 006853)
        // 2. Tabulação (\t)
        // 3. Código fixo 360
        // 4. Tabulação (\t)
        // 5. Valor com zeros à esquerda até 14 posições, vírgula decimal (ex: 000000000263,32)
        let rawReg = item.registro !== undefined ? item.registro : item.REGISTRO
        let cleanReg = String(rawReg || '')
          .replace(/^0+(?!$)/, '')
          .trim()
        let reg = cleanReg.padStart(6, '0')

        let rawVal =
          item.valor_calculado !== undefined ? item.valor_calculado : item.VALOR_CALCULADO
        let val = Number(rawVal || 0)
        let valDecimalStr = val.toFixed(2).replace('.', ',')
        let valPadded = valDecimalStr.padStart(14, '0')

        lines.push(`${reg}\t360\t${valPadded}`)
      }

      const compParts = comp.split('/')
      const mm = compParts[0]
      const yyyy = compParts[1]
      const lastDay = new Date(parseInt(yyyy, 10), parseInt(mm, 10), 0).getDate()
      const lastDayStr = lastDay < 10 ? '0' + lastDay : String(lastDay)

      let filename = `01.${mm}.${yyyy}_${lastDayStr}.${mm}.${yyyy}.txt`
      if (garagemParam && garagemParam !== 'ambas' && garagemParam !== 'Ambas Garagens') {
        const norm = String(garagemParam || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toUpperCase()
        if (norm === 'CURSINO') {
          filename = `01.${mm}.${yyyy}_${lastDayStr}.${mm}.${yyyy}_Cursino.txt`
        } else if (norm === 'SAPOPEMBA') {
          filename = `01.${mm}.${yyyy}_${lastDayStr}.${mm}.${yyyy}_Sapopemba.txt`
        } else {
          filename = `01.${mm}.${yyyy}_${lastDayStr}.${mm}.${yyyy}_${garagemParam.trim()}.txt`
        }
      }

      e.response.header().set('Content-Disposition', `attachment; filename="${filename}"`)
      e.response.header().set('Access-Control-Expose-Headers', 'Content-Disposition')

      return e.string(200, lines.join('\n'))
    } catch (err) {
      $app.logger().error('Erro ao exportar folha', 'error', err.message)
      return e.internalServerError('Falha na comunicação com o servidor externo')
    }
  },
  $apis.requireAuth(),
)
