import { NextFunction, Request, Response } from "express";
import {
  registerUserService,
  verifyEmailService,
  resendVerificationEmailService,
  loginUserService,
  socialLoginService,
  forgotPasswordService,
  resetPasswordService,
  requestAccountDeletionService,
  getEmailPreferencesService,
  updateEmailPreferencesService,
  updateUserProfileService,
} from "../services/user.auth.service";

const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await registerUserService(req.body);

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

const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.params.token as string;

    const result = await verifyEmailService(token);

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

const resendVerificationEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await resendVerificationEmailService(req.body);

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

const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await loginUserService(req.body);

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

const socialLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await socialLoginService(req.body);

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

const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await forgotPasswordService(req.body);

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

const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.params.token as string;

    const result = await resetPasswordService(token, req.body);

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

const requestAccountDeletion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).authUser?._id || (req as any).authUser?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized", data: null });
    }
    const result = await requestAccountDeletionService(userId.toString());

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

const getEmailPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).authUser?._id || (req as any).authUser?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized", data: null });
    const result = await getEmailPreferencesService(userId.toString());
    return res.status(result.statusCode).json({ success: result.success, message: result.message, data: result.data });
  } catch (error) { return next(error); }
};

const updateEmailPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).authUser?._id || (req as any).authUser?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized", data: null });
    const result = await updateEmailPreferencesService(userId.toString(), req.body);
    return res.status(result.statusCode).json({ success: result.success, message: result.message, data: result.data });
  } catch (error) { return next(error); }
};

const updateUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).authUser?._id || (req as any).authUser?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized", data: null });

    const updateData = { ...req.body };
    if (req.file) {
      updateData.avatar = req.file.filename;
    }

    const result = await updateUserProfileService(userId.toString(), updateData);
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

export {
  registerUser,
  verifyEmail,
  resendVerificationEmail,
  loginUser,
  socialLogin,
  forgotPassword,
  resetPassword,
  requestAccountDeletion,
  getEmailPreferences,
  updateEmailPreferences,
  updateUserProfile,
};