import { Link } from 'react-router-dom';
import { usePageTitle } from '../components/ui';

export function Forbidden() {
  usePageTitle('No access');
  return (
    <div className="page forbidden">
      <h1>403</h1>
      <p className="muted">
        You don't have access to this area. Ask a super admin to grant the permission if you need it.
      </p>
      <Link className="link" to="/">
        Back to your workspace
      </Link>
    </div>
  );
}

export function NotFound() {
  usePageTitle('Not found');
  return (
    <div className="page forbidden">
      <h1>404</h1>
      <p className="muted">That page doesn't exist.</p>
      <Link className="link" to="/">
        Back to your workspace
      </Link>
    </div>
  );
}
