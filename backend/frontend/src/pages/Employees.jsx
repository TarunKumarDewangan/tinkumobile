import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Modal, Button, Tabs, Tab } from 'react-bootstrap';
import api from '../api/axios';
import { formatDate } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [shops, setShops]         = useState([]);
  const { isOwner }               = useAuth();
  
  // Staff Modal
  const [showModal, setShowModal] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', address: '', designation: '',
    join_date: new Date().toISOString().slice(0, 10),
    base_salary: 0, shop_id: '', is_active: true
  });

  // Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    employee_id: '', amount: '', type: 'salary', 
    for_month: new Date().toISOString().slice(0, 7), 
    payment_date: new Date().toISOString().slice(0, 10), 
    notes: ''
  });

  // History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [filters, setFilters] = useState({
    search: '', shop_id: ''
  });

  useEffect(() => {
    loadEmployees();
    if (isOwner()) {
        api.get('/shops').then(r => setShops(r.data));
    }
  }, [filters]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/employees', { params: filters });
      setEmployees(data);
    } catch (e) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (emp) => {
    setCurrentEmployee(emp);
    setFormData({
      name: emp.name, phone: emp.phone || '', email: emp.email || '',
      address: emp.address || '', designation: emp.designation || '',
      join_date: emp.join_date ? new Date(emp.join_date).toISOString().slice(0, 10) : '',
      base_salary: emp.base_salary, shop_id: emp.shop_id, is_active: emp.is_active
    });
    setShowModal(true);
  };

  const handleAddNew = () => {
    setCurrentEmployee(null);
    setFormData({
      name: '', phone: '', email: '', address: '', designation: '',
      join_date: new Date().toISOString().slice(0, 10),
      base_salary: 0, shop_id: '', is_active: true
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (currentEmployee) {
        await api.put(`/employees/${currentEmployee.id}`, formData);
        toast.success('✅ Employee updated successfully');
      } else {
        await api.post('/employees', formData);
        toast.success('✅ New employee added');
      }
      setShowModal(false);
      loadEmployees();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error saving employee');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    try {
      await api.delete(`/employees/${id}`);
      toast.success('Employee deleted');
      loadEmployees();
    } catch (e) {
      toast.error('Error deleting employee');
    }
  };

  // ── Payment Methods ──
  const handleOpenPayment = (emp) => {
      setCurrentEmployee(emp);
      setPaymentData({
          employee_id: emp.id,
          amount: emp.base_salary || '',
          type: 'salary',
          for_month: new Date().toISOString().slice(0, 7),
          payment_date: new Date().toISOString().slice(0, 10),
          notes: ''
      });
      setShowPaymentModal(true);
  };

  const handleSavePayment = async (e) => {
      e.preventDefault();
      try {
          await api.post('/salary-payments', paymentData);
          toast.success('✅ Payment recorded successfully');
          setShowPaymentModal(false);
          loadEmployees();
      } catch (e) {
          toast.error(e.response?.data?.message || 'Error recording payment');
      }
  };

  const handleViewHistory = async (emp) => {
      setCurrentEmployee(emp);
      setShowHistoryModal(true);
      setHistoryLoading(true);
      try {
          const { data } = await api.get('/salary-payments', { params: { employee_id: emp.id } });
          setHistory(data);
      } catch (e) {
          toast.error('Failed to load history');
      } finally {
          setHistoryLoading(false);
      }
  };

  const handleDeleteHistory = async (id) => {
      if (!window.confirm('Delete this payment record?')) return;
      try {
          await api.delete(`/salary-payments/${id}`);
          toast.success('Record deleted');
          setHistory(prev => prev.filter(h => h.id !== id));
      } catch (e) {
          toast.error('Failed to delete');
      }
  };

  return (
    <div className="container-fluid py-2">
      <div className="page-header mb-3 d-flex justify-content-between align-items-center">
        <div className="text-uppercase">
           <h2 className="mb-0 fw-bold">👥 STAFF MANAGEMENT</h2>
           <p className="text-muted small mb-0">MANAGE EMPLOYEE DETAILS AND PAYROLL TRACKING</p>
        </div>
        <button onClick={handleAddNew} className="btn btn-primary shadow-sm text-uppercase fw-bold">+ Add Staff Member</button>
      </div>

      {/* Filters */}
      <div className="card shadow-sm border-0 mb-4 p-3 bg-white rounded-3">
        <div className="row g-2 text-uppercase">
            <div className="col-12 col-md-4">
                <label className="small text-muted mb-1 fw-bold">Search Staff</label>
                <input 
                    type="text" 
                    className="form-control form-control-sm text-uppercase" 
                    placeholder="NAME, PHONE OR DESIGNATION..." 
                    value={filters.search}
                    onChange={e => setFilters({...filters, search: e.target.value})}
                />
            </div>
            {isOwner() && (
                <div className="col-12 col-md-3">
                    <label className="small text-muted mb-1 fw-bold">Shop Branch</label>
                    <select 
                        className="form-select form-select-sm text-uppercase"
                        value={filters.shop_id}
                        onChange={e => setFilters({...filters, shop_id: e.target.value})}
                    >
                        <option value="">ALL BRANCHES</option>
                        {shops.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                    </select>
                </div>
            )}
        </div>
      </div>

      <div className="table-card shadow-sm border-0 bg-white rounded-3 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover mb-0 text-uppercase align-middle">
            <thead className="bg-light">
              <tr>
                <th>Name & Contact</th>
                <th>Designation</th>
                <th>Shop</th>
                <th className="text-end">Salary</th>
                <th className="text-center">Joined</th>
                <th className="text-center">Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary"/></td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-4 text-muted">NO STAFF RECORDED YET.</td></tr>
              ) : employees.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <div className="fw-bold text-dark">{emp.name.toUpperCase()}</div>
                    <div className="text-muted x-small">{emp.phone || '-'} | {emp.email || '-'}</div>
                  </td>
                  <td><span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">{emp.designation?.toUpperCase() || '-'}</span></td>
                  <td className="small text-muted">{emp.shop?.name.toUpperCase() || 'N/A'}</td>
                  <td className="text-end fw-bold">₹{parseFloat(emp.base_salary).toLocaleString('en-IN')}</td>
                  <td className="text-center small">📅 {formatDate(emp.join_date)}</td>
                  <td className="text-center">
                    <span className={`badge rounded-pill ${emp.is_active ? 'bg-success' : 'bg-danger'}`}>
                        {emp.is_active ? 'ACTIVE' : 'LEFT'}
                    </span>
                  </td>
                  <td className="text-end">
                    <div className="d-flex justify-content-end gap-1">
                        <button onClick={() => handleOpenPayment(emp)} className="btn btn-xs btn-success fw-bold">PAY</button>
                        <button onClick={() => handleViewHistory(emp)} className="btn btn-xs btn-info text-white fw-bold">HISTORY</button>
                        <button onClick={() => handleEdit(emp)} className="btn btn-xs btn-outline-secondary">EDIT</button>
                        <button onClick={() => handleDelete(emp.id)} className="btn btn-xs btn-outline-danger">DEL</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add/Edit Staff */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered className="text-uppercase" size="lg">
        <Modal.Header closeButton className="bg-dark text-white py-3">
          <Modal.Title className="fw-bold">{currentEmployee ? '✍️ EDIT STAFF MEMBER' : '➕ ADD NEW STAFF MEMBER'}</Modal.Title>
        </Modal.Header>
        <form onSubmit={handleSubmit}>
          <Modal.Body className="p-4">
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold">Staff Name <span className="text-danger">*</span></label>
                <input type="text" className="form-control text-uppercase" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold">Designation</label>
                <input type="text" className="form-control text-uppercase" placeholder="E.G. MANAGER, SALESMAN" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value.toUpperCase()})} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold">Phone Number</label>
                <input type="text" className="form-control" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold">Email Address</label>
                <input type="email" className="form-control" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              {isOwner() && (
                <div className="col-12">
                   <label className="form-label small fw-bold text-primary">Assign To Shop <span className="text-danger">*</span></label>
                   <select className="form-select border-primary" required value={formData.shop_id} onChange={e => setFormData({...formData, shop_id: e.target.value})}>
                     <option value="">— SELECT SHOP —</option>
                     {shops.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                   </select>
                </div>
              )}
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold">Monthly Salary (₹)</label>
                <input type="number" className="form-control fw-bold" value={formData.base_salary} onChange={e => setFormData({...formData, base_salary: e.target.value})} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold">Joining Date</label>
                <input type="date" className="form-control" value={formData.join_date} onChange={e => setFormData({...formData, join_date: e.target.value})} />
              </div>
              <div className="col-12 col-md-4">
                 <label className="form-label small fw-bold">Status</label>
                 <select className="form-select" value={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.value === 'true'})}>
                    <option value="true">ACTIVE</option>
                    <option value="false">LEFT / INACTIVE</option>
                 </select>
              </div>
              <div className="col-12">
                <label className="form-label small fw-bold">Full Address</label>
                <textarea className="form-control text-uppercase" rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})}></textarea>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" className="fw-bold" onClick={() => setShowModal(false)}>CANCEL</Button>
            <Button type="submit" variant="primary" className="fw-bold px-4">SAVE DETAILS</Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Modal: Record Payment (Salary/Advance/Bonus) */}
      <Modal show={showPaymentModal} onHide={() => setShowPaymentModal(false)} centered className="text-uppercase" style={{zIndex: 1100}}>
          <Modal.Header closeButton className="bg-success text-white">
              <Modal.Title className="fw-bold">💳 RECORD PAYMENT: {currentEmployee?.name}</Modal.Title>
          </Modal.Header>
          <form onSubmit={handleSavePayment}>
              <Modal.Body className="p-4">
                  <div className="mb-3">
                      <label className="form-label small fw-bold">Payment Type</label>
                      <select className="form-select border-success fw-bold" value={paymentData.type} onChange={e => setPaymentData({...paymentData, type: e.target.value})}>
                          <option value="salary">MONTHLY SALARY</option>
                          <option value="advance">ADVANCE PAYMENT</option>
                          <option value="bonus">BONUS / INCENTIVE</option>
                      </select>
                  </div>
                  <div className="row g-2 mb-3">
                      <div className="col-6">
                            <label className="form-label small fw-bold">Amount (₹)</label>
                            <input type="number" step="0.01" className="form-control fs-5 fw-bold text-success border-success" required value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} />
                      </div>
                      <div className="col-6">
                            <label className="form-label small fw-bold">Payment Date</label>
                            <input type="date" className="form-control" required value={paymentData.payment_date} onChange={e => setPaymentData({...paymentData, payment_date: e.target.value})} />
                      </div>
                  </div>
                  {paymentData.type === 'salary' && (
                      <div className="mb-3">
                            <label className="form-label small fw-bold">For Month</label>
                            <input type="month" className="form-control" required value={paymentData.for_month} onChange={e => setPaymentData({...paymentData, for_month: e.target.value})} />
                      </div>
                  )}
                  <div className="mb-0">
                      <label className="form-label small fw-bold">Notes / Reference</label>
                      <textarea className="form-control text-uppercase" rows={2} placeholder="E.G. PAID VIA CASH, PHONEPE, ETC..." value={paymentData.notes} onChange={e => setPaymentData({...paymentData, notes: e.target.value.toUpperCase()})} />
                  </div>
              </Modal.Body>
              <Modal.Footer>
                  <Button variant="secondary" className="fw-bold" onClick={() => setShowPaymentModal(false)}>CANCEL</Button>
                  <Button type="submit" variant="success" className="fw-bold px-4 shadow-sm">CONFIRM PAYMENT</Button>
              </Modal.Footer>
          </form>
      </Modal>

      {/* Modal: Payment History */}
      <Modal show={showHistoryModal} onHide={() => setShowHistoryModal(false)} centered size="lg" className="text-uppercase" style={{zIndex: 1100}}>
          <Modal.Header closeButton className="bg-info text-white">
              <Modal.Title className="fw-bold">📜 PAYMENT HISTORY: {currentEmployee?.name}</Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-0">
              <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                      <thead className="bg-light">
                          <tr>
                              <th className="ps-3">Date</th>
                              <th>Type</th>
                              <th>Description</th>
                              <th className="text-end pe-3">Amount</th>
                              <th className="text-center">Action</th>
                          </tr>
                      </thead>
                      <tbody>
                          {historyLoading ? (
                              <tr><td colSpan={5} className="text-center py-5"><div className="spinner-border text-info" /></td></tr>
                          ) : history.length === 0 ? (
                              <tr><td colSpan={5} className="text-center py-5 text-muted">NO PAYMENT RECORDS FOUND.</td></tr>
                          ) : history.map(h => (
                              <tr key={h.id}>
                                  <td className="ps-3 small fw-bold">{formatDate(h.payment_date)}</td>
                                  <td>
                                      <span className={`badge x-small ${h.type === 'salary' ? 'bg-primary' : h.type === 'advance' ? 'bg-warning text-dark' : 'bg-success'}`}>
                                          {h.type}
                                      </span>
                                  </td>
                                  <td>
                                      {h.type === 'salary' ? <div className="small fw-bold text-uppercase">Month: {h.for_month}</div> : null}
                                      <div className="x-small text-muted">{h.notes || 'No notes'}</div>
                                  </td>
                                  <td className="text-end pe-3 fw-bold">₹{parseFloat(h.amount).toLocaleString('en-IN')}</td>
                                  <td className="text-center">
                                      <button onClick={() => handleDeleteHistory(h.id)} className="btn btn-xs btn-link text-danger border-0">DEL</button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </Modal.Body>
          <Modal.Footer>
              <Button variant="secondary" className="fw-bold px-4 shadow-sm" onClick={() => setShowHistoryModal(false)}>CLOSE</Button>
          </Modal.Footer>
      </Modal>

      <style>{`
          .x-small { font-size: 0.7rem; }
          .btn-xs { padding: 2px 6px; font-size: 0.65rem; }
      `}</style>
    </div>
  );
}
