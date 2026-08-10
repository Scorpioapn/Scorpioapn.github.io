Option Explicit

Const xlTypePdf = 0
Const xlPortrait = 1
Const xlPaperA4 = 9
Const xlSheetHidden = 0

Dim fso, scriptDir, repoRoot, workbookPath, qaDir
Dim excel, workbook, marginPoints, sheet, pageSetup, calculation, baseInfo
Dim sheetName, pdfPath, sheetOrder, index, links, linkCount
Dim usedRange, cell, formulaErrorCount, formulaErrorSamples
Dim formulaText, formulaNormalizationCount, functionName, needsNormalization

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
repoRoot = fso.GetAbsolutePathName(fso.BuildPath(scriptDir, "..\.."))
If WScript.Arguments.Count > 0 Then
  workbookPath = fso.GetAbsolutePathName(WScript.Arguments(0))
Else
  workbookPath = fso.BuildPath(repoRoot, "outputs\agenda-excel-20260717\畅言议程生成器-无宏版.xlsx")
End If
qaDir = fso.BuildPath(repoRoot, "outputs\agenda-excel-20260717\qa\native")
If Not fso.FolderExists(qaDir) Then fso.CreateFolder qaDir

On Error Resume Next
Set excel = CreateObject("Excel.Application")
AbortIfError "create Excel"
excel.Visible = False
excel.DisplayAlerts = False
excel.ScreenUpdating = False
AbortIfError "configure Excel"

Set workbook = excel.Workbooks.Open(workbookPath, 0, False)
AbortIfError "open workbook"
marginPoints = excel.CentimetersToPoints(1.2)
AbortIfError "calculate margins"

' artifact-tool writes modern function names without every OOXML future-function
' prefix that desktop Excel expects. Re-assign those formulas through Formula2 so
' Excel records the native function identity instead of treating it as _xludf.
formulaNormalizationCount = 0
For index = 1 To workbook.Worksheets.Count
  Set sheet = workbook.Worksheets.Item(index)
  Set usedRange = sheet.UsedRange
  For Each cell In usedRange.Cells
    If cell.HasFormula Then
      formulaText = CStr(cell.Formula)
      needsNormalization = False
      For Each functionName In Array("LET", "TEXTJOIN", "XLOOKUP", "TEXTBEFORE", "TEXTAFTER", "FILTER")
        If InStr(1, formulaText, functionName & "(", vbTextCompare) > 0 Then needsNormalization = True
      Next
      If needsNormalization Then
        cell.Formula2 = formulaText
        formulaNormalizationCount = formulaNormalizationCount + 1
      End If
    End If
  Next
  Set usedRange = Nothing
  Set sheet = Nothing
Next
AbortIfError "normalize modern Excel formulas"

For Each sheetName In Array("A4议程", "A4续页")
  Set sheet = workbook.Worksheets.Item(sheetName)
  sheet.Unprotect
  sheet.Cells.Locked = True
  Set pageSetup = sheet.PageSetup
  pageSetup.PaperSize = xlPaperA4
  pageSetup.Orientation = xlPortrait
  pageSetup.TopMargin = marginPoints
  pageSetup.BottomMargin = marginPoints
  pageSetup.LeftMargin = marginPoints
  pageSetup.RightMargin = marginPoints
  pageSetup.HeaderMargin = 0
  pageSetup.FooterMargin = 0
  pageSetup.PrintArea = "$A$1:$P$48"
  pageSetup.Zoom = False
  pageSetup.FitToPagesWide = 1
  pageSetup.FitToPagesTall = 1
  pageSetup.CenterHorizontally = True
  pageSetup.CenterVertically = False
  pageSetup.PrintGridlines = False
  pageSetup.PrintHeadings = False
  ' Keep cells protected while leaving drawings editable so users can use
  ' Excel's Change Picture command without first unprotecting the sheet.
  sheet.Protect "", False, True, True
  AbortIfError "configure " & sheetName
  Set pageSetup = Nothing
  Set sheet = Nothing
Next

Set calculation = workbook.Worksheets.Item("计算区")
calculation.Unprotect
calculation.Cells.Locked = True
calculation.Protect
calculation.Visible = xlSheetHidden
AbortIfError "protect calculation sheet"

excel.CalculateFullRebuild
AbortIfError "recalculate workbook"

formulaErrorCount = 0
formulaErrorSamples = ""
For index = 1 To workbook.Worksheets.Count
  Set sheet = workbook.Worksheets.Item(index)
  Set usedRange = sheet.UsedRange
  For Each cell In usedRange.Cells
    If cell.HasFormula Then
      If VarType(cell.Value) = 10 Then
        formulaErrorCount = formulaErrorCount + 1
        If formulaErrorCount <= 10 Then
          If Len(formulaErrorSamples) > 0 Then formulaErrorSamples = formulaErrorSamples & "; "
          formulaErrorSamples = formulaErrorSamples & sheet.Name & "!" & cell.Address(False, False) & "=" & cell.Text & " [" & Left(CStr(cell.Formula2), 120) & "]"
        End If
      End If
    End If
  Next
  Set usedRange = Nothing
  Set sheet = Nothing
