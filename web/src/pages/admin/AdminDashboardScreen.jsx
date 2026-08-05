import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../admin/AdminSidebar';

export default function AdminDashboardScreen({ children, activeSection, setActiveSection, adminName }) {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FA' }}>
      <AdminSidebar 
        activeSection={activeSection} 
        setActiveSection={setActiveSection} 
        adminName={adminName}
        onLogout={async () => { await import('../../../lib/supabase').then(m => m.supabase.auth.signOut()); navigate('/admin-login'); }}
      />
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}