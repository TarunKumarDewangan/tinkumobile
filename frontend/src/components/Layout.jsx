import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import api from '../api/axios';

const NAV = [
  { section: 'Main' },
  { to: '/', icon: '📊', label: 'Dashboard', perm: 'view_dashboard', end: true },
  
  { 
    section: 'Master Entries', 
    dropdown: true,
    children: [
        { to: '/purchases?category_group=master', icon: '🛒', label: 'Master Purchase', perm: 'view_purchases' },
        { to: '/sales?category_group=master',     icon: '🧾', label: 'Master Sales',    perm: 'view_sales' },
    ]
  },
  
  {
    section: 'New Mobile',
    dropdown: true,
    children: [
        { to: '/purchases',       icon: '🛒', label: 'Purchases',  perm: 'view_purchases' },
        { to: '/stock-entry',     icon: '📦', label: 'Stocks',     perm: 'create_purchases' },
        { to: '/sales',           icon: '🧾', label: 'Sales',      perm: 'view_sales' },
        { to: '/finance-tracker', icon: '💳', label: 'Finance',    perm: 'view_sales' },
    ]
  },
  
  { 
    section: 'Old/2nd Mobile', 
    dropdown: true,
    children: [
        { to: '/old-mobiles',        icon: '🛒', label: 'Purchase',   perm: 'view_old_mobile_purchases', end: true },
        { to: '/old-mobiles/stocks', icon: '📦', label: '2nd Stocks', perm: 'view_old_mobile_purchases' },
        { to: '/old-mobiles/sales',  icon: '🧾', label: 'Sales',      perm: 'view_sales' },
    ]
  },
  
  { 
    section: 'Other Products', 
    dropdown: true,
    children: [
        { to: '/products?category_group=other',    icon: '📱', label: 'Products Entry', perm: 'view_products' },
        { to: '/purchases?category_group=other',   icon: '🛒', label: 'Purchases',      perm: 'view_purchases' },
        { to: '/sales?category_group=other',       icon: '🧾', label: 'Sales',          perm: 'view_sales' },
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
        { to: '/admin/users', icon: '👷', label: 'Staff Details', perm: 'manage_users' },
        { to: '/admin/shops', icon: '🏪', label: 'Shops Manager',  perm: 'manage_shops' },
        { to: '/incentives',  icon: '🏆', label: 'Incentives', perm: 'manage_incentives' },
        { to: '/offers',      icon: '🎯', label: 'Offers',     perm: 'manage_offers' },
        { to: '/send-offers', icon: '✉️', label: 'Send Offers', perm: 'manage_offers' },
        { to: '/reports',     icon: '📈', label: 'Reports',    perm: 'view_reports', end: true },
        { to: '/reports/combined-sales', icon: '📊', label: 'Combined Sales', perm: 'view_reports' },
        { to: '/reports/set-sales-matrix', icon: '📅', label: 'Set Sales Matrix', perm: 'view_reports' },
    ]
  },


  { 
    section: 'Accounts', 
    dropdown: true,
    children: [
        { to: '/accounts/entity-manager', icon: '🏛️', label: 'Entity Manager', perm: 'view_reports' },
        { to: '/accounts/group-summary', icon: '📋', label: 'Group Summary', perm: 'view_reports' },
        { to: '/accounts/trade-summary', icon: '⚖️', label: 'Sales & Purchase A/C', perm: 'view_reports' },
        { to: '/accounts/daybook', icon: '📖', label: 'Daybook', perm: 'view_reports' },
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
        { id: 'airtel-backup', icon: '💾', label: 'Full Backup v3 (JSON)', perm: 'view_reports', action: 'BACKUP_AIRTEL' },
    ]
  },
  { 
    section: 'Tasks', 
    dropdown: true,
    children: [
        { to: '/tasks',       icon: '✅', label: 'All Tasks',  perm: 'view_tasks' },
        { to: '/tasks/new',   icon: '➕', label: 'New Task',   perm: 'assign_tasks' },
    ]
  },

  { 
    section: 'Settings', 
    dropdown: true,
    children: [
        { to: '/admin/whatsapp-config', icon: '⚙️', label: 'WhatsApp Config', perm: 'manage_users' },
    ]
  },

];

