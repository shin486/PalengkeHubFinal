/**
 * CSV Export Utility
 * Converts array of objects to CSV and triggers download.
 */
export function exportToCSV({ data, filename, headers }) {
  if (!data || data.length === 0) {
    return false;
  }

  const csvHeaders = headers || Object.keys(data[0]);
  const csvRows = [
    csvHeaders.join(','),
    ...data.map(row =>
      csvHeaders.map(field => {
        const value = row[field] !== undefined && row[field] !== null ? row[field] : '';
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    ),
  ];

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Format a date range for report filenames.
 */
export function formatDateRange(startDate, endDate) {
  const fmt = (d) => d ? new Date(d).toISOString().split('T')[0] : null;
  const s = fmt(startDate);
  const e = fmt(endDate);
  if (s && e) return `${s}_to_${e}`;
  if (s) return s;
  if (e) return e;
  return new Date().toISOString().split('T')[0];
}

/**
 * Get the start and end of a date range based on a preset.
 */
export function getDateRangePreset(preset) {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'month':
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'quarter':
      start.setDate(now.getDate() - 90);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      return { startDate: null, endDate: null };
  }

  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/**
 * Aggregate orders by date for chart data.
 */
export function aggregateSalesByDate(orders, days = 7) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const dayTotal = (orders || [])
      .filter(o => (o.created_at || '').startsWith(key))
      .reduce((s, o) => s + parseFloat(o.total_amount || o.total || 0), 0);
    result.push({
      date: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      sales: dayTotal,
      count: (orders || []).filter(o => (o.created_at || '').startsWith(key)).length,
    });
  }
  return result;
}

/**
 * Aggregate orders by status.
 */
export function aggregateByStatus(orders) {
  const statusMap = {};
  (orders || []).forEach(o => {
    const status = o.status || 'unknown';
    statusMap[status] = (statusMap[status] || 0) + 1;
  });
  return Object.entries(statusMap).map(([status, count]) => ({ status, count }));
}

/**
 * Aggregate revenue by stall.
 */
export function aggregateRevenueByStall(orders) {
  const stallMap = {};
  (orders || []).forEach(o => {
    if (o.status !== 'completed') return;
    const stallName = o.stall?.stall_name || `Stall #${o.stall?.stall_number || 'N/A'}`;
    if (!stallMap[stallName]) {
      stallMap[stallName] = { stall: stallName, revenue: 0, orders: 0 };
    }
    stallMap[stallName].revenue += parseFloat(o.total_amount || o.total || 0);
    stallMap[stallName].orders += 1;
  });
  return Object.values(stallMap).sort((a, b) => b.revenue - a.revenue);
}

/**
 * Aggregate revenue by product category.
 */
export function aggregateRevenueByCategory(orderItems, products) {
  const catMap = {};
  const productMap = {};
  (products || []).forEach(p => {
    productMap[p.id] = p;
  });

  (orderItems || []).forEach(item => {
    const product = productMap[item.product_id];
    const category = product?.category || 'Uncategorized';
    if (!catMap[category]) {
      catMap[category] = { category, revenue: 0, quantity: 0 };
    }
    catMap[category].revenue += parseFloat(item.price || 0) * (item.quantity || 1);
    catMap[category].quantity += item.quantity || 1;
  });

  return Object.values(catMap).sort((a, b) => b.revenue - a.revenue);
}

/**
 * Calculate summary statistics for a set of orders.
 */
export function calculateOrderStats(orders) {
  const completed = (orders || []).filter(o => o.status === 'completed');
  const totalRevenue = completed.reduce((s, o) => s + parseFloat(o.total_amount || o.total || 0), 0);
  const avgOrderValue = completed.length > 0 ? totalRevenue / completed.length : 0;
  const pending = (orders || []).filter(o => o.status === 'pending').length;
  const cancelled = (orders || []).filter(o => o.status === 'cancelled').length;

  return {
    totalOrders: orders?.length || 0,
    completedOrders: completed.length,
    totalRevenue,
    avgOrderValue,
    pendingOrders: pending,
    cancelledOrders: cancelled,
  };
}

/**
 * Calculate product performance metrics.
 *
 * There is no order_items table — orders.items is a JSONB array
 * embedded on each order (see CheckoutContent.js), and each entry
 * identifies the product via `id` (or `product_id` on some older
 * write paths), not a foreign key row. `orderItems` here is that
 * JSONB flattened across orders, not a DB table result.
 */
export function calculateProductPerformance(products, orderItems) {
  const productMap = {};
  (products || []).forEach(p => {
    productMap[p.id] = { ...p, totalSold: 0, totalRevenue: 0, orderCount: 0 };
  });

  (orderItems || []).forEach(item => {
    const productId = item.product_id || item.id;
    if (productMap[productId]) {
      productMap[productId].totalSold += item.quantity || 1;
      productMap[productId].totalRevenue += parseFloat(item.price || 0) * (item.quantity || 1);
      productMap[productId].orderCount += 1;
    }
  });

  return Object.values(productMap)
    .filter(p => p.totalSold > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/**
 * Calculate vendor performance metrics.
 */
export function calculateVendorPerformance(stalls, orders) {
  const stallMap = {};
  (stalls || []).forEach(s => {
    stallMap[s.id] = {
      stallName: s.stall_name || `Stall #${s.stall_number}`,
      stallNumber: s.stall_number,
      vendor: s.vendor?.full_name || 'Unassigned',
      section: s.section || 'N/A',
      totalRevenue: 0,
      orderCount: 0,
      completedOrders: 0,
    };
  });

  (orders || []).forEach(o => {
    if (stallMap[o.stall_id]) {
      stallMap[o.stall_id].orderCount += 1;
      if (o.status === 'completed') {
        stallMap[o.stall_id].totalRevenue += parseFloat(o.total_amount || o.total || 0);
        stallMap[o.stall_id].completedOrders += 1;
      }
    }
  });

  return Object.values(stallMap)
    .filter(s => s.orderCount > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/**
 * Calculate customer analytics.
 */
export function calculateCustomerAnalytics(orders) {
  const customerMap = {};
  (orders || []).forEach(o => {
    const customerId = o.consumer_id;
    if (!customerId) return;
    if (!customerMap[customerId]) {
      customerMap[customerId] = {
        customerId,
        customerName: o.customer?.full_name || 'N/A',
        orderCount: 0,
        totalSpent: 0,
      };
    }
    customerMap[customerId].orderCount += 1;
    if (o.status === 'completed') {
      customerMap[customerId].totalSpent += parseFloat(o.total_amount || o.total || 0);
    }
  });

  return Object.values(customerMap)
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

export default {
  exportToCSV,
  formatDateRange,
  getDateRangePreset,
  aggregateSalesByDate,
  aggregateByStatus,
  aggregateRevenueByStall,
  aggregateRevenueByCategory,
  calculateOrderStats,
  calculateProductPerformance,
  calculateVendorPerformance,
  calculateCustomerAnalytics,
};