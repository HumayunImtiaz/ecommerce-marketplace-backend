import { Response } from "express";

type FieldError = {
  field: string;
  message: string;
};

type ApiResponseParams = {
  statusCode?: number;
  success?: boolean;
  data?: any;
  message?: string;
  errors?: FieldError[];
};

export type CustomError = Error & {
  statusCode?: number;
  success?: boolean;
  data?: any;
  errors?: FieldError[];
};

const sendResponse = (
  res: Response,
  {
    statusCode = 200,
    success = true,
    data = null,
    message = "Request successful",
    errors = undefined,
  }: ApiResponseParams
): Response => {
  const response: any = {
    success,
    statusCode,
    message,
    data,
  };

  if (errors && errors.length > 0) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

export const createError = ({
  statusCode = 500,
  success = false,
  message = "Internal server error",
  data = null,
  errors = undefined,
}: ApiResponseParams): CustomError => {
  const error = new Error(message) as CustomError;
  error.statusCode = statusCode;
  error.success = success;
  error.data = data;
  if (errors) {
    error.errors = errors;
  }
  return error;
};

export default sendResponse;