const BOTTOM_TABS = [
  { to: '/',         icon: '📊', label: 'Home',     end: true },
  { to: '/sales',    icon: '🧾', label: 'Sales',    perm: 'view_sales' },
  { to: '/airtel/quick-recovery', icon: '⚡', label: 'Recovery', perm: 'view_airtel_recovery' },
  { to: '/repairs',  icon: '🔧', label: 'Repairs',  perm: 'view_repairs' },
];

export default function Layout() {
  const { user, logout, can, isOwner, isAdmin, isManager, hasFullAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expanded, setExpanded] = useState({ 'Master Entries': false, 'New Mobile': true, 'Old/2nd Mobile': false, 'Other Products': false, 'Services': false, 'Business': false, 'Accounts': false, 'Airtel Recovery': false, 'Tasks': false, 'Settings': false });
  
  const getNavLinkClass = (to, end) => {
    try {
      const currentPath = location.pathname;
      const currentSearch = new URLSearchParams(location.search);
      
      const toUrl = new URL(to, window.location.origin);
      const toPath = toUrl.pathname;
      const toSearch = toUrl.searchParams;
      
      let pathMatches = false;
      if (end) {
        pathMatches = currentPath === toPath;
      } else {
        pathMatches = currentPath === toPath || currentPath.startsWith(toPath + '/');
      }
      
      if (!pathMatches) return '';
      
      let currentCatGroup = currentSearch.get('category_group');
      if (currentPath.includes('-master')) {
        currentCatGroup = 'master';
      }
      const toCatGroup = toSearch.get('category_group');
      
      const isFilteredRoute = toPath.includes('/purchases') || toPath.includes('/sales') || toPath.includes('/products');
      if (isFilteredRoute) {
        const normalizedCurrent = currentCatGroup || 'new_mobile';
        const normalizedTo = toCatGroup || 'new_mobile';
        if (normalizedCurrent !== normalizedTo) {
          return '';
        }
      }
      
      return 'active';
    } catch (e) {
      return '';
    }
  };
  
  const toggleSection = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const closeSidebar = () => setSidebarOpen(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const handleAirtelBackup = async () => {
      try {
          toast.info('Preparing backup...');
          const response = await api.get('/airtel-retailers/backup', {
              responseType: 'blob'
          });
          
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          link.setAttribute('download', `airtel_full_backup_${timestamp}.json`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          
          toast.success('Backup downloaded successfully');
      } catch (error) {
          console.error('Backup error:', error);
          toast.error('Backup failed: ' + (error.response?.data?.message || 'Server error'));
      }
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
                                    {item.section === 'Master Entries' ? '🗂️' :
                                     item.section === 'New Mobile' ? '📦' : 
                                     item.section === 'Old/2nd Mobile' ? '📲' :
                                     item.section === 'Other Products' ? '🗃️' :
                                     item.section === 'Services' ? '🛠️' :
                                     item.section === 'Business' ? '💼' :
                                     item.section === 'Accounts' ? '🏦' :
                                     item.section === 'Airtel Recovery' ? '🔴' :
                                     item.section === 'Tasks' ? '✅' :
                                     item.section === 'Settings' ? '⚙️' : '⚙️'}
                                </span>
                                {item.section}
                            </div>
                            <span className="dropdown-arrow" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
                        </button>
                        {isExpanded && (
                            <div className="sidebar-dropdown-content" style={{ paddingLeft: '0.5rem', borderLeft: '1px solid rgba(255,255,255,0.05)', marginLeft: '1.25rem' }}>
                                {visibleChildren.map(child => (
                                    child.action === 'BACKUP_AIRTEL' ? (
                                        <button key={child.id} onClick={handleAirtelBackup} className="sidebar-action-btn">
                                            {child.icon} {child.label}
                                        </button>
                                    ) : (
                                        <NavLink key={child.to} to={child.to} end={child.end} onClick={closeSidebar} className={() => getNavLinkClass(child.to, child.end)}>
                                            {child.icon} {child.label}
                                        </NavLink>
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                );
            }

            if (!isVisible(item)) return null;
             return (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={closeSidebar} className={() => getNavLinkClass(item.to, item.end)}>
                {item.icon} {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <div className="user-name">{user?.name}</div>
          {user?.emp_id && <div style={{ fontSize:'0.68rem', color:'#a5b4fc', fontWeight:600, letterSpacing:'.3px', marginBottom:2 }}>🆔 {user.emp_id}</div>}
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
             <NavLink key={t.to} to={t.to} end={t.end} className={() => `mobile-nav-item ${getNavLinkClass(t.to, t.end)}`} onClick={closeSidebar}>
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
