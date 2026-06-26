import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';

const STATUS_META = {
  pending: { label: 'Pending', icon: '⏳', color: '#92400e', bg: '#fef3c7' },
  in_progress: { label: 'In Progress', icon: '🔄', color: '#1e40af', bg: '#dbeafe' },
  completed: { label: 'Completed', icon: '✅', color: '#065f46', bg: '#d1fae5' },
  cancelled: { label: 'Cancelled', icon: '❌', color: '#9d174d', bg: '#fce7f3' },
};

const PRIORITY_META = {
  low: { label: 'Low', color: '#475569', bg: '#f1f5f9' },
  medium: { label: 'Medium', color: '#1e40af', bg: '#dbeafe' },
  high: { label: 'High', color: '#92400e', bg: '#fef3c7' },
  urgent: { label: 'Urgent', color: '#991b1b', bg: '#fee2e2' },
};

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const [task, setTask] = useState(null);
  const [related, setRelated] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [updating, setUpdating] = useState(false);

  const canAssign = can('assign_tasks');
  const isAssignee = task?.assigned_to?.id === user?.id;

  const fetchTask = async () => {
    try {
      const res = await api.get(`/tasks/${id}`);
      setTask(res.data.task);
      setRelated(res.data.related);
      setUpdates(res.data.task.updates || []);
    } catch (e) {
      toast.error('Task not found');
      navigate('/tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTask(); }, [id]);

  const handleStatusChange = async (newStatus) => {
    if (!comment.trim() && newStatus !== task.status) {
      // For non-trivial transitions, ask for a comment
    }
    setUpdating(true);
    try {
      const res = await api.patch(`/tasks/${id}/status`, {
        status: newStatus,
        comment: comment.trim() || null,
      });
      setTask(res.data);
      setComment('');
      toast.success(`Task status changed to ${STATUS_META[newStatus]?.label}`);
      fetchTask();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this task permanently?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      toast.success('Task deleted');
      navigate('/tasks');
    } catch (e) {
      toast.error('Failed to delete task');
    }
  };

  if (loading) {
    return (
      <div className="page-container text-center py-5">
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  if (!task) return null;

  const badgeStyle = (meta) => ({
    background: meta.bg,
    color: meta.color,
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: '.75rem',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  });

  // Determine available status transitions
  const transitions = {
    pending: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: ['in_progress'],
    cancelled: ['pending'],
  };

  const availableTransitions = (transitions[task.status] || []).filter(s => {
    // Only assignee can start/complete; manager can do anything
    if (!isAssignee && !canAssign) return false;
    if (s === 'cancelled' && !canAssign) return false;
    if (s === 'in_progress' && !isAssignee && !canAssign) return false;
    if (s === 'reopen' && !canAssign) return false;
    return true;
  });

  return (
    <div className="page-container fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Back button */}
      <button onClick={() => navigate('/tasks')} className="btn btn-sm btn-outline-secondary rounded-pill mb-3">
        ← Back to Tasks
      </button>

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body p-4">
          {/* Title + Actions row */}
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h4 className="fw-bold mb-1">{task.title}</h4>
              <span className="text-muted" style={{ fontSize: '.82rem' }}>
                Task #{task.id} · Created {new Date(task.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="d-flex gap-2">
              {canAssign && (
                <button onClick={handleDelete} className="btn btn-outline-danger btn-sm rounded-pill">
                  🗑 Delete
                </button>
              )}
            </div>
          </div>

          {/* Status + Priority badges */}
          <div className="d-flex gap-3 mb-3 flex-wrap">
            <span style={badgeStyle(STATUS_META[task.status])}>
              {STATUS_META[task.status]?.icon} {STATUS_META[task.status]?.label}
            </span>
            <span style={badgeStyle(PRIORITY_META[task.priority])}>
              {task.priority}
            </span>
            {task.due_date && (
              <span className="text-muted" style={{ fontSize: '.78rem', alignSelf: 'center' }}>
                📅 Due: {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div className="mb-3 p-3" style={{ background: '#f8fafc', borderRadius: 8, fontSize: '.88rem' }}>
              {task.description}
            </div>
          )}

          {/* Assignment info */}
          <div className="d-flex gap-4 mb-3 flex-wrap" style={{ fontSize: '.82rem' }}>
            <div>
              <span className="text-muted">Assigned By:</span>
              <span className="fw-semibold ms-1">{task.assigned_by?.name || '—'}</span>
              {task.assigned_by?.emp_id && <span className="text-muted ms-1" style={{ fontSize: '.72rem' }}>({task.assigned_by.emp_id})</span>}
            </div>
            <div>
              <span className="text-muted">Assigned To:</span>
              <span className="fw-semibold ms-1">{task.assigned_to?.name || '—'}</span>
              {task.assigned_to?.emp_id && <span className="text-muted ms-1" style={{ fontSize: '.72rem' }}>({task.assigned_to.emp_id})</span>}
            </div>
          </div>

          {/* Related record */}
          {related && (
            <div className="mb-3 p-3" style={{ background: '#eef2ff', borderRadius: 8, fontSize: '.82rem' }}>
              <span className="fw-semibold">🔗 Related {task.related_type}:</span>
              {' '}
              {related.name || related.title || related.id || `#${task.related_id}`}
              {related.id && <span className="text-muted ms-1">(ID: {related.id})</span>}
            </div>
          )}

          {/* Status transition buttons */}
          <div className="d-flex gap-2 mt-4 flex-wrap">
            {availableTransitions.map(s => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className="btn btn-sm rounded-pill"
                disabled={updating}
                style={{
                  background: STATUS_META[s]?.bg,
                  color: STATUS_META[s]?.color,
                  border: `1.5px solid ${STATUS_META[s]?.color}`,
                  fontWeight: 700,
                }}
              >
                {STATUS_META[s]?.icon} Mark {STATUS_META[s]?.label}
              </button>
            ))}
          </div>

          {/* Comment input for status change */}
          {(isAssignee || canAssign) && (
            <div className="mt-3">
              <textarea
                className="form-control"
                rows={2}
                placeholder="Add a comment (optional)…"
                value={comment}
                onChange={e => setComment(e.target.value)}
                style={{ fontSize: '.82rem' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Update timeline */}
      {updates.length > 0 && (
        <div className="card shadow-sm border-0">
          <div className="card-body p-4">
            <h6 className="fw-bold mb-3">📜 Activity Log</h6>
            <div style={{ position: 'relative', paddingLeft: 24 }}>
              {/* Timeline line */}
              <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: '#e2e8f0' }} />
              {updates.map((u, i) => (
                <div key={u.id} style={{ position: 'relative', marginBottom: 16, paddingLeft: 16 }}>
                  <div style={{ position: 'absolute', left: -20, top: 4, width: 12, height: 12, borderRadius: '50%', background: u.new_status === 'completed' ? '#059669' : u.new_status === 'cancelled' ? '#dc2626' : '#6366f1', border: '2px solid #fff' }} />
                  <div style={{ fontSize: '.82rem' }}>
                    <span className="fw-semibold">{u.updated_by?.name || 'System'}</span>
                    {' '}
                    <span className="text-muted">
                      changed status from{' '}
                      <span style={{ fontWeight: 600 }}>{u.old_status || '—'}</span>
                      {' → '}
                      <span style={{ fontWeight: 600, color: STATUS_META[u.new_status]?.color }}>
                        {STATUS_META[u.new_status]?.label || u.new_status}
                      </span>
                    </span>
                    <span className="text-muted ms-2" style={{ fontSize: '.72rem' }}>
                      {new Date(u.created_at).toLocaleString()}
                    </span>
                  </div>
                  {u.comment && (
                    <div className="mt-1 p-2" style={{ background: '#f8fafc', borderRadius: 6, fontSize: '.8rem', color: '#475569' }}>
                      💬 {u.comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
