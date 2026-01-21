import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { formatDateForInput, calculateAge } from '../utils/calculations';

export default function MemberForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [waitlistMember, setWaitlistMember] = useState(null);
  
  const [form, setForm] = useState({
    member_number: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    email: '',
    phone: '',
    address_street: '',
    address_city: '',
    address_state: 'CT',
    address_zip: '',
    key_fob_number: '',
    original_join_date: '',
    tier: searchParams.get('tier') || 'Regular',
    status: 'Active',
    assessment_years_completed: 0,
    notes: ''
  });

  useEffect(() => {
    if (isEdit) {
      fetchMember();
    }
  }, [id]);

  const fetchMember = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      setForm({
        member_number: data.member_number || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        date_of_birth: formatDateForInput(data.date_of_birth) || '',
        email: data.email || '',
        phone: data.phone || '',
        address_street: data.address_street || '',
        address_city: data.address_city || '',
        address_state: data.address_state || 'CT',
        address_zip: data.address_zip || '',
        key_fob_number: data.key_fob_number || '',
        original_join_date: formatDateForInput(data.original_join_date) || '',
        tier: data.tier || 'Regular',
        status: data.status || 'Active',
        assessment_years_completed: data.assessment_years_completed || 0,
        notes: data.notes || ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    
    // If tier changed to "Promote", load first waitlist member
    if (name === 'tier' && value === 'Promote') {
      loadFirstWaitlistMember();
    }
  };
  
  const loadFirstWaitlistMember = async () => {
    try {
      const { data, error } = await supabase
        .from('waitlist')
        .select('*')
        .order('waitlist_position', { ascending: true })
        .limit(1)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          alert('No members on waitlist');
          setForm(prev => ({ ...prev, tier: 'Regular' }));
          return;
        }
        throw error;
      }
      
      setWaitlistMember(data);
      
      // Populate form with waitlist member's data
      // Note: waitlist table has contact_name instead of first_name/last_name split
      const names = (data.contact_name || '').split(' ');
      const firstName = names[0] || '';
      const lastName = names.slice(1).join(' ') || data.last_name || '';
      
      setForm(prev => ({
        ...prev,
        member_number: '', // Will be assigned when they become a member
        first_name: firstName,
        last_name: lastName,
        date_of_birth: '', // Not stored in waitlist table
        email: data.email || '',
        phone: data.phone || '',
        address_street: data.street_address || '',
        address_city: data.city || '',
        address_state: data.state_province || 'CT',
        address_zip: data.postal_code || '',
        original_join_date: '', // Leave empty - they need to be sworn in
        notes: [
          data.notes || '',
          data.sponsor_1 ? `Sponsor 1: ${data.sponsor_1}` : '',
          data.sponsor_2 ? `Sponsor 2: ${data.sponsor_2}` : '',
          data.date_application_received ? `Applied: ${data.date_application_received}` : ''
        ].filter(Boolean).join('\n')
      }));
      
      alert(`Loaded: ${data.contact_name} (Waitlist Position #${data.waitlist_position})\nSponsors: ${data.sponsor_1 || 'N/A'}, ${data.sponsor_2 || 'N/A'}`);
    } catch (err) {
      setError(err.message);
      setForm(prev => ({ ...prev, tier: 'Regular' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // Validate age for Regular members
      if (form.tier === 'Regular' && form.date_of_birth) {
        const age = calculateAge(form.date_of_birth);
        if (age < 21) {
          throw new Error('Regular members must be at least 21 years old');
        }
      }

      const memberData = {
        member_number: form.member_number,
        first_name: form.first_name,
        last_name: form.last_name,
        date_of_birth: form.date_of_birth,
        email: form.email || null,
        phone: form.phone || null,
        address_street: form.address_street || null,
        address_city: form.address_city || null,
        address_state: form.address_state || null,
        address_zip: form.address_zip || null,
        original_join_date: form.original_join_date || null,
        tier: form.tier === 'Promote' ? 'Regular' : form.tier, // Convert Promote to Regular
        status: form.status,
        assessment_years_completed: parseInt(form.assessment_years_completed) || 0,
        notes: form.notes || null,
        waitlist_position: null, // Clear waitlist position
        waitlist_date: null // Clear waitlist date
      };

      if (isEdit) {
        const { error } = await supabase
          .from('members')
          .update(memberData)
          .eq('id', id);
        
        if (error) throw error;
        
        navigate(`/members/${id}`);
      } else {
        // Check if promoting from waitlist
        if (form.tier === 'Promote' && waitlistMember) {
          // Create new member record (not update - waitlist is separate table)
          const { data, error } = await supabase
            .from('members')
            .insert([memberData])
            .select()
            .single();
          
          if (error) throw error;
          
          // Log initial tier (from Waitlist promotion)
          await supabase.from('tier_history').insert([{
            member_id: data.id,
            old_tier: null,
            new_tier: form.tier === 'Promote' ? 'Regular' : form.tier,
            effective_date: form.original_join_date || new Date().toISOString().split('T')[0],
            reason: `Promoted from waitlist (was position #${waitlistMember.waitlist_position})`
          }]);
          
          // Log initial status
          await supabase.from('status_history').insert([{
            member_id: data.id,
            old_status: null,
            new_status: 'Active',
            change_date: form.original_join_date || new Date().toISOString().split('T')[0],
            reason: 'Promoted from waitlist'
          }]);
          
          // Delete from waitlist table (auto-reorder trigger will move others up)
          await supabase
            .from('waitlist')
            .delete()
            .eq('id', waitlistMember.id);
          
          navigate(`/members/${data.id}`);
        } else {
          // Normal add new member
          const { data, error } = await supabase
            .from('members')
            .insert([memberData])
            .select()
            .single();
          
          if (error) throw error;
          
          // Log initial tier
          await supabase.from('tier_history').insert([{
            member_id: data.id,
            old_tier: null,
            new_tier: form.tier,
            effective_date: form.original_join_date,
            reason: 'Initial membership'
          }]);
        
          // Log initial status
          await supabase.from('status_history').insert([{
            member_id: data.id,
            old_status: null,
            new_status: 'Active',
            change_date: form.original_join_date,
            reason: 'New member'
          }]);
        
          navigate(`/members/${data.id}`);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      navigate('/members');
    } catch (err) {
      alert('Error deleting member: ' + err.message);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
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
      <div style={{ marginBottom: '24px' }}>
        <Link to={isEdit ? `/members/${id}` : '/members'} className="btn btn-secondary btn-sm" style={{ marginBottom: '16px' }}>
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: '700' }}>
          {isEdit ? 'Edit Member' : 'Add New Member'}
        </h1>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-header">
            <h2>Member Information</h2>
          </div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Member Number *</label>
                <input
                  type="text"
                  name="member_number"
                  className="form-input"
                  value={form.member_number}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Key Fob Number *</label>
                <input
                  type="text"
                  name="key_fob_number"
                  className="form-input"
                  value={form.key_fob_number}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tier *</label>
                <select
                  name="tier"
                  className="form-select"
                  value={form.tier}
                  onChange={handleChange}
                  required
                >
                  <option value="Regular">Regular</option>
                  <option value="Absentee">Absentee</option>
                  <option value="Life">Life</option>
                  <option value="Honorary">Honorary</option>
                  {!isEdit && <option value="Promote">Promote from Waitlist</option>}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Status *</label>
                <select
                  name="status"
                  className="form-select"
                  value={form.status}
                  onChange={handleChange}
                  required
                >
                  <option value="Active">Active</option>
                  <option value="Deceased">Deceased</option>
                  <option value="Resigned">Resigned</option>
                  <option value="Expelled">Expelled</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  className="form-input"
                  value={form.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  className="form-input"
                  value={form.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date of Birth *</label>
                <input
                  type="date"
                  name="date_of_birth"
                  className="form-input"
                  value={form.date_of_birth}
                  onChange={handleChange}
                  required
                />
                {form.date_of_birth && (
                  <div className="form-help">
                    Age: {calculateAge(form.date_of_birth)} years
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Original Join Date *</label>
                <input
                  type="date"
                  name="original_join_date"
                  className="form-input"
                  value={form.original_join_date}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Street Address</label>
              <input
                type="text"
                name="address_street"
                className="form-input"
                value={form.address_street}
                onChange={handleChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  type="text"
                  name="address_city"
                  className="form-input"
                  value={form.address_city}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input
                  type="text"
                  name="address_state"
                  className="form-input"
                  value={form.address_state}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label">ZIP</label>
                <input
                  type="text"
                  name="address_zip"
                  className="form-input"
                  value={form.address_zip}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Assessment Years Completed (0-5)</label>
                <input
                  type="number"
                  name="assessment_years_completed"
                  className="form-input"
                  value={form.assessment_years_completed}
                  onChange={handleChange}
                  min="0"
                  max="5"
                />
                <div className="form-help">
                  For imports: how many years of the 5-year assessment have been paid
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                name="notes"
                className="form-textarea"
                value={form.notes}
                onChange={handleChange}
                rows={3}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'space-between' }}>
          <div>
            {isEdit && (
              <button 
                type="button" 
                onClick={() => setShowDeleteConfirm(true)} 
                className="btn btn-danger"
              >
                <Trash2 size={16} />
                Delete Member
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link to={isEdit ? `/members/${id}` : '/members'} className="btn btn-secondary btn-lg">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving...' : (isEdit ? 'Update Member' : 'Create Member')}
            </button>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ Delete Member</h2>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px' }}>
                Are you sure you want to delete <strong>{form.first_name} {form.last_name}</strong>?
              </p>
              <p style={{ color: '#dc2626', fontWeight: '500' }}>
                This action cannot be undone. All associated records (payments, work hours, history) will also be deleted.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                onClick={() => setShowDeleteConfirm(false)} 
                className="btn btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleDelete} 
                className="btn btn-danger"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .btn-danger {
          background-color: #dc2626;
          color: white;
          border: none;
        }
        .btn-danger:hover {
          background-color: #b91c1c;
        }
        .btn-danger:disabled {
          background-color: #fca5a5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
