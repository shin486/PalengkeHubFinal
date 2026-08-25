import { Link } from 'react-router-dom';

const features = [
 { icon: ', title: 'Shop Online', desc: 'Browse stalls and products from Lipa City Public Market vendors. Order your fresh tinda in just a few taps.'},
 { icon: ', title: 'For Vendors', desc: 'List your stall, manage products, and grow your business with PalengkeHub\'s digital platform.'},
 { icon: ', title: 'Market Pickup', desc: 'Order online and pick up at the market — no delivery fees, just fresh goods waiting for you.'},
 { icon: ', title: 'Market Analytics', desc: 'Real-time data and insights for market administrators to monitor activity and trends.'},
 { icon: ', title: 'Chat Support', desc: 'Message your vendor directly for special requests or to confirm your order before pickup.'},
 { icon: ', title: 'Secure & Reliable', desc: 'All transactions and data are protected. Built for the Lipa City Public Market community.'},
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="wrap">
          <h1>
            Your <span className="highlight">Palengke</span>,<br />Right on Your Phone
          </h1>
          <p>
            PalengkeHub brings the Lipa City Public Market online. Browse stalls, order fresh produce and goods, and pick them up at the market — no delivery fees, just the palengke experience made digital.
          </p>
          <div className="hero-actions">
 <Link to="/shop" className="btn-primary"> Start Shopping</Link>
 <Link to="/sell" className="btn-secondary"> Become a Vendor</Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section" id="features">
        <div className="wrap">
          <div className="section-header">
            <span className="section-kicker">Why PalengkeHub</span>
            <h2>Everything You Need in One Place</h2>
            <p>From shopping to selling, PalengkeHub connects the entire market community.</p>
          </div>
          <div className="card-grid">
            {features.map((f, i) => (
              <div className="card" key={i}>
                <div className="card-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="section section-light" id="stats">
        <div className="wrap">
          <div className="section-header">
            <span className="section-kicker">Our Impact</span>
            <h2>Growing the Market Community</h2>
          </div>
          <div className="stats-row">
            <div>
              <div className="stat-number">50+</div>
              <div className="stat-label">Active Stalls</div>
            </div>
            <div>
              <div className="stat-number">1,000+</div>
              <div className="stat-label">Happy Customers</div>
            </div>
            <div>
              <div className="stat-number">5,000+</div>
              <div className="stat-label">Orders Processed</div>
            </div>
            <div>
              <div className="stat-number">24/7</div>
              <div className="stat-label">Market Access</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section text-center">
        <div className="wrap">
          <h2 style={{ fontFamily: 'var(--display)', fontSize: '2rem', color: 'var(--red-deep)', marginBottom: '16px' }}>
            Ready to Experience the Digital Palengke?
          </h2>
          <p style={{ color: 'var(--gray)', marginBottom: '32px', fontSize: '1.05rem' }}>
            Download the PalengkeHub app or start shopping online today.
          </p>
          <div className="hero-actions">
 <Link to="/shop" className="btn-primary"> Browse Products</Link>
 <Link to="/sell" className="btn-secondary"> Sell with Us</Link>
          </div>
        </div>
      </section>
    </>
  );
}