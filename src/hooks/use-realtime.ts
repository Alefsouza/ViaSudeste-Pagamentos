import { useEffect, useRef } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

/**
 * Hook for real-time subscriptions to a PocketBase collection.
 * ALWAYS use this hook instead of subscribing inline.
 * Uses the per-listener UnsubscribeFunc so multiple components
 * can safely subscribe to the same collection without conflicts.
 *
 * Generic over the record type: pass your collection's interface as
 * `useRealtime<MyRecord>(...)` to get a typed subscription payload
 * instead of `unknown`.
 */
export function useRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false
    let retryTimeout: ReturnType<typeof setTimeout> | undefined
    let consecutiveErrors = 0
    const MAX_RETRIES = 5

    const connect = () => {
      if (cancelled) return

      pb.collection<TRecord>(collectionName)
        .subscribe('*', (e) => {
          consecutiveErrors = 0
          callbackRef.current(e)
        })
        .then((fn) => {
          if (cancelled) {
            fn().catch(() => {})
          } else {
            unsubscribeFn = fn
            consecutiveErrors = 0
          }
        })
        .catch((err) => {
          consecutiveErrors += 1
          const isInvalidClientId =
            err?.status === 404 ||
            err?.message?.includes('Missing or invalid client id') ||
            err?.response?.message?.includes('Missing or invalid client id')

          if (isInvalidClientId) {
            console.warn(
              `[useRealtime] Assinatura da coleção '${collectionName}' desativada (erro 404 client id). Polling garantirá atualização.`,
            )
            return
          }

          // Se passar do número máximo de tentativas de reconexão,
          // aplica backoff exponencial e interrompe novas tentativas após MAX_RETRIES para evitar loop infinito
          if (consecutiveErrors <= MAX_RETRIES && !cancelled) {
            const backoffDelay = Math.min(30000, Math.pow(2, consecutiveErrors) * 1000)
            retryTimeout = setTimeout(() => {
              if (!cancelled) {
                connect()
              }
            }, backoffDelay)
          } else {
            console.warn(
              `[useRealtime] Limite de tentativas atingido para '${collectionName}'. Reconexão automática suspensa.`,
            )
          }
        })
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimeout) {
        clearTimeout(retryTimeout)
      }
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled])
}

export default useRealtime
