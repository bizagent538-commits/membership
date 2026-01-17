// Membership App - Fixed Date Utilities
// Fixes negative age calculation bug

/**
 * Calculate age from date of birth - FIXED VERSION
 * Handles timezone issues that cause negative ages
 * 
 * @param {string|Date} dateOfBirth - Date in ISO format (YYYY-MM-DD) or Date object
 * @returns {number|null} - Age in years, or null if invalid
 */
export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  
  // Parse the date carefully to avoid timezone issues
  let dob;
  
  if (typeof dateOfBirth === 'string') {
    // If it's an ISO date string like "1985-03-15" or "1985-03-15T00:00:00.000Z"
    // Parse it as a local date to avoid timezone shifts
    const parts = dateOfBirth.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
      const day = parseInt(parts[2], 10);
      
      // Validate the parts
      if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
      if (year < 1900 || year > new Date().getFullYear()) return null;
      if (month < 0 || month > 11) return null;
      if (day < 1 || day > 31) return null;
      
      dob = new Date(year, month, day);
    } else {
      return null;
    }
  } else if (dateOfBirth instanceof Date) {
    dob = dateOfBirth;
  } else {
    return null;
  }
  
  // Validate the resulting date
  if (isNaN(dob.getTime())) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day
  
  // Check if birthdate is in the future
  if (dob > today) {
    console.warn('Birthdate is in the future:', dateOfBirth);
    return null; // Return null instead of negative
  }
  
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  const dayDiff = today.getDate() - dob.getDate();
  
  // Adjust if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }
  
  // Final validation - age should never be negative
  if (age < 0) {
    console.warn('Calculated negative age for:', dateOfBirth);
    return null;
  }
  
  return age;
}

/**
 * Format date for display - handles timezone issues
 * @param {string|Date} date 
 * @returns {string} Formatted date like "Mar 15, 1985"
 */
export function formatDate(date) {
  if (!date) return '';
  
  let d;
  if (typeof date === 'string') {
    // Parse as local date
    const parts = date.split('T')[0].split('-');
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      return '';
    }
  } else {
    d = new Date(date);
  }
  
  if (isNaN(d.getTime())) return '';
  
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format date for input fields (YYYY-MM-DD)
 * @param {string|Date} date 
 * @returns {string} Date in YYYY-MM-DD format
 */
export function formatDateForInput(date) {
  if (!date) return '';
  
  let d;
  if (typeof date === 'string') {
    // Already in correct format?
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    
    // Parse ISO string
    const parts = date.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return '';
  }
  
  d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Calculate consecutive years of membership
 * @param {string|Date} originalJoinDate 
 * @returns {number}
 */
export function calculateConsecutiveYears(originalJoinDate) {
  if (!originalJoinDate) return 0;
  
  let joinDate;
  if (typeof originalJoinDate === 'string') {
    const parts = originalJoinDate.split('T')[0].split('-');
    if (parts.length === 3) {
      joinDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      return 0;
    }
  } else {
    joinDate = new Date(originalJoinDate);
  }
  
  if (isNaN(joinDate.getTime())) return 0;
  
  const today = new Date();
  let years = today.getFullYear() - joinDate.getFullYear();
  
  // Adjust if anniversary hasn't occurred yet
  const joinMonth = joinDate.getMonth();
  const joinDay = joinDate.getDate();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();
  
  if (currentMonth < joinMonth || (currentMonth === joinMonth && currentDay < joinDay)) {
    years--;
  }
  
  return Math.max(0, years);
}

/**
 * Validate a date string
 * @param {string} dateStr 
 * @returns {boolean}
 */
export function isValidDate(dateStr) {
  if (!dateStr) return false;
  
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return false;
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  // Check if the date is actually valid (e.g., Feb 30 is not valid)
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}
