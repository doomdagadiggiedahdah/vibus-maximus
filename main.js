'use strict';

var obsidian = require('obsidian');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

// Define the view type for our visualization
const VIEW_TYPE_TSNE = "tsne-visualization";
const DEFAULT_SETTINGS = {
    perplexity: 30,
    iterations: 1000,
    epsilon: 10
};
// Custom view for t-SNE visualization
class TSNEView extends obsidian.ItemView {
    constructor(leaf) {
        super(leaf);
    }
    getViewType() {
        return VIEW_TYPE_TSNE;
    }
    getDisplayText() {
        return "t-SNE Visualization";
    }
    getIcon() {
        return "graph";
    }
    // Set onDrop handler to prevent error
    onDrop(event) {
        // Not implemented
    }
    // Set onPaneMenu handler to prevent error
    onPaneMenu(menu, source) {
        // Not implemented
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            const container = this.contentEl;
            container.empty();
            // Add header
            container.createEl("div", { cls: "tsne-header" }, (header) => {
                header.createEl("h2", { text: "t-SNE Note Visualization" });
                // Add action buttons
                const actionBar = header.createEl("div", { cls: "tsne-actions" });
                const runButton = actionBar.createEl("button", { text: "Run Analysis", cls: "mod-cta" });
                runButton.addEventListener("click", () => {
                    // Get the plugin instance and run t-SNE
                    const plugin = this.app.plugins.plugins["vibe-boi"];
                    plugin.runTSNE();
                });
                const selectFolderButton = actionBar.createEl("button", { text: "Select Folder" });
                selectFolderButton.addEventListener("click", () => {
                    // TODO: Implement folder selection
                    new obsidian.Notice("Folder selection not implemented yet");
                });
            });
            // Add info text
            container.createEl("p", {
                text: "Run t-SNE analysis to visualize your notes as clusters based on content similarity.",
                cls: "tsne-info"
            });
            // Add visualization container
            container.createEl("div", {
                cls: "tsne-container",
                attr: { id: "tsne-container" }
            });
            // Add status text
            container.createEl("div", {
                cls: "tsne-status",
                attr: { id: "tsne-status" }
            }, (status) => {
                status.createEl("p", {
                    text: "Use the 'Run Analysis' button to start processing your notes.",
                    cls: "tsne-status-text"
                });
            });
            // Add simple CSS
            const style = document.createElement('style');
            style.textContent = `
      .tsne-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }
      .tsne-actions {
        display: flex;
        gap: 10px;
      }
      .tsne-info {
        margin-bottom: 1rem;
        opacity: 0.8;
      }
      .tsne-container {
        width: 100%;
        height: 600px;
        margin: 1rem 0;
        border-radius: 4px;
      }
      .tsne-status {
        margin-top: 1rem;
        padding: 0.5rem;
        border-radius: 4px;
        background-color: var(--background-secondary);
      }
      .tsne-status-text {
        margin: 0;
        font-size: 0.9rem;
        opacity: 0.8;
      }
    `;
            document.head.appendChild(style);
        });
    }
}
class VibeBoyPlugin extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadSettings();
            // Register the custom view
            this.registerView(VIEW_TYPE_TSNE, (leaf) => new TSNEView(leaf));
            // Add command to open the visualization
            this.addCommand({
                id: 'open-tsne-visualization',
                name: 'Open t-SNE Visualization',
                callback: () => {
                    this.activateView();
                }
            });
            // Add command to run t-SNE analysis
            this.addCommand({
                id: 'run-tsne-analysis',
                name: 'Run t-SNE Analysis',
                callback: () => {
                    this.runTSNE();
                }
            });
            // Add setting tab
            this.addSettingTab(new SettingTab(this.app, this));
        });
    }
    onunload() {
        // Clean up resources when the plugin is disabled
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
    activateView() {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_TSNE);
            if (existing.length) {
                this.app.workspace.revealLeaf(existing[0]);
                return;
            }
            const leaf = this.app.workspace.getLeaf(true);
            yield leaf.setViewState({
                type: VIEW_TYPE_TSNE,
                active: true,
            });
        });
    }
    runTSNE() {
        return __awaiter(this, void 0, void 0, function* () {
            // Process notes and run t-SNE analysis
            new obsidian.Notice('t-SNE analysis starting...');
            this.updateStatus('Gathering notes...');
            // Get all markdown files in the vault
            const files = this.app.vault.getMarkdownFiles();
            try {
                // Limit to a reasonable number of files for performance
                const maxFiles = 200;
                const selectedFiles = files.slice(0, maxFiles);
                this.updateStatus(`Processing ${selectedFiles.length} notes...`);
                // Prepare notes data for the Python server
                const notes = yield Promise.all(selectedFiles.map((file) => __awaiter(this, void 0, void 0, function* () {
                    const content = yield this.app.vault.read(file);
                    const stat = yield this.app.vault.adapter.stat(file.path);
                    const wordCount = content.split(/\s+/).length;
                    const readingTime = Math.ceil(wordCount / 200); // Avg reading speed ~200 words/minute
                    // Extract tags (looking for #tag format)
                    const tagRegex = /#([a-zA-Z0-9_-]+)/g;
                    const tags = [...content.matchAll(tagRegex)].map(match => match[1]);
                    // Get a content preview (first 150 chars)
                    const contentPreview = content.substring(0, 150).replace(/\n/g, ' ') +
                        (content.length > 150 ? '...' : '');
                    return {
                        path: file.path,
                        title: file.basename,
                        content: content,
                        mtime: stat.mtime,
                        ctime: stat.ctime,
                        wordCount: wordCount,
                        readingTime: readingTime,
                        tags: tags,
                        contentPreview: contentPreview
                    };
                })));
                this.updateStatus('Sending data to t-SNE server...');
                // Check if Python server is running
                try {
                    const healthCheck = yield fetch('http://127.0.0.1:1234/health', {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (!healthCheck.ok) {
                        throw new Error("Python server is not responding");
                    }
                }
                catch (error) {
                    throw new Error("Cannot connect to Python server. Make sure the server is running at http://127.0.0.1:1234. " +
                        "Run 'python src/python/tsne/server.py' to start it.");
                }
                // Send to Python server for processing
                this.updateStatus(`Running t-SNE analysis with perplexity=${this.settings.perplexity}, iterations=${this.settings.iterations}...`);
                const response = yield fetch('http://127.0.0.1:1234/process', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        notes: notes,
                        settings: {
                            perplexity: this.settings.perplexity,
                            iterations: this.settings.iterations,
                            learning_rate: this.settings.epsilon
                        }
                    })
                });
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                const result = yield response.json();
                if (result.error) {
                    throw new Error(`Server error: ${result.error}`);
                }
                this.updateStatus('Visualizing results...');
                // Debug - log the result structure to check metadata
                console.log('Visualizing result with metadata:', result);
                // Check if we have additional metadata
                if (result.points && result.points.length > 0) {
                    const samplePoint = result.points[0];
                    console.log('Sample point metadata:', {
                        hasWordCount: samplePoint.wordCount !== undefined,
                        hasMtime: samplePoint.mtime !== undefined,
                        hasCtime: samplePoint.ctime !== undefined,
                        hasTags: samplePoint.tags !== undefined,
                        hasContentPreview: samplePoint.contentPreview !== undefined,
                        hasDistanceToCenter: samplePoint.distanceToCenter !== undefined
                    });
                }
                // Visualize the result
                this.visualizeResult(result);
                this.updateStatus(`Visualization complete! Displaying ${result.points.length} notes.`);
                new obsidian.Notice('t-SNE analysis complete!');
            }
            catch (error) {
                console.error('Error running t-SNE analysis:', error);
                this.updateStatus(`Error: ${error.message}`);
                new obsidian.Notice(`t-SNE analysis failed: ${error.message}`);
            }
        });
    }
    updateStatus(message) {
        // Find the status element in the view and update it
        const statusElement = document.querySelector('#tsne-status .tsne-status-text');
        if (statusElement) {
            statusElement.textContent = message;
        }
        console.log(`Status: ${message}`);
    }
    visualizeResult(result) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get or create the visualization view
            let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_TSNE)[0];
            if (!leaf) {
                // Activate the view if not found
                yield this.activateView();
                // Try to get the leaf again
                leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_TSNE)[0];
                if (!leaf) {
                    console.error('Could not create visualization view');
                    return;
                }
            }
            // Access the view container
            const view = leaf.view;
            const container = view.contentEl.querySelector('#tsne-container');
            if (!container) {
                console.error('Container not found in view');
                return;
            }
            // Clear any existing content
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            // Create the visualizer
            const openCallback = (path) => {
                // Open the selected note
                const file = this.app.vault.getAbstractFileByPath(path);
                if (file instanceof obsidian.TFile) {
                    this.app.workspace.getLeaf().openFile(file);
                }
            };
            // Create and use the visualizer directly
            const visualizer = new TSNEVisualizer(container, openCallback);
            visualizer.setData(result);
        });
    }
}
class TSNEVisualizer {
    constructor(container, openCallback) {
        this.result = null;
        this.width = 800;
        this.height = 600;
        this.pointRadius = 10;
        this.mouseX = 0;
        this.mouseY = 0;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.hoveredPoint = null;
        this.container = container;
        this.openCallback = openCallback;
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.classList.add('tsne-canvas');
        this.canvas.style.border = '1px solid var(--background-modifier-border)';
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not create canvas context');
        }
        this.ctx = context;
        // Clear the container first
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
        // Add canvas to container
        this.container.appendChild(this.canvas);
        // Add event listeners
        this.addEventListeners();
    }
    addEventListeners() {
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
    }
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
        if (this.isDragging) {
            const dx = this.mouseX - this.lastX;
            const dy = this.mouseY - this.lastY;
            this.offsetX += dx;
            this.offsetY += dy;
            this.lastX = this.mouseX;
            this.lastY = this.mouseY;
            this.draw();
        }
        else {
            this.updateHoveredPoint();
            this.draw();
        }
    }
    handleClick(e) {
        if (this.hoveredPoint) {
            this.openCallback(this.hoveredPoint.path);
        }
    }
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.scale *= delta;
        // Limit zoom
        this.scale = Math.max(0.1, Math.min(5, this.scale));
        this.draw();
    }
    handleMouseDown(e) {
        this.isDragging = true;
        this.lastX = this.mouseX;
        this.lastY = this.mouseY;
        this.canvas.style.cursor = 'grabbing';
    }
    handleMouseUp(e) {
        this.isDragging = false;
        this.canvas.style.cursor = this.hoveredPoint ? 'pointer' : 'default';
    }
    updateHoveredPoint() {
        if (!this.result)
            return;
        this.hoveredPoint = null;
        for (const point of this.result.points) {
            const [screenX, screenY] = this.worldToScreen(point.x, point.y);
            const distance = Math.sqrt(Math.pow(screenX - this.mouseX, 2) +
                Math.pow(screenY - this.mouseY, 2));
            if (distance <= this.pointRadius) {
                this.hoveredPoint = point;
                this.canvas.style.cursor = 'pointer';
                return;
            }
        }
        this.canvas.style.cursor = this.isDragging ? 'grabbing' : 'default';
    }
    // Converts world space (t-SNE) coordinates to screen coordinates
    worldToScreen(x, y) {
        // Normalize to center of screen
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        // Apply scale and offset
        const screenX = x * this.scale * 100 + centerX + this.offsetX;
        const screenY = y * this.scale * 100 + centerY + this.offsetY;
        return [screenX, screenY];
    }
    setData(result) {
        this.result = result;
        this.resetView();
        this.draw();
    }
    resetView() {
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
    }
    draw() {
        if (!this.result)
            return;
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        // Draw background grid
        this.drawGrid();
        // Find clusters using a simple distance metric
        const clusters = this.findClusters();
        // Draw clusters first (underneath points)
        this.drawClusters(clusters);
        // Draw points
        for (const point of this.result.points) {
            this.drawPoint(point);
        }
        // Draw tooltip for hovered point
        if (this.hoveredPoint) {
            this.drawTooltip();
        }
    }
    drawGrid() {
        const gridSize = 50 * this.scale;
        this.ctx.strokeStyle = 'rgba(var(--background-modifier-border-rgb), 0.3)';
        this.ctx.lineWidth = 1;
        // Vertical lines
        for (let x = this.offsetX % gridSize; x < this.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        // Horizontal lines
        for (let y = this.offsetY % gridSize; y < this.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }
    findClusters() {
        if (!this.result)
            return [];
        // Simple clustering based on distance
        const points = this.result.points;
        const clusters = [];
        const visited = new Set();
        const distanceThreshold = 0.2; // Adjust this threshold as needed
        for (let i = 0; i < points.length; i++) {
            if (visited.has(i))
                continue;
            const cluster = [points[i]];
            visited.add(i);
            for (let j = 0; j < points.length; j++) {
                if (i === j || visited.has(j))
                    continue;
                const distance = Math.sqrt(Math.pow(points[i].x - points[j].x, 2) +
                    Math.pow(points[i].y - points[j].y, 2));
                if (distance < distanceThreshold) {
                    cluster.push(points[j]);
                    visited.add(j);
                }
            }
            if (cluster.length > 1) {
                clusters.push(cluster);
            }
        }
        return clusters;
    }
    drawClusters(clusters) {
        // Skip if no result data
        if (!this.result)
            return;
        // Color palette for clusters (excluding noise points)
        const colors = [
            { fill: 'rgba(255, 99, 132, 0.1)', stroke: 'rgba(255, 99, 132, 0.5)' },
            { fill: 'rgba(54, 162, 235, 0.1)', stroke: 'rgba(54, 162, 235, 0.5)' },
            { fill: 'rgba(255, 206, 86, 0.1)', stroke: 'rgba(255, 206, 86, 0.5)' },
            { fill: 'rgba(75, 192, 192, 0.1)', stroke: 'rgba(75, 192, 192, 0.5)' },
            { fill: 'rgba(153, 102, 255, 0.1)', stroke: 'rgba(153, 102, 255, 0.5)' },
            { fill: 'rgba(255, 159, 64, 0.1)', stroke: 'rgba(255, 159, 64, 0.5)' },
            { fill: 'rgba(199, 199, 199, 0.1)', stroke: 'rgba(199, 199, 199, 0.5)' },
        ];
        // Group points by cluster ID from the server response
        const clusterGroups = {};
        for (const point of this.result.points) {
            if (point.cluster === -1)
                continue; // Skip noise points
            if (!clusterGroups[point.cluster]) {
                clusterGroups[point.cluster] = [];
            }
            clusterGroups[point.cluster].push(point);
        }
        // Draw each cluster
        Object.entries(clusterGroups).forEach(([clusterId, points], index) => {
            // Find the centroid and bounds of the cluster
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            let sumX = 0, sumY = 0;
            for (const point of points) {
                const [screenX, screenY] = this.worldToScreen(point.x, point.y);
                minX = Math.min(minX, screenX);
                minY = Math.min(minY, screenY);
                maxX = Math.max(maxX, screenX);
                maxY = Math.max(maxY, screenY);
                sumX += screenX;
                sumY += screenY;
            }
            // Calculate centroid
            const centerX = sumX / points.length;
            sumY / points.length;
            // Add padding
            const padding = 20;
            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;
            // Use color from palette (cycle if more clusters than colors)
            const colorIndex = parseInt(clusterId) % colors.length;
            const color = colors[colorIndex];
            // Draw a rounded rectangle around the cluster
            this.ctx.fillStyle = color.fill;
            this.ctx.strokeStyle = color.stroke;
            this.ctx.lineWidth = 1;
            this.roundRect(minX, minY, maxX - minX, maxY - minY, 10);
            this.ctx.fill();
            this.ctx.stroke();
            // Draw cluster label with top terms if available
            if (this.result.cluster_terms && this.result.cluster_terms[clusterId]) {
                const terms = this.result.cluster_terms[clusterId]
                    .slice(0, 3) // Take top 3 terms
                    .map(t => t.term)
                    .join(', ');
                // Draw a label with cluster ID and top terms
                this.ctx.fillStyle = 'var(--text-normal)';
                this.ctx.font = 'bold 12px var(--font-text)';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`Cluster ${clusterId}: ${terms}`, centerX, minY - 5);
            }
        });
    }
    roundRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.arcTo(x + width, y, x + width, y + radius, radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.arcTo(x, y + height, x, y + height - radius, radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.arcTo(x, y, x + radius, y, radius);
        this.ctx.closePath();
    }
    drawPoint(point) {
        const [x, y] = this.worldToScreen(point.x, point.y);
        // Color palette for clusters
        const clusterColors = [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(199, 199, 199, 1)', // grey
        ];
        // Draw circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.pointRadius, 0, Math.PI * 2);
        // Determine color based on hover state and cluster
        if (this.hoveredPoint === point) {
            // Hovered points are always highlighted in the accent color
            this.ctx.fillStyle = 'var(--interactive-accent)';
        }
        else if (point.cluster === -1) {
            // Noise points (not in a cluster) are grey
            this.ctx.fillStyle = 'var(--text-muted)';
        }
        else {
            // Points in clusters use the cluster color palette
            const colorIndex = point.cluster % clusterColors.length;
            this.ctx.fillStyle = clusterColors[colorIndex];
        }
        this.ctx.fill();
        // Add border to points
        this.ctx.strokeStyle = 'var(--background-primary)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        // Draw title if not hovered (hovered shows in tooltip)
        if (this.hoveredPoint !== point) {
            this.ctx.fillStyle = 'var(--text-normal)';
            this.ctx.font = '12px var(--font-text)';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(point.title, x, y - this.pointRadius - 5);
        }
    }
    drawTooltip() {
        if (!this.hoveredPoint || !this.result)
            return;
        const [x, y] = this.worldToScreen(this.hoveredPoint.x, this.hoveredPoint.y);
        const point = this.hoveredPoint;
        // Tooltip content
        const title = point.title;
        const path = point.path;
        const terms = point.top_terms.join(', ');
        // Format dates if available
        const formatDate = (timestamp) => {
            if (!timestamp)
                return 'Unknown';
            const date = new Date(timestamp);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };
        // Get metadata
        const modified = formatDate(point.mtime);
        const created = formatDate(point.ctime);
        const wordCount = point.wordCount ? `${point.wordCount} words` : 'Unknown';
        const readingTime = point.readingTime ? `~${point.readingTime} min read` : '';
        // Format tags
        const tags = point.tags && point.tags.length > 0
            ? point.tags.map(tag => `#${tag}`).join(' ')
            : 'No tags';
        // Format content preview
        const preview = point.contentPreview || 'No preview available';
        // Get distance to center
        const distanceInfo = point.distanceToCenter !== undefined && point.cluster !== -1
            ? `Distance to center: ${point.distanceToCenter.toFixed(2)}`
            : '';
        // Get cluster information
        let clusterInfo = 'Not clustered';
        if (point.cluster !== -1) {
            const clusterId = point.cluster;
            // Get cluster terms if available
            let clusterTerms = '';
            if (this.result.cluster_terms && this.result.cluster_terms[clusterId]) {
                clusterTerms = this.result.cluster_terms[clusterId]
                    .slice(0, 3) // Take top 3 terms
                    .map(t => t.term)
                    .join(', ');
            }
            clusterInfo = `Cluster ${clusterId}: ${clusterTerms}`;
        }
        // Define all tooltip sections
        const sections = [
            { label: 'Title', text: title, font: 'bold 14px var(--font-text)' },
            { label: 'Path', text: path },
            { label: 'Keywords', text: terms },
            { label: 'Cluster', text: clusterInfo },
            { label: 'Tags', text: tags },
            { label: 'Modified', text: modified },
            { label: 'Created', text: created },
            { label: 'Stats', text: `${wordCount} ${readingTime}` },
            { label: 'Preview', text: preview, optional: true },
            { label: '', text: distanceInfo, skipIfEmpty: true }
        ];
        // Calculate tooltip dimensions
        this.ctx.font = 'bold 14px var(--font-text)';
        let tooltipWidth = this.ctx.measureText(title).width;
        this.ctx.font = '12px var(--font-text)';
        sections.forEach(section => {
            if (!section.skipIfEmpty || section.text) {
                const width = this.ctx.measureText(section.label ? `${section.label}: ${section.text}` : section.text).width;
                tooltipWidth = Math.max(tooltipWidth, width);
            }
        });
        tooltipWidth += 20; // Add padding
        // Calculate tooltip height (more sections now)
        const lineHeight = 20;
        // Count how many sections will be visible
        const visibleSections = sections.filter(s => !s.optional && (!s.skipIfEmpty || s.text)).length;
        console.log(`Visible sections: ${visibleSections}`);
        // Add some extra padding to ensure all text fits
        const tooltipHeight = (visibleSections + 1) * lineHeight + 20;
        // Position tooltip
        const tooltipX = Math.min(x + 10, this.width - tooltipWidth - 10);
        const tooltipY = Math.min(y - 10, this.height - tooltipHeight - 10);
        // Draw tooltip background with solid colors instead of CSS variables
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'; // Nearly opaque white background
        this.ctx.strokeStyle = '#666666'; // Medium gray border
        this.ctx.lineWidth = 1;
        this.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 5);
        this.ctx.fill();
        this.ctx.stroke();
        // Add a debug rectangle to ensure the tooltip area is rendered
        this.ctx.strokeStyle = '#FF0000'; // Red outline for debugging
        this.ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        // Draw tooltip content - use a solid color instead of CSS variable
        this.ctx.fillStyle = '#000000'; // Black text should be visible on any background
        this.ctx.textAlign = 'left';
        // Debug the tooltip dimensions
        console.log(`Drawing tooltip: ${tooltipWidth}x${tooltipHeight} at ${tooltipX},${tooltipY}`);
        // Draw each section
        let currentY = tooltipY + 20;
        sections.forEach(section => {
            if (section.optional || (section.skipIfEmpty && !section.text))
                return;
            this.ctx.font = section.font || '12px sans-serif'; // Use sans-serif instead of CSS variable
            const text = section.label
                ? `${section.label}: ${section.text}`
                : section.text;
            // Debug each line of text
            console.log(`Drawing text at ${tooltipX + 10},${currentY}: ${text}`);
            this.ctx.fillText(text, tooltipX + 10, currentY);
            currentY += lineHeight;
        });
    }
}
class SettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Vibe Boi - t-SNE Settings' });
        new obsidian.Setting(containerEl)
            .setName('Perplexity')
            .setDesc('Controls the balance between local and global aspects of the data (recommended: 5-50)')
            .addSlider(slider => slider
            .setLimits(5, 100, 5)
            .setValue(this.plugin.settings.perplexity)
            .setDynamicTooltip()
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.perplexity = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName('Iterations')
            .setDesc('Number of iterations to run the algorithm')
            .addSlider(slider => slider
            .setLimits(250, 2000, 250)
            .setValue(this.plugin.settings.iterations)
            .setDynamicTooltip()
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.iterations = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName('Epsilon (learning rate)')
            .setDesc('Controls the speed of optimization')
            .addSlider(slider => slider
            .setLimits(1, 100, 1)
            .setValue(this.plugin.settings.epsilon)
            .setDynamicTooltip()
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.epsilon = value;
            yield this.plugin.saveSettings();
        })));
    }
}

