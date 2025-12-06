
// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

function exportCSV(view) {
    let data, filename;

    if (view === 'compare') {
        // Export comparison data (both images)
        const dataA = targets['comp_a'].analysisData;
        const dataB = targets['comp_b'].analysisData;

        if (!dataA && !dataB) {
            alert('No data to export');
            return;
        }

        let csv = 'X_Axis';
        if (dataA) csv += ',Image1_Total,Image1_Red,Image1_Green,Image1_Blue';
        if (dataB) csv += ',Image2_Total,Image2_Red,Image2_Green,Image2_Blue';
        csv += '\n';

        // Use longest x_axis
        const maxLen = Math.max(
            dataA ? dataA.x_axis.length : 0,
            dataB ? dataB.x_axis.length : 0
        );

        for (let i = 0; i < maxLen; i++) {
            const xVal = (dataA && i < dataA.x_axis.length) ? dataA.x_axis[i] :
                (dataB && i < dataB.x_axis.length) ? dataB.x_axis[i] : i;

            csv += xVal;

            if (dataA && i < dataA.total.length) {
                csv += `,${dataA.total[i]},${dataA.red[i]},${dataA.green[i]},${dataA.blue[i]}`;
            } else if (dataA) {
                csv += ',,,';
            }

            if (dataB && i < dataB.total.length) {
                csv += `,${dataB.total[i]},${dataB.red[i]},${dataB.green[i]},${dataB.blue[i]}`;
            }

            csv += '\n';
        }

        filename = 'comparison_spectrum.csv';

    } else {
        // Export single or live data
        const targetId = view === 'single' ? 'single' : 'live';
        data = targets[targetId].analysisData;

        if (!data) {
            alert('No data to export. Please analyze an image first.');
            return;
        }

        // Create CSV header
        let csv = 'X_Axis,Total_Intensity,Red,Green,Blue\n';

        // Add data rows
        for (let i = 0; i < data.x_axis.length; i++) {
            csv += `${data.x_axis[i]},${data.total[i]},${data.red[i]},${data.green[i]},${data.blue[i]}\n`;
        }

        filename = `${targetId}_spectrum.csv`;
    }

    // Trigger download
    downloadFile(csv, filename, 'text/csv');
}

function exportPNG(view) {
    let chart, filename;

    if (view === 'compare') {
        chart = charts.comp;
        filename = 'comparison_graph.png';
    } else if (view === 'single') {
        chart = charts.intensity;
        filename = 'single_graph.png';
    } else {
        chart = charts.live_intensity;
        filename = 'live_graph.png';
    }

    if (!chart) {
        alert('No graph to export. Please analyze an image first.');
        return;
    }

    // Get base64 image from Chart.js
    const url = chart.toBase64Image();

    // Convert to blob and download
    fetch(url)
        .then(res => res.blob())
        .then(blob => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
        });
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
