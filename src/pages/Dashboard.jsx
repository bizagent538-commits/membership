import { Link } from 'react-router-dom';
import { useDashboardStats, useSettings } from '../hooks/useData';
import { useLifeEligibilityQueue } from '../hooks/useData';
import { Users, UserCheck, Award, AlertTriangle, DollarSign, Clock, Calendar } from 'lucide-react';
import { formatCurrency, getCollectionPeriodStatus, getWorkHourReviewStatus, getCurrentFiscalYear } from '../utils/calculations';

export default function Dashboard() {
  const { stats, loading } = useDashboardStats();
  const { queue: lifeQueue } = useLifeEligibilityQueue();
  const { settings } = useSettings();
  
  const collectionStatus = getCollectionPeriodStatus();
  const workHourStatus = getWorkHourReviewStatus();
  const fiscalYear = getCurrentFiscalYear();

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
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Dashboard</h1>
        <p style={{ color: '#6b7280' }}>Fiscal Year {fiscalYear}</p>
      </div>

      {/* Alert Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {collectionStatus.status === 'open' && (
          <div className="alert alert-warning">
            <Calendar size={20} />
            <div>
              <strong>Collection Period Open</strong>
              <p style={{ margin: 0 }}>{collectionStatus.message}</p>
            </div>
          </div>
        )}
        
        {workHourStatus.status === 'review' && (
          <div className="alert alert-info">
            <Clock size={20} />
            <div>
              <strong>Work Hour Review Period</strong>
              <p style={{ margin: 0 }}>{workHourStatus.message}</p>
            </div>
          </div>
        )}
        
        {lifeQueue.length > 0 && (
          <div className="alert alert-success">
            <Award size={20} />
            <div>
              <strong>{lifeQueue.length} member{lifeQueue.length > 1 ? 's' : ''} eligible for Life membership</strong>
              <p style={{ margin: 0 }}>
                <Link to="/life-eligibility" style={{ color: 'inherit' }}>Review eligibility queue →</Link>
              </p>
            </div>
          </div>
        )}
        
        {stats.unpaidBills > 0 && (
          <div className="alert alert-danger">
            <AlertTriangle size={20} />
            <div>
              <strong>{stats.unpaidBills} unpaid bill{stats.unpaidBills > 1 ? 's' : ''}</strong>
              <p style={{ margin: 0 }}>
                Total outstanding: {formatCurrency(stats.totalDue)} — <Link to="/billing" style={{ color: 'inherit' }}>View billing →</Link>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Members</div>
          <div className="stat-value">{stats.totalMembers}</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-label">Active Members</div>
          <div className="stat-value">{stats.activeMembers}</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-label">Regular</div>
          <div className="stat-value">{stats.byTier.Regular}</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-label">Life</div>
          <div className="stat-value">{stats.byTier.Life}</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-label">Absentee</div>
          <div className="stat-value">{stats.byTier.Absentee}</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-label">Honorary</div>
          <div className="stat-value">{stats.byTier.Honorary}</div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="card">
        <div className="card-header">
          <h2>Quick Actions</h2>
        </div>
        <div className="card-body" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/members/new" className="btn btn-primary">
            <Users size={16} /> Add Member
          </Link>
          <Link to="/billing" className="btn btn-secondary">
            <DollarSign size={16} /> Generate Bills
          </Link>
          <Link to="/work-hours" className="btn btn-secondary">
            <Clock size={16} /> Review Work Hours
          </Link>
          <Link to="/reports" className="btn btn-secondary">
            <UserCheck size={16} /> Export Reports
          </Link>
        </div>
      </div>

      {/* Current Settings Summary */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2>Current Rates</h2>
          <Link to="/settings" className="btn btn-sm btn-secondary">Edit Settings</Link>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: '13px' }}>Regular Dues</div>
              <div style={{ fontWeight: '600' }}>{formatCurrency(settings.regular_dues || 300)}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '13px' }}>Absentee Dues</div>
              <div style={{ fontWeight: '600' }}>{formatCurrency(settings.absentee_dues || 50)}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '13px' }}>Work Hours Required</div>
              <div style={{ fontWeight: '600' }}>{settings.work_hours_required || 10} hrs</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '13px' }}>Buyout Rate</div>
              <div style={{ fontWeight: '600' }}>{formatCurrency(settings.buyout_rate || 20)}/hr</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '13px' }}>Assessment (5 yr)</div>
              <div style={{ fontWeight: '600' }}>{formatCurrency(settings.assessment_amount || 50)}/yr</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '13px' }}>Cabaret Tax</div>
              <div style={{ fontWeight: '600' }}>{(parseFloat(settings.cabaret_tax_rate || 0.10) * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
