migrate(
  (app) => {
    try {
      const record = app.findFirstRecordByData('app_settings', 'name', 'login_background')
      const siteUrl = $secrets.get('SITE_URL') || 'https://pagamentos.goskip.app'
      const url = `${siteUrl.replace(/\/$/, '')}/Gemini_Generated_Image_5usejb5usejb5use.png`
      const file = $filesystem.fileFromURL(url, 60)
      record.set('file', file)
      record.set('value', '')
      app.save(record)
    } catch (err) {
      console.log('Failed to update login_background: ' + err.message)
    }
  },
  (app) => {
    try {
      const record = app.findFirstRecordByData('app_settings', 'name', 'login_background')
      // Fallback to the previous state
      const url =
        'https://viasultrans-my.sharepoint.com/:i:/g/personal/alef_silva_viasudeste_com/IQAVo_MvOl7ARbVqkemDNEqiAbY9HVZNm9lonQkoYgxkUvk?download=1'
      const file = $filesystem.fileFromURL(url, 30)
      record.set('file', file)
      record.set('value', '')
      app.save(record)
    } catch (_) {}
  },
)
