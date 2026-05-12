import prisma from "../../../config/prisma";
import { ROLE } from "../../../utils/enums/role";

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
      end.setHours(23, 59, 59, 999);
    } else {
      // Default to last 6 months to ensure migrated data is visible
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      end = now;
    }

    const duration = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - duration);
    const prevEnd = new Date(start.getTime() - 1);

    // ── 1. KPI Calculations ───────────────────────────────────────────────────
    const currentOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        paymentStatus: "paid",
      },
      select: { total: true },
    });

    const previousOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: prevStart, lte: prevEnd },
        paymentStatus: "paid",
      },
      select: { total: true },
    });

    const curRevenue = currentOrders.reduce((sum, o) => sum + o.total, 0);
    const curOrders = currentOrders.length;
    const prevRevenue = previousOrders.reduce((sum, o) => sum + o.total, 0);
    const prevOrders = previousOrders.length;

    const currentCustomersCount = await prisma.user.count({
      where: {
        role: ROLE.USER,
        isDeleted: false,
        createdAt: { gte: start, lte: end },
      },
    });

    const previousCustomersCount = await prisma.user.count({
      where: {
        role: ROLE.USER,
        isDeleted: false,
        createdAt: { gte: prevStart, lte: prevEnd },
      },
    });

    const totalProductsCount = await prisma.product.count({
      where: {
        isActive: true,
        createdAt: { gte: start, lte: end },
      },
    });

    const calcTrend = (current: number, previous: number): string => {
      if (previous === 0) return current > 0 ? "+100%" : "0%";
      const change = ((current - previous) / previous) * 100;
      return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
    };

    const kpis = {
      totalRevenue: curRevenue,
      totalOrders: curOrders,
      totalCustomers: currentCustomersCount,
      totalProducts: totalProductsCount,
      revenueTrend: calcTrend(curRevenue, prevRevenue),
      ordersTrend: calcTrend(curOrders, prevOrders),
      customersTrend: calcTrend(currentCustomersCount, previousCustomersCount),
    };

    // ── 2. Monthly Sales ──────────────────────────────────────────────────────
    const chartStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth() - 6, 1);
    
    const monthlySalesRaw = await prisma.order.findMany({
      where: {
        createdAt: { gte: chartStart, lte: end },
        paymentStatus: "paid",
      },
      select: {
        total: true,
        createdAt: true,
      },
    });

    const salesGroups = new Map<string, { sales: number, orders: number }>();
    monthlySalesRaw.forEach(order => {
      const key = `${order.createdAt.getFullYear()}-${order.createdAt.getMonth() + 1}`;
      const current = salesGroups.get(key) || { sales: 0, orders: 0 };
      current.sales += order.total;
      current.orders += 1;
      salesGroups.set(key, current);
    });

    const monthlySales: { name: string; sales: number; orders: number }[] = [];
    let monthsToShow = 7;
    if (startDate && endDate) {
      const diffTime = Math.abs(end.getTime() - chartStart.getTime());
      monthsToShow = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
      if (monthsToShow < 1) monthsToShow = 1;
      if (monthsToShow > 12) monthsToShow = 12;
    }

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const data = salesGroups.get(key);
      monthlySales.push({
        name: MONTH_NAMES[d.getMonth()],
        sales: data ? Math.round(data.sales) : 0,
        orders: data ? data.orders : 0,
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

    const statusCounts = await prisma.order.groupBy({
      by: ['orderStatus'],
      where: { createdAt: { gte: start, lte: end } },
      _count: { orderStatus: true },
    });

    const orderStatusDistribution = statusCounts.map((item) => ({
      name: item.orderStatus.charAt(0).toUpperCase() + item.orderStatus.slice(1),
      value: item._count.orderStatus,
      fill: statusColors[item.orderStatus] || "#6b7280",
    }));

    // ── 4. Recent Activity ────────────────────────────────────────────────────
    const recentOrders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: {
          select: { fullName: true, avatar: true }
        }
      }
    });

    const recentSignups = await prisma.user.findMany({
      where: {
        role: ROLE.USER,
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const activities: any[] = [];

    for (const order of recentOrders) {
      activities.push({
        id: order.id,
        type: "order",
        role: ROLE.USER,
        user: order.user?.fullName || "Unknown User",
        avatar: order.user?.avatar || null,
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
        id: user.id,
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
