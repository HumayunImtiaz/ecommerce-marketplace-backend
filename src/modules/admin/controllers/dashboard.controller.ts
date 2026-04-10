import { NextFunction, Request, Response } from "express";
import { getDashboardStatsService } from "../services/dashboard.service";

export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await getDashboardStatsService(
      startDate as string,
      endDate as string
    );
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};
