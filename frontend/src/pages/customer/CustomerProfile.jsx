import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'react-toastify';

export default function CustomerProfile() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { id } = useParams();
  const navigate = useNavigate();

  const isAdmin = localStorage.getItem('token');
  
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get(`/customer/history/${id}`);
        setData(res.data);
      } catch (err) {
        toast.error('Could not fetch history');
        if (!isAdmin) navigate('/customer/login');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [id, navigate, isAdmin]);

  if (loading) return <div className="text-center p-5 fw-bold text-primary">Loading your history...</div>;
  if (!data || !data.customer) return <div className="text-center p-5 text-muted">No history found for this customer.</div>;

  const { customer, repairs=[], sales=[], recharges=[], sims=[], old_mobiles=[], loans=[] } = data;

  return (
    <div className="min-vh-100 bg-light py-4 px-3">
      <div className="container" style={{ maxWidth: 900 }}>
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4 bg-white p-3 rounded-4 shadow-sm">
          <div>
            <h4 className="fw-bold mb-0 text-primary">Namaste, {customer.name}!</h4>
            <div className="x-small text-muted">{customer.phone}</div>
          </div>
          <button 
            onClick={() => { 
                if (isAdmin) navigate('/customers'); 
                else { localStorage.removeItem('customer_info'); navigate('/customer/login'); } 
            }} 
            className={`btn ${isAdmin ? 'btn-outline-secondary' : 'btn-outline-danger'} btn-sm px-3 rounded-pill fw-bold`}
          >
            {isAdmin ? 'Close' : 'Logout'}
          </button>
        </div>

        {/* Customer Info Card */}
        <div className="row g-3 mb-4">
          <div className="col-md-12">
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body p-4">
                <h6 className="fw-bold text-muted text-uppercase x-small mb-3">Address & Contact</h6>
                <div className="row">
                  <div className="col-md-6 mb-3 mb-md-0">
                    <div className="small text-muted mb-1">EMAIL</div>
                    <div className="fw-bold">{customer.email || 'N/A'}</div>
                  </div>
                  <div className="col-md-6">
                    <div className="small text-muted mb-1">ADDRESS</div>
                    <div className="fw-bold text-uppercase">{customer.address || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline of History */}
        <h5 className="fw-bold mb-3 d-flex align-items-center">
            <span className="me-2">📉</span> Service History
        </h5>

        <div className="timeline">
          {/* Combine all history items into one array for chronological display */}
          {[
            ...repairs.map(r => ({ ...r, timeline_type: 'REPAIR', date: r.submitted_date, display: `${r.device_model} (Status: ${r.status.replace('_', ' ').toUpperCase()})` })),
            ...sales.map(s => ({ ...s, timeline_type: 'PURCHASE', date: s.sale_date, display: `Bought New Device/Product (${s.invoice_no})` })),
            ...recharges.map(r => ({ ...r, timeline_type: 'RECHARGE', date: r.sale_date, display: `₹${r.amount} Recharge for ${r.mobile_number}` })),
            ...sims.map(s => ({ ...s, timeline_type: 'SIM CARD', date: s.sold_date, display: `New SIM Card Purchase` })),
            ...old_mobiles.map(o => ({ ...o, timeline_type: 'PURCHASE', date: o.purchase_date, display: `Sold Old Device: ${o.model_name} to us` })),
            ...loans.map(l => ({ ...l, timeline_type: 'LOAN', date: l.start_date, display: `Finance/Loan Taken: ₹${l.principal}` }))
          ].sort((a, b) => new Date(b.date) - new Date(a.date)).map((item, idx) => (
            <div key={idx} className="timeline-item mb-3 ms-md-4 ps-4 position-relative">
              <div className="timeline-dot bg-primary shadow"></div>
              <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className={`badge ${getTypeColor(item.timeline_type)} rounded-pill px-3`}>{item.timeline_type}</span>
                    <span className="x-small fw-bold text-muted">{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <h6 className="fw-bold mb-1">{item.display}</h6>
                  {item.shop && <div className="x-small text-muted">Shop: <span className="fw-bold">{item.shop.name}</span></div>}
                  {item.timeline_type === 'REPAIR' && item.is_forwarded && (
                     <div className="alert alert-info py-1 px-2 mt-2 mb-0 x-small fw-bold border-0 rounded-3">
                        ℹ️ This device is being handled by our external specialist.
                     </div>
                  )}
                  {item.timeline_type === 'PURCHASE' && item.grand_total && (
                    <div className="mt-2 fw-bold text-success fs-5">₹{parseFloat(item.grand_total).toLocaleString()}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Empty State */}
          {repairs.length === 0 && sales.length === 0 && recharges.length === 0 && (
            <div className="text-center p-5 bg-white rounded-4 shadow-sm border">
               <div className="fs-1 mb-2">📦</div>
               <h6 className="fw-bold text-muted">No services recorded yet.</h6>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .timeline { border-left: 2px solid #dee2e6; margin-left: 10px; }
        .timeline-item::before { content: ""; position: absolute; top: 15px; left: -10px; width: 10px; height: 2px; background: #dee2e6; }
        .timeline-dot { position: absolute; left: -16px; top: 10px; width: 12px; height: 12px; border-radius: 50%; z-index: 10; }
        .timeline-item:last-child { border-left: 2px solid transparent; }
        .x-small { font-size: 0.75rem; }
        .rounded-4 { border-radius: 1rem; }
      `}</style>
    </div>
  );
}

function getTypeColor(type) {
  switch(type) {
    case 'REPAIR': return 'bg-primary';
    case 'PURCHASE': return 'bg-success';
    case 'RECHARGE': return 'bg-warning text-dark';
    case 'LOAN': return 'bg-danger';
    case 'SIM CARD': return 'bg-info text-dark';
    default: return 'bg-secondary';
  }
}
