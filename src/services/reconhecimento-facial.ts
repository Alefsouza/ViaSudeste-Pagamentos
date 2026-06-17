import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'

export class FacialRecognitionError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'FacialRecognitionError'
  }
}

export const reconhecimentoFacialService = async (
  fotoPredeterminada: string,
  fotoCaptured: string,
  registro?: string,
): Promise<boolean> => {
  try {
    const response = await pb.send<{ match: boolean }>('/backend/v1/facial-recognition', {
      method: 'POST',
      body: JSON.stringify({
        fotoPredeterminada,
        fotoCaptured,
        registro,
      }),
    })
    return response.match
  } catch (error) {
    if (error instanceof ClientResponseError) {
      const msg = error.response?.message || error.message
      throw new FacialRecognitionError(error.status, msg)
    }
    throw new FacialRecognitionError(500, error instanceof Error ? error.message : 'Unknown error')
  }
}
