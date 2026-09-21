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
interface UseRealtimeOptions {
  pollingIntervalMs?: number
  maxConsecutiveErrors?: number
}

export function useRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
  options?: UseRealtimeOptions,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const pollingIntervalMs = options?.pollingIntervalMs ?? 15000
  const maxConsecutiveErrors = options?.maxConsecutiveErrors ?? 3

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false
    let pollingIntervalId: ReturnType<typeof setInterval> | null = null
    let consecutiveErrors = 0
    let realtimeConnected = false

    const startPollingFallback = () => {
      if (pollingIntervalId || cancelled) return
      // Fallback polling: invokes callback with a dummy update event periodically
      pollingIntervalId = setInterval(() => {
        if (!cancelled && document.visibilityState === 'visible') {
          callbackRef.current({
            action: 'update',
            record: {} as TRecord,
          })
        }
      }, pollingIntervalMs)
    }

    const stopPollingFallback = () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId)
        pollingIntervalId = null
      }
    }

    // Monitor PocketBase realtime eventSource or subscribe errors
    const checkRealtimeHealth = () => {
      try {
        const realtimeService = (pb as any).realtime
        const eventSource = realtimeService?.eventSource
        // If eventSource exists and is in CLOSED state (2)
        if (
          eventSource &&
          typeof eventSource.readyState === 'number' &&
          eventSource.readyState === 2
        ) {
          startPollingFallback()
        }
      } catch {
        // Ignore inspection errors
      }
    }

    // Try subscribing to the PocketBase realtime collection
    pb.collection<TRecord>(collectionName)
      .subscribe('*', (e) => {
        realtimeConnected = true
        consecutiveErrors = 0
        stopPollingFallback()
        callbackRef.current(e)
      })
      .then((fn) => {
        if (cancelled) {
          fn().catch(() => {})
        } else {
          unsubscribeFn = fn
          realtimeConnected = true
        }
      })
      .catch((err) => {
        console.warn(`[useRealtime] Failed to subscribe to ${collectionName}, using fallback:`, err)
        consecutiveErrors++
        startPollingFallback()
      })

    // Also monitor PB_CONNECT or SSE connection status if available
    let unsubConnect: (() => Promise<void>) | undefined
    try {
      if (pb.realtime && typeof pb.realtime.subscribe === 'function') {
        pb.realtime
          .subscribe('PB_CONNECT', () => {
            realtimeConnected = true
            consecutiveErrors = 0
            stopPollingFallback()
          })
          .then((unsub) => {
            if (cancelled) {
              unsub().catch(() => {})
            } else {
              unsubConnect = unsub
            }
          })
          .catch(() => {
            // If PB_CONNECT fails, activate fallback polling
            startPollingFallback()
          })
      }
    } catch {
      // Ignore if realtime client structure differs
    }

    // Periodically check if eventSource is broken or closed
    const healthInterval = setInterval(checkRealtimeHealth, 5000)

    // Safety timeout: if realtime hasn't established or confirmed within 5s, start polling as fallback
    const safetyTimer = setTimeout(() => {
      if (!cancelled && !realtimeConnected) {
        startPollingFallback()
      }
    }, 5000)

    return () => {
      cancelled = true
      clearTimeout(safetyTimer)
      clearInterval(healthInterval)
      stopPollingFallback()
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
      if (unsubConnect) {
        unsubConnect().catch(() => {})
      }
    }
  }, [collectionName, enabled, pollingIntervalMs, maxConsecutiveErrors])
}

export default useRealtime
