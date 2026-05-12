export const ROLE = {
  USER: "USER",
  VENDOR: "VENDOR",
  ADMIN: "ADMIN",
} as const;

export type AuthRole = (typeof ROLE)[keyof typeof ROLE];