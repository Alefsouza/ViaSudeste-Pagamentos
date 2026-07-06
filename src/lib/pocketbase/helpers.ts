import pb from '@/lib/pocketbase/client'

export async function getAllPaginated(
  collection: string,
  options: any = {},
  perPage = 500,
): Promise<any[]> {
  let page = 1
  let all: any[] = []
  let totalPages = 1
  while (page <= totalPages) {
    const res = await pb.collection(collection).getList(page, perPage, options)
    all.push(...res.items)
    totalPages = res.totalPages
    page++
  }
  return all
}
