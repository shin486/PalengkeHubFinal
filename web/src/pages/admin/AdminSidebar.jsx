import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import '../../admin.css';

const SIDEBAR_ICONS = {
  overview: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  stalls: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  products: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  prices: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  'price-history': 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  'price-anomaly': 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
  orders: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
  reports: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  complaints: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  announcements: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  chats: 'M17 2a4 4 0 0 1 4 4v8.5a2.5 2.5 0 0 1-2.5 2.5H7a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h10z M7 2h10a2 2 0 0 1 2 2v8.5a.5.5 0 0 1-.5.5H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M9 11h6M9 7h6',
  audit: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
};

const MENU_ITEMS = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'stalls', label: 'Stall Management' },
  { id: 'products', label: 'Product Categories' },
  { id: 'prices', label: 'Price Monitoring' },
  { id: 'price-history', label: 'Price Change History' },
  { id: 'price-anomaly', label: 'Price Anomaly Detection' },
  { id: 'orders', label: 'Order Monitoring' },
  { id: 'users', label: 'User Management' },
  { id: 'reports', label: 'Reports Generation' },
  { id: 'complaints', label: 'Complaint Management' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'chats', label: 'Admin Chat' },
  { id: 'audit', label: 'Audit Trail' },
];

export default function AdminSidebar({ activeSection, setActiveSection, adminName }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin-login');
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <img src="/palengkehublogo.jpg" alt="PalengkeHub" className="admin-sidebar-logo" />
        <div>
          <div className="admin-sidebar-title">PalengkeHub</div>
          <div className="admin-sidebar-subtitle">Admin Panel</div>
        </div>
      </div>
      <nav className="admin-sidebar-nav">
        {MENU_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`admin-nav-item${activeSection === item.id ? ' active' : ''}`}
            title={item.label}
          >
            <span className="admin-nav-item-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={SIDEBAR_ICONS[item.id]} />
              </svg>
            </span>
            <span>{item.label}</span>
            <span className="admin-nav-item-dot" />
          </button>
        ))}
      </nav>
      <div className="admin-sidebar-footer">
        <div className="admin-sidebar-user">{adminName || 'Admin'}</div>
        <div className="admin-sidebar-role">System Administrator</div>
        <button className="admin-sidebar-logout" onClick={handleLogout}>Sign Out</button>
      </div>
    </aside>
  );
}