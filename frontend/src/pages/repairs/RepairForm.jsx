import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';

export default function RepairForm() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ 
    customer_name:'', 
    customer_phone:'', 
    customer_email:'', 
    submitted_date: new Date().toISOString().slice(0,10),
    device_model:'', 
    quoted_amount: 0,
    advance_amount: 0,
    service_center_cost: 0,
    issue_description: [''], 
    estimated_delivery_date:'',
    is_forwarded: false,
    forwarded_to: '',
    forwarded_phone: '',
    external_expected_delivery: ''
  });
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => { 
    api.get('/customers').then(r => setCustomers(r.data)); 
    api.get('/repairs/external-shops').then(r => setExternalShops(r.data));
    
    if (id) {
      api.get(`/repairs/${id}`).then(r => {
        setForm({
          ...r.data,
          submitted_date: r.data.submitted_date?.slice(0,10) || '',
          estimated_delivery_date: r.data.estimated_delivery_date?.slice(0,10) || '',
          external_expected_delivery: r.data.external_expected_delivery?.slice(0,10) || '',
          issue_description: Array.isArray(r.data.issue_description) ? r.data.issue_description : [''],
          quoted_amount: parseFloat(r.data.quoted_amount || 0),
          advance_amount: parseFloat(r.data.advance_amount || 0),
          service_center_cost: parseFloat(r.data.service_center_cost || 0),
        });
      });
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (id) {
        await api.put(`/repairs/${id}`, form);
        toast.success('Repair updated successfully');
      } else {
        await api.post('/repairs', form);
        toast.success('Repair request created');
      }
      navigate('/repairs');
    } catch (e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const f = (field) => ({ 
    value: form[field], 
    onChange: e => setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }) 
  });

  const addIssue = () => setForm({ ...form, issue_description: [...form.issue_description, ''] });
  const removeIssue = (index) => setForm({ ...form, issue_description: form.issue_description.filter((_, i) => i !== index) });
  const updateIssue = (index, val) => {
    const newIssues = [...form.issue_description];
    newIssues[index] = val;
    setForm({ ...form, issue_description: newIssues });
  };

  const selectShop = (shop) => {
    setForm({ ...form, forwarded_to: shop.forwarded_to, forwarded_phone: shop.forwarded_phone || '' });
    setShowShopList(false);
  };

  return (
    <div>
      <div className="page-header">
        <h2>{id ? '✏️ Edit Repair' : '➕ New Repair'}</h2>
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
            <div className="col-md-6">
              <label className="form-label fw-semibold">Email</label>
              <input className="form-control" type="email" {...f('customer_email')} />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Submitted Date</label>
              <input type="date" className="form-control" {...f('submitted_date')} />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Device Model *</label>
              <input className="form-control" required placeholder="e.g. Samsung Galaxy S22" {...f('device_model')} />
            </div>
            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label fw-bold small text-uppercase mb-0">Issue Description(s) *</label>
                <button type="button" className="btn btn-xs btn-outline-primary fw-bold" onClick={addIssue}>+ ADD ISSUE</button>
              </div>
              {form.issue_description.map((issue, idx) => (
                <div key={idx} className="input-group input-group-sm mb-2 animate-fade-in shadow-sm">
                  <span className="input-group-text bg-light fw-bold text-muted">{idx + 1}</span>
                  <input 
                    className="form-control text-uppercase" 
                    placeholder="Describe the issue... (e.g. Broken Display)" 
                    required 
                    value={issue} 
                    onChange={e => updateIssue(idx, e.target.value.toUpperCase())} 
                  />
                  {form.issue_description.length > 1 && (
                    <button type="button" className="btn btn-outline-danger" onClick={() => removeIssue(idx)}>✕</button>
                  )}
                </div>
              ))}
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Expected Customer Delivery</label>
              <input type="date" className="form-control border-primary" {...f('estimated_delivery_date')} />
            </div>

            <div className="col-12 border-top pt-3 mt-4">
              <h6 className="text-uppercase fw-bold small text-muted mb-3">💰 Financial Tracking</h6>
              <div className="row g-3 bg-light p-3 rounded-4 border border-info-subtle shadow-sm">
                <div className="col-md-6">
                  <label className="form-label x-small fw-bold text-uppercase opacity-75">Quoted Amount (Asking Price)</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white border-end-0">₹</span>
                    <input type="number" step="0.01" className="form-control border-start-0 fw-bold fs-5" placeholder="0.00" {...f('quoted_amount')} />
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label x-small fw-bold text-uppercase opacity-75">Advance Taken (Deposit)</label>
                  <div className="input-group">
                    <span className="input-group-text bg-white border-end-0 text-success">₹</span>
                    <input type="number" step="0.01" className="form-control border-start-0 fw-bold fs-5 text-success" placeholder="0.00" {...f('advance_amount')} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-12 border-top pt-3 mt-4">
              <div className="form-check form-switch mb-3">
                <input className="form-check-input" type="checkbox" id="isForwarded" {...f('is_forwarded')} checked={form.is_forwarded} />
                <label className="form-check-label fw-bold text-primary" htmlFor="isForwarded">Forward to Service Center / Other Repair Shop?</label>
              </div>
              
              {form.is_forwarded && (
                <div className="row g-3 animate-fade-in p-3 bg-light rounded border border-warning">
                   <div className="col-md-7 position-relative">
                      <label className="form-label small fw-bold">Name of Service Center / Repair Shop</label>
                      <input 
                        className="form-control border-warning" 
                        placeholder="e.g. Samsung Care / ABC Mobile" 
                        {...f('forwarded_to')} 
                        onFocus={() => setShowShopList(true)}
                        onBlur={() => setTimeout(() => setShowShopList(false), 200)}
                      />
                      {showShopList && externalShops.length > 0 && (
                        <div className="position-absolute w-100 bg-white shadow-sm border rounded mt-1 overflow-auto" style={{ maxHeight: 150, zIndex: 1000, left: 0 }}>
                           {externalShops
                             .filter(s => s.forwarded_to.toUpperCase().includes(form.forwarded_to.toUpperCase()))
                             .map((shop, i) => (
                               <div 
                                 key={i} 
                                 className="p-2 cursor-pointer border-bottom hover-bg-light"
                                 onMouseDown={() => selectShop(shop)}
                               >
                                 <div className="fw-bold small">{shop.forwarded_to}</div>
                                 <div className="text-muted" style={{ fontSize: '0.7rem' }}>{shop.forwarded_phone}</div>
                               </div>
                           ))}
                        </div>
                      )}
                   </div>
                   <div className="col-md-5">
                      <label className="form-label small fw-bold">External Contact No.</label>
                      <input className="form-control border-warning" placeholder="Shop Phone Number" {...f('forwarded_phone')} />
                   </div>
                   <div className="col-md-7">
                      <label className="form-label small fw-bold">Ret. Delivery to TinkuMobiles</label>
                      <input type="date" className="form-control border-warning" {...f('external_expected_delivery')} />
                   </div>
                   <div className="col-md-5">
                      <label className="form-label small fw-bold text-danger">Service Center Quote (Our Cost)</label>
                      <div className="input-group">
                        <span className="input-group-text bg-white border-end-0 text-danger small">₹</span>
                        <input type="number" step="0.01" className="form-control border-warning border-start-0 fw-bold text-danger" placeholder="0.00" {...f('service_center_cost')} />
                      </div>
                   </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4">
            <button type="submit" className="btn btn-primary me-2">{id ? 'Update Repair' : 'Create Repair'}</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/repairs')}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
