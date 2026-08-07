import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AdminSidebar from './admin/AdminSidebar';
import { jsPDF } from 'jspdf';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar,
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
  // Header band
  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(0, 0, pageWidth, 42, 'F');
  // Accent line
  doc.setFillColor(...PDF_COLORS.accent);
  doc.rect(0, 42, pageWidth, 3, 'F');
  // Logo placeholder (text-based since image loading is async)
  doc.setFillColor(...PDF_COLORS.white);
  doc.roundedRect(14, 8, 26, 26, 4, 4, 'F');
  doc.setTextColor(...PDF_COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('PH', 27, 25, { align: 'center' });
  // Title
  doc.setTextColor(...PDF_COLORS.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 48, 20);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 48, 30);
  // Date on right
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

  if (loading) return <div className="admin-loading">Loading dashboard</div>;

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
  useEffect(() => { load(); }, []);
  async function load() {
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
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5);
    setOrders(data || []);
    // Sales data for chart (last 7 days)
    const { data: allOrders } = await supabase.from('orders').select('total_amount, created_at').eq('status', 'completed');
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayTotal = (allOrders || []).filter(o => (o.created_at || '').startsWith(key)).reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
      days.push({ date: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), sales: dayTotal });
    }
    setSalesData(days);
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
      <div className="admin-section">
        <div className="admin-section-header">Sales Overview - Last 7 Days</div>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
              <Tooltip formatter={(v) => [`₱${PH(v)}`, 'Sales']} />
              <Bar dataKey="sales" fill="#DC2626" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="admin-section">
        <div className="admin-section-header">Recent Orders</div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Order #</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
            <tbody>
              {orders.length === 0 ? <tr><td colSpan="4"><EmptyState message="No orders yet" /></td></tr>
                : orders.map(o => { const s = ORDER_STATUS[o.status] || ORDER_STATUS.pending; return (
                  <tr key={o.id}><td>#{o.order_number?.slice(-6) || String(o.id).slice(-6)}</td><td><span className={`status-badge ${s.cls}`}>{s.label}</span></td><td>₱{PH(o.total_amount || o.total)}</td><td>{PH_DATE(o.created_at)}</td></tr>
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
    await supabase.from('stalls').update({ is_active: !stall.is_active }).eq('id', stall.id);
    await logAudit('stall_status_change', 'stalls', stall.id, `${stall.stall_name || `Stall #${stall.stall_number}`} ${stall.is_active ? 'deactivated' : 'activated'}`);
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
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', audience: 'all', duration_days: 7, is_promotion: false, promotion_type: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    supabase.from('announcements').select('*').order('created_at', { ascending: false }).then(({ data }) => setItems(data || []));
  }, []);
  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const filtered = items.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || (a.title || '').toLowerCase().includes(q) || (a.content || '').toLowerCase().includes(q);
    const matchAudience = !audienceFilter || a.audience === audienceFilter;
    const isExpired = a.expires_at && new Date(a.expires_at) < now;
    const matchStatus = !statusFilter || (statusFilter === 'active' ? !isExpired : isExpired);
    return matchSearch && matchAudience && matchStatus;
  });

  const create = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(form.duration_days || 7));
    await supabase.from('announcements').insert({
      title: form.title,
      content: form.content,
      audience: form.audience,
      expires_at: expiresAt.toISOString(),
      is_promotion: form.is_promotion,
      promotion_type: form.is_promotion ? form.promotion_type : null,
    });
    await logAudit('announcement_create', 'announcements', form.title, `Announcement created for ${form.audience} audience`);
    setSaving(false);
    setShowForm(false);
    setForm({ title: '', content: '', audience: 'all', duration_days: 7, is_promotion: false, promotion_type: '' });
    load();
  };

  const deleteAnnouncement = async (a) => {
    if (!window.confirm(`Delete announcement "${a.title}"?`)) return;
    await supabase.from('announcements').delete().eq('id', a.id);
    await logAudit('announcement_delete', 'announcements', a.title, 'Announcement deleted');
    load();
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">Announcements</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search announcements..." />
        <FilterSelect value={audienceFilter} onChange={setAudienceFilter} options={[{ value: 'all', label: 'Everyone' }, { value: 'vendor', label: 'Vendors' }, { value: 'consumer', label: 'Consumers' }]} placeholder="All Audiences" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'active', label: 'Active' }, { value: 'expired', label: 'Expired' }]} placeholder="All Statuses" />
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>New Announcement</button>
      </div>
      <div className="announcement-grid">
        {filtered.length === 0 ? <EmptyState message="No announcements found" />
          : filtered.map(a => {
            const isExpired = a.expires_at && new Date(a.expires_at) < now;
            return (
              <div key={a.id} className="announcement-card">
                <div className="announcement-card-top">
                  <h4>{a.title}</h4>
                  {a.is_promotion && <span className="status-badge status-confirmed">Promotion</span>}
                </div>
                <p>{a.content}</p>
                <div className="announcement-meta">
                  <span className="status-badge status-approved" style={{ textTransform: 'capitalize' }}>{a.audience || 'all'}</span>
                  {a.promotion_type && <span className="status-badge status-pending">{a.promotion_type}</span>}
                  <span className={`status-badge ${isExpired ? 'status-cancelled' : 'status-completed'}`}>{isExpired ? 'Expired' : 'Active'}</span>
                </div>
                <div className="announcement-footer">
                  <div className="date">Created: {PH_DATE(a.created_at)}</div>
                  {a.expires_at && <div className="date">Expires: {PH_DATE(a.expires_at)}</div>}
                </div>
                <div className="announcement-actions">
                  <button className="btn btn-sm btn-danger" onClick={() => deleteAnnouncement(a)}>Delete</button>
                </div>
              </div>
            );
          })}
      </div>

      {showForm && (
        <Modal title="New Announcement" onClose={() => setShowForm(false)}>
          <div className="form-grid">
            <FormField label="Title">
              <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Announcement title" />
            </FormField>
            <FormField label="Audience">
              <select className="form-input" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}>
                <option value="all">Everyone (Vendors & Consumers)</option>
                <option value="vendor">Vendors Only</option>
                <option value="consumer">Consumers Only</option>
              </select>
            </FormField>
            <FormField label="Content">
              <textarea className="form-input" rows="4" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Announcement content" />
            </FormField>
            <FormField label="Duration (days)">
              <input type="number" className="form-input" min="1" max="365" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: e.target.value })} />
            </FormField>
            <FormField label="Promotion">
              <label className="checkbox-label">
                <input type="checkbox" checked={form.is_promotion} onChange={e => setForm({ ...form, is_promotion: e.target.checked })} />
                Mark as promotion
              </label>
            </FormField>
            {form.is_promotion && (
              <FormField label="Promotion Type">
                <select className="form-input" value={form.promotion_type} onChange={e => setForm({ ...form, promotion_type: e.target.value })}>
                  <option value="">Select type</option>
                  <option value="stall_promotion">Stall Promotion</option>
                  <option value="product_promotion">Product Promotion</option>
                  <option value="market_event">Market Event</option>
                  <option value="seasonal">Seasonal</option>
                </select>
              </FormField>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Creating...' : 'Create Announcement'}</button>
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
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [resolution, setResolution] = useState('');

  const load = useCallback(() => {
    supabase.from('complaints').select('*').order('created_at', { ascending: false }).then(({ data }) => setComplaints(data || []));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = complaints.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || (c.user_name || '').toLowerCase().includes(q) || (c.subject || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || c.status === statusFilter;
    const matchType = !typeFilter || c.complaint_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const updateStatus = async (c, status) => {
    await supabase.from('complaints').update({ status, resolution: resolution || c.resolution || null }).eq('id', c.id);
    await logAudit('complaint_update', 'complaints', c.subject, `Complaint marked as ${status}`);
    setSelected(null);
    setResolution('');
    load();
  };

  const types = [...new Set(complaints.map(c => c.complaint_type).filter(Boolean))];

  return (
    <div className="admin-section">
      <div className="admin-section-header">Complaint Management</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search complaints..." />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'pending', label: 'Pending' }, { value: 'resolved', label: 'Resolved' }, { value: 'dismissed', label: 'Dismissed' }]} placeholder="All Statuses" />
        <FilterSelect value={typeFilter} onChange={setTypeFilter} options={types.map(t => ({ value: t, label: t }))} placeholder="All Types" />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>From</th><th>Subject</th><th>Type</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="6"><EmptyState message="No complaints found" /></td></tr>
              : filtered.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.user_name || 'Anonymous'}</strong></td>
                  <td>{c.subject || 'N/A'}</td>
                  <td><span className="status-badge status-confirmed">{c.complaint_type || 'General'}</span></td>
                  <td><span className={`status-badge ${c.status === 'resolved' ? 'status-completed' : c.status === 'dismissed' ? 'status-cancelled' : 'status-pending'}`}>{c.status || 'pending'}</span></td>
                  <td>{PH_DATE(c.created_at)}</td>
                  <td><button className="btn btn-sm btn-primary" onClick={() => { setSelected(c); setResolution(c.resolution || ''); }}>Review</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <Modal title="Review Complaint" onClose={() => setSelected(null)}>
          <div className="complaint-detail">
            <div className="complaint-detail-row"><strong>From:</strong> {selected.user_name || 'Anonymous'}</div>
            <div className="complaint-detail-row"><strong>Subject:</strong> {selected.subject}</div>
            <div className="complaint-detail-row"><strong>Type:</strong> {selected.complaint_type || 'General'}</div>
            <div className="complaint-detail-row"><strong>Date:</strong> {PH_DATETIME(selected.created_at)}</div>
            <div className="complaint-detail-row"><strong>Description:</strong></div>
            <div className="complaint-description">{selected.description || 'No description provided'}</div>
            <FormField label="Resolution / Notes">
              <textarea className="form-input" rows="4" value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Enter resolution or notes..." />
            </FormField>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
            <button className="btn btn-success" onClick={() => updateStatus(selected, 'resolved')}>Mark Resolved</button>
            <button className="btn btn-danger" onClick={() => updateStatus(selected, 'dismissed')}>Dismiss</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==================== AUDIT TRAIL ==================== */
function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const load = useCallback(() => {
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200).then(({ data }) => setLogs(data || []));
  }, []);
  useEffect(() => { load(); }, [load]);

  const actions = [...new Set(logs.map(l => l.action).filter(Boolean))];
  const entities = [...new Set(logs.map(l => l.entity_type).filter(Boolean))];

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || (l.details || '').toLowerCase().includes(q) || (l.user_email || '').toLowerCase().includes(q) || (l.entity_id || '').toLowerCase().includes(q);
    const matchAction = !actionFilter || l.action === actionFilter;
    const matchEntity = !entityFilter || l.entity_type === entityFilter;
    const matchDate = !dateFilter || (l.created_at || '').startsWith(dateFilter);
    return matchSearch && matchAction && matchEntity && matchDate;
  });

  return (
    <div className="admin-section">
      <div className="admin-section-header">Audit Trail - System Activity Log</div>
      <div className="admin-toolbar-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search details, user, entity..." />
        <FilterSelect value={actionFilter} onChange={setActionFilter} options={actions.map(a => ({ value: a, label: a }))} placeholder="All Actions" />
        <FilterSelect value={entityFilter} onChange={setEntityFilter} options={entities.map(e => ({ value: e, label: e }))} placeholder="All Entities" />
        <input type="date" className="admin-filter-select" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Timestamp</th><th>Action</th><th>Entity</th><th>Details</th><th>User</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="5"><EmptyState message="No audit logs found" /></td></tr>
              : filtered.map(l => (
                <tr key={l.id}>
                  <td>{PH_DATETIME(l.created_at)}</td>
                  <td><span className="status-badge status-confirmed">{l.action || 'Update'}</span></td>
                  <td>{l.entity_type || 'N/A'}</td>
                  <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.details || 'N/A'}</td>
                  <td>{l.user_email || 'System'}</td>
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
  const [sales, setSales] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [p, s, o, ph] = await Promise.all([
      supabase.from('products').select('*, stall:stall_id(stall_name, stall_number)').order('name'),
      supabase.from('stalls').select('*, vendor:profiles(full_name, email)').order('stall_number'),
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('price_history').select('*, product:product_id(name)').order('changed_at', { ascending: false }).limit(200),
    ]);
    setProducts(p.data || []);
    setStalls(s.data || []);
    setOrders(o.data || []);
    setPriceHistory(ph.data || []);
    // Sales data
    const completed = (o.data || []).filter(x => x.status === 'completed');
    const byDate = {};
    completed.forEach(x => {
      const d = (x.created_at || '').split('T')[0];
      byDate[d] = (byDate[d] || 0) + parseFloat(x.total_amount || 0);
    });
    setSales(Object.entries(byDate).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date)));
    setLoading(false);
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const exportProducts = () => {
    const rows = products.map(p => [p.name, p.category || 'Uncategorized', p.stall?.stall_name || 'N/A', `₱${PH(p.price)}`, p.stock || 0]);
    generatePdf({
      title: 'Product Price Report',
      subtitle: 'Complete list of products and their current prices',
      headers: ['Product', 'Category', 'Stall', 'Price', 'Stock'],
      rows,
      filename: `palengkehub_products_${new Date().toISOString().split('T')[0]}.pdf`,
      summary: [`Total Products: ${products.length}`, `Generated by PalengkeHub Admin`],
    });
  };

  const exportStalls = () => {
    const rows = stalls.map(s => [s.stall_name || `Stall #${s.stall_number}`, s.stall_number, s.section || 'N/A', s.floor || 'N/A', s.location || 'N/A', s.vendor?.full_name || 'Unassigned', s.is_active ? 'Active' : 'Inactive']);
    generatePdf({
      title: 'Stall Report',
      subtitle: 'Complete list of market stalls',
      headers: ['Stall Name', 'Number', 'Section', 'Floor', 'Location', 'Vendor', 'Status'],
      rows,
      filename: `palengkehublog_stalls_${new Date().toISOString().split('T')[0]}.pdf`,
      summary: [`Total Stalls: ${stalls.length}`, `Active: ${stalls.filter(s => s.is_active).length}`, `Inactive: ${stalls.filter(s => !s.is_active).length}`],
    });
  };

  const exportOrders = () => {
    const rows = orders.map(o => [`#${o.order_number?.slice(-8) || String(o.id).slice(-6)}`, o.status, `₱${PH(o.total_amount || o.total)}`, PH_DATE(o.created_at)]);
    generatePdf({
      title: 'Order Report',
      subtitle: 'All orders in the system',
      headers: ['Order #', 'Status', 'Total', 'Date'],
      rows,
      filename: `palengkehublog_orders_${new Date().toISOString().split('T')[0]}.pdf`,
      summary: [`Total Orders: ${orders.length}`, `Total Revenue: ₱${PH(orders.filter(o => o.status === 'completed').reduce((s, o) => s + parseFloat(o.total_amount || o.total || 0), 0))}`],
    });
  };

  const exportSales = () => {
    const rows = sales.map(s => [s.date, `₱${PH(s.total)}`]);
    generatePdf({
      title: 'Sales Report',
      subtitle: 'Completed sales by date',
      headers: ['Date', 'Total Sales'],
      rows,
      filename: `palengkehublog_sales_${new Date().toISOString().split('T')[0]}.pdf`,
      summary: [`Total Sales: ₱${PH(sales.reduce((s, x) => s + x.total, 0))}`, `Total Transactions: ${sales.length}`],
    });
  };

  const exportPriceHistory = () => {
    const rows = priceHistory.map(h => [h.product?.name || 'Unknown', `₱${PH(h.previous_price)}`, `₱${PH(h.new_price)}`, PH_DATETIME(h.changed_at)]);
    generatePdf({
      title: 'Price Change Report',
      subtitle: 'Historical price changes per product',
      headers: ['Product', 'Previous Price', 'New Price', 'Date Changed'],
      rows,
      filename: `palengkehublog_price_changes_${new Date().toISOString().split('T')[0]}.pdf`,
      summary: [`Total Price Changes: ${priceHistory.length}`],
    });
  };

  const exportPricePerProduct = () => {
    const rows = products.map(p => [p.name, p.category || 'Uncategorized', `₱${PH(p.price)}`, p.stall?.stall_name || 'N/A']);
    generatePdf({
      title: 'Price Per Product Report',
      subtitle: 'Current price of each product per stall',
      headers: ['Product', 'Category', 'Price', 'Stall'],
      rows,
      filename: `palengkehublog_price_per_product_${new Date().toISOString().split('T')[0]}.pdf`,
      summary: [`Total Products: ${products.length}`],
    });
  };

  return (
    <>
      <div className="admin-section">
        <div className="admin-section-header">Report Generation</div>
        <p style={{ color: 'var(--admin-text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
          Generate professional PDF reports with the PalengkeHub branding. Reports include prices, products, stalls, orders, and sales data.
        </p>
        <div className="report-grid">
          <div className="report-card">
            <h4>Product Price Report</h4>
            <p>Complete list of all products with current prices and stock levels.</p>
            <button className="btn btn-primary" onClick={exportProducts} disabled={loading}>Generate PDF</button>
          </div>
          <div className="report-card">
            <h4>Stall Report</h4>
            <p>All market stalls with vendor assignments, locations, and status.</p>
            <button className="btn btn-primary" onClick={exportStalls} disabled={loading}>Generate PDF</button>
          </div>
          <div className="report-card">
            <h4>Order Report</h4>
            <p>All orders with status, totals, and transaction dates.</p>
            <button className="btn btn-primary" onClick={exportOrders} disabled={loading}>Generate PDF</button>
          </div>
          <div className="report-card">
            <h4>Sales Report</h4>
            <p>Completed sales aggregated by date with revenue totals.</p>
            <button className="btn btn-primary" onClick={exportSales} disabled={loading}>Generate PDF</button>
          </div>
          <div className="report-card">
            <h4>Price Change Report</h4>
            <p>Historical price changes per product with timestamps.</p>
            <button className="btn btn-primary" onClick={exportPriceHistory} disabled={loading}>Generate PDF</button>
          </div>
          <div className="report-card">
            <h4>Price Per Product</h4>
            <p>Current price of each product per stall for market comparison.</p>
            <button className="btn btn-primary" onClick={exportPricePerProduct} disabled={loading}>Generate PDF</button>
          </div>
        </div>
      </div>
      <div className="admin-section">
        <div className="admin-section-header">Sales Chart</div>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
              <Tooltip formatter={(v) => [`₱${PH(v)}`, 'Sales']} />
              <Legend />
              <Line type="monotone" dataKey="total" name="Sales" stroke="#DC2626" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

/* ==================== CHAT ==================== */
function Chat() {
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');

  const loadConvs = useCallback(() => {
    supabase.from('conversations')
      .select('*, customer:customer_id(id, full_name, email), stall:stall_id(id, stall_name, stall_number, vendor_id)')
      .order('updated_at', { ascending: false })
      .then(({ data }) => setConvs(data || []));
  }, []);
  useEffect(() => { loadConvs(); }, [loadConvs]);

  async function loadMsgs(id) {
    setActive(id);
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true });
    setMsgs(data || []);
    setTimeout(() => {
      const el = document.querySelector('.chat-messages-scroll');
      if (el) el.scrollTop = el.scrollHeight;
    }, 100);
  }

  async function send() {
    if (!input.trim() || !active) return;
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('messages').insert({
      conversation_id: active,
      sender_id: session.user.id,
      sender_role: 'admin',
      message: input,
      is_image: false,
    });
    await supabase.from('conversations').update({
      last_message: input,
      last_message_time: new Date().toISOString(),
    }).eq('id', active);
    setInput('');
    loadMsgs(active);
    loadConvs();
  }

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">Conversations</div>
        <div className="chat-sidebar-list">
          {convs.length === 0 ? <div className="empty-state"><div className="empty-state-text">No conversations</div></div>
            : convs.map(c => (
              <div key={c.id} className={`chat-conv-item${active === c.id ? ' active' : ''}`} onClick={() => loadMsgs(c.id)}>
                <div className="chat-conv-name">{c.customer?.full_name || 'Customer'} - {c.stall?.stall_name || 'Stall #' + (c.stall?.stall_number || '')}</div>
                <div className="chat-conv-preview">{c.last_message || 'No messages'}</div>
              </div>
            ))}
        </div>
      </div>
      <div className="chat-main">
        {!active ? <div className="chat-empty">Select a conversation to view messages</div> : <>
          <div className="chat-messages chat-messages-scroll">
            {msgs.length === 0 ? <div className="chat-empty">No messages yet</div>
              : msgs.map(m => (
                <div key={m.id} className={`chat-msg ${m.sender_role === 'admin' ? 'chat-msg-sent' : 'chat-msg-received'}`}>
                  <div className="chat-sender-label">{m.sender_role === 'admin' ? 'Admin' : m.sender_role}</div>
                  {m.message}
                  <div className="chat-msg-time">{new Date(m.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              ))}
          </div>
          <div className="chat-input-bar">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." />
            <button onClick={send}>Send</button>
          </div>
        </>}
      </div>
    </div>
  );
}

/* ==================== AUDIT LOG HELPER ==================== */
async function logAudit(action, entityType, entityId, details) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('audit_logs').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      user_email: session?.user?.email || 'System',
    });
  } catch (e) {
    console.error('Failed to log audit:', e);
  }
}