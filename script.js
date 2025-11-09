let graph = {};
let algorithm = 'dfs';
let inputMode = 'list';
let animationSteps = [];
let currentStep = 0;
let animationSpeed = 800;
let isAnimating = false;
let isPaused = false;
let animationTimer = null;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const logContent = document.getElementById('logContent');

const NODE_RADIUS = 25;
const COLORS = {
    unvisited: '#6c757d',
    visiting: '#ffc107',
    processed: '#28a745',
    inStack: '#667eea',
    edge: '#adb5bd',
    edgeActive: '#667eea'
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize with a default graph drawn on canvas
    try {
        graph = parseGraph(document.getElementById('graphInput').value);
        drawGraph({ states: {} });
    } catch (e) {
        console.error("Error initializing default graph:", e);
    }

    // --- NEW: Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        // Don't fire shortcuts if the user is typing in an input field
        const activeTagName = document.activeElement.tagName.toLowerCase();
        if (activeTagName === 'textarea' || activeTagName === 'input') {
            return;
        }

        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const pauseBtn = document.getElementById('pauseBtn');

        switch (e.key) {
            case 'ArrowLeft':
                if (!prevBtn.disabled) prevBtn.click();
                break;
            case 'ArrowRight':
                if (!nextBtn.disabled) nextBtn.click();
                break;
            case ' ': // Space key
                e.preventDefault(); // Prevent page from scrolling on space
                if (!pauseBtn.disabled) pauseBtn.click();
                break;
        }
    });
});

document.getElementById('speedSlider').addEventListener('input', (e) => {
    animationSpeed = parseInt(e.target.value);
    document.getElementById('speedLabel').textContent = (animationSpeed / 1000).toFixed(1) + 's';
});

function showView(viewId) {
    const visualizerView = document.getElementById('visualizer-view');
    const theoryView = document.getElementById('theory-view');
    const title = document.getElementById('main-title');
    const visualizerBtn = document.getElementById('visualizer-btn');
    const theoryBtn = document.getElementById('theory-btn');

    if (viewId === 'theory') {
        visualizerView.style.display = 'none';
        theoryView.style.display = 'block';
        title.innerHTML = '🧠 Topological Sorting Theory';
        visualizerBtn.classList.remove('active');
        theoryBtn.classList.add('active');
    } else {
        visualizerView.style.display = 'block';
        theoryView.style.display = 'none';
        title.innerHTML = '🔄 Topological Sorting Visualizer';
        theoryBtn.classList.remove('active');
        visualizerBtn.classList.add('active');
    }
}

function setAlgorithm(algo) {
    algorithm = algo;
    document.getElementById('dfsBtn').classList.toggle('active', algo === 'dfs');
    document.getElementById('bfsBtn').classList.toggle('active', algo === 'bfs');
    document.getElementById('dfs-pseudo').style.display = (algo === 'dfs') ? 'block' : 'none';
    document.getElementById('bfs-pseudo').style.display = (algo === 'bfs') ? 'block' : 'none';
}

function setInputMode(mode) {
    if (mode === inputMode) return;

    const graphInput = document.getElementById('graphInput');
    let currentGraph;
    try {
        currentGraph = parseGraph(graphInput.value);
    } catch (e) {
        console.error("Error parsing graph for conversion:", e);
        return;
    }
    
    inputMode = mode;
    
    document.getElementById('listBtn').classList.toggle('active', mode === 'list');
    document.getElementById('matrixBtn').classList.toggle('active', mode === 'matrix');

    if (mode === 'list') {
        graphInput.placeholder = "0: 1,2\n1: 3\n2: 3\n3: 4\n4:";
        graphInput.value = graphToListString(currentGraph);
    } else {
        graphInput.placeholder = "  0 1 2 3 4\n0 0 1 1 0 0\n1 0 0 0 1 0\n2 0 0 0 1 0\n3 0 0 0 0 1\n4 0 0 0 0 0";
        graphInput.value = graphToMatrixString(currentGraph);
    }
}


function parseGraph(input) {
    if (inputMode === 'list') return parseAdjacencyList(input);
    return parseAdjacencyMatrix(input);
}

