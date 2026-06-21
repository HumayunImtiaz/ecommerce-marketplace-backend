import { Router, Request, Response, NextFunction } from "express";
import { authenticateStaff } from "../../../middlewares/auth.middleware";
import { storageData } from "../../../utils/multer";
import { uploadToCloudinary } from "../../../utils/cloudinary";

const router = Router();
const upload = storageData("products");

router.post(
  "/images",
  authenticateStaff,
  (req: Request, res: Response, next: NextFunction) => {
    upload.array("images", 10)(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || "Image upload failed",
          data: null,
        });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No images provided",
          data: null,
        });
      }

      const uploadPromises = files.map((file) =>
        uploadToCloudinary(file.buffer, "luxacart/products")
      );

      const uploadResults = await Promise.all(uploadPromises);
      const urls = uploadResults.map((result) => result.secure_url);

      return res.status(200).json({
        success: true,
        message: "Images uploaded successfully",
        data: urls,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Cloudinary upload failed",
        data: null,
      });
    }
  }
);

export default router;