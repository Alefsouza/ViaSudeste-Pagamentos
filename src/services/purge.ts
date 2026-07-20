import pb from '@/lib/pocketbase/client'

export const purgeReference = (referencia: number) =>
  pb.send('/backend/v1/purge-reference', {
    method: 'POST',
    body: JSON.stringify({ referencia }),
    headers: { 'Content-Type': 'application/json' },
  })
