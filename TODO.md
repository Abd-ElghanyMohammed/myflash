# Task: Add Excel Import Feature

## Steps to Complete:

- [x] 1. Add "Import from Excel" button to the dashboard action buttons row in index.html
- [x] 2. Add Import modal to index.html with file input and import options
- [x] 3. Add JavaScript event listener in app.js for the import button
- [x] 4. Enhance importFromExcel function in app.js to support both CSV and Excel (xlsx) formats
- [x] 5. Add styling for the Import button in style.css
- [x] 6. Add SheetJS library for Excel file parsing

## Details:
- Added button after "Export Products" button in the action buttons row
- Modal has:
  - File input for Excel/CSV upload
  - Option to Merge (add to existing) or Replace (delete all and add new)
  - Preview of data before importing
- Uses SheetJS (xlsx) library for Excel file parsing
- Supports automatic column detection (Serial Number, Product Name, Warehouse)
- Maps warehouse names to Arabic (فيصل, البيني, باب الوق)

