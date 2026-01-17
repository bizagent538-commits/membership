// WaitlistReport.jsx - Waitlist Report Page
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  Clock, 
  Calendar, 
  Download, 
  Upload,
  ArrowUp,
  ArrowDown,
  Search,
  UserPlus,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function WaitlistReport() {
  const [waitlist, setWaitlist] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);

  useEffect(() => {
    fetchWaitlist();
  }, []);

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      // Fetch waitlist members
      const { data: members, error } = await supabase
        .from('members')
        .select('*')
        .eq('tier', 'Waitlist')
        .order('waitlist_position', { ascending: true });

      if (error) throw error;
      setWaitlist(members || []);

      // Calculate stats
      if (members && members.length > 0) {
        const today = new Date();
        const waitDays = members.map(m => {
          if (!m.waitlist_date) return 0;
          const added = new Date(m.waitlist_date);
          return Math.floor((today - added) / (1000 * 60 * 60 * 24));
        });

        setStats({
          total: members.length,
          longestWait: Math.max(...waitDays),
          averageWait: Math.round(waitDays.reduce((a, b) => a + b, 0) / waitDays.length),
          addedThisMonth: members.filter(m => {
            if (!m.waitlist_date) return false;
            const added = new Date(m.waitlist_date);
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            return added >= monthStart;
          }).length
        });
      } else {
        setStats({ total: 0, longestWait: 0, averageWait: 0, addedThisMonth: 0 });
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysWaiting = (date) => {
    if (!date) return 0;
    const added = new Date(date);
    const today = new Date();
    return Math.floor((today - added) / (1000 * 60 * 60 * 24));
  };

  // Filter waitlist by search
  const filteredWaitlist = waitlist.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.first_name?.toLowerCase().includes(q) ||
      m.last_name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.member_number?.toLowerCase().includes(q)
    );
  });

  // Export to Excel
  const exportToExcel = () => {
    const data = waitlist.map(m => ({
      'Position': m.waitlist_position,
      'Member #': m.member_number,
      'First Name': m.first_name,
      'Last Name': m.last_name,
      'Email': m.email || '',
      'Phone': m.phone || '',
      'Date Added': m.waitlist_date || '',
      'Days Waiting': getDaysWaiting(m.waitlist_date),
      'Notes': m.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Waitlist');
    XLSX.writeFile(wb, `waitlist-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Import from Excel
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setImportResults(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      let imported = 0;
      let errors = [];

      // Get current max position
      const { data: maxData } = await supabase
        .from('members')
        .select('waitlist_position')
        .eq('tier', 'Waitlist')
        .order('waitlist_position', { ascending: false })
        .limit(1);

      let nextPosition = (maxData?.[0]?.waitlist_position || 0) + 1;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        // Map Excel columns (flexible naming)
        const firstName = row['First Name'] || row['first_name'] || row['FirstName'] || '';
        const lastName = row['Last Name'] || row['last_name'] || row['LastName'] || '';
        const email = row['Email'] || row['email'] || '';
        const phone = row['Phone'] || row['phone'] || '';
        const notes = row['Notes'] || row['notes'] || '';
        const dateAdded = row['Date Added'] || row['date_added'] || row['waitlist_date'] || null;

        if (!firstName || !lastName) {
          errors.push(`Row ${i + 2}: Missing first or last name`);
          continue;
        }

        // Generate member number for waitlist
        const memberNumber = `W${Date.now()}-${i}`;

        // Parse date
        let waitlistDate = null;
        if (dateAdded) {
          try {
            const d = new Date(dateAdded);
            if (!isNaN(d.getTime())) {
              waitlistDate = d.toISOString().split('T')[0];
            }
          } catch (e) {
            // Use today if date invalid
          }
        }
        if (!waitlistDate) {
          waitlistDate = new Date().toISOString().split('T')[0];
        }

        const { error } = await supabase.from('members').insert({
          member_number: memberNumber,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          notes: notes?.trim() || null,
          tier: 'Waitlist',
          status: 'Active',
          waitlist_date: waitlistDate,
          waitlist_position: nextPosition,
          date_of_birth: '1900-01-01', // Placeholder - required field
          original_join_date: waitlistDate
        });

        if (error) {
          errors.push(`Row ${i + 2}: ${error.message}`);
        } else {
          imported++;
          nextPosition++;
        }
      }

      setImportResults({ imported, errors });
      fetchWaitlist(); // Refresh list
    } catch (error) {
      setImportResults({ imported: 0, errors: [error.message] });
    } finally {
      setImporting(false);
      e.target.value = ''; // Reset file input
    }
  };

  // Move member up in waitlist
  const moveUp = async (member) => {
    if (member.waitlist_position <= 1) return;
    
    const memberAbove = waitlist.find(m => m.waitlist_position === member.waitlist_position - 1);
    if (!memberAbove) return;

    await supabase.from('members').update({ waitlist_position: member.waitlist_position }).eq('id', memberAbove.id);
    await supabase.from('members').update({ waitlist_position: member.waitlist_position - 1 }).eq('id', member.id);
    fetchWaitlist();
  };

  // Move member down in waitlist
  const moveDown = async (member) => {
    if (member.waitlist_position >= waitlist.length) return;
    
    const memberBelow = waitlist.find(m => m.waitlist_position === member.waitlist_position + 1);
    if (!memberBelow) return;

    await supabase.from('members').update({ waitlist_position: member.waitlist_position }).eq('id', memberBelow.id);
    await supabase.from('members').update({ waitlist_position: member.waitlist_position + 1 }).eq('id', member.id);
    fetchWaitlist();
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Waitlist</h1>
          <p className="text-muted">{stats?.total || 0} people waiting</p>
        </div>
        <div className="header-actions">
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={16} />
            Import Excel
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              style={{ display: 'none' }}
              disabled={importing}
            />
          </label>
          <button onClick={exportToExcel} className="btn btn-secondary" disabled={waitlist.length === 0}>
            <Download size={16} />
            Export
          </button>
          <Link to="/members/new?tier=Waitlist" className="btn btn-primary">
            <UserPlus size={16} />
            Add to Waitlist
          </Link>
        </div>
      </div>

      {/* Import Results */}
      {importResults && (
        <div className={`alert ${importResults.errors.length > 0 ? 'alert-warning' : 'alert-success'}`}>
          <div>
            <strong>Import Complete:</strong> {importResults.imported} added to waitlist
            {importResults.errors.length > 0 && (
              <ul style={{ marginTop: '8px', marginBottom: 0 }}>
                {importResults.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {importResults.errors.length > 5 && (
                  <li>...and {importResults.errors.length - 5} more errors</li>
                )}
              </ul>
            )}
          </div>
          <button onClick={() => setImportResults(null)} className="btn btn-sm">✕</button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#e0e7ff' }}>
              <Users size={24} color="#4f46e5" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total on Waitlist</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#fef3c7' }}>
              <Clock size={24} color="#d97706" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.longestWait}</div>
              <div className="stat-label">Longest Wait (days)</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#d1fae5' }}>
              <Calendar size={24} color="#059669" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.averageWait}</div>
              <div className="stat-label">Average Wait (days)</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#ede9fe' }}>
              <UserPlus size={24} color="#7c3aed" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.addedThisMonth}</div>
              <div className="stat-label">Added This Month</div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card">
        <div className="card-body" style={{ padding: '16px' }}>
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search waitlist..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Waitlist Table */}
      <div className="card">
        <div className="card-header">
          <h2>Waitlist Order</h2>
          <button onClick={fetchWaitlist} className="btn btn-sm btn-secondary">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Date Added</th>
                <th>Days Waiting</th>
                <th style={{ width: '120px' }}>Reorder</th>
                <th style={{ width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWaitlist.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    {searchQuery ? 'No matches found' : 'Waitlist is empty'}
                  </td>
                </tr>
              ) : (
                filteredWaitlist.map((member, index) => (
                  <tr key={member.id}>
                    <td>
                      <span className="position-badge">{member.waitlist_position}</span>
                    </td>
                    <td>
                      <div className="member-name">
                        {member.first_name} {member.last_name}
                      </div>
                      <div className="member-number">#{member.member_number}</div>
                    </td>
                    <td>
                      <div>{member.email || '—'}</div>
                      <div className="text-muted">{member.phone || ''}</div>
                    </td>
                    <td>{formatDate(member.waitlist_date)}</td>
                    <td>
                      <span className={`days-badge ${getDaysWaiting(member.waitlist_date) > 365 ? 'days-long' : ''}`}>
                        {getDaysWaiting(member.waitlist_date)} days
                      </span>
                    </td>
                    <td>
                      <div className="reorder-buttons">
                        <button
                          onClick={() => moveUp(member)}
                          disabled={member.waitlist_position <= 1}
                          className="btn btn-sm btn-icon"
                          title="Move up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => moveDown(member)}
                          disabled={member.waitlist_position >= waitlist.length}
                          className="btn btn-sm btn-icon"
                          title="Move down"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <Link to={`/members/${member.id}`} className="btn btn-sm">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Template Info */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2>Import Template</h2>
        </div>
        <div className="card-body">
          <p>Excel file should have these columns:</p>
          <table className="table" style={{ maxWidth: '600px' }}>
            <thead>
              <tr>
                <th>Column</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>First Name</td><td>Yes</td><td>Person's first name</td></tr>
              <tr><td>Last Name</td><td>Yes</td><td>Person's last name</td></tr>
              <tr><td>Email</td><td>No</td><td>Email address</td></tr>
              <tr><td>Phone</td><td>No</td><td>Phone number</td></tr>
              <tr><td>Date Added</td><td>No</td><td>When added to waitlist (defaults to today)</td></tr>
              <tr><td>Notes</td><td>No</td><td>Any notes</td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: '12px', color: '#6b7280' }}>
            New imports are added to the bottom of the waitlist in the order they appear in the file.
          </p>
        </div>
      </div>

      <style jsx>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #1f2937;
        }
        .stat-label {
          font-size: 14px;
          color: #6b7280;
        }
        .position-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: #4f46e5;
          color: white;
          border-radius: 50%;
          font-weight: 600;
          font-size: 14px;
        }
        .member-name {
          font-weight: 500;
        }
        .member-number {
          font-size: 12px;
          color: #6b7280;
        }
        .days-badge {
          padding: 4px 8px;
          border-radius: 4px;
          background: #e5e7eb;
          font-size: 13px;
        }
        .days-badge.days-long {
          background: #fef3c7;
          color: #92400e;
        }
        .reorder-buttons {
          display: flex;
          gap: 4px;
        }
        .btn-icon {
          padding: 4px 8px;
        }
        .header-actions {
          display: flex;
          gap: 8px;
        }
      `}</style>
    </div>
  );
}
