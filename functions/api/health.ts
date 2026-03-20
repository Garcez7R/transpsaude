import { ok, type Env } from './_utils'

export const onRequestGet: PagesFunction<Env> = async () => {
  return ok({
    app: 'transp-saude',
    status: 'ok',
  })
}
