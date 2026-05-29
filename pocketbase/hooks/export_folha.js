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

      const items = data.items.filter((item) => item.competencia === comp)

      if (items.length === 0) {
        return e.notFoundError('Nenhum registro encontrado para esta competência')
      }

      let lines = []
      for (const item of items) {
        // Remove leading zeros, keep at least one '0' if it's all zeros
        let reg = String(item.registro || '').replace(/^0+(?!$)/, '')
        // Pad end with spaces to exactly 10 characters
        reg = reg.padEnd(10, ' ')

        // Format number to 2 decimal places with comma
        let val = Number(item.valor_calculado || 0)
        let valStr = val.toFixed(2).replace('.', ',')

        // Concatenate directly (value starts at column 11)
        lines.push(`${reg}${valStr}`)
      }

      return e.string(200, lines.join('\n'))
    } catch (err) {
      $app.logger().error('Erro ao exportar folha', 'error', err.message)
      return e.internalServerError('Falha na comunicação com o servidor externo')
    }
  },
  $apis.requireAuth(),
)