function parseAdjacencyList(input) {
    const lines = input.trim().split('\n');
    const g = {};
    const allNodes = new Set();
    for (let line of lines) {
        if (!line.trim()) continue;
        const [node, neighbors] = line.split(':').map(s => s.trim());
        allNodes.add(node);
        if (neighbors) {
            const neighborList = neighbors.split(',').map(s => s.trim()).filter(Boolean);
            g[node] = neighborList;
            neighborList.forEach(n => allNodes.add(n));
        } else {
            g[node] = [];
        }
    }
    allNodes.forEach(node => { if (!(node in g)) g[node] = []; });
    return g;
}

function parseAdjacencyMatrix(input) {
    const lines = input.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 1) return {};
    const nodes = lines[0].split(/\s+/).filter(Boolean);
    const g = {};
    nodes.forEach(node => g[node] = []);
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/\s+/).filter(Boolean);
        if (parts.length < 1) continue;
        const fromNode = parts[0];
         if (!nodes.includes(fromNode)) continue;
        const row = parts.slice(1);
        for (let j = 0; j < row.length && j < nodes.length; j++) {
            if (row[j] === '1') g[fromNode].push(nodes[j]);
        }
    }
    return g;
}

function graphToListString(graph) {
    const sortedNodes = Object.keys(graph).sort((a, b) => a - b);
    return sortedNodes.map(node => {
        const neighbors = graph[node] ? graph[node].join(', ') : '';
        return `${node}: ${neighbors}`;
    }).join('\n');
}

function graphToMatrixString(graph) {
    const nodes = Object.keys(graph).sort((a, b) => a - b);
    if (nodes.length === 0) return '';

    const header = '  ' + nodes.join(' ');
    const matrix = nodes.map(fromNode => {
        const row = nodes.map(toNode => {
            return graph[fromNode] && graph[fromNode].includes(toNode) ? '1' : '0';
        }).join(' ');
        return `${fromNode} ${row}`;
    });
    return `${header}\n${matrix.join('\n')}`;
}


function generateDFSSteps(graph) {
    const visited = new Set();
    const stack = [];
    const nodes = Object.keys(graph).sort((a, b) => a - b); // Sort for deterministic behavior
    const steps = [];
    const nodeStates = {};
    nodes.forEach(node => nodeStates[node] = 'unvisited');

    steps.push({ message: 'Starting DFS-based Topological Sort', states: { ...nodeStates }, stack: [], pseudoLine: 1 });

    function dfs(node, recStack, path) {
        recStack.add(node);
        visited.add(node);
        path.push(node);
        nodeStates[node] = 'visiting';
        steps.push({ message: `Visiting node ${node}`, states: { ...nodeStates }, stack: [...stack], activeNode: node, pseudoLine: 9 });

        const neighbors = graph[node] || [];
        for (let neighbor of neighbors) {
            steps.push({ message: `Exploring edge ${node} → ${neighbor}`, states: { ...nodeStates }, stack: [...stack], activeEdge: [node, neighbor], pseudoLine: 10 });

            if (!visited.has(neighbor)) {
                steps.push({ message: `${neighbor} is not visited, recursively call DFS`, states: { ...nodeStates }, stack: [...stack], pseudoLine: 12 });
                dfs(neighbor, recStack, path);
            } else if (recStack.has(neighbor)) {
                // If the neighbor is already visited AND is in the current recursion stack, a cycle is found.
                path.push(neighbor); // Add the neighbor to show the full cycle path
                const cyclePath = path.slice(path.indexOf(neighbor));
                steps.push({
                    message: `Cycle detected: ${cyclePath.join(' → ')}`,
                    states: { ...nodeStates },
                    cycle: cyclePath,
                    final: true,
                    error: true
                });
                throw new Error(`Cycle detected involving node ${neighbor}`);
            }
        }

        recStack.delete(node);
        path.pop();
        nodeStates[node] = 'processed';
        stack.push(node);
        steps.push({ message: `Finished processing node ${node}, adding to stack`, states: { ...nodeStates }, stack: [...stack], pseudoLine: 13 });
    }

    try {
        for (let node of nodes) {
            steps.push({ message: `Checking main loop for unvisited nodes. Current: ${node}`, states: { ...nodeStates }, stack: [...stack], pseudoLine: 4 });
            if (!visited.has(node)) {
                steps.push({ message: `Node ${node} is unvisited. Starting DFS from it.`, states: { ...nodeStates }, stack: [...stack], pseudoLine: 6 });
                dfs(node, new Set(), []);
            }
        }
        const result = [...stack].reverse();
        steps.push({ message: 'Reversing stack to get topological order', states: { ...nodeStates }, stack: [], result: result, final: true, pseudoLine: 7 });
    } catch (error) {
        // The error is used to break recursion, the final error step is already in the steps array.
        console.log("Caught expected error:", error.message);
    }
    return steps;
}


