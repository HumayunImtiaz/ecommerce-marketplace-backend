import prisma from "../../../config/prisma";
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

    const existing = await prisma.category.findFirst({
      where: {
        OR: [{ name: validData.name }, { slug }],
      },
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

    const category = await prisma.category.create({
      data: {
        name: validData.name,
        slug,
        description: validData.description || null,
        image: validData.image || "",
      },
    });

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
      // Get categories that have at least one product
      categories = await prisma.category.findMany({
        where: {
          isActive: true,
          products: { some: {} },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      categories = await prisma.category.findMany({
        orderBy: { createdAt: "desc" },
      });
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
    const category = await prisma.category.findUnique({ where: { id: categoryId } });

    if (!category) {
      return {
        success: false,
        statusCode: 404,
        message: `Category not found: no category exists with ID "${categoryId}"`,
        data: null,
        errors: [{ field: "categoryId", message: `No category found with ID "${categoryId}"` }],
      };
    }

    let slug = category.slug;
    let name = category.name;

    if (validData.name || validData.slug) {
      slug = validData.slug
        ? validData.slug.toLowerCase().trim()
        : validData.name
        ? generateSlug(validData.name)
        : category.slug;

      if (validData.name) name = validData.name;

      const duplicate = await prisma.category.findFirst({
        where: {
          id: { not: categoryId },
          OR: [
            ...(validData.name ? [{ name: validData.name }] : []),
            { slug },
          ],
        },
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
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name,
        slug,
        description: validData.description !== undefined ? validData.description || null : category.description,
        image: validData.image !== undefined ? validData.image || "" : category.image,
        isActive: validData.isActive !== undefined ? validData.isActive : category.isActive,
      },
    });

    return {
      success: true,
      statusCode: 200,
      message: "Category updated successfully",
      data: updatedCategory,
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

    const category = await prisma.category.findUnique({ where: { id: categoryId } });

    if (!category) {
      return {
        success: false,
        statusCode: 404,
        message: `Category not found: no category exists with ID "${categoryId}"`,
        data: null,
        errors: [{ field: "categoryId", message: `No category found with ID "${categoryId}"` }],
      };
    }

    await prisma.category.delete({ where: { id: categoryId } });

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