import pb from '@/lib/pocketbase/client'

// Deduplication map for concurrent identical queries
const inFlightRequests = new Map<string, Promise<any[]>>()

export async function getAllPaginated(
  collection: string,
  options: any = {},
  perPage = 500,
): Promise<any[]> {
  // Build a stable cache key for in-flight deduplication
  const cacheKey = `${collection}:${JSON.stringify(options)}:${perPage}`
  const existing = inFlightRequests.get(cacheKey)
  if (existing) {
    return existing
  }

  const promise = (async () => {
    let page = 1
    let all: any[] = []
    let totalPages = 1
    const maxPages = options?.maxPages ?? Number.POSITIVE_INFINITY

    // Remove maxPages from the options passed to PocketBase
    const { maxPages: _mp, ...pbOptions } = options

    while (page <= totalPages && page <= maxPages) {
      let attempt = 0
      const maxRetries = 3
      let success = false

      while (!success && attempt <= maxRetries) {
        try {
          // Small pacing delay between consecutive pages to avoid server rate spikes
          if (page > 1 && attempt === 0) {
            await new Promise((r) => setTimeout(r, 40))
          }

          const res = await pb.collection(collection).getList(page, perPage, pbOptions)
          all.push(...res.items)
          totalPages = res.totalPages
          page++
          success = true
        } catch (err: any) {
          const is429 =
            err?.status === 429 ||
            err?.response?.status === 429 ||
            err?.message?.includes('429') ||
            err?.message?.includes('Too Many Requests')

          if (is429 && attempt < maxRetries) {
            attempt++
            // Exponential backoff with jitter on 429: 2s, 4s, 8s...
            const delay = 1500 * Math.pow(2, attempt - 1) + Math.random() * 500
            await new Promise((r) => setTimeout(r, delay))
            continue
          }

          if (is429 && (options?.fallbackOn429 || all.length > 0)) {
            console.warn(
              `[getAllPaginated] 429 Too Many Requests para '${collection}'. Retornando ${all.length} registros parciais para evitar erro de runtime.`,
            )
            return all
          }

          if (page > 1 && (err?.status === 400 || err?.status === 404)) {
            return all
          }
          throw err
        }
      }
    }
    return all
  })()

  inFlightRequests.set(cacheKey, promise)
  promise.finally(() => {
    inFlightRequests.delete(cacheKey)
  })

  return promise
}
