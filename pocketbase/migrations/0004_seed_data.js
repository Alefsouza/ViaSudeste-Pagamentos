migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const seedUsers = [
      { email: 'gestor1@viasudeste.com', name: 'Gestor 1', tipo: 'gestor' },
      { email: 'gestor2@viasudeste.com', name: 'Gestor 2', tipo: 'gestor' },
      { email: 'boca1@viasudeste.com', name: 'Caixa 1', tipo: 'boca_de_caixa' },
      { email: 'boca2@viasudeste.com', name: 'Caixa 2', tipo: 'boca_de_caixa' },
      { email: 'boca3@viasudeste.com', name: 'Caixa 3', tipo: 'boca_de_caixa' },
    ]

    for (const u of seedUsers) {
      try {
        app.findAuthRecordByEmail('_pb_users_auth_', u.email)
      } catch (_) {
        const record = new Record(users)
        record.setEmail(u.email)
        record.setPassword('Skip@Pass')
        record.setVerified(true)
        record.set('name', u.name)
        record.set('tipo_usuario', u.tipo)
        app.save(record)
      }
    }

    const colabCol = app.findCollectionByNameOrId('colaboradores')
    const seedColabs = [
      { registro: 'R001', nome: 'João Silva', valor: 1500, filial: 'Cursino' },
      { registro: 'R002', nome: 'Maria Santos', valor: 2100, filial: 'Sapopemba' },
      { registro: 'R003', nome: 'Pedro Oliveira', valor: 850, filial: 'Cursino' },
      { registro: 'R004', nome: 'Ana Costa', valor: 3000, filial: 'Sapopemba' },
      { registro: 'R005', nome: 'Lucas Souza', valor: 1200, filial: 'Cursino' },
      { registro: 'R006', nome: 'Juliana Lima', valor: 2500, filial: 'Sapopemba' },
      { registro: 'R007', nome: 'Marcos Pereira', valor: 500, filial: 'Cursino' },
      { registro: 'R008', nome: 'Camila Ferreira', valor: 1800, filial: 'Sapopemba' },
      { registro: 'R009', nome: 'Bruno Alves', valor: 2200, filial: 'Cursino' },
      { registro: 'R010', nome: 'Fernanda Ribeiro', valor: 950, filial: 'Sapopemba' },
    ]

    for (const c of seedColabs) {
      try {
        app.findFirstRecordByData('colaboradores', 'registro', c.registro)
      } catch (_) {
        const record = new Record(colabCol)
        record.set('registro', c.registro)
        record.set('nome', c.nome)
        record.set('valor_a_receber', c.valor)
        record.set('filial', c.filial)
        app.save(record)
      }
    }

    const pagamentosCol = app.findCollectionByNameOrId('pagamentos')
    const colabsToPay = ['R001', 'R002', 'R005', 'R008', 'R009']

    for (let i = 0; i < colabsToPay.length; i++) {
      try {
        const c = app.findFirstRecordByData('colaboradores', 'registro', colabsToPay[i])
        const existing = app.findRecordsByFilter(
          'pagamentos',
          `colaborador_id = '${c.id}'`,
          '',
          1,
          0,
        )
        if (existing.length === 0) {
          const record = new Record(pagamentosCol)
          record.set('colaborador_id', c.id)
          record.set('valor_pago', c.get('valor_a_receber') * 0.5)
          const d = new Date()
          d.setDate(d.getDate() - i)
          record.set('data_pagamento', d.toISOString().replace('T', ' '))
          app.save(record)
        }
      } catch (_) {}
    }
  },
  (app) => {
    // Migrations generally rely on drop commands or are rolled back structurally
  },
)
