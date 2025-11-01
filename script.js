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

document.getElementById('speedSlider').addEventListener('input', (e) => {
    animationSpeed = parseInt(e.target.value);
    document.getElementById('speedLabel').textContent = (animationSpeed / 1000).toFixed(1) + 's';
});

function setAlgorithm(algo) {
    algorithm = algo;
    document.getElementById('dfsBtn').classList.toggle('active', algo === 'dfs');
    document.getElementById('bfsBtn').classList.toggle('active', algo === 'bfs');
}

function setInputMode(mode) {
    inputMode = mode;
    document.getElementById('listBtn').classList.toggle('active', mode === 'list');
    document.getElementById('matrixBtn').classList.toggle('active', mode === 'matrix');

    const graphInput = document.getElementById('graphInput');
    const infoText = document.getElementById('infoText');

    if (mode === 'list') {
        graphInput.placeholder = `0: 1,2
1: 3
2: 3
3: 4
4:`;
        graphInput.value = `0: 1,2
1: 3
2: 3
3: 4
4:`;
        infoText.innerHTML = '<strong>How to use:</strong> Enter graph as adjacency list (one per line). Example: "0: 1,2" means node 0 points to nodes 1 and 2.';
    } else {
        graphInput.placeholder = `  0 1 2 3 4
0 0 1 1 0 0
1 0 0 0 1 0
2 0 0 0 1 0
3 0 0 0 0 1
4 0 0 0 0 0`;
        graphInput.value = `  0 1 2 3 4
0 0 1 1 0 0
1 0 0 0 1 0
2 0 0 0 1 0
3 0 0 0 0 1
4 0 0 0 0 0`;
        infoText.innerHTML = '<strong>How to use:</strong> Enter adjacency matrix with node labels in first row and column. 1 means edge exists from row node to column node.';
    }
}

function parseGraph(input) {
    if (inputMode === 'list') {
        return parseAdjacencyList(input);
    } else {
        return parseAdjacencyMatrix(input);
    }
}

function parseAdjacencyList(input) {
    const lines = input.trim().split('\n');
    const g = {};
    const allNodes = new Set();

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        const [node, neighbors] = line.split(':').map(s => s.trim());
        allNodes.add(node);

        if (neighbors) {
            const neighborList = neighbors.split(',').map(s => s.trim()).filter(s => s);
            g[node] = neighborList;
            neighborList.forEach(n => allNodes.add(n));
        } else {
            g[node] = [];
        }
    }

    allNodes.forEach(node => {
        if (!(node in g)) {
            g[node] = [];
        }
    });

    return g;
}

function parseAdjacencyMatrix(input) {
    const lines = input.trim().split('\n').map(line => line.trim()).filter(line => line);

    if (lines.length < 2) {
        throw new Error('Invalid matrix format. Need at least header row and one data row.');
    }

    // Parse header (node labels)
    const nodes = lines[0].split(/\s+/).filter(s => s);
    const g = {};

    // Initialize all nodes
    nodes.forEach(node => g[node] = []);

    // Parse matrix rows
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/\s+/).filter(s => s);

        if (parts.length < 2) continue;

        const fromNode = parts[0];
        const row = parts.slice(1);

        for (let j = 0; j < row.length && j < nodes.length; j++) {
            if (row[j] === '1') {
                g[fromNode].push(nodes[j]);
            }
        }
    }

    return g;
}

function generateDFSSteps(graph) {
    const visited = new Set();
    const stack = [];
    const nodes = Object.keys(graph);
    const steps = [];
    const nodeStates = {};

    nodes.forEach(node => nodeStates[node] = 'unvisited');

    steps.push({
        message: 'Starting DFS-based Topological Sort',
        states: { ...nodeStates },
        stack: [],
        result: []
    });

    function dfs(node, recStack, path) {
        if (recStack.has(node)) {
            throw new Error('Graph contains a cycle! Topological sort not possible.');
        }
        if (visited.has(node)) return;

        recStack.add(node);
        visited.add(node);
        nodeStates[node] = 'visiting';

        steps.push({
            message: `Visiting node ${node}`,
            states: { ...nodeStates },
            stack: [...stack],
            result: [],
            activeNode: node
        });

        for (let neighbor of graph[node]) {
            if (!visited.has(neighbor)) {
                steps.push({
                    message: `Exploring edge ${node} → ${neighbor}`,
                    states: { ...nodeStates },
                    stack: [...stack],
                    result: [],
                    activeEdge: [node, neighbor]
                });
                dfs(neighbor, recStack, [...path, neighbor]);
            } else {
                steps.push({
                    message: `Node ${neighbor} already visited, skipping`,
                    states: { ...nodeStates },
                    stack: [...stack],
                    result: [],
                    activeEdge: [node, neighbor]
                });
            }
        }

        recStack.delete(node);
        nodeStates[node] = 'processed';
        stack.push(node);

        steps.push({
            message: `Finished processing node ${node}, adding to stack`,
            states: { ...nodeStates },
            stack: [...stack],
            result: []
        });
    }

    for (let node of nodes) {
        if (!visited.has(node)) {
            steps.push({
                message: `Starting DFS from unvisited node ${node}`,
                states: { ...nodeStates },
                stack: [...stack],
                result: []
            });
            dfs(node, new Set(), [node]);
        }
    }

    const result = [...stack].reverse();
    steps.push({
        message: 'Reversing stack to get topological order',
        states: { ...nodeStates },
        stack: [],
        result: result,
        final: true
    });

    return steps;
}

