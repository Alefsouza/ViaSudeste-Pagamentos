routerAdd(
  'POST',
  '/backend/v1/import/colaboradores',
  (e) => {
    const body = e.requestInfo().body
    if (!body || !body.data || !Array.isArray(body.data)) {
      return e.badRequestError('Nenhum dado enviado.')
    }

    const data = body.data
    let count = 0
    let errors = []

    const col = $app.findCollectionByNameOrId('colaboradores')

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const getVal = (key) => {
        const found = Object.keys(row).find((k) => k.toUpperCase().trim() === key)
        return found ? row[found] : ''
      }

      const registro = String(getVal('REGISTRO')).trim()
      if (!registro) continue

      const nome = String(getVal('NOME')).trim() || ''

      // Parse DATA DD/MM/YYYY
      let dataVal = ''
      const rawData = String(getVal('DATA')).trim()
      if (rawData) {
        if (!isNaN(Number(rawData)) && rawData.indexOf('/') === -1 && rawData.indexOf('-') === -1) {
          const excelDate = Number(rawData)
          const jsDate = new Date((excelDate - 25569) * 86400 * 1000)
          const yyyy = jsDate.getUTCFullYear()
          const mm = String(jsDate.getUTCMonth() + 1).padStart(2, '0')
          const dd = String(jsDate.getUTCDate()).padStart(2, '0')
          dataVal = `${yyyy}-${mm}-${dd} 12:00:00.000Z`
        } else {
          const sep = rawData.indexOf('/') !== -1 ? '/' : '-'
          const parts = rawData.split(sep)
          if (parts.length === 3) {
            const dd = parts[0].padStart(2, '0')
            const mm = parts[1].padStart(2, '0')
            let yyyy = parts[2]
            if (yyyy.length === 2) yyyy = '20' + yyyy
            dataVal = `${yyyy}-${mm}-${dd} 12:00:00.000Z`
          } else {
            const d = new Date(rawData)
            if (!isNaN(d.valueOf())) {
              dataVal = d.toISOString()
            }
          }
        }
      }

      const formatTime = (val) => {
        if (!val) return ''
        const str = String(val).trim()
        if (!isNaN(Number(str)) && str.indexOf(':') === -1) {
          const totalMinutes = Math.round(Number(str) * 24 * 60)
          const h = Math.floor(totalMinutes / 60)
          const m = totalMinutes % 60
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        }
        const timeMatch = str.match(/(\d{1,2}):(\d{2})/)
        if (timeMatch) {
          let h = parseInt(timeMatch[1], 10)
          const m = timeMatch[2]
          if (str.toLowerCase().includes('pm') && h < 12) h += 12
          if (str.toLowerCase().includes('am') && h === 12) h = 0
          return `${String(h).padStart(2, '0')}:${m}`
        }
        return str
      }

      const formatHoras = (val) => {
        if (!val) return ''
        const str = String(val).trim().replace(',', '.')
        if (!isNaN(Number(str)) && str.indexOf(':') === -1) {
          const num = Number(str)
          return num < 10 ? `0${num.toFixed(2)}` : num.toFixed(2)
        }
        const timeMatch = str.match(/(\d{1,2}):(\d{2})/)
        if (timeMatch) {
          const h = parseInt(timeMatch[1], 10)
          const m = parseInt(timeMatch[2], 10)
          const num = h + m / 60
          return num < 10 ? `0${num.toFixed(2)}` : num.toFixed(2)
        }
        return str
      }

      const inicio = formatTime(getVal('INICIO'))
      const termino = formatTime(getVal('TERMINO'))
      const horas = formatHoras(getVal('HORAS'))

      let valorStr = String(getVal('VALOR')).replace(',', '.')
      let valor = parseFloat(valorStr)
      if (isNaN(valor)) valor = 0
      valor = parseFloat(valor.toFixed(2))

      const idtipopgtoRaw = String(getVal('IDTIPOPGTO')).trim()
      const idtipopgto = parseInt(idtipopgtoRaw, 10) || 0

      const filialRaw = String(getVal('FILIAL')).trim()
      const filialId = parseInt(filialRaw, 10) || 0

      let record
      try {
        record = $app.findFirstRecordByData('colaboradores', 'registro', registro)
      } catch (err) {
        record = new Record(col)
        record.set('registro', registro)
        record.set('foto_confirmacao_url', '')
      }

      record.set('nome', nome)
      record.set('data', dataVal)
      record.set('idtipopgto', idtipopgto)
      record.set('inicio', inicio)
      record.set('termino', termino)
      record.set('horas', horas)
      record.set('valor', valor)
      record.set('filial_id', filialId)

      // Backward compatibility fields
      record.set('valor_a_receber', valor)
      if (filialId === 2) record.set('filial', 'Sapopemba')
      else if (filialId === 3 || filialId === 4) record.set('filial', 'Cursino')

      try {
        $app.save(record)
        count++
      } catch (err) {
        errors.push(`Erro ao importar linha ${i + 2}: ${err.message}`)
      }
    }

    if (errors.length > 0 && count === 0) {
      return e.badRequestError(errors.join('\n'))
    }

    return e.json(200, {
      message: `${count} colaboradores importados com sucesso`,
      count,
      errors,
    })
  },
  $apis.requireAuth(),
)
