import React, { useState } from 'react';
import Papa from 'papaparse';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WaitlistEntry {
  lastName: string;
  contactName: string;
  email: string;
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  sponsor1: string;
  sponsor2: string;
  dateApplicationReceived: string;
  phone: string;
}

interface WaitlistImportProps {
  onImportComplete?: () => void;
}

export default function WaitlistImport({ onImportComplete }: WaitlistImportProps) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const EXPECTED_HEADERS = [
    'Last Name',
    'Contact Name',
    'Email',
    'Street Address',
    'City',
    'State/Province',
    'Postal Code',
    'Sponsor #1',
    'Sponsor #2',
    'Date Application Received',
    'Phone'
  ];

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setSuccess(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Validate headers
          const headers = results.meta.fields || [];
          const missingHeaders = EXPECTED_HEADERS.filter(h => !headers.includes(h));
          
          if (missingHeaders.length > 0) {
            setError(`Missing required columns: ${missingHeaders.join(', ')}`);
            setImporting(false);
            return;
          }

          // Map CSV data to WaitlistEntry objects
          const entries: WaitlistEntry[] = results.data.map((row: any) => ({
            lastName: row['Last Name']?.trim() || '',
            contactName: row['Contact Name']?.trim() || '',
            email: row['Email']?.trim() || '',
            streetAddress: row['Street Address']?.trim() || '',
            city: row['City']?.trim() || '',
            stateProvince: row['State/Province']?.trim() || '',
            postalCode: row['Postal Code']?.trim() || '',
            sponsor1: row['Sponsor #1']?.trim() || '',
            sponsor2: row['Sponsor #2']?.trim() || '',
            dateApplicationReceived: row['Date Application Received']?.trim() || '',
            phone: row['Phone']?.trim() || ''
          }));

          // Filter out completely empty rows
          const validEntries = entries.filter(entry => 
            entry.lastName || entry.contactName || entry.email
          );

          if (validEntries.length === 0) {
            setError('No valid entries found in the file');
            setImporting(false);
            return;
          }

          // Get the current max waitlist position
          const { data: maxPosition } = await supabase
            .from('waitlist')
            .select('waitlist_position')
            .order('waitlist_position', { ascending: false })
            .limit(1)
            .single();

          const startPosition = (maxPosition?.waitlist_position || 0) + 1;

          // Prepare entries for database with sequential positions
          const dbEntries = validEntries.map((entry, index) => ({
            last_name: entry.lastName,
            contact_name: entry.contactName,
            email: entry.email || null,
            street_address: entry.streetAddress || null,
            city: entry.city || null,
            state_province: entry.stateProvince || null,
            postal_code: entry.postalCode || null,
            sponsor_1: entry.sponsor1 || null,
            sponsor_2: entry.sponsor2 || null,
            date_application_received: entry.dateApplicationReceived || null,
            phone: entry.phone || null,
            waitlist_position: startPosition + index,
            status: 'pending'
          }));

          // Insert into Supabase
          const { error: insertError } = await supabase
            .from('waitlist')
            .insert(dbEntries);

          if (insertError) {
            throw new Error(`Database error: ${insertError.message}`);
          }

          setSuccess(`Successfully imported ${validEntries.length} waitlist entries`);
          setImporting(false);
          
          // Reset file input
          event.target.value = '';
          
          // Notify parent component to refresh
          if (onImportComplete) {
            onImportComplete();
          }
        } catch (err: any) {
          setError(err?.message || 'Failed to import waitlist');
          setImporting(false);
        }
      },
      error: (err) => {
        setError(`Failed to parse CSV file: ${err.message}`);
        setImporting(false);
      }
    });
  };

  const downloadTemplate = () => {
    const template = EXPECTED_HEADERS.join(',') + '\n';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'waitlist_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Import Waitlist</h3>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Upload a CSV file with the following columns:
          </p>
          <div className="bg-gray-50 p-3 rounded text-xs font-mono overflow-x-auto">
            {EXPECTED_HEADERS.join(' | ')}
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={downloadTemplate}
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            Download CSV Template
          </button>

          <div className="flex items-center gap-3">
            <label className="flex-1">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={importing}
                className="hidden"
                id="waitlist-upload"
              />
              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                <Upload className="w-4 h-4" />
                <span>{importing ? 'Importing...' : 'Upload CSV File'}</span>
              </div>
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {success && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">{success}</div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Import Instructions</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>CSV file must include all 11 columns in the exact order shown</li>
          <li>Column headers must match exactly (case-sensitive)</li>
          <li>At minimum, Last Name, Contact Name, or Email should be provided</li>
          <li>Date Application Received should be in a standard date format (MM/DD/YYYY recommended)</li>
          <li>Empty rows will be skipped automatically</li>
        </ul>
      </div>
    </div>
  );
}
