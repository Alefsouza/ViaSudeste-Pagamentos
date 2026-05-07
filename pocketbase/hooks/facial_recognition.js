routerAdd(
  'POST',
  '/backend/v1/facial-recognition',
  (e) => {
    // Pure JS SHA256 and HMAC-SHA256 implementation to remove external dependencies
    function safe_add(x, y) {
      const lsw = (x & 0xffff) + (y & 0xffff)
      const msw = (x >>> 16) + (y >>> 16) + (lsw >>> 16)
      return (msw << 16) | (lsw & 0xffff)
    }
    function S(X, n) {
      return (X >>> n) | (X << (32 - n))
    }
    function R(X, n) {
      return X >>> n
    }
    function Ch(x, y, z) {
      return (x & y) ^ (~x & z)
    }
    function Maj(x, y, z) {
      return (x & y) ^ (x & z) ^ (y & z)
    }
    function Sigma0256(x) {
      return S(x, 2) ^ S(x, 13) ^ S(x, 22)
    }
    function Sigma1256(x) {
      return S(x, 6) ^ S(x, 11) ^ S(x, 25)
    }
    function Gamma0256(x) {
      return S(x, 7) ^ S(x, 18) ^ R(x, 3)
    }
    function Gamma1256(x) {
      return S(x, 17) ^ S(x, 19) ^ R(x, 10)
    }

    function core_sha256(m, l) {
      const K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
      ]
      const H = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
      ]
      const W = new Array(64)
      let a, b, c, d, e, f, g, h, i, j
      let T1, T2

      m[l >> 5] |= 0x80 << (24 - (l % 32))
      m[(((l + 64) >> 9) << 4) + 15] = l

      for (i = 0; i < m.length; i += 16) {
        a = H[0]
        b = H[1]
        c = H[2]
        d = H[3]
        e = H[4]
        f = H[5]
        g = H[6]
        h = H[7]

        for (j = 0; j < 64; j++) {
          if (j < 16) W[j] = m[i + j] || 0
          else
            W[j] = safe_add(
              safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])),
              W[j - 16],
            )

          T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j])
          T2 = safe_add(Sigma0256(a), Maj(a, b, c))

          h = g
          g = f
          f = e
          e = safe_add(d, T1)
          d = c
          c = b
          b = a
          a = safe_add(T1, T2)
        }

        H[0] = safe_add(a, H[0])
        H[1] = safe_add(b, H[1])
        H[2] = safe_add(c, H[2])
        H[3] = safe_add(d, H[3])
        H[4] = safe_add(e, H[4])
        H[5] = safe_add(f, H[5])
        H[6] = safe_add(g, H[6])
        H[7] = safe_add(h, H[7])
      }
      return H
    }

    function str2binb(str) {
      const len = str.length
      const bin = new Array((len >> 2) + 1)
      for (let i = 0; i < bin.length; i++) bin[i] = 0
      for (let i = 0; i < len; i++) {
        bin[i >> 2] |= (str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8)
      }
      return { bin: bin, length: len * 8 }
    }

    function binb2hex(binarray) {
      const hex_tab = '0123456789abcdef'
      let str = ''
      for (let i = 0; i < binarray.length * 4; i++) {
        str +=
          hex_tab.charAt((binarray[i >> 2] >>> ((3 - (i % 4)) * 8 + 4)) & 0xf) +
          hex_tab.charAt((binarray[i >> 2] >>> ((3 - (i % 4)) * 8)) & 0xf)
      }
      return str
    }

    function core_hmac_sha256(key_bin, data) {
      let bkey = key_bin
      if (bkey.length > 16) bkey = core_sha256(bkey, bkey.length * 32)

      const ipad = new Array(16),
        opad = new Array(16)
      for (let i = 0; i < 16; i++) {
        const k = bkey[i] || 0
        ipad[i] = k ^ 0x36363636
        opad[i] = k ^ 0x5c5c5c5c
      }

      const hash = core_sha256(ipad.concat(data.bin), 512 + data.length)
      return core_sha256(opad.concat(hash), 512 + 256)
    }

    function hmac_sha256_hex(key_bin, data_str) {
      return binb2hex(core_hmac_sha256(key_bin, str2binb(data_str)))
    }

    function hmac_sha256_bin(key_bin, data_str) {
      return core_hmac_sha256(key_bin, str2binb(data_str))
    }

    function sha256_hex(data_str) {
      const data = str2binb(data_str)
      return binb2hex(core_sha256(data.bin, data.length))
    }

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
      const k = str2binb('AWS4' + key).bin
      const kDate = hmac_sha256_bin(k, dateStamp)
      const kRegion = hmac_sha256_bin(kDate, regionName)
      const kService = hmac_sha256_bin(kRegion, serviceName)
      const kSigning = hmac_sha256_bin(kService, 'aws4_request')
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

      const payloadHash = sha256_hex(requestBody)

      const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`

      const algorithm = 'AWS4-HMAC-SHA256'
      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
      const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${sha256_hex(canonicalRequest)}`

      const signingKey = getSignatureKey(secretKey, dateStamp, region, service)
      const signature = hmac_sha256_hex(signingKey, stringToSign)

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
