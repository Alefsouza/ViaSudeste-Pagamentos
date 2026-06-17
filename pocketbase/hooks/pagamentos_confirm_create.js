onRecordAfterCreateSuccess((e) => {
  // Hook temporarily disabled to always permit the transaction without side effects
  return e.next()
}, 'pagamentos')
