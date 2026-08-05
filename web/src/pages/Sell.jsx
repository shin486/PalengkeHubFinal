import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Sell() {
  const [form, setForm] = useState({
    businessName: '', category: '', description: '', email: '', phone: ''
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.businessName || !form.category || !form.email) {
      setStatus({ type: 'error', message: '⚠️ Please fill in all required fields.' });
      return;
    }
    setLoading(true);
    setStatus({ type: '', message: '' });
    try {
      const { error } = await supabase.from('vendor_applications').insert([{
        business_name: form.businessName,
        category: form.category,
        description: form.description,
        email: form.email,
        phone: form.phone,
        status: 'pending'
      }]);
      if (error) throw error;
      setStatus({ type: 'success', message: '✅ Application submitted! We will review it and get back to you soon.' });
      setForm({ businessName: '', category: '', description: '', email: '', phone: '' });
    } catch (err) {
      setStatus({ type: 'error', message: '⚠️ Failed to submit application. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="page-header">
        <div className="wrap">
          <span className="page-kicker">Become a Vendor</span>
          <h1>Sell on PalengkeHub</h1>
          <p>Join the Lipa City Public Market's digital platform and reach more customers online.</p>
        </div>
      </section>
      <section className="section">
        <div className="wrap" style={{ maxWidth: '640px' }}>
          <div className="card" style={{ padding: '40px' }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.5rem', color: 'var(--red-deep)', marginBottom: '8px' }}>
              Vendor Application
            </h2>
            <p style={{ color: 'var(--gray)', marginBottom: '24px', fontSize: '0.95rem' }}>
              Fill out the form below to apply as a vendor. Our team will review your application.
            </p>
            {status.message && (
              <div className={`form-status form-status-${status.type}`}>
                {status.message}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="businessName">Business Name *</label>
                <input type="text" id="businessName" name="businessName" value={form.businessName} onChange={handleChange} placeholder="Your stall or business name" required />
              </div>
              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <select id="category" name="category" value={form.category} onChange={handleChange} required>
                  <option value="">Select a category</option>
                  <option value="Fruits & Vegetables">Fruits & Vegetables</option>
                  <option value="Meat & Poultry">Meat & Poultry</option>
                  <option value="Seafood">Seafood</option>
                  <option value="Dry Goods">Dry Goods</option>
                  <option value="Cooked Food">Cooked Food</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" value={form.description} onChange={handleChange} rows="3" placeholder="Tell us about your products..." />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input type="email" id="email" name="email" value={form.email} onChange={handleChange} placeholder="your@email.com" required />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input type="tel" id="phone" name="phone" value={form.phone} onChange={handleChange} placeholder="+63 9XX XXX XXXX" />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}