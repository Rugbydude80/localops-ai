import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface StaffImportData {
  name: string;
  email: string;
  phone?: string;
  position?: string;
  hourly_rate?: number;
  department?: string;
}

export interface ShiftImportData {
  staff_name: string;
  staff_email: string;
  date: string;
  start_time: string;
  end_time: string;
  position: string;
  notes?: string;
}

export interface WorkReportData {
  staff_name: string;
  date: string;
  start_time: string;
  end_time: string;
  hours_worked: number;
  position: string;
  hourly_rate?: number;
  total_pay?: number;
  status: string;
}

// Import staff from Excel
export const importStaffFromExcel = (file: File): Promise<StaffImportData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const staffData: StaffImportData[] = jsonData.map((row: any) => ({
          name: row.Name || row.name || '',
          email: row.Email || row.email || '',
          phone: row.Phone || row.phone || '',
          position: row.Position || row.position || '',
          hourly_rate: parseFloat(row['Hourly Rate'] || row.hourly_rate || '0') || undefined,
          department: row.Department || row.department || ''
        }));
        
        resolve(staffData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

// Import shifts from Excel
export const importShiftsFromExcel = (file: File): Promise<ShiftImportData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const shiftData: ShiftImportData[] = jsonData.map((row: any) => ({
          staff_name: row['Staff Name'] || row.staff_name || '',
          staff_email: row['Staff Email'] || row.staff_email || '',
          date: row.Date || row.date || '',
          start_time: row['Start Time'] || row.start_time || '',
          end_time: row['End Time'] || row.end_time || '',
          position: row.Position || row.position || '',
          notes: row.Notes || row.notes || ''
        }));
        
        resolve(shiftData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

// Export work report to Excel
export const exportWorkReportToExcel = (data: WorkReportData[], filename?: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data.map(row => ({
    'Staff Name': row.staff_name,
    'Date': row.date,
    'Start Time': row.start_time,
    'End Time': row.end_time,
    'Hours Worked': row.hours_worked,
    'Position': row.position,
    'Hourly Rate': row.hourly_rate || '',
    'Total Pay': row.total_pay || '',
    'Status': row.status
  })));
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Work Report');
  
  const fileName = filename || `work-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

// Export staff template
export const exportStaffTemplate = () => {
  const templateData = [
    {
      'Name': 'John Doe',
      'Email': 'john@example.com',
      'Phone': '555-0123',
      'Position': 'Server',
      'Hourly Rate': 15.00,
      'Department': 'Front of House'
    }
  ];
  
  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Staff Template');
  
  XLSX.writeFile(workbook, 'staff-import-template.xlsx');
};

// Export shifts template
export const exportShiftsTemplate = () => {
  const templateData = [
    {
      'Staff Name': 'John Doe',
      'Staff Email': 'john@example.com',
      'Date': '2024-01-15',
      'Start Time': '09:00',
      'End Time': '17:00',
      'Position': 'Server',
      'Notes': 'Regular shift'
    }
  ];
  
  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Shifts Template');
  
  XLSX.writeFile(workbook, 'shifts-import-template.xlsx');
};