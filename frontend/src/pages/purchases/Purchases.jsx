import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import pinGate from '../../utils/pinGate';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import DataBackupModal from '../../components/DataBackupModal';

export default function Purchases() {
  const [searchParams] = useSearchParams();
  const category_group = searchParams.get('category_group') || 'new_mobile';
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
    imei: '',
    description: ''
  });

  const [activeTab, setActiveTab] = useState('purchases');
  const [availableStock, setAvailableStock] = useState([]);
  const [pendingStock, setPendingStock] = useState([]);
  const [fullStocksData, setFullStocksData] = useState([]);
  const [editingStock, setEditingStock] = useState(null);
  const [showEditStockModal, setShowEditStockModal] = useState(false);
  const [viewingStock, setViewingStock] = useState(null);
  const [showViewStockModal, setShowViewStockModal] = useState(false);
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
    } else if (activeTab === 'full') {
      loadFullStocks();
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
      const { data } = await api.get('/purchase-invoices', { params: { ...filters, category_group, with_items: 1 } });
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
      const { data } = await api.get('/products', { params: { ...filters, category_group, group_by_config: groupStocks } });
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
      const { data } = await api.get('/purchase-invoices/pending-stocks', { params: { ...filters, category_group, group_by_config: groupPending } });
      setPendingStock(data.data || data);
    } catch(e) {
      toast.error('Failed to load pending stock');
    } finally {
      setLoadingStocks(false);
    }
  };

  const loadFullStocks = async () => {
    setLoadingStocks(true);
    try {
      const { data } = await api.get('/products', { params: { ...filters, category_group, group_by_config: 'false' } });
      setFullStocksData(data.data || data);
    } catch(e) {
      toast.error('Failed to load full stock items');
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
      imei: '',
      description: ''
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
    if (!await pinGate.confirm()) return;

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
        loadFullStocks();
        loadPurchases();
      } catch (e) {
        toast.error(e.response?.data?.message || 'Error deleting stock');
      }
    }
  };

  const handleEditStockSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/products/stock/${editingStock.id}`, {
        color: editingStock.color,
        ram: editingStock.ram,
        storage: editingStock.storage,
        imei: editingStock.imei,
        selling_price: editingStock.selling_price,
        wholeseller_price: editingStock.wholeseller_price,
        min_selling_price: editingStock.min_selling_price,
        incentive_amount: editingStock.incentive_amount,
        unit_price: editingStock.unit_price,
        location: editingStock.location
      });
      toast.success('Stock item updated successfully');
      setShowEditStockModal(false);
      setEditingStock(null);
      loadFullStocks();
      loadAvailableStock();
      loadPurchases();
    } catch(err) {
      toast.error(err.response?.data?.message || 'Error updating stock item');
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
    .pm-hero{background:#1e293b;border-radius:12px;padding:20px 24px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;border:1px solid #cbd5e1;}
    .pm-hero h2{color:#fff;font-size:1.15rem;font-weight:800;letter-spacing:1px;margin:0;}
    .pm-hero p{color:rgba(255,255,255,.5);font-size:.7rem;margin:2px 0 0;letter-spacing:.5px;}
    .pm-new-btn{background:#334155;border:1px solid #475569;color:#fff;font-weight:700;font-size:.78rem;padding:9px 20px;border-radius:8px;letter-spacing:.5px;text-decoration:none;white-space:nowrap;transition:background .15s;}
    .pm-new-btn:hover{background:#0f172a;color:#fff;}
    .pm-filters{background:#fff;border-radius:12px;padding:16px 18px;margin-bottom:16px;box-shadow:none;border:1px solid #cbd5e1;}
    .pm-flabel{font-size:.63rem;font-weight:800;letter-spacing:.8px;color:#475569;text-transform:uppercase;margin-bottom:4px;display:block;}
    .pm-finput{font-size:.78rem;border:1.5px solid #cbd5e1;border-radius:6px;padding:5px 10px;width:100%;background:#f8fafc;transition:border-color .15s;}
    .pm-finput:focus{outline:none;border-color:#1e293b;background:#fff;}
    .pm-tab-bar{display:flex;gap:6px;margin-bottom:16px;}
    .pm-tab{padding:8px 18px;border-radius:8px;font-size:.75rem;font-weight:700;letter-spacing:.5px;cursor:pointer;border:1px solid #cbd5e1;transition:all .18s;text-transform:uppercase;}
    .pm-tab.active{background:#334155;color:#fff;border-color:transparent;box-shadow:none;}
    .pm-tab:not(.active){background:#fff;color:#475569;border-color:#cbd5e1;}
    .pm-tab:not(.active):hover{border-color:#1e293b;color:#1e293b;}
    .pm-table-wrap{background:#fff;border-radius:8px;overflow:hidden;border:1px solid #cbd5e1;box-shadow:none;}
    .pm-table{width:100%;border-collapse:collapse;font-size:.78rem;}
    .pm-table thead tr{background:#f1f5f9;border-bottom:2px solid #cbd5e1;}
    .pm-table thead th{color:#1e293b;font-size:.65rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:12px 14px;border:1px solid #cbd5e1;}
    .pm-table tbody tr{border-bottom:1px solid #cbd5e1;}
    .pm-table tbody tr:hover{background:#f8fafc;}
    .pm-table td{padding:12px 14px;vertical-align:top;border:1px solid #cbd5e1;color:#1e293b;}
    .pm-badge-ordered{background:#f8fafc;color:#475569;font-size:.6rem;font-weight:700;padding:3px 10px;border-radius:4px;border:1px solid #cbd5e1;letter-spacing:.5px;}
    .pm-badge-received{background:#f1f5f9;color:#1e293b;font-size:.6rem;font-weight:700;padding:3px 10px;border-radius:4px;border:1px solid #94a3b8;letter-spacing:.5px;}
    .pm-badge-unpaid{background:#fff;color:#b91c1c;font-size:.6rem;font-weight:700;padding:3px 8px;border-radius:4px;border:1px solid #fca5a5;}
    .pm-badge-partial{background:#fff;color:#0284c7;font-size:.6rem;font-weight:700;padding:3px 8px;border-radius:4px;border:1px solid #bae6fd;}
    .pm-badge-paid{background:#fff;color:#16a34a;font-size:.6rem;font-weight:700;padding:3px 8px;border-radius:4px;border:1px solid #bbf7d0;}
    .pm-act-btn{font-size:.65rem;font-weight:700;padding:4px 9px;border-radius:4px;border:1px solid #cbd5e1;background:#fff;color:#475569;cursor:pointer;transition:all .15s;text-decoration:none;display:inline-block;}
    .pm-act-btn:hover{background:#f1f5f9;color:#0f172a;border-color:#94a3b8;}
    .pm-tip{background:#f8fafc;border-radius:8px;padding:12px 18px;font-size:.78rem;margin-top:16px;border:1px solid #cbd5e1;border-left:4px solid #475569;}
    .pm-clear-btn{font-size:.7rem;font-weight:700;padding:5px 12px;border-radius:6px;border:1.5px solid #cbd5e1;background:#fff;color:#475569;cursor:pointer;transition:all .15s;}
    .pm-clear-btn:hover{border-color:#b91c1c;color:#b91c1c;}
    .pm-toggle{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1.5px solid #cbd5e1;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:.7rem;font-weight:700;color:#475569;transition:border-color .15s;}
    .pm-toggle:hover{border-color:#1e293b;color:#1e293b;}
  `;

  return (
    <div className="pm-wrap">
      <style>{PS}</style>

      {/* Hero Header */}
      <div className="pm-hero">
        <div>
          <h2>{category_group === 'master' ? '📊 Master Purchases Manager' : (category_group === 'other' ? '🗃️ Other Products Manager' : '📱 New Mobiles Manager')}</h2>
          <p>{category_group === 'master' ? 'ALL CATEGORIES · INVENTORY · STOCK TRACKING' : (category_group === 'other' ? 'ACCESSORIES & SIMS · INVENTORY · STOCK' : 'PURCHASES · INVENTORY · STOCK TRACKING')}</p>
        </div>
        <div className="d-flex gap-2">
          <button onClick={() => setShowBackupModal(true)} className="pm-new-btn" style={{background: 'linear-gradient(135deg, #1e293b, #334155)'}}>
            📥 Backup / Restore
          </button>
          <Link to={category_group === 'master' ? '/purchases/new-master' : (category_group && category_group !== 'master' ? `/purchases/new?category_group=${category_group}` : '/purchases/new?category_group=new_mobile')} className="pm-new-btn">+ New Purchase</Link>
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
          <div className="col-6 col-md-2">
            <span className="pm-flabel">📝 Description</span>
            <input className="pm-finput" placeholder="e.g. SSD, RAM, I3" value={filters.description}
              onChange={e => handleFilterChange('description', e.target.value.toUpperCase())} />
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
        <button className={`pm-tab${activeTab==='full'?' active':''}`} onClick={() => setActiveTab('full')}>📦 Full Stocks</button>
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
                    <td><span style={{fontSize:'.72rem',color:'#475569'}}>📅 {formatDate(p.purchase_date)}</span></td>
                    <td><span style={{fontWeight:800,color:'#1e293b',fontSize:'.78rem'}}>{p.invoice_no}</span></td>
                    <td style={{fontWeight:600}}>{p.supplier?.name}</td>
                    <td style={{fontSize:'.75rem',maxWidth:280}}>
                      {(() => {
                        // Filter items client-side if any item-level filters are active
                        const hasItemFilter = filters.model || filters.imei || filters.color || filters.ram || filters.storage || filters.description;
                        const rawItems = hasItemFilter ? (p.items || []).filter(item => {
                          const name = (item.product?.name || '').toUpperCase();
                          if (filters.model && !name.includes(filters.model.toUpperCase())) return false;
                          if (filters.imei && !(item.imei || '').includes(filters.imei)) return false;
                          if (filters.color && !(item.color || '').toUpperCase().includes(filters.color.toUpperCase())) return false;
                          if (filters.ram && !(item.ram || '').includes(filters.ram)) return false;
                          if (filters.storage && !(item.storage || '').includes(filters.storage)) return false;
                          if (filters.description && !(item.product?.attributes?.description || '').toUpperCase().includes(filters.description.toUpperCase())) return false;
                          return true;
                        }) : (p.items || []);
                        // Group split-row items (same product+specs+price → one entry)
                        const seenG = {};
                        const filteredAll = [];
                        rawItems.forEach(row => {
                          const key = `${row.product_id}|${(row.ram||'').toLowerCase()}|${(row.storage||'').toLowerCase()}|${(row.color||'').toLowerCase()}|${String(row.unit_price)}`;
                          const gi = seenG[key];
                          if (gi !== undefined) {
                            const ex = filteredAll[gi];
                            const exImeis = ex.imei ? ex.imei.split(',').filter(Boolean) : [];
                            const newImeis = row.imei ? row.imei.split(',').filter(Boolean) : [];
                            filteredAll[gi] = { ...ex, imei: [...exImeis, ...newImeis].join(','), quantity: ex.quantity + row.quantity, received_quantity: (ex.received_quantity||0) + (row.received_quantity||0), damaged_quantity: (ex.damaged_quantity||0) + (row.damaged_quantity||0) };
                          } else {
                            seenG[key] = filteredAll.length;
                            filteredAll.push({ ...row });
                          }
                        });
                        const isExpanded = expandedRows[p.id];
                        const items = isExpanded ? filteredAll : filteredAll.slice(0, 3);
                        const extra = filteredAll.length - 3;
                        return (
                          <>
                            {items?.map((item,idx) => (
                              <div key={idx} style={{marginBottom:5,paddingBottom:5,borderBottom:'1px solid #cbd5e1'}}>
                                {/* Row 1: Name + Qty */}
                                <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                                  <span style={{fontWeight:700,color:'#1e293b'}}>
                                    {(item.product?.brand ? item.product.brand.name.toUpperCase() + ' ' : '') + (item.product?.name?.toUpperCase() || '')}
                                  </span>
                                  <span style={{background:'#f1f5f9',color:'#475569',border:'1px solid #cbd5e1',fontSize:'.6rem',fontWeight:700,padding:'1px 5px',borderRadius:4}}>x{item.quantity}</span>
                                  {p.status==='received' && <>
                                    <span style={{color:'#16a34a',fontSize:'.6rem',fontWeight:700}}>✔{item.received_quantity||0}</span>
                                    {item.damaged_quantity>0 && <span style={{color:'#b91c1c',fontSize:'.6rem',fontWeight:700}}>✖{item.damaged_quantity}</span>}
                                  </>}
                                </div>
                                {/* Row 2: Config */}
                                <div style={{marginTop:2,color:'#475569',fontSize:'.65rem'}}>
                                  {[item.ram, item.storage, item.color].filter(Boolean).join(' / ')}
                                  {item.imei && item.imei.split(',').filter(Boolean).map((imei, ii) => (
                                    <span key={ii} style={{display:'inline-block',marginLeft:6,color:'#475569',fontWeight:700}}>
                                      🆔 <Link to={category_group === 'master' ? `/sales/new-master?imei=${imei}` : `/sales/new?category_group=${category_group}&imei=${imei}`} style={{color: 'inherit', textDecoration: 'underline'}} title="Click to create sale for this IMEI">{imei}</Link>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {extra > 0 && (
                              <button onClick={() => toggleRowExpand(p.id)}
                                style={{background:'none',border:'none',padding:0,color:'#475569',fontWeight:700,fontSize:'.65rem',cursor:'pointer',textDecoration:'underline'}}>
                                {isExpanded ? '▲ Show less' : `+${extra} more — click to expand`}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td><span className={p.status==='ordered'?'pm-badge-ordered':'pm-badge-received'}>{p.status?.toUpperCase()}</span></td>
                    <td style={{fontWeight:800,color:'#1e293b'}}>₹{parseFloat(p.grand_total||0).toLocaleString('en-IN')}</td>
                    <td>
                      <div style={{fontSize:'.7rem',color:'#16a34a',fontWeight:700}}>₹{parseFloat(p.total_paid||0).toLocaleString('en-IN')}</div>
                      <div style={{fontSize:'.7rem',color:balance>0?'#b91c1c':'#475569',fontWeight:700}}>Bal:₹{balance.toLocaleString('en-IN')}</div>
                      <span className={ps==='paid'?'pm-badge-paid':ps==='partial'?'pm-badge-partial':'pm-badge-unpaid'}>{ps?.toUpperCase()||'UNPAID'}</span>
                    </td>
                    <td style={{fontSize:'.72rem',color:'#475569',maxWidth:110,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={p.notes}>{p.notes||'-'}</td>
                    <td>
                      <div style={{display:'flex',justifyContent:'flex-end',gap:5,flexWrap:'wrap'}}>
                        {p.status==='ordered' && (
                          <button onClick={() => handleMarkReceived(p)} className="pm-act-btn" style={{background:'#f8fafc',borderColor:'#cbd5e1',color:'#1e293b'}}>✓ Receive</button>
                        )}
                        <Link to={category_group === 'master' ? `/purchases/${p.id}/edit-master` : (category_group ? `/purchases/${p.id}/edit?category_group=${category_group}` : `/purchases/${p.id}/edit`)} className="pm-act-btn">Edit</Link>
                        <Link to={category_group ? `/purchases/${p.id}?category_group=${category_group}` : `/purchases/${p.id}`} className="pm-act-btn">View</Link>
                        <button onClick={() => handleDelete(p.id)} className="pm-act-btn" style={{color:'#b91c1c',borderColor:'#fca5a5'}}>Del</button>
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
              <input type="checkbox" checked={groupStocks} onChange={()=>{}} style={{accentColor:'#334155',width:16,height:16}} />
              Group by Same Configuration
            </div>
            <button className="pm-act-btn" style={{padding:'6px 14px'}}>📊 Full Report</button>
          </div>
          <div className="pm-table-wrap">
            <table className="pm-table">
              <thead><tr><th>Product</th><th>Configuration</th><th>Location</th><th style={{textAlign:'center'}}>Stock</th><th style={{textAlign:'right'}}>Price</th><th style={{textAlign:'right'}}>Actions</th></tr></thead>
              <tbody>
                {loadingStocks ? (
                  <tr><td colSpan={6} style={{textAlign:'center',padding:'40px'}}><div className="spinner-border spinner-border-sm"/></td></tr>
                ) : availableStock.map((p,idx) => (
                  <tr key={p.id||idx}>
                    <td style={{fontWeight:700,color:'#1e293b'}}>
                      {p.brand ? p.brand.name.toUpperCase() + ' ' : ''}{p.name}
                      {p.is_old_mobile && (
                        <span style={{marginLeft:6,background:'#fef3c7',color:'#92400e',border:'1px solid #fcd34d',fontSize:'.58rem',fontWeight:700,padding:'1px 5px',borderRadius:3}}>2ND HAND</span>
                      )}
                    </td>
                    <td style={{fontSize:'.75rem'}}>
                      {['mobile-new', 'mobile-old', 'MOBILE-NEW', 'MOBILE-OLD'].includes((p.category?.slug || p.category?.name || '').toUpperCase().replace(' ', '-')) ? (
                        <>
                          <span style={{background:'#f1f5f9',border:'1px solid #cbd5e1',borderRadius:4,padding:'2px 8px',fontSize:'.65rem',fontWeight:700,marginRight:6}}>{p.attributes?.color||'-'}</span>
                          <span style={{color:'#475569'}}>{p.attributes?.ram||'-'}/{p.attributes?.storage||'-'}</span>
                        </>
                      ) : (
                        <span style={{color:'#475569', fontWeight: 700, textTransform: 'uppercase'}}>{p.attributes?.description || '—'}</span>
                      )}
                      {/* Show IMEI — check both attributes.imei (new mobile) and root p.imei (old mobile exchange) */}
                      {(p.attributes?.imei || p.imei) && (
                        <div style={{color:'#16a34a',fontSize:'.63rem',fontWeight:700}}>
                          🆔<Link to={category_group === 'master' ? `/sales/new-master?imei=${p.attributes?.imei || p.imei}` : `/sales/new?category_group=${category_group}&imei=${p.attributes?.imei || p.imei}`} style={{color: 'inherit', textDecoration: 'underline'}} title="Click to create sale for this set">{p.attributes?.imei || p.imei}</Link>
                        </div>
                      )}
                    </td>
                    <td>
                      <button onClick={() => openLocationModal(p.id,p.location,groupStocks)} style={{background:'none',border:'none',color:'#475569',fontWeight:700,fontSize:'.75rem',cursor:'pointer',padding:0}}>
                        📍 {p.location||'Set Location'}
                      </button>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{background:p.current_stock>0?'#f1f5f9':'#fff',color:p.current_stock>0?'#1e293b':'#b91c1c',border:p.current_stock>0?'1px solid #cbd5e1':'1px solid #fca5a5',fontWeight:700,fontSize:'.7rem',padding:'3px 10px',borderRadius:4}}>{p.current_stock} pcs</span>
                    </td>
                    <td style={{textAlign:'right',fontWeight:700}}>₹{parseFloat(p.selling_price||0).toLocaleString('en-IN')}</td>
                    <td style={{textAlign:'right'}}>
                      <div style={{display:'flex',justifyContent:'flex-end',gap:5}}>
                        {(isOwner()&&!groupStocks) && <button onClick={() => setConfirmModal({show:true,id:p.id,type:'delete_stock'})} className="pm-act-btn" style={{color:'#b91c1c',borderColor:'#fca5a5'}}>Del</button>}
                        <button onClick={() => toast.info('Stock Ledger coming soon!')} className="pm-act-btn">Ledger</button>
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
              <input type="checkbox" checked={groupPending} onChange={()=>{}} style={{accentColor:'#334155',width:16,height:16}} />
              Group Pending by Configuration
            </div>
            <button className="pm-act-btn" style={{padding:'6px 14px'}}>📑 Pending Report</button>
          </div>
          <div className="pm-table-wrap">
            <table className="pm-table">
              <thead><tr><th>Product</th><th>Configuration</th><th style={{textAlign:'center'}}>Qty</th><th>Supplier</th><th>Expected</th><th style={{textAlign:'right'}}>Actions</th></tr></thead>
              <tbody>
                {loadingStocks ? (
                  <tr><td colSpan={6} style={{textAlign:'center',padding:'40px'}}><div className="spinner-border spinner-border-sm"/></td></tr>
                ) : pendingStock.map((item,idx) => (
                  <tr key={item.id||idx}>
                    <td style={{fontWeight:700,color:'#1e293b'}}>
                      {(item.product?.brand ? item.product.brand.name.toUpperCase() + ' ' : '') + (item.product?.name || '')}
                    </td>
                    <td style={{fontSize:'.75rem'}}>
                      {['mobile-new', 'mobile-old'].includes((item.product?.category?.slug || item.product?.category?.name || '').toLowerCase()) ? (
                        <>
                          <span style={{background:'#f1f5f9',border:'1px solid #cbd5e1',borderRadius:4,padding:'2px 8px',fontSize:'.65rem',fontWeight:700,marginRight:6}}>{item.color||'-'}</span>
                          <span style={{color:'#475569'}}>{item.ram||'-'}/{item.storage||'-'}</span>
                        </>
                      ) : (
                        <span style={{color:'#475569', fontWeight: 700, textTransform: 'uppercase'}}>{item.product?.attributes?.description || '—'}</span>
                      )}
                      {item.imei && (
                        <div style={{color:'#475569',fontSize:'.63rem',fontWeight:700}}>
                          🆔<Link to={category_group === 'master' ? `/sales/new-master?imei=${item.imei}` : `/sales/new?category_group=${category_group}&imei=${item.imei}`} style={{color: 'inherit', textDecoration: 'underline'}} title="Click to create sale for this set">{item.imei}</Link>
                        </div>
                      )}
                    </td>
                    <td style={{textAlign:'center'}}><span style={{background:'#f1f5f9',color:'#475569',border:'1px solid #cbd5e1',fontWeight:700,fontSize:'.75rem',padding:'3px 12px',borderRadius:4}}>{item.quantity}</span></td>
                    <td style={{fontSize:'.78rem'}}>{item.invoice?.supplier?.name}</td>
                    <td style={{fontSize:'.72rem',color:'#475569'}}>{item.invoice?.expected_delivery_date||'-'}</td>
                    <td style={{textAlign:'right'}}><button className="pm-act-btn" onClick={() => toast.info('Expected delivery details coming soon!')}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FULL STOCKS ── */}
      {activeTab === 'full' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <h5 className="mb-0 fw-bold text-uppercase" style={{color:'#1e293b', fontSize:'.85rem', letterSpacing:'.5px'}}>📦 Individual Stock Item Inventory</h5>
            <button className="pm-act-btn" style={{padding:'6px 14px'}} onClick={() => loadFullStocks()}>🔄 Refresh List</button>
          </div>
          <div className="pm-table-wrap">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>Specifications</th>
                  <th>IMEI / Serial</th>
                  <th style={{textAlign:'right'}}>Purchase Price</th>
                  <th style={{textAlign:'right'}}>Retail Price</th>
                  <th style={{textAlign:'right'}}>Wholeseller Price</th>
                  <th>Location</th>
                  <th style={{textAlign:'right',width:'280px'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingStocks ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:'40px'}}><div className="spinner-border spinner-border-sm"/></td></tr>
                ) : (fullStocksData||[]).length === 0 ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>No stock items found in this view.</td></tr>
                ) : (fullStocksData||[]).map((p, idx) => {
                  const hasImei = p.attributes?.imei || p.imei;
                  return (
                    <tr key={p.id||idx}>
                      <td style={{fontWeight:700,color:'#1e293b'}}>
                        <div style={{fontWeight:800}}>{(p.brand?.name || p.attributes?.brand || '').toUpperCase()} {p.name}</div>
                        <div className="x-small text-muted" style={{fontSize:'.65rem',marginTop:2}}>{(p.category?.name || p.category?.slug || '').toUpperCase()}</div>
                      </td>
                      <td style={{fontSize:'.75rem'}}>
                        <span style={{background:'#f1f5f9',border:'1px solid #cbd5e1',borderRadius:4,padding:'2px 8px',fontSize:'.65rem',fontWeight:700,marginRight:6}}>{p.attributes?.color||'-'}</span>
                        <span style={{color:'#475569'}}>{p.attributes?.ram||'-'}/{p.attributes?.storage||'-'}</span>
                      </td>
                      <td style={{fontWeight:600,color:'#475569'}}>
                        {hasImei ? (
                          <code style={{fontSize:'.75rem',color:'#0f172a'}}>{hasImei}</code>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                      <td style={{textAlign:'right',fontWeight:700,color:'#475569'}}>₹{parseFloat(p.purchase_price || p.unit_price || 0).toLocaleString('en-IN')}</td>
                      <td style={{textAlign:'right',fontWeight:700,color:'#16a34a'}}>₹{parseFloat(p.selling_price||0).toLocaleString('en-IN')}</td>
                      <td style={{textAlign:'right',fontWeight:700,color:'#2563eb'}}>₹{parseFloat(p.wholeseller_price||0).toLocaleString('en-IN')}</td>
                      <td style={{fontWeight:600,color:'#475569'}}>
                        📍 {p.location || 'Not Specified'}
                      </td>
                      <td style={{textAlign:'right'}}>
                        <div style={{display:'flex',justifyContent:'flex-end',gap:4}}>
                          <button 
                            onClick={() => {
                              const sUrl = category_group === 'master' 
                                ? `/sales/new-master?product_id=${p.product_id || p.id}&imei=${hasImei || ''}` 
                                : `/sales/new?category_group=${category_group}&product_id=${p.product_id || p.id}&imei=${hasImei || ''}`;
                              window.location.href = sUrl;
                            }} 
                            className="pm-act-btn"
                            style={{background:'#22c55e',borderColor:'#22c55e',color:'#fff',fontWeight:800}}
                          >
                            🟢 Sell
                          </button>
                          <button 
                            onClick={() => {
                              setViewingStock(p);
                              setShowViewStockModal(true);
                            }} 
                            className="pm-act-btn"
                          >
                            👁️ View
                          </button>
                          {isOwner() && (
                            <>
                              <button 
                                onClick={() => {
                                  setEditingStock({
                                    id: p.id,
                                    name: p.name,
                                    brand: p.brand?.name || p.attributes?.brand || '',
                                    category: p.category?.name || p.category?.slug || '',
                                    color: p.attributes?.color || '',
                                    ram: p.attributes?.ram || '',
                                    storage: p.attributes?.storage || '',
                                    imei: hasImei || '',
                                    purchase_price: p.purchase_price || p.unit_price || 0,
                                    unit_price: p.purchase_price || p.unit_price || 0,
                                    selling_price: p.selling_price || 0,
                                    wholeseller_price: p.wholeseller_price || 0,
                                    min_selling_price: p.min_selling_price || 0,
                                    incentive_amount: p.incentive_amount || 0,
                                    location: p.location || ''
                                  });
                                  setShowEditStockModal(true);
                                }} 
                                className="pm-act-btn"
                                style={{color:'#2563eb',borderColor:'#93c5fd'}}
                              >
                                📝 Edit
                              </button>
                              <button 
                                onClick={() => setConfirmModal({show:true,id:p.id,type:'delete_stock'})} 
                                className="pm-act-btn" 
                                style={{color:'#b91c1c',borderColor:'#fca5a5'}}
                              >
                                ❌ Del
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
            : confirmModal.type==='delete_stock'
              ? 'Are you sure you want to delete this stock item? This will remove the item from inventory and adjust the source purchase invoice.'
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

      {/* Edit Stock Modal */}
      <Modal show={showEditStockModal} onHide={() => { setShowEditStockModal(false); setEditingStock(null); }} centered size="lg">
        <Modal.Header closeButton style={{background:'linear-gradient(135deg, #1e3a8a, #3b82f6)',borderBottom:'none'}}>
          <Modal.Title style={{color:'#fff',fontWeight:700,fontSize:'1rem'}}>📝 Edit Stock Item: {editingStock?.name}</Modal.Title>
        </Modal.Header>
        <form onSubmit={handleEditStockSubmit}>
          <Modal.Body style={{padding:'24px'}}>
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold text-muted">PRODUCT NAME</label>
                <input type="text" className="form-control fw-bold bg-light" value={editingStock?.name || ''} readOnly />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-bold text-muted">BRAND</label>
                <input type="text" className="form-control fw-bold bg-light" value={editingStock?.brand || ''} readOnly />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-bold text-muted">CATEGORY</label>
                <input type="text" className="form-control fw-bold bg-light" value={editingStock?.category || ''} readOnly />
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold text-primary">COLOR</label>
                <input type="text" className="form-control fw-bold" value={editingStock?.color || ''} onChange={e => setEditingStock({...editingStock, color: e.target.value.toUpperCase()})} />
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-bold text-primary">RAM (GB)</label>
                <input type="text" className="form-control fw-bold" value={editingStock?.ram || ''} onChange={e => setEditingStock({...editingStock, ram: e.target.value.toUpperCase()})} />
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-bold text-primary">STORAGE (GB)</label>
                <input type="text" className="form-control fw-bold" value={editingStock?.storage || ''} onChange={e => setEditingStock({...editingStock, storage: e.target.value.toUpperCase()})} />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold text-primary">IMEI / SERIAL NUMBER</label>
                <input type="text" className="form-control fw-bold" value={editingStock?.imei || ''} onChange={e => setEditingStock({...editingStock, imei: e.target.value.toUpperCase()})} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold text-primary">CURRENT LOCATION</label>
                <input type="text" className="form-control fw-bold" value={editingStock?.location || ''} onChange={e => setEditingStock({...editingStock, location: e.target.value.toUpperCase()})} placeholder="E.G. COUNTER 1" />
              </div>

              <div className="col-6 col-md-4">
                <label className="form-label small fw-bold text-primary">PURCHASE PRICE (BASE)</label>
                <input type="number" step="0.01" className="form-control fw-bold" value={editingStock?.unit_price || 0} onChange={e => setEditingStock({...editingStock, unit_price: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-bold text-primary">RETAIL SELLING PRICE</label>
                <input type="number" step="0.01" className="form-control fw-bold" value={editingStock?.selling_price || 0} onChange={e => setEditingStock({...editingStock, selling_price: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label small fw-bold text-primary">WHOLESALE PRICE</label>
                <input type="number" step="0.01" className="form-control fw-bold" value={editingStock?.wholeseller_price || 0} onChange={e => setEditingStock({...editingStock, wholeseller_price: parseFloat(e.target.value) || 0})} />
              </div>

              <div className="col-6 col-md-6">
                <label className="form-label small fw-bold text-primary">MIN SELLING PRICE</label>
                <input type="number" step="0.01" className="form-control fw-bold" value={editingStock?.min_selling_price || 0} onChange={e => setEditingStock({...editingStock, min_selling_price: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="col-6 col-md-6">
                <label className="form-label small fw-bold text-primary">INCENTIVE / COMMISSION</label>
                <input type="number" step="0.01" className="form-control fw-bold" value={editingStock?.incentive_amount || 0} onChange={e => setEditingStock({...editingStock, incentive_amount: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer style={{borderTop:'1px solid #f1f5f9',padding:'12px 20px'}}>
            <Button variant="light" className="fw-bold" onClick={() => { setShowEditStockModal(false); setEditingStock(null); }}>Cancel</Button>
            <Button type="submit" variant="primary" className="fw-bold px-4">Save Changes</Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* View Stock Modal */}
      <Modal show={showViewStockModal} onHide={() => { setShowViewStockModal(false); setViewingStock(null); }} centered>
        <Modal.Header closeButton style={{background:'#1f2937',borderBottom:'none'}}>
          <Modal.Title style={{color:'#fff',fontWeight:700,fontSize:'1rem'}}>👁️ Stock Item Details</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{padding:'24px',fontSize:'.82rem'}}>
          <div className="d-flex flex-column gap-3">
            <div>
              <span className="text-muted fw-bold text-uppercase d-block" style={{fontSize:'.65rem'}}>Product Name</span>
              <span className="fw-bold" style={{fontSize:'1rem',color:'#111827'}}>{viewingStock?.brand?.name || viewingStock?.attributes?.brand} {viewingStock?.name}</span>
            </div>
            
            <div className="row g-2">
              <div className="col-6">
                <span className="text-muted fw-bold text-uppercase d-block" style={{fontSize:'.65rem'}}>Category</span>
                <span className="fw-bold">{viewingStock?.category?.name || viewingStock?.category?.slug || '—'}</span>
              </div>
              <div className="col-6">
                <span className="text-muted fw-bold text-uppercase d-block" style={{fontSize:'.65rem'}}>Location</span>
                <span className="fw-bold text-primary">📍 {viewingStock?.location || 'Not Specified'}</span>
              </div>
            </div>

            <div className="row g-2">
              <div className="col-4">
                <span className="text-muted fw-bold text-uppercase d-block" style={{fontSize:'.65rem'}}>Color</span>
                <span className="fw-bold bg-light px-2 py-1 rounded border d-inline-block mt-1">{viewingStock?.attributes?.color || '—'}</span>
              </div>
              <div className="col-4">
                <span className="text-muted fw-bold text-uppercase d-block" style={{fontSize:'.65rem'}}>RAM</span>
                <span className="fw-bold bg-light px-2 py-1 rounded border d-inline-block mt-1">{viewingStock?.attributes?.ram || '—'}</span>
              </div>
              <div className="col-4">
                <span className="text-muted fw-bold text-uppercase d-block" style={{fontSize:'.65rem'}}>Storage</span>
                <span className="fw-bold bg-light px-2 py-1 rounded border d-inline-block mt-1">{viewingStock?.attributes?.storage || '—'}</span>
              </div>
            </div>

            <div>
              <span className="text-muted fw-bold text-uppercase d-block" style={{fontSize:'.65rem'}}>IMEI / Serial Number</span>
              <code style={{fontSize:'.9rem',color:'#0f172a',fontWeight:700}}>{viewingStock?.attributes?.imei || viewingStock?.imei || '—'}</code>
            </div>

            <hr className="my-1" />

            <div className="row g-2 text-uppercase">
              <div className="col-6">
                <span className="text-muted fw-bold d-block" style={{fontSize:'.65rem'}}>Purchase Price</span>
                <span className="fw-bold text-dark" style={{fontSize:'.95rem'}}>₹{parseFloat(viewingStock?.purchase_price || viewingStock?.unit_price || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="col-6">
                <span className="text-muted fw-bold d-block" style={{fontSize:'.65rem'}}>Retail Selling Price</span>
                <span className="fw-bold text-success" style={{fontSize:'.95rem'}}>₹{parseFloat(viewingStock?.selling_price || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="row g-2 text-uppercase">
              <div className="col-6">
                <span className="text-muted fw-bold d-block" style={{fontSize:'.65rem'}}>Wholesale Price</span>
                <span className="fw-bold text-primary" style={{fontSize:'.95rem'}}>₹{parseFloat(viewingStock?.wholeseller_price || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="col-6">
                <span className="text-muted fw-bold d-block" style={{fontSize:'.65rem'}}>Min Selling Price</span>
                <span className="fw-bold text-danger" style={{fontSize:'.95rem'}}>₹{parseFloat(viewingStock?.min_selling_price || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div>
              <span className="text-muted fw-bold text-uppercase d-block" style={{fontSize:'.65rem'}}>Incentive / Commission</span>
              <span className="fw-bold">₹{parseFloat(viewingStock?.incentive_amount || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer style={{borderTop:'none',padding:'12px 20px'}}>
          <Button variant="secondary" className="fw-bold px-4" onClick={() => { setShowViewStockModal(false); setViewingStock(null); }}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
