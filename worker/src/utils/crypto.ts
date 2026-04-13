const SALT = 'my_custom_8848'

export async function encryptPassword(password: string): Promise<string> {
  const str = `password=${password}&key=${SALT}`
  const encoded = new TextEncoder().encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
