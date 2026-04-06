import { SignJWT, jwtVerify } from 'jose'

const SECRET_KEY = 'alifn_jueblog_jwt_8765'
const secret = new TextEncoder().encode(SECRET_KEY)

export async function signJwt(payload: {
  id: number
  phone: string
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyJwt(
  token: string,
): Promise<{ id: number; phone: string }> {
  const { payload } = await jwtVerify(token, secret)
  return payload as { id: number; phone: string }
}
