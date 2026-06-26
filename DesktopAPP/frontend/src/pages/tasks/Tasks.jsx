import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';

const STATUS_BADGES = {
  pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  in_progress: { bg: '#dbeafe', color: '#1e40af', label: 'In Progress' },
  completed: { bg: '#d1fae5', color: '#065f46', label: 'Completed' },
  cancelled: { bg: '#fce7f3', color: '#9d174d', label: 'Cancelled' },
};

const PRIORITY_BADGES = {
  low: { bg: '#f1f5f9', color: '#475569', label: 'Low' },
  medium: { bg: '#dbeafe', color: '#1e40af', label: 'Medium' },
  high: { bg: '#fef3c7', color: '#92400e', label: 'High' },
  urgent: { bg: '#fee2e2', color: '#991b1b', label: 'Urgent' },
};

export default function Tasks() {
  const { user, can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const statusFilter = searchParams.get('status') || '';

  const canAssign = can('assign_tasks');

  const fetchTasks = async (status = '') => {
    setLoading(true);
    try {
      const params = { per_page: 50 };
      if (status) params.status = status;
      const res = await api.get('/tasks', { params });
      setTasks(res.data.data || res.data);
      setPagination(res.data.meta || null);
    } catch (e) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks(statusFilter);
  }, [statusFilter]);

  const handleStatusFilter = (status) => {
    if (status === statusFilter) {
      setSearchParams({});
    } else if (status) {
      setSearchParams({ status });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="page-container fade-in">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0">📋 Tasks</h4>
        {canAssign && (
          <Link to="/tasks/new" className="btn btn-primary btn-sm rounded-pill px-3">
            + New Task
          </Link>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="d-flex gap-2 mb-3 flex-wrap">
        {['', 'pending', 'in_progress', 'completed', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => handleStatusFilter(s)}
            className={`btn btn-sm rounded-pill px-3 ${statusFilter === s ? 'btn-dark' : 'btn-outline-secondary'}`}
          >
            {s ? (STATUS_BADGES[s]?.label || s) : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <p style={{ fontSize: '1.1rem' }}>No tasks found</p>
          {canAssign && <Link to="/tasks/new" className="btn btn-primary btn-sm">Assign a new task</Link>}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle" style={{ fontSize: '.82rem' }}>
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Assigned To</th>
                {canAssign && <th>Assigned By</th>}
                <th>Priority</th>
                <th>Status</th>
                <th>Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id}>
                  <td className="text-muted">#{task.id}</td>
                  <td>
                    <Link to={`/tasks/${task.id}`} style={{ fontWeight: 600, color: '#1e293b', textDecoration: 'none' }}>
                      {task.title}
                    </Link>
                    {task.related_type && (
                      <span className="badge bg-light text-muted ms-2" style={{ fontSize: '.65rem' }}>
                        {task.related_type}
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{task.assigned_to?.name || '—'}</span>
                    {task.assigned_to?.emp_id && (
                      <span className="text-muted d-block" style={{ fontSize: '.68rem' }}>{task.assigned_to.emp_id}</span>
                    )}
                  </td>
                  {canAssign && (
                    <td>
                      <span className="text-muted">{task.assigned_by?.name || '—'}</span>
                    </td>
                  )}
                  <td>
                    <span className="badge" style={{ background: PRIORITY_BADGES[task.priority]?.bg, color: PRIORITY_BADGES[task.priority]?.color, fontSize: '.7rem' }}>
                      {PRIORITY_BADGES[task.priority]?.label || task.priority}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{ background: STATUS_BADGES[task.status]?.bg, color: STATUS_BADGES[task.status]?.color, fontSize: '.7rem' }}>
                      {STATUS_BADGES[task.status]?.label || task.status}
                    </span>
                  </td>
                  <td className="text-muted">{task.due_date || '—'}</td>
                  <td>
                    <Link to={`/tasks/${task.id}`} className="btn btn-sm btn-outline-primary rounded-pill" style={{ fontSize: '.72rem' }}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
