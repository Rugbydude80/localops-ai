import React, { useState } from 'react';
import { 
  DocumentArrowUpIcon, 
  DocumentArrowDownIcon, 
  UserGroupIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { 
  importStaffFromExcel, 
  importShiftsFromExcel, 
  exportWorkReportToExcel,
  exportStaffTemplate,
  exportShiftsTemplate,
  StaffImportData,
  ShiftImportData,
  WorkReportData
} from '../lib/excelUtils';
import { format, parseISO } from 'date-fns';

interface ExcelImportExportProps {
  onDataImported?: () => void;
}

export default function ExcelImportExport({ onDataImported }: ExcelImportExportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleStaffImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const staffData = await importStaffFromExcel(file);
      
      // Validate required fields
      const validStaff = staffData.filter(staff => staff.name && staff.email);
      if (validStaff.length === 0) {
        throw new Error('No valid staff records found. Name and Email are required.');
      }

      // Import to database
      const { data, error } = await supabase
        .from('staff')
        .insert(validStaff.map(staff => ({
          name: staff.name,
          email: staff.email,
          phone: staff.phone || null,
          position: staff.position || 'Staff',
          hourly_rate: staff.hourly_rate || null,
          department: staff.department || null,
          is_active: true
        })));

      if (error) throw error;

      toast.success(`Successfully imported ${validStaff.length} staff members`);
      onDataImported?.();
    } catch (error) {
      console.error('Staff import error:', error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
      event.target.value = ''; // Reset file input
    }
  };

  const handleShiftsImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const shiftsData = await importShiftsFromExcel(file);
      
      // Get staff data to match emails to IDs
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, email, name');
      
      if (staffError) throw staffError;

      const staffMap = new Map(staffData.map(staff => [staff.email.toLowerCase(), staff]));
      
      // Process shifts and match with staff
      const validShifts = [];
      for (const shift of shiftsData) {
        const staff = staffMap.get(shift.staff_email.toLowerCase());
        if (!staff) {
          console.warn(`Staff not found for email: ${shift.staff_email}`);
          continue;
        }

        validShifts.push({
          staff_id: staff.id,
          date: shift.date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          position: shift.position,
          notes: shift.notes || null,
          status: 'scheduled'
        });
      }

      if (validShifts.length === 0) {
        throw new Error('No valid shifts found. Make sure staff emails match existing staff.');
      }

      // Import shifts to database
      const { error } = await supabase
        .from('shifts')
        .insert(validShifts);

      if (error) throw error;

      toast.success(`Successfully imported ${validShifts.length} shifts`);
      onDataImported?.();
    } catch (error) {
      console.error('Shifts import error:', error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
      event.target.value = ''; // Reset file input
    }
  };

  const handleWorkReportExport = async () => {
    setIsExporting(true);
    try {
      // Get shifts with staff data for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: shifts, error } = await supabase
        .from('shifts')
        .select(`
          *,
          staff:staff_id (
            name,
            hourly_rate
          )
        `)
        .gte('date', format(thirtyDaysAgo, 'yyyy-MM-dd'))
        .eq('status', 'completed');

      if (error) throw error;

      const workReportData: WorkReportData[] = shifts.map(shift => {
        const startTime = new Date(`${shift.date}T${shift.start_time}`);
        const endTime = new Date(`${shift.date}T${shift.end_time}`);
        const hoursWorked = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        const hourlyRate = shift.staff?.hourly_rate || 0;
        
        return {
          staff_name: shift.staff?.name || 'Unknown',
          date: shift.date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          hours_worked: Math.round(hoursWorked * 100) / 100,
          position: shift.position,
          hourly_rate: hourlyRate,
          total_pay: Math.round(hoursWorked * hourlyRate * 100) / 100,
          status: shift.status
        };
      });

      exportWorkReportToExcel(workReportData);
      toast.success('Work report exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-6">Excel Import/Export</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Import Section */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-700 flex items-center">
            <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
            Import Data
          </h4>
          
          {/* Staff Import */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 flex items-center">
                <UserGroupIcon className="h-4 w-4 mr-1" />
                Import Staff
              </span>
              <button
                onClick={exportStaffTemplate}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Download Template
              </button>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleStaffImport}
              disabled={isImporting}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Shifts Import */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 flex items-center">
                <CalendarDaysIcon className="h-4 w-4 mr-1" />
                Import Shifts
              </span>
              <button
                onClick={exportShiftsTemplate}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Download Template
              </button>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleShiftsImport}
              disabled={isImporting}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>

        {/* Export Section */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-700 flex items-center">
            <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
            Export Data
          </h4>
          
          {/* Work Report Export */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 flex items-center">
                <ClipboardDocumentListIcon className="h-4 w-4 mr-1" />
                Work Report (Last 30 Days)
              </span>
            </div>
            <button
              onClick={handleWorkReportExport}
              disabled={isExporting}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isExporting ? 'Exporting...' : 'Export to Excel'}
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h5 className="text-sm font-medium text-gray-700 mb-2">Instructions:</h5>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Download templates to see the required format for imports</li>
          <li>• Staff import requires Name and Email columns</li>
          <li>• Shifts import requires existing staff emails to match shifts</li>
          <li>• Work reports include completed shifts with calculated hours and pay</li>
        </ul>
      </div>
    </div>
  );
}