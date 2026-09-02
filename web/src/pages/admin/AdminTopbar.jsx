import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import ThemeToggle from '../../components/ThemeToggle';

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
    const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
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

    /* Global content search across products, stalls, orders, vendors, users */
  const doSearch = async (term) => {
    const q = term.trim();
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    setSearchResults([]);
    const [p, s, o, u] = await Promise.all([
      supabase.from('products').select('id, name, price, stall:stall_id(stall_name, stall_number)').ilike('name', `%${q}%`).order('name').limit(8),
      supabase.from('stalls').select('id, stall_name, stall_number, section, vendor:profiles(full_name)').or(`stall_name.ilike.%${q}%,stall_number.eq.${q}`).order('stall_number').limit(8),
      supabase.from('orders').select('id, order_number, total_amount, status, created_at, customer:consumer_id(full_name)').or(`order_number.ilike.%${q}%,id.eq.${q}`).order('created_at', { ascending: false }).limit(8),
      supabase.from('profiles').select('id, full_name, email, role').or(`full_name.ilike.%${q}%,email.ilike.%${q}%`).order('full_name').limit(8),
    ]);
    const results = [
      ...(p.data || []).map(r => ({ type: 'product', label: r.name, sub: `₱${parseFloat(r.price).toLocaleString()} · ${r.stall?.stall_name || ''}`, icon: '🛒', goto: 'products', tag: r.id })),
      ...(s.data || []).map(r => ({ type: 'stall', label: r.stall_name || `Stall #${r.stall_number}`, sub: `${r.section || ''} ${r.vendor?.full_name ? `· ${r.vendor.full_name}` : ''}`, icon: '🏪', goto: 'stalls', tag: r.id })),
      ...(o.data || []).map(r => ({ type: 'order', label: `#${r.order_number?.slice(-8) || String(r.id).slice(-6)}`, sub: `₱${parseFloat(r.total_amount || 0).toLocaleString()} · ${new Date(r.created_at).toLocaleDateString('en-PH', { month:'short', day:'numeric' })}`, icon: '📦', goto: 'orders', tag: r.id })),
      ...(u.data || []).map(r => ({ type: 'user', label: r.full_name || r.email, sub: r.email || r.role, icon: '👤', goto: 'users', tag: r.id })),
    ];
    setSearchResults(results);
    setSearchLoading(false);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setShowResults(true);
    doSearch(val);
  };

  const SECTION_ORDER = [
    'overview', 'stalls', 'products', 'orders',
    'users', 'prices', 'price-history', 'price-anomaly',
    'announcements', 'complaints', 'chats', 'reports',
  ];
  const sectionMatches = useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    return SECTION_ORDER
      .filter(id => SECTION_LABELS[id]?.toLowerCase().includes(query.trim().toLowerCase()))
      .map(id => ({ id, label: SECTION_LABELS[id] }));
  }, [query]);

  const jumpTo = (section, tag = null) => {
    setActiveSection(section);
    setQuery('');
    setShowResults(false);
    setSearchResults([]);
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
                    placeholder="Search products, stalls, orders, vendors…"
          onChange={handleSearchChange}
          onFocus={() => setShowResults(true)}
          aria-label="Global search"
        />
        {showResults && (
          <div className="admin-topbar-search-results-expanded">
            {searchLoading && <div className="admin-topbar-search-loading">Searching…</div>}
            {!searchLoading && searchResults.length === 0 && query.trim().length < 2 && (
              <div className="admin-topbar-search-hint-small">Type 2+ chars to search products, stalls, orders, users</div>
            )}
            {!searchLoading && searchResults.length === 0 && query.trim().length >= 2 && (
              <div className="admin-topbar-search-empty">No results found</div>
            )}
            {!searchLoading && searchResults.map((r) => (
              <button key={`${r.type}-${r.tag}`} className="admin-topbar-search-result-row" onClick={() => jumpTo(r.goto, r.tag)}>
                <span className="admin-topbar-search-result-icon">{r.icon}</span>
                <div className="admin-topbar-search-result-labels">
                  <span className="admin-topbar-search-result-title">{r.label}</span>
                  <span className="admin-topbar-search-result-sub">{r.sub}</span>
                </div>
                <span className="admin-topbar-search-hint">Go →</span>
              </button>
            ))}
            {!searchLoading && query.trim().length >= 2 && searchResults.length === 0 && sectionMatches.length > 0 && (
              <div className="admin-topbar-search-divider" />
            )}
            {!searchLoading && sectionMatches.map((m) => (
              <button key={m.id} onClick={() => jumpTo(m.id)}>
                <span>{m.label}</span>
                <span className="admin-topbar-search-hint">Go →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="admin-topbar-actions">
        <ThemeToggle />

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
