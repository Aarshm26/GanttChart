function calculateSchedule() {
    const burstTimes = document.getElementById('processes').value.split(',').map(Number);
    const arrivalTimes = document.getElementById('arrivalTimes').value.split(',').map(Number);
    const priorities = document.getElementById('priorities').value.split(',').map(Number);
    const timeQuantum = parseInt(document.getElementById('timeQuantum').value, 10);
    const algorithm = document.getElementById('algorithm').value;
    const errorElement = document.getElementById('error');

    // Input validation
    if (burstTimes.length === 0 || burstTimes.some(isNaN)) {
        errorElement.style.display = 'block';
        errorElement.textContent = "Please enter valid burst times.";
        return;
    }

    // If arrival times are not provided, default to 0
    const validArrivalTimes = arrivalTimes.length === burstTimes.length ? 
        arrivalTimes : new Array(burstTimes.length).fill(0);

    if (algorithm.includes('priority') && (priorities.length !== burstTimes.length || priorities.some(isNaN))) {
        errorElement.style.display = 'block';
        errorElement.textContent = "Please enter valid priorities for all processes.";
        return;
    }

    if (algorithm === 'rr' && (isNaN(timeQuantum) || timeQuantum <= 0)) {
        errorElement.style.display = 'block';
        errorElement.textContent = "Please enter a valid time quantum greater than 0.";
        return;
    }

    if (burstTimes.some(t => t <= 0)) {
        errorElement.style.display = 'block';
        errorElement.textContent = "Burst times must be positive numbers.";
        return;
    }

    errorElement.style.display = 'none';

    const processes = burstTimes.map((burst, i) => ({
        id: i + 1,
        burst,
        arrival: validArrivalTimes[i],
        priority: priorities[i] || 0,
        remainingTime: burst
    }));

    let result;
    switch (algorithm) {
        case 'fcfs':
            result = fcfs([...processes]);
            break;
        case 'sjf':
            result = sjf([...processes]);
            break;
        case 'srtf':
            result = srtf([...processes]);
            break;
        case 'rr':
            result = roundRobin([...processes], timeQuantum);
            break;
        case 'priority-np':
            result = priorityNonPreemptive([...processes]);
            break;
        case 'priority-p':
            result = priorityPreemptive([...processes]);
            break;
        default:
            errorElement.style.display = 'block';
            errorElement.textContent = "Invalid algorithm selected.";
            return;
    }

    displayResults(result, processes);
}

function fcfs(processes) {
    processes.sort((a, b) => a.arrival - b.arrival);
    let currentTime = 0;
    let ganttChart = [];
    let completionTimes = new Array(processes.length).fill(0);

    processes.forEach(process => {
        currentTime = Math.max(currentTime, process.arrival);
        ganttChart.push({ id: process.id, start: currentTime, end: currentTime + process.burst });
        currentTime += process.burst;
        completionTimes[process.id - 1] = currentTime;
    });

    return { ganttChart, completionTimes };
}

function sjf(processes) {
    let currentTime = 0;
    let ganttChart = [];
    let completionTimes = new Array(processes.length).fill(0);
    let remainingProcesses = [...processes];

    while (remainingProcesses.length > 0) {
        let availableProcesses = remainingProcesses.filter(p => p.arrival <= currentTime);
        
        if (availableProcesses.length === 0) {
            currentTime = Math.min(...remainingProcesses.map(p => p.arrival));
            continue;
        }

        let selectedProcess = availableProcesses
            .reduce((min, p) => p.burst < min.burst ? p : min, availableProcesses[0]);

        ganttChart.push({ 
            id: selectedProcess.id, 
            start: currentTime, 
            end: currentTime + selectedProcess.burst 
        });

        currentTime += selectedProcess.burst;
        completionTimes[selectedProcess.id - 1] = currentTime;
        remainingProcesses = remainingProcesses.filter(p => p.id !== selectedProcess.id);
    }

    return { ganttChart, completionTimes };
}

