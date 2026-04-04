import { Link } from 'react-router-dom';

export default function Reports() {
  const reports = [
    { icon:'📊', title:'Sales Summary', desc:'All sales by date, staff, bill type', to:'/reports/sales' },
    { icon:'💹', title:'Profit Analysis', desc:'Revenue vs cost per product', to:'/reports/profit' },
    { icon:'📦', title:'Stock Levels', desc:'Current inventory & low stock alerts', to:'/reports/stock' },
    { icon:'💰', title:'Loan Outstanding', desc:'Pending EMI and overdue payments', to:'/reports/loans' },
  ];

  return (
    <div>
      <div className="page-header"><h2>📈 Reports</h2></div>
      <div className="row g-3">
        {reports.map(r => (
          <div key={r.to} className="col-md-3 col-6">
            <Link to={r.to} style={{ textDecoration:'none' }}>
              <div className="table-card p-4 text-center h-100" style={{ cursor:'pointer', transition:'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(108,63,197,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform =''; e.currentTarget.style.boxShadow = ''; }}>
                <div style={{ fontSize:'2.4rem', marginBottom:'0.5rem' }}>{r.icon}</div>
                <div className="fw-bold" style={{ color:'#1a1a2e' }}>{r.title}</div>
                <div className="text-muted mt-1" style={{ fontSize:'0.82rem' }}>{r.desc}</div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
