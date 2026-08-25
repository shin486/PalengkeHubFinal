import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
 setStatus({ type: 'error', message: ' Please fill in all required fields.'});
      return;
    }
    setLoading(true);
    setStatus({ type: '', message: '' });
    try {
      const { error } = await supabase.from('contact_messages').insert([{
        name: form.name, email: form.email, subject: form.subject, message: form.message,
      }]);
      if (error) throw error;
 setStatus({ type: 'success', message: " Message sent! We'll get back to you soon."});
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
 setStatus({ type: 'error', message: ' Failed to send message. Please try again.'});
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="page-header">
        <div className="wrap">
          <span className="page-kicker">Get In Touch</span>
          <h1>Contact Us</h1>
          <p>Have questions or feedback? We'd love to hear from you.</p>
        </div>
      </section>
      <section className="section">
        <div className="wrap" style={{ maxWidth: '640px' }}>
          <div className="card" style={{ padding: '40px' }}>
            {status.message && (
              <div className={`form-status form-status-${status.type}`}>{status.message}</div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input type="text" id="name" name="name" value={form.name} onChange={handleChange} placeholder="Juan Dela Cruz" required />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input type="email" id="email" name="email" value={form.email} onChange={handleChange} placeholder="juan@example.com" required />
              </div>
              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input type="text" id="subject" name="subject" value={form.subject} onChange={handleChange} placeholder="How can we help?" />
              </div>
              <div className="form-group">
                <label htmlFor="message">Message *</label>
                <textarea id="message" name="message" value={form.message} onChange={handleChange} rows="5" placeholder="Tell us what's on your mind..." required />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}