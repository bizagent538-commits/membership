import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMembers } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import { Award, Check, X, Clock } from 'lucide-react';
import { 
  formatDate, 
  calculateAge, 
  calculateConsecutiveYears, 
  checkLifeEligibility 
} from '../utils/calculations';

export default function LifeEligibility() {
  const { members, loading: membersLoading, refetch: refetchMembers } = useMembers();
  const [encumbrances, setEncumbrances] = useState([]);
  const [eligibilityLog, setEligibilityLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [encRes, logRes] = await Promise.all([
        supabase.from('encumbrances').select('member_id').is('date_removed', null),
        supabase.from('life_eligibility_log').select('*').order('date_flagged', { ascending: false })
      ]);
      
      setEncumbrances(encRes.data || []);
      setEligibilityLog(logRes.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate eligible members
  const eligibleMembers = useMemo(() => {
    if (!members) return [];
    
    const encumberedMemberIds = new Set(encumbrances.map(e => e.member_id));
    
    return members
      .filter(m => m.status === 'Active' && m.tier !== 'Life' && m.tier !== 'Honorary')
      .map(member => {
        const hasEncumbrance = encumberedMemberIds.has(member.id);
        const eligibility = checkLifeEligibility(member, hasEncumbrance);
        const existingLog = eligibilityLog.find(l => l.member_id === member.id && l.action_taken === 'Pending');
        
        return {
          ...member,
          age: calculateAge(member.date_of_birth),
          consecutiveYears: calculateConsecutiveYears(member.original_join_date),
          hasEncumbrance,
          eligibility,
          pendingReview: existingLog
        };
      })
      .filter(m => m.eligibility.eligible);
  }, [members, encumbrances, eligibilityLog]);

  // Members close to eligibility
  const nearEligibleMembers = useMemo(() => {
    if (!members) return [];
    
    const encumberedMemberIds = new Set(encumbrances.map(e => e.member_id));
    
    return members
      .filter(m => m.status === 'Active' && m.tier !== 'Life' && m.tier !== 'Honorary')
      .map(member => {
        const hasEncumbrance = encumberedMemberIds.has(member.id);
        const eligibility = checkLifeEligibility(member, hasEncumbrance);
        const age = calculateAge(member.date_of_birth);
        const years = calculateConsecutiveYears(member.original_join_date);
        
        // Check if within 2 years of any eligibility
        const nearLongevity = years >= 28 && years < 30;
        const nearStandard = age >= 60 && age < 62 && years >= 20;  // Has service, needs age
        const nearLegacy = age >= 60 && age < 62 && years >= 10 && 
          new Date(member.original_join_date) < new Date('2011-07-01');  // Has service, needs age
        
        // Calculate best path to eligibility
        let statusMessage = '';
        const yearsToLongevity = 30 - years;
        const yearsToAge = Math.max(0, 62 - age);
        const yearsToService = years >= 20 ? 0 : 20 - years;
        
        // Determine the closest path
        if (nearLongevity) {
          // Close to longevity (28-29 years)
          statusMessage = `${yearsToLongevity} years until longevity eligible`;
        } else if (nearStandard) {
          // Close to standard rule (60+ age, 18-19 years service)
          if (yearsToAge === 0) {
            // Already 62+, just need more service years
            statusMessage = `${yearsToService} more years of membership needed`;
          } else if (yearsToService === 0) {
            // Already 20+ years, just need to reach 62
            statusMessage = `${yearsToAge} years until age eligible`;
          } else {
            // Need both - show whichever is closer
            if (yearsToAge <= yearsToService) {
              statusMessage = `${yearsToAge} years until age eligible`;
            } else {
              statusMessage = `${yearsToService} more years of membership needed`;
            }
          }
        } else if (nearLegacy) {
          // Close to legacy rule (60+ age, 8-9 years service, joined before 2011)
          if (age >= 62) {
            statusMessage = `${10 - years} more years of membership needed (legacy rule)`;
          } else {
            statusMessage = `${yearsToAge} years until age eligible (legacy rule)`;
          }
        } else {
          statusMessage = eligibility.reason;
        }
        
        return {
          ...member,
          age,
          consecutiveYears: years,
          hasEncumbrance,
          eligibility,
          isNear: nearLongevity || nearStandard || nearLegacy,
          statusMessage
        };
      })
      .filter(m => !m.eligibility.eligible && m.isNear);
  }, [members, encumbrances]);

  const handleConvertToLife = async (member) => {
    if (!confirm(`Convert ${member.first_name} ${member.last_name} to Life membership?`)) return;
    
    setProcessing(member.id);
    try {
      // Update member tier
      await supabase.from('members').update({ tier: 'Life' }).eq('id', member.id);
      
      // Log tier change
      await supabase.from('tier_history').insert([{
        member_id: member.id,
        old_tier: member.tier,
        new_tier: 'Life',
        effective_date: new Date().toISOString().split('T')[0],
        reason: `Life eligibility: ${member.eligibility.rule} rule - ${member.eligibility.reason}`
      }]);
      
      // Update or create eligibility log
      if (member.pendingReview) {
        await supabase.from('life_eligibility_log').update({
          action_taken: 'Converted',
          action_date: new Date().toISOString().split('T')[0],
          reviewed_by: 'Admin'
        }).eq('id', member.pendingReview.id);
      } else {
        await supabase.from('life_eligibility_log').insert([{
          member_id: member.id,
          date_flagged: new Date().toISOString().split('T')[0],
          qualifying_rule: member.eligibility.rule,
          action_taken: 'Converted',
          action_date: new Date().toISOString().split('T')[0],
          reviewed_by: 'Admin'
        }]);
      }
      
      await fetchData();
      await refetchMembers();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDefer = async (member) => {
    const reason = prompt('Reason for deferring?');
    if (!reason) return;
    
    setProcessing(member.id);
    try {
      if (member.pendingReview) {
        await supabase.from('life_eligibility_log').update({
          action_taken: 'Deferred',
          action_date: new Date().toISOString().split('T')[0],
          admin_notes: reason,
          reviewed_by: 'Admin'
        }).eq('id', member.pendingReview.id);
      } else {
        await supabase.from('life_eligibility_log').insert([{
          member_id: member.id,
          date_flagged: new Date().toISOString().split('T')[0],
          qualifying_rule: member.eligibility.rule,
          action_taken: 'Deferred',
          action_date: new Date().toISOString().split('T')[0],
          admin_notes: reason,
          reviewed_by: 'Admin'
        }]);
      }
      
      await fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleFlagForReview = async (member) => {
    setProcessing(member.id);
    try {
      await supabase.from('life_eligibility_log').insert([{
        member_id: member.id,
        date_flagged: new Date().toISOString().split('T')[0],
        qualifying_rule: member.eligibility.rule,
        action_taken: 'Pending'
      }]);
      
      await fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(null);
    }
  };

  if (loading || membersLoading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Life Membership Eligibility</h1>
        <p style={{ color: '#6b7280' }}>Review and process Life membership conversions</p>
      </div>

      {/* Eligibility Rules Reference */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2>Eligibility Rules</h2>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
              <strong style={{ color: '#166534' }}>Longevity Rule</strong>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#166534' }}>
                30+ consecutive years of membership (any age)
              </p>
            </div>
            <div style={{ padding: '12px', background: '#dbeafe', borderRadius: '8px' }}>
              <strong style={{ color: '#1e40af' }}>Legacy Rule</strong>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#1e40af' }}>
                Joined before July 1, 2011: Age 62+, 10+ consecutive years
              </p>
            </div>
            <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '8px' }}>
              <strong style={{ color: '#92400e' }}>Standard Rule</strong>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#92400e' }}>
                Joined July 1, 2011 or after: Age 62+, 20+ consecutive years
              </p>
            </div>
          </div>
          <p style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
            All paths require no active Article XII encumbrances. Board may also grant Life status for "long and outstanding service."
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Currently Eligible</div>
          <div className="stat-value">{eligibleMembers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Near Eligibility</div>
          <div className="stat-value">{nearEligibleMembers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current Life Members</div>
          <div className="stat-value">{members?.filter(m => m.status === 'Active' && m.tier === 'Life').length || 0}</div>
        </div>
      </div>

      {/* Eligible Members */}
      <div className="card">
        <div className="card-header">
          <h2>Eligible for Life Membership</h2>
        </div>
        <div className="card-body">
          {eligibleMembers.length === 0 ? (
            <div className="empty-state">
              <Award size={64} />
              <h3>No members currently eligible</h3>
              <p>Members will appear here when they meet Life eligibility criteria</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Current Tier</th>
                    <th>Age</th>
                    <th>Years</th>
                    <th>Qualifying Rule</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleMembers.map(member => (
                    <tr key={member.id}>
                      <td>
                        <Link to={`/members/${member.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '500' }}>
                          {member.last_name}, {member.first_name}
                        </Link>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          #{member.member_number} • Joined {formatDate(member.original_join_date)}
                        </div>
                      </td>
                      <td>{member.tier}</td>
                      <td>{member.age}</td>
                      <td>{member.consecutiveYears}</td>
                      <td>
                        <span className="badge badge-success">{member.eligibility.rule}</span>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                          {member.eligibility.reason}
                        </div>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button 
                            onClick={() => handleConvertToLife(member)} 
                            className="btn btn-sm btn-success"
                            disabled={processing === member.id}
                          >
                            <Check size={14} /> Convert
                          </button>
                          <button 
                            onClick={() => handleDefer(member)} 
                            className="btn btn-sm btn-secondary"
                            disabled={processing === member.id}
                          >
                            <Clock size={14} /> Defer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Near Eligible Members */}
      {nearEligibleMembers.length > 0 && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">
            <h2>Approaching Eligibility (within 2 years)</h2>
          </div>
          <div className="card-body">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Current Tier</th>
                    <th>Age</th>
                    <th>Years</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {nearEligibleMembers.map(member => (
                    <tr key={member.id}>
                      <td>
                        <Link to={`/members/${member.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                          {member.last_name}, {member.first_name}
                        </Link>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>#{member.member_number}</div>
                      </td>
                      <td>{member.tier}</td>
                      <td>{member.age}</td>
                      <td>{member.consecutiveYears}</td>
                      <td>
                        <span style={{ color: '#6b7280', fontSize: '13px' }}>
                          {member.statusMessage}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Recent Actions */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2>Recent Eligibility Actions</h2>
        </div>
        <div className="card-body">
          {eligibilityLog.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No eligibility actions recorded</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Member</th>
                    <th>Rule</th>
                    <th>Action</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibilityLog.slice(0, 10).map(log => {
                    const member = members?.find(m => m.id === log.member_id);
                    return (
                      <tr key={log.id}>
                        <td>{formatDate(log.action_date || log.date_flagged)}</td>
                        <td>
                          {member ? (
                            <Link to={`/members/${member.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                              {member.last_name}, {member.first_name}
                            </Link>
                          ) : 'Unknown'}
                        </td>
                        <td>{log.qualifying_rule}</td>
                        <td>
                          <span className={`badge ${
                            log.action_taken === 'Converted' ? 'badge-success' :
                            log.action_taken === 'Deferred' ? 'badge-warning' :
                            log.action_taken === 'Pending' ? 'badge-info' : 'badge-gray'
                          }`}>
                            {log.action_taken}
                          </span>
                        </td>
                        <td style={{ color: '#6b7280', fontSize: '13px' }}>{log.admin_notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
