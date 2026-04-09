import { z } from "zod";
import Review from "../models/review.model";
import Product from "../../product/models/product.model";

type FieldError = { field: string; message: string };
type ServiceResponse<T = unknown> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  errors?: FieldError[];
};

const createReviewSchema = z.object({
  rating: z.number().int().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5"),
  comment: z.string().trim().min(5, "Comment must be at least 5 characters"),
});

// Product ki avg rating recalculate karo 
const recalculateProductRating = async (productId: string): Promise<void> => {
  const reviews = await Review.find({ productId });
  const reviewCount = reviews.length;
  const avgRating =
    reviewCount > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : 0;

  await Product.findByIdAndUpdate(productId, {
    avgRating: Math.round(avgRating * 10) / 10, // 1 decimal place
    reviewCount,
  });
};

// Get Product Reviews 
export const getProductReviewsService = async (
  productId: string
): Promise<ServiceResponse> => {
  try {
    if (!productId?.trim()) {
      return { success: false, statusCode: 400, message: "Product ID is required", data: null };
    }

    const product = await Product.findById(productId);
    if (!product) {
      return { success: false, statusCode: 404, message: "Product not found", data: null };
    }

    const reviews = await Review.find({ productId }).sort({ createdAt: -1 });

    return {
      success: true,
      statusCode: 200,
      message: "Reviews fetched successfully",
      data: reviews.map((r) => ({
        id: r._id,
        productId: r.productId,
        userId: r.userId,
        userName: r.userName,
        rating: r.rating,
        comment: r.comment,
        date: r.createdAt,
      })),
    };
  } catch (error: any) {
    return { success: false, statusCode: 500, message: `Failed to fetch reviews: ${error.message}`, data: null };
  }
};

//  Create Review
export const createReviewService = async (
  productId: string,
  userId: string,
  userName: string,
  body: any
): Promise<ServiceResponse> => {
  try {
    if (!productId?.trim()) {
      return { success: false, statusCode: 400, message: "Product ID is required", data: null };
    }

    const product = await Product.findById(productId);
    if (!product) {
      return { success: false, statusCode: 404, message: "Product not found", data: null };
    }

    const validation = createReviewSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
      return {
        success: false,
        statusCode: 400,
        message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`,
        data: null,
        errors: fieldErrors,
      };
    }

    // Check karo kya user ne already review kiya hai
    const existingReview = await Review.findOne({ productId, userId });
    if (existingReview) {
      return {
        success: false,
        statusCode: 409,
        message: "You have already reviewed this product",
        data: null,
        errors: [{ field: "review", message: "You can only review a product once" }],
      };
    }

    const review = new Review({
      productId,
      userId,
      userName,
      rating: validation.data.rating,
      comment: validation.data.comment,
    });

    await review.save();

    // Product ki avg rating update karo
    await recalculateProductRating(productId);

    return {
      success: true,
      statusCode: 201,
      message: "Review submitted successfully",
      data: {
        id: review._id,
        productId: review.productId,
        userId: review.userId,
        userName: review.userName,
        rating: review.rating,
        comment: review.comment,
        date: review.createdAt,
      },
    };
  } catch (error: any) {
    if (error.code === 11000) {
      return {
        success: false,
        statusCode: 409,
        message: "You have already reviewed this product",
        data: null,
      };
    }
    return { success: false, statusCode: 500, message: `Failed to submit review: ${error.message}`, data: null };
  }
};