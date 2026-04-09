import Product from "../models/product.model";
import Variant from "../models/variant.model";
import Stock from "../models/stock.model";
import Category from "../models/category.model";
import { productValidation } from "../validations/product.validation";
import mongoose from "mongoose";
import slugify from "slugify";

import { notifySubscribersService } from "../../newsletter/services/newsletter.service";

type FieldError = { field: string; message: string };
type ServiceResponse<T = unknown> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  errors?: FieldError[];
};

const generateSlug = (name: string): string => {
  return slugify(name, { lower: true, strict: true });
};

const generateUniqueSlug = async (
  baseSlug: string,
  excludeId?: string
): Promise<string> => {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query: any = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Product.findOne(query);
    if (!exists) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// ─── Helper: product ka full detail object banao ─────────────────────────────
const buildProductDetail = async (product: any) => {
  console.log('buildProductDetail product features:', product.features);
  let totalStock = product.totalStock;
  let variants = [];
  let stocks = [];

  if (totalStock === undefined) {
    variants = await Variant.find({ productId: product._id });
    const variantIds = variants.map((v) => v._id);
    stocks = await Stock.find({ variantId: { $in: variantIds } });
    totalStock = stocks.reduce((sum, s) => sum + s.quantity, 0);
  } else {
    variants = await Variant.find({ productId: product._id });
    const variantIds = variants.map((v) => v._id);
    stocks = await Stock.find({ variantId: { $in: variantIds } });
  }

  return {
    id: product._id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    comparePrice: product.comparePrice,
    sku: product.sku,
    category: product.categoryId,
    tags: product.tags,
    images: product.images,
    features: product.features || [],
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    avgRating: product.avgRating,
    reviewCount: product.reviewCount,
    totalStock,
    inStock: totalStock > 0,
    outOfStock: totalStock <= 0,
    variants: variants.map((v) => {
      const variantStock = stocks.find(
        (s) => s.variantId.toString() === v._id.toString()
      );
      return {
        id: v._id,
        size: v.size,
        color: v.color,
        price: v.price,
        stock: variantStock
          ? { quantity: variantStock.quantity, status: variantStock.status }
          : null,
      };
    }),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
};

// ─── Create Product ───────────────────────────────────────────────────────────
const createProductService = async (body: any): Promise<ServiceResponse> => {
  try {
    const isDraft = body.isActive === false;

    // If it's a draft, we only strictly need the name.
    if (isDraft && (!body.name || body.name.trim().length < 2)) {
      return { success: false, statusCode: 400, message: "Draft requires at least a product name", data: null };
    }

    let validData: any;
    if (!isDraft) {
      const validation = productValidation.createProductSchema.safeParse(body);
      if (!validation.success) {
        const fieldErrors = validation.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
        return { success: false, statusCode: 400, message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`, data: null, errors: fieldErrors };
      }
      validData = validation.data;
    } else {
      validData = body;
    }

    // Default category for drafts if missing
    let categoryId = validData.categoryId;
    if (!categoryId && isDraft) {
      const generalCat = await Category.findOne({ slug: "general" });
      if (generalCat) categoryId = generalCat._id;
      else {
        // Find any category
        const anyCat = await Category.findOne();
        if (anyCat) categoryId = anyCat._id;
      }
    }

    if (categoryId) {
      const categoryExists = await Category.findById(categoryId);
      if (!categoryExists && !isDraft) {
        return { success: false, statusCode: 404, message: "Category not found", data: null };
      }
    } else if (!isDraft) {
      return { success: false, statusCode: 400, message: "Category is required for active products", data: null };
    }

    const sku = validData.sku || `DRAFT-${Date.now()}`;
    if (!isDraft) {
      const skuExists = await Product.findOne({ sku });
      if (skuExists) {
        return { success: false, statusCode: 409, message: `SKU "${sku}" already exists`, data: null };
      }
    }

    const baseSlug = validData.slug ? validData.slug.toLowerCase().trim() : generateSlug(validData.name);
    const slug = await generateUniqueSlug(baseSlug);

    const product = new Product({
      name: validData.name,
      slug,
      description: validData.description || null,
      price: validData.price || 0,
      comparePrice: validData.comparePrice || null,
      sku: sku,
      categoryId: categoryId,
      tags: validData.tags || [],
      images: validData.images || [],
      features: validData.features || [],
      isActive: validData.isActive ?? true,
      isFeatured: validData.isFeatured ?? false,
    });

    await product.save();

    const createdVariants: any[] = [];
    const createdStocks: any[] = [];

    if (validData.variants && validData.variants.length > 0) {
      for (const v of validData.variants) {
        const variant = new Variant({ productId: product._id, size: v.size, color: v.color, price: v.price ?? null });
        await variant.save();
        const stock = new Stock({ variantId: variant._id, quantity: v.stock ?? 0 });
        await stock.save();
        createdVariants.push(variant);
        createdStocks.push(stock);
      }
    }

    if (product.isActive) {
      notifySubscribersService(product).catch((err) =>
        console.error("Newsletter notification failed:", err.message)
      );
    }

    return { success: true, statusCode: 201, message: isDraft ? "Draft saved successfully" : "Product created successfully", data: { product, variants: createdVariants, stocks: createdStocks } };
  } catch (error: any) {
    console.error("createProductService error:", error);
    return { success: false, statusCode: 500, message: `Failed to create product: ${error.message || "unknown error"}`, data: null };
  }
};

const getProductBySlugService = async (slug: string): Promise<ServiceResponse> => {
  try {
    const product = await Product.findOne({ slug, isActive: true }).populate("categoryId", "name slug");
    if (!product) {
      return { success: false, statusCode: 404, message: "Product not found", data: null };
    }

    const fullProduct = await buildProductDetail(product);

    return {
      success: true,
      statusCode: 200,
      message: "Product fetched successfully",
      data: { product: fullProduct }
    };
  } catch (error: any) {
    console.error("getProductBySlugService error:", error);
    return { success: false, statusCode: 500, message: `Failed to fetch product: ${error.message || "unknown error"}`, data: null };
  }
};

const getAllProductsService = async (options: any = {}): Promise<ServiceResponse & { metaDetails?: any }> => {
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
      page = 1,
      limit = 12,
    } = options;

    const filter: any = {};

    if (isFeatured !== undefined) {
      filter.isFeatured = isFeatured === "true" || isFeatured === true;
    }

    if (status === "active") {
      filter.isActive = true;
    } else if (status === "draft") {
      filter.isActive = false;
    } else if (activeOnly) {
      filter.isActive = true;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (category) {
      const isObjectId = mongoose.Types.ObjectId.isValid(category);
      if (isObjectId) {
        filter.categoryId = category;
      } else {
        const foundCat = await Category.findOne({
          $or: [
            { name: { $regex: new RegExp(`^${category}$`, "i") } },
            { slug: { $regex: new RegExp(`^${category}$`, "i") } },
          ],
        });
        if (foundCat) {
          filter.categoryId = foundCat._id;
        } else {
          filter.categoryId = new mongoose.Types.ObjectId();
        }
      }
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    if (rating !== undefined) {
      filter.avgRating = { $gte: rating };
    }

    const pipeline: any[] = [{ $match: filter }];

    pipeline.push(
      {
        $lookup: {
          from: "variants",
          localField: "_id",
          foreignField: "productId",
          as: "v",
        },
      },
      {
        $lookup: {
          from: "stocks",
          localField: "v._id",
          foreignField: "variantId",
          as: "s",
        },
      },
      {
        $addFields: {
          totalStock: { $sum: "$s.quantity" },
        },
      }
    );

    if (inStock === true) {
      pipeline.push({ $match: { totalStock: { $gt: 0 } } });
    }

    let sortObj: any = { createdAt: -1 };
    switch (sortBy) {
      case "price-low":
        sortObj = { price: 1 };
        break;
      case "price-high":
        sortObj = { price: -1 };
        break;
      case "rating":
        sortObj = { avgRating: -1 };
        break;
      case "name":
        sortObj = { name: 1 };
        break;
      case "newest":
        sortObj = { createdAt: -1 };
        break;
      case "featured":
        sortObj = { isFeatured: -1, avgRating: -1 };
        break;
      case "trending":
        sortObj = { reviewCount: -1, avgRating: -1 };
        break;
    }
    pipeline.push({ $sort: sortObj });

    const countPipeline = [...pipeline];
    const [{ totalCount = 0 } = {}] = await Product.aggregate([
      ...countPipeline,
      { $count: "totalCount" },
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    pipeline.push({ $skip: skip }, { $limit: limit });

    const products = await Product.aggregate(pipeline);
    await Product.populate(products, { path: "categoryId", select: "name slug" });

    const productsWithDetails = await Promise.all(
      products.map((product) => buildProductDetail(product))
    );

    const facetFilter = { ...filter };
    delete facetFilter.categoryId;
    const categoryCountsRaw = await Product.aggregate([
      { $match: facetFilter },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    ]);

    const categoryCounts: Record<string, number> = {};
    categoryCountsRaw.forEach((facet: any) => {
      if (facet._id) {
        categoryCounts[facet._id.toString()] = facet.count;
      }
    });

    return {
      success: true,
      statusCode: 200,
      message: "Products fetched successfully",
      data: productsWithDetails,
      metaDetails: {
        totalCount,
        totalPages,
        currentPage: page,
        limit,
        categoryCounts,
        sortOptions: [
          { value: "featured", label: "Featured" },
          { value: "price-low", label: "Price: Low to High" },
          { value: "price-high", label: "Price: High to Low" },
          { value: "rating", label: "Highest Rated" },
          { value: "newest", label: "Newest" },
          { value: "name", label: "Name A-Z" },
        ],
      },
    };
  } catch (error: any) {
    console.error("getAllProductsService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Failed to fetch products: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

const updateProductService = async (productId: string, body: any): Promise<ServiceResponse> => {
  try {
    const validation = productValidation.updateProductSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
      return { success: false, statusCode: 400, message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`, data: null, errors: fieldErrors };
    }

    const validData = validation.data;
    const product = await Product.findById(productId);
    if (!product) {
      return { success: false, statusCode: 404, message: `Product not found with ID "${productId}"`, data: null, errors: [{ field: "productId", message: `No product found with ID "${productId}"` }] };
    }

    if (validData.categoryId) {
      const categoryExists = await Category.findById(validData.categoryId);
      if (!categoryExists) {
        return { success: false, statusCode: 404, message: "Category not found", data: null, errors: [{ field: "categoryId", message: "Category does not exist" }] };
      }
    }

    if (validData.sku && validData.sku !== product.sku) {
      const skuExists = await Product.findOne({ sku: validData.sku, _id: { $ne: productId } });
      if (skuExists) {
        return { success: false, statusCode: 409, message: `SKU "${validData.sku}" already exists`, data: null, errors: [{ field: "sku", message: `"${validData.sku}" already exists` }] };
      }
    }

    if (validData.name || validData.slug) {
      const baseSlug = validData.slug
        ? validData.slug.toLowerCase().trim()
        : validData.name
          ? generateSlug(validData.name)
          : product.slug;
      product.slug = await generateUniqueSlug(baseSlug, productId);
    }

    if (validData.name !== undefined) product.name = validData.name;
    if (validData.description !== undefined) product.description = validData.description ?? null;
    if (validData.price !== undefined) product.price = validData.price;
    if (validData.comparePrice !== undefined) product.comparePrice = validData.comparePrice ?? null;
    if (validData.sku !== undefined) product.sku = validData.sku;
    if (validData.categoryId !== undefined) product.categoryId = validData.categoryId as any;
    if (validData.tags !== undefined) product.tags = validData.tags;
    if (validData.images !== undefined) product.images = validData.images;
    if (validData.features !== undefined) product.features = validData.features;
    if (validData.isActive !== undefined) product.isActive = validData.isActive;
    if (validData.isFeatured !== undefined) product.isFeatured = validData.isFeatured;

    await product.save();

    let updatedVariants: any[] = [];
    let updatedStocks: any[] = [];

    if (validData.variants !== undefined) {
      const existingVariants = await Variant.find({ productId: product._id });
      const existingVariantIds = existingVariants.map((v) => v._id);
      await Stock.deleteMany({ variantId: { $in: existingVariantIds } });
      await Variant.deleteMany({ productId: product._id });

      for (const v of validData.variants) {
        const variant = new Variant({ productId: product._id, size: v.size, color: v.color, price: v.price ?? null });
        await variant.save();
        const stock = new Stock({ variantId: variant._id, quantity: v.stock ?? 0 });
        await stock.save();
        updatedVariants.push(variant);
        updatedStocks.push(stock);
      }
    }

    return { success: true, statusCode: 200, message: "Product updated successfully", data: { product, variants: updatedVariants, stocks: updatedStocks } };
  } catch (error: any) {
    console.error("updateProductService error:", error);
    return { success: false, statusCode: 500, message: `Failed to update product: ${error.message || "unknown error"}`, data: null };
  }
};

const deleteProductService = async (productId: string): Promise<ServiceResponse> => {
  try {
    if (!productId?.trim()) {
      return { success: false, statusCode: 400, message: "Product ID is required", data: null };
    }

    const product = await Product.findById(productId);
    if (!product) {
      return { success: false, statusCode: 404, message: `No product found with ID "${productId}"`, data: null };
    }

    const variants = await Variant.find({ productId: product._id });
    const variantIds = variants.map((v) => v._id);
    await Stock.deleteMany({ variantId: { $in: variantIds } });
    await Variant.deleteMany({ productId: product._id });

    const categoryId = product.categoryId;
    await Product.findByIdAndDelete(productId);


    if (categoryId) {
      const remainingProducts = await Product.countDocuments({ categoryId });
      if (remainingProducts === 0) {
        await Category.findByIdAndDelete(categoryId);
        console.log(`Auto-cleaned empty category: ${categoryId}`);
      }
    }

    return { success: true, statusCode: 200, message: "Product deleted and category cleaned up if empty", data: null };
  } catch (error: any) {
    console.error("deleteProductService error:", error);
    return { success: false, statusCode: 500, message: `Failed to delete product: ${error.message || "unknown error"}`, data: null };
  }
};

const bulkUpdateProductStatusService = async (productIds: string[], isActive: boolean): Promise<ServiceResponse> => {
  try {
    if (!productIds || productIds.length === 0) {
      return { success: false, statusCode: 400, message: "No product IDs provided", data: null };
    }

    await Product.updateMany({ _id: { $in: productIds } }, { isActive });

    return {
      success: true,
      statusCode: 200,
      message: `Successfully ${isActive ? "published" : "unpublished"} ${productIds.length} products`,
      data: null
    };
  } catch (error: any) {
    console.error("bulkUpdateProductStatusService error:", error);
    return { success: false, statusCode: 500, message: `Failed to update products: ${error.message || "unknown error"}`, data: null };
  }
};

const bulkDeleteProductService = async (productIds: string[]): Promise<ServiceResponse> => {
  try {
    if (!productIds || productIds.length === 0) {
      return { success: false, statusCode: 400, message: "No product IDs provided", data: null };
    }

    const products = await Product.find({ _id: { $in: productIds } }, "categoryId");
    const categoryIds = Array.from(new Set(products.map(p => p.categoryId?.toString()).filter(Boolean)));

    const variants = await Variant.find({ productId: { $in: productIds } });
    const variantIds = variants.map((v) => v._id);

    await Stock.deleteMany({ variantId: { $in: variantIds } });
    await Variant.deleteMany({ productId: { $in: productIds } });
    await Product.deleteMany({ _id: { $in: productIds } });

    // Auto-cleanup categories
    for (const catId of categoryIds) {
      if (catId) {
        const remaining = await Product.countDocuments({ categoryId: catId });
        if (remaining === 0) {
          await Category.findByIdAndDelete(catId);
          console.log(`Bulk auto-cleaned empty category: ${catId}`);
        }
      }
    }

    return { success: true, statusCode: 200, message: `Successfully deleted ${productIds.length} products and cleaned up categories.`, data: null };
  } catch (error: any) {
    console.error("bulkDeleteProductService error:", error);
    return { success: false, statusCode: 500, message: `Failed to delete products: ${error.message || "unknown error"}`, data: null };
  }
};

export {
  buildProductDetail,
  createProductService,
  getProductBySlugService,
  getAllProductsService,
  updateProductService,
  deleteProductService,
  bulkUpdateProductStatusService,
  bulkDeleteProductService
};
