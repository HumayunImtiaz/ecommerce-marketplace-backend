import multer from "multer";
import fs from "fs";
import { Request } from "express";

type UploadedFile = {
  originalname: string;
};

export const storageData = (name: string) => {
  const storage = multer.diskStorage({
    destination: (
      req: Request,
      file: UploadedFile,
      cb: (error: Error | null, destination: string) => void
    ) => {
      const uploadPath = `public/${name}`;

      try {
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
      } catch (err) {
        cb(err as Error, "");
      }
    },

    filename: (
      req: Request,
      file: UploadedFile,
      cb: (error: Error | null, filename: string) => void
    ) => {
      const safeName =
        typeof file.originalname === "string"
          ? file.originalname.replace(/[^\w.]/g, "_")
          : "file";

      cb(null, `${Date.now()}-${safeName}`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: 50 * 1024 * 1024,
    },
  });
};