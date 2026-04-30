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

    if (
      (!fotoPredeterminada.startsWith('data:image/') && !fotoPredeterminada.startsWith('http')) ||
      (!fotoCaptured.startsWith('data:image/') && !fotoCaptured.startsWith('http'))
    ) {
      return e.badRequestError('Invalid image format')
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
      return e.json(429, { error: 'Rate limit exceeded' })
    }

    const logRecord = new Record($app.findCollectionByNameOrId('api_audit_logs'))
    logRecord.set('user', userId)
    logRecord.set('endpoint', '/backend/v1/facial-recognition')
    logRecord.set('status', 0)
    $app.save(logRecord)

    const apiKey =
      $secrets.get('API_OPENIA_KEY') ||
      $secrets.get('API_OPENAI') ||
      $secrets.get('OPENAI_API_KEY') ||
      $secrets.get('API_OPENIA')
    if (!apiKey) {
      logRecord.set('status', 401)
      $app.save(logRecord)
      return e.json(401, { error: 'Missing API Key' })
    }

    const payload = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: "Analise estas duas fotos de rosto. Sao o mesmo rosto? Responda APENAS com 'SIM' ou 'NAO'. Nao explique, nao adicione nada mais. Apenas 'SIM' ou 'NAO'.",
            },
            { type: 'image_url', image_url: { url: fotoPredeterminada } },
            { type: 'image_url', image_url: { url: fotoCaptured } },
          ],
        },
      ],
      max_tokens: 10,
    }

    let success = false
    let responseText = ''
    let statusCode = 500
    let timeout = false

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = $http.send({
          url: 'https://api.openai.com/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + apiKey,
          },
          body: JSON.stringify(payload),
          timeout: 10,
        })

        statusCode = res.statusCode

        if (statusCode === 200) {
          if (res.json && res.json.choices && res.json.choices.length > 0) {
            responseText = res.json.choices[0].message.content.trim().toUpperCase()
            success = true
          }
          break
        } else if (statusCode === 401 || statusCode === 403) {
          break
        }
      } catch (err) {
        statusCode = 504
        timeout = true
        $app.logger().error('OpenAI Transport Error', 'error', String(err))
      }
    }

    logRecord.set('status', statusCode)
    $app.save(logRecord)
    $app
      .logger()
      .info(
        'Facial recognition attempt',
        'user',
        userId,
        'status',
        statusCode,
        'response',
        responseText,
      )

    if (statusCode === 401 || statusCode === 403) {
      return e.json(401, { error: 'Invalid API Key' })
    }

    if (statusCode === 504 || timeout) {
      return e.json(504, { error: 'Timeout' })
    }

    if (!success) {
      return e.json(500, { error: 'OpenAI Service Error' })
    }

    const isMatch = responseText.includes('SIM')
    return e.json(200, { match: isMatch })
  },
  $apis.requireAuth(),
)
