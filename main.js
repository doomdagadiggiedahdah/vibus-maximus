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
        // Tooltip content
        const title = this.hoveredPoint.title;
        const path = this.hoveredPoint.path;
        const terms = this.hoveredPoint.top_terms.join(', ');
        // Get cluster information
        let clusterInfo = 'Not clustered';
        if (this.hoveredPoint.cluster !== -1) {
            const clusterId = this.hoveredPoint.cluster;
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
        // Prepare text
        this.ctx.font = 'bold 14px var(--font-text)';
        const titleWidth = this.ctx.measureText(title).width;
        this.ctx.font = '12px var(--font-text)';
        const pathWidth = this.ctx.measureText(path).width;
        const termsWidth = this.ctx.measureText(`Keywords: ${terms}`).width;
        const clusterWidth = this.ctx.measureText(`Cluster: ${clusterInfo}`).width;
        // Calculate tooltip dimensions
        const tooltipWidth = Math.max(titleWidth, pathWidth, termsWidth, clusterWidth) + 20;
        const tooltipHeight = 95; // Increased height for the cluster info
        const tooltipX = Math.min(x + 10, this.width - tooltipWidth - 10);
        const tooltipY = Math.min(y - 10, this.height - tooltipHeight - 10);
        // Draw tooltip background
        this.ctx.fillStyle = 'var(--background-primary)';
        this.ctx.strokeStyle = 'var(--background-modifier-border)';
        this.ctx.lineWidth = 1;
        this.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 5);
        this.ctx.fill();
        this.ctx.stroke();
        // Draw tooltip content
        this.ctx.fillStyle = 'var(--text-normal)';
        this.ctx.textAlign = 'left';
        this.ctx.font = 'bold 14px var(--font-text)';
        this.ctx.fillText(title, tooltipX + 10, tooltipY + 20);
        this.ctx.font = '12px var(--font-text)';
        this.ctx.fillText(path, tooltipX + 10, tooltipY + 40);
        this.ctx.fillText(`Keywords: ${terms}`, tooltipX + 10, tooltipY + 60);
        // Add cluster information
        this.ctx.fillText(`Cluster: ${clusterInfo}`, tooltipX + 10, tooltipY + 80);
    }
}

