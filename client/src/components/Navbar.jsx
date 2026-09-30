import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

/**
 * Public navbar — shown on landing, login, signup pages.
 * Contains FileNest branding and auth CTAs.
 */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar-inner container">
        <Link to="/" className="navbar-brand">FileNest</Link>
        <div className="navbar-actions">
          <Link to="/login" className="btn-ghost">Login</Link>
          <Link to="/signup" className="btn-primary navbar-signup-btn">Sign Up</Link>
        </div>
      </div>
    </nav>
  );
}