function generateBFSSteps(graph) {
    const inDegree = {};
    const nodes = Object.keys(graph);
    const steps = [];
    const nodeStates = {};

    nodes.forEach(node => {
        inDegree[node] = 0;
        nodeStates[node] = 'unvisited';
    });

    for (let node in graph) {
        for (let neighbor of graph[node]) {
            inDegree[neighbor] = (inDegree[neighbor] || 0) + 1;
        }
    }

    steps.push({
        message: 'Starting BFS (Kahn\'s Algorithm) - Calculated in-degrees',
        states: { ...nodeStates },
        queue: [],
        result: [],
        inDegree: { ...inDegree }
    });

    const queue = [];
    for (let node in inDegree) {
        if (inDegree[node] === 0) {
            queue.push(node);
            nodeStates[node] = 'inStack';
        }
    }

    steps.push({
        message: `Added nodes with in-degree 0 to queue: [${queue.join(', ')}]`,
        states: { ...nodeStates },
        queue: [...queue],
        result: [],
        inDegree: { ...inDegree }
    });

    const result = [];
    while (queue.length > 0) {
        const node = queue.shift();
        nodeStates[node] = 'visiting';

        steps.push({
            message: `Processing node ${node} from queue`,
            states: { ...nodeStates },
            queue: [...queue],
            result: [...result],
            activeNode: node,
            inDegree: { ...inDegree }
        });

        result.push(node);
        nodeStates[node] = 'processed';

        for (let neighbor of graph[node]) {
            inDegree[neighbor]--;

            steps.push({
                message: `Reduced in-degree of ${neighbor} to ${inDegree[neighbor]}`,
                states: { ...nodeStates },
                queue: [...queue],
                result: [...result],
                activeEdge: [node, neighbor],
                inDegree: { ...inDegree }
            });

            if (inDegree[neighbor] === 0) {
                queue.push(neighbor);
                nodeStates[neighbor] = 'inStack';

                steps.push({
                    message: `Added ${neighbor} to queue (in-degree = 0)`,
                    states: { ...nodeStates },
                    queue: [...queue],
                    result: [...result],
                    inDegree: { ...inDegree }
                });
            }
        }
    }

    if (result.length !== nodes.length) {
        throw new Error('Graph contains a cycle! Topological sort not possible.');
    }

    steps.push({
        message: 'Completed! All nodes processed.',
        states: { ...nodeStates },
        queue: [],
        result: result,
        final: true
    });

    return steps;
}

function calculateNodePositions(nodes) {
    const positions = {};
    const numNodes = nodes.length;

    if (numNodes <= 5) {
        nodes.forEach((node, idx) => {
            positions[node] = {
                x: (idx + 1) * (canvas.width / (numNodes + 1)),
                y: canvas.height / 2
            };
        });
    } else {
        const cols = Math.ceil(Math.sqrt(numNodes));
        const rows = Math.ceil(numNodes / cols);
        const xSpacing = canvas.width / (cols + 1);
        const ySpacing = canvas.height / (rows + 1);

        nodes.forEach((node, idx) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            positions[node] = {
                x: (col + 1) * xSpacing,
                y: (row + 1) * ySpacing
            };
        });
    }

    return positions;
}

