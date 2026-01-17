import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowUp, ArrowDown, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function WaitlistReport() {
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWaitlist();
  }, []);

  const loadWaitlist = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('tier', 'Waitlist')
        .order('waitlist_position', { ascending: true });
      
      if (error) throw error;
      setWaitlist(data || []);
    } catch (err) {
      console.error('Error loading waitlist:', err);
      alert('Error loading waitlist');
    } finally {
      setLoading(false);
    }
  };

  const moveUp = async (member) => {
    if (member.waitlist_position <= 1) return;
    
    try {
      const newPosition = member.waitlist_position - 1;
      const swapMember = waitlist.find(m => m.waitlist_position === newPosition);
      
      // Swap positions
      await supabase.from('members').update({ waitlist_position: member.waitlist_position }).eq('id', swapMember.id);
      await supabase.from('members').update({ waitlist_position: newPosition }).eq('id', member.id);
      
      loadWaitlist();
    } catch (err) {
      console.error('Error moving member:', err);
      alert('Error updating position');
    }
  };

  const moveDown = async (member) => {
    if (member.waitlist_position >= waitlist.length) return;
    
    try {
      const newPosition = member.waitlist_position + 1;
      const swapMember = waitlist.find(m => m.waitlist_position === newPosition);
      
      // Swap positions
      await supabase.from('members').update({ waitlist_position: member.waitlist_position }).eq('id', swapMember.id);
      await supabase.from('members').update({ waitlist_position: newPosition }).eq('id', member.id);
      
      loadWaitlist();
    } catch (err) {
      console.error('Error moving member:', err);
      alert('Error updating position');
    }
  };

  const getDaysWaiting = (dateAdded) => {
    if (!dateAdded) return 0;
    const added = new Date(dateAdded);
    const now = new Date();
    const diff = now - added;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const exportToExcel = () => {
    const data = waitlist.map(m => ({
      'Position': m.waitlist_position,
      'Member #': m.member_number,
      'Last Name': m.last_name,
      'First Name': m.first_name,
      'Email': m.email || '',
      'Phone': m.phone || '',
      'Date Added': m.waitlist_date ? new Date(m.waitlist_date).toLocaleDateString() : '',
      'Days Waiting': getDaysWaiting(m.waitlist_date)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Waitlist');
    
    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
    ws['!cols'] = colWidths;
    
    XLSX.writeFile(wb, `waitlist-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      // Get current max position
      const maxPosition = waitlist.length > 0 ? Math.max(...waitlist.map(m => m.waitlist_position)) : 0;

      // Import each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        const memberData = {
          member_number: row['Member #'] || `W${Date.now()}-${i}`,
          first_name: row['First Name'] || '',
          last_name: row['Last Name'] || '',
          email: row['Email'] || null,
          phone: row['Phone'] || null,
          address_street: row['Street Address'] || null,
          address_city: row['City'] || null,
          address_state: row['State'] || null,
          address_zip: row['Zip'] || null,
          tier: 'Waitlist',
          status: 'Active',
          waitlist_position: maxPosition + i + 1,
          waitlist_date: row['Application Received'] ? new Date(row['Application Received']).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          date_of_birth: row['Date of Birth'] || null,
          original_join_date: null, // NULL until they actually join
          assessment_years_completed: 0,
          notes: [
            row['Sponsor 1'] ? `Sponsor 1: ${row['Sponsor 1']}` : '',
            row['Sponsor 2'] ? `Sponsor 2: ${row['Sponsor 2']}` : ''
          ].filter(Boolean).join('; ') || null
        };

        await supabase.from('members').insert(memberData);
      }

      alert(`Imported ${rows.length} waitlist members`);
      loadWaitlist();
    } catch (err) {
      console.error('Import error:', err);
      alert('Error importing file: ' + err.message);
    }

    e.target.value = ''; // Reset file input
  };

  const avgDaysWaiting = waitlist.length > 0
    ? Math.round(waitlist.reduce((sum, m) => sum + getDaysWaiting(m.waitlist_date), 0) / waitlist.length)
    : 0;

  const longestWait = waitlist.length > 0
    ? Math.max(...waitlist.map(m => getDaysWaiting(m.waitlist_date)))
    : 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <div>Loading waitlist...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Membership Waitlist</h1>
        <p style={{ color: '#6b7280' }}>Manage and track membership waitlist</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Total on Waitlist</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#2563eb' }}>{waitlist.length}</div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Average Wait Time</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#7c3aed' }}>{avgDaysWaiting} days</div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Longest Wait</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#dc2626' }}>{longestWait} days</div>
        </div>
      </div>

      {/* Actions */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2>Actions</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={exportToExcel} className="btn btn-secondary">
              <Download size={16} /> Export to Excel
            </button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={16} /> Import from Excel
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      </div>

      {/* Waitlist Table */}
      <div className="card">
        <div className="card-header">
          <h2>Current Waitlist</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Member #</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Date Added</th>
                <th>Days Waiting</th>
                <th>Reorder</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    No members on waitlist
                  </td>
                </tr>
              ) : (
                waitlist.map(member => (
                  <tr key={member.id}>
                    <td><strong>#{member.waitlist_position}</strong></td>
                    <td>{member.member_number}</td>
                    <td>{member.last_name}, {member.first_name}</td>
                    <td>
                      {member.email && <div style={{ fontSize: '13px' }}>{member.email}</div>}
                      {member.phone && <div style={{ fontSize: '13px', color: '#6b7280' }}>{member.phone}</div>}
                    </td>
                    <td>{member.waitlist_date ? new Date(member.waitlist_date).toLocaleDateString() : '-'}</td>
                    <td>
                      <span className={getDaysWaiting(member.waitlist_date) > 180 ? 'badge badge-danger' : getDaysWaiting(member.waitlist_date) > 90 ? 'badge badge-warning' : 'badge'}>
                        {getDaysWaiting(member.waitlist_date)} days
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => moveUp(member)}
                          disabled={member.waitlist_position <= 1}
                          className="btn btn-sm"
                          title="Move up"
                          style={{ padding: '4px 8px' }}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => moveDown(member)}
                          disabled={member.waitlist_position >= waitlist.length}
                          className="btn btn-sm"
                          title="Move down"
                          style={{ padding: '4px 8px' }}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <a href={`/members/${member.id}`} className="btn btn-sm">
                        View
                      </a>
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
          <p>Excel file should have these columns (in this exact order):</p>
          <table className="table" style={{ maxWidth: '800px' }}>
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
              <tr><td>Street Address</td><td>No</td><td>Street address</td></tr>
              <tr><td>City</td><td>No</td><td>City</td></tr>
              <tr><td>State</td><td>No</td><td>State (2-letter code)</td></tr>
              <tr><td>Zip</td><td>No</td><td>ZIP code</td></tr>
              <tr><td>Sponsor 1</td><td>No</td><td>Name of first sponsor (saved in notes)</td></tr>
              <tr><td>Sponsor 2</td><td>No</td><td>Name of second sponsor (saved in notes)</td></tr>
              <tr><td>Application Received</td><td>No</td><td>Date application received (defaults to today)</td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: '12px', color: '#6b7280' }}>
            New imports are added to the bottom of the waitlist in the order they appear in the file.
            Sponsor information will be saved in the member's notes field.
          </p>
        </div>
      </div>
    </div>
  );
}
