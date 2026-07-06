routerAdd(
  'POST',
  '/backend/v1/facial-recognition',
  (e) => {
    // SHA-256 core for binary HMAC only — text hashing uses native $security.sha256
    const K256 = [
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
    const H256 = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
      0x5be0cd19,
    ]
    function safe_add(x, y) {
      const l = (x & 0xffff) + (y & 0xffff)
      const m = (x >>> 16) + (y >>> 16) + (l >>> 16)
      return (m << 16) | (l & 0xffff)
    }
    function S(X, n) {
      return (X >>> n) | (X << (32 - n))
    }

    function core_sha256(m, l) {
      const W = new Array(64)
      let a, b, c, d, e, f, g, h, i, j, T1, T2
      const H = H256.slice()
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
              safe_add(
                safe_add(S(W[j - 2], 17) ^ S(W[j - 2], 19) ^ (W[j - 2] >>> 10), W[j - 7]),
                S(W[j - 15], 7) ^ S(W[j - 15], 18) ^ (W[j - 15] >>> 3),
              ),
              W[j - 16],
            )
          T1 = safe_add(
            safe_add(
              safe_add(safe_add(h, S(e, 6) ^ S(e, 11) ^ S(e, 25)), (e & f) ^ (~e & g)),
              K256[j],
            ),
            W[j],
          )
          T2 = safe_add(S(a, 2) ^ S(a, 13) ^ S(a, 22), (a & b) ^ (a & c) ^ (b & c))
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

    function str2binb(s) {
      const len = s.length
      const bin = new Array((len >> 2) + 1)
      for (let i = 0; i < bin.length; i++) bin[i] = 0
      for (let i = 0; i < len; i++) bin[i >> 2] |= (s.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8)
      return { bin: bin, length: len * 8 }
    }

    function binb2hex(ba) {
      const t = '0123456789abcdef'
      let s = ''
      for (let i = 0; i < ba.length * 4; i++)
        s +=
          t.charAt((ba[i >> 2] >>> ((3 - (i % 4)) * 8 + 4)) & 0xf) +
          t.charAt((ba[i >> 2] >>> ((3 - (i % 4)) * 8)) & 0xf)
      return s
    }

    function core_hmac_sha256(key, data) {
      let bk = key
      if (bk.length > 16) bk = core_sha256(bk, bk.length * 32)
      const ip = new Array(16),
        op = new Array(16)
      for (let i = 0; i < 16; i++) {
        const k = bk[i] || 0
        ip[i] = k ^ 0x36363636
        op[i] = k ^ 0x5c5c5c5c
      }
      return core_sha256(op.concat(core_sha256(ip.concat(data.bin), 512 + data.length)), 512 + 256)
    }

    function hexToBinb(h) {
      const b = []
      for (let i = 0; i < h.length; i += 8) b.push(parseInt(h.substr(i, 8), 16))
      return b
    }

    function bytesToBase64(bytes) {
      let u8
      if (bytes instanceof Uint8Array) u8 = bytes
      else if (bytes instanceof ArrayBuffer) u8 = new Uint8Array(bytes)
      else if (bytes && bytes.buffer instanceof ArrayBuffer)
        u8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      else u8 = new Uint8Array(bytes)
      const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      const l = u8.length
      const p = []
      for (let i = 0; i < l - 2; i += 3)
        p.push(
          c[u8[i] >> 2],
          c[((u8[i] & 3) << 4) | (u8[i + 1] >> 4)],
          c[((u8[i + 1] & 15) << 2) | (u8[i + 2] >> 6)],
          c[u8[i + 2] & 63],
        )
      if (l % 3 === 2)
        p.push(
          c[u8[l - 2] >> 2],
          c[((u8[l - 2] & 3) << 4) | (u8[l - 1] >> 4)],
          c[(u8[l - 1] & 15) << 2],
          '=',
        )
      else if (l % 3 === 1) p.push(c[u8[l - 1] >> 2], c[(u8[l - 1] & 3) << 4], '==')
      return p.join('')
    }

    const body = e.requestInfo().body || {}
    let fotoPred = body.fotoPredeterminada || body.fotoDoBanco
    let fotoCap = body.fotoCaptured || body.fotoCapturada
    const registro = body.registro
    const fotoPredBase64 = body.fotoPredeterminadaBase64

    if (!fotoPred || !fotoCap) return e.badRequestError('Missing images')
    fotoCap = fotoCap.includes(',') ? fotoCap.split(',')[1] : fotoCap
    if (fotoPred.startsWith('data:')) fotoPred = fotoPred.split(',')[1]

    const userId = e.auth.id
    const d = new Date(Date.now() - 60000)
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    const oneMinAgo = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.000Z`

    const recentLogs = $app.findRecordsByFilter(
      'api_audit_logs',
      `user='${userId}' && created>='${oneMinAgo}'`,
      '-created',
      11,
      0,
    )
    if (recentLogs.length >= 10)
      return e.json(429, {
        message: 'Limite de requisicoes atingido. Tente novamente em alguns segundos',
      })

    const logRecord = new Record($app.findCollectionByNameOrId('api_audit_logs'))
    logRecord.set('user', userId)
    logRecord.set('endpoint', '/backend/v1/facial-recognition')

    function respond(status, responseBody) {
      logRecord.set('status', status)
      $app.saveNoValidate(logRecord)
      return e.json(status, responseBody)
    }

    const accessKey = $secrets.get('AWS_API_KEY')
    const secretKey = $secrets.get('AWS_API_SECRET')
    const region = 'sa-east-1'
    if (!accessKey || !secretKey)
      return respond(401, { message: 'Credenciais da AWS invalidas. Verifique Secrets' })

    let sourceB64
    if (fotoPredBase64) {
      sourceB64 = fotoPredBase64.includes(',') ? fotoPredBase64.split(',')[1] : fotoPredBase64
    } else {
      const cacheKey = registro || fotoPred
      globalThis.__photoCache = globalThis.__photoCache || {}
      const now = Date.now()
      for (const k in globalThis.__photoCache) {
        if (now - globalThis.__photoCache[k].time > 300000) delete globalThis.__photoCache[k]
      }
      if (globalThis.__photoCache[cacheKey]) {
        sourceB64 = globalThis.__photoCache[cacheKey].data
      } else if (fotoPred.startsWith('http')) {
        try {
          const hdrs = {}
          const ah = e.requestInfo().headers['authorization']
          if (ah) hdrs['Authorization'] = ah
          const fr = $http.send({ url: fotoPred, method: 'GET', headers: hdrs, timeout: 5 })
          if (fr.statusCode === 200 && fr.body) {
            sourceB64 = bytesToBase64(fr.body)
            if (!sourceB64) throw new Error('conversion failed')
            globalThis.__photoCache[cacheKey] = { data: sourceB64, time: now }
          } else {
            return respond(400, { message: 'Erro ao baixar foto do banco. Tente novamente' })
          }
        } catch (err) {
          return respond(400, { message: 'Erro ao baixar foto do banco. Tente novamente' })
        }
      } else {
        sourceB64 = fotoPred
        globalThis.__photoCache[cacheKey] = { data: sourceB64, time: now }
      }
    }

    sourceB64 = sourceB64.replace(/\s+/g, '')
    fotoCap = fotoCap.replace(/\s+/g, '')

    const sizeBytes = Math.round((fotoCap.length * 3) / 4)
    if (sizeBytes > 5 * 1024 * 1024)
      return respond(400, { message: 'Imagem invalida. Tente capturar novamente' })

    let requestBody
    try {
      requestBody = JSON.stringify({
        SourceImage: { Bytes: sourceB64 },
        TargetImage: { Bytes: fotoCap },
        SimilarityThreshold: 70,
      })
    } catch (err) {
      return respond(400, { message: 'Erro ao processar foto. Tente capturar novamente' })
    }

    // AWS SigV4 — first HMAC uses native $security.hs256, chain uses compact binary HMAC
    function getSignatureKey(secret, dateStamp, regionName, serviceName) {
      const kDateHex = $security.hs256(dateStamp, 'AWS4' + secret)
      const kDateBin = hexToBinb(kDateHex)
      const kRegion = core_hmac_sha256(kDateBin, str2binb(regionName))
      const kService = core_hmac_sha256(kRegion, str2binb(serviceName))
      return core_hmac_sha256(kService, str2binb('aws4_request'))
    }

    function signAWSRequest() {
      const service = 'rekognition'
      const host = `${service}.${region}.amazonaws.com`
      const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
      const dateStamp = amzDate.substring(0, 8)
      const amzTarget = 'RekognitionService.CompareFaces'
      const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${amzTarget}\n`
      const signedHeaders = 'content-type;host;x-amz-date;x-amz-target'
      const payloadHash = $security.sha256(requestBody)
      const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
      const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${$security.sha256(canonicalRequest)}`
      const signingKey = getSignatureKey(secretKey, dateStamp, region, service)
      const signature = binb2hex(core_hmac_sha256(signingKey, str2binb(stringToSign)))
      return {
        url: `https://${host}/`,
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Date': amzDate,
          'X-Amz-Target': amzTarget,
          Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        },
      }
    }

    let success = false,
      match = false,
      statusCode = 500,
      awsMessage = ''
    try {
      const reqData = signAWSRequest()
      const res = $http.send({
        url: reqData.url,
        method: 'POST',
        headers: reqData.headers,
        body: requestBody,
        timeout: 5,
      })
      statusCode = res.statusCode
      if (statusCode === 200) {
        const data = res.json || {}
        success = true
        const fm = data.FaceMatches || []
        if (fm.length > 0 && fm[0].Similarity >= 70) match = true
      } else if (statusCode === 400) {
        const err = res.json || {}
        awsMessage = err.message || err.Message || err.__type || ''
      }
    } catch (err) {
      statusCode = 504
      $app.logger().error('AWS Rekognition Error', 'error', String(err))
    }

    if (statusCode === 401 || statusCode === 403)
      return respond(401, { message: 'Credenciais da AWS invalidas. Verifique Secrets' })
    if (statusCode === 400) {
      const m = awsMessage.toLowerCase()
      if (m.includes('face') || m.includes('rosto'))
        return respond(400, {
          message:
            'Nenhum rosto detectado na imagem. Certifique-se de que o rosto está bem iluminado e visível.',
        })
      return respond(400, { message: 'Imagem invalida. Tente capturar novamente' })
    }
    if (statusCode === 504)
      return respond(504, { message: 'Timeout ao processar reconhecimento. Tente novamente' })
    if (!success) return respond(500, { message: 'Servico da AWS indisponivel. Tente novamente' })
    return respond(200, { match: match })
  },
  $apis.requireAuth(),
)
