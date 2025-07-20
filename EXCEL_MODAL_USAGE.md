# Excel Import/Export Modal Usage Guide

## How to Open and Close the Excel Import/Export Modal

### Opening the Modal

There are **three ways** to open the Excel Import/Export modal:

1. **Click the Excel Icon Button**
   - Look for the document upload icon (📄) in the header of the Enhanced Shift Management page
   - Click the button to open the modal
   - The button has a tooltip showing "Excel Import/Export (Ctrl+E)"

2. **Keyboard Shortcut: Ctrl+E (or Cmd+E on Mac)**
   - Press `Ctrl + E` (Windows/Linux) or `Cmd + E` (Mac) anywhere on the page
   - The modal will open instantly

3. **Programmatically**
   - Set the `showExcelModal` state to `true` in the component
   - Example: `setShowExcelModal(true)`

### Closing the Modal

There are **three ways** to close the Excel Import/Export modal:

1. **Click the X Button**
   - Click the "X" button in the top-right corner of the modal
   - This is the most common way to close the modal

2. **Press Escape Key**
   - Press the `Escape` key on your keyboard
   - The modal will close immediately

3. **Programmatically**
   - Set the `showExcelModal` state to `false` in the component
   - Example: `setShowExcelModal(false)`

## Modal Features

The Excel Import/Export modal includes:

### Import Section
- **Staff Import**: Upload Excel files with staff data
- **Shifts Import**: Upload Excel files with shift data
- **Template Downloads**: Get the correct Excel format for imports

### Export Section
- **Work Report Export**: Download completed shifts from the last 30 days
- **Calculated Data**: Hours worked and pay calculations included

### Instructions
- Clear guidance on how to use each feature
- Format requirements for imports
- Data validation information

## Technical Implementation

### State Management
```typescript
const [showExcelModal, setShowExcelModal] = useState(false)
```

### Keyboard Event Listeners
```typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && showExcelModal) {
      setShowExcelModal(false)
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
      event.preventDefault()
      setShowExcelModal(true)
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [showExcelModal])
```

### Modal Structure
```tsx
{showExcelModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      {/* Modal Header with Close Button */}
      {/* Modal Content with ExcelImportExport Component */}
    </div>
  </div>
)}
```

## Benefits of Modal Implementation

1. **Better UX**: Modal doesn't take up permanent screen space
2. **Keyboard Accessibility**: Full keyboard navigation support
3. **Responsive Design**: Works well on all screen sizes
4. **Focus Management**: Proper focus handling for accessibility
5. **Clean Interface**: Keeps the main interface uncluttered

## Testing the Modal

To test the modal functionality:

1. Navigate to `/enhanced-shifts` page
2. Try opening the modal using all three methods:
   - Click the Excel icon button
   - Press Ctrl+E (or Cmd+E)
   - Programmatically trigger it
3. Try closing the modal using all three methods:
   - Click the X button
   - Press Escape key
   - Programmatically close it
4. Verify that the modal content loads correctly
5. Test that keyboard shortcuts work as expected 