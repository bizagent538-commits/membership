import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMember, useSettings } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Edit, AlertTriangle, Plus, Check, X } from 'lucide-react';
import AuditHistory from '../components/AuditHistory';
import { 
  formatDate, 
  formatCurrency, 
  calculateAge, 
  calculateConsecutiveYears,
  checkLifeEligibility,
  calculateBilling 
} from '../utils/calculations';

export default function MemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { 
    member, 
    encumbrances, 
    tierHistory, 
    statusHistory, 
    membershipYears, 
    payments, 
    workHours,
    loading, 
    error,
    refetch 
  } = useMember(id);
  const { settings } = useSettings();
  
  const [showEncumbranceModal, setShowEncumbranceModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [encumbranceForm, setEncumbranceForm] = useState({ date_applied: '', reason: '' });
  const [statusForm, setStatusForm] = useState({ status: '', reason: '', expulsion_cause: '', financial_met: 'No' });
  const [tierForm, setTierForm] = useState({ tier: '', reason: '' });

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (error || !member) {
    return (
      <div className="alert alert-danger">
        {error || 'Member not found'}
        <Link to="/members" className="btn btn-secondary" style={{ marginLeft: '16px' }}>
          Back to Members
        </Link>
      </div>
    );
  }

  const age = calculateAge(member.date_of_birth);
  const consecutiveYears = calculateConsecutiveYears(member.original_join_date);
  const activeEncumbrances = encumbrances.filter(e => !e.date_removed);
  const hasActiveEncumbrance = activeEncumbrances.length > 0;
  const lifeEligibility = checkLifeEligibility(member, hasActiveEncumbrance);
  
  // Calculate total work hours for current year
  const currentYearHours = workHours
    .filter(h => h.approved)
    .reduce((sum, h) => sum + parseFloat(h.hours_worked), 0);
  
  const billing = calculateBilling(member, settings, currentYearHours);

  const getTierBadgeClass = (tier) => {
    switch (tier) {
      case 'Life': return 'badge-success';
      case 'Honorary': return 'badge-info';
      case 'Regular': return 'badge-gray';
      case 'Absentee': return 'badge-warning';
      default: return 'badge-gray';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Active': return 'badge-success';
      case 'Deceased': return 'badge-gray';
      case 'Resigned': return 'badge-warning';
      case 'Expelled': return 'badge-danger';
      default: return 'badge-gray';
    }
  };

  const handleAddEncumbrance = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('encumbrances').insert([{
        member_id: id,
        date_applied: encumbranceForm.date_applied,
        reason: encumbranceForm.reason
      }]);
      setShowEncumbranceModal(false);
      setEncumbranceForm({ date_applied: '', reason: '' });
      refetch();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleRemoveEncumbrance = async (encId) => {
    try {
      await supabase.from('encumbrances').update({
        date_removed: new Date().toISOString().split('T')[0],
        removed_by: 'Admin'
      }).eq('id', encId);
      refetch();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleStatusChange = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('members').update({ status: statusForm.status }).eq('id', id);
      
      await supabase.from('status_history').insert([{
        member_id: id,
        old_status: member.status,
        new_status: statusForm.status,
        change_date: new Date().toISOString().split('T')[0],
        reason: statusForm.reason
      }]);
      
      if (statusForm.status === 'Expelled') {
        await supabase.from('expulsion_records').insert([{
          member_id: id,
          expulsion_date: new Date().toISOString().split('T')[0],
          cause: statusForm.expulsion_cause,
          financial_obligations_met: statusForm.financial_met
        }]);
      }
      
      setShowStatusModal(false);
      setStatusForm({ status: '', reason: '', expulsion_cause: '', financial_met: 'No' });
      refetch();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleTierChange = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('members').update({ tier: tierForm.tier }).eq('id', id);
      
      await supabase.from('tier_history').insert([{
        member_id: id,
        old_tier: member.tier,
        new_tier: tierForm.tier,
        effective_date: new Date().toISOString().split('T')[0],
        reason: tierForm.reason
      }]);
      
      setShowTierModal(false);
      setTierForm({ tier: '', reason: '' });
      refetch();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div>
      <Link to="/members" className="btn btn-secondary btn-sm" style={{ marginBottom: '16px' }}>
        <ArrowLeft size={16} /> Back to Members
      </Link>

      {/* Header */}
      <div className="member-header">
        <div>
          <h1 className="member-name">{member.first_name} {member.last_name}</h1>
          <div className="member-meta">
            <span>#{member.member_number}</span>
            <span className={`badge ${getTierBadgeClass(member.tier)}`}>{member.tier}</span>
            <span className={`badge ${getStatusBadgeClass(member.status)}`}>{member.status}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setShowTierModal(true)} className="btn btn-secondary">
            Change Tier
          </button>
          <button onClick={() => setShowStatusModal(true)} className="btn btn-secondary">
            Change Status
          </button>
          <Link to={`/members/${id}/edit`} className="btn btn-primary">
            <Edit size={16} /> Edit
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {hasActiveEncumbrance && (
        <div className="alert alert-danger">
          <AlertTriangle size={20} />
          <div>
            <strong>Active Article XII Encumbrance</strong>
            <p style={{ margin: 0 }}>{activeEncumbrances[0].reason}</p>
          </div>
        </div>
      )}
      
      {lifeEligibility.eligible && member.tier !== 'Life' && (
        <div className="alert alert-success">
          <Check size={20} />
          <div>
            <strong>Eligible for Life Membership ({lifeEligibility.rule} Rule)</strong>
            <p style={{ margin: 0 }}>{lifeEligibility.reason}</p>
          </div>
        </div>
      )}

      {/* Detail Grid */}
      <div className="detail-grid">
        {/* Personal Info */}
        <div className="detail-section">
          <h3>Personal Information</h3>
          <div className="detail-row">
            <span className="detail-label">Date of Birth</span>
            <span className="detail-value">{formatDate(member.date_of_birth)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Age</span>
            <span className="detail-value">{age} years</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Email</span>
            <span className="detail-value">{member.email || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Phone</span>
            <span className="detail-value">{member.phone || '—'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Address</span>
            <span className="detail-value">
              {member.address_street ? (
                <>
                  {member.address_street}<br />
                  {member.address_city}, {member.address_state} {member.address_zip}
                </>
              ) : '—'}
            </span>
          </div>
        </div>

        {/* Membership Info */}
        <div className="detail-section">
          <h3>Membership</h3>
          <div className="detail-row">
            <span className="detail-label">Join Date</span>
            <span className="detail-value">{formatDate(member.original_join_date)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Consecutive Years</span>
            <span className="detail-value">{consecutiveYears} years</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Assessment Years</span>
            <span className="detail-value">{member.assessment_years_completed} of 5 completed</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Life Eligibility</span>
            <span className="detail-value">
              {member.tier === 'Life' ? 'Life Member' : (
                lifeEligibility.eligible ? 
                  <span style={{ color: '#16a34a' }}>Eligible ({lifeEligibility.rule})</span> :
                  <span style={{ color: '#6b7280' }}>{lifeEligibility.reason}</span>
              )}
            </span>
          </div>
        </div>

        {/* Current Billing (for Regular/Absentee) */}
        {(member.tier === 'Regular' || member.tier === 'Absentee') && member.status === 'Active' && (
          <div className="detail-section">
            <h3>Current Year Billing</h3>
            <div className="detail-row">
              <span className="detail-label">Dues</span>
              <span className="detail-value">{formatCurrency(billing.dues)}</span>
            </div>
            {billing.assessment > 0 && (
              <div className="detail-row">
                <span className="detail-label">Assessment</span>
                <span className="detail-value">{formatCurrency(billing.assessment)}</span>
              </div>
            )}
            {member.tier === 'Regular' && (
              <>
                <div className="detail-row">
                  <span className="detail-label">Work Hours</span>
                  <span className="detail-value">{currentYearHours} / {billing.workHoursRequired} hrs</span>
                </div>
                {billing.buyout > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Buyout ({billing.workHoursShort} hrs)</span>
                    <span className="detail-value">{formatCurrency(billing.buyout)}</span>
                  </div>
                )}
              </>
            )}
            <div className="detail-row">
              <span className="detail-label">Tax (10%)</span>
              <span className="detail-value">{formatCurrency(billing.tax)}</span>
            </div>
            <div className="detail-row" style={{ fontWeight: '700' }}>
              <span className="detail-label">Total</span>
              <span className="detail-value">{formatCurrency(billing.total)}</span>
            </div>
          </div>
        )}

        {/* Notes */}
        {member.notes && (
          <div className="detail-section">
            <h3>Notes</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{member.notes}</p>
          </div>
        )}
      </div>

      {/* Encumbrances Section */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2>Article XII Encumbrances</h2>
          <button onClick={() => setShowEncumbranceModal(true)} className="btn btn-sm btn-secondary">
            <Plus size={16} /> Add Encumbrance
          </button>
        </div>
        <div className="card-body">
          {encumbrances.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No encumbrances on record</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date Applied</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Date Removed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {encumbrances.map(enc => (
                  <tr key={enc.id}>
                    <td>{formatDate(enc.date_applied)}</td>
                    <td>{enc.reason}</td>
                    <td>
                      <span className={`badge ${enc.date_removed ? 'badge-gray' : 'badge-danger'}`}>
                        {enc.date_removed ? 'Removed' : 'Active'}
                      </span>
                    </td>
                    <td>{enc.date_removed ? formatDate(enc.date_removed) : '—'}</td>
                    <td>
                      {!enc.date_removed && (
                        <button 
                          onClick={() => handleRemoveEncumbrance(enc.id)} 
                          className="btn btn-sm btn-success"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Payment History */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2>Payment History</h2>
        </div>
        <div className="card-body">
          {payments.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No payment records</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Fiscal Year</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(pmt => (
                  <tr key={pmt.id}>
                    <td>{formatDate(pmt.payment_date)}</td>
                    <td>{pmt.fiscal_year}</td>
                    <td>{pmt.payment_type}</td>
                    <td>{formatCurrency(pmt.amount)}</td>
                    <td>{pmt.payment_method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Tier History */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2>Tier History</h2>
        </div>
        <div className="card-body">
          {tierHistory.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No tier changes on record</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {tierHistory.map(th => (
                  <tr key={th.id}>
                    <td>{formatDate(th.effective_date)}</td>
                    <td>{th.old_tier || '—'}</td>
                    <td>{th.new_tier}</td>
                    <td>{th.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Encumbrance Modal */}
      {showEncumbranceModal && (
        <div className="modal-overlay" onClick={() => setShowEncumbranceModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Encumbrance</h2>
            </div>
            <form onSubmit={handleAddEncumbrance}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Date Applied</label>
                  <input
                    type="date"
                    className="form-input"
                    value={encumbranceForm.date_applied}
                    onChange={e => setEncumbranceForm(f => ({ ...f, date_applied: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <textarea
                    className="form-textarea"
                    value={encumbranceForm.reason}
                    onChange={e => setEncumbranceForm(f => ({ ...f, reason: e.target.value }))}
                    required
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowEncumbranceModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Encumbrance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Change Status</h2>
            </div>
            <form onSubmit={handleStatusChange}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">New Status</label>
                  <select
                    className="form-select"
                    value={statusForm.status}
                    onChange={e => setStatusForm(f => ({ ...f, status: e.target.value }))}
                    required
                  >
                    <option value="">Select status...</option>
                    <option value="Active">Active</option>
                    <option value="Deceased">Deceased</option>
                    <option value="Resigned">Resigned</option>
                    <option value="Expelled">Expelled</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <textarea
                    className="form-textarea"
                    value={statusForm.reason}
                    onChange={e => setStatusForm(f => ({ ...f, reason: e.target.value }))}
                    rows={2}
                  />
                </div>
                {statusForm.status === 'Expelled' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Expulsion Cause (Required)</label>
                      <textarea
                        className="form-textarea"
                        value={statusForm.expulsion_cause}
                        onChange={e => setStatusForm(f => ({ ...f, expulsion_cause: e.target.value }))}
                        required
                        rows={3}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Financial Obligations Met</label>
                      <select
                        className="form-select"
                        value={statusForm.financial_met}
                        onChange={e => setStatusForm(f => ({ ...f, financial_met: e.target.value }))}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                        <option value="Partial">Partial</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowStatusModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Change Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tier Change Modal */}
      {showTierModal && (
        <div className="modal-overlay" onClick={() => setShowTierModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Change Tier</h2>
            </div>
            <form onSubmit={handleTierChange}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">New Tier</label>
                  <select
                    className="form-select"
                    value={tierForm.tier}
                    onChange={e => setTierForm(f => ({ ...f, tier: e.target.value }))}
                    required
                  >
                    <option value="">Select tier...</option>
                    <option value="Regular">Regular</option>
                    <option value="Absentee">Absentee</option>
                    <option value="Life">Life</option>
                    <option value="Honorary">Honorary</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <textarea
                    className="form-textarea"
                    value={tierForm.reason}
                    onChange={e => setTierForm(f => ({ ...f, reason: e.target.value }))}
                    rows={2}
                    placeholder="e.g., Life eligibility met, Board action, etc."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowTierModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Change Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      606       </div>
    )}
     {/* Audit History */}
     <div style={{ marginTop: '24px' }}>
      <AuditHistory 
        memberId={member.id} 
        memberName={`${member.first_name} ${member.last_name}`} 
      />
   </div>
   </div>
   );
 }
    </div>
  );
}
