import { Schema, model, Model, Types } from "mongoose";

export interface IStock {
  variantId: Types.ObjectId;
  quantity: number;
  lowStockThreshold: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
  createdAt: Date;
  updatedAt: Date;
}

type StockModel = Model<IStock>;

const stockSchema = new Schema<IStock, StockModel>(
  {
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
      unique: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
    status: {
      type: String,
      enum: ["in_stock", "low_stock", "out_of_stock"],
      default: "out_of_stock",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

stockSchema.pre("save", function () {
  if (this.quantity <= 0) {
    this.status = "out_of_stock";
  } else if (this.quantity <= this.lowStockThreshold) {
    this.status = "low_stock";
  } else {
    this.status = "in_stock";
  }
});

const Stock = model<IStock, StockModel>("Stock", stockSchema);
export default Stock;