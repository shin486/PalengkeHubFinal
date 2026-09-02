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
  'vendor-applications': 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  'vendor-locations': 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  reports: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  complaints: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  announcements: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  chats: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
};

/* Grouped navigation — keeps the 13 sections scannable for new admins */
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ id: 'overview', label: 'Dashboard' }],
  },
  {
    label: 'Marketplace',
    items: [
      { id: 'stalls', label: 'Stalls' },
      { id: 'products', label: 'Products' },
      { id: 'orders', label: 'Orders' },
      { id: 'users', label: 'Users' },
      { id: 'vendor-applications', label: 'Vendor Applications' },
      { id: 'vendor-locations', label: 'Vendor Locations' },
    ],
  },
  {
    label: 'Pricing',
    items: [
      { id: 'prices', label: 'Price Monitor' },
      { id: 'price-history', label: 'Price History' },
      { id: 'price-anomaly', label: 'Price Anomalies' },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { id: 'complaints', label: 'Complaints' },
      { id: 'announcements', label: 'Announcements' },
      { id: 'chats', label: 'Messages' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { id: 'reports', label: 'Reports & Audit' },
    ],
  },
];

export default function AdminSidebar({ activeSection, setActiveSection, adminName }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin-login');
  };

  const initial = (adminName || 'A').trim().charAt(0).toUpperCase();

  return (
    <aside className="admin-sidebar">
      {/* ── Top: logo / title ── */}
      <div className="admin-sidebar-brand">
        <img src="/palengkehublogo.jpg" alt="PalengkeHub" className="admin-sidebar-logo" />
        <div className="admin-sidebar-brand-text">
          <div className="admin-sidebar-title">Palengke<span className="brand-hub">Hub</span></div>
          <div className="admin-sidebar-subtitle">Admin Panel</div>
        </div>
      </div>

      {/* ── Middle: grouped nav links (icon + label) ── */}
      <nav className="admin-sidebar-nav" aria-label="Admin sections">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="admin-nav-group">
            <div className="admin-nav-group-label">{group.label}</div>
            {group.items.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`admin-nav-item${activeSection === item.id ? ' active' : ''}`}
                title={item.label}
                aria-current={activeSection === item.id ? 'page' : undefined}
              >
                <span className="admin-nav-item-icon">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={SIDEBAR_ICONS[item.id]} />
                  </svg>
                </span>
                <span className="admin-nav-item-label">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* ── Bottom: profile + logout ── */}
      <div className="admin-sidebar-footer">
        <div className="admin-sidebar-avatar" aria-hidden="true">{initial}</div>
        <div className="admin-sidebar-userinfo">
          <div className="admin-sidebar-user">{adminName || 'Admin'}</div>
          <div className="admin-sidebar-role">System Administrator</div>
        </div>
        <button className="admin-sidebar-logout" onClick={handleLogout} title="Sign Out" aria-label="Sign Out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={SIDEBAR_ICONS.logout} />
          </svg>
        </button>
      </div>
    </aside>
  );
}