import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMembers, useSettings } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import { Clock, Plus, Check, X, Search } from 'lucide-react';
import { formatDate, getCurrentWorkYear, getWorkHourReviewStatus } from '../utils/calculations';

export default function WorkHours() {
  const { members, loading: membersLoading } = useMembers();
  const { settings } = useSettings();
  const [workHours, setWorkHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    member_id: '',
    hours_date: new Date().toISOString().split('T')[0],
    hours_worked: '',
    description: ''
  });

  const workYear = getCurrentWorkYear();
  const reviewStatus = getWorkHourReviewStatus();
  const requiredHours = parseFloat(settings.work_hours_required || 10);

  useEffect(() => {
    fetchWorkHours();
  }, [workYear]);

  const fetchWorkHours = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('work_hours')
        .select('*, members(id, member_number, first_name, last_name)')
        .eq('work_year', workYear)
        .order('hours_date', { ascending: false });
      
      if (error) throw error;
      setWorkHours(data || []);
    } catch (err) {
      console.error('Error fetching work hours:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate hours summary per member
  const memberHoursSummary = useMemo(() => {
    if (!members) return [];
    
    const regularMembers = members.filter(m => m.tier === 'Regular' && m.status === 'Active');
    
    const allSummary = regularMembers.map(member => {
      const memberHours = workHours.filter(h => h.member_id === member.id);
      const totalHours = memberHours.reduce((sum, h) => sum + parseFloat(h.hours_worked), 0);
      const approvedHours = memberHours.filter(h => h.approved).reduce((sum, h) => sum + parseFloat(h.hours_worked), 0);
      const pendingHours = memberHours.filter(h => !h.approved).reduce((sum, h) => sum + parseFloat(h.hours_worked), 0);
      
      return {
        ...member,
        totalHours,
        approvedHours,
        pendingHours,
        hoursShort: Math.max(0, requiredHours - approvedHours),
        entries: memberHours.length
      };
    }).sort((a, b) => a.last_name.localeCompare(b.last_name));
    
    // Apply search and filters
    return allSummary.filter(summary => {
      const matchesSearch = search === '' || 
        summary.first_name.toLowerCase().includes(search.toLowerCase()) ||
        summary.last_name.toLowerCase().includes(search.toLowerCase()) ||
        summary.member_number.toLowerCase().includes(search.toLowerCase()) ||
        (summary.email && summary.email.toLowerCase().includes(search.toLowerCase()));
      
      const matchesStatus = statusFilter === '' || 
        (statusFilter === 'Complete' && summary.hoursShort === 0) ||
        (statusFilter === 'Incomplete' && summary.hoursShort > 0);
      
      return matchesSearch && matchesStatus;
    });
  }, [members, workHours, requiredHours, search, statusFilter]);

  const handleAddHours = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('work_hours').insert([{
        member_id: addForm.member_id,
        work_year: workYear,
        hours_date: addForm.hours_date,
        hours_worked: parseFloat(addForm.hours_worked),
        description: addForm.description,
        approved: false,
        source: 'Manual'
      }]);
      
      setShowAddModal(false);
      setAddForm({
        member_id: '',
        hours_date: new Date().toISOString().split('T')[0],
        hours_worked: '',
        description: ''
      });
      await fetchWorkHours();
    } catch (err) {
      alert('Error adding hours: ' + err.message);
    }
  };

  const handleApprove = async (id) => {
    try {
      await supabase.from('work_hours').update({
        approved: true,
        approved_by: 'Admin',
        approved_date: new Date().toISOString().split('T')[0]
      }).eq('id', id);
      await fetchWorkHours();
    } catch (err) {
      alert('Error approving hours: ' + err.message);
    }
  };

  const handleReject = async (id) => {
    if (!confirm('Delete this work hour entry?')) return;
    try {
      await supabase.from('work_hours').delete().eq('id', id);
      await fetchWorkHours();
    } catch (err) {
      alert('Error deleting hours: ' + err.message);
    }
  };

  const handleApproveAll = async () => {
    if (!confirm('Approve all pending work hour entries?')) return;
    try {
      await supabase.from('work_hours').update({
        approved: true,
        approved_by: 'Admin',
        approved_date: new Date().toISOString().split('T')[0]
      }).eq('work_year', workYear).eq('approved', false);
      await fetchWorkHours();
    } catch (err) {
      alert('Error approving hours: ' + err.message);
    }
  };

  const pendingEntries = workHours.filter(h => !h.approved);
  const regularMembers = members?.filter(m => m.tier === 'Regular' && m.status === 'Active') || [];

  if (loading || membersLoading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Work Hours</h1>
          <p style={{ color: '#6b7280' }}>Work Year {workYear} (Mar 1 - Feb 28)</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {pendingEntries.length > 0 && (
            <button onClick={handleApproveAll} className="btn btn-success">
              <Check size={16} /> Approve All ({pendingEntries.length})
            </button>
          )}
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus size={16} /> Add Hours
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {reviewStatus.status === 'review' && (
        <div className="alert alert-warning" style={{ marginBottom: '24px' }}>
          <Clock size={20} />
          <div>
            <strong>Work Hour Review Period</strong>
            <p style={{ margin: 0 }}>{reviewStatus.message}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Regular Members</div>
          <div className="stat-value">{regularMembers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Entries</div>
          <div className="stat-value">{workHours.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Approval</div>
          <div className="stat-value">{pendingEntries.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Members at 100%</div>
          <div className="stat-value">
            {memberHoursSummary.filter(m => m.approvedHours >= requiredHours).length}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="filter-bar" style={{ marginTop: '24px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div className="search-box" style={{ flex: 1 }}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', width: '100%' }}
          />
        </div>
        <select 
          className="form-select" 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="">All Members</option>
          <option value="Complete">Complete (100%)</option>
          <option value="Incomplete">Incomplete</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className="tab active">Member Summary</button>
      </div>

      {/* Member Hours Summary */}
      <div className="card">
        <div className="card-body">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Approved Hours</th>
                  <th>Pending</th>
                  <th>Required</th>
                  <th>Progress</th>
                  <th>Short</th>
                </tr>
              </thead>
              <tbody>
                {memberHoursSummary.map(member => (
                  <tr key={member.id}>
                    <td>
                      <Link to={`/members/${member.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                        {member.last_name}, {member.first_name}
                      </Link>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>#{member.member_number}</div>
                    </td>
                    <td>{member.approvedHours.toFixed(1)} hrs</td>
                    <td>
                      {member.pendingHours > 0 ? (
                        <span className="badge badge-warning">{member.pendingHours.toFixed(1)} hrs</span>
                      ) : '—'}
                    </td>
                    <td>{requiredHours} hrs</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                          width: '100px', 
                          height: '8px', 
                          background: '#e5e7eb', 
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${Math.min(100, (member.approvedHours / requiredHours) * 100)}%`,
                            height: '100%',
                            background: member.approvedHours >= requiredHours ? '#16a34a' : '#2563eb',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          {Math.round((member.approvedHours / requiredHours) * 100)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      {member.hoursShort > 0 ? (
                        <span style={{ color: '#dc2626' }}>{member.hoursShort.toFixed(1)} hrs</span>
                      ) : (
                        <span className="badge badge-success">Complete</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Entries */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2>Recent Entries</h2>
        </div>
        <div className="card-body">
          {workHours.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No work hour entries recorded</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Member</th>
                    <th>Hours</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workHours.slice(0, 20).map(entry => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.hours_date)}</td>
                      <td>
                        {entry.members ? (
                          <Link to={`/members/${entry.members.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                            {entry.members.last_name}, {entry.members.first_name}
                          </Link>
                        ) : 'Unknown'}
                      </td>
                      <td>{parseFloat(entry.hours_worked).toFixed(1)}</td>
                      <td>{entry.description || '—'}</td>
                      <td>
                        <span className={`badge ${entry.approved ? 'badge-success' : 'badge-warning'}`}>
                          {entry.approved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        {!entry.approved && (
                          <div className="table-actions">
                            <button onClick={() => handleApprove(entry.id)} className="btn btn-sm btn-success btn-icon" title="Approve">
                              <Check size={14} />
                            </button>
                            <button onClick={() => handleReject(entry.id)} className="btn btn-sm btn-danger btn-icon" title="Reject">
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Hours Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Work Hours</h2>
            </div>
            <form onSubmit={handleAddHours}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Member</label>
                  <select
                    className="form-select"
                    value={addForm.member_id}
                    onChange={e => setAddForm(f => ({ ...f, member_id: e.target.value }))}
                    required
                  >
                    <option value="">Select member...</option>
                    {regularMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.last_name}, {m.first_name} (#{m.member_number})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={addForm.hours_date}
                      onChange={e => setAddForm(f => ({ ...f, hours_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      className="form-input"
                      value={addForm.hours_worked}
                      onChange={e => setAddForm(f => ({ ...f, hours_worked: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    className="form-input"
                    value={addForm.description}
                    onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="e.g., Kitchen duty, Grounds maintenance"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Hours
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