// Modal for displaying and processing suggested links
class SuggestedLinksModal extends obsidian.Modal {
    constructor(app, connections, plugin) {
        super(app);
        this.selectedConnectionIndex = 0;
        this.processingConnection = false;
        this.connections = connections;
        this.plugin = plugin;
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            const { contentEl } = this;
            // Set modal title
            contentEl.createEl('h2', { text: 'Suggested Note Connections' });
            contentEl.createEl('p', {
                text: 'Below are potential connections between notes based on content similarity. ' +
                    'Select a connection and generate a description to create a link between the notes.'
            });
            // Create container for connections list
            const connectionsContainer = contentEl.createDiv({ cls: 'connections-container' });
            // Create container for selected connection details
            const detailsContainer = contentEl.createDiv({ cls: 'connection-details' });
            // Add some CSS
            const style = document.createElement('style');
            style.textContent = `
      .connections-container {
        max-height: 150px;
        overflow-y: auto;
        margin-bottom: 15px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
      }
      .connection-item {
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid var(--background-modifier-border);
      }
      .connection-item:hover {
        background-color: var(--background-secondary);
      }
      .connection-item.selected {
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
      }
      .connection-details {
        padding: 10px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        margin-bottom: 15px;
      }
      .connection-stats {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .generate-button {
        margin-top: 10px;
        margin-bottom: 10px;
      }
      .llm-description {
        margin-top: 10px;
        width: 100%;
        min-height: 100px;
      }
      .button-container {
        display: flex;
        justify-content: space-between;
        margin-top: 15px;
      }
    `;
            document.head.appendChild(style);
            // Render connections list
            this.renderConnectionsList(connectionsContainer);
            // Render details for the first connection
            this.renderConnectionDetails(detailsContainer, this.connections[0]);
            // Focus the first connection
            this.selectConnection(0);
        });
    }
    renderConnectionsList(container) {
        container.empty();
        this.connections.forEach((connection, index) => {
            const item = container.createDiv({ cls: 'connection-item' });
            if (index === this.selectedConnectionIndex) {
                item.addClass('selected');
            }
            const sourceTitle = connection.sourceNote.title;
            const targetTitle = connection.targetNote.title;
            const similarity = Math.round(connection.similarity);
            item.createEl('div', { text: `${sourceTitle} ↔ ${targetTitle} (${similarity}% similarity)` });
            item.addEventListener('click', () => {
                this.selectConnection(index);
            });
        });
    }
    renderConnectionDetails(container, connection) {
        container.empty();
        const sourceNote = connection.sourceNote;
        const targetNote = connection.targetNote;
        // Note titles and paths
        container.createEl('h3', { text: `Connection: ${sourceNote.title} ↔ ${targetNote.title}` });
        container.createEl('div', { text: `Source: ${sourceNote.path}` });
        container.createEl('div', { text: `Target: ${targetNote.path}` });
        // Stats
        const statsDiv = container.createDiv({ cls: 'connection-stats' });
        statsDiv.createEl('div', { text: `Similarity: ${Math.round(connection.similarity)}%` });
        statsDiv.createEl('div', { text: `${sourceNote.wordCount || '?'} words / ${targetNote.wordCount || '?'} words` });
        // Shared terms
        if (connection.commonTerms.length > 0) {
            container.createEl('div', { text: `Common terms: ${connection.commonTerms.join(', ')}` });
        }
        // Cluster terms
        if (connection.clusterTerms.length > 0) {
            container.createEl('div', { text: `Cluster terms: ${connection.clusterTerms.join(', ')}` });
        }
        // Reason for connection
        container.createEl('div', { text: `Connection reason: ${connection.reason}` });
        // Generate description button
        const generateButton = new obsidian.ButtonComponent(container)
            .setButtonText('Generate Connection Description')
            .setCta() // Use setCta() instead of setClass with spaces
            .onClick(() => __awaiter(this, void 0, void 0, function* () {
            yield this.generateLLMDescription(connection);
        }));
        // Add class without spaces
        generateButton.buttonEl.addClass('generate-button');
        if (this.processingConnection) {
            generateButton.setDisabled(true);
            generateButton.setButtonText('Generating...');
        }
        // Description text area
        if (connection.llmDescription) {
            const descriptionContainer = container.createDiv();
            descriptionContainer.createEl('h4', { text: 'Connection Description:' });
            const textArea = new obsidian.TextAreaComponent(descriptionContainer)
                .setValue(connection.llmDescription)
                .setPlaceholder('Connection description will appear here...');
            textArea.inputEl.addClass('llm-description');
            // Create button
            const buttonContainer = container.createDiv({ cls: 'button-container' });
            new obsidian.ButtonComponent(buttonContainer)
                .setButtonText('Create Link')
                .setCta() // Use setCta() instead of setClass with spaces
                .onClick(() => __awaiter(this, void 0, void 0, function* () {
                this.createLink(connection, textArea.getValue());
            }));
            new obsidian.ButtonComponent(buttonContainer)
                .setButtonText('Edit Description')
                .onClick(() => {
                textArea.setDisabled(false);
                textArea.inputEl.focus();
            });
        }
    }
    selectConnection(index) {
        if (index < 0 || index >= this.connections.length)
            return;
        this.selectedConnectionIndex = index;
        const connectionContainer = this.contentEl.querySelector('.connections-container');
        const detailsContainer = this.contentEl.querySelector('.connection-details');
        if (connectionContainer && detailsContainer) {
            this.renderConnectionsList(connectionContainer);
            this.renderConnectionDetails(detailsContainer, this.connections[index]);
        }
    }
    generateLLMDescription(connection) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.processingConnection)
                return;
            this.processingConnection = true;
            const detailsContainer = this.contentEl.querySelector('.connection-details');
            this.renderConnectionDetails(detailsContainer, connection);
            try {
                // Fetch source and target note content
                const sourceFile = this.app.vault.getAbstractFileByPath(connection.sourceNote.path);
                const targetFile = this.app.vault.getAbstractFileByPath(connection.targetNote.path);
                if (!(sourceFile instanceof obsidian.TFile) || !(targetFile instanceof obsidian.TFile)) {
                    throw new Error('Could not find note files');
                }
                const sourceContent = yield this.app.vault.read(sourceFile);
                const targetContent = yield this.app.vault.read(targetFile);
                // Prepare data for LLM call
                const data = {
                    sourceNote: {
                        title: connection.sourceNote.title,
                        content: sourceContent.substring(0, 1000),
                        topTerms: connection.sourceNote.top_terms
                    },
                    targetNote: {
                        title: connection.targetNote.title,
                        content: targetContent.substring(0, 1000),
                        topTerms: connection.targetNote.top_terms
                    },
                    commonTerms: connection.commonTerms,
                    clusterTerms: connection.clusterTerms,
                    reason: connection.reason
                };
                // Call the LLM service
                const description = yield this.callLLMService(data);
                // Update the connection with the generated description
                connection.llmDescription = description;
                // Update the UI
                this.processingConnection = false;
                const detailsContainer = this.contentEl.querySelector('.connection-details');
                this.renderConnectionDetails(detailsContainer, connection);
            }
            catch (error) {
                this.processingConnection = false;
                console.error('Error generating description:', error);
                new obsidian.Notice(`Failed to generate description: ${error.message}`);
                // Update UI to show error
                const detailsContainer = this.contentEl.querySelector('.connection-details');
                this.renderConnectionDetails(detailsContainer, connection);
            }
        });
    }
    callLLMService(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Try to connect to the local LLM API server
                const sourceTitle = data.sourceNote.title;
                const targetTitle = data.targetNote.title;
                const sourceContent = data.sourceNote.content;
                const targetContent = data.targetNote.content;
                const commonTerms = data.commonTerms.join(', ');
                const clusterTerms = data.clusterTerms.join(', ');
                // First, try to use the Python server's LLM integration
                const response = yield fetch('http://127.0.0.1:1234/generate_connection', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        source_note: {
                            title: sourceTitle,
                            content: sourceContent,
                            terms: data.sourceNote.topTerms
                        },
                        target_note: {
                            title: targetTitle,
                            content: targetContent,
                            terms: data.targetNote.topTerms
                        },
                        common_terms: data.commonTerms,
                        cluster_terms: data.clusterTerms
                    })
                });
                if (response.ok) {
                    const result = yield response.json();
                    if (result.description) {
                        return result.description;
                    }
                }
                // If server call fails or not available, use fallback logic
                console.log("Using fallback connection description generation");
                // Create a template-based description (fallback)
                let description = '';
                if (commonTerms) {
                    description += `These notes share conceptual overlap around ${commonTerms}. `;
                }
                else {
                    description += `These notes appear to be conceptually related. `;
                }
                description += `The note "${targetTitle}" provides complementary information that expands on ideas in "${sourceTitle}"`;
                if (clusterTerms) {
                    description += `, particularly regarding ${clusterTerms}.`;
                }
                else {
                    description += '.';
                }
                return description;
            }
            catch (error) {
                console.error('Error calling LLM service:', error);
                // Return a basic description as fallback
                return `These notes appear to be related in their content. The note "${data.targetNote.title}" complements "${data.sourceNote.title}" with additional relevant information.`;
            }
        });
    }
    createLink(connection, description) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!description || description.trim().length === 0) {
                new obsidian.Notice('Please generate or provide a description for the connection');
                return;
            }
            // Close the modal first so it doesn't interfere with the note opening
            this.close();
            // Create the link - this will also open the source note
            const success = yield this.plugin.createNoteLink(connection.sourceNote.path, connection.targetNote.path, description);
            if (success) {
                // Open the target note in a split pane after a short delay to let the source note open
                setTimeout(() => {
                    try {
                        // Also offer option to view the target note
                        const targetFile = this.app.vault.getAbstractFileByPath(connection.targetNote.path);
                        if (targetFile instanceof obsidian.TFile) {
                            // Create a modal asking if user wants to open the target note
                            const modal = new obsidian.Modal(this.app);
                            const { contentEl } = modal;
                            // Add some styling
                            const style = document.createElement('style');
                            style.textContent = `
              .success-modal {
                padding: 20px;
                text-align: center;
              }
              .success-icon {
                font-size: 36px;
                margin-bottom: 15px;
                color: var(--interactive-accent);
              }
              .success-title {
                margin-bottom: 10px;
                color: var(--interactive-accent);
              }
              .note-info {
                margin-bottom: 20px;
                font-style: italic;
              }
              .confirmation-question {
                margin-bottom: 20px;
                font-weight: bold;
              }
              .modal-button-container {
                display: flex;
                justify-content: space-around;
                margin-top: 20px;
              }
            `;
                            document.head.appendChild(style);
                            // Create the modal content with styling
                            const container = contentEl.createDiv({ cls: 'success-modal' });
                            // Success icon - using emoji for simplicity
                            container.createDiv({ cls: 'success-icon', text: '🔗' });
                            container.createEl('h2', {
                                text: `Link Created Successfully!`,
                                cls: 'success-title'
                            });
                            container.createEl('p', {
                                text: `A link to "${connection.targetNote.title}" has been added to "${connection.sourceNote.title}".`,
                                cls: 'note-info'
                            });
                            container.createEl('p', {
                                text: `Would you like to open "${connection.targetNote.title}" as well?`,
                                cls: 'confirmation-question'
                            });
                            const buttonContainer = container.createDiv({ cls: 'modal-button-container' });
                            // Button to open the target note
                            const openButton = new obsidian.ButtonComponent(buttonContainer)
                                .setButtonText(`Open "${connection.targetNote.title}"`)
                                .setCta()
                                .onClick(() => {
                                // Open in a new leaf (split pane)
                                const leaf = this.app.workspace.createLeafBySplit(this.app.workspace.activeLeaf, 'vertical');
                                leaf.openFile(targetFile);
                                modal.close();
                            });
                            // Button to stay on the current note
                            new obsidian.ButtonComponent(buttonContainer)
                                .setButtonText('Stay on current note')
                                .onClick(() => {
                                modal.close();
                            });
                            modal.open();
                        }
                    }
                    catch (error) {
                        console.error('Error opening target note:', error);
                    }
                }, 500);
            }
        });
    }
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
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
                // Create parameter control panel
                const paramPanel = header.createEl("div", { cls: "tsne-param-panel" });
                paramPanel.style.marginBottom = "15px";
                paramPanel.style.display = "flex";
                paramPanel.style.flexWrap = "wrap";
                paramPanel.style.gap = "15px";
                paramPanel.style.alignItems = "center";
                // Add perplexity slider
                const plugin = this.app.plugins.plugins["vibe-boi"];
                // Perplexity control
                const perplexityContainer = paramPanel.createEl("div", { cls: "tsne-param-container" });
                perplexityContainer.style.display = "flex";
                perplexityContainer.style.alignItems = "center";
                perplexityContainer.style.gap = "10px";
                const perplexityLabel = perplexityContainer.createEl("label", { text: "Perplexity:" });
                perplexityLabel.style.minWidth = "80px";
                const perplexityValue = perplexityContainer.createEl("span", {
                    text: plugin.settings.perplexity.toString(),
                    cls: "tsne-param-value"
                });
                perplexityValue.style.minWidth = "30px";
                perplexityValue.style.textAlign = "center";
                const perplexitySlider = perplexityContainer.createEl("input", {
                    type: "range",
                    cls: "tsne-param-slider"
                });
                perplexitySlider.setAttribute("min", "5");
                perplexitySlider.setAttribute("max", "100");
                perplexitySlider.setAttribute("step", "5");
                perplexitySlider.setAttribute("value", plugin.settings.perplexity.toString());
                perplexitySlider.addEventListener("input", (e) => __awaiter(this, void 0, void 0, function* () {
                    const value = parseInt(e.target.value);
                    perplexityValue.textContent = value.toString();
                    plugin.settings.perplexity = value;
                    yield plugin.saveSettings();
                }));
                // Iterations control
                const iterationsContainer = paramPanel.createEl("div", { cls: "tsne-param-container" });
                iterationsContainer.style.display = "flex";
                iterationsContainer.style.alignItems = "center";
                iterationsContainer.style.gap = "10px";
                const iterationsLabel = iterationsContainer.createEl("label", { text: "Iterations:" });
                iterationsLabel.style.minWidth = "80px";
                const iterationsValue = iterationsContainer.createEl("span", {
                    text: plugin.settings.iterations.toString(),
                    cls: "tsne-param-value"
                });
                iterationsValue.style.minWidth = "30px";
                iterationsValue.style.textAlign = "center";
                const iterationsSlider = iterationsContainer.createEl("input", {
                    type: "range",
                    cls: "tsne-param-slider"
                });
                iterationsSlider.setAttribute("min", "250");
                iterationsSlider.setAttribute("max", "2000");
                iterationsSlider.setAttribute("step", "250");
                iterationsSlider.setAttribute("value", plugin.settings.iterations.toString());
                iterationsSlider.addEventListener("input", (e) => __awaiter(this, void 0, void 0, function* () {
                    const value = parseInt(e.target.value);
                    iterationsValue.textContent = value.toString();
                    plugin.settings.iterations = value;
                    yield plugin.saveSettings();
                }));
                // Action buttons
                const runButton = actionBar.createEl("button", { text: "Run Analysis", cls: "mod-cta" });
                runButton.addEventListener("click", () => {
                    // Get the plugin instance and run t-SNE
                    plugin.runTSNE();
                });
                const suggestLinksButton = actionBar.createEl("button", { text: "Suggest Links", cls: "mod-cta" });
                suggestLinksButton.addEventListener("click", () => {
                    // Suggest links
                    plugin.suggestLinks();
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
        flex-direction: column;
        margin-bottom: 1rem;
      }
      .tsne-header h2 {
        margin-bottom: 1rem;
      }
      .tsne-actions {
        display: flex;
        gap: 10px;
        margin-top: 1rem;
        align-self: flex-end;
      }
      .tsne-param-panel {
        background-color: var(--background-secondary);
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 10px;
      }
      .tsne-param-slider {
        width: 150px;
      }
      .tsne-param-value {
        font-weight: bold;
        min-width: 30px;
        display: inline-block;
        text-align: center;
      }
      .tsne-info {
        margin-bottom: 1rem;
        opacity: 0.8;
      }
      .tsne-container {
        width: 100%;
        height: 800px;
        margin: 1rem 0;
        border-radius: 4px;
        overflow-x: auto;
        overflow-y: auto;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      }
      .tsne-status {
        margin-top: 10px;
        padding: 0.5rem;
        border-radius: 4px;
        background-color: var(--background-secondary);
        width: 100%;
        text-align: center;
      }
      .tsne-status-text {
        margin: 0;
        font-size: 0.9rem;
        opacity: 0.8;
      }
      .tsne-control-panel {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
      }
      .tsne-button-group button {
        transition: background-color 0.2s, color 0.2s;
      }
      .tsne-button-group button:first-child {
        border-radius: 4px 0 0 4px;
      }
      .tsne-button-group button:last-child {
        border-radius: 0 4px 4px 0;
      }
    `;
            document.head.appendChild(style);
        });
    }
}
class VibeBoyPlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        // Store the last result for use in link suggestions
        this.lastResult = null;
    }
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
                // Store the result for later use in link suggestions
                this.lastResult = result;
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
    // Method to suggest links between notes using LLM
    suggestLinks() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.lastResult || !this.lastResult.points || this.lastResult.points.length === 0) {
                new obsidian.Notice('Please run t-SNE analysis first to generate note data');
                return;
            }
            // Show a notice that we're starting the process
            new obsidian.Notice('Finding potential note connections...');
            try {
                // Find potential connections based on t-SNE proximity and clustering
                const connections = this.findPotentialConnections(this.lastResult);
                if (connections.length === 0) {
                    new obsidian.Notice('No strong connections found between notes');
                    return;
                }
                // Create a modal to display the suggested connections
                const modal = new SuggestedLinksModal(this.app, connections, this);
                modal.open();
            }
            catch (error) {
                console.error('Error suggesting links:', error);
                new obsidian.Notice(`Error suggesting links: ${error.message}`);
            }
        });
    }
    // Find potential connections between notes based on t-SNE results
    findPotentialConnections(result) {
        const connections = [];
        const points = result.points;
        // 1. Find notes in the same cluster
        const clusterGroups = {};
        // Group points by cluster
        for (const point of points) {
            if (point.cluster === -1)
                continue; // Skip unclustered points
            if (!clusterGroups[point.cluster]) {
                clusterGroups[point.cluster] = [];
            }
            clusterGroups[point.cluster].push(point);
        }
        // For each cluster, find the most central notes
        Object.entries(clusterGroups).forEach(([clusterId, clusterPoints]) => {
            var _a, _b;
            // Only consider clusters with at least 2 notes
            if (clusterPoints.length < 2)
                return;
            // Find most central notes in the cluster (closest to cluster center)
            clusterPoints.sort((a, b) => {
                const distA = a.distanceToCenter || Infinity;
                const distB = b.distanceToCenter || Infinity;
                return distA - distB;
            });
            // Take the most central notes
            const centralNotes = clusterPoints.slice(0, Math.min(3, clusterPoints.length));
            // Create connections between the central notes
            for (let i = 0; i < centralNotes.length; i++) {
                for (let j = i + 1; j < centralNotes.length; j++) {
                    const noteA = centralNotes[i];
                    const noteB = centralNotes[j];
                    // Skip if the two notes are very far apart in the visualization
                    const distance = Math.sqrt(Math.pow(noteA.x - noteB.x, 2) + Math.pow(noteA.y - noteB.y, 2));
                    if (distance > 0.5)
                        continue; // Skip if too far
                    // Calculate a similarity score (0-100)
                    const similarity = 100 - Math.min(100, distance * 100);
                    // Find common terms
                    const commonTerms = noteA.top_terms.filter(term => noteB.top_terms.includes(term));
                    connections.push({
                        sourceNote: noteA,
                        targetNote: noteB,
                        similarity: similarity,
                        commonTerms: commonTerms,
                        clusterTerms: ((_b = (_a = result.cluster_terms) === null || _a === void 0 ? void 0 : _a[clusterId]) === null || _b === void 0 ? void 0 : _b.slice(0, 5).map((t) => t.term)) || [],
                        reason: `Both notes are central in cluster ${clusterId}`
                    });
                }
            }
        });
        // 2. Find notes that are close in the t-SNE projection but may be in different clusters
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const noteA = points[i];
                const noteB = points[j];
                // Skip notes in the same cluster (already handled above)
                if (noteA.cluster !== -1 && noteA.cluster === noteB.cluster)
                    continue;
                // Calculate Euclidean distance in t-SNE space
                const distance = Math.sqrt(Math.pow(noteA.x - noteB.x, 2) + Math.pow(noteA.y - noteB.y, 2));
                // Only consider very close notes
                if (distance > 0.2)
                    continue;
                // Calculate a similarity score (0-100)
                const similarity = 100 - Math.min(100, distance * 200);
                // Find common terms
                const commonTerms = noteA.top_terms.filter(term => noteB.top_terms.includes(term));
                // Only include if they have common terms
                if (commonTerms.length > 0) {
                    connections.push({
                        sourceNote: noteA,
                        targetNote: noteB,
                        similarity: similarity,
                        commonTerms: commonTerms,
                        clusterTerms: [],
                        reason: `Notes are very close in the visualization and share common terms`
                    });
                }
            }
        }
        // Sort connections by similarity (highest first)
        connections.sort((a, b) => b.similarity - a.similarity);
        // Return top 10 connections to avoid overwhelming the user
        return connections.slice(0, 10);
    }
    // Create a link between two notes
    createNoteLink(sourceNotePath, targetNotePath, description) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get the source file
                const sourceFile = this.app.vault.getAbstractFileByPath(sourceNotePath);
                if (!(sourceFile instanceof obsidian.TFile)) {
                    throw new Error(`Source file not found: ${sourceNotePath}`);
                }
                // Read the file content
                const sourceContent = yield this.app.vault.read(sourceFile);
                // Generate the link text with the formatted connection description
                const targetFileName = targetNotePath.split('/').pop() || targetNotePath;
                const linkText = `\n\n## Related Notes\n\n- [[${targetFileName}]] - ${description.trim()}\n`;
                // Append the link to the source file
                yield this.app.vault.modify(sourceFile, sourceContent + linkText);
                // Open the source file in a new pane to show the link
                const leaf = this.app.workspace.getLeaf(this.app.workspace.activeLeaf !== null &&
                    this.app.workspace.activeLeaf !== undefined);
                yield leaf.openFile(sourceFile, {
                    active: true,
                    eState: {
                        line: sourceContent.split('\n').length + 2,
                        focus: true // Focus the editor
                    }
                });
                // Show a success notice
                new obsidian.Notice("Link created successfully! 🔗", 2000);
                return true;
            }
            catch (error) {
                console.error('Error creating note link:', error);
                new obsidian.Notice(`Failed to create link: ${error.message}`);
                return false;
            }
        });
    }
}
// TSNEVisualizer is now imported from visualization.ts
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9vYnNpZGlhbi1wbHVnaW4vdmlzdWFsaXphdGlvbi50cyIsInNyYy9vYnNpZGlhbi1wbHVnaW4vbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuLyogZ2xvYmFsIFJlZmxlY3QsIFByb21pc2UsIFN1cHByZXNzZWRFcnJvciwgU3ltYm9sLCBJdGVyYXRvciAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19lc0RlY29yYXRlKGN0b3IsIGRlc2NyaXB0b3JJbiwgZGVjb3JhdG9ycywgY29udGV4dEluLCBpbml0aWFsaXplcnMsIGV4dHJhSW5pdGlhbGl6ZXJzKSB7XHJcbiAgICBmdW5jdGlvbiBhY2NlcHQoZikgeyBpZiAoZiAhPT0gdm9pZCAwICYmIHR5cGVvZiBmICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGdW5jdGlvbiBleHBlY3RlZFwiKTsgcmV0dXJuIGY7IH1cclxuICAgIHZhciBraW5kID0gY29udGV4dEluLmtpbmQsIGtleSA9IGtpbmQgPT09IFwiZ2V0dGVyXCIgPyBcImdldFwiIDoga2luZCA9PT0gXCJzZXR0ZXJcIiA/IFwic2V0XCIgOiBcInZhbHVlXCI7XHJcbiAgICB2YXIgdGFyZ2V0ID0gIWRlc2NyaXB0b3JJbiAmJiBjdG9yID8gY29udGV4dEluW1wic3RhdGljXCJdID8gY3RvciA6IGN0b3IucHJvdG90eXBlIDogbnVsbDtcclxuICAgIHZhciBkZXNjcmlwdG9yID0gZGVzY3JpcHRvckluIHx8ICh0YXJnZXQgPyBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgY29udGV4dEluLm5hbWUpIDoge30pO1xyXG4gICAgdmFyIF8sIGRvbmUgPSBmYWxzZTtcclxuICAgIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgICAgdmFyIGNvbnRleHQgPSB7fTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbikgY29udGV4dFtwXSA9IHAgPT09IFwiYWNjZXNzXCIgPyB7fSA6IGNvbnRleHRJbltwXTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbi5hY2Nlc3MpIGNvbnRleHQuYWNjZXNzW3BdID0gY29udGV4dEluLmFjY2Vzc1twXTtcclxuICAgICAgICBjb250ZXh0LmFkZEluaXRpYWxpemVyID0gZnVuY3Rpb24gKGYpIHsgaWYgKGRvbmUpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgYWRkIGluaXRpYWxpemVycyBhZnRlciBkZWNvcmF0aW9uIGhhcyBjb21wbGV0ZWRcIik7IGV4dHJhSW5pdGlhbGl6ZXJzLnB1c2goYWNjZXB0KGYgfHwgbnVsbCkpOyB9O1xyXG4gICAgICAgIHZhciByZXN1bHQgPSAoMCwgZGVjb3JhdG9yc1tpXSkoa2luZCA9PT0gXCJhY2Nlc3NvclwiID8geyBnZXQ6IGRlc2NyaXB0b3IuZ2V0LCBzZXQ6IGRlc2NyaXB0b3Iuc2V0IH0gOiBkZXNjcmlwdG9yW2tleV0sIGNvbnRleHQpO1xyXG4gICAgICAgIGlmIChraW5kID09PSBcImFjY2Vzc29yXCIpIHtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gdm9pZCAwKSBjb250aW51ZTtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCB8fCB0eXBlb2YgcmVzdWx0ICE9PSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkXCIpO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuZ2V0KSkgZGVzY3JpcHRvci5nZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuc2V0KSkgZGVzY3JpcHRvci5zZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuaW5pdCkpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChfID0gYWNjZXB0KHJlc3VsdCkpIHtcclxuICAgICAgICAgICAgaWYgKGtpbmQgPT09IFwiZmllbGRcIikgaW5pdGlhbGl6ZXJzLnVuc2hpZnQoXyk7XHJcbiAgICAgICAgICAgIGVsc2UgZGVzY3JpcHRvcltrZXldID0gXztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAodGFyZ2V0KSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBjb250ZXh0SW4ubmFtZSwgZGVzY3JpcHRvcik7XHJcbiAgICBkb25lID0gdHJ1ZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3J1bkluaXRpYWxpemVycyh0aGlzQXJnLCBpbml0aWFsaXplcnMsIHZhbHVlKSB7XHJcbiAgICB2YXIgdXNlVmFsdWUgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5pdGlhbGl6ZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFsdWUgPSB1c2VWYWx1ZSA/IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcsIHZhbHVlKSA6IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHVzZVZhbHVlID8gdmFsdWUgOiB2b2lkIDA7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wcm9wS2V5KHgpIHtcclxuICAgIHJldHVybiB0eXBlb2YgeCA9PT0gXCJzeW1ib2xcIiA/IHggOiBcIlwiLmNvbmNhdCh4KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NldEZ1bmN0aW9uTmFtZShmLCBuYW1lLCBwcmVmaXgpIHtcclxuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gXCJzeW1ib2xcIikgbmFtZSA9IG5hbWUuZGVzY3JpcHRpb24gPyBcIltcIi5jb25jYXQobmFtZS5kZXNjcmlwdGlvbiwgXCJdXCIpIDogXCJcIjtcclxuICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkoZiwgXCJuYW1lXCIsIHsgY29uZmlndXJhYmxlOiB0cnVlLCB2YWx1ZTogcHJlZml4ID8gXCJcIi5jb25jYXQocHJlZml4LCBcIiBcIiwgbmFtZSkgOiBuYW1lIH0pO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpIHtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5tZXRhZGF0YSA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gUmVmbGVjdC5tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0ZXIodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19nZW5lcmF0b3IodGhpc0FyZywgYm9keSkge1xyXG4gICAgdmFyIF8gPSB7IGxhYmVsOiAwLCBzZW50OiBmdW5jdGlvbigpIHsgaWYgKHRbMF0gJiAxKSB0aHJvdyB0WzFdOyByZXR1cm4gdFsxXTsgfSwgdHJ5czogW10sIG9wczogW10gfSwgZiwgeSwgdCwgZyA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBJdGVyYXRvciA9PT0gXCJmdW5jdGlvblwiID8gSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSk7XHJcbiAgICByZXR1cm4gZy5uZXh0ID0gdmVyYigwKSwgZ1tcInRocm93XCJdID0gdmVyYigxKSwgZ1tcInJldHVyblwiXSA9IHZlcmIoMiksIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoZyAmJiAoZyA9IDAsIG9wWzBdICYmIChfID0gMCkpLCBfKSB0cnkge1xyXG4gICAgICAgICAgICBpZiAoZiA9IDEsIHkgJiYgKHQgPSBvcFswXSAmIDIgPyB5W1wicmV0dXJuXCJdIDogb3BbMF0gPyB5W1widGhyb3dcIl0gfHwgKCh0ID0geVtcInJldHVyblwiXSkgJiYgdC5jYWxsKHkpLCAwKSA6IHkubmV4dCkgJiYgISh0ID0gdC5jYWxsKHksIG9wWzFdKSkuZG9uZSkgcmV0dXJuIHQ7XHJcbiAgICAgICAgICAgIGlmICh5ID0gMCwgdCkgb3AgPSBbb3BbMF0gJiAyLCB0LnZhbHVlXTtcclxuICAgICAgICAgICAgc3dpdGNoIChvcFswXSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAwOiBjYXNlIDE6IHQgPSBvcDsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDQ6IF8ubGFiZWwrKzsgcmV0dXJuIHsgdmFsdWU6IG9wWzFdLCBkb25lOiBmYWxzZSB9O1xyXG4gICAgICAgICAgICAgICAgY2FzZSA1OiBfLmxhYmVsKys7IHkgPSBvcFsxXTsgb3AgPSBbMF07IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA3OiBvcCA9IF8ub3BzLnBvcCgpOyBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBpZiAoISh0ID0gXy50cnlzLCB0ID0gdC5sZW5ndGggPiAwICYmIHRbdC5sZW5ndGggLSAxXSkgJiYgKG9wWzBdID09PSA2IHx8IG9wWzBdID09PSAyKSkgeyBfID0gMDsgY29udGludWU7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDMgJiYgKCF0IHx8IChvcFsxXSA+IHRbMF0gJiYgb3BbMV0gPCB0WzNdKSkpIHsgXy5sYWJlbCA9IG9wWzFdOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gNiAmJiBfLmxhYmVsIDwgdFsxXSkgeyBfLmxhYmVsID0gdFsxXTsgdCA9IG9wOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ICYmIF8ubGFiZWwgPCB0WzJdKSB7IF8ubGFiZWwgPSB0WzJdOyBfLm9wcy5wdXNoKG9wKTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodFsyXSkgXy5vcHMucG9wKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvcCA9IGJvZHkuY2FsbCh0aGlzQXJnLCBfKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7IG9wID0gWzYsIGVdOyB5ID0gMDsgfSBmaW5hbGx5IHsgZiA9IHQgPSAwOyB9XHJcbiAgICAgICAgaWYgKG9wWzBdICYgNSkgdGhyb3cgb3BbMV07IHJldHVybiB7IHZhbHVlOiBvcFswXSA/IG9wWzFdIDogdm9pZCAwLCBkb25lOiB0cnVlIH07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19jcmVhdGVCaW5kaW5nID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihtLCBrKTtcclxuICAgIGlmICghZGVzYyB8fCAoXCJnZXRcIiBpbiBkZXNjID8gIW0uX19lc01vZHVsZSA6IGRlc2Mud3JpdGFibGUgfHwgZGVzYy5jb25maWd1cmFibGUpKSB7XHJcbiAgICAgICAgZGVzYyA9IHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfTtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBrMiwgZGVzYyk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tLCBwYWNrKSB7XHJcbiAgICBpZiAocGFjayB8fCBhcmd1bWVudHMubGVuZ3RoID09PSAyKSBmb3IgKHZhciBpID0gMCwgbCA9IGZyb20ubGVuZ3RoLCBhcjsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmIChhciB8fCAhKGkgaW4gZnJvbSkpIHtcclxuICAgICAgICAgICAgaWYgKCFhcikgYXIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tLCAwLCBpKTtcclxuICAgICAgICAgICAgYXJbaV0gPSBmcm9tW2ldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0by5jb25jYXQoYXIgfHwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSkpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdCh2KSB7XHJcbiAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIF9fYXdhaXQgPyAodGhpcy52ID0gdiwgdGhpcykgOiBuZXcgX19hd2FpdCh2KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNHZW5lcmF0b3IodGhpc0FyZywgX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIGcgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSksIGksIHEgPSBbXTtcclxuICAgIHJldHVybiBpID0gT2JqZWN0LmNyZWF0ZSgodHlwZW9mIEFzeW5jSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEFzeW5jSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSksIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiwgYXdhaXRSZXR1cm4pLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiBhd2FpdFJldHVybihmKSB7IHJldHVybiBmdW5jdGlvbiAodikgeyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZiwgcmVqZWN0KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlmIChnW25dKSB7IGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IGlmIChmKSBpW25dID0gZihpW25dKTsgfSB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogZmFsc2UgfSA6IGYgPyBmKHYpIDogdjsgfSA6IGY7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNWYWx1ZXMobykge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBtID0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sIGk7XHJcbiAgICByZXR1cm4gbSA/IG0uY2FsbChvKSA6IChvID0gdHlwZW9mIF9fdmFsdWVzID09PSBcImZ1bmN0aW9uXCIgPyBfX3ZhbHVlcyhvKSA6IG9bU3ltYm9sLml0ZXJhdG9yXSgpLCBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaSk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaVtuXSA9IG9bbl0gJiYgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgdiA9IG9bbl0odiksIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHYuZG9uZSwgdi52YWx1ZSk7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCBkLCB2KSB7IFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGZ1bmN0aW9uKHYpIHsgcmVzb2x2ZSh7IHZhbHVlOiB2LCBkb25lOiBkIH0pOyB9LCByZWplY3QpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdykge1xyXG4gICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkgeyBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29va2VkLCBcInJhd1wiLCB7IHZhbHVlOiByYXcgfSk7IH0gZWxzZSB7IGNvb2tlZC5yYXcgPSByYXc7IH1cclxuICAgIHJldHVybiBjb29rZWQ7XHJcbn07XHJcblxyXG52YXIgX19zZXRNb2R1bGVEZWZhdWx0ID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgXCJkZWZhdWx0XCIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgdmFsdWU6IHYgfSk7XHJcbn0pIDogZnVuY3Rpb24obywgdikge1xyXG4gICAgb1tcImRlZmF1bHRcIl0gPSB2O1xyXG59O1xyXG5cclxudmFyIG93bktleXMgPSBmdW5jdGlvbihvKSB7XHJcbiAgICBvd25LZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgfHwgZnVuY3Rpb24gKG8pIHtcclxuICAgICAgICB2YXIgYXIgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBrIGluIG8pIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgaykpIGFyW2FyLmxlbmd0aF0gPSBrO1xyXG4gICAgICAgIHJldHVybiBhcjtcclxuICAgIH07XHJcbiAgICByZXR1cm4gb3duS2V5cyhvKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrID0gb3duS2V5cyhtb2QpLCBpID0gMDsgaSA8IGsubGVuZ3RoOyBpKyspIGlmIChrW2ldICE9PSBcImRlZmF1bHRcIikgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrW2ldKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRJbihzdGF0ZSwgcmVjZWl2ZXIpIHtcclxuICAgIGlmIChyZWNlaXZlciA9PT0gbnVsbCB8fCAodHlwZW9mIHJlY2VpdmVyICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiByZWNlaXZlciAhPT0gXCJmdW5jdGlvblwiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgJ2luJyBvcGVyYXRvciBvbiBub24tb2JqZWN0XCIpO1xyXG4gICAgcmV0dXJuIHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgPT09IHN0YXRlIDogc3RhdGUuaGFzKHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlKGVudiwgdmFsdWUsIGFzeW5jKSB7XHJcbiAgICBpZiAodmFsdWUgIT09IG51bGwgJiYgdmFsdWUgIT09IHZvaWQgMCkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgZXhwZWN0ZWQuXCIpO1xyXG4gICAgICAgIHZhciBkaXNwb3NlLCBpbm5lcjtcclxuICAgICAgICBpZiAoYXN5bmMpIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuYXN5bmNEaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jRGlzcG9zZSBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICAgICAgICAgIGRpc3Bvc2UgPSB2YWx1ZVtTeW1ib2wuYXN5bmNEaXNwb3NlXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGRpc3Bvc2UgPT09IHZvaWQgMCkge1xyXG4gICAgICAgICAgICBpZiAoIVN5bWJvbC5kaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmRpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmRpc3Bvc2VdO1xyXG4gICAgICAgICAgICBpZiAoYXN5bmMpIGlubmVyID0gZGlzcG9zZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkaXNwb3NlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3Qgbm90IGRpc3Bvc2FibGUuXCIpO1xyXG4gICAgICAgIGlmIChpbm5lcikgZGlzcG9zZSA9IGZ1bmN0aW9uKCkgeyB0cnkgeyBpbm5lci5jYWxsKHRoaXMpOyB9IGNhdGNoIChlKSB7IHJldHVybiBQcm9taXNlLnJlamVjdChlKTsgfSB9O1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgdmFsdWU6IHZhbHVlLCBkaXNwb3NlOiBkaXNwb3NlLCBhc3luYzogYXN5bmMgfSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChhc3luYykge1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgYXN5bmM6IHRydWUgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcblxyXG59XHJcblxyXG52YXIgX1N1cHByZXNzZWRFcnJvciA9IHR5cGVvZiBTdXBwcmVzc2VkRXJyb3IgPT09IFwiZnVuY3Rpb25cIiA/IFN1cHByZXNzZWRFcnJvciA6IGZ1bmN0aW9uIChlcnJvciwgc3VwcHJlc3NlZCwgbWVzc2FnZSkge1xyXG4gICAgdmFyIGUgPSBuZXcgRXJyb3IobWVzc2FnZSk7XHJcbiAgICByZXR1cm4gZS5uYW1lID0gXCJTdXBwcmVzc2VkRXJyb3JcIiwgZS5lcnJvciA9IGVycm9yLCBlLnN1cHByZXNzZWQgPSBzdXBwcmVzc2VkLCBlO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGlzcG9zZVJlc291cmNlcyhlbnYpIHtcclxuICAgIGZ1bmN0aW9uIGZhaWwoZSkge1xyXG4gICAgICAgIGVudi5lcnJvciA9IGVudi5oYXNFcnJvciA/IG5ldyBfU3VwcHJlc3NlZEVycm9yKGUsIGVudi5lcnJvciwgXCJBbiBlcnJvciB3YXMgc3VwcHJlc3NlZCBkdXJpbmcgZGlzcG9zYWwuXCIpIDogZTtcclxuICAgICAgICBlbnYuaGFzRXJyb3IgPSB0cnVlO1xyXG4gICAgfVxyXG4gICAgdmFyIHIsIHMgPSAwO1xyXG4gICAgZnVuY3Rpb24gbmV4dCgpIHtcclxuICAgICAgICB3aGlsZSAociA9IGVudi5zdGFjay5wb3AoKSkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFyLmFzeW5jICYmIHMgPT09IDEpIHJldHVybiBzID0gMCwgZW52LnN0YWNrLnB1c2gociksIFByb21pc2UucmVzb2x2ZSgpLnRoZW4obmV4dCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoci5kaXNwb3NlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHIuZGlzcG9zZS5jYWxsKHIudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChyLmFzeW5jKSByZXR1cm4gcyB8PSAyLCBQcm9taXNlLnJlc29sdmUocmVzdWx0KS50aGVuKG5leHQsIGZ1bmN0aW9uKGUpIHsgZmFpbChlKTsgcmV0dXJuIG5leHQoKTsgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHMgfD0gMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgZmFpbChlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocyA9PT0gMSkgcmV0dXJuIGVudi5oYXNFcnJvciA/IFByb21pc2UucmVqZWN0KGVudi5lcnJvcikgOiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgICBpZiAoZW52Lmhhc0Vycm9yKSB0aHJvdyBlbnYuZXJyb3I7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV4dCgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24ocGF0aCwgcHJlc2VydmVKc3gpIHtcclxuICAgIGlmICh0eXBlb2YgcGF0aCA9PT0gXCJzdHJpbmdcIiAmJiAvXlxcLlxcLj9cXC8vLnRlc3QocGF0aCkpIHtcclxuICAgICAgICByZXR1cm4gcGF0aC5yZXBsYWNlKC9cXC4odHN4KSR8KCg/OlxcLmQpPykoKD86XFwuW14uL10rPyk/KVxcLihbY21dPyl0cyQvaSwgZnVuY3Rpb24gKG0sIHRzeCwgZCwgZXh0LCBjbSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHN4ID8gcHJlc2VydmVKc3ggPyBcIi5qc3hcIiA6IFwiLmpzXCIgOiBkICYmICghZXh0IHx8ICFjbSkgPyBtIDogKGQgKyBleHQgKyBcIi5cIiArIGNtLnRvTG93ZXJDYXNlKCkgKyBcImpzXCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBhdGg7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIF9fZXh0ZW5kczogX19leHRlbmRzLFxyXG4gICAgX19hc3NpZ246IF9fYXNzaWduLFxyXG4gICAgX19yZXN0OiBfX3Jlc3QsXHJcbiAgICBfX2RlY29yYXRlOiBfX2RlY29yYXRlLFxyXG4gICAgX19wYXJhbTogX19wYXJhbSxcclxuICAgIF9fZXNEZWNvcmF0ZTogX19lc0RlY29yYXRlLFxyXG4gICAgX19ydW5Jbml0aWFsaXplcnM6IF9fcnVuSW5pdGlhbGl6ZXJzLFxyXG4gICAgX19wcm9wS2V5OiBfX3Byb3BLZXksXHJcbiAgICBfX3NldEZ1bmN0aW9uTmFtZTogX19zZXRGdW5jdGlvbk5hbWUsXHJcbiAgICBfX21ldGFkYXRhOiBfX21ldGFkYXRhLFxyXG4gICAgX19hd2FpdGVyOiBfX2F3YWl0ZXIsXHJcbiAgICBfX2dlbmVyYXRvcjogX19nZW5lcmF0b3IsXHJcbiAgICBfX2NyZWF0ZUJpbmRpbmc6IF9fY3JlYXRlQmluZGluZyxcclxuICAgIF9fZXhwb3J0U3RhcjogX19leHBvcnRTdGFyLFxyXG4gICAgX192YWx1ZXM6IF9fdmFsdWVzLFxyXG4gICAgX19yZWFkOiBfX3JlYWQsXHJcbiAgICBfX3NwcmVhZDogX19zcHJlYWQsXHJcbiAgICBfX3NwcmVhZEFycmF5czogX19zcHJlYWRBcnJheXMsXHJcbiAgICBfX3NwcmVhZEFycmF5OiBfX3NwcmVhZEFycmF5LFxyXG4gICAgX19hd2FpdDogX19hd2FpdCxcclxuICAgIF9fYXN5bmNHZW5lcmF0b3I6IF9fYXN5bmNHZW5lcmF0b3IsXHJcbiAgICBfX2FzeW5jRGVsZWdhdG9yOiBfX2FzeW5jRGVsZWdhdG9yLFxyXG4gICAgX19hc3luY1ZhbHVlczogX19hc3luY1ZhbHVlcyxcclxuICAgIF9fbWFrZVRlbXBsYXRlT2JqZWN0OiBfX21ha2VUZW1wbGF0ZU9iamVjdCxcclxuICAgIF9faW1wb3J0U3RhcjogX19pbXBvcnRTdGFyLFxyXG4gICAgX19pbXBvcnREZWZhdWx0OiBfX2ltcG9ydERlZmF1bHQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0OiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldDogX19jbGFzc1ByaXZhdGVGaWVsZFNldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRJbjogX19jbGFzc1ByaXZhdGVGaWVsZEluLFxyXG4gICAgX19hZGREaXNwb3NhYmxlUmVzb3VyY2U6IF9fYWRkRGlzcG9zYWJsZVJlc291cmNlLFxyXG4gICAgX19kaXNwb3NlUmVzb3VyY2VzOiBfX2Rpc3Bvc2VSZXNvdXJjZXMsXHJcbiAgICBfX3Jld3JpdGVSZWxhdGl2ZUltcG9ydEV4dGVuc2lvbjogX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24sXHJcbn07XHJcbiIsImltcG9ydCB7IFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vLyBJbnRlcmZhY2UgZm9yIHQtU05FIHJlc3VsdCBwb2ludHNcbmludGVyZmFjZSBUU05FUG9pbnQge1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgdGl0bGU6IHN0cmluZztcbiAgcGF0aDogc3RyaW5nO1xuICB0b3BfdGVybXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyOiBudW1iZXI7IC8vIENsdXN0ZXIgSUQgKC0xIG1lYW5zIG5vaXNlL25vdCBjbHVzdGVyZWQpXG59XG5cbi8vIEludGVyZmFjZSBmb3IgY2x1c3RlciB0ZXJtIGluZm9ybWF0aW9uXG5pbnRlcmZhY2UgQ2x1c3RlclRlcm0ge1xuICB0ZXJtOiBzdHJpbmc7XG4gIHNjb3JlOiBudW1iZXI7XG59XG5cbi8vIEludGVyZmFjZSBmb3IgY2x1c3RlciBpbmZvcm1hdGlvblxuaW50ZXJmYWNlIENsdXN0ZXJJbmZvIHtcbiAgW2tleTogc3RyaW5nXTogQ2x1c3RlclRlcm1bXTtcbn1cblxuLy8gSW50ZXJmYWNlIGZvciB0LVNORSByZXN1bHRzXG5pbnRlcmZhY2UgVFNORVJlc3VsdCB7XG4gIHBvaW50czogVFNORVBvaW50W107XG4gIGZlYXR1cmVfbmFtZXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyczogbnVtYmVyO1xuICBjbHVzdGVyX3Rlcm1zOiBDbHVzdGVySW5mbztcbn1cblxuZXhwb3J0IGNsYXNzIFRTTkVWaXN1YWxpemVyIHtcbiAgcHJpdmF0ZSBjb250YWluZXI6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQ7XG4gIHByaXZhdGUgY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG4gIHByaXZhdGUgcmVzdWx0OiBUU05FUmVzdWx0IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgd2lkdGggPSA4MDA7XG4gIHByaXZhdGUgaGVpZ2h0ID0gNjAwO1xuICBwcml2YXRlIHBvaW50UmFkaXVzID0gMTA7XG4gIHByaXZhdGUgbW91c2VYID0gMDtcbiAgcHJpdmF0ZSBtb3VzZVkgPSAwO1xuICBwcml2YXRlIHNjYWxlID0gMTtcbiAgcHJpdmF0ZSBvZmZzZXRYID0gMDtcbiAgcHJpdmF0ZSBvZmZzZXRZID0gMDtcbiAgcHJpdmF0ZSBpc0RyYWdnaW5nID0gZmFsc2U7XG4gIHByaXZhdGUgbGFzdFggPSAwO1xuICBwcml2YXRlIGxhc3RZID0gMDtcbiAgcHJpdmF0ZSBob3ZlcmVkUG9pbnQ6IFRTTkVQb2ludCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIG9wZW5DYWxsYmFjazogKHBhdGg6IHN0cmluZykgPT4gdm9pZDtcblxuICBjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBvcGVuQ2FsbGJhY2s6IChwYXRoOiBzdHJpbmcpID0+IHZvaWQpIHtcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICB0aGlzLm9wZW5DYWxsYmFjayA9IG9wZW5DYWxsYmFjaztcbiAgICBcbiAgICAvLyBDcmVhdGUgY2FudmFzIGVsZW1lbnRcbiAgICB0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIHRoaXMuY2FudmFzLndpZHRoID0gdGhpcy53aWR0aDtcbiAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSB0aGlzLmhlaWdodDtcbiAgICB0aGlzLmNhbnZhcy5jbGFzc0xpc3QuYWRkKCd0c25lLWNhbnZhcycpO1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLmJvcmRlciA9ICcxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpJztcbiAgICBcbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBpZiAoIWNvbnRleHQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGNyZWF0ZSBjYW52YXMgY29udGV4dCcpO1xuICAgIH1cbiAgICB0aGlzLmN0eCA9IGNvbnRleHQ7XG4gICAgXG4gICAgLy8gQ2xlYXIgdGhlIGNvbnRhaW5lciBmaXJzdFxuICAgIHdoaWxlICh0aGlzLmNvbnRhaW5lci5maXJzdENoaWxkKSB7XG4gICAgICB0aGlzLmNvbnRhaW5lci5yZW1vdmVDaGlsZCh0aGlzLmNvbnRhaW5lci5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQWRkIGNhbnZhcyB0byBjb250YWluZXJcbiAgICB0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLmNhbnZhcyk7XG4gICAgXG4gICAgLy8gQWRkIGV2ZW50IGxpc3RlbmVyc1xuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnMoKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhZGRFdmVudExpc3RlbmVycygpIHtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmhhbmRsZU1vdXNlTW92ZS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuaGFuZGxlQ2xpY2suYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignd2hlZWwnLCB0aGlzLmhhbmRsZVdoZWVsLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMuaGFuZGxlTW91c2VEb3duLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmhhbmRsZU1vdXNlVXAuYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsIHRoaXMuaGFuZGxlTW91c2VVcC5iaW5kKHRoaXMpKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZU1vdmUoZTogTW91c2VFdmVudCkge1xuICAgIGNvbnN0IHJlY3QgPSB0aGlzLmNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB0aGlzLm1vdXNlWCA9IGUuY2xpZW50WCAtIHJlY3QubGVmdDtcbiAgICB0aGlzLm1vdXNlWSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xuICAgIFxuICAgIGlmICh0aGlzLmlzRHJhZ2dpbmcpIHtcbiAgICAgIGNvbnN0IGR4ID0gdGhpcy5tb3VzZVggLSB0aGlzLmxhc3RYO1xuICAgICAgY29uc3QgZHkgPSB0aGlzLm1vdXNlWSAtIHRoaXMubGFzdFk7XG4gICAgICBcbiAgICAgIHRoaXMub2Zmc2V0WCArPSBkeDtcbiAgICAgIHRoaXMub2Zmc2V0WSArPSBkeTtcbiAgICAgIFxuICAgICAgdGhpcy5sYXN0WCA9IHRoaXMubW91c2VYO1xuICAgICAgdGhpcy5sYXN0WSA9IHRoaXMubW91c2VZO1xuICAgICAgXG4gICAgICB0aGlzLmRyYXcoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51cGRhdGVIb3ZlcmVkUG9pbnQoKTtcbiAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVDbGljayhlOiBNb3VzZUV2ZW50KSB7XG4gICAgaWYgKHRoaXMuaG92ZXJlZFBvaW50KSB7XG4gICAgICB0aGlzLm9wZW5DYWxsYmFjayh0aGlzLmhvdmVyZWRQb2ludC5wYXRoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgaGFuZGxlV2hlZWwoZTogV2hlZWxFdmVudCkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBcbiAgICBjb25zdCBkZWx0YSA9IGUuZGVsdGFZID4gMCA/IDAuOSA6IDEuMTtcbiAgICB0aGlzLnNjYWxlICo9IGRlbHRhO1xuICAgIFxuICAgIC8vIExpbWl0IHpvb21cbiAgICB0aGlzLnNjYWxlID0gTWF0aC5tYXgoMC4xLCBNYXRoLm1pbig1LCB0aGlzLnNjYWxlKSk7XG4gICAgXG4gICAgdGhpcy5kcmF3KCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgaGFuZGxlTW91c2VEb3duKGU6IE1vdXNlRXZlbnQpIHtcbiAgICB0aGlzLmlzRHJhZ2dpbmcgPSB0cnVlO1xuICAgIHRoaXMubGFzdFggPSB0aGlzLm1vdXNlWDtcbiAgICB0aGlzLmxhc3RZID0gdGhpcy5tb3VzZVk7XG4gICAgdGhpcy5jYW52YXMuc3R5bGUuY3Vyc29yID0gJ2dyYWJiaW5nJztcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZVVwKGU6IE1vdXNlRXZlbnQpIHtcbiAgICB0aGlzLmlzRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS5jdXJzb3IgPSB0aGlzLmhvdmVyZWRQb2ludCA/ICdwb2ludGVyJyA6ICdkZWZhdWx0JztcbiAgfVxuICBcbiAgcHJpdmF0ZSB1cGRhdGVIb3ZlcmVkUG9pbnQoKSB7XG4gICAgaWYgKCF0aGlzLnJlc3VsdCkgcmV0dXJuO1xuICAgIFxuICAgIHRoaXMuaG92ZXJlZFBvaW50ID0gbnVsbDtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgY29uc3QgW3NjcmVlblgsIHNjcmVlblldID0gdGhpcy53b3JsZFRvU2NyZWVuKHBvaW50LngsIHBvaW50LnkpO1xuICAgICAgY29uc3QgZGlzdGFuY2UgPSBNYXRoLnNxcnQoXG4gICAgICAgIE1hdGgucG93KHNjcmVlblggLSB0aGlzLm1vdXNlWCwgMikgKyBcbiAgICAgICAgTWF0aC5wb3coc2NyZWVuWSAtIHRoaXMubW91c2VZLCAyKVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgaWYgKGRpc3RhbmNlIDw9IHRoaXMucG9pbnRSYWRpdXMpIHtcbiAgICAgICAgdGhpcy5ob3ZlcmVkUG9pbnQgPSBwb2ludDtcbiAgICAgICAgdGhpcy5jYW52YXMuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHRoaXMuY2FudmFzLnN0eWxlLmN1cnNvciA9IHRoaXMuaXNEcmFnZ2luZyA/ICdncmFiYmluZycgOiAnZGVmYXVsdCc7XG4gIH1cbiAgXG4gIC8vIENvbnZlcnRzIHdvcmxkIHNwYWNlICh0LVNORSkgY29vcmRpbmF0ZXMgdG8gc2NyZWVuIGNvb3JkaW5hdGVzXG4gIHByaXZhdGUgd29ybGRUb1NjcmVlbih4OiBudW1iZXIsIHk6IG51bWJlcik6IFtudW1iZXIsIG51bWJlcl0ge1xuICAgIC8vIE5vcm1hbGl6ZSB0byBjZW50ZXIgb2Ygc2NyZWVuXG4gICAgY29uc3QgY2VudGVyWCA9IHRoaXMud2lkdGggLyAyO1xuICAgIGNvbnN0IGNlbnRlclkgPSB0aGlzLmhlaWdodCAvIDI7XG4gICAgXG4gICAgLy8gQXBwbHkgc2NhbGUgYW5kIG9mZnNldFxuICAgIGNvbnN0IHNjcmVlblggPSB4ICogdGhpcy5zY2FsZSAqIDEwMCArIGNlbnRlclggKyB0aGlzLm9mZnNldFg7XG4gICAgY29uc3Qgc2NyZWVuWSA9IHkgKiB0aGlzLnNjYWxlICogMTAwICsgY2VudGVyWSArIHRoaXMub2Zmc2V0WTtcbiAgICBcbiAgICByZXR1cm4gW3NjcmVlblgsIHNjcmVlblldO1xuICB9XG4gIFxuICBwdWJsaWMgc2V0RGF0YShyZXN1bHQ6IFRTTkVSZXN1bHQpIHtcbiAgICB0aGlzLnJlc3VsdCA9IHJlc3VsdDtcbiAgICB0aGlzLnJlc2V0VmlldygpO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG4gIFxuICBwcml2YXRlIHJlc2V0VmlldygpIHtcbiAgICB0aGlzLnNjYWxlID0gMTtcbiAgICB0aGlzLm9mZnNldFggPSAwO1xuICAgIHRoaXMub2Zmc2V0WSA9IDA7XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhdygpIHtcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgLy8gQ2xlYXIgY2FudmFzXG4gICAgdGhpcy5jdHguY2xlYXJSZWN0KDAsIDAsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcbiAgICBcbiAgICAvLyBEcmF3IGJhY2tncm91bmQgZ3JpZFxuICAgIHRoaXMuZHJhd0dyaWQoKTtcbiAgICBcbiAgICAvLyBGaW5kIGNsdXN0ZXJzIHVzaW5nIGEgc2ltcGxlIGRpc3RhbmNlIG1ldHJpY1xuICAgIGNvbnN0IGNsdXN0ZXJzID0gdGhpcy5maW5kQ2x1c3RlcnMoKTtcbiAgICBcbiAgICAvLyBEcmF3IGNsdXN0ZXJzIGZpcnN0ICh1bmRlcm5lYXRoIHBvaW50cylcbiAgICB0aGlzLmRyYXdDbHVzdGVycyhjbHVzdGVycyk7XG4gICAgXG4gICAgLy8gRHJhdyBwb2ludHNcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgdGhpcy5kcmF3UG9pbnQocG9pbnQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBEcmF3IHRvb2x0aXAgZm9yIGhvdmVyZWQgcG9pbnRcbiAgICBpZiAodGhpcy5ob3ZlcmVkUG9pbnQpIHtcbiAgICAgIHRoaXMuZHJhd1Rvb2x0aXAoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhd0dyaWQoKSB7XG4gICAgY29uc3QgZ3JpZFNpemUgPSA1MCAqIHRoaXMuc2NhbGU7XG4gICAgXG4gICAgdGhpcy5jdHguc3Ryb2tlU3R5bGUgPSAncmdiYSh2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlci1yZ2IpLCAwLjMpJztcbiAgICB0aGlzLmN0eC5saW5lV2lkdGggPSAxO1xuICAgIFxuICAgIC8vIFZlcnRpY2FsIGxpbmVzXG4gICAgZm9yIChsZXQgeCA9IHRoaXMub2Zmc2V0WCAlIGdyaWRTaXplOyB4IDwgdGhpcy53aWR0aDsgeCArPSBncmlkU2l6ZSkge1xuICAgICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgICB0aGlzLmN0eC5tb3ZlVG8oeCwgMCk7XG4gICAgICB0aGlzLmN0eC5saW5lVG8oeCwgdGhpcy5oZWlnaHQpO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgfVxuICAgIFxuICAgIC8vIEhvcml6b250YWwgbGluZXNcbiAgICBmb3IgKGxldCB5ID0gdGhpcy5vZmZzZXRZICUgZ3JpZFNpemU7IHkgPCB0aGlzLmhlaWdodDsgeSArPSBncmlkU2l6ZSkge1xuICAgICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgICB0aGlzLmN0eC5tb3ZlVG8oMCwgeSk7XG4gICAgICB0aGlzLmN0eC5saW5lVG8odGhpcy53aWR0aCwgeSk7XG4gICAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZmluZENsdXN0ZXJzKCkge1xuICAgIGlmICghdGhpcy5yZXN1bHQpIHJldHVybiBbXTtcbiAgICBcbiAgICAvLyBTaW1wbGUgY2x1c3RlcmluZyBiYXNlZCBvbiBkaXN0YW5jZVxuICAgIGNvbnN0IHBvaW50cyA9IHRoaXMucmVzdWx0LnBvaW50cztcbiAgICBjb25zdCBjbHVzdGVyczogVFNORVBvaW50W11bXSA9IFtdO1xuICAgIGNvbnN0IHZpc2l0ZWQgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgICBcbiAgICBjb25zdCBkaXN0YW5jZVRocmVzaG9sZCA9IDAuMjsgIC8vIEFkanVzdCB0aGlzIHRocmVzaG9sZCBhcyBuZWVkZWRcbiAgICBcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHZpc2l0ZWQuaGFzKGkpKSBjb250aW51ZTtcbiAgICAgIFxuICAgICAgY29uc3QgY2x1c3RlcjogVFNORVBvaW50W10gPSBbcG9pbnRzW2ldXTtcbiAgICAgIHZpc2l0ZWQuYWRkKGkpO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHBvaW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICBpZiAoaSA9PT0gaiB8fCB2aXNpdGVkLmhhcyhqKSkgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBkaXN0YW5jZSA9IE1hdGguc3FydChcbiAgICAgICAgICBNYXRoLnBvdyhwb2ludHNbaV0ueCAtIHBvaW50c1tqXS54LCAyKSArIFxuICAgICAgICAgIE1hdGgucG93KHBvaW50c1tpXS55IC0gcG9pbnRzW2pdLnksIDIpXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICBpZiAoZGlzdGFuY2UgPCBkaXN0YW5jZVRocmVzaG9sZCkge1xuICAgICAgICAgIGNsdXN0ZXIucHVzaChwb2ludHNbal0pO1xuICAgICAgICAgIHZpc2l0ZWQuYWRkKGopO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChjbHVzdGVyLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgY2x1c3RlcnMucHVzaChjbHVzdGVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGNsdXN0ZXJzO1xuICB9XG4gIFxuICBwcml2YXRlIGRyYXdDbHVzdGVycyhjbHVzdGVyczogVFNORVBvaW50W11bXSkge1xuICAgIC8vIFNraXAgaWYgbm8gcmVzdWx0IGRhdGFcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgLy8gQ29sb3IgcGFsZXR0ZSBmb3IgY2x1c3RlcnMgKGV4Y2x1ZGluZyBub2lzZSBwb2ludHMpXG4gICAgY29uc3QgY29sb3JzID0gW1xuICAgICAgeyBmaWxsOiAncmdiYSgyNTUsIDk5LCAxMzIsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDI1NSwgOTksIDEzMiwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoNTQsIDE2MiwgMjM1LCAwLjEpJywgc3Ryb2tlOiAncmdiYSg1NCwgMTYyLCAyMzUsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDI1NSwgMjA2LCA4NiwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMjU1LCAyMDYsIDg2LCAwLjUpJyB9LFxuICAgICAgeyBmaWxsOiAncmdiYSg3NSwgMTkyLCAxOTIsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDc1LCAxOTIsIDE5MiwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoMTUzLCAxMDIsIDI1NSwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMTUzLCAxMDIsIDI1NSwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoMjU1LCAxNTksIDY0LCAwLjEpJywgc3Ryb2tlOiAncmdiYSgyNTUsIDE1OSwgNjQsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDE5OSwgMTk5LCAxOTksIDAuMSknLCBzdHJva2U6ICdyZ2JhKDE5OSwgMTk5LCAxOTksIDAuNSknIH0sXG4gICAgXTtcbiAgICBcbiAgICAvLyBHcm91cCBwb2ludHMgYnkgY2x1c3RlciBJRCBmcm9tIHRoZSBzZXJ2ZXIgcmVzcG9uc2VcbiAgICBjb25zdCBjbHVzdGVyR3JvdXBzOiB7IFtrZXk6IG51bWJlcl06IFRTTkVQb2ludFtdIH0gPSB7fTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgaWYgKHBvaW50LmNsdXN0ZXIgPT09IC0xKSBjb250aW51ZTsgLy8gU2tpcCBub2lzZSBwb2ludHNcbiAgICAgIFxuICAgICAgaWYgKCFjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdKSB7XG4gICAgICAgIGNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0gPSBbXTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXS5wdXNoKHBvaW50KTtcbiAgICB9XG4gICAgXG4gICAgLy8gRHJhdyBlYWNoIGNsdXN0ZXJcbiAgICBPYmplY3QuZW50cmllcyhjbHVzdGVyR3JvdXBzKS5mb3JFYWNoKChbY2x1c3RlcklkLCBwb2ludHNdLCBpbmRleCkgPT4ge1xuICAgICAgLy8gRmluZCB0aGUgY2VudHJvaWQgYW5kIGJvdW5kcyBvZiB0aGUgY2x1c3RlclxuICAgICAgbGV0IG1pblggPSBJbmZpbml0eSwgbWluWSA9IEluZmluaXR5O1xuICAgICAgbGV0IG1heFggPSAtSW5maW5pdHksIG1heFkgPSAtSW5maW5pdHk7XG4gICAgICBsZXQgc3VtWCA9IDAsIHN1bVkgPSAwO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHBvaW50cykge1xuICAgICAgICBjb25zdCBbc2NyZWVuWCwgc2NyZWVuWV0gPSB0aGlzLndvcmxkVG9TY3JlZW4ocG9pbnQueCwgcG9pbnQueSk7XG4gICAgICAgIG1pblggPSBNYXRoLm1pbihtaW5YLCBzY3JlZW5YKTtcbiAgICAgICAgbWluWSA9IE1hdGgubWluKG1pblksIHNjcmVlblkpO1xuICAgICAgICBtYXhYID0gTWF0aC5tYXgobWF4WCwgc2NyZWVuWCk7XG4gICAgICAgIG1heFkgPSBNYXRoLm1heChtYXhZLCBzY3JlZW5ZKTtcbiAgICAgICAgc3VtWCArPSBzY3JlZW5YO1xuICAgICAgICBzdW1ZICs9IHNjcmVlblk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIENhbGN1bGF0ZSBjZW50cm9pZFxuICAgICAgY29uc3QgY2VudGVyWCA9IHN1bVggLyBwb2ludHMubGVuZ3RoO1xuICAgICAgY29uc3QgY2VudGVyWSA9IHN1bVkgLyBwb2ludHMubGVuZ3RoO1xuICAgICAgXG4gICAgICAvLyBBZGQgcGFkZGluZ1xuICAgICAgY29uc3QgcGFkZGluZyA9IDIwO1xuICAgICAgbWluWCAtPSBwYWRkaW5nO1xuICAgICAgbWluWSAtPSBwYWRkaW5nO1xuICAgICAgbWF4WCArPSBwYWRkaW5nO1xuICAgICAgbWF4WSArPSBwYWRkaW5nO1xuICAgICAgXG4gICAgICAvLyBVc2UgY29sb3IgZnJvbSBwYWxldHRlIChjeWNsZSBpZiBtb3JlIGNsdXN0ZXJzIHRoYW4gY29sb3JzKVxuICAgICAgY29uc3QgY29sb3JJbmRleCA9IHBhcnNlSW50KGNsdXN0ZXJJZCkgJSBjb2xvcnMubGVuZ3RoO1xuICAgICAgY29uc3QgY29sb3IgPSBjb2xvcnNbY29sb3JJbmRleF07XG4gICAgICBcbiAgICAgIC8vIERyYXcgYSByb3VuZGVkIHJlY3RhbmdsZSBhcm91bmQgdGhlIGNsdXN0ZXJcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9IGNvbG9yLmZpbGw7XG4gICAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9IGNvbG9yLnN0cm9rZTtcbiAgICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgICBcbiAgICAgIHRoaXMucm91bmRSZWN0KFxuICAgICAgICBtaW5YLCBcbiAgICAgICAgbWluWSwgXG4gICAgICAgIG1heFggLSBtaW5YLCBcbiAgICAgICAgbWF4WSAtIG1pblksIFxuICAgICAgICAxMFxuICAgICAgKTtcbiAgICAgIFxuICAgICAgdGhpcy5jdHguZmlsbCgpO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgICBcbiAgICAgIC8vIERyYXcgY2x1c3RlciBsYWJlbCB3aXRoIHRvcCB0ZXJtcyBpZiBhdmFpbGFibGVcbiAgICAgIGlmICh0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zICYmIHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXSkge1xuICAgICAgICBjb25zdCB0ZXJtcyA9IHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXVxuICAgICAgICAgIC5zbGljZSgwLCAzKSAgLy8gVGFrZSB0b3AgMyB0ZXJtc1xuICAgICAgICAgIC5tYXAodCA9PiB0LnRlcm0pXG4gICAgICAgICAgLmpvaW4oJywgJyk7XG4gICAgICAgIFxuICAgICAgICAvLyBEcmF3IGEgbGFiZWwgd2l0aCBjbHVzdGVyIElEIGFuZCB0b3AgdGVybXNcbiAgICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3ZhcigtLXRleHQtbm9ybWFsKSc7XG4gICAgICAgIHRoaXMuY3R4LmZvbnQgPSAnYm9sZCAxMnB4IHZhcigtLWZvbnQtdGV4dCknO1xuICAgICAgICB0aGlzLmN0eC50ZXh0QWxpZ24gPSAnY2VudGVyJztcbiAgICAgICAgdGhpcy5jdHguZmlsbFRleHQoYENsdXN0ZXIgJHtjbHVzdGVySWR9OiAke3Rlcm1zfWAsIGNlbnRlclgsIG1pblkgLSA1KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBcbiAgcHJpdmF0ZSByb3VuZFJlY3QoeDogbnVtYmVyLCB5OiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCByYWRpdXM6IG51bWJlcikge1xuICAgIHRoaXMuY3R4LmJlZ2luUGF0aCgpO1xuICAgIHRoaXMuY3R4Lm1vdmVUbyh4ICsgcmFkaXVzLCB5KTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCArIHdpZHRoIC0gcmFkaXVzLCB5KTtcbiAgICB0aGlzLmN0eC5hcmNUbyh4ICsgd2lkdGgsIHksIHggKyB3aWR0aCwgeSArIHJhZGl1cywgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCArIHdpZHRoLCB5ICsgaGVpZ2h0IC0gcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5hcmNUbyh4ICsgd2lkdGgsIHkgKyBoZWlnaHQsIHggKyB3aWR0aCAtIHJhZGl1cywgeSArIGhlaWdodCwgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCArIHJhZGl1cywgeSArIGhlaWdodCk7XG4gICAgdGhpcy5jdHguYXJjVG8oeCwgeSArIGhlaWdodCwgeCwgeSArIGhlaWdodCAtIHJhZGl1cywgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCwgeSArIHJhZGl1cyk7XG4gICAgdGhpcy5jdHguYXJjVG8oeCwgeSwgeCArIHJhZGl1cywgeSwgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5jbG9zZVBhdGgoKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBkcmF3UG9pbnQocG9pbnQ6IFRTTkVQb2ludCkge1xuICAgIGNvbnN0IFt4LCB5XSA9IHRoaXMud29ybGRUb1NjcmVlbihwb2ludC54LCBwb2ludC55KTtcbiAgICBcbiAgICAvLyBDb2xvciBwYWxldHRlIGZvciBjbHVzdGVyc1xuICAgIGNvbnN0IGNsdXN0ZXJDb2xvcnMgPSBbXG4gICAgICAncmdiYSgyNTUsIDk5LCAxMzIsIDEpJywgICAgLy8gcmVkXG4gICAgICAncmdiYSg1NCwgMTYyLCAyMzUsIDEpJywgICAgLy8gYmx1ZVxuICAgICAgJ3JnYmEoMjU1LCAyMDYsIDg2LCAxKScsICAgIC8vIHllbGxvd1xuICAgICAgJ3JnYmEoNzUsIDE5MiwgMTkyLCAxKScsICAgIC8vIGdyZWVuXG4gICAgICAncmdiYSgxNTMsIDEwMiwgMjU1LCAxKScsICAgLy8gcHVycGxlXG4gICAgICAncmdiYSgyNTUsIDE1OSwgNjQsIDEpJywgICAgLy8gb3JhbmdlXG4gICAgICAncmdiYSgxOTksIDE5OSwgMTk5LCAxKScsICAgLy8gZ3JleVxuICAgIF07XG4gICAgXG4gICAgLy8gRHJhdyBjaXJjbGVcbiAgICB0aGlzLmN0eC5iZWdpblBhdGgoKTtcbiAgICB0aGlzLmN0eC5hcmMoeCwgeSwgdGhpcy5wb2ludFJhZGl1cywgMCwgTWF0aC5QSSAqIDIpO1xuICAgIFxuICAgIC8vIERldGVybWluZSBjb2xvciBiYXNlZCBvbiBob3ZlciBzdGF0ZSBhbmQgY2x1c3RlclxuICAgIGlmICh0aGlzLmhvdmVyZWRQb2ludCA9PT0gcG9pbnQpIHtcbiAgICAgIC8vIEhvdmVyZWQgcG9pbnRzIGFyZSBhbHdheXMgaGlnaGxpZ2h0ZWQgaW4gdGhlIGFjY2VudCBjb2xvclxuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3ZhcigtLWludGVyYWN0aXZlLWFjY2VudCknO1xuICAgIH0gZWxzZSBpZiAocG9pbnQuY2x1c3RlciA9PT0gLTEpIHtcbiAgICAgIC8vIE5vaXNlIHBvaW50cyAobm90IGluIGEgY2x1c3RlcikgYXJlIGdyZXlcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS10ZXh0LW11dGVkKSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFBvaW50cyBpbiBjbHVzdGVycyB1c2UgdGhlIGNsdXN0ZXIgY29sb3IgcGFsZXR0ZVxuICAgICAgY29uc3QgY29sb3JJbmRleCA9IHBvaW50LmNsdXN0ZXIgJSBjbHVzdGVyQ29sb3JzLmxlbmd0aDtcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9IGNsdXN0ZXJDb2xvcnNbY29sb3JJbmRleF07XG4gICAgfVxuICAgIFxuICAgIHRoaXMuY3R4LmZpbGwoKTtcbiAgICBcbiAgICAvLyBBZGQgYm9yZGVyIHRvIHBvaW50c1xuICAgIHRoaXMuY3R4LnN0cm9rZVN0eWxlID0gJ3ZhcigtLWJhY2tncm91bmQtcHJpbWFyeSknO1xuICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgXG4gICAgLy8gRHJhdyB0aXRsZSBpZiBub3QgaG92ZXJlZCAoaG92ZXJlZCBzaG93cyBpbiB0b29sdGlwKVxuICAgIGlmICh0aGlzLmhvdmVyZWRQb2ludCAhPT0gcG9pbnQpIHtcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS10ZXh0LW5vcm1hbCknO1xuICAgICAgdGhpcy5jdHguZm9udCA9ICcxMnB4IHZhcigtLWZvbnQtdGV4dCknO1xuICAgICAgdGhpcy5jdHgudGV4dEFsaWduID0gJ2NlbnRlcic7XG4gICAgICB0aGlzLmN0eC5maWxsVGV4dChwb2ludC50aXRsZSwgeCwgeSAtIHRoaXMucG9pbnRSYWRpdXMgLSA1KTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhd1Rvb2x0aXAoKSB7XG4gICAgaWYgKCF0aGlzLmhvdmVyZWRQb2ludCB8fCAhdGhpcy5yZXN1bHQpIHJldHVybjtcbiAgICBcbiAgICBjb25zdCBbeCwgeV0gPSB0aGlzLndvcmxkVG9TY3JlZW4odGhpcy5ob3ZlcmVkUG9pbnQueCwgdGhpcy5ob3ZlcmVkUG9pbnQueSk7XG4gICAgXG4gICAgLy8gVG9vbHRpcCBjb250ZW50XG4gICAgY29uc3QgdGl0bGUgPSB0aGlzLmhvdmVyZWRQb2ludC50aXRsZTtcbiAgICBjb25zdCBwYXRoID0gdGhpcy5ob3ZlcmVkUG9pbnQucGF0aDtcbiAgICBjb25zdCB0ZXJtcyA9IHRoaXMuaG92ZXJlZFBvaW50LnRvcF90ZXJtcy5qb2luKCcsICcpO1xuICAgIFxuICAgIC8vIEdldCBjbHVzdGVyIGluZm9ybWF0aW9uXG4gICAgbGV0IGNsdXN0ZXJJbmZvID0gJ05vdCBjbHVzdGVyZWQnO1xuICAgIGlmICh0aGlzLmhvdmVyZWRQb2ludC5jbHVzdGVyICE9PSAtMSkge1xuICAgICAgY29uc3QgY2x1c3RlcklkID0gdGhpcy5ob3ZlcmVkUG9pbnQuY2x1c3RlcjtcbiAgICAgIFxuICAgICAgLy8gR2V0IGNsdXN0ZXIgdGVybXMgaWYgYXZhaWxhYmxlXG4gICAgICBsZXQgY2x1c3RlclRlcm1zID0gJyc7XG4gICAgICBpZiAodGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtcyAmJiB0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zW2NsdXN0ZXJJZF0pIHtcbiAgICAgICAgY2x1c3RlclRlcm1zID0gdGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtc1tjbHVzdGVySWRdXG4gICAgICAgICAgLnNsaWNlKDAsIDMpIC8vIFRha2UgdG9wIDMgdGVybXNcbiAgICAgICAgICAubWFwKHQgPT4gdC50ZXJtKVxuICAgICAgICAgIC5qb2luKCcsICcpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjbHVzdGVySW5mbyA9IGBDbHVzdGVyICR7Y2x1c3RlcklkfTogJHtjbHVzdGVyVGVybXN9YDtcbiAgICB9XG4gICAgXG4gICAgLy8gUHJlcGFyZSB0ZXh0XG4gICAgdGhpcy5jdHguZm9udCA9ICdib2xkIDE0cHggdmFyKC0tZm9udC10ZXh0KSc7XG4gICAgY29uc3QgdGl0bGVXaWR0aCA9IHRoaXMuY3R4Lm1lYXN1cmVUZXh0KHRpdGxlKS53aWR0aDtcbiAgICBcbiAgICB0aGlzLmN0eC5mb250ID0gJzEycHggdmFyKC0tZm9udC10ZXh0KSc7XG4gICAgY29uc3QgcGF0aFdpZHRoID0gdGhpcy5jdHgubWVhc3VyZVRleHQocGF0aCkud2lkdGg7XG4gICAgY29uc3QgdGVybXNXaWR0aCA9IHRoaXMuY3R4Lm1lYXN1cmVUZXh0KGBLZXl3b3JkczogJHt0ZXJtc31gKS53aWR0aDtcbiAgICBjb25zdCBjbHVzdGVyV2lkdGggPSB0aGlzLmN0eC5tZWFzdXJlVGV4dChgQ2x1c3RlcjogJHtjbHVzdGVySW5mb31gKS53aWR0aDtcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgdG9vbHRpcCBkaW1lbnNpb25zXG4gICAgY29uc3QgdG9vbHRpcFdpZHRoID0gTWF0aC5tYXgodGl0bGVXaWR0aCwgcGF0aFdpZHRoLCB0ZXJtc1dpZHRoLCBjbHVzdGVyV2lkdGgpICsgMjA7XG4gICAgY29uc3QgdG9vbHRpcEhlaWdodCA9IDk1OyAvLyBJbmNyZWFzZWQgaGVpZ2h0IGZvciB0aGUgY2x1c3RlciBpbmZvXG4gICAgY29uc3QgdG9vbHRpcFggPSBNYXRoLm1pbih4ICsgMTAsIHRoaXMud2lkdGggLSB0b29sdGlwV2lkdGggLSAxMCk7XG4gICAgY29uc3QgdG9vbHRpcFkgPSBNYXRoLm1pbih5IC0gMTAsIHRoaXMuaGVpZ2h0IC0gdG9vbHRpcEhlaWdodCAtIDEwKTtcbiAgICBcbiAgICAvLyBEcmF3IHRvb2x0aXAgYmFja2dyb3VuZFxuICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS1iYWNrZ3JvdW5kLXByaW1hcnkpJztcbiAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9ICd2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlciknO1xuICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgXG4gICAgdGhpcy5yb3VuZFJlY3QodG9vbHRpcFgsIHRvb2x0aXBZLCB0b29sdGlwV2lkdGgsIHRvb2x0aXBIZWlnaHQsIDUpO1xuICAgIHRoaXMuY3R4LmZpbGwoKTtcbiAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICBcbiAgICAvLyBEcmF3IHRvb2x0aXAgY29udGVudFxuICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS10ZXh0LW5vcm1hbCknO1xuICAgIHRoaXMuY3R4LnRleHRBbGlnbiA9ICdsZWZ0JztcbiAgICBcbiAgICB0aGlzLmN0eC5mb250ID0gJ2JvbGQgMTRweCB2YXIoLS1mb250LXRleHQpJztcbiAgICB0aGlzLmN0eC5maWxsVGV4dCh0aXRsZSwgdG9vbHRpcFggKyAxMCwgdG9vbHRpcFkgKyAyMCk7XG4gICAgXG4gICAgdGhpcy5jdHguZm9udCA9ICcxMnB4IHZhcigtLWZvbnQtdGV4dCknO1xuICAgIHRoaXMuY3R4LmZpbGxUZXh0KHBhdGgsIHRvb2x0aXBYICsgMTAsIHRvb2x0aXBZICsgNDApO1xuICAgIHRoaXMuY3R4LmZpbGxUZXh0KGBLZXl3b3JkczogJHt0ZXJtc31gLCB0b29sdGlwWCArIDEwLCB0b29sdGlwWSArIDYwKTtcbiAgICBcbiAgICAvLyBBZGQgY2x1c3RlciBpbmZvcm1hdGlvblxuICAgIHRoaXMuY3R4LmZpbGxUZXh0KGBDbHVzdGVyOiAke2NsdXN0ZXJJbmZvfWAsIHRvb2x0aXBYICsgMTAsIHRvb2x0aXBZICsgODApO1xuICB9XG59IiwiaW1wb3J0IHsgQXBwLCBJdGVtVmlldywgTW9kYWwsIE5vdGljZSwgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nLCBURmlsZSwgV29ya3NwYWNlTGVhZiwgVGV4dEFyZWFDb21wb25lbnQsIEJ1dHRvbkNvbXBvbmVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCAqIGFzIFRTTkUgZnJvbSAndHNuZS1qcyc7XG5pbXBvcnQgeyBUU05FVmlzdWFsaXplciB9IGZyb20gJy4vdmlzdWFsaXphdGlvbic7XG5cbi8vIEludGVyZmFjZSBmb3Igbm90ZSBjb25uZWN0aW9uc1xuaW50ZXJmYWNlIE5vdGVDb25uZWN0aW9uIHtcbiAgc291cmNlTm90ZTogVFNORVBvaW50O1xuICB0YXJnZXROb3RlOiBUU05FUG9pbnQ7XG4gIHNpbWlsYXJpdHk6IG51bWJlcjtcbiAgY29tbW9uVGVybXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyVGVybXM6IHN0cmluZ1tdO1xuICByZWFzb246IHN0cmluZztcbiAgbGxtRGVzY3JpcHRpb24/OiBzdHJpbmc7XG59XG5cbi8vIE1vZGFsIGZvciBkaXNwbGF5aW5nIGFuZCBwcm9jZXNzaW5nIHN1Z2dlc3RlZCBsaW5rc1xuY2xhc3MgU3VnZ2VzdGVkTGlua3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgcHJpdmF0ZSBjb25uZWN0aW9uczogTm90ZUNvbm5lY3Rpb25bXTtcbiAgcHJpdmF0ZSBwbHVnaW46IFZpYmVCb3lQbHVnaW47XG4gIHByaXZhdGUgc2VsZWN0ZWRDb25uZWN0aW9uSW5kZXg6IG51bWJlciA9IDA7XG4gIHByaXZhdGUgcHJvY2Vzc2luZ0Nvbm5lY3Rpb246IGJvb2xlYW4gPSBmYWxzZTtcbiAgXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBjb25uZWN0aW9uczogTm90ZUNvbm5lY3Rpb25bXSwgcGx1Z2luOiBWaWJlQm95UGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmNvbm5lY3Rpb25zID0gY29ubmVjdGlvbnM7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cbiAgXG4gIGFzeW5jIG9uT3BlbigpIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBcbiAgICAvLyBTZXQgbW9kYWwgdGl0bGVcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnU3VnZ2VzdGVkIE5vdGUgQ29ubmVjdGlvbnMnIH0pO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHsgXG4gICAgICB0ZXh0OiAnQmVsb3cgYXJlIHBvdGVudGlhbCBjb25uZWN0aW9ucyBiZXR3ZWVuIG5vdGVzIGJhc2VkIG9uIGNvbnRlbnQgc2ltaWxhcml0eS4gJyArXG4gICAgICAgICAgICAnU2VsZWN0IGEgY29ubmVjdGlvbiBhbmQgZ2VuZXJhdGUgYSBkZXNjcmlwdGlvbiB0byBjcmVhdGUgYSBsaW5rIGJldHdlZW4gdGhlIG5vdGVzLidcbiAgICB9KTtcbiAgICBcbiAgICAvLyBDcmVhdGUgY29udGFpbmVyIGZvciBjb25uZWN0aW9ucyBsaXN0XG4gICAgY29uc3QgY29ubmVjdGlvbnNDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnY29ubmVjdGlvbnMtY29udGFpbmVyJyB9KTtcbiAgICBcbiAgICAvLyBDcmVhdGUgY29udGFpbmVyIGZvciBzZWxlY3RlZCBjb25uZWN0aW9uIGRldGFpbHNcbiAgICBjb25zdCBkZXRhaWxzQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Nvbm5lY3Rpb24tZGV0YWlscycgfSk7XG4gICAgXG4gICAgLy8gQWRkIHNvbWUgQ1NTXG4gICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgICAgLmNvbm5lY3Rpb25zLWNvbnRhaW5lciB7XG4gICAgICAgIG1heC1oZWlnaHQ6IDE1MHB4O1xuICAgICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgICAgICBtYXJnaW4tYm90dG9tOiAxNXB4O1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlcik7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLWl0ZW0ge1xuICAgICAgICBwYWRkaW5nOiA4cHggMTJweDtcbiAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpO1xuICAgICAgfVxuICAgICAgLmNvbm5lY3Rpb24taXRlbTpob3ZlciB7XG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWJhY2tncm91bmQtc2Vjb25kYXJ5KTtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLWl0ZW0uc2VsZWN0ZWQge1xuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1pbnRlcmFjdGl2ZS1hY2NlbnQpO1xuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1vbi1hY2NlbnQpO1xuICAgICAgfVxuICAgICAgLmNvbm5lY3Rpb24tZGV0YWlscyB7XG4gICAgICAgIHBhZGRpbmc6IDEwcHg7XG4gICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyKTtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICBtYXJnaW4tYm90dG9tOiAxNXB4O1xuICAgICAgfVxuICAgICAgLmNvbm5lY3Rpb24tc3RhdHMge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7XG4gICAgICB9XG4gICAgICAuZ2VuZXJhdGUtYnV0dG9uIHtcbiAgICAgICAgbWFyZ2luLXRvcDogMTBweDtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTBweDtcbiAgICAgIH1cbiAgICAgIC5sbG0tZGVzY3JpcHRpb24ge1xuICAgICAgICBtYXJnaW4tdG9wOiAxMHB4O1xuICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgbWluLWhlaWdodDogMTAwcHg7XG4gICAgICB9XG4gICAgICAuYnV0dG9uLWNvbnRhaW5lciB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgbWFyZ2luLXRvcDogMTVweDtcbiAgICAgIH1cbiAgICBgO1xuICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICAgIFxuICAgIC8vIFJlbmRlciBjb25uZWN0aW9ucyBsaXN0XG4gICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uc0xpc3QoY29ubmVjdGlvbnNDb250YWluZXIpO1xuICAgIFxuICAgIC8vIFJlbmRlciBkZXRhaWxzIGZvciB0aGUgZmlyc3QgY29ubmVjdGlvblxuICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoZGV0YWlsc0NvbnRhaW5lciwgdGhpcy5jb25uZWN0aW9uc1swXSk7XG4gICAgXG4gICAgLy8gRm9jdXMgdGhlIGZpcnN0IGNvbm5lY3Rpb25cbiAgICB0aGlzLnNlbGVjdENvbm5lY3Rpb24oMCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgcmVuZGVyQ29ubmVjdGlvbnNMaXN0KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICBcbiAgICB0aGlzLmNvbm5lY3Rpb25zLmZvckVhY2goKGNvbm5lY3Rpb24sIGluZGV4KSA9PiB7XG4gICAgICBjb25zdCBpdGVtID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ2Nvbm5lY3Rpb24taXRlbScgfSk7XG4gICAgICBpZiAoaW5kZXggPT09IHRoaXMuc2VsZWN0ZWRDb25uZWN0aW9uSW5kZXgpIHtcbiAgICAgICAgaXRlbS5hZGRDbGFzcygnc2VsZWN0ZWQnKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc291cmNlVGl0bGUgPSBjb25uZWN0aW9uLnNvdXJjZU5vdGUudGl0bGU7XG4gICAgICBjb25zdCB0YXJnZXRUaXRsZSA9IGNvbm5lY3Rpb24udGFyZ2V0Tm90ZS50aXRsZTtcbiAgICAgIGNvbnN0IHNpbWlsYXJpdHkgPSBNYXRoLnJvdW5kKGNvbm5lY3Rpb24uc2ltaWxhcml0eSk7XG4gICAgICBcbiAgICAgIGl0ZW0uY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYCR7c291cmNlVGl0bGV9IOKGlCAke3RhcmdldFRpdGxlfSAoJHtzaW1pbGFyaXR5fSUgc2ltaWxhcml0eSlgIH0pO1xuICAgICAgXG4gICAgICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLnNlbGVjdENvbm5lY3Rpb24oaW5kZXgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgXG4gIHByaXZhdGUgcmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgY29ubmVjdGlvbjogTm90ZUNvbm5lY3Rpb24pIHtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICBcbiAgICBjb25zdCBzb3VyY2VOb3RlID0gY29ubmVjdGlvbi5zb3VyY2VOb3RlO1xuICAgIGNvbnN0IHRhcmdldE5vdGUgPSBjb25uZWN0aW9uLnRhcmdldE5vdGU7XG4gICAgXG4gICAgLy8gTm90ZSB0aXRsZXMgYW5kIHBhdGhzXG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogYENvbm5lY3Rpb246ICR7c291cmNlTm90ZS50aXRsZX0g4oaUICR7dGFyZ2V0Tm90ZS50aXRsZX1gIH0pO1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgU291cmNlOiAke3NvdXJjZU5vdGUucGF0aH1gIH0pO1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgVGFyZ2V0OiAke3RhcmdldE5vdGUucGF0aH1gIH0pO1xuICAgIFxuICAgIC8vIFN0YXRzXG4gICAgY29uc3Qgc3RhdHNEaXYgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiAnY29ubmVjdGlvbi1zdGF0cycgfSk7XG4gICAgc3RhdHNEaXYuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYFNpbWlsYXJpdHk6ICR7TWF0aC5yb3VuZChjb25uZWN0aW9uLnNpbWlsYXJpdHkpfSVgIH0pO1xuICAgIHN0YXRzRGl2LmNyZWF0ZUVsKCdkaXYnLCB7IHRleHQ6IGAke3NvdXJjZU5vdGUud29yZENvdW50IHx8ICc/J30gd29yZHMgLyAke3RhcmdldE5vdGUud29yZENvdW50IHx8ICc/J30gd29yZHNgIH0pO1xuICAgIFxuICAgIC8vIFNoYXJlZCB0ZXJtc1xuICAgIGlmIChjb25uZWN0aW9uLmNvbW1vblRlcm1zLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgQ29tbW9uIHRlcm1zOiAke2Nvbm5lY3Rpb24uY29tbW9uVGVybXMuam9pbignLCAnKX1gIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyBDbHVzdGVyIHRlcm1zXG4gICAgaWYgKGNvbm5lY3Rpb24uY2x1c3RlclRlcm1zLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgQ2x1c3RlciB0ZXJtczogJHtjb25uZWN0aW9uLmNsdXN0ZXJUZXJtcy5qb2luKCcsICcpfWAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIFJlYXNvbiBmb3IgY29ubmVjdGlvblxuICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgQ29ubmVjdGlvbiByZWFzb246ICR7Y29ubmVjdGlvbi5yZWFzb259YCB9KTtcbiAgICBcbiAgICAvLyBHZW5lcmF0ZSBkZXNjcmlwdGlvbiBidXR0b25cbiAgICBjb25zdCBnZW5lcmF0ZUJ1dHRvbiA9IG5ldyBCdXR0b25Db21wb25lbnQoY29udGFpbmVyKVxuICAgICAgLnNldEJ1dHRvblRleHQoJ0dlbmVyYXRlIENvbm5lY3Rpb24gRGVzY3JpcHRpb24nKVxuICAgICAgLnNldEN0YSgpIC8vIFVzZSBzZXRDdGEoKSBpbnN0ZWFkIG9mIHNldENsYXNzIHdpdGggc3BhY2VzXG4gICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMuZ2VuZXJhdGVMTE1EZXNjcmlwdGlvbihjb25uZWN0aW9uKTtcbiAgICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBjbGFzcyB3aXRob3V0IHNwYWNlc1xuICAgIGdlbmVyYXRlQnV0dG9uLmJ1dHRvbkVsLmFkZENsYXNzKCdnZW5lcmF0ZS1idXR0b24nKTtcbiAgICBcbiAgICBpZiAodGhpcy5wcm9jZXNzaW5nQ29ubmVjdGlvbikge1xuICAgICAgZ2VuZXJhdGVCdXR0b24uc2V0RGlzYWJsZWQodHJ1ZSk7XG4gICAgICBnZW5lcmF0ZUJ1dHRvbi5zZXRCdXR0b25UZXh0KCdHZW5lcmF0aW5nLi4uJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIERlc2NyaXB0aW9uIHRleHQgYXJlYVxuICAgIGlmIChjb25uZWN0aW9uLmxsbURlc2NyaXB0aW9uKSB7XG4gICAgICBjb25zdCBkZXNjcmlwdGlvbkNvbnRhaW5lciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoKTtcbiAgICAgIGRlc2NyaXB0aW9uQ29udGFpbmVyLmNyZWF0ZUVsKCdoNCcsIHsgdGV4dDogJ0Nvbm5lY3Rpb24gRGVzY3JpcHRpb246JyB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGV4dEFyZWEgPSBuZXcgVGV4dEFyZWFDb21wb25lbnQoZGVzY3JpcHRpb25Db250YWluZXIpXG4gICAgICAgIC5zZXRWYWx1ZShjb25uZWN0aW9uLmxsbURlc2NyaXB0aW9uKVxuICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ0Nvbm5lY3Rpb24gZGVzY3JpcHRpb24gd2lsbCBhcHBlYXIgaGVyZS4uLicpO1xuICAgICAgXG4gICAgICB0ZXh0QXJlYS5pbnB1dEVsLmFkZENsYXNzKCdsbG0tZGVzY3JpcHRpb24nKTtcbiAgICAgIFxuICAgICAgLy8gQ3JlYXRlIGJ1dHRvblxuICAgICAgY29uc3QgYnV0dG9uQ29udGFpbmVyID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ2J1dHRvbi1jb250YWluZXInIH0pO1xuICAgICAgXG4gICAgICBuZXcgQnV0dG9uQ29tcG9uZW50KGJ1dHRvbkNvbnRhaW5lcilcbiAgICAgICAgLnNldEJ1dHRvblRleHQoJ0NyZWF0ZSBMaW5rJylcbiAgICAgICAgLnNldEN0YSgpIC8vIFVzZSBzZXRDdGEoKSBpbnN0ZWFkIG9mIHNldENsYXNzIHdpdGggc3BhY2VzXG4gICAgICAgIC5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0aGlzLmNyZWF0ZUxpbmsoY29ubmVjdGlvbiwgdGV4dEFyZWEuZ2V0VmFsdWUoKSk7XG4gICAgICAgIH0pO1xuICAgICAgXG4gICAgICBuZXcgQnV0dG9uQ29tcG9uZW50KGJ1dHRvbkNvbnRhaW5lcilcbiAgICAgICAgLnNldEJ1dHRvblRleHQoJ0VkaXQgRGVzY3JpcHRpb24nKVxuICAgICAgICAub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGV4dEFyZWEuc2V0RGlzYWJsZWQoZmFsc2UpO1xuICAgICAgICAgIHRleHRBcmVhLmlucHV0RWwuZm9jdXMoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIHNlbGVjdENvbm5lY3Rpb24oaW5kZXg6IG51bWJlcikge1xuICAgIGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5jb25uZWN0aW9ucy5sZW5ndGgpIHJldHVybjtcbiAgICBcbiAgICB0aGlzLnNlbGVjdGVkQ29ubmVjdGlvbkluZGV4ID0gaW5kZXg7XG4gICAgY29uc3QgY29ubmVjdGlvbkNvbnRhaW5lciA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJy5jb25uZWN0aW9ucy1jb250YWluZXInKSBhcyBIVE1MRWxlbWVudDtcbiAgICBjb25zdCBkZXRhaWxzQ29udGFpbmVyID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignLmNvbm5lY3Rpb24tZGV0YWlscycpIGFzIEhUTUxFbGVtZW50O1xuICAgIFxuICAgIGlmIChjb25uZWN0aW9uQ29udGFpbmVyICYmIGRldGFpbHNDb250YWluZXIpIHtcbiAgICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbnNMaXN0KGNvbm5lY3Rpb25Db250YWluZXIpO1xuICAgICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uRGV0YWlscyhkZXRhaWxzQ29udGFpbmVyLCB0aGlzLmNvbm5lY3Rpb25zW2luZGV4XSk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGdlbmVyYXRlTExNRGVzY3JpcHRpb24oY29ubmVjdGlvbjogTm90ZUNvbm5lY3Rpb24pIHtcbiAgICBpZiAodGhpcy5wcm9jZXNzaW5nQ29ubmVjdGlvbikgcmV0dXJuO1xuICAgIFxuICAgIHRoaXMucHJvY2Vzc2luZ0Nvbm5lY3Rpb24gPSB0cnVlO1xuICAgIGNvbnN0IGRldGFpbHNDb250YWluZXIgPSB0aGlzLmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKCcuY29ubmVjdGlvbi1kZXRhaWxzJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uRGV0YWlscyhkZXRhaWxzQ29udGFpbmVyLCBjb25uZWN0aW9uKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgLy8gRmV0Y2ggc291cmNlIGFuZCB0YXJnZXQgbm90ZSBjb250ZW50XG4gICAgICBjb25zdCBzb3VyY2VGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbm5lY3Rpb24uc291cmNlTm90ZS5wYXRoKTtcbiAgICAgIGNvbnN0IHRhcmdldEZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY29ubmVjdGlvbi50YXJnZXROb3RlLnBhdGgpO1xuICAgICAgXG4gICAgICBpZiAoIShzb3VyY2VGaWxlIGluc3RhbmNlb2YgVEZpbGUpIHx8ICEodGFyZ2V0RmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIG5vdGUgZmlsZXMnKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc291cmNlQ29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoc291cmNlRmlsZSk7XG4gICAgICBjb25zdCB0YXJnZXRDb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZCh0YXJnZXRGaWxlKTtcbiAgICAgIFxuICAgICAgLy8gUHJlcGFyZSBkYXRhIGZvciBMTE0gY2FsbFxuICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgc291cmNlTm90ZToge1xuICAgICAgICAgIHRpdGxlOiBjb25uZWN0aW9uLnNvdXJjZU5vdGUudGl0bGUsXG4gICAgICAgICAgY29udGVudDogc291cmNlQ29udGVudC5zdWJzdHJpbmcoMCwgMTAwMCksIC8vIExpbWl0IHRvIGZpcnN0IDEwMDAgY2hhcnNcbiAgICAgICAgICB0b3BUZXJtczogY29ubmVjdGlvbi5zb3VyY2VOb3RlLnRvcF90ZXJtc1xuICAgICAgICB9LFxuICAgICAgICB0YXJnZXROb3RlOiB7XG4gICAgICAgICAgdGl0bGU6IGNvbm5lY3Rpb24udGFyZ2V0Tm90ZS50aXRsZSxcbiAgICAgICAgICBjb250ZW50OiB0YXJnZXRDb250ZW50LnN1YnN0cmluZygwLCAxMDAwKSwgLy8gTGltaXQgdG8gZmlyc3QgMTAwMCBjaGFyc1xuICAgICAgICAgIHRvcFRlcm1zOiBjb25uZWN0aW9uLnRhcmdldE5vdGUudG9wX3Rlcm1zXG4gICAgICAgIH0sXG4gICAgICAgIGNvbW1vblRlcm1zOiBjb25uZWN0aW9uLmNvbW1vblRlcm1zLFxuICAgICAgICBjbHVzdGVyVGVybXM6IGNvbm5lY3Rpb24uY2x1c3RlclRlcm1zLFxuICAgICAgICByZWFzb246IGNvbm5lY3Rpb24ucmVhc29uXG4gICAgICB9O1xuICAgICAgXG4gICAgICAvLyBDYWxsIHRoZSBMTE0gc2VydmljZVxuICAgICAgY29uc3QgZGVzY3JpcHRpb24gPSBhd2FpdCB0aGlzLmNhbGxMTE1TZXJ2aWNlKGRhdGEpO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgdGhlIGNvbm5lY3Rpb24gd2l0aCB0aGUgZ2VuZXJhdGVkIGRlc2NyaXB0aW9uXG4gICAgICBjb25uZWN0aW9uLmxsbURlc2NyaXB0aW9uID0gZGVzY3JpcHRpb247XG4gICAgICBcbiAgICAgIC8vIFVwZGF0ZSB0aGUgVUlcbiAgICAgIHRoaXMucHJvY2Vzc2luZ0Nvbm5lY3Rpb24gPSBmYWxzZTtcbiAgICAgIGNvbnN0IGRldGFpbHNDb250YWluZXIgPSB0aGlzLmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKCcuY29ubmVjdGlvbi1kZXRhaWxzJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICB0aGlzLnJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKGRldGFpbHNDb250YWluZXIsIGNvbm5lY3Rpb24pO1xuICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMucHJvY2Vzc2luZ0Nvbm5lY3Rpb24gPSBmYWxzZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdlbmVyYXRpbmcgZGVzY3JpcHRpb246JywgZXJyb3IpO1xuICAgICAgbmV3IE5vdGljZShgRmFpbGVkIHRvIGdlbmVyYXRlIGRlc2NyaXB0aW9uOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICBcbiAgICAgIC8vIFVwZGF0ZSBVSSB0byBzaG93IGVycm9yXG4gICAgICBjb25zdCBkZXRhaWxzQ29udGFpbmVyID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignLmNvbm5lY3Rpb24tZGV0YWlscycpIGFzIEhUTUxFbGVtZW50O1xuICAgICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uRGV0YWlscyhkZXRhaWxzQ29udGFpbmVyLCBjb25uZWN0aW9uKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgY2FsbExMTVNlcnZpY2UoZGF0YTogYW55KTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICB0cnkge1xuICAgICAgLy8gVHJ5IHRvIGNvbm5lY3QgdG8gdGhlIGxvY2FsIExMTSBBUEkgc2VydmVyXG4gICAgICBjb25zdCBzb3VyY2VUaXRsZSA9IGRhdGEuc291cmNlTm90ZS50aXRsZTtcbiAgICAgIGNvbnN0IHRhcmdldFRpdGxlID0gZGF0YS50YXJnZXROb3RlLnRpdGxlO1xuICAgICAgY29uc3Qgc291cmNlQ29udGVudCA9IGRhdGEuc291cmNlTm90ZS5jb250ZW50O1xuICAgICAgY29uc3QgdGFyZ2V0Q29udGVudCA9IGRhdGEudGFyZ2V0Tm90ZS5jb250ZW50O1xuICAgICAgY29uc3QgY29tbW9uVGVybXMgPSBkYXRhLmNvbW1vblRlcm1zLmpvaW4oJywgJyk7XG4gICAgICBjb25zdCBjbHVzdGVyVGVybXMgPSBkYXRhLmNsdXN0ZXJUZXJtcy5qb2luKCcsICcpO1xuICAgICAgXG4gICAgICAvLyBGaXJzdCwgdHJ5IHRvIHVzZSB0aGUgUHl0aG9uIHNlcnZlcidzIExMTSBpbnRlZ3JhdGlvblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnaHR0cDovLzEyNy4wLjAuMToxMjM0L2dlbmVyYXRlX2Nvbm5lY3Rpb24nLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHNvdXJjZV9ub3RlOiB7XG4gICAgICAgICAgICB0aXRsZTogc291cmNlVGl0bGUsXG4gICAgICAgICAgICBjb250ZW50OiBzb3VyY2VDb250ZW50LFxuICAgICAgICAgICAgdGVybXM6IGRhdGEuc291cmNlTm90ZS50b3BUZXJtc1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdGFyZ2V0X25vdGU6IHtcbiAgICAgICAgICAgIHRpdGxlOiB0YXJnZXRUaXRsZSxcbiAgICAgICAgICAgIGNvbnRlbnQ6IHRhcmdldENvbnRlbnQsXG4gICAgICAgICAgICB0ZXJtczogZGF0YS50YXJnZXROb3RlLnRvcFRlcm1zXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb21tb25fdGVybXM6IGRhdGEuY29tbW9uVGVybXMsXG4gICAgICAgICAgY2x1c3Rlcl90ZXJtczogZGF0YS5jbHVzdGVyVGVybXNcbiAgICAgICAgfSlcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICBpZiAocmVzdWx0LmRlc2NyaXB0aW9uKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdC5kZXNjcmlwdGlvbjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBJZiBzZXJ2ZXIgY2FsbCBmYWlscyBvciBub3QgYXZhaWxhYmxlLCB1c2UgZmFsbGJhY2sgbG9naWNcbiAgICAgIGNvbnNvbGUubG9nKFwiVXNpbmcgZmFsbGJhY2sgY29ubmVjdGlvbiBkZXNjcmlwdGlvbiBnZW5lcmF0aW9uXCIpO1xuICAgICAgXG4gICAgICAvLyBDcmVhdGUgYSB0ZW1wbGF0ZS1iYXNlZCBkZXNjcmlwdGlvbiAoZmFsbGJhY2spXG4gICAgICBsZXQgZGVzY3JpcHRpb24gPSAnJztcbiAgICAgIFxuICAgICAgaWYgKGNvbW1vblRlcm1zKSB7XG4gICAgICAgIGRlc2NyaXB0aW9uICs9IGBUaGVzZSBub3RlcyBzaGFyZSBjb25jZXB0dWFsIG92ZXJsYXAgYXJvdW5kICR7Y29tbW9uVGVybXN9LiBgO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVzY3JpcHRpb24gKz0gYFRoZXNlIG5vdGVzIGFwcGVhciB0byBiZSBjb25jZXB0dWFsbHkgcmVsYXRlZC4gYDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgZGVzY3JpcHRpb24gKz0gYFRoZSBub3RlIFwiJHt0YXJnZXRUaXRsZX1cIiBwcm92aWRlcyBjb21wbGVtZW50YXJ5IGluZm9ybWF0aW9uIHRoYXQgZXhwYW5kcyBvbiBpZGVhcyBpbiBcIiR7c291cmNlVGl0bGV9XCJgO1xuICAgICAgXG4gICAgICBpZiAoY2x1c3RlclRlcm1zKSB7XG4gICAgICAgIGRlc2NyaXB0aW9uICs9IGAsIHBhcnRpY3VsYXJseSByZWdhcmRpbmcgJHtjbHVzdGVyVGVybXN9LmA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZXNjcmlwdGlvbiArPSAnLic7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybiBkZXNjcmlwdGlvbjtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgY2FsbGluZyBMTE0gc2VydmljZTonLCBlcnJvcik7XG4gICAgICBcbiAgICAgIC8vIFJldHVybiBhIGJhc2ljIGRlc2NyaXB0aW9uIGFzIGZhbGxiYWNrXG4gICAgICByZXR1cm4gYFRoZXNlIG5vdGVzIGFwcGVhciB0byBiZSByZWxhdGVkIGluIHRoZWlyIGNvbnRlbnQuIFRoZSBub3RlIFwiJHtkYXRhLnRhcmdldE5vdGUudGl0bGV9XCIgY29tcGxlbWVudHMgXCIke2RhdGEuc291cmNlTm90ZS50aXRsZX1cIiB3aXRoIGFkZGl0aW9uYWwgcmVsZXZhbnQgaW5mb3JtYXRpb24uYDtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgY3JlYXRlTGluayhjb25uZWN0aW9uOiBOb3RlQ29ubmVjdGlvbiwgZGVzY3JpcHRpb246IHN0cmluZykge1xuICAgIGlmICghZGVzY3JpcHRpb24gfHwgZGVzY3JpcHRpb24udHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbmV3IE5vdGljZSgnUGxlYXNlIGdlbmVyYXRlIG9yIHByb3ZpZGUgYSBkZXNjcmlwdGlvbiBmb3IgdGhlIGNvbm5lY3Rpb24nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgLy8gQ2xvc2UgdGhlIG1vZGFsIGZpcnN0IHNvIGl0IGRvZXNuJ3QgaW50ZXJmZXJlIHdpdGggdGhlIG5vdGUgb3BlbmluZ1xuICAgIHRoaXMuY2xvc2UoKTtcbiAgICBcbiAgICAvLyBDcmVhdGUgdGhlIGxpbmsgLSB0aGlzIHdpbGwgYWxzbyBvcGVuIHRoZSBzb3VyY2Ugbm90ZVxuICAgIGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCB0aGlzLnBsdWdpbi5jcmVhdGVOb3RlTGluayhcbiAgICAgIGNvbm5lY3Rpb24uc291cmNlTm90ZS5wYXRoLFxuICAgICAgY29ubmVjdGlvbi50YXJnZXROb3RlLnBhdGgsXG4gICAgICBkZXNjcmlwdGlvblxuICAgICk7XG4gICAgXG4gICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgIC8vIE9wZW4gdGhlIHRhcmdldCBub3RlIGluIGEgc3BsaXQgcGFuZSBhZnRlciBhIHNob3J0IGRlbGF5IHRvIGxldCB0aGUgc291cmNlIG5vdGUgb3BlblxuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gQWxzbyBvZmZlciBvcHRpb24gdG8gdmlldyB0aGUgdGFyZ2V0IG5vdGVcbiAgICAgICAgICBjb25zdCB0YXJnZXRGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbm5lY3Rpb24udGFyZ2V0Tm90ZS5wYXRoKTtcbiAgICAgICAgICBpZiAodGFyZ2V0RmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBtb2RhbCBhc2tpbmcgaWYgdXNlciB3YW50cyB0byBvcGVuIHRoZSB0YXJnZXQgbm90ZVxuICAgICAgICAgICAgY29uc3QgbW9kYWwgPSBuZXcgTW9kYWwodGhpcy5hcHApO1xuICAgICAgICAgICAgY29uc3QgeyBjb250ZW50RWwgfSA9IG1vZGFsO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBBZGQgc29tZSBzdHlsaW5nXG4gICAgICAgICAgICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgICAgICAgICBzdHlsZS50ZXh0Q29udGVudCA9IGBcbiAgICAgICAgICAgICAgLnN1Y2Nlc3MtbW9kYWwge1xuICAgICAgICAgICAgICAgIHBhZGRpbmc6IDIwcHg7XG4gICAgICAgICAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC5zdWNjZXNzLWljb24ge1xuICAgICAgICAgICAgICAgIGZvbnQtc2l6ZTogMzZweDtcbiAgICAgICAgICAgICAgICBtYXJnaW4tYm90dG9tOiAxNXB4O1xuICAgICAgICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbnRlcmFjdGl2ZS1hY2NlbnQpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC5zdWNjZXNzLXRpdGxlIHtcbiAgICAgICAgICAgICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuICAgICAgICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbnRlcmFjdGl2ZS1hY2NlbnQpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC5ub3RlLWluZm8ge1xuICAgICAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDIwcHg7XG4gICAgICAgICAgICAgICAgZm9udC1zdHlsZTogaXRhbGljO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC5jb25maXJtYXRpb24tcXVlc3Rpb24ge1xuICAgICAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDIwcHg7XG4gICAgICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLm1vZGFsLWJ1dHRvbi1jb250YWluZXIge1xuICAgICAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1hcm91bmQ7XG4gICAgICAgICAgICAgICAgbWFyZ2luLXRvcDogMjBweDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgYDtcbiAgICAgICAgICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDcmVhdGUgdGhlIG1vZGFsIGNvbnRlbnQgd2l0aCBzdHlsaW5nXG4gICAgICAgICAgICBjb25zdCBjb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnc3VjY2Vzcy1tb2RhbCcgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFN1Y2Nlc3MgaWNvbiAtIHVzaW5nIGVtb2ppIGZvciBzaW1wbGljaXR5XG4gICAgICAgICAgICBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiAnc3VjY2Vzcy1pY29uJywgdGV4dDogJ/CflJcnIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb250YWluZXIuY3JlYXRlRWwoJ2gyJywgeyBcbiAgICAgICAgICAgICAgdGV4dDogYExpbmsgQ3JlYXRlZCBTdWNjZXNzZnVsbHkhYCxcbiAgICAgICAgICAgICAgY2xzOiAnc3VjY2Vzcy10aXRsZSdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb250YWluZXIuY3JlYXRlRWwoJ3AnLCB7IFxuICAgICAgICAgICAgICB0ZXh0OiBgQSBsaW5rIHRvIFwiJHtjb25uZWN0aW9uLnRhcmdldE5vdGUudGl0bGV9XCIgaGFzIGJlZW4gYWRkZWQgdG8gXCIke2Nvbm5lY3Rpb24uc291cmNlTm90ZS50aXRsZX1cIi5gLFxuICAgICAgICAgICAgICBjbHM6ICdub3RlLWluZm8nXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29udGFpbmVyLmNyZWF0ZUVsKCdwJywgeyBcbiAgICAgICAgICAgICAgdGV4dDogYFdvdWxkIHlvdSBsaWtlIHRvIG9wZW4gXCIke2Nvbm5lY3Rpb24udGFyZ2V0Tm90ZS50aXRsZX1cIiBhcyB3ZWxsP2AsXG4gICAgICAgICAgICAgIGNsczogJ2NvbmZpcm1hdGlvbi1xdWVzdGlvbidcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBidXR0b25Db250YWluZXIgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiAnbW9kYWwtYnV0dG9uLWNvbnRhaW5lcicgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEJ1dHRvbiB0byBvcGVuIHRoZSB0YXJnZXQgbm90ZVxuICAgICAgICAgICAgY29uc3Qgb3BlbkJ1dHRvbiA9IG5ldyBCdXR0b25Db21wb25lbnQoYnV0dG9uQ29udGFpbmVyKVxuICAgICAgICAgICAgICAuc2V0QnV0dG9uVGV4dChgT3BlbiBcIiR7Y29ubmVjdGlvbi50YXJnZXROb3RlLnRpdGxlfVwiYClcbiAgICAgICAgICAgICAgLnNldEN0YSgpXG4gICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBPcGVuIGluIGEgbmV3IGxlYWYgKHNwbGl0IHBhbmUpXG4gICAgICAgICAgICAgICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5jcmVhdGVMZWFmQnlTcGxpdChcbiAgICAgICAgICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmLCBcbiAgICAgICAgICAgICAgICAgICd2ZXJ0aWNhbCdcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxlYWYub3BlbkZpbGUodGFyZ2V0RmlsZSk7XG4gICAgICAgICAgICAgICAgbW9kYWwuY2xvc2UoKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEJ1dHRvbiB0byBzdGF5IG9uIHRoZSBjdXJyZW50IG5vdGVcbiAgICAgICAgICAgIG5ldyBCdXR0b25Db21wb25lbnQoYnV0dG9uQ29udGFpbmVyKVxuICAgICAgICAgICAgICAuc2V0QnV0dG9uVGV4dCgnU3RheSBvbiBjdXJyZW50IG5vdGUnKVxuICAgICAgICAgICAgICAub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICAgICAgbW9kYWwuY2xvc2UoKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIG1vZGFsLm9wZW4oKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igb3BlbmluZyB0YXJnZXQgbm90ZTonLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0sIDUwMCk7XG4gICAgfVxuICB9XG4gIFxuICBvbkNsb3NlKCkge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICB9XG59XG5cbi8vIERlZmluZSB0aGUgdmlldyB0eXBlIGZvciBvdXIgdmlzdWFsaXphdGlvblxuY29uc3QgVklFV19UWVBFX1RTTkUgPSBcInRzbmUtdmlzdWFsaXphdGlvblwiO1xuXG5pbnRlcmZhY2UgVmliZUJveVNldHRpbmdzIHtcbiAgcGVycGxleGl0eTogbnVtYmVyO1xuICBpdGVyYXRpb25zOiBudW1iZXI7XG4gIGVwc2lsb246IG51bWJlcjtcbn1cblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogVmliZUJveVNldHRpbmdzID0ge1xuICBwZXJwbGV4aXR5OiAzMCxcbiAgaXRlcmF0aW9uczogMTAwMCxcbiAgZXBzaWxvbjogMTBcbn1cblxuLy8gQ3VzdG9tIHZpZXcgZm9yIHQtU05FIHZpc3VhbGl6YXRpb25cbmNsYXNzIFRTTkVWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmKSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiBWSUVXX1RZUEVfVFNORTtcbiAgfVxuXG4gIGdldERpc3BsYXlUZXh0KCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFwidC1TTkUgVmlzdWFsaXphdGlvblwiO1xuICB9XG5cbiAgZ2V0SWNvbigpOiBzdHJpbmcge1xuICAgIHJldHVybiBcImdyYXBoXCI7XG4gIH1cblxuICAvLyBTZXQgb25Ecm9wIGhhbmRsZXIgdG8gcHJldmVudCBlcnJvclxuICBvbkRyb3AoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuICAgIC8vIE5vdCBpbXBsZW1lbnRlZFxuICB9XG5cbiAgLy8gU2V0IG9uUGFuZU1lbnUgaGFuZGxlciB0byBwcmV2ZW50IGVycm9yXG4gIG9uUGFuZU1lbnUobWVudTogYW55LCBzb3VyY2U6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIE5vdCBpbXBsZW1lbnRlZFxuICB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGVudEVsO1xuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIFxuICAgIC8vIEFkZCBoZWFkZXJcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwidHNuZS1oZWFkZXJcIiB9LCAoaGVhZGVyKSA9PiB7XG4gICAgICBoZWFkZXIuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwidC1TTkUgTm90ZSBWaXN1YWxpemF0aW9uXCIgfSk7XG4gICAgICBcbiAgICAgIC8vIEFkZCBhY3Rpb24gYnV0dG9uc1xuICAgICAgY29uc3QgYWN0aW9uQmFyID0gaGVhZGVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInRzbmUtYWN0aW9uc1wiIH0pO1xuICAgICAgXG4gICAgICAvLyBDcmVhdGUgcGFyYW1ldGVyIGNvbnRyb2wgcGFuZWxcbiAgICAgIGNvbnN0IHBhcmFtUGFuZWwgPSBoZWFkZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwidHNuZS1wYXJhbS1wYW5lbFwiIH0pO1xuICAgICAgcGFyYW1QYW5lbC5zdHlsZS5tYXJnaW5Cb3R0b20gPSBcIjE1cHhcIjtcbiAgICAgIHBhcmFtUGFuZWwuc3R5bGUuZGlzcGxheSA9IFwiZmxleFwiO1xuICAgICAgcGFyYW1QYW5lbC5zdHlsZS5mbGV4V3JhcCA9IFwid3JhcFwiO1xuICAgICAgcGFyYW1QYW5lbC5zdHlsZS5nYXAgPSBcIjE1cHhcIjtcbiAgICAgIHBhcmFtUGFuZWwuc3R5bGUuYWxpZ25JdGVtcyA9IFwiY2VudGVyXCI7XG4gICAgICBcbiAgICAgIC8vIEFkZCBwZXJwbGV4aXR5IHNsaWRlclxuICAgICAgY29uc3QgcGx1Z2luID0gKHRoaXMuYXBwIGFzIGFueSkucGx1Z2lucy5wbHVnaW5zW1widmliZS1ib2lcIl0gYXMgVmliZUJveVBsdWdpbjtcbiAgICAgIFxuICAgICAgLy8gUGVycGxleGl0eSBjb250cm9sXG4gICAgICBjb25zdCBwZXJwbGV4aXR5Q29udGFpbmVyID0gcGFyYW1QYW5lbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJ0c25lLXBhcmFtLWNvbnRhaW5lclwiIH0pO1xuICAgICAgcGVycGxleGl0eUNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gXCJmbGV4XCI7XG4gICAgICBwZXJwbGV4aXR5Q29udGFpbmVyLnN0eWxlLmFsaWduSXRlbXMgPSBcImNlbnRlclwiO1xuICAgICAgcGVycGxleGl0eUNvbnRhaW5lci5zdHlsZS5nYXAgPSBcIjEwcHhcIjtcbiAgICAgIFxuICAgICAgY29uc3QgcGVycGxleGl0eUxhYmVsID0gcGVycGxleGl0eUNvbnRhaW5lci5jcmVhdGVFbChcImxhYmVsXCIsIHsgdGV4dDogXCJQZXJwbGV4aXR5OlwiIH0pO1xuICAgICAgcGVycGxleGl0eUxhYmVsLnN0eWxlLm1pbldpZHRoID0gXCI4MHB4XCI7XG4gICAgICBcbiAgICAgIGNvbnN0IHBlcnBsZXhpdHlWYWx1ZSA9IHBlcnBsZXhpdHlDb250YWluZXIuY3JlYXRlRWwoXCJzcGFuXCIsIHsgXG4gICAgICAgIHRleHQ6IHBsdWdpbi5zZXR0aW5ncy5wZXJwbGV4aXR5LnRvU3RyaW5nKCksXG4gICAgICAgIGNsczogXCJ0c25lLXBhcmFtLXZhbHVlXCJcbiAgICAgIH0pO1xuICAgICAgcGVycGxleGl0eVZhbHVlLnN0eWxlLm1pbldpZHRoID0gXCIzMHB4XCI7XG4gICAgICBwZXJwbGV4aXR5VmFsdWUuc3R5bGUudGV4dEFsaWduID0gXCJjZW50ZXJcIjtcbiAgICAgIFxuICAgICAgY29uc3QgcGVycGxleGl0eVNsaWRlciA9IHBlcnBsZXhpdHlDb250YWluZXIuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IFxuICAgICAgICB0eXBlOiBcInJhbmdlXCIsXG4gICAgICAgIGNsczogXCJ0c25lLXBhcmFtLXNsaWRlclwiXG4gICAgICB9KTtcbiAgICAgIHBlcnBsZXhpdHlTbGlkZXIuc2V0QXR0cmlidXRlKFwibWluXCIsIFwiNVwiKTtcbiAgICAgIHBlcnBsZXhpdHlTbGlkZXIuc2V0QXR0cmlidXRlKFwibWF4XCIsIFwiMTAwXCIpO1xuICAgICAgcGVycGxleGl0eVNsaWRlci5zZXRBdHRyaWJ1dGUoXCJzdGVwXCIsIFwiNVwiKTtcbiAgICAgIHBlcnBsZXhpdHlTbGlkZXIuc2V0QXR0cmlidXRlKFwidmFsdWVcIiwgcGx1Z2luLnNldHRpbmdzLnBlcnBsZXhpdHkudG9TdHJpbmcoKSk7XG4gICAgICBcbiAgICAgIHBlcnBsZXhpdHlTbGlkZXIuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsIGFzeW5jIChlKSA9PiB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcGFyc2VJbnQoKGUudGFyZ2V0IGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlKTtcbiAgICAgICAgcGVycGxleGl0eVZhbHVlLnRleHRDb250ZW50ID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgcGx1Z2luLnNldHRpbmdzLnBlcnBsZXhpdHkgPSB2YWx1ZTtcbiAgICAgICAgYXdhaXQgcGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIEl0ZXJhdGlvbnMgY29udHJvbFxuICAgICAgY29uc3QgaXRlcmF0aW9uc0NvbnRhaW5lciA9IHBhcmFtUGFuZWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwidHNuZS1wYXJhbS1jb250YWluZXJcIiB9KTtcbiAgICAgIGl0ZXJhdGlvbnNDb250YWluZXIuc3R5bGUuZGlzcGxheSA9IFwiZmxleFwiO1xuICAgICAgaXRlcmF0aW9uc0NvbnRhaW5lci5zdHlsZS5hbGlnbkl0ZW1zID0gXCJjZW50ZXJcIjtcbiAgICAgIGl0ZXJhdGlvbnNDb250YWluZXIuc3R5bGUuZ2FwID0gXCIxMHB4XCI7XG4gICAgICBcbiAgICAgIGNvbnN0IGl0ZXJhdGlvbnNMYWJlbCA9IGl0ZXJhdGlvbnNDb250YWluZXIuY3JlYXRlRWwoXCJsYWJlbFwiLCB7IHRleHQ6IFwiSXRlcmF0aW9uczpcIiB9KTtcbiAgICAgIGl0ZXJhdGlvbnNMYWJlbC5zdHlsZS5taW5XaWR0aCA9IFwiODBweFwiO1xuICAgICAgXG4gICAgICBjb25zdCBpdGVyYXRpb25zVmFsdWUgPSBpdGVyYXRpb25zQ29udGFpbmVyLmNyZWF0ZUVsKFwic3BhblwiLCB7IFxuICAgICAgICB0ZXh0OiBwbHVnaW4uc2V0dGluZ3MuaXRlcmF0aW9ucy50b1N0cmluZygpLFxuICAgICAgICBjbHM6IFwidHNuZS1wYXJhbS12YWx1ZVwiXG4gICAgICB9KTtcbiAgICAgIGl0ZXJhdGlvbnNWYWx1ZS5zdHlsZS5taW5XaWR0aCA9IFwiMzBweFwiO1xuICAgICAgaXRlcmF0aW9uc1ZhbHVlLnN0eWxlLnRleHRBbGlnbiA9IFwiY2VudGVyXCI7XG4gICAgICBcbiAgICAgIGNvbnN0IGl0ZXJhdGlvbnNTbGlkZXIgPSBpdGVyYXRpb25zQ29udGFpbmVyLmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyBcbiAgICAgICAgdHlwZTogXCJyYW5nZVwiLFxuICAgICAgICBjbHM6IFwidHNuZS1wYXJhbS1zbGlkZXJcIlxuICAgICAgfSk7XG4gICAgICBpdGVyYXRpb25zU2xpZGVyLnNldEF0dHJpYnV0ZShcIm1pblwiLCBcIjI1MFwiKTtcbiAgICAgIGl0ZXJhdGlvbnNTbGlkZXIuc2V0QXR0cmlidXRlKFwibWF4XCIsIFwiMjAwMFwiKTtcbiAgICAgIGl0ZXJhdGlvbnNTbGlkZXIuc2V0QXR0cmlidXRlKFwic3RlcFwiLCBcIjI1MFwiKTtcbiAgICAgIGl0ZXJhdGlvbnNTbGlkZXIuc2V0QXR0cmlidXRlKFwidmFsdWVcIiwgcGx1Z2luLnNldHRpbmdzLml0ZXJhdGlvbnMudG9TdHJpbmcoKSk7XG4gICAgICBcbiAgICAgIGl0ZXJhdGlvbnNTbGlkZXIuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsIGFzeW5jIChlKSA9PiB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcGFyc2VJbnQoKGUudGFyZ2V0IGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlKTtcbiAgICAgICAgaXRlcmF0aW9uc1ZhbHVlLnRleHRDb250ZW50ID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgcGx1Z2luLnNldHRpbmdzLml0ZXJhdGlvbnMgPSB2YWx1ZTtcbiAgICAgICAgYXdhaXQgcGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIEFjdGlvbiBidXR0b25zXG4gICAgICBjb25zdCBydW5CdXR0b24gPSBhY3Rpb25CYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlJ1biBBbmFseXNpc1wiLCBjbHM6IFwibW9kLWN0YVwiIH0pO1xuICAgICAgcnVuQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIC8vIEdldCB0aGUgcGx1Z2luIGluc3RhbmNlIGFuZCBydW4gdC1TTkVcbiAgICAgICAgcGx1Z2luLnJ1blRTTkUoKTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBzdWdnZXN0TGlua3NCdXR0b24gPSBhY3Rpb25CYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlN1Z2dlc3QgTGlua3NcIiwgY2xzOiBcIm1vZC1jdGFcIiB9KTtcbiAgICAgIHN1Z2dlc3RMaW5rc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICAvLyBTdWdnZXN0IGxpbmtzXG4gICAgICAgIHBsdWdpbi5zdWdnZXN0TGlua3MoKTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RGb2xkZXJCdXR0b24gPSBhY3Rpb25CYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlNlbGVjdCBGb2xkZXJcIiB9KTtcbiAgICAgIHNlbGVjdEZvbGRlckJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICAvLyBUT0RPOiBJbXBsZW1lbnQgZm9sZGVyIHNlbGVjdGlvblxuICAgICAgICBuZXcgTm90aWNlKFwiRm9sZGVyIHNlbGVjdGlvbiBub3QgaW1wbGVtZW50ZWQgeWV0XCIpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgXG4gICAgLy8gQWRkIGluZm8gdGV4dFxuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcInBcIiwgeyBcbiAgICAgIHRleHQ6IFwiUnVuIHQtU05FIGFuYWx5c2lzIHRvIHZpc3VhbGl6ZSB5b3VyIG5vdGVzIGFzIGNsdXN0ZXJzIGJhc2VkIG9uIGNvbnRlbnQgc2ltaWxhcml0eS5cIixcbiAgICAgIGNsczogXCJ0c25lLWluZm9cIlxuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCB2aXN1YWxpemF0aW9uIGNvbnRhaW5lclxuICAgIGNvbnN0IHRzbmVDb250YWluZXIgPSBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBcbiAgICAgIGNsczogXCJ0c25lLWNvbnRhaW5lclwiLCBcbiAgICAgIGF0dHI6IHsgaWQ6IFwidHNuZS1jb250YWluZXJcIiB9IFxuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBzdGF0dXMgdGV4dFxuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7IFxuICAgICAgY2xzOiBcInRzbmUtc3RhdHVzXCIsXG4gICAgICBhdHRyOiB7IGlkOiBcInRzbmUtc3RhdHVzXCIgfVxuICAgIH0sIChzdGF0dXMpID0+IHtcbiAgICAgIHN0YXR1cy5jcmVhdGVFbChcInBcIiwgeyBcbiAgICAgICAgdGV4dDogXCJVc2UgdGhlICdSdW4gQW5hbHlzaXMnIGJ1dHRvbiB0byBzdGFydCBwcm9jZXNzaW5nIHlvdXIgbm90ZXMuXCIsXG4gICAgICAgIGNsczogXCJ0c25lLXN0YXR1cy10ZXh0XCJcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBzaW1wbGUgQ1NTXG4gICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgICAgLnRzbmUtaGVhZGVyIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMXJlbTtcbiAgICAgIH1cbiAgICAgIC50c25lLWhlYWRlciBoMiB7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDFyZW07XG4gICAgICB9XG4gICAgICAudHNuZS1hY3Rpb25zIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgZ2FwOiAxMHB4O1xuICAgICAgICBtYXJnaW4tdG9wOiAxcmVtO1xuICAgICAgICBhbGlnbi1zZWxmOiBmbGV4LWVuZDtcbiAgICAgIH1cbiAgICAgIC50c25lLXBhcmFtLXBhbmVsIHtcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tYmFja2dyb3VuZC1zZWNvbmRhcnkpO1xuICAgICAgICBwYWRkaW5nOiAxMHB4O1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7XG4gICAgICB9XG4gICAgICAudHNuZS1wYXJhbS1zbGlkZXIge1xuICAgICAgICB3aWR0aDogMTUwcHg7XG4gICAgICB9XG4gICAgICAudHNuZS1wYXJhbS12YWx1ZSB7XG4gICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICBtaW4td2lkdGg6IDMwcHg7XG4gICAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgfVxuICAgICAgLnRzbmUtaW5mbyB7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDFyZW07XG4gICAgICAgIG9wYWNpdHk6IDAuODtcbiAgICAgIH1cbiAgICAgIC50c25lLWNvbnRhaW5lciB7XG4gICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICBoZWlnaHQ6IDgwMHB4O1xuICAgICAgICBtYXJnaW46IDFyZW0gMDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICBvdmVyZmxvdy14OiBhdXRvO1xuICAgICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgICAgICBib3gtc2hhZG93OiAwIDAgMTBweCByZ2JhKDAsIDAsIDAsIDAuMSk7XG4gICAgICB9XG4gICAgICAudHNuZS1zdGF0dXMge1xuICAgICAgICBtYXJnaW4tdG9wOiAxMHB4O1xuICAgICAgICBwYWRkaW5nOiAwLjVyZW07XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tYmFja2dyb3VuZC1zZWNvbmRhcnkpO1xuICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgfVxuICAgICAgLnRzbmUtc3RhdHVzLXRleHQge1xuICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgIGZvbnQtc2l6ZTogMC45cmVtO1xuICAgICAgICBvcGFjaXR5OiAwLjg7XG4gICAgICB9XG4gICAgICAudHNuZS1jb250cm9sLXBhbmVsIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgZmxleC13cmFwOiB3cmFwO1xuICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTBweDtcbiAgICAgIH1cbiAgICAgIC50c25lLWJ1dHRvbi1ncm91cCBidXR0b24ge1xuICAgICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kLWNvbG9yIDAuMnMsIGNvbG9yIDAuMnM7XG4gICAgICB9XG4gICAgICAudHNuZS1idXR0b24tZ3JvdXAgYnV0dG9uOmZpcnN0LWNoaWxkIHtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4IDAgMCA0cHg7XG4gICAgICB9XG4gICAgICAudHNuZS1idXR0b24tZ3JvdXAgYnV0dG9uOmxhc3QtY2hpbGQge1xuICAgICAgICBib3JkZXItcmFkaXVzOiAwIDRweCA0cHggMDtcbiAgICAgIH1cbiAgICBgO1xuICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFZpYmVCb3lQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5nczogVmliZUJveVNldHRpbmdzO1xuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG4gICAgLy8gUmVnaXN0ZXIgdGhlIGN1c3RvbSB2aWV3XG4gICAgdGhpcy5yZWdpc3RlclZpZXcoXG4gICAgICBWSUVXX1RZUEVfVFNORSxcbiAgICAgIChsZWFmKSA9PiBuZXcgVFNORVZpZXcobGVhZilcbiAgICApO1xuXG4gICAgLy8gQWRkIGNvbW1hbmQgdG8gb3BlbiB0aGUgdmlzdWFsaXphdGlvblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogJ29wZW4tdHNuZS12aXN1YWxpemF0aW9uJyxcbiAgICAgIG5hbWU6ICdPcGVuIHQtU05FIFZpc3VhbGl6YXRpb24nLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEFkZCBjb21tYW5kIHRvIHJ1biB0LVNORSBhbmFseXNpc1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogJ3J1bi10c25lLWFuYWx5c2lzJyxcbiAgICAgIG5hbWU6ICdSdW4gdC1TTkUgQW5hbHlzaXMnLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgdGhpcy5ydW5UU05FKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBZGQgc2V0dGluZyB0YWJcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IFNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgfVxuXG4gIG9udW5sb2FkKCkge1xuICAgIC8vIENsZWFuIHVwIHJlc291cmNlcyB3aGVuIHRoZSBwbHVnaW4gaXMgZGlzYWJsZWRcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG5cbiAgYXN5bmMgYWN0aXZhdGVWaWV3KCkge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfVFNORSk7XG4gICAgaWYgKGV4aXN0aW5nLmxlbmd0aCkge1xuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoZXhpc3RpbmdbMF0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZih0cnVlKTtcbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7XG4gICAgICB0eXBlOiBWSUVXX1RZUEVfVFNORSxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIHJ1blRTTkUoKSB7XG4gICAgLy8gUHJvY2VzcyBub3RlcyBhbmQgcnVuIHQtU05FIGFuYWx5c2lzXG4gICAgbmV3IE5vdGljZSgndC1TTkUgYW5hbHlzaXMgc3RhcnRpbmcuLi4nKTtcbiAgICB0aGlzLnVwZGF0ZVN0YXR1cygnR2F0aGVyaW5nIG5vdGVzLi4uJyk7XG4gICAgXG4gICAgLy8gR2V0IGFsbCBtYXJrZG93biBmaWxlcyBpbiB0aGUgdmF1bHRcbiAgICBjb25zdCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgLy8gTGltaXQgdG8gYSByZWFzb25hYmxlIG51bWJlciBvZiBmaWxlcyBmb3IgcGVyZm9ybWFuY2VcbiAgICAgIGNvbnN0IG1heEZpbGVzID0gMjAwO1xuICAgICAgY29uc3Qgc2VsZWN0ZWRGaWxlcyA9IGZpbGVzLnNsaWNlKDAsIG1heEZpbGVzKTtcbiAgICAgIFxuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoYFByb2Nlc3NpbmcgJHtzZWxlY3RlZEZpbGVzLmxlbmd0aH0gbm90ZXMuLi5gKTtcbiAgICAgIFxuICAgICAgLy8gUHJlcGFyZSBub3RlcyBkYXRhIGZvciB0aGUgUHl0aG9uIHNlcnZlclxuICAgICAgY29uc3Qgbm90ZXMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgc2VsZWN0ZWRGaWxlcy5tYXAoYXN5bmMgKGZpbGUpID0+IHtcbiAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgICBjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5zdGF0KGZpbGUucGF0aCk7XG4gICAgICAgICAgY29uc3Qgd29yZENvdW50ID0gY29udGVudC5zcGxpdCgvXFxzKy8pLmxlbmd0aDtcbiAgICAgICAgICBjb25zdCByZWFkaW5nVGltZSA9IE1hdGguY2VpbCh3b3JkQ291bnQgLyAyMDApOyAvLyBBdmcgcmVhZGluZyBzcGVlZCB+MjAwIHdvcmRzL21pbnV0ZVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIEV4dHJhY3QgdGFncyAobG9va2luZyBmb3IgI3RhZyBmb3JtYXQpXG4gICAgICAgICAgY29uc3QgdGFnUmVnZXggPSAvIyhbYS16QS1aMC05Xy1dKykvZztcbiAgICAgICAgICBjb25zdCB0YWdzID0gWy4uLmNvbnRlbnQubWF0Y2hBbGwodGFnUmVnZXgpXS5tYXAobWF0Y2ggPT4gbWF0Y2hbMV0pO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIEdldCBhIGNvbnRlbnQgcHJldmlldyAoZmlyc3QgMTUwIGNoYXJzKVxuICAgICAgICAgIGNvbnN0IGNvbnRlbnRQcmV2aWV3ID0gY29udGVudC5zdWJzdHJpbmcoMCwgMTUwKS5yZXBsYWNlKC9cXG4vZywgJyAnKSArIFxuICAgICAgICAgICAgKGNvbnRlbnQubGVuZ3RoID4gMTUwID8gJy4uLicgOiAnJyk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBhdGg6IGZpbGUucGF0aCxcbiAgICAgICAgICAgIHRpdGxlOiBmaWxlLmJhc2VuYW1lLFxuICAgICAgICAgICAgY29udGVudDogY29udGVudCxcbiAgICAgICAgICAgIG10aW1lOiBzdGF0Lm10aW1lLFxuICAgICAgICAgICAgY3RpbWU6IHN0YXQuY3RpbWUsXG4gICAgICAgICAgICB3b3JkQ291bnQ6IHdvcmRDb3VudCxcbiAgICAgICAgICAgIHJlYWRpbmdUaW1lOiByZWFkaW5nVGltZSxcbiAgICAgICAgICAgIHRhZ3M6IHRhZ3MsXG4gICAgICAgICAgICBjb250ZW50UHJldmlldzogY29udGVudFByZXZpZXdcbiAgICAgICAgICB9O1xuICAgICAgICB9KVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoJ1NlbmRpbmcgZGF0YSB0byB0LVNORSBzZXJ2ZXIuLi4nKTtcbiAgICAgIFxuICAgICAgLy8gQ2hlY2sgaWYgUHl0aG9uIHNlcnZlciBpcyBydW5uaW5nXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBoZWFsdGhDaGVjayA9IGF3YWl0IGZldGNoKCdodHRwOi8vMTI3LjAuMC4xOjEyMzQvaGVhbHRoJywgeyBcbiAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFoZWFsdGhDaGVjay5vaykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlB5dGhvbiBzZXJ2ZXIgaXMgbm90IHJlc3BvbmRpbmdcIik7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBcIkNhbm5vdCBjb25uZWN0IHRvIFB5dGhvbiBzZXJ2ZXIuIE1ha2Ugc3VyZSB0aGUgc2VydmVyIGlzIHJ1bm5pbmcgYXQgaHR0cDovLzEyNy4wLjAuMToxMjM0LiBcIiArXG4gICAgICAgICAgXCJSdW4gJ3B5dGhvbiBzcmMvcHl0aG9uL3RzbmUvc2VydmVyLnB5JyB0byBzdGFydCBpdC5cIlxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBTZW5kIHRvIFB5dGhvbiBzZXJ2ZXIgZm9yIHByb2Nlc3NpbmdcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGBSdW5uaW5nIHQtU05FIGFuYWx5c2lzIHdpdGggcGVycGxleGl0eT0ke3RoaXMuc2V0dGluZ3MucGVycGxleGl0eX0sIGl0ZXJhdGlvbnM9JHt0aGlzLnNldHRpbmdzLml0ZXJhdGlvbnN9Li4uYCk7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCdodHRwOi8vMTI3LjAuMC4xOjEyMzQvcHJvY2VzcycsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgbm90ZXM6IG5vdGVzLFxuICAgICAgICAgIHNldHRpbmdzOiB7XG4gICAgICAgICAgICBwZXJwbGV4aXR5OiB0aGlzLnNldHRpbmdzLnBlcnBsZXhpdHksXG4gICAgICAgICAgICBpdGVyYXRpb25zOiB0aGlzLnNldHRpbmdzLml0ZXJhdGlvbnMsXG4gICAgICAgICAgICBsZWFybmluZ19yYXRlOiB0aGlzLnNldHRpbmdzLmVwc2lsb25cbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNlcnZlciByZXNwb25kZWQgd2l0aCBzdGF0dXM6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICBcbiAgICAgIGlmIChyZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgZXJyb3I6ICR7cmVzdWx0LmVycm9yfWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnVmlzdWFsaXppbmcgcmVzdWx0cy4uLicpO1xuICAgICAgXG4gICAgICAvLyBEZWJ1ZyAtIGxvZyB0aGUgcmVzdWx0IHN0cnVjdHVyZSB0byBjaGVjayBtZXRhZGF0YVxuICAgICAgY29uc29sZS5sb2coJ1Zpc3VhbGl6aW5nIHJlc3VsdCB3aXRoIG1ldGFkYXRhOicsIHJlc3VsdCk7XG4gICAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGFkZGl0aW9uYWwgbWV0YWRhdGFcbiAgICAgIGlmIChyZXN1bHQucG9pbnRzICYmIHJlc3VsdC5wb2ludHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBzYW1wbGVQb2ludCA9IHJlc3VsdC5wb2ludHNbMF07XG4gICAgICAgIGNvbnNvbGUubG9nKCdTYW1wbGUgcG9pbnQgbWV0YWRhdGE6Jywge1xuICAgICAgICAgIGhhc1dvcmRDb3VudDogc2FtcGxlUG9pbnQud29yZENvdW50ICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzTXRpbWU6IHNhbXBsZVBvaW50Lm10aW1lICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzQ3RpbWU6IHNhbXBsZVBvaW50LmN0aW1lICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzVGFnczogc2FtcGxlUG9pbnQudGFncyAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc0NvbnRlbnRQcmV2aWV3OiBzYW1wbGVQb2ludC5jb250ZW50UHJldmlldyAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc0Rpc3RhbmNlVG9DZW50ZXI6IHNhbXBsZVBvaW50LmRpc3RhbmNlVG9DZW50ZXIgIT09IHVuZGVmaW5lZFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gU3RvcmUgdGhlIHJlc3VsdCBmb3IgbGF0ZXIgdXNlIGluIGxpbmsgc3VnZ2VzdGlvbnNcbiAgICAgIHRoaXMubGFzdFJlc3VsdCA9IHJlc3VsdDtcbiAgICAgIFxuICAgICAgLy8gVmlzdWFsaXplIHRoZSByZXN1bHRcbiAgICAgIHRoaXMudmlzdWFsaXplUmVzdWx0KHJlc3VsdCk7XG4gICAgICBcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGBWaXN1YWxpemF0aW9uIGNvbXBsZXRlISBEaXNwbGF5aW5nICR7cmVzdWx0LnBvaW50cy5sZW5ndGh9IG5vdGVzLmApO1xuICAgICAgbmV3IE5vdGljZSgndC1TTkUgYW5hbHlzaXMgY29tcGxldGUhJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHJ1bm5pbmcgdC1TTkUgYW5hbHlzaXM6JywgZXJyb3IpO1xuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoYEVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICBuZXcgTm90aWNlKGB0LVNORSBhbmFseXNpcyBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgdXBkYXRlU3RhdHVzKG1lc3NhZ2U6IHN0cmluZykge1xuICAgIC8vIEZpbmQgdGhlIHN0YXR1cyBlbGVtZW50IGluIHRoZSB2aWV3IGFuZCB1cGRhdGUgaXRcbiAgICBjb25zdCBzdGF0dXNFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RzbmUtc3RhdHVzIC50c25lLXN0YXR1cy10ZXh0Jyk7XG4gICAgaWYgKHN0YXR1c0VsZW1lbnQpIHtcbiAgICAgIHN0YXR1c0VsZW1lbnQudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICAgIH1cbiAgICBjb25zb2xlLmxvZyhgU3RhdHVzOiAke21lc3NhZ2V9YCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgdmlzdWFsaXplUmVzdWx0KHJlc3VsdDogYW55KSB7XG4gICAgLy8gR2V0IG9yIGNyZWF0ZSB0aGUgdmlzdWFsaXphdGlvbiB2aWV3XG4gICAgbGV0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9UU05FKVswXTtcbiAgICBpZiAoIWxlYWYpIHtcbiAgICAgIC8vIEFjdGl2YXRlIHRoZSB2aWV3IGlmIG5vdCBmb3VuZFxuICAgICAgYXdhaXQgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICAgIC8vIFRyeSB0byBnZXQgdGhlIGxlYWYgYWdhaW5cbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9UU05FKVswXTtcbiAgICAgIFxuICAgICAgaWYgKCFsZWFmKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NvdWxkIG5vdCBjcmVhdGUgdmlzdWFsaXphdGlvbiB2aWV3Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gQWNjZXNzIHRoZSB2aWV3IGNvbnRhaW5lclxuICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXcgYXMgVFNORVZpZXc7XG4gICAgY29uc3QgY29udGFpbmVyID0gdmlldy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignI3RzbmUtY29udGFpbmVyJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgaWYgKCFjb250YWluZXIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0NvbnRhaW5lciBub3QgZm91bmQgaW4gdmlldycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICAvLyBDbGVhciBhbnkgZXhpc3RpbmcgY29udGVudFxuICAgIHdoaWxlIChjb250YWluZXIuZmlyc3RDaGlsZCkge1xuICAgICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKGNvbnRhaW5lci5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ3JlYXRlIHRoZSB2aXN1YWxpemVyXG4gICAgY29uc3Qgb3BlbkNhbGxiYWNrID0gKHBhdGg6IHN0cmluZykgPT4ge1xuICAgICAgLy8gT3BlbiB0aGUgc2VsZWN0ZWQgbm90ZVxuICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcbiAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoKS5vcGVuRmlsZShmaWxlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIC8vIENyZWF0ZSBhbmQgdXNlIHRoZSB2aXN1YWxpemVyIGRpcmVjdGx5XG4gICAgY29uc3QgdmlzdWFsaXplciA9IG5ldyBUU05FVmlzdWFsaXplcihjb250YWluZXIsIG9wZW5DYWxsYmFjayk7XG4gICAgdmlzdWFsaXplci5zZXREYXRhKHJlc3VsdCk7XG4gIH1cbiAgXG4gIC8vIE1ldGhvZCB0byBzdWdnZXN0IGxpbmtzIGJldHdlZW4gbm90ZXMgdXNpbmcgTExNXG4gIGFzeW5jIHN1Z2dlc3RMaW5rcygpIHtcbiAgICBpZiAoIXRoaXMubGFzdFJlc3VsdCB8fCAhdGhpcy5sYXN0UmVzdWx0LnBvaW50cyB8fCB0aGlzLmxhc3RSZXN1bHQucG9pbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbmV3IE5vdGljZSgnUGxlYXNlIHJ1biB0LVNORSBhbmFseXNpcyBmaXJzdCB0byBnZW5lcmF0ZSBub3RlIGRhdGEnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgLy8gU2hvdyBhIG5vdGljZSB0aGF0IHdlJ3JlIHN0YXJ0aW5nIHRoZSBwcm9jZXNzXG4gICAgbmV3IE5vdGljZSgnRmluZGluZyBwb3RlbnRpYWwgbm90ZSBjb25uZWN0aW9ucy4uLicpO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICAvLyBGaW5kIHBvdGVudGlhbCBjb25uZWN0aW9ucyBiYXNlZCBvbiB0LVNORSBwcm94aW1pdHkgYW5kIGNsdXN0ZXJpbmdcbiAgICAgIGNvbnN0IGNvbm5lY3Rpb25zID0gdGhpcy5maW5kUG90ZW50aWFsQ29ubmVjdGlvbnModGhpcy5sYXN0UmVzdWx0KTtcbiAgICAgIFxuICAgICAgaWYgKGNvbm5lY3Rpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBuZXcgTm90aWNlKCdObyBzdHJvbmcgY29ubmVjdGlvbnMgZm91bmQgYmV0d2VlbiBub3RlcycpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIENyZWF0ZSBhIG1vZGFsIHRvIGRpc3BsYXkgdGhlIHN1Z2dlc3RlZCBjb25uZWN0aW9uc1xuICAgICAgY29uc3QgbW9kYWwgPSBuZXcgU3VnZ2VzdGVkTGlua3NNb2RhbCh0aGlzLmFwcCwgY29ubmVjdGlvbnMsIHRoaXMpO1xuICAgICAgbW9kYWwub3BlbigpO1xuICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHN1Z2dlc3RpbmcgbGlua3M6JywgZXJyb3IpO1xuICAgICAgbmV3IE5vdGljZShgRXJyb3Igc3VnZ2VzdGluZyBsaW5rczogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxuICBcbiAgLy8gU3RvcmUgdGhlIGxhc3QgcmVzdWx0IGZvciB1c2UgaW4gbGluayBzdWdnZXN0aW9uc1xuICBwcml2YXRlIGxhc3RSZXN1bHQ6IGFueSA9IG51bGw7XG4gIFxuICAvLyBGaW5kIHBvdGVudGlhbCBjb25uZWN0aW9ucyBiZXR3ZWVuIG5vdGVzIGJhc2VkIG9uIHQtU05FIHJlc3VsdHNcbiAgcHJpdmF0ZSBmaW5kUG90ZW50aWFsQ29ubmVjdGlvbnMocmVzdWx0OiBhbnkpOiBOb3RlQ29ubmVjdGlvbltdIHtcbiAgICBjb25zdCBjb25uZWN0aW9uczogTm90ZUNvbm5lY3Rpb25bXSA9IFtdO1xuICAgIGNvbnN0IHBvaW50cyA9IHJlc3VsdC5wb2ludHMgYXMgVFNORVBvaW50W107XG4gICAgXG4gICAgLy8gMS4gRmluZCBub3RlcyBpbiB0aGUgc2FtZSBjbHVzdGVyXG4gICAgY29uc3QgY2x1c3Rlckdyb3VwczogeyBba2V5OiBudW1iZXJdOiBUU05FUG9pbnRbXSB9ID0ge307XG4gICAgXG4gICAgLy8gR3JvdXAgcG9pbnRzIGJ5IGNsdXN0ZXJcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHBvaW50cykge1xuICAgICAgaWYgKHBvaW50LmNsdXN0ZXIgPT09IC0xKSBjb250aW51ZTsgLy8gU2tpcCB1bmNsdXN0ZXJlZCBwb2ludHNcbiAgICAgIFxuICAgICAgaWYgKCFjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdKSB7XG4gICAgICAgIGNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0gPSBbXTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXS5wdXNoKHBvaW50KTtcbiAgICB9XG4gICAgXG4gICAgLy8gRm9yIGVhY2ggY2x1c3RlciwgZmluZCB0aGUgbW9zdCBjZW50cmFsIG5vdGVzXG4gICAgT2JqZWN0LmVudHJpZXMoY2x1c3Rlckdyb3VwcykuZm9yRWFjaCgoW2NsdXN0ZXJJZCwgY2x1c3RlclBvaW50c10pID0+IHtcbiAgICAgIC8vIE9ubHkgY29uc2lkZXIgY2x1c3RlcnMgd2l0aCBhdCBsZWFzdCAyIG5vdGVzXG4gICAgICBpZiAoY2x1c3RlclBvaW50cy5sZW5ndGggPCAyKSByZXR1cm47XG4gICAgICBcbiAgICAgIC8vIEZpbmQgbW9zdCBjZW50cmFsIG5vdGVzIGluIHRoZSBjbHVzdGVyIChjbG9zZXN0IHRvIGNsdXN0ZXIgY2VudGVyKVxuICAgICAgY2x1c3RlclBvaW50cy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGRpc3RBID0gYS5kaXN0YW5jZVRvQ2VudGVyIHx8IEluZmluaXR5O1xuICAgICAgICBjb25zdCBkaXN0QiA9IGIuZGlzdGFuY2VUb0NlbnRlciB8fCBJbmZpbml0eTtcbiAgICAgICAgcmV0dXJuIGRpc3RBIC0gZGlzdEI7XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gVGFrZSB0aGUgbW9zdCBjZW50cmFsIG5vdGVzXG4gICAgICBjb25zdCBjZW50cmFsTm90ZXMgPSBjbHVzdGVyUG9pbnRzLnNsaWNlKDAsIE1hdGgubWluKDMsIGNsdXN0ZXJQb2ludHMubGVuZ3RoKSk7XG4gICAgICBcbiAgICAgIC8vIENyZWF0ZSBjb25uZWN0aW9ucyBiZXR3ZWVuIHRoZSBjZW50cmFsIG5vdGVzXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNlbnRyYWxOb3Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCBjZW50cmFsTm90ZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBjb25zdCBub3RlQSA9IGNlbnRyYWxOb3Rlc1tpXTtcbiAgICAgICAgICBjb25zdCBub3RlQiA9IGNlbnRyYWxOb3Rlc1tqXTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBTa2lwIGlmIHRoZSB0d28gbm90ZXMgYXJlIHZlcnkgZmFyIGFwYXJ0IGluIHRoZSB2aXN1YWxpemF0aW9uXG4gICAgICAgICAgY29uc3QgZGlzdGFuY2UgPSBNYXRoLnNxcnQoXG4gICAgICAgICAgICBNYXRoLnBvdyhub3RlQS54IC0gbm90ZUIueCwgMikgKyBNYXRoLnBvdyhub3RlQS55IC0gbm90ZUIueSwgMilcbiAgICAgICAgICApO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChkaXN0YW5jZSA+IDAuNSkgY29udGludWU7IC8vIFNraXAgaWYgdG9vIGZhclxuICAgICAgICAgIFxuICAgICAgICAgIC8vIENhbGN1bGF0ZSBhIHNpbWlsYXJpdHkgc2NvcmUgKDAtMTAwKVxuICAgICAgICAgIGNvbnN0IHNpbWlsYXJpdHkgPSAxMDAgLSBNYXRoLm1pbigxMDAsIGRpc3RhbmNlICogMTAwKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBGaW5kIGNvbW1vbiB0ZXJtc1xuICAgICAgICAgIGNvbnN0IGNvbW1vblRlcm1zID0gbm90ZUEudG9wX3Rlcm1zLmZpbHRlcih0ZXJtID0+IFxuICAgICAgICAgICAgbm90ZUIudG9wX3Rlcm1zLmluY2x1ZGVzKHRlcm0pXG4gICAgICAgICAgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIHNvdXJjZU5vdGU6IG5vdGVBLFxuICAgICAgICAgICAgdGFyZ2V0Tm90ZTogbm90ZUIsXG4gICAgICAgICAgICBzaW1pbGFyaXR5OiBzaW1pbGFyaXR5LFxuICAgICAgICAgICAgY29tbW9uVGVybXM6IGNvbW1vblRlcm1zLFxuICAgICAgICAgICAgY2x1c3RlclRlcm1zOiByZXN1bHQuY2x1c3Rlcl90ZXJtcz8uW2NsdXN0ZXJJZF0/LnNsaWNlKDAsIDUpLm1hcCgodDogYW55KSA9PiB0LnRlcm0pIHx8IFtdLFxuICAgICAgICAgICAgcmVhc29uOiBgQm90aCBub3RlcyBhcmUgY2VudHJhbCBpbiBjbHVzdGVyICR7Y2x1c3RlcklkfWBcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIC8vIDIuIEZpbmQgbm90ZXMgdGhhdCBhcmUgY2xvc2UgaW4gdGhlIHQtU05FIHByb2plY3Rpb24gYnV0IG1heSBiZSBpbiBkaWZmZXJlbnQgY2x1c3RlcnNcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgZm9yIChsZXQgaiA9IGkgKyAxOyBqIDwgcG9pbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGNvbnN0IG5vdGVBID0gcG9pbnRzW2ldO1xuICAgICAgICBjb25zdCBub3RlQiA9IHBvaW50c1tqXTtcbiAgICAgICAgXG4gICAgICAgIC8vIFNraXAgbm90ZXMgaW4gdGhlIHNhbWUgY2x1c3RlciAoYWxyZWFkeSBoYW5kbGVkIGFib3ZlKVxuICAgICAgICBpZiAobm90ZUEuY2x1c3RlciAhPT0gLTEgJiYgbm90ZUEuY2x1c3RlciA9PT0gbm90ZUIuY2x1c3RlcikgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICAvLyBDYWxjdWxhdGUgRXVjbGlkZWFuIGRpc3RhbmNlIGluIHQtU05FIHNwYWNlXG4gICAgICAgIGNvbnN0IGRpc3RhbmNlID0gTWF0aC5zcXJ0KFxuICAgICAgICAgIE1hdGgucG93KG5vdGVBLnggLSBub3RlQi54LCAyKSArIE1hdGgucG93KG5vdGVBLnkgLSBub3RlQi55LCAyKVxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgLy8gT25seSBjb25zaWRlciB2ZXJ5IGNsb3NlIG5vdGVzXG4gICAgICAgIGlmIChkaXN0YW5jZSA+IDAuMikgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICAvLyBDYWxjdWxhdGUgYSBzaW1pbGFyaXR5IHNjb3JlICgwLTEwMClcbiAgICAgICAgY29uc3Qgc2ltaWxhcml0eSA9IDEwMCAtIE1hdGgubWluKDEwMCwgZGlzdGFuY2UgKiAyMDApO1xuICAgICAgICBcbiAgICAgICAgLy8gRmluZCBjb21tb24gdGVybXNcbiAgICAgICAgY29uc3QgY29tbW9uVGVybXMgPSBub3RlQS50b3BfdGVybXMuZmlsdGVyKHRlcm0gPT4gXG4gICAgICAgICAgbm90ZUIudG9wX3Rlcm1zLmluY2x1ZGVzKHRlcm0pXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICAvLyBPbmx5IGluY2x1ZGUgaWYgdGhleSBoYXZlIGNvbW1vbiB0ZXJtc1xuICAgICAgICBpZiAoY29tbW9uVGVybXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgc291cmNlTm90ZTogbm90ZUEsXG4gICAgICAgICAgICB0YXJnZXROb3RlOiBub3RlQixcbiAgICAgICAgICAgIHNpbWlsYXJpdHk6IHNpbWlsYXJpdHksXG4gICAgICAgICAgICBjb21tb25UZXJtczogY29tbW9uVGVybXMsXG4gICAgICAgICAgICBjbHVzdGVyVGVybXM6IFtdLFxuICAgICAgICAgICAgcmVhc29uOiBgTm90ZXMgYXJlIHZlcnkgY2xvc2UgaW4gdGhlIHZpc3VhbGl6YXRpb24gYW5kIHNoYXJlIGNvbW1vbiB0ZXJtc2BcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBTb3J0IGNvbm5lY3Rpb25zIGJ5IHNpbWlsYXJpdHkgKGhpZ2hlc3QgZmlyc3QpXG4gICAgY29ubmVjdGlvbnMuc29ydCgoYSwgYikgPT4gYi5zaW1pbGFyaXR5IC0gYS5zaW1pbGFyaXR5KTtcbiAgICBcbiAgICAvLyBSZXR1cm4gdG9wIDEwIGNvbm5lY3Rpb25zIHRvIGF2b2lkIG92ZXJ3aGVsbWluZyB0aGUgdXNlclxuICAgIHJldHVybiBjb25uZWN0aW9ucy5zbGljZSgwLCAxMCk7XG4gIH1cbiAgXG4gIC8vIENyZWF0ZSBhIGxpbmsgYmV0d2VlbiB0d28gbm90ZXNcbiAgYXN5bmMgY3JlYXRlTm90ZUxpbmsoc291cmNlTm90ZVBhdGg6IHN0cmluZywgdGFyZ2V0Tm90ZVBhdGg6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZykge1xuICAgIHRyeSB7XG4gICAgICAvLyBHZXQgdGhlIHNvdXJjZSBmaWxlXG4gICAgICBjb25zdCBzb3VyY2VGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHNvdXJjZU5vdGVQYXRoKTtcbiAgICAgIGlmICghKHNvdXJjZUZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTb3VyY2UgZmlsZSBub3QgZm91bmQ6ICR7c291cmNlTm90ZVBhdGh9YCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFJlYWQgdGhlIGZpbGUgY29udGVudFxuICAgICAgY29uc3Qgc291cmNlQ29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoc291cmNlRmlsZSk7XG4gICAgICBcbiAgICAgIC8vIEdlbmVyYXRlIHRoZSBsaW5rIHRleHQgd2l0aCB0aGUgZm9ybWF0dGVkIGNvbm5lY3Rpb24gZGVzY3JpcHRpb25cbiAgICAgIGNvbnN0IHRhcmdldEZpbGVOYW1lID0gdGFyZ2V0Tm90ZVBhdGguc3BsaXQoJy8nKS5wb3AoKSB8fCB0YXJnZXROb3RlUGF0aDtcbiAgICAgIGNvbnN0IGxpbmtUZXh0ID0gYFxcblxcbiMjIFJlbGF0ZWQgTm90ZXNcXG5cXG4tIFtbJHt0YXJnZXRGaWxlTmFtZX1dXSAtICR7ZGVzY3JpcHRpb24udHJpbSgpfVxcbmA7XG4gICAgICBcbiAgICAgIC8vIEFwcGVuZCB0aGUgbGluayB0byB0aGUgc291cmNlIGZpbGVcbiAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShzb3VyY2VGaWxlLCBzb3VyY2VDb250ZW50ICsgbGlua1RleHQpO1xuICAgICAgXG4gICAgICAvLyBPcGVuIHRoZSBzb3VyY2UgZmlsZSBpbiBhIG5ldyBwYW5lIHRvIHNob3cgdGhlIGxpbmtcbiAgICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLmFjdGl2ZUxlYWYgIT09IG51bGwgJiYgXG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmICE9PSB1bmRlZmluZWRcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGF3YWl0IGxlYWYub3BlbkZpbGUoc291cmNlRmlsZSwgeyBcbiAgICAgICAgYWN0aXZlOiB0cnVlLCAgIC8vIE1ha2UgdGhlIHBhbmUgYWN0aXZlXG4gICAgICAgIGVTdGF0ZTogeyAgICAgICAvLyBUcnkgdG8gc2Nyb2xsIHRvIHRoZSBuZXdseSBhZGRlZCBsaW5rXG4gICAgICAgICAgbGluZTogc291cmNlQ29udGVudC5zcGxpdCgnXFxuJykubGVuZ3RoICsgMiwgLy8gQXBwcm94aW1hdGUgbGluZSBudW1iZXIgb2YgdGhlIG5ldyBsaW5rXG4gICAgICAgICAgZm9jdXM6IHRydWUgICAvLyBGb2N1cyB0aGUgZWRpdG9yXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyBTaG93IGEgc3VjY2VzcyBub3RpY2VcbiAgICAgIG5ldyBOb3RpY2UoXCJMaW5rIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5ISDwn5SXXCIsIDIwMDApO1xuICAgICAgXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgY3JlYXRpbmcgbm90ZSBsaW5rOicsIGVycm9yKTtcbiAgICAgIG5ldyBOb3RpY2UoYEZhaWxlZCB0byBjcmVhdGUgbGluazogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxufVxuXG4vLyBJbnRlcmZhY2UgZm9yIHQtU05FIHJlc3VsdCBwb2ludHNcbmludGVyZmFjZSBUU05FUG9pbnQge1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgdGl0bGU6IHN0cmluZztcbiAgcGF0aDogc3RyaW5nO1xuICB0b3BfdGVybXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyOiBudW1iZXI7IC8vIENsdXN0ZXIgSUQgKC0xIG1lYW5zIG5vaXNlL25vdCBjbHVzdGVyZWQpXG4gIFxuICAvLyBBZGRpdGlvbmFsIG1ldGFkYXRhXG4gIG10aW1lPzogbnVtYmVyOyAgICAgIC8vIExhc3QgbW9kaWZpZWQgdGltZVxuICBjdGltZT86IG51bWJlcjsgICAgICAvLyBDcmVhdGlvbiB0aW1lXG4gIHdvcmRDb3VudD86IG51bWJlcjsgIC8vIFdvcmQgY291bnRcbiAgcmVhZGluZ1RpbWU/OiBudW1iZXI7IC8vIEVzdGltYXRlZCByZWFkaW5nIHRpbWUgaW4gbWludXRlcyAgXG4gIHRhZ3M/OiBzdHJpbmdbXTsgICAgIC8vIE5vdGUgdGFnc1xuICBjb250ZW50UHJldmlldz86IHN0cmluZzsgLy8gU2hvcnQgcHJldmlldyBvZiBjb250ZW50XG4gIGRpc3RhbmNlVG9DZW50ZXI/OiBudW1iZXI7IC8vIERpc3RhbmNlIHRvIGNsdXN0ZXIgY2VudGVyXG59XG5cbi8vIEludGVyZmFjZSBmb3IgY2x1c3RlciB0ZXJtIGluZm9ybWF0aW9uXG5pbnRlcmZhY2UgQ2x1c3RlclRlcm0ge1xuICB0ZXJtOiBzdHJpbmc7XG4gIHNjb3JlOiBudW1iZXI7XG59XG5cbi8vIEludGVyZmFjZSBmb3IgY2x1c3RlciBpbmZvcm1hdGlvblxuaW50ZXJmYWNlIENsdXN0ZXJJbmZvIHtcbiAgW2tleTogc3RyaW5nXTogQ2x1c3RlclRlcm1bXTtcbn1cblxuLy8gSW50ZXJmYWNlIGZvciB0LVNORSByZXN1bHRzXG5pbnRlcmZhY2UgVFNORVJlc3VsdCB7XG4gIHBvaW50czogVFNORVBvaW50W107XG4gIGZlYXR1cmVfbmFtZXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyczogbnVtYmVyO1xuICBjbHVzdGVyX3Rlcm1zOiBDbHVzdGVySW5mbztcbn1cblxuLy8gVFNORVZpc3VhbGl6ZXIgaXMgbm93IGltcG9ydGVkIGZyb20gdmlzdWFsaXphdGlvbi50c1xuXG5jbGFzcyBTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHBsdWdpbjogVmliZUJveVBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBWaWJlQm95UGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7Y29udGFpbmVyRWx9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywge3RleHQ6ICdWaWJlIEJvaSAtIHQtU05FIFNldHRpbmdzJ30pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnUGVycGxleGl0eScpXG4gICAgICAuc2V0RGVzYygnQ29udHJvbHMgdGhlIGJhbGFuY2UgYmV0d2VlbiBsb2NhbCBhbmQgZ2xvYmFsIGFzcGVjdHMgb2YgdGhlIGRhdGEgKHJlY29tbWVuZGVkOiA1LTUwKScpXG4gICAgICAuYWRkU2xpZGVyKHNsaWRlciA9PiBzbGlkZXJcbiAgICAgICAgLnNldExpbWl0cyg1LCAxMDAsIDUpXG4gICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5wZXJwbGV4aXR5KVxuICAgICAgICAuc2V0RHluYW1pY1Rvb2x0aXAoKVxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucGVycGxleGl0eSA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdJdGVyYXRpb25zJylcbiAgICAgIC5zZXREZXNjKCdOdW1iZXIgb2YgaXRlcmF0aW9ucyB0byBydW4gdGhlIGFsZ29yaXRobScpXG4gICAgICAuYWRkU2xpZGVyKHNsaWRlciA9PiBzbGlkZXJcbiAgICAgICAgLnNldExpbWl0cygyNTAsIDIwMDAsIDI1MClcbiAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLml0ZXJhdGlvbnMpXG4gICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pdGVyYXRpb25zID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pKTtcbiAgICAgICAgXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnRXBzaWxvbiAobGVhcm5pbmcgcmF0ZSknKVxuICAgICAgLnNldERlc2MoJ0NvbnRyb2xzIHRoZSBzcGVlZCBvZiBvcHRpbWl6YXRpb24nKVxuICAgICAgLmFkZFNsaWRlcihzbGlkZXIgPT4gc2xpZGVyXG4gICAgICAgIC5zZXRMaW1pdHMoMSwgMTAwLCAxKVxuICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZXBzaWxvbilcbiAgICAgICAgLnNldER5bmFtaWNUb29sdGlwKClcbiAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmVwc2lsb24gPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkpO1xuICB9XG59Il0sIm5hbWVzIjpbIk1vZGFsIiwiQnV0dG9uQ29tcG9uZW50IiwiVGV4dEFyZWFDb21wb25lbnQiLCJURmlsZSIsIk5vdGljZSIsIkl0ZW1WaWV3IiwiUGx1Z2luIiwiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciXSwi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
