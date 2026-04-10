import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import api from '../../api/axios';
import { formatDate } from '../../utils/formatters';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    name: '', email: '', password: '', shop_id: '', role: 'cashier',
    phone: '', address: '', designation: '', base_salary: 0,
    joining_date: new Date().toISOString().slice(0, 10),
    aadhaar_no: '', status: 'active',
    customRole: ''
  });

  // Payroll / History Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [currentStaff, setCurrentStaff]   = useState(null);
  const [paymentData, setPaymentData]     = useState({
      user_id: '', amount: '', type: 'salary', 
      for_month: new Date().toISOString().slice(0, 7), 
      payment_date: new Date().toISOString().slice(0, 10), 
      notes: ''
  });
  const [history, setHistory]             = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const standardRoles = ['owner', 'manager', 'cashier', 'sales_person', 'computer_operator', 'stock_clerk', 'repair_tech', 'auditor', 'recovery_man'];

  const load = () => {
    setLoading(true);
    api.get('/users').then(r => setUsers(r.data)).finally(() => setLoading(false));
  };

  // ── Payroll Handlers (Consolidated) ──
  const handleOpenPayment = (staff) => {
    setCurrentStaff(staff);
    setPaymentData({
        user_id: staff.id,
        amount: staff.base_salary || '',
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
    } catch (e) {
        toast.error(e.response?.data?.message || 'Error recording payment');
    }
  };

  const handleViewHistory = async (staff) => {
    setCurrentStaff(staff);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
        const { data } = await api.get('/salary-payments', { params: { user_id: staff.id } });
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

  useEffect(() => {
    load();
    api.get('/shops').then(r => setShops(r.data));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.put(`/users/${editId}`, { ...form, role: form.role === 'other' ? form.customRole : form.role });
        toast.success('Staff details updated');
      } else {
        await api.post('/users', { ...form, role: form.role === 'other' ? form.customRole : form.role });
        toast.success('Staff account created');
      }
      setShowForm(false);
      setEditId(null);
      resetForm();
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error saving staff details');
    }
  };

  const resetForm = () => {
    setForm({
      name: '', email: '', password: '', shop_id: '', role: 'cashier',
      phone: '', address: '', designation: '', base_salary: 0,
      joining_date: new Date().toISOString().slice(0, 10),
      aadhaar_no: '', status: 'active',
      customRole: ''
    });
  };

  const handleEdit = (u) => {
    setEditId(u.id);
    const currentRole = u.roles?.[0];
    const roleName = typeof currentRole === 'object' ? currentRole.name : (currentRole || 'cashier');

    setForm({
      name: u.name,
      email: u.email,
      password: '', // Keep empty unless changing
      shop_id: u.shop_id || '',
      role: roleName,
      phone: u.phone || '',
      address: u.address || '',
      designation: u.designation || '',
      base_salary: u.base_salary || 0,
      joining_date: u.joining_date || new Date().toISOString().slice(0, 10),
      aadhaar_no: u.aadhaar_no || '',
      status: u.status || 'active',
      role: standardRoles.includes(roleName) ? roleName : 'other',
      customRole: standardRoles.includes(roleName) ? '' : roleName
    });
    setShowForm(true);
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this staff account?')) return;
    await api.delete(`/users/${id}`);
    toast.success('Deleted');
    load();
  };

  const roleColors = { 
    owner: 'badge-owner',
    Executive: 'badge-admin',
    Admin: 'badge-admin',
    admin: 'badge-admin',
    ADMIN: 'badge-admin',
    manager: 'badge-manager', 
    cashier: 'badge-cashier', 
    sales_person: 'badge-stock',
    computer_operator: 'badge-stock',
    stock_clerk: 'badge-stock', 
    repair_tech: 'badge-repair', 
    auditor: 'badge-auditor',
    recovery_man: 'badge-recovery'
  };

  return (
    <div>
      <div className="page-header">
        <h2>👤 User & Staff Management</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setEditId(null); resetForm(); }}>
          + Add New User / Staff
        </button>
      </div>

      {showForm && (
        <div className="table-card p-4 mb-3">
          <h6 className="fw-bold mb-3">{editId ? '📝 Edit User Details' : '🆕 Create New Account (Owner/Staff)'}</h6>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              {/* Basic Info */}
              <div className="col-md-3">
                <label className="form-label fw-semibold">Full Name *</label>
                <input className="form-control" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Email *</label>
                <input type="email" className="form-control" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">{editId ? 'New Password (optional)' : 'Password *'}</label>
                <input type="password" className="form-control" required={!editId} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Phone</label>
                <input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>

              {/* Assignment */}
              <div className="col-md-3">
                <label className="form-label fw-semibold">Shop / Branch *</label>
                <select className="form-select" required value={form.shop_id} onChange={e => setForm({ ...form, shop_id: e.target.value })}>
                  <option value="">— Select Shop —</option>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className={form.role === 'other' ? 'col-md-2' : 'col-md-3'}>
                <label className="form-label fw-semibold">Role *</label>
                <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="owner">Owner</option>
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="sales_person">Sales Person</option>
                  <option value="computer_operator">Computer Operator</option>
                  <option value="stock_clerk">Stock Clerk</option>
                  <option value="repair_tech">Repair Tech</option>
                  <option value="auditor">Auditor</option>
                  <option value="recovery_man">Recovery Man</option>
                  <option value="other">Other...</option>
                </select>
              </div>
              {form.role === 'other' && (
                <div className="col-md-2">
                  <label className="form-label fw-semibold">Type Role *</label>
                  <input className="form-control" required placeholder="Enter role" value={form.customRole} onChange={e => setForm({ ...form, customRole: e.target.value })} />
                </div>
              )}
              <div className="col-md-3">
                <label className="form-label fw-semibold">Designation</label>
                <input className="form-control" placeholder="e.g. Senior Technician" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Status</label>
                <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="active">🟢 Active</option>
                  <option value="inactive">🔴 Inactive</option>
                </select>
              </div>

              {/* Salary & Personal */}
              <div className="col-md-3">
                <label className="form-label fw-semibold">Base Salary (Monthly)</label>
                <div className="input-group">
                  <span className="input-group-text">₹</span>
                  <input type="number" className="form-control" value={form.base_salary} onChange={e => setForm({ ...form, base_salary: e.target.value })} />
                </div>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Joining Date</label>
                <input type="date" className="form-control" value={form.joining_date} onChange={e => setForm({ ...form, joining_date: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Aadhaar / ID No.</label>
                <input className="form-control" value={form.aadhaar_no} onChange={e => setForm({ ...form, aadhaar_no: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Address</label>
                <input className="form-control" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>

            <div className="mt-4 d-flex gap-2">
              <button type="submit" className="btn btn-primary px-4 fw-bold">
                {editId ? 'Update Staff Member' : 'Create Staff Account'}
              </button>
              <button type="button" className="btn btn-outline-secondary px-4" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
            <div className="mt-2 text-muted">Loading staff list...</div>
          </div>
        ) : (
          <div className="table-responsive-mobile">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Name & Contact</th>
                  <th>Designation</th>
                  <th>Shop</th>
                  <th>Salary</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => {
                  const roles = u.roles?.map(r => typeof r === 'object' ? r.name : r) || [];
                  return !roles.some(r => r.toLowerCase() === 'admin');
                }).map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="fw-bold">{u.name}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{u.email}</div>
                      {u.phone && <div className="text-muted" style={{ fontSize: '0.75rem' }}>📞 {u.phone}</div>}
                    </td>
                    <td>
                      <div>{u.designation || '—'}</div>
                      {u.roles?.map((r, idx) => {
                        let roleName = typeof r === 'object' ? r.name : r;
                        if (roleName?.toLowerCase() === 'admin') return null;
                        return (
                          <span key={roleName || idx} className={`role-badge ${roleColors[roleName] || roleColors[roleName?.toLowerCase()] || roleColors['other']} mt-1`} style={{ fontSize: '0.6rem' }}>
                            {roleName === 'admin' ? 'EXECUTIVE' : roleName?.replace('_', ' ').toUpperCase()}
                          </span>
                        );
                      })}
                    </td>
                    <td>{u.shop?.name || '—'}</td>
                    <td className="fw-semibold">₹{Number(u.base_salary || 0).toLocaleString('en-IN')}</td>
                    <td className="text-muted" style={{ fontSize: '0.8rem' }}>{formatDate(u.joining_date)}</td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} border`}>
                        {u.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex gap-1 justify-content-end">
                        <button className="btn btn-xs btn-success fw-bold" onClick={() => handleOpenPayment(u)}>PAY</button>
                        <button className="btn btn-xs btn-info text-white fw-bold" onClick={() => handleViewHistory(u)}>HISTORY</button>
                        <button className="btn btn-xs btn-outline-primary" onClick={() => handleEdit(u)}>Edit</button>
                        <button className="btn btn-xs btn-outline-danger" onClick={() => deleteUser(u.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-5 text-muted">
                      No staff members found. Add your first employee above!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Record Payment (Salary/Advance/Bonus) */}
      <Modal show={showPaymentModal} onHide={() => setShowPaymentModal(false)} centered className="text-uppercase" style={{zIndex: 1100}}>
          <Modal.Header closeButton className="bg-success text-white py-2">
              <Modal.Title className="fw-bold" style={{fontSize: '1.1rem'}}>💳 Record Payment: {currentStaff?.name}</Modal.Title>
          </Modal.Header>
          <form onSubmit={handleSavePayment}>
              <Modal.Body className="p-4">
                  <div className="mb-3">
                      <label className="form-label small fw-bold">Payment Type</label>
                      <select className="form-select border-success fw-bold" value={paymentData.type} onChange={e => setPaymentData({...paymentData, type: e.target.value})}>
                          <option value="salary">Monthly Salary</option>
                          <option value="advance">Advance Payment</option>
                          <option value="bonus">Bonus / Incentive</option>
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
                      <textarea className="form-control text-uppercase" rows={2} placeholder="e.g. Paid via Cash, PhonePe, etc..." value={paymentData.notes} onChange={e => setPaymentData({...paymentData, notes: e.target.value.toUpperCase()})} />
                  </div>
              </Modal.Body>
              <Modal.Footer>
                  <Button variant="secondary" className="fw-bold" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
                  <Button type="submit" variant="success" className="fw-bold px-4 shadow-sm">Confirm Payment</Button>
              </Modal.Footer>
          </form>
      </Modal>

      {/* Modal: Payment History */}
      <Modal show={showHistoryModal} onHide={() => setShowHistoryModal(false)} centered size="lg" className="text-uppercase" style={{zIndex: 1100}}>
          <Modal.Header closeButton className="bg-info text-white py-2">
              <Modal.Title className="fw-bold" style={{fontSize: '1.1rem'}}>📜 Payment History: {currentStaff?.name}</Modal.Title>
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
                              <tr><td colSpan={5} className="text-center py-5 text-muted">No payment records found.</td></tr>
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
              <Button variant="secondary" className="fw-bold px-4 shadow-sm" onClick={() => setShowHistoryModal(false)}>Close</Button>
          </Modal.Footer>
      </Modal>

      <style>{`
          .x-small { font-size: 0.7rem; }
          .btn-xs { padding: 2px 6px; font-size: 0.65rem; }
      `}</style>
    </div>
  );
}
