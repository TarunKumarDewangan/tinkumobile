import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';

export default function Recharge() {
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('sales');

  // Modals state
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);

  // Form states
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: '',
    operator: 'JIO',
    custom_operator: '',
    amount: '',
    cost_price: '',
    purchase_date: new Date().toISOString().split('T')[0]
  });

  const [saleForm, setSaleForm] = useState({
    mobile_number: '',
    operator: 'JIO',
    custom_operator: '',
    amount: '',
    selling_price: '',
    sale_date: new Date().toISOString().split('T')[0],
    customer_mode: 'existing', // 'existing' or 'new'
    customer_id: '',
    customer_name: '',
    customer_phone: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [resPurchases, resSales, resSuppliers, resCustomers] = await Promise.all([
        api.get('/recharge-purchases'),
        api.get('/recharge-sales'),
        api.get('/suppliers'),
        api.get('/customers')
      ]);
      setPurchases(resPurchases.data);
      setSales(resSales.data);
      setSuppliers(resSuppliers.data);
      setCustomers(resCustomers.data);
    } catch (e) {
      toast.error("Failed to load recharge data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute dynamic operator balances
  const operatorMap = {};
  // Pre-populate standard operators
  ['JIO', 'AIRTEL', 'VI', 'BSNL'].forEach(op => {
    operatorMap[op] = { name: op, purchases: 0, sales: 0, balance: 0 };
  });

  purchases.forEach(p => {
    const op = (p.operator || 'OTHER').trim().toUpperCase();
    if (!operatorMap[op]) {
      operatorMap[op] = { name: op, purchases: 0, sales: 0, balance: 0 };
    }
    operatorMap[op].purchases += parseFloat(p.amount || 0);
  });

  sales.forEach(s => {
    const op = (s.operator || 'OTHER').trim().toUpperCase();
    if (!operatorMap[op]) {
      operatorMap[op] = { name: op, purchases: 0, sales: 0, balance: 0 };
    }
    operatorMap[op].sales += parseFloat(s.amount || 0);
  });

  Object.keys(operatorMap).forEach(op => {
    operatorMap[op].balance = operatorMap[op].purchases - operatorMap[op].sales;
  });

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    if (!purchaseForm.supplier_id) return toast.error("Please select a supplier");
    
    const finalOperator = purchaseForm.operator === 'OTHER' 
      ? purchaseForm.custom_operator.trim().toUpperCase() 
      : purchaseForm.operator;
      
    if (!finalOperator) return toast.error("Please specify the operator");

    try {
      await api.post('/recharge-purchases', {
        supplier_id: purchaseForm.supplier_id,
        operator: finalOperator,
        amount: parseFloat(purchaseForm.amount),
        cost_price: parseFloat(purchaseForm.cost_price),
        purchase_date: purchaseForm.purchase_date
      });
      toast.success("Balance purchase recorded successfully!");
      setShowPurchaseModal(false);
      setPurchaseForm({
        supplier_id: '',
        operator: 'JIO',
        custom_operator: '',
        amount: '',
        cost_price: '',
        purchase_date: new Date().toISOString().split('T')[0]
      });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record purchase");
    }
  };

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    const finalOperator = saleForm.operator === 'OTHER' 
      ? saleForm.custom_operator.trim().toUpperCase() 
      : saleForm.operator;

    if (!finalOperator) return toast.error("Please specify the operator");

    // Live balance check
    const currentBal = operatorMap[finalOperator]?.balance || 0;
    const reqAmount = parseFloat(saleForm.amount || 0);
    
    if (reqAmount > currentBal) {
      const confirmProceed = window.confirm(
        `⚠️ Warning: Insufficient balance for ${finalOperator}.\n` +
        `Available Balance: ₹${currentBal.toLocaleString()}\n` +
        `Recharge Amount: ₹${reqAmount.toLocaleString()}\n\n` +
        `Do you want to proceed with this entry anyway?`
      );
      if (!confirmProceed) return;
    }

    const payload = {
      mobile_number: saleForm.mobile_number,
      operator: finalOperator,
      amount: reqAmount,
      selling_price: parseFloat(saleForm.selling_price || saleForm.amount),
      sale_date: saleForm.sale_date
    };

    if (saleForm.customer_mode === 'existing') {
      if (!saleForm.customer_id) return toast.error("Please select a customer");
      payload.customer_id = saleForm.customer_id;
    } else {
      if (!saleForm.customer_phone) return toast.error("Customer phone number is required");
      payload.customer_name = saleForm.customer_name || 'Walk-in Customer';
      payload.customer_phone = saleForm.customer_phone;
    }

    try {
      await api.post('/recharge-sales', payload);
      toast.success("Recharge sale recorded successfully!");
      setShowSaleModal(false);
      setSaleForm({
        mobile_number: '',
        operator: 'JIO',
        custom_operator: '',
        amount: '',
        selling_price: '',
        sale_date: new Date().toISOString().split('T')[0],
        customer_mode: 'existing',
        customer_id: '',
        customer_name: '',
        customer_phone: ''
      });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record recharge sale");
    }
  };

  const selectedSaleOperator = saleForm.operator === 'OTHER' 
    ? saleForm.custom_operator.trim().toUpperCase() 
    : saleForm.operator;
  const currentSaleOpBalance = operatorMap[selectedSaleOperator]?.balance || 0;

  return (
    <div className="container-fluid py-4 animate-fadeIn">
      {/* Page Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="h4 mb-0 text-uppercase fw-bold text-dark">⚡ Recharge Management</h2>
          <p className="text-muted small mb-0">Manage LAPU balance stocks and customer recharges</p>
        </div>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-dark btn-sm rounded-2 px-3 fw-bold"
            onClick={() => setShowPurchaseModal(true)}
          >
            ➕ Add Balance
          </button>
          <button 
            className="btn btn-dark btn-sm rounded-2 px-3 fw-bold"
            onClick={() => setShowSaleModal(true)}
          >
            ⚡ New Recharge
          </button>
        </div>
      </div>

      {/* Operator Balances Row */}
      <h6 className="fw-bold text-muted text-uppercase x-small mb-3">Operator Wallets (LAPU Balance)</h6>
      <div className="row g-3 mb-4">
        {Object.values(operatorMap).map(op => (
          <div key={op.name} className="col-md-2 col-6">
            <div className="card border border-secondary border-opacity-25 bg-white p-3 shadow-none rounded-2">
              <div className="small text-uppercase fw-bold text-muted opacity-75 mb-1">{op.name}</div>
              <div className={`h5 mb-0 fw-bold ${op.balance <= 100 ? 'text-danger' : 'text-dark'}`}>
                ₹{op.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <ul className="nav nav-tabs mb-3 no-print">
        <li className="nav-item">
          <button className={`nav-link fw-bold ${tab === 'sales' ? 'active' : ''}`} onClick={() => setTab('sales')}>
            Sales History
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link fw-bold ${tab === 'purchases' ? 'active' : ''}`} onClick={() => setTab('purchases')}>
            Purchase History
          </button>
        </li>
      </ul>

      {/* History Listing */}
      <div className="card border border-secondary border-opacity-25 rounded-2 shadow-none overflow-hidden bg-white">
        <div className="table-responsive">
          <table className="table custom-tally-table mb-0">
            <thead>
              {tab === 'sales' ? (
                <tr>
                  <th className="ps-3" style={{ width: '130px' }}>Date</th>
                  <th>Customer</th>
                  <th>Mobile Number</th>
                  <th>Operator</th>
                  <th className="text-end">Recharge Amt</th>
                  <th className="text-end pe-3">Charged Amt</th>
                </tr>
              ) : (
                <tr>
                  <th className="ps-3" style={{ width: '130px' }}>Date</th>
                  <th>Supplier</th>
                  <th>Operator</th>
                  <th className="text-end">Credit Amt</th>
                  <th className="text-end">Cost Paid</th>
                  <th className="text-end pe-3">Margin (Profit)</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-5 border-0">
                    <div className="spinner-border text-secondary" />
                  </td>
                </tr>
              ) : tab === 'sales' && sales.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5 text-muted border-0">
                    No recharge sales recorded.
                  </td>
                </tr>
              ) : tab === 'purchases' && purchases.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5 text-muted border-0">
                    No balance purchases recorded.
                  </td>
                </tr>
              ) : tab === 'sales' ? (
                sales.map(s => (
                  <tr key={s.id} className="tally-row">
                    <td className="ps-3 text-muted small">{formatDate(s.sale_date)}</td>
                    <td className="fw-bold">{s.customer?.name || 'Walk-in Customer'}</td>
                    <td>{s.mobile_number}</td>
                    <td><span className="badge bg-light text-dark border border-secondary border-opacity-25">{s.operator}</span></td>
                    <td className="text-end fw-bold">₹{parseFloat(s.amount).toLocaleString()}</td>
                    <td className="text-end pe-3 fw-bold">₹{parseFloat(s.selling_price).toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                purchases.map(p => {
                  const profit = parseFloat(p.amount) - parseFloat(p.cost_price);
                  return (
                    <tr key={p.id} className="tally-row">
                      <td className="ps-3 text-muted small">{formatDate(p.purchase_date)}</td>
                      <td className="fw-bold">{p.supplier?.name}</td>
                      <td><span className="badge bg-light text-dark border border-secondary border-opacity-25">{p.operator}</span></td>
                      <td className="text-end fw-bold">₹{parseFloat(p.amount).toLocaleString()}</td>
                      <td className="text-end fw-bold">₹{parseFloat(p.cost_price).toLocaleString()}</td>
                      <td className="text-end pe-3 fw-bold text-success">₹{profit.toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD BALANCE MODAL */}
      {showPurchaseModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom p-3">
                <h5 className="modal-title fw-bold text-dark mb-0">➕ Add Balance (LAPU Purchase)</h5>
                <button type="button" className="btn-close shadow-none" onClick={() => setShowPurchaseModal(false)}></button>
              </div>
              <form onSubmit={handlePurchaseSubmit}>
                <div className="modal-body p-3">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label x-small fw-bold text-dark">Supplier <span className="text-danger">*</span></label>
                      <select 
                        className="form-select" 
                        required
                        value={purchaseForm.supplier_id}
                        onChange={e => setPurchaseForm({...purchaseForm, supplier_id: e.target.value})}
                      >
                        <option value="">-- Choose Supplier --</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Operator <span className="text-danger">*</span></label>
                      <select 
                        className="form-select"
                        value={purchaseForm.operator}
                        onChange={e => setPurchaseForm({...purchaseForm, operator: e.target.value})}
                      >
                        <option value="JIO">JIO</option>
                        <option value="AIRTEL">AIRTEL</option>
                        <option value="VI">VI</option>
                        <option value="BSNL">BSNL</option>
                        <option value="OTHER">OTHER OPERATOR</option>
                      </select>
                    </div>

                    {purchaseForm.operator === 'OTHER' && (
                      <div className="col-md-6">
                        <label className="form-label x-small fw-bold text-dark">Custom Operator Name <span className="text-danger">*</span></label>
                        <input 
                          type="text" 
                          className="form-control"
                          required
                          placeholder="E.g. MTNL"
                          value={purchaseForm.custom_operator}
                          onChange={e => setPurchaseForm({...purchaseForm, custom_operator: e.target.value.toUpperCase()})}
                        />
                      </div>
                    )}

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Credit Amount (₹) <span className="text-danger">*</span></label>
                      <input 
                        type="number" 
                        step="0.01" 
                        className="form-control" 
                        required
                        placeholder="E.g. 5000"
                        value={purchaseForm.amount}
                        onChange={e => setPurchaseForm({...purchaseForm, amount: e.target.value})}
                      />
                      <div className="form-text xx-small">Actual recharge balance added to wallet</div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Cost Price Paid (₹) <span className="text-danger">*</span></label>
                      <input 
                        type="number" 
                        step="0.01" 
                        className="form-control" 
                        required
                        placeholder="E.g. 4850"
                        value={purchaseForm.cost_price}
                        onChange={e => setPurchaseForm({...purchaseForm, cost_price: e.target.value})}
                      />
                      <div className="form-text xx-small">Amount paid to the distributor</div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Purchase Date</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        required
                        value={purchaseForm.purchase_date}
                        onChange={e => setPurchaseForm({...purchaseForm, purchase_date: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top p-2 bg-light justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-2 px-3 fw-bold" onClick={() => setShowPurchaseModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-dark btn-sm rounded-2 px-4 fw-bold">Record Balance</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MAKE RECHARGE MODAL */}
      {showSaleModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom p-3">
                <h5 className="modal-title fw-bold text-dark mb-0">⚡ Make Recharge (Sale)</h5>
                <button type="button" className="btn-close shadow-none" onClick={() => setShowSaleModal(false)}></button>
              </div>
              <form onSubmit={handleSaleSubmit}>
                <div className="modal-body p-3">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Mobile Number <span className="text-danger">*</span></label>
                      <input 
                        type="tel" 
                        maxLength="10"
                        className="form-control fw-bold fs-5" 
                        required
                        placeholder="10 digit number"
                        value={saleForm.mobile_number}
                        onChange={e => setSaleForm({...saleForm, mobile_number: e.target.value.replace(/\D/g, '')})}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Operator <span className="text-danger">*</span></label>
                      <select 
                        className="form-select"
                        value={saleForm.operator}
                        onChange={e => setSaleForm({...saleForm, operator: e.target.value})}
                      >
                        <option value="JIO">JIO</option>
                        <option value="AIRTEL">AIRTEL</option>
                        <option value="VI">VI</option>
                        <option value="BSNL">BSNL</option>
                        <option value="OTHER">OTHER OPERATOR</option>
                      </select>
                      <div className="mt-1 xx-small fw-bold">
                        Available Balance: <span className={currentSaleOpBalance <= 100 ? 'text-danger' : 'text-success'}>₹{currentSaleOpBalance.toLocaleString()}</span>
                      </div>
                    </div>

                    {saleForm.operator === 'OTHER' && (
                      <div className="col-12">
                        <label className="form-label x-small fw-bold text-dark">Custom Operator Name <span className="text-danger">*</span></label>
                        <input 
                          type="text" 
                          className="form-control"
                          required
                          placeholder="E.g. MTNL"
                          value={saleForm.custom_operator}
                          onChange={e => setSaleForm({...saleForm, custom_operator: e.target.value.toUpperCase()})}
                        />
                      </div>
                    )}

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Recharge Amount (₹) <span className="text-danger">*</span></label>
                      <input 
                        type="number" 
                        className="form-control fw-bold" 
                        required
                        placeholder="E.g. 299"
                        value={saleForm.amount}
                        onChange={e => {
                          const val = e.target.value;
                          setSaleForm({
                            ...saleForm, 
                            amount: val, 
                            selling_price: saleForm.selling_price === '' || saleForm.selling_price === saleForm.amount ? val : saleForm.selling_price
                          });
                        }}
                      />
                      {parseFloat(saleForm.amount || 0) > currentSaleOpBalance && (
                        <div className="text-danger xx-small mt-1 fw-bold">⚠️ Amount exceeds operator balance!</div>
                      )}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Selling Price (₹) <span className="text-danger">*</span></label>
                      <input 
                        type="number" 
                        className="form-control fw-bold" 
                        required
                        placeholder="E.g. 299"
                        value={saleForm.selling_price}
                        onChange={e => setSaleForm({...saleForm, selling_price: e.target.value})}
                      />
                      <div className="form-text xx-small">Price charged to customer</div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Sale Date</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        required
                        value={saleForm.sale_date}
                        onChange={e => setSaleForm({...saleForm, sale_date: e.target.value})}
                      />
                    </div>

                    <div className="col-12 border-top pt-3">
                      <label className="form-label x-small fw-bold text-dark d-block">CUSTOMER OPTION</label>
                      <div className="d-flex gap-3 mb-3">
                        <label className="form-check-label x-small cursor-pointer">
                          <input 
                            type="radio" 
                            name="cust_mode" 
                            className="form-check-input me-1"
                            checked={saleForm.customer_mode === 'existing'}
                            onChange={() => setSaleForm({...saleForm, customer_mode: 'existing'})}
                          />
                          Existing Customer
                        </label>
                        <label className="form-check-label x-small cursor-pointer">
                          <input 
                            type="radio" 
                            name="cust_mode" 
                            className="form-check-input me-1"
                            checked={saleForm.customer_mode === 'new'}
                            onChange={() => setSaleForm({...saleForm, customer_mode: 'new'})}
                          />
                          Quick Add / Walk-In
                        </label>
                      </div>

                      {saleForm.customer_mode === 'existing' ? (
                        <div>
                          <label className="form-label xx-small fw-bold text-muted">Select Customer <span className="text-danger">*</span></label>
                          <select 
                            className="form-select"
                            value={saleForm.customer_id}
                            onChange={e => setSaleForm({...saleForm, customer_id: e.target.value})}
                          >
                            <option value="">-- Choose Customer --</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                          </select>
                        </div>
                      ) : (
                        <div className="row g-2">
                          <div className="col-6">
                            <label className="form-label xx-small fw-bold text-muted">Customer Name</label>
                            <input 
                              type="text" 
                              className="form-control form-control-sm"
                              placeholder="Name"
                              value={saleForm.customer_name}
                              onChange={e => setSaleForm({...saleForm, customer_name: e.target.value})}
                            />
                          </div>
                          <div className="col-6">
                            <label className="form-label xx-small fw-bold text-muted">Customer Phone <span className="text-danger">*</span></label>
                            <input 
                              type="tel" 
                              className="form-control form-control-sm"
                              placeholder="Phone"
                              value={saleForm.customer_phone}
                              onChange={e => setSaleForm({...saleForm, customer_phone: e.target.value.replace(/\D/g, '')})}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top p-2 bg-light justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-2 px-3 fw-bold" onClick={() => setShowSaleModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-dark btn-sm rounded-2 px-4 fw-bold">Record Recharge</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-tally-table {
            width: 100%;
            border-collapse: collapse !important;
        }
        .custom-tally-table thead th {
            background: #f8fafc;
            color: #475569;
            font-size: 0.75rem;
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
        .custom-tally-table tbody tr:last-child td {
            border-bottom: none !important;
        }
        .custom-tally-table tbody tr.tally-row:hover {
            background-color: #f1f5f9;
        }
        .cursor-pointer { cursor: pointer; }
        .x-small { font-size: 0.75rem; }
        .xx-small { font-size: 0.65rem; }
      `}</style>
    </div>
  );
}
