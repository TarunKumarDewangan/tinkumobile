import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_COLORS = { pending:'warning', assigned:'info', in_progress:'primary', completed:'success', delivered:'secondary' };

export default function Repairs() {
  const { hasFullAccess } = useAuth();
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    submitted_from: '',
    submitted_to: '',
    delivery_from: '',
    delivered_from: '',
    delivered_to: '',
    payment_from: '',
    payment_to: '',
    is_forwarded: '',
    cost_payment_status: ''
  });

  const load = () => {
    setLoading(true);
    api.get('/repairs', { params: filters }).then(r => setRepairs(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const updateStatus = async (id, status) => {
    await api.put(`/repairs/${id}`, { status });
    toast.success('Status updated');
    load();
  };

  const payShop = async (id) => {
    if (!window.confirm('Are you sure you want to record payment to this external shop? This will create an OUT transaction in the cashbook.')) return;
    try {
      await api.post(`/repairs/${id}/pay-cost`);
      toast.success('Payment recorded successfully');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error recording payment');
    }
  };

  const deleteRepair = async (id) => {
    if (!window.confirm('Are you sure you want to delete this repair?')) return;
    try {
      await api.delete(`/repairs/${id}`);
      toast.success('Repair deleted');
      load();
    } catch (e) { toast.error('Unauthorized or error'); }
  };

  const handleFilter = (field, val) => setFilters(prev => ({ ...prev, [field]: val }));

  const totals = repairs.reduce((acc, r) => {
    const quoted = parseFloat(r.quoted_amount || 0);
    const advance = parseFloat(r.advance_amount || 0);
    const balanceReceived = parseFloat(r.balance_amount_received || 0);
    const shopCost = parseFloat(r.service_center_cost || 0);

    acc.quoted += quoted;
    acc.advanceRemaining += (!r.balance_received_at) ? advance : 0;
    acc.received += advance + balanceReceived;
    acc.cost += shopCost;
    acc.given += r.is_cost_paid ? shopCost : 0;
    acc.costPending += !r.is_cost_paid ? shopCost : 0;
    acc.balanceRemaining += (!r.balance_received_at) ? (quoted - advance) : 0;
    
    acc.forwardedCount += r.is_forwarded ? 1 : 0;
    acc.customers.add(r.customer_phone || r.customer_name);
    acc.devices.add(r.device_model);
    acc.issueCount += Array.isArray(r.issue_description) ? r.issue_description.length : 1;
    return acc;
  }, { quoted: 0, advanceRemaining: 0, received: 0, cost: 0, costPending: 0, given: 0, balanceRemaining: 0, forwardedCount: 0, customers: new Set(), devices: new Set(), issueCount: 0 });

  return (
    <div>
      <div className="page-header mb-4 flex-column align-items-stretch gap-3">
        <div className="d-flex align-items-center flex-wrap gap-3">
            <h2 className="mb-0">🔧 Repairs</h2>
            
            {/* Quick Search */}
            <div className="input-group input-group-sm shadow-sm" style={{ maxWidth: 280 }}>
                <span className="input-group-text bg-white border-end-0">🔍</span>
                <input 
                  className="form-control border-start-0 ps-0" 
                  placeholder="Search Name, Phone, Shop..." 
                  value={filters.search} onChange={e => handleFilter('search', e.target.value)} 
                />
            </div>

            {/* Status Filter */}
            <select className="form-select form-select-sm shadow-sm" style={{ width: 140 }} value={filters.status} onChange={e => handleFilter('status', e.target.value)}>
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="delivered">Delivered</option>
            </select>

            {/* Forwarding Filter */}
            <div className="btn-group btn-group-sm shadow-sm">
                <button className={`btn ${filters.is_forwarded === '' ? 'btn-primary' : 'btn-outline-primary'}`} 
                  onClick={() => handleFilter('is_forwarded', '')}>All</button>
                <button className={`btn ${filters.is_forwarded === 'false' ? 'btn-primary' : 'btn-outline-primary'}`} 
                  onClick={() => handleFilter('is_forwarded', 'false')}>Local</button>
            </div>

            {/* Cost Status Filter */}
            <select className="form-select form-select-sm shadow-sm" style={{ width: 150 }} 
              value={filters.cost_payment_status} onChange={e => handleFilter('cost_payment_status', e.target.value)}>
                <option value="">Any Cost Status</option>
                <option value="pending">Pending Cost</option>
                <option value="paid">Paid Cost</option>
            </select>

            <div className="ms-auto d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" 
                  onClick={() => setFilters({ status:'', search:'', submitted_from:'', submitted_to:'', delivery_from:'', delivery_to:'', delivered_from:'', delivered_to:'', payment_from:'', payment_to:'', is_forwarded:'', cost_payment_status:'' })}>
                  Reset
                </button>
                <Link to="/repairs/new" className="btn btn-primary btn-sm shadow-sm">+ New Repair</Link>
            </div>
        </div>

        {/* Date Filters Row - Vertical Layout */}
        <div className="row g-3 px-3 py-3 bg-light rounded-4 shadow-sm border border-white mx-0 mt-1">
            <div className="col-md-3 border-end">
                <div className="text-muted x-small fw-bold mb-2 text-uppercase letter-spacing-1">📅 Submitted Date</div>
                <div className="d-flex flex-column gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted x-small w-25">From:</span>
                        <input type="date" className="form-control form-control-sm border shadow-none flex-grow-1"
                            value={filters.submitted_from} onChange={e => handleFilter('submitted_from', e.target.value)} />
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted x-small w-25">Upto:</span>
                        <input type="date" className="form-control form-control-sm border shadow-none flex-grow-1"
                            value={filters.submitted_to} onChange={e => handleFilter('submitted_to', e.target.value)} />
                    </div>
                </div>
            </div>
            
            <div className="col-md-3 border-end">
                <div className="text-muted x-small fw-bold mb-2 text-uppercase letter-spacing-1">🕒 Est. Delivery</div>
                <div className="d-flex flex-column gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted x-small w-25">From:</span>
                        <input type="date" className="form-control form-control-sm border shadow-none flex-grow-1"
                            value={filters.delivery_from} onChange={e => handleFilter('delivery_from', e.target.value)} />
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted x-small w-25">Upto:</span>
                        <input type="date" className="form-control form-control-sm border shadow-none flex-grow-1"
                            value={filters.delivery_to} onChange={e => handleFilter('delivery_to', e.target.value)} />
                    </div>
                </div>
            </div>

            <div className="col-md-3 border-end">
                <div className="text-success x-small fw-bold mb-2 text-uppercase letter-spacing-1">✅ Actual Delivery</div>
                <div className="d-flex flex-column gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted x-small w-25">From:</span>
                        <input type="date" className="form-control form-control-sm border shadow-none flex-grow-1"
                            value={filters.delivered_from} onChange={e => handleFilter('delivered_from', e.target.value)} />
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted x-small w-25">Upto:</span>
                        <input type="date" className="form-control form-control-sm border shadow-none flex-grow-1"
                            value={filters.delivered_to} onChange={e => handleFilter('delivered_to', e.target.value)} />
                    </div>
                </div>
            </div>

            <div className="col-md-3">
                <div className="text-primary x-small fw-bold mb-2 text-uppercase letter-spacing-1">💰 Payment Date</div>
                <div className="d-flex flex-column gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted x-small w-25">From:</span>
                        <input type="date" className="form-control form-control-sm border shadow-none flex-grow-1"
                            value={filters.payment_from} onChange={e => handleFilter('payment_from', e.target.value)} />
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted x-small w-25">Upto:</span>
                        <input type="date" className="form-control form-control-sm border shadow-none flex-grow-1"
                            value={filters.payment_to} onChange={e => handleFilter('payment_to', e.target.value)} />
                    </div>
                </div>
            </div>
        </div>

      </div>

      <div className="table-card border-0 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" />
            <div className="mt-2 text-muted small">Loading repairs...</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="bg-light shadow-none">
                <tr className="border-bottom border-white">
                  <th className="ps-3" style={{width:50}}>#</th>
                  <th>Submitted</th>
                  <th>Customer</th>
                  <th>Device</th>
                  <th>Issues</th>
                  <th className="text-end">Recieved</th>
                  <th className="text-end">Given</th>
                  <th className="text-end">Customer Bills</th>
                  <th>Status</th>
                  <th>Delivery</th>
                  <th className="text-end pe-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Financial Summary Row */}
                {!loading && repairs.length > 0 && (
                  <tr className="bg-light-subtle fw-bold" style={{ backgroundColor: '#f0f7f9' }}>
                    <td className="ps-3 text-primary">Σ</td>
                    <td className="text-center">
                        <div className="x-small text-muted text-uppercase">Total</div>
                        <div className="text-dark">{repairs.length} Rep.</div>
                    </td>
                    <td>
                        <div className="x-small text-muted text-uppercase">Customers</div>
                        <div className="text-dark">{totals.customers.size} Unique</div>
                    </td>
                    <td>
                        <div className="x-small text-muted text-uppercase">Devices</div>
                        <div className="text-dark">{totals.devices.size} Models</div>
                    </td>
                    <td>
                        <div className="x-small text-muted text-uppercase">Issues</div>
                        <div className="text-info">{totals.issueCount} Total</div>
                    </td>
                    <td>
                        <div className="x-small text-muted text-uppercase">Forwarded</div>
                        <div className="text-primary">{totals.forwardedCount} Jobs</div>
                    </td>
                    <td className="text-end py-3 bg-danger-subtle shadow-sm border-start border-end border-danger border-opacity-25">
                      <div className="x-small text-uppercase text-danger fw-bold opacity-75">T. Shop Cost</div>
                      <div className="h6 mb-0 text-danger fw-bold">₹{totals.cost.toLocaleString()}</div>
                      {totals.costPending > 0 && <div style={{fontSize:'0.65rem'}} className="text-danger-emphasis">Pending: ₹{totals.costPending.toLocaleString()}</div>}
                    </td>
                    <td className="text-end py-3 bg-white shadow-sm rounded-end border-end border-3 border-primary">
                      <div className="x-small text-uppercase text-muted opacity-75">T. Quoted: <span className="text-dark">₹{(totals.quoted || 0).toLocaleString()}</span></div>
                      {totals.advanceRemaining > 0 && <div className="x-small text-uppercase text-muted opacity-75">Adv. Pending: <span className="text-success">₹{totals.advanceRemaining.toLocaleString()}</span></div>}
                      <div className="mt-1 pt-1 border-top border-light text-primary fw-bold">
                        T. DUE: ₹{(totals.balanceRemaining || 0).toLocaleString()}
                      </div>
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                )}

                {repairs.map(r => (
                  <tr key={r.id}>
                    <td className="ps-3 text-muted small">{r.id}</td>
                    <td>
                      <div className="fw-semibold text-dark small">{formatDate(r.submitted_date) || '-'}</div>
                    </td>
                    <td>
                      <div className="fw-bold">{r.customer_name}</div>
                      <div className="text-muted small">{r.customer_phone}</div>
                    </td>
                    <td>
                      <div className="fw-semibold">{r.device_model}</div>
                    </td>
                    <td>
                      {Array.isArray(r.issue_description) ? (
                        <ul className="mb-0 ps-3 small text-muted">
                          {r.issue_description.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="small text-muted">{r.issue_description}</div>
                      )}
                    </td>
                    <td>
                      {r.is_forwarded ? (
                        <div>
                          <div className="fw-bold text-primary" style={{ fontSize: '0.9rem' }}>{r.forwarded_to}</div>
                          <div className="text-muted small">{r.forwarded_phone || 'No Phone'}</div>
                        </div>
                      ) : (
                        <span className="text-muted small italic">Local Repair</span>
                      )}
                    </td>
                    <td className="text-end">
                       <div className="p-2 rounded bg-success-subtle border-start border-success border-3">
                          <div className="x-small text-uppercase text-success fw-bold opacity-75">Collected:</div>
                          <div className="text-success fw-bold h6 mb-0">
                             ₹{(parseFloat(r.advance_amount || 0) + parseFloat(r.balance_amount_received || 0)).toLocaleString()}
                          </div>
                          {r.balance_received_at && <div className="x-small text-muted mt-1" style={{fontSize:'0.6rem'}}>Full Paid</div>}
                       </div>
                    </td>
                    <td className="text-end">
                       {r.is_forwarded && r.service_center_cost > 0 ? (
                         <div className={`p-2 rounded ${r.is_cost_paid ? 'bg-light' : 'bg-danger-subtle'} border-start border-danger border-3`}>
                            <div className="x-small text-uppercase text-muted mb-1">{r.is_cost_paid ? 'Paid To:' : 'Owed To:'}</div>
                            <div className="text-dark fw-bold small text-truncate" style={{maxWidth:100}}>{r.forwarded_to}</div>
                            <div className={`${r.is_cost_paid ? 'text-dark' : 'text-danger'} fw-bold h6 mb-0`}>
                                ₹{parseFloat(r.service_center_cost).toLocaleString()}
                            </div>
                            {!r.is_cost_paid && <span className="badge bg-danger text-white p-1" style={{fontSize:'0.6rem'}}>UNSETTLED</span>}
                         </div>
                       ) : <span className="text-muted small italic">-</span>}
                    </td>
                    <td className="text-end bg-light-subtle rounded-3" style={{ borderLeft: '3px solid #dee2e6' }}>
                      <div className="x-small text-uppercase text-muted opacity-75">Quoted: <span className="text-dark fw-bold">₹{parseFloat(r.quoted_amount || 0).toLocaleString()}</span></div>
                      {!r.balance_received_at && (
                        <div className="x-small text-uppercase text-muted opacity-75">Advance: <span className="text-success fw-bold">₹{parseFloat(r.advance_amount || 0).toLocaleString()}</span></div>
                      )}
                      
                      {r.balance_received_at ? (
                        <div className="mt-1 pt-1 border-top border-light animate-fade-in text-end">
                           <div className="badge bg-success small">SETTLED</div>
                           {r.balance_received_at && (
                             <div className="text-muted x-small mt-1">
                                {new Date(r.balance_received_at).toLocaleDateString()}
                             </div>
                           )}
                        </div>
                      ) : (
                        <div className="mt-1 pt-1 border-top border-light">
                          <div className="small text-uppercase fw-bold text-primary">Due: ₹{parseFloat((r.quoted_amount || 0) - (r.advance_amount || 0)).toLocaleString()}</div>
                        </div>
                      )}
                    </td>
                    <td>
                       <span className={`badge bg-${STATUS_COLORS[r.status] || 'secondary'} rounded-pill`}>
                         {r.status.replace('_', ' ').toUpperCase()}
                       </span>
                    </td>
                    <td>
                      {r.status !== 'delivered' ? (
                        <>
                          <div className={`small ${r.estimated_delivery_date && new Date(r.estimated_delivery_date) < new Date() ? 'text-danger fw-bold' : 'text-muted'}`}>
                            {formatDate(r.estimated_delivery_date) || 'N/A'}
                          </div>
                          {r.is_forwarded && r.external_expected_delivery && (
                             <div className="text-info mt-1" style={{ fontSize: '0.65rem' }}>
                                Shop Exp: {formatDate(r.external_expected_delivery)}
                             </div>
                          )}
                        </>
                      ) : (
                        <div className="text-muted small">Released</div>
                      )}
                    </td>
                    <td className="text-end pe-3">
                      <select className="form-select form-select-sm d-inline-block" style={{ width:125 }}
                        value={r.status} onChange={e => updateStatus(r.id, e.target.value)}>
                        <option value="pending">Pending</option>
                        <option value="assigned">Assigned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="delivered">Delivered</option>
                      </select>
                      
                      <div className="d-inline-flex gap-1 ms-2">
                        {r.is_forwarded && !r.is_cost_paid && r.service_center_cost > 0 && (
                          <button className="btn btn-outline-success btn-sm border-0 p-1" onClick={() => payShop(r.id)} title="Record Cost Payment">
                             💰
                          </button>
                        )}
                        <Link to={`/repairs/${r.id}/edit`} className="btn btn-outline-primary btn-sm border-0 p-1" title="View/Edit Repair">
                           👁️
                        </Link>
                        <Link to={`/repairs/${r.id}/edit`} className="btn btn-outline-info btn-sm border-0 p-1" title="Quick Edit">
                           ✏️
                        </Link>
                        {hasFullAccess() && (
                          <button className="btn btn-outline-danger btn-sm border-0 p-1" onClick={() => deleteRepair(r.id)} title="Delete Repair">
                             🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {repairs.length === 0 && !loading && (
          <div className="text-center py-5 text-muted bg-white">
             <div style={{fontSize:'3.5rem'}}>🕵️‍♂️</div>
             <div className="fw-bold">No matching repairs found</div>
             <div className="small">Try adjusting your search or filters above</div>
          </div>
        )}
      </div>
      <style>{`
        .x-small { font-size: 0.7rem; }
        .btn-xs { padding: 0.1rem 0.25rem; font-size: 0.7rem; }
        .letter-spacing-1 { letter-spacing: 1px; }
      `}</style>
    </div>
  );
}
