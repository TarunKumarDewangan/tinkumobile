import { useState, useEffect } from 'react';
import pinGate from '../../utils/pinGate';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import RepairBackupModal from './RepairBackupModal';

const STATUS_COLORS = { pending:'warning', assigned:'info', in_progress:'primary', completed:'success', delivered:'secondary' };

// issue_description comes back either as a real array or as a JSON-encoded
// string (legacy rows) — normalize both into a plain comma-joined string.
const parseIssues = (val) => {
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.join(', ') : String(parsed);
    } catch (e) { /* fall through */ }
  }
  return val || '';
};

export default function Repairs() {
  const { hasFullAccess, user } = useAuth();
  const navigate = useNavigate();
  const [repairs, setRepairs] = useState([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    submitted_from: '',
    submitted_to: '',
    delivery_from: '',
    delivery_to: '',
    delivered_from: '',
    delivered_to: '',
    payment_from: '',
    payment_to: '',
    is_forwarded: '',
    cost_payment_status: '',
    forwarded_to: ''
  });

  const [externalShops, setExternalShops] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [viewMode, setViewMode] = useState('sheet'); // 'table' | 'sheet'

  const load = () => {
    setLoading(true);
    api.get('/repairs', { params: { ...filters, page } })
      .then(r => {
        const res = r.data;
        if (Array.isArray(res)) {
          setRepairs(res);
          setLastPage(1);
        } else {
          setRepairs(res.data || []);
          setLastPage(res.last_page || 1);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters, page]);

  // Load external shop names for the dropdown filter
  useEffect(() => {
    api.get('/repairs/external-shops').then(r => setExternalShops(r.data)).catch(() => {});
    api.get('/users').then(r => setStaffList(r.data)).catch(() => {});
  }, []);

  const updateStatus = async (id, status) => {
    if (status === 'delivered') {
       return navigate(`/repairs/${id}/edit`);
    }

    await api.put(`/repairs/${id}`, { status });
    toast.success('Status updated');
    load();
  };

  const updateStaff = async (id, staffId) => {
    try {
      await api.put(`/repairs/${id}`, { staff_id: staffId || null });
      toast.success('Staff updated');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error updating staff');
    }
  };

  const payShop = async (id) => {
    if (!await pinGate.confirm()) return;
    try {
      await api.post(`/repairs/${id}/pay-cost`);
      toast.success('Payment recorded successfully');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error recording payment');
    }
  };

  const deleteRepair = async (id) => {
    if (!await pinGate.confirm()) return;
    try {
      await api.delete(`/repairs/${id}`);
      toast.success('Repair deleted');
      load();
    } catch (e) { toast.error('Unauthorized or error'); }
  };

  const handleFilter = (field, val) => {
    setFilters(prev => ({ ...prev, [field]: val }));
    setPage(1);
  };

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
    acc.deliveredCount += r.status === 'delivered' ? 1 : 0;
    acc.pendingCount += r.status !== 'delivered' ? 1 : 0;
    acc.customers.add(r.customer_phone || r.customer_name);
    acc.devices.add(r.device_model);
    acc.issueCount += Array.isArray(r.issue_description) ? r.issue_description.length : 1;
    return acc;
  }, { quoted: 0, advanceRemaining: 0, received: 0, cost: 0, costPending: 0, given: 0, balanceRemaining: 0, forwardedCount: 0, deliveredCount: 0, pendingCount: 0, customers: new Set(), devices: new Set(), issueCount: 0 });

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
                <button className={`btn ${filters.is_forwarded === 'true' ? 'btn-primary' : 'btn-outline-primary'}`} 
                  onClick={() => handleFilter('is_forwarded', 'true')}>Forwarded</button>
            </div>

            {/* Forwarded Shop Filter — shown when forwarded tab is active or a shop is selected */}
            <div className="position-relative" style={{ minWidth: 190 }}>
              <select
                className="form-select form-select-sm shadow-sm pe-4"
                style={{ borderColor: filters.forwarded_to ? '#6366f1' : undefined, fontWeight: filters.forwarded_to ? 700 : undefined }}
                value={filters.forwarded_to}
                onChange={e => {
                  const val = e.target.value;
                  setFilters(prev => ({
                    ...prev,
                    forwarded_to: val,
                    // auto-switch to Forwarded tab when a shop is selected
                    is_forwarded: val ? 'true' : prev.is_forwarded
                  }));
                }}
              >
                <option value="">🏪 All Shops</option>
                {externalShops.map(s => (
                  <option key={s.forwarded_to} value={s.forwarded_to}>{s.forwarded_to}</option>
                ))}
              </select>
              {filters.forwarded_to && (
                <button
                  className="btn btn-link btn-sm p-0 position-absolute top-50 end-0 translate-middle-y me-1 text-danger"
                  style={{ fontSize: '0.7rem', zIndex: 5 }}
                  onClick={() => handleFilter('forwarded_to', '')}
                  title="Clear shop filter"
                >✕</button>
              )}
            </div>

            {/* Cost Status Filter */}
            <select className="form-select form-select-sm shadow-sm" style={{ width: 150 }} 
              value={filters.cost_payment_status} onChange={e => handleFilter('cost_payment_status', e.target.value)}>
                <option value="">Any Cost Status</option>
                <option value="pending">Pending Cost</option>
                <option value="paid">Paid Cost</option>
            </select>

            <div className="ms-auto d-flex gap-2">
                <div className="btn-group btn-group-sm shadow-sm">
                  <button className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setViewMode('table')}>📊 Table View</button>
                  <button className={`btn ${viewMode === 'sheet' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setViewMode('sheet')}>📋 Sheet View</button>
                </div>
                <button className="btn btn-outline-secondary btn-sm"
                  onClick={() => setFilters({ status:'', search:'', submitted_from:'', submitted_to:'', delivery_from:'', delivery_to:'', delivered_from:'', delivered_to:'', payment_from:'', payment_to:'', is_forwarded:'', cost_payment_status:'', forwarded_to:'' })}>
                  Reset
                </button>
                <button className="btn btn-info btn-sm text-white shadow-sm" onClick={() => setIsBackupModalOpen(true)}>
                  💾 Backup
                </button>
                <Link to="/repairs/new" className="btn btn-primary btn-sm shadow-sm">+ New Repair</Link>
            </div>
        </div>

        {/* Date Filters Row - Vertical Layout */}
        <div className="row g-3 px-3 py-3 bg-light rounded-4 shadow-sm border border-white mx-0 mt-1">
            <div className="col-12 col-md-3 border-end">
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
            
            <div className="col-12 col-md-3 border-end">
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

            <div className="col-12 col-md-3 border-end">
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

            <div className="col-12 col-md-3">
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
        ) : viewMode === 'sheet' ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 custom-tally-table">
              <thead className="bg-light-subtle shadow-none">
                <tr className="border-bottom text-uppercase text-muted" style={{ fontSize: '0.65rem' }}>
                  <th className="ps-3" style={{width:40}}>#</th>
                  <th>Timestamp</th>
                  <th>Customer Name</th>
                  <th>Address</th>
                  <th>Mobile Number</th>
                  <th>Model Number</th>
                  <th>Problem Kya Hai</th>
                  <th className="text-end">Kitna Kharcha Ayega</th>
                  <th>Koun Repairer Karega</th>
                  <th>Staff Name</th>
                  <th style={{width:130}}>Status</th>
                  <th className="text-end pe-3" style={{width:70}}>Edit</th>
                </tr>
              </thead>
              <tbody>
                {repairs.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="ps-3 text-muted small">{idx + 1}</td>
                    <td className="small">{formatDate(r.submitted_date) || '-'}</td>
                    <td className="fw-bold small">{r.customer_name}</td>
                    <td className="small text-muted">{r.customer_address || '-'}</td>
                    <td className="small">{r.customer_phone}</td>
                    <td className="small fw-semibold">{r.device_model}</td>
                    <td className="small text-muted">{parseIssues(r.issue_description)}</td>
                    <td className="text-end small fw-bold">₹{parseFloat(r.quoted_amount || 0).toLocaleString()}</td>
                    <td className="small">
                      {r.is_forwarded && r.forwarded_to ? (
                        <span className="fw-bold text-primary text-uppercase">{r.forwarded_to}</span>
                      ) : (
                        <span className="text-muted italic opacity-50">Local Repair</span>
                      )}
                    </td>
                    <td style={{width:150}}>
                      {hasFullAccess() ? (
                        <select className="form-select form-select-sm" style={{fontSize:'0.72rem'}}
                          value={r.staff?.id || ''} onChange={e => updateStaff(r.id, e.target.value)}>
                          <option value="">— Unassigned —</option>
                          {staffList.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="small fw-semibold">{r.staff?.name || user?.name || '-'}</span>
                      )}
                    </td>
                    <td>
                      <select className="form-select form-select-sm fw-bold border-2"
                        style={{ fontSize: '0.7rem' }}
                        value={r.status} onChange={e => updateStatus(r.id, e.target.value)}>
                        <option value="pending">PENDING</option>
                        <option value="assigned">ASSIGNED</option>
                        <option value="in_progress">IN PROGRESS</option>
                        <option value="completed">COMPLETED</option>
                        <option value="delivered">DELIVERED</option>
                      </select>
                    </td>
                    <td className="text-end pe-3">
                      <Link to={`/repairs/${r.id}/edit`} className="btn btn-outline-primary btn-xs border-0" title="Edit">
                        ✏️
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 custom-tally-table">
              <thead className="bg-light-subtle shadow-none">
                <tr className="border-bottom text-uppercase text-muted" style={{ fontSize: '0.65rem' }}>
                  <th className="ps-3" style={{width:40}}>#</th>
                  <th>Submitted</th>
                  <th>Customer</th>
                  <th>Device</th>
                  <th>Issues</th>
                  <th>Forwarded To</th>
                  <th>Financials</th>
                  <th className="text-center">Status</th>
                  <th>Delivery</th>
                  <th colSpan={2} className="text-end pe-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Financial Summary Row */}
                {!loading && repairs.length > 0 && (
                  <tr className="bg-light-subtle fw-bold" style={{ backgroundColor: '#f8f9fa' }}>
                    <td className="ps-3 text-primary italic">Σ</td>
                    <td className="small">
                        <div className="x-small text-muted text-uppercase" style={{fontSize:'0.6rem'}}>Jobs</div>
                        <div>{repairs.length}</div>
                    </td>
                    <td className="small">
                        <div className="x-small text-muted text-uppercase" style={{fontSize:'0.6rem'}}>Clients</div>
                        <div>{totals.customers.size}</div>
                    </td>
                    <td colSpan={2}></td>
                    <td className="small">
                        <div className="x-small text-muted text-uppercase" style={{fontSize:'0.6rem'}}>Forwarded</div>
                        <div className="text-primary">{totals.forwardedCount}</div>
                    </td>
                    <td className="text-end bg-white shadow-sm border-start border-secondary border-3">
                        <div className="d-flex flex-column gap-1 pe-2 py-1">
                            <div className="x-small text-uppercase text-muted opacity-75">Q: ₹{totals.quoted.toLocaleString()}</div>
                            <div className="x-small text-uppercase text-success opacity-75">S: ₹{totals.received.toLocaleString()}</div>
                            <div className="x-small text-uppercase text-danger opacity-75">C: ₹{totals.cost.toLocaleString()}</div>
                            <div className="border-top pt-1 text-primary fw-bold" style={{fontSize:'0.75rem'}}>
                                DUE: ₹{totals.balanceRemaining.toLocaleString()}
                            </div>
                        </div>
                    </td>
                    <td className="text-center small">
                        <div className="x-small text-muted text-uppercase mb-1" style={{fontSize:'0.6rem'}}>Progress</div>
                        <div className="text-primary small fw-bold" style={{lineHeight:1}}>
                           P: {totals.pendingCount} | D: {totals.deliveredCount}
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
                            <>
                                <div className="fw-bold text-primary text-uppercase x-small">{r.forwarded_to}</div>
                                <div className="text-muted" style={{fontSize:'0.65rem'}}>{r.forwarded_phone}</div>
                            </>
                        ) : (
                            <div className="text-muted x-small italic opacity-50">Local Repair</div>
                        )}
                    </td>

                    <td className="text-end py-2">
                       <div className="d-flex flex-column x-small text-uppercase gap-1 opacity-75">
                          <div>Quoted: <span className="fw-bold text-dark">₹{parseFloat(r.quoted_amount||0).toLocaleString()}</span></div>
                          <div>Advance: <span className="fw-bold">₹{parseFloat(r.advance_amount||0).toLocaleString()}</span></div>
                          {(parseFloat(r.balance_amount_received || 0) > 0) && (
                              <div className="text-success">Settled: <span className="fw-bold">₹{parseFloat(r.balance_amount_received).toLocaleString()}</span></div>
                          )}
                          {r.is_forwarded && (
                              <div>Cost: <span className={`fw-bold ${r.is_cost_paid ? 'text-success' : 'text-danger'}`}>₹{parseFloat(r.service_center_cost||0).toLocaleString()}</span></div>
                          )}
                          <div className="border-top pt-1 fw-bold text-primary mt-1" style={{ fontSize: '0.75rem' }}>
                             Balance: ₹{Math.max(0, parseFloat(r.quoted_amount || 0) - (parseFloat(r.advance_amount || 0) + parseFloat(r.balance_amount_received || 0))).toLocaleString()}
                          </div>
                          {(parseFloat(r.balance_amount_received || 0) > 0) && (
                            <div className="text-success fw-bold italic border-top pt-1 mt-1" style={{fontSize:'0.6rem', lineHeight: 1.1}}>
                                Pending amount ₹{parseFloat(r.balance_amount_received).toLocaleString()} paid 
                                {r.balance_received_at ? (
                                    <> at <br/> {new Date(r.balance_received_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</>
                                ) : ' (Timestamp Missing)'}
                            </div>
                          )}
                       </div>
                    </td>

                    <td className="text-center">
                        <span className={`badge bg-${STATUS_COLORS[r.status] || 'secondary'} rounded-pill x-small px-2`}>
                          {r.status.toUpperCase()}
                        </span>
                    </td>

                    <td>
                      <div className="x-small fw-bold">{formatDate(r.actual_delivery_date) || '-'}</div>
                      <div className="text-muted mt-1" style={{fontSize:'0.6rem'}}>
                        Expected: {formatDate(r.estimated_delivery_date) || 'N/A'}
                      </div>
                    </td>
                    <td className="text-end pe-1" style={{ width:130 }}>
                      <select className="form-select form-select-sm fw-bold border-2" 
                        style={{ fontSize: '0.7rem', height: '32px' }}
                        value={r.status} onChange={e => updateStatus(r.id, e.target.value)}>
                        <option value="pending">PENDING</option>
                        <option value="assigned">ASSIGNED</option>
                        <option value="in_progress">IN PROGRESS</option>
                        <option value="completed">COMPLETED</option>
                        <option value="delivered">DELIVERED</option>
                      </select>
                    </td>
                    <td className="text-end pe-3" style={{ width: 100 }}>
                      <div className="d-flex justify-content-end gap-1">
                        {r.is_forwarded && !r.is_cost_paid && r.service_center_cost > 0 && (
                          <button className="btn btn-outline-success btn-xs border-0" onClick={() => payShop(r.id)} title="Pay Shop">
                             💰
                          </button>
                        )}
                        <Link to={`/repairs/${r.id}/edit`} className="btn btn-outline-primary btn-xs border-0" title="Edit">
                           ✏️
                        </Link>
                        {hasFullAccess() && (
                          <button className="btn btn-outline-danger btn-xs border-0" onClick={() => deleteRepair(r.id)} title="Delete">
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
        
        {lastPage > 1 && repairs.length > 0 && (
          <div className="card-footer d-flex justify-content-between align-items-center py-3 bg-light border-top">
            <button className="btn btn-outline-secondary btn-sm rounded-pill px-3" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span className="text-muted small text-uppercase fw-bold">Page {page} of {lastPage}</span>
            <button className="btn btn-outline-secondary btn-sm rounded-pill px-3" disabled={page === lastPage} onClick={() => setPage(p => p + 1)}>Next</button>
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
      
      <RepairBackupModal 
        isOpen={isBackupModalOpen} 
        onClose={() => setIsBackupModalOpen(false)} 
        onRefresh={load} 
      />

      <style>{`
        .x-small { font-size: 0.7rem; }
        .btn-xs { padding: 0.1rem 0.25rem; font-size: 0.7rem; }
        .letter-spacing-1 { letter-spacing: 1px; }
        .custom-tally-table {
          width: 100%;
          border-collapse: collapse !important;
          border: 1px solid #cbd5e1 !important;
        }
        .custom-tally-table thead th {
          position: sticky;
          top: 0;
          z-index: 10;
          background: #f8fafc !important;
          color: #475569 !important;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 0.65rem 0.5rem;
          border-bottom: 2px solid #cbd5e1 !important;
          border-right: 1px solid #cbd5e1 !important;
        }
        .custom-tally-table thead th:last-child {
          border-right: none !important;
        }
        .custom-tally-table tbody tr td {
          padding: 0.6rem 0.5rem;
          border-bottom: 1px solid #cbd5e1 !important;
          border-right: 1px solid #cbd5e1 !important;
          vertical-align: middle;
        }
        .custom-tally-table tbody tr td:last-child {
          border-right: none !important;
        }
        .custom-tally-table tbody tr:hover {
          background-color: #f1f5f9 !important;
        }
      `}</style>
    </div>
  );
}
