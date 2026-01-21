# Membership App Updates - January 2026

## Summary of Changes

This update includes bug fixes and new features discussed in previous conversations:

### 1. Fixed Negative Age Bug ✅

**Problem**: Some members showed negative ages (e.g., -24 years old)

**Root Cause**: Two issues:
- Timezone-related date parsing (dates like "1985-03-15" were being parsed as UTC midnight, which could shift to the previous day)
- Some birthdates were imported as 2049 instead of 1949 (Excel date formatting issue)

**Fix**:
- Updated `calculateAge()` function in `/src/utils/calculations.js` to:
  - Parse dates as local time, not UTC
  - Validate date parts before calculating age
  - Return `null` for invalid or future dates instead of negative numbers
- Added SQL to fix existing bad birthdates (subtracts 100 years from any future dates)

**Files Changed**:
- `src/utils/calculations.js` - Enhanced calculateAge() with better validation

### 2. Added Comprehensive Audit Trail ✅

**Problem**: Need to track who made what changes to member records and when

**Solution**: Implemented a full audit logging system

**Features**:
- Tracks ALL changes to member records (insert, update, delete)
- Records:
  - Which field changed
  - Old value → New value
  - Who made the change (email address)
  - Timestamp of change
  - Full record snapshots (JSON)
- Automatic logging via database trigger (no code changes needed)
- Searchable audit history in the member detail page
- Filterable by field, action, date range
- Export to CSV

**Files Created/Modified**:
- `supabase-migrations/002_waitlist_and_audit_fixes.sql` - Database schema for audit_log table and triggers
- `src/components/AuditHistory.jsx` - Already exists in your repo (displays audit history)

**Database Objects Created**:
- `audit_log` table - Stores all changes
- `log_member_changes()` function - Trigger function
- `member_audit_history` view - Easy querying
- `get_member_audit_history(UUID)` function - Get history for one member
- Automatic trigger on members table

### 3. Added Waitlist Support ✅

**Problem**: Need to manage a waitlist of prospective members separately from actual members

**Solution**: Created separate `waitlist` table for tracking prospective members with sponsor information

**Features**:
- Separate `waitlist` table (waitlist members are NOT in the members table)
- Tracks: contact_name, last_name, email, phone, address
- **Sponsor tracking**: sponsor_1, sponsor_2 fields
- **Application date**: date_application_received
- Waitlist position with auto-reorder when someone is promoted
- Dedicated Waitlist page for managing/importing waitlist
- Promote from Waitlist feature:
  - Select "Promote from Waitlist" when adding new member
  - Auto-loads first waitlist member (position #1)
  - Shows sponsor information in alert
  - Adds sponsors and application date to Notes field
  - Creates new member record in members table
  - Deletes from waitlist table (auto-reorders remaining members)
  - Leaves original_join_date empty (member needs to be sworn in)

**Important Notes**:
- Waitlist members have NO assessment (not members yet)
- Waitlist members have NO billing (not members yet)
- Waitlist members have NO member_number until promoted
- When promoted, sponsors and application date are saved to Notes field

**Files Changed**:
- `src/pages/MemberForm.jsx` - "Promote from Waitlist" option loads from waitlist table
- `src/pages/WaitlistReport.jsx` - Already exists, manages waitlist table
- `supabase-migrations/002_waitlist_and_audit_fixes.sql` - Creates waitlist table with auto-reorder trigger
- `docs/WAITLIST_IMPORT_GUIDE.md` - Import instructions with sponsor fields

**Database Changes**:
- Created `waitlist` table separate from `members` table
- Fields: waitlist_position, contact_name, last_name, email, phone, address, sponsor_1, sponsor_2, date_application_received
- Auto-reorder trigger when someone is deleted/promoted
- No changes to members table tier constraint

**Waitlist Table Includes**:
- Position (auto-maintained, #1 = next to promote)
- Contact name and last name
- Email, phone, address
- **Sponsor 1 and Sponsor 2 names**
- **Date application received**
- Status (pending/approved/contacted/declined)
- Notes

## Installation Instructions

### Step 1: Run Database Migration

In Supabase SQL Editor, run the migration file:

```sql
-- Copy and paste the entire contents of:
-- supabase-migrations/002_waitlist_and_audit_fixes.sql
```

This will:
1. Create waitlist table (separate from members) ✅
2. Add auto-reorder trigger for waitlist ✅
3. Update tier constraint (no Waitlist tier) ✅
4. Fix any existing bad birthdates ✅
5. Create audit_log table and triggers ✅
6. Set up RLS policies ✅
7. Create helper views and functions ✅

### Step 2: Deploy Updated Code

Upload the updated files to your GitHub repository:

**Changed Files**:
- `src/utils/calculations.js`
- `src/pages/MemberForm.jsx`
- `src/pages/Reports.jsx`

**New Files**:
- `supabase-migrations/002_waitlist_and_audit_fixes.sql`
- `docs/WAITLIST_IMPORT_GUIDE.md`

### Step 3: Test the Changes

1. **Test Age Calculation**:
   - View a member detail page
   - Age should display correctly (no negative numbers)
   - Check several members with different birthdates

2. **Test Audit Trail**:
   - Edit a member (change name, email, etc.)
   - Open member detail page
   - Scroll to "Change History" section
   - Verify changes are logged with timestamp and email

3. **Test Waitlist**:
   - Go to Waitlist page
   - Import waitlist CSV with sponsor_1, sponsor_2, date_application_received columns
   - Verify sponsors and application dates appear
   - Click "Add New Member"
   - Select "Promote from Waitlist" in tier dropdown
   - Alert should show first waitlist member with sponsors
   - Notes field should contain sponsor info
   - Save and verify:
     - New member created in members table
     - Member removed from waitlist table
     - Remaining waitlist members moved up one position

4. **Test Promotion**:
   - Click "Add New Member"
   - Select "Promote from Waitlist" in tier dropdown
   - First waitlist member should auto-load
   - Complete and save
   - Verify tier changed to Regular

## Breaking Changes

**None** - All changes are backward compatible:
- Existing members not affected
- New tier added (doesn't change existing tiers)
- Audit logging is additive (doesn't change existing data)
- Age calculation improvement (doesn't break anything)

## Future Enhancements

Potential additions for future updates:
- Automatic waitlist position re-sequencing after promotions
- Email notifications when members move up the waitlist
- Waitlist statistics dashboard
- Batch promote multiple waitlist members at once
- Waitlist export with custom date ranges

## Support

If you encounter any issues:
1. Check Supabase logs for database errors
2. Check browser console for JavaScript errors
3. Verify migration ran successfully
4. Ensure RLS policies are enabled

## Questions?

Common questions:

**Q: What if I already have members with bad birthdates?**
A: The migration includes a fix that automatically corrects future birthdates by subtracting 100 years.

**Q: Can I see audit history for deleted members?**
A: Yes! The audit_log table preserves full record snapshots even after deletion.

**Q: How do I import an existing waitlist?**
A: See `docs/WAITLIST_IMPORT_GUIDE.md` for detailed instructions.

**Q: What if two people have the same waitlist position?**
A: The system will display both, but you should manually fix to ensure unique sequential positions.

**Q: How do I re-number waitlist after promotions?**
A: Run the SQL query in the WAITLIST_IMPORT_GUIDE.md or manually edit positions in the app.
