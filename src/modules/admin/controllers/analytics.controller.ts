import { Request, Response, NextFunction } from "express";
import { getAnalyticsStatsService } from "../services/analytics.service";


const getAnalyticsStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateRange, startDate, endDate } = req.query;
    const result = await getAnalyticsStatsService(dateRange as string, startDate as string, endDate as string);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    return next(error);
  }
};

export { getAnalyticsStats };
