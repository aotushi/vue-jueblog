export function ok(data: unknown) {
  return Response.json({ code: 0, data })
}

export function err(message: string, status = 400) {
  return Response.json({ code: 1, message }, { status })
}

export function unauthorized() {
  return Response.json({ code: 401, message: '未授权' }, { status: 401 })
}
