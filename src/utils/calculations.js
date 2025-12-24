// Date and calculation utilities for membership management

// Get current fiscal year (July 1 - June 30)
export function getCurrentFiscalYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  
  if (month >= 7) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

// Get current work hour year (March 1 - February 28)
export function getCurrentWorkYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  
  if (month >= 3) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

// Get fiscal year from a date
export function getFiscalYearFromDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  
  if (month >= 7) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

// Get quarter within fiscal year (Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun)
export function getFiscalQuarter(date) {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  
  if (month >= 7 && month <= 9) return 1;
  if (month >= 10 && month <= 12) return 2;
  if (month >= 1 && month <= 3) return 3;
  return 4;
}

// Get proration percentage based on quarter
export function getProrationPercentage(quarter) {
  const prorations = { 1: 1.0, 2: 0.75, 3: 0.5, 4: 0.25 };
  return prorations[quarter] || 1.0;
}

// Calculate age from date of birth
export function calculateAge(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
}

// Calculate consecutive years of membership
export function calculateConsecutiveYears(originalJoinDate) {
  const joinDate = new Date(originalJoinDate);
  const today = new Date();
  
  let years = today.getFullYear() - joinDate.getFullYear();
  
  // Adjust if we haven't reached the anniversary yet this year
  const joinMonth = joinDate.getMonth();
  const joinDay = joinDate.getDate();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();
  
  if (currentMonth < joinMonth || (currentMonth === joinMonth && currentDay < joinDay)) {
    years--;
  }
  
  return Math.max(0, years);
}

// Calculate prorated dues
export function calculateProratedDues(baseDues, joinDate) {
  const quarter = getFiscalQuarter(joinDate);
  const proration = getProrationPercentage(quarter);
  return Math.round(baseDues * proration * 100) / 100;
}

// Calculate prorated work hours
export function calculateProratedHours(baseHours, joinDate) {
  const quarter = getFiscalQuarter(joinDate);
  const proration = getProrationPercentage(quarter);
  return Math.round(baseHours * proration * 10) / 10;
}

// Calculate billing for a member
export function calculateBilling(member, settings, workHoursCompleted = 0) {
  const result = {
    dues: 0,
    assessment: 0,
    workHoursRequired: 0,
    workHoursCompleted: workHoursCompleted,
    workHoursShort: 0,
    buyout: 0,
    subtotal: 0,
    tax: 0,
    total: 0
  };
  
  // Life and Honorary pay nothing
  if (member.tier === 'Life' || member.tier === 'Honorary') {
    return result;
  }
  
  // Absentee pays flat rate, no work hours
  if (member.tier === 'Absentee') {
    result.dues = parseFloat(settings.absentee_dues || 50);
    result.subtotal = result.dues;
    result.tax = Math.round(result.subtotal * parseFloat(settings.cabaret_tax_rate || 0.10) * 100) / 100;
    result.total = result.subtotal + result.tax;
    return result;
  }
  
  // Regular member
  const baseDues = parseFloat(settings.regular_dues || 300);
  const baseHours = parseFloat(settings.work_hours_required || 10);
  const buyoutRate = parseFloat(settings.buyout_rate || 20);
  const assessmentAmount = parseFloat(settings.assessment_amount || 50);
  const taxRate = parseFloat(settings.cabaret_tax_rate || 0.10);
  
  // For new members, calculate proration
  // For existing members, use full amounts
  const joinYear = new Date(member.original_join_date).getFullYear();
  const currentYear = new Date().getFullYear();
  const isNewMember = joinYear === currentYear || 
    (joinYear === currentYear - 1 && new Date().getMonth() < 6);
  
  if (isNewMember) {
    result.dues = calculateProratedDues(baseDues, member.original_join_date);
    result.workHoursRequired = calculateProratedHours(baseHours, member.original_join_date);
  } else {
    result.dues = baseDues;
    result.workHoursRequired = baseHours;
  }
  
  // Assessment for first 5 years
  if (member.assessment_years_completed < 5) {
    result.assessment = assessmentAmount;
  }
  
  // Work hours buyout
  result.workHoursShort = Math.max(0, result.workHoursRequired - workHoursCompleted);
  result.buyout = Math.round(result.workHoursShort * buyoutRate * 100) / 100;
  
  // Totals
  result.subtotal = result.dues + result.assessment + result.buyout;
  result.tax = Math.round(result.subtotal * taxRate * 100) / 100;
  result.total = Math.round((result.subtotal + result.tax) * 100) / 100;
  
  return result;
}

