export type Bindings = {
  DB: D1Database
}

export type Variables = {
  userId: number
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}
