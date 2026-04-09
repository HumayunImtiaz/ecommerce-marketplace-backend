import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
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

  // Mongoose validation errors
  if (err instanceof mongoose.Error.ValidationError) {
    const fieldErrors = Object.values(err.errors).map((error: any) => ({
      field: error.path,
      message: error.message,
    }));

    return sendResponse(res, {
      statusCode: 400,
      success: false,
      data: null,
      message: `Database validation failed: ${fieldErrors.map((e) => `${e.field} - ${e.message}`).join(", ")}`,
      errors: fieldErrors,
    });
  }

  // Mongoose CastError (invalid ObjectId etc)
  if (err instanceof mongoose.Error.CastError) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      data: null,
      message: `Invalid value for ${err.path}: "${err.value}" is not a valid ${err.kind}`,
      errors: [{ field: err.path, message: `"${err.value}" is not a valid ${err.kind}` }],
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const duplicateField = Object.keys(err.keyValue || {})[0];
    const duplicateValue = err.keyValue?.[duplicateField];

    return sendResponse(res, {
      statusCode: 409,
      success: false,
      data: null,
      message: `Duplicate value: ${duplicateField} "${duplicateValue}" already exists`,
      errors: [{ field: duplicateField, message: `"${duplicateValue}" already exists` }],
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