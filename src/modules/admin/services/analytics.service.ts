import prisma from "../../../config/prisma";

const getAnalyticsStatsService = async (dateRange: string = "30d", startDate?: string, endDate?: string) => {
  try {
    const now = new Date();
    let start: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      now.setTime(new Date(endDate).getTime());
      now.setHours(23, 59, 59, 999);
    } else {
      switch (dateRange) {
        case "7d":
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "1y":
          start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        case "30d":
        default:
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    const startQuery = start;
    const endQuery = now;

    // ─── Daily Trends ──────────────────────────────────────────────────────────
    const ordersForTrends = await prisma.order.findMany({
      where: {
        createdAt: { gte: startQuery, lte: endQuery },
        paymentStatus: "paid",
      },
      select: {
        total: true,
        createdAt: true,
      },
    });

    const trendsMap = new Map<string, { revenue: number, orders: number, dateRaw: Date }>();
    ordersForTrends.forEach(order => {
      const dateStr = order.createdAt.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      const current = trendsMap.get(dateStr) || { revenue: 0, orders: 0, dateRaw: order.createdAt };
      current.revenue += order.total;
      current.orders += 1;
      trendsMap.set(dateStr, current);
    });

    const dailyTrends = Array.from(trendsMap.entries())
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        orders: data.orders,
        visitors: 0,
        dateRaw: data.dateRaw
      }))
      .sort((a, b) => a.dateRaw.getTime() - b.dateRaw.getTime())
      .map(({ dateRaw, ...rest }) => rest);


    // ─── Revenue Metrics ───────────────────────────────────────────────────────
    const allOrdersInRange = await prisma.order.findMany({
      where: {
        createdAt: { gte: startQuery, lte: endQuery },
      },
      select: {
        total: true,
        paymentStatus: true,
        orderStatus: true,
      },
    });

    let totalRevenue = 0;
    let orderCount = allOrdersInRange.length;
    let paidOrderCount = 0;
    let cancelledCount = 0;

    allOrdersInRange.forEach(order => {
      if (order.paymentStatus === "paid") {
        totalRevenue += order.total;
        paidOrderCount++;
      }
      if (order.orderStatus === "cancelled") {
        cancelledCount++;
      }
    });

    const avgOrderValue = paidOrderCount > 0 ? totalRevenue / paidOrderCount : 0;
    const paymentSuccessRate = orderCount > 0 ? (paidOrderCount / orderCount) * 100 : 0;
    const refundRate = orderCount > 0 ? (cancelledCount / orderCount) * 100 : 0;

    const revenueMetrics = [
      {
        title: "Total Revenue",
        value: `$${totalRevenue.toLocaleString()}`,
        change: "+0%",
        trend: "up",
        progress: 100,
      },
      {
        title: "Average Order Value",
        value: `$${avgOrderValue.toFixed(2)}`,
        change: "+0%",
        trend: "neutral",
        progress: 100,
      },
      {
        title: "Payment Success Rate",
        value: `${paymentSuccessRate.toFixed(1)}%`,
        change: "+0%",
        trend: "up",
        progress: Math.round(paymentSuccessRate),
      },
      {
        title: "Refund Rate",
        value: `${refundRate.toFixed(1)}%`,
        change: "+0%",
        trend: "down",
        progress: Math.round(refundRate),
      },
    ];


    // ─── Customer Segments ─────────────────────────────────────────────────────
    const userOrdersInRange = await prisma.order.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: startQuery, lte: endQuery } },
      _count: { userId: true },
      _sum: { total: true },
    });

    const segments = {
      New: { count: 0, value: 0, fill: "#10b981" },
      Returning: { count: 0, value: 0, fill: "#3b82f6" },
      VIP: { count: 0, value: 0, fill: "#8b5cf6" },
    };

    userOrdersInRange.forEach(cust => {
      const orderCount = cust._count.userId;
      const totalValue = cust._sum.total || 0;
      if (orderCount >= 5) {
        segments.VIP.count++;
        segments.VIP.value += totalValue;
      } else if (orderCount > 1) {
        segments.Returning.count++;
        segments.Returning.value += totalValue;
      } else {
        segments.New.count++;
        segments.New.value += totalValue;
      }
    });

    const customerSegmentData = Object.keys(segments).map(key => ({
      segment: key,
      ...(segments as any)[key]
    }));


    // ─── Acquisition Data (Mocked as in original) ──────────────────────────────
    const acquisitionData = [
      { channel: "Organic", customers: Math.floor(orderCount * 0.4) },
      { channel: "Social Media", customers: Math.floor(orderCount * 0.25) },
      { channel: "Email", customers: Math.floor(orderCount * 0.15) },
      { channel: "Paid Ads", customers: Math.floor(orderCount * 0.1) },
      { channel: "Referral", customers: Math.floor(orderCount * 0.1) },
    ];


    // ─── Top Products ──────────────────────────────────────────────────────────
    const orderItemsInRange = await prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: startQuery, lte: endQuery },
          paymentStatus: "paid",
        }
      },
      select: {
        productId: true,
        name: true,
        quantity: true,
        price: true,
      }
    });

    const productStatsMap = new Map<string, { name: string, sales: number, revenue: number }>();
    orderItemsInRange.forEach(item => {
      const current = productStatsMap.get(item.productId) || { name: item.name, sales: 0, revenue: 0 };
      current.sales += item.quantity;
      current.revenue += item.price * item.quantity;
      productStatsMap.set(item.productId, current);
    });

    const topProducts = Array.from(productStatsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        sales: p.sales,
        revenue: p.revenue,
        growth: 0
      }));


    // ─── Category Performance ──────────────────────────────────────────────────
    const categoryStatsInRange = await prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: startQuery, lte: endQuery },
          paymentStatus: "paid",
        }
      },
      select: {
        quantity: true,
        product: {
          select: {
            category: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    const categoryMap = new Map<string, number>();
    categoryStatsInRange.forEach(item => {
      const catName = item.product?.category?.name || "Uncategorized";
      categoryMap.set(catName, (categoryMap.get(catName) || 0) + item.quantity);
    });

    const categoryPerformance = Array.from(categoryMap.entries()).map(([category, sales]) => ({
      category,
      sales,
      target: 100,
      performance: 80
    }));

    return {
      statusCode: 200,
      success: true,
      message: "Analytics data fetched successfully",
      data: {
        dailyTrends,
        revenueMetrics,
        customerSegmentData,
        acquisitionData,
        topProducts,
        categoryPerformance
      }
    };

  } catch (error: any) {
    console.error("Analytics Service Error:", error);
    return { statusCode: 500, success: false, message: error.message || "Internal server error", data: null };
  }
};

export { getAnalyticsStatsService };
