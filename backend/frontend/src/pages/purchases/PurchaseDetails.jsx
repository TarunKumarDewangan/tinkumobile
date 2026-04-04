import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';

export default function PurchaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [receiptModal, setReceiptModal] = useState({ show: false, items: [] });
  const [paymentModal, setPaymentModal] = useState({ show: false, amount: 0, notes: '', date: new Date().toISOString().slice(0,10) });

  useEffect(() => {
    loadPurchase();
  }, [id]);

  const loadPurchase = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/purchase-invoices/${id}`);
      setPurchase(r.data);
    } catch(e) {
      toast.error('Failed to load purchase details');
      navigate('/purchases');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReceived = () => {
    setReceiptModal({ 
      show: true, 
      items: purchase.items.map(item => ({
        id: item.id,
        product_name: item.product?.name,
        ordered_quantity: item.quantity,
        received_quantity: item.quantity,
        damaged_quantity: 0
      }))
    });
  };

  const handleReceiptItemChange = (idx, field, value) => {
    const newItems = [...receiptModal.items];
    newItems[idx][field] = parseInt(value) || 0;
    setReceiptModal(prev => ({ ...prev, items: newItems }));
  };

  const handleConfirmReceipt = async () => {
    try {
      await api.post(`/purchase-invoices/${purchase.id}/receive`, {
        items: receiptModal.items.map(item => ({
          id: item.id,
          received_quantity: item.received_quantity,
          damaged_quantity: item.damaged_quantity
        }))
      });
      toast.success('✅ Order marked as received and stock updated!');
      setReceiptModal({ show: false, items: [] });
      loadPurchase();
    } catch(e) {
      toast.error(e.response?.data?.message || 'Error updating status');
    }
  };

  const handleAddPayment = async () => {
    if (paymentModal.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    try {
      await api.post(`/purchase-invoices/${purchase.id}/add-payment`, {
        amount: paymentModal.amount,
        payment_date: paymentModal.date,
        notes: paymentModal.notes
      });
      toast.success('✅ Payment recorded successfully!');
      setPaymentModal({ show: false, amount: 0, notes: '', date: new Date().toISOString().slice(0,10) });
      loadPurchase();
    } catch(e) {
      toast.error('Failed to record payment');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"/></div>;
  if (!purchase) return <div className="text-center py-5">Purchase not found</div>;

  const balance = parseFloat(purchase.grand_total) - parseFloat(purchase.total_paid || 0);

  return (
    <div className="container-fluid py-2">
      <style>{`
        @media print {
          .no-print, .btn, .navbar, .sidebar { display: none !important; }
          .container-fluid { padding: 0 !important; margin: 0 !important; width: 100% !important; }
          .card { border: none !important; box-shadow: none !important; }
          body { background: white !important; font-size: 12pt; }
          .print-header { display: block !important; }
          .badge { border: 1px solid #000 !important; color: #000 !important; background: transparent !important; }
        }
        .print-header { display: none; }
      `}</style>

      <div className="page-header mb-3 d-flex justify-content-between align-items-center no-print text-uppercase">
        <div>
           <h2 className="mb-0 fw-bold">🧾 PURCHASE DETAILS</h2>
           <p className="text-muted small mb-0">INVOICE: {purchase.invoice_no}</p>
        </div>
        <div className="d-flex gap-2">
           <button onClick={() => navigate('/purchases')} className="btn btn-outline-secondary fw-bold shadow-sm">← Back</button>
           <button onClick={handlePrint} className="btn btn-dark fw-bold shadow-sm">🖨️ Print Invoice</button>
           {purchase.status === 'ordered' && (
             <button onClick={handleMarkReceived} className="btn btn-success fw-bold shadow-sm">✅ Mark Received</button>
           )}
           <Link to={`/purchases/${purchase.id}/edit`} className="btn btn-primary fw-bold shadow-sm">✍️ Edit</Link>
        </div>
      </div>

      {/* PRINT HEADER */}
      <div className="print-header mb-4 text-center">
         <h1 className="fw-bold mb-1">TINKU MOBILES</h1>
         <p className="mb-0">Dhamtari, Chhattisgarh | Contact: +91 99933-22222</p>
         <h4 className="mt-3 text-decoration-underline text-uppercase">Purchase Invoice Receipt</h4>
      </div>

      <div className="row g-3">
        {/* Left: Invoice Info */}
        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0 rounded-3 mb-3">
            <div className="card-header bg-primary text-white py-3">
               <h6 className="mb-0 fw-bold text-uppercase">📦 ORDER INFORMATION</h6>
            </div>
            <div className="card-body text-uppercase">
                <div className="mb-3 border-bottom pb-2">
                    <label className="text-muted small fw-bold d-block">Status</label>
                    <div className="d-flex align-items-center gap-2 mt-1">
                        {purchase.status === 'ordered' ? (
                            <span className="badge bg-warning text-dark px-3 rounded-pill">ORDERED</span>
                        ) : (
                            <span className="badge bg-success px-3 rounded-pill">RECEIVED</span>
                        )}
                        <span className={`badge px-3 rounded-pill ${
                            purchase.payment_status === 'paid' ? 'bg-success' : 
                            purchase.payment_status === 'partial' ? 'bg-info' : 'bg-danger'
                        }`}>
                            {purchase.payment_status?.toUpperCase() || 'UNPAID'}
                        </span>
                        <span className={`badge px-3 rounded-pill bg-secondary`}>
                            {purchase.bill_type?.toUpperCase() || 'KACCHA'}
                        </span>
                    </div>
                </div>

                <div className="mb-3 border-bottom pb-2">
                    <label className="text-muted small fw-bold d-block">Supplier Detail</label>
                    <div className="fw-bold fs-5 text-primary">{purchase.supplier?.name.toUpperCase()}</div>
                    <div className="small text-muted">📞 {purchase.supplier?.phone || 'N/A'}</div>
                    <div className="small text-muted">📍 {purchase.supplier?.address || 'N/A'}</div>
                </div>

                <div className="row g-2 mb-3">
                    <div className="col-6 border-end">
                        <label className="text-muted small fw-bold d-block">Invoice Date</label>
                        <div className="fw-bold">📅 {formatDate(purchase.purchase_date)}</div>
                    </div>
                    <div className="col-6">
                        <label className="text-muted small fw-bold d-block">Shop Branch</label>
                        <div className="fw-bold">{purchase.shop?.name?.toUpperCase() || 'MAIN BRANCH'}</div>
                    </div>
                </div>

                {purchase.status === 'ordered' && purchase.expected_delivery_date && (
                    <div className="mb-3 bg-primary-subtle p-2 rounded">
                        <label className="text-primary small fw-bold d-block">Expected On</label>
                        <div className="fw-bold text-primary">🚚 {formatDate(purchase.expected_delivery_date)}</div>
                    </div>
                )}

                {purchase.status === 'received' && purchase.received_at && (
                    <div className="mb-3 bg-success-subtle p-2 rounded">
                        <label className="text-success small fw-bold d-block">Received On</label>
                        <div className="fw-bold text-success">📦 {formatDate(purchase.received_at)}</div>
                    </div>
                )}

                <div className="mb-0">
                    <label className="text-muted small fw-bold d-block">Notes / Ref</label>
                    <div className="p-2 bg-light rounded small mt-1">{purchase.notes || 'No extra notes provided.'}</div>
                </div>
            </div>
          </div>

          <div className="card shadow-sm border-0 rounded-3 no-print">
            <div className="card-header bg-success text-white py-3 d-flex justify-content-between align-items-center">
               <h6 className="mb-0 fw-bold text-uppercase">💳 PAYMENT SUMMARY</h6>
               <button onClick={() => setPaymentModal({...paymentModal, show: true})} className="btn btn-xs btn-light fw-bold">ADD PAYMENT</button>
            </div>
            <div className="card-body text-uppercase">
                <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted small fw-bold">Grand Total:</span>
                    <span className="fw-bold">₹{parseFloat(purchase.grand_total).toLocaleString('en-IN')}</span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                    <span className="text-success small fw-bold">Total Paid:</span>
                    <span className="fw-bold text-success">₹{parseFloat(purchase.total_paid || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="d-flex justify-content-between border-top pt-2">
                    <span className="text-danger small fw-bold">Balance Due:</span>
                    <span className="fw-bold text-danger fs-5">₹{balance.toLocaleString('en-IN')}</span>
                </div>
            </div>
          </div>
        </div>

        {/* Right: Items */}
        <div className="col-12 col-md-8">
          <div className="card shadow-sm border-0 rounded-3 h-100 overflow-hidden">
            <div className="card-header bg-white py-3 border-bottom border-light">
                <h6 className="mb-0 fw-bold text-uppercase">🛒 PURCHASED PRODUCTS</h6>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0 text-uppercase">
                <thead className="bg-light">
                  <tr>
                    <th>Product & Config</th>
                    <th className="text-center">Qty</th>
                    <th className="text-end">Price</th>
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchase.items?.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div className="fw-bold text-dark">{item.product?.name.toUpperCase()}</div>
                        <div className="d-flex gap-2 mt-1" style={{ fontSize: '0.7rem' }}>
                            {item.imei && <span className="text-muted border-end pe-2">IMEI: {item.imei}</span>}
                            {item.ram && <span className="text-muted border-end pe-2">RAM: {item.ram}</span>}
                            {item.storage && <span className="text-muted border-end pe-2">ROM: {item.storage}</span>}
                            {item.color && <span className="text-muted">COL: {item.color}</span>}
                        </div>
                      </td>
                      <td className="text-center fw-bold">
                        {item.quantity} PCS
                        {purchase.status === 'received' && (
                          <div className="d-flex flex-column gap-1 mt-1 no-print" style={{fontSize: '0.65rem'}}>
                            <span className="badge bg-success py-1">RCV: {item.received_quantity || 0}</span>
                            {item.damaged_quantity > 0 && (
                              <span className="badge bg-danger py-1">DMG: {item.damaged_quantity}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="fw-bold">₹{parseFloat(item.unit_price).toLocaleString('en-IN')}</div>
                      </td>
                      <td className="text-end fw-bold text-primary">₹{parseFloat(item.total).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="table-light text-uppercase">
                  <tr>
                    <td colSpan={3} className="text-end fw-bold">Subtotal:</td>
                    <td className="text-end fw-bold">₹{parseFloat(purchase.total_amount).toLocaleString('en-IN')}</td>
                  </tr>
                  {(parseFloat(purchase.cgst_amount) > 0 || parseFloat(purchase.sgst_amount) > 0) && (
                    <tr>
                      <td colSpan={3} className="text-end text-muted small fw-bold">GST Summary:</td>
                      <td className="text-end fw-semibold small">₹{((parseFloat(purchase.cgst_amount) + parseFloat(purchase.sgst_amount))).toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                  {parseFloat(purchase.discount) > 0 && (
                    <tr>
                      <td colSpan={3} className="text-end text-danger fw-bold">Less Discount:</td>
                      <td className="text-end text-danger fw-bold">- ₹{parseFloat(purchase.discount).toLocaleString('en-IN')}</td>
                    </tr>
                  )}
                  <tr className="fs-5 border-top border-dark border-3">
                    <td colSpan={3} className="text-end fw-bold">Grand Total:</td>
                    <td className="text-end fw-bold text-primary">₹{parseFloat(purchase.grand_total).toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 no-print text-center text-muted small text-uppercase">
           Purchased By: {purchase.user?.name} | Generated on: {new Date().toLocaleString()}
      </div>

      {/* RECEIPT MODAL */}
      <Modal show={receiptModal.show} onHide={() => setReceiptModal({ show: false, items: [] })} centered size="lg" className="text-uppercase" style={{zIndex: 1100}}>
        <Modal.Header closeButton className="bg-success text-white">
          <Modal.Title className="fw-bold">📦 RECEIVE STOCK</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <p className="small text-muted mb-3 fw-bold">VERIFY QUANTITIES RECEIVED. DAMAGED ITEMS WILL BE RECORDED BUT NOT ADDED TO MARKETABLE STOCK.</p>
          <div className="table-responsive">
            <table className="table table-sm table-bordered align-middle">
              <thead className="bg-light">
                <tr>
                  <th>PRODUCT</th>
                  <th className="text-center" style={{width:'80px'}}>ORD</th>
                  <th className="text-center" style={{width:'100px'}}>RCV</th>
                  <th className="text-center" style={{width:'100px'}}>DMG</th>
                  <th className="text-center" style={{width:'80px'}}>GOOD</th>
                </tr>
              </thead>
              <tbody>
                {receiptModal.items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="small fw-bold">{item.product_name.toUpperCase()}</td>
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
                        className="form-control form-control-sm text-center fw-bold text-danger border-danger"
                        value={item.damaged_quantity}
                        onChange={(e) => handleReceiptItemChange(idx, 'damaged_quantity', e.target.value)}
                        min="0"
                      />
                    </td>
                    <td className="text-center fw-bold text-success bg-light">
                      {item.received_quantity - item.damaged_quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" className="fw-bold" onClick={() => setReceiptModal({ show: false, items: [] })}>CANCEL</Button>
          <Button variant="success" className="fw-bold px-4 shadow-sm" onClick={handleConfirmReceipt}>CONFIRM RECEIPT</Button>
        </Modal.Footer>
      </Modal>

      {/* PAYMENT MODAL */}
      <Modal show={paymentModal.show} onHide={() => setPaymentModal({...paymentModal, show: false})} centered className="text-uppercase" style={{zIndex: 1100}}>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title className="fw-bold">💳 RECORD PAYMENT</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
            <div className="mb-3">
                <label className="form-label small fw-bold">Amount Paid (₹)</label>
                <input 
                    type="number" 
                    className="form-control form-control-lg border-primary fw-bold text-primary" 
                    value={paymentModal.amount} 
                    onChange={e => setPaymentModal({...paymentModal, amount: e.target.value})}
                    placeholder="Enter amount..."
                />
                <div className="small text-muted mt-1">Remaining Balance: ₹{(balance - (parseFloat(paymentModal.amount) || 0)).toLocaleString('en-IN')}</div>
            </div>
            <div className="mb-3">
                <label className="form-label small fw-bold">Payment Date</label>
                <input 
                    type="date" 
                    className="form-control" 
                    value={paymentModal.date} 
                    onChange={e => setPaymentModal({...paymentModal, date: e.target.value})}
                />
            </div>
            <div className="mb-0">
                <label className="form-label small fw-bold">Payment Notes</label>
                <textarea 
                    className="form-control text-uppercase" 
                    rows={2} 
                    placeholder="E.G. PAID VIA PhonePe, CASH, ETC..."
                    value={paymentModal.notes} 
                    onChange={e => setPaymentModal({...paymentModal, notes: e.target.value.toUpperCase()})}
                ></textarea>
            </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" className="fw-bold" onClick={() => setPaymentModal({...paymentModal, show: false })}>CANCEL</Button>
          <Button variant="primary" className="fw-bold px-4 shadow-sm" onClick={handleAddPayment}>SAVE PAYMENT</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
