import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

const NAV = [
  { section: 'Main' },
  { to: '/', icon: '📊', label: 'Dashboard', perm: 'view_dashboard', end: true },
  
  { 
    section: 'New Mobile', 
    dropdown: true,
    children: [
        { to: '/purchases',   icon: '🛒', label: 'Purchases',  perm: 'view_purchases' },
        { to: '/stock-entry', icon: '📦', label: 'Stocks',       perm: 'create_purchases' },
        { to: '/sales',       icon: '🧾', label: 'Sales',      perm: 'view_sales' },
    ]
  },
  
  { 
    section: 'Other Inventory', 
    dropdown: true,
    children: [
        { to: '/products',    icon: '📱', label: 'Products',   perm: 'view_products' },
        { to: '/sim-cards',   icon: '📶', label: 'SIM Cards',  perm: 'view_sims' },
        { to: '/old-mobiles', icon: '📲', label: 'Old Mobiles',perm: 'view_old_mobile_purchases' },
        { to: '/gifts',       icon: '🎁', label: 'Gifts',      perm: 'view_gifts' },
    ]
  },

  { 
    section: 'Services', 
    dropdown: true,
    children: [
        { to: '/recharge',    icon: '⚡', label: 'Recharge',   perm: 'view_recharge_sales' },
        { to: '/repairs',     icon: '🔧', label: 'Repairs',    perm: 'view_repairs' },
        { to: '/follow-ups',  icon: '📅', label: 'Follow-ups', perm: 'view_followups' },
        { to: '/loans',       icon: '💰', label: 'Loans',      perm: 'view_loans' },
    ]
  },

  { 
    section: 'Business', 
    dropdown: true,
    children: [
        { to: '/customers',   icon: '👥', label: 'Customers',  perm: 'view_customers' },
        { to: '/admin/users', icon: '👷', label: 'Staff Details', perm: 'manage_users' },
        { to: '/admin/shops', icon: '🏪', label: 'Shops Manager',  perm: 'manage_shops' },
        { to: '/suppliers',   icon: '🏭', label: 'Suppliers',  perm: 'view_suppliers' },
        { to: '/incentives',  icon: '🏆', label: 'Incentives', perm: 'manage_incentives' },
        { to: '/offers',      icon: '🎯', label: 'Offers',     perm: 'manage_offers' },
        { to: '/reports',     icon: '📈', label: 'Reports',    perm: 'view_reports' },
    ]
  },

  { 
    section: 'Accounts', 
    dropdown: true,
    children: [
        { to: '/accounts/cashbook', icon: '📖', label: 'Cashbook', perm: 'view_reports' },
        { to: '/accounts/entity-ledger', icon: '🧾', label: 'Entity Ledger', perm: 'view_reports' },
        { to: '/accounts/entity-manager', icon: '👥', label: 'Entity Manager', perm: 'view_reports' },
        { to: '/accounts/expenses',  icon: '💸', label: 'Overheads', perm: 'view_reports' },
        { to: '/accounts/categories', icon: '📁', label: 'Categories', perm: 'view_reports' },
    ]
  },

  { 
    section: 'Airtel Recovery', 
    dropdown: true,
    children: [
        { to: '/airtel/quick-recovery', icon: '⚡', label: 'Quick Recovery', perm: 'view_airtel_recovery' },
        { to: '/airtel/retailers', icon: '🏪', label: 'Retailers', perm: 'view_airtel_recovery' },
        { to: '/airtel/drops',     icon: '📉', label: 'Daily Drops', perm: 'view_airtel_recovery' },
        { to: '/airtel/reports',   icon: '📊', label: 'Reports',    perm: 'view_reports' },
    ]
  },
];

const BOTTOM_TABS = [
  { to: '/',         icon: '📊', label: 'Home',     end: true },
  { to: '/sales',    icon: '🧾', label: 'Sales',    perm: 'view_sales' },
  { to: '/airtel/quick-recovery', icon: '⚡', label: 'Recovery', perm: 'view_airtel_recovery' },
  { to: '/products', icon: '📱', label: 'Products', perm: 'view_products' },
  { to: '/repairs',  icon: '🔧', label: 'Repairs',  perm: 'view_repairs' },
];

