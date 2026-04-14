import { Schema, model, Document } from "mongoose";

export interface ISiteSettings extends Document {
  storeName: string;
  footerText: string;
  logo: string;
  hero: {
    title: string;
    subtitle: string;
    image: string;
    buttonText: string;
    buttonLink: string;
  };
  contact: {
    email: string;
    phone: string;
    address: string;
    workingHours: string;
    latitude?: number;
    longitude?: number;
  };
  about: {
    title: string;
    content: string;
    image: string;
    stats: { label: string; value: string; icon: string }[];
    values: { title: string; description: string; icon: string }[];
    team: { name: string; role: string; bio: string; image: string }[];
    milestones: { year: string; title: string; description: string }[];
    sustainability: { title: string; description: string; image: string; bullets: string[] };
    mission: { title: string; content: string[]; image: string };
  };
  adminEmail: string;
  socialLinks: {
    facebook: string;
    instagram: string;
    twitter: string;
  };
  footer: {
    quickLinks: { label: string; url: string }[];
    categoryLinks: { label: string; url: string }[];
  };
  notifications: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    pushNotifications: boolean;
    orderNotifications: boolean;
    customerNotifications: boolean;
    inventoryNotifications: boolean;
    marketingNotifications: boolean;
    frequency: string;
    notificationEmail: string;
    notificationPhone: string;
  };
}

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    storeName: { type: String, default: "LuxeCart" },
    footerText: { type: String, default: "© 2024 LuxeCart. All rights reserved." },
    logo: { type: String, default: "/logo.png" },
    hero: {
      title: { type: String, default: "Discover Amazing Products" },
      subtitle: { type: String, default: "Shop the latest trends and get up to 50% off." },
      image: { type: String, default: "/hero.jpg" },
      buttonText: { type: String, default: "Shop Now" },
      buttonLink: { type: String, default: "/products" },
    },
    contact: {
      email: { type: String, default: "support@example.com" },
      phone: { type: String, default: "+1 234 567 890" },
      address: { type: String, default: "123 Business St, New York, NY" },
      workingHours: { type: String, default: "Mon-Fri: 9AM - 6PM" },
      latitude: { type: Number, default: 40.7128 },
      longitude: { type: Number, default: -74.0060 },
    },
    about: {
      title: { type: String, default: "Our Story" },
      content: { type: String, default: "Learn more about our mission and vision." },
      image: { type: String, default: "/about.jpg" },
      stats: [
        {
          label: { type: String, required: true },
          value: { type: String, required: true },
          icon: { type: String, default: "Users" },
        }
      ],
      values: [
        {
          title: { type: String, required: true },
          description: { type: String, required: true },
          icon: { type: String, default: "Shield" },
        }
      ],
      team: [
        {
          name: { type: String, required: true },
          role: { type: String, required: true },
          bio: { type: String, required: true },
          image: { type: String, default: "/placeholder.svg" },
        }
      ],
      milestones: [
        {
          year: { type: String, required: true },
          title: { type: String, required: true },
          description: { type: String, required: true },
        }
      ],
      sustainability: {
        title: { type: String, default: "Committed to Sustainability" },
        description: { type: String, default: "We believe in doing business responsibly." },
        image: { type: String, default: "/placeholder.svg" },
        bullets: [{ type: String }],
      },
      mission: {
        title: { type: String, default: "Our Mission" },
        content: [{ type: String, default: "At LuxeCart, our mission is to democratize access to quality products." }],
        image: { type: String, default: "/placeholder.svg" },
      }
    },
    adminEmail: { type: String, default: "admin@example.com" },
    socialLinks: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
    },
    footer: {
      quickLinks: [
        {
          label: { type: String, required: true },
          url: { type: String, required: true },
        }
      ],
      categoryLinks: [
        {
          label: { type: String, required: true },
          url: { type: String, required: true },
        }
      ],
    },
    notifications: {
      emailNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: false },
      pushNotifications: { type: Boolean, default: true },
      orderNotifications: { type: Boolean, default: true },
      customerNotifications: { type: Boolean, default: true },
      inventoryNotifications: { type: Boolean, default: true },
      marketingNotifications: { type: Boolean, default: false },
      frequency: { type: String, default: "immediate" },
      notificationEmail: { type: String, default: "" },
      notificationPhone: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

const SiteSettings = model<ISiteSettings>("SiteSettings", siteSettingsSchema);
export default SiteSettings;