function generateBFSSteps(graph) {
    const inDegree = {};
    const nodes = Object.keys(graph);
    const steps = [];
    const nodeStates = {};
    nodes.forEach(node => { inDegree[node] = 0; nodeStates[node] = 'unvisited'; });

    for (let node in graph) {
        for (let neighbor of graph[node]) {
            inDegree[neighbor]++;
        }
    }
    steps.push({ message: 'Starting BFS (Kahn\'s) - Calculated in-degrees', states: { ...nodeStates }, queue: [], result: [], pseudoLine: 5 });

    const queue = [];
    for (let node in inDegree) {
        if (inDegree[node] === 0) {
            queue.push(node);
            nodeStates[node] = 'inStack';
        }
    }
    steps.push({ message: `Added nodes with 0 in-degree: [${queue.join(', ')}]`, states: { ...nodeStates }, queue: [...queue], result: [], pseudoLine: 6 });

    const result = [];
    while (queue.length > 0) {
        steps.push({ message: 'Checking if queue is empty', states: { ...nodeStates }, queue: [...queue], result: [...result], pseudoLine: 8 });
        const node = queue.shift();
        nodeStates[node] = 'visiting';
        steps.push({ message: `Processing ${node} from queue`, states: { ...nodeStates }, queue: [...queue], result: [...result], activeNode: node, pseudoLine: 9 });

        result.push(node);
        nodeStates[node] = 'processed';
        steps.push({ message: `Added ${node} to the final result list`, states: { ...nodeStates }, queue: [...queue], result: [...result], pseudoLine: 10 });

        for (let neighbor of graph[node]) {
            inDegree[neighbor]--;
            steps.push({ message: `Decremented in-degree of ${neighbor} to ${inDegree[neighbor]}`, states: { ...nodeStates }, queue: [...queue], result: [...result], activeEdge: [node, neighbor], pseudoLine: 12 });
            if (inDegree[neighbor] === 0) {
                queue.push(neighbor);
                nodeStates[neighbor] = 'inStack';
                steps.push({ message: `Added ${neighbor} to queue as its in-degree is 0`, states: { ...nodeStates }, queue: [...queue], result: [...result], pseudoLine: 14 });
            }
        }
    }

    if (result.length !== nodes.length) {
        steps.push({ message: 'Error: Cycle detected! Not all nodes were visited.', states: { ...nodeStates }, queue: [], result, final: true, error: true, pseudoLine: 17 });
    } else {
        steps.push({ message: 'Completed! All nodes processed.', states: { ...nodeStates }, queue: [], result: result, final: true, pseudoLine: 16 });
    }
    return steps;
}


function calculateNodePositions(nodes) {
    const positions = {};
    const numNodes = nodes.length;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - NODE_RADIUS * 1.5;
    const sortedNodes = [...nodes].sort();

    sortedNodes.forEach((node, idx) => {
        const angle = (idx / numNodes) * 2 * Math.PI - (Math.PI / 2);
        positions[node] = {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
        };
    });
    return positions;
}

