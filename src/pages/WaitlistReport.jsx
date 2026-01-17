import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ArrowUp, ArrowDown, Download, Trash2 } from 'lucide-react';
import WaitlistImport from '../components/WaitlistImport';

export default function WaitlistReport() {
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    avgWaitDays: 0,
    longestWaitDays: 0
  });

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
      alert('Failed to load waitlist');
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
      // Find the entry above
      const entryAbove = waitlist.find(e => e.waitlist_position === entry.waitlist_position - 1);
      if (!entryAbove) return;

      // Swap positions
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
      alert('Failed to reorder waitlist');
    }
  };

  const moveDown = async (entry) => {
    if (entry.waitlist_position >= waitlist.length) return;

    try {
      // Find the entry below
      const entryBelow = waitlist.find(e => e.waitlist_position === entry.waitlist_position + 1);
      if (!entryBelow) return;

      // Swap positions
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
      alert('Failed to reorder waitlist');
    }
  };

  const removeFromWaitlist = async (entry) => {
    if (!confirm(`Remove ${entry.contact_name} from the waitlist?`)) return;

    try {
      // Delete the entry
      const { error } = await supabase
        .from('waitlist')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;

      // Reorder remaining entries
      const remaining = waitlist
        .filter(e => e.id !== entry.id)
        .sort((a, b) => a.waitlist_position - b.waitlist_position);

      for (let i = 0; i < remaining.length; i++) {
        await supabase
          .from('waitlist')
          .update({ waitlist_position: i + 1 })
          .eq('id', remaining[i].id);
      }

      loadWaitlist();
    } catch (error) {
      console.error('Error removing from waitlist:', error);
      alert('Failed to remove from waitlist');
    }
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

  const getDaysWaiting = (dateReceived) => {
    if (!dateReceived) return 0;
    const today = new Date();
    const appDate = new Date(dateReceived);
    return Math.floor((today - appDate) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Membership Waitlist</h1>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Download className="w-4 h-4" />
          Export to Excel
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total on Waitlist</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Average Wait Time</div>
          <div className="text-2xl font-bold">{stats.avgWaitDays} days</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Longest Wait Time</div>
          <div className="text-2xl font-bold">{stats.longestWaitDays} days</div>
        </div>
      </div>

      {/* Import Component */}
      <div className="mb-6">
        <WaitlistImport onImportComplete={loadWaitlist} />
      </div>

      {/* Waitlist Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sponsors</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Applied</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Waiting</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    Loading waitlist...
                  </td>
                </tr>
              ) : waitlist.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No entries on waitlist
                  </td>
                </tr>
              ) : (
                waitlist.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{entry.waitlist_position}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{entry.contact_name}</div>
                      <div className="text-gray-500 text-xs">{entry.last_name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{entry.email}</div>
                      <div className="text-gray-500 text-xs">{entry.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{entry.city}, {entry.state_province}</div>
                      <div className="text-gray-500 text-xs">{entry.postal_code}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-xs">
                        {entry.sponsor_1 && <div>1: {entry.sponsor_1}</div>}
                        {entry.sponsor_2 && <div>2: {entry.sponsor_2}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {entry.date_application_received
                        ? new Date(entry.date_application_received).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {getDaysWaiting(entry.date_application_received)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                        entry.status === 'contacted' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {entry.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveUp(entry)}
                          disabled={entry.waitlist_position === 1}
                          className="p-1 text-gray-600 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveDown(entry)}
                          disabled={entry.waitlist_position === waitlist.length}
                          className="p-1 text-gray-600 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeFromWaitlist(entry)}
                          className="p-1 text-gray-600 hover:text-red-600"
                          title="Remove from waitlist"
                        >
                          <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