function drawGraph(step) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const nodes = Object.keys(graph);
    const positions = calculateNodePositions(nodes);

    // Draw edges
    for (let node in graph) {
        for (let neighbor of graph[node]) {
            const from = positions[node];
            const to = positions[neighbor];

            const angle = Math.atan2(to.y - from.y, to.x - from.x);
            const startX = from.x + NODE_RADIUS * Math.cos(angle);
            const startY = from.y + NODE_RADIUS * Math.sin(angle);
            const endX = to.x - NODE_RADIUS * Math.cos(angle);
            const endY = to.y - NODE_RADIUS * Math.sin(angle);

            const isActive = step.activeEdge &&
                step.activeEdge[0] === node &&
                step.activeEdge[1] === neighbor;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = isActive ? COLORS.edgeActive : COLORS.edge;
            ctx.lineWidth = isActive ? 3 : 2;
            ctx.stroke();

            // Arrow
            const arrowSize = 10;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
                endX - arrowSize * Math.cos(angle - Math.PI / 6),
                endY - arrowSize * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                endX - arrowSize * Math.cos(angle + Math.PI / 6),
                endY - arrowSize * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fillStyle = isActive ? COLORS.edgeActive : COLORS.edge;
            ctx.fill();
        }
    }

    // Draw nodes
    for (let node in positions) {
        const pos = positions[node];
        const state = step.states[node];
        const isActive = step.activeNode === node;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = COLORS[state] || COLORS.unvisited;
        ctx.fill();
        ctx.strokeStyle = isActive ? '#dc3545' : '#333';
        ctx.lineWidth = isActive ? 4 : 2;
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node, pos.x, pos.y);
    }

    // Draw stack/queue info
    if (step.queue || step.stack) {
        const info = step.queue ?
            `Queue: [${step.queue.join(', ')}]` :
            `Stack: [${step.stack.join(', ')}]`;

        ctx.fillStyle = '#333';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(info, 10, 20);
    }

    // Draw result
    if (step.result && step.result.length > 0) {
        const resultText = `Result: [${step.result.join(' → ')}]`;
        ctx.fillStyle = '#28a745';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(resultText, 10, 45);
    }
}

function addLogEntry(step, index) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    if (index === currentStep) {
        entry.classList.add('active');
    }
    entry.innerHTML = `<span class="step-number">Step ${index + 1}:</span>${step.message}`;
    logContent.appendChild(entry);
    entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateLog() {
    logContent.innerHTML = '';
    animationSteps.forEach((step, idx) => {
        if (idx <= currentStep) {
            addLogEntry(step, idx);
        }
    });
}

function startVisualization() {
    const input = document.getElementById('graphInput').value;
    const resultDiv = document.getElementById('result');

    try {
        graph = parseGraph(input);

        if (algorithm === 'dfs') {
            animationSteps = generateDFSSteps(graph);
        } else {
            animationSteps = generateBFSSteps(graph);
        }

        currentStep = 0;
        isPaused = false;
        logContent.innerHTML = '';
        resultDiv.innerHTML = '';

        drawGraph(animationSteps[0]);
        updateLog();

        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('pauseBtn').textContent = 'Pause';
        document.getElementById('nextBtn').disabled = false;

        isAnimating = true;
        autoPlay();

    } catch (error) {
        resultDiv.innerHTML = `
                    <div class="result error">
                        <h3>❌ Error</h3>
                        <div>${error.message}</div>
                    </div>
                `;
    }
}

function nextStep() {
    if (currentStep < animationSteps.length - 1) {
        currentStep++;
        drawGraph(animationSteps[currentStep]);
        updateLog();

        if (animationSteps[currentStep].final) {
            showFinalResult();
            document.getElementById('nextBtn').disabled = true;
            document.getElementById('pauseBtn').disabled = true;
            isAnimating = false;
            isPaused = false;
            if (animationTimer) {
                clearTimeout(animationTimer);
            }
        }
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
    isPaused = !isPaused;
    const pauseBtn = document.getElementById('pauseBtn');
    
    if (isPaused) {
        pauseBtn.textContent = 'Resume';
        if (animationTimer) {
            clearTimeout(animationTimer);
        }
    } else {
        pauseBtn.textContent = 'Pause';
        autoPlay();
    }
}

function showFinalResult() {
    const step = animationSteps[currentStep];
    const resultDiv = document.getElementById('result');

    resultDiv.innerHTML = `
                <div class="result">
                    <h3>✅ Final Topological Order (${algorithm.toUpperCase()})</h3>
                    <div class="result-order">${step.result.join(' → ')}</div>
                </div>
            `;
}

function resetVisualization() {
    if (animationTimer) {
        clearTimeout(animationTimer);
    }
    isAnimating = false;
    isPaused = false;
    currentStep = 0;

    if (animationSteps.length > 0) {
        drawGraph(animationSteps[0]);
        updateLog();
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('pauseBtn').textContent = 'Pause';
    document.getElementById('nextBtn').disabled = true;
    document.getElementById('result').innerHTML = '';
}

function clearGraph() {
    if (animationTimer) {
        clearTimeout(animationTimer);
    }
    isAnimating = false;
    isPaused = false;
    document.getElementById('graphInput').value = '';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    logContent.innerHTML = '';
    document.getElementById('result').innerHTML = '';
    graph = {};
    animationSteps = [];
    currentStep = 0;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('pauseBtn').textContent = 'Pause';
    document.getElementById('nextBtn').disabled = true;
}