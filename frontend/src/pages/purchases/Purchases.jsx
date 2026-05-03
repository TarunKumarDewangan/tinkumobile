import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import DataBackupModal from '../../components/DataBackupModal';

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [confirmModal, setConfirmModal] = useState({ show: false, id: null, type: '' });
  const [receiptModal, setReceiptModal] = useState({ show: false, invoice: null, items: [] });
  const [suppliers, setSuppliers] = useState([]);
  const { isOwner } = useAuth();
  
  // Filter States
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    supplier_id: '',
    from: '',
    to: '',
    ram: '',
    storage: '',
    color: '',
    model: '',
    imei: ''
  });

  const [activeTab, setActiveTab] = useState('purchases');
  const [availableStock, setAvailableStock] = useState([]);
  const [pendingStock, setPendingStock] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [groupStocks, setGroupStocks] = useState(true);
  const [groupPending, setGroupPending] = useState(true);
  const [imeiList, setImeiList] = useState([]);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRowExpand = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    loadSuppliers();
    loadUniqueImeis();
  }, []);

  useEffect(() => {
    if (activeTab === 'purchases') {
      loadPurchases();
    } else if (activeTab === 'available') {
      loadAvailableStock();
    } else if (activeTab === 'pending') {
      loadPendingStock();
    }
  }, [filters, activeTab, groupStocks, groupPending]);

  const loadSuppliers = async () => {
    try {
      const r = await api.get('/suppliers');
      setSuppliers(r.data);
    } catch(e) {}
  };

  const loadUniqueImeis = async () => {
    try {
      const { data } = await api.get('/purchase-invoices/unique-imeis');
      setImeiList(data);
    } catch(e) {}
  };

  const loadPurchases = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/purchase-invoices', { params: { ...filters, category_id: 1, with_items: 1 } });
      setPurchases(data.data || data); // Fallback for non-paginated or error
    } catch(e) {
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableStock = async () => {
    setLoadingStocks(true);
    try {
      // Category 1 = Mobile
      const { data } = await api.get('/products', { params: { ...filters, category_id: 1, group_by_config: groupStocks } });
      setAvailableStock(data.data || data);
    } catch(e) {
      toast.error('Failed to load available stock');
    } finally {
      setLoadingStocks(false);
    }
  };

  const loadPendingStock = async () => {
    setLoadingStocks(true);
    try {
      const { data } = await api.get('/purchase-invoices/pending-stocks', { params: { ...filters, group_by_config: groupPending } });
      setPendingStock(data.data || data);
    } catch(e) {
      toast.error('Failed to load pending stock');
    } finally {
      setLoadingStocks(false);
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      supplier_id: '',
      from: '',
      to: '',
      ram: '',
      storage: '',
      color: '',
      model: '',
      imei: ''
    });
  };

  const [locationModal, setLocationModal] = useState({ show: false, id: null, currentLocation: '', isProduct: false });

  const openLocationModal = (id, currentLocation, isProduct) => {
    setLocationModal({ show: true, id, currentLocation: currentLocation || '', isProduct });
  };

  const handleUpdateLocation = async () => {
    const { id, currentLocation, isProduct } = locationModal;
    try {
      await api.patch(`/stocks/${id}/location`, { 
        location: currentLocation.toUpperCase(),
        is_product: isProduct 
      });
      toast.success('Location updated');
      setLocationModal({ show: false, id: null, currentLocation: '', isProduct: false });
      loadAvailableStock();
    } catch(e) {
      toast.error('Failed to update location');
    }
  };

  const handleMarkReceived = (purchase) => {
    setReceiptModal({ 
      show: true, 
      invoice: purchase, 
      items: purchase.items.map(item => ({
        id: item.id,
        product_name: item.product?.name,
        ordered_quantity: item.quantity,
        received_quantity: item.quantity,
        damaged_quantity: 0
      }))
    });
  };

  const handleDelete = (id) => {
    setConfirmModal({ show: true, id, type: 'delete' });
  };

  const executeAction = async () => {
    const { id, type } = confirmModal;
    setConfirmModal({ show: false, id: null, type: '' });

    if (type === 'delete') {
      try {
        await api.delete(`/purchase-invoices/${id}`);
        toast.success('Purchase order deleted');
        loadPurchases();
      } catch(e) {
        toast.error(e.response?.data?.message || 'Error deleting');
      }
    } else if (type === 'delete_stock') {
      try {
        await api.delete(`/products/stock/${id}`);
        toast.success('Stock item removed and invoice adjusted');
        loadAvailableStock();
        loadPurchases();
      } catch (e) {
        toast.error(e.response?.data?.message || 'Error deleting stock');
      }
    }
  };

  const handleReceiptItemChange = (idx, field, value) => {
    const newItems = [...receiptModal.items];
    newItems[idx][field] = parseInt(value) || 0;
    setReceiptModal(prev => ({ ...prev, items: newItems }));
  };

  const handleConfirmReceipt = async () => {
    try {
      await api.post(`/purchase-invoices/${receiptModal.invoice.id}/receive`, {
        items: receiptModal.items.map(item => ({
          id: item.id,
          received_quantity: item.received_quantity,
          damaged_quantity: item.damaged_quantity
        }))
      });
      toast.success('✅ Order marked as received and stock updated!');
      setReceiptModal({ show: false, invoice: null, items: [] });
      loadPurchases();
    } catch(e) {
      toast.error(e.response?.data?.message || 'Error updating status');
    }
  };

  const PS = `
    .pm-wrap{background:#f1f5f9;min-height:100vh;padding:20px;}
    .pm-hero{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);border-radius:16px;padding:22px 28px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;}
    .pm-hero h2{color:#fff;font-size:1.15rem;font-weight:800;letter-spacing:1px;margin:0;}
    .pm-hero p{color:rgba(255,255,255,.5);font-size:.7rem;margin:2px 0 0;letter-spacing:.5px;}
    .pm-new-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;font-weight:700;font-size:.78rem;padding:9px 20px;border-radius:10px;letter-spacing:.5px;text-decoration:none;white-space:nowrap;transition:opacity .18s;}
    .pm-new-btn:hover{opacity:.88;color:#fff;}
    .pm-filters{background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,.06);}
    .pm-flabel{font-size:.63rem;font-weight:800;letter-spacing:.8px;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;display:block;}
    .pm-finput{font-size:.78rem;border:1.5px solid #e2e8f0;border-radius:8px;padding:5px 10px;width:100%;background:#f8fafc;transition:border-color .15s;}
    .pm-finput:focus{outline:none;border-color:#6366f1;background:#fff;}
    .pm-tab-bar{display:flex;gap:6px;margin-bottom:16px;}
    .pm-tab{padding:8px 18px;border-radius:10px;font-size:.75rem;font-weight:700;letter-spacing:.5px;cursor:pointer;border:2px solid transparent;transition:all .18s;text-transform:uppercase;}
    .pm-tab.active{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-color:transparent;box-shadow:0 3px 10px rgba(99,102,241,.3);}
    .pm-tab:not(.active){background:#fff;color:#64748b;border-color:#e2e8f0;}
    .pm-tab:not(.active):hover{border-color:#6366f1;color:#6366f1;}
    .pm-table-wrap{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);}
    .pm-table{width:100%;border-collapse:collapse;font-size:.78rem;}
    .pm-table thead tr{background:linear-gradient(135deg,#1e293b,#0f172a);}
    .pm-table thead th{color:rgba(255,255,255,.7);font-size:.62rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:11px 14px;border:none;}
    .pm-table tbody tr{border-bottom:1px solid #f1f5f9;transition:background .1s;}
    .pm-table tbody tr:hover{background:#f8fafc;}
    .pm-table td{padding:11px 14px;vertical-align:middle;border:none;color:#334155;}
    .pm-badge-ordered{background:#fef3c7;color:#92400e;font-size:.6rem;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.5px;}
    .pm-badge-received{background:#d1fae5;color:#065f46;font-size:.6rem;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.5px;}
    .pm-badge-unpaid{background:#fee2e2;color:#991b1b;font-size:.6rem;font-weight:700;padding:3px 8px;border-radius:20px;}
    .pm-badge-partial{background:#e0f2fe;color:#0369a1;font-size:.6rem;font-weight:700;padding:3px 8px;border-radius:20px;}
    .pm-badge-paid{background:#d1fae5;color:#065f46;font-size:.6rem;font-weight:700;padding:3px 8px;border-radius:20px;}
    .pm-act-btn{font-size:.65rem;font-weight:700;padding:4px 9px;border-radius:7px;border:1.5px solid;cursor:pointer;transition:all .15s;text-decoration:none;display:inline-block;}
    .pm-tip{background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:12px;padding:12px 18px;font-size:.78rem;margin-top:16px;border-left:4px solid #6366f1;}
    .pm-clear-btn{font-size:.7rem;font-weight:700;padding:5px 12px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;transition:all .15s;}
    .pm-clear-btn:hover{border-color:#ef4444;color:#ef4444;}
    .pm-toggle{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;padding:7px 14px;cursor:pointer;font-size:.7rem;font-weight:700;color:#475569;transition:border-color .15s;}
    .pm-toggle:hover{border-color:#6366f1;color:#6366f1;}
  `;

  return (
    <div className="pm-wrap">
      <style>{PS}</style>

      {/* Hero Header */}
      <div className="pm-hero">
        <div>
          <h2>📱 New Mobiles Manager</h2>
          <p>PURCHASES · INVENTORY · STOCK TRACKING</p>
        </div>
        <div className="d-flex gap-2">
          <button onClick={() => setShowBackupModal(true)} className="pm-new-btn" style={{background: 'linear-gradient(135deg, #1e293b, #334155)'}}>
            📥 Backup / Restore
          </button>
          <Link to="/purchases/new" className="pm-new-btn">+ New Purchase</Link>
        </div>
      </div>

      <DataBackupModal 
        isOpen={showBackupModal} 
        onClose={() => setShowBackupModal(false)}
        onRefresh={loadPurchases}
        title="Purchases Data Backup"
        endpoint="/purchase-invoices"
        typeLabel="Purchases"
      />

      {/* Filters */}
      <div className="pm-filters">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-2">
            <span className="pm-flabel">🔍 Search Invoice / Supplier</span>
            <input className="pm-finput" placeholder="Invoice or supplier..." value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value.toUpperCase())} />
          </div>
          <div className="col-6 col-md-2">
            <span className="pm-flabel">📱 Model Name</span>
            <input className="pm-finput" placeholder="e.g. VIVO V70" value={filters.model}
              onChange={e => handleFilterChange('model', e.target.value.toUpperCase())} />
          </div>
          <div className="col-6 col-md-2">
            <span className="pm-flabel">🆔 IMEI No</span>
            <input className="pm-finput" placeholder="Search by IMEI" value={filters.imei}
              onChange={e => handleFilterChange('imei', e.target.value)} />
          </div>
          <div className="col-4 col-md-1">
            <span className="pm-flabel">🎨 Color</span>
            <input className="pm-finput" placeholder="e.g. BLACK" value={filters.color}
              onChange={e => handleFilterChange('color', e.target.value.toUpperCase())} />
          </div>
          <div className="col-4 col-md-1">
            <span className="pm-flabel">💾 RAM</span>
            <input className="pm-finput" placeholder="e.g. 8" value={filters.ram}
              onChange={e => handleFilterChange('ram', e.target.value)} />
          </div>
          <div className="col-4 col-md-1">
            <span className="pm-flabel">📦 Storage</span>
            <input className="pm-finput" placeholder="e.g. 128" value={filters.storage}
              onChange={e => handleFilterChange('storage', e.target.value)} />
          </div>
          {activeTab === 'purchases' && (
            <div className="col-6 col-md-1">
              <span className="pm-flabel">📅 From</span>
              <input type="date" className="pm-finput" value={filters.from} onChange={e => handleFilterChange('from', e.target.value)} />
            </div>
          )}
          {activeTab === 'purchases' && (
            <div className="col-6 col-md-1">
              <span className="pm-flabel">📅 To</span>
              <input type="date" className="pm-finput" value={filters.to} onChange={e => handleFilterChange('to', e.target.value)} />
            </div>
          )}
          {activeTab === 'purchases' && (
            <div className="col-6 col-md-1">
              <span className="pm-flabel">📦 Status</span>
              <select className="pm-finput" value={filters.status} onChange={e => handleFilterChange('status', e.target.value)}>
                <option value="">All Status</option>
                <option value="ordered">Ordered</option>
                <option value="received">Received</option>
              </select>
            </div>
          )}
          <div className="col-6 col-md-2">
            <span className="pm-flabel">👤 Supplier</span>
            <select className="pm-finput" value={filters.supplier_id} onChange={e => handleFilterChange('supplier_id', e.target.value)}>
              <option value="">All Suppliers</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-auto d-flex align-items-end">
            <button className="pm-clear-btn" onClick={clearFilters}>✕ Clear All</button>
          </div>
        </div>
      </div>

      {/* Custom Tab Bar */}
      <div className="pm-tab-bar">
        <button className={`pm-tab${activeTab==='purchases'?' active':''}`} onClick={() => setActiveTab('purchases')}>📋 Purchase History</button>
        <button className={`pm-tab${activeTab==='available'?' active':''}`} onClick={() => setActiveTab('available')}>✅ Stocks Available</button>
        <button className={`pm-tab${activeTab==='pending'?' active':''}`} onClick={() => setActiveTab('pending')}>⏳ Stocks Pending</button>
      </div>

      {/* ── PURCHASE HISTORY ── */}
      {activeTab === 'purchases' && (
        <div className="pm-table-wrap">
          <table className="pm-table">
            <thead>
              <tr>
                <th>Date</th><th>Invoice #</th><th>Supplier</th>
                <th>Items</th><th>Status</th>
                <th>Total</th><th>Paid / Bal</th><th>Notes</th><th style={{textAlign:'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{textAlign:'center',padding:'40px'}}><div className="spinner-border spinner-border-sm"/></td></tr>
              ) : (purchases||[]).length === 0 ? (
                <tr><td colSpan={9} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>No purchases found</td></tr>
              ) : (purchases||[]).map(p => {
                const balance = parseFloat(p.grand_total||0) - parseFloat(p.total_paid||0);
                const ps = p.payment_status;
                return (
                  <tr key={p.id}>
                    <td><span style={{fontSize:'.72rem',color:'#64748b'}}>📅 {formatDate(p.purchase_date)}</span></td>
                    <td><span style={{fontWeight:700,color:'#6366f1',fontSize:'.78rem'}}>{p.invoice_no}</span></td>
                    <td style={{fontWeight:600}}>{p.supplier?.name}</td>
                    <td style={{fontSize:'.75rem',maxWidth:280}}>
                      {(() => {
                        // Filter items client-side if any item-level filters are active
                        const hasItemFilter = filters.model || filters.imei || filters.color || filters.ram || filters.storage;
                        const filteredAll = hasItemFilter ? (p.items || []).filter(item => {
                          const name = (item.product?.name || '').toUpperCase();
                          if (filters.model && !name.includes(filters.model.toUpperCase())) return false;
                          if (filters.imei && !(item.imei || '').includes(filters.imei)) return false;
                          if (filters.color && !(item.color || '').toUpperCase().includes(filters.color.toUpperCase())) return false;
                          if (filters.ram && !(item.ram || '').includes(filters.ram)) return false;
                          if (filters.storage && !(item.storage || '').includes(filters.storage)) return false;
                          return true;
                        }) : (p.items || []);
                        const isExpanded = expandedRows[p.id];
                        const items = isExpanded ? filteredAll : filteredAll.slice(0, 3);
                        const extra = filteredAll.length - 3;
                        return (
                          <>
                            {items?.map((item,idx) => (
                              <div key={idx} style={{marginBottom:5,paddingBottom:5,borderBottom:'1px solid #f1f5f9'}}>
                                {/* Row 1: Name + Qty */}
                                <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                                  <span style={{fontWeight:700,color:'#1e293b'}}>{item.product?.name}</span>
                                  <span style={{background:'#e0e7ff',color:'#6366f1',fontSize:'.6rem',fontWeight:700,padding:'1px 7px',borderRadius:10}}>x{item.quantity}</span>
                                  {p.status==='received' && <>
                                    <span style={{color:'#059669',fontSize:'.6rem',fontWeight:700}}>✔{item.received_quantity||0}</span>
                                    {item.damaged_quantity>0 && <span style={{color:'#dc2626',fontSize:'.6rem',fontWeight:700}}>✖{item.damaged_quantity}</span>}
                                  </>}
                                </div>
                                {/* Row 2: Config */}
                                <div style={{marginTop:2,color:'#64748b',fontSize:'.65rem'}}>
                                  {[item.ram, item.storage, item.color].filter(Boolean).join(' / ')}
                                  {item.imei && <span style={{display:'inline-block',marginLeft:6,color:'#6366f1',fontWeight:700}}>🆔 {item.imei}</span>}
                                </div>
                              </div>
                            ))}
                            {extra > 0 && (
                              <button onClick={() => toggleRowExpand(p.id)}
                                style={{background:'none',border:'none',padding:0,color:'#6366f1',fontWeight:700,fontSize:'.65rem',cursor:'pointer',textDecoration:'underline'}}>
                                {isExpanded ? '▲ Show less' : `+${extra} more — click to expand`}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td><span className={p.status==='ordered'?'pm-badge-ordered':'pm-badge-received'}>{p.status?.toUpperCase()}</span></td>
                    <td style={{fontWeight:700,color:'#6366f1'}}>₹{parseFloat(p.grand_total||0).toLocaleString('en-IN')}</td>
                    <td>
                      <div style={{fontSize:'.7rem',color:'#059669',fontWeight:700}}>₹{parseFloat(p.total_paid||0).toLocaleString('en-IN')}</div>
                      <div style={{fontSize:'.7rem',color:balance>0?'#dc2626':'#94a3b8',fontWeight:700}}>Bal:₹{balance.toLocaleString('en-IN')}</div>
                      <span className={ps==='paid'?'pm-badge-paid':ps==='partial'?'pm-badge-partial':'pm-badge-unpaid'}>{ps?.toUpperCase()||'UNPAID'}</span>
                    </td>
                    <td style={{fontSize:'.72rem',color:'#94a3b8',maxWidth:110,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={p.notes}>{p.notes||'-'}</td>
                    <td>
                      <div style={{display:'flex',justifyContent:'flex-end',gap:5,flexWrap:'wrap'}}>
                        {p.status==='ordered' && (
                          <button onClick={() => handleMarkReceived(p)} className="pm-act-btn" style={{background:'#d1fae5',borderColor:'#6ee7b7',color:'#065f46'}}>✓ Receive</button>
                        )}
                        <Link to={`/purchases/${p.id}/edit`} className="pm-act-btn" style={{borderColor:'#a5b4fc',color:'#6366f1'}}>Edit</Link>
                        <Link to={`/purchases/${p.id}`} className="pm-act-btn" style={{borderColor:'#93c5fd',color:'#2563eb'}}>View</Link>
                        <button onClick={() => handleDelete(p.id)} className="pm-act-btn" style={{background:'none',borderColor:'#fca5a5',color:'#dc2626'}}>Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── AVAILABLE STOCKS ── */}
      {activeTab === 'available' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div className="pm-toggle" onClick={() => setGroupStocks(!groupStocks)}>
              <input type="checkbox" checked={groupStocks} onChange={()=>{}} style={{accentColor:'#6366f1',width:16,height:16}} />
              Group by Same Configuration
            </div>
            <button className="pm-act-btn" style={{borderColor:'#a5b4fc',color:'#6366f1',padding:'6px 14px'}}>📊 Full Report</button>
          </div>
          <div className="pm-table-wrap">
            <table className="pm-table">
              <thead><tr><th>Product</th><th>Configuration</th><th>Location</th><th style={{textAlign:'center'}}>Stock</th><th style={{textAlign:'right'}}>Price</th><th style={{textAlign:'right'}}>Actions</th></tr></thead>
              <tbody>
                {loadingStocks ? (
                  <tr><td colSpan={6} style={{textAlign:'center',padding:'40px'}}><div className="spinner-border spinner-border-sm"/></td></tr>
                ) : availableStock.map((p,idx) => (
                  <tr key={p.id||idx}>
                    <td style={{fontWeight:700,color:'#6366f1'}}>{p.name}</td>
                    <td style={{fontSize:'.75rem'}}>
                      <span style={{background:'#f1f5f9',borderRadius:6,padding:'2px 8px',fontSize:'.65rem',fontWeight:700,marginRight:6}}>{p.attributes?.color||'-'}</span>
                      <span style={{color:'#64748b'}}>{p.attributes?.ram||'-'}/{p.attributes?.storage||'-'}</span>
                      {p.attributes?.imei && <div style={{color:'#059669',fontSize:'.63rem',fontWeight:700}}>🆔{p.attributes.imei}</div>}
                    </td>
                    <td>
                      <button onClick={() => openLocationModal(p.id,p.location,groupStocks)} style={{background:'none',border:'none',color:'#64748b',fontWeight:700,fontSize:'.75rem',cursor:'pointer',padding:0}}>
                        📍 {p.location||'Set Location'}
                      </button>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{background:p.current_stock>0?'#d1fae5':'#fee2e2',color:p.current_stock>0?'#065f46':'#991b1b',fontWeight:700,fontSize:'.7rem',padding:'3px 12px',borderRadius:20}}>{p.current_stock} pcs</span>
                    </td>
                    <td style={{textAlign:'right',fontWeight:700}}>₹{parseFloat(p.selling_price||0).toLocaleString('en-IN')}</td>
                    <td style={{textAlign:'right'}}>
                      <div style={{display:'flex',justifyContent:'flex-end',gap:5}}>
                        {(isOwner()&&!groupStocks) && <button onClick={() => setConfirmModal({show:true,id:p.id,type:'delete_stock'})} className="pm-act-btn" style={{borderColor:'#fca5a5',color:'#dc2626'}}>🗑️</button>}
                        <button onClick={() => toast.info('Stock Ledger coming soon!')} className="pm-act-btn" style={{borderColor:'#93c5fd',color:'#2563eb'}}>📄</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PENDING STOCKS ── */}
      {activeTab === 'pending' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div className="pm-toggle" onClick={() => setGroupPending(!groupPending)}>
              <input type="checkbox" checked={groupPending} onChange={()=>{}} style={{accentColor:'#f59e0b',width:16,height:16}} />
              Group Pending by Configuration
            </div>
            <button className="pm-act-btn" style={{borderColor:'#a5b4fc',color:'#6366f1',padding:'6px 14px'}}>📑 Pending Report</button>
          </div>
          <div className="pm-table-wrap">
            <table className="pm-table">
              <thead><tr><th>Product</th><th>Configuration</th><th style={{textAlign:'center'}}>Qty</th><th>Supplier</th><th>Expected</th><th style={{textAlign:'right'}}>Actions</th></tr></thead>
              <tbody>
                {loadingStocks ? (
                  <tr><td colSpan={6} style={{textAlign:'center',padding:'40px'}}><div className="spinner-border spinner-border-sm"/></td></tr>
                ) : pendingStock.map((item,idx) => (
                  <tr key={item.id||idx}>
                    <td style={{fontWeight:700,color:'#6366f1'}}>{item.product?.name}</td>
                    <td style={{fontSize:'.75rem'}}>
                      <span style={{background:'#fef3c7',borderRadius:6,padding:'2px 8px',fontSize:'.65rem',fontWeight:700,marginRight:6}}>{item.color||'-'}</span>
                      <span style={{color:'#64748b'}}>{item.ram||'-'}/{item.storage||'-'}</span>
                      {item.imei && <div style={{color:'#f59e0b',fontSize:'.63rem',fontWeight:700}}>🆔{item.imei}</div>}
                    </td>
                    <td style={{textAlign:'center'}}><span style={{background:'#fef3c7',color:'#92400e',fontWeight:700,fontSize:'.75rem',padding:'3px 12px',borderRadius:20}}>{item.quantity}</span></td>
                    <td style={{fontSize:'.78rem'}}>{item.invoice?.supplier?.name}</td>
                    <td style={{fontSize:'.72rem',color:'#94a3b8'}}>{item.invoice?.expected_delivery_date||'-'}</td>
                    <td style={{textAlign:'right'}}><button className="pm-act-btn" style={{borderColor:'#93c5fd',color:'#2563eb'}}>📋</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pro Tip */}
      <div className="pm-tip">
        💡 <strong>PRO TIP:</strong> Orders in <span style={{color:'#f59e0b',fontWeight:700}}>ORDERED</span> status do not affect inventory. Stock is added only when you click <span style={{color:'#059669',fontWeight:700}}>"MARK RECEIVED"</span>.
      </div>

      {/* Confirm Modal */}
      <Modal show={confirmModal.show} onHide={() => setConfirmModal({show:false,id:null,type:''})} centered>
        <Modal.Header closeButton style={{background:'#1e293b',borderBottom:'none'}}>
          <Modal.Title style={{color:'#fff',fontWeight:700,fontSize:'1rem'}}>⚠️ Confirm Action</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{padding:'24px',fontSize:'.85rem',color:'#475569'}}>
          {confirmModal.type==='delete'
            ? 'Are you sure you want to delete this purchase order? This will reverse any stock added.'
            : 'Mark this order as received? Items will be added to inventory stock.'}
        </Modal.Body>
        <Modal.Footer style={{borderTop:'1px solid #f1f5f9',padding:'12px 20px'}}>
          <Button variant="light" className="fw-bold" onClick={() => setConfirmModal({show:false,id:null,type:''})}>Cancel</Button>
          <Button variant={confirmModal.type==='delete'?'danger':'success'} className="fw-bold px-4" onClick={executeAction}>
            {confirmModal.type==='delete'?'Yes, Delete':'Confirm Receive'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Receipt Modal */}
      <Modal show={receiptModal.show} onHide={() => setReceiptModal({show:false,invoice:null,items:[]})} centered size="lg">
        <Modal.Header closeButton style={{background:'linear-gradient(135deg,#1a1a2e,#0f3460)',borderBottom:'none'}}>
          <Modal.Title style={{color:'#fff',fontWeight:700,fontSize:'1rem'}}>📦 Receive: {receiptModal.invoice?.invoice_no}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{padding:'20px'}}>
          <p style={{fontSize:'.8rem',color:'#64748b',marginBottom:16}}>Check received items and mark any damage. Only "good" items will be added to stock.</p>
          <div className="table-responsive">
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.82rem'}}>
              <thead><tr style={{background:'#f8fafc'}}>
                <th style={{padding:'10px 14px',fontWeight:700,color:'#475569',textTransform:'uppercase',fontSize:'.65rem',letterSpacing:.8}}>Product</th>
                <th style={{padding:'10px 14px',textAlign:'center',fontWeight:700,color:'#475569',textTransform:'uppercase',fontSize:'.65rem',letterSpacing:.8,width:90}}>Ordered</th>
                <th style={{padding:'10px 14px',textAlign:'center',fontWeight:700,color:'#059669',textTransform:'uppercase',fontSize:'.65rem',letterSpacing:.8,width:110}}>Received</th>
                <th style={{padding:'10px 14px',textAlign:'center',fontWeight:700,color:'#dc2626',textTransform:'uppercase',fontSize:'.65rem',letterSpacing:.8,width:110}}>Damaged</th>
                <th style={{padding:'10px 14px',textAlign:'center',fontWeight:700,color:'#6366f1',textTransform:'uppercase',fontSize:'.65rem',letterSpacing:.8,width:90}}>Good</th>
              </tr></thead>
              <tbody>
                {receiptModal.items.map((item,idx) => (
                  <tr key={item.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                    <td style={{padding:'10px 14px',fontWeight:600}}>{item.product_name}</td>
                    <td style={{padding:'10px 14px',textAlign:'center',fontWeight:700,color:'#64748b'}}>{item.ordered_quantity}</td>
                    <td style={{padding:'10px 14px'}}><input type="number" className="form-control form-control-sm text-center fw-bold" style={{borderColor:'#6ee7b7'}} value={item.received_quantity} onChange={e => handleReceiptItemChange(idx,'received_quantity',e.target.value)} min="0" /></td>
                    <td style={{padding:'10px 14px'}}><input type="number" className="form-control form-control-sm text-center fw-bold" style={{borderColor:'#fca5a5',color:'#dc2626'}} value={item.damaged_quantity} onChange={e => handleReceiptItemChange(idx,'damaged_quantity',e.target.value)} min="0" /></td>
                    <td style={{padding:'10px 14px',textAlign:'center',fontWeight:700,color:'#6366f1'}}>{item.received_quantity-item.damaged_quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal.Body>
        <Modal.Footer style={{borderTop:'1px solid #f1f5f9',padding:'12px 20px'}}>
          <Button variant="light" className="fw-bold" onClick={() => setReceiptModal({show:false,invoice:null,items:[]})}>Cancel</Button>
          <Button className="fw-bold px-4" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',borderColor:'transparent'}} onClick={handleConfirmReceipt}>✅ Confirm Receipt & Add to Stock</Button>
        </Modal.Footer>
      </Modal>

      {/* Location Modal */}
      <Modal show={locationModal.show} onHide={() => setLocationModal({...locationModal,show:false})} centered>
        <Modal.Header closeButton style={{borderBottom:'none',paddingBottom:0}}>
          <Modal.Title style={{fontWeight:700,fontSize:'1rem'}}>📍 Set Stock Location</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{padding:'20px 24px'}}>
          <label style={{fontSize:'.72rem',fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.8,display:'block',marginBottom:8}}>Enter physical location (e.g. Counter 1, Drawer A)</label>
          <input type="text" className="form-control fw-bold" style={{borderColor:'#6366f1',borderWidth:2}} placeholder="TYPE LOCATION..." autoFocus
            value={locationModal.currentLocation}
            onChange={e => setLocationModal({...locationModal,currentLocation:e.target.value.toUpperCase()})}
            onKeyDown={e => e.key==='Enter' && handleUpdateLocation()} />
        </Modal.Body>
        <Modal.Footer style={{borderTop:'none',padding:'0 24px 20px'}}>
          <Button variant="light" className="fw-bold" onClick={() => setLocationModal({...locationModal,show:false})}>Cancel</Button>
          <Button className="fw-bold px-4" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',borderColor:'transparent'}} onClick={handleUpdateLocation}>Save Location</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
