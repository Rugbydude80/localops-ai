# Excel Import/Export Guide

Your LocalOps AI system now supports Excel import and export functionality for staff and shifts management.

## Features Added

### 1. Staff Import from Excel
- Import staff members from Excel files (.xlsx, .xls)
- Required columns: Name, Email
- Optional columns: Phone, Position, Hourly Rate, Department
- Download template available in the interface

### 2. Shifts Import from Excel
- Import shifts from Excel files
- Required columns: Staff Name, Staff Email, Date, Start Time, End Time, Position
- Optional columns: Notes
- Staff must exist in the system before importing shifts
- Download template available in the interface

### 3. Work Report Export to Excel
- Export completed shifts from the last 30 days
- Includes staff name, dates, hours worked, pay calculations
- Automatically calculates total hours and pay based on hourly rates

## How to Use

### Accessing the Feature
The Excel import/export functionality is available in two places:
1. **Dashboard** - In the Staff management section
2. **Shifts Page** - At the bottom of the page

### Staff Import Process
1. Click "Download Template" next to "Import Staff" to get the correct format
2. Fill in your staff data in the Excel template:
   - **Name** (required): Full name of staff member
   - **Email** (required): Email address (must be unique)
   - **Phone** (optional): Phone number
   - **Position** (optional): Job title/position
   - **Hourly Rate** (optional): Hourly wage rate
   - **Department** (optional): Department or team
3. Save your Excel file
4. Click "Choose File" and select your Excel file
5. The system will validate and import your staff

### Shifts Import Process
1. Ensure all staff members are already in the system
2. Click "Download Template" next to "Import Shifts" to get the correct format
3. Fill in your shift data:
   - **Staff Name**: Must match existing staff name
   - **Staff Email**: Must match existing staff email
   - **Date**: Format as YYYY-MM-DD (e.g., 2024-01-15)
   - **Start Time**: Format as HH:MM (e.g., 09:00)
   - **End Time**: Format as HH:MM (e.g., 17:00)
   - **Position**: Job position for this shift
   - **Notes** (optional): Any additional notes
4. Save your Excel file
5. Click "Choose File" and select your Excel file
6. The system will match staff emails and import shifts

### Work Report Export
1. Click "Export to Excel" in the Work Report section
2. The system will generate an Excel file with:
   - All completed shifts from the last 30 days
   - Staff names and shift details
   - Calculated hours worked
   - Pay calculations (if hourly rates are set)
3. The file will be automatically downloaded

## Excel Template Formats

### Staff Import Template
```
Name          | Email              | Phone      | Position | Hourly Rate | Department
John Doe      | john@example.com   | 555-0123   | Server   | 15.00       | Front of House
Jane Smith    | jane@example.com   | 555-0124   | Cook     | 18.00       | Kitchen
```

### Shifts Import Template
```
Staff Name | Staff Email        | Date       | Start Time | End Time | Position | Notes
John Doe   | john@example.com   | 2024-01-15 | 09:00      | 17:00    | Server   | Regular shift
Jane Smith | jane@example.com   | 2024-01-15 | 10:00      | 18:00    | Cook     | Busy day
```

## Tips and Best Practices

1. **Always download templates first** to ensure correct formatting
2. **Keep backups** of your Excel files before importing
3. **Test with small batches** first to ensure data imports correctly
4. **Verify staff emails** match exactly when importing shifts
5. **Use consistent date/time formats** as shown in templates
6. **Check for duplicates** before importing to avoid conflicts

## Troubleshooting

### Common Import Issues
- **"No valid staff records found"**: Check that Name and Email columns are filled
- **"Staff not found for email"**: Ensure staff email matches existing staff exactly
- **"Import failed"**: Check file format and required columns

### File Format Issues
- Only .xlsx and .xls files are supported
- Ensure the first row contains column headers
- Don't leave empty rows between data

### Data Validation
- Email addresses must be unique for staff
- Dates must be in YYYY-MM-DD format
- Times must be in HH:MM format (24-hour)
- Hourly rates should be numbers (no currency symbols)

## Security Notes
- Imported data is validated before being saved to the database
- Only authorized users can access import/export functionality
- All imports are logged for audit purposes