export default function About() {
  return (
    <>
      <section className="page-header">
        <div className="wrap">
          <span className="page-kicker">About Us</span>
          <h1>About PalengkeHub</h1>
          <p>Digitalizing the Lipa City Public Market for the modern Filipino.</p>
        </div>
      </section>
      <section className="section">
        <div className="wrap" style={{ maxWidth: '800px' }}>
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.75rem', color: 'var(--red-deep)', marginBottom: '16px' }}>
              Our Mission
            </h2>
            <p style={{ color: 'var(--gray)', lineHeight: '1.8', fontSize: '1.05rem' }}>
              PalengkeHub is dedicated to bringing the traditional Filipino palengke (public market) into the digital age. We connect customers with trusted local vendors at the Lipa City Public Market, making it easy to browse, order, and pick up fresh goods — all while supporting the local economy.
            </p>
          </div>
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.75rem', color: 'var(--red-deep)', marginBottom: '16px' }}>
              Our Story
            </h2>
            <p style={{ color: 'var(--gray)', lineHeight: '1.8', fontSize: '1.05rem' }}>
              Founded in 2025, PalengkeHub started as a student-led initiative to modernize the Lipa City Public Market Management Information System. What began as a capstone project has grown into a full platform serving hundreds of customers and dozens of vendors across Lipa City, Batangas.
            </p>
          </div>
          <div className="card-grid">
            <div className="card">
              <div className="card-icon">🎯</div>
              <h3>Our Vision</h3>
              <p>A fully digital public market ecosystem where every vendor thrives and every customer finds what they need.</p>
            </div>
            <div className="card">
              <div className="card-icon">🤝</div>
              <h3>Community First</h3>
              <p>We prioritize local vendors and the market community, ensuring that technology serves the people, not the other way around.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}