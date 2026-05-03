import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';
import _ from 'lodash'; // Using lodash for debounce

export default function EntityLedger() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [entities, setEntities] = useState([]);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [selectedEntityName, setSelectedEntityName] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [targetEntity, setTargetEntity] = useState(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); 
  const [summary, setSummary] = useState({ overallTotal: 0, receivable: 0, payable: 0 });
  
  const [dateFilter, setDateFilter] = useState({
    start: '',
    end: ''
  });

  const [settleData, setSettleData] = useState({
    amount: '',
    type: 'OUT',
    payment_mode: 'CASH',
    category: 'ENTITY_SETTLEMENT',
    description: ''
  });
  const [categories, setCategories] = useState(['ENTITY_SETTLEMENT', 'SHOP_EXPENSE', 'PERSONAL', 'LOAN_PAYMENT']);

  const fetchSummary = async () => {
    try {
      const { data } = await api.get('/ledgers/summary');
      setSummary(data);
      
      // Also fetch unique categories for the dropdown
      const catRes = await api.get('/transactions/categories');
      if (catRes.data && catRes.data.length > 0) {
        setCategories(catRes.data);
      }
    } catch (e) {
      console.error('Failed to fetch summary or categories', e);
    }
  };

  const loadEntities = useCallback(async (query = '', type = 'ALL') => {
    setLoading(true);
    try {
      const res = await api.get('/ledgers/entity-balances', { params: { q: query, type: type !== 'ALL' ? type : undefined } });
      setEntities(res.data);
    } catch (e) {
      toast.error('Failed to load entities');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  const debouncedSearch = useCallback(
    _.debounce((q, t) => {
      loadEntities(q, t);
    }, 500),
    []
  );

  useEffect(() => {
    debouncedSearch(searchTerm, filterType);
  }, [searchTerm, filterType, debouncedSearch]);

  const [visibleItems, setVisibleItems] = useState(50);

  const loadLedger = async (id, name, dates = dateFilter) => {
    if (!id) return;
    
    setSelectedEntityId(id);
    setSelectedEntityName(name);
    setLedgerLoading(true);
    setVisibleItems(50);
    try {
      const { data } = await api.get(`/ledgers/statement/${id}`, {
        params: {
          start_date: dates.start,
          end_date: dates.end
        }
      });
      setLedger(data.entries || []);
      setTargetEntity({
          ...data.entity,
          net_balance: data.closing_balance,
          opening_balance: data.opening_balance
      });
      setSearchParams({ id, name });
    } catch (error) {
      toast.error('Failed to load ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    const id = searchParams.get('id');
    const name = searchParams.get('name');
    if (id && name) {
      loadLedger(id, name);
    }
  }, []);

  const handleSettle = async (e) => {
    e.preventDefault();
    if (!settleData.amount || settleData.amount <= 0) return toast.error('Enter valid amount');
    try {
      await api.post('/entities/settle', {
        ...settleData,
        entity_name: selectedEntityName
      });
      toast.success('Settlement recorded');
      setShowSettleModal(false);
      setSettleData({ ...settleData, amount: '', description: '' });
      loadLedger(selectedEntityId, selectedEntityName);
      fetchSummary();
      if (searchTerm) loadEntities(searchTerm, filterType);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error recording settlement');
    }
  };

  const handleDateChange = (field, value) => {
    const newDates = { ...dateFilter, [field]: value };
    setDateFilter(newDates);
    if (selectedEntityId) {
        loadLedger(selectedEntityId, selectedEntityName, newDates);
    }
  };

  const clearDates = () => {
    const cleared = { start: '', end: '' };
    setDateFilter(cleared);
    if (selectedEntityId) loadLedger(selectedEntityId, selectedEntityName, cleared);
  };

  return (
    <div className="entity-ledger-modern h-100 d-flex flex-column animate-fadeIn">
      {/* Compact Premium Header with Integrated Search */}
      <div className="page-header-glass compact mb-3 p-3 rounded-4 shadow-sm border border-white border-opacity-20 animate-slideDown">
        <div className="row g-3 align-items-center">
          <div className="col-auto border-end pe-4">
            <h1 className="h4 mb-0 fw-bold tracking-tight">Entity Ledger</h1>
            <p className="xx-small text-muted mb-0 text-uppercase letter-spacing-1">Management Portal</p>
          </div>
          
          <div className="col-md-3">
             <div className="search-box position-relative">
                <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted x-small"></i>
                <input 
                  type="text" 
                  className="form-control form-control-sm rounded-pill ps-5 bg-white bg-opacity-50 border-0 shadow-none py-2 x-small" 
                  placeholder="Search name or mobile..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
          </div>

          <div className="col-auto me-auto">
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
          
          <div className="col-md-2">
            <div className="stat-card">
              <span className="xx-small text-uppercase fw-bold opacity-50 d-block">Overall Total</span>
              <span className={`h5 mb-0 fw-bold ${summary.overallTotal >= 0 ? 'text-primary' : 'text-danger'}`}>
                ₹{parseFloat(summary.overallTotal).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="col-md-2">
            <div className="stat-card">
              <span className="xx-small text-uppercase fw-bold text-success opacity-50 d-block">Receivable</span>
              <span className="h5 mb-0 fw-bold text-success">₹{parseFloat(summary.receivable).toLocaleString()}</span>
            </div>
          </div>
          <div className="col-md-2">
            <div className="stat-card">
              <span className="xx-small text-uppercase fw-bold text-danger opacity-50 d-block">Payable</span>
              <span className="h5 mb-0 fw-bold text-danger">₹{parseFloat(summary.payable).toLocaleString()}</span>
            </div>
          </div>
          <div className="col-auto">
             <button className="btn btn-glass-secondary btn-sm rounded-pill" onClick={() => { fetchSummary(); if (searchTerm) loadEntities(searchTerm, filterType); }}>
                <i className="bi bi-arrow-clockwise"></i>
             </button>
          </div>
        </div>
      </div>

      <div className="row g-3 flex-grow-1 overflow-hidden">
        {/* Modern Sidebar / Master View */}
        <div className="col-lg-3 col-md-5 d-flex flex-column overflow-hidden h-100 animate-slideRight">
          <div className="glass-card flex-grow-1 d-flex flex-column overflow-hidden shadow-sm p-0">
            <div className="flex-grow-1 overflow-auto entity-list p-2">
              {loading ? (
                <div className="d-flex justify-content-center py-5">
                    <div className="spinner-border spinner-border-sm text-primary opacity-50"></div>
                </div>
              ) : !searchTerm ? (
                <div className="text-center py-5">
                  <div className="mb-3 opacity-10"><i className="bi bi-keyboard display-4"></i></div>
                  <div className="text-muted small px-4">Type in the header search to find entities</div>
                </div>
              ) : entities.length === 0 ? (
                <div className="text-center py-5">
                  <div className="mb-3 opacity-10"><i className="bi bi-search display-4"></i></div>
                  <div className="text-muted small px-4">No results found for "{searchTerm}"</div>
                </div>
              ) : (
                entities.map(ent => (
                  <div 
                    key={ent.id}
                    className={`entity-card compact p-2 mb-1 rounded-3 cursor-pointer transition-all ${selectedEntityId == ent.id ? 'active shadow-sm' : 'hover-bg'}`}
                    onClick={() => loadLedger(ent.id, ent.name)}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center">
                        <div className={`avatar-initial rounded-circle me-2 ${ent.net_balance >= 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
                          {ent.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <div className="fw-bold text-dark text-truncate x-small" style={{maxWidth: '120px'}}>{ent.name}</div>
                          <div className="xx-small text-muted">{ent.phone || '—'}</div>
                        </div>
                      </div>
                      <div className="text-end ps-2">
                        <div className={`fw-bold x-small ${ent.net_balance >= 0 ? 'text-success' : 'text-danger'}`}>
                          ₹{Math.abs(ent.net_balance).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Detailed Ledger Area */}
        <div className="col-lg-9 col-md-7 d-flex flex-column overflow-hidden h-100 animate-slideLeft">
          {selectedEntityId ? (
            <div className="glass-card-main flex-grow-1 d-flex flex-column overflow-hidden shadow-sm p-0 animate-fadeIn">
              {/* Detail Header */}
              <div className="p-3 border-bottom bg-white bg-opacity-50 d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                   <h3 className="h5 mb-0 fw-bold">{selectedEntityName}</h3>
                   <div className="d-flex gap-2 align-items-center mt-1">
                      <span className="badge bg-light text-muted fw-normal rounded-pill px-2 xx-small">{targetEntity?.type || 'Entity'}</span>
                      <span className={`xx-small fw-bold text-uppercase ${parseFloat(targetEntity?.net_balance || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                          {parseFloat(targetEntity?.net_balance || 0) >= 0 ? 'Receivable' : 'Payable'}
                      </span>
                   </div>
                </div>

                <div className="d-flex align-items-center gap-2 flex-wrap">
                    {/* Date Filters */}
                    <div className="d-flex align-items-center gap-2 bg-light p-1 rounded-pill px-2 border">
                        <input 
                            type="date" 
                            className="form-control form-control-sm border-0 bg-transparent shadow-none w-auto x-small" 
                            value={dateFilter.start}
                            onChange={e => handleDateChange('start', e.target.value)}
                        />
                        <span className="text-muted xx-small">to</span>
                        <input 
                            type="date" 
                            className="form-control form-control-sm border-0 bg-transparent shadow-none w-auto x-small" 
                            value={dateFilter.end}
                            onChange={e => handleDateChange('end', e.target.value)}
                        />
                        {(dateFilter.start || dateFilter.end) && (
                            <button className="btn btn-link btn-sm p-0 text-danger" onClick={clearDates}><i className="bi bi-x-circle"></i></button>
                        )}
                    </div>
                    
                    <button className="btn btn-primary btn-sm rounded-pill px-3 fw-bold" onClick={() => setShowSettleModal(true)}>
                      Settle
                    </button>
                </div>
              </div>

              {/* Ledger Stats Summary Bar */}
              <div className="bg-light bg-opacity-25 p-2 px-3 d-flex gap-4 border-bottom flex-wrap">
                  <div className="stat-item">
                    <div className="xx-small text-muted fw-bold text-uppercase opacity-50">Total Net</div>
                    <div className={`fw-bold x-small ${parseFloat(targetEntity?.net_balance || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        ₹{Math.abs(parseFloat(targetEntity?.net_balance || 0)).toLocaleString()}
                    </div>
                  </div>
                  <div className="stat-item border-start ps-3">
                    <div className="xx-small text-muted fw-bold text-uppercase opacity-50">In (Recv)</div>
                    <div className="x-small fw-bold text-primary">₹{parseFloat(targetEntity?.in_worth || 0).toLocaleString()}</div>
                  </div>
                  <div className="stat-item border-start ps-3">
                    <div className="xx-small text-muted fw-bold text-uppercase opacity-50">Out (Paid)</div>
                    <div className="x-small fw-bold text-warning">₹{parseFloat(targetEntity?.out_worth || 0).toLocaleString()}</div>
                  </div>
                  {targetEntity?.repair_dues > 0 && (
                      <div className="stat-item border-start ps-3">
                         <div className="xx-small text-muted fw-bold text-uppercase opacity-50">Repairs</div>
                         <div className="x-small fw-bold text-danger">₹{parseFloat(targetEntity?.repair_dues).toLocaleString()}</div>
                      </div>
                  )}
              </div>

              {/* Modern Table Area */}
              <div className="flex-grow-1 overflow-auto p-0 scrollbar-thin">
                {ledgerLoading ? (
                   <div className="text-center py-5">
                       <div className="spinner-border text-primary opacity-50 pulse-animation"></div>
                   </div>
                ) : ledger.length === 0 ? (
                    <div className="text-center py-5 mt-4">
                       <div className="display-4 opacity-10 mb-3"><i className="bi bi-journal-x"></i></div>
                       <h6 className="text-muted">No transactions recorded for this period.</h6>
                    </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle custom-ledger-table mb-0">
                      <thead>
                        <tr>
                          <th className="ps-4">Date</th>
                          <th>Particulars</th>
                          <th>Vch Type</th>
                          <th className="text-end">Debit (Dr)</th>
                          <th className="text-end pe-4">Credit (Cr)</th>
                          <th className="text-end pe-4">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="opening-balance-row bg-light bg-opacity-50">
                          <td className="ps-4 xx-small text-muted">—</td>
                          <td className="xx-small italic text-muted fw-bold text-primary">Opening Balance</td>
                          <td>—</td>
                          <td className="text-end">—</td>
                          <td className="text-end pe-4">—</td>
                          <td className={`text-end pe-4 fw-bold x-small ${(targetEntity?.opening_balance || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                             ₹{Math.abs(targetEntity?.opening_balance || 0).toLocaleString()} {targetEntity?.opening_balance >= 0 ? 'Dr' : 'Cr'}
                          </td>
                        </tr>
                        {ledger.slice(0, visibleItems).map((item) => (
                          <tr key={item.id}>
                            <td className="ps-4">
                                <span className="x-small text-muted">{new Date(item.date).toLocaleDateString()}</span>
                            </td>
                            <td>
                                <div className="d-flex align-items-center">
                                    <div className={`category-dot me-2 bg-primary`}></div>
                                    <div>
                                        <div className="fw-bold text-dark x-small">{item.particulars}</div>
                                    </div>
                                </div>
                            </td>
                            <td><span className="badge bg-light text-secondary border xx-small">{item.voucher_type}</span></td>
                            <td className={`text-end fw-bold x-small ${item.debit > 0 ? 'text-danger' : 'text-muted opacity-25'}`}>
                                {item.debit > 0 ? `₹${Number(item.debit).toLocaleString()}` : '—'}
                            </td>
                            <td className={`text-end pe-4 fw-bold x-small ${item.credit > 0 ? 'text-success' : 'text-muted opacity-25'}`}>
                                {item.credit > 0 ? `₹${Number(item.credit).toLocaleString()}` : '—'}
                            </td>
                            <td className={`text-end pe-4 fw-bold x-small ${item.running_balance >= 0 ? 'text-success' : 'text-danger'}`}>
                                ₹{Math.abs(item.running_balance).toLocaleString()} {item.running_balance >= 0 ? 'Dr' : 'Cr'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {ledger.length > visibleItems && (
                        <div className="text-center p-3">
                            <button className="btn btn-outline-primary btn-sm rounded-pill px-4" onClick={() => setVisibleItems(v => v + 100)}>
                                Load More Transactions ({ledger.length - visibleItems} remaining)
                            </button>
                        </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-100 glass-card d-flex flex-column align-items-center justify-content-center text-muted border-0 shadow-sm">
               <div className="mb-3 bg-light rounded-circle p-3">
                  <i className="bi bi-person-bounding-box h2 opacity-25 mb-0"></i>
               </div>
               <h5 className="fw-bold mb-1">Select an Entity</h5>
               <p className="x-small px-5 text-center">Use the search box in the sidebar to find and select an account.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL & STYLES (Keep same but adjusted for compactness) */}
      {showSettleModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <form onSubmit={handleSettle}>
                <div className="modal-header border-0 p-4 pb-0">
                  <h5 className="modal-title fw-bold">Record Settlement</h5>
                  <button type="button" className="btn-close shadow-none" onClick={() => setShowSettleModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                   <p className="text-muted small mb-4">Add a transaction for <strong>{selectedEntityName}</strong></p>
                   <div className="row g-3">
                       <div className="col-12">
                          <div className="d-flex gap-2">
                             <button type="button" className={`btn flex-fill rounded-3 x-small fw-bold ${settleData.type === 'OUT' ? 'btn-danger' : 'btn-outline-secondary'}`} onClick={() => setSettleData({ ...settleData, type: 'OUT' })}>Paid Out</button>
                             <button type="button" className={`btn flex-fill rounded-3 x-small fw-bold ${settleData.type === 'IN' ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => setSettleData({ ...settleData, type: 'IN' })}>Received</button>
                          </div>
                       </div>
                       <div className="col-md-6">
                            <label className="xx-small fw-bold text-uppercase text-muted">Amount (₹)</label>
                            <input type="number" className="form-control border-0 bg-light fw-bold" required value={settleData.amount} onChange={e => setSettleData({ ...settleData, amount: e.target.value })} />
                       </div>
                       <div className="col-md-6">
                            <label className="xx-small fw-bold text-uppercase text-muted">Payment Mode</label>
                            <select className="form-select border-0 bg-light x-small" value={settleData.payment_mode} onChange={e => setSettleData({ ...settleData, payment_mode: e.target.value })}>
                                <option value="CASH">Cash</option>
                                <option value="GPay">GPay</option>
                                <option value="Online">Online</option>
                            </select>
                       </div>
                       <div className="col-12">
                            <label className="xx-small fw-bold text-uppercase text-muted">Category</label>
                            <input 
                              type="text" 
                              list="categoryOptions"
                              className="form-control border-0 bg-light x-small" 
                              placeholder="e.g. SETTLEMENT, EXPENSE..." 
                              value={settleData.category} 
                              onChange={e => setSettleData({ ...settleData, category: e.target.value })} 
                            />
                            <datalist id="categoryOptions">
                               {categories.map(c => <option key={c} value={c} />)}
                            </datalist>
                       </div>
                       <div className="col-12">
                          <textarea className="form-control border-0 bg-light x-small" rows="2" placeholder="Description..." value={settleData.description} onChange={e => setSettleData({ ...settleData, description: e.target.value })}></textarea>
                       </div>
                   </div>
                </div>
                <div className="modal-footer border-0 p-4 pt-0">
                  <button type="submit" className="btn btn-primary w-100 rounded-pill py-2 fw-bold shadow">Save Transaction</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .entity-ledger-modern {
            font-family: 'Inter', sans-serif;
            color: #1e293b;
            background-color: #f8fafc;
            font-size: 0.85rem;
        }
        .page-header-glass.compact {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .stat-card {
            background: rgba(255,255,255,0.4);
            padding: 8px 12px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.6);
        }
        .glass-card {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.4);
            border-radius: 1rem;
        }
        .glass-card-main {
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            border-radius: 1rem;
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
            padding: 6px 14px;
            border-radius: 10px;
            font-size: 0.65rem;
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
            font-size: 0.8rem;
            opacity: 0.8;
        }
        .entity-card.compact {
            transition: all 0.2s;
        }
        .entity-card.active { background: #edf2ff; border: 1px solid #c7d2fe; }
        .entity-card.hover-bg:hover { background: #f1f5f9; }
        
        .avatar-initial {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 0.9rem;
        }
        .custom-ledger-table thead th {
            background: #f8fafc;
            color: #64748b;
            font-size: 0.65rem;
            font-weight: 700;
            text-transform: uppercase;
            padding: 1rem;
            border-bottom: 2px solid #e2e8f0;
        }
        .custom-ledger-table tbody tr td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; }
        .category-dot { width: 6px; height: 6px; border-radius: 50%; }
        .x-small { font-size: 0.75rem; }
        .xx-small { font-size: 0.65rem; }
        .letter-spacing-1 { letter-spacing: 0.05em; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .animate-slideDown { animation: slideDown 0.4s ease-out; }
      `}</style>
    </div>
  );
}
