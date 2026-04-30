routerAdd(
  'POST',
  '/backend/v1/facial-recognition',
  (e) => {
    const body = e.requestInfo().body || {}
    const fotoPredeterminada = body.fotoPredeterminada || body.fotoDoBanco
    const fotoCaptured = body.fotoCaptured || body.fotoCapturada

    if (!fotoPredeterminada || !fotoCaptured) {
      return e.badRequestError('Missing images')
    }

    const userId = e.auth.id
    const d = new Date(Date.now() - 60000)
    const pad = (n) => (n < 10 ? '0' + n : n)
    const oneMinAgoStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.000Z`

    const recentLogs = $app.findRecordsByFilter(
      'api_audit_logs',
      `user = '${userId}' && created >= '${oneMinAgoStr}'`,
      '-created',
      11,
      0,
    )

    if (recentLogs.length >= 10) {
      return e.json(429, {
        message: 'Limite de requisicoes atingido. Tente novamente em alguns segundos',
      })
    }

    const logRecord = new Record($app.findCollectionByNameOrId('api_audit_logs'))
    logRecord.set('user', userId)
    logRecord.set('endpoint', '/backend/v1/facial-recognition')
    logRecord.set('status', 0)
    $app.save(logRecord)

    const apiKey = $secrets.get('API_AZURE')
    const endpoint = $secrets.get('ENDPOINT_AZURE')

    if (!apiKey || !endpoint) {
      logRecord.set('status', 401)
      $app.save(logRecord)
      return e.json(401, { message: 'Chave ou endpoint da Azure invalidos. Verifique Secrets' })
    }

    const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint

    const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const decodeBase64 = (str) => {
      str = str.replace(/[^A-Za-z0-9\+\/]/g, '')
      let len = str.length
      let bytes = new Uint8Array((len * 3) / 4)
      let a, b, c, d
      let i = 0,
        j = 0
      while (i < len) {
        a = b64.indexOf(str.charAt(i++))
        b = b64.indexOf(str.charAt(i++))
        c = b64.indexOf(str.charAt(i++))
        d = b64.indexOf(str.charAt(i++))
        bytes[j++] = (a << 2) | (b >> 4)
        if (c !== 64) bytes[j++] = ((b & 15) << 4) | (c >> 2)
        if (d !== 64) bytes[j++] = ((c & 3) << 6) | d
      }
      return bytes.slice(0, j)
    }

    const callDetect = (imageStr) => {
      let reqBody, contentType
      if (imageStr.startsWith('http')) {
        reqBody = JSON.stringify({ url: imageStr })
        contentType = 'application/json'
      } else {
        const b64Data = imageStr.includes(',') ? imageStr.split(',')[1] : imageStr
        reqBody = decodeBase64(b64Data)
        contentType = 'application/octet-stream'
      }
      return $http.send({
        url: baseUrl + '/face/v1.0/detect?returnFaceId=true',
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': contentType,
        },
        body: reqBody,
        timeout: 10,
      })
    }

    let success = false
    let match = false
    let statusCode = 500
    let timeout = false
    let authFailed = false

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res1 = callDetect(fotoPredeterminada)
        statusCode = res1.statusCode
        if (statusCode === 401 || statusCode === 403) {
          authFailed = true
          break
        }
        if (statusCode !== 200) continue

        const faces1 = res1.json || []
        if (faces1.length === 0) {
          statusCode = 400
          break
        }
        const faceId1 = faces1[0].faceId

        const res2 = callDetect(fotoCaptured)
        statusCode = res2.statusCode
        if (statusCode === 401 || statusCode === 403) {
          authFailed = true
          break
        }
        if (statusCode !== 200) continue

        const faces2 = res2.json || []
        if (faces2.length === 0) {
          statusCode = 400
          break
        }
        const faceId2 = faces2[0].faceId

        const verifyRes = $http.send({
          url: baseUrl + '/face/v1.0/verify',
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ faceId1, faceId2 }),
          timeout: 10,
        })

        statusCode = verifyRes.statusCode
        if (statusCode === 401 || statusCode === 403) {
          authFailed = true
          break
        }
        if (statusCode === 200) {
          success = true
          match = verifyRes.json.isIdentical && verifyRes.json.confidence >= 0.6
          break
        }
      } catch (err) {
        statusCode = 504
        timeout = true
        $app.logger().error('Azure API Error', 'error', String(err))
      }
    }

    logRecord.set('status', statusCode)
    $app.save(logRecord)

    if (authFailed) {
      return e.json(401, { message: 'Autenticacao falhou. Verifique API_AZURE em Secrets' })
    }
    if (statusCode === 504 || timeout) {
      return e.json(504, { message: 'Timeout ao processar reconhecimento. Tente novamente' })
    }
    if (!success) {
      if (statusCode === 400) {
        return e.json(400, { message: 'Erro ao processar foto. Tente capturar novamente' })
      }
      return e.json(500, { message: 'Servico da Azure indisponivel. Tente novamente' })
    }

    return e.json(200, { match: match })
  },
  $apis.requireAuth(),
)
