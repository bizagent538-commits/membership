import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMembers, useSettings } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import { DollarSign, FileDown, Send, Check } from 'lucide-react';
import { 
  formatCurrency, 
  getCurrentFiscalYear, 
  calculateBilling,
  getCollectionPeriodStatus 
} from '../utils/calculations';
import { exportBillingReportToExcel } from '../utils/excel';

export default function Billing() {
  const { members, loading: membersLoading } = useMembers();
  const { settings, loading: settingsLoading } = useSettings();
  const [membershipYears, setMembershipYears] = useState([]);
  const [workHoursByMember, setWorkHoursByMember] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'Check',
    type: 'Combined',
    check_number: '',
    notes: ''
  });

  const fiscalYear = getCurrentFiscalYear();
  const collectionStatus = getCollectionPeriodStatus();

  useEffect(() => {
    if (!membersLoading) {
      fetchBillingData();
    }
  }, [membersLoading, fiscalYear]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      
      // Fetch membership years for current fiscal year
      const { data: years } = await supabase
        .from('membership_years')
        .select('*')
        .eq('fiscal_year', fiscalYear);
      
      setMembershipYears(years || []);
      
      // Fetch approved work hours for all members
      const { data: hours } = await supabase
        .from('work_hours')
        .select('member_id, hours_worked')
        .eq('approved', true);
      
      const hoursByMember = {};
      (hours || []).forEach(h => {
        if (!hoursByMember[h.member_id]) hoursByMember[h.member_id] = 0;
        hoursByMember[h.member_id] += parseFloat(h.hours_worked);
      });
      setWorkHoursByMember(hoursByMember);
      
    } catch (err) {
      console.error('Error fetching billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate billing for all active members
  const billingData = useMemo(() => {
    if (!members || !settings) return [];
    
    const activeMembers = members.filter(m => m.status === 'Active');
    
    return activeMembers.map(member => {
      const workHours = workHoursByMember[member.id] || 0;
      const billing = calculateBilling(member, settings, workHours);
      const yearRecord = membershipYears.find(y => y.member_id === member.id);
      
      return {
        ...member,
        ...billing,
        work_hours_completed: workHours,
        work_hours_short: billing.workHoursShort,
        payment_status: yearRecord?.payment_status || 'Unpaid',
        total_paid: yearRecord?.total_paid || 0,
        membership_year_id: yearRecord?.id
      };
    }).filter(m => m.total > 0); // Only show members with bills
  }, [members, settings, membershipYears, workHoursByMember]);

  const handleGenerateBills = async () => {
    if (!confirm('Generate bills for all active members for fiscal year ' + fiscalYear + '?')) {
      return;
    }
    
    setGenerating(true);
    try {
      for (const bill of billingData) {
        // Check if record already exists
        const existing = membershipYears.find(y => y.member_id === bill.id);
        
        const yearData = {
          member_id: bill.id,
          fiscal_year: fiscalYear,
          dues_owed: bill.dues,
          assessment_owed: bill.assessment,
          work_hours_required: bill.workHoursRequired,
          work_hours_completed: bill.work_hours_completed,
          work_hours_bought_out: bill.work_hours_short,
          buyout_owed: bill.buyout,
          tax_owed: bill.tax,
          total_owed: bill.total,
          payment_status: 'Unpaid'
        };
        
        if (existing) {
          await supabase
            .from('membership_years')
            .update(yearData)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('membership_years')
            .insert([yearData]);
        }
      }
      
      await fetchBillingData();
      alert('Bills generated successfully!');
    } catch (err) {
      alert('Error generating bills: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      const member = showPaymentModal;
      const amount = parseFloat(paymentForm.amount);
      
      // Insert payment record
      await supabase.from('payments').insert([{
        member_id: member.id,
        membership_year_id: member.membership_year_id,
        fiscal_year: fiscalYear,
        payment_date: new Date().toISOString().split('T')[0],
        amount: amount,
        payment_method: paymentForm.method,
        payment_type: paymentForm.type,
        check_number: paymentForm.check_number || null,
        notes: paymentForm.notes || null
      }]);
      
      // Update membership year
      const newTotalPaid = (member.total_paid || 0) + amount;
      const newStatus = newTotalPaid >= member.total ? 'Paid' : 
                        newTotalPaid > 0 ? 'Partial' : 'Unpaid';
      
      if (member.membership_year_id) {
        await supabase
          .from('membership_years')
          .update({
            total_paid: newTotalPaid,
            payment_status: newStatus
          })
          .eq('id', member.membership_year_id);
      }
      
      // Update assessment years if fully paid
      if (newStatus === 'Paid' && member.assessment > 0 && member.assessment_years_completed < 5) {
        await supabase
          .from('members')
          .update({ assessment_years_completed: member.assessment_years_completed + 1 })
          .eq('id', member.id);
      }
      
      setShowPaymentModal(null);
      setPaymentForm({ amount: '', method: 'Check', type: 'Combined', check_number: '', notes: '' });
      await fetchBillingData();
    } catch (err) {
      alert('Error recording payment: ' + err.message);
    }
  };

  const handleExport = () => {
    const exportData = billingData.map(b => ({
      member_number: b.member_number,
      first_name: b.first_name,
      last_name: b.last_name,
      tier: b.tier,
      dues: b.dues,
      assessment: b.assessment,
      work_hours_required: b.workHoursRequired,
      work_hours_completed: b.work_hours_completed,
      work_hours_short: b.work_hours_short,
      buyout: b.buyout,
      subtotal: b.subtotal,
      tax: b.tax,
      total: b.total,
      payment_status: b.payment_status
    }));
    
    exportBillingReportToExcel(exportData, fiscalYear, `billing-${fiscalYear}.xlsx`);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Paid': return 'badge-success';
      case 'Partial': return 'badge-warning';
      default: return 'badge-danger';
    }
  };

  const totals = useMemo(() => {
    return billingData.reduce((acc, b) => ({
      dues: acc.dues + b.dues,
      assessment: acc.assessment + b.assessment,
      buyout: acc.buyout + b.buyout,
      tax: acc.tax + b.tax,
      total: acc.total + b.total,
      paid: acc.paid + (b.total_paid || 0)
    }), { dues: 0, assessment: 0, buyout: 0, tax: 0, total: 0, paid: 0 });
  }, [billingData]);

  if (loading || membersLoading || settingsLoading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Billing</h1>
          <p style={{ color: '#6b7280' }}>Fiscal Year {fiscalYear}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleExport} className="btn btn-secondary">
            <FileDown size={16} /> Export Excel
          </button>
          <button onClick={handleGenerateBills} className="btn btn-primary" disabled={generating}>
            <Send size={16} /> {generating ? 'Generating...' : 'Generate Bills'}
          </button>
        </div>
      </div>

      {/* Collection Status Alert */}
      {collectionStatus.status === 'open' && (
        <div className="alert alert-info" style={{ marginBottom: '24px' }}>
          <DollarSign size={20} />
          <div>
            <strong>Collection Period Open</strong>
            <p style={{ margin: 0 }}>{collectionStatus.message} — Deadline: {collectionStatus.deadline.toLocaleDateString()}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Billed</div>
          <div className="stat-value">{formatCurrency(totals.total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Collected</div>
          <div className="stat-value">{formatCurrency(totals.paid)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Outstanding</div>
          <div className="stat-value">{formatCurrency(totals.total - totals.paid)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Members Billed</div>
          <div className="stat-value">{billingData.length}</div>
        </div>
      </div>

      {/* Billing Table */}
      <div className="card">
        <div className="card-body">
          {billingData.length === 0 ? (
            <div className="empty-state">
              <DollarSign size={64} />
              <h3>No bills to display</h3>
              <p>Click "Generate Bills" to create bills for all active members</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Tier</th>
                    <th>Dues</th>
                    <th>Assessment</th>
                    <th>Hours</th>
                    <th>Buyout</th>
                    <th>Tax</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {billingData.map(bill => (
                    <tr key={bill.id}>
                      <td>
                        <Link to={`/members/${bill.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                          {bill.last_name}, {bill.first_name}
                        </Link>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>#{bill.member_number}</div>
                      </td>
                      <td>{bill.tier}</td>
                      <td>{formatCurrency(bill.dues)}</td>
                      <td>{bill.assessment > 0 ? formatCurrency(bill.assessment) : '—'}</td>
                      <td>
                        {bill.tier === 'Regular' ? (
                          <span>{bill.work_hours_completed}/{bill.workHoursRequired}</span>
                        ) : '—'}
                      </td>
                      <td>{bill.buyout > 0 ? formatCurrency(bill.buyout) : '—'}</td>
                      <td>{formatCurrency(bill.tax)}</td>
                      <td style={{ fontWeight: '600' }}>{formatCurrency(bill.total)}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(bill.payment_status)}`}>
                          {bill.payment_status}
                        </span>
                        {bill.total_paid > 0 && bill.payment_status !== 'Paid' && (
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            Paid: {formatCurrency(bill.total_paid)}
                          </div>
                        )}
                      </td>
                      <td>
                        {bill.payment_status !== 'Paid' && (
                          <button 
                            onClick={() => {
                              setShowPaymentModal(bill);
                              setPaymentForm(f => ({ ...f, amount: (bill.total - (bill.total_paid || 0)).toFixed(2) }));
                            }} 
                            className="btn btn-sm btn-success"
                          >
                            <Check size={14} /> Payment
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: '700', background: '#f3f4f6' }}>
                    <td colSpan={2}>Totals</td>
                    <td>{formatCurrency(totals.dues)}</td>
                    <td>{formatCurrency(totals.assessment)}</td>
                    <td>—</td>
                    <td>{formatCurrency(totals.buyout)}</td>
                    <td>{formatCurrency(totals.tax)}</td>
                    <td>{formatCurrency(totals.total)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Record Payment</h2>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body">
                <p style={{ marginBottom: '16px' }}>
                  Recording payment for <strong>{showPaymentModal.first_name} {showPaymentModal.last_name}</strong>
                  <br />
                  <span style={{ color: '#6b7280' }}>
                    Total due: {formatCurrency(showPaymentModal.total)} | 
                    Paid: {formatCurrency(showPaymentModal.total_paid || 0)} | 
                    Remaining: {formatCurrency(showPaymentModal.total - (showPaymentModal.total_paid || 0))}
                  </span>
                </p>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={paymentForm.amount}
                      onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Method</label>
                    <select
                      className="form-select"
                      value={paymentForm.method}
                      onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Check">Check</option>
                      <option value="Credit Card">Credit Card</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Payment Type</label>
                    <select
                      className="form-select"
                      value={paymentForm.type}
                      onChange={e => setPaymentForm(f => ({ ...f, type: e.target.value }))}
                    >
                      <option value="Combined">Combined (All)</option>
                      <option value="Dues">Dues Only</option>
                      <option value="Assessment">Assessment Only</option>
                      <option value="Buyout">Buyout Only</option>
                      <option value="Tax">Tax Only</option>
                    </select>
                  </div>
                  {paymentForm.method === 'Check' && (
                    <div className="form-group">
                      <label className="form-label">Check Number</label>
                      <input
                        type="text"
                        className="form-input"
                        value={paymentForm.check_number}
                        onChange={e => setPaymentForm(f => ({ ...f, check_number: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
                
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    value={paymentForm.notes}
                    onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowPaymentModal(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
