import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Upload, FileSpreadsheet, AlertTriangle, Check, X, Download } from 'lucide-react';
import { parseImportedExcel, validateImportedMembers, generateImportTemplate } from '../utils/excel';

export default function Import() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setParseResult(null);
    setImportResult(null);
    setParsing(true);
    
    try {
      const members = await parseImportedExcel(selectedFile);
      const validation = validateImportedMembers(members);
      setParseResult(validation);
    } catch (err) {
      setParseResult({ error: err.message, valid: [], errors: [], warnings: [] });
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.valid.length === 0) return;
    
    setImporting(true);
    const results = { success: 0, failed: 0, errors: [] };
    
    try {
      for (const member of parseResult.valid) {
        try {
          // Insert member
          const { data, error } = await supabase
            .from('members')
            .insert([{
              member_number: member.member_number,
              first_name: member.first_name,
              last_name: member.last_name,
              date_of_birth: member.date_of_birth,
              original_join_date: member.original_join_date,
              tier: member.tier,
              status: member.status,
              email: member.email || null,
              phone: member.phone || null,
              address_street: member.address_street || null,
              address_city: member.address_city || null,
              address_state: member.address_state || null,
              address_zip: member.address_zip || null,
              assessment_years_completed: member.assessment_years_completed,
              notes: member.notes || null
            }])
            .select()
            .single();
          
          if (error) throw error;
          
          // Add encumbrance if specified
          if (member.has_encumbrance && member.encumbrance_reason) {
            await supabase.from('encumbrances').insert([{
              member_id: data.id,
              date_applied: member.encumbrance_date || member.original_join_date,
              reason: member.encumbrance_reason
            }]);
          }
          
          // Log initial tier
          await supabase.from('tier_history').insert([{
            member_id: data.id,
            old_tier: null,
            new_tier: member.tier,
            effective_date: member.original_join_date,
            reason: 'Imported from CivicCRM'
          }]);
          
          // Log initial status
          await supabase.from('status_history').insert([{
            member_id: data.id,
            old_status: null,
            new_status: member.status,
            change_date: member.original_join_date,
            reason: 'Imported from CivicCRM'
          }]);
          
          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push({ member: member.member_number, error: err.message });
        }
      }
      
      setImportResult(results);
    } catch (err) {
      setImportResult({ success: 0, failed: parseResult.valid.length, errors: [{ member: 'All', error: err.message }] });
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    generateImportTemplate();
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Import Members</h1>
        <p style={{ color: '#6b7280' }}>Import member data from Excel (CivicCRM export)</p>
      </div>

      {/* Instructions */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2>Instructions</h2>
          <button onClick={handleDownloadTemplate} className="btn btn-sm btn-secondary">
            <Download size={16} /> Download Template
          </button>
        </div>
        <div className="card-body">
          <p style={{ marginBottom: '12px' }}>Upload an Excel file (.xlsx) with member data. Required columns:</p>
          <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
            <li><strong>member_number</strong> - Unique identifier</li>
            <li><strong>first_name</strong>, <strong>last_name</strong> - Member name</li>
            <li><strong>date_of_birth</strong> - Date format (MM/DD/YYYY)</li>
            <li><strong>original_join_date</strong> - Date format (MM/DD/YYYY)</li>
            <li><strong>tier</strong> - Regular, Absentee, Life, Honorary, or Waitlist</li>
            <li><strong>status</strong> - Active, Deceased, Resigned, or Expelled</li>
          </ul>
          <p style={{ color: '#6b7280' }}>
            Optional columns: email, phone, address_street, address_city, address_state, address_zip, 
            assessment_years_completed, has_encumbrance, encumbrance_date, encumbrance_reason, notes
          </p>
        </div>
      </div>

      {/* File Upload */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2>Upload File</h2>
        </div>
        <div className="card-body">
          <div 
            style={{ 
              border: '2px dashed #d1d5db', 
              borderRadius: '8px', 
              padding: '40px', 
              textAlign: 'center',
              background: '#f9fafb'
            }}
          >
            <Upload size={48} color="#9ca3af" style={{ marginBottom: '16px' }} />
            <p style={{ marginBottom: '16px' }}>
              {file ? file.name : 'Drag and drop an Excel file, or click to browse'}
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload" className="btn btn-primary">
              <FileSpreadsheet size={16} /> Select File
            </label>
          </div>
        </div>
      </div>

      {/* Parsing indicator */}
      {parsing && (
        <div className="loading">
          <div className="spinner"></div>
          <span style={{ marginLeft: '12px' }}>Parsing file...</span>
        </div>
      )}

      {/* Parse Results */}
      {parseResult && !parsing && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h2>Validation Results</h2>
          </div>
          <div className="card-body">
            {parseResult.error ? (
              <div className="alert alert-danger">
                <AlertTriangle size={20} />
                <span>Error parsing file: {parseResult.error}</span>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={20} color="#16a34a" />
                    <span><strong>{parseResult.valid.length}</strong> valid records</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <X size={20} color="#dc2626" />
                    <span><strong>{parseResult.errors.length}</strong> errors</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={20} color="#ca8a04" />
                    <span><strong>{parseResult.warnings.length}</strong> warnings</span>
                  </div>
                </div>

                {/* Errors */}
                {parseResult.errors.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#dc2626' }}>
                      Errors (will not be imported)
                    </h3>
                    <div style={{ maxHeight: '200px', overflow: 'auto', background: '#fee2e2', padding: '12px', borderRadius: '8px' }}>
                      {parseResult.errors.map((err, i) => (
                        <div key={i} style={{ marginBottom: '8px' }}>
                          <strong>Row {err.row} ({err.member}):</strong> {err.errors.join(', ')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {parseResult.warnings.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#ca8a04' }}>
                      Warnings (will be imported with adjustments)
                    </h3>
                    <div style={{ maxHeight: '200px', overflow: 'auto', background: '#fef9c3', padding: '12px', borderRadius: '8px' }}>
                      {parseResult.warnings.map((warn, i) => (
                        <div key={i} style={{ marginBottom: '8px' }}>
                          <strong>Row {warn.row} ({warn.member}):</strong> {warn.warnings.join(', ')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Valid Records Preview */}
                {parseResult.valid.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                      Preview (first 10 of {parseResult.valid.length} valid records)
                    </h3>
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>DOB</th>
                            <th>Join Date</th>
                            <th>Tier</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parseResult.valid.slice(0, 10).map((m, i) => (
                            <tr key={i}>
                              <td>{m.member_number}</td>
                              <td>{m.last_name}, {m.first_name}</td>
                              <td>{m.date_of_birth}</td>
                              <td>{m.original_join_date}</td>
                              <td>{m.tier}</td>
                              <td>{m.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Import Button */}
                {parseResult.valid.length > 0 && !importResult && (
                  <div style={{ marginTop: '24px' }}>
                    <button 
                      onClick={handleImport} 
                      className="btn btn-primary btn-lg"
                      disabled={importing}
                    >
                      {importing ? 'Importing...' : `Import ${parseResult.valid.length} Members`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Import Results */}
      {importResult && (
        <div className="card">
          <div className="card-header">
            <h2>Import Complete</h2>
          </div>
          <div className="card-body">
            <div className={`alert ${importResult.failed === 0 ? 'alert-success' : 'alert-warning'}`}>
              <Check size={20} />
              <div>
                <strong>{importResult.success} members imported successfully</strong>
                {importResult.failed > 0 && (
                  <p style={{ margin: 0 }}>{importResult.failed} failed to import</p>
                )}
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#dc2626' }}>
                  Import Errors
                </h3>
                <div style={{ background: '#fee2e2', padding: '12px', borderRadius: '8px' }}>
                  {importResult.errors.map((err, i) => (
                    <div key={i} style={{ marginBottom: '4px' }}>
                      <strong>{err.member}:</strong> {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <button onClick={() => navigate('/members')} className="btn btn-primary">
                View Members
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
