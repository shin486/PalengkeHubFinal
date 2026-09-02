import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AdminSidebar from './admin/AdminSidebar';
import AdminTopbar from './admin/AdminTopbar';
import { ToastContainer, toast } from '../components/admin/Toast';
import { categoryLabel } from '../constants/productCategories';
import { Skeleton, SkeletonTable, SkeletonStatCard, SkeletonChart } from '../components/admin/Skeleton';
import {
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
} from '../lib/exportUtils';
import { jsPDF } from 'jspdf';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import '../admin.css';

const ORDER_STATUS = {
  pending: { label: 'Pending', cls: 'status-pending' },
  confirmed: { label: 'Confirmed', cls: 'status-confirmed' },
  preparing: { label: 'Preparing', cls: 'status-preparing' },
  ready: { label: 'Ready', cls: 'status-ready' },
  completed: { label: 'Completed', cls: 'status-completed' },
  cancelled: { label: 'Cancelled', cls: 'status-cancelled' },
};

const PH = (n) => parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const PH_DATE = (d) => new Date(d).toLocaleDateString('en-PH');
const PH_DATETIME = (d) => new Date(d).toLocaleString('en-PH');

// Recharts' default pie label sits outside the slice on a leader line, at a
// distance the ResponsiveContainer doesn't reserve any room for — in a
// narrow chart-card that puts the text past the SVG's own width, where SVG's
// default overflow:hidden clips it mid-word ("confirmed (1..."). Drawing the
// label inside the slice instead keeps it within outerRadius, which is
// always inside the SVG's bounds no matter how narrow the card gets. Every
// slice gets a label, however small — a thin wedge is still real order
// volume, and hiding it read as data missing rather than data that's just
// small. The radius sits near the outer edge (0.78) rather than mid-slice,
// since the arc is at its widest out there, giving a thin wedge the most
// room a curved label point can get.
function renderInsidePercentLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.78;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#FFFDFA" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} stroke="#261006" strokeWidth={2} paintOrder="stroke">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

/* ==================== SHARED UI HELPERS ==================== */
function SearchBar({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="admin-toolbar-search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="admin-search-input"
      />
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder = 'All' }) {
  return (
    <select className="admin-filter-select" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function EmptyState({ message }) {
  return (
    <div className="empty-state">
 <div className="empty-state-icon"></div>
      <div className="empty-state-text">{message}</div>
    </div>
  );
}

function Modal({ title, onClose, children, width = '600px' }) {
  // Rendered via a portal straight to <body> — several ancestors in the
  // admin layout (.admin-main, .stat-card, etc.) carry a `transform` from
  // their entrance animation's `forwards` fill-mode. A transformed ancestor
  // becomes the containing block for `position: fixed` descendants, so
  // without the portal this modal was trapped inside the scrollable content
  // column instead of centering over the real viewport — it rendered
  // hundreds of pixels down the page, off-screen, looking like it "covered
  // the whole screen" as a bare dark overlay with no visible box.
  return createPortal(
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: width }} onClick={e => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{title}</h3>
          <button className="admin-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function FormField({ label, children }) {
  return (
    <div className="form-field">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

/* ==================== PDF GENERATION ====================
   Colors mirror the app's actual design system (src/theme/tokens.js) —
   brand orange, never red on anything that isn't an error. */
const PDF_COLORS = {
  primary: [232, 131, 58],   // brand orange #E8833A
  secondary: [201, 106, 40], // primaryDark #C96A28
  accent: [216, 154, 23],    // gold #D89A17
  dark: [38, 16, 6],         // ink #261006
  muted: [138, 114, 99],     // text tertiary #8A7263
  light: [243, 227, 203],    // surfaceSecondary #F3E3CB
  border: [227, 207, 176],   // border #E3CFB0
  white: [255, 253, 250],    // paper #FFFDFA
};

// Preloaded once so every PDF can stamp the real logo instead of a "PH"
// text badge. Falls back gracefully if this hasn't resolved yet (only
// possible if a report is exported within moments of the page loading).
let cachedLogoDataUrl = null;
(async () => {
  try {
    const res = await fetch('/palengkehublogo.jpg');
    const blob = await res.blob();
    cachedLogoDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Could not preload PDF logo:', e);
  }
})();

function addPdfHeader(doc, title, subtitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setFillColor(...PDF_COLORS.accent);
  doc.rect(0, 42, pageWidth, 3, 'F');
  doc.setFillColor(...PDF_COLORS.white);
  doc.roundedRect(14, 8, 26, 26, 4, 4, 'F');
  if (cachedLogoDataUrl) {
    try {
      doc.addImage(cachedLogoDataUrl, 'JPEG', 15, 9, 24, 24, undefined, 'FAST');
    } catch (e) {
      doc.setTextColor(...PDF_COLORS.primary);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('PH', 27, 25, { align: 'center' });
    }
  } else {
    doc.setTextColor(...PDF_COLORS.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('PH', 27, 25, { align: 'center' });
  }
  doc.setTextColor(...PDF_COLORS.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 48, 20);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 48, 30);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, pageWidth - 14, 20, { align: 'right' });
  doc.text('PalengkeHub Admin System', pageWidth - 14, 30, { align: 'right' });
}

function addPdfFooter(doc) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(14, pageHeight - 20, pageWidth - 14, pageHeight - 20);
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text('PalengkeHub - Palengke Management System', 14, pageHeight - 12);
  doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 14, pageHeight - 12, { align: 'right' });
}

function addPdfTable(doc, headers, rows, startY, colWidths) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const tableWidth = pageWidth - margin * 2;
  const rowHeight = 8;
  const headerHeight = 9;
  let y = startY;

  if (!colWidths) {
    colWidths = headers.map(() => tableWidth / headers.length);
  }

  // Header
  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(margin, y, tableWidth, headerHeight, 'F');
  doc.setTextColor(...PDF_COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  let x = margin;
  headers.forEach((h, i) => {
    doc.text(h, x + 3, y + 6, { maxWidth: colWidths[i] - 6 });
    x += colWidths[i];
  });
  y += headerHeight;

  // Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  rows.forEach((row, ri) => {
    if (y > pageHeight - 30) {
      addPdfFooter(doc);
      doc.addPage();
      addPdfHeader(doc, 'PalengkeHub Report', 'Continued');
      y = 55;
      // Re-draw header
      doc.setFillColor(...PDF_COLORS.primary);
      doc.rect(margin, y, tableWidth, headerHeight, 'F');
      doc.setTextColor(...PDF_COLORS.white);
      doc.setFont('helvetica', 'bold');
      x = margin;
      headers.forEach((h, i) => {
        doc.text(h, x + 3, y + 3.5, { maxWidth: colWidths[i] - 6 });
        x += colWidths[i];
      });
      y += headerHeight;
      doc.setFont('helvetica', 'normal');
    }
    if (ri % 2 === 0) {
      doc.setFillColor(...PDF_COLORS.light);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    doc.setTextColor(...PDF_COLORS.dark);
    x = margin;
    row.forEach((cell, ci) => {
      doc.text(String(cell), x + 3, y + 5.5, { maxWidth: colWidths[ci] - 6 });
      x += colWidths[ci];
    });
    y += rowHeight;
  });

  return y;
}

function generatePdf({ title, subtitle, filename, headers, rows, colWidths, summary }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  addPdfHeader(doc, title, subtitle);

  let y = 55;
  if (summary && summary.length) {
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_COLORS.muted);
    summary.forEach(s => {
      doc.text(s, 14, y);
      y += 5;
    });
    y += 4;
  }

  y = addPdfTable(doc, headers, rows, y, colWidths);
  addPdfFooter(doc);
  doc.save(filename);
}

// Builds a self-describing, collision-free PDF filename: the active filter
// (if any) plus a full date-and-time stamp, so printing the same screen
// twice — or with a different filter — never produces the same filename
// twice in a row (the browser was silently overwriting/auto-numbering
// same-day exports before this).
function printFilename(prefix, filterLabel) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  const slug = (filterLabel || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `palengkehub_${prefix}${slug ? `_${slug}` : ''}_${stamp}.pdf`;
}

/* ==================== AUDIT LOG ==================== */
async function logAudit(action, table, recordId, details) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('audit_log').insert({
      action,
      table_name: table,
      record_id: recordId,
      details,
      user_id: session.user.id,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

/* ==================== MAIN COMPONENT ==================== */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/admin-login', { replace: true }); return; }
      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', session.user.id).single();
      if (!profile || profile.role !== 'admin') { await supabase.auth.signOut(); navigate('/admin-login', { replace: true }); return; }
      setAdminName(profile.full_name || 'Admin');
      setLoading(false);
    })();
  }, [navigate]);

  if (loading) return <div className="admin-loading"><div className="admin-loading-spinner"></div><span>Loading dashboard</span></div>;

  const labels = {
    overview: 'Admin Dashboard', users: 'User Management', stalls: 'Stall Management',
    products: 'Product Categories', orders: 'Order Monitoring',
    prices: 'Price Monitoring', 'price-history': 'Price Change History',
    'price-anomaly': 'Price Anomaly Detection',
    announcements: 'Announcements', complaints: 'Complaint Management',
    reports: 'Reports & Audit', chats: 'Chats',
    'vendor-applications': 'Vendor Applications', 'vendor-locations': 'Vendor Locations',
  };

  return (
    <div className="admin-layout">
      <AdminSidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        adminName={adminName}
      />
      <main className="admin-main">
        <AdminTopbar setActiveSection={setActiveSection} />
        <div className="admin-page-header">
          <h1 className="admin-page-title">{labels[activeSection] || 'Dashboard'}</h1>
          <p className="admin-page-subtitle">Welcome back, {adminName}</p>
        </div>
        <SectionRenderer section={activeSection} setActiveSection={setActiveSection} />
      </main>
      <ToastContainer />
    </div>
  );
}

function SectionRenderer({ section, setActiveSection }) {
  switch (section) {
    case 'overview': return <Overview onNavigate={setActiveSection} />;
    case 'users': return <UserManagement />;
    case 'stalls': return <StallManagement />;
    case 'products': return <ProductCategories />;
    case 'prices': return <PriceMonitor />;
    case 'price-history': return <PriceHistory />;
    case 'price-anomaly': return <PriceAnomaly />;
    case 'orders': return <Orders />;
    case 'announcements': return <Announcements />;
    case 'complaints': return <ComplaintManagement />;
    case 'chats': return <Chat />;
    case 'reports': return <ReportsAndAudit />;
    case 'vendor-applications': return <VendorApplications />;
    case 'vendor-locations': return <VendorLocations />;
    default: return <Overview />;
  }
}

