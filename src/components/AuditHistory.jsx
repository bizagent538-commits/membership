// AuditHistory.jsx - Component to display member change history
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { History, User, Calendar, ArrowRight, Filter, Download, X } from 'lucide-react';

// Field display names for better readability
const FIELD_LABELS = {
  first_name: 'First Name',
  last_name: 'Last Name',
  date_of_birth: 'Date of Birth',
  email: 'Email',
  phone: 'Phone',
  address_street: 'Street Address',
  address_city: 'City',
  address_state: 'State',
  address_zip: 'ZIP Code',
  tier: 'Membership Tier',
  status: 'Status',
  original_join_date: 'Original Join Date',
  notes: 'Notes',
  member_number: 'Member Number',
  assessment_years_completed: 'Assessment Years',
  life_eligibility_override: 'Life Override',
  life_override_reason: 'Life Override Reason'
};

// Action colors
const ACTION_COLORS = {
  INSERT: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800'
};

export default function AuditHistory({ memberId = null, memberName = null }) {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    field: '',
    action: '',
    startDate: '',
    endDate: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAuditLogs();
  }, [memberId, filters]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('audit_log')
        .select(`
          id,
          record_id,
          action,
          field_name,
          old_value,
          new_value,
          changed_by_email,
          changed_at,
          notes
        `)
        .eq('table_name', 'members')
        .not('field_name', 'is', null) // Exclude full record snapshots
        .order('changed_at', { ascending: false })
        .limit(500);

      // Filter by member if provided
      if (memberId) {
        query = query.eq('record_id', memberId);
      }

      // Apply filters
      if (filters.field) {
        query = query.eq('field_name', filters.field);
      }
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.startDate) {
        query = query.gte('changed_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('changed_at', filters.endDate + 'T23:59:59');
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // If we need member info and don't have member-specific view
      if (!memberId && data?.length > 0) {
        // Get unique member IDs
        const memberIds = [...new Set(data.map(d => d.record_id))];
        
        // Fetch member info
        const { data: members } = await supabase
          .from('members')
          .select('id, member_number, first_name, last_name')
          .in('id', memberIds);
        
        const memberMap = {};
        members?.forEach(m => {
          memberMap[m.id] = m;
        });
        
        // Attach member info to logs
        data.forEach(log => {
          log.member = memberMap[log.record_id];
        });
      }

      setAuditLogs(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('Failed to load audit history');
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value, fieldName) => {
    if (value === null || value === undefined || value === '') return '(empty)';
    
    // Format dates nicely
    if (fieldName?.includes('date') && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      try {
        return format(new Date(value), 'MMM d, yyyy');
      } catch {
        return value;
      }
    }
    
    // Truncate long values
    if (value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    
    return value;
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Member', 'Action', 'Field', 'Old Value', 'New Value', 'Changed By'];
    const rows = auditLogs.map(log => [
      format(new Date(log.changed_at), 'yyyy-MM-dd HH:mm:ss'),
      log.member ? `${log.member.first_name} ${log.member.last_name}` : (memberName || 'Unknown'),
      log.action,
      FIELD_LABELS[log.field_name] || log.field_name,
      log.old_value || '',
      log.new_value || '',
      log.changed_by_email || 'system'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-history-${memberId || 'all'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const clearFilters = () => {
    setFilters({ field: '', action: '', startDate: '', endDate: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {memberName ? `Audit History: ${memberName}` : 'Member Audit History'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100 text-gray-600'}`}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={exportToCSV}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
              title="Export to CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
                <select
                  value={filters.field}
                  onChange={e => setFilters({ ...filters, field: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Fields</option>
                  {Object.entries(FIELD_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <select
                  value={filters.action}
                  onChange={e => setFilters({ ...filters, action: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Actions</option>
                  <option value="INSERT">Created</option>
                  <option value="UPDATE">Updated</option>
                  <option value="DELETE">Deleted</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            {(filters.field || filters.action || filters.startDate || filters.endDate) && (
              <button
                onClick={clearFilters}
                className="mt-3 text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 border-b border-red-200">
          {error}
        </div>
      )}

      {/* Audit Log List */}
      <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No audit history found</p>
          </div>
        ) : (
          auditLogs.map(log => (
            <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-4">
                {/* Action Badge */}
                <span className={`px-2 py-1 text-xs font-medium rounded ${ACTION_COLORS[log.action]}`}>
                  {log.action === 'INSERT' ? 'Created' : log.action === 'DELETE' ? 'Deleted' : 'Updated'}
                </span>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  {/* Member name (if showing all members) */}
                  {!memberId && log.member && (
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {log.member.first_name} {log.member.last_name}
                      <span className="text-gray-500 font-normal ml-2">#{log.member.member_number}</span>
                    </div>
                  )}

                  {/* Field change */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-700">
                      {FIELD_LABELS[log.field_name] || log.field_name}
                    </span>
                    
                    {log.action === 'UPDATE' && (
                      <>
                        <span className="text-gray-400 line-through">
                          {formatValue(log.old_value, log.field_name)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-900">
                          {formatValue(log.new_value, log.field_name)}
                        </span>
                      </>
                    )}
                    
                    {log.action === 'INSERT' && (
                      <span className="text-green-700">
                        {formatValue(log.new_value, log.field_name)}
                      </span>
                    )}
                    
                    {log.action === 'DELETE' && (
                      <span className="text-red-700">
                        {formatValue(log.old_value, log.field_name)}
                      </span>
                    )}
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(log.changed_at), 'MMM d, yyyy h:mm a')}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {log.changed_by_email || 'system'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {auditLogs.length > 0 && (
        <div className="p-3 border-t border-gray-200 text-sm text-gray-500 text-center">
          Showing {auditLogs.length} records
        </div>
      )}
    </div>
  );
}
