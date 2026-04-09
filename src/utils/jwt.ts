import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { AuthRole } from "./enums/role";

export type JwtPayloadType = {
  id: string;
  email: string;
  role: AuthRole;
};

const generateToken = (payload: JwtPayloadType): string => {
  const secret: Secret = process.env.JWT_SECRET as string;

  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || "1d") as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, secret, options);
};

export const verifyToken = (token: string): JwtPayloadType => {
  return jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayloadType;
};

export default generateToken;