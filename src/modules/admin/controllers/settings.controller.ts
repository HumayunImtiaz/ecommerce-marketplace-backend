import { Request, Response } from "express";
import SiteSettings from "../models/site-settings.model";

export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) {
      // Create default settings if they don't exist
      settings = await SiteSettings.create({});
    }
    return res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const updatedSettings = await SiteSettings.findOneAndUpdate({}, req.body, {
      new: true,
      upsert: true,
      runValidators: true,
    });
    return res.status(200).json({ success: true, data: updatedSettings });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
