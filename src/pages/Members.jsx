import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMembers } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import { Search, Plus, Eye, Edit, Trash2, Users } from 'lucide-react';
import { formatDate, calculateAge, calculateConsecutiveYears } from '../utils/calculations';
import { exportMembersToExcel } from '../utils/excel';

export default function Members() {
  const { members, loading, refetch } = useMembers();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch = search === '' || 
        m.first_name.toLowerCase().includes(search.toLowerCase()) ||
        m.last_name.toLowerCase().includes(search.toLowerCase()) ||
        m.member_number.toLowerCase().includes(search.toLowerCase()) ||
        (m.email && m.email.toLowerCase().includes(search.toLowerCase())) ||
        (m.key_fob_number && m.key_fob_number.toLowerCase().includes(search.toLowerCase()));
      
      const matchesTier = tierFilter === '' || m.tier === tierFilter;
      const matchesStatus = statusFilter === '' || m.status === statusFilter;
      
      return matchesSearch && matchesTier && matchesStatus;
    });
  }, [members, search, tierFilter, statusFilter]);

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setDeleteConfirm(null);
      refetch();
    } catch (err) {
      alert('Error deleting member: ' + err.message);
    }
  };

  const handleExport = () => {
    exportMembersToExcel(filteredMembers, `members-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

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

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Members</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleExport} className="btn btn-secondary">
            Export Excel
          </button>
          <Link to="/members/new" className="btn btn-primary">
            <Plus size={16} /> Add Member
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {/* Search and Filters */}
          <div className="search-bar">
            <div className="search-input">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search by name, member #, email, or key fob..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <select 
                className="form-select" 
                value={tierFilter} 
                onChange={(e) => setTierFilter(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="">All Tiers</option>
                <option value="Regular">Regular</option>
                <option value="Absentee">Absentee</option>
                <option value="Life">Life</option>
                <option value="Honorary">Honorary</option>
              </select>
              <select 
                className="form-select" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Deceased">Deceased</option>
                <option value="Resigned">Resigned</option>
                <option value="Expelled">Expelled</option>
              </select>
            </div>
          </div>

          {/* Results count */}
          <div style={{ marginBottom: '16px', color: '#6b7280', fontSize: '14px' }}>
            Showing {filteredMembers.length} of {members.length} members
          </div>

          {/* Members Table */}
          {filteredMembers.length === 0 ? (
            <div className="empty-state">
              <Users size={64} />
              <h3>No members found</h3>
              <p>Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member #</th>
                    <th>Name</th>
                    <th>Tier</th>
                    <th>Status</th>
                    <th>Age</th>
                    <th>Years</th>
                    <th>Join Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(member => (
                    <tr key={member.id}>
                      <td style={{ fontFamily: 'monospace' }}>{member.member_number}</td>
                      <td>
                        <Link to={`/members/${member.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '500' }}>
                          {member.last_name}, {member.first_name}
                        </Link>
                      </td>
                      <td>
                        <span className={`badge ${getTierBadgeClass(member.tier)}`}>
                          {member.tier}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(member.status)}`}>
                          {member.status}
                        </span>
                      </td>
                      <td>{calculateAge(member.date_of_birth) !== null ? calculateAge(member.date_of_birth) : '—'}</td>
                      <td>{calculateConsecutiveYears(member.original_join_date)}</td>
                      <td>{formatDate(member.original_join_date)}</td>
                      <td>
                        <div className="table-actions">
                          <Link to={`/members/${member.id}`} className="btn btn-sm btn-secondary btn-icon" title="View">
                            <Eye size={16} />
                          </Link>
                          <Link to={`/members/${member.id}/edit`} className="btn btn-sm btn-secondary btn-icon" title="Edit">
                            <Edit size={16} />
                          </Link>
                          <button 
                            onClick={() => setDeleteConfirm(member)} 
                            className="btn btn-sm btn-danger btn-icon"
                            title="Delete"
                          >
                            <Trash2 size={16} />
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Member</h2>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to permanently delete <strong>{deleteConfirm.first_name} {deleteConfirm.last_name}</strong> (#{deleteConfirm.member_number})?</p>
              <p style={{ color: '#dc2626', marginTop: '12px' }}>
                This will also delete all related records (payments, work hours, history). This action cannot be undone.
              </p>
              <p style={{ marginTop: '12px', color: '#6b7280' }}>
                Consider changing their status to Resigned or Expelled instead to preserve history.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="btn btn-danger">
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
