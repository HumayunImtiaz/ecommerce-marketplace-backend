import prisma from "../../../config/prisma";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Calculates and saves earnings for each vendor in an order
 * Called when order status becomes DELIVERED
 */
export const calculateAndSaveEarning = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: { vendor: true }
          }
        }
      }
    }
  });

  if (!order) throw new Error("Order not found");

  // Group items by vendor
  const vendorItems = new Map<string, any[]>();
  order.items.forEach((item: any) => {
    const vendorId = item.product?.vendorId;
    if (vendorId) {
      if (!vendorItems.has(vendorId)) vendorItems.set(vendorId, []);
      vendorItems.get(vendorId)?.push(item);
    }
  });

  // Calculate and save per vendor
  for (const [vendorId, items] of vendorItems.entries()) {
    const vendor = items[0].product.vendor;
    const grossAmount = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    
    // Commission calculation (default 10% if not set)
    const commissionRate = vendor?.commissionRate || 10;
    const commissionAmount = (grossAmount * Number(commissionRate)) / 100;
    const netAmount = grossAmount - commissionAmount;

    await prisma.vendorEarning.create({
      data: {
        vendorId,
        orderId,
        grossAmount: grossAmount,
        commissionAmount: commissionAmount,
        netAmount: netAmount,
        status: "PENDING"
      }
    });
  }
};

/**
 * Vendor requests a payout of their available balance
 */
export const requestPayout = async (vendorId: string, amount: number) => {
  // 1. Calculate available balance
  const totalEarnings = await prisma.vendorEarning.aggregate({
    where: { vendorId },
    _sum: { netAmount: true }
  });

  const totalPaidOut = await prisma.payoutRequest.aggregate({
    where: { vendorId, status: { in: ["PAID", "PENDING"] } },
    _sum: { amount: true }
  });

  const available = Number(totalEarnings._sum.netAmount || 0) - Number(totalPaidOut._sum.amount || 0);

  if (amount > available) {
    throw new Error("Insufficient balance for payout");
  }

  return await prisma.payoutRequest.create({
    data: {
      vendorId,
      amount: amount,
      status: "PENDING"
    }
  });
};
