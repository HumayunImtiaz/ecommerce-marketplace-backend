import { NextFunction, Request, Response } from "express";
import {
  subscribeService,
  unsubscribeService,
  broadcastNewsletterService,
  getNewsletterLogsService,
} from "../services/newsletter.service";

const subscribe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const result = await subscribeService(email);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

const unsubscribe = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const result = await unsubscribeService(email);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

const broadcast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subject, body } = req.body;
    const result = await broadcastNewsletterService(subject, body);
    return res.status(result.statusCode).json(result);
  } catch (error) {
    return next(error);
  }
};

const getLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getNewsletterLogsService();
    return res.status(result.statusCode).json(result);
  } catch (error) {
    return next(error);
  }
};

export { subscribe, unsubscribe, broadcast, getLogs };
