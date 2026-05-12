import prisma from "../../../config/prisma";
import mailTransporter from "../../../config/mail";
import { createError } from "../../../utils/apiResponse";

// ── Vendor Registration (User applies to become a vendor) ──
export const registerVendorService = async (
  userId: string,
  body: {
    businessName: string;
    slug?: string;
    description?: string;
  }
) => {
  // Check if user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  // Check if user already has a vendor profile
  const existingVendor = await prisma.vendor.findUnique({
    where: { userId },
  });
  if (existingVendor) {
    throw createError({
      statusCode: 400,
      message: `Vendor application already exists (Status: ${existingVendor.status})`,
    });
  }

  // Generate slug from business name if not provided
  const slug =
    body.slug ||
    body.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
      "-" +
      Date.now().toString(36);

  // Check slug uniqueness
  const slugExists = await prisma.vendor.findUnique({ where: { slug } });
  if (slugExists) {
    throw createError({
      statusCode: 400,
      message: "This business slug is already taken",
    });
  }

  // Create vendor record with PENDING status
  const vendor = await prisma.vendor.create({
    data: {
      userId,
      businessName: body.businessName,
      slug,
      description: body.description || null,
      status: "PENDING",
    },
  });

  // Send email notification to admin
  try {
    const adminEmail = process.env.MAIL_USER || "admin@example.com";
    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM,
      to: adminEmail,
      subject: "🏪 New Vendor Application - LuxaCart",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #002147;">New Vendor Application</h2>
          <p>A new vendor application has been submitted:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Applicant</td><td style="padding: 8px; border: 1px solid #ddd;">${user.fullName}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email</td><td style="padding: 8px; border: 1px solid #ddd;">${user.email}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Business Name</td><td style="padding: 8px; border: 1px solid #ddd;">${body.businessName}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Slug</td><td style="padding: 8px; border: 1px solid #ddd;">${slug}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Description</td><td style="padding: 8px; border: 1px solid #ddd;">${body.description || "N/A"}</td></tr>
          </table>
          <p>Please review this application in the admin panel.</p>
        </div>
      `,
    });
  } catch (emailError) {
    console.error("Failed to send vendor application email:", emailError);
    // Don't throw — vendor record is already created
  }

  return {
    statusCode: 201,
    success: true,
    message: "Vendor application submitted successfully. Awaiting admin approval.",
    data: vendor,
  };
};

// ── Get Vendor Profile (for logged-in vendor) ──
export const getVendorProfileService = async (userId: string) => {
  const vendor = await prisma.vendor.findUnique({
    where: { userId },
    include: {
      user: {
        select: { fullName: true, email: true, avatar: true },
      },
    },
  });

  if (!vendor) {
    throw createError({ statusCode: 404, message: "Vendor profile not found" });
  }

  return {
    statusCode: 200,
    success: true,
    message: "Vendor profile fetched successfully",
    data: vendor,
  };
};

// ── Get Vendor Dashboard Stats ──
export const getVendorDashboardService = async (vendorId: string) => {
  const [totalProducts, totalEarnings, pendingPayouts] = await Promise.all([
    prisma.product.count({ where: { vendorId, isDeleted: false } }),
    prisma.vendorEarning.aggregate({
      where: { vendorId },
      _sum: { netAmount: true },
    }),
    prisma.payoutRequest.count({
      where: { vendorId, status: "PENDING" },
    }),
  ]);

  return {
    statusCode: 200,
    success: true,
    message: "Vendor dashboard stats fetched",
    data: {
      totalProducts,
      totalEarnings: totalEarnings._sum.netAmount || 0,
      pendingPayouts,
    },
  };
};

// ── Admin: Get All Vendor Applications ──
export const getAllVendorsService = async (status?: string) => {
  const where = status ? { status: status as any } : {};

  const vendors = await prisma.vendor.findMany({
    where,
    include: {
      user: {
        select: { fullName: true, email: true, avatar: true, phone: true },
      },
      _count: { select: { products: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    statusCode: 200,
    success: true,
    message: "Vendors fetched successfully",
    data: vendors,
  };
};

// ── Admin: Approve Vendor ──
export const approveVendorService = async (vendorId: string) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: { user: true },
  });

  if (!vendor) {
    throw createError({ statusCode: 404, message: "Vendor not found" });
  }

  if (vendor.status === "APPROVED") {
    throw createError({
      statusCode: 400,
      message: "Vendor is already approved",
    });
  }

  // Update vendor status + user role in a transaction
  const [updatedVendor] = await prisma.$transaction([
    prisma.vendor.update({
      where: { id: vendorId },
      data: { status: "APPROVED" },
    }),
    prisma.user.update({
      where: { id: vendor.userId },
      data: { role: "VENDOR" },
    }),
  ]);

  // Notify vendor via email
  try {
    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM,
      to: vendor.user.email,
      subject: "🎉 Your Vendor Application has been Approved! - LuxaCart",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #002147;">Congratulations, ${vendor.user.fullName}!</h2>
          <p>Your vendor application for <strong>${vendor.businessName}</strong> has been <span style="color: green; font-weight: bold;">APPROVED</span>.</p>
          <p>You can now log in to your vendor dashboard and start adding products.</p>
          <p style="margin-top: 20px;">
            <a href="${process.env.CLIENT_URL}/vendor/dashboard" style="background: #002147; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Go to Vendor Dashboard</a>
          </p>
        </div>
      `,
    });
  } catch (emailError) {
    console.error("Failed to send vendor approval email:", emailError);
  }

  return {
    statusCode: 200,
    success: true,
    message: "Vendor approved successfully",
    data: updatedVendor,
  };
};

