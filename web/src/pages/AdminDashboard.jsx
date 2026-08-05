import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AdminSidebar from './admin/AdminSidebar';
import '../admin.css';

const ORDER_STATUS = {
  pending: { label: 'Pending', cls: 'status-pending' },
  confirmed: { label: 'Confirmed', cls: 'status-confirmed' },
  preparing: { label: 'Preparing', cls: 'status-preparing' },
  ready: { label: 'Ready', cls: 'status-ready' },
  completed: { label: 'Completed', cls: 'status-completed' },
  cancelled: { label: 'Cancelled', cls: 'status-cancelled' },
};

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
    overview:'Admin Dashboard',users:'User Management',stalls:'Stall Management',
    products:'Product Categories',orders:'Order Monitoring',
    prices:'Price Monitoring','price-history':'Price Change History',
    'price-anomaly':'Price Anomaly Detection',
    announcements:'Announcements',complaints:'Complaint Management',
    reports:'Reports Generation',audit:'Audit Trail',chats:'Chats',
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
    case 'users': return <DataTable table="profiles" cols={['full_name','email','role','created_at']} titles={['Name','Email','Role','Registered']} />;
    case 'stalls': return <Stalls />;
    case 'products': return <DataTable table="products" cols={['name','price','stock','stall_id']} titles={['Product','Price','Stock','Stall']} />;
    case 'prices': return <PriceMonitor />;
    case 'price-history': return <PriceHistory />;
    case 'price-anomaly': return <PriceAnomaly />;
    case 'orders': return <Orders />;
    case 'announcements': return <Announcements />;
    case 'complaints': return <DataTable table="complaints" cols={['user_name','subject','status','created_at']} titles={['From','Subject','Status','Date']} />;
    case 'chats': return <Chat />;
    case 'reports': return <Reports />;
    case 'audit': return <AuditTrail />;
    default: return <Overview />;
  }
}

