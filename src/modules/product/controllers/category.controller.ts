import { NextFunction, Request, Response } from "express";
import {
  createCategoryService,
  getAllCategoriesService,
  updateCategoryService,
  deleteCategoryService,
} from "../services/category.service";

const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await createCategoryService(req.body);

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

const getAllCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const hideEmpty = req.query.hideEmpty === "true";
    const result = await getAllCategoriesService(hideEmpty);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categoryId = req.params.categoryId as string;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Category ID is required in URL params",
        data: null,
        errors: [{ field: "categoryId", message: "Category ID is required in URL params" }],
      });
    }

    const result = await updateCategoryService(categoryId, req.body);

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

const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categoryId = req.params.categoryId as string;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "Category ID is required in URL params",
        data: null,
        errors: [{ field: "categoryId", message: "Category ID is required in URL params" }],
      });
    }

    const result = await deleteCategoryService(categoryId);

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
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
};