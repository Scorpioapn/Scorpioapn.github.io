Option Explicit

Dim fso, scriptDir, repoRoot, sourcePath, qaDir, scenarioPath
Dim excel, workbook, dashboard, agenda, calculation, a4Main, a4Overflow, templateLibrary
Dim originalRelay, flatRelay, duplicateRelay, row, index, previousEnd, lastRow
Dim scenarioCount, finalErrorCount
Dim templateTable, sourceTemplateRow, newTemplateRow, newTemplateName

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
repoRoot = fso.GetAbsolutePathName(fso.BuildPath(scriptDir, "..\.."))
If WScript.Arguments.Count > 0 Then
  sourcePath = fso.GetAbsolutePathName(WScript.Arguments(0))
Else
  sourcePath = fso.BuildPath(repoRoot, "outputs\agenda-excel-20260717\畅言议程生成器-无宏版.xlsx")
End If
qaDir = fso.BuildPath(repoRoot, "outputs\agenda-excel-20260717\qa\native")
scenarioPath = fso.BuildPath(qaDir, "scenario-validation.xlsx")
fso.CopyFile sourcePath, scenarioPath, True

On Error Resume Next
Set excel = CreateObject("Excel.Application")
AbortIfError "create Excel"
excel.Visible = False
excel.DisplayAlerts = False
Set workbook = excel.Workbooks.Open(scenarioPath, 0, False)
AbortIfError "open scenario copy"

Set dashboard = workbook.Worksheets.Item("操作台")
Set agenda = workbook.Worksheets.Item("议程编辑")
Set calculation = workbook.Worksheets.Item("计算区")
Set a4Main = workbook.Worksheets.Item("A4议程")
Set a4Overflow = workbook.Worksheets.Item("A4续页")
Set templateLibrary = workbook.Worksheets.Item("模板库")
scenarioCount = 0

' Baseline template.
excel.CalculateFullRebuild
AbortIfError "calculate baseline template"
If ActiveRowCount() <> 27 Then Fail "regular template did not produce 27 items"
scenarioCount = scenarioCount + 1

' Approved 779 relay must flow through the editor and A4 output.
originalRelay = CStr(dashboard.Range("B18").Value2)
dashboard.Range("B4").Value2 = "接龙导入"
excel.CalculateFullRebuild
AbortIfError "calculate relay scenario"
AssertCellText "计算区", "E2", "779"
AssertCellText "计算区", "E3", "志愿者"
AssertCellText "计算区", "E4", "服务"
AssertCellText "计算区", "E5", "莫婷"
AssertCellText "计算区", "E9", "深圳南山•讯美科技3号楼4楼Space Max会议室"
AssertTime "计算区", "E7", 19, 30
AssertTime "计算区", "E8", 21, 30
If ActiveRowCount() <> 21 Then Fail "relay did not produce 21 items"
AssertAgendaPerson "时间官宣言", "May"
AssertAgendaPerson "时间官报告", "May"
AssertAgendaPerson "语法官宣言", "莫婷"
AssertAgendaPerson "语法官报告", "莫婷"
AssertAgendaPerson "哼哈官宣言", "Jessica"
AssertAgendaPerson "哼哈官报告", "Jessica"
AssertAgendaPerson "备稿演讲3", "待定"
AssertAgendaPerson "备稿点评3", "待定"
AssertTime "议程编辑", "F4", 19, 30
lastRow = LastActiveRow()
AssertTime "议程编辑", "R" & lastRow, 21, 5
For row = 5 To lastRow
  If Len(CStr(agenda.Range("B" & row).Value2)) > 0 Then
    previousEnd = CDbl(agenda.Range("R" & (row - 1)).Value2)
    If Abs(CDbl(agenda.Range("F" & row).Value2) - previousEnd) > 0.000001 Then
      Fail "relay schedule discontinuity at row " & row
    End If
  End If
Next
AssertCellText "A4议程", "J8", "事务官开场"
AssertCellText "A4议程", "O8", "文星"
scenarioCount = scenarioCount + 1

' One-line relay text must parse the same way.
flatRelay = Replace(Replace(originalRelay, vbCr, " "), vbLf, " ")
dashboard.Range("B18").Value2 = flatRelay
excel.CalculateFullRebuild
AbortIfError "calculate flattened relay"
AssertCellText "计算区", "E2", "779"
AssertCellText "计算区", "B14", "May"
AssertCellText "计算区", "B15", "Jessica"
AssertCellText "计算区", "B16", "莫婷"
scenarioCount = scenarioCount + 1

