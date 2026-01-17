import { useState } from 'react';
import { useSettings, useMembers } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, Save, AlertTriangle, Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';

export default function Settings() {
  const { settings, loading, updateSetting, refetch } = useSettings();
  const { refetch: refetchMembers } = useMembers();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({});

  // Initialize form when settings load
  useState(() => {
    if (settings && Object.keys(settings).length > 0 && Object.keys(form).length === 0) {
      setForm(settings);
    }
  }, [settings]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      for (const [key, value] of Object.entries(form)) {
        if (settings[key] !== value) {
          await updateSetting(key, value);
        }
      }
      setMessage('Settings saved successfully!');
      await refetch();
    } catch (err) {
      setMessage('Error saving settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (deletePhrase !== 'DELETE ALL DATA') {
      alert('Please type the confirmation phrase exactly');
      return;
    }
    
    setDeleting(true);
    try {
      // Delete in order to respect foreign keys (child tables first)
      // Using .gte('created_at', '1970-01-01') to match all rows
      const tables = [
        'payments',
        'work_hours', 
        'life_eligibility_log',
        'membership_years',
        'expulsion_records',
        'status_history',
        'tier_history',
        'encumbrances',
        'members'
      ];
      
      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .gte('created_at', '1970-01-01');
        
        if (error) {
          console.error(`Error deleting from ${table}:`, error);
          throw new Error(`Failed to delete from ${table}: ${error.message}`);
        }
      }
      
      setShowDeleteConfirm(false);
      setDeletePhrase('');
      alert('All data deleted successfully');
      await refetchMembers();
    } catch (err) {
      alert('Error deleting data: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const currentForm = Object.keys(form).length > 0 ? form : settings;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Settings</h1>
        <p style={{ color: '#6b7280' }}>Configure membership rates and system options</p>
      </div>

      {message && (
        <div className={`alert ${message.includes('Error') ? 'alert-danger' : 'alert-success'}`} style={{ marginBottom: '20px' }}>
          {message}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>Dues & Fees</h2>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Regular Dues (Annual)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#6b7280' }}>$</span>
                <input
                  type="number"
                  className="form-input"
                  value={currentForm.regular_dues || ''}
                  onChange={(e) => handleChange('regular_dues', e.target.value)}
                />
              </div>
              <div className="form-help">Prorated quarterly for new members</div>
            </div>
            <div className="form-group">
              <label className="form-label">Absentee Dues (Annual)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#6b7280' }}>$</span>
                <input
                  type="number"
                  className="form-input"
                  value={currentForm.absentee_dues || ''}
                  onChange={(e) => handleChange('absentee_dues', e.target.value)}
                />
              </div>
              <div className="form-help">Flat rate, no proration</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First 5 Years Assessment</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#6b7280' }}>$</span>
                <input
                  type="number"
                  className="form-input"
                  value={currentForm.assessment_amount || ''}
                  onChange={(e) => handleChange('assessment_amount', e.target.value)}
                />
                <span style={{ color: '#6b7280' }}>/year</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Cabaret Tax Rate</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={currentForm.cabaret_tax_rate || ''}
                  onChange={(e) => handleChange('cabaret_tax_rate', e.target.value)}
                />
                <span style={{ color: '#6b7280' }}>(e.g., 0.10 = 10%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2>Work Hours</h2>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Annual Work Hours Required</label>
              <input
                type="number"
                className="form-input"
                value={currentForm.work_hours_required || ''}
                onChange={(e) => handleChange('work_hours_required', e.target.value)}
              />
              <div className="form-help">For Regular members only</div>
            </div>
            <div className="form-group">
              <label className="form-label">Buyout Rate per Hour</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#6b7280' }}>$</span>
                <input
                  type="number"
                  className="form-input"
                  value={currentForm.buyout_rate || ''}
                  onChange={(e) => handleChange('buyout_rate', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Timeclock Integration</label>
            <select
              className="form-select"
              value={currentForm.timeclock_integration || 'false'}
              onChange={(e) => handleChange('timeclock_integration', e.target.value)}
              style={{ maxWidth: '300px' }}
            >
              <option value="false">Disabled - Manual Entry Only</option>
              <option value="true">Enabled - Pull from Timeclock App</option>
            </select>
            <div className="form-help">When enabled, work hours will sync from the timeclock system</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2>Membership Rules</h2>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Minimum Age for Regular Membership</label>
              <input
                type="number"
                className="form-input"
                value={currentForm.min_age_regular || ''}
                onChange={(e) => handleChange('min_age_regular', e.target.value)}
                style={{ maxWidth: '150px' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fiscal Year Start Month</label>
              <select
                className="form-select"
                value={currentForm.fiscal_year_start_month || '7'}
                onChange={(e) => handleChange('fiscal_year_start_month', e.target.value)}
                style={{ maxWidth: '200px' }}
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <option key={m} value={m}>
                    {new Date(2000, m-1, 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Work Hour Year Start Month</label>
              <select
                className="form-select"
                value={currentForm.work_hour_year_start_month || '3'}
                onChange={(e) => handleChange('work_hour_year_start_month', e.target.value)}
                style={{ maxWidth: '200px' }}
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <option key={m} value={m}>
                    {new Date(2000, m-1, 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <button onClick={handleSave} className="btn btn-primary btn-lg" disabled={saving}>
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Current Values Summary */}
      <div className="card" style={{ marginTop: '32px' }}>
        <div className="card-header">
          <h2>Current Billing Example</h2>
        </div>
        <div className="card-body">
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            Based on current settings, a new Regular member with no work hours would owe:
          </p>
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Dues</span>
              <span>{formatCurrency(currentForm.regular_dues || 300)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Assessment (Year 1 of 5)</span>
              <span>{formatCurrency(currentForm.assessment_amount || 50)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Work Hour Buyout ({currentForm.work_hours_required || 10} hrs × {formatCurrency(currentForm.buyout_rate || 20)})</span>
              <span>{formatCurrency((currentForm.work_hours_required || 10) * (currentForm.buyout_rate || 20))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>
              <span>Subtotal</span>
              <span>{formatCurrency(
                parseFloat(currentForm.regular_dues || 300) + 
                parseFloat(currentForm.assessment_amount || 50) + 
                (parseFloat(currentForm.work_hours_required || 10) * parseFloat(currentForm.buyout_rate || 20))
              )}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Tax ({((parseFloat(currentForm.cabaret_tax_rate) || 0.10) * 100).toFixed(0)}%)</span>
              <span>{formatCurrency(
                (parseFloat(currentForm.regular_dues || 300) + 
                parseFloat(currentForm.assessment_amount || 50) + 
                (parseFloat(currentForm.work_hours_required || 10) * parseFloat(currentForm.buyout_rate || 20))) *
                parseFloat(currentForm.cabaret_tax_rate || 0.10)
              )}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>
              <span>Total</span>
              <span>{formatCurrency(
                (parseFloat(currentForm.regular_dues || 300) + 
                parseFloat(currentForm.assessment_amount || 50) + 
                (parseFloat(currentForm.work_hours_required || 10) * parseFloat(currentForm.buyout_rate || 20))) *
                (1 + parseFloat(currentForm.cabaret_tax_rate || 0.10))
              )}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="danger-zone">
        <h3><AlertTriangle size={20} style={{ display: 'inline', marginRight: '8px' }} /> Danger Zone</h3>
        <p>
          These actions are irreversible. Use with extreme caution.
        </p>
        <button onClick={() => setShowDeleteConfirm(true)} className="btn btn-danger">
          <Trash2 size={16} /> Delete All Data
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ color: '#dc2626' }}>⚠️ Delete All Data</h2>
            </div>
            <div className="modal-body">
              <p style={{ color: '#dc2626', fontWeight: '600' }}>
                This will permanently delete ALL members, payments, work hours, and history.
              </p>
              <p style={{ marginTop: '12px' }}>
                This action cannot be undone. Type <strong>DELETE ALL DATA</strong> to confirm.
              </p>
              <div className="form-group" style={{ marginTop: '16px' }}>
                <input
                  type="text"
                  className="form-input"
                  value={deletePhrase}
                  onChange={(e) => setDeletePhrase(e.target.value)}
                  placeholder="Type confirmation phrase..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button 
                onClick={handleDeleteAllData} 
                className="btn btn-danger"
                disabled={deletePhrase !== 'DELETE ALL DATA' || deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
