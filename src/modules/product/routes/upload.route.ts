import { Router, Request, Response, NextFunction } from "express";
import { authenticateAdmin } from "../../../middlewares/auth.middleware";
import { storageData } from "../../../utils/multer";

const router = Router();
const upload = storageData("uploads/products");

router.post(
  "/images",
  authenticateAdmin,
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
  (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No images provided",
        data: null,
      });
    }

    const urls = files.map(
      (file) =>
        `/uploads/products/${file.filename}`
    );

    return res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: urls,
    });
  }
);

export default router;