function drawGraph(step) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const nodes = Object.keys(graph);
    if (nodes.length === 0) return;
    const positions = calculateNodePositions(nodes);

    const cycleNodes = new Set(step.cycle || []);
    const cycleEdges = new Set();
    if (step.cycle) {
        for (let i = 0; i < step.cycle.length - 1; i++) {
            cycleEdges.add(`${step.cycle[i]}-${step.cycle[i + 1]}`);
        }
    }

    for (let node in graph) {
        for (let neighbor of graph[node]) {
            const from = positions[node];
            const to = positions[neighbor];
            if (!from || !to) continue;

            const isActive = step.activeEdge && step.activeEdge[0] === node && step.activeEdge[1] === neighbor;
            const isCycleEdge = cycleEdges.has(`${node}-${neighbor}`);

            const angle = Math.atan2(to.y - from.y, to.x - from.x);
            const startX = from.x + NODE_RADIUS * Math.cos(angle);
            const startY = from.y + NODE_RADIUS * Math.sin(angle);
            const endX = to.x - NODE_RADIUS * Math.cos(angle);
            const endY = to.y - NODE_RADIUS * Math.sin(angle);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = isCycleEdge ? '#e74c3c' : (isActive ? COLORS.edgeActive : COLORS.edge);
            ctx.lineWidth = isCycleEdge ? 4 : (isActive ? 3 : 2);
            ctx.stroke();

            const arrowSize = 10;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - arrowSize * Math.cos(angle - Math.PI / 6), endY - arrowSize * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(endX - arrowSize * Math.cos(angle + Math.PI / 6), endY - arrowSize * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = isCycleEdge ? '#e74c3c' : (isActive ? COLORS.edgeActive : COLORS.edge);
            ctx.fill();
        }
    }

    for (let node in positions) {
        const pos = positions[node];
        const state = step.states[node];
        const isActive = step.activeNode === node;
        const isCycleNode = cycleNodes.has(node);

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = COLORS[state] || COLORS.unvisited;
        ctx.fill();
        ctx.strokeStyle = isCycleNode ? '#e74c3c' : (isActive ? '#dc3545' : '#333');
        ctx.lineWidth = isCycleNode ? 5 : (isActive ? 4 : 2);
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node, pos.x, pos.y);
    }
}

function updateLog() {
    logContent.innerHTML = '';
    animationSteps.forEach((step, idx) => {
        if (idx <= currentStep) {
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            if (idx === currentStep) entry.classList.add('active');
            entry.innerHTML = `<span class="step-number">Step ${idx + 1}:</span> ${step.message}`;
            logContent.appendChild(entry);
        }
    });

    // --- THIS IS THE FIX ---
    // This scrolls the container's content to the bottom without affecting the page scroll.
    logContent.scrollTop = logContent.scrollHeight;
}

