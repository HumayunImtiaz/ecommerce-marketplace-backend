import { NextFunction, Request, Response } from "express";
import sendResponse, { createError, CustomError } from "../utils/apiResponse";
import { verifyToken } from "../utils/jwt";
import { ROLE, AuthRole } from "../utils/enums/role";
import prisma from "../config/prisma";

type RequestWithUser = Request & {
  loginUser?: any;
  authUser?: any;
  authAdmin?: any;
};

const getUserByEmailFromRequest = async (
  req: RequestWithUser
): Promise<any | CustomError> => {
  if (req.loginUser) {
    return req.loginUser;
  }

  const { email } = req.body;

  if (!email) {
    return createError({
      statusCode: 400,
      success: false,
      message: "Email is required",
      data: null,
    });
  }

  const user = await prisma.user.findFirst({ 
    where: { email } 
  });

  if (!user) {
    return createError({
      statusCode: 401,
      success: false,
      message: "Invalid email or password",
      data: null,
    });
  }

  req.loginUser = user;
  return user;
};

const checkLocalProviderBeforeLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await getUserByEmailFromRequest(req as RequestWithUser);

    if (user instanceof Error) {
      return next(user);
    }

    const hasPassword = !!user.password;

    if (user.provider !== "local" && !hasPassword) {
      return next(
        createError({
          statusCode: 400,
          success: false,
          message: `Please login with ${user.provider}`,
          data: null,
        })
      );
    }

    return next();
  } catch (error) {
    return next(
      createError({
        statusCode: 500,
        success: false,
        message: "Internal server error",
        data: null,
      })
    );
  }
};

const checkUserVerifiedBeforeLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(
        createError({
          statusCode: 400,
          success: false,
          message: "Email is required",
          data: null,
        })
      );
    }

    const user = await prisma.user.findFirst({ where: { email } });

    if (!user) {
      return next();
    }

    if (!user.isVerified) {
      return sendResponse(res, {
        statusCode: 403,
        success: false,
        message: "Please verify your email first",
        data: null,
      });
    }

    return next();
  } catch (error) {
    return next(
      createError({
        statusCode: 500,
        success: false,
        message: "Internal server error",
        data: null,
      })
    );
  }
};

const authenticateByRole = (role: AuthRole) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next(
          createError({
            statusCode: 401,
            success: false,
            message: "Unauthorized access",
            data: null,
          })
        );
      }

      const token = authHeader.split(" ")[1];
      const decoded = verifyToken(token);

      if (decoded.role?.toLowerCase() !== role.toLowerCase()) {
        return next(
          createError({
            statusCode: 401,
            success: false,
            message: "Unauthorized access - Role mismatch",
            data: null,
          })
        );
      }

      if (role === ROLE.USER) {
        const userId = (decoded.id || (decoded as any)._id) as string;
        const user = await prisma.user.findFirst({
          where: { id: userId, role: ROLE.USER }
        });

        if (!user) {
          return next(
            createError({
              statusCode: 404,
              success: false,
              message: "User not found",
              data: null,
            })
          );
        }

        (req as RequestWithUser).authUser = user;
        return next();
      }

      const adminId = (decoded.id || (decoded as any)._id) as string;
      const admin = await prisma.user.findFirst({
        where: { id: adminId, role: ROLE.ADMIN }
      });

      if (!admin) {
        return next(
          createError({
            statusCode: 404,
            success: false,
            message: "Admin not found",
            data: null,
          })
        );
      }

      (req as RequestWithUser).authAdmin = admin;
      return next();
    } catch (error) {
      console.error("Authentication Error:", error);
      return next(
        createError({
          statusCode: 401,
          success: false,
          message: "Invalid or expired token",
          data: null,
        })
      );
    }
  };
};

const authenticateUser = authenticateByRole(ROLE.USER);
const authenticateAdmin = authenticateByRole(ROLE.ADMIN);

export {
  getUserByEmailFromRequest,
  checkLocalProviderBeforeLogin,
  checkUserVerifiedBeforeLogin,
  authenticateUser,
  authenticateAdmin,
};