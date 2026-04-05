import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Modal, Button, Tabs, Tab } from 'react-bootstrap';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

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
      setPurchases(data);
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
      setAvailableStock(data);
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
      setPendingStock(data);
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

  return (
    <div className="container-fluid py-2">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center">
        <div className="text-uppercase">
           <h2 className="mb-0 fw-bold">📱 NEW MOBILES MANAGER</h2>
           <p className="text-muted small mb-0">MANAGE PURCHASES AND INVENTORY FOR NEW MOBILE PHONES</p>
        </div>
        <Link to="/purchases/new" className="btn btn-primary shadow-sm text-uppercase fw-bold">+ New Purchase</Link>
      </div>

      {/* GLOBAL FILTERS */}
      <div className="card border-0 shadow-sm p-3 mb-4 bg-white rounded-3">
        <div className="row g-2 align-items-end text-uppercase">
          <div className="col-12 col-md-3">
            <label className="small text-muted mb-1 px-1 fw-bold">🔍 SEARCH INVOICE / SUPPLIER / PRODUCT</label>
            <input 
              type="text" 
              className="form-control form-control-sm border-light bg-light text-uppercase"
              placeholder="TYPE TO SEARCH..." 
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value.toUpperCase())}
            />
          </div>
          {activeTab === 'purchases' && (
            <div className="col-6 col-md-2">
              <label className="small text-muted mb-1 px-1 fw-bold">📦 STATUS</label>
              <select 
                className="form-control form-control-sm border-light bg-light text-uppercase"
                value={filters.status}
                onChange={e => handleFilterChange('status', e.target.value)}
              >
                <option value="">ALL STATUS</option>
                <option value="ordered">ORDERED</option>
                <option value="received">RECEIVED</option>
              </select>
            </div>
          )}
          <div className="col-6 col-md-2">
            <label className="small text-muted mb-1 px-1 fw-bold">👩‍💼 SUPPLIER</label>
            <select 
              className="form-control form-control-sm border-light bg-light text-uppercase"
              value={filters.supplier_id}
              onChange={e => handleFilterChange('supplier_id', e.target.value)}
            >
              <option value="">ALL SUPPLIERS</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-1">
            <label className="small text-muted mb-1 px-1 fw-bold">📅 FROM</label>
            <input 
              type="date" 
              className="form-control form-control-sm border-light bg-light"
              value={filters.from}
              onChange={e => handleFilterChange('from', e.target.value)}
            />
          </div>
          <div className="col-6 col-md-1">
            <label className="small text-muted mb-1 px-1 fw-bold">📅 TO</label>
            <input 
              type="date" 
              className="form-control form-control-sm border-light bg-light"
              value={filters.to}
              onChange={e => handleFilterChange('to', e.target.value)}
            />
          </div>
          <div className="col-auto">
             <button className="btn btn-sm btn-light border-0 text-uppercase fw-bold" onClick={clearFilters}>Clear</button>
          </div>
        </div>

        <div className="row g-2 align-items-end mt-2 pt-2 border-top border-light text-uppercase">
           <div className="col-6 col-md-3">
              <label className="small text-muted mb-1 px-1 fw-bold">📱 MODEL/BRAND</label>
              <input 
                type="text" 
                className="form-control form-control-sm border-light bg-light text-uppercase"
                placeholder="E.G. VIVO V70" 
                value={filters.model}
                onChange={e => handleFilterChange('model', e.target.value.toUpperCase())}
              />
           </div>
           <div className="col-6 col-md-2">
              <label className="small text-muted mb-1 px-1 fw-bold">🎨 COLOR</label>
              <input 
                type="text" 
                className="form-control form-control-sm border-light bg-light text-uppercase"
                placeholder="E.G. BLACK" 
                value={filters.color}
                onChange={e => handleFilterChange('color', e.target.value.toUpperCase())}
              />
           </div>
           <div className="col-6 col-md-2">
              <label className="small text-muted mb-1 px-1 fw-bold">🚀 RAM</label>
              <input 
                type="text" 
                className="form-control form-control-sm border-light bg-light text-uppercase"
                placeholder="E.G. 8GB" 
                value={filters.ram}
                onChange={e => handleFilterChange('ram', e.target.value.toUpperCase())}
              />
           </div>
           <div className="col-6 col-md-2">
              <label className="small text-muted mb-1 px-1 fw-bold">💾 STORAGE</label>
              <input 
                type="text" 
                className="form-control form-control-sm border-light bg-light text-uppercase"
                placeholder="E.G. 128GB" 
                value={filters.storage}
                onChange={e => handleFilterChange('storage', e.target.value.toUpperCase())}
              />
           </div>
           <div className="col-6 col-md-2">
              <label className="small text-muted mb-1 px-1 fw-bold">🆔 IMEI NUMBER</label>
              <input 
                list="imeiOptions"
                type="text" 
                className="form-control form-control-sm border-light bg-light text-uppercase"
                placeholder="TYPE OR SELECT IMEI..." 
                value={filters.imei}
                onChange={e => handleFilterChange('imei', e.target.value.toUpperCase())}
              />
              <datalist id="imeiOptions">
                {imeiList.map((imei, idx) => <option key={idx} value={imei} />)}
              </datalist>
           </div>
        </div>
      </div>

      <Tabs 
        activeKey={activeTab} 
        onSelect={(k) => setActiveTab(k)} 
        className="mb-0 custom-tabs border-bottom-0 text-uppercase"
        id="new-mobiles-tabs"
      >
        <Tab eventKey="purchases" title="📋 Purchase History">
          <div className="mt-3">
             <div className="table-card">
              <div className="table-responsive-mobile">
                <table className="table table-hover mb-0 text-uppercase">
                  <thead>
                    <tr className="bg-light">
                      <th style={{width: '120px'}}>Dates</th>
                      <th>Invoice #</th>
                      <th>Supplier</th>
                      <th style={{minWidth: '150px'}}>Products (Qty)</th>
                      <th>Configuration</th>
                      <th>Status</th>
                      <th className="fw-bold">Total</th>
                      <th className="fw-bold">Paid / Bal</th>
                      <th>Notes/Ref</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={10} className="text-center py-4"><div className="spinner-border spinner-border-sm"/></td></tr>
                    ) : (purchases || []).map(p => {
                      const balance = parseFloat(p.grand_total || 0) - parseFloat(p.total_paid || 0);
                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="small text-muted">📅 {formatDate(p.purchase_date)}</div>
                          </td>
                          <td className="fw-semibold">{p.invoice_no}</td>
                          <td>{p.supplier?.name}</td>
                          <td className="small">
                            {p.items?.map((item, idx) => (
                              <div key={idx} className="d-flex flex-column border-bottom border-light pb-1 mb-1">
                                <div className="d-flex justify-content-between">
                                  <span>{item.product?.name}</span>
                                  <span className="badge bg-secondary ms-2">{item.quantity}</span>
                                </div>
                                {p.status === 'received' && (
                                  <div className="d-flex gap-1 mt-1" style={{fontSize: '0.65rem'}}>
                                    <span className="text-success fw-bold">RCV: {item.received_quantity || 0}</span>
                                    {item.damaged_quantity > 0 && (
                                      <span className="text-danger fw-bold">DMG: {item.damaged_quantity}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </td>
                          <td className="small text-muted">
                            {p.items?.map((item, idx) => (
                              <div key={idx} className="mb-1 border-bottom border-light pb-1">
                                {item.ram || '-'}/{item.storage || '-'}/{item.color || '-'}
                                {item.imei && (
                                  <div className="text-primary fw-bold mt-1" style={{fontSize: '0.65rem'}}>
                                    🆔 {item.imei}
                                  </div>
                                )}
                              </div>
                            ))}
                          </td>
                          <td>
                            {p.status === 'ordered' ? (
                              <span className="badge bg-warning text-dark px-2 rounded-pill shadow-xs" style={{fontSize:'0.65rem'}}>ORDERED</span>
                            ) : (
                              <span className="badge bg-success px-2 rounded-pill shadow-xs" style={{fontSize:'0.65rem'}}>RECEIVED</span>
                            )}
                          </td>
                          <td className="fw-bold text-primary" title={`SUBTOTAL: ₹${(p.total_amount || 0).toLocaleString('en-IN')}\nGST: ₹${((parseFloat(p.cgst_amount || 0) + parseFloat(p.sgst_amount || 0))).toLocaleString('en-IN')}`}>
                            ₹{parseFloat(p.grand_total || 0).toLocaleString('en-IN')}
                          </td>
                          <td>
                            <div className="text-success small fw-bold" style={{fontSize:'0.7rem'}}>Paid: ₹{parseFloat(p.total_paid || 0).toLocaleString('en-IN')}</div>
                            <div className={balance > 0 ? "text-danger small fw-bold" : "text-muted small"} style={{fontSize:'0.7rem'}}>
                              Bal: ₹{balance.toLocaleString('en-IN')}
                            </div>
                            <span className={`badge mt-1 ${
                              p.payment_status === 'paid' ? 'bg-success' : 
                              p.payment_status === 'partial' ? 'bg-info text-white' : 'bg-danger-subtle text-danger border'
                            }`} style={{fontSize:'0.6rem'}}>
                              {p.payment_status?.toUpperCase() || 'UNPAID'}
                            </span>
                          </td>
                          <td className="small text-muted truncate" title={p.notes} style={{maxWidth: '120px'}}>
                            {p.notes || '-'}
                          </td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end gap-1">
                                {p.status === 'ordered' && (
                                <button onClick={() => handleMarkReceived(p)} className="btn btn-xs btn-success py-1 px-2 fw-bold" style={{fontSize:'0.72rem'}}>
                                    MARK RECEIVED
                                </button>
                                )}
                                <Link to={`/purchases/${p.id}/edit`} className="btn btn-xs btn-outline-primary py-1 px-2 fw-bold" style={{fontSize:'0.72rem'}}>EDIT</Link>
                                <Link to={`/purchases/${p.id}`} className="btn btn-xs btn-outline-info py-1 px-2 fw-bold" style={{fontSize:'0.72rem'}}>VIEW</Link>
                                <button onClick={() => handleDelete(p.id)} className="btn btn-xs btn-outline-danger py-1 px-2 fw-bold" style={{fontSize:'0.72rem'}}>DELETE</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Tab>
        
        <Tab eventKey="available" title="✅ Stocks Available">
           <div className="mt-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                 <div className="d-inline-flex align-items-center bg-white p-2 px-3 rounded-pill shadow-sm border border-primary-subtle" style={{cursor: 'pointer'}} onClick={() => setGroupStocks(!groupStocks)}>
                    <div className="form-check form-switch p-0 m-0 d-flex align-items-center">
                        <input className="form-check-input ms-0" type="checkbox" id="groupSwitch" style={{cursor: 'pointer', width: '2.5em', height: '1.25em'}} checked={groupStocks} onChange={() => {}} />
                        <label className="form-check-label small fw-bold text-primary ms-2 mb-0" style={{cursor: 'pointer', fontSize:'0.75rem'}}>GROUP BY SAME CONFIGURATION</label>
                    </div>
                 </div>
                 <button className="btn btn-sm btn-outline-primary shadow-sm text-uppercase fw-bold">📊 View Full Report</button>
              </div>
              <div className="table-card">
                <div className="table-responsive-mobile">
                  <table className="table table-hover mb-0 text-uppercase">
                    <thead>
                      <tr className="bg-light">
                        <th>Product Name</th>
                        <th>Configuration</th>
                        <th>Location</th>
                        <th className="text-center">Available Stock</th>
                        <th className="text-end">Price</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingStocks ? (
                        <tr><td colSpan={6} className="text-center py-4"><div className="spinner-border spinner-border-sm"/></td></tr>
                      ) : availableStock.map((p, idx) => (
                        <tr key={p.id || idx}>
                          <td className="fw-semibold text-primary">{p.name}</td>
                          <td>
                            <span className="badge border text-dark bg-white me-1 text-uppercase" style={{borderColor:'#eee'}}>{p.attributes?.color || '-'}</span>
                            <small className="text-muted text-uppercase">{p.attributes?.ram || '-'} / {p.attributes?.storage || '-'}</small>
                            {p.attributes?.imei && (
                               <div className="text-success x-small mt-1" style={{fontSize:'0.7rem'}}>
                                  🆔 IMEI: {p.attributes.imei}
                                </div>
                            )}
                          </td>
                          <td>
                             <button 
                               onClick={() => openLocationModal(p.id, p.location, groupStocks)}
                               className="btn btn-link btn-sm p-0 text-decoration-none text-muted fw-bold"
                             >
                                📍 {p.location || 'SET LOCATION'}
                             </button>
                          </td>
                          <td className="text-center">
                             <span className={`badge ${p.current_stock > 0 ? 'bg-success' : 'bg-danger'} rounded-pill`}>
                               {p.current_stock} pcs
                             </span>
                          </td>
                          <td className="text-end fw-bold text-dark">₹{parseFloat(p.selling_price || 0).toLocaleString('en-IN')}</td>
                          <td className="text-end">
                             <div className="d-flex justify-content-end gap-1">
                                {(isOwner() && !groupStocks) && (
                                  <button 
                                    onClick={() => setConfirmModal({ show: true, id: p.id, type: 'delete_stock' })} 
                                    className="btn btn-xs btn-outline-danger p-1" 
                                    title="Delete Stock Unit"
                                  >
                                    🗑️
                                  </button>
                                )}
                                <button className="btn btn-xs btn-outline-info p-1" title="Stock Report" onClick={() => toast.info("Stock Ledger / History feature coming soon!")}>📄</button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
           </div>
        </Tab>

        <Tab eventKey="pending" title="⏳ Stocks Pending">
           <div className="mt-3">
              <div className="d-flex justify-content-between align-items-center mb-3 text-uppercase">
                 <div className="d-inline-flex align-items-center bg-white p-2 px-3 rounded-pill shadow-sm border border-warning-subtle" style={{cursor: 'pointer'}} onClick={() => setGroupPending(!groupPending)}>
                    <div className="form-check form-switch p-0 m-0 d-flex align-items-center">
                        <input className="form-check-input ms-0" type="checkbox" id="groupPendingSwitch" style={{cursor: 'pointer', width: '2.5em', height: '1.25em'}} checked={groupPending} onChange={() => {}} />
                        <label className="form-check-label small fw-bold text-warning ms-2 mb-0" style={{cursor: 'pointer', fontSize:'0.75rem'}}>GROUP PENDING BY CONFIGURATION</label>
                    </div>
                 </div>
                 <button className="btn btn-sm btn-outline-primary shadow-sm fw-bold">📑 Pending Orders Report</button>
              </div>
              <div className="table-card">
                <div className="table-responsive-mobile">
                  <table className="table table-hover mb-0 text-uppercase">
                    <thead>
                      <tr className="bg-light">
                        <th>Product</th>
                        <th>Configuration</th>
                        <th className="text-center">Qty</th>
                        <th>Supplier</th>
                        <th>Expected Date</th>
                        <th className="text-end">Reports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingStocks ? (
                        <tr><td colSpan={6} className="text-center py-4"><div className="spinner-border spinner-border-sm"/></td></tr>
                      ) : pendingStock.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td className="fw-semibold text-primary">{item.product?.name}</td>
                          <td>
                            <span className="badge border text-dark bg-white me-1 text-uppercase" style={{borderColor:'#eee'}}>{item.color || '-'}</span>
                            <small className="text-muted text-uppercase">{item.ram || '-'}/{item.storage || '-'}</small>
                            {item.imei && (
                               <div className="text-warning x-small mt-1" style={{fontSize:'0.7rem'}}>
                                  🆔 IMEI: {item.imei}
                               </div>
                            )}
                          </td>
                          <td className="text-center fw-bold text-warning">{item.quantity}</td>
                          <td>{item.invoice?.supplier?.name}</td>
                          <td className="small text-muted">{item.invoice?.expected_delivery_date || '-'}</td>
                          <td className="text-end">
                             <button className="btn btn-xs btn-outline-info p-1" title="Order Report">📋</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
           </div>
        </Tab>
      </Tabs>

      {/* Pro Tip */}
      <div className="mt-4 p-3 bg-white rounded-3 shadow-sm border-start border-primary border-4 text-uppercase" style={{fontSize:'0.82rem'}}>
        💡 <strong>PRO TIP:</strong> ORDERS IN <span className="text-warning fw-bold">ORDERED</span> STATUS DO NOT AFFECT INVENTORY. STOCK IS ADDED ONLY WHEN YOU CLICK <span className="text-success fw-bold">"MARK RECEIVED"</span>.
      </div>

      <Modal show={confirmModal.show} onHide={() => setConfirmModal({ show: false, id: null, type: '' })} centered className="text-uppercase">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">Confirm Action</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirmModal.type === 'delete' ? 
            'ARE YOU SURE YOU WANT TO DELETE THIS PURCHASE ORDER? THIS WILL REVERSE ANY STOCK ADDED IF IT WAS ALREADY MARKED AS RECEIVED.' :
            'MARK THIS ORDER AS RECEIVED? THIS WILL ADD THE ITEMS TO YOUR INVENTORY STOCK.'
          }
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setConfirmModal({ show: false, id: null, type: '' })} className="fw-bold">
            CANCEL
          </Button>
          <Button variant={confirmModal.type === 'delete' ? 'danger' : 'success'} onClick={executeAction} className="fw-bold">
            CONFIRM {confirmModal.type === 'delete' ? 'DELETE' : 'RECEIVE'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* RECEIPT MODAL */}
      <Modal show={receiptModal.show} onHide={() => setReceiptModal({ show: false, invoice: null, items: [] })} centered size="lg" className="text-uppercase">
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">📦 RECEIVE PURCHASE: {receiptModal.invoice?.invoice_no}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-3">CHECK ITEMS RECEIVED AND MARK ANY DAMAGES. ONLY "GOOD" ITEMS WILL BE ADDED TO STOCK.</p>
          <div className="table-responsive">
            <table className="table table-sm table-bordered align-middle">
              <thead className="bg-light">
                <tr>
                  <th>PRODUCT</th>
                  <th className="text-center" style={{width:'100px'}}>ORDERED</th>
                  <th className="text-center" style={{width:'120px'}}>RECEIVED</th>
                  <th className="text-center" style={{width:'120px'}}>DAMAGED</th>
                  <th className="text-center" style={{width:'100px'}}>GOOD QTY</th>
                </tr>
              </thead>
              <tbody>
                {receiptModal.items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="small fw-bold">{item.product_name}</td>
                    <td className="text-center">{item.ordered_quantity}</td>
                    <td>
                      <input 
                        type="number" 
                        className="form-control form-control-sm text-center fw-bold"
                        value={item.received_quantity}
                        onChange={(e) => handleReceiptItemChange(idx, 'received_quantity', e.target.value)}
                        min="0"
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        className="form-control form-control-sm text-center fw-bold text-danger"
                        value={item.damaged_quantity}
                        onChange={(e) => handleReceiptItemChange(idx, 'damaged_quantity', e.target.value)}
                        min="0"
                      />
                    </td>
                    <td className="text-center fw-bold text-success">
                      {item.received_quantity - item.damaged_quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setReceiptModal({ show: false, invoice: null, items: [] })} className="fw-bold">
            CANCEL
          </Button>
          <Button variant="success" onClick={handleConfirmReceipt} className="fw-bold">
            CONFIRM RECEIPT & ADD TO STOCK
          </Button>
        </Modal.Footer>
      </Modal>

      {/* LOCATION MODAL */}
      <Modal show={locationModal.show} onHide={() => setLocationModal({ ...locationModal, show: false })} centered className="text-uppercase">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold h5">📍 SET STOCK LOCATION</Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-4">
           <label className="small text-muted mb-2 fw-bold">ENTER PHYSICAL LOCATION (E.G. COUNTER 1, DRAWER A)</label>
           <input 
             type="text" 
             className="form-control fw-bold border-primary shadow-sm"
             placeholder="TYPE LOCATION..."
             autoFocus
             value={locationModal.currentLocation}
             onChange={e => setLocationModal({ ...locationModal, currentLocation: e.target.value.toUpperCase() })}
             onKeyDown={e => e.key === 'Enter' && handleUpdateLocation()}
           />
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <button className="btn btn-light fw-bold" onClick={() => setLocationModal({ ...locationModal, show: false })}>CANCEL</button>
          <button className="btn btn-primary fw-bold px-4" onClick={handleUpdateLocation}>SAVE LOCATION</button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
