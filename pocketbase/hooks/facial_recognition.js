// @deps crypto-js@4.2.0
routerAdd(
  'POST',
  '/backend/v1/facial-recognition',
  (e) => {
    const CryptoJS = require('crypto-js')

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

    const accessKey = $secrets.get('AWS_API_KEY')
    const secretKey = $secrets.get('AWS_API_SECRET')
    const region = $secrets.get('AWS_REGIAO')

    if (!accessKey || !secretKey) {
      logRecord.set('status', 401)
      $app.save(logRecord)
      return e.json(401, { message: 'Credenciais da AWS invalidas. Verifique Secrets' })
    }

    if (!region) {
      logRecord.set('status', 403)
      $app.save(logRecord)
      return e.json(403, { message: 'Regiao da AWS invalida. Verifique Secrets' })
    }

    function bytesToBase64(bytes) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      let result = ''
      let i
      const len = bytes.length
      for (i = 0; i < len - 2; i += 3) {
        result += chars[bytes[i] >> 2]
        result += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)]
        result += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)]
        result += chars[bytes[i + 2] & 63]
      }
      if (len % 3 === 2) {
        result += chars[bytes[i] >> 2]
        result += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)]
        result += chars[(bytes[i + 1] & 15) << 2]
        result += '='
      } else if (len % 3 === 1) {
        result += chars[bytes[i] >> 2]
        result += chars[(bytes[i] & 3) << 4]
        result += '=='
      }
      return result
    }

    let sourceB64 = fotoPredeterminada
    if (sourceB64.startsWith('http://') || sourceB64.startsWith('https://')) {
      try {
        const fetchRes = $http.send({ url: sourceB64, method: 'GET', timeout: 5 })
        if (fetchRes.statusCode === 200 && fetchRes.body) {
          sourceB64 = bytesToBase64(fetchRes.body)
        } else {
          logRecord.set('status', 400)
          $app.save(logRecord)
          return e.json(400, { message: 'Erro ao baixar foto do banco. Tente novamente' })
        }
      } catch (err) {
        logRecord.set('status', 400)
        $app.save(logRecord)
        return e.json(400, { message: 'Erro ao baixar foto do banco. Tente novamente' })
      }
    } else {
      sourceB64 = sourceB64.includes(',') ? sourceB64.split(',')[1] : sourceB64
    }

    let targetB64 = fotoCaptured.includes(',') ? fotoCaptured.split(',')[1] : fotoCaptured

    sourceB64 = sourceB64.replace(/\s+/g, '')
    targetB64 = targetB64.replace(/\s+/g, '')

    const sizeInBytes = Math.round((targetB64.length * 3) / 4)
    if (sizeInBytes > 5 * 1024 * 1024) {
      logRecord.set('status', 400)
      $app.save(logRecord)
      return e.json(400, { message: 'Imagem invalida. Tente capturar novamente' })
    }

    let requestBody
    try {
      requestBody = JSON.stringify({
        SourceImage: { Bytes: sourceB64 },
        TargetImage: { Bytes: targetB64 },
        SimilarityThreshold: 80,
      })
    } catch (err) {
      logRecord.set('status', 400)
      $app.save(logRecord)
      return e.json(400, { message: 'Erro ao processar foto. Tente capturar novamente' })
    }

    const amzTarget = 'RekognitionService.CompareFaces'

    function getSignatureKey(key, dateStamp, regionName, serviceName) {
      const kDate = CryptoJS.HmacSHA256(dateStamp, 'AWS4' + key)
      const kRegion = CryptoJS.HmacSHA256(regionName, kDate)
      const kService = CryptoJS.HmacSHA256(serviceName, kRegion)
      const kSigning = CryptoJS.HmacSHA256('aws4_request', kService)
      return kSigning
    }

    function signAWSRequest(region, accessKey, secretKey, requestBody, amzTarget) {
      const method = 'POST'
      const service = 'rekognition'
      const host = `${service}.${region}.amazonaws.com`
      const endpoint = `https://${host}/`

      const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
      const dateStamp = amzDate.substring(0, 8)

      const canonicalUri = '/'
      const canonicalQuerystring = ''
      const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${amzTarget}\n`
      const signedHeaders = 'content-type;host;x-amz-date;x-amz-target'

      const payloadHash = CryptoJS.SHA256(requestBody).toString(CryptoJS.enc.Hex)

      const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`

      const algorithm = 'AWS4-HMAC-SHA256'
      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
      const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${CryptoJS.SHA256(canonicalRequest).toString(CryptoJS.enc.Hex)}`

      const signingKey = getSignatureKey(secretKey, dateStamp, region, service)
      const signature = CryptoJS.HmacSHA256(stringToSign, signingKey).toString(CryptoJS.enc.Hex)

      const authorizationHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

      return {
        url: endpoint,
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Date': amzDate,
          'X-Amz-Target': amzTarget,
          Authorization: authorizationHeader,
        },
      }
    }

    let success = false
    let match = false
    let statusCode = 500
    let timeout = false
    let authFailed = false
    let badRequest = false

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const reqData = signAWSRequest(region, accessKey, secretKey, requestBody, amzTarget)

        const res = $http.send({
          url: reqData.url,
          method: 'POST',
          headers: reqData.headers,
          body: requestBody,
          timeout: 10,
        })

        statusCode = res.statusCode

        if (statusCode === 400) {
          badRequest = true
          break
        }
        if (statusCode === 403 || statusCode === 401) {
          authFailed = true
          break
        }

        if (statusCode === 200) {
          const data = res.json || {}
          const faceMatches = data.FaceMatches || []
          success = true
          if (faceMatches.length > 0 && faceMatches[0].Similarity >= 80) {
            match = true
          }
          break
        }
      } catch (err) {
        statusCode = 504
        timeout = true
        $app.logger().error('AWS API Error', 'error', String(err))
      }
    }

    logRecord.set('status', statusCode)
    $app.save(logRecord)

    if (authFailed) {
      return e.json(401, { message: 'Credenciais da AWS invalidas. Verifique Secrets' })
    }
    if (badRequest) {
      return e.json(400, { message: 'Imagem invalida. Tente capturar novamente' })
    }
    if (statusCode === 504 || timeout) {
      return e.json(504, { message: 'Timeout ao processar reconhecimento. Tente novamente' })
    }
    if (!success) {
      return e.json(500, { message: 'Servico da AWS indisponivel. Tente novamente' })
    }

    return e.json(200, { match: match })
  },
  $apis.requireAuth(),
)
