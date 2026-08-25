import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCategories } from '../lib/queries';
import { EASE, useMotionOK } from '../lib/motion';
import { Logo } from './Logo';
import '../styles/footer.css';

export function Footer() {
  const { data: categories } = useCategories();
  const topCategories = (categories ?? []).filter((c) => !c.parentId);
  const ok = useMotionOK();

  return (
    <footer className="site-footer">
      <motion.span
        className="footer-hairline"
        aria-hidden="true"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: EASE }}
      />
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo size={40} className="footer-logo" />
          <p className="footer-heritage">Dealing in textiles since 1992</p>
          <p className="footer-story">
            Three decades of trust, woven into every weave. From handpicked sarees to
            antique imitation jewellery, Chikbo brings premium Indian fashion home —
            quality checked, budget friendly, delivered pan-India.
          </p>
        </div>

        <nav className="footer-col" aria-label="Shop categories">
          <h3>Shop</h3>
          <ul>
            {topCategories.map((cat) => (
              <li key={cat.id}>
                <Link to={`/c/${cat.slug}`}>{cat.name}</Link>
              </li>
            ))}
            <li>
              <Link to="/search?q=new">New Arrivals</Link>
            </li>
          </ul>
        </nav>

        <nav className="footer-col" aria-label="Policies">
          <h3>Policies</h3>
          <ul>
            <li>
              <Link to="/policy/shipping">Shipping &amp; Delivery</Link>
            </li>
            <li>
              <Link to="/policy/returns">Returns &amp; Refunds</Link>
            </li>
            <li>
              <Link to="/policy/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link to="/policy/terms">Terms of Service</Link>
            </li>
          </ul>
        </nav>

        <div className="footer-col">
          <h3>Contact</h3>
          <ul>
            <li>
              <a href="tel:+919346060635">+91 93460 60635</a>
            </li>
            <li>
              <address>
                21-1-684 &amp; 85, Rikab gunj,
                <br />
                Hyderabad, Telangana
              </address>
            </li>
            <li>
              <Link to="/account/orders">Track your order</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-ghost-wrap" aria-hidden="true">
        <motion.p
          className="footer-ghost"
          initial={{ y: ok ? 60 : 0, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: '0px 0px -40px 0px' }}
          transition={{ duration: 1.2, ease: EASE }}
        >
          CHIKBO
        </motion.p>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p>© {new Date().getFullYear()} Chikbo · Trust, Quality and Budget friendly</p>
          <p className="footer-since">Woven with trust since 1992</p>
        </div>
      </div>
    </footer>
  );
}