module.exports = VibeBoyPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9vYnNpZGlhbi1wbHVnaW4vbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuLyogZ2xvYmFsIFJlZmxlY3QsIFByb21pc2UsIFN1cHByZXNzZWRFcnJvciwgU3ltYm9sLCBJdGVyYXRvciAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19lc0RlY29yYXRlKGN0b3IsIGRlc2NyaXB0b3JJbiwgZGVjb3JhdG9ycywgY29udGV4dEluLCBpbml0aWFsaXplcnMsIGV4dHJhSW5pdGlhbGl6ZXJzKSB7XHJcbiAgICBmdW5jdGlvbiBhY2NlcHQoZikgeyBpZiAoZiAhPT0gdm9pZCAwICYmIHR5cGVvZiBmICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGdW5jdGlvbiBleHBlY3RlZFwiKTsgcmV0dXJuIGY7IH1cclxuICAgIHZhciBraW5kID0gY29udGV4dEluLmtpbmQsIGtleSA9IGtpbmQgPT09IFwiZ2V0dGVyXCIgPyBcImdldFwiIDoga2luZCA9PT0gXCJzZXR0ZXJcIiA/IFwic2V0XCIgOiBcInZhbHVlXCI7XHJcbiAgICB2YXIgdGFyZ2V0ID0gIWRlc2NyaXB0b3JJbiAmJiBjdG9yID8gY29udGV4dEluW1wic3RhdGljXCJdID8gY3RvciA6IGN0b3IucHJvdG90eXBlIDogbnVsbDtcclxuICAgIHZhciBkZXNjcmlwdG9yID0gZGVzY3JpcHRvckluIHx8ICh0YXJnZXQgPyBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgY29udGV4dEluLm5hbWUpIDoge30pO1xyXG4gICAgdmFyIF8sIGRvbmUgPSBmYWxzZTtcclxuICAgIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgICAgdmFyIGNvbnRleHQgPSB7fTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbikgY29udGV4dFtwXSA9IHAgPT09IFwiYWNjZXNzXCIgPyB7fSA6IGNvbnRleHRJbltwXTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbi5hY2Nlc3MpIGNvbnRleHQuYWNjZXNzW3BdID0gY29udGV4dEluLmFjY2Vzc1twXTtcclxuICAgICAgICBjb250ZXh0LmFkZEluaXRpYWxpemVyID0gZnVuY3Rpb24gKGYpIHsgaWYgKGRvbmUpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgYWRkIGluaXRpYWxpemVycyBhZnRlciBkZWNvcmF0aW9uIGhhcyBjb21wbGV0ZWRcIik7IGV4dHJhSW5pdGlhbGl6ZXJzLnB1c2goYWNjZXB0KGYgfHwgbnVsbCkpOyB9O1xyXG4gICAgICAgIHZhciByZXN1bHQgPSAoMCwgZGVjb3JhdG9yc1tpXSkoa2luZCA9PT0gXCJhY2Nlc3NvclwiID8geyBnZXQ6IGRlc2NyaXB0b3IuZ2V0LCBzZXQ6IGRlc2NyaXB0b3Iuc2V0IH0gOiBkZXNjcmlwdG9yW2tleV0sIGNvbnRleHQpO1xyXG4gICAgICAgIGlmIChraW5kID09PSBcImFjY2Vzc29yXCIpIHtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gdm9pZCAwKSBjb250aW51ZTtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCB8fCB0eXBlb2YgcmVzdWx0ICE9PSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkXCIpO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuZ2V0KSkgZGVzY3JpcHRvci5nZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuc2V0KSkgZGVzY3JpcHRvci5zZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuaW5pdCkpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChfID0gYWNjZXB0KHJlc3VsdCkpIHtcclxuICAgICAgICAgICAgaWYgKGtpbmQgPT09IFwiZmllbGRcIikgaW5pdGlhbGl6ZXJzLnVuc2hpZnQoXyk7XHJcbiAgICAgICAgICAgIGVsc2UgZGVzY3JpcHRvcltrZXldID0gXztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAodGFyZ2V0KSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBjb250ZXh0SW4ubmFtZSwgZGVzY3JpcHRvcik7XHJcbiAgICBkb25lID0gdHJ1ZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3J1bkluaXRpYWxpemVycyh0aGlzQXJnLCBpbml0aWFsaXplcnMsIHZhbHVlKSB7XHJcbiAgICB2YXIgdXNlVmFsdWUgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5pdGlhbGl6ZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFsdWUgPSB1c2VWYWx1ZSA/IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcsIHZhbHVlKSA6IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHVzZVZhbHVlID8gdmFsdWUgOiB2b2lkIDA7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wcm9wS2V5KHgpIHtcclxuICAgIHJldHVybiB0eXBlb2YgeCA9PT0gXCJzeW1ib2xcIiA/IHggOiBcIlwiLmNvbmNhdCh4KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NldEZ1bmN0aW9uTmFtZShmLCBuYW1lLCBwcmVmaXgpIHtcclxuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gXCJzeW1ib2xcIikgbmFtZSA9IG5hbWUuZGVzY3JpcHRpb24gPyBcIltcIi5jb25jYXQobmFtZS5kZXNjcmlwdGlvbiwgXCJdXCIpIDogXCJcIjtcclxuICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkoZiwgXCJuYW1lXCIsIHsgY29uZmlndXJhYmxlOiB0cnVlLCB2YWx1ZTogcHJlZml4ID8gXCJcIi5jb25jYXQocHJlZml4LCBcIiBcIiwgbmFtZSkgOiBuYW1lIH0pO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpIHtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5tZXRhZGF0YSA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gUmVmbGVjdC5tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0ZXIodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19nZW5lcmF0b3IodGhpc0FyZywgYm9keSkge1xyXG4gICAgdmFyIF8gPSB7IGxhYmVsOiAwLCBzZW50OiBmdW5jdGlvbigpIHsgaWYgKHRbMF0gJiAxKSB0aHJvdyB0WzFdOyByZXR1cm4gdFsxXTsgfSwgdHJ5czogW10sIG9wczogW10gfSwgZiwgeSwgdCwgZyA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBJdGVyYXRvciA9PT0gXCJmdW5jdGlvblwiID8gSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSk7XHJcbiAgICByZXR1cm4gZy5uZXh0ID0gdmVyYigwKSwgZ1tcInRocm93XCJdID0gdmVyYigxKSwgZ1tcInJldHVyblwiXSA9IHZlcmIoMiksIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoZyAmJiAoZyA9IDAsIG9wWzBdICYmIChfID0gMCkpLCBfKSB0cnkge1xyXG4gICAgICAgICAgICBpZiAoZiA9IDEsIHkgJiYgKHQgPSBvcFswXSAmIDIgPyB5W1wicmV0dXJuXCJdIDogb3BbMF0gPyB5W1widGhyb3dcIl0gfHwgKCh0ID0geVtcInJldHVyblwiXSkgJiYgdC5jYWxsKHkpLCAwKSA6IHkubmV4dCkgJiYgISh0ID0gdC5jYWxsKHksIG9wWzFdKSkuZG9uZSkgcmV0dXJuIHQ7XHJcbiAgICAgICAgICAgIGlmICh5ID0gMCwgdCkgb3AgPSBbb3BbMF0gJiAyLCB0LnZhbHVlXTtcclxuICAgICAgICAgICAgc3dpdGNoIChvcFswXSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAwOiBjYXNlIDE6IHQgPSBvcDsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDQ6IF8ubGFiZWwrKzsgcmV0dXJuIHsgdmFsdWU6IG9wWzFdLCBkb25lOiBmYWxzZSB9O1xyXG4gICAgICAgICAgICAgICAgY2FzZSA1OiBfLmxhYmVsKys7IHkgPSBvcFsxXTsgb3AgPSBbMF07IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA3OiBvcCA9IF8ub3BzLnBvcCgpOyBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBpZiAoISh0ID0gXy50cnlzLCB0ID0gdC5sZW5ndGggPiAwICYmIHRbdC5sZW5ndGggLSAxXSkgJiYgKG9wWzBdID09PSA2IHx8IG9wWzBdID09PSAyKSkgeyBfID0gMDsgY29udGludWU7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDMgJiYgKCF0IHx8IChvcFsxXSA+IHRbMF0gJiYgb3BbMV0gPCB0WzNdKSkpIHsgXy5sYWJlbCA9IG9wWzFdOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gNiAmJiBfLmxhYmVsIDwgdFsxXSkgeyBfLmxhYmVsID0gdFsxXTsgdCA9IG9wOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ICYmIF8ubGFiZWwgPCB0WzJdKSB7IF8ubGFiZWwgPSB0WzJdOyBfLm9wcy5wdXNoKG9wKTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodFsyXSkgXy5vcHMucG9wKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvcCA9IGJvZHkuY2FsbCh0aGlzQXJnLCBfKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7IG9wID0gWzYsIGVdOyB5ID0gMDsgfSBmaW5hbGx5IHsgZiA9IHQgPSAwOyB9XHJcbiAgICAgICAgaWYgKG9wWzBdICYgNSkgdGhyb3cgb3BbMV07IHJldHVybiB7IHZhbHVlOiBvcFswXSA/IG9wWzFdIDogdm9pZCAwLCBkb25lOiB0cnVlIH07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19jcmVhdGVCaW5kaW5nID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihtLCBrKTtcclxuICAgIGlmICghZGVzYyB8fCAoXCJnZXRcIiBpbiBkZXNjID8gIW0uX19lc01vZHVsZSA6IGRlc2Mud3JpdGFibGUgfHwgZGVzYy5jb25maWd1cmFibGUpKSB7XHJcbiAgICAgICAgZGVzYyA9IHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfTtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBrMiwgZGVzYyk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tLCBwYWNrKSB7XHJcbiAgICBpZiAocGFjayB8fCBhcmd1bWVudHMubGVuZ3RoID09PSAyKSBmb3IgKHZhciBpID0gMCwgbCA9IGZyb20ubGVuZ3RoLCBhcjsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmIChhciB8fCAhKGkgaW4gZnJvbSkpIHtcclxuICAgICAgICAgICAgaWYgKCFhcikgYXIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tLCAwLCBpKTtcclxuICAgICAgICAgICAgYXJbaV0gPSBmcm9tW2ldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0by5jb25jYXQoYXIgfHwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSkpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdCh2KSB7XHJcbiAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIF9fYXdhaXQgPyAodGhpcy52ID0gdiwgdGhpcykgOiBuZXcgX19hd2FpdCh2KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNHZW5lcmF0b3IodGhpc0FyZywgX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIGcgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSksIGksIHEgPSBbXTtcclxuICAgIHJldHVybiBpID0gT2JqZWN0LmNyZWF0ZSgodHlwZW9mIEFzeW5jSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEFzeW5jSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSksIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiwgYXdhaXRSZXR1cm4pLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiBhd2FpdFJldHVybihmKSB7IHJldHVybiBmdW5jdGlvbiAodikgeyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZiwgcmVqZWN0KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlmIChnW25dKSB7IGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IGlmIChmKSBpW25dID0gZihpW25dKTsgfSB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogZmFsc2UgfSA6IGYgPyBmKHYpIDogdjsgfSA6IGY7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNWYWx1ZXMobykge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBtID0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sIGk7XHJcbiAgICByZXR1cm4gbSA/IG0uY2FsbChvKSA6IChvID0gdHlwZW9mIF9fdmFsdWVzID09PSBcImZ1bmN0aW9uXCIgPyBfX3ZhbHVlcyhvKSA6IG9bU3ltYm9sLml0ZXJhdG9yXSgpLCBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaSk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaVtuXSA9IG9bbl0gJiYgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgdiA9IG9bbl0odiksIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHYuZG9uZSwgdi52YWx1ZSk7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCBkLCB2KSB7IFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGZ1bmN0aW9uKHYpIHsgcmVzb2x2ZSh7IHZhbHVlOiB2LCBkb25lOiBkIH0pOyB9LCByZWplY3QpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdykge1xyXG4gICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkgeyBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29va2VkLCBcInJhd1wiLCB7IHZhbHVlOiByYXcgfSk7IH0gZWxzZSB7IGNvb2tlZC5yYXcgPSByYXc7IH1cclxuICAgIHJldHVybiBjb29rZWQ7XHJcbn07XHJcblxyXG52YXIgX19zZXRNb2R1bGVEZWZhdWx0ID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgXCJkZWZhdWx0XCIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgdmFsdWU6IHYgfSk7XHJcbn0pIDogZnVuY3Rpb24obywgdikge1xyXG4gICAgb1tcImRlZmF1bHRcIl0gPSB2O1xyXG59O1xyXG5cclxudmFyIG93bktleXMgPSBmdW5jdGlvbihvKSB7XHJcbiAgICBvd25LZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgfHwgZnVuY3Rpb24gKG8pIHtcclxuICAgICAgICB2YXIgYXIgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBrIGluIG8pIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgaykpIGFyW2FyLmxlbmd0aF0gPSBrO1xyXG4gICAgICAgIHJldHVybiBhcjtcclxuICAgIH07XHJcbiAgICByZXR1cm4gb3duS2V5cyhvKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrID0gb3duS2V5cyhtb2QpLCBpID0gMDsgaSA8IGsubGVuZ3RoOyBpKyspIGlmIChrW2ldICE9PSBcImRlZmF1bHRcIikgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrW2ldKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRJbihzdGF0ZSwgcmVjZWl2ZXIpIHtcclxuICAgIGlmIChyZWNlaXZlciA9PT0gbnVsbCB8fCAodHlwZW9mIHJlY2VpdmVyICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiByZWNlaXZlciAhPT0gXCJmdW5jdGlvblwiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgJ2luJyBvcGVyYXRvciBvbiBub24tb2JqZWN0XCIpO1xyXG4gICAgcmV0dXJuIHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgPT09IHN0YXRlIDogc3RhdGUuaGFzKHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlKGVudiwgdmFsdWUsIGFzeW5jKSB7XHJcbiAgICBpZiAodmFsdWUgIT09IG51bGwgJiYgdmFsdWUgIT09IHZvaWQgMCkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgZXhwZWN0ZWQuXCIpO1xyXG4gICAgICAgIHZhciBkaXNwb3NlLCBpbm5lcjtcclxuICAgICAgICBpZiAoYXN5bmMpIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuYXN5bmNEaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jRGlzcG9zZSBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICAgICAgICAgIGRpc3Bvc2UgPSB2YWx1ZVtTeW1ib2wuYXN5bmNEaXNwb3NlXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGRpc3Bvc2UgPT09IHZvaWQgMCkge1xyXG4gICAgICAgICAgICBpZiAoIVN5bWJvbC5kaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmRpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmRpc3Bvc2VdO1xyXG4gICAgICAgICAgICBpZiAoYXN5bmMpIGlubmVyID0gZGlzcG9zZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkaXNwb3NlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3Qgbm90IGRpc3Bvc2FibGUuXCIpO1xyXG4gICAgICAgIGlmIChpbm5lcikgZGlzcG9zZSA9IGZ1bmN0aW9uKCkgeyB0cnkgeyBpbm5lci5jYWxsKHRoaXMpOyB9IGNhdGNoIChlKSB7IHJldHVybiBQcm9taXNlLnJlamVjdChlKTsgfSB9O1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgdmFsdWU6IHZhbHVlLCBkaXNwb3NlOiBkaXNwb3NlLCBhc3luYzogYXN5bmMgfSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChhc3luYykge1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgYXN5bmM6IHRydWUgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcblxyXG59XHJcblxyXG52YXIgX1N1cHByZXNzZWRFcnJvciA9IHR5cGVvZiBTdXBwcmVzc2VkRXJyb3IgPT09IFwiZnVuY3Rpb25cIiA/IFN1cHByZXNzZWRFcnJvciA6IGZ1bmN0aW9uIChlcnJvciwgc3VwcHJlc3NlZCwgbWVzc2FnZSkge1xyXG4gICAgdmFyIGUgPSBuZXcgRXJyb3IobWVzc2FnZSk7XHJcbiAgICByZXR1cm4gZS5uYW1lID0gXCJTdXBwcmVzc2VkRXJyb3JcIiwgZS5lcnJvciA9IGVycm9yLCBlLnN1cHByZXNzZWQgPSBzdXBwcmVzc2VkLCBlO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGlzcG9zZVJlc291cmNlcyhlbnYpIHtcclxuICAgIGZ1bmN0aW9uIGZhaWwoZSkge1xyXG4gICAgICAgIGVudi5lcnJvciA9IGVudi5oYXNFcnJvciA/IG5ldyBfU3VwcHJlc3NlZEVycm9yKGUsIGVudi5lcnJvciwgXCJBbiBlcnJvciB3YXMgc3VwcHJlc3NlZCBkdXJpbmcgZGlzcG9zYWwuXCIpIDogZTtcclxuICAgICAgICBlbnYuaGFzRXJyb3IgPSB0cnVlO1xyXG4gICAgfVxyXG4gICAgdmFyIHIsIHMgPSAwO1xyXG4gICAgZnVuY3Rpb24gbmV4dCgpIHtcclxuICAgICAgICB3aGlsZSAociA9IGVudi5zdGFjay5wb3AoKSkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFyLmFzeW5jICYmIHMgPT09IDEpIHJldHVybiBzID0gMCwgZW52LnN0YWNrLnB1c2gociksIFByb21pc2UucmVzb2x2ZSgpLnRoZW4obmV4dCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoci5kaXNwb3NlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHIuZGlzcG9zZS5jYWxsKHIudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChyLmFzeW5jKSByZXR1cm4gcyB8PSAyLCBQcm9taXNlLnJlc29sdmUocmVzdWx0KS50aGVuKG5leHQsIGZ1bmN0aW9uKGUpIHsgZmFpbChlKTsgcmV0dXJuIG5leHQoKTsgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHMgfD0gMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgZmFpbChlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocyA9PT0gMSkgcmV0dXJuIGVudi5oYXNFcnJvciA/IFByb21pc2UucmVqZWN0KGVudi5lcnJvcikgOiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgICBpZiAoZW52Lmhhc0Vycm9yKSB0aHJvdyBlbnYuZXJyb3I7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV4dCgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24ocGF0aCwgcHJlc2VydmVKc3gpIHtcclxuICAgIGlmICh0eXBlb2YgcGF0aCA9PT0gXCJzdHJpbmdcIiAmJiAvXlxcLlxcLj9cXC8vLnRlc3QocGF0aCkpIHtcclxuICAgICAgICByZXR1cm4gcGF0aC5yZXBsYWNlKC9cXC4odHN4KSR8KCg/OlxcLmQpPykoKD86XFwuW14uL10rPyk/KVxcLihbY21dPyl0cyQvaSwgZnVuY3Rpb24gKG0sIHRzeCwgZCwgZXh0LCBjbSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHN4ID8gcHJlc2VydmVKc3ggPyBcIi5qc3hcIiA6IFwiLmpzXCIgOiBkICYmICghZXh0IHx8ICFjbSkgPyBtIDogKGQgKyBleHQgKyBcIi5cIiArIGNtLnRvTG93ZXJDYXNlKCkgKyBcImpzXCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBhdGg7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIF9fZXh0ZW5kczogX19leHRlbmRzLFxyXG4gICAgX19hc3NpZ246IF9fYXNzaWduLFxyXG4gICAgX19yZXN0OiBfX3Jlc3QsXHJcbiAgICBfX2RlY29yYXRlOiBfX2RlY29yYXRlLFxyXG4gICAgX19wYXJhbTogX19wYXJhbSxcclxuICAgIF9fZXNEZWNvcmF0ZTogX19lc0RlY29yYXRlLFxyXG4gICAgX19ydW5Jbml0aWFsaXplcnM6IF9fcnVuSW5pdGlhbGl6ZXJzLFxyXG4gICAgX19wcm9wS2V5OiBfX3Byb3BLZXksXHJcbiAgICBfX3NldEZ1bmN0aW9uTmFtZTogX19zZXRGdW5jdGlvbk5hbWUsXHJcbiAgICBfX21ldGFkYXRhOiBfX21ldGFkYXRhLFxyXG4gICAgX19hd2FpdGVyOiBfX2F3YWl0ZXIsXHJcbiAgICBfX2dlbmVyYXRvcjogX19nZW5lcmF0b3IsXHJcbiAgICBfX2NyZWF0ZUJpbmRpbmc6IF9fY3JlYXRlQmluZGluZyxcclxuICAgIF9fZXhwb3J0U3RhcjogX19leHBvcnRTdGFyLFxyXG4gICAgX192YWx1ZXM6IF9fdmFsdWVzLFxyXG4gICAgX19yZWFkOiBfX3JlYWQsXHJcbiAgICBfX3NwcmVhZDogX19zcHJlYWQsXHJcbiAgICBfX3NwcmVhZEFycmF5czogX19zcHJlYWRBcnJheXMsXHJcbiAgICBfX3NwcmVhZEFycmF5OiBfX3NwcmVhZEFycmF5LFxyXG4gICAgX19hd2FpdDogX19hd2FpdCxcclxuICAgIF9fYXN5bmNHZW5lcmF0b3I6IF9fYXN5bmNHZW5lcmF0b3IsXHJcbiAgICBfX2FzeW5jRGVsZWdhdG9yOiBfX2FzeW5jRGVsZWdhdG9yLFxyXG4gICAgX19hc3luY1ZhbHVlczogX19hc3luY1ZhbHVlcyxcclxuICAgIF9fbWFrZVRlbXBsYXRlT2JqZWN0OiBfX21ha2VUZW1wbGF0ZU9iamVjdCxcclxuICAgIF9faW1wb3J0U3RhcjogX19pbXBvcnRTdGFyLFxyXG4gICAgX19pbXBvcnREZWZhdWx0OiBfX2ltcG9ydERlZmF1bHQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0OiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldDogX19jbGFzc1ByaXZhdGVGaWVsZFNldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRJbjogX19jbGFzc1ByaXZhdGVGaWVsZEluLFxyXG4gICAgX19hZGREaXNwb3NhYmxlUmVzb3VyY2U6IF9fYWRkRGlzcG9zYWJsZVJlc291cmNlLFxyXG4gICAgX19kaXNwb3NlUmVzb3VyY2VzOiBfX2Rpc3Bvc2VSZXNvdXJjZXMsXHJcbiAgICBfX3Jld3JpdGVSZWxhdGl2ZUltcG9ydEV4dGVuc2lvbjogX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24sXHJcbn07XHJcbiIsImltcG9ydCB7IEFwcCwgSXRlbVZpZXcsIE1vZGFsLCBOb3RpY2UsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgVEZpbGUsIFdvcmtzcGFjZUxlYWYgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgKiBhcyBUU05FIGZyb20gJ3RzbmUtanMnO1xuXG4vLyBEZWZpbmUgdGhlIHZpZXcgdHlwZSBmb3Igb3VyIHZpc3VhbGl6YXRpb25cbmNvbnN0IFZJRVdfVFlQRV9UU05FID0gXCJ0c25lLXZpc3VhbGl6YXRpb25cIjtcblxuaW50ZXJmYWNlIFZpYmVCb3lTZXR0aW5ncyB7XG4gIHBlcnBsZXhpdHk6IG51bWJlcjtcbiAgaXRlcmF0aW9uczogbnVtYmVyO1xuICBlcHNpbG9uOiBudW1iZXI7XG59XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFZpYmVCb3lTZXR0aW5ncyA9IHtcbiAgcGVycGxleGl0eTogMzAsXG4gIGl0ZXJhdGlvbnM6IDEwMDAsXG4gIGVwc2lsb246IDEwXG59XG5cbi8vIEN1c3RvbSB2aWV3IGZvciB0LVNORSB2aXN1YWxpemF0aW9uXG5jbGFzcyBUU05FVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZikge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gVklFV19UWVBFX1RTTkU7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBcInQtU05FIFZpc3VhbGl6YXRpb25cIjtcbiAgfVxuXG4gIGdldEljb24oKTogc3RyaW5nIHtcbiAgICByZXR1cm4gXCJncmFwaFwiO1xuICB9XG5cbiAgLy8gU2V0IG9uRHJvcCBoYW5kbGVyIHRvIHByZXZlbnQgZXJyb3JcbiAgb25Ecm9wKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcbiAgICAvLyBOb3QgaW1wbGVtZW50ZWRcbiAgfVxuXG4gIC8vIFNldCBvblBhbmVNZW51IGhhbmRsZXIgdG8gcHJldmVudCBlcnJvclxuICBvblBhbmVNZW51KG1lbnU6IGFueSwgc291cmNlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAvLyBOb3QgaW1wbGVtZW50ZWRcbiAgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRlbnRFbDtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICBcbiAgICAvLyBBZGQgaGVhZGVyXG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInRzbmUtaGVhZGVyXCIgfSwgKGhlYWRlcikgPT4ge1xuICAgICAgaGVhZGVyLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcInQtU05FIE5vdGUgVmlzdWFsaXphdGlvblwiIH0pO1xuICAgICAgXG4gICAgICAvLyBBZGQgYWN0aW9uIGJ1dHRvbnNcbiAgICAgIGNvbnN0IGFjdGlvbkJhciA9IGhlYWRlci5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJ0c25lLWFjdGlvbnNcIiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgcnVuQnV0dG9uID0gYWN0aW9uQmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJSdW4gQW5hbHlzaXNcIiwgY2xzOiBcIm1vZC1jdGFcIiB9KTtcbiAgICAgIHJ1bkJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICAvLyBHZXQgdGhlIHBsdWdpbiBpbnN0YW5jZSBhbmQgcnVuIHQtU05FXG4gICAgICAgIGNvbnN0IHBsdWdpbiA9ICh0aGlzLmFwcCBhcyBhbnkpLnBsdWdpbnMucGx1Z2luc1tcInZpYmUtYm9pXCJdIGFzIFZpYmVCb3lQbHVnaW47XG4gICAgICAgIHBsdWdpbi5ydW5UU05FKCk7XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0Rm9sZGVyQnV0dG9uID0gYWN0aW9uQmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJTZWxlY3QgRm9sZGVyXCIgfSk7XG4gICAgICBzZWxlY3RGb2xkZXJCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgLy8gVE9ETzogSW1wbGVtZW50IGZvbGRlciBzZWxlY3Rpb25cbiAgICAgICAgbmV3IE5vdGljZShcIkZvbGRlciBzZWxlY3Rpb24gbm90IGltcGxlbWVudGVkIHlldFwiKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBpbmZvIHRleHRcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJwXCIsIHsgXG4gICAgICB0ZXh0OiBcIlJ1biB0LVNORSBhbmFseXNpcyB0byB2aXN1YWxpemUgeW91ciBub3RlcyBhcyBjbHVzdGVycyBiYXNlZCBvbiBjb250ZW50IHNpbWlsYXJpdHkuXCIsXG4gICAgICBjbHM6IFwidHNuZS1pbmZvXCJcbiAgICB9KTtcbiAgICBcbiAgICAvLyBBZGQgdmlzdWFsaXphdGlvbiBjb250YWluZXJcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBcbiAgICAgIGNsczogXCJ0c25lLWNvbnRhaW5lclwiLCBcbiAgICAgIGF0dHI6IHsgaWQ6IFwidHNuZS1jb250YWluZXJcIiB9IFxuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBzdGF0dXMgdGV4dFxuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7IFxuICAgICAgY2xzOiBcInRzbmUtc3RhdHVzXCIsXG4gICAgICBhdHRyOiB7IGlkOiBcInRzbmUtc3RhdHVzXCIgfVxuICAgIH0sIChzdGF0dXMpID0+IHtcbiAgICAgIHN0YXR1cy5jcmVhdGVFbChcInBcIiwgeyBcbiAgICAgICAgdGV4dDogXCJVc2UgdGhlICdSdW4gQW5hbHlzaXMnIGJ1dHRvbiB0byBzdGFydCBwcm9jZXNzaW5nIHlvdXIgbm90ZXMuXCIsXG4gICAgICAgIGNsczogXCJ0c25lLXN0YXR1cy10ZXh0XCJcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBzaW1wbGUgQ1NTXG4gICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgICAgLnRzbmUtaGVhZGVyIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICBtYXJnaW4tYm90dG9tOiAxcmVtO1xuICAgICAgfVxuICAgICAgLnRzbmUtYWN0aW9ucyB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGdhcDogMTBweDtcbiAgICAgIH1cbiAgICAgIC50c25lLWluZm8ge1xuICAgICAgICBtYXJnaW4tYm90dG9tOiAxcmVtO1xuICAgICAgICBvcGFjaXR5OiAwLjg7XG4gICAgICB9XG4gICAgICAudHNuZS1jb250YWluZXIge1xuICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgaGVpZ2h0OiA2MDBweDtcbiAgICAgICAgbWFyZ2luOiAxcmVtIDA7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgIH1cbiAgICAgIC50c25lLXN0YXR1cyB7XG4gICAgICAgIG1hcmdpbi10b3A6IDFyZW07XG4gICAgICAgIHBhZGRpbmc6IDAuNXJlbTtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1iYWNrZ3JvdW5kLXNlY29uZGFyeSk7XG4gICAgICB9XG4gICAgICAudHNuZS1zdGF0dXMtdGV4dCB7XG4gICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgZm9udC1zaXplOiAwLjlyZW07XG4gICAgICAgIG9wYWNpdHk6IDAuODtcbiAgICAgIH1cbiAgICBgO1xuICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFZpYmVCb3lQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5nczogVmliZUJveVNldHRpbmdzO1xuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG4gICAgLy8gUmVnaXN0ZXIgdGhlIGN1c3RvbSB2aWV3XG4gICAgdGhpcy5yZWdpc3RlclZpZXcoXG4gICAgICBWSUVXX1RZUEVfVFNORSxcbiAgICAgIChsZWFmKSA9PiBuZXcgVFNORVZpZXcobGVhZilcbiAgICApO1xuXG4gICAgLy8gQWRkIGNvbW1hbmQgdG8gb3BlbiB0aGUgdmlzdWFsaXphdGlvblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogJ29wZW4tdHNuZS12aXN1YWxpemF0aW9uJyxcbiAgICAgIG5hbWU6ICdPcGVuIHQtU05FIFZpc3VhbGl6YXRpb24nLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEFkZCBjb21tYW5kIHRvIHJ1biB0LVNORSBhbmFseXNpc1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogJ3J1bi10c25lLWFuYWx5c2lzJyxcbiAgICAgIG5hbWU6ICdSdW4gdC1TTkUgQW5hbHlzaXMnLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgdGhpcy5ydW5UU05FKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBZGQgc2V0dGluZyB0YWJcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IFNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgfVxuXG4gIG9udW5sb2FkKCkge1xuICAgIC8vIENsZWFuIHVwIHJlc291cmNlcyB3aGVuIHRoZSBwbHVnaW4gaXMgZGlzYWJsZWRcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG5cbiAgYXN5bmMgYWN0aXZhdGVWaWV3KCkge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfVFNORSk7XG4gICAgaWYgKGV4aXN0aW5nLmxlbmd0aCkge1xuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoZXhpc3RpbmdbMF0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZih0cnVlKTtcbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7XG4gICAgICB0eXBlOiBWSUVXX1RZUEVfVFNORSxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIHJ1blRTTkUoKSB7XG4gICAgLy8gUHJvY2VzcyBub3RlcyBhbmQgcnVuIHQtU05FIGFuYWx5c2lzXG4gICAgbmV3IE5vdGljZSgndC1TTkUgYW5hbHlzaXMgc3RhcnRpbmcuLi4nKTtcbiAgICB0aGlzLnVwZGF0ZVN0YXR1cygnR2F0aGVyaW5nIG5vdGVzLi4uJyk7XG4gICAgXG4gICAgLy8gR2V0IGFsbCBtYXJrZG93biBmaWxlcyBpbiB0aGUgdmF1bHRcbiAgICBjb25zdCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgLy8gTGltaXQgdG8gYSByZWFzb25hYmxlIG51bWJlciBvZiBmaWxlcyBmb3IgcGVyZm9ybWFuY2VcbiAgICAgIGNvbnN0IG1heEZpbGVzID0gMjAwO1xuICAgICAgY29uc3Qgc2VsZWN0ZWRGaWxlcyA9IGZpbGVzLnNsaWNlKDAsIG1heEZpbGVzKTtcbiAgICAgIFxuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoYFByb2Nlc3NpbmcgJHtzZWxlY3RlZEZpbGVzLmxlbmd0aH0gbm90ZXMuLi5gKTtcbiAgICAgIFxuICAgICAgLy8gUHJlcGFyZSBub3RlcyBkYXRhIGZvciB0aGUgUHl0aG9uIHNlcnZlclxuICAgICAgY29uc3Qgbm90ZXMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgc2VsZWN0ZWRGaWxlcy5tYXAoYXN5bmMgKGZpbGUpID0+IHtcbiAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgICBjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5zdGF0KGZpbGUucGF0aCk7XG4gICAgICAgICAgY29uc3Qgd29yZENvdW50ID0gY29udGVudC5zcGxpdCgvXFxzKy8pLmxlbmd0aDtcbiAgICAgICAgICBjb25zdCByZWFkaW5nVGltZSA9IE1hdGguY2VpbCh3b3JkQ291bnQgLyAyMDApOyAvLyBBdmcgcmVhZGluZyBzcGVlZCB+MjAwIHdvcmRzL21pbnV0ZVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIEV4dHJhY3QgdGFncyAobG9va2luZyBmb3IgI3RhZyBmb3JtYXQpXG4gICAgICAgICAgY29uc3QgdGFnUmVnZXggPSAvIyhbYS16QS1aMC05Xy1dKykvZztcbiAgICAgICAgICBjb25zdCB0YWdzID0gWy4uLmNvbnRlbnQubWF0Y2hBbGwodGFnUmVnZXgpXS5tYXAobWF0Y2ggPT4gbWF0Y2hbMV0pO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIEdldCBhIGNvbnRlbnQgcHJldmlldyAoZmlyc3QgMTUwIGNoYXJzKVxuICAgICAgICAgIGNvbnN0IGNvbnRlbnRQcmV2aWV3ID0gY29udGVudC5zdWJzdHJpbmcoMCwgMTUwKS5yZXBsYWNlKC9cXG4vZywgJyAnKSArIFxuICAgICAgICAgICAgKGNvbnRlbnQubGVuZ3RoID4gMTUwID8gJy4uLicgOiAnJyk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBhdGg6IGZpbGUucGF0aCxcbiAgICAgICAgICAgIHRpdGxlOiBmaWxlLmJhc2VuYW1lLFxuICAgICAgICAgICAgY29udGVudDogY29udGVudCxcbiAgICAgICAgICAgIG10aW1lOiBzdGF0Lm10aW1lLFxuICAgICAgICAgICAgY3RpbWU6IHN0YXQuY3RpbWUsXG4gICAgICAgICAgICB3b3JkQ291bnQ6IHdvcmRDb3VudCxcbiAgICAgICAgICAgIHJlYWRpbmdUaW1lOiByZWFkaW5nVGltZSxcbiAgICAgICAgICAgIHRhZ3M6IHRhZ3MsXG4gICAgICAgICAgICBjb250ZW50UHJldmlldzogY29udGVudFByZXZpZXdcbiAgICAgICAgICB9O1xuICAgICAgICB9KVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoJ1NlbmRpbmcgZGF0YSB0byB0LVNORSBzZXJ2ZXIuLi4nKTtcbiAgICAgIFxuICAgICAgLy8gQ2hlY2sgaWYgUHl0aG9uIHNlcnZlciBpcyBydW5uaW5nXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBoZWFsdGhDaGVjayA9IGF3YWl0IGZldGNoKCdodHRwOi8vMTI3LjAuMC4xOjEyMzQvaGVhbHRoJywgeyBcbiAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFoZWFsdGhDaGVjay5vaykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlB5dGhvbiBzZXJ2ZXIgaXMgbm90IHJlc3BvbmRpbmdcIik7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBcIkNhbm5vdCBjb25uZWN0IHRvIFB5dGhvbiBzZXJ2ZXIuIE1ha2Ugc3VyZSB0aGUgc2VydmVyIGlzIHJ1bm5pbmcgYXQgaHR0cDovLzEyNy4wLjAuMToxMjM0LiBcIiArXG4gICAgICAgICAgXCJSdW4gJ3B5dGhvbiBzcmMvcHl0aG9uL3RzbmUvc2VydmVyLnB5JyB0byBzdGFydCBpdC5cIlxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBTZW5kIHRvIFB5dGhvbiBzZXJ2ZXIgZm9yIHByb2Nlc3NpbmdcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGBSdW5uaW5nIHQtU05FIGFuYWx5c2lzIHdpdGggcGVycGxleGl0eT0ke3RoaXMuc2V0dGluZ3MucGVycGxleGl0eX0sIGl0ZXJhdGlvbnM9JHt0aGlzLnNldHRpbmdzLml0ZXJhdGlvbnN9Li4uYCk7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCdodHRwOi8vMTI3LjAuMC4xOjEyMzQvcHJvY2VzcycsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgbm90ZXM6IG5vdGVzLFxuICAgICAgICAgIHNldHRpbmdzOiB7XG4gICAgICAgICAgICBwZXJwbGV4aXR5OiB0aGlzLnNldHRpbmdzLnBlcnBsZXhpdHksXG4gICAgICAgICAgICBpdGVyYXRpb25zOiB0aGlzLnNldHRpbmdzLml0ZXJhdGlvbnMsXG4gICAgICAgICAgICBsZWFybmluZ19yYXRlOiB0aGlzLnNldHRpbmdzLmVwc2lsb25cbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNlcnZlciByZXNwb25kZWQgd2l0aCBzdGF0dXM6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICBcbiAgICAgIGlmIChyZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgZXJyb3I6ICR7cmVzdWx0LmVycm9yfWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnVmlzdWFsaXppbmcgcmVzdWx0cy4uLicpO1xuICAgICAgXG4gICAgICAvLyBEZWJ1ZyAtIGxvZyB0aGUgcmVzdWx0IHN0cnVjdHVyZSB0byBjaGVjayBtZXRhZGF0YVxuICAgICAgY29uc29sZS5sb2coJ1Zpc3VhbGl6aW5nIHJlc3VsdCB3aXRoIG1ldGFkYXRhOicsIHJlc3VsdCk7XG4gICAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGFkZGl0aW9uYWwgbWV0YWRhdGFcbiAgICAgIGlmIChyZXN1bHQucG9pbnRzICYmIHJlc3VsdC5wb2ludHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBzYW1wbGVQb2ludCA9IHJlc3VsdC5wb2ludHNbMF07XG4gICAgICAgIGNvbnNvbGUubG9nKCdTYW1wbGUgcG9pbnQgbWV0YWRhdGE6Jywge1xuICAgICAgICAgIGhhc1dvcmRDb3VudDogc2FtcGxlUG9pbnQud29yZENvdW50ICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzTXRpbWU6IHNhbXBsZVBvaW50Lm10aW1lICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzQ3RpbWU6IHNhbXBsZVBvaW50LmN0aW1lICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzVGFnczogc2FtcGxlUG9pbnQudGFncyAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc0NvbnRlbnRQcmV2aWV3OiBzYW1wbGVQb2ludC5jb250ZW50UHJldmlldyAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc0Rpc3RhbmNlVG9DZW50ZXI6IHNhbXBsZVBvaW50LmRpc3RhbmNlVG9DZW50ZXIgIT09IHVuZGVmaW5lZFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gVmlzdWFsaXplIHRoZSByZXN1bHRcbiAgICAgIHRoaXMudmlzdWFsaXplUmVzdWx0KHJlc3VsdCk7XG4gICAgICBcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGBWaXN1YWxpemF0aW9uIGNvbXBsZXRlISBEaXNwbGF5aW5nICR7cmVzdWx0LnBvaW50cy5sZW5ndGh9IG5vdGVzLmApO1xuICAgICAgbmV3IE5vdGljZSgndC1TTkUgYW5hbHlzaXMgY29tcGxldGUhJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHJ1bm5pbmcgdC1TTkUgYW5hbHlzaXM6JywgZXJyb3IpO1xuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoYEVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICBuZXcgTm90aWNlKGB0LVNORSBhbmFseXNpcyBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgdXBkYXRlU3RhdHVzKG1lc3NhZ2U6IHN0cmluZykge1xuICAgIC8vIEZpbmQgdGhlIHN0YXR1cyBlbGVtZW50IGluIHRoZSB2aWV3IGFuZCB1cGRhdGUgaXRcbiAgICBjb25zdCBzdGF0dXNFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RzbmUtc3RhdHVzIC50c25lLXN0YXR1cy10ZXh0Jyk7XG4gICAgaWYgKHN0YXR1c0VsZW1lbnQpIHtcbiAgICAgIHN0YXR1c0VsZW1lbnQudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICAgIH1cbiAgICBjb25zb2xlLmxvZyhgU3RhdHVzOiAke21lc3NhZ2V9YCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgdmlzdWFsaXplUmVzdWx0KHJlc3VsdDogYW55KSB7XG4gICAgLy8gR2V0IG9yIGNyZWF0ZSB0aGUgdmlzdWFsaXphdGlvbiB2aWV3XG4gICAgbGV0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9UU05FKVswXTtcbiAgICBpZiAoIWxlYWYpIHtcbiAgICAgIC8vIEFjdGl2YXRlIHRoZSB2aWV3IGlmIG5vdCBmb3VuZFxuICAgICAgYXdhaXQgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICAgIC8vIFRyeSB0byBnZXQgdGhlIGxlYWYgYWdhaW5cbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9UU05FKVswXTtcbiAgICAgIFxuICAgICAgaWYgKCFsZWFmKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NvdWxkIG5vdCBjcmVhdGUgdmlzdWFsaXphdGlvbiB2aWV3Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gQWNjZXNzIHRoZSB2aWV3IGNvbnRhaW5lclxuICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXcgYXMgVFNORVZpZXc7XG4gICAgY29uc3QgY29udGFpbmVyID0gdmlldy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignI3RzbmUtY29udGFpbmVyJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgaWYgKCFjb250YWluZXIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0NvbnRhaW5lciBub3QgZm91bmQgaW4gdmlldycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICAvLyBDbGVhciBhbnkgZXhpc3RpbmcgY29udGVudFxuICAgIHdoaWxlIChjb250YWluZXIuZmlyc3RDaGlsZCkge1xuICAgICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKGNvbnRhaW5lci5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ3JlYXRlIHRoZSB2aXN1YWxpemVyXG4gICAgY29uc3Qgb3BlbkNhbGxiYWNrID0gKHBhdGg6IHN0cmluZykgPT4ge1xuICAgICAgLy8gT3BlbiB0aGUgc2VsZWN0ZWQgbm90ZVxuICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcbiAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoKS5vcGVuRmlsZShmaWxlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIC8vIENyZWF0ZSBhbmQgdXNlIHRoZSB2aXN1YWxpemVyIGRpcmVjdGx5XG4gICAgY29uc3QgdmlzdWFsaXplciA9IG5ldyBUU05FVmlzdWFsaXplcihjb250YWluZXIsIG9wZW5DYWxsYmFjayk7XG4gICAgdmlzdWFsaXplci5zZXREYXRhKHJlc3VsdCk7XG4gIH1cbn1cblxuLy8gSW50ZXJmYWNlIGZvciB0LVNORSByZXN1bHQgcG9pbnRzXG5pbnRlcmZhY2UgVFNORVBvaW50IHtcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIHBhdGg6IHN0cmluZztcbiAgdG9wX3Rlcm1zOiBzdHJpbmdbXTtcbiAgY2x1c3RlcjogbnVtYmVyOyAvLyBDbHVzdGVyIElEICgtMSBtZWFucyBub2lzZS9ub3QgY2x1c3RlcmVkKVxuICBcbiAgLy8gQWRkaXRpb25hbCBtZXRhZGF0YVxuICBtdGltZT86IG51bWJlcjsgICAgICAvLyBMYXN0IG1vZGlmaWVkIHRpbWVcbiAgY3RpbWU/OiBudW1iZXI7ICAgICAgLy8gQ3JlYXRpb24gdGltZVxuICB3b3JkQ291bnQ/OiBudW1iZXI7ICAvLyBXb3JkIGNvdW50XG4gIHJlYWRpbmdUaW1lPzogbnVtYmVyOyAvLyBFc3RpbWF0ZWQgcmVhZGluZyB0aW1lIGluIG1pbnV0ZXMgIFxuICB0YWdzPzogc3RyaW5nW107ICAgICAvLyBOb3RlIHRhZ3NcbiAgY29udGVudFByZXZpZXc/OiBzdHJpbmc7IC8vIFNob3J0IHByZXZpZXcgb2YgY29udGVudFxuICBkaXN0YW5jZVRvQ2VudGVyPzogbnVtYmVyOyAvLyBEaXN0YW5jZSB0byBjbHVzdGVyIGNlbnRlclxufVxuXG4vLyBJbnRlcmZhY2UgZm9yIGNsdXN0ZXIgdGVybSBpbmZvcm1hdGlvblxuaW50ZXJmYWNlIENsdXN0ZXJUZXJtIHtcbiAgdGVybTogc3RyaW5nO1xuICBzY29yZTogbnVtYmVyO1xufVxuXG4vLyBJbnRlcmZhY2UgZm9yIGNsdXN0ZXIgaW5mb3JtYXRpb25cbmludGVyZmFjZSBDbHVzdGVySW5mbyB7XG4gIFtrZXk6IHN0cmluZ106IENsdXN0ZXJUZXJtW107XG59XG5cbi8vIEludGVyZmFjZSBmb3IgdC1TTkUgcmVzdWx0c1xuaW50ZXJmYWNlIFRTTkVSZXN1bHQge1xuICBwb2ludHM6IFRTTkVQb2ludFtdO1xuICBmZWF0dXJlX25hbWVzOiBzdHJpbmdbXTtcbiAgY2x1c3RlcnM6IG51bWJlcjtcbiAgY2x1c3Rlcl90ZXJtczogQ2x1c3RlckluZm87XG59XG5cbmNsYXNzIFRTTkVWaXN1YWxpemVyIHtcbiAgcHJpdmF0ZSBjb250YWluZXI6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQ7XG4gIHByaXZhdGUgY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG4gIHByaXZhdGUgcmVzdWx0OiBUU05FUmVzdWx0IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgd2lkdGggPSA4MDA7XG4gIHByaXZhdGUgaGVpZ2h0ID0gNjAwO1xuICBwcml2YXRlIHBvaW50UmFkaXVzID0gMTA7XG4gIHByaXZhdGUgbW91c2VYID0gMDtcbiAgcHJpdmF0ZSBtb3VzZVkgPSAwO1xuICBwcml2YXRlIHNjYWxlID0gMTtcbiAgcHJpdmF0ZSBvZmZzZXRYID0gMDtcbiAgcHJpdmF0ZSBvZmZzZXRZID0gMDtcbiAgcHJpdmF0ZSBpc0RyYWdnaW5nID0gZmFsc2U7XG4gIHByaXZhdGUgbGFzdFggPSAwO1xuICBwcml2YXRlIGxhc3RZID0gMDtcbiAgcHJpdmF0ZSBob3ZlcmVkUG9pbnQ6IFRTTkVQb2ludCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIG9wZW5DYWxsYmFjazogKHBhdGg6IHN0cmluZykgPT4gdm9pZDtcblxuICBjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBvcGVuQ2FsbGJhY2s6IChwYXRoOiBzdHJpbmcpID0+IHZvaWQpIHtcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICB0aGlzLm9wZW5DYWxsYmFjayA9IG9wZW5DYWxsYmFjaztcbiAgICBcbiAgICAvLyBDcmVhdGUgY2FudmFzIGVsZW1lbnRcbiAgICB0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIHRoaXMuY2FudmFzLndpZHRoID0gdGhpcy53aWR0aDtcbiAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSB0aGlzLmhlaWdodDtcbiAgICB0aGlzLmNhbnZhcy5jbGFzc0xpc3QuYWRkKCd0c25lLWNhbnZhcycpO1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLmJvcmRlciA9ICcxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpJztcbiAgICBcbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBpZiAoIWNvbnRleHQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGNyZWF0ZSBjYW52YXMgY29udGV4dCcpO1xuICAgIH1cbiAgICB0aGlzLmN0eCA9IGNvbnRleHQ7XG4gICAgXG4gICAgLy8gQ2xlYXIgdGhlIGNvbnRhaW5lciBmaXJzdFxuICAgIHdoaWxlICh0aGlzLmNvbnRhaW5lci5maXJzdENoaWxkKSB7XG4gICAgICB0aGlzLmNvbnRhaW5lci5yZW1vdmVDaGlsZCh0aGlzLmNvbnRhaW5lci5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQWRkIGNhbnZhcyB0byBjb250YWluZXJcbiAgICB0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLmNhbnZhcyk7XG4gICAgXG4gICAgLy8gQWRkIGV2ZW50IGxpc3RlbmVyc1xuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnMoKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhZGRFdmVudExpc3RlbmVycygpIHtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmhhbmRsZU1vdXNlTW92ZS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuaGFuZGxlQ2xpY2suYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignd2hlZWwnLCB0aGlzLmhhbmRsZVdoZWVsLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMuaGFuZGxlTW91c2VEb3duLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmhhbmRsZU1vdXNlVXAuYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsIHRoaXMuaGFuZGxlTW91c2VVcC5iaW5kKHRoaXMpKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZU1vdmUoZTogTW91c2VFdmVudCkge1xuICAgIGNvbnN0IHJlY3QgPSB0aGlzLmNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB0aGlzLm1vdXNlWCA9IGUuY2xpZW50WCAtIHJlY3QubGVmdDtcbiAgICB0aGlzLm1vdXNlWSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xuICAgIFxuICAgIGlmICh0aGlzLmlzRHJhZ2dpbmcpIHtcbiAgICAgIGNvbnN0IGR4ID0gdGhpcy5tb3VzZVggLSB0aGlzLmxhc3RYO1xuICAgICAgY29uc3QgZHkgPSB0aGlzLm1vdXNlWSAtIHRoaXMubGFzdFk7XG4gICAgICBcbiAgICAgIHRoaXMub2Zmc2V0WCArPSBkeDtcbiAgICAgIHRoaXMub2Zmc2V0WSArPSBkeTtcbiAgICAgIFxuICAgICAgdGhpcy5sYXN0WCA9IHRoaXMubW91c2VYO1xuICAgICAgdGhpcy5sYXN0WSA9IHRoaXMubW91c2VZO1xuICAgICAgXG4gICAgICB0aGlzLmRyYXcoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51cGRhdGVIb3ZlcmVkUG9pbnQoKTtcbiAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVDbGljayhlOiBNb3VzZUV2ZW50KSB7XG4gICAgaWYgKHRoaXMuaG92ZXJlZFBvaW50KSB7XG4gICAgICB0aGlzLm9wZW5DYWxsYmFjayh0aGlzLmhvdmVyZWRQb2ludC5wYXRoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgaGFuZGxlV2hlZWwoZTogV2hlZWxFdmVudCkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBcbiAgICBjb25zdCBkZWx0YSA9IGUuZGVsdGFZID4gMCA/IDAuOSA6IDEuMTtcbiAgICB0aGlzLnNjYWxlICo9IGRlbHRhO1xuICAgIFxuICAgIC8vIExpbWl0IHpvb21cbiAgICB0aGlzLnNjYWxlID0gTWF0aC5tYXgoMC4xLCBNYXRoLm1pbig1LCB0aGlzLnNjYWxlKSk7XG4gICAgXG4gICAgdGhpcy5kcmF3KCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgaGFuZGxlTW91c2VEb3duKGU6IE1vdXNlRXZlbnQpIHtcbiAgICB0aGlzLmlzRHJhZ2dpbmcgPSB0cnVlO1xuICAgIHRoaXMubGFzdFggPSB0aGlzLm1vdXNlWDtcbiAgICB0aGlzLmxhc3RZID0gdGhpcy5tb3VzZVk7XG4gICAgdGhpcy5jYW52YXMuc3R5bGUuY3Vyc29yID0gJ2dyYWJiaW5nJztcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZVVwKGU6IE1vdXNlRXZlbnQpIHtcbiAgICB0aGlzLmlzRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS5jdXJzb3IgPSB0aGlzLmhvdmVyZWRQb2ludCA/ICdwb2ludGVyJyA6ICdkZWZhdWx0JztcbiAgfVxuICBcbiAgcHJpdmF0ZSB1cGRhdGVIb3ZlcmVkUG9pbnQoKSB7XG4gICAgaWYgKCF0aGlzLnJlc3VsdCkgcmV0dXJuO1xuICAgIFxuICAgIHRoaXMuaG92ZXJlZFBvaW50ID0gbnVsbDtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgY29uc3QgW3NjcmVlblgsIHNjcmVlblldID0gdGhpcy53b3JsZFRvU2NyZWVuKHBvaW50LngsIHBvaW50LnkpO1xuICAgICAgY29uc3QgZGlzdGFuY2UgPSBNYXRoLnNxcnQoXG4gICAgICAgIE1hdGgucG93KHNjcmVlblggLSB0aGlzLm1vdXNlWCwgMikgKyBcbiAgICAgICAgTWF0aC5wb3coc2NyZWVuWSAtIHRoaXMubW91c2VZLCAyKVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgaWYgKGRpc3RhbmNlIDw9IHRoaXMucG9pbnRSYWRpdXMpIHtcbiAgICAgICAgdGhpcy5ob3ZlcmVkUG9pbnQgPSBwb2ludDtcbiAgICAgICAgdGhpcy5jYW52YXMuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHRoaXMuY2FudmFzLnN0eWxlLmN1cnNvciA9IHRoaXMuaXNEcmFnZ2luZyA/ICdncmFiYmluZycgOiAnZGVmYXVsdCc7XG4gIH1cbiAgXG4gIC8vIENvbnZlcnRzIHdvcmxkIHNwYWNlICh0LVNORSkgY29vcmRpbmF0ZXMgdG8gc2NyZWVuIGNvb3JkaW5hdGVzXG4gIHByaXZhdGUgd29ybGRUb1NjcmVlbih4OiBudW1iZXIsIHk6IG51bWJlcik6IFtudW1iZXIsIG51bWJlcl0ge1xuICAgIC8vIE5vcm1hbGl6ZSB0byBjZW50ZXIgb2Ygc2NyZWVuXG4gICAgY29uc3QgY2VudGVyWCA9IHRoaXMud2lkdGggLyAyO1xuICAgIGNvbnN0IGNlbnRlclkgPSB0aGlzLmhlaWdodCAvIDI7XG4gICAgXG4gICAgLy8gQXBwbHkgc2NhbGUgYW5kIG9mZnNldFxuICAgIGNvbnN0IHNjcmVlblggPSB4ICogdGhpcy5zY2FsZSAqIDEwMCArIGNlbnRlclggKyB0aGlzLm9mZnNldFg7XG4gICAgY29uc3Qgc2NyZWVuWSA9IHkgKiB0aGlzLnNjYWxlICogMTAwICsgY2VudGVyWSArIHRoaXMub2Zmc2V0WTtcbiAgICBcbiAgICByZXR1cm4gW3NjcmVlblgsIHNjcmVlblldO1xuICB9XG4gIFxuICBwdWJsaWMgc2V0RGF0YShyZXN1bHQ6IFRTTkVSZXN1bHQpIHtcbiAgICB0aGlzLnJlc3VsdCA9IHJlc3VsdDtcbiAgICB0aGlzLnJlc2V0VmlldygpO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG4gIFxuICBwcml2YXRlIHJlc2V0VmlldygpIHtcbiAgICB0aGlzLnNjYWxlID0gMTtcbiAgICB0aGlzLm9mZnNldFggPSAwO1xuICAgIHRoaXMub2Zmc2V0WSA9IDA7XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhdygpIHtcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgLy8gQ2xlYXIgY2FudmFzXG4gICAgdGhpcy5jdHguY2xlYXJSZWN0KDAsIDAsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcbiAgICBcbiAgICAvLyBEcmF3IGJhY2tncm91bmQgZ3JpZFxuICAgIHRoaXMuZHJhd0dyaWQoKTtcbiAgICBcbiAgICAvLyBGaW5kIGNsdXN0ZXJzIHVzaW5nIGEgc2ltcGxlIGRpc3RhbmNlIG1ldHJpY1xuICAgIGNvbnN0IGNsdXN0ZXJzID0gdGhpcy5maW5kQ2x1c3RlcnMoKTtcbiAgICBcbiAgICAvLyBEcmF3IGNsdXN0ZXJzIGZpcnN0ICh1bmRlcm5lYXRoIHBvaW50cylcbiAgICB0aGlzLmRyYXdDbHVzdGVycyhjbHVzdGVycyk7XG4gICAgXG4gICAgLy8gRHJhdyBwb2ludHNcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgdGhpcy5kcmF3UG9pbnQocG9pbnQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBEcmF3IHRvb2x0aXAgZm9yIGhvdmVyZWQgcG9pbnRcbiAgICBpZiAodGhpcy5ob3ZlcmVkUG9pbnQpIHtcbiAgICAgIHRoaXMuZHJhd1Rvb2x0aXAoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhd0dyaWQoKSB7XG4gICAgY29uc3QgZ3JpZFNpemUgPSA1MCAqIHRoaXMuc2NhbGU7XG4gICAgXG4gICAgdGhpcy5jdHguc3Ryb2tlU3R5bGUgPSAncmdiYSh2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlci1yZ2IpLCAwLjMpJztcbiAgICB0aGlzLmN0eC5saW5lV2lkdGggPSAxO1xuICAgIFxuICAgIC8vIFZlcnRpY2FsIGxpbmVzXG4gICAgZm9yIChsZXQgeCA9IHRoaXMub2Zmc2V0WCAlIGdyaWRTaXplOyB4IDwgdGhpcy53aWR0aDsgeCArPSBncmlkU2l6ZSkge1xuICAgICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgICB0aGlzLmN0eC5tb3ZlVG8oeCwgMCk7XG4gICAgICB0aGlzLmN0eC5saW5lVG8oeCwgdGhpcy5oZWlnaHQpO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgfVxuICAgIFxuICAgIC8vIEhvcml6b250YWwgbGluZXNcbiAgICBmb3IgKGxldCB5ID0gdGhpcy5vZmZzZXRZICUgZ3JpZFNpemU7IHkgPCB0aGlzLmhlaWdodDsgeSArPSBncmlkU2l6ZSkge1xuICAgICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgICB0aGlzLmN0eC5tb3ZlVG8oMCwgeSk7XG4gICAgICB0aGlzLmN0eC5saW5lVG8odGhpcy53aWR0aCwgeSk7XG4gICAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZmluZENsdXN0ZXJzKCkge1xuICAgIGlmICghdGhpcy5yZXN1bHQpIHJldHVybiBbXTtcbiAgICBcbiAgICAvLyBTaW1wbGUgY2x1c3RlcmluZyBiYXNlZCBvbiBkaXN0YW5jZVxuICAgIGNvbnN0IHBvaW50cyA9IHRoaXMucmVzdWx0LnBvaW50cztcbiAgICBjb25zdCBjbHVzdGVyczogVFNORVBvaW50W11bXSA9IFtdO1xuICAgIGNvbnN0IHZpc2l0ZWQgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgICBcbiAgICBjb25zdCBkaXN0YW5jZVRocmVzaG9sZCA9IDAuMjsgIC8vIEFkanVzdCB0aGlzIHRocmVzaG9sZCBhcyBuZWVkZWRcbiAgICBcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHZpc2l0ZWQuaGFzKGkpKSBjb250aW51ZTtcbiAgICAgIFxuICAgICAgY29uc3QgY2x1c3RlcjogVFNORVBvaW50W10gPSBbcG9pbnRzW2ldXTtcbiAgICAgIHZpc2l0ZWQuYWRkKGkpO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHBvaW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICBpZiAoaSA9PT0gaiB8fCB2aXNpdGVkLmhhcyhqKSkgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBkaXN0YW5jZSA9IE1hdGguc3FydChcbiAgICAgICAgICBNYXRoLnBvdyhwb2ludHNbaV0ueCAtIHBvaW50c1tqXS54LCAyKSArIFxuICAgICAgICAgIE1hdGgucG93KHBvaW50c1tpXS55IC0gcG9pbnRzW2pdLnksIDIpXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICBpZiAoZGlzdGFuY2UgPCBkaXN0YW5jZVRocmVzaG9sZCkge1xuICAgICAgICAgIGNsdXN0ZXIucHVzaChwb2ludHNbal0pO1xuICAgICAgICAgIHZpc2l0ZWQuYWRkKGopO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChjbHVzdGVyLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgY2x1c3RlcnMucHVzaChjbHVzdGVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGNsdXN0ZXJzO1xuICB9XG4gIFxuICBwcml2YXRlIGRyYXdDbHVzdGVycyhjbHVzdGVyczogVFNORVBvaW50W11bXSkge1xuICAgIC8vIFNraXAgaWYgbm8gcmVzdWx0IGRhdGFcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgLy8gQ29sb3IgcGFsZXR0ZSBmb3IgY2x1c3RlcnMgKGV4Y2x1ZGluZyBub2lzZSBwb2ludHMpXG4gICAgY29uc3QgY29sb3JzID0gW1xuICAgICAgeyBmaWxsOiAncmdiYSgyNTUsIDk5LCAxMzIsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDI1NSwgOTksIDEzMiwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoNTQsIDE2MiwgMjM1LCAwLjEpJywgc3Ryb2tlOiAncmdiYSg1NCwgMTYyLCAyMzUsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDI1NSwgMjA2LCA4NiwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMjU1LCAyMDYsIDg2LCAwLjUpJyB9LFxuICAgICAgeyBmaWxsOiAncmdiYSg3NSwgMTkyLCAxOTIsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDc1LCAxOTIsIDE5MiwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoMTUzLCAxMDIsIDI1NSwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMTUzLCAxMDIsIDI1NSwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoMjU1LCAxNTksIDY0LCAwLjEpJywgc3Ryb2tlOiAncmdiYSgyNTUsIDE1OSwgNjQsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDE5OSwgMTk5LCAxOTksIDAuMSknLCBzdHJva2U6ICdyZ2JhKDE5OSwgMTk5LCAxOTksIDAuNSknIH0sXG4gICAgXTtcbiAgICBcbiAgICAvLyBHcm91cCBwb2ludHMgYnkgY2x1c3RlciBJRCBmcm9tIHRoZSBzZXJ2ZXIgcmVzcG9uc2VcbiAgICBjb25zdCBjbHVzdGVyR3JvdXBzOiB7IFtrZXk6IG51bWJlcl06IFRTTkVQb2ludFtdIH0gPSB7fTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgaWYgKHBvaW50LmNsdXN0ZXIgPT09IC0xKSBjb250aW51ZTsgLy8gU2tpcCBub2lzZSBwb2ludHNcbiAgICAgIFxuICAgICAgaWYgKCFjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdKSB7XG4gICAgICAgIGNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0gPSBbXTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXS5wdXNoKHBvaW50KTtcbiAgICB9XG4gICAgXG4gICAgLy8gRHJhdyBlYWNoIGNsdXN0ZXJcbiAgICBPYmplY3QuZW50cmllcyhjbHVzdGVyR3JvdXBzKS5mb3JFYWNoKChbY2x1c3RlcklkLCBwb2ludHNdLCBpbmRleCkgPT4ge1xuICAgICAgLy8gRmluZCB0aGUgY2VudHJvaWQgYW5kIGJvdW5kcyBvZiB0aGUgY2x1c3RlclxuICAgICAgbGV0IG1pblggPSBJbmZpbml0eSwgbWluWSA9IEluZmluaXR5O1xuICAgICAgbGV0IG1heFggPSAtSW5maW5pdHksIG1heFkgPSAtSW5maW5pdHk7XG4gICAgICBsZXQgc3VtWCA9IDAsIHN1bVkgPSAwO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHBvaW50cykge1xuICAgICAgICBjb25zdCBbc2NyZWVuWCwgc2NyZWVuWV0gPSB0aGlzLndvcmxkVG9TY3JlZW4ocG9pbnQueCwgcG9pbnQueSk7XG4gICAgICAgIG1pblggPSBNYXRoLm1pbihtaW5YLCBzY3JlZW5YKTtcbiAgICAgICAgbWluWSA9IE1hdGgubWluKG1pblksIHNjcmVlblkpO1xuICAgICAgICBtYXhYID0gTWF0aC5tYXgobWF4WCwgc2NyZWVuWCk7XG4gICAgICAgIG1heFkgPSBNYXRoLm1heChtYXhZLCBzY3JlZW5ZKTtcbiAgICAgICAgc3VtWCArPSBzY3JlZW5YO1xuICAgICAgICBzdW1ZICs9IHNjcmVlblk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIENhbGN1bGF0ZSBjZW50cm9pZFxuICAgICAgY29uc3QgY2VudGVyWCA9IHN1bVggLyBwb2ludHMubGVuZ3RoO1xuICAgICAgY29uc3QgY2VudGVyWSA9IHN1bVkgLyBwb2ludHMubGVuZ3RoO1xuICAgICAgXG4gICAgICAvLyBBZGQgcGFkZGluZ1xuICAgICAgY29uc3QgcGFkZGluZyA9IDIwO1xuICAgICAgbWluWCAtPSBwYWRkaW5nO1xuICAgICAgbWluWSAtPSBwYWRkaW5nO1xuICAgICAgbWF4WCArPSBwYWRkaW5nO1xuICAgICAgbWF4WSArPSBwYWRkaW5nO1xuICAgICAgXG4gICAgICAvLyBVc2UgY29sb3IgZnJvbSBwYWxldHRlIChjeWNsZSBpZiBtb3JlIGNsdXN0ZXJzIHRoYW4gY29sb3JzKVxuICAgICAgY29uc3QgY29sb3JJbmRleCA9IHBhcnNlSW50KGNsdXN0ZXJJZCkgJSBjb2xvcnMubGVuZ3RoO1xuICAgICAgY29uc3QgY29sb3IgPSBjb2xvcnNbY29sb3JJbmRleF07XG4gICAgICBcbiAgICAgIC8vIERyYXcgYSByb3VuZGVkIHJlY3RhbmdsZSBhcm91bmQgdGhlIGNsdXN0ZXJcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9IGNvbG9yLmZpbGw7XG4gICAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9IGNvbG9yLnN0cm9rZTtcbiAgICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgICBcbiAgICAgIHRoaXMucm91bmRSZWN0KFxuICAgICAgICBtaW5YLCBcbiAgICAgICAgbWluWSwgXG4gICAgICAgIG1heFggLSBtaW5YLCBcbiAgICAgICAgbWF4WSAtIG1pblksIFxuICAgICAgICAxMFxuICAgICAgKTtcbiAgICAgIFxuICAgICAgdGhpcy5jdHguZmlsbCgpO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgICBcbiAgICAgIC8vIERyYXcgY2x1c3RlciBsYWJlbCB3aXRoIHRvcCB0ZXJtcyBpZiBhdmFpbGFibGVcbiAgICAgIGlmICh0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zICYmIHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXSkge1xuICAgICAgICBjb25zdCB0ZXJtcyA9IHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXVxuICAgICAgICAgIC5zbGljZSgwLCAzKSAgLy8gVGFrZSB0b3AgMyB0ZXJtc1xuICAgICAgICAgIC5tYXAodCA9PiB0LnRlcm0pXG4gICAgICAgICAgLmpvaW4oJywgJyk7XG4gICAgICAgIFxuICAgICAgICAvLyBEcmF3IGEgbGFiZWwgd2l0aCBjbHVzdGVyIElEIGFuZCB0b3AgdGVybXNcbiAgICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3ZhcigtLXRleHQtbm9ybWFsKSc7XG4gICAgICAgIHRoaXMuY3R4LmZvbnQgPSAnYm9sZCAxMnB4IHZhcigtLWZvbnQtdGV4dCknO1xuICAgICAgICB0aGlzLmN0eC50ZXh0QWxpZ24gPSAnY2VudGVyJztcbiAgICAgICAgdGhpcy5jdHguZmlsbFRleHQoYENsdXN0ZXIgJHtjbHVzdGVySWR9OiAke3Rlcm1zfWAsIGNlbnRlclgsIG1pblkgLSA1KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBcbiAgcHJpdmF0ZSByb3VuZFJlY3QoeDogbnVtYmVyLCB5OiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCByYWRpdXM6IG51bWJlcikge1xuICAgIHRoaXMuY3R4LmJlZ2luUGF0aCgpO1xuICAgIHRoaXMuY3R4Lm1vdmVUbyh4ICsgcmFkaXVzLCB5KTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCArIHdpZHRoIC0gcmFkaXVzLCB5KTtcbiAgICB0aGlzLmN0eC5hcmNUbyh4ICsgd2lkdGgsIHksIHggKyB3aWR0aCwgeSArIHJhZGl1cywgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCArIHdpZHRoLCB5ICsgaGVpZ2h0IC0gcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5hcmNUbyh4ICsgd2lkdGgsIHkgKyBoZWlnaHQsIHggKyB3aWR0aCAtIHJhZGl1cywgeSArIGhlaWdodCwgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCArIHJhZGl1cywgeSArIGhlaWdodCk7XG4gICAgdGhpcy5jdHguYXJjVG8oeCwgeSArIGhlaWdodCwgeCwgeSArIGhlaWdodCAtIHJhZGl1cywgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCwgeSArIHJhZGl1cyk7XG4gICAgdGhpcy5jdHguYXJjVG8oeCwgeSwgeCArIHJhZGl1cywgeSwgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5jbG9zZVBhdGgoKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBkcmF3UG9pbnQocG9pbnQ6IFRTTkVQb2ludCkge1xuICAgIGNvbnN0IFt4LCB5XSA9IHRoaXMud29ybGRUb1NjcmVlbihwb2ludC54LCBwb2ludC55KTtcbiAgICBcbiAgICAvLyBDb2xvciBwYWxldHRlIGZvciBjbHVzdGVyc1xuICAgIGNvbnN0IGNsdXN0ZXJDb2xvcnMgPSBbXG4gICAgICAncmdiYSgyNTUsIDk5LCAxMzIsIDEpJywgICAgLy8gcmVkXG4gICAgICAncmdiYSg1NCwgMTYyLCAyMzUsIDEpJywgICAgLy8gYmx1ZVxuICAgICAgJ3JnYmEoMjU1LCAyMDYsIDg2LCAxKScsICAgIC8vIHllbGxvd1xuICAgICAgJ3JnYmEoNzUsIDE5MiwgMTkyLCAxKScsICAgIC8vIGdyZWVuXG4gICAgICAncmdiYSgxNTMsIDEwMiwgMjU1LCAxKScsICAgLy8gcHVycGxlXG4gICAgICAncmdiYSgyNTUsIDE1OSwgNjQsIDEpJywgICAgLy8gb3JhbmdlXG4gICAgICAncmdiYSgxOTksIDE5OSwgMTk5LCAxKScsICAgLy8gZ3JleVxuICAgIF07XG4gICAgXG4gICAgLy8gRHJhdyBjaXJjbGVcbiAgICB0aGlzLmN0eC5iZWdpblBhdGgoKTtcbiAgICB0aGlzLmN0eC5hcmMoeCwgeSwgdGhpcy5wb2ludFJhZGl1cywgMCwgTWF0aC5QSSAqIDIpO1xuICAgIFxuICAgIC8vIERldGVybWluZSBjb2xvciBiYXNlZCBvbiBob3ZlciBzdGF0ZSBhbmQgY2x1c3RlclxuICAgIGlmICh0aGlzLmhvdmVyZWRQb2ludCA9PT0gcG9pbnQpIHtcbiAgICAgIC8vIEhvdmVyZWQgcG9pbnRzIGFyZSBhbHdheXMgaGlnaGxpZ2h0ZWQgaW4gdGhlIGFjY2VudCBjb2xvclxuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3ZhcigtLWludGVyYWN0aXZlLWFjY2VudCknO1xuICAgIH0gZWxzZSBpZiAocG9pbnQuY2x1c3RlciA9PT0gLTEpIHtcbiAgICAgIC8vIE5vaXNlIHBvaW50cyAobm90IGluIGEgY2x1c3RlcikgYXJlIGdyZXlcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS10ZXh0LW11dGVkKSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFBvaW50cyBpbiBjbHVzdGVycyB1c2UgdGhlIGNsdXN0ZXIgY29sb3IgcGFsZXR0ZVxuICAgICAgY29uc3QgY29sb3JJbmRleCA9IHBvaW50LmNsdXN0ZXIgJSBjbHVzdGVyQ29sb3JzLmxlbmd0aDtcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9IGNsdXN0ZXJDb2xvcnNbY29sb3JJbmRleF07XG4gICAgfVxuICAgIFxuICAgIHRoaXMuY3R4LmZpbGwoKTtcbiAgICBcbiAgICAvLyBBZGQgYm9yZGVyIHRvIHBvaW50c1xuICAgIHRoaXMuY3R4LnN0cm9rZVN0eWxlID0gJ3ZhcigtLWJhY2tncm91bmQtcHJpbWFyeSknO1xuICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgXG4gICAgLy8gRHJhdyB0aXRsZSBpZiBub3QgaG92ZXJlZCAoaG92ZXJlZCBzaG93cyBpbiB0b29sdGlwKVxuICAgIGlmICh0aGlzLmhvdmVyZWRQb2ludCAhPT0gcG9pbnQpIHtcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS10ZXh0LW5vcm1hbCknO1xuICAgICAgdGhpcy5jdHguZm9udCA9ICcxMnB4IHZhcigtLWZvbnQtdGV4dCknO1xuICAgICAgdGhpcy5jdHgudGV4dEFsaWduID0gJ2NlbnRlcic7XG4gICAgICB0aGlzLmN0eC5maWxsVGV4dChwb2ludC50aXRsZSwgeCwgeSAtIHRoaXMucG9pbnRSYWRpdXMgLSA1KTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhd1Rvb2x0aXAoKSB7XG4gICAgaWYgKCF0aGlzLmhvdmVyZWRQb2ludCB8fCAhdGhpcy5yZXN1bHQpIHJldHVybjtcbiAgICBcbiAgICBjb25zdCBbeCwgeV0gPSB0aGlzLndvcmxkVG9TY3JlZW4odGhpcy5ob3ZlcmVkUG9pbnQueCwgdGhpcy5ob3ZlcmVkUG9pbnQueSk7XG4gICAgY29uc3QgcG9pbnQgPSB0aGlzLmhvdmVyZWRQb2ludDtcbiAgICBcbiAgICAvLyBUb29sdGlwIGNvbnRlbnRcbiAgICBjb25zdCB0aXRsZSA9IHBvaW50LnRpdGxlO1xuICAgIGNvbnN0IHBhdGggPSBwb2ludC5wYXRoO1xuICAgIGNvbnN0IHRlcm1zID0gcG9pbnQudG9wX3Rlcm1zLmpvaW4oJywgJyk7XG4gICAgXG4gICAgLy8gRm9ybWF0IGRhdGVzIGlmIGF2YWlsYWJsZVxuICAgIGNvbnN0IGZvcm1hdERhdGUgPSAodGltZXN0YW1wPzogbnVtYmVyKSA9PiB7XG4gICAgICBpZiAoIXRpbWVzdGFtcCkgcmV0dXJuICdVbmtub3duJztcbiAgICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSh0aW1lc3RhbXApO1xuICAgICAgcmV0dXJuIGRhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKCkgKyAnICcgKyBkYXRlLnRvTG9jYWxlVGltZVN0cmluZyhbXSwgeyBob3VyOiAnMi1kaWdpdCcsIG1pbnV0ZTogJzItZGlnaXQnIH0pO1xuICAgIH07XG4gICAgXG4gICAgLy8gR2V0IG1ldGFkYXRhXG4gICAgY29uc3QgbW9kaWZpZWQgPSBmb3JtYXREYXRlKHBvaW50Lm10aW1lKTtcbiAgICBjb25zdCBjcmVhdGVkID0gZm9ybWF0RGF0ZShwb2ludC5jdGltZSk7XG4gICAgY29uc3Qgd29yZENvdW50ID0gcG9pbnQud29yZENvdW50ID8gYCR7cG9pbnQud29yZENvdW50fSB3b3Jkc2AgOiAnVW5rbm93bic7XG4gICAgY29uc3QgcmVhZGluZ1RpbWUgPSBwb2ludC5yZWFkaW5nVGltZSA/IGB+JHtwb2ludC5yZWFkaW5nVGltZX0gbWluIHJlYWRgIDogJyc7XG4gICAgXG4gICAgLy8gRm9ybWF0IHRhZ3NcbiAgICBjb25zdCB0YWdzID0gcG9pbnQudGFncyAmJiBwb2ludC50YWdzLmxlbmd0aCA+IDAgXG4gICAgICA/IHBvaW50LnRhZ3MubWFwKHRhZyA9PiBgIyR7dGFnfWApLmpvaW4oJyAnKVxuICAgICAgOiAnTm8gdGFncyc7XG4gICAgXG4gICAgLy8gRm9ybWF0IGNvbnRlbnQgcHJldmlld1xuICAgIGNvbnN0IHByZXZpZXcgPSBwb2ludC5jb250ZW50UHJldmlldyB8fCAnTm8gcHJldmlldyBhdmFpbGFibGUnO1xuICAgIFxuICAgIC8vIEdldCBkaXN0YW5jZSB0byBjZW50ZXJcbiAgICBjb25zdCBkaXN0YW5jZUluZm8gPSBwb2ludC5kaXN0YW5jZVRvQ2VudGVyICE9PSB1bmRlZmluZWQgJiYgcG9pbnQuY2x1c3RlciAhPT0gLTFcbiAgICAgID8gYERpc3RhbmNlIHRvIGNlbnRlcjogJHtwb2ludC5kaXN0YW5jZVRvQ2VudGVyLnRvRml4ZWQoMil9YFxuICAgICAgOiAnJztcbiAgICBcbiAgICAvLyBHZXQgY2x1c3RlciBpbmZvcm1hdGlvblxuICAgIGxldCBjbHVzdGVySW5mbyA9ICdOb3QgY2x1c3RlcmVkJztcbiAgICBpZiAocG9pbnQuY2x1c3RlciAhPT0gLTEpIHtcbiAgICAgIGNvbnN0IGNsdXN0ZXJJZCA9IHBvaW50LmNsdXN0ZXI7XG4gICAgICBcbiAgICAgIC8vIEdldCBjbHVzdGVyIHRlcm1zIGlmIGF2YWlsYWJsZVxuICAgICAgbGV0IGNsdXN0ZXJUZXJtcyA9ICcnO1xuICAgICAgaWYgKHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXMgJiYgdGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtc1tjbHVzdGVySWRdKSB7XG4gICAgICAgIGNsdXN0ZXJUZXJtcyA9IHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXVxuICAgICAgICAgIC5zbGljZSgwLCAzKSAvLyBUYWtlIHRvcCAzIHRlcm1zXG4gICAgICAgICAgLm1hcCh0ID0+IHQudGVybSlcbiAgICAgICAgICAuam9pbignLCAnKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2x1c3RlckluZm8gPSBgQ2x1c3RlciAke2NsdXN0ZXJJZH06ICR7Y2x1c3RlclRlcm1zfWA7XG4gICAgfVxuICAgIFxuICAgIC8vIERlZmluZSBhbGwgdG9vbHRpcCBzZWN0aW9uc1xuICAgIGNvbnN0IHNlY3Rpb25zID0gW1xuICAgICAgeyBsYWJlbDogJ1RpdGxlJywgdGV4dDogdGl0bGUsIGZvbnQ6ICdib2xkIDE0cHggdmFyKC0tZm9udC10ZXh0KScgfSxcbiAgICAgIHsgbGFiZWw6ICdQYXRoJywgdGV4dDogcGF0aCB9LFxuICAgICAgeyBsYWJlbDogJ0tleXdvcmRzJywgdGV4dDogdGVybXMgfSxcbiAgICAgIHsgbGFiZWw6ICdDbHVzdGVyJywgdGV4dDogY2x1c3RlckluZm8gfSxcbiAgICAgIHsgbGFiZWw6ICdUYWdzJywgdGV4dDogdGFncyB9LFxuICAgICAgeyBsYWJlbDogJ01vZGlmaWVkJywgdGV4dDogbW9kaWZpZWQgfSxcbiAgICAgIHsgbGFiZWw6ICdDcmVhdGVkJywgdGV4dDogY3JlYXRlZCB9LFxuICAgICAgeyBsYWJlbDogJ1N0YXRzJywgdGV4dDogYCR7d29yZENvdW50fSAke3JlYWRpbmdUaW1lfWAgfSxcbiAgICAgIHsgbGFiZWw6ICdQcmV2aWV3JywgdGV4dDogcHJldmlldywgb3B0aW9uYWw6IHRydWUgfSxcbiAgICAgIHsgbGFiZWw6ICcnLCB0ZXh0OiBkaXN0YW5jZUluZm8sIHNraXBJZkVtcHR5OiB0cnVlIH1cbiAgICBdO1xuICAgIFxuICAgIC8vIENhbGN1bGF0ZSB0b29sdGlwIGRpbWVuc2lvbnNcbiAgICB0aGlzLmN0eC5mb250ID0gJ2JvbGQgMTRweCB2YXIoLS1mb250LXRleHQpJztcbiAgICBsZXQgdG9vbHRpcFdpZHRoID0gdGhpcy5jdHgubWVhc3VyZVRleHQodGl0bGUpLndpZHRoO1xuICAgIFxuICAgIHRoaXMuY3R4LmZvbnQgPSAnMTJweCB2YXIoLS1mb250LXRleHQpJztcbiAgICBzZWN0aW9ucy5mb3JFYWNoKHNlY3Rpb24gPT4ge1xuICAgICAgaWYgKCFzZWN0aW9uLnNraXBJZkVtcHR5IHx8IHNlY3Rpb24udGV4dCkge1xuICAgICAgICBjb25zdCB3aWR0aCA9IHRoaXMuY3R4Lm1lYXN1cmVUZXh0KFxuICAgICAgICAgIHNlY3Rpb24ubGFiZWwgPyBgJHtzZWN0aW9uLmxhYmVsfTogJHtzZWN0aW9uLnRleHR9YCA6IHNlY3Rpb24udGV4dFxuICAgICAgICApLndpZHRoO1xuICAgICAgICB0b29sdGlwV2lkdGggPSBNYXRoLm1heCh0b29sdGlwV2lkdGgsIHdpZHRoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICB0b29sdGlwV2lkdGggKz0gMjA7IC8vIEFkZCBwYWRkaW5nXG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIHRvb2x0aXAgaGVpZ2h0IChtb3JlIHNlY3Rpb25zIG5vdylcbiAgICBjb25zdCBsaW5lSGVpZ2h0ID0gMjA7XG4gICAgLy8gQ291bnQgaG93IG1hbnkgc2VjdGlvbnMgd2lsbCBiZSB2aXNpYmxlXG4gICAgY29uc3QgdmlzaWJsZVNlY3Rpb25zID0gc2VjdGlvbnMuZmlsdGVyKHMgPT4gIXMub3B0aW9uYWwgJiYgKCFzLnNraXBJZkVtcHR5IHx8IHMudGV4dCkpLmxlbmd0aDtcbiAgICBjb25zb2xlLmxvZyhgVmlzaWJsZSBzZWN0aW9uczogJHt2aXNpYmxlU2VjdGlvbnN9YCk7XG4gICAgLy8gQWRkIHNvbWUgZXh0cmEgcGFkZGluZyB0byBlbnN1cmUgYWxsIHRleHQgZml0c1xuICAgIGNvbnN0IHRvb2x0aXBIZWlnaHQgPSAodmlzaWJsZVNlY3Rpb25zICsgMSkgKiBsaW5lSGVpZ2h0ICsgMjA7XG4gICAgXG4gICAgLy8gUG9zaXRpb24gdG9vbHRpcFxuICAgIGNvbnN0IHRvb2x0aXBYID0gTWF0aC5taW4oeCArIDEwLCB0aGlzLndpZHRoIC0gdG9vbHRpcFdpZHRoIC0gMTApO1xuICAgIGNvbnN0IHRvb2x0aXBZID0gTWF0aC5taW4oeSAtIDEwLCB0aGlzLmhlaWdodCAtIHRvb2x0aXBIZWlnaHQgLSAxMCk7XG4gICAgXG4gICAgLy8gRHJhdyB0b29sdGlwIGJhY2tncm91bmQgd2l0aCBzb2xpZCBjb2xvcnMgaW5zdGVhZCBvZiBDU1MgdmFyaWFibGVzXG4gICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3JnYmEoMjU1LCAyNTUsIDI1NSwgMC45NSknOyAvLyBOZWFybHkgb3BhcXVlIHdoaXRlIGJhY2tncm91bmRcbiAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9ICcjNjY2NjY2JzsgLy8gTWVkaXVtIGdyYXkgYm9yZGVyXG4gICAgdGhpcy5jdHgubGluZVdpZHRoID0gMTtcbiAgICBcbiAgICB0aGlzLnJvdW5kUmVjdCh0b29sdGlwWCwgdG9vbHRpcFksIHRvb2x0aXBXaWR0aCwgdG9vbHRpcEhlaWdodCwgNSk7XG4gICAgdGhpcy5jdHguZmlsbCgpO1xuICAgIHRoaXMuY3R4LnN0cm9rZSgpO1xuICAgIFxuICAgIC8vIEFkZCBhIGRlYnVnIHJlY3RhbmdsZSB0byBlbnN1cmUgdGhlIHRvb2x0aXAgYXJlYSBpcyByZW5kZXJlZFxuICAgIHRoaXMuY3R4LnN0cm9rZVN0eWxlID0gJyNGRjAwMDAnOyAvLyBSZWQgb3V0bGluZSBmb3IgZGVidWdnaW5nXG4gICAgdGhpcy5jdHguc3Ryb2tlUmVjdCh0b29sdGlwWCwgdG9vbHRpcFksIHRvb2x0aXBXaWR0aCwgdG9vbHRpcEhlaWdodCk7XG4gICAgXG4gICAgLy8gRHJhdyB0b29sdGlwIGNvbnRlbnQgLSB1c2UgYSBzb2xpZCBjb2xvciBpbnN0ZWFkIG9mIENTUyB2YXJpYWJsZVxuICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICcjMDAwMDAwJzsgLy8gQmxhY2sgdGV4dCBzaG91bGQgYmUgdmlzaWJsZSBvbiBhbnkgYmFja2dyb3VuZFxuICAgIHRoaXMuY3R4LnRleHRBbGlnbiA9ICdsZWZ0JztcbiAgICBcbiAgICAvLyBEZWJ1ZyB0aGUgdG9vbHRpcCBkaW1lbnNpb25zXG4gICAgY29uc29sZS5sb2coYERyYXdpbmcgdG9vbHRpcDogJHt0b29sdGlwV2lkdGh9eCR7dG9vbHRpcEhlaWdodH0gYXQgJHt0b29sdGlwWH0sJHt0b29sdGlwWX1gKTtcbiAgICBcbiAgICAvLyBEcmF3IGVhY2ggc2VjdGlvblxuICAgIGxldCBjdXJyZW50WSA9IHRvb2x0aXBZICsgMjA7XG4gICAgc2VjdGlvbnMuZm9yRWFjaChzZWN0aW9uID0+IHtcbiAgICAgIGlmIChzZWN0aW9uLm9wdGlvbmFsIHx8IChzZWN0aW9uLnNraXBJZkVtcHR5ICYmICFzZWN0aW9uLnRleHQpKSByZXR1cm47XG4gICAgICBcbiAgICAgIHRoaXMuY3R4LmZvbnQgPSBzZWN0aW9uLmZvbnQgfHwgJzEycHggc2Fucy1zZXJpZic7IC8vIFVzZSBzYW5zLXNlcmlmIGluc3RlYWQgb2YgQ1NTIHZhcmlhYmxlXG4gICAgICBcbiAgICAgIGNvbnN0IHRleHQgPSBzZWN0aW9uLmxhYmVsXG4gICAgICAgID8gYCR7c2VjdGlvbi5sYWJlbH06ICR7c2VjdGlvbi50ZXh0fWBcbiAgICAgICAgOiBzZWN0aW9uLnRleHQ7XG4gICAgICBcbiAgICAgIC8vIERlYnVnIGVhY2ggbGluZSBvZiB0ZXh0XG4gICAgICBjb25zb2xlLmxvZyhgRHJhd2luZyB0ZXh0IGF0ICR7dG9vbHRpcFggKyAxMH0sJHtjdXJyZW50WX06ICR7dGV4dH1gKTtcbiAgICAgIFxuICAgICAgdGhpcy5jdHguZmlsbFRleHQodGV4dCwgdG9vbHRpcFggKyAxMCwgY3VycmVudFkpO1xuICAgICAgY3VycmVudFkgKz0gbGluZUhlaWdodDtcbiAgICB9KTtcbiAgfVxufVxuXG5jbGFzcyBTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHBsdWdpbjogVmliZUJveVBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBWaWJlQm95UGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7Y29udGFpbmVyRWx9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywge3RleHQ6ICdWaWJlIEJvaSAtIHQtU05FIFNldHRpbmdzJ30pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnUGVycGxleGl0eScpXG4gICAgICAuc2V0RGVzYygnQ29udHJvbHMgdGhlIGJhbGFuY2UgYmV0d2VlbiBsb2NhbCBhbmQgZ2xvYmFsIGFzcGVjdHMgb2YgdGhlIGRhdGEgKHJlY29tbWVuZGVkOiA1LTUwKScpXG4gICAgICAuYWRkU2xpZGVyKHNsaWRlciA9PiBzbGlkZXJcbiAgICAgICAgLnNldExpbWl0cyg1LCAxMDAsIDUpXG4gICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5wZXJwbGV4aXR5KVxuICAgICAgICAuc2V0RHluYW1pY1Rvb2x0aXAoKVxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucGVycGxleGl0eSA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdJdGVyYXRpb25zJylcbiAgICAgIC5zZXREZXNjKCdOdW1iZXIgb2YgaXRlcmF0aW9ucyB0byBydW4gdGhlIGFsZ29yaXRobScpXG4gICAgICAuYWRkU2xpZGVyKHNsaWRlciA9PiBzbGlkZXJcbiAgICAgICAgLnNldExpbWl0cygyNTAsIDIwMDAsIDI1MClcbiAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLml0ZXJhdGlvbnMpXG4gICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pdGVyYXRpb25zID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pKTtcbiAgICAgICAgXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnRXBzaWxvbiAobGVhcm5pbmcgcmF0ZSknKVxuICAgICAgLnNldERlc2MoJ0NvbnRyb2xzIHRoZSBzcGVlZCBvZiBvcHRpbWl6YXRpb24nKVxuICAgICAgLmFkZFNsaWRlcihzbGlkZXIgPT4gc2xpZGVyXG4gICAgICAgIC5zZXRMaW1pdHMoMSwgMTAwLCAxKVxuICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZXBzaWxvbilcbiAgICAgICAgLnNldER5bmFtaWNUb29sdGlwKClcbiAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmVwc2lsb24gPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkpO1xuICB9XG59Il0sIm5hbWVzIjpbIkl0ZW1WaWV3IiwiTm90aWNlIiwiUGx1Z2luIiwiVEZpbGUiLCJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFvR0E7QUFDTyxTQUFTLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUU7QUFDN0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEtBQUssWUFBWSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsT0FBTyxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUss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
