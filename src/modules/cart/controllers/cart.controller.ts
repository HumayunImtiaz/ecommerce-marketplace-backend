import { Request, Response, NextFunction } from "express";
import Cart from "../models/cart.model";
import sendResponse, { createError } from "../../../utils/apiResponse";


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
