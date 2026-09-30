import Navbar from '../components/Navbar';
import './Landing.css';

export default function Landing() {
  return (
    <div className="landing">
      <Navbar />

      {/* ── HERO ── */}
      <section className="hero">
        <div className="container hero-content">
          <h1 className="text-display hero-title">
            Your files,<br />secured in the cloud.
          </h1>
          <p className="text-smoke hero-subtitle">
            FileNest is a secure cloud storage platform. Upload, manage,
            and access your files from anywhere — with direct S3 uploads
            and encrypted authentication.
          </p>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="features-section">
        <div className="container">
          <div className="features-header">
            <span className="features-eyebrow">CAPABILITIES</span>
            <h2 className="text-heading-sm features-title">What FileNest offers</h2>
          </div>
          <div className="features-grid">
            <div className="feature-item">
              <span className="feature-number">01</span>
              <h3 className="text-heading-xs">Secure Authentication</h3>
              <p className="text-body text-smoke">
                JWT-based authentication with salted password hashing.
                Your account is protected by industry-standard security.
              </p>
            </div>
            <div className="feature-item">
              <span className="feature-number">02</span>
              <h3 className="text-heading-xs">Cloud File Storage</h3>
              <p className="text-body text-smoke">
                Files are stored securely on Amazon S3 infrastructure.
                Reliable, durable, and available whenever you need them.
              </p>
            </div>
            <div className="feature-item">
              <span className="feature-number">03</span>
              <h3 className="text-heading-xs">Direct S3 Uploads</h3>
              <p className="text-body text-smoke">
                Files stream straight from the browser to cloud storage via
                presigned URLs. No server bottlenecks or transfer delays.
              </p>
            </div>
            <div className="feature-item">
              <span className="feature-number">04</span>
              <h3 className="text-heading-xs">Encrypted Downloads</h3>
              <p className="text-body text-smoke">
                Generate time-limited presigned download URLs on demand.
                Your assets remain private and protected throughout transit.
              </p>
            </div>
            <div className="feature-item">
              <span className="feature-number">05</span>
              <h3 className="text-heading-xs">Asset Management</h3>
              <p className="text-body text-smoke">
                View, organize, preview, and delete files through a clean
                dashboard. Full control over your stored data.
              </p>
            </div>
            <div className="feature-item">
              <span className="feature-number">06</span>
              <h3 className="text-heading-xs">Storage Insights</h3>
              <p className="text-body text-smoke">
                Track storage capacity, inspect file types, and
                filter your assets with instant category views and metrics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="container footer-inner">
          <span className="footer-brand">FileNest</span>
          <span className="text-caption text-smoke">Secure cloud file storage.</span>
        </div>
      </footer>
    </div>
  );
}
