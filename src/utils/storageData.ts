import multer from "multer";
import fs from "fs";
import { Request } from "express";

type UploadedFile = {
  originalname: string;
};

export const storageData = (name: string) => {
  const storage = multer.memoryStorage();

  return multer({
    storage,
    limits: {
      fileSize: 50 * 1024 * 1024,
    },
  });
};