// Check Life eligibility
export function checkLifeEligibility(member, hasActiveEncumbrance) {
  if (hasActiveEncumbrance) {
    return { eligible: false, rule: null, reason: 'Has active Article XII encumbrance' };
  }
  
  if (member.tier === 'Life') {
    return { eligible: false, rule: null, reason: 'Already Life member' };
  }
  
  if (member.status !== 'Active') {
    return { eligible: false, rule: null, reason: 'Not an active member' };
  }
  
  const age = calculateAge(member.date_of_birth);
  const consecutiveYears = calculateConsecutiveYears(member.original_join_date);
  const joinDate = new Date(member.original_join_date);
  const cutoffDate = new Date('2011-07-01');
  
  // Longevity rule (30+ consecutive years, any age) - as of Jan 18, 2023
  if (consecutiveYears >= 30) {
    return { 
      eligible: true, 
      rule: 'Longevity', 
      reason: `${consecutiveYears} consecutive years (30+ required)` 
    };
  }
  
  // Legacy rule (joined before July 1, 2011: 62+ age, 10+ years)
  if (joinDate < cutoffDate && age >= 62 && consecutiveYears >= 10) {
    return { 
      eligible: true, 
      rule: 'Legacy', 
      reason: `Age ${age} (62+ required), ${consecutiveYears} consecutive years (10+ required), joined before July 2011` 
    };
  }
  
  // Standard rule (joined July 1, 2011 or after: 62+ age, 20+ years)
  if (joinDate >= cutoffDate && age >= 62 && consecutiveYears >= 20) {
    return { 
      eligible: true, 
      rule: 'Standard', 
      reason: `Age ${age} (62+ required), ${consecutiveYears} consecutive years (20+ required)` 
    };
  }
  
  // Not eligible - provide closest path
  let closest = '';
  if (consecutiveYears >= 20 && age < 62) {
    closest = `${62 - age} years until age eligible`;
  } else if (age >= 62 && consecutiveYears < 20) {
    closest = `${20 - consecutiveYears} more years of membership needed`;
  } else if (consecutiveYears < 30) {
    closest = `${30 - consecutiveYears} years until longevity eligible`;
  }
  
  return { eligible: false, rule: null, reason: closest || 'Does not meet criteria' };
}

// Format currency
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

// Format date for display
export function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Format date for input fields
export function formatDateForInput(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

// Get collection period status
export function getCollectionPeriodStatus() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  
  // Collection period: Apr 1 - 1st Wed of June
  const apr1 = new Date(year, 3, 1);
  
  // Find first Wednesday of June
  const june1 = new Date(year, 5, 1);
  const firstWedJune = new Date(year, 5, 1);
  while (firstWedJune.getDay() !== 3) {
    firstWedJune.setDate(firstWedJune.getDate() + 1);
  }
  
  if (now < apr1) {
    const daysUntil = Math.ceil((apr1 - now) / (1000 * 60 * 60 * 24));
    return { status: 'pre', message: `Collection opens in ${daysUntil} days`, deadline: firstWedJune };
  }
  
  if (now >= apr1 && now <= firstWedJune) {
    const daysLeft = Math.ceil((firstWedJune - now) / (1000 * 60 * 60 * 24));
    return { status: 'open', message: `${daysLeft} days until deadline`, deadline: firstWedJune };
  }
  
  return { status: 'closed', message: 'Collection period closed', deadline: firstWedJune };
}

// Get work hour review period status
export function getWorkHourReviewStatus() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  // Work year ends Feb 28, review by Mar 30
  const feb28 = new Date(year, 1, 28);
  const mar30 = new Date(year, 2, 30);
  
  if (month >= 3) {
    // Next cycle
    return { 
      status: 'complete', 
      message: 'Work hour year closed',
      reviewDeadline: new Date(year + 1, 2, 30)
    };
  }
  
  if (now < feb28) {
    const daysLeft = Math.ceil((feb28 - now) / (1000 * 60 * 60 * 24));
    return { 
      status: 'open', 
      message: `${daysLeft} days left in work hour year`,
      reviewDeadline: mar30
    };
  }
  
  if (now >= feb28 && now <= mar30) {
    const daysLeft = Math.ceil((mar30 - now) / (1000 * 60 * 60 * 24));
    return { 
      status: 'review', 
      message: `Review work hours - ${daysLeft} days until deadline`,
      reviewDeadline: mar30
    };
  }
  
  return { status: 'complete', message: 'Review period closed', reviewDeadline: mar30 };
}
