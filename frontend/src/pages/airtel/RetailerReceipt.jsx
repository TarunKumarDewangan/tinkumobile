import React from 'react';

const RetailerReceipt = ({ recovery, retailer }) => {
    if (!recovery || !retailer) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="receipt-container p-4 bg-white shadow-sm rounded border">
            <div className="d-print-none mb-3 text-end">
                <button onClick={handlePrint} className="btn btn-primary btn-sm">
                    <i className="bi bi-printer me-2"></i>Print Receipt
                </button>
            </div>

            <div className="printable-receipt border border-primary p-3" style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'monospace' }}>
                <div className="text-center border-bottom border-primary pb-2 mb-3">
                    <div className="small fw-bold">BILL</div>
                    <h2 className="mb-0 fw-bold text-primary" style={{ letterSpacing: '2px' }}>TINKU MOBILE</h2>
                    <div className="x-small fw-bold">NEHRU GARDEN COMPEX DHAMTARI</div>
                    <div className="x-small fw-bold">9630830999, 7869974002</div>
                    <div className="mt-1">
                         <img src="https://upload.wikimedia.org/wikipedia/commons/a/af/Airtel_logo.svg" alt="Airtel" style={{height:'15px'}} />
                    </div>
                </div>

                <div className="d-flex justify-content-between x-small fw-bold mb-1">
                    <div>S.NO. <span className="text-danger fw-bold h5">#{recovery.id}</span></div>
                    <div>DATE: {new Date(recovery.recovered_at).toLocaleDateString('en-GB')}</div>
                </div>

                <div className="x-small fw-bold mb-3">
                    NAME: <span className="border-bottom border-primary flex-grow-1 d-inline-block" style={{minWidth: '200px'}}>{retailer.name}</span>
                </div>

                <table className="table table-bordered border-primary x-small mb-3">
                    <thead className="text-center fw-bold">
                        <tr>
                            <th style={{ width: '50px' }}>S.No.</th>
                            <th>PARTICULERS</th>
                            <th style={{ width: '100px' }}>AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ minHeight: '150px' }}>
                            <td className="text-center">1</td>
                            <td style={{ minHeight: '150px', verticalAlign: 'top' }}>
                                PAYMENT RECEIVED FOR AIRTEL RECOVERY
                                {recovery.notes && <div className="mt-2 text-muted italic">Note: {recovery.notes}</div>}
                            </td>
                            <td className="text-end fw-bold">₹{parseFloat(recovery.amount).toLocaleString()}</td>
                        </tr>
                        {/* Fillers */}
                        <tr>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan="2" className="text-end fw-bold">TOTAL</td>
                            <td className="text-end fw-bold">₹{parseFloat(recovery.amount).toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>

                <div className="text-end mt-4">
                    <div className="d-inline-block text-center" style={{ minWidth: '100px' }}>
                        <div className="border-top border-primary pt-1 x-small fw-bold">SIG.</div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body * { visibility: hidden; }
                    .printable-receipt, .printable-receipt * { visibility: visible; }
                    .printable-receipt { position: absolute; left: 0; top: 0; box-shadow: none !important; border: 1px solid #000 !important; width: 100%; }
                    .d-print-none { display: none !important; }
                }
            `}} />
        </div>
    );
};

export default RetailerReceipt;
