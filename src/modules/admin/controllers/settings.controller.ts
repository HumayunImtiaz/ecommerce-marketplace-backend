import { Request, Response } from "express";
import prisma from "../../../config/prisma";

const DEFAULT_SETTINGS = {
  logo: "/logo.png",
  footerText: "© 2024 LuxeCart. All rights reserved.",
  hero: {
    title: "Discover Amazing Products",
    subtitle: "Shop the latest trends and get up to 50% off.",
    image: "/hero.jpg",
    buttonText: "Shop Now",
    buttonLink: "/products",
  },
  contact: {
    email: "support@luxecart.com",
    phone: "+1 234 567 890",
    address: "123 Business St, New York, NY",
    workingHours: "09:00 - 18:00",
    latitude: 40.7128,
    longitude: -74.0060,
  },
  about: {
    title: "Our Story",
    content: "We provide the best curated selection of luxury products from around the world.",
    image: "/about.jpg",
    stats: [],
    values: [],
    team: [],
    milestones: [],
    mission: { title: "Our Mission", content: [], image: "" },
    sustainability: { title: "Sustainability", description: "", image: "", bullets: [] },
  },
  footer: {
    quickLinks: [],
    categoryLinks: [],
  },
  socialLinks: {
    facebook: "https://facebook.com/luxecart",
    instagram: "https://instagram.com/luxecart",
    twitter: "https://twitter.com/luxecart",
  },
  notifications: {
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    orderNotifications: true,
    customerNotifications: true,
    inventoryNotifications: true,
    marketingNotifications: false,
  }
};

export const getSettings = async (req: Request, res: Response) => {
  try {
    let siteSettings = await prisma.siteSettings.findFirst();
    if (!siteSettings) {
      siteSettings = await prisma.siteSettings.create({
        data: {
          storeName: "LuxeCart",
          adminEmail: "admin@example.com",
          settings: DEFAULT_SETTINGS
        }
      });
    }

    // Flatten the response and merge with defaults to ensure all sections exist
    const settingsData = {
      ...DEFAULT_SETTINGS,
      ...(siteSettings.settings as object),
    };

    const flattened = {
      ...settingsData,
      id: siteSettings.id,
      storeName: siteSettings.storeName,
      adminEmail: siteSettings.adminEmail,
      createdAt: siteSettings.createdAt,
      updatedAt: siteSettings.updatedAt,
    };

    return res.status(200).json({ success: true, data: flattened });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { storeName, adminEmail, id, createdAt, updatedAt, ...rest } = req.body;
    
    const existing = await prisma.siteSettings.findFirst();
    
    let updated;
    if (existing) {
      // Merge new updates with existing JSON settings to preserve other sections
      const mergedSettings = {
        ...(existing.settings as object),
        ...rest
      };

      updated = await prisma.siteSettings.update({
        where: { id: existing.id },
        data: {
          storeName: storeName !== undefined ? storeName : existing.storeName,
          adminEmail: adminEmail !== undefined ? adminEmail : existing.adminEmail,
          settings: mergedSettings,
        },
      });
    } else {
      updated = await prisma.siteSettings.create({
        data: {
          storeName: storeName || "LuxeCart",
          adminEmail: adminEmail || "admin@example.com",
          settings: rest,
        },
      });
    }
    
    // Return flattened
    const flattened = {
      ...(updated.settings as object),
      id: updated.id,
      storeName: updated.storeName,
      adminEmail: updated.adminEmail,
    };

    return res.status(200).json({ success: true, data: flattened });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
