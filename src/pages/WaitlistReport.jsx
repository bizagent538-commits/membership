import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowUp, ArrowDown, Download, Trash2, Upload, Clock, Users, Edit } from 'lucide-react';

function toLocalDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function WaitlistReport() {
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    street_address: '',
    city: '',
    state_province: '',
    postal_code: '',
    sponsor_1: '',
    sponsor_2: '',
    date_application_received: toLocalDateStr(),
    phone: '',
    status: 'pending',
    family_member_of_member: 'no',
    related_member_name: '',
    related_member_number: ''
  });
  const [stats, setStats] = useState({
    total: 0,
    avgWaitDays: 0,
    longestWaitDays: 0
  });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const showConfirm = (message, onConfirm) => {
    setConfirmModal({ show: true, message, onConfirm });
  };

  useEffect(() => {
    loadWaitlist();
  }, []);

  const loadWaitlist = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('waitlist')
        .select('*')
        .order('waitlist_position', { ascending: true });

      if (error) throw error;

      setWaitlist(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error loading waitlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    if (data.length === 0) {
      setStats({ total: 0, avgWaitDays: 0, longestWaitDays: 0 });
      return;
    }

    const today = new Date();
    const waitDays = data.map(entry => {
      if (!entry.date_application_received) return 0;
      const appDate = new Date(entry.date_application_received);
      const days = Math.floor((today - appDate) / (1000 * 60 * 60 * 24));
      return days;
    });

    const avgDays = Math.round(waitDays.reduce((a, b) => a + b, 0) / waitDays.length);
    const longestDays = Math.max(...waitDays);

    setStats({
      total: data.length,
      avgWaitDays: avgDays,
      longestWaitDays: longestDays
    });
  };

  const moveUp = async (entry) => {
    if (entry.waitlist_position <= 1) return;

    try {
      const entryAbove = waitlist.find(e => e.waitlist_position === entry.waitlist_position - 1);
      if (!entryAbove) return;

      await supabase
        .from('waitlist')
        .update({ waitlist_position: entry.waitlist_position })
        .eq('id', entryAbove.id);

      await supabase
        .from('waitlist')
        .update({ waitlist_position: entry.waitlist_position - 1 })
        .eq('id', entry.id);

      loadWaitlist();
    } catch (error) {
      console.error('Error moving up:', error);
      showToast('Failed to reorder waitlist', 'error');
    }
  };

  const moveDown = async (entry) => {
    if (entry.waitlist_position >= waitlist.length) return;

    try {
      const entryBelow = waitlist.find(e => e.waitlist_position === entry.waitlist_position + 1);
      if (!entryBelow) return;

      await supabase
        .from('waitlist')
        .update({ waitlist_position: entry.waitlist_position })
        .eq('id', entryBelow.id);

      await supabase
        .from('waitlist')
        .update({ waitlist_position: entry.waitlist_position + 1 })
        .eq('id', entry.id);

      loadWaitlist();
    } catch (error) {
      console.error('Error moving down:', error);
      showToast('Failed to reorder waitlist', 'error');
    }
  };

  const removeFromWaitlist = (entry) => {
    showConfirm(`Remove ${entry.contact_name} from the waitlist?`, async () => {
      try {
        const { error } = await supabase
          .from('waitlist')
          .delete()
          .eq('id', entry.id);

        if (error) throw error;

        const remaining = waitlist
          .filter(e => e.id !== entry.id)
          .sort((a, b) => a.waitlist_position - b.waitlist_position);

        for (let i = 0; i < remaining.length; i++) {
          await supabase
            .from('waitlist')
            .update({ waitlist_position: i + 1 })
            .eq('id', remaining[i].id);
        }

        showToast(`${entry.contact_name} removed from waitlist`);
        loadWaitlist();
      } catch (error) {
        console.error('Error removing from waitlist:', error);
        showToast('Failed to remove from waitlist', 'error');
      }
    });
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setFormData({
      first_name: entry.first_name || '',
      last_name: entry.last_name || '',
      email: entry.email || '',
      street_address: entry.street_address || '',
      city: entry.city || '',
      state_province: entry.state_province || '',
      postal_code: entry.postal_code || '',
      sponsor_1: entry.sponsor_1 || '',
      sponsor_2: entry.sponsor_2 || '',
      date_application_received: entry.date_application_received || toLocalDateStr(),
      phone: entry.phone || '',
      status: entry.status || 'pending',
      family_member_of_member: entry.family_member_of_member || 'no',
      related_member_name: entry.related_member_name || '',
      related_member_number: entry.related_member_number || ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const contactName = `${formData.first_name} ${formData.last_name}`.trim();
      
      const { error } = await supabase
        .from('waitlist')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          contact_name: contactName,
          email: formData.email,
          phone: formData.phone,
          street_address: formData.street_address,
          city: formData.city,
          state_province: formData.state_province,
          postal_code: formData.postal_code,
          sponsor_1: formData.sponsor_1,
          sponsor_2: formData.sponsor_2,
          date_application_received: formData.date_application_received,
          status: formData.status,
          family_member_of_member: formData.family_member_of_member,
          related_member_name: formData.related_member_name,
          related_member_number: formData.related_member_number
        })
        .eq('id', editingEntry.id);

      if (error) throw error;

      showToast('Waitlist entry updated successfully!');
      setShowEditModal(false);
      setEditingEntry(null);
      resetForm();
      loadWaitlist();
    } catch (error) {
      console.error('Error updating waitlist entry:', error);
      showToast('Failed to update: ' + error.message, 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      street_address: '',
      city: '',
      state_province: '',
      postal_code: '',
      sponsor_1: '',
      sponsor_2: '',
      date_application_received: toLocalDateStr(),
      phone: '',
      status: 'pending',
      family_member_of_member: 'no',
      related_member_name: '',
      related_member_number: ''
    });
  };

  const exportToExcel = () => {
    const headers = [
      'Position',
      'Last Name',
      'Contact Name',
      'Email',
      'Phone',
      'Street Address',
      'City',
      'State/Province',
      'Postal Code',
      'Sponsor #1',
      'Sponsor #2',
      'Date Application Received',
      'Days Waiting',
      'Status'
    ];

    const today = new Date();
    const rows = waitlist.map(entry => {
      const daysWaiting = entry.date_application_received
        ? Math.floor((today - new Date(entry.date_application_received)) / (1000 * 60 * 60 * 24))
        : 0;

      return [
        entry.waitlist_position,
        entry.last_name || '',
        entry.contact_name || '',
        entry.email || '',
        entry.phone || '',
        entry.street_address || '',
        entry.city || '',
        entry.state_province || '',
        entry.postal_code || '',
        entry.sponsor_1 || '',
        entry.sponsor_2 || '',
        entry.date_application_received || '',
        daysWaiting,
        entry.status || 'pending'
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waitlist_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Street Address',
      'City',
      'State/Province',
      'Postal Code',
      'Sponsor #1',
      'Sponsor #2',
      'Applied',
      'Phone'
    ];

    const csv = headers.join(',');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'waitlist_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    
    try {
      const contactName = `${formData.first_name} ${formData.last_name}`.trim();
      const isPriority = formData.family_member_of_member === 'yes' &&
        formData.related_member_name.trim() !== '' &&
        formData.related_member_number.trim() !== '';

      let insertPosition;

      if (isPriority) {
        // Shift all existing entries down by 1 to make room at position 1
        for (let i = waitlist.length - 1; i >= 0; i--) {
          await supabase
            .from('waitlist')
            .update({ waitlist_position: waitlist[i].waitlist_position + 1 })
            .eq('id', waitlist[i].id);
        }
        insertPosition = 1;
      } else {
        insertPosition = waitlist.length + 1;
      }

      const { error } = await supabase
        .from('waitlist')
        .insert({
          waitlist_position: insertPosition,
          first_name: formData.first_name,
          last_name: formData.last_name,
          contact_name: contactName,
          email: formData.email,
          phone: formData.phone,
          street_address: formData.street_address,
          city: formData.city,
          state_province: formData.state_province,
          postal_code: formData.postal_code,
          sponsor_1: formData.sponsor_1,
          sponsor_2: formData.sponsor_2,
          date_application_received: formData.date_application_received,
          status: 'pending',
          family_member_of_member: formData.family_member_of_member,
          related_member_name: formData.related_member_name,
          related_member_number: formData.related_member_number
        });

      if (error) throw error;

      showToast(isPriority
        ? `${contactName} added to top of waitlist (family member priority)`
        : `${contactName} added to waitlist`
      );
      setShowAddModal(false);
      resetForm();
      loadWaitlist();
    } catch (error) {
      console.error('Error adding to waitlist:', error);
      showToast('Failed to add person to waitlist: ' + error.message, 'error');
    }
  };
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      
      console.log('📋 CSV Headers found:', headers);
      
      const entries = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
        if (values.length === 0) continue;

        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });

        const firstName = row['first name'] || row['first_name'] || row['firstname'] || '';
        const lastName = row['last name'] || row['last_name'] || row['lastname'] || '';
        const fullName = (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName);
        
        // Parse date (handle MM/DD/YYYY or YYYY-MM-DD formats)
        let parsedDate = null;
        const dateStr = row['applied'] || row['date application received'] || row['date_application_received'] || row['date applied'] || '';
        if (dateStr) {
          // If format is MM/DD/YYYY, convert to YYYY-MM-DD
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const month = parts[0].padStart(2, '0');
              const day = parts[1].padStart(2, '0');
              const year = parts[2];
              parsedDate = `${year}-${month}-${day}`;
            }
          } else {
            parsedDate = dateStr;
          }
        }
        
        const entry = {
          waitlist_position: parseInt(row['position'] || row['waitlist_position']) || (waitlist.length + entries.length + 1),
          first_name: firstName,
          last_name: lastName,
          contact_name: fullName,
          email: row['email'] || '',
          phone: row['phone'] || '',
          street_address: row['street address'] || row['street_address'] || row['address'] || '',
          city: row['city'] || '',
          state_province: row['state/province'] || row['state_province'] || row['state'] || '',
          postal_code: row['postal code'] || row['postal_code'] || row['zip'] || '',
          sponsor_1: row['sponsor #1'] || row['sponsor_1'] || row['sponsor 1'] || row['sponsor#1'] || '',
          sponsor_2: row['sponsor #2'] || row['sponsor_2'] || row['sponsor 2'] || row['sponsor#2'] || '',
          date_application_received: parsedDate,
          status: row['status'] || 'pending'
        };
        
        // Log first entry for debugging
        if (i === 1) {
          console.log('🔍 First row parsed:', entry);
          console.log('   Sponsor 1:', entry.sponsor_1);
          console.log('   Sponsor 2:', entry.sponsor_2);
          console.log('   Date Applied:', entry.date_application_received);
        }
        
        entries.push(entry);
      }

      console.log(`✅ Prepared ${entries.length} entries for import`);

      if (entries.length > 0) {
        const { error } = await supabase.from('waitlist').insert(entries);
        if (error) throw error;
        showToast(`Imported ${entries.length} waitlist entries`);
        loadWaitlist();
      }
    } catch (error) {
      console.error('Import error:', error);
      showToast('Failed to import: ' + error.message, 'error');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const getDaysWaiting = (dateReceived) => {
    if (!dateReceived) return 0;
    const today = new Date();
    const appDate = new Date(dateReceived);
    return Math.floor((today - appDate) / (1000 * 60 * 60 * 24));
  };

  const getStatusBadge = (status) => {
    const styles = {
      approved: { background: 'var(--success-light)', color: 'var(--success)' },
      contacted: { background: 'var(--primary-light)', color: 'var(--primary)' },
      pending: { background: 'var(--gray-100)', color: 'var(--gray-600)' }
    };
    const style = styles[status] || styles.pending;
    return (
      <span style={{ ...style, padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
        {status || 'pending'}
      </span>
    );
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Membership Waitlist</h1>
          <p style={{ color: '#6b7280' }}>Manage prospective members waiting for membership</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={downloadTemplate} className="btn btn-secondary">
            <Download size={16} /> Download Template
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={16} />
            {importing ? 'Importing...' : 'Import CSV'}
            <input
              type="file"
              accept=".csv"
              onChange={handleImport}
              style={{ display: 'none' }}
              disabled={importing}
            />
          </label>
          <button onClick={() => { resetForm(); setShowAddModal(true); }} className="btn btn-primary">
            + Add Person
          </button>
          <button onClick={exportToExcel} className="btn btn-success">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={24} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Total on Waitlist</div>
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{stats.total}</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'var(--warning-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={24} style={{ color: 'var(--warning)' }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Average Wait</div>
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{stats.avgWaitDays} days</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'var(--danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={24} style={{ color: 'var(--danger)' }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Longest Wait</div>
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{stats.longestWaitDays} days</div>
            </div>
          </div>
        </div>
      </div>

      {/* Waitlist Table */}
      <div className="card">
        <div className="card-header">
          <h2>Waitlist Entries</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Sponsors</th>
                <th>Applied</th>
                <th>Waiting</th>
                <th>Status</th>
                <th style={{ width: '140px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                    No entries on waitlist. Import a CSV to add entries.
                  </td>
                </tr>
              ) : (
                waitlist.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ fontWeight: '600' }}>{entry.waitlist_position}</td>
                    <td>
                      <div style={{ fontWeight: '500' }}>{entry.contact_name}</div>
                      {entry.last_name && <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{entry.last_name}</div>}
                    </td>
                    <td>
                      <div>{entry.email || '-'}</div>
                      {entry.phone && <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{entry.phone}</div>}
                    </td>
                    <td>
                      {entry.city || entry.state_province ? (
                        <>
                          <div>{[entry.city, entry.state_province].filter(Boolean).join(', ')}</div>
                          {entry.postal_code && <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{entry.postal_code}</div>}
                        </>
                      ) : '-'}
                    </td>
                    <td style={{ fontSize: '13px' }}>
                      {entry.sponsor_1 && <div>1: {entry.sponsor_1}</div>}
                      {entry.sponsor_2 && <div>2: {entry.sponsor_2}</div>}
                      {!entry.sponsor_1 && !entry.sponsor_2 && '-'}
                    </td>
                    <td>
                      {entry.date_application_received
                        ? new Date(entry.date_application_received).toLocaleDateString()
                        : '-'}
                    </td>
                    <td style={{ fontWeight: '500' }}>
                      {getDaysWaiting(entry.date_application_received)} days
                    </td>
                    <td>{getStatusBadge(entry.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => openEditModal(entry)}
                          className="btn btn-sm btn-icon btn-secondary"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => moveUp(entry)}
                          disabled={entry.waitlist_position === 1}
                          className="btn btn-sm btn-icon btn-secondary"
                          title="Move up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => moveDown(entry)}
                          disabled={entry.waitlist_position === waitlist.length}
                          className="btn btn-sm btn-icon btn-secondary"
                          title="Move down"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          onClick={() => removeFromWaitlist(entry)}
                          className="btn btn-sm btn-icon btn-danger"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Person Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Person to Waitlist</h2>
              <button onClick={() => setShowAddModal(false)} className="btn btn-icon">×</button>
            </div>
            <form onSubmit={handleManualAdd}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Street Address</label>
                    <input
                      type="text"
                      value={formData.street_address}
                      onChange={(e) => setFormData({...formData, street_address: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>State/Province</label>
                    <input
                      type="text"
                      value={formData.state_province}
                      onChange={(e) => setFormData({...formData, state_province: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Postal Code</label>
                    <input
                      type="text"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Sponsor #1</label>
                    <input
                      type="text"
                      value={formData.sponsor_1}
                      onChange={(e) => setFormData({...formData, sponsor_1: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Sponsor #2</label>
                    <input
                      type="text"
                      value={formData.sponsor_2}
                      onChange={(e) => setFormData({...formData, sponsor_2: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Date Applied *</label>
                    <input
                      type="date"
                      required
                      value={formData.date_application_received}
                      onChange={(e) => setFormData({...formData, date_application_received: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '16px', marginTop: '4px' }}>
                      <label style={{ fontWeight: '600', fontSize: '14px' }}>Son, Daughter, or Spouse of a Member?</label>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'normal' }}>
                          <input
                            type="radio"
                            name="add_family_member"
                            value="no"
                            checked={formData.family_member_of_member === 'no'}
                            onChange={() => setFormData({...formData, family_member_of_member: 'no', related_member_name: '', related_member_number: ''})}
                          /> No
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'normal' }}>
                          <input
                            type="radio"
                            name="add_family_member"
                            value="yes"
                            checked={formData.family_member_of_member === 'yes'}
                            onChange={() => setFormData({...formData, family_member_of_member: 'yes'})}
                          /> Yes
                        </label>
                      </div>
                    </div>
                  </div>
                  {formData.family_member_of_member === 'yes' && (
                    <>
                      <div className="form-group">
                        <label>Member Name</label>
                        <input
                          type="text"
                          value={formData.related_member_name}
                          onChange={(e) => setFormData({...formData, related_member_name: e.target.value})}
                          className="form-control"
                          placeholder="Full name of member"
                        />
                      </div>
                      <div className="form-group">
                        <label>Member #</label>
                        <input
                          type="text"
                          value={formData.related_member_number}
                          onChange={(e) => setFormData({...formData, related_member_number: e.target.value})}
                          className="form-control"
                          placeholder="Member number"
                        />
                      </div>
                      {formData.related_member_name.trim() && formData.related_member_number.trim() && (
                        <div style={{ gridColumn: '1 / -1', background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: 'var(--success)' }}>
                          ★ This person will be added to the <strong>top of the waitlist</strong> (family member priority).
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add to Waitlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Person Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); setEditingEntry(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Waitlist Entry</h2>
              <button onClick={() => { setShowEditModal(false); setEditingEntry(null); }} className="btn btn-icon">×</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Street Address</label>
                    <input
                      type="text"
                      value={formData.street_address}
                      onChange={(e) => setFormData({...formData, street_address: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>State/Province</label>
                    <input
                      type="text"
                      value={formData.state_province}
                      onChange={(e) => setFormData({...formData, state_province: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Postal Code</label>
                    <input
                      type="text"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Sponsor #1</label>
                    <input
                      type="text"
                      value={formData.sponsor_1}
                      onChange={(e) => setFormData({...formData, sponsor_1: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Sponsor #2</label>
                    <input
                      type="text"
                      value={formData.sponsor_2}
                      onChange={(e) => setFormData({...formData, sponsor_2: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Date Applied *</label>
                    <input
                      type="date"
                      required
                      value={formData.date_application_received}
                      onChange={(e) => setFormData({...formData, date_application_received: e.target.value})}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="form-control"
                    >
                      <option value="pending">Pending</option>
                      <option value="contacted">Contacted</option>
                      <option value="approved">Approved</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '16px', marginTop: '4px' }}>
                      <label style={{ fontWeight: '600', fontSize: '14px' }}>Son, Daughter, or Spouse of a Member?</label>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'normal' }}>
                          <input
                            type="radio"
                            name="edit_family_member"
                            value="no"
                            checked={formData.family_member_of_member === 'no'}
                            onChange={() => setFormData({...formData, family_member_of_member: 'no', related_member_name: '', related_member_number: ''})}
                          /> No
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'normal' }}>
                          <input
                            type="radio"
                            name="edit_family_member"
                            value="yes"
                            checked={formData.family_member_of_member === 'yes'}
                            onChange={() => setFormData({...formData, family_member_of_member: 'yes'})}
                          /> Yes
                        </label>
                      </div>
                    </div>
                  </div>
                  {formData.family_member_of_member === 'yes' && (
                    <>
                      <div className="form-group">
                        <label>Member Name</label>
                        <input
                          type="text"
                          value={formData.related_member_name}
                          onChange={(e) => setFormData({...formData, related_member_name: e.target.value})}
                          className="form-control"
                          placeholder="Full name of member"
                        />
                      </div>
                      <div className="form-group">
                        <label>Member #</label>
                        <input
                          type="text"
                          value={formData.related_member_number}
                          onChange={(e) => setFormData({...formData, related_member_number: e.target.value})}
                          className="form-control"
                          placeholder="Member number"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => { setShowEditModal(false); setEditingEntry(null); }} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.show && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm</h2>
            </div>
            <div className="modal-body">
              <p>{confirmModal.message}</p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmModal({ show: false, message: '', onConfirm: null })}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setConfirmModal({ show: false, message: '', onConfirm: null });
                  confirmModal.onConfirm?.();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999,
          background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
          color: '#fff', padding: '12px 20px', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '14px', maxWidth: '360px'
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
