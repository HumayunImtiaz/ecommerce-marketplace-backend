import { NextFunction, Request, Response } from "express";
import {
  adminLoginService,
  getAllUsersService,
  temporaryDeleteUserService,
  permanentDeleteUserService,
  changeAdminPasswordService,
  updateAdminProfileService,
  addUserService,
  getUserByIdService,
} from "../services/admin.auth.service";

const adminLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminLoginService(req.body);
    return res.status(result.statusCode).json({
      success: result.success, message: result.message, data: result.data,
      ...(result.errors && { errors: result.errors }),
    });
  } catch (error) { return next(error); }
};

const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getAllUsersService();
    return res.status(result.statusCode).json({ success: result.success, message: result.message, data: result.data });
  } catch (error) { return next(error); }
};

const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getUserByIdService(req.params.userId as string);
    return res.status(result.statusCode).json({
      success: result.success, message: result.message, data: result.data,
      ...(result.errors && { errors: result.errors }),
    });
  } catch (error) { return next(error); }
};

const temporaryDeleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const adminId = String((req as any).authAdmin?._id || "");
    const result = await temporaryDeleteUserService(userId, adminId);
    return res.status(result.statusCode).json({
      success: result.success, message: result.message, data: result.data,
      ...(result.errors && { errors: result.errors }),
    });
  } catch (error) { return next(error); }
};

const permanentDeleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const result = await permanentDeleteUserService(userId);
    return res.status(result.statusCode).json({
      success: result.success, message: result.message, data: result.data,
      ...(result.errors && { errors: result.errors }),
    });
  } catch (error) { return next(error); }
};

const changeAdminPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = String((req as any).authAdmin?._id || "");
    if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized", data: null });
    const result = await changeAdminPasswordService(adminId, req.body);
    return res.status(result.statusCode).json({
      success: result.success, message: result.message, data: result.data,
      ...(result.errors && { errors: result.errors }),
    });
  } catch (error) { return next(error); }
};

const updateAdminProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = String((req as any).authAdmin?._id || "");
    if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized", data: null });
    
    const updateData = { ...req.body };
    if (req.file) {
      updateData.avatar = req.file.filename;
    }

    const result = await updateAdminProfileService(adminId, updateData);
    return res.status(result.statusCode).json({
      success: result.success, message: result.message, data: result.data,
      ...(result.errors && { errors: result.errors }),
    });
  } catch (error) { return next(error); }
};
 
const addUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await addUserService(req.body);
    return res.status(result.statusCode).json({
      success: result.success, message: result.message, data: result.data,
      ...(result.errors && { errors: result.errors }),
    });
  } catch (error) { return next(error); }
};

export {
  adminLogin,
  getAllUsers,
  getUserById,
  temporaryDeleteUser,
  permanentDeleteUser,
  changeAdminPassword,
  updateAdminProfile,
  addUser,
};