Next
If formulaErrorCount > 0 Then
  Err.Raise vbObjectError + 513, "finalize-excel", "Native Excel formula errors: " & formulaErrorSamples
End If
AbortIfError "validate native formulas"

AssertCellText "议程编辑", "H4", ""
AbortIfError "validate native blank explanation"
AssertCellText "议程编辑", "K6", ""
AbortIfError "validate native blank owner"
AssertCellText "A4议程", "O10", "待定"
AbortIfError "validate native pending owner"
If InStr(CStr(workbook.Worksheets.Item("A4议程").Range("J8").Value2), vbLf & "0") > 0 Then
  Err.Raise vbObjectError + 514, "finalize-excel", "A4议程!J8 contains a spurious zero line"
End If
AbortIfError "validate native blank normalization"

workbook.Save
AbortIfError "calculate and save workbook"

For Each sheetName In Array("A4议程", "A4续页")
  Set sheet = workbook.Worksheets.Item(sheetName)
  pdfPath = fso.BuildPath(qaDir, sheetName & ".pdf")
  sheet.ExportAsFixedFormat xlTypePdf, pdfPath, 0, True, False
  AbortIfError "export " & sheetName & " PDF"
  Set sheet = Nothing
Next

sheetOrder = ""
For index = 1 To workbook.Worksheets.Count
  Set sheet = workbook.Worksheets.Item(index)
  If Len(sheetOrder) > 0 Then sheetOrder = sheetOrder & "|"
  sheetOrder = sheetOrder & sheet.Name
  Set sheet = Nothing
Next

linkCount = 0
Err.Clear
links = workbook.LinkSources(1)
If Err.Number = 0 Then
  If IsArray(links) Then linkCount = UBound(links) - LBound(links) + 1
End If
Err.Clear

WScript.Echo "workbook=" & workbookPath
WScript.Echo "fileFormat=" & workbook.FileFormat
WScript.Echo "sheetOrder=" & sheetOrder
WScript.Echo "externalLinks=" & linkCount
WScript.Echo "normalizedFormulas=" & formulaNormalizationCount
WScript.Echo "formulaErrors=" & formulaErrorCount
WScript.Echo "calculationHidden=" & CStr(calculation.Visible = xlSheetHidden)
WScript.Echo "calculationProtected=" & CStr(calculation.ProtectContents)

Set baseInfo = workbook.Worksheets.Item("基础资料")
WScript.Echo "baseInfoShapes=" & baseInfo.Shapes.Count
Set baseInfo = Nothing

For Each sheetName In Array("A4议程", "A4续页")
  Set sheet = workbook.Worksheets.Item(sheetName)
  Set pageSetup = sheet.PageSetup
  WScript.Echo sheetName & ".paperSize=" & pageSetup.PaperSize
  WScript.Echo sheetName & ".orientation=" & pageSetup.Orientation
  WScript.Echo sheetName & ".printArea=" & pageSetup.PrintArea
  WScript.Echo sheetName & ".fitWide=" & pageSetup.FitToPagesWide
  WScript.Echo sheetName & ".fitTall=" & pageSetup.FitToPagesTall
  WScript.Echo sheetName & ".centerHorizontally=" & CStr(pageSetup.CenterHorizontally)
  WScript.Echo sheetName & ".printGridlines=" & CStr(pageSetup.PrintGridlines)
  WScript.Echo sheetName & ".printHeadings=" & CStr(pageSetup.PrintHeadings)
  WScript.Echo sheetName & ".protected=" & CStr(sheet.ProtectContents)
  WScript.Echo sheetName & ".shapes=" & sheet.Shapes.Count
  Set pageSetup = Nothing
  Set sheet = Nothing
Next

workbook.Close False
excel.Quit
Set calculation = Nothing
Set workbook = Nothing
Set excel = Nothing
WScript.Quit 0

Sub AbortIfError(stage)
  Dim number, description
  If Err.Number = 0 Then Exit Sub
  number = Err.Number
  description = Err.Description
  Err.Clear
  On Error Resume Next
  If IsObject(workbook) Then workbook.Close False
  If IsObject(excel) Then excel.Quit
  WScript.Echo "ERROR " & stage & ": " & CStr(number) & " " & description
  WScript.Quit 1
End Sub

Sub AssertCellText(sheetNameToCheck, address, expected)
  Dim actual
  On Error Resume Next
  actual = CStr(workbook.Worksheets.Item(sheetNameToCheck).Range(address).Value2)
  If actual <> expected Then
    Err.Raise vbObjectError + 515, "finalize-excel", sheetNameToCheck & "!" & address & " expected '" & expected & "' but was '" & actual & "'"
  End If
End Sub
