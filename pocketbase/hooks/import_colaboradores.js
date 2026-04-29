// @deps xlsx@0.18.5
routerAdd(
  'POST',
  '/backend/v1/import/colaboradores',
  (e) => {
    const { read, utils } = require('xlsx')

    const body = e.requestInfo().body
    if (!body || !body.fileBase64) {
      return e.badRequestError('Nenhum arquivo enviado.')
    }

    let workbook
    try {
      workbook = read(body.fileBase64, { type: 'base64' })
    } catch (err) {
      return e.badRequestError(
        'Não foi possível ler o arquivo. Certifique-se de que é um Excel válido.',
      )
    }

    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    if (!worksheet || !worksheet['!ref']) {
      return e.badRequestError('Planilha vazia.')
    }

    const range = utils.decode_range(worksheet['!ref'])
    const headers = []
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[utils.encode_cell({ c: C, r: range.s.r })]
      if (cell && cell.v) headers.push(String(cell.v).toUpperCase().trim())
    }

    const requiredCols = [
      'REGISTRO',
      'DATA',
      'IDTIPOPGTO',
      'INICIO',
      'TERMINO',
      'HORAS',
      'VALOR',
      'FILIAL',
    ]
    const hasAllCols = requiredCols.every((col) => headers.includes(col))

    if (!hasAllCols) {
      return e.badRequestError(
        'Arquivo inválido. Verifique se tem as colunas: REGISTRO, DATA, IDTIPOPGTO, INICIO, TERMINO, HORAS, VALOR, FILIAL',
      )
    }

    const data = utils.sheet_to_json(worksheet, { raw: false, defval: '' })
    let count = 0

    $app.runInTransaction((txApp) => {
      for (const row of data) {
        const getVal = (key) => {
          const found = Object.keys(row).find((k) => k.toUpperCase().trim() === key)
          return found ? row[found] : ''
        }

        const registro = String(getVal('REGISTRO')).trim()
        if (!registro) continue

        let valorStr = String(getVal('VALOR')).replace(',', '.')
        let valor = parseFloat(valorStr)
        if (isNaN(valor)) valor = 0

        const filialRaw = String(getVal('FILIAL')).trim()
        let filialName = ''
        if (filialRaw === '2') filialName = 'Sapopemba'
        else if (filialRaw === '3' || filialRaw === '4') filialName = 'Cursino'
        else continue

        let record
        try {
          record = txApp.findFirstRecordByData('colaboradores', 'registro', registro)
          record.set('valor_a_receber', valor)
          record.set('filial', filialName)
        } catch (_) {
          const col = txApp.findCollectionByNameOrId('colaboradores')
          record = new Record(col)
          record.set('registro', registro)
          record.set('nome', 'Colaborador ' + registro)
          record.set('valor_a_receber', valor)
          record.set('filial', filialName)
        }
        txApp.save(record)
        count++
      }
    })

    return e.json(200, { message: `${count} colaboradores importados com sucesso`, count })
  },
  $apis.requireAuth(),
)
