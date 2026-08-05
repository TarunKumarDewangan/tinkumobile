import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import pinGate from '../utils/pinGate';
import { Modal, Button } from 'react-bootstrap';
import Select from 'react-select';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';
import PaymentSplitInput from '../components/PaymentSplitInput';
import { newSingleLine, buildPaymentPayload, paymentLinesSumMatches, buildModeOptions } from '../utils/paymentSplit';
import { isAssetEntityType } from '../utils/assetEntityTypes';

export default function Recharge() {
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [bankEntities, setBankEntities] = useState([]);
  const [purchasePaymentLines, setPurchasePaymentLines] = useState(newSingleLine('CASH'));
  const [salePaymentLines, setSalePaymentLines] = useState(newSingleLine('CASH'));
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('sales');

  // Modals state
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [entitySubmitting, setEntitySubmitting] = useState(false);

  // SIM Stock (bulk count ledger by operator/distributor)
  const [simStockSummary, setSimStockSummary] = useState([]);
  const [showSimStockModal, setShowSimStockModal] = useState(false);
  const [showSimSellModal, setShowSimSellModal] = useState(false);
  const [simStockForm, setSimStockForm] = useState({
    distributor_id: '', operator: 'JIO', custom_operator: '',
    quantity: '', price_per_sim: 10, remarks: '',
    entry_date: new Date().toISOString().split('T')[0]
  });
  const [simSellForm, setSimSellForm] = useState({
    operator: 'JIO', custom_operator: '', quantity: '', remarks: '',
    entry_date: new Date().toISOString().split('T')[0]
  });

  // Form states
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: '',
    operator: 'JIO',
    custom_operator: '',
    amount: '',
    cost_price: '',
    purchase_date: new Date().toISOString().split('T')[0]
  });

  const rechargeModeOptions = useMemo(() => buildModeOptions(
    [{ value: 'CASH', label: 'CASH' }, { value: 'PHONEPE', label: 'PHONEPE' }, { value: 'GPAY', label: 'GPAY' }, { value: 'BANK / NEFT', label: 'BANK / NEFT' }],
    bankEntities
  ).concat([{ value: 'OTHER', label: 'OTHER' }]), [bankEntities]);

  const distributorOptions = useMemo(() => {
    return distributors.map(d => ({ value: `entity-${d.id}`, label: d.name }));
  }, [distributors]);

  const selectedDistributorOption = useMemo(() => {
    if (!purchaseForm.supplier_id) return null;
    return distributorOptions.find(opt => opt.value === purchaseForm.supplier_id) || null;
  }, [purchaseForm.supplier_id, distributorOptions]);

  const [newEntity, setNewEntity] = useState({
    name: '',
    type: 'DISTRIBUTOR',
    phone: '',
    address: '',
    email: '',
    gst_number: '',
    opening_balance: 0,
    balance_type: 'PAYABLE',
    description: '',
    voucher_code: '',
    events: []
  });

  const [customTypes, setCustomTypes] = useState([]);

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
      const [resPurchases, resSales, resDistributors, resCustomers, resEntities] = await Promise.all([
        api.get('/recharge-purchases'),
        api.get('/recharge-sales'),
        api.get('/entities', { params: { type: 'DISTRIBUTOR' } }),
        api.get('/customers'),
        api.get('/entities')
      ]);
      setPurchases(resPurchases.data);
      setSales(resSales.data);
      setDistributors(resDistributors.data);
      setCustomers(resCustomers.data);
      setBankEntities((resEntities.data || []).filter(e => isAssetEntityType(e.type)));
    } catch (e) {
      toast.error("Failed to load recharge data");
    } finally {
      setLoading(false);
    }
  };

  const loadSimStock = async () => {
    try {
      const res = await api.get('/sim-stock/summary');
      setSimStockSummary(res.data);
    } catch (e) {
      toast.error('Failed to load SIM stock');
    }
  };

  useEffect(() => {
    loadData();
    loadSimStock();
  }, []);

  const handleAddSimStock = async (e) => {
    e.preventDefault();
    const operator = simStockForm.operator === 'OTHER' ? simStockForm.custom_operator.trim().toUpperCase() : simStockForm.operator;
    if (!operator) return toast.error('Enter an operator name');
    try {
      await api.post('/sim-stock', {
        distributor_id: simStockForm.distributor_id || null,
        operator,
        quantity: simStockForm.quantity,
        price_per_sim: simStockForm.price_per_sim,
        remarks: simStockForm.remarks,
        entry_date: simStockForm.entry_date,
      });
      toast.success('SIM stock added');
      setShowSimStockModal(false);
      setSimStockForm({ distributor_id: '', operator: 'JIO', custom_operator: '', quantity: '', price_per_sim: 10, remarks: '', entry_date: new Date().toISOString().split('T')[0] });
      loadSimStock();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add SIM stock');
    }
  };

  const handleSellSimStock = async (e) => {
    e.preventDefault();
    const operator = simSellForm.operator === 'OTHER' ? simSellForm.custom_operator.trim().toUpperCase() : simSellForm.operator;
    if (!operator) return toast.error('Enter an operator name');
    try {
      await api.post('/sim-stock/sell', {
        operator,
        quantity: simSellForm.quantity,
        remarks: simSellForm.remarks,
        entry_date: simSellForm.entry_date,
      });
      toast.success('SIM stock reduced');
      setShowSimSellModal(false);
      setSimSellForm({ operator: 'JIO', custom_operator: '', quantity: '', remarks: '', entry_date: new Date().toISOString().split('T')[0] });
      loadSimStock();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record SIM sale');
    }
  };

  const simStockTotal = simStockSummary.reduce((sum, s) => sum + s.available, 0);

  const hasDistributors = distributors.length > 0;

  // Depends on hasDistributors (a boolean), not the distributors array itself —
  // the array gets a new reference every time one is added (see
  // handleQuickEntityAdd below), which previously re-triggered this whole
  // custom-types fetch as a side effect of adding a single distributor.
  useEffect(() => {
    if (hasDistributors) {
      api.get('/entities').then(res => {
        const types = (res.data || []).map(e => e.type).filter(Boolean);
        const uniqueCustomTypes = Array.from(new Set(types)).filter(
          t => !['CUSTOMER', 'SHOP_CUSTOMER', 'SHOP', 'SUPPLIER', 'DISTRIBUTOR', 'BANK', 'CARD', 'UPI', 'OTHER'].includes(t)
        );
        setCustomTypes(uniqueCustomTypes);
      }).catch(() => {});
    }
  }, [hasDistributors]);

  const handleQuickEntityAdd = async (e) => {
    e.preventDefault();
    if (entitySubmitting) return;
    setEntitySubmitting(true);
    try {
      const { data } = await api.post('/entities', newEntity);
      toast.success('✅ Distributor added successfully!');
      setDistributors(prev => [...prev, data]);
      setPurchaseForm(prev => ({ ...prev, supplier_id: `entity-${data.id}` }));
      setShowEntityModal(false);
      setNewEntity({
        name: '',
        type: 'DISTRIBUTOR',
        phone: '',
        address: '',
        email: '',
        gst_number: '',
        opening_balance: 0,
        balance_type: 'PAYABLE',
        description: '',
        voucher_code: '',
        events: []
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create entity');
    } finally {
      setEntitySubmitting(false);
    }
  };

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
    if (!purchaseForm.supplier_id) return toast.error("Please select a distributor");
    
    const finalOperator = purchaseForm.operator === 'OTHER' 
      ? purchaseForm.custom_operator.trim().toUpperCase() 
      : purchaseForm.operator;
      
    if (!finalOperator) return toast.error("Please specify the operator");

    if (!paymentLinesSumMatches(purchasePaymentLines, purchaseForm.cost_price)) {
      return toast.error("Split doesn't add up to the cost price");
    }

    try {
      await api.post('/recharge-purchases', {
        supplier_id: purchaseForm.supplier_id,
        operator: finalOperator,
        amount: parseFloat(purchaseForm.amount) || 0,
        cost_price: parseFloat(purchaseForm.cost_price) || 0,
        purchase_date: purchaseForm.purchase_date,
        ...buildPaymentPayload(purchasePaymentLines)
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
      setPurchasePaymentLines(newSingleLine('CASH'));
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
      if (!await pinGate.confirm()) return;
    }

    if (!paymentLinesSumMatches(salePaymentLines, saleForm.selling_price || saleForm.amount)) {
      return toast.error("Split doesn't add up to the selling price");
    }

    const payload = {
      mobile_number: saleForm.mobile_number,
      operator: finalOperator,
      amount: reqAmount,
      selling_price: parseFloat(saleForm.selling_price || saleForm.amount),
      sale_date: saleForm.sale_date,
      ...buildPaymentPayload(salePaymentLines)
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
      setSalePaymentLines(newSingleLine('CASH'));
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record recharge sale");
    }
  };

  const selectedSaleOperator = saleForm.operator === 'OTHER' 
    ? saleForm.custom_operator.trim().toUpperCase() 
    : saleForm.operator;
  const currentSaleOpBalance = operatorMap[selectedSaleOperator]?.balance || 0;

  const isDefaultType = ['CUSTOMER', 'SHOP_CUSTOMER', 'SHOP', 'SUPPLIER', 'DISTRIBUTOR', 'BANK', 'CARD', 'UPI'].includes(newEntity.type);
  const isCustomType = customTypes.includes(newEntity.type);
  const showCustomInput = newEntity.type === 'OTHER' || (!isDefaultType && !isCustomType && newEntity.type !== '');

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

      {/* SIM Stock Row */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold text-muted text-uppercase x-small mb-0">📱 SIM Stocks {simStockTotal > 0 && `(${simStockTotal} total)`}</h6>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-danger btn-sm rounded-2 px-3 fw-bold" onClick={() => setShowSimSellModal(true)}>
            − Sell SIM
          </button>
          <button className="btn btn-outline-dark btn-sm rounded-2 px-3 fw-bold" onClick={() => setShowSimStockModal(true)}>
            ➕ Add New Stock (New Arrival)
          </button>
        </div>
      </div>
      <div className="row g-3 mb-4">
        {simStockSummary.length === 0 ? (
          <div className="col-12">
            <div className="card border border-secondary border-opacity-25 bg-white p-3 shadow-none rounded-2 text-muted small text-center">
              No SIM stock recorded yet. Click "Add New Stock" to log a new arrival.
            </div>
          </div>
        ) : (
          simStockSummary.map(s => (
            <div key={s.operator} className="col-md-2 col-6">
              <div className="card border border-secondary border-opacity-25 bg-white p-3 shadow-none rounded-2">
                <div className="small text-uppercase fw-bold text-muted opacity-75 mb-1">{s.operator}</div>
                <div className={`h5 mb-0 fw-bold ${s.available <= 5 ? 'text-danger' : 'text-dark'}`}>
                  {s.available} <span className="x-small text-muted">sims</span>
                </div>
                <div className="x-small text-muted">₹{(s.available * 10).toLocaleString('en-IN')} value</div>
              </div>
            </div>
          ))
        )}
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
                  <th>Distributor</th>
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
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="form-label x-small fw-bold text-dark mb-0">Distributor <span className="text-danger">*</span></label>
                        <button 
                          type="button" 
                          className="btn btn-link p-0 text-decoration-none x-small fw-bold" 
                          onClick={() => setShowEntityModal(true)}
                        >
                          ➕ Add Distributor
                        </button>
                      </div>
                      <Select
                        options={distributorOptions}
                        value={selectedDistributorOption}
                        onChange={opt => setPurchaseForm({...purchaseForm, supplier_id: opt ? opt.value : ''})}
                        placeholder="-- Choose Distributor --"
                        isSearchable
                        isClearable
                        styles={{
                          control: (base) => ({
                            ...base,
                            minHeight: '38px',
                            fontSize: '0.85rem',
                            borderColor: '#cbd5e1',
                            borderRadius: '0.375rem',
                            boxShadow: 'none',
                            '&:hover': {
                              borderColor: '#cbd5e1'
                            }
                          }),
                          menu: (base) => ({ ...base, fontSize: '0.85rem', zIndex: 1100 }),
                        }}
                      />
                    </div>

                    <div className="col-12 col-md-6">
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
                      <div className="col-12 col-md-6">
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

                    <div className="col-12 col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Credit Amount (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        placeholder="E.g. 5000"
                        value={purchaseForm.amount}
                        onChange={e => setPurchaseForm({...purchaseForm, amount: e.target.value})}
                      />
                      <div className="form-text xx-small">Actual recharge balance added to wallet</div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Cost Price Paid (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        placeholder="E.g. 4850"
                        value={purchaseForm.cost_price}
                        onChange={e => setPurchaseForm({...purchaseForm, cost_price: e.target.value})}
                      />
                      <div className="form-text xx-small">Amount paid to the distributor</div>
                    </div>

                    {parseFloat(purchaseForm.cost_price) > 0 && (
                      <div className="col-12">
                        <label className="form-label x-small fw-bold text-dark">Payment Mode</label>
                        <PaymentSplitInput
                          totalAmount={purchaseForm.cost_price}
                          lines={purchasePaymentLines}
                          onChange={setPurchasePaymentLines}
                          modeOptions={rechargeModeOptions}
                          size="x-small"
                        />
                      </div>
                    )}

                    <div className="col-12 col-md-6">
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
                    <div className="col-12 col-md-6">
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

                    <div className="col-12 col-md-6">
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

                    <div className="col-12 col-md-6">
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

                    <div className="col-12 col-md-6">
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

                    {parseFloat(saleForm.selling_price || saleForm.amount) > 0 && (
                      <div className="col-12">
                        <label className="form-label x-small fw-bold text-dark">Payment Mode</label>
                        <PaymentSplitInput
                          totalAmount={saleForm.selling_price || saleForm.amount}
                          lines={salePaymentLines}
                          onChange={setSalePaymentLines}
                          modeOptions={rechargeModeOptions}
                          size="x-small"
                        />
                      </div>
                    )}

                    <div className="col-12 col-md-6">
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

      {/* ADD SIM STOCK MODAL (New Arrival) */}
      {showSimStockModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom p-3">
                <h5 className="modal-title fw-bold text-dark mb-0">➕ Add New SIM Stock (New Arrival)</h5>
                <button type="button" className="btn-close shadow-none" onClick={() => setShowSimStockModal(false)}></button>
              </div>
              <form onSubmit={handleAddSimStock}>
                <div className="modal-body p-3">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label x-small fw-bold text-dark">Distributor (if any)</label>
                      <Select
                        options={distributorOptions}
                        value={distributorOptions.find(opt => opt.value === simStockForm.distributor_id) || null}
                        onChange={opt => setSimStockForm({...simStockForm, distributor_id: opt ? opt.value : ''})}
                        placeholder="-- Optional --"
                        isSearchable
                        isClearable
                        styles={{
                          control: (base) => ({ ...base, minHeight: '38px', fontSize: '0.85rem', borderColor: '#cbd5e1', borderRadius: '0.375rem', boxShadow: 'none' }),
                          menu: (base) => ({ ...base, fontSize: '0.85rem', zIndex: 1100 }),
                        }}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Operator <span className="text-danger">*</span></label>
                      <select className="form-select" value={simStockForm.operator} onChange={e => setSimStockForm({...simStockForm, operator: e.target.value})}>
                        <option value="JIO">JIO</option>
                        <option value="AIRTEL">AIRTEL</option>
                        <option value="VI">VI</option>
                        <option value="BSNL">BSNL</option>
                        <option value="OTHER">OTHER OPERATOR</option>
                      </select>
                    </div>
                    {simStockForm.operator === 'OTHER' && (
                      <div className="col-12 col-md-6">
                        <label className="form-label x-small fw-bold text-dark">Operator Name <span className="text-danger">*</span></label>
                        <input type="text" className="form-control text-uppercase" value={simStockForm.custom_operator} onChange={e => setSimStockForm({...simStockForm, custom_operator: e.target.value})} />
                      </div>
                    )}
                    <div className="col-12 col-md-6">
                      <label className="form-label x-small fw-bold text-dark">SIM Count <span className="text-danger">*</span></label>
                      <input type="number" min="1" required className="form-control" value={simStockForm.quantity} onChange={e => setSimStockForm({...simStockForm, quantity: e.target.value})} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Price / SIM</label>
                      <div className="input-group">
                        <span className="input-group-text">₹</span>
                        <input type="number" min="0" step="0.01" className="form-control" value={simStockForm.price_per_sim} onChange={e => setSimStockForm({...simStockForm, price_per_sim: e.target.value})} />
                      </div>
                    </div>
                    <div className="col-12">
                      <label className="form-label x-small fw-bold text-dark">Total Value</label>
                      <div className="form-control bg-light fw-bold text-success">
                        ₹{((parseFloat(simStockForm.quantity) || 0) * (parseFloat(simStockForm.price_per_sim) || 0)).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Entry Date <span className="text-danger">*</span></label>
                      <input type="date" required className="form-control" value={simStockForm.entry_date} onChange={e => setSimStockForm({...simStockForm, entry_date: e.target.value})} />
                    </div>
                    <div className="col-12">
                      <label className="form-label x-small fw-bold text-dark">Remarks</label>
                      <textarea rows="2" className="form-control text-uppercase" value={simStockForm.remarks} onChange={e => setSimStockForm({...simStockForm, remarks: e.target.value.toUpperCase()})} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top p-2 bg-light justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-2 px-3 fw-bold" onClick={() => setShowSimStockModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-dark btn-sm rounded-2 px-4 fw-bold">Save Stock Entry</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SELL SIM MODAL */}
      {showSimSellModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-3">
              <div className="modal-header border-bottom p-3">
                <h5 className="modal-title fw-bold text-dark mb-0">− Sell SIM (Reduce Stock)</h5>
                <button type="button" className="btn-close shadow-none" onClick={() => setShowSimSellModal(false)}></button>
              </div>
              <form onSubmit={handleSellSimStock}>
                <div className="modal-body p-3">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Operator <span className="text-danger">*</span></label>
                      <select className="form-select" value={simSellForm.operator} onChange={e => setSimSellForm({...simSellForm, operator: e.target.value})}>
                        <option value="JIO">JIO</option>
                        <option value="AIRTEL">AIRTEL</option>
                        <option value="VI">VI</option>
                        <option value="BSNL">BSNL</option>
                        <option value="OTHER">OTHER OPERATOR</option>
                      </select>
                      {(() => {
                        const op = simSellForm.operator === 'OTHER' ? simSellForm.custom_operator.trim().toUpperCase() : simSellForm.operator;
                        const avail = simStockSummary.find(s => s.operator === op)?.available ?? 0;
                        return <div className="x-small text-muted mt-1">Available: <span className="fw-bold">{avail}</span></div>;
                      })()}
                    </div>
                    {simSellForm.operator === 'OTHER' && (
                      <div className="col-12 col-md-6">
                        <label className="form-label x-small fw-bold text-dark">Operator Name <span className="text-danger">*</span></label>
                        <input type="text" className="form-control text-uppercase" value={simSellForm.custom_operator} onChange={e => setSimSellForm({...simSellForm, custom_operator: e.target.value})} />
                      </div>
                    )}
                    <div className="col-12 col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Quantity <span className="text-danger">*</span></label>
                      <input type="number" min="1" required className="form-control" value={simSellForm.quantity} onChange={e => setSimSellForm({...simSellForm, quantity: e.target.value})} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label x-small fw-bold text-dark">Date <span className="text-danger">*</span></label>
                      <input type="date" required className="form-control" value={simSellForm.entry_date} onChange={e => setSimSellForm({...simSellForm, entry_date: e.target.value})} />
                    </div>
                    <div className="col-12">
                      <label className="form-label x-small fw-bold text-dark">Remarks</label>
                      <textarea rows="2" className="form-control text-uppercase" value={simSellForm.remarks} onChange={e => setSimSellForm({...simSellForm, remarks: e.target.value.toUpperCase()})} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top p-2 bg-light justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-2 px-3 fw-bold" onClick={() => setShowSimSellModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-danger btn-sm rounded-2 px-4 fw-bold">Confirm Sale</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* NEW ENTITY MODAL */}
      <Modal show={showEntityModal} onHide={() => setShowEntityModal(false)} centered className="text-uppercase modal-dialog-scrollable" style={{ zIndex: 1060 }}>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title className="fw-bold text-uppercase" style={{ fontSize: '1rem' }}>New Entity</Modal.Title>
        </Modal.Header>
        <form onSubmit={handleQuickEntityAdd}>
          <Modal.Body className="p-4">
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label fw-bold small text-muted text-uppercase">Entity Name *</label>
                <input 
                  type="text" 
                  className="form-control text-uppercase" 
                  required 
                  value={newEntity.name}
                  onChange={e => setNewEntity({...newEntity, name: e.target.value.toUpperCase()})}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Category *</label>
                <select 
                  className="form-select fw-semibold text-uppercase"
                  required
                  value={
                    isDefaultType || isCustomType
                      ? newEntity.type
                      : (newEntity.type ? 'OTHER' : '')
                  }
                  onChange={e => setNewEntity({...newEntity, type: e.target.value})}
                >
                  <option value="">Select Category...</option>
                  <option value="CUSTOMER">NORMAL CUSTOMER</option>
                  <option value="SHOP_CUSTOMER">SHOP CUSTOMER</option>
                  <option value="SHOP">SHOP</option>
                  <option value="SUPPLIER">SUPPLIER</option>
                  <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                  <option value="BANK">BANK</option>
                  <option value="CARD">CARD</option>
                  <option value="UPI">UPI</option>
                  {customTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="OTHER">OTHER / CUSTOM TYPE</option>
                </select>
              </div>

              {showCustomInput && (
                <div className="col-12">
                  <label className="form-label fw-bold small text-muted text-uppercase">Custom Category / Type *</label>
                  <input 
                    type="text" 
                    className="form-control fw-bold text-uppercase"
                    required
                    placeholder="Type custom category name..."
                    value={newEntity.type === 'OTHER' ? '' : newEntity.type}
                    onChange={e => setNewEntity({...newEntity, type: e.target.value.toUpperCase()})}
                  />
                </div>
              )}
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={newEntity.phone}
                  onChange={e => setNewEntity({...newEntity, phone: e.target.value})}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Address"
                  value={newEntity.address}
                  onChange={e => setNewEntity({...newEntity, address: e.target.value})}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">GST Number</label>
                <input
                  type="text"
                  className="form-control text-uppercase"
                  placeholder="Optional"
                  value={newEntity.gst_number}
                  onChange={e => setNewEntity({...newEntity, gst_number: e.target.value.toUpperCase()})}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Opening Balance</label>
                <input 
                  type="number" 
                  className="form-control"
                  value={newEntity.opening_balance}
                  onChange={e => setNewEntity({...newEntity, opening_balance: e.target.value})}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold small text-muted text-uppercase">Balance Type</label>
                <select 
                  className="form-select text-uppercase"
                  value={newEntity.balance_type}
                  onChange={e => setNewEntity({...newEntity, balance_type: e.target.value})}
                >
                  <option value="RECEIVABLE">THEY OWE ME (Receivable)</option>
                  <option value="PAYABLE">I OWE THEM (Payable)</option>
                </select>
              </div>

              {['CUSTOMER', 'SHOP_CUSTOMER'].includes(newEntity.type) && (
                <>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-bold small text-muted text-uppercase">Email</label>
                    <input 
                      type="email" 
                      className="form-control text-uppercase"
                      placeholder="Email address"
                      value={newEntity.email || ''}
                      onChange={e => setNewEntity({...newEntity, email: e.target.value})}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-bold small text-muted text-uppercase">Voucher Code</label>
                    <input 
                      type="text" 
                      className="form-control text-primary fw-semibold text-uppercase"
                      placeholder="Voucher Code"
                      value={newEntity.voucher_code || ''}
                      onChange={e => setNewEntity({...newEntity, voucher_code: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div className="col-12 mt-3 pt-3 border-top">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '0.9rem' }}>
                        🎂 Customer Events
                      </h6>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-primary fw-bold" 
                        onClick={() => setNewEntity({...newEntity, events: [...(newEntity.events || []), { type: '', name: '', date: '' }]})}
                        style={{ fontSize: '0.75rem', borderRadius: '6px', padding: '4px 12px' }}
                      >
                        + Add Event
                      </button>
                    </div>
                    <p className="text-muted x-small text-uppercase mb-3 fw-semibold" style={{ letterSpacing: '0.5px', fontSize: '0.7rem' }}>
                      Click "+ Add Event" to track birthdays, etc.
                    </p>

                    <div className="row g-2">
                      {(newEntity.events || []).map((ev, idx) => (
                        <div key={idx} className="col-12 p-3 bg-light rounded border mb-2">
                          <div className="row g-2 align-items-center">
                            
                            <div className="col-12 col-md-4">
                              <select 
                                className="form-select form-select-sm fw-semibold text-uppercase" 
                                value={ev.type} 
                                onChange={e => {
                                  const newEvents = [...newEntity.events];
                                  newEvents[idx].type = e.target.value;
                                  setNewEntity({...newEntity, events: newEvents});
                                }}
                              >
                                <option value="">Select Type</option>
                                <option value="dob">DOB</option>
                                <option value="anniversary">Anniversary</option>
                                <option value="other">Other</option>
                              </select>
                            </div>

                            {ev.type === 'other' && (
                              <div className="col-12 col-md-3">
                                <input 
                                  className="form-control form-control-sm fw-semibold text-uppercase" 
                                  placeholder="Event Name" 
                                  value={ev.name || ''} 
                                  onChange={e => {
                                    const newEvents = [...newEntity.events];
                                    newEvents[idx].name = e.target.value.toUpperCase();
                                    setNewEntity({...newEntity, events: newEvents});
                                  }}
                                />
                              </div>
                            )}

                            <div className={`col-md-${ev.type === 'other' ? '4' : '7'}`}>
                              <input 
                                className="form-control form-control-sm fw-semibold" 
                                type="date" 
                                value={ev.date} 
                                onChange={e => {
                                  const newEvents = [...newEntity.events];
                                  newEvents[idx].date = e.target.value;
                                  setNewEntity({...newEntity, events: newEvents});
                                }}
                              />
                            </div>

                            <div className="col-12 col-md-1 text-end">
                              <button 
                                type="button" 
                                className="btn btn-sm btn-link text-danger p-0 border-0 bg-transparent" 
                                onClick={() => {
                                  const newEvents = newEntity.events.filter((_, i) => i !== idx);
                                  setNewEntity({...newEntity, events: newEvents});
                                }}
                              >
                                ❌
                              </button>
                            </div>

                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="col-12">
                <label className="form-label fw-bold small text-muted text-uppercase">Description / Notes</label>
                <textarea 
                  className="form-control text-uppercase"
                  rows="2"
                  value={newEntity.description}
                  onChange={e => setNewEntity({...newEntity, description: e.target.value.toUpperCase()})}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer className="border-0 p-4 pt-0">
            <Button variant="light" onClick={() => setShowEntityModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" className="fw-bold px-4" disabled={entitySubmitting}>
              {entitySubmitting ? 'SAVING...' : 'SAVE ACCOUNT'}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

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
