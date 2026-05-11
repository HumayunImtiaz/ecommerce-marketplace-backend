import prisma from "../../../config/prisma";
import { productValidation } from "../validations/product.validation";
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

const generateUniqueSlug = async (baseSlug: string, excludeId?: string): Promise<string> => {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const exists = await prisma.product.findFirst({
      where: { slug, id: excludeId ? { not: excludeId } : undefined },
    });
    if (!exists) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// ─── Helper: product ka full detail object banao ─────────────────────────────
const buildProductDetail = async (product: any) => {
  const variants = await prisma.variant.findMany({
    where: { productId: product.id },
    include: { stock: true },
  });

  const totalStock = variants.reduce((sum, v) => sum + (v.stock?.quantity || 0), 0);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    comparePrice: product.comparePrice,
    sku: product.sku,
    category: product.category || product.categoryId,
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
    variants: variants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      price: v.price,
      stock: v.stock ? { quantity: v.stock.quantity, status: v.stock.status } : null,
    })),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
};

// ─── Create Product ───────────────────────────────────────────────────────────
const createProductService = async (body: any): Promise<ServiceResponse> => {
  try {
    const isDraft = body.isActive === false;

    if (isDraft && (!body.name || body.name.trim().length < 2)) {
      return { success: false, statusCode: 400, message: "Draft requires at least a product name", data: null };
    }

    let validData: any;
    const dataToValidate = { ...body };
    if (!dataToValidate.categoryId && dataToValidate.category) {
      dataToValidate.categoryId = dataToValidate.category;
    }

    if (!isDraft) {
      const validation = productValidation.createProductSchema.safeParse(dataToValidate);
      if (!validation.success) {
        const fieldErrors = validation.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
        return { success: false, statusCode: 400, message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`, data: null, errors: fieldErrors };
      }
      validData = validation.data;
    } else {
      validData = dataToValidate;
    }

    // Default category for drafts if missing
    let categoryId = validData.categoryId;
    if (!categoryId && isDraft) {
      const generalCat = await prisma.category.findFirst({ where: { slug: "general" } });
      if (generalCat) categoryId = generalCat.id;
      else {
        const anyCat = await prisma.category.findFirst();
        if (anyCat) categoryId = anyCat.id;
      }
    }

    if (categoryId) {
      const categoryExists = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!categoryExists && !isDraft) {
        return { success: false, statusCode: 404, message: "Category not found", data: null };
      }
    } else if (!isDraft) {
      return { success: false, statusCode: 400, message: "Category is required for active products", data: null };
    }

    const sku = validData.sku || `DRAFT-${Date.now()}`;
    if (!isDraft) {
      const skuExists = await prisma.product.findFirst({ where: { sku } });
      if (skuExists) {
        return { success: false, statusCode: 409, message: `SKU "${sku}" already exists`, data: null };
      }
    }

    const baseSlug = validData.slug ? validData.slug.toLowerCase().trim() : generateSlug(validData.name);
    const slug = await generateUniqueSlug(baseSlug);

    const product = await prisma.product.create({
      data: {
        name: validData.name,
        slug,
        description: validData.description || null,
        price: validData.price || 0,
        comparePrice: validData.comparePrice || null,
        sku,
        categoryId: categoryId,
        tags: validData.tags || [],
        images: validData.images || [],
        features: validData.features || [],
        isActive: validData.isActive ?? true,
        isFeatured: validData.isFeatured ?? false,
      },
    });

    const createdVariants: any[] = [];
    const createdStocks: any[] = [];

    if (validData.variants && validData.variants.length > 0) {
      for (const v of validData.variants) {
        const variant = await prisma.variant.create({
          data: { productId: product.id, size: v.size, color: v.color, price: v.price ?? null },
        });
        const stock = await prisma.stock.create({
          data: { variantId: variant.id, quantity: v.stock ?? 0 },
        });
        createdVariants.push(variant);
        createdStocks.push(stock);
      }
    }

    if (product.isActive) {
      notifySubscribersService(product).catch((err) =>
        console.error("Newsletter notification failed:", err.message)
      );
    }

    return {
      success: true,
      statusCode: 201,
      message: isDraft ? "Draft saved successfully" : "Product created successfully",
      data: { product, variants: createdVariants, stocks: createdStocks },
    };
  } catch (error: any) {
    console.error("createProductService error:", error);
    return { success: false, statusCode: 500, message: `Failed to create product: ${error.message || "unknown error"}`, data: null };
  }
};

const getProductBySlugService = async (slug: string): Promise<ServiceResponse> => {
  try {
    const product = await prisma.product.findFirst({
      where: {
        slug: slug,
        isDeleted: false,
      },
      include: {
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });
    if (!product) {
      return { success: false, statusCode: 404, message: "Product not found", data: null };
    }

    const fullProduct = await buildProductDetail(product);

    return {
      success: true,
      statusCode: 200,
      message: "Product fetched successfully",
      data: { product: fullProduct },
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
      sortBy,
      page = 1,
      limit = 12,
      includeDeleted = false, // Added for admin if needed
    } = options;

    const where: any = {};
    if (!includeDeleted) {
      where.isDeleted = false;
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured === "true" || isFeatured === true;
    }

    if (status === "active") {
      where.isActive = true;
    } else if (status === "draft") {
      where.isActive = false;
    } else if (activeOnly) {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) {
      // Check if it's a UUID or a slug/name
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(category)) {
        where.categoryId = category;
      } else {
        const foundCat = await prisma.category.findFirst({
          where: {
            OR: [
              { name: { equals: category, mode: "insensitive" } },
              { slug: { equals: category, mode: "insensitive" } },
            ],
          },
        });
        where.categoryId = foundCat ? foundCat.id : "nonexistent";
      }
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = Number(minPrice);
      if (maxPrice !== undefined) where.price.lte = Number(maxPrice);
    }

    if (rating !== undefined) {
      where.avgRating = { gte: Number(rating) };
    }

    let orderBy: any = { createdAt: "desc" };
    switch (sortBy) {
      case "price-low":    orderBy = { price: "asc" }; break;
      case "price-high":   orderBy = { price: "desc" }; break;
      case "rating":       orderBy = { avgRating: "desc" }; break;
      case "name":         orderBy = { name: "asc" }; break;
      case "newest":       orderBy = { createdAt: "desc" }; break;
      case "featured":     orderBy = [{ isFeatured: "desc" }, { avgRating: "desc" }]; break;
      case "trending":     orderBy = [{ reviewCount: "desc" }, { avgRating: "desc" }]; break;
    }

    // Get all products with variants + stock to filter inStock
    const allProducts = await prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true, slug: true } },
        variants: { include: { stock: true } },
      },
      orderBy,
    });

    // Filter by inStock if needed
    let filteredProducts = allProducts;
    if (inStock === true || inStock === "true") {
      filteredProducts = allProducts.filter((p) =>
        p.variants.reduce((sum, v) => sum + (v.stock?.quantity || 0), 0) > 0
      );
    }

    const totalCount = filteredProducts.length;
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;
    const paginatedProducts = filteredProducts.slice(skip, skip + Number(limit));

    const productsWithDetails = await Promise.all(
      paginatedProducts.map((product) => buildProductDetail(product))
    );

    // Category counts (facets)
    const whereWithoutCategory = { ...where };
    delete whereWithoutCategory.categoryId;
    const categoryCountsRaw = await prisma.product.groupBy({
      by: ["categoryId"],
      where: whereWithoutCategory,
      _count: { categoryId: true },
    });
    const categoryCounts: Record<string, number> = {};
    categoryCountsRaw.forEach((f) => {
      if (f.categoryId) categoryCounts[f.categoryId] = f._count.categoryId;
    });

    return {
      success: true,
      statusCode: 200,
      message: "Products fetched successfully",
      data: productsWithDetails,
      metaDetails: {
        totalCount,
        totalPages,
        currentPage: Number(page),
        limit: Number(limit),
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
    const dataToValidate = { ...body };
    if (!dataToValidate.categoryId && dataToValidate.category) {
      dataToValidate.categoryId = dataToValidate.category;
    }

    const validation = productValidation.updateProductSchema.safeParse(dataToValidate);
    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
      return { success: false, statusCode: 400, message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`, data: null, errors: fieldErrors };
    }

    const validData = validation.data;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return { success: false, statusCode: 404, message: `Product not found with ID "${productId}"`, data: null };
    }

    if (validData.categoryId) {
      const categoryExists = await prisma.category.findUnique({ where: { id: validData.categoryId as string } });
      if (!categoryExists) {
        return { success: false, statusCode: 404, message: "Category not found", data: null };
      }
    }

    if (validData.sku && validData.sku !== product.sku) {
      const skuExists = await prisma.product.findFirst({ where: { sku: validData.sku, id: { not: productId } } });
      if (skuExists) {
        return { success: false, statusCode: 409, message: `SKU "${validData.sku}" already exists`, data: null };
      }
    }

    let slug = product.slug;
    if (validData.name || validData.slug) {
      const baseSlug = (validData.slug as string | undefined)
        ? (validData.slug as string).toLowerCase().trim()
        : validData.name
        ? generateSlug(validData.name)
        : product.slug;
      slug = await generateUniqueSlug(baseSlug, productId);
    }

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        name: validData.name !== undefined ? validData.name : product.name,
        slug,
        description: validData.description !== undefined ? validData.description ?? null : product.description,
        price: validData.price !== undefined ? validData.price : product.price,
        comparePrice: validData.comparePrice !== undefined ? validData.comparePrice ?? null : product.comparePrice,
        sku: validData.sku !== undefined ? validData.sku : product.sku,
        categoryId: validData.categoryId !== undefined ? validData.categoryId as string : product.categoryId,
        tags: validData.tags !== undefined ? validData.tags : product.tags,
        images: validData.images !== undefined ? validData.images : product.images,
        features: validData.features !== undefined ? validData.features : product.features,
        isActive: validData.isActive !== undefined ? validData.isActive : product.isActive,
        isFeatured: validData.isFeatured !== undefined ? validData.isFeatured : product.isFeatured,
      },
    });

    let updatedVariants: any[] = [];
    let updatedStocks: any[] = [];

    if (validData.variants !== undefined) {
      // Delete existing variants and stocks (cascade handles stocks)
      await prisma.variant.deleteMany({ where: { productId: product.id } });

      for (const v of validData.variants) {
        const variant = await prisma.variant.create({
          data: { productId: product.id, size: v.size, color: v.color, price: v.price ?? null },
        });
        const stock = await prisma.stock.create({
          data: { variantId: variant.id, quantity: v.stock ?? 0 },
        });
        updatedVariants.push(variant);
        updatedStocks.push(stock);
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: "Product updated successfully",
      data: { product: updatedProduct, variants: updatedVariants, stocks: updatedStocks },
    };
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

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return { success: false, statusCode: 404, message: `No product found with ID "${productId}"`, data: null };
    }

    const categoryId = product.categoryId;

    // Use soft delete instead of permanent delete
    await prisma.product.update({
      where: { id: productId },
      data: { isDeleted: true, isActive: false },
    });

    if (categoryId) {
      const remainingProducts = await prisma.product.count({ where: { categoryId, isDeleted: false } });
      if (remainingProducts === 0) {
        await prisma.category.delete({ where: { id: categoryId } });
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

    await prisma.product.updateMany({ where: { id: { in: productIds } }, data: { isActive } });

    return {
      success: true,
      statusCode: 200,
      message: `Successfully ${isActive ? "published" : "unpublished"} ${productIds.length} products`,
      data: null,
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

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { categoryId: true },
    });
    const categoryIds = Array.from(new Set(products.map((p) => p.categoryId).filter(Boolean))) as string[];

    // Use soft delete
    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { isDeleted: true, isActive: false },
    });

    // Auto-cleanup categories
    for (const catId of categoryIds) {
      const remaining = await prisma.product.count({ where: { categoryId: catId, isDeleted: false } });
      if (remaining === 0) {
        await prisma.category.delete({ where: { id: catId } });
        console.log(`Bulk auto-cleaned empty category: ${catId}`);
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: `Successfully deleted ${productIds.length} products and cleaned up categories.`,
      data: null,
    };
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
  bulkDeleteProductService,
};
