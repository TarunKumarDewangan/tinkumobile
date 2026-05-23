import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';
import _ from 'lodash'; // Using lodash for debounce

export default function EntityLedger() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [pinModal, setPinModal] = useState({ show: false, action: null, value: '', error: false, shake: false });
  const [viewTxModal, setViewTxModal] = useState({ show: false, transaction: null });
  const [editTxModal, setEditTxModal] = useState({ 
    show: false, 
    transaction: null, 
    loading: false, 
    formData: { amount: '', category: '', payment_mode: '', description: '', transaction_date: '' } 
  });
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

  const [breakdown, setBreakdown] = useState({
    show: false,
    type: 'OVERALL',
    data: [],
    loading: false
  });

  const [settleData, setSettleData] = useState({
    amount: '',
    type: 'OUT',
    payment_mode: 'CASH',
    category: 'ENTITY_SETTLEMENT',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0]
  });
  const [categories, setCategories] = useState(['ENTITY_SETTLEMENT', 'SHOP_EXPENSE', 'PERSONAL', 'LOAN_PAYMENT']);

  const handlePinRequiredAction = (action) => {
    if (isPinVerified) {
      action();
    } else {
      setPinModal({ show: true, action, value: '', error: false, shake: false });
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinModal.value === '71727378') {
      setIsPinVerified(true);
      const actionToRun = pinModal.action;
      setPinModal({ show: false, action: null, value: '', error: false, shake: false });
      if (actionToRun) actionToRun();
    } else {
      setPinModal(prev => ({ ...prev, error: true, shake: true }));
      toast.error('Invalid security PIN!');
      setTimeout(() => {
        setPinModal(prev => ({ ...prev, shake: false }));
      }, 500);
    }
  };

  const handleViewEntry = async (item) => {
    if (['RECEIPT', 'PAYMENT'].includes(item.voucher_type)) {
      try {
        const { data } = await api.get(`/transactions/${item.voucher_id}`);
        setViewTxModal({ show: true, transaction: data });
      } catch (err) {
        toast.error('Failed to fetch transaction details');
      }
    } else if (['SALE', 'SALE_FINANCE', 'FINANCE_PENDING'].includes(item.voucher_type)) {
      navigate(`/sales/${item.voucher_id}`);
    } else if (item.voucher_type === 'REPAIR') {
      navigate(`/repairs/${item.voucher_id}/edit`);
    } else if (item.voucher_type === 'PURCHASE') {
      navigate(`/purchases/${item.voucher_id}`);
    } else {
      toast.info(`View details of ${item.voucher_type} is not supported directly.`);
    }
  };

  const handleEditEntry = (item) => {
    handlePinRequiredAction(async () => {
      if (['RECEIPT', 'PAYMENT'].includes(item.voucher_type)) {
        try {
          const { data } = await api.get(`/transactions/${item.voucher_id}`);
          setEditTxModal({
            show: true,
            transaction: data,
            loading: false,
            formData: {
              amount: data.amount,
              category: data.category,
              payment_mode: data.payment_mode,
              description: data.description || '',
              transaction_date: data.transaction_date.split('T')[0]
            }
          });
        } catch (err) {
          toast.error('Failed to fetch transaction details for editing');
        }
      } else if (['SALE', 'SALE_FINANCE', 'FINANCE_PENDING'].includes(item.voucher_type)) {
        navigate(`/sales/${item.voucher_id}/edit`);
      } else if (item.voucher_type === 'REPAIR') {
        navigate(`/repairs/${item.voucher_id}/edit`);
      } else if (item.voucher_type === 'PURCHASE') {
        navigate(`/purchases/${item.voucher_id}/edit`);
      } else {
        toast.info(`Editing of ${item.voucher_type} is not supported directly.`);
      }
    });
  };

  const handleDeleteEntry = (item) => {
    handlePinRequiredAction(() => {
      if (!window.confirm(`Are you sure you want to permanently delete this ${item.voucher_type} entry? This action is irreversible.`)) {
        return;
      }
      
      let deleteUrl = '';
      if (['RECEIPT', 'PAYMENT'].includes(item.voucher_type)) {
        deleteUrl = `/transactions/${item.voucher_id}`;
      } else if (['SALE', 'SALE_FINANCE', 'FINANCE_PENDING'].includes(item.voucher_type)) {
        deleteUrl = `/sale-invoices/${item.voucher_id}`;
      } else if (item.voucher_type === 'REPAIR') {
        deleteUrl = `/repairs/${item.voucher_id}`;
      } else if (item.voucher_type === 'PURCHASE') {
        deleteUrl = `/purchase-invoices/${item.voucher_id}`;
      } else if (item.voucher_type === 'AIRTEL_DROP') {
        deleteUrl = `/airtel-drops/${item.voucher_id}`;
      } else if (item.voucher_type === 'AIRTEL_RECOVERY') {
        deleteUrl = `/airtel-recoveries/${item.voucher_id}`;
      } else {
        toast.error(`Deletion of ${item.voucher_type} is not supported.`);
        return;
      }

      api.delete(deleteUrl)
        .then(() => {
          toast.success(`${item.voucher_type} deleted successfully`);
          loadLedger(selectedEntityId, selectedEntityName);
          fetchSummary();
          if (searchTerm) loadEntities(searchTerm, filterType);
        })
        .catch(err => {
          toast.error(err.response?.data?.message || `Failed to delete ${item.voucher_type}`);
        });
    });
  };

  const handleUpdateTx = async (e) => {
    e.preventDefault();
    setEditTxModal(prev => ({ ...prev, loading: true }));
    try {
      await api.put(`/transactions/${editTxModal.transaction.id}`, editTxModal.formData);
      toast.success('Transaction updated successfully');
      setEditTxModal({ show: false, transaction: null, loading: false, formData: {} });
      loadLedger(selectedEntityId, selectedEntityName);
      fetchSummary();
      if (searchTerm) loadEntities(searchTerm, filterType);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update transaction');
    } finally {
      setEditTxModal(prev => ({ ...prev, loading: false }));
    }
  };

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
      let finalData = { ...settleData };
      if (settleData.payment_mode === 'OTHER' && settleData.other_mode) {
        finalData.payment_mode = settleData.other_mode;
      }
      await api.post('/entities/settle', {
        ...finalData,
        entity_name: selectedEntityName
      });
      toast.success('Settlement recorded');
      setShowSettleModal(false);
      setSettleData({ ...settleData, amount: '', description: '', transaction_date: new Date().toISOString().split('T')[0] });
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

  const handleShowBreakdown = async (type) => {
    setBreakdown({ ...breakdown, show: true, type, loading: true, data: [] });
    try {
      const { data } = await api.get('/ledgers/breakdown', { params: { type } });
      setBreakdown(prev => ({ ...prev, data, loading: false }));
    } catch (e) {
      toast.error('Failed to load breakdown');
      setBreakdown(prev => ({ ...prev, show: false, loading: false }));
    }
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
            <div className="stat-card clickable hover-lift" onClick={() => handleShowBreakdown('OVERALL')}>
              <span className="xx-small text-uppercase fw-bold opacity-50 d-block">Overall Total</span>
              <span className={`h5 mb-0 fw-bold ${summary.overallTotal >= 0 ? 'text-primary' : 'text-danger'}`}>
                ₹{parseFloat(summary.overallTotal).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="col-md-2">
            <div className="stat-card clickable hover-lift success" onClick={() => handleShowBreakdown('RECEIVABLE')}>
              <span className="xx-small text-uppercase fw-bold text-success opacity-50 d-block">Receivable</span>
              <span className="h5 mb-0 fw-bold text-success">₹{parseFloat(summary.receivable).toLocaleString()}</span>
            </div>
          </div>
          <div className="col-md-2">
            <div className="stat-card clickable hover-lift danger" onClick={() => handleShowBreakdown('PAYABLE')}>
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
                    
                    <button 
                      className="btn btn-primary btn-sm rounded-pill px-3 fw-bold shadow-sm" 
                      onClick={() => {
                        const isRecv = parseFloat(targetEntity?.net_balance || 0) >= 0;
                        setSettleData(prev => ({ 
                          ...prev, 
                          type: isRecv ? 'IN' : 'OUT',
                          transaction_date: new Date().toISOString().split('T')[0]
                        }));
                        setShowSettleModal(true);
                      }}
                    >
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
                ) : (ledger.length === 0 && parseFloat(targetEntity?.opening_balance || 0) === 0) ? (
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
                          <th className="text-center pe-4" style={{ width: '160px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseFloat(targetEntity?.opening_balance || 0) !== 0 && (
                          <tr className="opening-balance-row bg-light bg-opacity-50">
                            <td className="ps-4 xx-small text-muted">—</td>
                            <td className="xx-small italic text-muted fw-bold text-primary">Opening Balance</td>
                            <td>—</td>
                            <td className="text-end">—</td>
                            <td className="text-end pe-4">—</td>
                            <td className={`text-end pe-4 fw-bold x-small ${targetEntity?.balance_type === 'RECEIVABLE' ? 'text-success' : 'text-danger'}`}>
                               ₹{Math.abs(targetEntity?.opening_balance || 0).toLocaleString()} {targetEntity?.balance_type === 'RECEIVABLE' ? 'Dr' : 'Cr'}
                            </td>
                            <td></td>
                          </tr>
                        )}
                        {ledger.slice(0, visibleItems).map((item) => {
                          const isActionable = ['SALE', 'SALE_FINANCE', 'FINANCE_PENDING', 'REPAIR', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'AIRTEL_DROP', 'AIRTEL_RECOVERY'].includes(item.voucher_type);
                          const isEditable = ['SALE', 'SALE_FINANCE', 'FINANCE_PENDING', 'REPAIR', 'PURCHASE', 'RECEIPT', 'PAYMENT'].includes(item.voucher_type);
                          
                          return (
                            <tr key={item.id}>
                              <td className="ps-4">
                                  <span className="x-small text-muted">{new Date(item.date).toLocaleDateString('en-GB')}</span>
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
                              <td className="text-center pe-4">
                                <div className="d-inline-flex gap-1">
                                  {isActionable && (
                                    <button 
                                      className="btn btn-outline-primary btn-xs rounded-pill px-2 py-0.5 hover-scale fw-bold"
                                      onClick={() => handleViewEntry(item)}
                                    >
                                      View
                                    </button>
                                  )}
                                  {isEditable && (
                                    <button 
                                      className="btn btn-outline-warning btn-xs rounded-pill px-2 py-0.5 hover-scale fw-bold"
                                      onClick={() => handleEditEntry(item)}
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {isActionable && (
                                    <button 
                                      className="btn btn-outline-danger btn-xs rounded-pill px-2 py-0.5 hover-scale fw-bold"
                                      onClick={() => handleDeleteEntry(item)}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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

      {/* SETTLEMENT MODAL */}
      {showSettleModal && (
        <div className="modal show d-block animate-fadeIn" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden">
              <div className="modal-header border-0 p-4 bg-primary text-white">
                <div>
                  <h5 className="modal-title fw-bold mb-0">Record Settlement</h5>
                  <p className="xx-small text-white-50 mb-0 text-uppercase tracking-wider mt-1">
                    Settle outstanding dues for {selectedEntityName}
                  </p>
                </div>
                <button type="button" className="btn-close btn-close-white shadow-none" onClick={() => setShowSettleModal(false)}></button>
              </div>
              
              <form onSubmit={handleSettle}>
                <div className="modal-body p-4">
                  {/* Current Balance Hint */}
                  <div className="d-flex justify-content-between align-items-center bg-light p-3 rounded-3 mb-4 border">
                     <span className="x-small text-muted fw-bold">Current Outstanding:</span>
                     <span className={`fw-bold x-small ${parseFloat(targetEntity?.net_balance || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        ₹{Math.abs(parseFloat(targetEntity?.net_balance || 0)).toLocaleString()} {parseFloat(targetEntity?.net_balance || 0) >= 0 ? 'Receivable (Dr)' : 'Payable (Cr)'}
                     </span>
                  </div>

                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label x-small fw-bold text-dark">SETTLEMENT TYPE</label>
                      <div className="d-flex gap-3">
                        <label className={`btn btn-outline-success flex-grow-1 text-start p-2 rounded-3 ${settleData.type === 'IN' ? 'active fw-bold' : ''}`}>
                          <input 
                            type="radio" 
                            name="settle_type" 
                            className="d-none" 
                            checked={settleData.type === 'IN'} 
                            onChange={() => setSettleData({...settleData, type: 'IN'})} 
                          />
                          <div className="x-small">📥 Received In</div>
                          <div className="xx-small text-muted">Customer paying us</div>
                        </label>
                        <label className={`btn btn-outline-danger flex-grow-1 text-start p-2 rounded-3 ${settleData.type === 'OUT' ? 'active fw-bold' : ''}`}>
                          <input 
                            type="radio" 
                            name="settle_type" 
                            className="d-none" 
                            checked={settleData.type === 'OUT'} 
                            onChange={() => setSettleData({...settleData, type: 'OUT'})} 
                          />
                          <div className="x-small">📤 Paid Out</div>
                          <div className="xx-small text-muted">Paying supplier/party</div>
                        </label>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">AMOUNT (₹) <span className="text-danger">*</span></label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control fw-bold border-primary" 
                        placeholder="0.00" 
                        required
                        autoFocus
                        value={settleData.amount}
                        onChange={e => setSettleData({...settleData, amount: e.target.value})}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">PAYMENT MODE</label>
                      <select 
                        className="form-select x-small"
                        value={settleData.payment_mode}
                        onChange={e => setSettleData({...settleData, payment_mode: e.target.value})}
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI / Digital</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="ADJUSTMENT">Discount / Adjustment</option>
                        <option value="OTHER">Other Mode</option>
                      </select>
                    </div>

                    {settleData.payment_mode === 'OTHER' && (
                      <div className="col-12 animate-fadeIn">
                         <input 
                           type="text" 
                           className="form-control form-control-sm x-small" 
                           placeholder="Specify custom payment mode..." 
                           required 
                           value={settleData.other_mode || ''}
                           onChange={e => setSettleData({...settleData, other_mode: e.target.value})}
                         />
                      </div>
                    )}

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">SETTLEMENT DATE</label>
                      <input 
                        type="date" 
                        className="form-control x-small" 
                        required 
                        value={settleData.transaction_date}
                        onChange={e => setSettleData({...settleData, transaction_date: e.target.value})}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">CATEGORY</label>
                      <select 
                        className="form-select x-small text-uppercase"
                        value={settleData.category}
                        onChange={e => setSettleData({...settleData, category: e.target.value})}
                      >
                        {categories.map((c, idx) => (
                          <option key={idx} value={c}>{c.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label x-small fw-bold text-muted mb-1">PARTICULARS / NOTES</label>
                      <textarea 
                        className="form-control x-small" 
                        rows="2" 
                        placeholder="E.g. Settle old bill balance..."
                        value={settleData.description}
                        onChange={e => setSettleData({...settleData, description: e.target.value})}
                      ></textarea>
                    </div>
                  </div>
                </div>
                
                <div className="modal-footer border-0 p-3 bg-light justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3 fw-bold" onClick={() => setShowSettleModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm rounded-pill px-4 fw-bold">Confirm Settlement</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {breakdown.show && (
        <div className="modal show d-block animate-fadeIn" style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', zIndex: 1060 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden" style={{ background: 'rgba(255,255,255,0.95)' }}>
              <div className="modal-header border-0 p-4 bg-white">
                <div>
                  <h5 className="modal-title fw-bold">
                    {breakdown.type === 'RECEIVABLE' ? '📈 Accounts Receivable' : 
                     breakdown.type === 'PAYABLE' ? '📉 Accounts Payable' : '🏛️ Overall Account Summary'}
                  </h5>
                  <p className="xx-small text-muted mb-0 text-uppercase tracking-wider">
                    Detailed list of all contributing accounts
                  </p>
                </div>
                <button type="button" className="btn-close shadow-none" onClick={() => setBreakdown({ ...breakdown, show: false })}></button>
              </div>
              
              <div className="modal-body p-0">
                {breakdown.loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary opacity-50"></div>
                    <div className="mt-2 xx-small text-muted fw-bold">CALCULATING BALANCES...</div>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="bg-light sticky-top">
                        <tr>
                          <th className="ps-4 py-3 xx-small text-uppercase fw-bold text-muted">Account Name</th>
                          <th className="py-3 xx-small text-uppercase fw-bold text-muted">Type</th>
                          <th className="text-end py-3 xx-small text-uppercase fw-bold text-muted">Balance</th>
                          <th className="text-center py-3 xx-small text-uppercase fw-bold text-muted">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.data.map(item => (
                          <tr key={item.id} className="hover-bg transition-all">
                            <td className="ps-4">
                              <div className="fw-bold x-small">{item.name}</div>
                              <div className="xx-small text-muted">{item.phone || 'No Phone'}</div>
                            </td>
                            <td><span className="badge bg-light text-secondary border xx-small">{item.type}</span></td>
                            <td className={`text-end fw-bold x-small ${item.balance > 0 ? 'text-success' : 'text-danger'}`}>
                              ₹{Math.abs(item.balance).toLocaleString()} {item.balance > 0 ? 'Dr' : 'Cr'}
                            </td>
                            <td className="text-center">
                              <button 
                                className="btn btn-glass-primary btn-xs rounded-pill" 
                                onClick={() => { 
                                  loadLedger(item.id, item.name); 
                                  setBreakdown({ ...breakdown, show: false }); 
                                }}
                              >
                                <i className="bi bi-eye-fill me-1"></i> View Ledger
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
              <div className="modal-footer border-0 p-4 bg-light bg-opacity-50 justify-content-between">
                <div className="xx-small text-muted fw-bold">
                  TOTAL ACCOUNTS: {breakdown.data.length}
                </div>
                <button className="btn btn-secondary btn-sm rounded-pill px-4" onClick={() => setBreakdown({ ...breakdown, show: false })}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN PROMPT MODAL */}
      {pinModal.show && (
        <div className="modal show d-block animate-fadeIn" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-danger text-white border-0 p-4">
                <div className="d-flex align-items-center">
                  <div className="bg-white bg-opacity-20 rounded-circle p-2 me-3">
                    <i className="bi bi-shield-lock-fill h4 mb-0 text-white"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold mb-0">Security Authorization</h5>
                    <p className="xx-small text-white-50 mb-0 mt-1">This operation requires authorization PIN</p>
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white shadow-none" onClick={() => setPinModal({ show: false, action: null, value: '', error: false, shake: false })}></button>
              </div>
              
              <form onSubmit={handlePinSubmit}>
                <div className={`modal-body p-4 bg-light text-center ${pinModal.shake ? 'shake-animation' : ''}`}>
                  <p className="small text-muted mb-3 fw-bold">Enter authorization PIN to proceed:</p>
                  <div className="mb-3">
                    <input 
                      type="password" 
                      className={`form-control form-control-lg text-center fw-bold text-danger ${pinModal.error ? 'border-danger bg-danger-subtle' : 'border-secondary'} shadow-sm`} 
                      placeholder="• • • • • • • •" 
                      maxLength="8"
                      value={pinModal.value}
                      onChange={(e) => setPinModal({ ...pinModal, value: e.target.value, error: false })}
                      autoFocus
                      required
                    />
                  </div>
                </div>
                
                <div className="modal-footer border-0 p-3 bg-white justify-content-end gap-2">
                  <button type="button" className="btn btn-light fw-bold px-4 rounded-pill" onClick={() => setPinModal({ show: false, action: null, value: '', error: false, shake: false })}>Cancel</button>
                  <button type="submit" className="btn btn-danger fw-bold px-4 rounded-pill shadow-sm" disabled={pinModal.value.length < 8}>
                    Verify & Proceed
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW TRANSACTION MODAL */}
      {viewTxModal.show && viewTxModal.transaction && (
        <div className="modal show d-block animate-fadeIn" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header border-0 p-4 bg-primary text-white">
                <div>
                  <h5 className="modal-title fw-bold mb-0">Transaction Details</h5>
                  <p className="xx-small text-white-50 mb-0 mt-1 text-uppercase tracking-wider">Voucher ID: #{viewTxModal.transaction.id}</p>
                </div>
                <button type="button" className="btn-close btn-close-white shadow-none" onClick={() => setViewTxModal({ show: false, transaction: null })}></button>
              </div>
              
              <div className="modal-body p-4 bg-light">
                <div className="card border-0 shadow-sm rounded-3 p-3 mb-3 text-center bg-white">
                  <span className="xx-small text-uppercase fw-bold text-muted d-block mb-1">Transaction Amount</span>
                  <span className={`h2 mb-0 fw-bold ${viewTxModal.transaction.type === 'IN' ? 'text-success' : 'text-danger'}`}>
                    {viewTxModal.transaction.type === 'IN' ? '+' : '-'} ₹{Number(viewTxModal.transaction.amount).toLocaleString()}
                  </span>
                  <span className="badge bg-light text-secondary border rounded-pill mt-2 d-inline-block px-3 py-1 xx-small fw-bold">
                    {viewTxModal.transaction.type === 'IN' ? '📥 RECEIPT' : '📤 PAYMENT'}
                  </span>
                </div>

                <div className="bg-white rounded-3 shadow-sm p-3 border">
                  <div className="row g-3">
                    <div className="col-6">
                      <span className="xx-small text-muted text-uppercase fw-bold d-block">Transaction Date</span>
                      <span className="small fw-bold text-dark">{new Date(viewTxModal.transaction.transaction_date).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="col-6">
                      <span className="xx-small text-muted text-uppercase fw-bold d-block">Payment Mode</span>
                      <span className="small fw-bold text-dark text-uppercase">{viewTxModal.transaction.payment_mode}</span>
                    </div>
                    <div className="col-6">
                      <span className="xx-small text-muted text-uppercase fw-bold d-block">Category</span>
                      <span className="small fw-bold text-dark text-uppercase">{viewTxModal.transaction.category.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="col-6">
                      <span className="xx-small text-muted text-uppercase fw-bold d-block">Recorded By</span>
                      <span className="small fw-bold text-dark">{viewTxModal.transaction.user?.name || 'System'}</span>
                    </div>
                    <div className="col-12 border-top pt-2">
                      <span className="xx-small text-muted text-uppercase fw-bold d-block">Particulars / Description</span>
                      <span className="small text-dark">{viewTxModal.transaction.description || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="modal-footer border-0 p-3 bg-white justify-content-end">
                <button type="button" className="btn btn-primary fw-bold px-4 rounded-pill shadow-sm" onClick={() => setViewTxModal({ show: false, transaction: null })}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TRANSACTION MODAL */}
      {editTxModal.show && editTxModal.transaction && (
        <div className="modal show d-block animate-fadeIn" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header border-0 p-4 bg-warning text-dark">
                <div>
                  <h5 className="modal-title fw-bold mb-0">Edit Transaction</h5>
                  <p className="xx-small text-dark-50 mb-0 mt-1 text-uppercase tracking-wider">Modify Manual Transaction Details</p>
                </div>
                <button type="button" className="btn-close shadow-none" onClick={() => setEditTxModal({ show: false, transaction: null, loading: false, formData: {} })}></button>
              </div>
              
              <form onSubmit={handleUpdateTx}>
                <div className="modal-body p-4 bg-light">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">AMOUNT (₹) <span className="text-danger">*</span></label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-control form-control-sm fw-bold border-warning" 
                        placeholder="0.00" 
                        required
                        value={editTxModal.formData.amount}
                        onChange={e => setEditTxModal({
                          ...editTxModal,
                          formData: { ...editTxModal.formData, amount: e.target.value }
                        })}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">PAYMENT MODE</label>
                      <select 
                        className="form-select form-select-sm x-small"
                        value={editTxModal.formData.payment_mode}
                        onChange={e => setEditTxModal({
                          ...editTxModal,
                          formData: { ...editTxModal.formData, payment_mode: e.target.value }
                        })}
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI / Digital</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="ADJUSTMENT">Discount / Adjustment</option>
                        <option value="OTHER">Other Mode</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">TRANSACTION DATE</label>
                      <input 
                        type="date" 
                        className="form-control form-control-sm x-small" 
                        required 
                        value={editTxModal.formData.transaction_date}
                        onChange={e => setEditTxModal({
                          ...editTxModal,
                          formData: { ...editTxModal.formData, transaction_date: e.target.value }
                        })}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">CATEGORY</label>
                      <select 
                        className="form-select form-select-sm x-small text-uppercase"
                        value={editTxModal.formData.category}
                        onChange={e => setEditTxModal({
                          ...editTxModal,
                          formData: { ...editTxModal.formData, category: e.target.value }
                        })}
                      >
                        {categories.map((c, idx) => (
                          <option key={idx} value={c}>{c.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label x-small fw-bold text-muted mb-1">PARTICULARS / NOTES</label>
                      <textarea 
                        className="form-control form-control-sm x-small" 
                        rows="3" 
                        placeholder="E.g. Settle old bill balance..."
                        value={editTxModal.formData.description}
                        onChange={e => setEditTxModal({
                          ...editTxModal,
                          formData: { ...editTxModal.formData, description: e.target.value }
                        })}
                      ></textarea>
                    </div>
                  </div>
                </div>
                
                <div className="modal-footer border-0 p-3 bg-white justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill px-3 fw-bold" onClick={() => setEditTxModal({ show: false, transaction: null, loading: false, formData: {} })} disabled={editTxModal.loading}>Cancel</button>
                  <button type="submit" className="btn btn-warning btn-sm rounded-pill px-4 fw-bold shadow-sm text-dark" disabled={editTxModal.loading}>
                    {editTxModal.loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .shake-animation {
            animation: shake 0.4s ease-in-out;
        }
        .hover-scale {
            transition: all 0.2s ease-in-out;
        }
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
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .stat-card.clickable {
            cursor: pointer;
        }
        .stat-card.hover-lift:hover {
            transform: translateY(-4px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.05);
            background: rgba(255,255,255,0.9);
            border-color: var(--primary);
        }
        .stat-card.hover-lift.success:hover {
            border-color: #10b981;
            background: rgba(16, 185, 129, 0.05);
        }
        .stat-card.hover-lift.danger:hover {
            border-color: #ef4444;
            background: rgba(239, 68, 68, 0.05);
        }
        .btn-xs {
            padding: 0.25rem 0.6rem;
            font-size: 0.6rem;
        }
        .btn-glass-primary {
            background: rgba(var(--primary-rgb), 0.1);
            color: var(--primary);
            border: 1px solid rgba(var(--primary-rgb), 0.2);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .btn-glass-primary:hover {
            background: var(--primary);
            color: #fff;
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