export default function Layout() {
  const { user, logout, can, isOwner, isAdmin, isManager, hasFullAccess } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expanded, setExpanded] = useState({ 'New Mobile': true, 'Other Inventory': false, 'Services': false, 'Business': false, 'Accounts': false, 'Airtel Recovery': false });
  
  const toggleSection = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const closeSidebar = () => setSidebarOpen(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };
  
  // Shortcut: Alt + S for Stocks
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        navigate('/stock-entry');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const shopName = user?.shop?.name || (hasFullAccess() ? 'TinkuMobiles Main' : '');
  const roleName = isOwner() ? 'Owner' : (isAdmin() ? 'Executive' : (user?.roles?.[0] || 'Staff'));

  const isVisible = (item) => {
    if (item.owner && !hasFullAccess()) return false;
    if (item.perm && !can(item.perm)) return false;
    // Hide reports for Managers
    if (item.label === 'Reports' && isManager()) return false;
    return true;
  };

  return (
    <div style={{ display:'flex' }}>

      {/* ── Sidebar backdrop (mobile) ── */}
      <div className={`sidebar-backdrop ${sidebarOpen ? 'active' : ''}`} onClick={closeSidebar} />

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span role="img" aria-label="phone">📱</span>
          Tinku<span>Mobiles</span>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) => {
            if (item.section && !item.dropdown) return <div key={i} className="sidebar-section">{item.section}</div>;
            
            if (item.section && item.dropdown) {
                const isExpanded = expanded[item.section];
                const visibleChildren = (item.children || []).filter(isVisible);
                if (visibleChildren.length === 0) return null;

                return (
                    <div key={i} className="sidebar-dropdown">
                        <button className="sidebar-dropdown-toggle" onClick={() => toggleSection(item.section)}>
                            <div className="d-flex align-items-center gap-2">
                                <span style={{fontSize:'0.9rem'}}>
                                    {item.section === 'New Mobile' ? '📦' : 
                                     item.section === 'Other Inventory' ? '🗃️' :
                                     item.section === 'Services' ? '🛠️' :
                                     item.section === 'Business' ? '💼' :
                                     item.section === 'Accounts' ? '🏦' :
                                     item.section === 'Airtel Recovery' ? '🔴' : '⚙️'}
                                </span>
                                {item.section}
                            </div>
                            <span className="dropdown-arrow" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
                        </button>
                        {isExpanded && (
                            <div className="sidebar-dropdown-content" style={{ paddingLeft: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.05)', marginLeft: '1.25rem' }}>
                                {visibleChildren.map(child => (
                                    <NavLink key={child.to} to={child.to} end={child.end} onClick={closeSidebar}>
                                        {child.icon} {child.label}
                                    </NavLink>
                                ))}
                            </div>
                        )}
                    </div>
                );
            }

            if (!isVisible(item)) return null;
            return (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={closeSidebar}>
                {item.icon} {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <div className="user-name">{user?.name}</div>
          <div>{roleName}</div>
          {shopName && <div style={{ fontSize:'0.71rem', marginTop:'2px', opacity:0.7 }}>🏪 {shopName}</div>}
        </div>

        <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          <button onClick={handleLogout}
            style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.65rem 1.1rem', color:'#ff6b6b', background:'none', border:'none', width:'100%', cursor:'pointer', fontSize:'0.875rem', fontWeight:500 }}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="main-content" style={{ flex:1 }}>

        {/* ── Sticky Topbar ── */}
        <header className="topbar">
          <div className="d-flex align-items-center gap-2">
            {/* Hamburger – visible on mobile */}
            <button className="topbar-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <span className="topbar-brand">Tinku<span>Mobiles</span></span>
            {shopName && <span className="text-muted d-none d-sm-inline" style={{ fontSize:'0.78rem' }}>— {shopName}</span>}
          </div>
          <div className="topbar-right">
            <span className="badge rounded-pill" style={{ background:isAdmin()? '#fef3c7':  'var(--primary)', color: isAdmin()? '#92400e' : '#fff', fontSize:'0.7rem' }}>{roleName}</span>
            <span className="text-muted d-none d-md-inline" style={{ fontSize:'0.8rem' }}>{user?.email}</span>
          </div>
        </header>

        {/* ── Page body ── */}
        <div className="page-body fade-in">
          <Outlet />
        </div>
      </div>

      {/* ── Bottom mobile navigation bar ── */}
      <nav className="mobile-navbar">
        <div className="mobile-navbar-inner">
          {BOTTOM_TABS.filter(isVisible).map(t => (
            <NavLink key={t.to} to={t.to} end={t.end} className="mobile-nav-item" onClick={closeSidebar}>
              <span className="nav-icon">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
          <button className="mobile-nav-item" onClick={() => setSidebarOpen(true)}>
            <span className="nav-icon">☰</span>
            More
          </button>
        </div>
      </nav>

    </div>
  );
}
