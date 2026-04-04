import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';

export default function RepairForm() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customer_name:'', customer_phone:'', customer_email:'', device_model:'', issue_description:'', estimated_delivery_date:'' });
  const navigate = useNavigate();

  useEffect(() => { api.get('/customers').then(r => setCustomers(r.data)); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/repairs', form);
      toast.success('Repair request created');
      navigate('/repairs');
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const f = (field) => ({ value: form[field], onChange: e => setForm({ ...form, [field]: e.target.value }) });

  return (
    <div>
      <div className="page-header">
        <h2>➕ New Repair</h2>
        <button onClick={() => navigate('/repairs')} className="btn btn-outline-secondary btn-sm">← Back</button>
      </div>
      <div className="table-card p-4" style={{ maxWidth:600 }}>
        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold">Customer Name *</label>
              <input className="form-control" required {...f('customer_name')} />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Phone *</label>
              <input className="form-control" required {...f('customer_phone')} />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Email</label>
              <input className="form-control" type="email" {...f('customer_email')} />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Device Model *</label>
              <input className="form-control" required placeholder="e.g. Samsung Galaxy S22" {...f('device_model')} />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Issue Description *</label>
              <textarea className="form-control" rows={3} required {...f('issue_description')} />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Estimated Delivery</label>
              <input type="date" className="form-control" {...f('estimated_delivery_date')} />
            </div>
          </div>
          <div className="mt-4">
            <button type="submit" className="btn btn-primary me-2">Create Repair</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/repairs')}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
