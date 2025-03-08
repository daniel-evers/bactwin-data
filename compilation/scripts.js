async function getObjects() {
    const response = await fetch('objects.json')
    const json = await response.json()
    return json
}

function addTd(row, value) {
    let td = document.createElement('td')
    td.textContent = value
    row.appendChild(td)
    return td
}

async function ready() {

    const objects = await getObjects()

    let table = document.getElementById('mainTable')
    let header = document.getElementById('mainHeader')

    const headings = ['ObjSort + LfdNr', 'UUID', 'Vorlagenname', 'Verwendung', 'Kommentar', 'GA-FL Einträge (1.1.1)', 'GA-FL Einträge (2.2.1)', 'GA-FL Einträge (3.1.1)', 'GA-FL Einträge (3.1.3)', 'GA-FL Einträge',
        'Object_Name', 'Status_Flags', 'Event_State', 'Reliability', 'Out_Of_Service', 'Units', 'Min_Pres_Value', 'Max_Pres_Value', 'Resolution', 'COV_Increment', 'Time_Delay', 'Notification_Class', 'Low_Limit',
        'High_Limit', 'Deadband', 'Limit_Enable', 'Event_Enable', 'Notify_Type', 'Event_Time_Stamps', 'Event_Message_Texts', 'Event_Message_Texts_Config', 'Event_Detection_Enable', 'Event_Algorithm_Inhibit',
        'Event_Algorithm_Inhibit_Ref', 'Time_Delay_Normal', 'Reliability_Evaluation_Inhibit']

    headings.forEach(heading => {
        let span = document.createElement('span')
        span.textContent = heading
        let div = document.createElement('div')
        div.appendChild(span)
        let th = document.createElement('th')
        th.className = 'xrotate'
        th.appendChild(div)
        header.appendChild(th)
    })

    const subheadings = [['PropSort'], ['Conformance Code'], ['Grundlegende Vorgabe', 'rgb(153 204 0)'], ['Detailierte Festlegung', 'rgb(153 204 0)'], ['Umsetzung', 'rgb(153 204 0)'], ['Vorgabewert (Parametrierung)', 'rgb(255 204 0)']]
    subheadings.forEach(subheading => {
        let row = document.createElement('tr')
        for (let index = 0; index < 36; index++) {
            let td = document.createElement('td')
            if (index === 2) {
                td.textContent = subheading[0]
                if (subheading[1]) {
                    td.style.background = subheading[1]
                }
                td.style.fontWeight = 'bold'
            }
            row.appendChild(td)
        }
        table.appendChild(row)
    })

    function setCell(row, column, value, color) {
        const td = table.querySelector(`tr:nth-child(${row}) td:nth-child(${column})`)
        td.textContent = value
        if (color) {
            td.style.background = color
        }
    }

    let first = true
    let columnIndex = 11
    for (const [key, value] of Object.entries(objects)) {
        let row = document.createElement('tr')
        addTd(row, value.order)
        addTd(row, value.uuid)
        addTd(row, value.name)
        addTd(row, value.application)
        addTd(row, value.comment)
        addTd(row, value.functions['1.1.1'] ? '✓' : '').style.textAlign = 'center'
        addTd(row, value.functions['2.2.1'] ? '✓' : '').style.textAlign = 'center'
        addTd(row, value.functions['3.1.1'] ? '✓' : '').style.textAlign = 'center'
        addTd(row, value.functions['3.1.3'] ? '✓' : '').style.textAlign = 'center'
        addTd(row, Object.keys(Object.fromEntries(Object.entries(value.functions).filter(entry => entry[1]))).join('; '))
        for (const [name, property] of Object.entries(value.properties)) {
            if (first) {
                setCell(2, columnIndex, property.order)
                setCell(3, columnIndex, property.conformance)
                let duties = property.duty.split('-')
                setCell(4, columnIndex, duties[0], duties[0].length ? 'rgb(153 204 0)' : undefined)
                setCell(5, columnIndex, duties[1], duties[1].length ? 'rgb(153 204 0)' : undefined)
                setCell(6, columnIndex, duties[2], 'rgb(153 204 0)')
                if (property.preset) {
                    setCell(7, columnIndex, '!', 'rgb(255 204 0)')
                }
                else if (property.content !== null && property.content !== undefined && property.content !== '') {
                    setCell(7, columnIndex, '?', 'rgb(51 204 204)')
                }
            }
            columnIndex++
            if (property.content === null || property.content === undefined || property.content === '') {
                addTd(row, '')
                continue
            }
            let propval = property.suggestion ? `[${property.content}]` : property.content
            let tdz = addTd(row, propval)
            tdz.style.background = property.preset ? 'rgb(255 204 0)' : 'rgb(51 204 204)'
        }
        table.appendChild(row)
        first = false
    }

}