import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Hook for fetching settings
export function useSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('settings')
        .select('*');
      
      if (error) throw error;
      
      // Convert array to object
      const settingsObj = {};
      data.forEach(s => {
        settingsObj[s.setting_key] = s.setting_value;
      });
      setSettings(settingsObj);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key, value) => {
    const { error } = await supabase
      .from('settings')
      .update({ setting_value: String(value) })
      .eq('setting_key', key);
    
    if (error) throw error;
    
    setSettings(prev => ({ ...prev, [key]: String(value) }));
  };

  return { settings, loading, error, updateSetting, refetch: fetchSettings };
}

// Hook for fetching members
export function useMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('last_name', { ascending: true });
      
      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, loading, error, refetch: fetchMembers, setMembers };
}

// Hook for a single member with related data
export function useMember(id) {
  const [member, setMember] = useState(null);
  const [encumbrances, setEncumbrances] = useState([]);
  const [tierHistory, setTierHistory] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [membershipYears, setMembershipYears] = useState([]);
  const [payments, setPayments] = useState([]);
  const [workHours, setWorkHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMember = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      const [
        memberRes,
        encumbrancesRes,
        tierHistoryRes,
        statusHistoryRes,
        membershipYearsRes,
        paymentsRes,
        workHoursRes
      ] = await Promise.all([
        supabase.from('members').select('*').eq('id', id).single(),
        supabase.from('encumbrances').select('*').eq('member_id', id).order('date_applied', { ascending: false }),
        supabase.from('tier_history').select('*').eq('member_id', id).order('effective_date', { ascending: false }),
        supabase.from('status_history').select('*').eq('member_id', id).order('change_date', { ascending: false }),
        supabase.from('membership_years').select('*').eq('member_id', id).order('fiscal_year', { ascending: false }),
        supabase.from('payments').select('*').eq('member_id', id).order('payment_date', { ascending: false }),
        supabase.from('work_hours').select('*').eq('member_id', id).order('hours_date', { ascending: false })
      ]);

      if (memberRes.error) throw memberRes.error;
      
      setMember(memberRes.data);
      setEncumbrances(encumbrancesRes.data || []);
      setTierHistory(tierHistoryRes.data || []);
      setStatusHistory(statusHistoryRes.data || []);
      setMembershipYears(membershipYearsRes.data || []);
      setPayments(paymentsRes.data || []);
      setWorkHours(workHoursRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  return { 
    member, 
    encumbrances, 
    tierHistory, 
    statusHistory, 
    membershipYears, 
    payments, 
    workHours,
    loading, 
    error, 
    refetch: fetchMember 
  };
}

// Hook for dashboard stats
export function useDashboardStats() {
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    byTier: { Regular: 0, Absentee: 0, Life: 0, Honorary: 0 },
    byStatus: { Active: 0, Deceased: 0, Resigned: 0, Expelled: 0 },
    lifeEligible: 0,
    unpaidBills: 0,
    totalDue: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: members } = await supabase
        .from('members')
        .select('tier, status');
      
      const { data: eligibleMembers } = await supabase
        .from('life_eligibility_log')
        .select('id')
        .eq('action_taken', 'Pending');
      
      const { data: unpaidYears } = await supabase
        .from('membership_years')
        .select('total_owed, total_paid')
        .neq('payment_status', 'Paid');
      
      if (members) {
        const byTier = { Regular: 0, Absentee: 0, Life: 0, Honorary: 0 };
        const byStatus = { Active: 0, Deceased: 0, Resigned: 0, Expelled: 0 };
        
        members.forEach(m => {
          if (byTier[m.tier] !== undefined) byTier[m.tier]++;
          if (byStatus[m.status] !== undefined) byStatus[m.status]++;
        });
        
        let totalDue = 0;
        if (unpaidYears) {
          unpaidYears.forEach(y => {
            totalDue += parseFloat(y.total_owed || 0) - parseFloat(y.total_paid || 0);
          });
        }
        
        setStats({
          totalMembers: members.length,
          activeMembers: byStatus.Active,
          byTier,
          byStatus,
          lifeEligible: eligibleMembers?.length || 0,
          unpaidBills: unpaidYears?.length || 0,
          totalDue
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}

// Hook for life eligibility queue
export function useLifeEligibilityQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('life_eligibility_log')
        .select(`
          *,
          members (
            id,
            member_number,
            first_name,
            last_name,
            date_of_birth,
            original_join_date,
            tier
          )
        `)
        .eq('action_taken', 'Pending')
        .order('date_flagged', { ascending: true });
      
      if (error) throw error;
      setQueue(data || []);
    } catch (err) {
      console.error('Error fetching life eligibility queue:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return { queue, loading, refetch: fetchQueue };
}
