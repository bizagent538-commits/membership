import * as XLSX from 'xlsx';
import { formatCurrency, formatDate } from './calculations';

// Export members to Excel
export function exportMembersToExcel(members, filename = 'members.xlsx') {
  const data = members.map(m => ({
    'Member #': m.member_number,
    'Last Name': m.last_name,
    'First Name': m.first_name,
    'Tier': m.tier,
    'Status': m.status,
    'Email': m.email || '',
    'Phone': m.phone || '',
    'Address': m.address_street || '',
    'City': m.address_city || '',
    'State': m.address_state || '',
    'ZIP': m.address_zip || '',
    'Date of Birth': m.date_of_birth ? formatDate(m.date_of_birth) : '',
    'Join Date': m.original_join_date ? formatDate(m.original_join_date) : '',
    'Assessment Years Completed': m.assessment_years_completed || 0,
    'Notes': m.notes || ''
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  
  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
  ws['!cols'] = colWidths;
  
  XLSX.writeFile(wb, filename);
}

// Export billing report to Excel
export function exportBillingReportToExcel(billingData, fiscalYear, filename = 'billing-report.xlsx') {
  const data = billingData.map(b => ({
    'Member #': b.member_number,
    'Member Name': `${b.last_name}, ${b.first_name}`,
    'Tier': b.tier,
    'Dues': formatCurrency(b.dues),
    'Assessment': formatCurrency(b.assessment),
    'Hours Required': b.work_hours_required,
    'Hours Completed': b.work_hours_completed,
    'Hours Short': b.work_hours_short,
    'Buyout': formatCurrency(b.buyout),
    'Subtotal': formatCurrency(b.subtotal),
    'Tax (10%)': formatCurrency(b.tax),
    'Total Due': formatCurrency(b.total),
    'Status': b.payment_status
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Billing ${fiscalYear}`);
  
  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 12) }));
  ws['!cols'] = colWidths;
  
  XLSX.writeFile(wb, filename);
}

// Parse imported Excel file
export function parseImportedExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false });
        
        // Map to our expected format
        const members = jsonData.map((row, index) => {
          // Try to find columns by various possible names
          const memberNumber = row['member_number'] || row['Member #'] || row['Member Number'] || row['MemberNumber'] || '';
          const firstName = row['first_name'] || row['First Name'] || row['FirstName'] || '';
          const lastName = row['last_name'] || row['Last Name'] || row['LastName'] || '';
          const dob = row['date_of_birth'] || row['Date of Birth'] || row['DOB'] || row['DateOfBirth'] || '';
          const joinDate = row['original_join_date'] || row['Join Date'] || row['JoinDate'] || row['Original Join Date'] || '';
          const tier = row['tier'] || row['Tier'] || row['Membership Type'] || 'Regular';
          const status = row['status'] || row['Status'] || 'Active';
          const email = row['email'] || row['Email'] || '';
          const phone = row['phone'] || row['Phone'] || '';
          const street = row['address_street'] || row['Address'] || row['Street'] || '';
          const city = row['address_city'] || row['City'] || '';
          const state = row['address_state'] || row['State'] || '';
          const zip = row['address_zip'] || row['ZIP'] || row['Zip'] || '';
          const assessmentYears = row['assessment_years_completed'] || row['Assessment Years Completed'] || row['AssessmentYears'] || 0;
          const hasEncumbrance = row['has_encumbrance'] || row['Has Encumbrance'] || row['Encumbrance'] || '';
          const encumbranceDate = row['encumbrance_date'] || row['Encumbrance Date'] || '';
          const encumbranceReason = row['encumbrance_reason'] || row['Encumbrance Reason'] || '';
          const notes = row['notes'] || row['Notes'] || '';
          
          // Parse dates
          let parsedDob = '';
          let parsedJoinDate = '';
          
          try {
            if (dob) {
              const d = new Date(dob);
              if (!isNaN(d.getTime())) {
                parsedDob = d.toISOString().split('T')[0];
              }
            }
          } catch (e) {
            console.warn(`Invalid DOB at row ${index + 1}:`, dob);
          }
          
          try {
            if (joinDate) {
              const d = new Date(joinDate);
              if (!isNaN(d.getTime())) {
                parsedJoinDate = d.toISOString().split('T')[0];
              }
            }
          } catch (e) {
            console.warn(`Invalid join date at row ${index + 1}:`, joinDate);
          }
          
          // Normalize tier
          let normalizedTier = tier;
          const tierLower = (tier || '').toLowerCase();
          if (tierLower.includes('regular')) normalizedTier = 'Regular';
          else if (tierLower.includes('absentee')) normalizedTier = 'Absentee';
          else if (tierLower.includes('life')) normalizedTier = 'Life';
          else if (tierLower.includes('honorary')) normalizedTier = 'Honorary';
          
          // Normalize status
          let normalizedStatus = status;
          const statusLower = (status || '').toLowerCase();
          if (statusLower.includes('active')) normalizedStatus = 'Active';
          else if (statusLower.includes('deceased')) normalizedStatus = 'Deceased';
          else if (statusLower.includes('resigned')) normalizedStatus = 'Resigned';
          else if (statusLower.includes('expelled')) normalizedStatus = 'Expelled';
          
          return {
            row: index + 2, // Excel row number (1-indexed + header)
            member_number: String(memberNumber).trim(),
            first_name: String(firstName).trim(),
            last_name: String(lastName).trim(),
            date_of_birth: parsedDob,
            original_join_date: parsedJoinDate,
            tier: normalizedTier,
            status: normalizedStatus,
            email: String(email).trim(),
            phone: String(phone).trim(),
            address_street: String(street).trim(),
            address_city: String(city).trim(),
            address_state: String(state).trim(),
            address_zip: String(zip).trim(),
            assessment_years_completed: parseInt(assessmentYears) || 0,
            has_encumbrance: String(hasEncumbrance).toLowerCase() === 'y' || String(hasEncumbrance).toLowerCase() === 'yes',
            encumbrance_date: encumbranceDate,
            encumbrance_reason: String(encumbranceReason).trim(),
            notes: String(notes).trim()
          };
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

// Validate imported data
export function validateImportedMembers(members) {
  const errors = [];
  const warnings = [];
  const valid = [];
  const memberNumbers = new Set();
  
  members.forEach((member, index) => {
    const rowErrors = [];
    const rowWarnings = [];
    
    // Required fields
    if (!member.member_number) {
      rowErrors.push('Missing member number');
    } else if (memberNumbers.has(member.member_number)) {
      rowErrors.push(`Duplicate member number: ${member.member_number}`);
    } else {
      memberNumbers.add(member.member_number);
    }
    
    if (!member.first_name) rowErrors.push('Missing first name');
    if (!member.last_name) rowErrors.push('Missing last name');
    if (!member.date_of_birth) rowErrors.push('Missing or invalid date of birth');
    if (!member.original_join_date) rowErrors.push('Missing or invalid join date');
    
    // Validate tier
    if (!['Regular', 'Absentee', 'Life', 'Honorary'].includes(member.tier)) {
      rowErrors.push(`Invalid tier: ${member.tier}`);
    }
    
    // Validate status
    if (!['Active', 'Deceased', 'Resigned', 'Expelled'].includes(member.status)) {
      rowErrors.push(`Invalid status: ${member.status}`);
    }
    
    // Validate assessment years
    if (member.assessment_years_completed < 0 || member.assessment_years_completed > 5) {
      rowWarnings.push('Assessment years should be 0-5, defaulting to 0');
      member.assessment_years_completed = 0;
    }
    
    // Warnings for optional but recommended fields
    if (!member.email && !member.phone) {
      rowWarnings.push('No contact information provided');
    }
    
    if (rowErrors.length > 0) {
      errors.push({ row: member.row, member: member.member_number || `Row ${member.row}`, errors: rowErrors });
    } else {
      if (rowWarnings.length > 0) {
        warnings.push({ row: member.row, member: member.member_number, warnings: rowWarnings });
      }
      valid.push(member);
    }
  });
  
  return { valid, errors, warnings };
}

// Generate import template
export function generateImportTemplate() {
  const template = [{
    'member_number': '001',
    'first_name': 'John',
    'last_name': 'Smith',
    'date_of_birth': '03/15/1962',
    'original_join_date': '07/01/2015',
    'tier': 'Regular',
    'status': 'Active',
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
  
  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Import Template');
  
  // Column widths
  ws['!cols'] = [
    { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
    { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 15 },
    { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 10 },
    { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 30 }
  ];
  
  XLSX.writeFile(wb, 'membership-import-template.xlsx');
}
