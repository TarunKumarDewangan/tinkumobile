import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';

const STATUS_COLORS = { pending:'warning', assigned:'info', in_progress:'primary', completed:'success', delivered:'secondary' };

export default function Repairs() {
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    submitted_from: '',
    submitted_to: '',
    delivery_from: '',
    delivery_to: '',
    is_forwarded: ''
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

  const handleFilter = (field, val) => setFilters(prev => ({ ...prev, [field]: val }));

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
                <button className={`btn ${filters.is_forwarded === 'true' ? 'btn-primary' : 'btn-outline-primary'}`} 
                  onClick={() => handleFilter('is_forwarded', 'true')}>Forwarded</button>
                <button className={`btn ${filters.is_forwarded === 'false' ? 'btn-primary' : 'btn-outline-primary'}`} 
                  onClick={() => handleFilter('is_forwarded', 'false')}>Local</button>
            </div>

            <div className="ms-auto d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" 
                  onClick={() => setFilters({ status:'', search:'', submitted_from:'', submitted_to:'', delivery_from:'', delivery_to:'', is_forwarded:'' })}>
                  Reset
                </button>
                <Link to="/repairs/new" className="btn btn-primary btn-sm shadow-sm">+ New Repair</Link>
            </div>
        </div>

        {/* Date Filters Row */}
        <div className="d-flex align-items-center gap-4 py-2 px-3 bg-light rounded-3 shadow-sm border border-white">
            <div className="d-flex align-items-center gap-2">
                <span className="text-muted small fw-bold text-nowrap">Submitted:</span>
                <input type="date" className="form-control form-control-sm border-0 shadow-none" style={{width:130, background:'transparent'}}
                    value={filters.submitted_from} onChange={e => handleFilter('submitted_from', e.target.value)} />
                <span className="text-muted small">to</span>
                <input type="date" className="form-control form-control-sm border-0 shadow-none" style={{width:130, background:'transparent'}}
                    value={filters.submitted_to} onChange={e => handleFilter('submitted_to', e.target.value)} />
            </div>
            
            <div className="vr opacity-10"></div>

            <div className="d-flex align-items-center gap-2">
                <span className="text-muted small fw-bold text-nowrap">Delivery:</span>
                <input type="date" className="form-control form-control-sm border-0 shadow-none" style={{width:130, background:'transparent'}}
                    value={filters.delivery_from} onChange={e => handleFilter('delivery_from', e.target.value)} />
                <span className="text-muted small">to</span>
                <input type="date" className="form-control form-control-sm border-0 shadow-none" style={{width:130, background:'transparent'}}
                    value={filters.delivery_to} onChange={e => handleFilter('delivery_to', e.target.value)} />
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
                  <th>Forwarded To</th>
                  <th>Status</th>
                  <th>Delivery</th>
                  <th className="text-end pe-3">Actions</th>
                </tr>
              </thead>
              <tbody>
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
                    <td>
                       <span className={`badge bg-${STATUS_COLORS[r.status] || 'secondary'} rounded-pill`}>
                         {r.status.replace('_', ' ').toUpperCase()}
                       </span>
                    </td>
                    <td>
                      <div className={`small ${r.estimated_delivery_date && !r.actual_delivery_date && new Date(r.estimated_delivery_date) < new Date() ? 'text-danger fw-bold' : 'text-muted'}`}>
                        {formatDate(r.estimated_delivery_date) || 'N/A'}
                      </div>
                      {r.is_forwarded && r.external_expected_delivery && (
                         <div className="text-info mt-1" style={{ fontSize: '0.65rem' }}>
                            Expected: {formatDate(r.external_expected_delivery)}
                         </div>
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
    </div>
  );
}
