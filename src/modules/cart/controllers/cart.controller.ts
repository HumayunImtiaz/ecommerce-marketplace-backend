import { Request, Response, NextFunction } from "express";
import Cart from "../models/cart.model";
import sendResponse, { createError } from "../../../utils/apiResponse";
import Product from "../../product/models/product.model";
import Variant from "../../product/models/variant.model";
import Stock from "../../product/models/stock.model";


 //Get current user's cart

export const getCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).authUser;
    let cart = await Cart.findOne({ userId: user._id }).populate("items.productId");

    if (!cart) {
      cart = await Cart.create({ userId: user._id, items: [] });
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


//  Add item to cart or update quantity if it exists
 
export const addToCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).authUser;
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

    let cart = await Cart.findOne({ userId: user._id });

    if (!cart) {
      cart = await Cart.create({ userId: user._id, items: [] });
    }

    // Find if item already exists in cart with same color and size
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        item.selectedColor === selectedColor &&
        item.selectedSize === selectedSize
    );

    const currentQtyInCart = existingItemIndex > -1 ? cart.items[existingItemIndex].quantity : 0;
    const newTotalQty = currentQtyInCart + quantity;

    // Check Stock
    let variantQuery: any = { productId };
    if (selectedColor) variantQuery.color = selectedColor;
    if (selectedSize) variantQuery.size = selectedSize;

    let variant = await Variant.findOne(variantQuery);
    if (!variant && selectedColor) {
      variant = await Variant.findOne({ productId, color: selectedColor });
    }
    if (!variant) {
      variant = await Variant.findOne({ productId });
    }

    if (variant) {
      const stock = await Stock.findOne({ variantId: variant._id });
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

    if (existingItemIndex > -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({
        productId,
        quantity,
        selectedColor,
        selectedSize,
      } as any);
    }

    await cart.save();

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Item added to cart",
      data: cart,
    });
  } catch (error) {
    return next(error);
  }
};


 // Update quantity of a specific item in the cart
 
export const updateQuantity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).authUser;
    const { itemId, quantity } = req.body;

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

    const cart = await Cart.findOne({ userId: user._id });

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

    const itemIndex = cart.items.findIndex((item: any) => item._id.toString() === itemId);

    if (itemIndex === -1) {
      return next(
        createError({
          statusCode: 404,
          success: false,
          message: "Item not found in cart",
          data: null,
        })
      );
    }

    const item = cart.items[itemIndex] as any;

    if (quantity > 0) {
      let variantQuery: any = { productId: item.productId };
      if (item.selectedColor) variantQuery.color = item.selectedColor;
      if (item.selectedSize) variantQuery.size = item.selectedSize;

      let variant = await Variant.findOne(variantQuery);
      if (!variant && item.selectedColor) {
        variant = await Variant.findOne({ productId: item.productId, color: item.selectedColor });
      }
      if (!variant) {
        variant = await Variant.findOne({ productId: item.productId });
      }

      if (variant) {
        const stock = await Stock.findOne({ variantId: variant._id });
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
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Cart updated successfully",
      data: cart,
    });
  } catch (error) {
    return next(error);
  }
};


//  Remove an item from the cart
 
export const removeFromCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).authUser;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ userId: user._id });

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

    cart.items = cart.items.filter((item: any) => item._id.toString() !== itemId);

    await cart.save();

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Item removed from cart",
      data: cart,
    });
  } catch (error) {
    return next(error);
  }
};

//  Clear the entire cart
 
export const clearCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).authUser;

    const cart = await Cart.findOne({ userId: user._id });

    if (cart) {
      cart.items = [];
      await cart.save();
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
