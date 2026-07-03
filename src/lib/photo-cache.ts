import pb from '@/lib/pocketbase/client'

const CACHE_PREFIX = 'ref_photo_'
const CACHE_TTL = 30 * 60 * 1000

interface CacheEntry {
  base64: string
  timestamp: number
}

const memoryCache = new Map<string, CacheEntry>()

function readFromStorage(registro: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + registro)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.timestamp >= CACHE_TTL) {
      sessionStorage.removeItem(CACHE_PREFIX + registro)
      return null
    }
    return entry
  } catch {
    return null
  }
}

function writeToStorage(registro: string, entry: CacheEntry) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + registro, JSON.stringify(entry))
  } catch {
    // Storage might be full or unavailable
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function fetchPhotoAsBase64(url: string, registro: string): Promise<string | null> {
  const memEntry = memoryCache.get(registro)
  if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL) {
    return memEntry.base64
  }

  const storageEntry = readFromStorage(registro)
  if (storageEntry) {
    memoryCache.set(registro, storageEntry)
    return storageEntry.base64
  }

  try {
    const headers: Record<string, string> = {}
    if (pb.authStore.token) {
      headers['Authorization'] = pb.authStore.token
    }

    const response = await fetch(url, { headers })
    if (!response.ok) return null

    const blob = await response.blob()

    if (blob.size > 5 * 1024 * 1024) return null

    const base64 = await blobToBase64(blob)
    const entry: CacheEntry = { base64, timestamp: Date.now() }

    memoryCache.set(registro, entry)
    writeToStorage(registro, entry)

    return base64
  } catch {
    return null
  }
}

export function clearPhotoCache(registro?: string) {
  if (registro) {
    memoryCache.delete(registro)
    try {
      sessionStorage.removeItem(CACHE_PREFIX + registro)
    } catch {
      /* intentionally ignored */
    }
  } else {
    memoryCache.clear()
    try {
      const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(CACHE_PREFIX))
      keys.forEach((k) => sessionStorage.removeItem(k))
    } catch {
      /* intentionally ignored */
    }
  }
}

export function hasCachedPhoto(registro: string): boolean {
  const memEntry = memoryCache.get(registro)
  if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL) return true
  return readFromStorage(registro) !== null
}