' Duplicate posts: a later real name wins, and a later placeholder cannot erase it.
duplicateRelay = flatRelay & " 备稿演讲1:[玫瑰] 备稿演讲1:Alice 备稿演讲1:[烟花]"
dashboard.Range("B18").Value2 = duplicateRelay
excel.CalculateFullRebuild
AbortIfError "calculate duplicate relay"
If RelayValue("备稿演讲1") <> "Alice" Then Fail "duplicate relay did not keep the last real name"
If FormulaErrorCount() <> 0 Then Fail "duplicate relay produced formula errors"
dashboard.Range("B18").Value2 = originalRelay
scenarioCount = scenarioCount + 1

' Template switching must remain live.
dashboard.Range("B4").Value2 = "议程模板"
dashboard.Range("F4").Value2 = "即兴马拉松模板"
excel.CalculateFullRebuild
AbortIfError "calculate impromptu template"
If ActiveRowCount() <> 19 Then Fail "impromptu template did not produce 19 items"
dashboard.Range("F4").Value2 = "常规例会模板"
excel.CalculateFullRebuild
AbortIfError "restore regular template"
If ActiveRowCount() <> 27 Then Fail "regular template did not restore 27 items"
scenarioCount = scenarioCount + 1

' A template appended to the standard table must enter the dynamic dropdown
' and feed the editor without changing workbook formulas.
newTemplateName = "QA扩展模板"
Set templateTable = templateLibrary.ListObjects.Item("AgendaTemplatesTable")
Set sourceTemplateRow = Nothing
For index = 1 To templateTable.ListRows.Count
  If CStr(templateTable.ListColumns.Item("类型").DataBodyRange.Cells(index, 1).Value2) = "item" Then
    Set sourceTemplateRow = templateTable.ListRows.Item(index).Range
    Exit For
  End If
Next
If sourceTemplateRow Is Nothing Then Fail "no source template item row was found"
Set newTemplateRow = templateTable.ListRows.Add
newTemplateRow.Range.Value2 = sourceTemplateRow.Value2
newTemplateRow.Range.Cells(1, 1).Value2 = "qa-template"
newTemplateRow.Range.Cells(1, 2).Value2 = newTemplateName
newTemplateRow.Range.Cells(1, 3).Value2 = 1
newTemplateRow.Range.Cells(1, 4).Value2 = "qa-template-item"
newTemplateRow.Range.Cells(1, 8).Value2 = "扩展模板项目"
excel.CalculateFullRebuild
AbortIfError "calculate dynamic template list"
If excel.WorksheetFunction.CountIf(dashboard.Range("Q2:Q64"), newTemplateName) <> 1 Then
  Fail "new template did not enter the dropdown helper list"
End If
dashboard.Range("F4").Value2 = newTemplateName
excel.CalculateFullRebuild
AbortIfError "calculate appended template"
If ActiveRowCount() <> 1 Then Fail "appended template did not produce one item"
AssertCellText "A4议程", "J8", "扩展模板项目"
dashboard.Range("F4").Value2 = "常规例会模板"
excel.CalculateFullRebuild
If ActiveRowCount() <> 27 Then Fail "regular template did not restore after appended template"
scenarioCount = scenarioCount + 1

' Manual corrections must override, survive source switches, affect scheduling,
' and restore automatically when cleared.
agenda.Range("L4").Value2 = "修正标题验收"
agenda.Range("N4").Value2 = "9"
agenda.Range("O4").Value2 = 9
agenda.Range("P4").Value2 = "修正负责人"
excel.CalculateFullRebuild
AbortIfError "calculate manual correction"
AssertCellText "A4议程", "J8", "修正标题验收"
AssertCellText "A4议程", "N8", "9"
AssertCellText "A4议程", "O8", "修正负责人"
If Abs(CDbl(agenda.Range("R4").Value2) - (CDbl(agenda.Range("F4").Value2) + 9 / 1440)) > 0.000001 Then
  Fail "manual minutes did not update the first end time"
End If
If Abs(CDbl(agenda.Range("F5").Value2) - CDbl(agenda.Range("R4").Value2)) > 0.000001 Then
  Fail "manual minutes did not shift the next start time"
End If
dashboard.Range("B4").Value2 = "接龙导入"
excel.CalculateFullRebuild
dashboard.Range("B4").Value2 = "议程模板"
excel.CalculateFullRebuild
If CStr(agenda.Range("L4").Value2) <> "修正标题验收" Then Fail "source switch cleared a manual correction"
agenda.Range("L4:P4").ClearContents
excel.CalculateFullRebuild
AbortIfError "clear manual correction"
AssertCellText "A4议程", "J8", "来宾入会，相互认识与交流"
scenarioCount = scenarioCount + 1

