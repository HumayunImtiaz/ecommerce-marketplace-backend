import multer from "multer";
import fs from "fs";
import { Request } from "express";

export const storageData = (name: string) => {
  const storage = multer.diskStorage({
    destination: (
      req: Request,
      file: Express.Multer.File,
      cb: CallableFunction
    ) => {
      const path = `public/${name}`;
      try {
        fs.mkdirSync(path, { recursive: true });
        cb(null, path);
      } catch (err: any) {
        cb(err.message, null);
      }
    },
    filename: (
      req: Request,
      file: Express.Multer.File,
      cb: CallableFunction
    ) => {
      const fileName =
        typeof file.originalname === "string"
          ? file.originalname.replace(/[^\w.]/g, "_")
          : file.originalname;

      cb(null, Date.now() + "-" + fileName);
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 50 * 1024 * 1024,
    },
  });

  return upload;
};