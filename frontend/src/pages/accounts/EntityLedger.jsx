import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';

export default function EntityLedger() {
  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [settleData, setSettleData] = useState({
    amount: '',
    type: 'CASH_OUT',
    payment_mode: 'CASH',
    category: 'ENTITY_SETTLEMENT',
    description: ''
  });

  const loadEntities = async () => {
    setLoading(true);
    try {
      const res = await api.get('/entities/statements');
      setEntities(res.data);
    } catch (e) {
      toast.error('Failed to load entities');
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async (name) => {
    setLedgerLoading(true);
    try {
      const res = await api.get(`/entities/${name}/ledger`);
      setLedger(res.data);
      setSelectedEntity(name);
    } catch (e) {
      toast.error('Failed to load ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    loadEntities();
  }, []);

  const handleSettle = async (e) => {
    e.preventDefault();
    if (!settleData.amount || settleData.amount <= 0) return toast.error('Enter valid amount');
    try {
      await api.post('/entities/settle', {
        ...settleData,
        entity_name: selectedEntity
      });
      toast.success('Settlement recorded');
      setShowSettleModal(false);
      setSettleData({ ...settleData, amount: '', description: '' });
      loadLedger(selectedEntity);
      loadEntities();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error recording settlement');
    }
  };

  const filteredEntities = entities.filter(ent => 
    ent.entity_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totals = entities.reduce((acc, ent) => {
    acc.in += parseFloat(ent.total_in || 0);
    acc.out += parseFloat(ent.total_out || 0);
    acc.balance += parseFloat(ent.balance || 0);
    return acc;
  }, { in: 0, out: 0, balance: 0 });

  return (
    <div className="entity-ledger-container h-100 d-flex flex-column">
      <div className="page-header mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="mb-0">🧾 Entity Ledger</h2>
          <button className="btn btn-outline-secondary btn-sm" onClick={loadEntities}>Refresh</button>
        </div>
        
        {/* Summary Stats */}
        <div className="row g-3">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm bg-success text-white">
              <div className="card-body p-3">
                <div className="x-small opacity-75 text-uppercase fw-bold">Total Receivable</div>
                <div className="h4 mb-0">₹{totals.in.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm bg-danger text-white">
              <div className="card-body p-3">
                <div className="x-small opacity-75 text-uppercase fw-bold">Total Payable</div>
                <div className="h4 mb-0">₹{totals.out.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm bg-primary text-white">
              <div className="card-body p-3">
                <div className="x-small opacity-75 text-uppercase fw-bold">Net Balance</div>
                <div className="h4 mb-0">₹{totals.balance.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-0 flex-grow-1 overflow-hidden bg-white rounded-4 shadow-sm border">
        {/* Entities Sidebar */}
        <div className="col-md-4 border-end d-flex flex-column overflow-hidden h-100">
          <div className="p-3 border-bottom bg-light">
            <input 
              type="text" 
              className="form-control form-control-sm border-0 shadow-none bg-white" 
              placeholder="Search entity..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex-grow-1 overflow-auto">
            {loading ? (
              <div className="text-center py-5"><div className="spinner-border spinner-border-sm text-primary"/></div>
            ) : filteredEntities.length === 0 ? (
              <div className="text-center py-5 text-muted small">No entities found</div>
            ) : (
              <div className="list-group list-group-flush">
                {filteredEntities.map(ent => (
                  <button 
                    key={ent.entity_name}
                    className={`list-group-item list-group-item-action border-0 p-3 ${selectedEntity === ent.entity_name ? 'bg-primary-subtle border-start border-primary border-4' : ''}`}
                    onClick={() => loadLedger(ent.entity_name)}
                  >
                    <div className="d-flex justify-content-between align-items-baseline">
                      <div>
                        <div className="fw-bold text-dark">{ent.entity_name}</div>
                        {ent.repair_dues > 0 && (
                           <div className="x-small text-danger fw-bold">
                              ₹{ent.repair_dues.toLocaleString()} DUES in Repairs
                           </div>
                        )}
                        <div className="small text-muted italic">Net Statement Balance</div>
                      </div>
                      <div className={`fw-bold text-end ${ent.balance >= 0 ? 'text-success' : 'text-danger'}`}>
                        ₹{Math.abs(ent.balance).toLocaleString()}
                        <div className="x-small opacity-50">
                            {ent.balance >= 0 ? 'RECEIVE' : 'PAY'}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ledger Details */}
        <div className="col-md-8 d-flex flex-column overflow-hidden h-100 bg-light-subtle">
          {selectedEntity ? (
            <>
              <div className="p-3 border-bottom bg-white d-flex justify-content-between align-items-center shadow-sm z-1">
                <div>
                   <h5 className="mb-0 fw-bold">{selectedEntity}</h5>
                   <span className="x-small text-muted text-uppercase">Transaction History & Settlements</span>
                </div>
                <button className="btn btn-primary btn-sm shadow-sm" onClick={() => setShowSettleModal(true)}>
                  $ Settle Amount
                </button>
              </div>

              <div className="flex-grow-1 overflow-auto p-3">
                {ledgerLoading ? (
                   <div className="text-center py-5"><div className="spinner-border text-primary"/></div>
                ) : (
                  <div className="table-responsive bg-white rounded-3 shadow-sm border overflow-hidden">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="bg-light x-small fw-bold text-uppercase text-muted">
                        <tr>
                          <th className="ps-3">Date</th>
                          <th>Category</th>
                          <th>Description</th>
                          <th className="text-end">Cash In</th>
                          <th className="text-end pe-3">Cash Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map(t => (
                          <tr key={t.id} className="small">
                            <td className="ps-3 text-muted">{new Date(t.transaction_date).toLocaleDateString()}</td>
                            <td>
                                <span className="badge bg-light text-dark border x-small">{t.category}</span>
                            </td>
                            <td>
                                <div className="fw-semibold">{t.description}</div>
                                <div className="x-small text-muted">{t.payment_mode}</div>
                            </td>
                            <td className="text-end text-success fw-bold">
                                {t.type === 'CASH_IN' ? `₹${parseFloat(t.amount).toLocaleString()}` : '-'}
                            </td>
                            <td className="text-end text-danger fw-bold pe-3">
                                {t.type === 'CASH_OUT' ? `₹${parseFloat(t.amount).toLocaleString()}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted">
               <div style={{fontSize:'4rem'}}>📑</div>
               <div className="fw-bold">Select an entity to view ledger</div>
               <div className="small">Click on the left sidebar to see transaction history</div>
            </div>
          )}
        </div>
      </div>

      {/* Settlement Modal */}
      {showSettleModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <form onSubmit={handleSettle}>
                <div className="modal-header bg-primary text-white border-0">
                  <h5 className="modal-title">Record Settlement for {selectedEntity}</h5>
                  <button type="button" className="btn-close btn-close-white shadow-none" onClick={() => setShowSettleModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                   <div className="mb-3">
                      <label className="form-label x-small fw-bold text-uppercase text-muted">Transaction Type</label>
                      <select 
                        className="form-select border-2" 
                        value={settleData.type}
                        onChange={e => setSettleData({ ...settleData, type: e.target.value })}
                      >
                         <option value="CASH_OUT">GIVEN TO {selectedEntity} (Payment)</option>
                         <option value="CASH_IN">RECEIVED FROM {selectedEntity} (Adjustment)</option>
                      </select>
                   </div>
                   <div className="mb-3">
                      <label className="form-label x-small fw-bold text-uppercase text-muted">Amount (₹)</label>
                      <input 
                        type="number" 
                        className="form-control form-control-lg fw-bold" 
                        placeholder="0.00"
                        required
                        value={settleData.amount}
                        onChange={e => setSettleData({ ...settleData, amount: e.target.value })}
                      />
                   </div>
                   <div className="mb-3">
                      <label className="form-label x-small fw-bold text-uppercase text-muted">Payment Mode</label>
                      <select 
                        className="form-select" 
                        value={settleData.payment_mode}
                        onChange={e => setSettleData({ ...settleData, payment_mode: e.target.value })}
                      >
                         <option value="CASH">Cash</option>
                         <option value="GPay">GPay</option>
                         <option value="PhonePe">PhonePe</option>
                         <option value="Paytm">Paytm</option>
                         <option value="Online">Online Payment</option>
                         <option value="Card">Bank/Card</option>
                      </select>
                   </div>
                   <div className="mb-0">
                      <label className="form-label x-small fw-bold text-uppercase text-muted">Remarks / Description</label>
                      <textarea 
                        className="form-control" 
                        rows="2"
                        placeholder="Optional details..."
                        value={settleData.description}
                        onChange={e => setSettleData({ ...settleData, description: e.target.value })}
                      ></textarea>
                   </div>
                </div>
                <div className="modal-footer border-0 p-4 pt-0">
                  <button type="button" className="btn btn-light" onClick={() => setShowSettleModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary px-4 shadow">Record Transaction</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .x-small { font-size: 0.7rem; }
        .bg-light-subtle { background-color: #fcfcfd !important; }
        .italic { font-style: italic; }
      `}</style>
    </div>
  );
}
