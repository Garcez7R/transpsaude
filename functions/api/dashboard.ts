import { getSummary, ok, type Env } from './_utils'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const summary = await getSummary(env)
  return ok(summary)
}
