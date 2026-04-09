import { Schema, model, Model, Types } from "mongoose";

export interface IVariant {
  productId: Types.ObjectId;
  size: string;
  color: string;
  price: number | null;
  createdAt: Date;
  updatedAt: Date;
}

type VariantModel = Model<IVariant>;

const variantSchema = new Schema<IVariant, VariantModel>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    size: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

variantSchema.index({ productId: 1, size: 1, color: 1 }, { unique: true });

const Variant = model<IVariant, VariantModel>("Variant", variantSchema);
export default Variant;