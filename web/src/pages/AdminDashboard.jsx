import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AdminSidebar from './admin/AdminSidebar';
import { ToastContainer, toast } from '../components/admin/Toast';
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
      <div className="empty-state-icon">📦</div>
      <div className="empty-state-text">{message}</div>
    </div>
  );
}

function Modal({ title, onClose, children, width = '600px' }) {
  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: width }} onClick={e => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{title}</h3>
          <button className="admin-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
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

/* ==================== PDF GENERATION ==================== */
const PDF_COLORS = {
  primary: [122, 28, 30],
  secondary: [185, 28, 28],
  accent: [220, 38, 38],
  dark: [17, 24, 39],
  muted: [107, 114, 128],
  light: [243, 244, 246],
  border: [229, 231, 235],
  white: [255, 255, 255],
};

function addPdfHeader(doc, title, subtitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setFillColor(...PDF_COLORS.accent);
  doc.rect(0, 42, pageWidth, 3, 'F');
  doc.setFillColor(...PDF_COLORS.white);
  doc.roundedRect(14, 8, 26, 26, 4, 4, 'F');
  doc.setTextColor(...PDF_COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('PH', 27, 25, { align: 'center' });
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
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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
      if (!session) { navigate('/admin-login'); return; }
      const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', session.user.id).single();
      if (!profile || profile.role !== 'admin') { await supabase.auth.signOut(); navigate('/admin-login'); return; }
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
    reports: 'Reports Generation', audit: 'Audit Trail', chats: 'Chats',
  };

  return (
    <div className="admin-layout">
      <AdminSidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        adminName={adminName}
      />
      <main className="admin-main">
        <div className="admin-page-header">
          <h1 className="admin-page-title">{labels[activeSection] || 'Dashboard'}</h1>
          <p className="admin-page-subtitle">Welcome back, {adminName}</p>
        </div>
        <SectionRenderer section={activeSection} />
      </main>
      <ToastContainer />
    </div>
  );
}

function SectionRenderer({ section }) {
  switch (section) {
    case 'overview': return <Overview />;
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
    case 'reports': return <Reports />;
    case 'audit': return <AuditTrail />;
    default: return <Overview />;
  }
}

/* ==================== OVERVIEW ==================== */
function Overview() {
  const [stats, setStats] = useState({});
  const [orders, setOrders] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [orderStatusData, setOrderStatusData] = useState([]);
  const [revenueByStall, setRevenueByStall] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      setStats({ vendors: r[0].count || 0, customers: r[1].count || 0, stalls: r[2].count || 0, orders: r[3].count || 0, products: r[4].count || 0, pendingApps: r[5].count || 0, pendingOrders: r[6].count || 0, pendingComplaints: r[7].count || 0 });
      const { data: recentOrders } = await supabase.from('orders').select('*, customer:consumer_id(full_name), stall:stall_id(stall_name)').order('created_at', { ascending: false }).limit(5);
      setOrders(recentOrders || []);
      // Sales data for chart (last 7 days)
      const { data: allOrders } = await supabase.from('orders').select('total_amount, created_at, status').eq('status', 'completed');
      setSalesData(aggregateSalesByDate(allOrders || [], 7));
      // Order status distribution
      const { data: allStatusOrders } = await supabase.from('orders').select('status').limit(1000);
      setOrderStatusData(aggregateByStatus(allStatusOrders || []));
      // Revenue by stall
      const { data: stallOrders } = await supabase.from('orders').select('*, stall:stall_id(stall_name, stall_number)').eq('status', 'completed').limit(1000);
      setRevenueByStall(aggregateRevenueByStall(stallOrders || []));
      toast({ message: 'Dashboard data refreshed successfully', type: 'success' });
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
      toast({ message: 'Failed to load dashboard data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

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

  return (
    <>
      <div className="priority-grid">
        {[
          { v: stats.pendingApps, l: 'Pending Applications', c: '#C62828', bg: 'rgba(198,40,40,0.06)' },
          { v: stats.pendingOrders, l: 'Pending Orders', c: '#E65100', bg: 'rgba(230,81,0,0.06)' },
          { v: stats.pendingComplaints, l: 'Pending Complaints', c: '#D32F2F', bg: 'rgba(211,47,47,0.06)' },
        ].map((p, i) => (
          <div key={i} className="priority-card" style={{ background: p.bg, borderColor: p.c + '30' }}>
            <div className="priority-card-value" style={{ color: p.c }}>{p.v}</div>
            <div className="priority-card-label" style={{ color: p.c }}>{p.l}</div>
          </div>
        ))}
      </div>
      <div className="stats-grid">
        {[
          { v: stats.vendors, l: 'Total Vendors' }, { v: stats.stalls, l: 'Total Stalls' },
          { v: stats.products, l: 'Total Products' }, { v: stats.orders, l: 'Total Orders' },
          { v: stats.customers, l: 'Registered Users' }, { v: stats.pendingApps, l: 'Pending Apps' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-card-value">{s.v}</div>
            <div className="stat-card-label">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="chart-card">
        <div className="chart-card-header">
          <h3 className="chart-card-title">Sales Overview - Last 7 Days</h3>
          <button className="refresh-btn" onClick={load} disabled={loading}>
            <span className={loading ? 'refreshing' : ''}>Refresh</span>
          </button>
        </div>
        <div style={{ height: 280 }}>
          {loading ? <SkeletonChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
                <Tooltip formatter={(v) => [`₱${PH(v)}`, 'Sales']} />
                <Bar dataKey="sales" fill="#DC2626" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="chart-card">
        <div className="chart-card-header">
          <h3 className="chart-card-title">Order Status Distribution</h3>
        </div>
        <div style={{ height: 280 }}>
          {loading ? <SkeletonChart /> : orderStatusData.length === 0 ? (
            <EmptyState message="No order data available" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <Tooltip formatter={(v) => [v, 'Orders']} />
                <Legend />
                <Pie data={orderStatusData} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
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
        <div style={{ height: 280 }}>
          {loading ? <SkeletonChart /> : revenueByStall.length === 0 ? (
            <EmptyState message="No revenue data available" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByStall.slice(0, 5)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis dataKey="stall" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip formatter={(v) => [`₱${PH(v)}`, 'Revenue']} />
                <Legend />
                <Bar dataKey="revenue" fill="#DC2626" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="admin-section">
        <div className="admin-section-header">Recent Orders</div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Order #</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan="4"><SkeletonTable rows={1} cols={4} /></td></tr>
                ))
              ) : orders.length === 0 ? <tr><td colSpan="4"><EmptyState message="No orders yet" /></td></tr>
                : orders.map(o => { const s = ORDER_STATUS[o.status] || ORDER_STATUS.pending; return (
                  <tr key={o.id}><td>#{o.order_number?.slice(-6) || String(o.id).slice(-6)}</td><td><span className={`status-badge ${s.cls}`}>{s.label}</span></td><td>₱{PH(o.total_amount || o.total)}</td><td>{PH_DATE(o.created_at)}</td></tr>
                ); })}
            </tbody>
          </table>
        </div>
      </div>
      <Chat />
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
    await supabase.from('stalls').update({ is_active: !stall.is_active }).eq('id', stall.id);
    await logAudit('stall_status_change', 'stalls', stall.id, `${stall.stall_name || `Stall #${stall.stall_number}`} ${stall.is_active ? 'deactivated' : 'activated'}`);
    toast({ message: `Stall ${stall.is_active ? 'deactivated' : 'activated'} successfully`, type: 'success' });
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

  return (
    <div className="admin-section">
      <div className="admin-section-header">Stall Management</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search stall name, number, section, vendor..." />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} placeholder="All Statuses" />
        <FilterSelect value={sectionFilter} onChange={setSectionFilter} options={sections.map(s => ({ value: s, label: s }))} placeholder="All Sections" />
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
    await supabase.from('profiles').update({ is_active: user.is_active === false ? true : false }).eq('id', user.id);
    await logAudit('user_status_change', 'profiles', user.email, `${user.email} ${user.is_active === false ? 'activated' : 'deactivated'}`);
    toast({ message: `User ${user.is_active === false ? 'activated' : 'deactivated'} successfully`, type: 'success' });
    load();
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">User Management</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email..." />
        <FilterSelect value={roleFilter} onChange={setRoleFilter} options={[{ value: 'consumer', label: 'Consumer' }, { value: 'vendor', label: 'Vendor' }, { value: 'admin', label: 'Admin' }]} placeholder="All Roles" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} placeholder="All Statuses" />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Registered</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="6"><EmptyState message="No users found" /></td></tr>
              : filtered.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.full_name || 'Unnamed'}</strong></td>
                  <td>{u.email || 'N/A'}</td>
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

/* ==================== PRODUCT CATEGORIES ==================== */
function ProductCategories() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stallFilter, setStallFilter] = useState('');

  const load = useCallback(async () => {
    const [p, c, s] = await Promise.all([
      supabase.from('products').select('*, stall:stall_id(stall_name, stall_number)').order('name'),
      supabase.from('product_categories').select('*').order('name'),
      supabase.from('stalls').select('id, stall_name, stall_number').order('stall_number'),
    ]);
    setProducts(p.data || []);
    setCategories(c.data || []);
    setStalls(s.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
    const matchCategory = !categoryFilter || p.category === categoryFilter;
    const matchStall = !stallFilter || p.stall_id === stallFilter;
    return matchSearch && matchCategory && matchStall;
  });

  const catOptions = [...new Set([...categories.map(c => c.name), ...products.map(p => p.category).filter(Boolean)])];

  return (
    <div className="admin-section">
      <div className="admin-section-header">Product Categories</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products..." />
        <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={catOptions.map(c => ({ value: c, label: c }))} placeholder="All Categories" />
        <FilterSelect value={stallFilter} onChange={setStallFilter} options={stalls.map(s => ({ value: s.id, label: s.stall_name || `Stall #${s.stall_number}` }))} placeholder="All Stalls" />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Category</th><th>Stall</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="6"><EmptyState message="No products found" /></td></tr>
              : filtered.map(p => {
                const isLow = p.stock < 5;
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td><span className="status-badge status-confirmed">{p.category || 'Uncategorized'}</span></td>
                    <td>{p.stall?.stall_name || `Stall #${p.stall?.stall_number}` || 'N/A'}</td>
                    <td style={{ fontWeight: 700 }}>₱{PH(p.price)}</td>
                    <td>{p.stock || 0} {isLow && <span className="status-badge status-pending" style={{ marginLeft: '8px' }}>Low Stock</span>}</td>
                    <td><span className={`status-badge ${isLow ? 'status-pending' : 'status-completed'}`}>{isLow ? 'Reorder' : 'In Stock'}</span></td>
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
    const [p, s] = await Promise.all([
      supabase.from('products').select('*, stall:stall_id(stall_name, stall_number), price_history:price_history(order by changed_at desc limit 1)').order('name'),
      supabase.from('stalls').select('id, stall_name, stall_number').order('stall_number'),
    ]);
    setProducts(p.data || []);
    setStalls(s.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
    const matchCategory = !categoryFilter || p.category === categoryFilter;
    const matchStall = !stallFilter || p.stall_id === stallFilter;
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

  return (
    <div className="admin-section">
      <div className="admin-section-header">Price Monitoring</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search products..." />
        <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={categories.map(c => ({ value: c, label: c }))} placeholder="All Categories" />
        <FilterSelect value={stallFilter} onChange={setStallFilter} options={stalls.map(s => ({ value: s.id, label: s.stall_name || `Stall #${s.stall_number}` }))} placeholder="All Stalls" />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Category</th><th>Stall</th><th>Price</th><th>Last Updated</th><th>Stock</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="8"><EmptyState message="No products found" /></td></tr>
              : filtered.map(p => {
                const isLow = p.stock < 5;
                const lastUpdate = p.price_history?.[0]?.changed_at || p.updated_at || null;
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td><span className="status-badge status-confirmed">{p.category || 'Uncategorized'}</span></td>
                    <td>{p.stall?.stall_name || `Stall #${p.stall?.stall_number}` || 'N/A'}</td>
                    <td style={{ fontWeight: 700 }}>₱{PH(p.price)}</td>
                    <td>{lastUpdate ? PH_DATETIME(lastUpdate) : 'N/A'}</td>
                    <td>{p.stock || 0} {isLow && <span className="status-badge status-pending" style={{ marginLeft: '8px' }}>Low</span>}</td>
                    <td><span className={`status-badge ${isLow ? 'status-pending' : 'status-completed'}`}>{isLow ? 'Reorder' : 'In Stock'}</span></td>
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
                        <td style={{ color: isUp ? '#DC2626' : '#059669', fontWeight: 700 }}>
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
    const { data } = await supabase.from('price_history').select('*, product:product_id(name)').order('changed_at', { ascending: false }).limit(200);
    setHistory(data || []);
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

  return (
    <div className="admin-section">
      <div className="admin-section-header">Price Change History</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by product name..." />
        <FilterSelect value={typeFilter} onChange={setTypeFilter} options={[{ value: 'increase', label: 'Price Increase' }, { value: 'decrease', label: 'Price Decrease' }]} placeholder="All Changes" />
        <input type="date" className="admin-filter-select" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
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
                    <td style={{ color: isUp ? '#DC2626' : '#059669', fontWeight: 700 }}>
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
                  <td style={{ color: p.isHigh ? '#DC2626' : '#F59E0B', fontWeight: 700 }}>₱{PH(p.price)}</td>
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
  const load = () => supabase
    .from('orders')
    .select('*, customer:consumer_id (full_name, email), stall:stall_id (stall_name, stall_number)')
    .order('created_at', { ascending: false }).limit(100)
    .then(({ data }) => setOrders(data || []));
  useEffect(() => { load(); }, []);
  const update = async (id, status) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    await logAudit('order_status_change', 'orders', `Order #${String(id).slice(-6)}`, `Status changed to ${status}`);
    toast({ message: `Order status updated to ${status}`, type: 'success' });
    load();
  };

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const orderNum = o.order_number || String(o.id);
    const matchSearch = !q || orderNum.toLowerCase().includes(q) || (o.customer?.full_name || '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || o.status === statusFilter;
    const matchDate = !dateFilter || (o.created_at || '').startsWith(dateFilter);
    return matchSearch && matchStatus && matchDate;
  });

  return (
    <div className="admin-section">
      <div className="admin-section-header">Order Monitoring</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search order # or customer..." />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={Object.keys(ORDER_STATUS).map(k => ({ value: k, label: ORDER_STATUS[k].label }))} placeholder="All Statuses" />
        <input type="date" className="admin-filter-select" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
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
                      <select className="status-select" value={o.status} onChange={e => update(o.id, e.target.value)}>
                        {Object.keys(ORDER_STATUS).map(k => <option key={k} value={k}>{ORDER_STATUS[k].label}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== ANNOUNCEMENTS ==================== */
function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', audience: 'all', duration_days: 7, is_promotion: false, promotion_type: '' });

  const load = useCallback(async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setAnnouncements(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSaving(true);
    const { error } = await supabase.from('announcements').insert({
      title: form.title,
      content: form.content,
      audience: form.audience,
      duration_days: form.duration_days,
      is_promotion: form.is_promotion,
      promotion_type: form.is_promotion ? form.promotion_type : null,
    });
    if (error) {
      toast({ message: `Failed to create announcement: ${error.message}`, type: 'error' });
    } else {
      setSaving(false);
      setShowForm(false);
      setForm({ title: '', content: '', audience: 'all', duration_days: 7, is_promotion: false, promotion_type: '' });
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
                {a.is_promotion && <span className="badge badge-warning">Promotion</span>}
              </div>
              <p>{a.content}</p>
              <div className="announcement-meta">
                <span className="badge badge-info">Audience: {a.audience}</span>
                <span className="badge badge-primary">Duration: {a.duration_days} days</span>
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
                <option value="all">All Users</option>
                <option value="vendor">Vendors Only</option>
                <option value="consumer">Customers Only</option>
              </select>
            </FormField>
            <FormField label="Duration (days)">
              <input type="number" className="form-input" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: parseInt(e.target.value) || 7 })} />
            </FormField>
            <FormField label="Is Promotion?">
              <select className="form-input" value={form.is_promotion ? 'true' : 'false'} onChange={e => setForm({ ...form, is_promotion: e.target.value === 'true' })}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </FormField>
            {form.is_promotion && (
              <FormField label="Promotion Type">
                <input className="form-input" value={form.promotion_type} onChange={e => setForm({ ...form, promotion_type: e.target.value })} />
              </FormField>
            )}
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
    const { data } = await supabase.from('complaints').select('*, user:profiles(full_name, email)').order('created_at', { ascending: false });
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
    await supabase.from('complaints').update({ status, resolution: resolution }).eq('id', selected.id);
    await logAudit('complaint_status_change', 'complaints', selected.id, `Status changed to ${status}`);
    setSelected(null);
    setResolution('');
    toast({ message: `Complaint marked as ${status}`, type: 'success' });
    load();
  };

  const filtered = complaints.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || (c.subject || '').toLowerCase().includes(q) || (c.user?.full_name || '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="admin-section">
      <div className="admin-section-header">Complaint Management</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search complaints..." />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={types.map(t => ({ value: t.value, label: t.label }))} placeholder="All Statuses" />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Subject</th><th>User</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="5"><EmptyState message="No complaints found" /></td></tr>
              : filtered.map(c => {
                const t = types.find(t => t.value === c.status) || types[0];
                return (
                  <tr key={c.id}>
                    <td><strong>{c.subject || 'No subject'}</strong></td>
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
            <div className="complaint-detail-row"><strong>Subject:</strong> {selected.subject || 'N/A'}</div>
            <div className="complaint-detail-row"><strong>User:</strong> {selected.user?.full_name || 'N/A'} ({selected.user?.email || 'N/A'})</div>
            <div className="complaint-detail-row"><strong>Status:</strong> {types.find(t => t.value === selected.status)?.label || selected.status}</div>
            <div className="complaint-detail-row"><strong>Date:</strong> {PH_DATETIME(selected.created_at)}</div>
            <div className="complaint-description">
              <strong>Description:</strong><br />
              {selected.description || 'No description provided.'}
            </div>
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
        sender_role: 'customer',
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
              <div className="chat-empty-icon">💬</div>
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
                  <div className="chat-empty">No messages yet. Say hello! 👋</div>
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

/* ==================== AUDIT TRAIL ==================== */
function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('audit_log').select('*, user:profiles(full_name)').order('created_at', { ascending: false }).limit(200);
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
    <div className="admin-section">
      <div className="admin-section-header">Audit Trail</div>
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
    </div>
  );
}

/* ==================== REPORTS ==================== */
function Reports() {
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, o, oi, ph] = await Promise.all([
        supabase.from('products').select('*, stall:stall_id(stall_name, stall_number)').order('name'),
        supabase.from('stalls').select('*, vendor:profiles(full_name, email)').order('stall_number'),
        supabase.from('orders').select('*, customer:consumer_id(full_name, email), stall:stall_id(stall_name, stall_number)').order('created_at', { ascending: false }).limit(1000),
        supabase.from('order_items').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('price_history').select('*, product:product_id(name)').order('changed_at', { ascending: false }).limit(500),
      ]);
      setProducts(p.data || []);
      setStalls(s.data || []);
      setOrders(o.data || []);
      setOrderItems(oi.data || []);
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

  // Apply date range filter to orders
  const getFilteredOrders = () => {
    let filtered = [...orders];
    if (dateRange === 'custom' && customStart && customEnd) {
      filtered = filtered.filter(o => {
        const d = new Date(o.created_at || '');
        return d >= new Date(customStart) && d <= new Date(customEnd);
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

  const handleExport = async (type) => {
    setExporting(type);
    try {
      if (type === 'products-pdf') {
        const rows = products.map(p => [p.name, p.category || 'Uncategorized', p.stall?.stall_name || 'N/A', `₱${PH(p.price)}`, p.stock || 0]);
        generatePdf({
          title: 'Product Price Report',
          subtitle: `Complete list of products and their current prices (${formatDateRange(customStart, customEnd)})`,
          headers: ['Product', 'Category', 'Stall', 'Price', 'Stock'],
          rows,
          filename: `palengkehub_products_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Products: ${products.length}`, `Generated by PalengkeHub Admin`],
        });
        toast({ message: 'Product Price Report generated successfully', type: 'success' });
      } else if (type === 'products-csv') {
        exportToCSV({
          data: products,
          filename: `palengkehub_products_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['name', 'category', 'price', 'stock', 'stall_name'],
        });
        toast({ message: 'Product data exported to CSV', type: 'success' });
      } else if (type === 'stalls-pdf') {
        const rows = stalls.map(s => [s.stall_name || `Stall #${s.stall_number}`, s.stall_number, s.section || 'N/A', s.floor || 'N/A', s.location || 'N/A', s.vendor?.full_name || 'Unassigned', s.is_active ? 'Active' : 'Inactive']);
        generatePdf({
          title: 'Stall Report',
          subtitle: 'Complete list of market stalls',
          headers: ['Stall Name', 'Number', 'Section', 'Floor', 'Location', 'Vendor', 'Status'],
          rows,
          filename: `palengkehublog_stalls_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Stalls: ${stalls.length}`, `Active: ${stalls.filter(s => s.is_active).length}`, `Inactive: ${stalls.filter(s => !s.is_active).length}`],
        });
        toast({ message: 'Stall Report generated successfully', type: 'success' });
      } else if (type === 'stalls-csv') {
        exportToCSV({
          data: stalls,
          filename: `palengkehublog_stalls_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['stall_name', 'stall_number', 'section', 'floor', 'location', 'is_active'],
        });
        toast({ message: 'Stall data exported to CSV', type: 'success' });
      } else if (type === 'orders-pdf') {
        const rows = filteredOrders.map(o => [`#${o.order_number?.slice(-8) || String(o.id).slice(-6)}`, o.status, `₱${PH(o.total_amount || o.total)}`, PH_DATE(o.created_at), o.customer?.full_name || 'N/A', o.stall?.stall_name || 'N/A']);
        generatePdf({
          title: 'Order Report',
          subtitle: `All orders (${filteredOrders.length} records)`,
          headers: ['Order #', 'Status', 'Total', 'Date', 'Customer', 'Stall'],
          rows,
          filename: `palengkehublog_orders_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Orders: ${filteredOrders.length}`, `Total Revenue: ₱${PH(filteredCompleted.reduce((s, o) => s + parseFloat(o.total_amount || o.total || 0), 0))}`],
        });
        toast({ message: 'Order Report generated successfully', type: 'success' });
      } else if (type === 'orders-csv') {
        exportToCSV({
          data: filteredOrders,
          filename: `palengkehublog_orders_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['order_number', 'status', 'total_amount', 'created_at', 'customer_name', 'stall_name'],
        });
        toast({ message: 'Order data exported to CSV', type: 'success' });
      } else if (type === 'sales-pdf') {
        const rows = filteredSales.map(s => [s.date, `₱${PH(s.total)}`]);
        generatePdf({
          title: 'Sales Report',
          subtitle: `Completed sales by date (${filteredCompleted.length} transactions)`,
          headers: ['Date', 'Total Sales'],
          rows,
          filename: `palengkehublog_sales_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Sales: ₱${PH(filteredSales.reduce((s, x) => s + x.total, 0))}`, `Total Transactions: ${filteredCompleted.length}`],
        });
        toast({ message: 'Sales Report generated successfully', type: 'success' });
      } else if (type === 'sales-csv') {
        exportToCSV({
          data: filteredSales,
          filename: `palengkehublog_sales_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['date', 'total'],
        });
        toast({ message: 'Sales data exported to CSV', type: 'success' });
      } else if (type === 'price-history-pdf') {
        const rows = priceHistory.map(h => [h.product?.name || 'Unknown', `₱${PH(h.previous_price)}`, `₱${PH(h.new_price)}`, PH_DATETIME(h.changed_at)]);
        generatePdf({
          title: 'Price Change Report',
          subtitle: 'Historical price changes per product',
          headers: ['Product', 'Previous Price', 'New Price', 'Date Changed'],
          rows,
          filename: `palengkehublog_price_changes_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Price Changes: ${priceHistory.length}`],
        });
        toast({ message: 'Price Change Report generated successfully', type: 'success' });
      } else if (type === 'price-history-csv') {
        exportToCSV({
          data: priceHistory,
          filename: `palengkehublog_price_changes_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['product_name', 'previous_price', 'new_price', 'changed_at'],
        });
        toast({ message: 'Price history exported to CSV', type: 'success' });
      } else if (type === 'price-per-product-pdf') {
        const rows = products.map(p => [p.name, p.category || 'Uncategorized', `₱${PH(p.price)}`, p.stall?.stall_name || 'N/A']);
        generatePdf({
          title: 'Price Per Product Report',
          subtitle: 'Current price of each product per stall',
          headers: ['Product', 'Category', 'Price', 'Stall'],
          rows,
          filename: `palengkehublog_price_per_product_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Products: ${products.length}`],
        });
        toast({ message: 'Price Per Product Report generated successfully', type: 'success' });
      } else if (type === 'vendor-performance-pdf') {
        const vendorPerf = calculateVendorPerformance(stalls, filteredOrders);
        const rows = vendorPerf.map(v => [v.stallName, v.vendor, v.section, `₱${PH(v.totalRevenue)}`, v.orderCount, v.completedOrders]);
        generatePdf({
          title: 'Vendor Performance Report',
          subtitle: 'Revenue and order count by vendor/stall',
          headers: ['Stall', 'Vendor', 'Section', 'Revenue', 'Total Orders', 'Completed'],
          rows,
          filename: `palengkehublog_vendor_performance_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Vendors: ${vendorPerf.length}`, `Total Revenue: ₱${PH(vendorPerf.reduce((s, v) => s + v.totalRevenue, 0))}`],
        });
        toast({ message: 'Vendor Performance Report generated successfully', type: 'success' });
      } else if (type === 'vendor-performance-csv') {
        const vendorPerf = calculateVendorPerformance(stalls, filteredOrders);
        exportToCSV({
          data: vendorPerf,
          filename: `palengkehublog_vendor_performance_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['stallName', 'vendor', 'section', 'totalRevenue', 'orderCount', 'completedOrders'],
        });
        toast({ message: 'Vendor performance exported to CSV', type: 'success' });
      } else if (type === 'customer-analytics-pdf') {
        const customerData = calculateCustomerAnalytics(filteredOrders);
        const rows = customerData.map(c => [c.customerName, `₱${PH(c.totalSpent)}`, c.orderCount]);
        generatePdf({
          title: 'Customer Analytics Report',
          subtitle: 'Top customers by total spending',
          headers: ['Customer', 'Total Spent', 'Order Count'],
          rows,
          filename: `palengkehublog_customer_analytics_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Customers: ${customerData.length}`, `Total Revenue: ₱${PH(customerData.reduce((s, c) => s + c.totalSpent, 0))}`],
        });
        toast({ message: 'Customer Analytics Report generated successfully', type: 'success' });
      } else if (type === 'customer-analytics-csv') {
        const customerData = calculateCustomerAnalytics(filteredOrders);
        exportToCSV({
          data: customerData,
          filename: `palengkehublog_customer_analytics_${formatDateRange(customStart, customEnd)}.csv`,
          headers: ['customerName', 'totalSpent', 'orderCount'],
        });
        toast({ message: 'Customer analytics exported to CSV', type: 'success' });
      } else if (type === 'product-performance-pdf') {
        const productPerf = calculateProductPerformance(products, orderItems);
        const rows = productPerf.map(p => [p.name, p.category || 'Uncategorized', `₱${PH(p.totalRevenue)}`, p.totalSold, p.orderCount]);
        generatePdf({
          title: 'Product Performance Report',
          subtitle: 'Top selling products by revenue',
          headers: ['Product', 'Category', 'Revenue', 'Units Sold', 'Orders'],
          rows,
          filename: `palengkehublog_product_performance_${formatDateRange(customStart, customEnd)}.pdf`,
          summary: [`Total Products Sold: ${productPerf.length}`, `Total Revenue: ₱${PH(productPerf.reduce((s, p) => s + p.totalRevenue, 0))}`],
        });
        toast({ message: 'Product Performance Report generated successfully', type: 'success' });
      } else if (type === 'product-performance-csv') {
        const productPerf = calculateProductPerformance(products, orderItems);
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
      <div className="admin-section">
        <div className="admin-section-header">Report Generation</div>
        <p style={{ color: 'var(--admin-text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
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
            <p>Complete list of all products with current prices and stock levels.</p>
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('products-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('products-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Stall Report</h4>
            <p>All market stalls with vendor assignments, locations, and status.</p>
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('stalls-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('stalls-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Order Report</h4>
            <p>All orders with status, totals, and transaction dates.</p>
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('orders-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('orders-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Sales Report</h4>
            <p>Completed sales aggregated by date with revenue totals.</p>
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('sales-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('sales-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Price Change Report</h4>
            <p>Historical price changes per product with timestamps.</p>
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('price-history-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('price-history-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Price Per Product</h4>
            <p>Current price of each product per stall for market comparison.</p>
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('price-per-product-pdf')} disabled={loading || exporting}>PDF</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Vendor Performance</h4>
            <p>Revenue and order count by vendor/stall.</p>
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('vendor-performance-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('vendor-performance-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Customer Analytics</h4>
            <p>Top customers by total spending and order count.</p>
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('customer-analytics-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('customer-analytics-csv')} disabled={loading || exporting}>CSV</button>
            </div>
          </div>
          <div className="report-card">
            <h4>Product Performance</h4>
            <p>Top selling products by revenue and units sold.</p>
            <div className="export-btn-group">
              <button className="btn btn-sm btn-primary" onClick={() => handleExport('product-performance-pdf')} disabled={loading || exporting}>PDF</button>
              <button className="btn btn-sm btn-success" onClick={() => handleExport('product-performance-csv')} disabled={loading || exporting}>CSV</button>
            </div>
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
