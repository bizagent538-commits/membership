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

// Get quarter within billing year (Q1=Mar-May, Q2=Jun-Aug, Q3=Sep-Nov, Q4=Dec-Feb)
// Billing year runs March 1 - February 28
export function getFiscalQuarter(date) {
  const d = new Date(date);
  const month = d.getMonth() + 1; // 1-12
  
  // March 1 is start of billing year
  if (month >= 3 && month <= 5) return 1;  // Q1: Mar-May (100% - start of year)
  if (month >= 6 && month <= 8) return 2;  // Q2: Jun-Aug (75%)
  if (month >= 9 && month <= 11) return 3; // Q3: Sep-Nov (50%)
  return 4; // Q4: Dec-Feb (25% - end of year)
}

// Get proration percentage based on quarter
export function getProrationPercentage(quarter) {
  const prorations = { 1: 1.0, 2: 0.75, 3: 0.5, 4: 0.25 };
  return prorations[quarter] || 1.0;
}

// Calculate age from date of birth
export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  
  try {
    // Parse date as local date to avoid timezone shifts
    // If date is "1985-10-02", split and use local date constructor
    const dateStr = dateOfBirth.split('T')[0]; // Get just the date part
    const parts = dateStr.split('-');
    
    // Validate we have 3 parts
    if (parts.length !== 3) return null;
    
    const [year, month, day] = parts.map(Number);
    
    // Validate date parts
    if (!year || !month || !day || year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    
    const dob = new Date(year, month - 1, day); // Month is 0-indexed
    const today = new Date();
    
    // If birthdate is in the future, return null instead of negative
    if (dob > today) return null;
    
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    return age;
  } catch (err) {
    console.error('Error calculating age:', err);
    return null;
  }
}

// Calculate consecutive years of membership
export function calculateConsecutiveYears(originalJoinDate) {
  if (!originalJoinDate) return 0;
  
  // Parse as local date to avoid timezone shifts
  const dateStr = originalJoinDate.split('T')[0];
  const [year, month, day] = dateStr.split('-').map(Number);
  const joinDate = new Date(year, month - 1, day);
  
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

// Check if a date falls within the current billing year (March 1 - Feb 28)
export function isDateInCurrentBillingYear(date) {
  const d = new Date(date);
  const now = new Date();
  
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  const checkMonth = d.getMonth() + 1;
  const checkYear = d.getFullYear();
  
  // Determine current billing year start
  let billingYearStart;
  if (currentMonth >= 3) {
    billingYearStart = new Date(currentYear, 2, 1); // March 1 this year
  } else {
    billingYearStart = new Date(currentYear - 1, 2, 1); // March 1 last year
  }
  
  // Billing year end is Feb 28/29 of next year
  const billingYearEnd = new Date(billingYearStart.getFullYear() + 1, 1, 28);
  
  return d >= billingYearStart && d <= billingYearEnd;
}

// Get the date when member becomes Life eligible (returns null if not eligible this year)
export function getLifeEligibilityDate(member, hasActiveEncumbrance) {
  if (hasActiveEncumbrance) return null;
  if (member.tier === 'Life') return null;
  if (member.status !== 'Active') return null;
  
  const joinDate = new Date(member.original_join_date);
  const birthDate = new Date(member.date_of_birth);
  const cutoffDate = new Date('2011-07-01');
  
  // Calculate when they hit 30 years (longevity rule)
  const longevityDate = new Date(joinDate);
  longevityDate.setFullYear(longevityDate.getFullYear() + 30);
  
  // Calculate when they turn 62 (age requirement)
  const age62Date = new Date(birthDate);
  age62Date.setFullYear(age62Date.getFullYear() + 62);
  
  const consecutiveYears = calculateConsecutiveYears(member.original_join_date);
  const age = calculateAge(member.date_of_birth);
  
  // Longevity rule (30 years) - check if they hit 30 years this billing year
  if (consecutiveYears >= 29 && consecutiveYears < 30) {
    if (isDateInCurrentBillingYear(longevityDate)) {
      return longevityDate;
    }
  }
  
  // Legacy rule (joined before July 1, 2011: turns 62 this year, already has 10+ years)
  if (joinDate < cutoffDate && consecutiveYears >= 10 && age >= 61 && age < 62) {
    if (isDateInCurrentBillingYear(age62Date)) {
      return age62Date;
    }
  }
  
  // Standard rule (joined July 1, 2011 or after: turns 62 this year, already has 20+ years)
  if (joinDate >= cutoffDate && consecutiveYears >= 20 && age >= 61 && age < 62) {
    if (isDateInCurrentBillingYear(age62Date)) {
      return age62Date;
    }
  }
  
  return null;
}

// Calculate billing for a member
export function calculateBilling(member, settings, workHoursCompleted = 0, hasActiveEncumbrance = false) {
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
  
  // Check if member will become Life eligible THIS billing year
  const lifeEligibilityDate = getLifeEligibilityDate(member, hasActiveEncumbrance);
  const isBecomingLifeThisYear = lifeEligibilityDate && isDateInCurrentBillingYear(lifeEligibilityDate);
  
  // For new members, calculate proration
  // For existing members, use full amounts
  // Billing year runs March 1 - Feb 28
  const now = new Date();
  const joinDate = new Date(member.original_join_date);
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  const joinMonth = joinDate.getMonth() + 1;
  const joinYear = joinDate.getFullYear();
  
  // Calculate which billing year we're in (starts March 1)
  let currentBillingYear;
  if (currentMonth >= 3) {
    currentBillingYear = currentYear; // Mar-Dec 2026 = 2026 billing year
  } else {
    currentBillingYear = currentYear - 1; // Jan-Feb 2026 = 2025 billing year
  }
  
  // Calculate which billing year they joined in
  let joinBillingYear;
  if (joinMonth >= 3) {
    joinBillingYear = joinYear;
  } else {
    joinBillingYear = joinYear - 1;
  }
  
  // Determine if new member or becoming Life eligible this year
  const isNewMember = joinBillingYear === currentBillingYear;
  
  if (isNewMember) {
    // New member proration
    result.dues = calculateProratedDues(baseDues, member.original_join_date);
    result.workHoursRequired = calculateProratedHours(baseHours, member.original_join_date);
  } else if (isBecomingLifeThisYear) {
    // Becoming Life eligible this year - prorate based on eligibility date
    // They only pay for the portion of the year BEFORE they become Life eligible
    const eligibilityQuarter = getFiscalQuarter(lifeEligibilityDate);
    // Reverse proration: Q1 = 0% (eligible at start), Q2 = 25%, Q3 = 50%, Q4 = 75%
    const reverseProration = { 1: 0, 2: 0.25, 3: 0.5, 4: 0.75 }[eligibilityQuarter] || 0;
    result.dues = Math.round(baseDues * reverseProration * 100) / 100;
    result.workHoursRequired = Math.round(baseHours * reverseProration * 10) / 10;
  } else {
    // Regular member, full year
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
  
  // Parse as local date to avoid timezone shifts
  const dateStr = date.split('T')[0];
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  
  return d.toLocaleDateString('en-US', {
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
