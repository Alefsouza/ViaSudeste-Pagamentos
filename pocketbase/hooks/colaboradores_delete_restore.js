// Neutralização permanente do hook de servidor "colaboradores_delete_restore".
// Qualquer tentativa de interceptar a exclusão de colaboradores passa adiante de forma limpa,
// sem restaurar dados e SEM alterar o status `liberado_pagamento` de nenhum colaborador ou referência.
onRecordDelete((e) => {
  return e.next()
}, 'colaboradores')
