import { useRef, useEffect } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'
import { useRealtime } from '@/hooks/use-realtime'

export function useDebouncedRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: () => void,
  debounceMs: number = 600,
  enabled: boolean = true,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  useRealtime<TRecord>(
    collectionName,
    (_data: RecordSubscription<TRecord>) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        callbackRef.current()
      }, debounceMs)
    },
    enabled,
  )
}
