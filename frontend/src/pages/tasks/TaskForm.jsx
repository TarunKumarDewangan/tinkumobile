import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';

export default function TaskForm() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: '',
    related_type: '',
    related_id: '',
  });

  useEffect(() => {
    // Load users in the same shop for the assigned_to dropdown
    api.get('/users?per_page=200')
      .then(res => setUsers(res.data.data || res.data || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.warning('Title is required');
    if (!form.assigned_to) return toast.warning('Please select who to assign this task to');

    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.related_type) {
        delete payload.related_type;
        delete payload.related_id;
      }
      if (!payload.due_date) delete payload.due_date;

      await api.post('/tasks', payload);
      toast.success('Task created successfully');
      navigate('/tasks');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container fade-in" style={{ maxWidth: 680, margin: '0 auto' }}>
      <button type="button" className="btn btn-sm btn-outline-secondary fw-bold mb-2" onClick={() => navigate('/tasks')}>← Back</button>
      <h4 className="fw-bold mb-4">➕ New Task</h4>

      <form onSubmit={handleSubmit}>
        <div className="card shadow-sm border-0">
          <div className="card-body p-4">
            {/* Title */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Task Title *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g., Call customer for repair follow-up"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Description</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Optional details about this task"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* Assigned To */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Assign To *</label>
              <select
                className="form-select"
                value={form.assigned_to}
                onChange={e => setForm({ ...form, assigned_to: e.target.value })}
              >
                <option value="">— Select Employee —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.emp_id ? `(${u.emp_id})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority + Due Date */}
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Priority</label>
                <select
                  className="form-select"
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Due Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            </div>

            {/* Link to Record */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Link to Record (optional)</label>
              <div className="row g-2">
                <div className="col-md-4">
                  <select
                    className="form-select"
                    value={form.related_type}
                    onChange={e => setForm({ ...form, related_type: e.target.value, related_id: '' })}
                  >
                    <option value="">— None —</option>
                    <option value="repair">Repair</option>
                    <option value="sale">Sale</option>
                    <option value="customer">Customer</option>
                    <option value="airtel_retailer">Airtel Retailer</option>
                  </select>
                </div>
                <div className="col-md-8">
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Record ID (e.g., Repair #123)"
                    value={form.related_id}
                    onChange={e => setForm({ ...form, related_id: e.target.value })}
                    disabled={!form.related_type}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex gap-2 mt-4">
          <button type="submit" className="btn btn-primary px-4 rounded-pill" disabled={loading}>
            {loading ? 'Creating...' : '✓ Create Task'}
          </button>
          <button type="button" className="btn btn-outline-secondary px-4 rounded-pill" onClick={() => navigate('/tasks')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
