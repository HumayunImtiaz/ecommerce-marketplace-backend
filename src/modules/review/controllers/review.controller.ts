import { NextFunction, Request, Response } from "express";
import { getProductReviewsService, createReviewService } from "../services/review.service";

type RequestWithUser = Request & { authUser?: any };

export const getProductReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = req.params.productId as string;
    const result = await getProductReviewsService(productId);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

export const createReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = req.params.productId as string;
    const authUser = (req as RequestWithUser).authUser;
    const userId = String(authUser?.id || "");
    const userName = authUser?.fullName || "Anonymous";

    const result = await createReviewService(productId, userId, userName, req.body);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
      ...(result.errors && { errors: result.errors }),
    });
  } catch (error) {
    return next(error);
  }
};