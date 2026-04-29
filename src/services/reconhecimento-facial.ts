export const reconhecimentoFacialService = async (
  fotoDoBanco: string,
  fotoCapturada: string,
): Promise<boolean> => {
  // TODO: IMPLEMENT REAL API INTEGRATION HERE
  // Em uma implementação real, esta função faria um POST comparando as duas imagens

  // Implementação mockada: simula um delay e retorna sucesso (true)
  await new Promise((resolve) => setTimeout(resolve, 2000))

  return true
}
