import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';

export default function Shops() {
  const [shops, setShops] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const blankForm = { name:'', address:'', phone:'', alt_phone:'', email:'', gstin:'', latitude:'', longitude:'', attendance_radius_meters: 20, shift_start_time: '10:30', shift_end_time: '20:30', monthly_leave_limit: 2 };
  const [form, setForm] = useState(blankForm);
  const [locating, setLocating] = useState(false);

  const load = () => api.get('/shops').then(r => setShops(r.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/shops/${editingId}`, form);
        toast.success('Shop updated');
      } else {
        await api.post('/shops', form);
        toast.success('Shop created');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(blankForm);
      load();
    }
    catch(e) { toast.error(e.response?.data?.message || 'Error'); }
  };

  const handleEdit = (shop) => {
    setForm({
      name: shop.name, address: shop.address, phone: shop.phone, alt_phone: shop.alt_phone || '',
      email: shop.email || '', gstin: shop.gstin || '',
      latitude: shop.latitude ?? '', longitude: shop.longitude ?? '',
      attendance_radius_meters: shop.attendance_radius_meters ?? 20,
      shift_start_time: (shop.shift_start_time || '10:30:00').slice(0, 5),
      shift_end_time: (shop.shift_end_time || '20:30:00').slice(0, 5),
      monthly_leave_limit: shop.monthly_leave_limit ?? 2,
    });
    setEditingId(shop.id);
    setShowForm(true);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location not supported by this browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(7), longitude: pos.coords.longitude.toFixed(7) }));
        setLocating(false);
        toast.success('Location captured');
      },
      () => { setLocating(false); toast.error('Failed to get location — check browser permission'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-center">
        <h2>🏪 Shops</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditingId(null); setForm(blankForm); setShowForm(true); }}>+ Add Shop</button>
      </div>
      {showForm && (
        <div className="table-card p-4 mb-3">
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12 col-md-4"><input className="form-control" placeholder="Shop Name *" required value={form.name} onChange={e => setForm({...form, name:e.target.value})} /></div>
              <div className="col-12 col-md-4"><input className="form-control" placeholder="Phone *" required value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} /></div>
              <div className="col-12 col-md-4"><input className="form-control" placeholder="Alternative Mobile No" value={form.alt_phone} onChange={e => setForm({...form, alt_phone:e.target.value})} /></div>
              <div className="col-12 col-md-4"><input className="form-control" placeholder="Email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} /></div>
              <div className="col-12 col-md-8"><input className="form-control" placeholder="Address *" required value={form.address} onChange={e => setForm({...form, address:e.target.value})} /></div>
              <div className="col-12 col-md-4"><input className="form-control" placeholder="GSTIN" value={form.gstin} onChange={e => setForm({...form, gstin:e.target.value})} /></div>
            </div>

            <div className="mt-3 pt-3 border-top">
              <label className="form-label small fw-bold text-uppercase text-muted">📍 Attendance Location (for Staff Attendance's GPS check)</label>
              <div className="row g-3">
                <div className="col-6 col-md-3"><input type="number" step="any" className="form-control" placeholder="Latitude" value={form.latitude} onChange={e => setForm({...form, latitude:e.target.value})} /></div>
                <div className="col-6 col-md-3"><input type="number" step="any" className="form-control" placeholder="Longitude" value={form.longitude} onChange={e => setForm({...form, longitude:e.target.value})} /></div>
                <div className="col-6 col-md-3"><input type="number" className="form-control" placeholder="Radius (m)" value={form.attendance_radius_meters} onChange={e => setForm({...form, attendance_radius_meters:e.target.value})} /></div>
                <div className="col-6 col-md-3">
                  <button type="button" className="btn btn-outline-secondary btn-sm w-100 h-100" disabled={locating} onClick={useCurrentLocation}>
                    {locating ? 'Locating...' : '📡 Use My Location'}
                  </button>
                </div>
              </div>
              <div className="form-text">Staff must be within this radius of these coordinates to check in/out. Stand at the shop and click "Use My Location" for an easy accurate set.</div>

              <div className="row g-3 mt-1">
                <div className="col-6 col-md-3">
                  <label className="form-label small">Shift Start</label>
                  <input type="time" className="form-control" value={form.shift_start_time} onChange={e => setForm({...form, shift_start_time:e.target.value})} />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small">Shift End</label>
                  <input type="time" className="form-control" value={form.shift_end_time} onChange={e => setForm({...form, shift_end_time:e.target.value})} />
                </div>
              </div>
              <div className="form-text">Arriving after Shift Start is flagged "Delay"; leaving before Shift End (as the day's final checkout) is flagged "Early Leave" in the Attendance Report.</div>

              <div className="row g-3 mt-1">
                <div className="col-6 col-md-3">
                  <label className="form-label small">Monthly Leave Limit</label>
                  <input type="number" min="0" max="31" className="form-control" value={form.monthly_leave_limit} onChange={e => setForm({...form, monthly_leave_limit:e.target.value})} />
                </div>
              </div>
              <div className="form-text">Max Leave days (Full + Half combined) "Mark Leave" allows per staff member per month — marking beyond this is blocked with a message. Raise it here if needed.</div>
            </div>

            <div className="mt-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm">{editingId ? 'Update Shop' : 'Create Shop'}</button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setShowForm(false); setEditingId(null); setForm(blankForm); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      <div className="row g-3">
        {shops.map(s => (
          <div key={s.id} className="col-12 col-md-4">
            <div className="table-card p-4">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <h6 className="fw-bold mb-0">{s.name}</h6>
                <div>
                    {s.is_main && <span className="badge bg-primary me-2">Main</span>}
                    <button className="btn btn-xs btn-outline-secondary px-2 py-0" onClick={() => handleEdit(s)}>✎</button>
                </div>
              </div>
              <div className="text-muted" style={{ fontSize:'0.85rem' }}>
                <div>📞 {s.phone}{s.alt_phone && ` / ${s.alt_phone}`}</div>
                <div>📧 {s.email || '—'}</div>
                <div>📍 {s.address}</div>
                <div>🏢 GSTIN: <span className="fw-bold">{s.gstin || '—'}</span></div>
                <div>🎯 Attendance: {s.latitude && s.longitude ? `${s.latitude}, ${s.longitude} (±${s.attendance_radius_meters}m)` : <span className="text-danger">Not set up</span>}</div>
                <div>⏰ Shift: {(s.shift_start_time || '10:30:00').slice(0,5)} – {(s.shift_end_time || '20:30:00').slice(0,5)}</div>
                <div>🏖️ Monthly Leave Limit: {s.monthly_leave_limit ?? 2}</div>
              </div>
            </div>
          </div>
        ))}
        {shops.length === 0 && <div className="col"><div className="table-card p-4 text-center text-muted">No shops</div></div>}
      </div>
    </div>
  );
}
