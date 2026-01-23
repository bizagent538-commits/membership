// ============================================
// EXCEL IMPORT FIX - ADD TO src/utils/excel.js
// ============================================

// ISSUE: key_fob_number and deceased members not importing correctly
// 
// Find the parseExcelFile function and update the field mapping section.
// Look for where it maps Excel columns to member fields.

// ADD THIS TO THE FIELD MAPPING (inside the row processing loop):

// Key Fob Number - check multiple possible column names
const keyFobNumber = row['key_fob_number'] || 
                     row['Key Fob Number'] || 
                     row['Key Fob'] || 
                     row['KeyFob'] || 
                     row['Fob Number'] || 
                     row['fob_number'] ||
                     row['FOB'] ||
                     '';

// Then add to the member object being created:
// key_fob_number: keyFobNumber || null,

// ============================================
// FULL UPDATED parseExcelFile FUNCTION
// Replace the entire parseExcelFile function with this:
// ============================================

export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        
        const members = [];
        const errors = [];
        const warnings = [];
        const memberNumbers = new Set();
        
        jsonData.forEach((row, index) => {
          const rowNum = index + 2; // Excel row (1-indexed + header)
          const rowErrors = [];
          const rowWarnings = [];
          
          // Get values with flexible column name matching
          const memberNumber = row['member_number'] || row['Member Number'] || row['Member #'] || row['MemberNumber'] || row['member#'];
          const firstName = row['first_name'] || row['First Name'] || row['FirstName'] || row['first'];
          const lastName = row['last_name'] || row['Last Name'] || row['LastName'] || row['last'];
          const dateOfBirth = row['date_of_birth'] || row['Date of Birth'] || row['DOB'] || row['Birthday'] || row['Birthdate'];
          const joinDate = row['original_join_date'] || row['Join Date'] || row['JoinDate'] || row['Original Join Date'] || row['join_date'];
          const tier = row['tier'] || row['Tier'] || row['Membership Type'] || row['Type'];
          const status = row['status'] || row['Status'] || '';
          const email = row['email'] || row['Email'] || row['E-mail'] || '';
          const phone = row['phone'] || row['Phone'] || row['Phone Number'] || row['Telephone'] || '';
          const addressStreet = row['address_street'] || row['Street'] || row['Address'] || row['Street Address'] || '';
          const addressCity = row['address_city'] || row['City'] || '';
          const addressState = row['address_state'] || row['State'] || row['State/Province'] || '';
          const addressZip = row['address_zip'] || row['ZIP'] || row['Zip'] || row['Postal Code'] || row['ZipCode'] || '';
          const assessmentYears = row['assessment_years_completed'] || row['Assessment Years'] || row['Assessment Years Completed'] || '0';
          const hasEncumbrance = row['has_encumbrance'] || row['Encumbrance'] || row['Has Encumbrance'] || 'N';
          const encumbranceDate = row['encumbrance_date'] || row['Encumbrance Date'] || '';
          const encumbranceReason = row['encumbrance_reason'] || row['Encumbrance Reason'] || '';
          const notes = row['notes'] || row['Notes'] || row['Comments'] || '';
          
          // KEY FOB NUMBER - check multiple possible column names
          const keyFobNumber = row['key_fob_number'] || 
                              row['Key Fob Number'] || 
                              row['Key Fob'] || 
                              row['KeyFob'] || 
                              row['Fob Number'] || 
                              row['fob_number'] ||
                              row['FOB'] ||
                              row['fob'] ||
                              '';
          
          // Normalize tier and status
          let normalizedTier = tier;
          let normalizedStatus = status;
          const tierLower = (tier || '').toLowerCase();
          const statusLower = (status || '').toLowerCase();
          
          // Handle "Deceased Member" as a tier (it's actually a status)
          if (tierLower.includes('deceased')) {
            normalizedTier = 'Regular';
            normalizedStatus = 'Deceased';
          } else if (tierLower.includes('regular')) {
            normalizedTier = 'Regular';
          } else if (tierLower.includes('absentee')) {
            normalizedTier = 'Absentee';
          } else if (tierLower.includes('life')) {
            normalizedTier = 'Life';
          } else if (tierLower.includes('honorary')) {
            normalizedTier = 'Honorary';
          } else if (tierLower.includes('waitlist') || tierLower.includes('wait list')) {
            normalizedTier = 'Waitlist';
          } else {
            normalizedTier = 'Regular'; // Default to Regular for unknown tiers
            if (tier) rowWarnings.push(`Unknown tier "${tier}" - defaulting to Regular`);
          }
          
          // Normalize status (only if not already set by tier processing)
          if (normalizedStatus === status) {
            if (statusLower.includes('active')) normalizedStatus = 'Active';
            else if (statusLower.includes('deceased')) normalizedStatus = 'Deceased';
            else if (statusLower.includes('resigned')) normalizedStatus = 'Resigned';
            else if (statusLower.includes('expelled')) normalizedStatus = 'Expelled';
            else normalizedStatus = 'Active'; // Default to Active
          }
          
          // Parse dates
          let parsedDOB = null;
          let parsedJoinDate = null;
          
          if (dateOfBirth) {
            parsedDOB = parseDate(dateOfBirth);
            if (!parsedDOB) rowWarnings.push(`Invalid date of birth: ${dateOfBirth}`);
          }
          
          if (joinDate) {
            parsedJoinDate = parseDate(joinDate);
            if (!parsedJoinDate) rowWarnings.push(`Invalid join date: ${joinDate}`);
          }
          
          // Build member object
          const member = {
            member_number: memberNumber ? String(memberNumber).trim() : null,
            first_name: firstName ? String(firstName).trim() : null,
            last_name: lastName ? String(lastName).trim() : null,
            date_of_birth: parsedDOB,
            original_join_date: parsedJoinDate,
            tier: normalizedTier,
            status: normalizedStatus,
            key_fob_number: keyFobNumber ? String(keyFobNumber).trim() : null,
            email: email ? String(email).trim().toLowerCase() : null,
            phone: phone ? String(phone).trim() : null,
            address_street: addressStreet ? String(addressStreet).trim() : null,
            address_city: addressCity ? String(addressCity).trim() : null,
            address_state: addressState ? String(addressState).trim() : null,
            address_zip: addressZip ? String(addressZip).trim() : null,
            assessment_years_completed: parseInt(assessmentYears) || 0,
            has_encumbrance: hasEncumbrance && (hasEncumbrance.toLowerCase() === 'y' || hasEncumbrance.toLowerCase() === 'yes' || hasEncumbrance === true),
            encumbrance_date: encumbranceDate ? parseDate(encumbranceDate) : null,
            encumbrance_reason: encumbranceReason ? String(encumbranceReason).trim() : null,
            notes: notes ? String(notes).trim() : null
          };
          
          // Required fields validation
          if (!member.member_number) {
            rowErrors.push('Missing member number');
          } else if (memberNumbers.has(member.member_number)) {
            rowErrors.push(`Duplicate member number: ${member.member_number}`);
          } else {
            memberNumbers.add(member.member_number);
          }
          
          if (!member.first_name) rowErrors.push('Missing first name');
          if (!member.last_name) rowErrors.push('Missing last name');
          
          // Dates are optional - use defaults if missing
          if (!member.date_of_birth) {
            rowWarnings.push('Missing date of birth - using 1900-01-01');
            member.date_of_birth = '1900-01-01';
          }
          if (!member.original_join_date) {
            rowWarnings.push('Missing join date - using 1900-01-01');
            member.original_join_date = '1900-01-01';
          }
          
          // Tier validation
          if (!['Regular', 'Absentee', 'Life', 'Honorary', 'Waitlist'].includes(member.tier)) {
            rowWarnings.push(`Unknown tier "${member.tier}" - defaulting to Regular`);
            member.tier = 'Regular';
          }
          
          // Status validation
          if (!['Active', 'Deceased', 'Resigned', 'Expelled'].includes(member.status)) {
            rowWarnings.push(`Unknown status "${member.status}" - defaulting to Active`);
            member.status = 'Active';
          }
          
          // Add to results
          if (rowErrors.length > 0) {
            errors.push({ row: rowNum, errors: rowErrors, data: row });
          } else {
            members.push(member);
          }
          
          if (rowWarnings.length > 0) {
            warnings.push({ row: rowNum, warnings: rowWarnings });
          }
        });
        
        resolve({ members, errors, warnings });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// ============================================
