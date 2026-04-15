import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import sendResponse, { createError, CustomError } from "../utils/apiResponse";

const notFound = (req: Request, res: Response, next: NextFunction): void => {
  return next(
    createError({
      statusCode: 404,
      success: false,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      data: null,
    })
  );
};

const errorHandler = (
  err: Error | CustomError | any,
  req: Request,
  res: Response,
  next: NextFunction
): Response => {

  if (err.statusCode) {
    return sendResponse(res, {
      statusCode: err.statusCode,
      success: err.success ?? false,
      data: err.data ?? null,
      message: err.message,
      errors: err.errors ?? undefined,
    });
  }


  if (err instanceof ZodError) {
    const fieldErrors = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return sendResponse(res, {
      statusCode: 400,
      success: false,
      data: null,
      message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`,
      errors: fieldErrors,
    });
  }

  // Prisma Known Request Errors (e.g., unique constraint, not found)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint failed
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[]) || [];
      const field = target[target.length - 1] || "field";
      
      return sendResponse(res, {
        statusCode: 409,
        success: false,
        data: null,
        message: `Duplicate value: This ${field} already exists`,
        errors: [{ field, message: `Value already exists` }],
      });
    }

    // Record not found
    if (err.code === "P2025") {
      return sendResponse(res, {
        statusCode: 404,
        success: false,
        data: null,
        message: err.message || "Record not found",
      });
    }

    // Foreign key constraint failed
    if (err.code === "P2003") {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        data: null,
        message: "Relationship constraint failed: Please check references (IDs)",
      });
    }
  }

  // Prisma Validation Errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      data: null,
      message: "Database validation failed: Please check your input",
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return sendResponse(res, {
      statusCode: 401,
      success: false,
      data: null,
      message: "Invalid token: please login again",
    });
  }

  if (err.name === "TokenExpiredError") {
    return sendResponse(res, {
      statusCode: 401,
      success: false,
      data: null,
      message: "Token has expired: please login again",
    });
  }

  // Unknown errors
  console.error("Unhandled error:", err);

  return sendResponse(res, {
    statusCode: 500,
    success: false,
    data: null,
    message: process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error",
  });
};

export { notFound, errorHandler };