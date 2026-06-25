migrate(
  (app) => {
    try {
      const record = app.findFirstRecordByData('app_settings', 'name', 'login_background')
      // Use ?download=1 to bypass the SharePoint viewer and download the raw image file directly.
      const url =
        'https://viasultrans-my.sharepoint.com/:i:/g/personal/alef_silva_viasudeste_com/IQAVo_MvOl7ARbVqkemDNEqiAbY9HVZNm9lonQkoYgxkUvk?download=1'
      const file = $filesystem.fileFromURL(url, 30)
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
      record.set('file', null)
      record.set('value', 'https://img.usecurling.com/p/1920/1080?q=buses')
      app.save(record)
    } catch (_) {}
  },
)