' Manual 31-item agenda must retain the overflow row and warn visibly.
agenda.Range("L4:P63").ClearContents
dashboard.Range("B4").Value2 = "手工编辑"
For index = 1 To 31
  row = index + 3
  agenda.Range("L" & row).Value2 = "手工项目 " & index
  agenda.Range("N" & row).Value2 = "1"
  agenda.Range("O" & row).Value2 = 1
  agenda.Range("P" & row).Value2 = "负责人 " & index
Next
excel.CalculateFullRebuild
AbortIfError "calculate 31-item manual agenda"
If ActiveRowCount() <> 31 Then Fail "manual agenda did not retain 31 items"
If InStr(CStr(dashboard.Range("B30").Value2), "超过单页容量") = 0 Then Fail "31 items did not trigger the capacity warning"
AssertCellText "A4议程", "J37", "手工项目 30"
AssertCellText "A4续页", "J8", "手工项目 31"
AssertCellText "A4续页", "F39", "续页项目：1 项"
finalErrorCount = FormulaErrorCount()
If finalErrorCount <> 0 Then Fail "31-item scenario produced formula errors"
scenarioCount = scenarioCount + 1

WScript.Echo "source=" & sourcePath
WScript.Echo "scenarioCopy=" & scenarioPath
WScript.Echo "scenarios=" & scenarioCount
WScript.Echo "relayItems=21"
WScript.Echo "regularTemplateItems=27"
WScript.Echo "impromptuTemplateItems=19"
WScript.Echo "dynamicTemplateItems=1"
WScript.Echo "manualOverflowItems=31"
WScript.Echo "formulaErrors=" & finalErrorCount

workbook.Close False
excel.Quit
WScript.Quit 0

Function ActiveRowCount()
  Dim total, currentRow, currentValue
  total = 0
  For currentRow = 4 To 63
    currentValue = agenda.Range("S" & currentRow).Value2
    If IsNumeric(currentValue) Then total = total + CDbl(currentValue)
  Next
  ActiveRowCount = total
End Function

Function LastActiveRow()
  Dim currentRow
  For currentRow = 63 To 4 Step -1
    If Len(CStr(agenda.Range("B" & currentRow).Value2)) > 0 Then
      LastActiveRow = currentRow
      Exit Function
    End If
  Next
  LastActiveRow = 0
End Function

Function RelayValue(label)
  Dim currentRow
  For currentRow = 5 To 28
    If CStr(calculation.Range("A" & currentRow).Value2) = label Then
      RelayValue = CStr(calculation.Range("B" & currentRow).Value2)
      Exit Function
    End If
  Next
  Fail "relay label not found: " & label
End Function

Function FormulaErrorCount()
  Dim count, sheetIndex, currentSheet, currentRange, currentCell
  count = 0
  For sheetIndex = 1 To workbook.Worksheets.Count
    Set currentSheet = workbook.Worksheets.Item(sheetIndex)
    Set currentRange = currentSheet.UsedRange
    For Each currentCell In currentRange.Cells
      If currentCell.HasFormula Then
        If VarType(currentCell.Value) = 10 Then count = count + 1
      End If
    Next
  Next
  FormulaErrorCount = count
End Function

Sub AssertAgendaPerson(title, expected)
  Dim currentRow
  For currentRow = 4 To 63
    If CStr(agenda.Range("G" & currentRow).Value2) = title Then
      If CStr(agenda.Range("K" & currentRow).Value2) <> expected Then
        Fail title & " expected person '" & expected & "' but was '" & CStr(agenda.Range("K" & currentRow).Value2) & "'"
      End If
      Exit Sub
    End If
  Next
  Fail "agenda title not found: " & title
End Sub

Sub AssertCellText(sheetName, address, expected)
  Dim actual
  actual = CStr(workbook.Worksheets.Item(sheetName).Range(address).Value2)
  If actual <> expected Then
    Fail sheetName & "!" & address & " expected '" & expected & "' but was '" & actual & "'"
  End If
End Sub

Sub AssertTime(sheetName, address, expectedHour, expectedMinute)
  Dim actual, expected
  actual = CDbl(workbook.Worksheets.Item(sheetName).Range(address).Value2)
  actual = actual - Fix(actual)
  expected = (expectedHour * 60 + expectedMinute) / 1440
  If Abs(actual - expected) > 0.00001 Then
    Fail sheetName & "!" & address & " did not equal " & expectedHour & ":" & expectedMinute
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
