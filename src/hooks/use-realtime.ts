import { useEffect, useRef, useState } from 'react'
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

  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    const handleStart = () => setIsImporting(true)
    const handleEnd = () => setIsImporting(false)

    window.addEventListener('import-start', handleStart)
    window.addEventListener('import-end', handleEnd)

    return () => {
      window.removeEventListener('import-start', handleStart)
      window.removeEventListener('import-end', handleEnd)
    }
  }, [])

  const isActuallyEnabled = enabled && !isImporting

  useEffect(() => {
    if (!isActuallyEnabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false

    pb.collection<TRecord>(collectionName)
      .subscribe('*', (e) => {
        callbackRef.current(e)
      })
      .then((fn) => {
        if (cancelled) {
          fn().catch(() => {})
        } else {
          unsubscribeFn = fn
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, isActuallyEnabled])
}

export default useRealtime
