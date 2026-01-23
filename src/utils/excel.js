import * as XLSX from 'xlsx';

// ============================================
// IMPORT FUNCTIONS
// ============================================

export async function parseImportedExcel(file) {
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
        
        jsonData.forEach((row, index) => {
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
            normalizedTier = 'Regular';
          }
          
          if (normalizedStatus === status) {
            if (statusLower.includes('active')) normalizedStatus = 'Active';
            else if (statusLower.includes('deceased')) normalizedStatus = 'Deceased';
            else if (statusLower.includes('resigned')) normalizedStatus = 'Resigned';
            else if (statusLower.includes('expelled')) normalizedStatus = 'Expelled';
            else normalizedStatus = 'Active';
          }
          
          members.push({
            member_number: memberNumber ? String(memberNumber).trim() : null,
            first_name: firstName ? String(firstName).trim() : null,
            last_name: lastName ? String(lastName).trim() : null,
            date_of_birth: dateOfBirth ? parseDate(dateOfBirth) : null,
            original_join_date: joinDate ? parseDate(joinDate) : null,
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
          });
        });
        
        resolve(members);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function validateImportedMembers(members) {
  const valid = [];
  const errors = [];
  const warnings = [];
  const memberNumbers = new Set();
  
  members.forEach((member, index) => {
    const rowNum = index + 2;
    const rowErrors = [];
    const rowWarnings = [];
    
    if (!member.member_number) {
      rowErrors.push('Missing member number');
    } else if (memberNumbers.has(member.member_number)) {
      rowErrors.push(`Duplicate member number: ${member.member_number}`);
    } else {
      memberNumbers.add(member.member_number);
    }
    
    if (!member.first_name) rowErrors.push('Missing first name');
    if (!member.last_name) rowErrors.push('Missing last name');
    
    if (!member.date_of_birth) {
      rowWarnings.push('Missing date of birth - using 1900-01-01');
      member.date_of_birth = '1900-01-01';
    }
    if (!member.original_join_date) {
      rowWarnings.push('Missing join date - using 1900-01-01');
      member.original_join_date = '1900-01-01';
    }
    
    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, member: `${member.last_name}, ${member.first_name}`, errors: rowErrors });
    } else {
      valid.push(member);
    }
    
    if (rowWarnings.length > 0) {
      warnings.push({ row: rowNum, member: `${member.last_name}, ${member.first_name}`, warnings: rowWarnings });
    }
  });
  
  return { valid, errors, warnings };
}

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

// ============================================
// EXPORT FUNCTIONS
// ============================================

export function exportMembersToExcel(members, filename = 'members.xlsx') {
  const data = members.map(m => ({
    'Member #': m.member_number,
    'Last Name': m.last_name,
    'First Name': m.first_name,
    'Tier': m.tier,
    'Status': m.status,
    'Key Fob Number': m.key_fob_number || '',
    'Email': m.email || '',
    'Phone': m.phone || '',
    'Address': m.address_street || '',
    'City': m.address_city || '',
    'State': m.address_state || '',
    'ZIP': m.address_zip || '',
    'Date of Birth': m.date_of_birth || '',
    'Join Date': m.original_join_date || '',
    'Assessment Years Completed': m.assessment_years_completed || 0,
    'Notes': m.notes || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Members');
  XLSX.writeFile(workbook, filename);
}

export function exportBillingReportToExcel(billingData, filename = 'billing_report.xlsx') {
  const data = billingData.map(b => ({
    'Member #': b.member_number,
    'Name': `${b.last_name}, ${b.first_name}`,
    'Tier': b.tier,
    'Dues': b.dues || 0,
    'Assessment': b.assessment || 0,
    'Work Hours Short': b.workHoursShort || 0,
    'Buyout': b.buyout || 0,
    'Subtotal': b.subtotal || 0,
    'Tax': b.tax || 0,
    'Total': b.total || 0,
    'Status': b.payment_status || 'Unpaid'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Billing');
  XLSX.writeFile(workbook, filename);
}

export function exportWorkHoursToExcel(workHoursData, filename = 'work_hours.xlsx') {
  const data = workHoursData.map(w => ({
    'Member #': w.member_number,
    'Name': `${w.last_name}, ${w.first_name}`,
    'Hours Required': w.hours_required || 10,
    'Hours Completed': w.hours_completed || 0,
    'Hours Short': w.hours_short || 0,
    'Buyout Amount': w.buyout_amount || 0
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Work Hours');
  XLSX.writeFile(workbook, filename);
}

export function exportWaitlistToExcel(waitlist, filename = 'waitlist.xlsx') {
  const data = waitlist.map(w => ({
    'Position': w.waitlist_position,
    'Name': w.contact_name || `${w.last_name}, ${w.first_name}`,
    'Email': w.email || '',
    'Phone': w.phone || '',
    'Address': w.street_address || '',
    'City': w.city || '',
    'State': w.state_province || '',
    'ZIP': w.postal_code || '',
    'Sponsor 1': w.sponsor_1 || '',
    'Sponsor 2': w.sponsor_2 || '',
    'Date Applied': w.date_application_received || '',
    'Status': w.status || 'pending'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Waitlist');
  XLSX.writeFile(workbook, filename);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseDate(dateValue) {
  if (!dateValue) return null;
  
  if (dateValue instanceof Date) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  const str = String(dateValue).trim();
  
  let match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  match = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