function srtf(processes) {
    let currentTime = 0;
    let ganttChart = [];
    let completionTimes = new Array(processes.length).fill(0);
    let remainingProcesses = processes.map(p => ({ ...p, remainingTime: p.burst }));

    while (remainingProcesses.length > 0) {
        let availableProcesses = remainingProcesses.filter(p => p.arrival <= currentTime);
        
        if (availableProcesses.length === 0) {
            currentTime = Math.min(...remainingProcesses.map(p => p.arrival));
            continue;
        }

        let selectedProcess = availableProcesses
            .reduce((min, p) => p.remainingTime < min.remainingTime ? p : min, availableProcesses[0]);

        let nextArrivalTime = Math.min(
            ...remainingProcesses
                .filter(p => p.arrival > currentTime)
                .map(p => p.arrival),
            Infinity
        );

        let executeTime = Math.min(
            selectedProcess.remainingTime,
            nextArrivalTime - currentTime
        );

        if (ganttChart.length > 0 && ganttChart[ganttChart.length - 1].id === selectedProcess.id) {
            ganttChart[ganttChart.length - 1].end = currentTime + executeTime;
        } else {
            ganttChart.push({
                id: selectedProcess.id,
                start: currentTime,
                end: currentTime + executeTime
            });
        }

        selectedProcess.remainingTime -= executeTime;
        currentTime += executeTime;

        if (selectedProcess.remainingTime === 0) {
            completionTimes[selectedProcess.id - 1] = currentTime;
            remainingProcesses = remainingProcesses.filter(p => p.id !== selectedProcess.id);
        }
    }

    return { ganttChart, completionTimes };
}

function roundRobin(processes, timeQuantum) {
    let currentTime = 0;
    let ganttChart = [];
    let completionTimes = new Array(processes.length).fill(0);
    let remainingProcesses = processes.map(p => ({ ...p, remainingTime: p.burst }));
    let queue = [];

    while (remainingProcesses.length > 0 || queue.length > 0) {
        // Add newly arrived processes to queue
        let newArrivals = remainingProcesses
            .filter(p => p.arrival <= currentTime && !queue.includes(p));
        queue.push(...newArrivals);

        if (queue.length === 0) {
            currentTime = Math.min(...remainingProcesses.map(p => p.arrival));
            continue;
        }

        let currentProcess = queue.shift();
        let executeTime = Math.min(timeQuantum, currentProcess.remainingTime);

        if (ganttChart.length > 0 && ganttChart[ganttChart.length - 1].id === currentProcess.id) {
            ganttChart[ganttChart.length - 1].end = currentTime + executeTime;
        } else {
            ganttChart.push({
                id: currentProcess.id,
                start: currentTime,
                end: currentTime + executeTime
            });
        }

        currentTime += executeTime;
        currentProcess.remainingTime -= executeTime;

        if (currentProcess.remainingTime > 0) {
            // Add any processes that arrived during execution
            newArrivals = remainingProcesses
                .filter(p => p.arrival <= currentTime && 
                           !queue.includes(p) && 
                           p.id !== currentProcess.id);
            queue.push(...newArrivals);
            queue.push(currentProcess);
        } else {
            completionTimes[currentProcess.id - 1] = currentTime;
            remainingProcesses = remainingProcesses.filter(p => p.id !== currentProcess.id);
        }
    }

    return { ganttChart, completionTimes };
}

function priorityNonPreemptive(processes) {
    let currentTime = 0;
    let ganttChart = [];
    let completionTimes = new Array(processes.length).fill(0);
    let remainingProcesses = [...processes];

    while (remainingProcesses.length > 0) {
        let availableProcesses = remainingProcesses.filter(p => p.arrival <= currentTime);
        
        if (availableProcesses.length === 0) {
            currentTime = Math.min(...remainingProcesses.map(p => p.arrival));
            continue;
        }

        let selectedProcess = availableProcesses
            .reduce((min, p) => p.priority < min.priority ? p : min, availableProcesses[0]);

        ganttChart.push({
            id: selectedProcess.id,
            start: currentTime,
            end: currentTime + selectedProcess.burst
        });

        currentTime += selectedProcess.burst;
        completionTimes[selectedProcess.id - 1] = currentTime;
        remainingProcesses = remainingProcesses.filter(p => p.id !== selectedProcess.id);
    }

    return { ganttChart, completionTimes };
}

