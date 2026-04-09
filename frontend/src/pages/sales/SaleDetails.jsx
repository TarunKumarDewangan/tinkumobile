import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';

export default function SaleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');

  useEffect(() => { loadInvoice(); }, [id]);

  const loadInvoice = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/sale-invoices/${id}`);
      setInvoice(data);
    } catch (e) { toast.error('Failed to load invoice'); }
    finally { setLoading(false); }
  };

  const handleAddPayment = async (e) => {
      e.preventDefault();
      try {
          await api.post(`/sale-invoices/${id}/add-payment`, { amount: payAmount });
          toast.success('✅ Payment recorded');
          setShowPayModal(false);
          setPayAmount('');
          loadInvoice();
      } catch (e) { toast.error('Payment failed'); }
  };

  const handlePrint = () => { window.print(); };

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary" /></div>;
  if (!invoice) return <div className="alert alert-danger">Invoice not found</div>;

  const balance = parseFloat(invoice.grand_total) - parseFloat(invoice.total_paid);

  return (
    <div className="container-fluid py-2 sale-details-page">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center d-print-none">
        <div className="text-uppercase">
           <h2 className="mb-0 fw-bold">🧾 SALE INVOICE: {invoice.invoice_no}</h2>
           <p className="text-muted small mb-0">VIEW DETAILS, TRACK PAYMENTS AND PRINT</p>
        </div>
        <div className="d-flex gap-2">
            <button onClick={() => navigate('/sales')} className="btn btn-outline-secondary btn-sm fw-bold border-2 text-uppercase">← List</button>
            <button onClick={handlePrint} className="btn btn-dark btn-sm fw-bold shadow-sm text-uppercase">🖨️ Print</button>
        </div>
      </div>

      <div className="row g-3">
          {/* Main Invoice Card */}
          <div className="col-12 col-lg-8">
              <div className="card shadow-sm border-0 rounded-3 overflow-hidden bg-white invoice-print-container">
                  <div className="card-body p-4 p-md-5">
                      {/* Header Section */}
                      <div className="d-flex justify-content-between align-items-start mb-4 border-bottom pb-4">
                          <div>
                              <h1 className="fw-black text-primary mb-1" style={{ fontSize: '2.5rem' }}>TINKU MOBILES</h1>
                              <p className="mb-0 fw-bold text-uppercase">{invoice.shop?.name}</p>
                              <p className="text-muted small mb-0">{invoice.shop?.address || 'Premium Mobile Solutions'}</p>
                          </div>
                          <div className="text-end text-uppercase">
                              <h4 className="fw-bold mb-0">INVOICE</h4>
                              <div className="fw-bold text-primary">#{invoice.invoice_no}</div>
                              <div className="small text-muted fw-bold mt-1">DATE: {formatDate(invoice.sale_date)}</div>
                          </div>
                      </div>

                      {/* Info Section */}
                      <div className="row mb-4 text-uppercase">
                          <div className="col-6">
                              <div className="small text-muted fw-bold mb-1 border-bottom d-inline-block">BILLING TO:</div>
                              <div className="h5 fw-black mb-0 text-dark mt-1">{invoice.customer?.name}</div>
                              <div className="small fw-bold">📞 {invoice.customer?.phone}</div>
                              <div className="small text-muted">{invoice.customer?.address || 'No Address Provided'}</div>
                          </div>
                      </div>

                      {/* Items Table */}
                      <div className="table-responsive mb-4">
                          <table className="table table-bordered border-secondary-subtle align-middle text-uppercase">
                              <thead className="bg-light fw-bold x-small">
                                  <tr>
                                      <th className="ps-3 py-3" style={{ width: '50px' }}>#</th>
                                      <th className="py-3">ITEM DESCRIPTION & CONFIG</th>
                                      <th className="text-center py-3" style={{ width: '80px' }}>QTY</th>
                                      <th className="text-end py-3" style={{ width: '130px' }}>PRICE</th>
                                      <th className="text-end pe-3 py-3" style={{ width: '130px' }}>TOTAL</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {invoice.items.map((item, i) => (
                                      <tr key={i}>
                                          <td className="ps-3 fw-bold text-muted">{i + 1}</td>
                                          <td className="py-2">
                                              <div className="fw-black text-dark">{item.product?.name}</div>
                                               <div className="mt-1 d-flex flex-wrap gap-2 align-items-center">
                                                   {item.imei ? (
                                                       <span className="badge bg-dark text-white px-2 py-1" style={{ fontSize: '0.8rem' }}>IMEI: {item.imei}</span>
                                                   ) : (
                                                       <span className="text-danger fw-bold x-small border border-danger px-1 rounded">⚠️ IMEI NOT RECORDED</span>
                                                   )}
                                                   {(item.ram || item.storage || item.color) && (
                                                       <span className="text-muted fw-bold" style={{ fontSize: '0.8rem' }}>
                                                           {item.ram && <span>{item.ram} / </span>}
                                                           {item.storage && <span>{item.storage} / </span>}
                                                           {item.color && <span>{item.color}</span>}
                                                       </span>
                                                   )}
                                               </div>
                                          </td>
                                          <td className="text-center fw-bold">{item.quantity}</td>
                                          <td className="text-end fw-semibold">₹{parseFloat(item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          <td className="text-end pe-3 fw-black">₹{parseFloat(item.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>

                      {/* Gift Items if any */}
                      {invoice.gift_items?.length > 0 && (
                          <div className="mb-4 bg-light-subtle p-3 border rounded-3 border-secondary-subtle">
                             <div className="small fw-black text-primary text-uppercase mb-2">🎁 FREE GIFTS INCLUDED</div>
                             {invoice.gift_items.map((g, i) => (
                                 <div key={i} className="small fw-bold text-uppercase">• {g.gift_product?.name} ({g.quantity} PCS)</div>
                             ))}
                          </div>
                      )}

                      {/* Calculation Section */}
                      <div className="row justify-content-end text-uppercase">
                          <div className="col-12 col-md-5">
                              <div className="d-flex justify-content-between mb-2">
                                  <span className="fw-bold text-muted small">SUBTOTAL:</span>
                                  <span className="fw-bold">₹{parseFloat(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="d-flex justify-content-between mb-2">
                                  <span className="fw-bold text-muted small">CGST ({parseFloat(invoice.cgst_rate)}%):</span>
                                  <span className="fw-bold">₹{parseFloat(invoice.cgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="d-flex justify-content-between mb-2">
                                  <span className="fw-bold text-muted small">SGST ({parseFloat(invoice.sgst_rate)}%):</span>
                                  <span className="fw-bold">₹{parseFloat(invoice.sgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="d-flex justify-content-between mb-2">
                                  <span className="fw-bold text-muted small">ROUND OFF:</span>
                                  <span className="fw-bold">₹{parseFloat(invoice.round_off || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              {parseFloat(invoice.cash_discount) > 0 && (
                                  <div className="d-flex justify-content-between mb-2">
                                      <span className="fw-bold text-muted small">CASH DISCOUNT:</span>
                                      <span className="fw-bold text-success">- ₹{parseFloat(invoice.cash_discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                  </div>
                              )}
                              {parseFloat(invoice.discount) > 0 && (
                                  <div className="d-flex justify-content-between mb-2">
                                      <span className="fw-bold text-muted small">DISCOUNT:</span>
                                      <span className="fw-bold text-danger">- ₹{parseFloat(invoice.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                  </div>
                              )}
                              <div className="d-flex justify-content-between py-2 border-top border-bottom border-dark mb-3 bg-light px-2 rounded-1">
                                  <span className="h5 mb-0 fw-black">GRAND TOTAL:</span>
                                  <span className="h5 mb-0 fw-black text-primary">₹{parseFloat(invoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              
                              {/* Payment Breakdown */}
                              <div className="d-flex justify-content-between mb-1 opacity-75">
                                  <span className="x-small fw-black text-success">TOTAL PAID:</span>
                                  <span className="x-small fw-black text-success">₹{parseFloat(invoice.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="d-flex justify-content-between">
                                  <span className="x-small fw-black text-danger">PENDING BALANCE:</span>
                                  <span className="x-small fw-black text-danger">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                          </div>
                      </div>

                      {/* Footer Section */}
                      <div className="mt-5 pt-5 border-top border-secondary-subtle text-center text-muted x-small text-uppercase">
                          <p className="mb-1 fw-bold italicized">THANK YOU FOR YOUR PATRONAGE! PLEASE VISIT AGAIN.</p>
                          <p className="mb-0 fw-bold">THIS IS A COMPUTER GENERATED INVOICE.</p>
                      </div>
                  </div>
              </div>
          </div>

          {/* Right Sidebar: Status & Payment Options */}
          <div className="col-12 col-lg-4 d-print-none text-uppercase">
              <div className="card shadow-sm border-0 rounded-3 mb-3 bg-white">
                  <div className="card-body p-4">
                      <h5 className="fw-bold mb-3 border-bottom pb-2">📦 ORDER STATUS</h5>
                      <div className="mb-3">
                          <label className="small text-muted fw-bold mb-1">PAYMENT STATUS</label>
                          <div className="d-block w-100">
                             {invoice.is_cancelled ? <span className="badge bg-danger fs-6 w-100 py-2 rounded-1">CANCELLED</span> : (
                                invoice.payment_status === 'paid' ? <span className="badge bg-success fs-6 w-100 py-2 rounded-1">✅ FULLY PAID</span> :
                                invoice.payment_status === 'partial' ? <span className="badge bg-info fs-6 w-100 py-2 text-white rounded-1">💰 PARTIALLY PAID</span> :
                                <span className="badge bg-danger fs-6 w-100 py-2 rounded-1">❌ UNPAID BILL</span>
                             )}
                          </div>
                      </div>
                      
                      {balance > 0 && !invoice.is_cancelled && (
                          <button onClick={() => setShowPayModal(true)} className="btn btn-success w-100 fw-black py-2 shadow-sm">+ ADD PAYMENT</button>
                      )}
                  </div>
              </div>

              <div className="card shadow-sm border-0 rounded-3 mb-3 bg-white">
                    <div className="card-body p-4">
                        <h5 className="fw-bold mb-3 border-bottom pb-2">💳 PAYMENT SUMMARY</h5>
                        <div className="d-flex flex-column gap-2">
                             <div className="d-flex justify-content-between p-2 bg-light rounded">
                                 <span className="small fw-bold text-muted">TOTAL BILL:</span>
                                 <span className="fw-bold text-primary">₹{parseFloat(invoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                             </div>
                             <div className="d-flex justify-content-between p-2 bg-success bg-opacity-10 rounded text-success">
                                 <span className="small fw-bold">RECEIVED:</span>
                                 <span className="fw-bold">₹{parseFloat(invoice.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                             </div>
                             <div className="d-flex justify-content-between p-2 bg-danger bg-opacity-10 rounded text-danger">
                                 <span className="small fw-bold">OUTSTANDING:</span>
                                 <span className="fw-bold">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                             </div>
                        </div>
                        <div className="mt-3 small text-muted text-center fw-bold italicized">
                            INITIAL PAYMENT: {invoice.payment_method}
                        </div>
                    </div>
              </div>

              {invoice.notes && (
                  <div className="card shadow-sm border-0 rounded-3 bg-white">
                      <div className="card-body p-4">
                          <h6 className="fw-bold mb-2">📝 INVOICE NOTES</h6>
                          <div className="p-3 bg-light rounded text-muted small fw-bold">{invoice.notes}</div>
                      </div>
                  </div>
              )}
          </div>
      </div>

      {/* Modal: Add Payment */}
      <Modal show={showPayModal} onHide={() => setShowPayModal(false)} centered className="text-uppercase">
          <Modal.Header closeButton className="bg-success text-white">
              <Modal.Title className="fw-bold small">💳 RECEIVE CUSTOMER PAYMENT</Modal.Title>
          </Modal.Header>
          <form onSubmit={handleAddPayment}>
              <Modal.Body className="p-4">
                  <div className="mb-3">
                      <label className="form-label small fw-bold">Pending Balance</label>
                      <div className="h4 fw-black text-danger">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div className="mb-0">
                      <label className="form-label small fw-bold">Payment Amount (₹) <span className="text-danger">*</span></label>
                      <input type="number" step="0.01" className="form-control fs-3 fw-black text-success border-success bg-success bg-opacity-10" placeholder="0.00" required autoFocus value={payAmount} onChange={e => setPayAmount(e.target.value)} max={balance} />
                      <div className="small text-muted mt-2 fw-bold italicized">Max allowed: ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>
              </Modal.Body>
              <Modal.Footer>
                  <Button variant="secondary" className="fw-bold" onClick={() => setShowPayModal(false)}>CANCEL</Button>
                  <Button type="submit" variant="success" className="fw-bold px-4">CONFIRM PAYMENT</Button>
              </Modal.Footer>
          </form>
      </Modal>

      <style>{`
          .x-small { font-size: 0.7rem; }
          .fw-black { font-weight: 900; }
          .italicized { font-style: italic; }
          @media print {
              @page { size: A4; margin: 15mm; }
              body { background: white !important; }
              .sale-details-page { padding: 0 !important; }
              .col-lg-8 { width: 100% !important; }
              .invoice-print-container { box-shadow: none !important; border: none !important; }
              .d-print-none { display: none !important; }
              .card-body { padding: 0 !important; }
          }
      `}</style>
    </div>
  );
}
