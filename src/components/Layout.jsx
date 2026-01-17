import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Users, LayoutDashboard, DollarSign, Clock, Award, FileText, Settings, LogOut, Upload, ListOrdered } from 'lucide-react';

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-title">
          <Users size={24} color="#2563eb" />
          <h1>Membership Management</h1>
        </div>
        
        <nav className="header-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={16} /> Dashboard
          </NavLink>
          <NavLink to="/members" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Users size={16} /> Members
          </NavLink>
          <NavLink to="/billing" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <DollarSign size={16} /> Billing
          </NavLink>
          <NavLink to="/work-hours" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Clock size={16} /> Work Hours
          </NavLink>
          <NavLink to="/life-eligibility" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Award size={16} /> Life Eligibility
          </NavLink>
          <NavLink to="/waitlist" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ListOrdered size={16} /> Waitlist
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FileText size={16} /> Reports
          </NavLink>
          <NavLink to="/import" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Upload size={16} /> Import
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Settings size={16} /> Settings
          </NavLink>
        </nav>

        <div className="header-user">
          <span style={{ fontSize: '14px', color: '#6b7280' }}>{user?.email}</span>
          <button onClick={handleSignOut} className="btn btn-secondary btn-sm">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
