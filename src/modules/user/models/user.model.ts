import bcrypt from "bcryptjs";
import { HydratedDocument, Model, Schema, model } from "mongoose";

export interface IAddress {
  _id?: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

export interface IUser {
  fullName: string;
  email: string;
  password?: string;
  avatar: string | null;
  bio: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  addresses: IAddress[];
  role: "user" | "admin";
  isVerified: boolean;
  isDeleted: boolean;
  deletionRequested: boolean;
  deletedAt: Date | null;
  deletedBy: string | null;
  provider: "local" | "google" | "facebook";
  providerId: string | null;
  lastLogin: Date | null;
  stripeCustomerId: string | null;
  resetPasswordToken: string | null;
  resetPasswordExpires: Date | null;
  emailVerificationToken: string | null;
  emailVerificationExpires: Date | null;
  emailPreferences: {
    orderUpdates: boolean;
    promotionalEmails: boolean;
    productRecommendations: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

type UserModel = Model<IUser, {}, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    dateOfBirth: {
      type: String,
      default: null,
    },
    addresses: [
      {
        name: { type: String, required: true },
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        country: { type: String, required: true },
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        isDefault: { type: Boolean, default: false },
      },
    ],
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletionRequested: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: String,
      default: null,
    },
    provider: {
      type: String,
      enum: ["local", "google", "facebook"],
      default: "local",
    },
    providerId: {
      type: String,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    emailVerificationToken: {
      type: String,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    emailPreferences: {
      orderUpdates: { type: Boolean, default: true },
      promotionalEmails: { type: Boolean, default: true },
      productRecommendations: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.pre("save", async function () {
  const user = this as HydratedDocument<IUser>;
  if (!user.password || !user.isModified("password")) return;
  user.password = await bcrypt.hash(user.password, 10);
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

const User = model<IUser, UserModel>("User", userSchema);
export default User;