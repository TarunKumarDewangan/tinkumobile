import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';

const NumberToWords = (num) => {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    if ((num = num.toString()).length > 9) return 'overflow';
    let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.toUpperCase();
};

export default function SaleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // View Setup
  const [viewMode, setViewMode] = useState('v2'); // Default to Tax Invoice View ('v2')
  
  // Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');

  useEffect(() => { loadInvoice(); }, [id]);

  const loadInvoice = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/sale-invoices/${id}`);
      setInvoice(data);
    } catch (e) { 
        console.error(e);
        toast.error('Failed to load invoice'); 
    }
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

  const handleMarkFinanceReceived = async () => {
      if (!window.confirm('Mark this finance payment as RECEIVED?')) return;
      try {
          await api.post(`/sale-invoices/${id}/receive-finance`);
          toast.success('✅ Finance payment marked as received');
          loadInvoice();
      } catch (e) {
          toast.error(e.response?.data?.message || 'Failed to update finance status');
      }
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
            <button onClick={() => setViewMode(viewMode === 'v1' ? 'v2' : 'v1')} className={`btn btn-sm fw-bold border-2 text-uppercase ${viewMode === 'v1' ? 'btn-outline-primary' : 'btn-primary'}`}>
                {viewMode === 'v1' ? '✨ Switch to Tax Invoice' : '💎 Switch to Standard Bill'}
            </button>
            <button onClick={() => navigate('/sales')} className="btn btn-outline-secondary btn-sm fw-bold border-2 text-uppercase">← List</button>
            <button onClick={handlePrint} className="btn btn-dark btn-sm fw-bold shadow-sm text-uppercase">🖨️ Print</button>
        </div>
      </div>

      <div className="row g-3">
          {/* Main Invoice Card */}
          <div className="col-12 col-lg-8">
              <div className="card shadow-sm border-0 rounded-3 overflow-hidden bg-white invoice-print-container">
                  {viewMode === 'v1' ? (
                      <div className="card-body p-4 p-md-5">
                          {/* Header Section */}
                          <div className="d-flex justify-content-between align-items-start mb-4 border-bottom pb-4">
                              <div>
                                  <h1 className="fw-black text-primary mb-1 text-uppercase" style={{ fontSize: '2.5rem' }}>TINKU MOBILE</h1>
                                  <p className="text-muted small mb-0 text-uppercase">{invoice.shop?.address || 'Premium Mobile Solutions'}</p>
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
                                      {invoice.items?.map((item, i) => (
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
                                 {invoice.gift_items?.map((g, i) => (
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
                                      <span className="fw-bold text-muted small">CGST ({parseFloat(invoice.cgst_rate || 0)}%):</span>
                                      <span className="fw-bold">₹{parseFloat(invoice.cgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                  <div className="d-flex justify-content-between mb-2">
                                      <span className="fw-bold text-muted small">SGST ({parseFloat(invoice.sgst_rate || 0)}%):</span>
                                      <span className="fw-bold">₹{parseFloat(invoice.sgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                  <div className="d-flex justify-content-between mb-2">
                                      <span className="fw-bold text-muted small">ROUND OFF:</span>
                                      <span className="fw-bold">₹{parseFloat(invoice.round_off || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                  {parseFloat(invoice.cash_discount) > 0 && invoice.is_cash_discount_on_bill && (
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
                                  {parseFloat(invoice.exchange_paid || 0) > 0 && (
                                      <div className="d-flex justify-content-between mb-1 opacity-75 text-info">
                                          <span className="x-small fw-black">EXCHANGE CREDIT:</span>
                                          <span className="x-small fw-black">₹{parseFloat(invoice.exchange_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                  )}
                                  <div className="d-flex justify-content-between mb-1 opacity-75">
                                      <span className="x-small fw-black text-success">
                                          {parseFloat(invoice.exchange_paid || 0) > 0 ? 'NET PAID (CASH/UPI):' : 'TOTAL PAID:'}
                                      </span>
                                      <span className="x-small fw-black text-success">
                                          ₹{(parseFloat(invoice.total_paid) - parseFloat(invoice.exchange_paid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </span>
                                  </div>
                                  {parseFloat(invoice.exchange_paid || 0) > 0 && (
                                      <div className="d-flex justify-content-between mb-1 opacity-75 border-top pt-1">
                                          <span className="x-small fw-black text-dark">TOTAL PAID:</span>
                                          <span className="x-small fw-black text-dark">₹{parseFloat(invoice.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                  )}
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
                  ) : (
                      <div className="card-body p-3 p-md-4 view2-container">
                          {/* VIEW 2: Professional Tax Invoice */}
                          <div className="row mb-3 align-items-center">
                              <div className="col-8">
                                  <div className="d-flex align-items-center gap-3">
                                      {/* Logo Placeholder like in Photo */}
                                      <div className="bg-primary text-white p-2 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px', fontSize: '1.5rem', fontWeight: 900 }}>TM</div>
                                      <div>
                                          <h1 className="h2 fw-black mb-0 text-uppercase tracking-tighter">TINKU MOBILE</h1>
                                          <p className="mb-0 x-small fw-bold opacity-75 text-uppercase">{invoice.shop?.address || 'Main Road, Local Market, Kanker'}</p>
                                          <p className="mb-0 x-small fw-bold opacity-75 text-uppercase">📞 MOBILE: {invoice.shop?.phone || '9098795200'}</p>
                                          <p className="mb-0 x-small fw-black text-primary text-uppercase">GSTIN: {invoice.shop?.gstin || '22AXIPR7683P1ZJ'}</p>
                                      </div>
                                  </div>
                              </div>
                              <div className="col-4 text-end">
                                  <h5 className="fw-black text-muted mb-1 text-uppercase border-bottom pb-1">TAX INVOICE</h5>
                                  <div className="small fw-bold mt-2">Inv No: <span className="text-primary">{invoice.invoice_no}</span></div>
                                  <div className="small fw-bold">Date: {formatDate(invoice.sale_date)}</div>
                                  <div className="small fw-bold">Sales By Dealer Person: <span className="text-uppercase">{(invoice.sold_by?.name || invoice.user?.name || 'ADMIN').split(' ' )[0]}</span></div>
                              </div>
                          </div>

                          <div className="row mb-3 gx-0 border rounded overflow-hidden">
                              <div className="col-12 bg-light p-1 border-bottom px-3 fw-black x-small text-uppercase">Customer Details</div>
                              <div className="col-12 p-2 px-3">
                                  <div className="row">
                                      <div className="col-6">
                                          <div className="small fw-bold">NAME: <span className="text-dark">{invoice.customer?.name}</span></div>
                                          <div className="small fw-bold">MOBILE: <span className="text-dark">{invoice.customer?.phone}</span></div>
                                      </div>
                                      <div className="col-6">
                                          <div className="small fw-bold">Address: <span className="text-dark x-small">{invoice.customer?.address || 'N/A'}</span></div>
                                          <div className="small fw-bold">GST No: <span className="text-dark">{invoice.customer?.gst_no || 'N/A'}</span></div>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          <div className="table-responsive">
                              <table className="table table-bordered border-dark table-sm view2-table text-uppercase">
                                  <thead>
                                      <tr className="bg-light text-center small align-middle">
                                          <th rowSpan="2" style={{ width: '40px' }}>SNo.</th>
                                          <th rowSpan="2">Description of Item</th>
                                          <th rowSpan="2" style={{ width: '50px' }}>QTY</th>
                                          
                                          <th rowSpan="2" style={{ width: '100px' }}>RATE</th>
                                          <th rowSpan="2" style={{ width: '50px' }}>Disc%</th>
                                          <th rowSpan="2" style={{ width: '100px' }}>Taxable Amount</th>
                                          <th rowSpan="2" style={{ width: '50px' }}>GST%</th>
                                          <th colSpan="2">GST Amount</th>
                                          <th rowSpan="2" style={{ width: '120px' }}>Net Amount</th>
                                      </tr>
                                      <tr className="bg-light text-center x-small">
                                          <th style={{ width: '80px' }}>CGST</th>
                                          <th style={{ width: '80px' }}>SGST</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {invoice.items?.map((item, i) => {
                                          const taxable = invoice.calculate_gst ? (parseFloat(item.total) / (1 + (parseFloat(invoice.cgst_rate || 0) + parseFloat(invoice.sgst_rate || 0)) / 100)) : parseFloat(item.total);
                                          const cgstPer = invoice.calculate_gst ? (taxable * parseFloat(invoice.cgst_rate || 0) / 100) : 0;
                                          const sgstPer = invoice.calculate_gst ? (taxable * parseFloat(invoice.sgst_rate || 0) / 100) : 0;
                                          
                                          return (
                                              <tr key={i} className="small text-center align-middle">
                                                  <td>{i + 1}</td>
                                                  <td className="text-start ps-2 py-2">
                                                      <div className="fw-black">{item.product?.name}</div>
                                                      <div className="x-small text-muted fw-bold">
                                                          {item.imei && <span>Serial No: {item.imei}</span>}
                                                          {(item.ram || item.storage || item.color) && (
                                                              <div className="opacity-75">CONFIG: {item.ram}/{item.storage}/{item.color}</div>
                                                          )}
                                                      </div>
                                                  </td>
                                                  <td>{item.quantity}</td>
                                                  
                                                  <td>{parseFloat(item.unit_price).toFixed(2)}</td>
                                                  <td>0.00</td>
                                                  <td className="text-end pe-1">{taxable.toFixed(2)}</td>
                                                  <td>{parseFloat(invoice.cgst_rate || 0) + parseFloat(invoice.sgst_rate || 0)}</td>
                                                  <td className="text-end pe-1">{cgstPer.toFixed(2)}</td>
                                                  <td className="text-end pe-1">{sgstPer.toFixed(2)}</td>
                                                  <td className="text-end pe-1 fw-bold">{parseFloat(item.total).toFixed(2)}</td>
                                              </tr>
                                          );
                                      })}
                                      {/* Fill empty rows to maintain height like in photo */}
                                      {Array.from({ length: Math.max(0, 5 - (invoice.items?.length || 0)) }).map((_, i) => (
                                          <tr key={`empty-${i}`} style={{ height: '30px' }}>
                                              {Array.from({ length: 10 }).map((_, j) => <td key={j}></td>)}
                                          </tr>
                                      ))}
                                  </tbody>
                                  <tfoot>
                                      <tr className="fw-black bg-light text-uppercase">
                                          <td colSpan="5" className="text-start ps-3 align-top py-3" rowSpan="6">
                                              <div className="mb-2">Terms & Conditions :</div>
                                              <ol className="ps-3 x-small fw-bold mb-0 opacity-75">
                                                  <li>GOODS ONCE SOLD WILL NOT BE TAKEN BACK.</li>
                                                  <li>WARRANTY WILL BE COVERED AS PER COMPANY POLICY.</li>
                                                  <li>WARRANTY WILL NOT BE COVERED IN CASE OF PHYSICAL/LIQUID DAMAGE.</li>
                                                  <li>PLEASE CHECK GOODS BEFORE LEAVING OUR PREMISES.</li>
                                                  <li>SUBJECT TO KANKER JURISDICTION.</li>
                                              </ol>
                                          </td>
                                          <td className="text-start ps-2 x-small">Gross Amount</td>
                                          <td colSpan="3"></td>
                                          <td className="text-end pe-2">{parseFloat(invoice.total_amount).toFixed(2)}</td>
                                      </tr>
                                      <tr className="small fw-bold text-uppercase">
                                          <td className="text-start ps-2 x-small">Total Discount</td>
                                          <td colSpan="3"></td>
                                          <td className="text-end pe-2">{(parseFloat(invoice.discount || 0) + (invoice.is_cash_discount_on_bill ? parseFloat(invoice.cash_discount || 0) : 0)).toFixed(2)}</td>
                                      </tr>
                                      <tr className="small fw-bold text-uppercase">
                                          <td className="text-start ps-2 x-small">CGST Amount</td>
                                          <td colSpan="3"></td>
                                          <td className="text-end pe-2">{parseFloat(invoice.cgst_amount || 0).toFixed(2)}</td>
                                      </tr>
                                      <tr className="small fw-bold text-uppercase">
                                          <td className="text-start ps-2 x-small">SGST Amount</td>
                                          <td colSpan="3"></td>
                                          <td className="text-end pe-2">{parseFloat(invoice.sgst_amount || 0).toFixed(2)}</td>
                                      </tr>
                                      <tr className="small fw-bold text-uppercase">
                                          <td className="text-start ps-2 x-small">Round Off</td>
                                          <td colSpan="3"></td>
                                          <td className="text-end pe-2">{parseFloat(invoice.round_off || 0).toFixed(2)}</td>
                                      </tr>
                                      <tr className="h5 fw-black text-uppercase bg-light border-dark">
                                          <td className="text-start ps-2 py-2">Invoice Amount</td>
                                          <td colSpan="3" className="text-center align-middle">:</td>
                                          <td className="text-end pe-2 py-2 text-primary">₹{parseFloat(invoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                      </tr>
                                  </tfoot>
                              </table>
                          </div>
                          <div className="mt-2 text-uppercase fw-bold text-muted" style={{ fontSize: '0.6rem' }}>
                              Amount in words: <span className="text-dark">Rs. {NumberToWords(Math.round(invoice.grand_total))} Only</span>
                          </div>
                      </div>
                  )}
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

              {parseFloat(invoice.finance_amount || 0) > 0 && (
                  <div className="card shadow-sm border-0 rounded-3 mb-3 bg-white">
                      <div className="card-body p-4">
                          <h5 className="fw-bold mb-3 border-bottom pb-2">🏦 FINANCE DETAILS</h5>
                          <div className="d-flex flex-column gap-2 mb-3">
                              <div className="d-flex justify-content-between p-2 bg-light rounded">
                                  <span className="small fw-bold text-muted">FINANCER:</span>
                                  <span className="fw-bold text-primary">{invoice.financer?.name || 'FINANCE COMPANY'}</span>
                              </div>
                              <div className="d-flex justify-content-between p-2 bg-light rounded">
                                  <span className="small fw-bold text-muted">FINANCE AMOUNT:</span>
                                  <span className="fw-bold text-dark">₹{parseFloat(invoice.finance_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="d-flex justify-content-between p-2 bg-light rounded">
                                  <span className="small fw-bold text-muted">STATUS:</span>
                                  <span className={`badge ${invoice.finance_payment_status === 'RECEIVED' ? 'bg-success' : 'bg-danger'}`}>
                                      {invoice.finance_payment_status === 'RECEIVED' ? 'PAID / RECEIVED' : 'PENDING ⏳'}
                                  </span>
                              </div>
                          </div>
                          {invoice.finance_payment_status === 'PENDING' && !invoice.is_cancelled && (
                              <button 
                                  onClick={handleMarkFinanceReceived} 
                                  className="btn btn-primary w-100 fw-black py-2 shadow-sm"
                              >
                                  MARK FINANCE RECEIVED
                              </button>
                          )}
                      </div>
                  </div>
              )}

              <div className="card shadow-sm border-0 rounded-3 mb-3 bg-white">
                    <div className="card-body p-4">
                        <h5 className="fw-bold mb-3 border-bottom pb-2">💳 PAYMENT SUMMARY</h5>
                        <div className="d-flex flex-column gap-2">
                             <div className="d-flex justify-content-between p-2 bg-light rounded">
                                 <span className="small fw-bold text-muted">TOTAL BILL:</span>
                                 <span className="fw-bold text-primary">₹{parseFloat(invoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                             </div>
                             {(() => {
                               const totalDisc = parseFloat(invoice.discount || 0) +
                                 (invoice.is_cash_discount_on_bill ? parseFloat(invoice.cash_discount || 0) : 0);
                               return totalDisc > 0 ? (
                                 <div className="d-flex justify-content-between p-2 rounded" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                                   <span className="small fw-bold" style={{ color: '#92400e' }}>🏷️ DISCOUNT GIVEN:</span>
                                   <span className="fw-bold" style={{ color: '#b45309' }}>- ₹{totalDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                 </div>
                               ) : null;
                             })()}
                             {parseFloat(invoice.exchange_paid || 0) > 0 && (
                                 <div className="d-flex justify-content-between p-2 rounded text-info" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                     <span className="small fw-bold">🔄 EXCHANGE CREDIT USED:</span>
                                     <span className="fw-bold">₹{parseFloat(invoice.exchange_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                 </div>
                             )}
                             <div className="d-flex justify-content-between p-2 bg-success bg-opacity-10 rounded text-success">
                                 <span className="small fw-bold">{parseFloat(invoice.exchange_paid || 0) > 0 ? 'NET PAID (CASH/UPI):' : 'RECEIVED:'}</span>
                                 <span className="fw-bold">₹{(parseFloat(invoice.total_paid) - parseFloat(invoice.exchange_paid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                             </div>
                             {parseFloat(invoice.exchange_paid || 0) > 0 && (
                                 <div className="d-flex justify-content-between p-2 bg-light rounded text-dark border-top">
                                     <span className="small fw-bold">TOTAL RECEIVED:</span>
                                     <span className="fw-bold">₹{parseFloat(invoice.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                 </div>
                             )}
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
    </div>
  );
}