function priorityPreemptive(processes) {
    let currentTime = 0;
    let ganttChart = [];
    let completionTimes = new Array(processes.length).fill(0);
    let remainingProcesses = processes.map(p => ({ ...p, remainingTime: p.burst }));

    while (remainingProcesses.length > 0) {
        let availableProcesses = remainingProcesses.filter(p => p.arrival <= currentTime);
        
        if (availableProcesses.length === 0) {
            currentTime = Math.min(...remainingProcesses.map(p => p.arrival));
            continue;
        }

        let selectedProcess = availableProcesses
            .reduce((min, p) => p.priority < min.priority ? p : min, availableProcesses[0]);

        let nextEventTime = Math.min(
            ...remainingProcesses
                .filter(p => p.arrival > currentTime)
                .map(p => p.arrival),
            Infinity
        );

        let executeTime = Math.min(
            selectedProcess.remainingTime,
            nextEventTime - currentTime
        );

        if (ganttChart.length > 0 && ganttChart[ganttChart.length - 1].id === selectedProcess.id) {
            ganttChart[ganttChart.length - 1].end = currentTime + executeTime;
        } else {
            ganttChart.push({
                id: selectedProcess.id,
                start: currentTime,
                end: currentTime + executeTime
            });
        }

        selectedProcess.remainingTime -= executeTime;
        currentTime += executeTime;

        if (selectedProcess.remainingTime === 0) {
            completionTimes[selectedProcess.id - 1] = currentTime;
            remainingProcesses = remainingProcesses.filter(p => p.id !== selectedProcess.id);
        }
    }

    return { ganttChart, completionTimes };
}

function displayResults(result, processes) {
    const { ganttChart, completionTimes } = result;
    displayGanttChart(ganttChart);
    displayMetrics(processes, completionTimes);
    displayProcessTable(processes, completionTimes);
}

function displayGanttChart(ganttChart) {
    const ganttChartElement = document.getElementById('ganttChart');
    ganttChartElement.innerHTML = '';
    
    ganttChart.forEach(item => {
        const div = document.createElement('div');
        div.className = 'gantt-item';
        div.style.width = `${Math.max((item.end - item.start) * 30, 30)}px`;
        div.innerHTML = `P${item.id}<br>${item.start}-${item.end}`;
        ganttChartElement.appendChild(div);
    });
}

function displayMetrics(processes, completionTimes) {
    const waitingTimes = processes.map((p, i) => {
        return completionTimes[i] - p.arrival - p.burst;
    });

    const turnaroundTimes = processes.map((p, i) => {
        return completionTimes[i] - p.arrival;
    });

    const avgWaitingTime = (waitingTimes.reduce((a, b) => a + b, 0) / processes.length).toFixed(2);
    const avgTurnaroundTime = (turnaroundTimes.reduce((a, b) => a + b, 0) / processes.length).toFixed(2);

    document.getElementById('avgWaiting').textContent = avgWaitingTime;
    document.getElementById('avgTurnaround').textContent = avgTurnaroundTime;
    document.getElementById('totalProcesses').textContent = processes.length;
}

function displayProcessTable(processes, completionTimes) {
    const tableBody = document.getElementById('processTableBody');
    tableBody.innerHTML = '';
    
    processes.forEach((p, i) => {
        const waitingTime = completionTimes[i] - p.arrival - p.burst;
        const turnaroundTime = completionTimes[i] - p.arrival;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>P${p.id}</td>
            <td>${p.burst}</td>
            <td>${p.arrival}</td>
            <td>${p.priority || 'N/A'}</td>
            <td>${waitingTime}</td>
            <td>${turnaroundTime}</td>
        `;
        tableBody.appendChild(row);
    });
}