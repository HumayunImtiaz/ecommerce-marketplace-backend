import multer from "multer";
import fs from "fs";
import { Request } from "express";

export const storageData = (name: string) => {
  const storage = multer.memoryStorage();

  const upload = multer({
    storage,
    limits: {
      fileSize: 50 * 1024 * 1024,
    },
  });

  return upload;
};