// ── Admin: Suspend Vendor ──
export const suspendVendorService = async (vendorId: string) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) {
    throw createError({ statusCode: 404, message: "Vendor not found" });
  }

  const updatedVendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: { status: "SUSPENDED" },
  });

  return {
    statusCode: 200,
    success: true,
    message: "Vendor suspended successfully",
    data: updatedVendor,
  };
};

// ── Admin: Reject Vendor (delete the application) ──
export const rejectVendorService = async (vendorId: string) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) {
    throw createError({ statusCode: 404, message: "Vendor not found" });
  }

  await prisma.vendor.delete({ where: { id: vendorId } });

  // Notify vendor
  try {
    const user = await prisma.user.findUnique({
      where: { id: vendor.userId },
    });
    if (user) {
      await mailTransporter.sendMail({
        from: process.env.MAIL_FROM,
        to: user.email,
        subject: "Vendor Application Update - LuxaCart",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #002147;">Hello, ${user.fullName}</h2>
            <p>Unfortunately, your vendor application for <strong>${vendor.businessName}</strong> has been rejected.</p>
            <p>If you believe this is an error, please contact our support team.</p>
          </div>
        `,
      });
    }
  } catch (emailError) {
    console.error("Failed to send vendor rejection email:", emailError);
  }

  return {
    statusCode: 200,
    success: true,
    message: "Vendor application rejected",
    data: null,
  };
};

// ── Admin: Get Vendor Detail ──
export const getVendorDetailService = async (vendorId: string) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      user: {
        select: { fullName: true, email: true, avatar: true, phone: true },
      },
      products: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" }
      },
      earnings: {
        orderBy: { createdAt: "desc" },
        take: 20
      },
      payoutRequests: {
        orderBy: { requestedAt: "desc" },
        take: 20
      }
    },
  });

  if (!vendor) {
    throw createError({ statusCode: 404, message: "Vendor not found" });
  }

  return {
    statusCode: 200,
    success: true,
    message: "Vendor detail fetched successfully",
    data: vendor,
  };
};

// ── Admin: Update Commission Rate ──
export const updateVendorCommissionService = async (vendorId: string, commissionRate: number) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw createError({ statusCode: 404, message: "Vendor not found" });

  const updatedVendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: { commissionRate: commissionRate }
  });

  return {
    statusCode: 200,
    success: true,
    message: "Commission rate updated successfully",
    data: updatedVendor,
  };
};

// ── Admin: Get Platform Analytics ──
export const getPlatformAnalyticsService = async () => {
  const [totalGMV, totalCommission, vendorStats] = await Promise.all([
    prisma.order.aggregate({
      where: { paymentStatus: "paid" },
      _sum: { total: true }
    }),
    prisma.vendorEarning.aggregate({
      _sum: { commissionAmount: true }
    }),
    prisma.vendor.findMany({
      include: {
        user: { select: { fullName: true } },
        _count: { select: { products: true } },
        earnings: {
          select: { grossAmount: true, commissionAmount: true, netAmount: true }
        }
      }
    })
  ]);

  const performanceTable = vendorStats.map(v => {
    const totalGross = v.earnings.reduce((sum, e) => sum + e.grossAmount, 0);
    const totalNet = v.earnings.reduce((sum, e) => sum + e.netAmount, 0);
    return {
      id: v.id,
      name: v.businessName,
      owner: v.user.fullName,
      products: v._count.products,
      grossRevenue: totalGross,
      netEarnings: totalNet,
      commissionPaid: totalGross - totalNet
    };
  });

  return {
    statusCode: 200,
    success: true,
    message: "Platform analytics fetched",
    data: {
      totalGMV: totalGMV._sum.total || 0,
      totalCommission: totalCommission._sum.commissionAmount || 0,
      vendorPerformance: performanceTable,
      topVendors: performanceTable.sort((a, b) => b.grossRevenue - a.grossRevenue).slice(0, 5)
    }
  };
};

// ── Vendor: Get Orders for Vendor ──
export const getVendorOrdersService = async (userId: string) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) throw createError({ statusCode: 404, message: "Vendor profile not found" });

  const orders = await prisma.order.findMany({
    where: {
      items: {
        some: {
          product: { vendorId: vendor.id }
        }
      }
    },
    include: {
      user: { select: { fullName: true, email: true } },
      items: {
        where: {
          product: { vendorId: vendor.id }
        },
        include: { product: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return {
    statusCode: 200,
    success: true,
    message: "Vendor orders fetched successfully",
    data: orders,
  };
};

// ── Vendor: Update Vendor Profile ──
export const updateVendorProfileService = async (userId: string, updateData: any) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) throw createError({ statusCode: 404, message: "Vendor profile not found" });

  const { businessName, description, logo, address, bankDetails, phone } = updateData;

  const updatedVendor = await prisma.vendor.update({
    where: { id: vendor.id },
    data: {
      businessName: businessName !== undefined ? businessName : undefined,
      description: description !== undefined ? description : undefined,
      logo: logo !== undefined ? logo : undefined,
      bankDetails: bankDetails !== undefined ? bankDetails : undefined,
    }
  });

  if (phone !== undefined) {
    await prisma.user.update({
      where: { id: userId },
      data: { phone }
    });
  }

  return {
    statusCode: 200,
    success: true,
    message: "Profile updated successfully",
    data: updatedVendor,
  };
};

// ── Vendor: Get Specific Order Detail ──
export const getVendorOrderDetailService = async (userId: string, orderId: string) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) throw createError({ statusCode: 404, message: "Vendor profile not found" });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { fullName: true, email: true, phone: true } },
      addresses: true,
      items: {
        where: {
          product: { vendorId: vendor.id }
        },
        include: { product: true }
      }
    }
  });

  if (!order || order.items.length === 0) {
    throw createError({ statusCode: 404, message: "Order not found or access denied" });
  }

  return {
    statusCode: 200,
    success: true,
    message: "Order detail fetched successfully",
    data: order,
  };
};
