# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright 2025 Daniel Evers

# re-compile data (YAML definitions to JSON files)
npm run compile

# open visible Excel instance
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $true

# create a new workbook with a proper worksheet
$workbook = $excel.Workbooks.Add()
$worksheet = $workbook.Worksheets.Item(1)
$worksheet.Name = "AI - de (Analog Input)"
$worksheet.Rows.Font.Name = "Calibri"
$worksheet.Rows.Font.Size = 10
$worksheet.Columns(2).Font.Name = "Consolas"

# load template data
$json = Get-Content '../compilation/objects.json' | ConvertFrom-Json

# initialize row and column index
$row = 7
$column = 1

# helper function to set cell value, background color and bold style
function Set-Cell {
    param ([int]$row, [int]$column, [string]$value, [int]$colorIndex, [bool]$bold)
    $cell = $worksheet.Cells($row, $column)
    if ($bold) {
        $cell.Font.Bold = $true
    }
    if ($colorIndex) {
        $cell.Interior.ColorIndex = $colorIndex
    }
    $cell.Value = "$value"
}

# set fixed headings
$heading = @('ObjSort + LfdNr', 'UUID', 'Vorlagenname', 'Verwendung', 'Kommentar', 'GA-FL Einträge (1.1.1)', 'GA-FL Einträge (2.2.1)', 'GA-FL Einträge (3.1.1)', 'GA-FL Einträge (3.1.3)', 'GA-FL Einträge',
    'Object_Name', 'Status_Flags', 'Event_State', 'Reliability', 'Out_Of_Service', 'Units', 'Min_Pres_Value', 'Max_Pres_Value', 'Resolution', 'COV_Increment', 'Time_Delay', 'Notification_Class', 'Low_Limit',
    'High_Limit', 'Deadband', 'Limit_Enable', 'Event_Enable', 'Notify_Type', 'Event_Time_Stamps', 'Event_Message_Texts', 'Event_Message_Texts_Config', 'Event_Detection_Enable', 'Event_Algorithm_Inhibit',
    'Event_Algorithm_Inhibit_Ref', 'Time_Delay_Normal', 'Reliability_Evaluation_Inhibit')
$heading | ForEach-Object {
    $worksheet.Cells(1, $column++).Value = "$_"
}
$headingRow = $worksheet.Rows(1)
$headingRow.Font.Bold = $true
$headingRow.Orientation = 45
$headingRow.HorizontalAlignment = -4108 # xlHAlignCenter

# set special subheadings
Set-Cell 2 3 "PropSort" -bold $true
Set-Cell 3 3 "Conformance Code" -bold $true
Set-Cell 4 3 "Grundlegende Vorgabe" 43 $true
Set-Cell 5 3 "Detailierte Festlegung" 43 $true
Set-Cell 6 3 "Umsetzung" 43 $true
Set-Cell 7 3 "Vorgabewert (Parametrierung)" 44 $true

# indication to output static property information
$first = $true

# output all available templates
foreach ($item in $json.PSObject.Properties) {
    $row++
    $column = 1
    $object = $item.Value

    # set common values
    Set-Cell $row ($column++) $object.order
    Set-Cell $row ($column++) $object.uuid
    Set-Cell $row ($column++) $object.name
    Set-Cell $row ($column++) $item.application
    Set-Cell $row ($column++) $object.comment

    # make and set BA function list values
    $functions = ''
    foreach ($function in $object.functions.PSObject.Properties) {
        if ($functions.Length -gt 0) {
            $functions += "; "
        }
        $functions += $function.Name

        $value = $function.Value
        if ($true -eq $function.Value) {
            $value = '✓'
        }
        elseif ($false -eq $function.Value) {
            $value = ''
        }
        $worksheet.Columns($column).HorizontalAlignment = -4108 # xlHAlignCenter
        $worksheet.Cells($row, $column++).Value = "$value"
    }
    Set-Cell $row ($column++) $functions

    # set property values
    foreach ($property in $object.properties.PSObject.Properties) {

        # set static property information
        if ($first) {
            $worksheet.Columns($column).HorizontalAlignment = -4108 # xlHAlignCenter
            $duties = $property.Value.duty -split "-"
            Set-Cell 2 $column $property.Value.order
            Set-Cell 3 $column $property.Value.conformance
            Set-Cell 4 $column $duties[0] (0 -eq $duties[0].Length ? 0 : 43)
            Set-Cell 5 $column $duties[1] (0 -eq $duties[1].Length ? 0 : 43)
            Set-Cell 6 $column $duties[2] 43
            Set-Cell 7 $column ($property.Value.preset ? '!' : '?')
            if ($property.Value.preset) {
                $worksheet.Cells(7, $column).Interior.ColorIndex = 44
            }
            elseif ($null -ne $property.Value.content) {
                $worksheet.Cells(7, $column).Value = '?'
                $worksheet.Cells(7, $column).Interior.ColorIndex = 42
            }
        }

        # ignire empty values
        if ($null -eq $property.Value.content) {
            $column++
            continue
        }

        # set background color and value
        $colorIndex = ($property.Value.preset ? 44 : 42)
        $value = ($property.Value.suggestion ? '[' + $property.Value.content + ']' : $property.Value.content)
        Set-Cell $row ($column++) $value $colorIndex
    }

    $first = $false
}

# set borders of main table
$range = $worksheet.Range("A1:AJ$row")
$range.Borders.LineStyle = 1 # xlContinuous
$range.Borders.ColorIndex = 16
$row = $row + 2

# helper function to set legend row
function Set-Legend {
    param ([int]$row, [string]$text, [int]$colorIndex, [bool]$bold)
    $range = $worksheet.Range("A$row" + ":" + "D$row")
    $range.Borders.LineStyle = 1 # xlContinuous
    $range.Borders.ColorIndex = 16
    $range.Merge()
    if ($bold) {
        $range.Font.Bold = $true
    }
    if ($colorIndex) {
        $range.Interior.ColorIndex = $colorIndex
    }
    $worksheet.Cells($row, 1).Value = "$text"
}

# set legend
Set-Legend ($row++) "Legende" -bold $true
Set-Legend ($row++) "* = B (Bauherr/Betreiber), P (GA-Planung), U (Ausführendes Unternehmen)" 43
Set-Legend ($row++) "! = Vorgabewert (Parametrierung) und Prüfwert" 44
Set-Legend ($row++) "? = Prüfwert (systemintern erzeugter Wert)" 42
Set-Legend ($row++) "[] = Vorschlag für einen Vorgabewert" 44
Set-Legend ($row++) "* Kann zur Prüfung beim 1:1 Test verwendet werden" 42
Set-Legend ($row++) "*** gemäß Kapitel 4.4 einrichten" 44

# fit width of all columns
[void]$worksheet.Range("A47").Select()
[void]$worksheet.Columns("A:AJ").AutoFit()
for ($index = 11; $index -le $worksheet.UsedRange.Columns.Count; $index++) {
    $column = $worksheet.Columns($index)
    $column.ColumnWidth = $column.ColumnWidth + 1
}

# save workbook and close Excel
#$workbook.SaveAs('bactwin-data-ai-demo.xlsx')
#$excel.Quit()