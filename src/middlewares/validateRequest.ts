import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { createError } from "../utils/apiResponse";

const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      return next();
    } catch (error: any) {
      const firstError = error?.issues?.[0];

      return next(
        createError({
          statusCode: 400,
          success: false,
          message: firstError?.message || "Validation failed",
          data: null,
        })
      );
    }
  };
};

export default validateRequest;