/* ==================== OVERVIEW ==================== */
function Overview({ onNavigate }) {
  const [stats, setStats] = useState({});
  const [orders, setOrders] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [orderStatusData, setOrderStatusData] = useState([]);
  const [revenueByStall, setRevenueByStall] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [recentPriceUpdates, setRecentPriceUpdates] = useState([]);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const completedOrdersRef = useRef([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'vendor'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'consumer'),
        supabase.from('stalls').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('vendor_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      // Supabase query errors land in r[i].error without throwing — the
      // outer try/catch never saw these, so an RLS/query failure on any one
      // count silently rendered as "0" (e.g. "0 pending complaints") with
      // no indication anything was actually wrong.
      const statLabels = ['vendors', 'customers', 'stalls', 'orders', 'products', 'pending applications', 'pending orders', 'pending complaints'];
      const failed = r.map((res, i) => res.error ? statLabels[i] : null).filter(Boolean);
      if (failed.length) {
        console.error('Overview stats load errors:', failed);
        toast({ message: `Could not load: ${failed.join(', ')}`, type: 'error' });
      }
      setStats({ vendors: r[0].count || 0, customers: r[1].count || 0, stalls: r[2].count || 0, orders: r[3].count || 0, products: r[4].count || 0, pendingApps: r[5].count || 0, pendingOrders: r[6].count || 0, pendingComplaints: r[7].count || 0 });
      const { data: recentOrders } = await supabase.from('orders').select('*, customer:consumer_id(full_name), stall:stall_id(stall_name)').order('created_at', { ascending: false }).limit(8);
      setOrders(recentOrders || []);
      // Completed orders power the sales trend + total revenue KPI
      const { data: completedOrders } = await supabase.from('orders').select('total_amount, created_at, status').eq('status', 'completed');
      completedOrdersRef.current = completedOrders || [];
      setTotalRevenue(completedOrdersRef.current.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0));
      setSalesData(aggregateSalesByDate(completedOrdersRef.current, range));
      // Order status distribution
      const { data: allStatusOrders } = await supabase.from('orders').select('status').limit(1000);
      setOrderStatusData(aggregateByStatus(allStatusOrders || []));
      // Revenue by stall
      const { data: stallOrders } = await supabase.from('orders').select('*, stall:stall_id(stall_name, stall_number)').eq('status', 'completed').limit(1000);
      setRevenueByStall(aggregateRevenueByStall(stallOrders || []));
      // Recent price changes — shown above Sales Trend so admins see what
      // moved the numbers before looking at the trend itself.
      const { data: priceUpdates, error: priceUpdatesError } = await supabase
        .from('price_history')
        .select('previous_price, new_price, changed_at, product:product_id(name, stall:stall_id(stall_name))')
        .order('changed_at', { ascending: false })
        .limit(5);
      if (priceUpdatesError) console.error('Recent price updates load error:', priceUpdatesError.message);
      setRecentPriceUpdates(priceUpdates || []);
      toast({ message: 'Dashboard data refreshed successfully', type: 'success' });
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
      toast({ message: 'Failed to load dashboard data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  /* Re-aggregate the trend chart client-side when the date range changes */
  const changeRange = (days) => {
    if (!completedOrdersRef.current.length && days !== range) { setRange(days); return; }
    setRange(days);
    setSalesData(aggregateSalesByDate(completedOrdersRef.current, days));
  };

  const exportSalesCSV = () => {
    if (salesData.length === 0) { toast({ message: 'No sales data to export', type: 'error' }); return; }
    exportToCSV({
      data: salesData.map(d => ({ Date: d.date, Sales: d.sales })),
      filename: `palengkehub-sales-last-${range}-days`,
      headers: ['Date', 'Sales'],
    });
    toast({ message: 'Sales report exported as CSV', type: 'success' });
  };

  const STATUS_COLORS = {
    pending: '#F59E0B', confirmed: '#3B82F6', preparing: '#8B5CF6',
    ready: '#10B981', completed: '#22C55E', cancelled: '#EF4444',
  };

  if (error) {
    return (
      <div className="error-state">
        <div className="error-state-icon">!</div>
        <div className="error-state-text">{error}</div>
        <button className="btn btn-primary refresh-btn" onClick={load}>Retry</button>
      </div>
    );
  }

  const totalUsers = (stats.vendors || 0) + (stats.customers || 0);

  return (
    <>
      {/* ── Top row: KPI cards ── */}
      <div className="kpi-grid">
        {loading ? (
          <>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </>
        ) : (
          <>
            <div className="kpi-card delay-1">
              <div className="kpi-icon kpi-icon-revenue" aria-hidden="true">₱</div>
              <div className="kpi-body">
                <div className="kpi-value">₱{PH(totalRevenue)}</div>
                <div className="kpi-label">Total Revenue</div>
                <div className="kpi-sub">{stats.orders || 0} orders all-time</div>
              </div>
            </div>
            <div className="kpi-card delay-2">
              <div className="kpi-icon kpi-icon-users" aria-hidden="true">👥</div>
              <div className="kpi-body">
                <div className="kpi-value">{totalUsers.toLocaleString()}</div>
                <div className="kpi-label">Total Users</div>
                <div className="kpi-sub">{stats.customers || 0} customers · {stats.vendors || 0} vendors</div>
              </div>
            </div>
            <button className="kpi-card kpi-card-link delay-3" onClick={() => onNavigate?.('orders')} title="View orders">
              <div className="kpi-icon kpi-icon-orders" aria-hidden="true">📦</div>
              <div className="kpi-body">
                <div className="kpi-value">{stats.orders || 0}</div>
                <div className="kpi-label">Total Orders</div>
                <div className="kpi-sub kpi-sub-warn">{stats.pendingOrders || 0} pending</div>
              </div>
            </button>
            <div className="kpi-card delay-4">
              <div className="kpi-icon kpi-icon-stalls" aria-hidden="true">🏪</div>
              <div className="kpi-body">
                <div className="kpi-value">{stats.stalls || 0}</div>
                <div className="kpi-label">Market Stalls</div>
                <div className="kpi-sub">{stats.products || 0} products listed</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Action-needed alert strip ── */}
      {(stats.pendingApps > 0 || stats.pendingOrders > 0 || stats.pendingComplaints > 0) && (
        <div className="alert-strip">
          {[
            { v: stats.pendingApps, l: 'vendor applications', section: 'vendor-applications' },
            { v: stats.pendingOrders, l: 'pending orders', section: 'orders' },
            { v: stats.pendingComplaints, l: 'open complaints', section: 'complaints' },
          ].filter(p => p.v > 0).map(p => (
            <button key={p.l} className="alert-chip" onClick={() => onNavigate?.(p.section)}>
              <strong>{p.v}</strong> {p.l} need attention →
            </button>
          ))}
        </div>
      )}

      {/* ── Recent Price Updates: shown before Sales Trend so admins see
          what changed before looking at the trend it fed into ── */}
      <div className="chart-card" style={{ marginBottom: 'var(--admin-radius, 24px)' }}>
        <div className="chart-card-header">
          <h3 className="chart-card-title">Recent Price Updates</h3>
          <button className="btn btn-sm btn-secondary" onClick={() => onNavigate?.('price-history')}>View All</button>
        </div>
        {recentPriceUpdates.length === 0 ? (
          <EmptyState message="No price changes recorded yet" />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Product</th><th>Stall</th><th>Previous</th><th>New</th><th>Changed</th></tr></thead>
              <tbody>
                {recentPriceUpdates.map((h, i) => (
                  <tr key={i}>
                    <td><strong>{h.product?.name || 'N/A'}</strong></td>
                    <td>{h.product?.stall?.stall_name || 'N/A'}</td>
                    <td>{h.previous_price != null ? `₱${PH(h.previous_price)}` : 'N/A'}</td>
                    <td style={{ fontWeight: 700 }}>₱{PH(h.new_price)}</td>
                    <td>{PH_DATETIME(h.changed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Toolbar: filters / date range / export ── */}
      <div className="overview-toolbar">
        <div className="overview-toolbar-left">
          <span className="overview-toolbar-title">Sales Trend</span>
          <div className="range-group" role="group" aria-label="Date range">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                className={`range-btn${range === d ? ' active' : ''}`}
                onClick={() => changeRange(d)}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>
        <div className="overview-toolbar-right">
          <button className="refresh-btn" onClick={load} disabled={loading}>
            <span className={loading ? 'refreshing' : ''}>↻ Refresh</span>
          </button>
          <button className="btn btn-sm btn-primary export-overview-btn" onClick={exportSalesCSV}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* ── Middle section: charts grid (line · pie · bar) ── */}
      <div className="chart-grid">
        <div className="chart-card chart-span-2">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Daily Sales — Last {range} Days</h3>
          </div>
          <div style={{ height: 280 }}>
            {loading ? <SkeletonChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
                  <Tooltip formatter={(v) => [`₱${PH(v)}`, 'Sales']} />
                  <Line type="monotone" dataKey="sales" stroke="#DC2626" strokeWidth={2.5} dot={{ r: 3, fill: '#DC2626' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Order Status</h3>
          </div>
          <div style={{ height: 260 }}>
            {loading ? <SkeletonChart /> : orderStatusData.length === 0 ? (
              <EmptyState message="No order data available" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(v) => [v, 'Orders']} />
                  <Legend />
                  <Pie
                    data={orderStatusData}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    labelLine={false}
                    label={renderInsidePercentLabel}
                  >
                    {orderStatusData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={STATUS_COLORS[entry.status] || '#9CA3AF'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Revenue by Stall (Top 5)</h3>
          </div>
          <div style={{ height: 260 }}>
            {loading ? <SkeletonChart /> : revenueByStall.length === 0 ? (
              <EmptyState message="No revenue data available" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByStall.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <YAxis type="category" dataKey="stall" tick={{ fontSize: 11, fill: '#6B7280' }} width={110} />
                  <Tooltip formatter={(v) => [`₱${PH(v)}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#DC2626" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom section: detailed data table ── */}
      <div className="admin-section">
        <div className="admin-section-header">Recent Orders</div>
        <div className="admin-table-wrap">
          <table className="admin-table admin-table-hover">
            <thead><tr><th>Order #</th><th>Customer</th><th>Stall</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan="6"><SkeletonTable rows={1} cols={6} /></td></tr>
                ))
              ) : orders.length === 0 ? <tr><td colSpan="6"><EmptyState message="No orders yet" /></td></tr>
                : orders.map(o => { const s = ORDER_STATUS[o.status] || ORDER_STATUS.pending; return (
                    <tr key={o.id}>
                      <td>#{o.order_number?.slice(-6) || String(o.id).slice(-6)}</td>
                      <td>{o.customer?.full_name || '—'}</td>
                      <td>{o.stall?.stall_name || '—'}</td>
                      <td><span className={`status-badge ${s.cls}`}>{s.label}</span></td>
                      <td style={{ fontWeight: 600 }}>₱{PH(o.total_amount || o.total)}</td>
                      <td>{PH_DATE(o.created_at)}</td>
                    </tr>
                  ); })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ==================== STALL MANAGEMENT ==================== */
function StallManagement() {
  const [stalls, setStalls] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showTransactions, setShowTransactions] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('stalls').select('*, vendor:vendor_id(id, full_name, email)').order('stall_number', { ascending: true });
    setStalls(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = stalls.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || (s.stall_name || '').toLowerCase().includes(q) || String(s.stall_number || '').includes(q) || (s.section || '').toLowerCase().includes(q) || (s.vendor?.full_name || '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || (statusFilter === 'active' ? s.is_active : !s.is_active);
    const matchSection = !sectionFilter || s.section === sectionFilter;
    return matchSearch && matchStatus && matchSection;
  });

  const sections = [...new Set(stalls.map(s => s.section).filter(Boolean))];

  const toggleActive = async (stall) => {
    const { error } = await supabase.from('stalls').update({ is_active: !stall.is_active }).eq('id', stall.id);
    if (error) {
      toast({ message: `Failed to update stall: ${error.message}`, type: 'error' });
      return;
    }
    await logAudit('stall_status_change', 'stalls', stall.id, `${stall.stall_name || `Stall #${stall.stall_number}`} ${stall.is_active ? 'deactivated' : 'activated'}`);
    toast({ message: `Stall ${stall.is_active ? 'deactivated' : 'activated'} successfully`, type: 'success' });
    load();
  };

  const deleteStall = async (stall) => {
    const label = stall.stall_name || `Stall #${stall.stall_number}`;
    if (!window.confirm(`Permanently delete "${label}"? This also deletes all of its products. This cannot be undone.`)) return;

    // Products carry a stall_id FK — deleted first so the stalls delete
    // below doesn't fail on a foreign-key violation. Orders/conversations/
    // carts/promotions/ratings also reference stall_id but are left alone
    // (order history shouldn't disappear because a stall was removed); if
    // any of those has a live DB constraint blocking the stall delete, the
    // error below surfaces that instead of silently corrupting data.
    const { error: productsError } = await supabase.from('products').delete().eq('stall_id', stall.id);
    if (productsError) {
      toast({ message: `Failed to delete stall's products: ${productsError.message}`, type: 'error' });
      return;
    }

    const { error } = await supabase.from('stalls').delete().eq('id', stall.id);
    if (error) {
      toast({ message: `Failed to delete stall: ${error.message}. It likely still has existing orders — remove or reassign those first.`, type: 'error' });
      return;
    }

    await logAudit('stall_deleted', 'stalls', stall.id, `${label} deleted`);
    toast({ message: `${label} deleted`, type: 'success' });
    load();
  };

  const saveEdit = async () => {
    setSaving(true);
    await supabase.from('stalls').update({
      stall_name: editing.stall_name,
      stall_number: editing.stall_number,
      section: editing.section,
      floor: editing.floor,
      location: editing.location,
      is_active: editing.is_active,
    }).eq('id', editing.id);
    await logAudit('stall_update', 'stalls', `${editing.stall_name || `Stall #${editing.stall_number}`}`, 'Stall details updated');
    setSaving(false);
    setEditing(null);
    toast({ message: 'Stall details updated successfully', type: 'success' });
    load();
  };

  const viewTransactions = async (stall) => {
    setViewing(stall);
    setShowTransactions(true);
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        *,
        stall:stall_id (stall_name, stall_number, section),
        customer:consumer_id (full_name, email)
      `)
      .eq('stall_id', stall.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setTransactions(orders || []);
  };

  const handlePrint = () => {
    generatePdf({
      title: 'Stall Report',
      subtitle: `Stall list${statusFilter ? ` — ${statusFilter}` : ''}${sectionFilter ? ` — ${sectionFilter}` : ''} (${filtered.length} records)`,
      headers: ['Stall Name', 'Number', 'Section', 'Floor', 'Location', 'Vendor', 'Status'],
      rows: filtered.map(s => [s.stall_name || `Stall #${s.stall_number}`, s.stall_number, s.section || 'N/A', s.floor || 'N/A', s.location || 'N/A', s.vendor?.full_name || 'Unassigned', s.is_active ? 'Active' : 'Inactive']),
      filename: printFilename('stalls', [statusFilter, sectionFilter].filter(Boolean).join(' ')),
      summary: [`Total Stalls: ${filtered.length}`],
    });
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">Stall Management</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search stall name, number, section, vendor..." />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} placeholder="All Statuses" />
        <FilterSelect value={sectionFilter} onChange={setSectionFilter} options={sections.map(s => ({ value: s, label: s }))} placeholder="All Sections" />
        <button className="btn btn-secondary" onClick={handlePrint}>Print</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Stall</th><th>Vendor</th><th>Section / Floor</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="6"><EmptyState message="No stalls found" /></td></tr>
              : filtered.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.stall_name || `Stall #${s.stall_number}`}</strong><div className="table-subtext">Stall #{s.stall_number}</div></td>
                  <td>{s.vendor?.full_name || 'Unassigned'}<div className="text-subtext">{s.vendor?.email || ''}</div></td>
                  <td>{s.section || 'N/A'} / {s.floor || 'N/A'}</td>
                  <td>{s.location || 'N/A'}</td>
                  <td><span className={`status-badge ${s.is_active ? 'status-completed' : 'status-cancelled'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-sm btn-primary" onClick={() => setEditing(s)}>Edit</button>
                      <button className="btn btn-sm btn-success" onClick={() => viewTransactions(s)}>Transactions</button>
                      <button className={`btn btn-sm ${s.is_active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleActive(s)}>{s.is_active ? 'Deactivate' : 'Activate'}</button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteStall(s)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={`Edit Stall - ${editing.stall_name || `Stall #${editing.stall_number}`}`} onClose={() => setEditing(null)}>
          <div className="form-grid">
            <FormField label="Stall Name">
              <input className="form-input" value={editing.stall_name || ''} onChange={e => setEditing({ ...editing, stall_name: e.target.value })} />
            </FormField>
            <FormField label="Stall Number">
              <input className="form-input" value={editing.stall_number || ''} onChange={e => setEditing({ ...editing, stall_number: e.target.value })} />
            </FormField>
            <FormField label="Section">
              <input className="form-input" value={editing.section || ''} onChange={e => setEditing({ ...editing, section: e.target.value })} />
            </FormField>
            <FormField label="Floor">
              <input className="form-input" value={editing.floor || ''} onChange={e => setEditing({ ...editing, floor: e.target.value })} />
            </FormField>
            <FormField label="Location">
              <input className="form-input" value={editing.location || ''} onChange={e => setEditing({ ...editing, location: e.target.value })} />
            </FormField>
            <FormField label="Status">
              <select className="form-input" value={editing.is_active ? 'true' : 'false'} onChange={e => setEditing({ ...editing, is_active: e.target.value === 'true' })}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </FormField>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </Modal>
      )}

      {showTransactions && viewing && (
        <Modal title={`Transactions - ${viewing.stall_name || `Stall #${viewing.stall_number}`}`} onClose={() => setShowTransactions(false)} width="800px">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Order #</th><th>Customer</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
              <tbody>
                {transactions.length === 0 ? <tr><td colSpan="5"><EmptyState message="No transactions found for this stall" /></td></tr>
                  : transactions.map(o => {
                    const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
                    const orderNum = o.order_number ? o.order_number.slice(-8) : String(o.id).slice(-6);
                    const custName = o.customer ? o.customer.full_name : 'N/A';
                    return (
                      <tr key={o.id}>
                        <td><strong>#{orderNum}</strong></td>
                        <td>{custName}</td>
                        <td><span className={'status-badge ' + st.cls}>{st.label}</span></td>
                        <td style={{ fontWeight: 700 }}>₱{PH(o.total_amount)}</td>
                        <td>{PH_DATETIME(o.created_at)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==================== USER MANAGEMENT ==================== */
function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    const matchStatus = !statusFilter || (statusFilter === 'active' ? u.is_active !== false : u.is_active === false);
    return matchSearch && matchRole && matchStatus;
  });

  const toggleActive = async (user) => {
    const { error } = await supabase.from('profiles').update({ is_active: user.is_active === false ? true : false }).eq('id', user.id);
    if (error) {
      toast({ message: `Failed to update user: ${error.message}`, type: 'error' });
      return;
    }
    await logAudit('user_status_change', 'profiles', user.email, `${user.email} ${user.is_active === false ? 'activated' : 'deactivated'}`);
    toast({ message: `User ${user.is_active === false ? 'activated' : 'deactivated'} successfully`, type: 'success' });
    load();
  };

  const handlePrint = () => {
    generatePdf({
      title: 'User Report',
      subtitle: `User list${roleFilter ? ` — ${roleFilter}` : ''}${statusFilter ? ` — ${statusFilter}` : ''} (${filtered.length} records)`,
      headers: ['Name', 'Email', 'Role', 'Registered', 'Status'],
      rows: filtered.map(u => [u.full_name || 'Unnamed', u.email || 'N/A', u.role || 'consumer', PH_DATE(u.created_at), u.is_active === false ? 'Inactive' : 'Active']),
      filename: printFilename('users', [roleFilter, statusFilter].filter(Boolean).join(' ')),
      summary: [`Total Users: ${filtered.length}`],
    });
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">User Management</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email..." />
        <FilterSelect value={roleFilter} onChange={setRoleFilter} options={[{ value: 'consumer', label: 'Consumer' }, { value: 'vendor', label: 'Vendor' }, { value: 'admin', label: 'Admin' }]} placeholder="All Roles" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} placeholder="All Statuses" />
        <button className="btn btn-secondary" onClick={handlePrint}>Print</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table admin-table-fixed">
          <colgroup>
            <col style={{ width: '17%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '24%' }} />
          </colgroup>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Registered</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="6"><EmptyState message="No users found" /></td></tr>
              : filtered.map(u => (
                <tr key={u.id}>
                  <td className="cell-truncate"><strong>{u.full_name || 'Unnamed'}</strong></td>
                  <td className="cell-truncate" title={u.email || ''}>{u.email || 'N/A'}</td>
                  <td><span className="status-badge status-confirmed" style={{ textTransform: 'capitalize' }}>{u.role || 'consumer'}</span></td>
                  <td>{PH_DATE(u.created_at)}</td>
                  <td><span className={`status-badge ${u.is_active === false ? 'status-cancelled' : 'status-completed'}`}>{u.is_active === false ? 'Inactive' : 'Active'}</span></td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-sm btn-primary" onClick={() => setSelected(u)}>View Details</button>
                      <button className={`btn btn-sm ${u.is_active === false ? 'btn-success' : 'btn-danger'}`} onClick={() => toggleActive(u)}>{u.is_active === false ? 'Activate' : 'Deactivate'}</button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <Modal title="User Details" onClose={() => setSelected(null)}>
          <div className="user-detail-grid">
            <div><strong>Name:</strong> {selected.full_name || 'N/A'}</div>
            <div><strong>Email:</strong> {selected.email || 'N/A'}</div>
            <div><strong>Role:</strong> <span style={{ textTransform: 'capitalize' }}>{selected.role || 'consumer'}</span></div>
            <div><strong>Registered:</strong> {PH_DATETIME(selected.created_at)}</div>
            <div><strong>Status:</strong> {selected.is_active === false ? 'Inactive' : 'Active'}</div>
            <div><strong>Last Updated:</strong> {selected.updated_at ? PH_DATETIME(selected.updated_at) : 'N/A'}</div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==================== VENDOR APPLICATIONS ==================== */
function VendorApplications() {
  const [applications, setApplications] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [requesting, setRequesting] = useState(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('vendor_applications')
      .select('*, applicant:applicant_id(full_name, email, phone)')
      .order('application_date', { ascending: false });
    setApplications(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = applications.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || (a.business_name || '').toLowerCase().includes(q) || (a.applicant?.full_name || '').toLowerCase().includes(q) || (a.applicant?.email || '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const approve = async (app) => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from('vendor_applications').update({
        status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: session?.user?.id || null,
      }).eq('id', app.id);
      if (error) { toast({ message: `Failed to approve: ${error.message}`, type: 'error' }); return; }
      const { error: roleError } = await supabase.from('profiles').update({ role: 'vendor' }).eq('id', app.applicant_id);
      if (roleError) {
        // Don't activate a stall for someone who was never actually granted
        // the vendor role — that would make it publicly visible/orderable
        // while its owner is stuck unable to reach the vendor dashboard to
        // manage it (App.js only runs the stall-active check for role='vendor').
        toast({ message: `Approved, but failed to grant vendor role: ${roleError.message}. Stall was not activated — retry the approval.`, type: 'error' });
        setSelected(null);
        load();
        return;
      }
      // The applicant's stall was created with is_active: false at signup
      // (src/contexts/AuthContext.js) so it stays invisible to customers
      // until an admin turns it on — this used to require a second, easy-
      // to-forget manual toggle in the Stalls tab after approving here.
      const { data: activatedStalls, error: activateError } = await supabase
        .from('stalls').update({ is_active: true }).eq('vendor_id', app.applicant_id).select('id');
      if (activateError) {
        // Previously fell through to the success toast/audit log right
        // after this error toast — an admin skimming could easily read
        // only the final "approved — is now a vendor" message and believe
        // the stall is live when it isn't.
        toast({ message: `Approved, but failed to activate the stall: ${activateError.message}`, type: 'error' });
        setSelected(null);
        load();
        return;
      }
      if (!activatedStalls?.length) {
        // A 0-row match isn't a Postgrest error, so it fails silently
        // without this check — happens if the signup-time stall insert
        // in AuthContext.js failed and only the application row exists.
        toast({ message: `Approved, but no stall was found for this vendor to activate. Check the Stalls tab.`, type: 'error' });
        setSelected(null);
        load();
        return;
      }
      await logAudit('vendor_application_approved', 'vendor_applications', app.id, `${app.business_name} approved — ${app.applicant?.full_name || app.applicant_id} is now a vendor`);
      toast({ message: `${app.business_name} approved — applicant is now a vendor`, type: 'success' });
      setSelected(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const reject = async (app) => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from('vendor_applications').update({
        status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: session?.user?.id || null,
      }).eq('id', app.id);
      if (error) { toast({ message: `Failed to reject: ${error.message}`, type: 'error' }); return; }
      await logAudit('vendor_application_rejected', 'vendor_applications', app.id, `${app.business_name} rejected`);
      toast({ message: `${app.business_name} rejected`, type: 'success' });
      setSelected(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const submitResubmissionRequest = async () => {
    if (!requesting || !requestMessage.trim()) {
      toast({ message: 'Write a message explaining what to fix', type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const { error: appError } = await supabase.from('vendor_applications').update({
        resubmission_status: 'requested',
        resubmission_message: requestMessage.trim(),
        resubmission_requested_at: nowIso,
      }).eq('id', requesting.id);
      if (appError) { toast({ message: `Failed to flag application: ${appError.message}`, type: 'error' }); return; }

      const { error } = await supabase.from('notifications').insert({
        user_id: requesting.applicant_id,
        type: 'vendor_resubmission',
        title: 'Update needed on your vendor application',
        message: requestMessage.trim(),
        data: { vendor_application_id: requesting.id },
        is_read: false,
      });
      if (error) { toast({ message: `Failed to notify applicant: ${error.message}`, type: 'error' }); return; }
      await logAudit('vendor_application_resubmission_requested', 'vendor_applications', requesting.id, `Asked ${requesting.applicant?.full_name || requesting.applicant_id} to resubmit: ${requestMessage.trim()}`);
      toast({ message: 'Applicant notified — application stays pending', type: 'success' });
      setRequesting(null);
      setRequestMessage('');
      setSelected(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = () => {
    generatePdf({
      title: 'Vendor Applications Report',
      subtitle: `Vendor applications${statusFilter ? ` — ${statusFilter}` : ''} (${filtered.length} records)`,
      headers: ['Business', 'Applicant', 'Category', 'Applied', 'Status'],
      rows: filtered.map(a => [a.business_name || 'N/A', a.applicant?.full_name || 'N/A', a.category || 'N/A', PH_DATE(a.application_date), a.status]),
      filename: printFilename('vendor_applications', statusFilter),
      summary: [`Total Applications: ${filtered.length}`],
    });
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">Vendor Applications</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by business name or applicant..." />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} placeholder="All Statuses" />
        <button className="btn btn-secondary" onClick={handlePrint}>Print</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Business</th><th>Applicant</th><th>Category</th><th>Applied</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="6"><EmptyState message="No vendor applications found" /></td></tr>
              : filtered.map(a => (
                <tr key={a.id}>
                  <td><strong>{a.business_name || 'N/A'}</strong><div className="table-subtext">{a.address || ''}</div></td>
                  <td>{a.applicant?.full_name || 'N/A'}<div className="text-subtext">{a.applicant?.email || ''}</div></td>
                  <td><span className="status-badge status-confirmed">{a.category || 'N/A'}</span></td>
                  <td>{PH_DATE(a.application_date)}</td>
                  <td>
                    <span className={`status-badge ${a.status === 'approved' ? 'status-completed' : a.status === 'rejected' ? 'status-cancelled' : 'status-pending'}`} style={{ textTransform: 'capitalize' }}>{a.status}</span>
                    {a.resubmission_status === 'requested' && (
                      <div className="status-badge status-pending" style={{ marginTop: '4px' }}>Awaiting Resubmission</div>
                    )}
                    {a.resubmission_status === 'resubmitted' && (
                      <div className="status-badge status-confirmed" style={{ marginTop: '4px' }}>Resubmitted — Review</div>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-sm btn-primary" onClick={() => setSelected(a)}>View Details</button>
                      {a.status === 'pending' && (
                        <>
                          <button className="btn btn-sm btn-success" onClick={() => approve(a)} disabled={busy}>Approve</button>
                          <button className="btn btn-sm btn-danger" onClick={() => reject(a)} disabled={busy}>Reject</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <Modal title="Vendor Application" onClose={() => setSelected(null)}>
          <div className="user-detail-grid">
            <div><strong>Business Name:</strong> {selected.business_name || 'N/A'}</div>
            <div><strong>Category:</strong> {selected.category || 'N/A'}</div>
            <div><strong>Applicant:</strong> {selected.applicant?.full_name || 'N/A'}</div>
            <div><strong>Email:</strong> {selected.applicant?.email || 'N/A'}</div>
            <div><strong>Phone:</strong> {selected.applicant?.phone || 'N/A'}</div>
            <div><strong>Address / Stall:</strong> {selected.address || 'N/A'}</div>
            <div><strong>Experience:</strong> {selected.experience || 'N/A'}</div>
            <div><strong>Applied:</strong> {PH_DATETIME(selected.application_date)}</div>
            <div><strong>Status:</strong> <span style={{ textTransform: 'capitalize' }}>{selected.status}</span></div>
            {selected.reviewed_at && <div><strong>Reviewed:</strong> {PH_DATETIME(selected.reviewed_at)}</div>}
          </div>
          {selected.notes && (
            <div style={{ marginTop: '16px' }}>
              <strong>Notes:</strong>
              <p style={{ marginTop: '4px', color: 'var(--admin-text-secondary)' }}>{selected.notes}</p>
            </div>
          )}
          {selected.resubmission_status === 'requested' && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--gold-soft, #FBEFD2)', borderRadius: 'var(--admin-radius-sm)', fontSize: '0.85rem' }}>
              <strong>Awaiting resubmission</strong> — requested {PH_DATETIME(selected.resubmission_requested_at)}
              <p style={{ marginTop: '4px', color: 'var(--admin-text-secondary)' }}>"{selected.resubmission_message}"</p>
            </div>
          )}
          {selected.resubmission_status === 'resubmitted' && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--brand-soft, #FBE7D4)', borderRadius: 'var(--admin-radius-sm)', fontSize: '0.85rem' }}>
              <strong>Applicant resubmitted documents</strong> — {PH_DATETIME(selected.resubmitted_at)}. The documents below are the updated set — please review again.
              <p style={{ marginTop: '4px', color: 'var(--admin-text-secondary)' }}>Original request: "{selected.resubmission_message}"</p>
            </div>
          )}
          {Array.isArray(selected.documents) && selected.documents.length > 0 ? (
            <div style={{ marginTop: '16px' }}>
              <strong>Documents:</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {selected.documents.map((doc, i) => (
                  <button
                    key={i}
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    {doc.type === 'valid_id' ? 'Valid ID' : doc.type === 'business_permit' ? 'Business Permit' : doc.type === 'gcash_qr' ? 'GCash QR Code' : `Document ${i + 1}`}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--gold-soft, #FBEFD2)', borderRadius: 'var(--admin-radius-sm)', fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>
              No documents on file — this application can't really be verified yet. Use "Request Resubmission" to ask the applicant to upload their ID and business permit.
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            {selected.status === 'pending' && (
              <>
                <button className="btn btn-secondary" onClick={() => { setRequesting(selected); setRequestMessage(''); }} disabled={busy}>Request Resubmission</button>
                <button className="btn btn-danger" onClick={() => reject(selected)} disabled={busy}>Reject</button>
                <button className="btn btn-success" onClick={() => approve(selected)} disabled={busy}>Approve</button>
              </>
            )}
          </div>
        </Modal>
      )}

      {requesting && (
        <Modal title="Request Resubmission" onClose={() => setRequesting(null)}>
          <p style={{ marginBottom: '12px', color: 'var(--admin-text-secondary)' }}>
            {requesting.applicant?.full_name || 'The applicant'} will get a notification asking them to fix and resubmit. The application stays pending — nothing is approved or rejected.
          </p>
          <FormField label="Message to applicant">
            <textarea
              className="form-input"
              rows={4}
              value={requestMessage}
              onChange={e => setRequestMessage(e.target.value)}
              placeholder="e.g. Please upload a clear photo of your valid government ID and business permit — we couldn't verify your application without them."
            />
          </FormField>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setRequesting(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitResubmissionRequest} disabled={busy || !requestMessage.trim()}>Send Request</button>
          </div>
        </Modal>
      )}

      {previewDoc && (
        <Modal
          title={previewDoc.type === 'valid_id' ? 'Valid ID' : previewDoc.type === 'business_permit' ? 'Business Permit' : previewDoc.type === 'gcash_qr' ? 'GCash QR Code' : 'Document'}
          onClose={() => setPreviewDoc(null)}
          width="720px"
        >
          {/\.pdf$/i.test(previewDoc.url.split('?')[0]) ? (
            <iframe
              src={previewDoc.url}
              title="Document preview"
              style={{ width: '100%', height: '70vh', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)' }}
            />
          ) : (
            <img
              src={previewDoc.url}
              alt="Document preview"
              style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 'var(--admin-radius-sm)', background: 'var(--admin-surface-secondary, #F3E3CB)', display: 'block' }}
            />
          )}
          <div className="modal-actions">
            <a href={previewDoc.url} target="_blank" rel="noreferrer" className="btn btn-secondary">Open in new tab</a>
            <button className="btn btn-primary" onClick={() => setPreviewDoc(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==================== VENDOR LOCATIONS ==================== */
const LOCATION_REVIEW_THRESHOLD_METERS = 15;

function VendorLocations() {
  const [tab, setTab] = useState('queue');
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flagging, setFlagging] = useState(null);
  const [flagReason, setFlagReason] = useState('');
  const [viewingMap, setViewingMap] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stall_locations')
      .select('*, stall:stall_id(id, stall_number, stall_name, section, vendor:vendor_id(id, full_name))')
      .eq('is_current', true)
      .order('accuracy_meters', { ascending: false, nullsFirst: false });
    setLocations(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const queue = locations.filter(l => !l.verified_by_admin || (l.accuracy_meters != null && l.accuracy_meters > LOCATION_REVIEW_THRESHOLD_METERS));
  const rows = tab === 'queue' ? queue : locations;

  const approve = async (loc) => {
    setBusy(true);
    try {
      const { error } = await supabase.from('stall_locations').update({
        verified_by_admin: true, verified_at: new Date().toISOString(),
      }).eq('id', loc.id);
      if (error) { toast({ message: `Failed to approve location: ${error.message}`, type: 'error' }); return; }
      await logAudit('stall_location_approved', 'stall_locations', loc.id, `${loc.stall?.stall_name || `Stall #${loc.stall?.stall_number}`} location verified`);
      toast({ message: 'Stall location approved', type: 'success' });
      load();
    } finally {
      setBusy(false);
    }
  };

  const submitFlag = async () => {
    if (!flagging || !flagReason.trim()) {
      toast({ message: 'Describe why this stall needs to re-register its location', type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from('stall_locations').update({
        reregister_reason: flagReason.trim(), verified_by_admin: false,
      }).eq('id', flagging.id);
      if (error) { toast({ message: `Failed to flag: ${error.message}`, type: 'error' }); return; }

      const vendorId = flagging.stall?.vendor?.id;
      if (vendorId) {
        await supabase.from('notifications').insert({
          user_id: vendorId,
          type: 'stall_location_reregister',
          title: 'Stall location needs re-registration',
          message: flagReason.trim(),
          data: { stall_id: flagging.stall_id, location_id: flagging.id },
          is_read: false,
        });
      }
      await logAudit('stall_location_flagged', 'stall_locations', flagging.id, `${flagging.stall?.stall_name || `Stall #${flagging.stall?.stall_number}`} flagged for re-registration: ${flagReason.trim()}`);
      toast({ message: 'Vendor notified to re-register their location', type: 'success' });
      setFlagging(null);
      setFlagReason('');
      load();
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = () => {
    generatePdf({
      title: 'Vendor Locations Report',
      subtitle: `${tab === 'queue' ? 'Locations needing review' : 'All stall locations'} (${rows.length} records)`,
      headers: ['Stall', 'Vendor', 'Coordinates', 'Accuracy', 'Captured By', 'Status'],
      rows: rows.map(l => {
        const needsReview = !l.verified_by_admin || (l.accuracy_meters != null && l.accuracy_meters > LOCATION_REVIEW_THRESHOLD_METERS);
        return [
          l.stall?.stall_name || `Stall #${l.stall?.stall_number}`,
          l.stall?.vendor?.full_name || 'N/A',
          `${Number(l.lat).toFixed(6)}, ${Number(l.lng).toFixed(6)}`,
          l.accuracy_meters != null ? `±${Math.round(l.accuracy_meters)}m` : (l.manually_adjusted ? 'Manual' : 'N/A'),
          l.captured_by || 'N/A',
          needsReview ? 'Needs Review' : 'Verified',
        ];
      }),
      filename: printFilename('vendor_locations', tab === 'queue' ? 'needs review' : 'all'),
      summary: [`Total Locations: ${rows.length}`],
    });
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">Vendor Locations</div>
      <div className="report-tabs" role="tablist" aria-label="Vendor location sections" style={{ marginBottom: '16px' }}>
        <button role="tab" aria-selected={tab === 'queue'} className={`report-tab${tab === 'queue' ? ' active' : ''}`} onClick={() => setTab('queue')}>
          Needs Review {queue.length > 0 && `(${queue.length})`}
        </button>
        <button role="tab" aria-selected={tab === 'all'} className={`report-tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>
          All Stalls
        </button>
        <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={handlePrint}>Print</button>
      </div>

      {loading ? <SkeletonTable rows={5} cols={7} /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Stall</th><th>Vendor</th><th>Coordinates</th><th>Accuracy</th><th>Captured By</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan="7"><EmptyState message={tab === 'queue' ? 'Nothing needs review right now' : 'No stall locations found'} /></td></tr>
                : rows.map(l => {
                  const needsReview = !l.verified_by_admin || (l.accuracy_meters != null && l.accuracy_meters > LOCATION_REVIEW_THRESHOLD_METERS);
                  return (
                    <tr key={l.id}>
                      <td><strong>{l.stall?.stall_name || `Stall #${l.stall?.stall_number}`}</strong><div className="table-subtext">{l.stall?.section || ''}</div></td>
                      <td>{l.stall?.vendor?.full_name || 'N/A'}</td>
                      <td>
                        <button
                          type="button"
                          className="coords-map-trigger"
                          onClick={() => setViewingMap(l)}
                          title="View this pin on a map"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {Number(l.lat).toFixed(6)}, {Number(l.lng).toFixed(6)}
                        </button>
                      </td>
                      <td>{l.accuracy_meters != null ? `±${Math.round(l.accuracy_meters)}m` : (l.manually_adjusted ? 'Manual' : 'N/A')}</td>
                      <td style={{ textTransform: 'capitalize' }}>{l.captured_by || 'N/A'}</td>
                      <td><span className={`status-badge ${needsReview ? 'status-pending' : 'status-completed'}`}>{needsReview ? 'Needs Review' : 'Verified'}</span></td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn btn-sm btn-success" onClick={() => approve(l)} disabled={busy}>Approve</button>
                          <button className="btn btn-sm btn-danger" onClick={() => { setFlagging(l); setFlagReason(''); }} disabled={busy}>Flag / Reject</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {flagging && (
        <Modal title="Flag Location for Re-registration" onClose={() => setFlagging(null)}>
          <p style={{ marginBottom: '12px', color: 'var(--admin-text-secondary)' }}>
            {flagging.stall?.stall_name || `Stall #${flagging.stall?.stall_number}`} will be asked to re-pin their stall location. Explain why so the vendor knows what to fix.
          </p>
          <FormField label="Reason">
            <textarea
              className="form-input"
              rows={4}
              value={flagReason}
              onChange={e => setFlagReason(e.target.value)}
              placeholder="e.g. Pin lands outside the market building — please re-capture standing at your stall."
            />
          </FormField>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setFlagging(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={submitFlag} disabled={busy || !flagReason.trim()}>Notify Vendor</button>
          </div>
        </Modal>
      )}

      {viewingMap && (
        <Modal
          title={`${viewingMap.stall?.stall_name || `Stall #${viewingMap.stall?.stall_number}`} — Pin Location`}
          onClose={() => setViewingMap(null)}
          width="600px"
        >
          <p style={{ marginBottom: '12px', color: 'var(--admin-text-secondary)', fontSize: '0.9rem' }}>
            Check the pin actually lands inside or right next to the market building — that's what "verified" is standing for.
          </p>
          <div style={{ borderRadius: 'var(--admin-radius)', overflow: 'hidden', border: '1px solid var(--admin-border)' }}>
            <iframe
              title="Stall pin location"
              width="100%"
              height="360"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
              src={`https://www.google.com/maps?q=${viewingMap.lat},${viewingMap.lng}&z=18&output=embed`}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setViewingMap(null)}>Close</button>
            <a
              className="btn btn-primary"
              href={`https://www.google.com/maps/search/?api=1&query=${viewingMap.lat},${viewingMap.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==================== PRODUCT CATEGORIES ==================== */
function ProductCategories() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stallFilter, setStallFilter] = useState('');

  const load = useCallback(async () => {
    const [p, c, s, ph] = await Promise.all([
      supabase.from('products').select('*, stall:stall_id(stall_name, stall_number)').order('name'),
      supabase.from('product_categories').select('*').order('name'),
      supabase.from('stalls').select('id, stall_name, stall_number').order('stall_number'),
      supabase.from('price_history').select('*').order('changed_at', { ascending: false }),
    ]);
    // First row per product after ordering by changed_at desc = most recent change.
    const histByProduct = {};
    (ph.data || []).forEach(h => { if (!histByProduct[h.product_id]) histByProduct[h.product_id] = h; });
    setProducts((p.data || []).map(prod => ({
      ...prod,
      price_history: histByProduct[prod.id] ? [histByProduct[prod.id]] : [],
    })));
    setCategories(c.data || []);
    setStalls(s.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
        const matchCategory = !categoryFilter || (p.category || '').toLowerCase() === categoryFilter.toLowerCase();
    // Coerce both sides to strings to avoid bigint/string comparison mismatches
    const matchStall = !stallFilter || String(p.stall_id) === String(stallFilter);
    return matchSearch && matchCategory && matchStall;
  });

  // Case/whitespace-insensitive dedupe so "Meat" and "meat" collapse to one
  const catOptions = [...new Set(
    [...categories.map(c => c.name), ...products.map(p => p.category).filter(Boolean)]
      .map(c => c.trim())
  )].sort((a, b) => a.localeCompare(b));

  const uniqueCatOptions = Object.values(
    catOptions.reduce((acc, c) => { acc[c.toLowerCase()] = c; return acc; }, {})
  );

  const handlePrint = () => {
    generatePdf({
      title: 'Product Report',
      subtitle: `Products${categoryFilter ? ` — ${categoryFilter}` : ''} (${filtered.length} records)`,
      headers: ['Product', 'Category', 'Stall', 'Price', 'Last Updated', 'Status'],
      rows: filtered.map(p => {
        const lastUpdate = p.price_history?.[0]?.changed_at || p.updated_at || null;
        return [p.name, categoryLabel(p.category), p.stall?.stall_name || `Stall #${p.stall?.stall_number}` || 'N/A', `₱${PH(p.price)}`, lastUpdate ? PH_DATETIME(lastUpdate) : 'N/A', p.is_available === false ? 'Not Available' : 'Available'];
      }),
      filename: printFilename('products', categoryFilter),
      summary: [`Total Products: ${filtered.length}`],
    });
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">Product Categories</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products..." />
        <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={uniqueCatOptions.map(c => ({ value: c, label: categoryLabel(c) }))} placeholder="All Categories" />
        <FilterSelect value={stallFilter} onChange={setStallFilter} options={stalls.map(s => ({ value: s.id, label: s.stall_name || s.stall_number || `Stall #${s.stall_number}` }))} placeholder="All Stalls" />
        <button className="btn btn-secondary" onClick={handlePrint}>Print</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Category</th><th>Stall</th><th>Price</th><th>Last Updated</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="6"><EmptyState message="No products found" /></td></tr>
              : filtered.map(p => {
                const lastUpdate = p.price_history?.[0]?.changed_at || p.updated_at || null;
                return (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td><span className="status-badge status-confirmed">{categoryLabel(p.category)}</span></td>
                  <td>{p.stall?.stall_name || p.stall?.stall_number || `Stall #${p.stall?.stall_number}` || 'N/A'}</td>
                  <td style={{ fontWeight: 700 }}>₱{PH(p.price)}</td>
                  <td>{lastUpdate ? PH_DATETIME(lastUpdate) : 'N/A'}</td>
                  {/* A palengke doesn't track live stock counts — the vendor's own
                      is_available toggle (set in the vendor app) is the real signal. */}
                  <td><span className={`status-badge ${p.is_available === false ? 'status-cancelled' : 'status-completed'}`}>{p.is_available === false ? 'Not Available' : 'Available'}</span></td>
                </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== PRICE MONITORING ==================== */
function PriceMonitor() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stallFilter, setStallFilter] = useState('');
  const [stalls, setStalls] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [graphRange, setGraphRange] = useState('week');
  const [graphData, setGraphData] = useState([]);

    const load = useCallback(async () => {
    try {
      const [p, s, ph] = await Promise.all([
        supabase.from('products').select('*, stall:stall_id(stall_name, stall_number)').order('name'),
        supabase.from('stalls').select('id, stall_name, stall_number').order('stall_number'),
        supabase.from('price_history').select('*').order('changed_at', { ascending: false }),
      ]);
      if (p.error) throw p.error;
      if (s.error) throw s.error;
      // price_history failing shouldn't block the whole page (products/stalls
      // still render), but it silently swallowing into an empty result made
      // a real query failure look identical to "no price history yet".
      if (ph.error) {
        console.error('PriceMonitor price_history load error:', ph.error.message);
        toast({ message: `Could not load price history: ${ph.error.message}`, type: 'error' });
      }
      const histByProduct = {};
      (ph.data || []).forEach(h => { if (!histByProduct[h.product_id]) histByProduct[h.product_id] = h; });
      const productsWithHistory = (p.data || []).map(prod => ({
        ...prod,
        price_history: histByProduct[prod.id] ? [histByProduct[prod.id]] : [],
      }));
      setProducts(productsWithHistory);
      setStalls(s.data || []);
    } catch (err) {
      console.error('PriceMonitor load error:', err.message);
      setProducts([]);
      setStalls([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const categories = Object.values(
    products.map(p => p.category).filter(Boolean)
      .reduce((acc, c) => {
        const k = c.trim().toLowerCase();
        if (!acc[k]) acc[k] = c.trim();
        return acc;
      }, {})
  ).sort((a, b) => a.localeCompare(b));

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
        const matchCategory = !categoryFilter || (p.category || '').toLowerCase() === categoryFilter.toLowerCase();
    // Coerce both sides to strings to avoid bigint/string comparison mismatches
    const matchStall = !stallFilter || String(p.stall_id) === String(stallFilter);
    return matchSearch && matchCategory && matchStall;
  });

  const viewProduct = async (product) => {
    setSelectedProduct(product);
    const { data: history } = await supabase.from('price_history').select('*').eq('product_id', product.id).order('changed_at', { ascending: true });
    setPriceHistory(history || []);
    buildGraphData(history || [], graphRange);
  };

  const buildGraphData = (history, range) => {
    if (!history || history.length === 0) { setGraphData([]); return; }
    const now = new Date();
    let startDate;
    if (range === 'week') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (range === 'month') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const filteredHistory = history.filter(h => new Date(h.changed_at) >= startDate);
    setGraphData(filteredHistory.map(h => ({
      date: new Date(h.changed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      price: parseFloat(h.new_price || 0),
    })));
  };

  const changeRange = (range) => {
    setGraphRange(range);
    buildGraphData(priceHistory, range);
  };

  const handlePrint = () => {
    generatePdf({
      title: 'Price Monitoring Report',
      subtitle: `Current product prices${categoryFilter ? ` — ${categoryFilter}` : ''} (${filtered.length} records)`,
      headers: ['Product', 'Category', 'Stall', 'Price', 'Last Updated', 'Status'],
      rows: filtered.map(p => {
        const lastUpdate = p.price_history?.[0]?.changed_at || p.updated_at || null;
        return [p.name, categoryLabel(p.category), p.stall?.stall_name || `Stall #${p.stall?.stall_number}` || 'N/A', `₱${PH(p.price)}`, lastUpdate ? PH_DATETIME(lastUpdate) : 'N/A', p.is_available === false ? 'Not Available' : 'Available'];
      }),
      filename: printFilename('price_monitoring', categoryFilter),
      summary: [`Total Products: ${filtered.length}`],
    });
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">Price Monitoring</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products..." />
        <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={categories.map(c => ({ value: c, label: c }))} placeholder="All Categories" />
        <FilterSelect value={stallFilter} onChange={setStallFilter} options={stalls.map(s => ({ value: s.id, label: s.stall_name || s.stall_number || `Stall #${s.stall_number}` }))} placeholder="All Stalls" />
        <button className="btn btn-secondary" onClick={handlePrint}>Print</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Category</th><th>Stall</th><th>Price</th><th>Last Updated</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="7"><EmptyState message="No products found" /></td></tr>
              : filtered.map(p => {
                const lastUpdate = p.price_history?.[0]?.changed_at || p.updated_at || null;
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td><span className="status-badge status-confirmed">{categoryLabel(p.category)}</span></td>
                    <td>{p.stall?.stall_name || `Stall #${p.stall?.stall_number}` || 'N/A'}</td>
                    <td style={{ fontWeight: 700 }}>₱{PH(p.price)}</td>
                    <td>{lastUpdate ? PH_DATETIME(lastUpdate) : 'N/A'}</td>
                    {/* A palengke doesn't track live stock counts — the vendor's own
                        is_available toggle (set in the vendor app) is the real signal. */}
                    <td><span className={`status-badge ${p.is_available === false ? 'status-cancelled' : 'status-completed'}`}>{p.is_available === false ? 'Not Available' : 'Available'}</span></td>
                    <td><button className="btn btn-sm btn-primary" onClick={() => viewProduct(p)}>View History</button></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {selectedProduct && (
        <Modal title={`Price History - ${selectedProduct.name}`} onClose={() => setSelectedProduct(null)} width="800px">
          <div className="graph-range-buttons">
            <button className={`btn btn-sm ${graphRange === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => changeRange('week')}>Last Week</button>
            <button className={`btn btn-sm ${graphRange === 'month' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => changeRange('month')}>Last Month</button>
            <button className={`btn btn-sm ${graphRange === 'year' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => changeRange('year')}>Last Year</button>
          </div>
          <div style={{ height: 300, marginTop: 16 }}>
            {graphData.length === 0 ? <EmptyState message="No price history available for this period" />
              : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graphData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} domain={['auto', 'auto']} />
                    <Tooltip formatter={(v) => [`₱${PH(v)}`, 'Price']} />
                    <Legend />
                    <Line type="monotone" dataKey="price" stroke="#DC2626" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
          </div>
          <div className="admin-table-wrap" style={{ marginTop: 20 }}>
            <table className="admin-table">
              <thead><tr><th>Date</th><th>Previous Price</th><th>New Price</th><th>Change</th></tr></thead>
              <tbody>
                {priceHistory.length === 0 ? <tr><td colSpan="4"><EmptyState message="No price history recorded" /></td></tr>
                  : priceHistory.map(h => {
                    const diff = parseFloat(h.new_price || 0) - parseFloat(h.previous_price || 0);
                    const isUp = diff > 0;
                    return (
                      <tr key={h.id}>
                        <td>{PH_DATETIME(h.changed_at)}</td>
                        <td>₱{PH(h.previous_price)}</td>
                        <td>₱{PH(h.new_price)}</td>
                        <td style={{ color: isUp ? 'var(--verdict-dear-text)' : 'var(--verdict-cheap-text)', fontWeight: 700 }}>
                          {isUp ? '+' : ''}₱{PH(diff)} ({h.previous_price ? ((diff / h.previous_price) * 100).toFixed(1) : 0}%)
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==================== PRICE CHANGE HISTORY ==================== */
function PriceHistory() {
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

    const load = useCallback(async () => {
    const { data, error } = await supabase.from('price_history').select('*, product:product_id(name)').order('changed_at', { ascending: false }).limit(200);
    if (error) {
      console.warn('price_history table issue:', error.message);
      // If the price_history table doesn't exist yet in the schema, we gracefully show "No price changes recorded"
      // rather than crashing the entire Price Monitor section.
      setHistory([]);
    } else {
      setHistory(data || []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = history.filter(h => {
    const q = search.toLowerCase();
    const matchSearch = !q || (h.product?.name || '').toLowerCase().includes(q);
    const diff = parseFloat(h.new_price || 0) - parseFloat(h.previous_price || 0);
    const matchType = !typeFilter || (typeFilter === 'increase' ? diff > 0 : diff < 0);
    const matchDate = !dateFilter || (h.changed_at || '').startsWith(dateFilter);
    return matchSearch && matchType && matchDate;
  });

  const handlePrint = () => {
    generatePdf({
      title: 'Price Change History Report',
      subtitle: `Price changes${typeFilter ? ` — ${typeFilter === 'increase' ? 'Price Increase' : 'Price Decrease'}` : ''} (${filtered.length} records)`,
      headers: ['Product', 'Previous Price', 'New Price', 'Date Changed'],
      rows: filtered.map(h => [h.product?.name || 'Unknown', `₱${PH(h.previous_price)}`, `₱${PH(h.new_price)}`, PH_DATETIME(h.changed_at)]),
      filename: printFilename('price_history', typeFilter === 'increase' ? 'increase' : typeFilter === 'decrease' ? 'decrease' : ''),
      summary: [`Total Price Changes: ${filtered.length}`],
    });
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">Price Change History</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by product name..." />
        <FilterSelect value={typeFilter} onChange={setTypeFilter} options={[{ value: 'increase', label: 'Price Increase' }, { value: 'decrease', label: 'Price Decrease' }]} placeholder="All Changes" />
        <input type="date" className="admin-filter-select" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        <button className="btn btn-secondary" onClick={handlePrint}>Print</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Previous Price</th><th>New Price</th><th>Change</th><th>Date</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="5"><EmptyState message="No price changes recorded" /></td></tr>
              : filtered.map(h => {
                const diff = parseFloat(h.new_price || 0) - parseFloat(h.previous_price || 0);
                const pct = h.previous_price ? ((diff / h.previous_price) * 100).toFixed(1) : 0;
                const isUp = diff > 0;
                return (
                  <tr key={h.id}>
                    <td><strong>{h.product?.name || 'Unknown'}</strong></td>
                    <td>₱{PH(h.previous_price)}</td>
                    <td>₱{PH(h.new_price)}</td>
                    <td style={{ color: isUp ? 'var(--verdict-dear-text)' : 'var(--verdict-cheap-text)', fontWeight: 700 }}>
                      {isUp ? '▲' : '▼'} ₱{PH(Math.abs(diff))} ({pct}%)
                    </td>
                    <td>{PH_DATETIME(h.changed_at)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== PRICE ANOMALY DETECTION ==================== */
function PriceAnomaly() {
  const [anomalies, setAnomalies] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const detect = useCallback(async () => {
    setLoading(true);
    const { data: products } = await supabase.from('products').select('*, stall:stall_id(stall_name, stall_number)');
    if (!products) { setLoading(false); return; }
    const prices = products.map(p => parseFloat(p.price || 0)).filter(p => p > 0);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const stdDev = Math.sqrt(prices.reduce((s, p) => s + Math.pow(p - avg, 2), 0) / prices.length);
    const threshold = stdDev * 1.5;
    const flagged = products.filter(p => {
      const price = parseFloat(p.price || 0);
      return price > avg + threshold || price < avg - threshold;
    }).map(p => {
      const price = parseFloat(p.price || 0);
      const isHigh = price > avg;
      const deviation = ((price - avg) / avg) * 100;
      return { ...p, isHigh, deviation: Math.abs(deviation).toFixed(1) };
    });
    setAnomalies(flagged);
    setLoading(false);
  }, []);
  useEffect(() => { detect(); }, [detect]);

  const filtered = anomalies.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || (a.name || '').toLowerCase().includes(q);
    const matchType = !typeFilter || (typeFilter === 'high' ? a.isHigh : !a.isHigh);
    return matchSearch && matchType;
  });

  const handlePrint = () => {
    generatePdf({
      title: 'Price Anomaly Report',
      subtitle: `Flagged products${typeFilter ? ` — ${typeFilter === 'high' ? 'Overpriced' : 'Underpriced'}` : ''} (${filtered.length} records)`,
      headers: ['Product', 'Stall', 'Price', 'Deviation', 'Flag'],
      rows: filtered.map(p => [p.name, p.stall?.stall_name || `Stall #${p.stall?.stall_number}` || 'N/A', `₱${PH(p.price)}`, `${p.deviation}% ${p.isHigh ? 'above' : 'below'} average`, p.isHigh ? 'Overpriced' : 'Underpriced']),
      filename: printFilename('price_anomalies', typeFilter === 'high' ? 'overpriced' : typeFilter === 'low' ? 'underpriced' : ''),
      summary: [`Total Anomalies: ${filtered.length}`],
    });
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">Price Anomaly Detection</div>
      <p style={{ color: 'var(--admin-text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
        Products with prices significantly above or below the market average (statistical deviation) are flagged below.
      </p>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products..." />
        <FilterSelect value={typeFilter} onChange={setTypeFilter} options={[{ value: 'high', label: 'Overpriced' }, { value: 'low', label: 'Underpriced' }]} placeholder="All Anomalies" />
        <button className="btn btn-primary" onClick={detect} disabled={loading}>{loading ? 'Detecting...' : 'Re-run Detection'}</button>
        <button className="btn btn-secondary" onClick={handlePrint}>Print</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Stall</th><th>Price</th><th>Deviation</th><th>Flag</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="5"><EmptyState message="No anomalies detected - all prices are within normal range" /></td></tr>
              : filtered.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.stall?.stall_name || `Stall #${p.stall?.stall_number}` || 'N/A'}</td>
                  <td style={{ color: p.isHigh ? 'var(--verdict-dear-text)' : 'var(--gold-dark)', fontWeight: 700 }}>₱{PH(p.price)}</td>
                  <td>{p.deviation}% {p.isHigh ? 'above' : 'below'} average</td>
                  <td><span className={`status-badge ${p.isHigh ? 'status-cancelled' : 'status-pending'}`}>{p.isHigh ? 'Overpriced' : 'Underpriced'}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== ORDERS ==================== */
function Orders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [viewing, setViewing] = useState(null);
  const load = () => supabase
    .from('orders')
    .select('*, customer:consumer_id (full_name, email), stall:stall_id (stall_name, stall_number)')
    .order('created_at', { ascending: false }).limit(100)
    .then(({ data, error }) => {
      // Previously had no error handling at all — a failed query (RLS,
      // network blip) just left orders empty/stale with the page looking
      // like a normal "no orders" state instead of surfacing the failure.
      if (error) {
        console.error('Orders load error:', error.message);
        toast({ message: `Failed to load orders: ${error.message}`, type: 'error' });
        return;
      }
      setOrders(data || []);
    });
  useEffect(() => { load(); }, []);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const orderNum = o.order_number || String(o.id);
    const matchSearch = !q || orderNum.toLowerCase().includes(q) || (o.customer?.full_name || '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || o.status === statusFilter;
    const matchDate = !dateFilter || (o.created_at || '').startsWith(dateFilter);
    return matchSearch && matchStatus && matchDate;
  });

  const handlePrint = () => {
    const s = ORDER_STATUS[statusFilter];
    generatePdf({
      title: 'Order Monitoring Report',
      subtitle: `Orders${s ? ` — ${s.label}` : ''} (${filtered.length} records)`,
      headers: ['Order #', 'Status', 'Total', 'Date', 'Customer'],
      rows: filtered.map(o => [`#${o.order_number?.slice(-8) || String(o.id).slice(-6)}`, (ORDER_STATUS[o.status] || ORDER_STATUS.pending).label, `₱${PH(o.total_amount || o.total)}`, PH_DATETIME(o.created_at), o.customer?.full_name || 'N/A']),
      filename: printFilename('orders', s?.label),
      summary: [`Total Orders: ${filtered.length}`],
    });
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">Order Monitoring</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search order # or customer..." />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={Object.keys(ORDER_STATUS).map(k => ({ value: k, label: ORDER_STATUS[k].label }))} placeholder="All Statuses" />
        <input type="date" className="admin-filter-select" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        <button className="btn btn-secondary" onClick={handlePrint}>Print</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Order #</th><th>Status</th><th>Total</th><th>Date</th><th>Action</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="5"><EmptyState message="No orders found" /></td></tr>
              : filtered.map(o => {
                const s = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
                return (
                  <tr key={o.id}>
                    <td><strong>#{o.order_number?.slice(-8) || String(o.id).slice(-6)}</strong><div className="table-subtext">{o.customer?.full_name || ''}</div></td>
                    <td><span className={`status-badge ${s.cls}`}>{s.label}</span></td>
                    <td>₱{PH(o.total_amount || o.total)}</td>
                    <td>{PH_DATETIME(o.created_at)}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => setViewing(o)}>View Receipt</button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {viewing && (
        <Modal title={`Receipt - #${viewing.order_number?.slice(-8) || String(viewing.id).slice(-6)}`} onClose={() => setViewing(null)} width="560px">
          <div className="complaint-detail">
            <div className="complaint-detail-row"><strong>Status:</strong> <span className={`status-badge ${(ORDER_STATUS[viewing.status] || ORDER_STATUS.pending).cls}`}>{(ORDER_STATUS[viewing.status] || ORDER_STATUS.pending).label}</span></div>
            <div className="complaint-detail-row"><strong>Date:</strong> {PH_DATETIME(viewing.created_at)}</div>
            <div className="complaint-detail-row"><strong>Customer:</strong> {viewing.customer?.full_name || 'N/A'} ({viewing.customer?.email || 'N/A'})</div>
            <div className="complaint-detail-row"><strong>Stall:</strong> {viewing.stall?.stall_name || `Stall #${viewing.stall?.stall_number}` || 'N/A'}</div>
            {viewing.payment_method && (
              <div className="complaint-detail-row"><strong>Payment:</strong> {viewing.payment_method.toUpperCase()} &middot; {viewing.payment_status || 'N/A'}</div>
            )}
            {viewing.special_instructions && (
              <div className="complaint-detail-row"><strong>Notes:</strong> {viewing.special_instructions}</div>
            )}

            <div className="admin-table-wrap" style={{ marginTop: 14 }}>
              <table className="admin-table">
                <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead>
                <tbody>
                  {(viewing.items || []).length === 0
                    ? <tr><td colSpan="4">No item details recorded for this order.</td></tr>
                    : viewing.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.name}</td>
                        <td>{item.quantity} {item.unit || ''}</td>
                        <td>&#8369;{PH(item.price)}</td>
                        <td>&#8369;{PH(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="complaint-detail-row" style={{ marginTop: 12, fontSize: '1.05em' }}>
              <strong>Total:</strong> &#8369;{PH(viewing.total_amount || viewing.total)}
            </div>

            {viewing.payment_receipt_url && (
              <div style={{ marginTop: 16 }}>
                <strong>Payment Proof</strong>
                <div style={{ marginTop: 8 }}>
                  <img src={viewing.payment_receipt_url} alt="Payment receipt" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #e4d3c8' }} />
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==================== ANNOUNCEMENTS ==================== */
function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', audience: 'both', duration_days: 7 });

  const load = useCallback(async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setAnnouncements(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSaving(true);
    // Live schema: target_audience text[], priority text, expires_at timestamptz.
    // No duration_days / is_promotion / promotion_type columns exist.
    const audienceMap = {
      both: ['vendors', 'customers'],
      vendors: ['vendors'],
      customers: ['customers'],
    };
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (parseInt(form.duration_days) || 7));
    const { error } = await supabase.from('announcements').insert({
      title: form.title,
      content: form.content,
      target_audience: audienceMap[form.audience] || ['all'],
      priority: 'normal',
      expires_at: expiresAt.toISOString(),
    });
    if (error) {
      toast({ message: `Failed to create announcement: ${error.message}`, type: 'error' });
    } else {
      setSaving(false);
      setShowForm(false);
      setForm({ title: '', content: '', audience: 'both', duration_days: 7 });
      toast({ message: 'Announcement created successfully', type: 'success' });
      load();
    }
    setSaving(false);
  };

  const deleteAnnouncement = async (a) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    await supabase.from('announcements').delete().eq('id', a.id);
    await logAudit('announcement_delete', 'announcements', a.title, 'Announcement deleted');
    toast({ message: 'Announcement deleted', type: 'success' });
    load();
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">Announcements</div>
      <div className="admin-toolbar-row">
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>Create Announcement</button>
      </div>
      <div className="announcement-grid">
        {announcements.length === 0 ? <EmptyState message="No announcements yet" />
          : announcements.map(a => (
            <div key={a.id} className="announcement-card">
              <div className="announcement-card-top">
                <h4>{a.title}</h4>
              </div>
              <p>{a.content}</p>
              <div className="announcement-meta">
                <span className="badge badge-info">Audience: {(a.target_audience || []).join(', ')}</span>
                <span className="badge badge-primary">Until: {a.expires_at ? PH_DATETIME(a.expires_at) : 'No expiry'}</span>
              </div>
              <div className="announcement-footer">
                <span className="text-subtext">{PH_DATETIME(a.created_at)}</span>
                <div className="announcement-actions">
                  <button className="btn btn-sm btn-danger" onClick={() => deleteAnnouncement(a)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
      </div>

      {showForm && (
        <Modal title="Create Announcement" onClose={() => setShowForm(false)}>
          <div className="form-grid">
            <FormField label="Title">
              <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </FormField>
            <FormField label="Content">
              <textarea className="form-input" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
            </FormField>
            <FormField label="Audience">
              <select className="form-input" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}>
                <option value="both">All Users</option>
                <option value="vendors">Vendors Only</option>
                <option value="customers">Customers Only</option>
              </select>
            </FormField>
            <FormField label="Duration (days)">
              <input type="number" className="form-input" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: parseInt(e.target.value) || 7 })} />
            </FormField>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Creating...' : 'Create'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==================== COMPLAINT MANAGEMENT ==================== */
function ComplaintManagement() {
  const [complaints, setComplaints] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [resolution, setResolution] = useState('');

  const load = useCallback(async () => {
    // complaints has two FKs into profiles (user_id and resolved_by), so
    // the implicit "profiles(...)" embed is ambiguous (PGRST201) and
    // errors the whole query — has to name which FK to follow.
    const { data, error } = await supabase.from('complaints').select('*, user:profiles!complaints_user_id_fkey(full_name, email), stall:stall_id(stall_name, stall_number)').order('created_at', { ascending: false });
    if (error) {
      toast({ message: `Failed to load complaints: ${error.message}`, type: 'error' });
      return;
    }
    setComplaints(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const types = [
    { value: 'pending', label: 'Pending', cls: 'status-pending' },
    { value: 'in_progress', label: 'In Progress', cls: 'status-preparing' },
    { value: 'resolved', label: 'Resolved', cls: 'status-completed' },
    { value: 'rejected', label: 'Rejected', cls: 'status-cancelled' },
  ];

  const updateStatus = async (status) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('complaints').update({ status, resolution, resolved_by: session?.user?.id || null, resolved_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) {
      // Previously unchecked — a failed write still closed the modal,
      // cleared the typed resolution text, and showed "marked as X"
      // success, so a network/RLS hiccup silently discarded the admin's
      // notes with no indication anything went wrong.
      toast({ message: `Failed to update complaint: ${error.message}`, type: 'error' });
      return;
    }
    await logAudit('complaint_status_change', 'complaints', selected.id, `Status changed to ${status}`);
    setSelected(null);
    setResolution('');
    toast({ message: `Complaint marked as ${status}`, type: 'success' });
    load();
  };

  // There is no "subject" column — a complaint is just a free-text
  // message tied to a stall, so the row title falls back to the stall
  // name and search matches against the message body instead.
  const filtered = complaints.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || (c.message || '').toLowerCase().includes(q) || (c.user?.full_name || '').toLowerCase().includes(q) || (c.stall?.stall_name || '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handlePrint = () => {
    const t = types.find(t => t.value === statusFilter);
    generatePdf({
      title: 'Complaints Report',
      subtitle: `Complaints${t ? ` — ${t.label}` : ''} (${filtered.length} records)`,
      headers: ['Stall', 'Message', 'User', 'Status', 'Date'],
      rows: filtered.map(c => [c.stall?.stall_name || `Stall #${c.stall?.stall_number}` || 'N/A', c.message || 'No message', c.user?.full_name || 'N/A', (types.find(t => t.value === c.status) || types[0]).label, PH_DATE(c.created_at)]),
      filename: printFilename('complaints', t?.label),
      summary: [`Total Complaints: ${filtered.length}`],
    });
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">Complaint Management</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search complaints..." />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={types.map(t => ({ value: t.value, label: t.label }))} placeholder="All Statuses" />
        <button className="btn btn-secondary" onClick={handlePrint}>Print</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Stall</th><th>Message</th><th>User</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="6"><EmptyState message="No complaints found" /></td></tr>
              : filtered.map(c => {
                const t = types.find(t => t.value === c.status) || types[0];
                return (
                  <tr key={c.id}>
                    <td><strong>{c.stall?.stall_name || `Stall #${c.stall?.stall_number}` || 'N/A'}</strong></td>
                    <td style={{ maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message || 'No message'}</td>
                    <td>{c.user?.full_name || 'N/A'}</td>
                    <td><span className={`status-badge ${t.cls}`}>{t.label}</span></td>
                    <td>{PH_DATE(c.created_at)}</td>
                    <td><button className="btn btn-sm btn-primary" onClick={() => setSelected(c)}>View</button></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {selected && (
        <Modal title="Complaint Details" onClose={() => setSelected(null)} width="700px">
          <div className="complaint-detail">
            <div className="complaint-detail-row"><strong>Stall:</strong> {selected.stall?.stall_name || `Stall #${selected.stall?.stall_number}` || 'N/A'}</div>
            <div className="complaint-detail-row"><strong>User:</strong> {selected.user?.full_name || 'N/A'} ({selected.user?.email || 'N/A'})</div>
            <div className="complaint-detail-row"><strong>Status:</strong> {types.find(t => t.value === selected.status)?.label || selected.status}</div>
            <div className="complaint-detail-row"><strong>Date:</strong> {PH_DATETIME(selected.created_at)}</div>
            <div className="complaint-description">
              <strong>Message:</strong><br />
              {selected.message || 'No message provided.'}
            </div>
            {selected.resolution && (
              <div className="complaint-description">
                <strong>Previous Resolution Notes:</strong><br />
                {selected.resolution}
              </div>
            )}
            <FormField label="Resolution">
              <textarea className="form-input" value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Enter resolution details..." />
            </FormField>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
              {types.map(t => (
                <button key={t.value} className={`btn btn-sm ${t.value === 'resolved' ? 'btn-success' : t.value === 'rejected' ? 'btn-danger' : 'btn-primary'}`} onClick={() => updateStatus(t.value)}>{t.label}</button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==================== CHAT ==================== */
function Chat() {
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [myId, setMyId] = useState(null);
  const imgInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Store the current admin's user id to identify own sent messages
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setMyId(data?.session?.user?.id || null);
    });
  }, []);

  // Load conversations from the database (vendors AND customers)
  const loadConvs = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, customer:customer_id(id, full_name, email), stall:stall_id(id, stall_name, stall_number, vendor_id)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const list = data || [];
      // Fetch vendor names for stalls that have an assigned vendor
      const vendorIds = [...new Set(list.map(c => c.stall?.vendor_id).filter(Boolean))];
      let vendorMap = {};
      if (vendorIds.length) {
        const { data: vendors } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', vendorIds);
        (vendors || []).forEach(v => { vendorMap[v.id] = v; });
      }
      setConvs(list.map(c =>
        c.stall?.vendor_id
          ? { ...c, stall: { ...c.stall, vendor: vendorMap[c.stall.vendor_id] || null } }
          : c
      ));
    } catch (err) {
      toast({ message: 'Failed to load conversations: ' + (err.message || 'Unknown error'), type: 'error' });
    } finally {
      setLoadingConvs(false);
    }
  }, []);
  useEffect(() => { loadConvs(); }, [loadConvs]);

  // Filter conversations by search query
  const filtered = convs.filter(c => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const haystack = [
      c.customer?.full_name,
      c.customer?.email,
      c.stall?.stall_name,
      c.stall?.vendor?.full_name,
      c.stall?.vendor?.email,
      String(c.stall?.stall_number || ''),
      c.last_message,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });

  const convName = (c) =>
    c?.stall?.vendor?.full_name || c?.customer?.full_name || c?.stall?.stall_name || 'User';

  const convSub = (c) => {
    const parts = [];
    if (c?.stall?.stall_name) parts.push(c.stall.stall_name);
    if (c?.stall?.vendor?.full_name) parts.push('Vendor');
    if (c?.customer?.full_name) parts.push('Customer');
    return parts.join(' • ') || 'Conversation';
  };

  const convAvatar = (c) => (convName(c).charAt(0) || '?').toUpperCase();

  async function loadMsgs(id) {
    setActive(id);
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    setMsgs(data || []);
    setLoadingMsgs(false);
    setTimeout(() => {
      const el = document.querySelector('.chat-messages-scroll');
      if (el) el.scrollTop = el.scrollHeight;
    }, 100);
  }

  async function send() {
    if (!input.trim() || !active || sending) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error: insertError } = await supabase.from('messages').insert({
        conversation_id: active,
        sender_id: session.user.id,
        sender_role: 'admin',
        message: input,
        is_image: false,
      });
      if (insertError) throw insertError;

      await supabase.from('conversations').update({
        last_message: input,
        last_message_time: new Date().toISOString(),
      }).eq('id', active);

      setInput('');
      toast({ message: 'Message sent successfully', type: 'success' });
      await loadMsgs(active);
      await loadConvs();
    } catch (err) {
      console.error('Send error:', err);
      toast({ message: 'Send failed: ' + (err.message || 'Unknown error'), type: 'error' });
    } finally {
      setSending(false);
    }
  }

  // ── Send an image (uploaded to ImgBB, stored as an image message) ──
  async function sendImage(file) {
    if (!file || !active || uploadingImage) return;
    setUploadingImage(true);
    try {
      // Upload to ImgBB (same service the vendor app uses)
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: fd,
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      // ImgBB encodes the key as a query param; retry with it appended if needed
      let json;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (!json?.data?.url) {
        // Retry with key as query param (some setups reject header-encoded)
        const fd2 = new FormData();
        fd2.append('image', file);
        const res2 = await fetch('https://api.imgbb.com/1/upload?key=0f4823dff292c1d4c4a6fdcc7d0037c9', {
          method: 'POST',
          body: fd2,
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        json = await res2.json();
      }
      const imageUrl = json?.data?.url;
      if (!imageUrl) throw new Error('Image upload failed');

      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('messages').insert({
        conversation_id: active,
        sender_id: session.user.id,
        sender_role: 'admin',
        message: imageUrl,
        is_image: true,
      });
      await supabase.from('conversations').update({
        last_message: '📷 Image',
        last_message_time: new Date().toISOString(),
      }).eq('id', active);

      toast({ message: 'Image sent', type: 'success' });
      await loadMsgs(active);
      await loadConvs();
    } catch (err) {
      console.error('Send image error:', err);
      toast({ message: 'Image send failed: ' + (err.message || 'Unknown error'), type: 'error' });
    } finally {
      setUploadingImage(false);
      if (imgInputRef.current) imgInputRef.current.value = '';
    }
  }

  const activeConv = convs.find(c => c.id === active);

  return (
    <div className="admin-section">
      <div className="admin-section-header">Admin Chat</div>
      <div className="chat-container">
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <span>Conversations</span>
            <span className="chat-count-badge">{filtered.length}</span>
          </div>
          <div className="chat-search-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="chat-search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendor, customer, stall..."
            />
            {search && <button className="chat-search-clear" onClick={() => setSearch('')}>&times;</button>}
          </div>
          <div className="chat-sidebar-list">
            {loadingConvs ? (
              <div className="chat-list-loading"><Skeleton count={4} height="48px" /></div>
            ) : filtered.length === 0 ? (
              <div className="chat-empty">No conversations found</div>
            ) : filtered.map(c => (
              <div key={c.id} className={`chat-conv-item${active === c.id ? ' active' : ''}`} onClick={() => loadMsgs(c.id)}>
                <div className="chat-conv-avatar">{convAvatar(c)}</div>
                <div className="chat-conv-info">
                  <div className="chat-conv-name">{convName(c)}</div>
                  <div className="chat-conv-preview">{c.last_message || 'No messages yet'}</div>
                  <div className="chat-conv-meta">{convSub(c)}</div>
                </div>
                {c.updated_at && <div className="chat-conv-time">{new Date(c.updated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="chat-main">
          {!active ? (
            <div className="chat-empty">
 <div className="chat-empty-icon"></div>
              <div>Select a conversation to start chatting</div>
              <span className="chat-empty-sub">Messages are fetched live from the database</span>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <div className="chat-header-avatar">{convAvatar(activeConv)}</div>
                <div className="chat-header-info">
                  <div className="chat-header-name">{convName(activeConv)}</div>
                  <div className="chat-header-sub">{convSub(activeConv)}</div>
                </div>
                <button className="refresh-btn" onClick={loadConvs} disabled={loadingConvs} title="Refresh conversations">
                  <span className={loadingConvs ? 'refreshing' : ''}>↻</span>
                </button>
              </div>
              <div className="chat-messages chat-messages-scroll">
                {loadingMsgs ? (
                  <div className="chat-list-loading"><Skeleton count={3} height="52px" /></div>
                ) : msgs.length === 0 ? (
 <div className="chat-empty">No messages yet. Say hello! </div>
                ) : msgs.map((m, idx) => {
                  const prev = msgs[idx - 1];
                  const showDate = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                  const mine = m.sender_id === myId;
                  return (
                    <div key={m.id} className="chat-message-block">
                      {showDate && (
                        <div className="chat-date-divider">
                          <span>{new Date(m.created_at).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        </div>
                      )}
                      <div className={`chat-msg ${mine ? 'chat-msg-sent' : 'chat-msg-received'}`}>
                        {!mine && <div className="chat-sender-label">{m.sender_role || 'Customer'}</div>}
                        {m.is_image ? (
                          <img src={m.message} alt="Shared" className="chat-msg-image" />
                        ) : (
                          m.message
                        )}
                        <div className="chat-msg-time">
                          {new Date(m.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                          {mine && <span className="chat-msg-read"> ✓</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="chat-input-bar">
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    if (f) sendImage(f);
                  }}
                />
                <button
                  type="button"
                  className="chat-attach-btn"
                  onClick={() => imgInputRef.current && imgInputRef.current.click()}
                  disabled={!active || uploadingImage}
                  title="Send an image"
                >
                  {uploadingImage ? '⏳' : '📷'}
                </button>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !sending && send()}
                  placeholder="Type a message..."
                />
                <button onClick={send} disabled={sending || !input.trim()}>
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== REPORTS & AUDIT (unified module) ==================== */
function ReportsAndAudit() {
  const [subTab, setSubTab] = useState('analytics');

  return (
    <div className="admin-section reports-audit-module">
      <div className="reports-audit-header">
        <div className="admin-section-header reports-audit-title">Reports &amp; Audit</div>
        <div className="report-tabs" role="tablist" aria-label="Reports and Audit sections">
          <button
            role="tab"
            aria-selected={subTab === 'analytics'}
            className={`report-tab${subTab === 'analytics' ? ' active' : ''}`}
            onClick={() => setSubTab('analytics')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Analytics Reports
          </button>
          <button
            role="tab"
            aria-selected={subTab === 'audit'}
            className={`report-tab${subTab === 'audit' ? ' active' : ''}`}
            onClick={() => setSubTab('audit')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Audit Logs
          </button>
        </div>
      </div>
      {subTab === 'analytics' ? <AnalyticsReports /> : <AuditLogs />}
    </div>
  );
}

/* ==================== AUDIT LOGS (sub-tab) ==================== */
function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('audit_log').select('*, user:profiles(full_name)').order('created_at', { ascending: false }).limit(200);
    if (error) {
      console.error('AuditLogs load error:', error.message);
      toast({ message: `Failed to load audit logs: ${error.message}`, type: 'error' });
      return;
    }
    setLogs(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || (l.action || '').toLowerCase().includes(q) || (l.details || '').toLowerCase().includes(q) || (l.user?.full_name || '').toLowerCase().includes(q);
    const matchAction = !actionFilter || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  const actionTypes = [...new Set(logs.map(l => l.action).filter(Boolean))];

  return (
    <>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by action or details..." />
        <FilterSelect value={actionFilter} onChange={setActionFilter} options={actionTypes.map(a => ({ value: a, label: a }))} placeholder="All Actions" />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Timestamp</th><th>Action</th><th>Table</th><th>Record</th><th>Details</th><th>User</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="6"><EmptyState message="No audit logs found" /></td></tr>
              : filtered.map(l => (
                <tr key={l.id}>
                  <td>{PH_DATETIME(l.created_at)}</td>
                  <td><span className="badge badge-primary">{l.action}</span></td>
                  <td>{l.table_name || 'N/A'}</td>
                  <td>{l.record_id || 'N/A'}</td>
                  <td>{l.details || 'N/A'}</td>
                  <td>{l.user?.full_name || 'System'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ==================== ANALYTICS REPORTS (sub-tab) ==================== */
function AnalyticsReports() {
  const [products, setProducts] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [exporting, setExporting] = useState(null);
  // Each report card gets its own independent filter — setting a category
  // on Product Price Report shouldn't silently narrow what Product
  // Performance exports next, so these live in one object keyed by report
  // rather than sharing state across cards.
  const [filters, setFilters] = useState({
    products: '', priceHistory: '', pricePerProduct: '', productPerformance: '',
    stalls: '', orders: '', sales: '', vendorPerformance: '', customerAnalytics: '',
  });
  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, o, ph] = await Promise.all([
        supabase.from('products').select('*, stall:stall_id(stall_name, stall_number)').order('name'),
        supabase.from('stalls').select('*, vendor:profiles(full_name, email)').order('stall_number'),
        supabase.from('orders').select('*, customer:consumer_id(full_name, email), stall:stall_id(stall_name, stall_number, section)').order('created_at', { ascending: false }).limit(1000),
        supabase.from('price_history').select('*, product:product_id(name, category)').order('changed_at', { ascending: false }).limit(500),
      ]);
      setProducts(p.data || []);
      setStalls(s.data || []);
      setOrders(o.data || []);
      // There is no order_items table — line items live as a JSONB
      // `items` array embedded on each order. Flatten completed orders'
      // items here so calculateProductPerformance has real data instead
      // of the permanently-empty result the missing table always gave it.
      setOrderItems((o.data || []).filter(x => x.status === 'completed').flatMap(x => x.items || []));
      setPriceHistory(ph.data || []);
      // Sales data
      const completed = (o.data || []).filter(x => x.status === 'completed');
      const byDate = {};
      completed.forEach(x => {
        const d = (x.created_at || '').split('T')[0];
        byDate[d] = (byDate[d] || 0) + parseFloat(x.total_amount || 0);
      });
      setSales(Object.entries(byDate).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date)));
      toast({ message: 'Report data loaded from database', type: 'success' });
    } catch (err) {
      toast({ message: 'Failed to load report data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  // Category/section-insensitive-dedupe, matching the pattern already used
  // in ProductCategories — "Meat" and "meat" collapse to one option.
  const dedupeCaseInsensitive = (values) => Object.values(
    [...new Set(values.filter(Boolean).map(v => v.trim()))]
      .reduce((acc, v) => { acc[v.toLowerCase()] = v; return acc; }, {})
  ).sort((a, b) => a.localeCompare(b));

  const categoryOptions = dedupeCaseInsensitive(products.map(p => p.category));
  const sectionOptions = dedupeCaseInsensitive(stalls.map(s => s.section));

  // Apply date range filter to orders
  const getFilteredOrders = () => {
    let filtered = [...orders];
    if (dateRange === 'custom' && customStart && customEnd) {
      // customEnd is a bare YYYY-MM-DD from <input type="date">, which
      // parses to 00:00:00.000 — comparing against that excluded almost
      // the entire end day (everything ordered after midnight), unlike
      // the preset-range branch below which correctly extends to 23:59:59.
      const endOfDay = new Date(customEnd);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(o => {
        const d = new Date(o.created_at || '');
        return d >= new Date(customStart) && d <= endOfDay;
      });
    } else if (dateRange !== 'all') {
      const { startDate, endDate } = getDateRangePreset(dateRange);
      if (startDate && endDate) {
        filtered = filtered.filter(o => {
          const d = new Date(o.created_at || '');
          return d >= new Date(startDate) && d <= new Date(endDate);
        });
      }
    }
    return filtered;
  };

  const filteredOrders = getFilteredOrders();
  const filteredCompleted = filteredOrders.filter(o => o.status === 'completed');
  const filteredSales = (() => {
    const byDate = {};
    filteredCompleted.forEach(x => {
      const d = (x.created_at || '').split('T')[0];
      byDate[d] = (byDate[d] || 0) + parseFloat(x.total_amount || 0);
    });
    return Object.entries(byDate).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date));
  })();

  // Applies the category-shaped reports' filter (case-insensitive, "" = all).
  const byCategory = (list, filterKey) => filters[filterKey]
    ? list.filter(x => (x.category || '').toLowerCase() === filters[filterKey].toLowerCase())
    : list;
  // Applies the section-shaped reports' filter, against either a stall row
  // itself (`.section`) or a row that carries a joined `.stall.section`.
  const bySection = (list, filterKey, getSection) => filters[filterKey]
    ? list.filter(x => (getSection(x) || '').toLowerCase() === filters[filterKey].toLowerCase())
    : list;

  const handleExport = async (type) => {
    setExporting(type);
    try {
      if (type === 'products-pdf') {
        const scoped = byCategory(products, 'products');
        const rows = scoped.map(p => [p.name, categoryLabel(p.category), p.stall?.stall_name || 'N/A', `₱${PH(p.price)}`, p.is_available === false ? 'Not Available' : 'Available']);
        generatePdf({
          title: 'Product Price Report',
          subtitle: `Complete list of products and their current prices${filters.products ? ` — ${filters.products}` : ''} (${formatDateRange(customStart, customEnd)})`,
          headers: ['Product', 'Category', 'Stall', 'Price', 'Availability'],
          rows,
          filename: `palengkehub_products_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Products: ${scoped.length}`, `Generated by PalengkeHub Admin`],
        });
        toast({ message: 'Product Price Report generated successfully', type: 'success' });
      } else if (type === 'products-csv') {
        const scoped = byCategory(products, 'products');
        exportToCSV({
          data: scoped.map(p => ({ ...p, availability: p.is_available === false ? 'Not Available' : 'Available', stall_name: p.stall?.stall_name || 'N/A' })),
          filename: `palengkehub_products_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['name', 'category', 'price', 'availability', 'stall_name'],
        });
        toast({ message: 'Product data exported to CSV', type: 'success' });
      } else if (type === 'stalls-pdf') {
        const scoped = bySection(stalls, 'stalls', s => s.section);
        const rows = scoped.map(s => [s.stall_name || `Stall #${s.stall_number}`, s.stall_number, s.section || 'N/A', s.floor || 'N/A', s.location || 'N/A', s.vendor?.full_name || 'Unassigned', s.is_active ? 'Active' : 'Inactive']);
        generatePdf({
          title: 'Stall Report',
          subtitle: `Complete list of market stalls${filters.stalls ? ` — ${filters.stalls}` : ''}`,
          headers: ['Stall Name', 'Number', 'Section', 'Floor', 'Location', 'Vendor', 'Status'],
          rows,
          filename: `palengkehublog_stalls_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Stalls: ${scoped.length}`, `Active: ${scoped.filter(s => s.is_active).length}`, `Inactive: ${scoped.filter(s => !s.is_active).length}`],
        });
        toast({ message: 'Stall Report generated successfully', type: 'success' });
      } else if (type === 'stalls-csv') {
        const scoped = bySection(stalls, 'stalls', s => s.section);
        exportToCSV({
          data: scoped,
          filename: `palengkehublog_stalls_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['stall_name', 'stall_number', 'section', 'floor', 'location', 'is_active'],
        });
        toast({ message: 'Stall data exported to CSV', type: 'success' });
      } else if (type === 'orders-pdf') {
        const scoped = bySection(filteredOrders, 'orders', o => o.stall?.section);
        const scopedCompleted = scoped.filter(o => o.status === 'completed');
        const rows = scoped.map(o => [`#${o.order_number?.slice(-8) || String(o.id).slice(-6)}`, o.status, `₱${PH(o.total_amount || o.total)}`, PH_DATE(o.created_at), o.customer?.full_name || 'N/A', o.stall?.stall_name || 'N/A']);
        generatePdf({
          title: 'Order Report',
          subtitle: `All orders${filters.orders ? ` — ${filters.orders}` : ''} (${scoped.length} records)`,
          headers: ['Order #', 'Status', 'Total', 'Date', 'Customer', 'Stall'],
          rows,
          filename: `palengkehublog_orders_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Orders: ${scoped.length}`, `Total Revenue: ₱${PH(scopedCompleted.reduce((s, o) => s + parseFloat(o.total_amount || o.total || 0), 0))}`],
        });
        toast({ message: 'Order Report generated successfully', type: 'success' });
      } else if (type === 'orders-csv') {
        const scoped = bySection(filteredOrders, 'orders', o => o.stall?.section);
        exportToCSV({
          data: scoped,
          filename: `palengkehublog_orders_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['order_number', 'status', 'total_amount', 'created_at', 'customer_name', 'stall_name'],
        });
        toast({ message: 'Order data exported to CSV', type: 'success' });
      } else if (type === 'sales-pdf') {
        const scopedCompleted = bySection(filteredCompleted, 'sales', o => o.stall?.section);
        const scopedSales = (() => {
          const byDate = {};
          scopedCompleted.forEach(x => {
            const d = (x.created_at || '').split('T')[0];
            byDate[d] = (byDate[d] || 0) + parseFloat(x.total_amount || 0);
          });
          return Object.entries(byDate).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date));
        })();
        const rows = scopedSales.map(s => [s.date, `₱${PH(s.total)}`]);
        generatePdf({
          title: 'Sales Report',
          subtitle: `Completed sales by date${filters.sales ? ` — ${filters.sales}` : ''} (${scopedCompleted.length} transactions)`,
          headers: ['Date', 'Total Sales'],
          rows,
          filename: `palengkehublog_sales_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Sales: ₱${PH(scopedSales.reduce((s, x) => s + x.total, 0))}`, `Total Transactions: ${scopedCompleted.length}`],
        });
        toast({ message: 'Sales Report generated successfully', type: 'success' });
      } else if (type === 'sales-csv') {
        const scopedCompleted = bySection(filteredCompleted, 'sales', o => o.stall?.section);
        const scopedSales = (() => {
          const byDate = {};
          scopedCompleted.forEach(x => {
            const d = (x.created_at || '').split('T')[0];
            byDate[d] = (byDate[d] || 0) + parseFloat(x.total_amount || 0);
          });
          return Object.entries(byDate).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date));
        })();
        exportToCSV({
          data: scopedSales,
          filename: `palengkehublog_sales_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['date', 'total'],
        });
        toast({ message: 'Sales data exported to CSV', type: 'success' });
      } else if (type === 'price-history-pdf') {
        const scoped = byCategory(priceHistory.map(h => ({ ...h, category: h.product?.category })), 'priceHistory');
        const rows = scoped.map(h => [h.product?.name || 'Unknown', `₱${PH(h.previous_price)}`, `₱${PH(h.new_price)}`, PH_DATETIME(h.changed_at)]);
        generatePdf({
          title: 'Price Change Report',
          subtitle: `Historical price changes per product${filters.priceHistory ? ` — ${filters.priceHistory}` : ''}`,
          headers: ['Product', 'Previous Price', 'New Price', 'Date Changed'],
          rows,
          filename: `palengkehublog_price_changes_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Price Changes: ${scoped.length}`],
        });
        toast({ message: 'Price Change Report generated successfully', type: 'success' });
      } else if (type === 'price-history-csv') {
        const scoped = byCategory(priceHistory.map(h => ({ ...h, category: h.product?.category, product_name: h.product?.name })), 'priceHistory');
        exportToCSV({
          data: scoped,
          filename: `palengkehublog_price_changes_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['product_name', 'previous_price', 'new_price', 'changed_at'],
        });
        toast({ message: 'Price history exported to CSV', type: 'success' });
      } else if (type === 'price-per-product-pdf') {
        const scoped = byCategory(products, 'pricePerProduct');
        const rows = scoped.map(p => [p.name, categoryLabel(p.category), `₱${PH(p.price)}`, p.stall?.stall_name || 'N/A']);
        generatePdf({
          title: 'Price Per Product Report',
          subtitle: `Current price of each product per stall${filters.pricePerProduct ? ` — ${filters.pricePerProduct}` : ''}`,
          headers: ['Product', 'Category', 'Price', 'Stall'],
          rows,
          filename: `palengkehublog_price_per_product_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Products: ${scoped.length}`],
        });
        toast({ message: 'Price Per Product Report generated successfully', type: 'success' });
      } else if (type === 'vendor-performance-pdf') {
        const scopedStalls = bySection(stalls, 'vendorPerformance', s => s.section);
        const vendorPerf = calculateVendorPerformance(scopedStalls, filteredOrders);
        const rows = vendorPerf.map(v => [v.stallName, v.vendor, v.section, `₱${PH(v.totalRevenue)}`, v.orderCount, v.completedOrders]);
        generatePdf({
          title: 'Vendor Performance Report',
          subtitle: `Revenue and order count by vendor/stall${filters.vendorPerformance ? ` — ${filters.vendorPerformance}` : ''}`,
          headers: ['Stall', 'Vendor', 'Section', 'Revenue', 'Total Orders', 'Completed'],
          rows,
          filename: `palengkehublog_vendor_performance_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Vendors: ${vendorPerf.length}`, `Total Revenue: ₱${PH(vendorPerf.reduce((s, v) => s + v.totalRevenue, 0))}`],
        });
        toast({ message: 'Vendor Performance Report generated successfully', type: 'success' });
      } else if (type === 'vendor-performance-csv') {
        const scopedStalls = bySection(stalls, 'vendorPerformance', s => s.section);
        const vendorPerf = calculateVendorPerformance(scopedStalls, filteredOrders);
        exportToCSV({
          data: vendorPerf,
          filename: `palengkehublog_vendor_performance_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['stallName', 'vendor', 'section', 'totalRevenue', 'orderCount', 'completedOrders'],
        });
        toast({ message: 'Vendor performance exported to CSV', type: 'success' });
      } else if (type === 'customer-analytics-pdf') {
        const scoped = bySection(filteredOrders, 'customerAnalytics', o => o.stall?.section);
        const customerData = calculateCustomerAnalytics(scoped);
        const rows = customerData.map(c => [c.customerName, `₱${PH(c.totalSpent)}`, c.orderCount]);
        generatePdf({
          title: 'Customer Analytics Report',
          subtitle: `Top customers by total spending${filters.customerAnalytics ? ` — ${filters.customerAnalytics}` : ''}`,
          headers: ['Customer', 'Total Spent', 'Order Count'],
          rows,
          filename: `palengkehublog_customer_analytics_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Customers: ${customerData.length}`, `Total Revenue: ₱${PH(customerData.reduce((s, c) => s + c.totalSpent, 0))}`],
        });
        toast({ message: 'Customer Analytics Report generated successfully', type: 'success' });
      } else if (type === 'customer-analytics-csv') {
        const scoped = bySection(filteredOrders, 'customerAnalytics', o => o.stall?.section);
        const customerData = calculateCustomerAnalytics(scoped);
        exportToCSV({
          data: customerData,
          filename: `palengkehublog_customer_analytics_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['customerName', 'totalSpent', 'orderCount'],
        });
        toast({ message: 'Customer analytics exported to CSV', type: 'success' });
      } else if (type === 'product-performance-pdf') {
        const scoped = byCategory(products, 'productPerformance');
        const productPerf = calculateProductPerformance(scoped, orderItems);
        const rows = productPerf.map(p => [p.name, categoryLabel(p.category), `₱${PH(p.totalRevenue)}`, p.totalSold, p.orderCount]);
        generatePdf({
          title: 'Product Performance Report',
          subtitle: `Top selling products by revenue${filters.productPerformance ? ` — ${filters.productPerformance}` : ''}`,
          headers: ['Product', 'Category', 'Revenue', 'Units Sold', 'Orders'],
          rows,
          filename: `palengkehublog_product_performance_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Products Sold: ${productPerf.length}`, `Total Revenue: ₱${PH(productPerf.reduce((s, p) => s + p.totalRevenue, 0))}`],
        });
        toast({ message: 'Product Performance Report generated successfully', type: 'success' });
      } else if (type === 'product-performance-csv') {
        const scoped = byCategory(products, 'productPerformance');
        const productPerf = calculateProductPerformance(scoped, orderItems);
        exportToCSV({
          data: productPerf,
          filename: `palengkehublog_product_performance_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['name', 'category', 'totalRevenue', 'totalSold', 'orderCount'],
        });
        toast({ message: 'Product performance exported to CSV', type: 'success' });
      }
    } catch (err) {
      toast({ message: `Export failed: ${err.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setExporting(null);
    }
  };

  const orderStats = calculateOrderStats(filteredOrders);

  return (
    <>
      <p className="reports-audit-intro">
          Generate professional PDF or CSV reports with the PalengkeHub branding. All data is fetched directly from the database.
          Use the date range filter to narrow down report data.
        </p>
        <div className="admin-toolbar-row">
          <div className="date-range-picker">
            <label>Date Range:</label>
            <select className="admin-filter-select" value={dateRange} onChange={e => { setDateRange(e.target.value); if (e.target.value !== 'custom') { setCustomStart(''); setCustomEnd(''); } }}>
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
              <option value="year">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>
            {dateRange === 'custom' && (
              <>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </>
            )}
          </div>
          <button className="refresh-btn" onClick={loadData} disabled={loading}>
            <span className={loading ? 'refreshing' : ''}>Refresh</span> Data
          </button>
        </div>

        <div className="report-summary-bar">
          <div className="report-summary-item">
            <div className="value">₱{PH(orderStats.totalRevenue)}</div>
            <div className="label">Total Revenue</div>
          </div>
          <div className="report-summary-item">
            <div className="value">{orderStats.totalOrders}</div>
            <div className="label">Total Orders</div>
          </div>
          <div className="report-summary-item">
            <div className="value">{orderStats.completedOrders}</div>
            <div className="label">Completed</div>
          </div>
          <div className="report-summary-item">
            <div className="value">{orderStats.pendingOrders}</div>
            <div className="label">Pending</div>
          </div>
          <div className="report-summary-item">
            <div className="value">₱{PH(orderStats.avgOrderValue)}</div>
            <div className="label">Avg Order</div>
          </div>
        </div>

        <div className="report-grid">
          <div className="report-card">
            <h4>Product Price Report</h4>
            <p>Complete list of all products with current prices and availability.</p>
            <FilterSelect value={filters.products} onChange={v => setFilter('products', v)} options={categoryOptions.map(c => ({ value: c, label: categoryLabel(c) }))} placeholder="All Categories" />
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('products-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('products-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Stall Report</h4>
            <p>All market stalls with vendor assignments, locations, and status.</p>
            <FilterSelect value={filters.stalls} onChange={v => setFilter('stalls', v)} options={sectionOptions.map(s => ({ value: s, label: s }))} placeholder="All Sections" />
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('stalls-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('stalls-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Order Report</h4>
            <p>All orders with status, totals, and transaction dates.</p>
            <FilterSelect value={filters.orders} onChange={v => setFilter('orders', v)} options={sectionOptions.map(s => ({ value: s, label: s }))} placeholder="All Sections" />
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('orders-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('orders-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Sales Report</h4>
            <p>Completed sales aggregated by date with revenue totals.</p>
            <FilterSelect value={filters.sales} onChange={v => setFilter('sales', v)} options={sectionOptions.map(s => ({ value: s, label: s }))} placeholder="All Sections" />
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('sales-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('sales-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Price Change Report</h4>
            <p>Historical price changes per product with timestamps.</p>
            <FilterSelect value={filters.priceHistory} onChange={v => setFilter('priceHistory', v)} options={categoryOptions.map(c => ({ value: c, label: categoryLabel(c) }))} placeholder="All Categories" />
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('price-history-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('price-history-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Price Per Product</h4>
            <p>Current price of each product per stall for market comparison.</p>
            <FilterSelect value={filters.pricePerProduct} onChange={v => setFilter('pricePerProduct', v)} options={categoryOptions.map(c => ({ value: c, label: categoryLabel(c) }))} placeholder="All Categories" />
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('price-per-product-pdf')} disabled={loading || exporting}>PDF</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Vendor Performance</h4>
            <p>Revenue and order count by vendor/stall.</p>
            <FilterSelect value={filters.vendorPerformance} onChange={v => setFilter('vendorPerformance', v)} options={sectionOptions.map(s => ({ value: s, label: s }))} placeholder="All Sections" />
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('vendor-performance-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('vendor-performance-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Customer Analytics</h4>
            <p>Top customers by total spending and order count.</p>
            <FilterSelect value={filters.customerAnalytics} onChange={v => setFilter('customerAnalytics', v)} options={sectionOptions.map(s => ({ value: s, label: s }))} placeholder="All Sections" />
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('customer-analytics-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('customer-analytics-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Product Performance</h4>
            <p>Top selling products by revenue and units sold.</p>
            <FilterSelect value={filters.productPerformance} onChange={v => setFilter('productPerformance', v)} options={categoryOptions.map(c => ({ value: c, label: categoryLabel(c) }))} placeholder="All Categories" />
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('product-performance-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('product-performance-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
        </div>
      <div className="chart-card">
        <div className="chart-card-header">
          <h3 className="chart-card-title">Sales Trend</h3>
        </div>
        <div style={{ height: 300 }}>
          {loading ? <SkeletonChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredSales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip formatter={(v) => [`₱${PH(v)}`, 'Sales']} />
                <Legend />
                <Line type="monotone" dataKey="total" name="Sales" stroke="#DC2626" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  );
}
