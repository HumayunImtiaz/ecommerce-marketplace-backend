export const ROLE = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type AuthRole = (typeof ROLE)[keyof typeof ROLE];