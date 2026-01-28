import { useState } from 'react';
import { useMembers, useSettings } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import { FileText, Download, Users, DollarSign, Clock, Award } from 'lucide-react';
import { 
  formatCurrency, 
  getCurrentFiscalYear, 
  calculateAge, 
  calculateConsecutiveYears,
  calculateBilling 
} from '../utils/calculations';
import { exportMembersToExcel, exportBillingReportToExcel } from '../utils/excel';
import * as XLSX from 'xlsx';

export default function Reports() {
  const { members, loading: membersLoading } = useMembers();
  const { settings } = useSettings();
  const [generating, setGenerating] = useState(null);

  const fiscalYear = getCurrentFiscalYear();

  const generateMemberRoster = () => {
    setGenerating('roster');
    try {
      const activeMembers = members.filter(m => m.status === 'Active');
      exportMembersToExcel(activeMembers, `member-roster-${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setGenerating(null);
    }
  };

  const generateMembersByTier = () => {
    setGenerating('tier');
    try {
      const data = members
        .filter(m => m.status === 'Active')
        .map(m => ({
          'Member #': m.member_number,
          'Name': `${m.last_name}, ${m.first_name}`,
          'Tier': m.tier,
          'Age': calculateAge(m.date_of_birth),
          'Years': calculateConsecutiveYears(m.original_join_date),
          'Join Date': m.original_join_date,
          'Email': m.email || '',
          'Phone': m.phone || ''
        }))
        .sort((a, b) => {
          const tierOrder = { Life: 0, Honorary: 1, Regular: 2, Absentee: 3 };
          return (tierOrder[a.Tier] || 99) - (tierOrder[b.Tier] || 99);
        });
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Members by Tier');
      XLSX.writeFile(wb, `members-by-tier-${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setGenerating(null);
    }
  };

  const generateBillingReport = async () => {
    setGenerating('billing');
    try {
      const { data: workHours } = await supabase
        .from('work_hours')
        .select('member_id, hours_worked')
        .eq('approved', true);
      
      const hoursByMember = {};
      (workHours || []).forEach(h => {
        if (!hoursByMember[h.member_id]) hoursByMember[h.member_id] = 0;
        hoursByMember[h.member_id] += parseFloat(h.hours_worked);
      });
      
      const billingData = members
        .filter(m => m.status === 'Active' && (m.tier === 'Regular' || m.tier === 'Absentee'))
        .map(m => {
          const hours = hoursByMember[m.id] || 0;
          const billing = calculateBilling(m, settings, hours);
          return {
            member_number: m.member_number,
            first_name: m.first_name,
            last_name: m.last_name,
            tier: m.tier,
            ...billing,
            work_hours_completed: hours,
            work_hours_short: billing.workHoursShort,
            payment_status: 'Unpaid'
          };
        });
      
      exportBillingReportToExcel(billingData, fiscalYear, `billing-report-${fiscalYear}.xlsx`);
    } finally {
      setGenerating(null);
    }
  };

  const generateLifeEligible = () => {
    setGenerating('life');
    try {
      const data = members
        .filter(m => m.status === 'Active' && m.tier !== 'Life')
        .map(m => ({
          'Member #': m.member_number,
          'Name': `${m.last_name}, ${m.first_name}`,
          'Tier': m.tier,
          'Age': calculateAge(m.date_of_birth),
          'Years': calculateConsecutiveYears(m.original_join_date),
          'Join Date': m.original_join_date,
          'Years to Longevity': Math.max(0, 30 - calculateConsecutiveYears(m.original_join_date)),
          'Years to Age 62': Math.max(0, 62 - calculateAge(m.date_of_birth))
        }))
        .filter(m => m['Years to Longevity'] <= 5 || (m['Years to Age 62'] <= 5 && m.Years >= 15))
        .sort((a, b) => Math.min(a['Years to Longevity'], a['Years to Age 62']) - Math.min(b['Years to Longevity'], b['Years to Age 62']));
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Life Eligibility');
      XLSX.writeFile(wb, `life-eligibility-${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setGenerating(null);
    }
  };

  const generateWorkHoursReport = async () => {
    setGenerating('hours');
    try {
      const { data: workHours } = await supabase
        .from('work_hours')
        .select('*, members(member_number, first_name, last_name)')
        .eq('approved', true)
        .order('hours_date', { ascending: false });
      
      const data = (workHours || []).map(h => ({
        'Date': h.hours_date,
        'Member #': h.members?.member_number || '',
        'Name': h.members ? `${h.members.last_name}, ${h.members.first_name}` : '',
        'Hours': h.hours_worked,
        'Description': h.description || ''
      }));
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Work Hours');
      XLSX.writeFile(wb, `work-hours-${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setGenerating(null);
    }
  };

  const generateContactList = () => {
    setGenerating('contact');
    try {
      const data = members
        .filter(m => m.status === 'Active')
        .map(m => ({
          'Member #': m.member_number,
          'Name': `${m.last_name}, ${m.first_name}`,
          'Tier': m.tier,
          'Email': m.email || '',
          'Phone': m.phone || '',
          'Address': m.address_street || '',
          'City': m.address_city || '',
          'State': m.address_state || '',
          'ZIP': m.address_zip || ''
        }))
        .sort((a, b) => a.Name.localeCompare(b.Name));
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contact List');
      XLSX.writeFile(wb, `contact-list-${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setGenerating(null);
    }
  };

  const generateStatusSummary = () => {
    setGenerating('status');
    try {
      // Count by tier (Active only) and status (all)
      const tierCounts = { Regular: 0, Absentee: 0, Life: 0, Honorary: 0 };
      const statusCounts = { Active: 0, Deceased: 0, Resigned: 0, Expelled: 0 };
      
      members.forEach(m => {
        // Count ALL members by status
        if (statusCounts[m.status] !== undefined) statusCounts[m.status]++;
        // Count ONLY ACTIVE members by tier
        if (m.status === 'Active' && tierCounts[m.tier] !== undefined) tierCounts[m.tier]++;
      });
      
      const summaryData = [
        { Category: 'By Tier', Type: 'Regular', Count: tierCounts.Regular },
        { Category: 'By Tier', Type: 'Absentee', Count: tierCounts.Absentee },
        { Category: 'By Tier', Type: 'Life', Count: tierCounts.Life },
        { Category: 'By Tier', Type: 'Honorary', Count: tierCounts.Honorary },
        { Category: '', Type: '', Count: '' },
        { Category: 'By Status', Type: 'Active', Count: statusCounts.Active },
        { Category: 'By Status', Type: 'Deceased', Count: statusCounts.Deceased },
        { Category: 'By Status', Type: 'Resigned', Count: statusCounts.Resigned },
        { Category: 'By Status', Type: 'Expelled', Count: statusCounts.Expelled },
        { Category: '', Type: '', Count: '' },
        { Category: 'Total', Type: 'All Members', Count: members.length }
      ];
      
      const ws = XLSX.utils.json_to_sheet(summaryData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Summary');
      XLSX.writeFile(wb, `membership-summary-${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setGenerating(null);
    }
  };

  if (membersLoading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const reports = [
    {
      id: 'roster',
      title: 'Active Member Roster',
      description: 'Complete list of all active members with contact information',
      icon: Users,
      action: generateMemberRoster
    },
    {
      id: 'tier',
      title: 'Members by Tier',
      description: 'Active members grouped by membership tier',
      icon: Users,
      action: generateMembersByTier
    },
    {
      id: 'billing',
      title: 'Billing Report',
      description: `Dues, assessments, and buyouts for fiscal year ${fiscalYear}`,
      icon: DollarSign,
      action: generateBillingReport
    },
    {
      id: 'hours',
      title: 'Work Hours Log',
      description: 'All approved work hour entries',
      icon: Clock,
      action: generateWorkHoursReport
    },
    {
      id: 'life',
      title: 'Life Eligibility Forecast',
      description: 'Members approaching Life membership eligibility',
      icon: Award,
      action: generateLifeEligible
    },
    {
      id: 'contact',
      title: 'Contact List',
      description: 'Email, phone, and address for all active members',
      icon: FileText,
      action: generateContactList
    },
    {
      id: 'status',
      title: 'Membership Summary',
      description: 'Statistics by tier and status',
      icon: FileText,
      action: generateStatusSummary
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Reports</h1>
        <p style={{ color: '#6b7280' }}>Generate and export membership reports</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {reports.map(report => (
          <div key={report.id} className="card">
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  background: '#dbeafe', 
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <report.icon size={24} color="#2563eb" />
                </div>
                <div>
                  <h3 style={{ fontWeight: '600', marginBottom: '4px' }}>{report.title}</h3>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>{report.description}</p>
                </div>
              </div>
              <button 
                onClick={report.action} 
                className="btn btn-secondary"
                disabled={generating === report.id}
                style={{ width: '100%' }}
              >
                <Download size={16} />
                {generating === report.id ? 'Generating...' : 'Download Excel'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="card" style={{ marginTop: '32px' }}>
        <div className="card-header">
          <h2>Current Membership Stats</h2>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>Total Members</div>
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{members.length}</div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>Active</div>
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{members.filter(m => m.status === 'Active').length}</div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>Regular</div>
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{members.filter(m => m.status === 'Active' && m.tier === 'Regular').length}</div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>Absentee</div>
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{members.filter(m => m.status === 'Active' && m.tier === 'Absentee').length}</div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>Life</div>
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{members.filter(m => m.status === 'Active' && m.tier === 'Life').length}</div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>Honorary</div>
              <div style={{ fontSize: '24px', fontWeight: '700' }}>{members.filter(m => m.status === 'Active' && m.tier === 'Honorary').length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
