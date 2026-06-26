import { useState, useEffect } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import api from '../api/axios';
import { toast } from 'react-toastify';

export default function DuplicateImeiModal({ show, onHide, onRefresh }) {
    const [duplicates, setDuplicates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [clearing, setClearing] = useState(false);

    useEffect(() => {
        if (show) loadDuplicates();
    }, [show]);

    const loadDuplicates = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/stock-adjustments/duplicates');
            setDuplicates(data);
        } catch (error) {
            toast.error('Failed to load duplicate IMEIs');
        } finally {
            setLoading(false);
        }
    };

    const handleClear = async () => {
        if (!window.confirm(`This will permanently delete all duplicate IMEI entries, keeping only the first occurrence for each. Inventory stock will be adjusted. Proceed?`)) return;
        
        setClearing(true);
        try {
            const { data } = await api.post('/stock-adjustments/clear-duplicates');
            toast.success(data.message);
            setDuplicates([]);
            onRefresh && onRefresh();
            onHide();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to clear duplicates');
        } finally {
            setClearing(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} size="lg" centered scrollable>
            <Modal.Header closeButton className="border-0 pb-0">
                <Modal.Title className="fw-bold fs-5">🔍 Duplicate IMEI Report</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                        <div className="mt-2 text-muted small">Scanning database for duplicates...</div>
                    </div>
                ) : duplicates.length === 0 ? (
                    <div className="text-center py-5">
                        <div className="fs-1 opacity-25">✅</div>
                        <div className="fw-bold mt-2">No duplicate IMEIs found in the system.</div>
                        <div className="small text-muted">All active stock IMEIs are unique.</div>
                    </div>
                ) : (
                    <>
                        <div className="alert alert-warning py-2 mb-3" style={{fontSize: '.85rem'}}>
                            <strong>System found {duplicates.length} duplicate IMEI numbers.</strong><br/>
                            Duplicate entries usually happen due to multiple Excel imports of the same file.
                        </div>
                        <div className="list-group list-group-flush border rounded overflow-hidden">
                            {duplicates.map((dup, idx) => (
                                <div key={idx} className="list-group-item p-3">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span className="badge bg-danger rounded-pill px-3">IMEI: {dup.imei}</span>
                                        <span className="text-muted small fw-bold">{dup.count} Occurrences</span>
                                    </div>
                                    <div className="ps-2 border-start border-3 border-light-subtle">
                                        {dup.occurrences.map((occ, oidx) => (
                                            <div key={oidx} className="small mb-1 d-flex justify-content-between">
                                                <span>
                                                    <span className="fw-bold">{occ.product}</span> 
                                                    <span className="text-muted mx-2">|</span>
                                                    <span>{occ.shop}</span>
                                                    <span className="text-muted mx-2">|</span>
                                                    <span className="text-muted">{occ.date}</span>
                                                </span>
                                                <span className="text-muted italic">{occ.invoice}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </Modal.Body>
            <Modal.Footer className="border-0 pt-0">
                <Button variant="light" className="fw-bold" onClick={onHide}>Close</Button>
                {duplicates.length > 0 && (
                    <Button 
                        variant="danger" 
                        className="fw-bold shadow-sm" 
                        onClick={handleClear} 
                        disabled={clearing}
                    >
                        {clearing ? 'Clearing...' : '🗑️ Erase All Duplicates'}
                    </Button>
                )}
            </Modal.Footer>
        </Modal>
    );
}
