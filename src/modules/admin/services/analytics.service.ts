import Order from "../../order/models/order.model";
import User from "../../user/models/user.model";
import Product from "../../product/models/product.model";
import Category from "../../product/models/category.model";

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



    const dailyTrends = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startQuery, $lte: endQuery },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%b %d", date: "$createdAt" } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
          dateRaw: { $first: "$createdAt" }
        },
      },
      { $sort: { dateRaw: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          revenue: 1,
          orders: 1,
          visitors: { $literal: 0 }
        }
      }
    ]);


    const revenueAgg = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startQuery, $lte: endQuery },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0] } },
          orderCount: { $sum: 1 },
          paidOrderCount: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
          cancelledCount: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] } },
        },
      },
    ]);

    const revData = revenueAgg[0] || { totalRevenue: 0, orderCount: 0, paidOrderCount: 0, cancelledCount: 0 };
    const avgOrderValue = revData.paidOrderCount > 0 ? revData.totalRevenue / revData.paidOrderCount : 0;
    const paymentSuccessRate = revData.orderCount > 0 ? (revData.paidOrderCount / revData.orderCount) * 100 : 0;
    const refundRate = revData.orderCount > 0 ? (revData.cancelledCount / revData.orderCount) * 100 : 0;

    const revenueMetrics = [
      {
        title: "Total Revenue",
        value: `$${revData.totalRevenue.toLocaleString()}`,
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


    const customerOrders = await Order.aggregate([
      { $match: { createdAt: { $gte: startQuery, $lte: endQuery } } },
      {
        $group: {
          _id: "$userId",
          orderCount: { $sum: 1 },
          totalValue: { $sum: "$total" },
        },
      },
    ]);

    const segments = {
      New: { count: 0, value: 0, fill: "#10b981" },
      Returning: { count: 0, value: 0, fill: "#3b82f6" },
      VIP: { count: 0, value: 0, fill: "#8b5cf6" },
    };

    customerOrders.forEach(cust => {
      if (cust.orderCount >= 5) {
        segments.VIP.count++;
        segments.VIP.value += cust.totalValue;
      } else if (cust.orderCount > 1) {
        segments.Returning.count++;
        segments.Returning.value += cust.totalValue;
      } else {
        segments.New.count++;
        segments.New.value += cust.totalValue;
      }
    });

    const customerSegmentData = Object.keys(segments).map(key => ({
      segment: key,
      ...(segments as any)[key]
    }));


    const acquisitionData = [
      { channel: "Organic", customers: Math.floor(revData.orderCount * 0.4) },
      { channel: "Social Media", customers: Math.floor(revData.orderCount * 0.25) },
      { channel: "Email", customers: Math.floor(revData.orderCount * 0.15) },
      { channel: "Paid Ads", customers: Math.floor(revData.orderCount * 0.1) },
      { channel: "Referral", customers: Math.floor(revData.orderCount * 0.1) },
    ];


    const topProductsRaw = await Order.aggregate([
      { $match: { createdAt: { $gte: startQuery, $lte: endQuery }, paymentStatus: "paid" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          sales: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $project: {
          _id: 0,
          name: "$productInfo.name",
          sales: 1,
          revenue: 1,
          growth: { $literal: 0 }
        }
      }
    ]);


    const categoryAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: startQuery, $lte: endQuery }, paymentStatus: "paid" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.category",
          sales: { $sum: "$items.quantity" },
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryInfo"
        }
      },
      { $unwind: "$categoryInfo" },
      {
        $project: {
          _id: 0,
          category: "$categoryInfo.name",
          sales: 1,
          target: { $literal: 100 },
          performance: { $literal: 80 }
        }
      }
    ]);

    return {
      statusCode: 200,
      success: true,
      message: "Analytics data fetched successfully",
      data: {
        dailyTrends,
        revenueMetrics,
        customerSegmentData,
        acquisitionData,
        topProducts: topProductsRaw,
        categoryPerformance: categoryAgg
      }
    };

  } catch (error: any) {
    console.error("Analytics Service Error:", error);
    return { statusCode: 500, success: false, message: error.message || "Internal server error", data: null };
  }
};

export { getAnalyticsStatsService };
