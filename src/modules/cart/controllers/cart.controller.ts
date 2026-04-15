import { Request, Response, NextFunction } from "express";
import prisma from "../../../config/prisma";
import sendResponse, { createError } from "../../../utils/apiResponse";
import { buildProductDetail } from "../../product/services/product.service";

// Get current user's cart
export const getCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).authUser;
    const userId = user?.id;

    let cart = await prisma.cart.findFirst({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId, items: { create: [] } },
        include: { items: { include: { product: true } } },
      });
    }

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Cart fetched successfully",
      data: cart,
    });
  } catch (error) {
    return next(error);
  }
};

// Add item to cart or update quantity if it exists
export const addToCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).authUser;
    const userId = user?.id;
    const { productId, quantity, selectedColor, selectedSize } = req.body;

    if (!productId || !quantity) {
      return next(
        createError({
          statusCode: 400,
          success: false,
          message: "Product ID and quantity are required",
          data: null,
        })
      );
    }

    let cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    // Find if item already exists in cart with same color and size
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        selectedColor: selectedColor || null,
        selectedSize: selectedSize || null,
      },
    });

    const currentQtyInCart = existingItem ? existingItem.quantity : 0;
    const newTotalQty = currentQtyInCart + quantity;

    // Check Stock
    const variantWhere: any = { productId };
    if (selectedColor) variantWhere.color = selectedColor;
    if (selectedSize) variantWhere.size = selectedSize;

    let variant = await prisma.variant.findFirst({ where: variantWhere });
    if (!variant && selectedColor) {
      variant = await prisma.variant.findFirst({ where: { productId, color: selectedColor } });
    }
    if (!variant) {
      variant = await prisma.variant.findFirst({ where: { productId } });
    }

    if (variant) {
      const stock = await prisma.stock.findFirst({ where: { variantId: variant.id } });
      const availableStock = stock ? stock.quantity : 0;

      if (newTotalQty > availableStock) {
        return next(
          createError({
            statusCode: 400,
            success: false,
            message: "stock itna hi prahai abhi",
            data: null,
          })
        );
      }
    }

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
          selectedColor: selectedColor || null,
          selectedSize: selectedSize || null,
        },
      });
    }

    const updatedCart = await prisma.cart.findFirst({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Item added to cart",
      data: updatedCart,
    });
  } catch (error) {
    return next(error);
  }
};

// Update quantity of a specific item in the cart
export const updateQuantity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).authUser;
    const userId = user?.id;
    const itemId = req.body.itemId as string;
    const { quantity } = req.body;

    if (!itemId || quantity === undefined) {
      return next(
        createError({
          statusCode: 400,
          success: false,
          message: "Item ID and quantity are required",
          data: null,
        })
      );
    }

    const cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart) {
      return next(
        createError({
          statusCode: 404,
          success: false,
          message: "Cart not found",
          data: null,
        })
      );
    }

    const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) {
      return next(
        createError({
          statusCode: 404,
          success: false,
          message: "Item not found in cart",
          data: null,
        })
      );
    }

    if (quantity > 0) {
      const variantWhere: any = { productId: item.productId };
      if (item.selectedColor) variantWhere.color = item.selectedColor;
      if (item.selectedSize) variantWhere.size = item.selectedSize;

      let variant = await prisma.variant.findFirst({ where: variantWhere });
      if (!variant && item.selectedColor) {
        variant = await prisma.variant.findFirst({ where: { productId: item.productId, color: item.selectedColor } });
      }
      if (!variant) {
        variant = await prisma.variant.findFirst({ where: { productId: item.productId } });
      }

      if (variant) {
        const stock = await prisma.stock.findFirst({ where: { variantId: variant.id } });
        const availableStock = stock ? stock.quantity : 0;

        if (quantity > availableStock) {
          return next(
            createError({
              statusCode: 400,
              success: false,
              message: "Not enough stock available.",
              data: null,
            })
          );
        }
      }
    }

    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    }

    const updatedCart = await prisma.cart.findFirst({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Cart updated successfully",
      data: updatedCart,
    });
  } catch (error) {
    return next(error);
  }
};

// Remove an item from the cart
export const removeFromCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).authUser;
    const userId = user?.id;
    const itemId = req.params.itemId as string;

    const cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart) {
      return next(
        createError({
          statusCode: 404,
          success: false,
          message: "Cart not found",
          data: null,
        })
      );
    }

    await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });

    const updatedCart = await prisma.cart.findFirst({
      where: { id: cart.id },
      include: { items: { include: { product: true } } },
    });

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Item removed from cart",
      data: updatedCart,
    });
  } catch (error) {
    return next(error);
  }
};

// Clear the entire cart
export const clearCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).authUser;
    const userId = user?.id || "";

    const cart = await prisma.cart.findFirst({ where: { userId } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Cart cleared successfully",
      data: cart,
    });
  } catch (error) {
    return next(error);
  }
};
