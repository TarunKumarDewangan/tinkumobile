import { useAuth } from '../contexts/AuthContext';

/**
 * Route guard that checks for a specific permission.
 * If the user lacks the permission, shows an "Access Denied" message.
 * If user is owner/admin, access is granted automatically.
 */
export default function PermissionRoute({ permission, children }) {
  const { can } = useAuth();

  if (can(permission)) {
    return children;
  }

  return (
    <div className="d-flex flex-column align-items-center justify-content-center" style={{ padding: '60px 20px' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
      <h4 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '.5rem' }}>Access Denied</h4>
      <p style={{ color: '#64748b', fontSize: '.88rem', textAlign: 'center', maxWidth: 400 }}>
        You do not have the <strong>"{permission}"</strong> permission required to view this page.
      </p>
      <p style={{ color: '#94a3b8', fontSize: '.78rem' }}>
        Contact your shop manager or owner to request access.
      </p>
    </div>
  );
}
