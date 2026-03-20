import { listRequests, ok, type Env } from './_utils'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url)
  const status = url.searchParams.get('status') ?? undefined
  const requests = await listRequests(env, status)
  return ok(requests)
}
