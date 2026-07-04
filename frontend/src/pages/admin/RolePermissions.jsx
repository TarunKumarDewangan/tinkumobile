import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';

const GROUPS = {
  'Core':       ['view_dashboard', 'view_customers', 'view_suppliers', 'view_staff'],
  'Sales':      ['view_sales', 'create_sales', 'edit_sales', 'delete_sales', 'convert_kaccha_to_pakka'],
  'Purchases':  ['view_purchases', 'create_purchases', 'edit_purchases', 'delete_purchases'],
  'Products':   ['view_products', 'create_products', 'edit_products', 'delete_products'],
  'Old Mobile': ['view_old_mobile_purchases', 'create_old_mobile_purchases'],
  'Recharge':   ['view_recharge_purchases', 'create_recharge_purchases', 'view_recharge_sales', 'create_recharge_sales'],
  'SIM Cards':  ['view_sims', 'purchase_sims', 'sell_sims'],
  'Repairs':    ['view_repairs', 'create_repair_requests', 'edit_repair_requests', 'assign_repair', 'update_repair_status'],
  'Follow-ups': ['view_followups', 'create_followup', 'edit_followup', 'delete_followup'],
  'Loans':      ['view_loans', 'create_loan', 'record_loan_payment'],
  'Gifts':      ['view_gifts', 'purchase_gifts', 'assign_gift_in_sale'],
  'Tasks':      ['view_tasks', 'assign_tasks', 'complete_task'],
  'Reports':    ['view_reports', 'view_all_shops_reports'],
  'Airtel':     ['view_airtel_recovery', 'manage_airtel_recovery'],
  'Admin':      ['manage_users', 'manage_shops', 'manage_roles', 'manage_incentives', 'manage_offers'],
};

const ROLE_PRESETS = {
  computer_operator: [
    'view_dashboard', 'view_customers', 'view_products',
    'view_sales', 'create_sales', 'edit_sales',
    'view_purchases', 'view_recharge_purchases', 'create_recharge_purchases',
    'view_recharge_sales', 'create_recharge_sales', 'view_sims', 'sell_sims',
    'view_old_mobile_purchases', 'view_repairs', 'create_repair_requests',
    'view_followups', 'create_followup', 'edit_followup',
    'view_tasks', 'complete_task',
  ],
  cashier: [
    'view_dashboard', 'view_customers', 'view_products', 'view_sales', 'create_sales',
    'create_recharge_sales', 'sell_sims', 'view_followups', 'create_followup', 'view_tasks', 'complete_task',
  ],
  sales_person: [
    'view_dashboard', 'view_customers', 'view_products', 'view_sales', 'create_sales',
    'view_followups', 'create_followup', 'edit_followup', 'view_tasks', 'complete_task', 'sell_sims', 'view_sims',
  ],
  stock_clerk: [
    'view_dashboard', 'view_products', 'view_purchases', 'create_purchases', 'edit_purchases', 'purchase_sims', 'purchase_gifts',
  ],
  repair_tech: [
    'view_dashboard', 'view_repairs', 'create_repair_requests', 'edit_repair_requests', 'assign_repair', 'update_repair_status',
  ],
  auditor: ['view_dashboard', 'view_reports', 'view_all_shops_reports'],
  recovery_man: ['view_dashboard', 'view_airtel_recovery'],
};

