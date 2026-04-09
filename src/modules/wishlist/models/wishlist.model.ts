import { Schema, model, Model, Types } from "mongoose";

export interface IWishlistItem {
  productId: Types.ObjectId;
  addedAt: Date;
}

export interface IWishlist {
  userId: Types.ObjectId;
  products: IWishlistItem[];
}

type WishlistModel = Model<IWishlist>;

const wishlistSchema = new Schema<IWishlist, WishlistModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    products: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Wishlist = model<IWishlist, WishlistModel>("Wishlist", wishlistSchema);
export default Wishlist;
