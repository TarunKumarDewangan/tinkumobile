import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
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

  const standardRoles = ['manager', 'cashier', 'sales_person', 'computer_operator', 'stock_clerk', 'repair_tech', 'auditor', 'recovery_man'];

  const load = () => {
    setLoading(true);
    api.get('/users').then(r => setUsers(r.data)).finally(() => setLoading(false));
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
    Admin: 'badge-admin',
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
        <h2>👤 Staff & Employee Management</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setEditId(null); resetForm(); }}>
          + Add Staff Member
        </button>
      </div>

      {showForm && (
        <div className="table-card p-4 mb-3">
          <h6 className="fw-bold mb-3">{editId ? '📝 Edit Staff Details' : '🆕 Add New Staff Member'}</h6>
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
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="fw-bold">{u.name}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{u.email}</div>
                      {u.phone && <div className="text-muted" style={{ fontSize: '0.75rem' }}>📞 {u.phone}</div>}
                    </td>
                    <td>
                      <div>{u.designation || '—'}</div>
                      {u.roles?.map((r, idx) => {
                        const roleName = typeof r === 'object' ? r.name : r;
                        return (
                          <span key={roleName || idx} className={`role-badge ${roleColors[roleName] || ''} mt-1`} style={{ fontSize: '0.6rem' }}>
                            {roleName?.replace('_', ' ')}
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
                      <button className="btn btn-xs btn-outline-primary me-2" onClick={() => handleEdit(u)}>Edit</button>
                      <button className="btn btn-xs btn-outline-danger" onClick={() => deleteUser(u.id)}>Del</button>
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
    </div>
  );
}
