const express = require('express');
const cors = require('cors');
const Datastore = require('nedb');
const path = require('path');
const UAParser = require('ua-parser-js');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

const db = new Datastore({ filename: path.join(__dirname, '.an.db'), autoload: true });

// Middleware
app.use(express.json()); // Parses incoming JSON requests
app.use(cors({ origin: process.env.ORIGIN })); 

app.get('/', (req, res) => {
  res.send('OK')
})

app.get('/view', (req, res) => {
  db.find({})
    .sort({ timestamp: 1 }) // Use sort here
    .exec((err, docs) => {
        if (err) {
          return res.status(500).send(err);
        }
        res.json(docs);
    });
});


app.post('/an', (req, res) => {
  const { timestamp, userAgent } = req.body;
  
  const p = new UAParser(userAgent);
  const { browser, cpu, device, engine, os } = p.getResult()
  
  if (!timestamp || !userAgent) {
    return res.status(400).send({ error: 'Invalid request data' });
  }
  
  // Insert data into the NeDB database
  db.insert({ 
    timestamp, 
    browser_name: browser.name || "unknown",
    browser_ver: browser.version || "unknown",
    os_name: os.name || "unknown",
    os_ver: os.version || "unknown",
    device_model: device.model || "unknown",
    device_type: device.type || "desktop",
    device_vendor: device.vendor || "unknown",
    engine_name: engine.name || "unknown",
    engine_ver: engine.version || "unknown",
    cpu: cpu.architecture || "unknown"
    }, (err, newDoc) => {
    if (err) {
      return res.status(500).send({ error: 'Failed to save' });
    }
    res.status(200).send({ success: true });
  });
});

app.get('/graph', (req, res) => {
  db.find({}, (err, docs) => {
    if (err) {
      return res.status(500).send(err);
    }

    const startDate = new Date(Math.min(...docs.map(entry => new Date(entry.timestamp))));
   
    // generate graph html
    const template = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SOS Analytics</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels"></script>
  <style>
    .pie-chart {
      max-width: 200px;
      width: 100%;
      height: auto;
    }
    .pies {
      display: flex;
      flex-wrap: wrap;
      gap: 2rem;
    }
  </style>
</head>
<body>
  <label for="startDate">Start Date:</label>
  <input type="date" id="startDate" value="${startDate.toISOString().split('T')[0]}"/>
  
  <label for="endDate">End Date:</label>
  <input type="date" id="endDate" value="${new Date().toISOString().split('T')[0]}"/>
  
  <button id="updateChart">Update Chart</button>
  <p id="totalVisits">Total Visits: ${docs.length}</p>
  
  <canvas id="myChart"></canvas>
  <div class="pies">
    <canvas class="pie-chart" id="browserChart"></canvas>
    <canvas class="pie-chart" id="osChart"></canvas>
    <canvas class="pie-chart" id="deviceChart"></canvas>
  </div>

  <script>
  
    Chart.register(ChartDataLabels);
    const d = ${JSON.stringify(docs)};
    
    let charts = []
    
    function getCounts(data, key) {
      return data.reduce((acc, entry) => {
        const value = entry[key];
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {});
    }
    
    
    function prepareChartData(counts) {
      const labels = Object.keys(counts);
      const values = Object.values(counts);
      return { labels, values };
    }


    function filterDataByDateRange(data, startDate, endDate) {
      return data.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= startDate && entryDate <= endDate;
      });
    }


    function renderPieChart(ctx, data, title, existingChart) {
    const c =  new Chart(ctx, {
        type: 'pie',
        data: {
          labels: data.labels,
          datasets: [{
            label: title,
            data: data.values,
            backgroundColor: [
              'rgba(255, 99, 132, 0.2)',
              'rgba(54, 162, 235, 0.2)',
              'rgba(255, 206, 86, 0.2)',
              'rgba(75, 192, 192, 0.2)',
              'rgba(153, 102, 255, 0.2)',
              'rgba(255, 159, 64, 0.2)',
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(153, 102, 255, 1)',
              'rgba(255, 159, 64, 1)',
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: title
            },
           datalabels: {
                color: 'black', 
            }
          }
        }
      });
      
      charts.push(c)
    }
    
    const startDate = new Date(Math.min(...d.map(entry => new Date(entry.timestamp))));
    const endDate = new Date();
    
    // Set default dates
    document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('endDate').value = endDate.toISOString().split('T')[0];

    function updateCharts() {
      let filteredData = d
      const startDateInput = new Date(document.getElementById('startDate').value);
      const endDateInput = new Date(document.getElementById('endDate').value);
      endDateInput.setHours(23, 59, 59, 999); // Set end of day
        
      if(charts.length) {
        destroyAllCharts()

        const filteredData = filterDataByDateRange(d, startDateInput, endDateInput);
      
      }
      

      
      // Update counts
      const browserCounts = getCounts(filteredData, 'browser_name');
      const deviceCounts = getCounts(filteredData, 'device_type');
      const osCounts = getCounts(filteredData, 'os_name');

      const browserData = prepareChartData(browserCounts);
      const deviceData = prepareChartData(deviceCounts);
      const osData = prepareChartData(osCounts);


      // Update pie charts
      renderPieChart(document.getElementById('browserChart').getContext('2d'), browserData, 'Browser');
      renderPieChart(document.getElementById('deviceChart').getContext('2d'), deviceData, 'Device');
      renderPieChart(document.getElementById('osChart').getContext('2d'), osData, 'Operating System');

      // Update total visits
      const totalVisits = filteredData.length;
      document.getElementById('totalVisits').textContent = \`Total Visits: \${totalVisits}\`;

      // Update bar graph
      const visitsPerDay = {};
      filteredData.forEach(entry => {
        const date = entry.timestamp.split('T')[0];
        visitsPerDay[date] = (visitsPerDay[date] || 0) + 1;
      });

      const dateRange = [];
      for (let d = new Date(startDateInput); d <= endDateInput; d.setDate(d.getDate() + 1)) {
        const dateString = d.toISOString().split('T')[0];
        dateRange.push({
          date: dateString,
          visits: visitsPerDay[dateString] || 0
        });
      }

      const filteredLabels = dateRange.map(entry => entry.date);
      const filteredVisitCounts = dateRange.map(entry => entry.visits);
      renderChart(filteredLabels, filteredVisitCounts);
    }

    const ctx = document.getElementById('myChart').getContext('2d');

    function renderChart(filteredLabels, filteredVisitCounts) {
   
      const c = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: filteredLabels,
          datasets: [{
            label: 'Visits per Day',
            data: filteredVisitCounts,
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Visits'
              },
              ticks: {
                stepSize: 1 
              }
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          }
        }
      });
      charts.push(c)
    }
    
    function destroyAllCharts() {
      charts.forEach(chart => {
            chart.destroy();
          });
      charts = []
    }


    document.getElementById('updateChart').addEventListener('click', updateCharts);

    // Initial rendering with the full dataset
    updateCharts();
  </script>
</body>
</html>


    `

    res.send(template);
  });
});


// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});



function tsToDay(ts) {
  return ts.split('T')[0]
}

function getDateRange(startDate, endDate) {
    const dateArray = [];
    let currentDate = new Date(startDate);
    const stopDate = new Date(endDate);

    while (currentDate <= stopDate) {
        dateArray.push(tsToDay(currentDate.toISOString())); 
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return dateArray;
}