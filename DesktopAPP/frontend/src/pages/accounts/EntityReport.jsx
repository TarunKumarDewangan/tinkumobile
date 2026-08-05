import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import debounce from 'lodash/debounce';
import { useNavigate } from 'react-router-dom';

const EntityReport = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, RECEIVABLE, PAYABLE
  
  // Default to current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = today.toISOString().split('T')[0];
  
  const [dateRange, setDateRange] = useState({ start: firstDay, end: lastDay });

  const fetchReport = useCallback(async (query = searchTerm) => {
    setLoading(true);
    try {
      const response = await api.get('/entities/report', {
        params: {
          start_date: dateRange.start,
          end_date: dateRange.end,
          q: query,
          type: filterType
        }
      });
      setData(response.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Failed to load entity report');
    } finally {
      setLoading(false);
    }
  }, [dateRange, filterType, searchTerm]);

  const debouncedFetch = useMemo(
    () => debounce((q) => fetchReport(q), 500),
    [fetchReport]
  );

  useEffect(() => {
    fetchReport();
  }, [dateRange, filterType]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    debouncedFetch(e.target.value);
  };

  // Calculations for Summary Cards
  const summary = useMemo(() => {
    return data.reduce((acc, item) => {
      acc.opening += item.opening_balance;
      acc.settlements += (item.period_out - item.period_in);
      acc.business += item.period_unrealized;
      acc.net += item.net_balance;
      return acc;
    }, { opening: 0, settlements: 0, business: 0, net: 0 });
  }, [data]);

  return (
    <div className="entity-report-page animate-fadeIn p-2 h-100 d-flex flex-column">
      {/* Header & Stats Section */}
      <div className="page-header-glass compact mb-3 p-3 rounded-4 shadow-sm border border-white border-opacity-20 animate-slideDown">
        <div className="row g-3 align-items-center">
          <div className="col-auto border-end pe-4">
            <h1 className="h4 mb-0 fw-bold tracking-tight">Entity Report</h1>
            <p className="xx-small text-muted mb-0 text-uppercase letter-spacing-1">Accounts Summary</p>
          </div>
          
          <div className="col-auto me-auto row g-3">
             <div className="col-auto">
                <div className="stat-card">
                  <span className="xx-small text-uppercase fw-bold opacity-50 d-block">Total Opening</span>
                  <span className={`fw-bold ${summary.opening >= 0 ? 'text-primary' : 'text-danger'}`}>
                    ₹{Math.abs(summary.opening).toLocaleString()} {summary.opening >= 0 ? 'Dr' : 'Cr'}
                  </span>
                </div>
             </div>
             <div className="col-auto">
                <div className="stat-card">
                  <span className="xx-small text-uppercase fw-bold text-success opacity-50 d-block">Settlements (Cash)</span>
                  <span className={`fw-bold ${summary.settlements >= 0 ? 'text-success' : 'text-danger'}`}>
                    {summary.settlements > 0 ? '+' : ''}₹{summary.settlements.toLocaleString()}
                  </span>
                </div>
             </div>
             <div className="col-auto">
                <div className="stat-card">
                   <span className="xx-small text-uppercase fw-bold text-warning opacity-50 d-block">Business (Worth)</span>
                   <span className={`fw-bold ${summary.business >= 0 ? 'text-warning' : 'text-danger'}`}>
                     {summary.business > 0 ? '+' : ''}₹{summary.business.toLocaleString()}
                   </span>
                </div>
             </div>
             <div className="col-auto">
                <div className="stat-card">
                  <span className="xx-small text-uppercase fw-bold opacity-50 d-block">Net Balance</span>
                  <span className={`fw-bold ${summary.net >= 0 ? 'text-primary' : 'text-danger'}`}>
                    ₹{Math.abs(summary.net).toLocaleString()} {summary.net >= 0 ? 'Dr' : 'Cr'}
                  </span>
                </div>
             </div>
          </div>

          <div className="col-auto">
             <button className="btn btn-glass-secondary btn-sm rounded-pill" onClick={() => fetchReport()}>
                <i className="bi bi-arrow-clockwise"></i>
             </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card mb-3 p-3 shadow-sm border-0 animate-fadeInUp">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-3">
             <div className="search-box position-relative">
                <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted x-small"></i>
                <input 
                  type="text" 
                  className="form-control form-control-sm rounded-pill ps-5 bg-light border-0 shadow-none py-2 x-small" 
                  placeholder="Search name or mobile..." 
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </div>
          </div>

          <div className="col-12 col-md-2">
            <div className="input-group input-group-sm">
                <span className="input-group-text bg-transparent border-0 x-small text-muted">From:</span>
                <input 
                    type="date" 
                    className="form-control form-control-sm rounded-pill border-0 bg-light px-3 x-small" 
                    value={dateRange.start}
                    onChange={e => setDateRange({...dateRange, start: e.target.value})}
                />
            </div>
          </div>

          <div className="col-12 col-md-2">
            <div className="input-group input-group-sm">
                <span className="input-group-text bg-transparent border-0 x-small text-muted">To:</span>
                <input 
                    type="date" 
                    className="form-control form-control-sm rounded-pill border-0 bg-light px-3 x-small" 
                    value={dateRange.end}
                    onChange={e => setDateRange({...dateRange, end: e.target.value})}
                />
            </div>
          </div>

          <div className="col-auto ms-auto">
             <div className="tabs-pill shadow-sm">
                <button className={`tab-item ${filterType === 'ALL' ? 'active' : ''}`} onClick={() => setFilterType('ALL')}>
                  <i className="bi bi-grid-fill me-1"></i> ALL
                </button>
                <button className={`tab-item ${filterType === 'RECEIVABLE' ? 'active success' : ''}`} onClick={() => setFilterType('RECEIVABLE')}>
                  <i className="bi bi-arrow-down-circle-fill me-1"></i> REC
                </button>
                <button className={`tab-item ${filterType === 'PAYABLE' ? 'active danger' : ''}`} onClick={() => setFilterType('PAYABLE')}>
                  <i className="bi bi-arrow-up-circle-fill me-1"></i> PAY
                </button>
              </div>
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="glass-card flex-grow-1 overflow-hidden d-flex flex-column shadow-lg p-0 border-0 animate-fadeInUp" style={{animationDelay: '0.1s'}}>
        <div className="table-responsive flex-grow-1 overflow-auto">
          <table className="table table-hover align-middle custom-modern-table mb-0">
            <thead className="sticky-top bg-white bg-opacity-75" style={{backdropFilter: 'blur(10px)', zIndex: 10}}>
              <tr>
                <th className="ps-4">Entity Details</th>
                <th>Relation</th>
                <th className="text-end">Opening</th>
                <th className="text-end">Settlements (Cash)</th>
                <th className="text-end">Business (Worth)</th>
                <th className="text-end pe-4">Net Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                   <td colSpan="7" className="text-center py-5">
                      <div className="spinner-border text-primary opacity-25"></div>
                   </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                   <td colSpan="7" className="text-center py-5 text-muted">No records found for the selected period</td>
                </tr>
              ) : (
                data.map((item, idx) => (
                  <tr key={idx} className="animate-fadeInUp" style={{animationDelay: `${idx * 0.05}s`}}>
                    <td className="ps-4">
                       <div className="d-flex align-items-center gap-3">
                          <div className="avatar shadow-sm" style={{width:'32px', height:'32px', fontSize:'0.75rem'}}>
                            {item.entity_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                             <div className="fw-bold text-dark text-nowrap cursor-pointer" onClick={() => navigate(`/accounts/entity-ledger?name=${encodeURIComponent(item.entity_name)}`)}>
                                {item.entity_name}
                             </div>
                             <div className="xx-small text-muted">{item.phone || 'No Phone'}</div>
                          </div>
                       </div>
                    </td>
                    <td>
                       <span className="badge bg-light text-muted x-small rounded-pill">{item.relation || 'Entity'}</span>
                    </td>
                    <td className={`text-end x-small ${item.opening_balance >= 0 ? 'text-primary' : 'text-danger'}`}>
                        ₹{Math.abs(item.opening_balance).toLocaleString()} {item.opening_balance >= 0 ? 'Dr' : 'Cr'}
                    </td>
                    <td className={`text-end x-small fw-bold ${(item.period_out - item.period_in) >= 0 ? 'text-success' : 'text-danger'}`}>
                        <div className="d-flex flex-column">
                          <span>{ (item.period_out - item.period_in) > 0 ? '+' : '' }₹{ (item.period_out - item.period_in).toLocaleString() }</span>
                          <span className="xx-small opacity-50 fw-normal text-nowrap">In: {item.period_in.toLocaleString()} | Out: {item.period_out.toLocaleString()}</span>
                        </div>
                    </td>
                    <td className={`text-end x-small fw-bold ${item.period_unrealized >= 0 ? 'text-warning' : 'text-danger'}`}>
                        { item.period_unrealized > 0 ? '+' : '' }₹{ item.period_unrealized.toLocaleString() }
                    </td>
                    <td className={`text-end pe-4 fw-bold ${item.net_balance >= 0 ? 'text-primary' : 'text-danger'}`}>
                        ₹{Math.abs(item.net_balance).toLocaleString()} {item.net_balance >= 0 ? 'Dr' : 'Cr'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .xx-small { font-size: 0.65rem; }
        .letter-spacing-1 { letter-spacing: 1px; }
        .avatar {
          background: linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1));
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: var(--primary);
        }
        .custom-modern-table th {
          font-size: 0.7rem;
          text-transform: uppercase;
          color: #6c757d;
          border-bottom: 2px solid #f8f9fa;
          padding: 1rem 0.5rem;
        }
        .custom-modern-table td {
          padding: 0.75rem 0.5rem;
          border-bottom: 1px solid rgba(0,0,0,0.02);
          font-size: 0.85rem;
        }
        .stat-card {
           background: rgba(255,255,255,0.2);
           padding: 6px 12px;
           border-radius: 12px;
           min-width: 120px;
        }
        .tabs-pill {
          display: flex;
          background: rgba(0, 0, 0, 0.05);
          padding: 4px;
          border-radius: 14px;
          gap: 2px;
          border: 1px solid rgba(0, 0, 0, 0.02);
          backdrop-filter: blur(10px);
        }
        .tab-item {
          border: none;
          background: none;
          padding: 6px 16px;
          border-radius: 10px;
          font-size: 0.7rem;
          font-weight: 700;
          color: #64748b;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          white-space: nowrap;
          letter-spacing: 0.5px;
        }
        .tab-item:hover {
          color: var(--primary);
          background: rgba(255, 255, 255, 0.4);
        }
        .tab-item.active {
          background: #fff;
          color: var(--primary);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          transform: translateY(-1px);
        }
        .tab-item.active.success {
          color: #10b981;
        }
        .tab-item.active.danger {
          color: #ef4444;
        }
        .tab-item i {
          font-size: 0.85rem;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
};

export default EntityReport;