export default function RolePermissions() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null); // role name
  const [perms, setPerms]         = useState(new Set()); // current checked perms
  const [saving, setSaving]       = useState(false);
  const [dirty, setDirty]         = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await api.get('/role-permissions');
      setData(res);
      // auto-select first role
      if (res.roles?.length > 0 && !selected) {
        selectRole(res.roles[0], res);
      }
    } catch { toast.error('Failed to load role permissions'); }
    finally  { setLoading(false); }
  }

  function selectRole(role, src = data) {
    setSelected(role.name);
    setPerms(new Set(role.permissions));
    setDirty(false);
  }

  function toggle(perm) {
    setPerms(prev => {
      const next = new Set(prev);
      next.has(perm) ? next.delete(perm) : next.add(perm);
      return next;
    });
    setDirty(true);
  }

  function applyPreset() {
    const preset = ROLE_PRESETS[selected];
    if (!preset) return toast.info('No preset defined for this role');
    setPerms(new Set(preset));
    setDirty(true);
  }

  function selectAll() {
    const all = data?.permissions ?? [];
    setPerms(new Set(all));
    setDirty(true);
  }

  function clearAll() {
    setPerms(new Set());
    setDirty(true);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.post(`/role-permissions/${selected}/sync`, { permissions: [...perms] });
      toast.success(`✅ Permissions saved for ${selected}`);
      setDirty(false);
      // refresh local data
      const { data: res } = await api.get('/role-permissions');
      setData(res);
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed'); }
    finally     { setSaving(false); }
  }

  const currentRoleData = data?.roles?.find(r => r.name === selected);
  const allPerms        = data?.permissions ?? [];

  return (
    <div className="container-fluid py-3">
      <div className="page-header mb-3">
        <h2 className="fw-bold text-uppercase mb-0">🔑 Role Permissions</h2>
        <p className="text-muted small mb-0 text-uppercase">Assign what each staff role can see and do</p>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : (
        <div className="row g-3">

          {/* Left: Role List */}
          <div className="col-12 col-md-3">
            <div style={{background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden'}}>
              <div style={{padding:'12px 16px', background:'#f1f5f9', borderBottom:'1px solid #e2e8f0', fontSize:'.7rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'1px', color:'#475569'}}>
                Roles
              </div>
              {data?.roles?.map(role => {
                const isActive = role.name === selected;
                const count    = role.permissions?.length ?? 0;
                return (
                  <div key={role.name} onClick={() => selectRole(role)}
                    style={{
                      padding:'12px 16px', cursor:'pointer', borderBottom:'1px solid #f1f5f9',
                      background: isActive ? '#1e293b' : '#fff',
                      color: isActive ? '#fff' : '#1e293b',
                      transition:'all .15s',
                    }}>
                    <div style={{fontWeight:700, fontSize:'.8rem', textTransform:'uppercase'}}>{role.name.replace(/_/g, ' ')}</div>
                    <div style={{fontSize:'.65rem', color: isActive ? '#94a3b8' : '#64748b', marginTop:2}}>
                      {count} permission{count !== 1 ? 's' : ''} assigned
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Permission Grid */}
          <div className="col-12 col-md-9">
            {!selected ? (
              <div className="text-center text-muted py-5 fw-bold text-uppercase">Select a role to manage permissions</div>
            ) : (
              <>
                {/* Header */}
                <div style={{background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'16px 20px', marginBottom:12}}>
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                      <div style={{fontWeight:900, fontSize:'1.1rem', textTransform:'uppercase'}}>{selected.replace(/_/g, ' ')}</div>
                      <div style={{fontSize:'.7rem', color:'#64748b'}}>{perms.size} of {allPerms.length} permissions selected</div>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                      <button onClick={applyPreset} style={{padding:'5px 14px', fontSize:'.7rem', fontWeight:700, background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:6, cursor:'pointer', textTransform:'uppercase'}}>
                        📋 Apply Preset
                      </button>
                      <button onClick={selectAll} style={{padding:'5px 14px', fontSize:'.7rem', fontWeight:700, background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:6, cursor:'pointer', textTransform:'uppercase'}}>
                        ✅ All
                      </button>
                      <button onClick={clearAll} style={{padding:'5px 14px', fontSize:'.7rem', fontWeight:700, background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5', borderRadius:6, cursor:'pointer', textTransform:'uppercase'}}>
                        ✕ Clear
                      </button>
                      <button onClick={save} disabled={saving || !dirty}
                        style={{padding:'5px 20px', fontSize:'.75rem', fontWeight:800, background: dirty ? '#1e293b' : '#94a3b8', color:'#fff', border:'none', borderRadius:6, cursor: dirty ? 'pointer' : 'not-allowed', textTransform:'uppercase'}}>
                        {saving ? 'Saving...' : dirty ? '💾 Save Changes' : '✓ Saved'}
                      </button>
                    </div>
                  </div>
                  {dirty && (
                    <div style={{marginTop:10, padding:'8px 12px', background:'#fefce8', border:'1px solid #fde047', borderRadius:6, fontSize:'.7rem', fontWeight:700, color:'#713f12'}}>
                      ⚠️ Unsaved changes — click Save Changes to apply. Logged-in users of this role will need to re-login for changes to take effect.
                    </div>
                  )}
                </div>

                {/* Permission Groups */}
                <div className="row g-2">
                  {Object.entries(GROUPS).map(([group, groupPerms]) => {
                    const available = groupPerms.filter(p => allPerms.includes(p));
                    if (available.length === 0) return null;
                    const checkedCount = available.filter(p => perms.has(p)).length;
                    const allChecked   = checkedCount === available.length;

                    return (
                      <div key={group} className="col-12 col-sm-6 col-lg-4">
                        <div style={{background:'#fff', border:`1.5px solid ${allChecked ? '#bbf7d0' : checkedCount > 0 ? '#bfdbfe' : '#e2e8f0'}`, borderRadius:8, overflow:'hidden'}}>
                          {/* Group header with select-all toggle */}
                          <div
                            style={{
                              padding:'8px 12px', background: allChecked ? '#f0fdf4' : checkedCount > 0 ? '#eff6ff' : '#f8fafc',
                              borderBottom:'1px solid #e2e8f0', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center',
                            }}
                            onClick={() => {
                              const allOn = available.every(p => perms.has(p));
                              setPerms(prev => {
                                const next = new Set(prev);
                                available.forEach(p => allOn ? next.delete(p) : next.add(p));
                                return next;
                              });
                              setDirty(true);
                            }}
                          >
                            <span style={{fontSize:'.7rem', fontWeight:800, textTransform:'uppercase', color:'#1e293b'}}>{group}</span>
                            <span style={{fontSize:'.62rem', fontWeight:700, color: allChecked ? '#16a34a' : checkedCount > 0 ? '#1d4ed8' : '#94a3b8'}}>
                              {checkedCount}/{available.length}
                            </span>
                          </div>
                          {/* Individual permissions */}
                          <div style={{padding:'8px 12px'}}>
                            {available.map(perm => (
                              <label key={perm} style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'3px 0', fontSize:'.72rem', color:'#1e293b'}}>
                                <input type="checkbox" checked={perms.has(perm)} onChange={() => toggle(perm)}
                                  style={{width:14, height:14, accentColor:'#1e293b'}} />
                                <span style={{fontFamily:'monospace', fontSize:'.68rem', color: perms.has(perm) ? '#1e293b' : '#94a3b8'}}>
                                  {perm}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
