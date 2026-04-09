import { Schema, model, Model } from "mongoose";

export interface ICategory {
  name: string;
  slug: string;
  description: string | null;
  image: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type CategoryModel = Model<ICategory>;

const categorySchema = new Schema<ICategory, CategoryModel>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    image: {
      type: String,
      default: "/placeholder.svg",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Category = model<ICategory, CategoryModel>("Category", categorySchema);
export default Category;