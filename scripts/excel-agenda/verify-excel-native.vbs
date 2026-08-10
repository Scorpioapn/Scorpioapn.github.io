Option Explicit

Const xlPortrait = 1
Const xlPaperA4 = 9
Const xlSheetHidden = 0

Dim fso, scriptDir, repoRoot, workbookPath
Dim excel, workbook, sheet, pageSetup, usedRange, cell, calculation, baseInfo
Dim expectedSheets, index, sheetName, errorCount, errorSamples, links, linkCount
Dim marginPoints, activeRows, value

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
repoRoot = fso.GetAbsolutePathName(fso.BuildPath(scriptDir, "..\.."))
If WScript.Arguments.Count > 0 Then
  workbookPath = fso.GetAbsolutePathName(WScript.Arguments(0))
Else
  workbookPath = fso.BuildPath(repoRoot, "outputs\agenda-excel-20260717\畅言议程生成器-无宏版.xlsx")
End If

On Error Resume Next
Set excel = CreateObject("Excel.Application")
AbortIfError "create Excel"
excel.Visible = False
excel.DisplayAlerts = False
Set workbook = excel.Workbooks.Open(workbookPath, 0, True)
AbortIfError "open workbook read-only"
excel.CalculateFullRebuild
AbortIfError "recalculate workbook"

expectedSheets = Array("操作台", "议程编辑", "A4议程", "A4续页", "模板库", "基础资料", "计算区")
If workbook.Worksheets.Count <> 7 Then Fail "worksheet count was " & workbook.Worksheets.Count
For index = 1 To 7
  If workbook.Worksheets.Item(index).Name <> expectedSheets(index - 1) Then
    Fail "worksheet order mismatch at index " & index
  End If
Next
If workbook.FileFormat <> 51 Then Fail "file format is not standard xlsx"

errorCount = 0
errorSamples = ""
For index = 1 To workbook.Worksheets.Count
  Set sheet = workbook.Worksheets.Item(index)
  Set usedRange = sheet.UsedRange
  For Each cell In usedRange.Cells
    If cell.HasFormula Then
      If VarType(cell.Value) = 10 Then
        errorCount = errorCount + 1
        If errorCount <= 10 Then
          If Len(errorSamples) > 0 Then errorSamples = errorSamples & "; "
          errorSamples = errorSamples & sheet.Name & "!" & cell.Address(False, False) & "=" & cell.Text
        End If
      End If
    End If
  Next
  Set usedRange = Nothing
  Set sheet = Nothing
Next
If errorCount > 0 Then Fail "formula errors after native save: " & errorSamples

linkCount = 0
Err.Clear
links = workbook.LinkSources(1)
If Err.Number = 0 Then
  If IsArray(links) Then linkCount = UBound(links) - LBound(links) + 1
End If
Err.Clear
If linkCount <> 0 Then Fail "external links were found"

Set calculation = workbook.Worksheets.Item("计算区")
If calculation.Visible <> xlSheetHidden Then Fail "calculation sheet is not hidden"
If Not calculation.ProtectContents Then Fail "calculation sheet is not protected"
AssertCellText "计算区", "E2", "779"
AssertCellText "计算区", "E3", "志愿者"
AssertCellText "计算区", "B21", "待定"
AssertCellText "计算区", "B25", "待定"

AssertCellText "议程编辑", "B4", "i-guest-checkin"
AssertCellText "议程编辑", "H4", ""
AssertCellText "议程编辑", "K6", ""
activeRows = 0
For index = 4 To 63
  value = workbook.Worksheets.Item("议程编辑").Range("S" & index).Value2
  If IsNumeric(value) Then activeRows = activeRows + CDbl(value)
Next
If activeRows <> 27 Then Fail "default template active row count was " & activeRows

AssertCellText "A4议程", "O10", "待定"
If InStr(CStr(workbook.Worksheets.Item("A4议程").Range("J8").Value2), vbLf & "0") > 0 Then
  Fail "A4议程!J8 contains a spurious zero line"
End If

marginPoints = excel.CentimetersToPoints(1.2)
For Each sheetName In Array("A4议程", "A4续页")
  Set sheet = workbook.Worksheets.Item(sheetName)
  Set pageSetup = sheet.PageSetup
  If pageSetup.PaperSize <> xlPaperA4 Then Fail sheetName & " is not A4"
  If pageSetup.Orientation <> xlPortrait Then Fail sheetName & " is not portrait"
  If pageSetup.PrintArea <> "$A$1:$P$48" Then Fail sheetName & " print area drifted"
  If pageSetup.FitToPagesWide <> 1 Or pageSetup.FitToPagesTall <> 1 Then Fail sheetName & " fit-to-page drifted"
  If Not pageSetup.CenterHorizontally Then Fail sheetName & " is not centered horizontally"
  If pageSetup.PrintGridlines Then Fail sheetName & " prints gridlines"
  If pageSetup.PrintHeadings Then Fail sheetName & " prints headings"
  If Abs(pageSetup.TopMargin - marginPoints) > 0.2 Then Fail sheetName & " top margin drifted"
  If Abs(pageSetup.BottomMargin - marginPoints) > 0.2 Then Fail sheetName & " bottom margin drifted"
  If Abs(pageSetup.LeftMargin - marginPoints) > 0.2 Then Fail sheetName & " left margin drifted"
  If Abs(pageSetup.RightMargin - marginPoints) > 0.2 Then Fail sheetName & " right margin drifted"
  If Not sheet.ProtectContents Then Fail sheetName & " is not protected"
  If sheet.ProtectDrawingObjects Then Fail sheetName & " protects drawings needed for Change Picture"
  If sheet.Shapes.Count <> 4 Then Fail sheetName & " shape count was " & sheet.Shapes.Count
  Set pageSetup = Nothing
  Set sheet = Nothing
Next

Set baseInfo = workbook.Worksheets.Item("基础资料")
If baseInfo.Shapes.Count <> 4 Then Fail "基础资料 shape count was " & baseInfo.Shapes.Count

WScript.Echo "workbook=" & workbookPath
WScript.Echo "fileFormat=" & workbook.FileFormat
WScript.Echo "externalLinks=" & linkCount
WScript.Echo "formulaErrors=" & errorCount
WScript.Echo "activeRows=" & activeRows
WScript.Echo "calculationHidden=True"
WScript.Echo "calculationProtected=True"
WScript.Echo "A4Pages=2"
WScript.Echo "A4Shapes=4|4"

workbook.Close False
excel.Quit
WScript.Quit 0

Sub AssertCellText(sheetNameToCheck, address, expected)
  Dim actual
  actual = CStr(workbook.Worksheets.Item(sheetNameToCheck).Range(address).Value2)
  If actual <> expected Then
    Fail sheetNameToCheck & "!" & address & " expected '" & expected & "' but was '" & actual & "'"
  End If
End Sub

Sub AbortIfError(stage)
  Dim number, description
  If Err.Number = 0 Then Exit Sub
  number = Err.Number
  description = Err.Description
  Err.Clear
  Fail stage & ": " & CStr(number) & " " & description
End Sub

Sub Fail(message)
  On Error Resume Next
  If IsObject(workbook) Then workbook.Close False
  If IsObject(excel) Then excel.Quit
  WScript.Echo "ERROR " & message
  WScript.Quit 1
End Sub
