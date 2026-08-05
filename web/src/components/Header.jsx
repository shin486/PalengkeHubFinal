import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header">
      <div className="wrap">
        <Link to="/" className="logo">
          <img src="/palengkehublogo.jpg" alt="PalengkeHub" />
          <span className="logo-text">PalengkeHub</span>
        </Link>
        <nav>
          <button
            className={`menu-btn${menuOpen ? ' active' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <ul id="nav-menu" className={menuOpen ? 'active' : ''}>
            <li><NavLink to="/" end onClick={() => setMenuOpen(false)}>Home</NavLink></li>
            <li><NavLink to="/shop" onClick={() => setMenuOpen(false)}>Shop</NavLink></li>
            <li><NavLink to="/sell" onClick={() => setMenuOpen(false)}>Sell</NavLink></li>
            <li><NavLink to="/about" onClick={() => setMenuOpen(false)}>About</NavLink></li>
            <li><NavLink to="/contact" onClick={() => setMenuOpen(false)}>Contact</NavLink></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}