/* ==================== PRICE MONITORING ==================== */
function PriceMonitor() {
  const [products, setProducts] = useState([]);
  useEffect(() => { supabase.from('products').select('*, stall:stall_id(stall_name, stall_number)').order('price', { ascending: false }).then(({ data }) => setProducts(data || [])); }, []);
  return (
    <div className="admin-section">
      <div className="admin-section-header">💰 Price Monitoring — All Products Across Stalls</div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Stall</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
          <tbody>
            {products.length === 0 ? <tr><td colSpan="5"><div className="empty-state"><div className="empty-state-icon">📦</div><div className="empty-state-text">No products found</div></div></td></tr>
              : products.map(p => {
                const isLow = p.stock < 5;
                const isHigh = p.price > 500;
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.stall?.stall_name || `Stall #${p.stall?.stall_number}` || '—'}</td>
                    <td style={{ color: isHigh ? '#DC2626' : '#059669', fontWeight: 700 }}>₱{parseFloat(p.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td>{p.stock || 0} {isLow && <span className="status-badge status-pending" style={{ marginLeft: '8px' }}>Low Stock</span>}</td>
                    <td><span className={`status-badge ${isLow ? 'status-pending' : 'status-ready'}`}>{isLow ? '⚠️ Reorder' : '✅ In Stock'}</span></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== PRICE CHANGE HISTORY ==================== */
function PriceHistory() {
  const [history, setHistory] = useState([]);
  useEffect(() => { supabase.from('price_history').select('*, product:product_id(name)').order('changed_at', { ascending: false }).limit(50).then(({ data }) => setHistory(data || [])); }, []);
  return (
    <div className="admin-section">
      <div className="admin-section-header">📝 Price Change History</div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Previous Price</th><th>New Price</th><th>Change</th><th>Date</th></tr></thead>
          <tbody>
            {history.length === 0 ? <tr><td colSpan="5"><div className="empty-state"><div className="empty-state-icon">📝</div><div className="empty-state-text">No price changes recorded</div></div></td></tr>
              : history.map(h => {
                const diff = parseFloat(h.new_price || 0) - parseFloat(h.previous_price || 0);
                const pct = h.previous_price ? ((diff / h.previous_price) * 100).toFixed(1) : 0;
                const isUp = diff > 0;
                return (
                  <tr key={h.id}>
                    <td><strong>{h.product?.name || 'Unknown'}</strong></td>
                    <td>₱{parseFloat(h.previous_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td>₱{parseFloat(h.new_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td style={{ color: isUp ? '#DC2626' : '#059669', fontWeight: 700 }}>
                      {isUp ? '↑' : '↓'} ₱{Math.abs(diff).toLocaleString('en-PH', { minimumFractionDigits: 2 })} ({pct}%)
                    </td>
                    <td>{new Date(h.changed_at).toLocaleDateString('en-PH')}</td>
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
  const detect = async () => {
    const { data: products } = await supabase.from('products').select('*');
    if (!products) return;
    const prices = products.map(p => parseFloat(p.price || 0)).filter(p => p > 0);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const flagged = products.filter(p => {
      const price = parseFloat(p.price || 0);
      return price > avg * 2 || price < avg * 0.3;
    });
    setAnomalies(flagged);
  };
  useEffect(() => { detect(); }, []);
  return (
    <div className="admin-section">
      <div className="admin-section-header">🔍 Price Anomaly Detection</div>
      <p style={{ color: 'var(--admin-text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
        Products with prices significantly above or below the market average are flagged below.
      </p>
      <button className="btn btn-primary" onClick={detect} style={{ marginBottom: '20px' }}>🔄 Re-run Detection</button>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Product</th><th>Price</th><th>Flag</th><th>Action</th></tr></thead>
          <tbody>
            {anomalies.length === 0 ? <tr><td colSpan="4"><div className="empty-state"><div className="empty-state-icon">✅</div><div className="empty-state-text">No anomalies detected — all prices are within normal range</div></div></td></tr>
              : anomalies.map(p => {
                const isHigh = parseFloat(p.price) > 300;
                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td style={{ color: isHigh ? '#DC2626' : '#F59E0B', fontWeight: 700 }}>₱{parseFloat(p.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td><span className={`status-badge ${isHigh ? 'status-cancelled' : 'status-pending'}`}>{isHigh ? '⚠️ Overpriced' : '⚠️ Underpriced'}</span></td>
                    <td><button className="btn btn-sm btn-danger">Verify</button></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== AUDIT TRAIL ==================== */
function AuditTrail() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100).then(({ data }) => setLogs(data || [])); }, []);
  return (
    <div className="admin-section">
      <div className="admin-section-header">📋 Audit Trail — System Activity Log</div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Timestamp</th><th>Action</th><th>Entity</th><th>Details</th><th>User</th></tr></thead>
          <tbody>
            {logs.length === 0 ? <tr><td colSpan="5"><div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-text">No audit logs recorded yet</div></div></td></tr>
              : logs.map(l => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString('en-PH')}</td>
                  <td><span className="status-badge status-confirmed">{l.action || 'Update'}</span></td>
                  <td>{l.entity_type || '—'}</td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.details || '—'}</td>
                  <td>{l.user_email || 'System'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== OVERVIEW ==================== */
function Overview() {
  const [stats, setStats] = useState({});
  const [orders, setOrders] = useState([]);
  useEffect(() => { load(); }, []);
  async function load() {
    const r = await Promise.all([
      supabase.from('profiles').select('id',{count:'exact',head:true}).eq('role','vendor'),
      supabase.from('profiles').select('id',{count:'exact',head:true}).eq('role','consumer'),
      supabase.from('stalls').select('id',{count:'exact',head:true}),
      supabase.from('orders').select('id',{count:'exact',head:true}),
      supabase.from('products').select('id',{count:'exact',head:true}),
      supabase.from('vendor_applications').select('id',{count:'exact',head:true}).eq('status','pending'),
      supabase.from('orders').select('id',{count:'exact',head:true}).eq('status','pending'),
      supabase.from('complaints').select('id',{count:'exact',head:true}).eq('status','pending'),
    ]);
    setStats({ vendors:r[0].count||0, customers:r[1].count||0, stalls:r[2].count||0, orders:r[3].count||0, products:r[4].count||0, pendingApps:r[5].count||0, pendingOrders:r[6].count||0, pendingComplaints:r[7].count||0 });
    const { data } = await supabase.from('orders').select('*').order('created_at',{ascending:false}).limit(5);
    setOrders(data||[]);
  }
  return (
    <>
      <div className="priority-grid">
        {[
          {v:stats.pendingApps,l:'Pending Applications',c:'#C62828',bg:'rgba(198,40,40,0.06)'},
          {v:stats.pendingOrders,l:'Pending Orders',c:'#E65100',bg:'rgba(230,81,0,0.06)'},
          {v:stats.pendingComplaints,l:'Pending Complaints',c:'#D32F2F',bg:'rgba(211,47,47,0.06)'},
        ].map((p,i)=>(
          <div key={i} className="priority-card" style={{background:p.bg,borderColor:p.c+'30'}}>
            <div className="priority-card-value" style={{color:p.c}}>{p.v}</div>
            <div className="priority-card-label" style={{color:p.c}}>{p.l}</div>
          </div>
        ))}
      </div>
      <div className="stats-grid">
        {[
          {v:stats.vendors,l:'Total Vendors'},{v:stats.stalls,l:'Total Stalls'},
          {v:stats.products,l:'Total Products'},{v:stats.orders,l:'Total Orders'},
          {v:stats.customers,l:'Registered Users'},{v:stats.pendingApps,l:'Pending Apps'},
        ].map((s,i)=>(
          <div key={i} className="stat-card">
            <div className="stat-card-value">{s.v}</div>
            <div className="stat-card-label">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="admin-section">
        <div className="admin-section-header">📦 Recent Orders</div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Order #</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
            <tbody>
              {orders.length===0?<tr><td colSpan="4"><div className="empty-state"><div className="empty-state-icon">📭</div><div className="empty-state-text">No orders yet</div></div></td></tr>
                :orders.map(o=>{const s=ORDER_STATUS[o.status]||ORDER_STATUS.pending;return(
                  <tr key={o.id}><td>#{String(o.id).slice(-6)}</td><td><span className={`status-badge ${s.cls}`}>{s.label}</span></td><td>₱{parseFloat(o.total||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</td><td>{new Date(o.created_at).toLocaleDateString('en-PH')}</td></tr>
                );})}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ==================== DATA TABLE ==================== */
function DataTable({ table, eq, cols, titles }) {
  const [data, setData] = useState([]);
  useEffect(()=>{
    let q = supabase.from(table).select('*').order('created_at',{ascending:false});
    if (eq) Object.entries(eq).forEach(([k,v])=> q = q.eq(k,v));
    q.then(({data:r})=>setData(r||[]));
  },[table,JSON.stringify(eq)]);

  const formatVal = (row, col) => {
    const v = row[col];
    if (col === 'created_at') return new Date(v).toLocaleDateString('en-PH');
    if (col === 'role') return <span style={{textTransform:'capitalize'}}>{v}</span>;
    if (col === 'status') return <span className={`status-badge status-${v||'pending'}`}>{v||'pending'}</span>;
    if (col === 'violation_type') return <span className="status-badge status-cancelled">{v||'General'}</span>;
    if (col === 'price') return `₱${v}`;
    return String(v||'—');
  };

  return (
    <div className="admin-section">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr>{titles.map((t,i)=><th key={i}>{t}</th>)}</tr></thead>
          <tbody>
            {data.length===0?<tr><td colSpan={titles.length}><div className="empty-state"><div className="empty-state-icon">📂</div><div className="empty-state-text">No data found</div></div></td></tr>
              :data.map(r=><tr key={r.id}>{cols.map((c,i)=><td key={i}>{formatVal(r,c)}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== COMPLIANCE ==================== */
function Compliance() {
  const [data,setData]=useState([]);
  useEffect(()=>{supabase.from('profiles').select('*').eq('role','vendor').order('created_at',{ascending:false}).then(({data:r})=>setData(r||[]));},[]);
  return <div className="admin-section"><div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>Vendor</th><th>Email</th><th>Compliance</th><th>Status</th></tr></thead>
    <tbody>{data.length===0?<tr><td colSpan="4"><div className="empty-state"><div className="empty-state-icon">📂</div><div className="empty-state-text">No vendors found</div></div></td></tr>
      :data.map(v=><tr key={v.id}><td><strong>{v.full_name}</strong></td><td>{v.email}</td><td>{v.compliance_score||100}%</td><td><span className="status-badge status-completed">Compliant</span></td></tr>)}</tbody>
  </table></div></div>;
}

/* ==================== APPLICATIONS ==================== */
function Applications() {
  const [apps,setApps]=useState([]);
  const load=()=>supabase.from('vendor_applications').select('*').order('created_at',{ascending:false}).then(({data})=>setApps(data||[]));
  useEffect(()=>{load();},[]);
  const update=(id,status)=>supabase.from('vendor_applications').update({status}).eq('id',id).then(load);
  return <div className="admin-section"><div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>Business</th><th>Category</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
    <tbody>{apps.length===0?<tr><td colSpan="5"><div className="empty-state"><div className="empty-state-icon">📂</div><div className="empty-state-text">No applications</div></div></td></tr>
      :apps.map(a=><tr key={a.id}><td><strong>{a.business_name}</strong></td><td>{a.category}</td>
        <td><span className={`status-badge status-${a.status||'pending'}`}>{a.status||'pending'}</span></td>
        <td>{new Date(a.created_at).toLocaleDateString('en-PH')}</td>
        <td>{a.status==='pending'&&<div style={{display:'flex',gap:'8px'}}>
          <button className="btn btn-success btn-sm" onClick={()=>update(a.id,'approved')}>Approve</button>
          <button className="btn btn-danger btn-sm" onClick={()=>update(a.id,'rejected')}>Reject</button>
        </div>}</td></tr>)}</tbody>
  </table></div></div>;
}

/* ==================== STALLS ==================== */
function Stalls() {
  const [stalls,setStalls]=useState([]);
  useEffect(()=>{supabase.from('stalls').select('*').order('stall_number',{ascending:true}).then(({data})=>setStalls(data||[]));},[]);
  return <div className="stall-cards-grid">
    {stalls.length===0?<div className="empty-state"><div className="empty-state-icon">🏪</div><div className="empty-state-text">No stalls found</div></div>
      :stalls.map(s=><div key={s.id} className="stall-card">
        <div className="stall-card-icon">🏪</div>
        <h3 className="stall-card-title">{s.stall_name||`Stall #${s.stall_number}`}</h3>
        <p className="stall-card-detail">Section: {s.section||'N/A'} | Floor: {s.floor||'N/A'}</p>
        <span className={`stall-card-status ${s.is_active?'stall-active':'stall-inactive'}`}>{s.is_active?'🟢 Active':'🔴 Inactive'}</span>
      </div>)}
  </div>;
}

/* ==================== ORDERS ==================== */
function Orders() {
  const [orders,setOrders]=useState([]);
  const load=()=>supabase.from('orders').select('*').order('created_at',{ascending:false}).limit(50).then(({data})=>setOrders(data||[]));
  useEffect(()=>{load();},[]);
  const update=(id,status)=>supabase.from('orders').update({status}).eq('id',id).then(load);
  return <div className="admin-section"><div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>Order #</th><th>Status</th><th>Total</th><th>Date</th><th>Action</th></tr></thead>
    <tbody>{orders.length===0?<tr><td colSpan="5"><div className="empty-state"><div className="empty-state-icon">📦</div><div className="empty-state-text">No orders found</div></div></td></tr>
      :orders.map(o=>{const s=ORDER_STATUS[o.status]||ORDER_STATUS.pending;return(
        <tr key={o.id}><td><strong>#{String(o.id).slice(-6)}</strong></td>
          <td><span className={`status-badge ${s.cls}`}>{s.label}</span></td>
          <td>₱{parseFloat(o.total||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
          <td>{new Date(o.created_at).toLocaleDateString('en-PH')}</td>
          <td><select className="status-select" value={o.status} onChange={e=>update(o.id,e.target.value)}>
            {Object.keys(ORDER_STATUS).map(k=><option key={k} value={k}>{ORDER_STATUS[k].label}</option>)}
          </select></td></tr>
      );})}</tbody>
  </table></div></div>;
}

/* ==================== ANNOUNCEMENTS ==================== */
function Announcements() {
  const [items,setItems]=useState([]);
  const load=()=>supabase.from('announcements').select('*').order('created_at',{ascending:false}).then(({data})=>setItems(data||[]));
  useEffect(()=>{load();},[]);
  const create=async()=>{const t=prompt('Title:');const c=prompt('Content:');if(t&&c){await supabase.from('announcements').insert({title:t,content:c});load();}};
  return <div className="admin-section">
    <button className="btn btn-primary" onClick={create} style={{marginBottom:'20px'}}>+ New Announcement</button>
    <div className="announcement-grid">
      {items.length===0?<div className="empty-state"><div className="empty-state-icon">📢</div><div className="empty-state-text">No announcements</div></div>
        :items.map(a=><div key={a.id} className="announcement-card"><h4>{a.title}</h4><p>{a.content}</p><div className="date">{new Date(a.created_at).toLocaleDateString('en-PH')}</div></div>)}
    </div>
  </div>;
}

/* ==================== CHAT ==================== */
function Chat() {
  const [convs,setConvs]=useState([]);
  const [active,setActive]=useState(null);
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState('');
  const ref=useRef(null);
  useEffect(()=>{supabase.from('conversations').select('*, customer:customer_id(id,full_name), stall:stall_id(id,stall_name,stall_number)').order('updated_at',{ascending:false}).then(({data})=>setConvs(data||[]));},[]);
  async function loadMsgs(id){setActive(id);const {data}=await supabase.from('messages').select('*').eq('conversation_id',id).order('created_at',{ascending:true});setMsgs(data||[]);setTimeout(()=>ref.current?.scrollTo(0,ref.current.scrollHeight),100);}
  async function send(){if(!input.trim()||!active)return;const {data:{session}}=await supabase.auth.getSession();await supabase.from('messages').insert({conversation_id:active,sender_id:session.user.id,sender_role:'customer',message:input,is_image:false});setInput('');loadMsgs(active);}
  return <div className="chat-container">
    <div className="chat-sidebar">
      <div className="chat-sidebar-header">Conversations</div>
      <div className="chat-sidebar-list">
        {convs.length===0?<div className="empty-state"><div className="empty-state-text">No conversations</div></div>
          :convs.map(c=><div key={c.id} className={`chat-conv-item${active===c.id?' active':''}`} onClick={()=>loadMsgs(c.id)}>
            <div className="chat-conv-name">{c.customer?.full_name||'User'} — {c.stall?.stall_name||'Stall'}</div>
            <div className="chat-conv-preview">{c.last_message||'No messages'}</div>
          </div>)}
      </div>
    </div>
    <div className="chat-main">
      {!active?<div className="chat-empty">Select a conversation to view messages</div>:<>
        <div className="chat-messages" ref={ref}>
          {msgs.length===0?<div className="chat-empty">No messages yet</div>
            :msgs.map(m=><div key={m.id} className={`chat-msg ${m.sender_role==='customer'||m.sender_role==='admin'?'chat-msg-sent':'chat-msg-received'}`}>{m.message}<div className="chat-msg-time">{new Date(m.created_at).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}</div></div>)}
        </div>
        <div className="chat-input-bar">
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Type a message..."/>
          <button onClick={send}>Send</button>
        </div>
      </>}
    </div>
  </div>;
}

/* ==================== REPORTS ==================== */
function Reports() {
  const [reports,setReports]=useState({customer:[],vendor:[]});
  useEffect(()=>{Promise.all([supabase.from('customer_reports').select('*').order('created_at',{ascending:false}),supabase.from('vendor_reports').select('*').order('created_at',{ascending:false})]).then(([c,v])=>setReports({customer:c.data||[],vendor:v.data||[]}));},[]);
  return <>
    <div className="admin-section">
      <div className="admin-section-header">Customer Reports</div>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Type</th><th>Description</th><th>Date</th></tr></thead>
        <tbody>{reports.customer.length===0?<tr><td colSpan="3"><div className="empty-state"><div className="empty-state-text">No customer reports</div></div></td></tr>
          :reports.customer.map(r=><tr key={r.id}><td>{r.report_type||'—'}</td><td>{r.description||'—'}</td><td>{new Date(r.created_at).toLocaleDateString('en-PH')}</td></tr>)}</tbody>
      </table></div>
    </div>
    <div className="admin-section">
      <div className="admin-section-header">Vendor Reports</div>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Type</th><th>Description</th><th>Date</th></tr></thead>
        <tbody>{reports.vendor.length===0?<tr><td colSpan="3"><div className="empty-state"><div className="empty-state-text">No vendor reports</div></div></td></tr>
          :reports.vendor.map(r=><tr key={r.id}><td>{r.report_type||'—'}</td><td>{r.description||'—'}</td><td>{new Date(r.created_at).toLocaleDateString('en-PH')}</td></tr>)}</tbody>
      </table></div>
    </div>
  </>;
}