// HELPER FUNCTION - Make sure this exists
// ============================================

function parseDate(dateValue) {
  if (!dateValue) return null;
  
  // If it's already a Date object (from XLSX cellDates: true)
  if (dateValue instanceof Date) {
    // Format as YYYY-MM-DD, using LOCAL date to avoid timezone issues
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  const str = String(dateValue).trim();
  
  // Try various date formats
  // MM/DD/YYYY or M/D/YYYY
  let match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // MM-DD-YYYY or M-D-YYYY
  match = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // YYYY-MM-DD (ISO format)
  match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try native Date parsing as fallback
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

// ============================================
// ALSO UPDATE generateImportTemplate()
// Make sure key_fob_number is in the template
// ============================================

export function generateImportTemplate() {
  const template = [{
    'member_number': '001',
    'first_name': 'John',
    'last_name': 'Smith',
    'date_of_birth': '03/15/1962',
    'original_join_date': '07/01/2015',
    'tier': 'Regular (or Absentee, Life, Honorary, Waitlist, Deceased Member)',
    'status': 'Active (or Deceased, Resigned, Expelled)',
    'key_fob_number': 'FOB-001',
    'email': 'john@example.com',
    'phone': '860-555-1234',
    'address_street': '123 Main St',
    'address_city': 'Groton',
    'address_state': 'CT',
    'address_zip': '06340',
    'assessment_years_completed': '2',
    'has_encumbrance': 'N',
    'encumbrance_date': '',
    'encumbrance_reason': '',
    'notes': 'Example member'
  }];
  
  const worksheet = XLSX.utils.json_to_sheet(template);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Import Template');
  XLSX.writeFile(workbook, 'member_import_template.xlsx');
}
