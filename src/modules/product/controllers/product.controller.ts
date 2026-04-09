import { NextFunction, Request, Response } from "express";
import {
  createProductService,
  getProductBySlugService,
  getAllProductsService,
  updateProductService,
  deleteProductService,
  bulkUpdateProductStatusService,
  bulkDeleteProductService,
} from "../services/product.service";

const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await createProductService(req.body);

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

const getProductBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { slug } = req.params;
    const result = await getProductBySlugService(slug as string);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      activeOnly,
      status,
      search,
      category,
      minPrice,
      maxPrice,
      rating,
      inStock,
      isFeatured,
      isTrending,
      sortBy,
      page,
      limit,
    } = req.query;

    const filterOptions: any = {
      activeOnly: activeOnly === "true",
      status:     status as string,
      search:     search as string,
      category:   category as string,
      minPrice:   (minPrice !== undefined && minPrice !== "") ? Number(minPrice) : undefined,
      maxPrice:   (maxPrice !== undefined && maxPrice !== "") ? Number(maxPrice) : undefined,
      rating:     (rating !== undefined && rating !== "")     ? Number(rating)   : undefined,
      inStock:    inStock === "true",
      isFeatured: isFeatured as string,
      isTrending: isTrending as string,
      sortBy:     sortBy as string,
      page:       page  ? Number(page)  : 1,
      limit:      limit ? Number(limit) : 12,
    };

    const result = await getAllProductsService(filterOptions);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data:    result.data,
      metaDetails: result.metaDetails,
    });
  } catch (error) {
    return next(error);
  }
};

const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const productId = req.params.productId as string;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required in URL params",
        data: null,
        errors: [{ field: "productId", message: "Product ID is required in URL params" }],
      });
    }

    console.log("updateProduct payload:", req.body);
    const result = await updateProductService(productId, req.body);
    console.log("updateProductService updated features:", (result.data as any)?.features);

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

const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const productId = req.params.productId as string;
    const result = await deleteProductService(productId);

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

const bulkUpdateProductStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { productIds, isActive } = req.body;
    const result = await bulkUpdateProductStatusService(productIds, isActive);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

const bulkDeleteProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { productIds } = req.body;
    const result = await bulkDeleteProductService(productIds);

    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

export {
  createProduct,
  getProductBySlug,
  getAllProducts,
  updateProduct,
  deleteProduct,
  bulkUpdateProductStatus,
  bulkDeleteProducts,
};