import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Shop() {
  const [stalls, setStalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStalls() {
      const { data, error } = await supabase
        .from('stalls')
        .select('*')
        .order('stall_number', { ascending: true });
      if (!error && data) setStalls(data);
      setLoading(false);
    }
    fetchStalls();
  }, []);

  return (
    <>
      <section className="page-header">
        <div className="wrap">
          <span className="page-kicker">Marketplace</span>
          <h1>Browse Stalls & Products</h1>
          <p>Explore all active stalls at the Lipa City Public Market.</p>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          {loading ? (
            <p className="text-center" style={{ color: 'var(--gray)' }}>Loading stalls...</p>
          ) : stalls.length === 0 ? (
            <div className="text-center">
              <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>🏪</p>
              <p style={{ color: 'var(--gray)' }}>No stalls available yet. Check back soon!</p>
            </div>
          ) : (
            <div className="card-grid">
              {stalls.map(stall => (
                <div className="card" key={stall.id}>
                  <div className="card-icon">🏪</div>
                  <h3>{stall.stall_name || `Stall #${stall.stall_number}`}</h3>
                  <p><strong>Section:</strong> {stall.section || 'General'}</p>
                  <p style={{ marginTop: '8px', color: 'var(--gray)', fontSize: '0.9rem' }}>
                    {stall.description || 'Fresh products available for order.'}
                  </p>
                  <div style={{ marginTop: '16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '4px 12px', borderRadius: '20px',
                      background: stall.is_active ? '#D1FAE5' : '#FEE2E2',
                      color: stall.is_active ? '#065F46' : '#991B1B',
                      fontSize: '0.8rem', fontWeight: 600
                    }}>
                      {stall.is_active ? '🟢 Active' : '🔴 Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}