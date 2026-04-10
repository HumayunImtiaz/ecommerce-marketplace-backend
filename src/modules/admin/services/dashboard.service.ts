import Order from "../../order/models/order.model";
import User from "../../user/models/user.model";
import Product from "../../product/models/product.model";


function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} months ago`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];


export const getDashboardStatsService = async (startDate?: string, endDate?: string) => {
  try {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      // Ensure end date includes the full day
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
    }

    // Calculate previous period for trends
    const duration = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - duration);
    const prevEnd = new Date(start.getTime() - 1);

    // ── 1. KPI Calculations ───────────────────────────────────────────────────

    // Current period stats
    const currentStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    // Previous period stats
    const previousStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: prevStart, $lte: prevEnd },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    // All-time totals (remains all-time)
    const allTimeRevenue = await Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
    ]);

    const totalRevenue = allTimeRevenue[0]?.total || 0;
    const totalOrders = allTimeRevenue[0]?.count || 0;

    // Customers count
    const totalCustomers = await User.countDocuments({ role: "user", isDeleted: false });
    
    // Current period signups
    const currentCustomers = await User.countDocuments({
      role: "user",
      isDeleted: false,
      createdAt: { $gte: start, $lte: end },
    });
    
    // Previous period signups
    const previousCustomers = await User.countDocuments({
      role: "user",
      isDeleted: false,
      createdAt: { $gte: prevStart, $lte: prevEnd },
    });

    // Filtered Products count
    const totalProducts = await Product.countDocuments({ 
      isActive: true,
      createdAt: { $gte: start, $lte: end }
    });

    // Calculate trend percentages
    const curRevenue = currentStats[0]?.totalRevenue || 0;
    const prevRevenue = previousStats[0]?.totalRevenue || 0;
    const curOrders = currentStats[0]?.totalOrders || 0;
    const prevOrders = previousStats[0]?.totalOrders || 0;

    const calcTrend = (current: number, previous: number): string => {
      if (previous === 0) return current > 0 ? "+100%" : "0%";
      const change = ((current - previous) / previous) * 100;
      return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
    };

    const kpis = {
      totalRevenue: curRevenue, // Now filtered by date range
      totalOrders: curOrders,   // Now filtered by date range
      totalCustomers: currentCustomers, // Now filtered by date range
      totalProducts: totalProducts, // Now filtered by date range
      revenueTrend: calcTrend(curRevenue, prevRevenue),
      ordersTrend: calcTrend(curOrders, prevOrders),
      customersTrend: calcTrend(currentCustomers, previousCustomers),
    };

    // ── 2. Monthly Sales (last 7 months or selected range) ──────────────────
    // If range is large, show months. If small, maybe we'd show days, but keeping months for now.
    const chartStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const monthlySalesRaw = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: chartStart, $lte: end },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          sales: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthlySales: { name: string; sales: number; orders: number }[] = [];
    
    // Determine how many months to show
    let monthsToShow = 7;
    if (startDate && endDate) {
      const diffTime = Math.abs(end.getTime() - chartStart.getTime());
      monthsToShow = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
      if (monthsToShow < 1) monthsToShow = 1;
      if (monthsToShow > 12) monthsToShow = 12; // Limit to 12 for UI
    }

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const found = monthlySalesRaw.find(
        (item: any) => item._id.year === year && item._id.month === month
      );
      monthlySales.push({
        name: MONTH_NAMES[month - 1],
        sales: found ? Math.round(found.sales) : 0,
        orders: found ? found.orders : 0,
      });
    }

    // ── 3. Order Status Distribution ──────────────────────────────────────────
    const statusColors: Record<string, string> = {
      pending: "#f59e0b",
      processing: "#8b5cf6",
      shipped: "#3b82f6",
      delivered: "#10b981",
      cancelled: "#ef4444",
    };

    const orderStatusRaw = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    const orderStatusDistribution = orderStatusRaw.map((item: any) => ({
      name: item._id.charAt(0).toUpperCase() + item._id.slice(1),
      value: item.count,
      fill: statusColors[item._id] || "#6b7280",
    }));

    // ── 4. Recent Activity ────────────────────────────────────────────────────
    const recentOrders = await Order.find({
      createdAt: { $gte: start, $lte: end }
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("userId", "fullName avatar")
      .lean();

    const recentSignups = await User.find({ 
      role: "user",
      createdAt: { $gte: start, $lte: end }
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const activities: any[] = [];

    for (const order of recentOrders) {
      const user = order.userId as any;
      activities.push({
        id: order._id,
        type: "order",
        user: user?.fullName || "Unknown User",
        avatar: user?.avatar || null,
        action:
          order.orderStatus === "delivered"
            ? "completed order"
            : order.orderStatus === "cancelled"
              ? "cancelled order"
              : "placed a new order",
        amount: `$${order.total.toFixed(2)}`,
        time: timeAgo(new Date(order.createdAt)),
        date: order.createdAt,
      });
    }

    for (const user of recentSignups) {
      activities.push({
        id: user._id,
        type: "signup",
        user: user.fullName,
        avatar: user.avatar || null,
        action: "signed up",
        amount: null,
        time: timeAgo(new Date(user.createdAt)),
        date: user.createdAt,
      });
    }

    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recentActivity = activities.slice(0, 10).map(({ date, ...rest }) => rest);

    return {
      statusCode: 200,
      success: true,
      message: "Dashboard stats fetched successfully",
      data: {
        kpis,
        monthlySales,
        orderStatusDistribution,
        recentActivity,
      },
    };
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    return {
      statusCode: 500,
      success: false,
      message: "Failed to fetch dashboard stats",
      data: null,
    };
  }
};
