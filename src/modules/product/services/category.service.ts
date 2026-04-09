import Category from "../models/category.model";
import { categoryValidation } from "../validations/category.validation";
import slugify from "slugify";

type FieldError = {
  field: string;
  message: string;
};

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

const createCategoryService = async (body: any): Promise<ServiceResponse> => {
  try {
    // --- Validation ---
    const validation = categoryValidation.createCategorySchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return {
        success: false,
        statusCode: 400,
        message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`,
        data: null,
        errors: fieldErrors,
      };
    }

    const validData = validation.data;
    const slug = validData.slug
      ? validData.slug.toLowerCase().trim()
      : generateSlug(validData.name);

    const existing = await Category.findOne({
      $or: [{ name: validData.name }, { slug }],
    });

    if (existing) {
      const duplicateField = existing.name === validData.name ? "name" : "slug";

      return {
        success: false,
        statusCode: 409,
        message: `Category with this ${duplicateField} already exists`,
        data: null,
        errors: [{ field: duplicateField, message: `"${duplicateField === "name" ? validData.name : slug}" already exists` }],
      };
    }

    const category = new Category({
      name: validData.name,
      slug,
      description: validData.description || null,
      image: validData.image || "",
    });

    await category.save();

    return {
      success: true,
      statusCode: 201,
      message: "Category created successfully",
      data: category,
    };
  } catch (error: any) {
    console.error("createCategoryService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Failed to create category: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

const getAllCategoriesService = async (hideEmpty: boolean = false): Promise<ServiceResponse> => {
  try {
    let categories;
    if (hideEmpty) {
      // Use aggregation to find categories that have at least one product
      categories = await Category.aggregate([
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "categoryId",
            as: "products",
          },
        },
        {
          $addFields: {
            productCount: { $size: "$products" },
          },
        },
        {
          $match: {
            productCount: { $gt: 0 },
            isActive: true
          },
        },
        { $sort: { createdAt: -1 } },
        { $project: { products: 0, productCount: 0 } }
      ]);
    } else {
      categories = await Category.find().sort({ createdAt: -1 });
    }

    return {
      success: true,
      statusCode: 200,
      message: "Categories fetched successfully",
      data: categories,
    };
  } catch (error: any) {
    console.error("getAllCategoriesService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Failed to fetch categories: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

const updateCategoryService = async (
  categoryId: string,
  body: any
): Promise<ServiceResponse> => {
  try {
    // --- Validation ---
    const validation = categoryValidation.updateCategorySchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return {
        success: false,
        statusCode: 400,
        message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`,
        data: null,
        errors: fieldErrors,
      };
    }

    const validData = validation.data;
    const category = await Category.findById(categoryId);

    if (!category) {
      return {
        success: false,
        statusCode: 404,
        message: `Category not found: no category exists with ID "${categoryId}"`,
        data: null,
        errors: [{ field: "categoryId", message: `No category found with ID "${categoryId}"` }],
      };
    }

    if (validData.name || validData.slug) {
      const slug = validData.slug
        ? validData.slug.toLowerCase().trim()
        : validData.name
        ? generateSlug(validData.name)
        : category.slug;

      const duplicate = await Category.findOne({
        _id: { $ne: categoryId },
        $or: [
          ...(validData.name ? [{ name: validData.name }] : []),
          { slug },
        ],
      });

      if (duplicate) {
        return {
          success: false,
          statusCode: 409,
          message: "Category name or slug already exists",
          data: null,
          errors: [{ field: "name", message: "Category name or slug already taken by another category" }],
        };
      }

      if (validData.name) {
        category.name = validData.name;
      }
      category.slug = slug;
    }

    if (validData.description !== undefined) {
      category.description = validData.description || null;
    }

    if (validData.image !== undefined) {
      category.image = validData.image || "";
    }

    if (validData.isActive !== undefined) {
      category.isActive = validData.isActive;
    }

    await category.save();

    return {
      success: true,
      statusCode: 200,
      message: "Category updated successfully",
      data: category,
    };
  } catch (error: any) {
    console.error("updateCategoryService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Failed to update category: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

const deleteCategoryService = async (
  categoryId: string
): Promise<ServiceResponse> => {
  try {
    if (!categoryId || categoryId.trim() === "") {
      return {
        success: false,
        statusCode: 400,
        message: "Category ID is required",
        data: null,
        errors: [{ field: "categoryId", message: "Category ID is required" }],
      };
    }

    const category = await Category.findById(categoryId);

    if (!category) {
      return {
        success: false,
        statusCode: 404,
        message: `Category not found: no category exists with ID "${categoryId}"`,
        data: null,
        errors: [{ field: "categoryId", message: `No category found with ID "${categoryId}"` }],
      };
    }

    await Category.findByIdAndDelete(categoryId);

    return {
      success: true,
      statusCode: 200,
      message: "Category deleted successfully",
      data: null,
    };
  } catch (error: any) {
    console.error("deleteCategoryService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Failed to delete category: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

export {
  createCategoryService,
  getAllCategoriesService,
  updateCategoryService,
  deleteCategoryService,
};