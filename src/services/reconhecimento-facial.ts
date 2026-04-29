import { getColaboradores } from './colaboradores'

export const mockRecognizeFace = async (imageBase64: string): Promise<string> => {
  // TODO: IMPLEMENT REAL API INTEGRATION HERE
  // Em uma implementação real, esta função faria um POST para o serviço de reconhecimento:
  //
  // const response = await fetch('https://api.exemplo.com/v1/reconhecimento', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ image: imageBase64 })
  // });
  // const data = await response.json();
  // return data.registro;

  // Implementação mockada: simula um delay e retorna um registro aleatório do banco
  await new Promise((resolve) => setTimeout(resolve, 2000))

  const colaboradores = await getColaboradores()
  if (colaboradores.length === 0) {
    throw new Error('Nenhum colaborador cadastrado para realizar o teste.')
  }

  const randomColab = colaboradores[Math.floor(Math.random() * colaboradores.length)]
  return randomColab.registro
}