function updatePseudocodeHighlight(line) {
    const pseudoContainerId = algorithm === 'dfs' ? 'dfs-pseudo' : 'bfs-pseudo';
    const container = document.getElementById(pseudoContainerId);
    if (!container) return;

    container.querySelectorAll('p.highlight').forEach(el => el.classList.remove('highlight'));

    if (line) {
        const lineEl = container.querySelector(`p[data-line="${line}"]`);
        if (lineEl) {
            lineEl.classList.add('highlight');
            // This line, which causes page scrolling, remains commented out.
            // lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

function startVisualization() {
    const input = document.getElementById('graphInput').value;
    const resultDiv = document.getElementById('result');
    try {
        graph = parseGraph(input);
        if (Object.keys(graph).length === 0) throw new Error("Graph is empty. Please enter a valid graph.");

        animationSteps = (algorithm === 'dfs') ? generateDFSSteps(graph) : generateBFSSteps(graph);
        currentStep = 0; isPaused = false; logContent.innerHTML = ''; resultDiv.innerHTML = '';

        drawGraph(animationSteps[0]);
        updateLog();
        updatePseudocodeHighlight(animationSteps[0].pseudoLine);

        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('pauseBtn').textContent = 'Pause';
        document.getElementById('nextBtn').disabled = false;
        document.getElementById('prevBtn').disabled = true;
        document.getElementById('dfsBtn').disabled = true;
        document.getElementById('bfsBtn').disabled = true;

        isAnimating = true; autoPlay();
    } catch (error) {
        resultDiv.innerHTML = `<div class="result error"><h3>❌ Error</h3><div>${error.message}</div></div>`;
    }
}

function prevStep() {
    if (currentStep <= 0) return;

    if (animationSteps[currentStep].final) {
        document.getElementById('result').innerHTML = '';
        isAnimating = true; 
    }

    currentStep--;
    drawGraph(animationSteps[currentStep]);
    updateLog();
    updatePseudocodeHighlight(animationSteps[currentStep].pseudoLine);

    document.getElementById('nextBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = false;
    document.getElementById('prevBtn').disabled = (currentStep === 0);
}

function nextStep() {
    if (currentStep >= animationSteps.length - 1) return;

    currentStep++;
    drawGraph(animationSteps[currentStep]);
    updateLog();
    updatePseudocodeHighlight(animationSteps[currentStep].pseudoLine);

    document.getElementById('prevBtn').disabled = false;

    if (animationSteps[currentStep].final) {
        showFinalResult();
        document.getElementById('nextBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('startBtn').disabled = false; // Re-enable Start
        document.getElementById('dfsBtn').disabled = false;
        document.getElementById('bfsBtn').disabled = false;
        isAnimating = false;
        isPaused = false;
        if (animationTimer) clearTimeout(animationTimer);
    }
}

function autoPlay() {
    if (isAnimating && !isPaused && currentStep < animationSteps.length - 1) {
        animationTimer = setTimeout(() => {
            nextStep();
            autoPlay();
        }, animationSpeed);
    }
}

function togglePause() {
    if (!isAnimating) return;
    isPaused = !isPaused;
    const pauseBtn = document.getElementById('pauseBtn');
    if (isPaused) {
        pauseBtn.textContent = 'Resume';
        if (animationTimer) clearTimeout(animationTimer);
    } else {
        pauseBtn.textContent = 'Pause';
        autoPlay();
    }
}

function showFinalResult() {
    const step = animationSteps[currentStep];
    const resultDiv = document.getElementById('result');
    if (step.error) {
        let errorMessage = step.cycle ? `The detected cycle path is: <div class="result-order">${step.cycle.join(' → ')}</div>` : 'A topological sort is not possible.';
        resultDiv.innerHTML = `<div class="result error"><h3>❌ Error: Cycle Detected</h3><div>${errorMessage}</div></div>`;
    } else {
        resultDiv.innerHTML = `<div class="result"><h3>✅ Final Topological Order (${algorithm.toUpperCase()})</h3><div class="result-order">${step.result.join(' → ')}</div></div>`;
    }
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetVisualization() {
    if (animationTimer) clearTimeout(animationTimer);
    isAnimating = false; isPaused = false; currentStep = 0;
    if (animationSteps.length > 0) {
        drawGraph(animationSteps[0]);
        updateLog();
        updatePseudocodeHighlight(animationSteps[0].pseudoLine);
    } else {
        try {
            graph = parseGraph(document.getElementById('graphInput').value);
            drawGraph({ states: {} });
            updatePseudocodeHighlight(null);
        } catch (e) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('pauseBtn').textContent = 'Pause';
    document.getElementById('nextBtn').disabled = true;
    document.getElementById('prevBtn').disabled = true;
    document.getElementById('result').innerHTML = '';
    logContent.innerHTML = '';
    document.getElementById('dfsBtn').disabled = false;
    document.getElementById('bfsBtn').disabled = false;
}

function clearGraph() {
    if (animationTimer) clearTimeout(animationTimer);
    isAnimating = false; isPaused = false;
    document.getElementById('graphInput').value = '';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    logContent.innerHTML = '';
    document.getElementById('result').innerHTML = '';
    graph = {}; animationSteps = []; currentStep = 0;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('pauseBtn').textContent = 'Pause';
    document.getElementById('nextBtn').disabled = true;
    document.getElementById('prevBtn').disabled = true;
    updatePseudocodeHighlight(null);
    document.getElementById('dfsBtn').disabled = false;
    document.getElementById('bfsBtn').disabled = false;
}

function generateRandomGraph() {
    const numNodes = parseInt(document.getElementById('numNodes').value) || 8;
    const numEdges = parseInt(document.getElementById('numEdges').value) || 10;
    const graphInput = document.getElementById('graphInput');

    if (numNodes <= 0) return;
    const nodes = Array.from({ length: numNodes }, (_, i) => String(i));
    const edges = new Set();
    const adj = {};
    nodes.forEach(node => adj[node] = []);

    let maxEdges = (numNodes * (numNodes - 1)) / 2;
    let edgeCount = 0;
    let attempts = 0;

    while (edgeCount < numEdges && edgeCount < maxEdges && attempts < numEdges * 5) {
        let uIndex = Math.floor(Math.random() * numNodes);
        let vIndex = Math.floor(Math.random() * numNodes);
        if (uIndex >= vIndex) { // Ensure u < v to create a DAG
            attempts++;
            continue;
        }

        const u = nodes[uIndex];
        const v = nodes[vIndex];
        const edgeKey = `${u}-${v}`;

        if (!edges.has(edgeKey)) {
            edges.add(edgeKey);
            adj[u].push(v);
            edgeCount++;
        }
        attempts++;
    }
    
    graph = adj;
    
    inputMode = 'list';
    document.getElementById('listBtn').classList.add('active');
    document.getElementById('matrixBtn').classList.remove('active');
    graphInput.value = graphToListString(graph);

    resetVisualization();
    drawGraph({ states: {} });
}