import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import Modal from './Modal';

export default function DataBackupModal({ isOpen, onClose, onRefresh, title, endpoint, typeLabel }) {
  const [tab, setTab] = useState('export');
  const [backupType, setBackupType] = useState('full');
  const [dates, setDates] = useState({ start_date: '', end_date: '' });
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);

  const handleExport = async () => {
    if (backupType === 'duration' && (!dates.start_date || !dates.end_date)) {
      return toast.warning('Please select both start and end dates.');
    }

    try {
      setLoading(true);
      const params = backupType === 'duration' ? dates : {};
      
      const response = await api.get(`${endpoint}/backup`, {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const disposition = response.headers['content-disposition'];
      let filename = `${typeLabel.toLowerCase()}_backup.json`;
      if (disposition && disposition.includes('filename=')) {
          filename = disposition.split('filename=')[1].replace(/"/g, '');
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Backup downloaded successfully!');
      onClose();
    } catch (e) {
      toast.error('Failed to generate backup.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return toast.warning('Please select a backup file to restore.');

    if (!window.confirm(`Are you sure you want to restore this ${typeLabel} backup? Existing records with the same ID will be updated.`)) {
        return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('backup_file', file);

      const res = await api.post(`${endpoint}/restore-backup`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(res.data.message || 'Backup restored successfully!');
      if (onRefresh) onRefresh();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to restore backup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} title={title} size="md">
      <div className="mb-4">
        <ul className="nav nav-pills nav-fill">
          <li className="nav-item">
            <button className={`nav-link ${tab === 'export' ? 'active' : ''}`} onClick={() => setTab('export')}>
               💾 Export Backup
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}>
               📥 Import Backup
            </button>
          </li>
        </ul>
      </div>

      {tab === 'export' ? (
        <div className="px-2">
          <div className="mb-4">
            <div className="form-check mb-2">
              <input className="form-check-input" type="radio" name="backupType" id="fullBackup" 
                checked={backupType === 'full'} onChange={() => setBackupType('full')} />
              <label className="form-check-label fw-bold" htmlFor="fullBackup">Full Backup</label>
              <div className="text-muted small">Download all {typeLabel.toLowerCase()} currently in the system.</div>
            </div>
            
            <div className="form-check">
              <input className="form-check-input" type="radio" name="backupType" id="durationBackup" 
                checked={backupType === 'duration'} onChange={() => setBackupType('duration')} />
              <label className="form-check-label fw-bold" htmlFor="durationBackup">Duration Backup</label>
              <div className="text-muted small">Download records within a specific date range.</div>
            </div>
          </div>

          {backupType === 'duration' && (
            <div className="row g-3 mb-4 bg-light p-3 rounded">
              <div className="col-6">
                <label className="form-label x-small text-uppercase text-muted fw-bold">From Date</label>
                <input type="date" className="form-control form-control-sm" 
                  value={dates.start_date} onChange={e => setDates(p => ({...p, start_date: e.target.value}))} />
              </div>
              <div className="col-6">
                <label className="form-label x-small text-uppercase text-muted fw-bold">To Date</label>
                <input type="date" className="form-control form-control-sm" 
                  value={dates.end_date} onChange={e => setDates(p => ({...p, end_date: e.target.value}))} />
              </div>
            </div>
          )}

          <div className="d-grid mt-4">
            <button className="btn btn-primary" onClick={handleExport} disabled={loading}>
               {loading ? 'Processing...' : 'Download Backup JSON'}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-2">
          <div className="alert alert-info py-2 small">
            <strong>Note:</strong> Uploading a backup will update existing records that match by ID and insert any new records found in the file.
          </div>
          
          <div className="mb-4">
            <label className="form-label fw-bold">Select Backup File (.json)</label>
            <input type="file" className="form-control" accept=".json" 
              onChange={e => setFile(e.target.files[0])} />
          </div>

          <div className="d-grid mt-4">
            <button className="btn btn-success" onClick={handleImport} disabled={loading || !file}>
               {loading ? 'Restoring...' : 'Restore Backup'}
            </button>
          </div>
        </div>
      )}
      <style>{`
        .x-small { font-size: 0.7rem; }
      `}</style>
    </Modal>
  );
}
