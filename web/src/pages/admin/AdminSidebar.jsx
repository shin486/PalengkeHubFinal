import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import '../../admin.css';

const MENU_ITEMS = [
  { id: 'overview', label: 'Admin Dashboard', icon: '📊' },
  { id: 'stalls', label: 'Stall Management', icon: '📍' },
  { id: 'products', label: 'Product Categories', icon: '📦' },
  { id: 'prices', label: 'Price Monitoring', icon: '💰' },
  { id: 'price-history', label: 'Price Change History', icon: '📝' },
  { id: 'price-anomaly', label: 'Price Anomaly Detection', icon: '🔍' },
  { id: 'orders', label: 'Order Monitoring', icon: '🛒' },
  { id: 'users', label: 'User Management', icon: '👥' },
  { id: 'reports', label: 'Reports Generation', icon: '📄' },
  { id: 'complaints', label: 'Complaint Management', icon: '💬' },
  { id: 'announcements', label: 'Announcements', icon: '📢' },
  { id: 'audit', label: 'Audit Trail', icon: '📋' },
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
            <span className="admin-nav-item-icon">{item.icon}</span>
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