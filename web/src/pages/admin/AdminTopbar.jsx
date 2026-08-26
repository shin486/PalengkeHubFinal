import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

const SECTION_LABELS = {
  overview: 'Dashboard', stalls: 'Stalls', products: 'Products', orders: 'Orders',
  users: 'Users', prices: 'Price Monitor', 'price-history': 'Price History',
  'price-anomaly': 'Price Anomalies', complaints: 'Complaints',
  announcements: 'Announcements', chats: 'Messages', reports: 'Reports & Audit',
};

export default function AdminTopbar({ setActiveSection }) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const searchRef = useRef(null);
  const notifRef = useRef(null);

  /* Load pending-work counts for the notification bell */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await Promise.all([
          supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('vendor_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);
        if (cancelled) return;
        const items = [
          { label: 'orders', text: `${r[0].count || 0} pending order${(r[0].count || 0) === 1 ? '' : 's'}`, section: 'orders' },
          { label: 'complaints', text: `${r[1].count || 0} open complaint${(r[1].count || 0) === 1 ? '' : 's'}`, section: 'complaints' },
          { label: 'applications', text: `${r[2].count || 0} vendor application${(r[2].count || 0) === 1 ? '' : 's'} awaiting review`, section: 'stalls' },
        ].filter(a => !a.text.startsWith('0 '));
        setAlerts(items);
      } catch { /* bell stays empty on failure */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalCount = alerts.length;

  /* Close dropdowns on outside click */
  useEffect(() => {
    const onDocClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const matches = query.trim()
    ? Object.entries(SECTION_LABELS).filter(([, label]) => label.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  const jumpTo = (section) => {
    setActiveSection(section);
    setQuery('');
    setShowResults(false);
  };

  return (
    <header className="admin-topbar">
      {/* Search — type to jump to any section */}
      <div className="admin-topbar-search" ref={searchRef}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          placeholder="Search pages…"
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          aria-label="Search pages"
        />
        {showResults && matches.length > 0 && (
          <div className="admin-topbar-search-results">
            {matches.map(([id, label]) => (
              <button key={id} onClick={() => jumpTo(id)}>
                <span>{label}</span>
                <span className="admin-topbar-search-hint">Go →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="admin-topbar-actions">
        {/* Notifications */}
        <div className="admin-topbar-notif" ref={notifRef}>
          <button
            className={`admin-topbar-icon-btn${notifOpen ? ' active' : ''}`}
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label={`Notifications (${totalCount})`}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {totalCount > 0 && <span className="admin-topbar-badge">{totalCount}</span>}
          </button>
          {notifOpen && (
            <div className="admin-topbar-dropdown">
              <div className="admin-topbar-dropdown-title">Needs attention</div>
              {alerts.length === 0 ? (
                <div className="admin-topbar-dropdown-empty">🎉 All caught up!</div>
              ) : alerts.map(a => (
                <button key={a.label} className="admin-topbar-dropdown-item" onClick={() => { setNotifOpen(false); jumpTo(a.section); }}>
                  <span className="admin-topbar-dropdown-dot" />
                  {a.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
