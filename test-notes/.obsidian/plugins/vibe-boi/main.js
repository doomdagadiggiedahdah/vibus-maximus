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

// Color mode options for visualization
var ColorMode;
(function (ColorMode) {
    ColorMode["Cluster"] = "cluster";
    ColorMode["Tags"] = "tags";
    ColorMode["Folder"] = "folder";
    ColorMode["Created"] = "created";
    ColorMode["Modified"] = "modified"; // Color by modification date
})(ColorMode || (ColorMode = {}));
class TSNEVisualizer {
    constructor(container, openCallback) {
        this.result = null;
        this.width = 1600; // Reduced width to avoid horizontal scrolling
        this.height = 700; // Slightly reduced height to minimize vertical scrolling
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
        this.colorMode = ColorMode.Cluster; // Default color mode
        this.colorMap = new Map(); // For mapping values to colors
        this.container = container;
        this.openCallback = openCallback;
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.classList.add('tsne-canvas');
        this.canvas.style.border = '1px solid var(--background-modifier-border)';
        // Allow the canvas to extend beyond the viewport with scrolling
        this.canvas.style.display = 'block';
        this.canvas.style.minWidth = this.width + 'px';
        this.canvas.style.minHeight = this.height + 'px';
        this.canvas.style.margin = '0 auto'; // Center the canvas horizontally
        // Container takes full width but allows scrolling for overflow
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.overflow = 'auto';
        this.container.style.textAlign = 'center'; // Center the canvas within the container
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not create canvas context');
        }
        this.ctx = context;
        // Clear the container first
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
        // Create color mode control panel
        this.createControlPanel();
        // Add canvas to container
        this.container.appendChild(this.canvas);
        // Add event listeners
        this.addEventListeners();
    }
    // Creates the control panel for color modes
    createControlPanel() {
        const controlPanel = document.createElement('div');
        controlPanel.classList.add('tsne-control-panel');
        controlPanel.style.marginBottom = '10px';
        controlPanel.style.display = 'flex';
        controlPanel.style.justifyContent = 'center';
        controlPanel.style.alignItems = 'center';
        controlPanel.style.flexWrap = 'wrap';
        controlPanel.style.gap = '10px';
        // Add label
        const label = document.createElement('span');
        label.textContent = 'Color by:';
        label.style.marginRight = '10px';
        controlPanel.appendChild(label);
        // Add color mode options
        const colorModes = [
            { value: ColorMode.Cluster, label: 'Cluster' },
            { value: ColorMode.Tags, label: 'Tags' },
            { value: ColorMode.Folder, label: 'Folder' },
            { value: ColorMode.Created, label: 'Creation Date' },
            { value: ColorMode.Modified, label: 'Last Modified' }
        ];
        // Create button group
        const buttonGroup = document.createElement('div');
        buttonGroup.classList.add('tsne-button-group');
        buttonGroup.style.display = 'inline-flex';
        buttonGroup.style.borderRadius = '4px';
        buttonGroup.style.overflow = 'hidden';
        buttonGroup.style.border = '1px solid var(--background-modifier-border)';
        colorModes.forEach(mode => {
            const button = document.createElement('button');
            button.textContent = mode.label;
            button.setAttribute('data-color-mode', mode.value);
            button.style.border = 'none';
            button.style.padding = '5px 10px';
            button.style.background = mode.value === this.colorMode
                ? 'var(--interactive-accent)'
                : 'var(--background-secondary)';
            button.style.color = mode.value === this.colorMode
                ? 'var(--text-on-accent)'
                : 'var(--text-normal)';
            button.style.cursor = 'pointer';
            button.style.fontSize = '12px';
            button.addEventListener('click', () => {
                // Update active button styling
                buttonGroup.querySelectorAll('button').forEach(btn => {
                    btn.style.background = 'var(--background-secondary)';
                    btn.style.color = 'var(--text-normal)';
                });
                button.style.background = 'var(--interactive-accent)';
                button.style.color = 'var(--text-on-accent)';
                // Set the color mode
                this.setColorMode(mode.value);
            });
            buttonGroup.appendChild(button);
        });
        controlPanel.appendChild(buttonGroup);
        this.container.appendChild(controlPanel);
    }
    // Set the color mode and redraw
    setColorMode(mode) {
        this.colorMode = mode;
        this.colorMap.clear(); // Reset color mapping
        if (this.result) {
            this.generateColorMap();
            this.draw();
            this.createLegend();
        }
    }
    // Create a legend showing what the colors represent
    createLegend() {
        // Remove any existing legend
        const existingLegend = this.container.querySelector('.tsne-color-legend');
        if (existingLegend) {
            existingLegend.remove();
        }
        if (!this.result)
            return;
        // Create a container for the legend
        const legendContainer = document.createElement('div');
        legendContainer.classList.add('tsne-color-legend');
        legendContainer.style.position = 'absolute';
        legendContainer.style.right = '20px';
        legendContainer.style.top = '120px'; // Position below the controls
        legendContainer.style.backgroundColor = 'rgba(var(--background-primary-rgb), 0.9)';
        legendContainer.style.border = '1px solid var(--background-modifier-border)';
        legendContainer.style.borderRadius = '4px';
        legendContainer.style.padding = '10px';
        legendContainer.style.fontSize = '12px';
        legendContainer.style.maxWidth = '250px';
        legendContainer.style.maxHeight = '300px';
        legendContainer.style.overflow = 'auto';
        legendContainer.style.zIndex = '10';
        legendContainer.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
        // Add a title
        const title = document.createElement('h3');
        title.textContent = 'Color Legend';
        title.style.marginTop = '0';
        title.style.marginBottom = '8px';
        title.style.fontSize = '14px';
        legendContainer.appendChild(title);
        // Add subtitle with current color mode
        const subtitle = document.createElement('div');
        subtitle.textContent = `Coloring by: ${this.getColorModeLabel()}`;
        subtitle.style.fontStyle = 'italic';
        subtitle.style.marginBottom = '10px';
        subtitle.style.fontSize = '11px';
        legendContainer.appendChild(subtitle);
        // Create the legend items based on color mode
        const legendItems = this.getLegendItems();
        if (legendItems.length === 0) {
            const noData = document.createElement('div');
            noData.textContent = 'No color data available for this mode';
            noData.style.fontStyle = 'italic';
            noData.style.opacity = '0.7';
            legendContainer.appendChild(noData);
        }
        else {
            // Create legend list
            const list = document.createElement('div');
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '5px';
            // Add the items
            legendItems.forEach(item => {
                const itemContainer = document.createElement('div');
                itemContainer.style.display = 'flex';
                itemContainer.style.alignItems = 'center';
                itemContainer.style.gap = '8px';
                // Color box
                const colorBox = document.createElement('div');
                colorBox.style.width = '12px';
                colorBox.style.height = '12px';
                colorBox.style.backgroundColor = item.color;
                colorBox.style.borderRadius = '2px';
                itemContainer.appendChild(colorBox);
                // Label
                const label = document.createElement('div');
                label.textContent = item.label;
                label.style.flex = '1';
                label.style.overflow = 'hidden';
                label.style.textOverflow = 'ellipsis';
                label.style.whiteSpace = 'nowrap';
                // Add title for full text on hover
                label.title = item.label;
                itemContainer.appendChild(label);
                list.appendChild(itemContainer);
            });
            legendContainer.appendChild(list);
        }
        // Close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '5px';
        closeButton.style.right = '5px';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontSize = '12px';
        closeButton.style.color = 'var(--text-muted)';
        closeButton.style.padding = '2px 5px';
        closeButton.addEventListener('click', () => {
            legendContainer.remove();
        });
        legendContainer.appendChild(closeButton);
        // Add to container
        this.container.appendChild(legendContainer);
    }
    // Get a display-friendly label for the current color mode
    getColorModeLabel() {
        switch (this.colorMode) {
            case ColorMode.Cluster: return 'Cluster';
            case ColorMode.Tags: return 'Tags';
            case ColorMode.Folder: return 'Folder';
            case ColorMode.Created: return 'Creation Date';
            case ColorMode.Modified: return 'Modification Date';
            default: return 'Unknown';
        }
    }
    // Get the items to show in the legend
    getLegendItems() {
        if (!this.result)
            return [];
        const items = [];
        switch (this.colorMode) {
            case ColorMode.Cluster:
                // For clusters, show each cluster ID and the top terms
                this.colorMap.forEach((color, clusterId) => {
                    var _a;
                    let label = `Cluster ${clusterId}`;
                    // Add top terms if available
                    if (((_a = this.result) === null || _a === void 0 ? void 0 : _a.cluster_terms) && this.result.cluster_terms[clusterId]) {
                        const terms = this.result.cluster_terms[clusterId]
                            .slice(0, 3)
                            .map(t => t.term)
                            .join(', ');
                        if (terms) {
                            label += `: ${terms}`;
                        }
                    }
                    items.push({ color, label });
                });
                break;
            case ColorMode.Tags:
                // For tags, show each tag
                this.colorMap.forEach((color, tag) => {
                    items.push({ color, label: `#${tag}` });
                });
                break;
            case ColorMode.Folder:
                // For folders, show each folder path
                this.colorMap.forEach((color, folder) => {
                    items.push({ color, label: folder });
                });
                break;
            case ColorMode.Created:
            case ColorMode.Modified:
                // For date ranges, format them nicely
                this.colorMap.forEach((color, rangeKey) => {
                    const [start, end] = rangeKey.split('-').map(Number);
                    const startDate = new Date(start);
                    const endDate = new Date(end);
                    // Format the dates
                    const formatDate = (date) => {
                        return date.toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        });
                    };
                    const label = `${formatDate(startDate)} - ${formatDate(endDate)}`;
                    items.push({ color, label });
                });
                break;
        }
        return items;
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
        this.generateColorMap();
        this.draw();
        this.createLegend();
    }
    // Generate color mapping based on current color mode
    generateColorMap() {
        if (!this.result)
            return;
        this.colorMap.clear();
        // Color palette for different categories
        const colorPalette = [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(199, 199, 199, 1)',
            'rgba(83, 123, 156, 1)',
            'rgba(172, 114, 89, 1)',
            'rgba(127, 255, 212, 1)',
            'rgba(102, 205, 170, 1)',
            'rgba(186, 85, 211, 1)',
            'rgba(219, 112, 147, 1)',
            'rgba(143, 188, 143, 1)',
            'rgba(233, 150, 122, 1)',
            'rgba(240, 230, 140, 1)',
            'rgba(221, 160, 221, 1)',
            'rgba(176, 196, 222, 1)', // light steel blue
        ];
        // Different mapping strategies based on color mode
        switch (this.colorMode) {
            case ColorMode.Cluster:
                // For cluster mode, use the cluster ID as key
                const clusters = new Set();
                this.result.points.forEach(point => {
                    if (point.cluster !== -1) {
                        clusters.add(point.cluster);
                    }
                });
                // Assign a color to each cluster
                Array.from(clusters).forEach((cluster, index) => {
                    const colorIndex = index % colorPalette.length;
                    this.colorMap.set(cluster.toString(), colorPalette[colorIndex]);
                });
                break;
            case ColorMode.Tags:
                // For tag mode, extract unique tags from all points
                const tags = new Set();
                this.result.points.forEach(point => {
                    if (point.tags && point.tags.length > 0) {
                        point.tags.forEach(tag => tags.add(tag));
                    }
                });
                // Assign a color to each unique tag
                Array.from(tags).forEach((tag, index) => {
                    const colorIndex = index % colorPalette.length;
                    this.colorMap.set(tag, colorPalette[colorIndex]);
                });
                break;
            case ColorMode.Folder:
                // For folder mode, extract unique folders from paths
                const folders = new Set();
                this.result.points.forEach(point => {
                    const folder = point.path.split('/').slice(0, -1).join('/') || '/';
                    folders.add(folder);
                });
                // Assign a color to each folder
                Array.from(folders).forEach((folder, index) => {
                    const colorIndex = index % colorPalette.length;
                    this.colorMap.set(folder, colorPalette[colorIndex]);
                });
                break;
            case ColorMode.Created:
            case ColorMode.Modified:
                // For date-based modes, create time-based color ranges
                const dateField = this.colorMode === ColorMode.Created ? 'ctime' : 'mtime';
                const dates = [];
                // Collect all valid date values
                this.result.points.forEach(point => {
                    const date = point[dateField];
                    if (date) {
                        dates.push(date);
                    }
                });
                if (dates.length === 0)
                    break;
                // Find min and max dates to create ranges
                const minDate = Math.min(...dates);
                const maxDate = Math.max(...dates);
                const timeRange = maxDate - minDate;
                // Create 8 time buckets
                const numBuckets = 8;
                const bucketSize = timeRange / numBuckets;
                // For each time bucket, assign a color
                for (let i = 0; i < numBuckets; i++) {
                    const bucketStart = minDate + (i * bucketSize);
                    const bucketEnd = bucketStart + bucketSize;
                    // Store the time range as a key (e.g., "timestamp1-timestamp2")
                    const rangeKey = `${bucketStart}-${bucketEnd}`;
                    const colorIndex = i % colorPalette.length;
                    this.colorMap.set(rangeKey, colorPalette[colorIndex]);
                }
                break;
        }
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
                const labelText = `Cluster ${clusterId}: ${terms}`;
                this.ctx.font = 'bold 14px var(--font-text)'; // Slightly larger font
                // Measure text to create background
                const textMetrics = this.ctx.measureText(labelText);
                const textWidth = textMetrics.width;
                const textHeight = 18; // Approximation for height
                // Draw background for label
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Semi-transparent black background
                this.ctx.fillRect(centerX - textWidth / 2 - 5, minY - textHeight - 5, textWidth + 10, textHeight);
                // Draw text
                this.ctx.fillStyle = '#ffffff'; // Bright white for better visibility
                this.ctx.textAlign = 'center';
                this.ctx.fillText(labelText, centerX, minY - 5);
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
        // Draw circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.pointRadius, 0, Math.PI * 2);
        // Determine color based on hover state and current color mode
        if (this.hoveredPoint === point) {
            // Hovered points are always highlighted in the accent color
            this.ctx.fillStyle = 'var(--interactive-accent)';
        }
        else {
            // Get the color based on the current color mode
            this.ctx.fillStyle = this.getPointColor(point);
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
    // Get color for a point based on current color mode
    getPointColor(point) {
        // Default color for points with no applicable metadata
        const defaultColor = 'var(--text-muted)';
        switch (this.colorMode) {
            case ColorMode.Cluster:
                if (point.cluster === -1)
                    return defaultColor;
                return this.colorMap.get(point.cluster.toString()) || defaultColor;
            case ColorMode.Tags:
                // If point has tags, use the first tag for color
                if (point.tags && point.tags.length > 0) {
                    return this.colorMap.get(point.tags[0]) || defaultColor;
                }
                return defaultColor;
            case ColorMode.Folder:
                // Get folder from path
                const folder = point.path.split('/').slice(0, -1).join('/') || '/';
                return this.colorMap.get(folder) || defaultColor;
            case ColorMode.Created:
            case ColorMode.Modified:
                // For date-based coloring, find which time bucket this point belongs to
                const dateField = this.colorMode === ColorMode.Created ? 'ctime' : 'mtime';
                const date = point[dateField];
                if (!date)
                    return defaultColor;
                // Check each time range to find where this date fits
                for (const [rangeKey, color] of this.colorMap.entries()) {
                    const [start, end] = rangeKey.split('-').map(Number);
                    if (date >= start && date <= end) {
                        return color;
                    }
                }
                return defaultColor;
            default:
                return defaultColor;
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
        // Get color information based on current mode
        let colorInfo = '';
        switch (this.colorMode) {
            case ColorMode.Cluster:
                const clusterId = this.hoveredPoint.cluster;
                if (clusterId === -1) {
                    colorInfo = 'Not clustered';
                }
                else {
                    // Get cluster terms if available
                    let clusterTerms = '';
                    if (this.result.cluster_terms && this.result.cluster_terms[clusterId]) {
                        clusterTerms = this.result.cluster_terms[clusterId]
                            .slice(0, 3) // Take top 3 terms
                            .map(t => t.term)
                            .join(', ');
                    }
                    colorInfo = `Cluster ${clusterId}: ${clusterTerms}`;
                }
                break;
            case ColorMode.Tags:
                colorInfo = (this.hoveredPoint.tags && this.hoveredPoint.tags.length > 0)
                    ? `Tags: ${this.hoveredPoint.tags.join(', ')}`
                    : 'No tags';
                break;
            case ColorMode.Folder:
                const folder = path.split('/').slice(0, -1).join('/') || '/';
                colorInfo = `Folder: ${folder}`;
                break;
            case ColorMode.Created:
                const ctime = this.hoveredPoint.ctime;
                colorInfo = ctime
                    ? `Created: ${new Date(ctime).toLocaleString()}`
                    : 'Creation time unknown';
                break;
            case ColorMode.Modified:
                const mtime = this.hoveredPoint.mtime;
                colorInfo = mtime
                    ? `Modified: ${new Date(mtime).toLocaleString()}`
                    : 'Modification time unknown';
                break;
        }
        // Get additional metadata if available
        const wordCount = this.hoveredPoint.wordCount ? `${this.hoveredPoint.wordCount} words` : '';
        const readingTime = this.hoveredPoint.readingTime ? `~${this.hoveredPoint.readingTime} min read` : '';
        const contentPreview = this.hoveredPoint.contentPreview ? this.hoveredPoint.contentPreview : '';
        // Prepare text
        this.ctx.font = 'bold 14px var(--font-text)';
        const titleWidth = this.ctx.measureText(title).width;
        this.ctx.font = '12px var(--font-text)';
        const pathWidth = this.ctx.measureText(path).width;
        const termsWidth = this.ctx.measureText(`Keywords: ${terms}`).width;
        const clusterWidth = this.ctx.measureText(`Cluster: ${colorInfo}`).width;
        const previewWidth = contentPreview ? this.ctx.measureText(`Preview: ${contentPreview.substring(0, 50)}...`).width : 0;
        // Calculate tooltip dimensions
        const tooltipWidth = Math.max(titleWidth, pathWidth, termsWidth, clusterWidth, previewWidth) + 20;
        const tooltipHeight = contentPreview ? 135 : 95; // Increased height if we have preview text
        const tooltipX = Math.min(x + 10, this.width - tooltipWidth - 10);
        const tooltipY = Math.min(y - 10, this.height - tooltipHeight - 10);
        // Draw tooltip background with a solid color (more reliable)
        this.ctx.fillStyle = 'rgba(245, 245, 250, 0.95)';
        this.ctx.strokeStyle = 'rgba(150, 150, 160, 0.8)';
        this.ctx.lineWidth = 1;
        this.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 5);
        this.ctx.fill();
        this.ctx.stroke();
        // Draw tooltip content
        this.ctx.textAlign = 'left';
        // Title with bold and dark color
        this.ctx.font = 'bold 14px sans-serif';
        this.ctx.fillStyle = '#0066cc';
        this.ctx.fillText(title, tooltipX + 10, tooltipY + 20);
        // Path in muted color
        this.ctx.font = 'italic 11px sans-serif';
        this.ctx.fillStyle = '#666666';
        this.ctx.fillText(path, tooltipX + 10, tooltipY + 35);
        // Keywords in normal text color
        this.ctx.font = '12px sans-serif';
        this.ctx.fillStyle = '#333333';
        this.ctx.fillText(`Keywords: ${terms}`, tooltipX + 10, tooltipY + 55);
        // Add color mode specific information
        this.ctx.fillText(colorInfo, tooltipX + 10, tooltipY + 75);
        // Add word count and reading time if available
        if (wordCount || readingTime) {
            const statsText = [wordCount, readingTime].filter(Boolean).join(' • ');
            this.ctx.fillStyle = '#555555';
            this.ctx.fillText(statsText, tooltipX + 10, tooltipY + 95);
        }
        // Add content preview if available
        if (contentPreview) {
            this.ctx.font = 'italic 11px sans-serif';
            this.ctx.fillStyle = '#777777';
            // Trim preview if too long
            const displayPreview = contentPreview.length > 60
                ? contentPreview.substring(0, 60) + '...'
                : contentPreview;
            this.ctx.fillText(`"${displayPreview}"`, tooltipX + 10, tooltipY + 115);
        }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIi4uLy4uLy4uLy4uL3NyYy9vYnNpZGlhbi1wbHVnaW4vdmlzdWFsaXphdGlvbi50cyIsIi4uLy4uLy4uLy4uL3NyYy9vYnNpZGlhbi1wbHVnaW4vbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuLyogZ2xvYmFsIFJlZmxlY3QsIFByb21pc2UsIFN1cHByZXNzZWRFcnJvciwgU3ltYm9sLCBJdGVyYXRvciAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19lc0RlY29yYXRlKGN0b3IsIGRlc2NyaXB0b3JJbiwgZGVjb3JhdG9ycywgY29udGV4dEluLCBpbml0aWFsaXplcnMsIGV4dHJhSW5pdGlhbGl6ZXJzKSB7XHJcbiAgICBmdW5jdGlvbiBhY2NlcHQoZikgeyBpZiAoZiAhPT0gdm9pZCAwICYmIHR5cGVvZiBmICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGdW5jdGlvbiBleHBlY3RlZFwiKTsgcmV0dXJuIGY7IH1cclxuICAgIHZhciBraW5kID0gY29udGV4dEluLmtpbmQsIGtleSA9IGtpbmQgPT09IFwiZ2V0dGVyXCIgPyBcImdldFwiIDoga2luZCA9PT0gXCJzZXR0ZXJcIiA/IFwic2V0XCIgOiBcInZhbHVlXCI7XHJcbiAgICB2YXIgdGFyZ2V0ID0gIWRlc2NyaXB0b3JJbiAmJiBjdG9yID8gY29udGV4dEluW1wic3RhdGljXCJdID8gY3RvciA6IGN0b3IucHJvdG90eXBlIDogbnVsbDtcclxuICAgIHZhciBkZXNjcmlwdG9yID0gZGVzY3JpcHRvckluIHx8ICh0YXJnZXQgPyBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgY29udGV4dEluLm5hbWUpIDoge30pO1xyXG4gICAgdmFyIF8sIGRvbmUgPSBmYWxzZTtcclxuICAgIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgICAgdmFyIGNvbnRleHQgPSB7fTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbikgY29udGV4dFtwXSA9IHAgPT09IFwiYWNjZXNzXCIgPyB7fSA6IGNvbnRleHRJbltwXTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbi5hY2Nlc3MpIGNvbnRleHQuYWNjZXNzW3BdID0gY29udGV4dEluLmFjY2Vzc1twXTtcclxuICAgICAgICBjb250ZXh0LmFkZEluaXRpYWxpemVyID0gZnVuY3Rpb24gKGYpIHsgaWYgKGRvbmUpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgYWRkIGluaXRpYWxpemVycyBhZnRlciBkZWNvcmF0aW9uIGhhcyBjb21wbGV0ZWRcIik7IGV4dHJhSW5pdGlhbGl6ZXJzLnB1c2goYWNjZXB0KGYgfHwgbnVsbCkpOyB9O1xyXG4gICAgICAgIHZhciByZXN1bHQgPSAoMCwgZGVjb3JhdG9yc1tpXSkoa2luZCA9PT0gXCJhY2Nlc3NvclwiID8geyBnZXQ6IGRlc2NyaXB0b3IuZ2V0LCBzZXQ6IGRlc2NyaXB0b3Iuc2V0IH0gOiBkZXNjcmlwdG9yW2tleV0sIGNvbnRleHQpO1xyXG4gICAgICAgIGlmIChraW5kID09PSBcImFjY2Vzc29yXCIpIHtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gdm9pZCAwKSBjb250aW51ZTtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCB8fCB0eXBlb2YgcmVzdWx0ICE9PSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkXCIpO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuZ2V0KSkgZGVzY3JpcHRvci5nZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuc2V0KSkgZGVzY3JpcHRvci5zZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuaW5pdCkpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChfID0gYWNjZXB0KHJlc3VsdCkpIHtcclxuICAgICAgICAgICAgaWYgKGtpbmQgPT09IFwiZmllbGRcIikgaW5pdGlhbGl6ZXJzLnVuc2hpZnQoXyk7XHJcbiAgICAgICAgICAgIGVsc2UgZGVzY3JpcHRvcltrZXldID0gXztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAodGFyZ2V0KSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBjb250ZXh0SW4ubmFtZSwgZGVzY3JpcHRvcik7XHJcbiAgICBkb25lID0gdHJ1ZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3J1bkluaXRpYWxpemVycyh0aGlzQXJnLCBpbml0aWFsaXplcnMsIHZhbHVlKSB7XHJcbiAgICB2YXIgdXNlVmFsdWUgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5pdGlhbGl6ZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFsdWUgPSB1c2VWYWx1ZSA/IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcsIHZhbHVlKSA6IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHVzZVZhbHVlID8gdmFsdWUgOiB2b2lkIDA7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wcm9wS2V5KHgpIHtcclxuICAgIHJldHVybiB0eXBlb2YgeCA9PT0gXCJzeW1ib2xcIiA/IHggOiBcIlwiLmNvbmNhdCh4KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NldEZ1bmN0aW9uTmFtZShmLCBuYW1lLCBwcmVmaXgpIHtcclxuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gXCJzeW1ib2xcIikgbmFtZSA9IG5hbWUuZGVzY3JpcHRpb24gPyBcIltcIi5jb25jYXQobmFtZS5kZXNjcmlwdGlvbiwgXCJdXCIpIDogXCJcIjtcclxuICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkoZiwgXCJuYW1lXCIsIHsgY29uZmlndXJhYmxlOiB0cnVlLCB2YWx1ZTogcHJlZml4ID8gXCJcIi5jb25jYXQocHJlZml4LCBcIiBcIiwgbmFtZSkgOiBuYW1lIH0pO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpIHtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5tZXRhZGF0YSA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gUmVmbGVjdC5tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0ZXIodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19nZW5lcmF0b3IodGhpc0FyZywgYm9keSkge1xyXG4gICAgdmFyIF8gPSB7IGxhYmVsOiAwLCBzZW50OiBmdW5jdGlvbigpIHsgaWYgKHRbMF0gJiAxKSB0aHJvdyB0WzFdOyByZXR1cm4gdFsxXTsgfSwgdHJ5czogW10sIG9wczogW10gfSwgZiwgeSwgdCwgZyA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBJdGVyYXRvciA9PT0gXCJmdW5jdGlvblwiID8gSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSk7XHJcbiAgICByZXR1cm4gZy5uZXh0ID0gdmVyYigwKSwgZ1tcInRocm93XCJdID0gdmVyYigxKSwgZ1tcInJldHVyblwiXSA9IHZlcmIoMiksIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoZyAmJiAoZyA9IDAsIG9wWzBdICYmIChfID0gMCkpLCBfKSB0cnkge1xyXG4gICAgICAgICAgICBpZiAoZiA9IDEsIHkgJiYgKHQgPSBvcFswXSAmIDIgPyB5W1wicmV0dXJuXCJdIDogb3BbMF0gPyB5W1widGhyb3dcIl0gfHwgKCh0ID0geVtcInJldHVyblwiXSkgJiYgdC5jYWxsKHkpLCAwKSA6IHkubmV4dCkgJiYgISh0ID0gdC5jYWxsKHksIG9wWzFdKSkuZG9uZSkgcmV0dXJuIHQ7XHJcbiAgICAgICAgICAgIGlmICh5ID0gMCwgdCkgb3AgPSBbb3BbMF0gJiAyLCB0LnZhbHVlXTtcclxuICAgICAgICAgICAgc3dpdGNoIChvcFswXSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAwOiBjYXNlIDE6IHQgPSBvcDsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDQ6IF8ubGFiZWwrKzsgcmV0dXJuIHsgdmFsdWU6IG9wWzFdLCBkb25lOiBmYWxzZSB9O1xyXG4gICAgICAgICAgICAgICAgY2FzZSA1OiBfLmxhYmVsKys7IHkgPSBvcFsxXTsgb3AgPSBbMF07IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA3OiBvcCA9IF8ub3BzLnBvcCgpOyBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBpZiAoISh0ID0gXy50cnlzLCB0ID0gdC5sZW5ndGggPiAwICYmIHRbdC5sZW5ndGggLSAxXSkgJiYgKG9wWzBdID09PSA2IHx8IG9wWzBdID09PSAyKSkgeyBfID0gMDsgY29udGludWU7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDMgJiYgKCF0IHx8IChvcFsxXSA+IHRbMF0gJiYgb3BbMV0gPCB0WzNdKSkpIHsgXy5sYWJlbCA9IG9wWzFdOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gNiAmJiBfLmxhYmVsIDwgdFsxXSkgeyBfLmxhYmVsID0gdFsxXTsgdCA9IG9wOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ICYmIF8ubGFiZWwgPCB0WzJdKSB7IF8ubGFiZWwgPSB0WzJdOyBfLm9wcy5wdXNoKG9wKTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodFsyXSkgXy5vcHMucG9wKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvcCA9IGJvZHkuY2FsbCh0aGlzQXJnLCBfKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7IG9wID0gWzYsIGVdOyB5ID0gMDsgfSBmaW5hbGx5IHsgZiA9IHQgPSAwOyB9XHJcbiAgICAgICAgaWYgKG9wWzBdICYgNSkgdGhyb3cgb3BbMV07IHJldHVybiB7IHZhbHVlOiBvcFswXSA/IG9wWzFdIDogdm9pZCAwLCBkb25lOiB0cnVlIH07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19jcmVhdGVCaW5kaW5nID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihtLCBrKTtcclxuICAgIGlmICghZGVzYyB8fCAoXCJnZXRcIiBpbiBkZXNjID8gIW0uX19lc01vZHVsZSA6IGRlc2Mud3JpdGFibGUgfHwgZGVzYy5jb25maWd1cmFibGUpKSB7XHJcbiAgICAgICAgZGVzYyA9IHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfTtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBrMiwgZGVzYyk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tLCBwYWNrKSB7XHJcbiAgICBpZiAocGFjayB8fCBhcmd1bWVudHMubGVuZ3RoID09PSAyKSBmb3IgKHZhciBpID0gMCwgbCA9IGZyb20ubGVuZ3RoLCBhcjsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmIChhciB8fCAhKGkgaW4gZnJvbSkpIHtcclxuICAgICAgICAgICAgaWYgKCFhcikgYXIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tLCAwLCBpKTtcclxuICAgICAgICAgICAgYXJbaV0gPSBmcm9tW2ldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0by5jb25jYXQoYXIgfHwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSkpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdCh2KSB7XHJcbiAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIF9fYXdhaXQgPyAodGhpcy52ID0gdiwgdGhpcykgOiBuZXcgX19hd2FpdCh2KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNHZW5lcmF0b3IodGhpc0FyZywgX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIGcgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSksIGksIHEgPSBbXTtcclxuICAgIHJldHVybiBpID0gT2JqZWN0LmNyZWF0ZSgodHlwZW9mIEFzeW5jSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEFzeW5jSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSksIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiwgYXdhaXRSZXR1cm4pLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiBhd2FpdFJldHVybihmKSB7IHJldHVybiBmdW5jdGlvbiAodikgeyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZiwgcmVqZWN0KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlmIChnW25dKSB7IGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IGlmIChmKSBpW25dID0gZihpW25dKTsgfSB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogZmFsc2UgfSA6IGYgPyBmKHYpIDogdjsgfSA6IGY7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNWYWx1ZXMobykge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBtID0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sIGk7XHJcbiAgICByZXR1cm4gbSA/IG0uY2FsbChvKSA6IChvID0gdHlwZW9mIF9fdmFsdWVzID09PSBcImZ1bmN0aW9uXCIgPyBfX3ZhbHVlcyhvKSA6IG9bU3ltYm9sLml0ZXJhdG9yXSgpLCBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaSk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaVtuXSA9IG9bbl0gJiYgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgdiA9IG9bbl0odiksIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHYuZG9uZSwgdi52YWx1ZSk7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCBkLCB2KSB7IFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGZ1bmN0aW9uKHYpIHsgcmVzb2x2ZSh7IHZhbHVlOiB2LCBkb25lOiBkIH0pOyB9LCByZWplY3QpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdykge1xyXG4gICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkgeyBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29va2VkLCBcInJhd1wiLCB7IHZhbHVlOiByYXcgfSk7IH0gZWxzZSB7IGNvb2tlZC5yYXcgPSByYXc7IH1cclxuICAgIHJldHVybiBjb29rZWQ7XHJcbn07XHJcblxyXG52YXIgX19zZXRNb2R1bGVEZWZhdWx0ID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgXCJkZWZhdWx0XCIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgdmFsdWU6IHYgfSk7XHJcbn0pIDogZnVuY3Rpb24obywgdikge1xyXG4gICAgb1tcImRlZmF1bHRcIl0gPSB2O1xyXG59O1xyXG5cclxudmFyIG93bktleXMgPSBmdW5jdGlvbihvKSB7XHJcbiAgICBvd25LZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgfHwgZnVuY3Rpb24gKG8pIHtcclxuICAgICAgICB2YXIgYXIgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBrIGluIG8pIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgaykpIGFyW2FyLmxlbmd0aF0gPSBrO1xyXG4gICAgICAgIHJldHVybiBhcjtcclxuICAgIH07XHJcbiAgICByZXR1cm4gb3duS2V5cyhvKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrID0gb3duS2V5cyhtb2QpLCBpID0gMDsgaSA8IGsubGVuZ3RoOyBpKyspIGlmIChrW2ldICE9PSBcImRlZmF1bHRcIikgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrW2ldKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRJbihzdGF0ZSwgcmVjZWl2ZXIpIHtcclxuICAgIGlmIChyZWNlaXZlciA9PT0gbnVsbCB8fCAodHlwZW9mIHJlY2VpdmVyICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiByZWNlaXZlciAhPT0gXCJmdW5jdGlvblwiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgJ2luJyBvcGVyYXRvciBvbiBub24tb2JqZWN0XCIpO1xyXG4gICAgcmV0dXJuIHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgPT09IHN0YXRlIDogc3RhdGUuaGFzKHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlKGVudiwgdmFsdWUsIGFzeW5jKSB7XHJcbiAgICBpZiAodmFsdWUgIT09IG51bGwgJiYgdmFsdWUgIT09IHZvaWQgMCkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgZXhwZWN0ZWQuXCIpO1xyXG4gICAgICAgIHZhciBkaXNwb3NlLCBpbm5lcjtcclxuICAgICAgICBpZiAoYXN5bmMpIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuYXN5bmNEaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jRGlzcG9zZSBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICAgICAgICAgIGRpc3Bvc2UgPSB2YWx1ZVtTeW1ib2wuYXN5bmNEaXNwb3NlXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGRpc3Bvc2UgPT09IHZvaWQgMCkge1xyXG4gICAgICAgICAgICBpZiAoIVN5bWJvbC5kaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmRpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmRpc3Bvc2VdO1xyXG4gICAgICAgICAgICBpZiAoYXN5bmMpIGlubmVyID0gZGlzcG9zZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkaXNwb3NlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3Qgbm90IGRpc3Bvc2FibGUuXCIpO1xyXG4gICAgICAgIGlmIChpbm5lcikgZGlzcG9zZSA9IGZ1bmN0aW9uKCkgeyB0cnkgeyBpbm5lci5jYWxsKHRoaXMpOyB9IGNhdGNoIChlKSB7IHJldHVybiBQcm9taXNlLnJlamVjdChlKTsgfSB9O1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgdmFsdWU6IHZhbHVlLCBkaXNwb3NlOiBkaXNwb3NlLCBhc3luYzogYXN5bmMgfSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChhc3luYykge1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgYXN5bmM6IHRydWUgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcblxyXG59XHJcblxyXG52YXIgX1N1cHByZXNzZWRFcnJvciA9IHR5cGVvZiBTdXBwcmVzc2VkRXJyb3IgPT09IFwiZnVuY3Rpb25cIiA/IFN1cHByZXNzZWRFcnJvciA6IGZ1bmN0aW9uIChlcnJvciwgc3VwcHJlc3NlZCwgbWVzc2FnZSkge1xyXG4gICAgdmFyIGUgPSBuZXcgRXJyb3IobWVzc2FnZSk7XHJcbiAgICByZXR1cm4gZS5uYW1lID0gXCJTdXBwcmVzc2VkRXJyb3JcIiwgZS5lcnJvciA9IGVycm9yLCBlLnN1cHByZXNzZWQgPSBzdXBwcmVzc2VkLCBlO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGlzcG9zZVJlc291cmNlcyhlbnYpIHtcclxuICAgIGZ1bmN0aW9uIGZhaWwoZSkge1xyXG4gICAgICAgIGVudi5lcnJvciA9IGVudi5oYXNFcnJvciA/IG5ldyBfU3VwcHJlc3NlZEVycm9yKGUsIGVudi5lcnJvciwgXCJBbiBlcnJvciB3YXMgc3VwcHJlc3NlZCBkdXJpbmcgZGlzcG9zYWwuXCIpIDogZTtcclxuICAgICAgICBlbnYuaGFzRXJyb3IgPSB0cnVlO1xyXG4gICAgfVxyXG4gICAgdmFyIHIsIHMgPSAwO1xyXG4gICAgZnVuY3Rpb24gbmV4dCgpIHtcclxuICAgICAgICB3aGlsZSAociA9IGVudi5zdGFjay5wb3AoKSkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFyLmFzeW5jICYmIHMgPT09IDEpIHJldHVybiBzID0gMCwgZW52LnN0YWNrLnB1c2gociksIFByb21pc2UucmVzb2x2ZSgpLnRoZW4obmV4dCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoci5kaXNwb3NlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHIuZGlzcG9zZS5jYWxsKHIudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChyLmFzeW5jKSByZXR1cm4gcyB8PSAyLCBQcm9taXNlLnJlc29sdmUocmVzdWx0KS50aGVuKG5leHQsIGZ1bmN0aW9uKGUpIHsgZmFpbChlKTsgcmV0dXJuIG5leHQoKTsgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHMgfD0gMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgZmFpbChlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocyA9PT0gMSkgcmV0dXJuIGVudi5oYXNFcnJvciA/IFByb21pc2UucmVqZWN0KGVudi5lcnJvcikgOiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgICBpZiAoZW52Lmhhc0Vycm9yKSB0aHJvdyBlbnYuZXJyb3I7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV4dCgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24ocGF0aCwgcHJlc2VydmVKc3gpIHtcclxuICAgIGlmICh0eXBlb2YgcGF0aCA9PT0gXCJzdHJpbmdcIiAmJiAvXlxcLlxcLj9cXC8vLnRlc3QocGF0aCkpIHtcclxuICAgICAgICByZXR1cm4gcGF0aC5yZXBsYWNlKC9cXC4odHN4KSR8KCg/OlxcLmQpPykoKD86XFwuW14uL10rPyk/KVxcLihbY21dPyl0cyQvaSwgZnVuY3Rpb24gKG0sIHRzeCwgZCwgZXh0LCBjbSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHN4ID8gcHJlc2VydmVKc3ggPyBcIi5qc3hcIiA6IFwiLmpzXCIgOiBkICYmICghZXh0IHx8ICFjbSkgPyBtIDogKGQgKyBleHQgKyBcIi5cIiArIGNtLnRvTG93ZXJDYXNlKCkgKyBcImpzXCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBhdGg7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIF9fZXh0ZW5kczogX19leHRlbmRzLFxyXG4gICAgX19hc3NpZ246IF9fYXNzaWduLFxyXG4gICAgX19yZXN0OiBfX3Jlc3QsXHJcbiAgICBfX2RlY29yYXRlOiBfX2RlY29yYXRlLFxyXG4gICAgX19wYXJhbTogX19wYXJhbSxcclxuICAgIF9fZXNEZWNvcmF0ZTogX19lc0RlY29yYXRlLFxyXG4gICAgX19ydW5Jbml0aWFsaXplcnM6IF9fcnVuSW5pdGlhbGl6ZXJzLFxyXG4gICAgX19wcm9wS2V5OiBfX3Byb3BLZXksXHJcbiAgICBfX3NldEZ1bmN0aW9uTmFtZTogX19zZXRGdW5jdGlvbk5hbWUsXHJcbiAgICBfX21ldGFkYXRhOiBfX21ldGFkYXRhLFxyXG4gICAgX19hd2FpdGVyOiBfX2F3YWl0ZXIsXHJcbiAgICBfX2dlbmVyYXRvcjogX19nZW5lcmF0b3IsXHJcbiAgICBfX2NyZWF0ZUJpbmRpbmc6IF9fY3JlYXRlQmluZGluZyxcclxuICAgIF9fZXhwb3J0U3RhcjogX19leHBvcnRTdGFyLFxyXG4gICAgX192YWx1ZXM6IF9fdmFsdWVzLFxyXG4gICAgX19yZWFkOiBfX3JlYWQsXHJcbiAgICBfX3NwcmVhZDogX19zcHJlYWQsXHJcbiAgICBfX3NwcmVhZEFycmF5czogX19zcHJlYWRBcnJheXMsXHJcbiAgICBfX3NwcmVhZEFycmF5OiBfX3NwcmVhZEFycmF5LFxyXG4gICAgX19hd2FpdDogX19hd2FpdCxcclxuICAgIF9fYXN5bmNHZW5lcmF0b3I6IF9fYXN5bmNHZW5lcmF0b3IsXHJcbiAgICBfX2FzeW5jRGVsZWdhdG9yOiBfX2FzeW5jRGVsZWdhdG9yLFxyXG4gICAgX19hc3luY1ZhbHVlczogX19hc3luY1ZhbHVlcyxcclxuICAgIF9fbWFrZVRlbXBsYXRlT2JqZWN0OiBfX21ha2VUZW1wbGF0ZU9iamVjdCxcclxuICAgIF9faW1wb3J0U3RhcjogX19pbXBvcnRTdGFyLFxyXG4gICAgX19pbXBvcnREZWZhdWx0OiBfX2ltcG9ydERlZmF1bHQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0OiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldDogX19jbGFzc1ByaXZhdGVGaWVsZFNldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRJbjogX19jbGFzc1ByaXZhdGVGaWVsZEluLFxyXG4gICAgX19hZGREaXNwb3NhYmxlUmVzb3VyY2U6IF9fYWRkRGlzcG9zYWJsZVJlc291cmNlLFxyXG4gICAgX19kaXNwb3NlUmVzb3VyY2VzOiBfX2Rpc3Bvc2VSZXNvdXJjZXMsXHJcbiAgICBfX3Jld3JpdGVSZWxhdGl2ZUltcG9ydEV4dGVuc2lvbjogX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24sXHJcbn07XHJcbiIsImltcG9ydCB7IFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vLyBJbnRlcmZhY2UgZm9yIHQtU05FIHJlc3VsdCBwb2ludHNcbmludGVyZmFjZSBUU05FUG9pbnQge1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgdGl0bGU6IHN0cmluZztcbiAgcGF0aDogc3RyaW5nO1xuICB0b3BfdGVybXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyOiBudW1iZXI7IC8vIENsdXN0ZXIgSUQgKC0xIG1lYW5zIG5vaXNlL25vdCBjbHVzdGVyZWQpXG4gIFxuICAvLyBBZGRpdGlvbmFsIG1ldGFkYXRhXG4gIG10aW1lPzogbnVtYmVyOyAgICAgIC8vIExhc3QgbW9kaWZpZWQgdGltZVxuICBjdGltZT86IG51bWJlcjsgICAgICAvLyBDcmVhdGlvbiB0aW1lXG4gIHdvcmRDb3VudD86IG51bWJlcjsgIC8vIFdvcmQgY291bnRcbiAgcmVhZGluZ1RpbWU/OiBudW1iZXI7IC8vIEVzdGltYXRlZCByZWFkaW5nIHRpbWUgaW4gbWludXRlcyAgXG4gIHRhZ3M/OiBzdHJpbmdbXTsgICAgIC8vIE5vdGUgdGFnc1xuICBjb250ZW50UHJldmlldz86IHN0cmluZzsgLy8gU2hvcnQgcHJldmlldyBvZiBjb250ZW50XG4gIGRpc3RhbmNlVG9DZW50ZXI/OiBudW1iZXI7IC8vIERpc3RhbmNlIHRvIGNsdXN0ZXIgY2VudGVyXG59XG5cbi8vIEludGVyZmFjZSBmb3IgY2x1c3RlciB0ZXJtIGluZm9ybWF0aW9uXG5pbnRlcmZhY2UgQ2x1c3RlclRlcm0ge1xuICB0ZXJtOiBzdHJpbmc7XG4gIHNjb3JlOiBudW1iZXI7XG59XG5cbi8vIEludGVyZmFjZSBmb3IgY2x1c3RlciBpbmZvcm1hdGlvblxuaW50ZXJmYWNlIENsdXN0ZXJJbmZvIHtcbiAgW2tleTogc3RyaW5nXTogQ2x1c3RlclRlcm1bXTtcbn1cblxuLy8gSW50ZXJmYWNlIGZvciB0LVNORSByZXN1bHRzXG5pbnRlcmZhY2UgVFNORVJlc3VsdCB7XG4gIHBvaW50czogVFNORVBvaW50W107XG4gIGZlYXR1cmVfbmFtZXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyczogbnVtYmVyO1xuICBjbHVzdGVyX3Rlcm1zOiBDbHVzdGVySW5mbztcbn1cblxuLy8gQ29sb3IgbW9kZSBvcHRpb25zIGZvciB2aXN1YWxpemF0aW9uXG5leHBvcnQgZW51bSBDb2xvck1vZGUge1xuICBDbHVzdGVyID0gJ2NsdXN0ZXInLCAgLy8gQ29sb3IgYnkgYXV0b21hdGljYWxseSBkZXRlY3RlZCBjbHVzdGVyc1xuICBUYWdzID0gJ3RhZ3MnLCAgICAgICAgLy8gQ29sb3IgYnkgbm90ZSB0YWdzXG4gIEZvbGRlciA9ICdmb2xkZXInLCAgICAvLyBDb2xvciBieSBmb2xkZXIvcGF0aFxuICBDcmVhdGVkID0gJ2NyZWF0ZWQnLCAgLy8gQ29sb3IgYnkgY3JlYXRpb24gZGF0ZVxuICBNb2RpZmllZCA9ICdtb2RpZmllZCcgLy8gQ29sb3IgYnkgbW9kaWZpY2F0aW9uIGRhdGVcbn1cblxuZXhwb3J0IGNsYXNzIFRTTkVWaXN1YWxpemVyIHtcbiAgcHJpdmF0ZSBjb250YWluZXI6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQ7XG4gIHByaXZhdGUgY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG4gIHByaXZhdGUgcmVzdWx0OiBUU05FUmVzdWx0IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgd2lkdGggPSAxNjAwOyAgLy8gUmVkdWNlZCB3aWR0aCB0byBhdm9pZCBob3Jpem9udGFsIHNjcm9sbGluZ1xuICBwcml2YXRlIGhlaWdodCA9IDcwMDsgIC8vIFNsaWdodGx5IHJlZHVjZWQgaGVpZ2h0IHRvIG1pbmltaXplIHZlcnRpY2FsIHNjcm9sbGluZ1xuICBwcml2YXRlIHBvaW50UmFkaXVzID0gMTA7XG4gIHByaXZhdGUgbW91c2VYID0gMDtcbiAgcHJpdmF0ZSBtb3VzZVkgPSAwO1xuICBwcml2YXRlIHNjYWxlID0gMTtcbiAgcHJpdmF0ZSBvZmZzZXRYID0gMDtcbiAgcHJpdmF0ZSBvZmZzZXRZID0gMDtcbiAgcHJpdmF0ZSBpc0RyYWdnaW5nID0gZmFsc2U7XG4gIHByaXZhdGUgbGFzdFggPSAwO1xuICBwcml2YXRlIGxhc3RZID0gMDtcbiAgcHJpdmF0ZSBob3ZlcmVkUG9pbnQ6IFRTTkVQb2ludCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIG9wZW5DYWxsYmFjazogKHBhdGg6IHN0cmluZykgPT4gdm9pZDtcbiAgcHJpdmF0ZSBjb2xvck1vZGU6IENvbG9yTW9kZSA9IENvbG9yTW9kZS5DbHVzdGVyOyAvLyBEZWZhdWx0IGNvbG9yIG1vZGVcbiAgcHJpdmF0ZSBjb2xvck1hcDogTWFwPHN0cmluZywgc3RyaW5nPiA9IG5ldyBNYXAoKTsgLy8gRm9yIG1hcHBpbmcgdmFsdWVzIHRvIGNvbG9yc1xuXG4gIGNvbnN0cnVjdG9yKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIG9wZW5DYWxsYmFjazogKHBhdGg6IHN0cmluZykgPT4gdm9pZCkge1xuICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgIHRoaXMub3BlbkNhbGxiYWNrID0gb3BlbkNhbGxiYWNrO1xuICAgIFxuICAgIC8vIENyZWF0ZSBjYW52YXMgZWxlbWVudFxuICAgIHRoaXMuY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgdGhpcy5jYW52YXMud2lkdGggPSB0aGlzLndpZHRoO1xuICAgIHRoaXMuY2FudmFzLmhlaWdodCA9IHRoaXMuaGVpZ2h0O1xuICAgIHRoaXMuY2FudmFzLmNsYXNzTGlzdC5hZGQoJ3RzbmUtY2FudmFzJyk7XG4gICAgdGhpcy5jYW52YXMuc3R5bGUuYm9yZGVyID0gJzFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlciknO1xuICAgIFxuICAgIC8vIEFsbG93IHRoZSBjYW52YXMgdG8gZXh0ZW5kIGJleW9uZCB0aGUgdmlld3BvcnQgd2l0aCBzY3JvbGxpbmdcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS5taW5XaWR0aCA9IHRoaXMud2lkdGggKyAncHgnO1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLm1pbkhlaWdodCA9IHRoaXMuaGVpZ2h0ICsgJ3B4JztcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS5tYXJnaW4gPSAnMCBhdXRvJzsgLy8gQ2VudGVyIHRoZSBjYW52YXMgaG9yaXpvbnRhbGx5XG4gICAgXG4gICAgLy8gQ29udGFpbmVyIHRha2VzIGZ1bGwgd2lkdGggYnV0IGFsbG93cyBzY3JvbGxpbmcgZm9yIG92ZXJmbG93XG4gICAgdGhpcy5jb250YWluZXIuc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gICAgdGhpcy5jb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gJzEwMCUnO1xuICAgIHRoaXMuY29udGFpbmVyLnN0eWxlLm92ZXJmbG93ID0gJ2F1dG8nO1xuICAgIHRoaXMuY29udGFpbmVyLnN0eWxlLnRleHRBbGlnbiA9ICdjZW50ZXInOyAvLyBDZW50ZXIgdGhlIGNhbnZhcyB3aXRoaW4gdGhlIGNvbnRhaW5lclxuICAgIFxuICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgIGlmICghY29udGV4dCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgY3JlYXRlIGNhbnZhcyBjb250ZXh0Jyk7XG4gICAgfVxuICAgIHRoaXMuY3R4ID0gY29udGV4dDtcbiAgICBcbiAgICAvLyBDbGVhciB0aGUgY29udGFpbmVyIGZpcnN0XG4gICAgd2hpbGUgKHRoaXMuY29udGFpbmVyLmZpcnN0Q2hpbGQpIHtcbiAgICAgIHRoaXMuY29udGFpbmVyLnJlbW92ZUNoaWxkKHRoaXMuY29udGFpbmVyLmZpcnN0Q2hpbGQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBDcmVhdGUgY29sb3IgbW9kZSBjb250cm9sIHBhbmVsXG4gICAgdGhpcy5jcmVhdGVDb250cm9sUGFuZWwoKTtcbiAgICBcbiAgICAvLyBBZGQgY2FudmFzIHRvIGNvbnRhaW5lclxuICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuY2FudmFzKTtcbiAgICBcbiAgICAvLyBBZGQgZXZlbnQgbGlzdGVuZXJzXG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVycygpO1xuICB9XG4gIFxuICAvLyBDcmVhdGVzIHRoZSBjb250cm9sIHBhbmVsIGZvciBjb2xvciBtb2Rlc1xuICBwcml2YXRlIGNyZWF0ZUNvbnRyb2xQYW5lbCgpIHtcbiAgICBjb25zdCBjb250cm9sUGFuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb250cm9sUGFuZWwuY2xhc3NMaXN0LmFkZCgndHNuZS1jb250cm9sLXBhbmVsJyk7XG4gICAgY29udHJvbFBhbmVsLnN0eWxlLm1hcmdpbkJvdHRvbSA9ICcxMHB4JztcbiAgICBjb250cm9sUGFuZWwuc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcbiAgICBjb250cm9sUGFuZWwuc3R5bGUuanVzdGlmeUNvbnRlbnQgPSAnY2VudGVyJztcbiAgICBjb250cm9sUGFuZWwuc3R5bGUuYWxpZ25JdGVtcyA9ICdjZW50ZXInO1xuICAgIGNvbnRyb2xQYW5lbC5zdHlsZS5mbGV4V3JhcCA9ICd3cmFwJztcbiAgICBjb250cm9sUGFuZWwuc3R5bGUuZ2FwID0gJzEwcHgnO1xuICAgIFxuICAgIC8vIEFkZCBsYWJlbFxuICAgIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgIGxhYmVsLnRleHRDb250ZW50ID0gJ0NvbG9yIGJ5Oic7XG4gICAgbGFiZWwuc3R5bGUubWFyZ2luUmlnaHQgPSAnMTBweCc7XG4gICAgY29udHJvbFBhbmVsLmFwcGVuZENoaWxkKGxhYmVsKTtcbiAgICBcbiAgICAvLyBBZGQgY29sb3IgbW9kZSBvcHRpb25zXG4gICAgY29uc3QgY29sb3JNb2RlcyA9IFtcbiAgICAgIHsgdmFsdWU6IENvbG9yTW9kZS5DbHVzdGVyLCBsYWJlbDogJ0NsdXN0ZXInIH0sXG4gICAgICB7IHZhbHVlOiBDb2xvck1vZGUuVGFncywgbGFiZWw6ICdUYWdzJyB9LFxuICAgICAgeyB2YWx1ZTogQ29sb3JNb2RlLkZvbGRlciwgbGFiZWw6ICdGb2xkZXInIH0sXG4gICAgICB7IHZhbHVlOiBDb2xvck1vZGUuQ3JlYXRlZCwgbGFiZWw6ICdDcmVhdGlvbiBEYXRlJyB9LFxuICAgICAgeyB2YWx1ZTogQ29sb3JNb2RlLk1vZGlmaWVkLCBsYWJlbDogJ0xhc3QgTW9kaWZpZWQnIH1cbiAgICBdO1xuICAgIFxuICAgIC8vIENyZWF0ZSBidXR0b24gZ3JvdXBcbiAgICBjb25zdCBidXR0b25Hcm91cCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGJ1dHRvbkdyb3VwLmNsYXNzTGlzdC5hZGQoJ3RzbmUtYnV0dG9uLWdyb3VwJyk7XG4gICAgYnV0dG9uR3JvdXAuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtZmxleCc7XG4gICAgYnV0dG9uR3JvdXAuc3R5bGUuYm9yZGVyUmFkaXVzID0gJzRweCc7XG4gICAgYnV0dG9uR3JvdXAuc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJztcbiAgICBidXR0b25Hcm91cC5zdHlsZS5ib3JkZXIgPSAnMXB4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyKSc7XG4gICAgXG4gICAgY29sb3JNb2Rlcy5mb3JFYWNoKG1vZGUgPT4ge1xuICAgICAgY29uc3QgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICBidXR0b24udGV4dENvbnRlbnQgPSBtb2RlLmxhYmVsO1xuICAgICAgYnV0dG9uLnNldEF0dHJpYnV0ZSgnZGF0YS1jb2xvci1tb2RlJywgbW9kZS52YWx1ZSk7XG4gICAgICBidXR0b24uc3R5bGUuYm9yZGVyID0gJ25vbmUnO1xuICAgICAgYnV0dG9uLnN0eWxlLnBhZGRpbmcgPSAnNXB4IDEwcHgnO1xuICAgICAgYnV0dG9uLnN0eWxlLmJhY2tncm91bmQgPSBtb2RlLnZhbHVlID09PSB0aGlzLmNvbG9yTW9kZSBcbiAgICAgICAgPyAndmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KScgXG4gICAgICAgIDogJ3ZhcigtLWJhY2tncm91bmQtc2Vjb25kYXJ5KSc7XG4gICAgICBidXR0b24uc3R5bGUuY29sb3IgPSBtb2RlLnZhbHVlID09PSB0aGlzLmNvbG9yTW9kZSBcbiAgICAgICAgPyAndmFyKC0tdGV4dC1vbi1hY2NlbnQpJyBcbiAgICAgICAgOiAndmFyKC0tdGV4dC1ub3JtYWwpJztcbiAgICAgIGJ1dHRvbi5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG4gICAgICBidXR0b24uc3R5bGUuZm9udFNpemUgPSAnMTJweCc7XG4gICAgICBcbiAgICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgLy8gVXBkYXRlIGFjdGl2ZSBidXR0b24gc3R5bGluZ1xuICAgICAgICBidXR0b25Hcm91cC5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b24nKS5mb3JFYWNoKGJ0biA9PiB7XG4gICAgICAgICAgYnRuLnN0eWxlLmJhY2tncm91bmQgPSAndmFyKC0tYmFja2dyb3VuZC1zZWNvbmRhcnkpJztcbiAgICAgICAgICBidG4uc3R5bGUuY29sb3IgPSAndmFyKC0tdGV4dC1ub3JtYWwpJztcbiAgICAgICAgfSk7XG4gICAgICAgIGJ1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kID0gJ3ZhcigtLWludGVyYWN0aXZlLWFjY2VudCknO1xuICAgICAgICBidXR0b24uc3R5bGUuY29sb3IgPSAndmFyKC0tdGV4dC1vbi1hY2NlbnQpJztcbiAgICAgICAgXG4gICAgICAgIC8vIFNldCB0aGUgY29sb3IgbW9kZVxuICAgICAgICB0aGlzLnNldENvbG9yTW9kZShtb2RlLnZhbHVlIGFzIENvbG9yTW9kZSk7XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgYnV0dG9uR3JvdXAuYXBwZW5kQ2hpbGQoYnV0dG9uKTtcbiAgICB9KTtcbiAgICBcbiAgICBjb250cm9sUGFuZWwuYXBwZW5kQ2hpbGQoYnV0dG9uR3JvdXApO1xuICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKGNvbnRyb2xQYW5lbCk7XG4gIH1cbiAgXG4gIC8vIFNldCB0aGUgY29sb3IgbW9kZSBhbmQgcmVkcmF3XG4gIHB1YmxpYyBzZXRDb2xvck1vZGUobW9kZTogQ29sb3JNb2RlKSB7XG4gICAgdGhpcy5jb2xvck1vZGUgPSBtb2RlO1xuICAgIHRoaXMuY29sb3JNYXAuY2xlYXIoKTsgLy8gUmVzZXQgY29sb3IgbWFwcGluZ1xuICAgIGlmICh0aGlzLnJlc3VsdCkge1xuICAgICAgdGhpcy5nZW5lcmF0ZUNvbG9yTWFwKCk7XG4gICAgICB0aGlzLmRyYXcoKTtcbiAgICAgIHRoaXMuY3JlYXRlTGVnZW5kKCk7XG4gICAgfVxuICB9XG4gIFxuICAvLyBDcmVhdGUgYSBsZWdlbmQgc2hvd2luZyB3aGF0IHRoZSBjb2xvcnMgcmVwcmVzZW50XG4gIHByaXZhdGUgY3JlYXRlTGVnZW5kKCkge1xuICAgIC8vIFJlbW92ZSBhbnkgZXhpc3RpbmcgbGVnZW5kXG4gICAgY29uc3QgZXhpc3RpbmdMZWdlbmQgPSB0aGlzLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcudHNuZS1jb2xvci1sZWdlbmQnKTtcbiAgICBpZiAoZXhpc3RpbmdMZWdlbmQpIHtcbiAgICAgIGV4aXN0aW5nTGVnZW5kLnJlbW92ZSgpO1xuICAgIH1cbiAgICBcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgLy8gQ3JlYXRlIGEgY29udGFpbmVyIGZvciB0aGUgbGVnZW5kXG4gICAgY29uc3QgbGVnZW5kQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgbGVnZW5kQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3RzbmUtY29sb3ItbGVnZW5kJyk7XG4gICAgbGVnZW5kQ29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICBsZWdlbmRDb250YWluZXIuc3R5bGUucmlnaHQgPSAnMjBweCc7XG4gICAgbGVnZW5kQ29udGFpbmVyLnN0eWxlLnRvcCA9ICcxMjBweCc7IC8vIFBvc2l0aW9uIGJlbG93IHRoZSBjb250cm9sc1xuICAgIGxlZ2VuZENvbnRhaW5lci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAncmdiYSh2YXIoLS1iYWNrZ3JvdW5kLXByaW1hcnktcmdiKSwgMC45KSc7XG4gICAgbGVnZW5kQ29udGFpbmVyLnN0eWxlLmJvcmRlciA9ICcxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpJztcbiAgICBsZWdlbmRDb250YWluZXIuc3R5bGUuYm9yZGVyUmFkaXVzID0gJzRweCc7XG4gICAgbGVnZW5kQ29udGFpbmVyLnN0eWxlLnBhZGRpbmcgPSAnMTBweCc7XG4gICAgbGVnZW5kQ29udGFpbmVyLnN0eWxlLmZvbnRTaXplID0gJzEycHgnO1xuICAgIGxlZ2VuZENvbnRhaW5lci5zdHlsZS5tYXhXaWR0aCA9ICcyNTBweCc7XG4gICAgbGVnZW5kQ29udGFpbmVyLnN0eWxlLm1heEhlaWdodCA9ICczMDBweCc7XG4gICAgbGVnZW5kQ29udGFpbmVyLnN0eWxlLm92ZXJmbG93ID0gJ2F1dG8nO1xuICAgIGxlZ2VuZENvbnRhaW5lci5zdHlsZS56SW5kZXggPSAnMTAnO1xuICAgIGxlZ2VuZENvbnRhaW5lci5zdHlsZS5ib3hTaGFkb3cgPSAnMCAycHggOHB4IHJnYmEoMCwgMCwgMCwgMC4yKSc7XG4gICAgXG4gICAgLy8gQWRkIGEgdGl0bGVcbiAgICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2gzJyk7XG4gICAgdGl0bGUudGV4dENvbnRlbnQgPSAnQ29sb3IgTGVnZW5kJztcbiAgICB0aXRsZS5zdHlsZS5tYXJnaW5Ub3AgPSAnMCc7XG4gICAgdGl0bGUuc3R5bGUubWFyZ2luQm90dG9tID0gJzhweCc7XG4gICAgdGl0bGUuc3R5bGUuZm9udFNpemUgPSAnMTRweCc7XG4gICAgbGVnZW5kQ29udGFpbmVyLmFwcGVuZENoaWxkKHRpdGxlKTtcbiAgICBcbiAgICAvLyBBZGQgc3VidGl0bGUgd2l0aCBjdXJyZW50IGNvbG9yIG1vZGVcbiAgICBjb25zdCBzdWJ0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHN1YnRpdGxlLnRleHRDb250ZW50ID0gYENvbG9yaW5nIGJ5OiAke3RoaXMuZ2V0Q29sb3JNb2RlTGFiZWwoKX1gO1xuICAgIHN1YnRpdGxlLnN0eWxlLmZvbnRTdHlsZSA9ICdpdGFsaWMnO1xuICAgIHN1YnRpdGxlLnN0eWxlLm1hcmdpbkJvdHRvbSA9ICcxMHB4JztcbiAgICBzdWJ0aXRsZS5zdHlsZS5mb250U2l6ZSA9ICcxMXB4JztcbiAgICBsZWdlbmRDb250YWluZXIuYXBwZW5kQ2hpbGQoc3VidGl0bGUpO1xuICAgIFxuICAgIC8vIENyZWF0ZSB0aGUgbGVnZW5kIGl0ZW1zIGJhc2VkIG9uIGNvbG9yIG1vZGVcbiAgICBjb25zdCBsZWdlbmRJdGVtcyA9IHRoaXMuZ2V0TGVnZW5kSXRlbXMoKTtcbiAgICBcbiAgICBpZiAobGVnZW5kSXRlbXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBub0RhdGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIG5vRGF0YS50ZXh0Q29udGVudCA9ICdObyBjb2xvciBkYXRhIGF2YWlsYWJsZSBmb3IgdGhpcyBtb2RlJztcbiAgICAgIG5vRGF0YS5zdHlsZS5mb250U3R5bGUgPSAnaXRhbGljJztcbiAgICAgIG5vRGF0YS5zdHlsZS5vcGFjaXR5ID0gJzAuNyc7XG4gICAgICBsZWdlbmRDb250YWluZXIuYXBwZW5kQ2hpbGQobm9EYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQ3JlYXRlIGxlZ2VuZCBsaXN0XG4gICAgICBjb25zdCBsaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICBsaXN0LnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG4gICAgICBsaXN0LnN0eWxlLmZsZXhEaXJlY3Rpb24gPSAnY29sdW1uJztcbiAgICAgIGxpc3Quc3R5bGUuZ2FwID0gJzVweCc7XG4gICAgICBcbiAgICAgIC8vIEFkZCB0aGUgaXRlbXNcbiAgICAgIGxlZ2VuZEl0ZW1zLmZvckVhY2goaXRlbSA9PiB7XG4gICAgICAgIGNvbnN0IGl0ZW1Db250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgaXRlbUNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuICAgICAgICBpdGVtQ29udGFpbmVyLnN0eWxlLmFsaWduSXRlbXMgPSAnY2VudGVyJztcbiAgICAgICAgaXRlbUNvbnRhaW5lci5zdHlsZS5nYXAgPSAnOHB4JztcbiAgICAgICAgXG4gICAgICAgIC8vIENvbG9yIGJveFxuICAgICAgICBjb25zdCBjb2xvckJveCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBjb2xvckJveC5zdHlsZS53aWR0aCA9ICcxMnB4JztcbiAgICAgICAgY29sb3JCb3guc3R5bGUuaGVpZ2h0ID0gJzEycHgnO1xuICAgICAgICBjb2xvckJveC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBpdGVtLmNvbG9yO1xuICAgICAgICBjb2xvckJveC5zdHlsZS5ib3JkZXJSYWRpdXMgPSAnMnB4JztcbiAgICAgICAgaXRlbUNvbnRhaW5lci5hcHBlbmRDaGlsZChjb2xvckJveCk7XG4gICAgICAgIFxuICAgICAgICAvLyBMYWJlbFxuICAgICAgICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBsYWJlbC50ZXh0Q29udGVudCA9IGl0ZW0ubGFiZWw7XG4gICAgICAgIGxhYmVsLnN0eWxlLmZsZXggPSAnMSc7XG4gICAgICAgIGxhYmVsLnN0eWxlLm92ZXJmbG93ID0gJ2hpZGRlbic7XG4gICAgICAgIGxhYmVsLnN0eWxlLnRleHRPdmVyZmxvdyA9ICdlbGxpcHNpcyc7XG4gICAgICAgIGxhYmVsLnN0eWxlLndoaXRlU3BhY2UgPSAnbm93cmFwJztcbiAgICAgICAgXG4gICAgICAgIC8vIEFkZCB0aXRsZSBmb3IgZnVsbCB0ZXh0IG9uIGhvdmVyXG4gICAgICAgIGxhYmVsLnRpdGxlID0gaXRlbS5sYWJlbDtcbiAgICAgICAgXG4gICAgICAgIGl0ZW1Db250YWluZXIuYXBwZW5kQ2hpbGQobGFiZWwpO1xuICAgICAgICBsaXN0LmFwcGVuZENoaWxkKGl0ZW1Db250YWluZXIpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGxlZ2VuZENvbnRhaW5lci5hcHBlbmRDaGlsZChsaXN0KTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ2xvc2UgYnV0dG9uXG4gICAgY29uc3QgY2xvc2VCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICBjbG9zZUJ1dHRvbi50ZXh0Q29udGVudCA9ICdYJztcbiAgICBjbG9zZUJ1dHRvbi5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgY2xvc2VCdXR0b24uc3R5bGUudG9wID0gJzVweCc7XG4gICAgY2xvc2VCdXR0b24uc3R5bGUucmlnaHQgPSAnNXB4JztcbiAgICBjbG9zZUJ1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kID0gJ25vbmUnO1xuICAgIGNsb3NlQnV0dG9uLnN0eWxlLmJvcmRlciA9ICdub25lJztcbiAgICBjbG9zZUJ1dHRvbi5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG4gICAgY2xvc2VCdXR0b24uc3R5bGUuZm9udFNpemUgPSAnMTJweCc7XG4gICAgY2xvc2VCdXR0b24uc3R5bGUuY29sb3IgPSAndmFyKC0tdGV4dC1tdXRlZCknO1xuICAgIGNsb3NlQnV0dG9uLnN0eWxlLnBhZGRpbmcgPSAnMnB4IDVweCc7XG4gICAgXG4gICAgY2xvc2VCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICBsZWdlbmRDb250YWluZXIucmVtb3ZlKCk7XG4gICAgfSk7XG4gICAgXG4gICAgbGVnZW5kQ29udGFpbmVyLmFwcGVuZENoaWxkKGNsb3NlQnV0dG9uKTtcbiAgICBcbiAgICAvLyBBZGQgdG8gY29udGFpbmVyXG4gICAgdGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQobGVnZW5kQ29udGFpbmVyKTtcbiAgfVxuICBcbiAgLy8gR2V0IGEgZGlzcGxheS1mcmllbmRseSBsYWJlbCBmb3IgdGhlIGN1cnJlbnQgY29sb3IgbW9kZVxuICBwcml2YXRlIGdldENvbG9yTW9kZUxhYmVsKCk6IHN0cmluZyB7XG4gICAgc3dpdGNoICh0aGlzLmNvbG9yTW9kZSkge1xuICAgICAgY2FzZSBDb2xvck1vZGUuQ2x1c3RlcjogcmV0dXJuICdDbHVzdGVyJztcbiAgICAgIGNhc2UgQ29sb3JNb2RlLlRhZ3M6IHJldHVybiAnVGFncyc7XG4gICAgICBjYXNlIENvbG9yTW9kZS5Gb2xkZXI6IHJldHVybiAnRm9sZGVyJztcbiAgICAgIGNhc2UgQ29sb3JNb2RlLkNyZWF0ZWQ6IHJldHVybiAnQ3JlYXRpb24gRGF0ZSc7XG4gICAgICBjYXNlIENvbG9yTW9kZS5Nb2RpZmllZDogcmV0dXJuICdNb2RpZmljYXRpb24gRGF0ZSc7XG4gICAgICBkZWZhdWx0OiByZXR1cm4gJ1Vua25vd24nO1xuICAgIH1cbiAgfVxuICBcbiAgLy8gR2V0IHRoZSBpdGVtcyB0byBzaG93IGluIHRoZSBsZWdlbmRcbiAgcHJpdmF0ZSBnZXRMZWdlbmRJdGVtcygpOiBBcnJheTx7Y29sb3I6IHN0cmluZywgbGFiZWw6IHN0cmluZ30+IHtcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm4gW107XG4gICAgXG4gICAgY29uc3QgaXRlbXM6IEFycmF5PHtjb2xvcjogc3RyaW5nLCBsYWJlbDogc3RyaW5nfT4gPSBbXTtcbiAgICBcbiAgICBzd2l0Y2ggKHRoaXMuY29sb3JNb2RlKSB7XG4gICAgICBjYXNlIENvbG9yTW9kZS5DbHVzdGVyOlxuICAgICAgICAvLyBGb3IgY2x1c3RlcnMsIHNob3cgZWFjaCBjbHVzdGVyIElEIGFuZCB0aGUgdG9wIHRlcm1zXG4gICAgICAgIHRoaXMuY29sb3JNYXAuZm9yRWFjaCgoY29sb3IsIGNsdXN0ZXJJZCkgPT4ge1xuICAgICAgICAgIGxldCBsYWJlbCA9IGBDbHVzdGVyICR7Y2x1c3RlcklkfWA7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gQWRkIHRvcCB0ZXJtcyBpZiBhdmFpbGFibGVcbiAgICAgICAgICBpZiAodGhpcy5yZXN1bHQ/LmNsdXN0ZXJfdGVybXMgJiYgdGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtc1tjbHVzdGVySWRdKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXJtcyA9IHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXVxuICAgICAgICAgICAgICAuc2xpY2UoMCwgMylcbiAgICAgICAgICAgICAgLm1hcCh0ID0+IHQudGVybSlcbiAgICAgICAgICAgICAgLmpvaW4oJywgJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0ZXJtcykge1xuICAgICAgICAgICAgICBsYWJlbCArPSBgOiAke3Rlcm1zfWA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIGl0ZW1zLnB1c2goeyBjb2xvciwgbGFiZWwgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgICAgXG4gICAgICBjYXNlIENvbG9yTW9kZS5UYWdzOlxuICAgICAgICAvLyBGb3IgdGFncywgc2hvdyBlYWNoIHRhZ1xuICAgICAgICB0aGlzLmNvbG9yTWFwLmZvckVhY2goKGNvbG9yLCB0YWcpID0+IHtcbiAgICAgICAgICBpdGVtcy5wdXNoKHsgY29sb3IsIGxhYmVsOiBgIyR7dGFnfWAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgICAgXG4gICAgICBjYXNlIENvbG9yTW9kZS5Gb2xkZXI6XG4gICAgICAgIC8vIEZvciBmb2xkZXJzLCBzaG93IGVhY2ggZm9sZGVyIHBhdGhcbiAgICAgICAgdGhpcy5jb2xvck1hcC5mb3JFYWNoKChjb2xvciwgZm9sZGVyKSA9PiB7XG4gICAgICAgICAgaXRlbXMucHVzaCh7IGNvbG9yLCBsYWJlbDogZm9sZGVyIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIFxuICAgICAgY2FzZSBDb2xvck1vZGUuQ3JlYXRlZDpcbiAgICAgIGNhc2UgQ29sb3JNb2RlLk1vZGlmaWVkOlxuICAgICAgICAvLyBGb3IgZGF0ZSByYW5nZXMsIGZvcm1hdCB0aGVtIG5pY2VseVxuICAgICAgICB0aGlzLmNvbG9yTWFwLmZvckVhY2goKGNvbG9yLCByYW5nZUtleSkgPT4ge1xuICAgICAgICAgIGNvbnN0IFtzdGFydCwgZW5kXSA9IHJhbmdlS2V5LnNwbGl0KCctJykubWFwKE51bWJlcik7XG4gICAgICAgICAgY29uc3Qgc3RhcnREYXRlID0gbmV3IERhdGUoc3RhcnQpO1xuICAgICAgICAgIGNvbnN0IGVuZERhdGUgPSBuZXcgRGF0ZShlbmQpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIEZvcm1hdCB0aGUgZGF0ZXNcbiAgICAgICAgICBjb25zdCBmb3JtYXREYXRlID0gKGRhdGU6IERhdGUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBkYXRlLnRvTG9jYWxlRGF0ZVN0cmluZyh1bmRlZmluZWQsIHsgXG4gICAgICAgICAgICAgIHllYXI6ICdudW1lcmljJyxcbiAgICAgICAgICAgICAgbW9udGg6ICdzaG9ydCcsXG4gICAgICAgICAgICAgIGRheTogJ251bWVyaWMnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IGxhYmVsID0gYCR7Zm9ybWF0RGF0ZShzdGFydERhdGUpfSAtICR7Zm9ybWF0RGF0ZShlbmREYXRlKX1gO1xuICAgICAgICAgIGl0ZW1zLnB1c2goeyBjb2xvciwgbGFiZWwgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGl0ZW1zO1xuICB9XG4gIFxuICBwcml2YXRlIGFkZEV2ZW50TGlzdGVuZXJzKCkge1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuaGFuZGxlTW91c2VNb3ZlLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5oYW5kbGVDbGljay5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCd3aGVlbCcsIHRoaXMuaGFuZGxlV2hlZWwuYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcy5oYW5kbGVNb3VzZURvd24uYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuaGFuZGxlTW91c2VVcC5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWxlYXZlJywgdGhpcy5oYW5kbGVNb3VzZVVwLmJpbmQodGhpcykpO1xuICB9XG4gIFxuICBwcml2YXRlIGhhbmRsZU1vdXNlTW92ZShlOiBNb3VzZUV2ZW50KSB7XG4gICAgY29uc3QgcmVjdCA9IHRoaXMuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHRoaXMubW91c2VYID0gZS5jbGllbnRYIC0gcmVjdC5sZWZ0O1xuICAgIHRoaXMubW91c2VZID0gZS5jbGllbnRZIC0gcmVjdC50b3A7XG4gICAgXG4gICAgaWYgKHRoaXMuaXNEcmFnZ2luZykge1xuICAgICAgY29uc3QgZHggPSB0aGlzLm1vdXNlWCAtIHRoaXMubGFzdFg7XG4gICAgICBjb25zdCBkeSA9IHRoaXMubW91c2VZIC0gdGhpcy5sYXN0WTtcbiAgICAgIFxuICAgICAgdGhpcy5vZmZzZXRYICs9IGR4O1xuICAgICAgdGhpcy5vZmZzZXRZICs9IGR5O1xuICAgICAgXG4gICAgICB0aGlzLmxhc3RYID0gdGhpcy5tb3VzZVg7XG4gICAgICB0aGlzLmxhc3RZID0gdGhpcy5tb3VzZVk7XG4gICAgICBcbiAgICAgIHRoaXMuZHJhdygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVwZGF0ZUhvdmVyZWRQb2ludCgpO1xuICAgICAgdGhpcy5kcmF3KCk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGhhbmRsZUNsaWNrKGU6IE1vdXNlRXZlbnQpIHtcbiAgICBpZiAodGhpcy5ob3ZlcmVkUG9pbnQpIHtcbiAgICAgIHRoaXMub3BlbkNhbGxiYWNrKHRoaXMuaG92ZXJlZFBvaW50LnBhdGgpO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVXaGVlbChlOiBXaGVlbEV2ZW50KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIFxuICAgIGNvbnN0IGRlbHRhID0gZS5kZWx0YVkgPiAwID8gMC45IDogMS4xO1xuICAgIHRoaXMuc2NhbGUgKj0gZGVsdGE7XG4gICAgXG4gICAgLy8gTGltaXQgem9vbVxuICAgIHRoaXMuc2NhbGUgPSBNYXRoLm1heCgwLjEsIE1hdGgubWluKDUsIHRoaXMuc2NhbGUpKTtcbiAgICBcbiAgICB0aGlzLmRyYXcoKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZURvd24oZTogTW91c2VFdmVudCkge1xuICAgIHRoaXMuaXNEcmFnZ2luZyA9IHRydWU7XG4gICAgdGhpcy5sYXN0WCA9IHRoaXMubW91c2VYO1xuICAgIHRoaXMubGFzdFkgPSB0aGlzLm1vdXNlWTtcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS5jdXJzb3IgPSAnZ3JhYmJpbmcnO1xuICB9XG4gIFxuICBwcml2YXRlIGhhbmRsZU1vdXNlVXAoZTogTW91c2VFdmVudCkge1xuICAgIHRoaXMuaXNEcmFnZ2luZyA9IGZhbHNlO1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLmN1cnNvciA9IHRoaXMuaG92ZXJlZFBvaW50ID8gJ3BvaW50ZXInIDogJ2RlZmF1bHQnO1xuICB9XG4gIFxuICBwcml2YXRlIHVwZGF0ZUhvdmVyZWRQb2ludCgpIHtcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgdGhpcy5ob3ZlcmVkUG9pbnQgPSBudWxsO1xuICAgIFxuICAgIGZvciAoY29uc3QgcG9pbnQgb2YgdGhpcy5yZXN1bHQucG9pbnRzKSB7XG4gICAgICBjb25zdCBbc2NyZWVuWCwgc2NyZWVuWV0gPSB0aGlzLndvcmxkVG9TY3JlZW4ocG9pbnQueCwgcG9pbnQueSk7XG4gICAgICBjb25zdCBkaXN0YW5jZSA9IE1hdGguc3FydChcbiAgICAgICAgTWF0aC5wb3coc2NyZWVuWCAtIHRoaXMubW91c2VYLCAyKSArIFxuICAgICAgICBNYXRoLnBvdyhzY3JlZW5ZIC0gdGhpcy5tb3VzZVksIDIpXG4gICAgICApO1xuICAgICAgXG4gICAgICBpZiAoZGlzdGFuY2UgPD0gdGhpcy5wb2ludFJhZGl1cykge1xuICAgICAgICB0aGlzLmhvdmVyZWRQb2ludCA9IHBvaW50O1xuICAgICAgICB0aGlzLmNhbnZhcy5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgdGhpcy5jYW52YXMuc3R5bGUuY3Vyc29yID0gdGhpcy5pc0RyYWdnaW5nID8gJ2dyYWJiaW5nJyA6ICdkZWZhdWx0JztcbiAgfVxuICBcbiAgLy8gQ29udmVydHMgd29ybGQgc3BhY2UgKHQtU05FKSBjb29yZGluYXRlcyB0byBzY3JlZW4gY29vcmRpbmF0ZXNcbiAgcHJpdmF0ZSB3b3JsZFRvU2NyZWVuKHg6IG51bWJlciwgeTogbnVtYmVyKTogW251bWJlciwgbnVtYmVyXSB7XG4gICAgLy8gTm9ybWFsaXplIHRvIGNlbnRlciBvZiBzY3JlZW5cbiAgICBjb25zdCBjZW50ZXJYID0gdGhpcy53aWR0aCAvIDI7XG4gICAgY29uc3QgY2VudGVyWSA9IHRoaXMuaGVpZ2h0IC8gMjtcbiAgICBcbiAgICAvLyBBcHBseSBzY2FsZSBhbmQgb2Zmc2V0XG4gICAgY29uc3Qgc2NyZWVuWCA9IHggKiB0aGlzLnNjYWxlICogMTAwICsgY2VudGVyWCArIHRoaXMub2Zmc2V0WDtcbiAgICBjb25zdCBzY3JlZW5ZID0geSAqIHRoaXMuc2NhbGUgKiAxMDAgKyBjZW50ZXJZICsgdGhpcy5vZmZzZXRZO1xuICAgIFxuICAgIHJldHVybiBbc2NyZWVuWCwgc2NyZWVuWV07XG4gIH1cbiAgXG4gIHB1YmxpYyBzZXREYXRhKHJlc3VsdDogVFNORVJlc3VsdCkge1xuICAgIHRoaXMucmVzdWx0ID0gcmVzdWx0O1xuICAgIHRoaXMucmVzZXRWaWV3KCk7XG4gICAgdGhpcy5nZW5lcmF0ZUNvbG9yTWFwKCk7XG4gICAgdGhpcy5kcmF3KCk7XG4gICAgdGhpcy5jcmVhdGVMZWdlbmQoKTtcbiAgfVxuICBcbiAgLy8gR2VuZXJhdGUgY29sb3IgbWFwcGluZyBiYXNlZCBvbiBjdXJyZW50IGNvbG9yIG1vZGVcbiAgcHJpdmF0ZSBnZW5lcmF0ZUNvbG9yTWFwKCkge1xuICAgIGlmICghdGhpcy5yZXN1bHQpIHJldHVybjtcbiAgICBcbiAgICB0aGlzLmNvbG9yTWFwLmNsZWFyKCk7XG4gICAgXG4gICAgLy8gQ29sb3IgcGFsZXR0ZSBmb3IgZGlmZmVyZW50IGNhdGVnb3JpZXNcbiAgICBjb25zdCBjb2xvclBhbGV0dGUgPSBbXG4gICAgICAncmdiYSgyNTUsIDk5LCAxMzIsIDEpJywgICAgLy8gcmVkXG4gICAgICAncmdiYSg1NCwgMTYyLCAyMzUsIDEpJywgICAgLy8gYmx1ZVxuICAgICAgJ3JnYmEoMjU1LCAyMDYsIDg2LCAxKScsICAgIC8vIHllbGxvd1xuICAgICAgJ3JnYmEoNzUsIDE5MiwgMTkyLCAxKScsICAgIC8vIGdyZWVuXG4gICAgICAncmdiYSgxNTMsIDEwMiwgMjU1LCAxKScsICAgLy8gcHVycGxlXG4gICAgICAncmdiYSgyNTUsIDE1OSwgNjQsIDEpJywgICAgLy8gb3JhbmdlXG4gICAgICAncmdiYSgxOTksIDE5OSwgMTk5LCAxKScsICAgLy8gZ3JleVxuICAgICAgJ3JnYmEoODMsIDEyMywgMTU2LCAxKScsICAgIC8vIHN0ZWVsIGJsdWVcbiAgICAgICdyZ2JhKDE3MiwgMTE0LCA4OSwgMSknLCAgICAvLyBzaWVubmFcbiAgICAgICdyZ2JhKDEyNywgMjU1LCAyMTIsIDEpJywgICAvLyBhcXVhbWFyaW5lXG4gICAgICAncmdiYSgxMDIsIDIwNSwgMTcwLCAxKScsICAgLy8gbWVkaXVtIGFxdWFtYXJpbmVcbiAgICAgICdyZ2JhKDE4NiwgODUsIDIxMSwgMSknLCAgICAvLyBtZWRpdW0gb3JjaGlkXG4gICAgICAncmdiYSgyMTksIDExMiwgMTQ3LCAxKScsICAgLy8gcGFsZSB2aW9sZXQgcmVkXG4gICAgICAncmdiYSgxNDMsIDE4OCwgMTQzLCAxKScsICAgLy8gZGFyayBzZWEgZ3JlZW5cbiAgICAgICdyZ2JhKDIzMywgMTUwLCAxMjIsIDEpJywgICAvLyBkYXJrIHNhbG1vblxuICAgICAgJ3JnYmEoMjQwLCAyMzAsIDE0MCwgMSknLCAgIC8vIGtoYWtpXG4gICAgICAncmdiYSgyMjEsIDE2MCwgMjIxLCAxKScsICAgLy8gcGx1bVxuICAgICAgJ3JnYmEoMTc2LCAxOTYsIDIyMiwgMSknLCAgIC8vIGxpZ2h0IHN0ZWVsIGJsdWVcbiAgICBdO1xuICAgIFxuICAgIC8vIERpZmZlcmVudCBtYXBwaW5nIHN0cmF0ZWdpZXMgYmFzZWQgb24gY29sb3IgbW9kZVxuICAgIHN3aXRjaCAodGhpcy5jb2xvck1vZGUpIHtcbiAgICAgIGNhc2UgQ29sb3JNb2RlLkNsdXN0ZXI6XG4gICAgICAgIC8vIEZvciBjbHVzdGVyIG1vZGUsIHVzZSB0aGUgY2x1c3RlciBJRCBhcyBrZXlcbiAgICAgICAgY29uc3QgY2x1c3RlcnMgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgICAgICAgdGhpcy5yZXN1bHQucG9pbnRzLmZvckVhY2gocG9pbnQgPT4ge1xuICAgICAgICAgIGlmIChwb2ludC5jbHVzdGVyICE9PSAtMSkge1xuICAgICAgICAgICAgY2x1c3RlcnMuYWRkKHBvaW50LmNsdXN0ZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICAvLyBBc3NpZ24gYSBjb2xvciB0byBlYWNoIGNsdXN0ZXJcbiAgICAgICAgQXJyYXkuZnJvbShjbHVzdGVycykuZm9yRWFjaCgoY2x1c3RlciwgaW5kZXgpID0+IHtcbiAgICAgICAgICBjb25zdCBjb2xvckluZGV4ID0gaW5kZXggJSBjb2xvclBhbGV0dGUubGVuZ3RoO1xuICAgICAgICAgIHRoaXMuY29sb3JNYXAuc2V0KGNsdXN0ZXIudG9TdHJpbmcoKSwgY29sb3JQYWxldHRlW2NvbG9ySW5kZXhdKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBcbiAgICAgIGNhc2UgQ29sb3JNb2RlLlRhZ3M6XG4gICAgICAgIC8vIEZvciB0YWcgbW9kZSwgZXh0cmFjdCB1bmlxdWUgdGFncyBmcm9tIGFsbCBwb2ludHNcbiAgICAgICAgY29uc3QgdGFncyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICB0aGlzLnJlc3VsdC5wb2ludHMuZm9yRWFjaChwb2ludCA9PiB7XG4gICAgICAgICAgaWYgKHBvaW50LnRhZ3MgJiYgcG9pbnQudGFncy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBwb2ludC50YWdzLmZvckVhY2godGFnID0+IHRhZ3MuYWRkKHRhZykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICAvLyBBc3NpZ24gYSBjb2xvciB0byBlYWNoIHVuaXF1ZSB0YWdcbiAgICAgICAgQXJyYXkuZnJvbSh0YWdzKS5mb3JFYWNoKCh0YWcsIGluZGV4KSA9PiB7XG4gICAgICAgICAgY29uc3QgY29sb3JJbmRleCA9IGluZGV4ICUgY29sb3JQYWxldHRlLmxlbmd0aDtcbiAgICAgICAgICB0aGlzLmNvbG9yTWFwLnNldCh0YWcsIGNvbG9yUGFsZXR0ZVtjb2xvckluZGV4XSk7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgICAgXG4gICAgICBjYXNlIENvbG9yTW9kZS5Gb2xkZXI6XG4gICAgICAgIC8vIEZvciBmb2xkZXIgbW9kZSwgZXh0cmFjdCB1bmlxdWUgZm9sZGVycyBmcm9tIHBhdGhzXG4gICAgICAgIGNvbnN0IGZvbGRlcnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgICAgdGhpcy5yZXN1bHQucG9pbnRzLmZvckVhY2gocG9pbnQgPT4ge1xuICAgICAgICAgIGNvbnN0IGZvbGRlciA9IHBvaW50LnBhdGguc3BsaXQoJy8nKS5zbGljZSgwLCAtMSkuam9pbignLycpIHx8ICcvJztcbiAgICAgICAgICBmb2xkZXJzLmFkZChmb2xkZXIpO1xuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIC8vIEFzc2lnbiBhIGNvbG9yIHRvIGVhY2ggZm9sZGVyXG4gICAgICAgIEFycmF5LmZyb20oZm9sZGVycykuZm9yRWFjaCgoZm9sZGVyLCBpbmRleCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGNvbG9ySW5kZXggPSBpbmRleCAlIGNvbG9yUGFsZXR0ZS5sZW5ndGg7XG4gICAgICAgICAgdGhpcy5jb2xvck1hcC5zZXQoZm9sZGVyLCBjb2xvclBhbGV0dGVbY29sb3JJbmRleF0pO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIFxuICAgICAgY2FzZSBDb2xvck1vZGUuQ3JlYXRlZDpcbiAgICAgIGNhc2UgQ29sb3JNb2RlLk1vZGlmaWVkOlxuICAgICAgICAvLyBGb3IgZGF0ZS1iYXNlZCBtb2RlcywgY3JlYXRlIHRpbWUtYmFzZWQgY29sb3IgcmFuZ2VzXG4gICAgICAgIGNvbnN0IGRhdGVGaWVsZCA9IHRoaXMuY29sb3JNb2RlID09PSBDb2xvck1vZGUuQ3JlYXRlZCA/ICdjdGltZScgOiAnbXRpbWUnO1xuICAgICAgICBjb25zdCBkYXRlczogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgXG4gICAgICAgIC8vIENvbGxlY3QgYWxsIHZhbGlkIGRhdGUgdmFsdWVzXG4gICAgICAgIHRoaXMucmVzdWx0LnBvaW50cy5mb3JFYWNoKHBvaW50ID0+IHtcbiAgICAgICAgICBjb25zdCBkYXRlID0gcG9pbnRbZGF0ZUZpZWxkXTtcbiAgICAgICAgICBpZiAoZGF0ZSkge1xuICAgICAgICAgICAgZGF0ZXMucHVzaChkYXRlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKGRhdGVzLmxlbmd0aCA9PT0gMCkgYnJlYWs7XG4gICAgICAgIFxuICAgICAgICAvLyBGaW5kIG1pbiBhbmQgbWF4IGRhdGVzIHRvIGNyZWF0ZSByYW5nZXNcbiAgICAgICAgY29uc3QgbWluRGF0ZSA9IE1hdGgubWluKC4uLmRhdGVzKTtcbiAgICAgICAgY29uc3QgbWF4RGF0ZSA9IE1hdGgubWF4KC4uLmRhdGVzKTtcbiAgICAgICAgY29uc3QgdGltZVJhbmdlID0gbWF4RGF0ZSAtIG1pbkRhdGU7XG4gICAgICAgIFxuICAgICAgICAvLyBDcmVhdGUgOCB0aW1lIGJ1Y2tldHNcbiAgICAgICAgY29uc3QgbnVtQnVja2V0cyA9IDg7XG4gICAgICAgIGNvbnN0IGJ1Y2tldFNpemUgPSB0aW1lUmFuZ2UgLyBudW1CdWNrZXRzO1xuICAgICAgICBcbiAgICAgICAgLy8gRm9yIGVhY2ggdGltZSBidWNrZXQsIGFzc2lnbiBhIGNvbG9yXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtQnVja2V0czsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgYnVja2V0U3RhcnQgPSBtaW5EYXRlICsgKGkgKiBidWNrZXRTaXplKTtcbiAgICAgICAgICBjb25zdCBidWNrZXRFbmQgPSBidWNrZXRTdGFydCArIGJ1Y2tldFNpemU7XG4gICAgICAgICAgY29uc3QgYnVja2V0TWlkZGxlID0gbmV3IERhdGUoKGJ1Y2tldFN0YXJ0ICsgYnVja2V0RW5kKSAvIDIpO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIFN0b3JlIHRoZSB0aW1lIHJhbmdlIGFzIGEga2V5IChlLmcuLCBcInRpbWVzdGFtcDEtdGltZXN0YW1wMlwiKVxuICAgICAgICAgIGNvbnN0IHJhbmdlS2V5ID0gYCR7YnVja2V0U3RhcnR9LSR7YnVja2V0RW5kfWA7XG4gICAgICAgICAgY29uc3QgY29sb3JJbmRleCA9IGkgJSBjb2xvclBhbGV0dGUubGVuZ3RoO1xuICAgICAgICAgIHRoaXMuY29sb3JNYXAuc2V0KHJhbmdlS2V5LCBjb2xvclBhbGV0dGVbY29sb3JJbmRleF0pO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSByZXNldFZpZXcoKSB7XG4gICAgdGhpcy5zY2FsZSA9IDE7XG4gICAgdGhpcy5vZmZzZXRYID0gMDtcbiAgICB0aGlzLm9mZnNldFkgPSAwO1xuICB9XG4gIFxuICBwcml2YXRlIGRyYXcoKSB7XG4gICAgaWYgKCF0aGlzLnJlc3VsdCkgcmV0dXJuO1xuICAgIFxuICAgIC8vIENsZWFyIGNhbnZhc1xuICAgIHRoaXMuY3R4LmNsZWFyUmVjdCgwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG4gICAgXG4gICAgLy8gRHJhdyBiYWNrZ3JvdW5kIGdyaWRcbiAgICB0aGlzLmRyYXdHcmlkKCk7XG4gICAgXG4gICAgLy8gRmluZCBjbHVzdGVycyB1c2luZyBhIHNpbXBsZSBkaXN0YW5jZSBtZXRyaWNcbiAgICBjb25zdCBjbHVzdGVycyA9IHRoaXMuZmluZENsdXN0ZXJzKCk7XG4gICAgXG4gICAgLy8gRHJhdyBjbHVzdGVycyBmaXJzdCAodW5kZXJuZWF0aCBwb2ludHMpXG4gICAgdGhpcy5kcmF3Q2x1c3RlcnMoY2x1c3RlcnMpO1xuICAgIFxuICAgIC8vIERyYXcgcG9pbnRzXG4gICAgZm9yIChjb25zdCBwb2ludCBvZiB0aGlzLnJlc3VsdC5wb2ludHMpIHtcbiAgICAgIHRoaXMuZHJhd1BvaW50KHBvaW50KTtcbiAgICB9XG4gICAgXG4gICAgLy8gRHJhdyB0b29sdGlwIGZvciBob3ZlcmVkIHBvaW50XG4gICAgaWYgKHRoaXMuaG92ZXJlZFBvaW50KSB7XG4gICAgICB0aGlzLmRyYXdUb29sdGlwKCk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGRyYXdHcmlkKCkge1xuICAgIGNvbnN0IGdyaWRTaXplID0gNTAgKiB0aGlzLnNjYWxlO1xuICAgIFxuICAgIHRoaXMuY3R4LnN0cm9rZVN0eWxlID0gJ3JnYmEodmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXItcmdiKSwgMC4zKSc7XG4gICAgdGhpcy5jdHgubGluZVdpZHRoID0gMTtcbiAgICBcbiAgICAvLyBWZXJ0aWNhbCBsaW5lc1xuICAgIGZvciAobGV0IHggPSB0aGlzLm9mZnNldFggJSBncmlkU2l6ZTsgeCA8IHRoaXMud2lkdGg7IHggKz0gZ3JpZFNpemUpIHtcbiAgICAgIHRoaXMuY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgdGhpcy5jdHgubW92ZVRvKHgsIDApO1xuICAgICAgdGhpcy5jdHgubGluZVRvKHgsIHRoaXMuaGVpZ2h0KTtcbiAgICAgIHRoaXMuY3R4LnN0cm9rZSgpO1xuICAgIH1cbiAgICBcbiAgICAvLyBIb3Jpem9udGFsIGxpbmVzXG4gICAgZm9yIChsZXQgeSA9IHRoaXMub2Zmc2V0WSAlIGdyaWRTaXplOyB5IDwgdGhpcy5oZWlnaHQ7IHkgKz0gZ3JpZFNpemUpIHtcbiAgICAgIHRoaXMuY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgdGhpcy5jdHgubW92ZVRvKDAsIHkpO1xuICAgICAgdGhpcy5jdHgubGluZVRvKHRoaXMud2lkdGgsIHkpO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGZpbmRDbHVzdGVycygpIHtcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm4gW107XG4gICAgXG4gICAgLy8gU2ltcGxlIGNsdXN0ZXJpbmcgYmFzZWQgb24gZGlzdGFuY2VcbiAgICBjb25zdCBwb2ludHMgPSB0aGlzLnJlc3VsdC5wb2ludHM7XG4gICAgY29uc3QgY2x1c3RlcnM6IFRTTkVQb2ludFtdW10gPSBbXTtcbiAgICBjb25zdCB2aXNpdGVkID0gbmV3IFNldDxudW1iZXI+KCk7XG4gICAgXG4gICAgY29uc3QgZGlzdGFuY2VUaHJlc2hvbGQgPSAwLjI7ICAvLyBBZGp1c3QgdGhpcyB0aHJlc2hvbGQgYXMgbmVlZGVkXG4gICAgXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh2aXNpdGVkLmhhcyhpKSkgY29udGludWU7XG4gICAgICBcbiAgICAgIGNvbnN0IGNsdXN0ZXI6IFRTTkVQb2ludFtdID0gW3BvaW50c1tpXV07XG4gICAgICB2aXNpdGVkLmFkZChpKTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBwb2ludHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKGkgPT09IGogfHwgdmlzaXRlZC5oYXMoaikpIGNvbnRpbnVlO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgZGlzdGFuY2UgPSBNYXRoLnNxcnQoXG4gICAgICAgICAgTWF0aC5wb3cocG9pbnRzW2ldLnggLSBwb2ludHNbal0ueCwgMikgKyBcbiAgICAgICAgICBNYXRoLnBvdyhwb2ludHNbaV0ueSAtIHBvaW50c1tqXS55LCAyKVxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgaWYgKGRpc3RhbmNlIDwgZGlzdGFuY2VUaHJlc2hvbGQpIHtcbiAgICAgICAgICBjbHVzdGVyLnB1c2gocG9pbnRzW2pdKTtcbiAgICAgICAgICB2aXNpdGVkLmFkZChqKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoY2x1c3Rlci5sZW5ndGggPiAxKSB7XG4gICAgICAgIGNsdXN0ZXJzLnB1c2goY2x1c3Rlcik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBjbHVzdGVycztcbiAgfVxuICBcbiAgcHJpdmF0ZSBkcmF3Q2x1c3RlcnMoY2x1c3RlcnM6IFRTTkVQb2ludFtdW10pIHtcbiAgICAvLyBTa2lwIGlmIG5vIHJlc3VsdCBkYXRhXG4gICAgaWYgKCF0aGlzLnJlc3VsdCkgcmV0dXJuO1xuICAgIFxuICAgIC8vIENvbG9yIHBhbGV0dGUgZm9yIGNsdXN0ZXJzIChleGNsdWRpbmcgbm9pc2UgcG9pbnRzKVxuICAgIGNvbnN0IGNvbG9ycyA9IFtcbiAgICAgIHsgZmlsbDogJ3JnYmEoMjU1LCA5OSwgMTMyLCAwLjEpJywgc3Ryb2tlOiAncmdiYSgyNTUsIDk5LCAxMzIsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDU0LCAxNjIsIDIzNSwgMC4xKScsIHN0cm9rZTogJ3JnYmEoNTQsIDE2MiwgMjM1LCAwLjUpJyB9LFxuICAgICAgeyBmaWxsOiAncmdiYSgyNTUsIDIwNiwgODYsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDI1NSwgMjA2LCA4NiwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoNzUsIDE5MiwgMTkyLCAwLjEpJywgc3Ryb2tlOiAncmdiYSg3NSwgMTkyLCAxOTIsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDE1MywgMTAyLCAyNTUsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDE1MywgMTAyLCAyNTUsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDI1NSwgMTU5LCA2NCwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMjU1LCAxNTksIDY0LCAwLjUpJyB9LFxuICAgICAgeyBmaWxsOiAncmdiYSgxOTksIDE5OSwgMTk5LCAwLjEpJywgc3Ryb2tlOiAncmdiYSgxOTksIDE5OSwgMTk5LCAwLjUpJyB9LFxuICAgIF07XG4gICAgXG4gICAgLy8gR3JvdXAgcG9pbnRzIGJ5IGNsdXN0ZXIgSUQgZnJvbSB0aGUgc2VydmVyIHJlc3BvbnNlXG4gICAgY29uc3QgY2x1c3Rlckdyb3VwczogeyBba2V5OiBudW1iZXJdOiBUU05FUG9pbnRbXSB9ID0ge307XG4gICAgXG4gICAgZm9yIChjb25zdCBwb2ludCBvZiB0aGlzLnJlc3VsdC5wb2ludHMpIHtcbiAgICAgIGlmIChwb2ludC5jbHVzdGVyID09PSAtMSkgY29udGludWU7IC8vIFNraXAgbm9pc2UgcG9pbnRzXG4gICAgICBcbiAgICAgIGlmICghY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXSkge1xuICAgICAgICBjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdID0gW107XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0ucHVzaChwb2ludCk7XG4gICAgfVxuICAgIFxuICAgIC8vIERyYXcgZWFjaCBjbHVzdGVyXG4gICAgT2JqZWN0LmVudHJpZXMoY2x1c3Rlckdyb3VwcykuZm9yRWFjaCgoW2NsdXN0ZXJJZCwgcG9pbnRzXSwgaW5kZXgpID0+IHtcbiAgICAgIC8vIEZpbmQgdGhlIGNlbnRyb2lkIGFuZCBib3VuZHMgb2YgdGhlIGNsdXN0ZXJcbiAgICAgIGxldCBtaW5YID0gSW5maW5pdHksIG1pblkgPSBJbmZpbml0eTtcbiAgICAgIGxldCBtYXhYID0gLUluZmluaXR5LCBtYXhZID0gLUluZmluaXR5O1xuICAgICAgbGV0IHN1bVggPSAwLCBzdW1ZID0gMDtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBwb2ludCBvZiBwb2ludHMpIHtcbiAgICAgICAgY29uc3QgW3NjcmVlblgsIHNjcmVlblldID0gdGhpcy53b3JsZFRvU2NyZWVuKHBvaW50LngsIHBvaW50LnkpO1xuICAgICAgICBtaW5YID0gTWF0aC5taW4obWluWCwgc2NyZWVuWCk7XG4gICAgICAgIG1pblkgPSBNYXRoLm1pbihtaW5ZLCBzY3JlZW5ZKTtcbiAgICAgICAgbWF4WCA9IE1hdGgubWF4KG1heFgsIHNjcmVlblgpO1xuICAgICAgICBtYXhZID0gTWF0aC5tYXgobWF4WSwgc2NyZWVuWSk7XG4gICAgICAgIHN1bVggKz0gc2NyZWVuWDtcbiAgICAgICAgc3VtWSArPSBzY3JlZW5ZO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBDYWxjdWxhdGUgY2VudHJvaWRcbiAgICAgIGNvbnN0IGNlbnRlclggPSBzdW1YIC8gcG9pbnRzLmxlbmd0aDtcbiAgICAgIGNvbnN0IGNlbnRlclkgPSBzdW1ZIC8gcG9pbnRzLmxlbmd0aDtcbiAgICAgIFxuICAgICAgLy8gQWRkIHBhZGRpbmdcbiAgICAgIGNvbnN0IHBhZGRpbmcgPSAyMDtcbiAgICAgIG1pblggLT0gcGFkZGluZztcbiAgICAgIG1pblkgLT0gcGFkZGluZztcbiAgICAgIG1heFggKz0gcGFkZGluZztcbiAgICAgIG1heFkgKz0gcGFkZGluZztcbiAgICAgIFxuICAgICAgLy8gVXNlIGNvbG9yIGZyb20gcGFsZXR0ZSAoY3ljbGUgaWYgbW9yZSBjbHVzdGVycyB0aGFuIGNvbG9ycylcbiAgICAgIGNvbnN0IGNvbG9ySW5kZXggPSBwYXJzZUludChjbHVzdGVySWQpICUgY29sb3JzLmxlbmd0aDtcbiAgICAgIGNvbnN0IGNvbG9yID0gY29sb3JzW2NvbG9ySW5kZXhdO1xuICAgICAgXG4gICAgICAvLyBEcmF3IGEgcm91bmRlZCByZWN0YW5nbGUgYXJvdW5kIHRoZSBjbHVzdGVyXG4gICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSBjb2xvci5maWxsO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlU3R5bGUgPSBjb2xvci5zdHJva2U7XG4gICAgICB0aGlzLmN0eC5saW5lV2lkdGggPSAxO1xuICAgICAgXG4gICAgICB0aGlzLnJvdW5kUmVjdChcbiAgICAgICAgbWluWCwgXG4gICAgICAgIG1pblksIFxuICAgICAgICBtYXhYIC0gbWluWCwgXG4gICAgICAgIG1heFkgLSBtaW5ZLCBcbiAgICAgICAgMTBcbiAgICAgICk7XG4gICAgICBcbiAgICAgIHRoaXMuY3R4LmZpbGwoKTtcbiAgICAgIHRoaXMuY3R4LnN0cm9rZSgpO1xuICAgICAgXG4gICAgICAvLyBEcmF3IGNsdXN0ZXIgbGFiZWwgd2l0aCB0b3AgdGVybXMgaWYgYXZhaWxhYmxlXG4gICAgICBpZiAodGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtcyAmJiB0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zW2NsdXN0ZXJJZF0pIHtcbiAgICAgICAgY29uc3QgdGVybXMgPSB0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zW2NsdXN0ZXJJZF1cbiAgICAgICAgICAuc2xpY2UoMCwgMykgIC8vIFRha2UgdG9wIDMgdGVybXNcbiAgICAgICAgICAubWFwKHQgPT4gdC50ZXJtKVxuICAgICAgICAgIC5qb2luKCcsICcpO1xuICAgICAgICBcbiAgICAgICAgLy8gRHJhdyBhIGxhYmVsIHdpdGggY2x1c3RlciBJRCBhbmQgdG9wIHRlcm1zXG4gICAgICAgIGNvbnN0IGxhYmVsVGV4dCA9IGBDbHVzdGVyICR7Y2x1c3RlcklkfTogJHt0ZXJtc31gO1xuICAgICAgICB0aGlzLmN0eC5mb250ID0gJ2JvbGQgMTRweCB2YXIoLS1mb250LXRleHQpJzsgLy8gU2xpZ2h0bHkgbGFyZ2VyIGZvbnRcbiAgICAgICAgXG4gICAgICAgIC8vIE1lYXN1cmUgdGV4dCB0byBjcmVhdGUgYmFja2dyb3VuZFxuICAgICAgICBjb25zdCB0ZXh0TWV0cmljcyA9IHRoaXMuY3R4Lm1lYXN1cmVUZXh0KGxhYmVsVGV4dCk7XG4gICAgICAgIGNvbnN0IHRleHRXaWR0aCA9IHRleHRNZXRyaWNzLndpZHRoO1xuICAgICAgICBjb25zdCB0ZXh0SGVpZ2h0ID0gMTg7IC8vIEFwcHJveGltYXRpb24gZm9yIGhlaWdodFxuICAgICAgICBcbiAgICAgICAgLy8gRHJhdyBiYWNrZ3JvdW5kIGZvciBsYWJlbFxuICAgICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAncmdiYSgwLCAwLCAwLCAwLjcpJzsgLy8gU2VtaS10cmFuc3BhcmVudCBibGFjayBiYWNrZ3JvdW5kXG4gICAgICAgIHRoaXMuY3R4LmZpbGxSZWN0KFxuICAgICAgICAgIGNlbnRlclggLSB0ZXh0V2lkdGggLyAyIC0gNSwgXG4gICAgICAgICAgbWluWSAtIHRleHRIZWlnaHQgLSA1LCBcbiAgICAgICAgICB0ZXh0V2lkdGggKyAxMCwgXG4gICAgICAgICAgdGV4dEhlaWdodFxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgLy8gRHJhdyB0ZXh0XG4gICAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICcjZmZmZmZmJzsgLy8gQnJpZ2h0IHdoaXRlIGZvciBiZXR0ZXIgdmlzaWJpbGl0eVxuICAgICAgICB0aGlzLmN0eC50ZXh0QWxpZ24gPSAnY2VudGVyJztcbiAgICAgICAgdGhpcy5jdHguZmlsbFRleHQobGFiZWxUZXh0LCBjZW50ZXJYLCBtaW5ZIC0gNSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgXG4gIHByaXZhdGUgcm91bmRSZWN0KHg6IG51bWJlciwgeTogbnVtYmVyLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgcmFkaXVzOiBudW1iZXIpIHtcbiAgICB0aGlzLmN0eC5iZWdpblBhdGgoKTtcbiAgICB0aGlzLmN0eC5tb3ZlVG8oeCArIHJhZGl1cywgeSk7XG4gICAgdGhpcy5jdHgubGluZVRvKHggKyB3aWR0aCAtIHJhZGl1cywgeSk7XG4gICAgdGhpcy5jdHguYXJjVG8oeCArIHdpZHRoLCB5LCB4ICsgd2lkdGgsIHkgKyByYWRpdXMsIHJhZGl1cyk7XG4gICAgdGhpcy5jdHgubGluZVRvKHggKyB3aWR0aCwgeSArIGhlaWdodCAtIHJhZGl1cyk7XG4gICAgdGhpcy5jdHguYXJjVG8oeCArIHdpZHRoLCB5ICsgaGVpZ2h0LCB4ICsgd2lkdGggLSByYWRpdXMsIHkgKyBoZWlnaHQsIHJhZGl1cyk7XG4gICAgdGhpcy5jdHgubGluZVRvKHggKyByYWRpdXMsIHkgKyBoZWlnaHQpO1xuICAgIHRoaXMuY3R4LmFyY1RvKHgsIHkgKyBoZWlnaHQsIHgsIHkgKyBoZWlnaHQgLSByYWRpdXMsIHJhZGl1cyk7XG4gICAgdGhpcy5jdHgubGluZVRvKHgsIHkgKyByYWRpdXMpO1xuICAgIHRoaXMuY3R4LmFyY1RvKHgsIHksIHggKyByYWRpdXMsIHksIHJhZGl1cyk7XG4gICAgdGhpcy5jdHguY2xvc2VQYXRoKCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhd1BvaW50KHBvaW50OiBUU05FUG9pbnQpIHtcbiAgICBjb25zdCBbeCwgeV0gPSB0aGlzLndvcmxkVG9TY3JlZW4ocG9pbnQueCwgcG9pbnQueSk7XG4gICAgXG4gICAgLy8gRHJhdyBjaXJjbGVcbiAgICB0aGlzLmN0eC5iZWdpblBhdGgoKTtcbiAgICB0aGlzLmN0eC5hcmMoeCwgeSwgdGhpcy5wb2ludFJhZGl1cywgMCwgTWF0aC5QSSAqIDIpO1xuICAgIFxuICAgIC8vIERldGVybWluZSBjb2xvciBiYXNlZCBvbiBob3ZlciBzdGF0ZSBhbmQgY3VycmVudCBjb2xvciBtb2RlXG4gICAgaWYgKHRoaXMuaG92ZXJlZFBvaW50ID09PSBwb2ludCkge1xuICAgICAgLy8gSG92ZXJlZCBwb2ludHMgYXJlIGFsd2F5cyBoaWdobGlnaHRlZCBpbiB0aGUgYWNjZW50IGNvbG9yXG4gICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAndmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEdldCB0aGUgY29sb3IgYmFzZWQgb24gdGhlIGN1cnJlbnQgY29sb3IgbW9kZVxuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gdGhpcy5nZXRQb2ludENvbG9yKHBvaW50KTtcbiAgICB9XG4gICAgXG4gICAgdGhpcy5jdHguZmlsbCgpO1xuICAgIFxuICAgIC8vIEFkZCBib3JkZXIgdG8gcG9pbnRzXG4gICAgdGhpcy5jdHguc3Ryb2tlU3R5bGUgPSAndmFyKC0tYmFja2dyb3VuZC1wcmltYXJ5KSc7XG4gICAgdGhpcy5jdHgubGluZVdpZHRoID0gMTtcbiAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICBcbiAgICAvLyBEcmF3IHRpdGxlIGlmIG5vdCBob3ZlcmVkIChob3ZlcmVkIHNob3dzIGluIHRvb2x0aXApXG4gICAgaWYgKHRoaXMuaG92ZXJlZFBvaW50ICE9PSBwb2ludCkge1xuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3ZhcigtLXRleHQtbm9ybWFsKSc7XG4gICAgICB0aGlzLmN0eC5mb250ID0gJzEycHggdmFyKC0tZm9udC10ZXh0KSc7XG4gICAgICB0aGlzLmN0eC50ZXh0QWxpZ24gPSAnY2VudGVyJztcbiAgICAgIHRoaXMuY3R4LmZpbGxUZXh0KHBvaW50LnRpdGxlLCB4LCB5IC0gdGhpcy5wb2ludFJhZGl1cyAtIDUpO1xuICAgIH1cbiAgfVxuICBcbiAgLy8gR2V0IGNvbG9yIGZvciBhIHBvaW50IGJhc2VkIG9uIGN1cnJlbnQgY29sb3IgbW9kZVxuICBwcml2YXRlIGdldFBvaW50Q29sb3IocG9pbnQ6IFRTTkVQb2ludCk6IHN0cmluZyB7XG4gICAgLy8gRGVmYXVsdCBjb2xvciBmb3IgcG9pbnRzIHdpdGggbm8gYXBwbGljYWJsZSBtZXRhZGF0YVxuICAgIGNvbnN0IGRlZmF1bHRDb2xvciA9ICd2YXIoLS10ZXh0LW11dGVkKSc7XG4gICAgXG4gICAgc3dpdGNoICh0aGlzLmNvbG9yTW9kZSkge1xuICAgICAgY2FzZSBDb2xvck1vZGUuQ2x1c3RlcjpcbiAgICAgICAgaWYgKHBvaW50LmNsdXN0ZXIgPT09IC0xKSByZXR1cm4gZGVmYXVsdENvbG9yO1xuICAgICAgICByZXR1cm4gdGhpcy5jb2xvck1hcC5nZXQocG9pbnQuY2x1c3Rlci50b1N0cmluZygpKSB8fCBkZWZhdWx0Q29sb3I7XG4gICAgICAgIFxuICAgICAgY2FzZSBDb2xvck1vZGUuVGFnczpcbiAgICAgICAgLy8gSWYgcG9pbnQgaGFzIHRhZ3MsIHVzZSB0aGUgZmlyc3QgdGFnIGZvciBjb2xvclxuICAgICAgICBpZiAocG9pbnQudGFncyAmJiBwb2ludC50YWdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5jb2xvck1hcC5nZXQocG9pbnQudGFnc1swXSkgfHwgZGVmYXVsdENvbG9yO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZhdWx0Q29sb3I7XG4gICAgICAgIFxuICAgICAgY2FzZSBDb2xvck1vZGUuRm9sZGVyOlxuICAgICAgICAvLyBHZXQgZm9sZGVyIGZyb20gcGF0aFxuICAgICAgICBjb25zdCBmb2xkZXIgPSBwb2ludC5wYXRoLnNwbGl0KCcvJykuc2xpY2UoMCwgLTEpLmpvaW4oJy8nKSB8fCAnLyc7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbG9yTWFwLmdldChmb2xkZXIpIHx8IGRlZmF1bHRDb2xvcjtcbiAgICAgICAgXG4gICAgICBjYXNlIENvbG9yTW9kZS5DcmVhdGVkOlxuICAgICAgY2FzZSBDb2xvck1vZGUuTW9kaWZpZWQ6XG4gICAgICAgIC8vIEZvciBkYXRlLWJhc2VkIGNvbG9yaW5nLCBmaW5kIHdoaWNoIHRpbWUgYnVja2V0IHRoaXMgcG9pbnQgYmVsb25ncyB0b1xuICAgICAgICBjb25zdCBkYXRlRmllbGQgPSB0aGlzLmNvbG9yTW9kZSA9PT0gQ29sb3JNb2RlLkNyZWF0ZWQgPyAnY3RpbWUnIDogJ210aW1lJztcbiAgICAgICAgY29uc3QgZGF0ZSA9IHBvaW50W2RhdGVGaWVsZF07XG4gICAgICAgIFxuICAgICAgICBpZiAoIWRhdGUpIHJldHVybiBkZWZhdWx0Q29sb3I7XG4gICAgICAgIFxuICAgICAgICAvLyBDaGVjayBlYWNoIHRpbWUgcmFuZ2UgdG8gZmluZCB3aGVyZSB0aGlzIGRhdGUgZml0c1xuICAgICAgICBmb3IgKGNvbnN0IFtyYW5nZUtleSwgY29sb3JdIG9mIHRoaXMuY29sb3JNYXAuZW50cmllcygpKSB7XG4gICAgICAgICAgY29uc3QgW3N0YXJ0LCBlbmRdID0gcmFuZ2VLZXkuc3BsaXQoJy0nKS5tYXAoTnVtYmVyKTtcbiAgICAgICAgICBpZiAoZGF0ZSA+PSBzdGFydCAmJiBkYXRlIDw9IGVuZCkge1xuICAgICAgICAgICAgcmV0dXJuIGNvbG9yO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmYXVsdENvbG9yO1xuICAgICAgICBcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBkZWZhdWx0Q29sb3I7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGRyYXdUb29sdGlwKCkge1xuICAgIGlmICghdGhpcy5ob3ZlcmVkUG9pbnQgfHwgIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgY29uc3QgW3gsIHldID0gdGhpcy53b3JsZFRvU2NyZWVuKHRoaXMuaG92ZXJlZFBvaW50LngsIHRoaXMuaG92ZXJlZFBvaW50LnkpO1xuICAgIFxuICAgIC8vIFRvb2x0aXAgY29udGVudFxuICAgIGNvbnN0IHRpdGxlID0gdGhpcy5ob3ZlcmVkUG9pbnQudGl0bGU7XG4gICAgY29uc3QgcGF0aCA9IHRoaXMuaG92ZXJlZFBvaW50LnBhdGg7XG4gICAgY29uc3QgdGVybXMgPSB0aGlzLmhvdmVyZWRQb2ludC50b3BfdGVybXMuam9pbignLCAnKTtcbiAgICBcbiAgICAvLyBHZXQgY29sb3IgaW5mb3JtYXRpb24gYmFzZWQgb24gY3VycmVudCBtb2RlXG4gICAgbGV0IGNvbG9ySW5mbyA9ICcnO1xuICAgIHN3aXRjaCAodGhpcy5jb2xvck1vZGUpIHtcbiAgICAgIGNhc2UgQ29sb3JNb2RlLkNsdXN0ZXI6XG4gICAgICAgIGNvbnN0IGNsdXN0ZXJJZCA9IHRoaXMuaG92ZXJlZFBvaW50LmNsdXN0ZXI7XG4gICAgICAgIGlmIChjbHVzdGVySWQgPT09IC0xKSB7XG4gICAgICAgICAgY29sb3JJbmZvID0gJ05vdCBjbHVzdGVyZWQnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEdldCBjbHVzdGVyIHRlcm1zIGlmIGF2YWlsYWJsZVxuICAgICAgICAgIGxldCBjbHVzdGVyVGVybXMgPSAnJztcbiAgICAgICAgICBpZiAodGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtcyAmJiB0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zW2NsdXN0ZXJJZF0pIHtcbiAgICAgICAgICAgIGNsdXN0ZXJUZXJtcyA9IHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXVxuICAgICAgICAgICAgICAuc2xpY2UoMCwgMykgLy8gVGFrZSB0b3AgMyB0ZXJtc1xuICAgICAgICAgICAgICAubWFwKHQgPT4gdC50ZXJtKVxuICAgICAgICAgICAgICAuam9pbignLCAnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29sb3JJbmZvID0gYENsdXN0ZXIgJHtjbHVzdGVySWR9OiAke2NsdXN0ZXJUZXJtc31gO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBcbiAgICAgIGNhc2UgQ29sb3JNb2RlLlRhZ3M6XG4gICAgICAgIGNvbG9ySW5mbyA9ICh0aGlzLmhvdmVyZWRQb2ludC50YWdzICYmIHRoaXMuaG92ZXJlZFBvaW50LnRhZ3MubGVuZ3RoID4gMCkgXG4gICAgICAgICAgPyBgVGFnczogJHt0aGlzLmhvdmVyZWRQb2ludC50YWdzLmpvaW4oJywgJyl9YCBcbiAgICAgICAgICA6ICdObyB0YWdzJztcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIFxuICAgICAgY2FzZSBDb2xvck1vZGUuRm9sZGVyOlxuICAgICAgICBjb25zdCBmb2xkZXIgPSBwYXRoLnNwbGl0KCcvJykuc2xpY2UoMCwgLTEpLmpvaW4oJy8nKSB8fCAnLyc7XG4gICAgICAgIGNvbG9ySW5mbyA9IGBGb2xkZXI6ICR7Zm9sZGVyfWA7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBcbiAgICAgIGNhc2UgQ29sb3JNb2RlLkNyZWF0ZWQ6XG4gICAgICAgIGNvbnN0IGN0aW1lID0gdGhpcy5ob3ZlcmVkUG9pbnQuY3RpbWU7XG4gICAgICAgIGNvbG9ySW5mbyA9IGN0aW1lIFxuICAgICAgICAgID8gYENyZWF0ZWQ6ICR7bmV3IERhdGUoY3RpbWUpLnRvTG9jYWxlU3RyaW5nKCl9YCBcbiAgICAgICAgICA6ICdDcmVhdGlvbiB0aW1lIHVua25vd24nO1xuICAgICAgICBicmVhaztcbiAgICAgICAgXG4gICAgICBjYXNlIENvbG9yTW9kZS5Nb2RpZmllZDpcbiAgICAgICAgY29uc3QgbXRpbWUgPSB0aGlzLmhvdmVyZWRQb2ludC5tdGltZTtcbiAgICAgICAgY29sb3JJbmZvID0gbXRpbWUgXG4gICAgICAgICAgPyBgTW9kaWZpZWQ6ICR7bmV3IERhdGUobXRpbWUpLnRvTG9jYWxlU3RyaW5nKCl9YCBcbiAgICAgICAgICA6ICdNb2RpZmljYXRpb24gdGltZSB1bmtub3duJztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIFxuICAgIC8vIEdldCBhZGRpdGlvbmFsIG1ldGFkYXRhIGlmIGF2YWlsYWJsZVxuICAgIGNvbnN0IHdvcmRDb3VudCA9IHRoaXMuaG92ZXJlZFBvaW50LndvcmRDb3VudCA/IGAke3RoaXMuaG92ZXJlZFBvaW50LndvcmRDb3VudH0gd29yZHNgIDogJyc7XG4gICAgY29uc3QgcmVhZGluZ1RpbWUgPSB0aGlzLmhvdmVyZWRQb2ludC5yZWFkaW5nVGltZSA/IGB+JHt0aGlzLmhvdmVyZWRQb2ludC5yZWFkaW5nVGltZX0gbWluIHJlYWRgIDogJyc7XG4gICAgY29uc3QgY29udGVudFByZXZpZXcgPSB0aGlzLmhvdmVyZWRQb2ludC5jb250ZW50UHJldmlldyA/IHRoaXMuaG92ZXJlZFBvaW50LmNvbnRlbnRQcmV2aWV3IDogJyc7XG4gICAgXG4gICAgLy8gUHJlcGFyZSB0ZXh0XG4gICAgdGhpcy5jdHguZm9udCA9ICdib2xkIDE0cHggdmFyKC0tZm9udC10ZXh0KSc7XG4gICAgY29uc3QgdGl0bGVXaWR0aCA9IHRoaXMuY3R4Lm1lYXN1cmVUZXh0KHRpdGxlKS53aWR0aDtcbiAgICBcbiAgICB0aGlzLmN0eC5mb250ID0gJzEycHggdmFyKC0tZm9udC10ZXh0KSc7XG4gICAgY29uc3QgcGF0aFdpZHRoID0gdGhpcy5jdHgubWVhc3VyZVRleHQocGF0aCkud2lkdGg7XG4gICAgY29uc3QgdGVybXNXaWR0aCA9IHRoaXMuY3R4Lm1lYXN1cmVUZXh0KGBLZXl3b3JkczogJHt0ZXJtc31gKS53aWR0aDtcbiAgICBjb25zdCBjbHVzdGVyV2lkdGggPSB0aGlzLmN0eC5tZWFzdXJlVGV4dChgQ2x1c3RlcjogJHtjb2xvckluZm99YCkud2lkdGg7XG4gICAgY29uc3QgcHJldmlld1dpZHRoID0gY29udGVudFByZXZpZXcgPyB0aGlzLmN0eC5tZWFzdXJlVGV4dChgUHJldmlldzogJHtjb250ZW50UHJldmlldy5zdWJzdHJpbmcoMCwgNTApfS4uLmApLndpZHRoIDogMDtcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgdG9vbHRpcCBkaW1lbnNpb25zXG4gICAgY29uc3QgdG9vbHRpcFdpZHRoID0gTWF0aC5tYXgodGl0bGVXaWR0aCwgcGF0aFdpZHRoLCB0ZXJtc1dpZHRoLCBjbHVzdGVyV2lkdGgsIHByZXZpZXdXaWR0aCkgKyAyMDtcbiAgICBjb25zdCB0b29sdGlwSGVpZ2h0ID0gY29udGVudFByZXZpZXcgPyAxMzUgOiA5NTsgLy8gSW5jcmVhc2VkIGhlaWdodCBpZiB3ZSBoYXZlIHByZXZpZXcgdGV4dFxuICAgIGNvbnN0IHRvb2x0aXBYID0gTWF0aC5taW4oeCArIDEwLCB0aGlzLndpZHRoIC0gdG9vbHRpcFdpZHRoIC0gMTApO1xuICAgIGNvbnN0IHRvb2x0aXBZID0gTWF0aC5taW4oeSAtIDEwLCB0aGlzLmhlaWdodCAtIHRvb2x0aXBIZWlnaHQgLSAxMCk7XG4gICAgXG4gICAgLy8gRHJhdyB0b29sdGlwIGJhY2tncm91bmQgd2l0aCBhIHNvbGlkIGNvbG9yIChtb3JlIHJlbGlhYmxlKVxuICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICdyZ2JhKDI0NSwgMjQ1LCAyNTAsIDAuOTUpJztcbiAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9ICdyZ2JhKDE1MCwgMTUwLCAxNjAsIDAuOCknO1xuICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgXG4gICAgdGhpcy5yb3VuZFJlY3QodG9vbHRpcFgsIHRvb2x0aXBZLCB0b29sdGlwV2lkdGgsIHRvb2x0aXBIZWlnaHQsIDUpO1xuICAgIHRoaXMuY3R4LmZpbGwoKTtcbiAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICBcbiAgICAvLyBEcmF3IHRvb2x0aXAgY29udGVudFxuICAgIHRoaXMuY3R4LnRleHRBbGlnbiA9ICdsZWZ0JztcbiAgICBcbiAgICAvLyBUaXRsZSB3aXRoIGJvbGQgYW5kIGRhcmsgY29sb3JcbiAgICB0aGlzLmN0eC5mb250ID0gJ2JvbGQgMTRweCBzYW5zLXNlcmlmJztcbiAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAnIzAwNjZjYyc7XG4gICAgdGhpcy5jdHguZmlsbFRleHQodGl0bGUsIHRvb2x0aXBYICsgMTAsIHRvb2x0aXBZICsgMjApO1xuICAgIFxuICAgIC8vIFBhdGggaW4gbXV0ZWQgY29sb3JcbiAgICB0aGlzLmN0eC5mb250ID0gJ2l0YWxpYyAxMXB4IHNhbnMtc2VyaWYnO1xuICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICcjNjY2NjY2JztcbiAgICB0aGlzLmN0eC5maWxsVGV4dChwYXRoLCB0b29sdGlwWCArIDEwLCB0b29sdGlwWSArIDM1KTtcbiAgICBcbiAgICAvLyBLZXl3b3JkcyBpbiBub3JtYWwgdGV4dCBjb2xvclxuICAgIHRoaXMuY3R4LmZvbnQgPSAnMTJweCBzYW5zLXNlcmlmJztcbiAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAnIzMzMzMzMyc7XG4gICAgdGhpcy5jdHguZmlsbFRleHQoYEtleXdvcmRzOiAke3Rlcm1zfWAsIHRvb2x0aXBYICsgMTAsIHRvb2x0aXBZICsgNTUpO1xuICAgIFxuICAgIC8vIEFkZCBjb2xvciBtb2RlIHNwZWNpZmljIGluZm9ybWF0aW9uXG4gICAgdGhpcy5jdHguZmlsbFRleHQoY29sb3JJbmZvLCB0b29sdGlwWCArIDEwLCB0b29sdGlwWSArIDc1KTtcbiAgICBcbiAgICAvLyBBZGQgd29yZCBjb3VudCBhbmQgcmVhZGluZyB0aW1lIGlmIGF2YWlsYWJsZVxuICAgIGlmICh3b3JkQ291bnQgfHwgcmVhZGluZ1RpbWUpIHtcbiAgICAgIGNvbnN0IHN0YXRzVGV4dCA9IFt3b3JkQ291bnQsIHJlYWRpbmdUaW1lXS5maWx0ZXIoQm9vbGVhbikuam9pbignIOKAoiAnKTtcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICcjNTU1NTU1JztcbiAgICAgIHRoaXMuY3R4LmZpbGxUZXh0KHN0YXRzVGV4dCwgdG9vbHRpcFggKyAxMCwgdG9vbHRpcFkgKyA5NSk7XG4gICAgfVxuICAgIFxuICAgIC8vIEFkZCBjb250ZW50IHByZXZpZXcgaWYgYXZhaWxhYmxlXG4gICAgaWYgKGNvbnRlbnRQcmV2aWV3KSB7XG4gICAgICB0aGlzLmN0eC5mb250ID0gJ2l0YWxpYyAxMXB4IHNhbnMtc2VyaWYnO1xuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJyM3Nzc3NzcnO1xuICAgICAgLy8gVHJpbSBwcmV2aWV3IGlmIHRvbyBsb25nXG4gICAgICBjb25zdCBkaXNwbGF5UHJldmlldyA9IGNvbnRlbnRQcmV2aWV3Lmxlbmd0aCA+IDYwIFxuICAgICAgICA/IGNvbnRlbnRQcmV2aWV3LnN1YnN0cmluZygwLCA2MCkgKyAnLi4uJyBcbiAgICAgICAgOiBjb250ZW50UHJldmlldztcbiAgICAgIHRoaXMuY3R4LmZpbGxUZXh0KGBcIiR7ZGlzcGxheVByZXZpZXd9XCJgLCB0b29sdGlwWCArIDEwLCB0b29sdGlwWSArIDExNSk7XG4gICAgfVxuICB9XG59IiwiaW1wb3J0IHsgQXBwLCBJdGVtVmlldywgTW9kYWwsIE5vdGljZSwgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nLCBURmlsZSwgV29ya3NwYWNlTGVhZiwgVGV4dEFyZWFDb21wb25lbnQsIEJ1dHRvbkNvbXBvbmVudCB9IGZyb20gJ29ic2lkaWFuJztcbmltcG9ydCAqIGFzIFRTTkUgZnJvbSAndHNuZS1qcyc7XG5pbXBvcnQgeyBUU05FVmlzdWFsaXplciB9IGZyb20gJy4vdmlzdWFsaXphdGlvbic7XG5cbi8vIEludGVyZmFjZSBmb3Igbm90ZSBjb25uZWN0aW9uc1xuaW50ZXJmYWNlIE5vdGVDb25uZWN0aW9uIHtcbiAgc291cmNlTm90ZTogVFNORVBvaW50O1xuICB0YXJnZXROb3RlOiBUU05FUG9pbnQ7XG4gIHNpbWlsYXJpdHk6IG51bWJlcjtcbiAgY29tbW9uVGVybXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyVGVybXM6IHN0cmluZ1tdO1xuICByZWFzb246IHN0cmluZztcbiAgbGxtRGVzY3JpcHRpb24/OiBzdHJpbmc7XG59XG5cbi8vIE1vZGFsIGZvciBkaXNwbGF5aW5nIGFuZCBwcm9jZXNzaW5nIHN1Z2dlc3RlZCBsaW5rc1xuY2xhc3MgU3VnZ2VzdGVkTGlua3NNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgcHJpdmF0ZSBjb25uZWN0aW9uczogTm90ZUNvbm5lY3Rpb25bXTtcbiAgcHJpdmF0ZSBwbHVnaW46IFZpYmVCb3lQbHVnaW47XG4gIHByaXZhdGUgc2VsZWN0ZWRDb25uZWN0aW9uSW5kZXg6IG51bWJlciA9IDA7XG4gIHByaXZhdGUgcHJvY2Vzc2luZ0Nvbm5lY3Rpb246IGJvb2xlYW4gPSBmYWxzZTtcbiAgXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBjb25uZWN0aW9uczogTm90ZUNvbm5lY3Rpb25bXSwgcGx1Z2luOiBWaWJlQm95UGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmNvbm5lY3Rpb25zID0gY29ubmVjdGlvbnM7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cbiAgXG4gIGFzeW5jIG9uT3BlbigpIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBcbiAgICAvLyBTZXQgbW9kYWwgdGl0bGVcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnU3VnZ2VzdGVkIE5vdGUgQ29ubmVjdGlvbnMnIH0pO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbCgncCcsIHsgXG4gICAgICB0ZXh0OiAnQmVsb3cgYXJlIHBvdGVudGlhbCBjb25uZWN0aW9ucyBiZXR3ZWVuIG5vdGVzIGJhc2VkIG9uIGNvbnRlbnQgc2ltaWxhcml0eS4gJyArXG4gICAgICAgICAgICAnU2VsZWN0IGEgY29ubmVjdGlvbiBhbmQgZ2VuZXJhdGUgYSBkZXNjcmlwdGlvbiB0byBjcmVhdGUgYSBsaW5rIGJldHdlZW4gdGhlIG5vdGVzLidcbiAgICB9KTtcbiAgICBcbiAgICAvLyBDcmVhdGUgY29udGFpbmVyIGZvciBjb25uZWN0aW9ucyBsaXN0XG4gICAgY29uc3QgY29ubmVjdGlvbnNDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnY29ubmVjdGlvbnMtY29udGFpbmVyJyB9KTtcbiAgICBcbiAgICAvLyBDcmVhdGUgY29udGFpbmVyIGZvciBzZWxlY3RlZCBjb25uZWN0aW9uIGRldGFpbHNcbiAgICBjb25zdCBkZXRhaWxzQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Nvbm5lY3Rpb24tZGV0YWlscycgfSk7XG4gICAgXG4gICAgLy8gQWRkIHNvbWUgQ1NTXG4gICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgICAgLmNvbm5lY3Rpb25zLWNvbnRhaW5lciB7XG4gICAgICAgIG1heC1oZWlnaHQ6IDE1MHB4O1xuICAgICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgICAgICBtYXJnaW4tYm90dG9tOiAxNXB4O1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlcik7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLWl0ZW0ge1xuICAgICAgICBwYWRkaW5nOiA4cHggMTJweDtcbiAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpO1xuICAgICAgfVxuICAgICAgLmNvbm5lY3Rpb24taXRlbTpob3ZlciB7XG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWJhY2tncm91bmQtc2Vjb25kYXJ5KTtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLWl0ZW0uc2VsZWN0ZWQge1xuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1pbnRlcmFjdGl2ZS1hY2NlbnQpO1xuICAgICAgICBjb2xvcjogdmFyKC0tdGV4dC1vbi1hY2NlbnQpO1xuICAgICAgfVxuICAgICAgLmNvbm5lY3Rpb24tZGV0YWlscyB7XG4gICAgICAgIHBhZGRpbmc6IDEwcHg7XG4gICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyKTtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICBtYXJnaW4tYm90dG9tOiAxNXB4O1xuICAgICAgfVxuICAgICAgLmNvbm5lY3Rpb24tc3RhdHMge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7XG4gICAgICB9XG4gICAgICAuZ2VuZXJhdGUtYnV0dG9uIHtcbiAgICAgICAgbWFyZ2luLXRvcDogMTBweDtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTBweDtcbiAgICAgIH1cbiAgICAgIC5sbG0tZGVzY3JpcHRpb24ge1xuICAgICAgICBtYXJnaW4tdG9wOiAxMHB4O1xuICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgbWluLWhlaWdodDogMTAwcHg7XG4gICAgICB9XG4gICAgICAuYnV0dG9uLWNvbnRhaW5lciB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgbWFyZ2luLXRvcDogMTVweDtcbiAgICAgIH1cbiAgICBgO1xuICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICAgIFxuICAgIC8vIFJlbmRlciBjb25uZWN0aW9ucyBsaXN0XG4gICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uc0xpc3QoY29ubmVjdGlvbnNDb250YWluZXIpO1xuICAgIFxuICAgIC8vIFJlbmRlciBkZXRhaWxzIGZvciB0aGUgZmlyc3QgY29ubmVjdGlvblxuICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoZGV0YWlsc0NvbnRhaW5lciwgdGhpcy5jb25uZWN0aW9uc1swXSk7XG4gICAgXG4gICAgLy8gRm9jdXMgdGhlIGZpcnN0IGNvbm5lY3Rpb25cbiAgICB0aGlzLnNlbGVjdENvbm5lY3Rpb24oMCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgcmVuZGVyQ29ubmVjdGlvbnNMaXN0KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICBcbiAgICB0aGlzLmNvbm5lY3Rpb25zLmZvckVhY2goKGNvbm5lY3Rpb24sIGluZGV4KSA9PiB7XG4gICAgICBjb25zdCBpdGVtID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ2Nvbm5lY3Rpb24taXRlbScgfSk7XG4gICAgICBpZiAoaW5kZXggPT09IHRoaXMuc2VsZWN0ZWRDb25uZWN0aW9uSW5kZXgpIHtcbiAgICAgICAgaXRlbS5hZGRDbGFzcygnc2VsZWN0ZWQnKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc291cmNlVGl0bGUgPSBjb25uZWN0aW9uLnNvdXJjZU5vdGUudGl0bGU7XG4gICAgICBjb25zdCB0YXJnZXRUaXRsZSA9IGNvbm5lY3Rpb24udGFyZ2V0Tm90ZS50aXRsZTtcbiAgICAgIGNvbnN0IHNpbWlsYXJpdHkgPSBNYXRoLnJvdW5kKGNvbm5lY3Rpb24uc2ltaWxhcml0eSk7XG4gICAgICBcbiAgICAgIGl0ZW0uY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYCR7c291cmNlVGl0bGV9IOKGlCAke3RhcmdldFRpdGxlfSAoJHtzaW1pbGFyaXR5fSUgc2ltaWxhcml0eSlgIH0pO1xuICAgICAgXG4gICAgICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICB0aGlzLnNlbGVjdENvbm5lY3Rpb24oaW5kZXgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgXG4gIHByaXZhdGUgcmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgY29ubmVjdGlvbjogTm90ZUNvbm5lY3Rpb24pIHtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICBcbiAgICBjb25zdCBzb3VyY2VOb3RlID0gY29ubmVjdGlvbi5zb3VyY2VOb3RlO1xuICAgIGNvbnN0IHRhcmdldE5vdGUgPSBjb25uZWN0aW9uLnRhcmdldE5vdGU7XG4gICAgXG4gICAgLy8gTm90ZSB0aXRsZXMgYW5kIHBhdGhzXG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogYENvbm5lY3Rpb246ICR7c291cmNlTm90ZS50aXRsZX0g4oaUICR7dGFyZ2V0Tm90ZS50aXRsZX1gIH0pO1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgU291cmNlOiAke3NvdXJjZU5vdGUucGF0aH1gIH0pO1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgVGFyZ2V0OiAke3RhcmdldE5vdGUucGF0aH1gIH0pO1xuICAgIFxuICAgIC8vIFN0YXRzXG4gICAgY29uc3Qgc3RhdHNEaXYgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiAnY29ubmVjdGlvbi1zdGF0cycgfSk7XG4gICAgc3RhdHNEaXYuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYFNpbWlsYXJpdHk6ICR7TWF0aC5yb3VuZChjb25uZWN0aW9uLnNpbWlsYXJpdHkpfSVgIH0pO1xuICAgIHN0YXRzRGl2LmNyZWF0ZUVsKCdkaXYnLCB7IHRleHQ6IGAke3NvdXJjZU5vdGUud29yZENvdW50IHx8ICc/J30gd29yZHMgLyAke3RhcmdldE5vdGUud29yZENvdW50IHx8ICc/J30gd29yZHNgIH0pO1xuICAgIFxuICAgIC8vIFNoYXJlZCB0ZXJtc1xuICAgIGlmIChjb25uZWN0aW9uLmNvbW1vblRlcm1zLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgQ29tbW9uIHRlcm1zOiAke2Nvbm5lY3Rpb24uY29tbW9uVGVybXMuam9pbignLCAnKX1gIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyBDbHVzdGVyIHRlcm1zXG4gICAgaWYgKGNvbm5lY3Rpb24uY2x1c3RlclRlcm1zLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgQ2x1c3RlciB0ZXJtczogJHtjb25uZWN0aW9uLmNsdXN0ZXJUZXJtcy5qb2luKCcsICcpfWAgfSk7XG4gICAgfVxuICAgIFxuICAgIC8vIFJlYXNvbiBmb3IgY29ubmVjdGlvblxuICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgQ29ubmVjdGlvbiByZWFzb246ICR7Y29ubmVjdGlvbi5yZWFzb259YCB9KTtcbiAgICBcbiAgICAvLyBHZW5lcmF0ZSBkZXNjcmlwdGlvbiBidXR0b25cbiAgICBjb25zdCBnZW5lcmF0ZUJ1dHRvbiA9IG5ldyBCdXR0b25Db21wb25lbnQoY29udGFpbmVyKVxuICAgICAgLnNldEJ1dHRvblRleHQoJ0dlbmVyYXRlIENvbm5lY3Rpb24gRGVzY3JpcHRpb24nKVxuICAgICAgLnNldEN0YSgpIC8vIFVzZSBzZXRDdGEoKSBpbnN0ZWFkIG9mIHNldENsYXNzIHdpdGggc3BhY2VzXG4gICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMuZ2VuZXJhdGVMTE1EZXNjcmlwdGlvbihjb25uZWN0aW9uKTtcbiAgICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBjbGFzcyB3aXRob3V0IHNwYWNlc1xuICAgIGdlbmVyYXRlQnV0dG9uLmJ1dHRvbkVsLmFkZENsYXNzKCdnZW5lcmF0ZS1idXR0b24nKTtcbiAgICBcbiAgICBpZiAodGhpcy5wcm9jZXNzaW5nQ29ubmVjdGlvbikge1xuICAgICAgZ2VuZXJhdGVCdXR0b24uc2V0RGlzYWJsZWQodHJ1ZSk7XG4gICAgICBnZW5lcmF0ZUJ1dHRvbi5zZXRCdXR0b25UZXh0KCdHZW5lcmF0aW5nLi4uJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIERlc2NyaXB0aW9uIHRleHQgYXJlYVxuICAgIGlmIChjb25uZWN0aW9uLmxsbURlc2NyaXB0aW9uKSB7XG4gICAgICBjb25zdCBkZXNjcmlwdGlvbkNvbnRhaW5lciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoKTtcbiAgICAgIGRlc2NyaXB0aW9uQ29udGFpbmVyLmNyZWF0ZUVsKCdoNCcsIHsgdGV4dDogJ0Nvbm5lY3Rpb24gRGVzY3JpcHRpb246JyB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGV4dEFyZWEgPSBuZXcgVGV4dEFyZWFDb21wb25lbnQoZGVzY3JpcHRpb25Db250YWluZXIpXG4gICAgICAgIC5zZXRWYWx1ZShjb25uZWN0aW9uLmxsbURlc2NyaXB0aW9uKVxuICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ0Nvbm5lY3Rpb24gZGVzY3JpcHRpb24gd2lsbCBhcHBlYXIgaGVyZS4uLicpO1xuICAgICAgXG4gICAgICB0ZXh0QXJlYS5pbnB1dEVsLmFkZENsYXNzKCdsbG0tZGVzY3JpcHRpb24nKTtcbiAgICAgIFxuICAgICAgLy8gQ3JlYXRlIGJ1dHRvblxuICAgICAgY29uc3QgYnV0dG9uQ29udGFpbmVyID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ2J1dHRvbi1jb250YWluZXInIH0pO1xuICAgICAgXG4gICAgICBuZXcgQnV0dG9uQ29tcG9uZW50KGJ1dHRvbkNvbnRhaW5lcilcbiAgICAgICAgLnNldEJ1dHRvblRleHQoJ0NyZWF0ZSBMaW5rJylcbiAgICAgICAgLnNldEN0YSgpIC8vIFVzZSBzZXRDdGEoKSBpbnN0ZWFkIG9mIHNldENsYXNzIHdpdGggc3BhY2VzXG4gICAgICAgIC5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0aGlzLmNyZWF0ZUxpbmsoY29ubmVjdGlvbiwgdGV4dEFyZWEuZ2V0VmFsdWUoKSk7XG4gICAgICAgIH0pO1xuICAgICAgXG4gICAgICBuZXcgQnV0dG9uQ29tcG9uZW50KGJ1dHRvbkNvbnRhaW5lcilcbiAgICAgICAgLnNldEJ1dHRvblRleHQoJ0VkaXQgRGVzY3JpcHRpb24nKVxuICAgICAgICAub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdGV4dEFyZWEuc2V0RGlzYWJsZWQoZmFsc2UpO1xuICAgICAgICAgIHRleHRBcmVhLmlucHV0RWwuZm9jdXMoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIHNlbGVjdENvbm5lY3Rpb24oaW5kZXg6IG51bWJlcikge1xuICAgIGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5jb25uZWN0aW9ucy5sZW5ndGgpIHJldHVybjtcbiAgICBcbiAgICB0aGlzLnNlbGVjdGVkQ29ubmVjdGlvbkluZGV4ID0gaW5kZXg7XG4gICAgY29uc3QgY29ubmVjdGlvbkNvbnRhaW5lciA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJy5jb25uZWN0aW9ucy1jb250YWluZXInKSBhcyBIVE1MRWxlbWVudDtcbiAgICBjb25zdCBkZXRhaWxzQ29udGFpbmVyID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignLmNvbm5lY3Rpb24tZGV0YWlscycpIGFzIEhUTUxFbGVtZW50O1xuICAgIFxuICAgIGlmIChjb25uZWN0aW9uQ29udGFpbmVyICYmIGRldGFpbHNDb250YWluZXIpIHtcbiAgICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbnNMaXN0KGNvbm5lY3Rpb25Db250YWluZXIpO1xuICAgICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uRGV0YWlscyhkZXRhaWxzQ29udGFpbmVyLCB0aGlzLmNvbm5lY3Rpb25zW2luZGV4XSk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGdlbmVyYXRlTExNRGVzY3JpcHRpb24oY29ubmVjdGlvbjogTm90ZUNvbm5lY3Rpb24pIHtcbiAgICBpZiAodGhpcy5wcm9jZXNzaW5nQ29ubmVjdGlvbikgcmV0dXJuO1xuICAgIFxuICAgIHRoaXMucHJvY2Vzc2luZ0Nvbm5lY3Rpb24gPSB0cnVlO1xuICAgIGNvbnN0IGRldGFpbHNDb250YWluZXIgPSB0aGlzLmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKCcuY29ubmVjdGlvbi1kZXRhaWxzJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uRGV0YWlscyhkZXRhaWxzQ29udGFpbmVyLCBjb25uZWN0aW9uKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgLy8gRmV0Y2ggc291cmNlIGFuZCB0YXJnZXQgbm90ZSBjb250ZW50XG4gICAgICBjb25zdCBzb3VyY2VGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbm5lY3Rpb24uc291cmNlTm90ZS5wYXRoKTtcbiAgICAgIGNvbnN0IHRhcmdldEZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY29ubmVjdGlvbi50YXJnZXROb3RlLnBhdGgpO1xuICAgICAgXG4gICAgICBpZiAoIShzb3VyY2VGaWxlIGluc3RhbmNlb2YgVEZpbGUpIHx8ICEodGFyZ2V0RmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIG5vdGUgZmlsZXMnKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc291cmNlQ29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoc291cmNlRmlsZSk7XG4gICAgICBjb25zdCB0YXJnZXRDb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZCh0YXJnZXRGaWxlKTtcbiAgICAgIFxuICAgICAgLy8gUHJlcGFyZSBkYXRhIGZvciBMTE0gY2FsbFxuICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgc291cmNlTm90ZToge1xuICAgICAgICAgIHRpdGxlOiBjb25uZWN0aW9uLnNvdXJjZU5vdGUudGl0bGUsXG4gICAgICAgICAgY29udGVudDogc291cmNlQ29udGVudC5zdWJzdHJpbmcoMCwgMTAwMCksIC8vIExpbWl0IHRvIGZpcnN0IDEwMDAgY2hhcnNcbiAgICAgICAgICB0b3BUZXJtczogY29ubmVjdGlvbi5zb3VyY2VOb3RlLnRvcF90ZXJtc1xuICAgICAgICB9LFxuICAgICAgICB0YXJnZXROb3RlOiB7XG4gICAgICAgICAgdGl0bGU6IGNvbm5lY3Rpb24udGFyZ2V0Tm90ZS50aXRsZSxcbiAgICAgICAgICBjb250ZW50OiB0YXJnZXRDb250ZW50LnN1YnN0cmluZygwLCAxMDAwKSwgLy8gTGltaXQgdG8gZmlyc3QgMTAwMCBjaGFyc1xuICAgICAgICAgIHRvcFRlcm1zOiBjb25uZWN0aW9uLnRhcmdldE5vdGUudG9wX3Rlcm1zXG4gICAgICAgIH0sXG4gICAgICAgIGNvbW1vblRlcm1zOiBjb25uZWN0aW9uLmNvbW1vblRlcm1zLFxuICAgICAgICBjbHVzdGVyVGVybXM6IGNvbm5lY3Rpb24uY2x1c3RlclRlcm1zLFxuICAgICAgICByZWFzb246IGNvbm5lY3Rpb24ucmVhc29uXG4gICAgICB9O1xuICAgICAgXG4gICAgICAvLyBDYWxsIHRoZSBMTE0gc2VydmljZVxuICAgICAgY29uc3QgZGVzY3JpcHRpb24gPSBhd2FpdCB0aGlzLmNhbGxMTE1TZXJ2aWNlKGRhdGEpO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgdGhlIGNvbm5lY3Rpb24gd2l0aCB0aGUgZ2VuZXJhdGVkIGRlc2NyaXB0aW9uXG4gICAgICBjb25uZWN0aW9uLmxsbURlc2NyaXB0aW9uID0gZGVzY3JpcHRpb247XG4gICAgICBcbiAgICAgIC8vIFVwZGF0ZSB0aGUgVUlcbiAgICAgIHRoaXMucHJvY2Vzc2luZ0Nvbm5lY3Rpb24gPSBmYWxzZTtcbiAgICAgIGNvbnN0IGRldGFpbHNDb250YWluZXIgPSB0aGlzLmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKCcuY29ubmVjdGlvbi1kZXRhaWxzJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICB0aGlzLnJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKGRldGFpbHNDb250YWluZXIsIGNvbm5lY3Rpb24pO1xuICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMucHJvY2Vzc2luZ0Nvbm5lY3Rpb24gPSBmYWxzZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdlbmVyYXRpbmcgZGVzY3JpcHRpb246JywgZXJyb3IpO1xuICAgICAgbmV3IE5vdGljZShgRmFpbGVkIHRvIGdlbmVyYXRlIGRlc2NyaXB0aW9uOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICBcbiAgICAgIC8vIFVwZGF0ZSBVSSB0byBzaG93IGVycm9yXG4gICAgICBjb25zdCBkZXRhaWxzQ29udGFpbmVyID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignLmNvbm5lY3Rpb24tZGV0YWlscycpIGFzIEhUTUxFbGVtZW50O1xuICAgICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uRGV0YWlscyhkZXRhaWxzQ29udGFpbmVyLCBjb25uZWN0aW9uKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgY2FsbExMTVNlcnZpY2UoZGF0YTogYW55KTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICB0cnkge1xuICAgICAgLy8gVHJ5IHRvIGNvbm5lY3QgdG8gdGhlIGxvY2FsIExMTSBBUEkgc2VydmVyXG4gICAgICBjb25zdCBzb3VyY2VUaXRsZSA9IGRhdGEuc291cmNlTm90ZS50aXRsZTtcbiAgICAgIGNvbnN0IHRhcmdldFRpdGxlID0gZGF0YS50YXJnZXROb3RlLnRpdGxlO1xuICAgICAgY29uc3Qgc291cmNlQ29udGVudCA9IGRhdGEuc291cmNlTm90ZS5jb250ZW50O1xuICAgICAgY29uc3QgdGFyZ2V0Q29udGVudCA9IGRhdGEudGFyZ2V0Tm90ZS5jb250ZW50O1xuICAgICAgY29uc3QgY29tbW9uVGVybXMgPSBkYXRhLmNvbW1vblRlcm1zLmpvaW4oJywgJyk7XG4gICAgICBjb25zdCBjbHVzdGVyVGVybXMgPSBkYXRhLmNsdXN0ZXJUZXJtcy5qb2luKCcsICcpO1xuICAgICAgXG4gICAgICAvLyBGaXJzdCwgdHJ5IHRvIHVzZSB0aGUgUHl0aG9uIHNlcnZlcidzIExMTSBpbnRlZ3JhdGlvblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnaHR0cDovLzEyNy4wLjAuMToxMjM0L2dlbmVyYXRlX2Nvbm5lY3Rpb24nLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHNvdXJjZV9ub3RlOiB7XG4gICAgICAgICAgICB0aXRsZTogc291cmNlVGl0bGUsXG4gICAgICAgICAgICBjb250ZW50OiBzb3VyY2VDb250ZW50LFxuICAgICAgICAgICAgdGVybXM6IGRhdGEuc291cmNlTm90ZS50b3BUZXJtc1xuICAgICAgICAgIH0sXG4gICAgICAgICAgdGFyZ2V0X25vdGU6IHtcbiAgICAgICAgICAgIHRpdGxlOiB0YXJnZXRUaXRsZSxcbiAgICAgICAgICAgIGNvbnRlbnQ6IHRhcmdldENvbnRlbnQsXG4gICAgICAgICAgICB0ZXJtczogZGF0YS50YXJnZXROb3RlLnRvcFRlcm1zXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb21tb25fdGVybXM6IGRhdGEuY29tbW9uVGVybXMsXG4gICAgICAgICAgY2x1c3Rlcl90ZXJtczogZGF0YS5jbHVzdGVyVGVybXNcbiAgICAgICAgfSlcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICBpZiAocmVzdWx0LmRlc2NyaXB0aW9uKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdC5kZXNjcmlwdGlvbjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBJZiBzZXJ2ZXIgY2FsbCBmYWlscyBvciBub3QgYXZhaWxhYmxlLCB1c2UgZmFsbGJhY2sgbG9naWNcbiAgICAgIGNvbnNvbGUubG9nKFwiVXNpbmcgZmFsbGJhY2sgY29ubmVjdGlvbiBkZXNjcmlwdGlvbiBnZW5lcmF0aW9uXCIpO1xuICAgICAgXG4gICAgICAvLyBDcmVhdGUgYSB0ZW1wbGF0ZS1iYXNlZCBkZXNjcmlwdGlvbiAoZmFsbGJhY2spXG4gICAgICBsZXQgZGVzY3JpcHRpb24gPSAnJztcbiAgICAgIFxuICAgICAgaWYgKGNvbW1vblRlcm1zKSB7XG4gICAgICAgIGRlc2NyaXB0aW9uICs9IGBUaGVzZSBub3RlcyBzaGFyZSBjb25jZXB0dWFsIG92ZXJsYXAgYXJvdW5kICR7Y29tbW9uVGVybXN9LiBgO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVzY3JpcHRpb24gKz0gYFRoZXNlIG5vdGVzIGFwcGVhciB0byBiZSBjb25jZXB0dWFsbHkgcmVsYXRlZC4gYDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgZGVzY3JpcHRpb24gKz0gYFRoZSBub3RlIFwiJHt0YXJnZXRUaXRsZX1cIiBwcm92aWRlcyBjb21wbGVtZW50YXJ5IGluZm9ybWF0aW9uIHRoYXQgZXhwYW5kcyBvbiBpZGVhcyBpbiBcIiR7c291cmNlVGl0bGV9XCJgO1xuICAgICAgXG4gICAgICBpZiAoY2x1c3RlclRlcm1zKSB7XG4gICAgICAgIGRlc2NyaXB0aW9uICs9IGAsIHBhcnRpY3VsYXJseSByZWdhcmRpbmcgJHtjbHVzdGVyVGVybXN9LmA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZXNjcmlwdGlvbiArPSAnLic7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybiBkZXNjcmlwdGlvbjtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgY2FsbGluZyBMTE0gc2VydmljZTonLCBlcnJvcik7XG4gICAgICBcbiAgICAgIC8vIFJldHVybiBhIGJhc2ljIGRlc2NyaXB0aW9uIGFzIGZhbGxiYWNrXG4gICAgICByZXR1cm4gYFRoZXNlIG5vdGVzIGFwcGVhciB0byBiZSByZWxhdGVkIGluIHRoZWlyIGNvbnRlbnQuIFRoZSBub3RlIFwiJHtkYXRhLnRhcmdldE5vdGUudGl0bGV9XCIgY29tcGxlbWVudHMgXCIke2RhdGEuc291cmNlTm90ZS50aXRsZX1cIiB3aXRoIGFkZGl0aW9uYWwgcmVsZXZhbnQgaW5mb3JtYXRpb24uYDtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgY3JlYXRlTGluayhjb25uZWN0aW9uOiBOb3RlQ29ubmVjdGlvbiwgZGVzY3JpcHRpb246IHN0cmluZykge1xuICAgIGlmICghZGVzY3JpcHRpb24gfHwgZGVzY3JpcHRpb24udHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbmV3IE5vdGljZSgnUGxlYXNlIGdlbmVyYXRlIG9yIHByb3ZpZGUgYSBkZXNjcmlwdGlvbiBmb3IgdGhlIGNvbm5lY3Rpb24nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgLy8gQ2xvc2UgdGhlIG1vZGFsIGZpcnN0IHNvIGl0IGRvZXNuJ3QgaW50ZXJmZXJlIHdpdGggdGhlIG5vdGUgb3BlbmluZ1xuICAgIHRoaXMuY2xvc2UoKTtcbiAgICBcbiAgICAvLyBDcmVhdGUgdGhlIGxpbmsgLSB0aGlzIHdpbGwgYWxzbyBvcGVuIHRoZSBzb3VyY2Ugbm90ZVxuICAgIGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCB0aGlzLnBsdWdpbi5jcmVhdGVOb3RlTGluayhcbiAgICAgIGNvbm5lY3Rpb24uc291cmNlTm90ZS5wYXRoLFxuICAgICAgY29ubmVjdGlvbi50YXJnZXROb3RlLnBhdGgsXG4gICAgICBkZXNjcmlwdGlvblxuICAgICk7XG4gICAgXG4gICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgIC8vIE9wZW4gdGhlIHRhcmdldCBub3RlIGluIGEgc3BsaXQgcGFuZSBhZnRlciBhIHNob3J0IGRlbGF5IHRvIGxldCB0aGUgc291cmNlIG5vdGUgb3BlblxuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gQWxzbyBvZmZlciBvcHRpb24gdG8gdmlldyB0aGUgdGFyZ2V0IG5vdGVcbiAgICAgICAgICBjb25zdCB0YXJnZXRGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbm5lY3Rpb24udGFyZ2V0Tm90ZS5wYXRoKTtcbiAgICAgICAgICBpZiAodGFyZ2V0RmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBtb2RhbCBhc2tpbmcgaWYgdXNlciB3YW50cyB0byBvcGVuIHRoZSB0YXJnZXQgbm90ZVxuICAgICAgICAgICAgY29uc3QgbW9kYWwgPSBuZXcgTW9kYWwodGhpcy5hcHApO1xuICAgICAgICAgICAgY29uc3QgeyBjb250ZW50RWwgfSA9IG1vZGFsO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBBZGQgc29tZSBzdHlsaW5nXG4gICAgICAgICAgICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgICAgICAgICBzdHlsZS50ZXh0Q29udGVudCA9IGBcbiAgICAgICAgICAgICAgLnN1Y2Nlc3MtbW9kYWwge1xuICAgICAgICAgICAgICAgIHBhZGRpbmc6IDIwcHg7XG4gICAgICAgICAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC5zdWNjZXNzLWljb24ge1xuICAgICAgICAgICAgICAgIGZvbnQtc2l6ZTogMzZweDtcbiAgICAgICAgICAgICAgICBtYXJnaW4tYm90dG9tOiAxNXB4O1xuICAgICAgICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbnRlcmFjdGl2ZS1hY2NlbnQpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC5zdWNjZXNzLXRpdGxlIHtcbiAgICAgICAgICAgICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuICAgICAgICAgICAgICAgIGNvbG9yOiB2YXIoLS1pbnRlcmFjdGl2ZS1hY2NlbnQpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC5ub3RlLWluZm8ge1xuICAgICAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDIwcHg7XG4gICAgICAgICAgICAgICAgZm9udC1zdHlsZTogaXRhbGljO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC5jb25maXJtYXRpb24tcXVlc3Rpb24ge1xuICAgICAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDIwcHg7XG4gICAgICAgICAgICAgICAgZm9udC13ZWlnaHQ6IGJvbGQ7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLm1vZGFsLWJ1dHRvbi1jb250YWluZXIge1xuICAgICAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1hcm91bmQ7XG4gICAgICAgICAgICAgICAgbWFyZ2luLXRvcDogMjBweDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgYDtcbiAgICAgICAgICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBDcmVhdGUgdGhlIG1vZGFsIGNvbnRlbnQgd2l0aCBzdHlsaW5nXG4gICAgICAgICAgICBjb25zdCBjb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiAnc3VjY2Vzcy1tb2RhbCcgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFN1Y2Nlc3MgaWNvbiAtIHVzaW5nIGVtb2ppIGZvciBzaW1wbGljaXR5XG4gICAgICAgICAgICBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiAnc3VjY2Vzcy1pY29uJywgdGV4dDogJ/CflJcnIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb250YWluZXIuY3JlYXRlRWwoJ2gyJywgeyBcbiAgICAgICAgICAgICAgdGV4dDogYExpbmsgQ3JlYXRlZCBTdWNjZXNzZnVsbHkhYCxcbiAgICAgICAgICAgICAgY2xzOiAnc3VjY2Vzcy10aXRsZSdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb250YWluZXIuY3JlYXRlRWwoJ3AnLCB7IFxuICAgICAgICAgICAgICB0ZXh0OiBgQSBsaW5rIHRvIFwiJHtjb25uZWN0aW9uLnRhcmdldE5vdGUudGl0bGV9XCIgaGFzIGJlZW4gYWRkZWQgdG8gXCIke2Nvbm5lY3Rpb24uc291cmNlTm90ZS50aXRsZX1cIi5gLFxuICAgICAgICAgICAgICBjbHM6ICdub3RlLWluZm8nXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29udGFpbmVyLmNyZWF0ZUVsKCdwJywgeyBcbiAgICAgICAgICAgICAgdGV4dDogYFdvdWxkIHlvdSBsaWtlIHRvIG9wZW4gXCIke2Nvbm5lY3Rpb24udGFyZ2V0Tm90ZS50aXRsZX1cIiBhcyB3ZWxsP2AsXG4gICAgICAgICAgICAgIGNsczogJ2NvbmZpcm1hdGlvbi1xdWVzdGlvbidcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBidXR0b25Db250YWluZXIgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiAnbW9kYWwtYnV0dG9uLWNvbnRhaW5lcicgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEJ1dHRvbiB0byBvcGVuIHRoZSB0YXJnZXQgbm90ZVxuICAgICAgICAgICAgY29uc3Qgb3BlbkJ1dHRvbiA9IG5ldyBCdXR0b25Db21wb25lbnQoYnV0dG9uQ29udGFpbmVyKVxuICAgICAgICAgICAgICAuc2V0QnV0dG9uVGV4dChgT3BlbiBcIiR7Y29ubmVjdGlvbi50YXJnZXROb3RlLnRpdGxlfVwiYClcbiAgICAgICAgICAgICAgLnNldEN0YSgpXG4gICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBPcGVuIGluIGEgbmV3IGxlYWYgKHNwbGl0IHBhbmUpXG4gICAgICAgICAgICAgICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5jcmVhdGVMZWFmQnlTcGxpdChcbiAgICAgICAgICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmLCBcbiAgICAgICAgICAgICAgICAgICd2ZXJ0aWNhbCdcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGxlYWYub3BlbkZpbGUodGFyZ2V0RmlsZSk7XG4gICAgICAgICAgICAgICAgbW9kYWwuY2xvc2UoKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEJ1dHRvbiB0byBzdGF5IG9uIHRoZSBjdXJyZW50IG5vdGVcbiAgICAgICAgICAgIG5ldyBCdXR0b25Db21wb25lbnQoYnV0dG9uQ29udGFpbmVyKVxuICAgICAgICAgICAgICAuc2V0QnV0dG9uVGV4dCgnU3RheSBvbiBjdXJyZW50IG5vdGUnKVxuICAgICAgICAgICAgICAub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICAgICAgbW9kYWwuY2xvc2UoKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIG1vZGFsLm9wZW4oKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igb3BlbmluZyB0YXJnZXQgbm90ZTonLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0sIDUwMCk7XG4gICAgfVxuICB9XG4gIFxuICBvbkNsb3NlKCkge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICB9XG59XG5cbi8vIERlZmluZSB0aGUgdmlldyB0eXBlIGZvciBvdXIgdmlzdWFsaXphdGlvblxuY29uc3QgVklFV19UWVBFX1RTTkUgPSBcInRzbmUtdmlzdWFsaXphdGlvblwiO1xuXG5pbnRlcmZhY2UgVmliZUJveVNldHRpbmdzIHtcbiAgcGVycGxleGl0eTogbnVtYmVyO1xuICBpdGVyYXRpb25zOiBudW1iZXI7XG4gIGVwc2lsb246IG51bWJlcjtcbn1cblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogVmliZUJveVNldHRpbmdzID0ge1xuICBwZXJwbGV4aXR5OiAzMCxcbiAgaXRlcmF0aW9uczogMTAwMCxcbiAgZXBzaWxvbjogMTBcbn1cblxuLy8gQ3VzdG9tIHZpZXcgZm9yIHQtU05FIHZpc3VhbGl6YXRpb25cbmNsYXNzIFRTTkVWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmKSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiBWSUVXX1RZUEVfVFNORTtcbiAgfVxuXG4gIGdldERpc3BsYXlUZXh0KCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFwidC1TTkUgVmlzdWFsaXphdGlvblwiO1xuICB9XG5cbiAgZ2V0SWNvbigpOiBzdHJpbmcge1xuICAgIHJldHVybiBcImdyYXBoXCI7XG4gIH1cblxuICAvLyBTZXQgb25Ecm9wIGhhbmRsZXIgdG8gcHJldmVudCBlcnJvclxuICBvbkRyb3AoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuICAgIC8vIE5vdCBpbXBsZW1lbnRlZFxuICB9XG5cbiAgLy8gU2V0IG9uUGFuZU1lbnUgaGFuZGxlciB0byBwcmV2ZW50IGVycm9yXG4gIG9uUGFuZU1lbnUobWVudTogYW55LCBzb3VyY2U6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIE5vdCBpbXBsZW1lbnRlZFxuICB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGVudEVsO1xuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIFxuICAgIC8vIEFkZCBoZWFkZXJcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwidHNuZS1oZWFkZXJcIiB9LCAoaGVhZGVyKSA9PiB7XG4gICAgICBoZWFkZXIuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwidC1TTkUgTm90ZSBWaXN1YWxpemF0aW9uXCIgfSk7XG4gICAgICBcbiAgICAgIC8vIEFkZCBhY3Rpb24gYnV0dG9uc1xuICAgICAgY29uc3QgYWN0aW9uQmFyID0gaGVhZGVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInRzbmUtYWN0aW9uc1wiIH0pO1xuICAgICAgXG4gICAgICAvLyBDcmVhdGUgcGFyYW1ldGVyIGNvbnRyb2wgcGFuZWxcbiAgICAgIGNvbnN0IHBhcmFtUGFuZWwgPSBoZWFkZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwidHNuZS1wYXJhbS1wYW5lbFwiIH0pO1xuICAgICAgcGFyYW1QYW5lbC5zdHlsZS5tYXJnaW5Cb3R0b20gPSBcIjE1cHhcIjtcbiAgICAgIHBhcmFtUGFuZWwuc3R5bGUuZGlzcGxheSA9IFwiZmxleFwiO1xuICAgICAgcGFyYW1QYW5lbC5zdHlsZS5mbGV4V3JhcCA9IFwid3JhcFwiO1xuICAgICAgcGFyYW1QYW5lbC5zdHlsZS5nYXAgPSBcIjE1cHhcIjtcbiAgICAgIHBhcmFtUGFuZWwuc3R5bGUuYWxpZ25JdGVtcyA9IFwiY2VudGVyXCI7XG4gICAgICBcbiAgICAgIC8vIEFkZCBwZXJwbGV4aXR5IHNsaWRlclxuICAgICAgY29uc3QgcGx1Z2luID0gKHRoaXMuYXBwIGFzIGFueSkucGx1Z2lucy5wbHVnaW5zW1widmliZS1ib2lcIl0gYXMgVmliZUJveVBsdWdpbjtcbiAgICAgIFxuICAgICAgLy8gUGVycGxleGl0eSBjb250cm9sXG4gICAgICBjb25zdCBwZXJwbGV4aXR5Q29udGFpbmVyID0gcGFyYW1QYW5lbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJ0c25lLXBhcmFtLWNvbnRhaW5lclwiIH0pO1xuICAgICAgcGVycGxleGl0eUNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gXCJmbGV4XCI7XG4gICAgICBwZXJwbGV4aXR5Q29udGFpbmVyLnN0eWxlLmFsaWduSXRlbXMgPSBcImNlbnRlclwiO1xuICAgICAgcGVycGxleGl0eUNvbnRhaW5lci5zdHlsZS5nYXAgPSBcIjEwcHhcIjtcbiAgICAgIFxuICAgICAgY29uc3QgcGVycGxleGl0eUxhYmVsID0gcGVycGxleGl0eUNvbnRhaW5lci5jcmVhdGVFbChcImxhYmVsXCIsIHsgdGV4dDogXCJQZXJwbGV4aXR5OlwiIH0pO1xuICAgICAgcGVycGxleGl0eUxhYmVsLnN0eWxlLm1pbldpZHRoID0gXCI4MHB4XCI7XG4gICAgICBcbiAgICAgIGNvbnN0IHBlcnBsZXhpdHlWYWx1ZSA9IHBlcnBsZXhpdHlDb250YWluZXIuY3JlYXRlRWwoXCJzcGFuXCIsIHsgXG4gICAgICAgIHRleHQ6IHBsdWdpbi5zZXR0aW5ncy5wZXJwbGV4aXR5LnRvU3RyaW5nKCksXG4gICAgICAgIGNsczogXCJ0c25lLXBhcmFtLXZhbHVlXCJcbiAgICAgIH0pO1xuICAgICAgcGVycGxleGl0eVZhbHVlLnN0eWxlLm1pbldpZHRoID0gXCIzMHB4XCI7XG4gICAgICBwZXJwbGV4aXR5VmFsdWUuc3R5bGUudGV4dEFsaWduID0gXCJjZW50ZXJcIjtcbiAgICAgIFxuICAgICAgY29uc3QgcGVycGxleGl0eVNsaWRlciA9IHBlcnBsZXhpdHlDb250YWluZXIuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IFxuICAgICAgICB0eXBlOiBcInJhbmdlXCIsXG4gICAgICAgIGNsczogXCJ0c25lLXBhcmFtLXNsaWRlclwiXG4gICAgICB9KTtcbiAgICAgIHBlcnBsZXhpdHlTbGlkZXIuc2V0QXR0cmlidXRlKFwibWluXCIsIFwiNVwiKTtcbiAgICAgIHBlcnBsZXhpdHlTbGlkZXIuc2V0QXR0cmlidXRlKFwibWF4XCIsIFwiMTAwXCIpO1xuICAgICAgcGVycGxleGl0eVNsaWRlci5zZXRBdHRyaWJ1dGUoXCJzdGVwXCIsIFwiNVwiKTtcbiAgICAgIHBlcnBsZXhpdHlTbGlkZXIuc2V0QXR0cmlidXRlKFwidmFsdWVcIiwgcGx1Z2luLnNldHRpbmdzLnBlcnBsZXhpdHkudG9TdHJpbmcoKSk7XG4gICAgICBcbiAgICAgIHBlcnBsZXhpdHlTbGlkZXIuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsIGFzeW5jIChlKSA9PiB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcGFyc2VJbnQoKGUudGFyZ2V0IGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlKTtcbiAgICAgICAgcGVycGxleGl0eVZhbHVlLnRleHRDb250ZW50ID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgcGx1Z2luLnNldHRpbmdzLnBlcnBsZXhpdHkgPSB2YWx1ZTtcbiAgICAgICAgYXdhaXQgcGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIEl0ZXJhdGlvbnMgY29udHJvbFxuICAgICAgY29uc3QgaXRlcmF0aW9uc0NvbnRhaW5lciA9IHBhcmFtUGFuZWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwidHNuZS1wYXJhbS1jb250YWluZXJcIiB9KTtcbiAgICAgIGl0ZXJhdGlvbnNDb250YWluZXIuc3R5bGUuZGlzcGxheSA9IFwiZmxleFwiO1xuICAgICAgaXRlcmF0aW9uc0NvbnRhaW5lci5zdHlsZS5hbGlnbkl0ZW1zID0gXCJjZW50ZXJcIjtcbiAgICAgIGl0ZXJhdGlvbnNDb250YWluZXIuc3R5bGUuZ2FwID0gXCIxMHB4XCI7XG4gICAgICBcbiAgICAgIGNvbnN0IGl0ZXJhdGlvbnNMYWJlbCA9IGl0ZXJhdGlvbnNDb250YWluZXIuY3JlYXRlRWwoXCJsYWJlbFwiLCB7IHRleHQ6IFwiSXRlcmF0aW9uczpcIiB9KTtcbiAgICAgIGl0ZXJhdGlvbnNMYWJlbC5zdHlsZS5taW5XaWR0aCA9IFwiODBweFwiO1xuICAgICAgXG4gICAgICBjb25zdCBpdGVyYXRpb25zVmFsdWUgPSBpdGVyYXRpb25zQ29udGFpbmVyLmNyZWF0ZUVsKFwic3BhblwiLCB7IFxuICAgICAgICB0ZXh0OiBwbHVnaW4uc2V0dGluZ3MuaXRlcmF0aW9ucy50b1N0cmluZygpLFxuICAgICAgICBjbHM6IFwidHNuZS1wYXJhbS12YWx1ZVwiXG4gICAgICB9KTtcbiAgICAgIGl0ZXJhdGlvbnNWYWx1ZS5zdHlsZS5taW5XaWR0aCA9IFwiMzBweFwiO1xuICAgICAgaXRlcmF0aW9uc1ZhbHVlLnN0eWxlLnRleHRBbGlnbiA9IFwiY2VudGVyXCI7XG4gICAgICBcbiAgICAgIGNvbnN0IGl0ZXJhdGlvbnNTbGlkZXIgPSBpdGVyYXRpb25zQ29udGFpbmVyLmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyBcbiAgICAgICAgdHlwZTogXCJyYW5nZVwiLFxuICAgICAgICBjbHM6IFwidHNuZS1wYXJhbS1zbGlkZXJcIlxuICAgICAgfSk7XG4gICAgICBpdGVyYXRpb25zU2xpZGVyLnNldEF0dHJpYnV0ZShcIm1pblwiLCBcIjI1MFwiKTtcbiAgICAgIGl0ZXJhdGlvbnNTbGlkZXIuc2V0QXR0cmlidXRlKFwibWF4XCIsIFwiMjAwMFwiKTtcbiAgICAgIGl0ZXJhdGlvbnNTbGlkZXIuc2V0QXR0cmlidXRlKFwic3RlcFwiLCBcIjI1MFwiKTtcbiAgICAgIGl0ZXJhdGlvbnNTbGlkZXIuc2V0QXR0cmlidXRlKFwidmFsdWVcIiwgcGx1Z2luLnNldHRpbmdzLml0ZXJhdGlvbnMudG9TdHJpbmcoKSk7XG4gICAgICBcbiAgICAgIGl0ZXJhdGlvbnNTbGlkZXIuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsIGFzeW5jIChlKSA9PiB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcGFyc2VJbnQoKGUudGFyZ2V0IGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlKTtcbiAgICAgICAgaXRlcmF0aW9uc1ZhbHVlLnRleHRDb250ZW50ID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICAgICAgcGx1Z2luLnNldHRpbmdzLml0ZXJhdGlvbnMgPSB2YWx1ZTtcbiAgICAgICAgYXdhaXQgcGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIEFjdGlvbiBidXR0b25zXG4gICAgICBjb25zdCBydW5CdXR0b24gPSBhY3Rpb25CYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlJ1biBBbmFseXNpc1wiLCBjbHM6IFwibW9kLWN0YVwiIH0pO1xuICAgICAgcnVuQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIC8vIEdldCB0aGUgcGx1Z2luIGluc3RhbmNlIGFuZCBydW4gdC1TTkVcbiAgICAgICAgcGx1Z2luLnJ1blRTTkUoKTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBzdWdnZXN0TGlua3NCdXR0b24gPSBhY3Rpb25CYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlN1Z2dlc3QgTGlua3NcIiwgY2xzOiBcIm1vZC1jdGFcIiB9KTtcbiAgICAgIHN1Z2dlc3RMaW5rc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICAvLyBTdWdnZXN0IGxpbmtzXG4gICAgICAgIHBsdWdpbi5zdWdnZXN0TGlua3MoKTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RGb2xkZXJCdXR0b24gPSBhY3Rpb25CYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlNlbGVjdCBGb2xkZXJcIiB9KTtcbiAgICAgIHNlbGVjdEZvbGRlckJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICAvLyBUT0RPOiBJbXBsZW1lbnQgZm9sZGVyIHNlbGVjdGlvblxuICAgICAgICBuZXcgTm90aWNlKFwiRm9sZGVyIHNlbGVjdGlvbiBub3QgaW1wbGVtZW50ZWQgeWV0XCIpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgXG4gICAgLy8gQWRkIGluZm8gdGV4dFxuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcInBcIiwgeyBcbiAgICAgIHRleHQ6IFwiUnVuIHQtU05FIGFuYWx5c2lzIHRvIHZpc3VhbGl6ZSB5b3VyIG5vdGVzIGFzIGNsdXN0ZXJzIGJhc2VkIG9uIGNvbnRlbnQgc2ltaWxhcml0eS5cIixcbiAgICAgIGNsczogXCJ0c25lLWluZm9cIlxuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCB2aXN1YWxpemF0aW9uIGNvbnRhaW5lclxuICAgIGNvbnN0IHRzbmVDb250YWluZXIgPSBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBcbiAgICAgIGNsczogXCJ0c25lLWNvbnRhaW5lclwiLCBcbiAgICAgIGF0dHI6IHsgaWQ6IFwidHNuZS1jb250YWluZXJcIiB9IFxuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBzdGF0dXMgdGV4dFxuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7IFxuICAgICAgY2xzOiBcInRzbmUtc3RhdHVzXCIsXG4gICAgICBhdHRyOiB7IGlkOiBcInRzbmUtc3RhdHVzXCIgfVxuICAgIH0sIChzdGF0dXMpID0+IHtcbiAgICAgIHN0YXR1cy5jcmVhdGVFbChcInBcIiwgeyBcbiAgICAgICAgdGV4dDogXCJVc2UgdGhlICdSdW4gQW5hbHlzaXMnIGJ1dHRvbiB0byBzdGFydCBwcm9jZXNzaW5nIHlvdXIgbm90ZXMuXCIsXG4gICAgICAgIGNsczogXCJ0c25lLXN0YXR1cy10ZXh0XCJcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBzaW1wbGUgQ1NTXG4gICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgICAgLnRzbmUtaGVhZGVyIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMXJlbTtcbiAgICAgIH1cbiAgICAgIC50c25lLWhlYWRlciBoMiB7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDFyZW07XG4gICAgICB9XG4gICAgICAudHNuZS1hY3Rpb25zIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgZ2FwOiAxMHB4O1xuICAgICAgICBtYXJnaW4tdG9wOiAxcmVtO1xuICAgICAgICBhbGlnbi1zZWxmOiBmbGV4LWVuZDtcbiAgICAgIH1cbiAgICAgIC50c25lLXBhcmFtLXBhbmVsIHtcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tYmFja2dyb3VuZC1zZWNvbmRhcnkpO1xuICAgICAgICBwYWRkaW5nOiAxMHB4O1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7XG4gICAgICB9XG4gICAgICAudHNuZS1wYXJhbS1zbGlkZXIge1xuICAgICAgICB3aWR0aDogMTUwcHg7XG4gICAgICB9XG4gICAgICAudHNuZS1wYXJhbS12YWx1ZSB7XG4gICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICBtaW4td2lkdGg6IDMwcHg7XG4gICAgICAgIGRpc3BsYXk6IGlubGluZS1ibG9jaztcbiAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgfVxuICAgICAgLnRzbmUtaW5mbyB7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDFyZW07XG4gICAgICAgIG9wYWNpdHk6IDAuODtcbiAgICAgIH1cbiAgICAgIC50c25lLWNvbnRhaW5lciB7XG4gICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICBoZWlnaHQ6IDgwMHB4O1xuICAgICAgICBtYXJnaW46IDFyZW0gMDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICBvdmVyZmxvdy14OiBhdXRvO1xuICAgICAgICBvdmVyZmxvdy15OiBhdXRvO1xuICAgICAgICBib3gtc2hhZG93OiAwIDAgMTBweCByZ2JhKDAsIDAsIDAsIDAuMSk7XG4gICAgICB9XG4gICAgICAudHNuZS1zdGF0dXMge1xuICAgICAgICBtYXJnaW4tdG9wOiAxMHB4O1xuICAgICAgICBwYWRkaW5nOiAwLjVyZW07XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tYmFja2dyb3VuZC1zZWNvbmRhcnkpO1xuICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgfVxuICAgICAgLnRzbmUtc3RhdHVzLXRleHQge1xuICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgIGZvbnQtc2l6ZTogMC45cmVtO1xuICAgICAgICBvcGFjaXR5OiAwLjg7XG4gICAgICB9XG4gICAgICAudHNuZS1jb250cm9sLXBhbmVsIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgZmxleC13cmFwOiB3cmFwO1xuICAgICAgICBnYXA6IDhweDtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTBweDtcbiAgICAgIH1cbiAgICAgIC50c25lLWJ1dHRvbi1ncm91cCBidXR0b24ge1xuICAgICAgICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kLWNvbG9yIDAuMnMsIGNvbG9yIDAuMnM7XG4gICAgICB9XG4gICAgICAudHNuZS1idXR0b24tZ3JvdXAgYnV0dG9uOmZpcnN0LWNoaWxkIHtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4IDAgMCA0cHg7XG4gICAgICB9XG4gICAgICAudHNuZS1idXR0b24tZ3JvdXAgYnV0dG9uOmxhc3QtY2hpbGQge1xuICAgICAgICBib3JkZXItcmFkaXVzOiAwIDRweCA0cHggMDtcbiAgICAgIH1cbiAgICBgO1xuICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFZpYmVCb3lQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5nczogVmliZUJveVNldHRpbmdzO1xuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG4gICAgLy8gUmVnaXN0ZXIgdGhlIGN1c3RvbSB2aWV3XG4gICAgdGhpcy5yZWdpc3RlclZpZXcoXG4gICAgICBWSUVXX1RZUEVfVFNORSxcbiAgICAgIChsZWFmKSA9PiBuZXcgVFNORVZpZXcobGVhZilcbiAgICApO1xuXG4gICAgLy8gQWRkIGNvbW1hbmQgdG8gb3BlbiB0aGUgdmlzdWFsaXphdGlvblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogJ29wZW4tdHNuZS12aXN1YWxpemF0aW9uJyxcbiAgICAgIG5hbWU6ICdPcGVuIHQtU05FIFZpc3VhbGl6YXRpb24nLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEFkZCBjb21tYW5kIHRvIHJ1biB0LVNORSBhbmFseXNpc1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogJ3J1bi10c25lLWFuYWx5c2lzJyxcbiAgICAgIG5hbWU6ICdSdW4gdC1TTkUgQW5hbHlzaXMnLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgdGhpcy5ydW5UU05FKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBZGQgc2V0dGluZyB0YWJcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IFNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgfVxuXG4gIG9udW5sb2FkKCkge1xuICAgIC8vIENsZWFuIHVwIHJlc291cmNlcyB3aGVuIHRoZSBwbHVnaW4gaXMgZGlzYWJsZWRcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG5cbiAgYXN5bmMgYWN0aXZhdGVWaWV3KCkge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfVFNORSk7XG4gICAgaWYgKGV4aXN0aW5nLmxlbmd0aCkge1xuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoZXhpc3RpbmdbMF0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZih0cnVlKTtcbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7XG4gICAgICB0eXBlOiBWSUVXX1RZUEVfVFNORSxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIHJ1blRTTkUoKSB7XG4gICAgLy8gUHJvY2VzcyBub3RlcyBhbmQgcnVuIHQtU05FIGFuYWx5c2lzXG4gICAgbmV3IE5vdGljZSgndC1TTkUgYW5hbHlzaXMgc3RhcnRpbmcuLi4nKTtcbiAgICB0aGlzLnVwZGF0ZVN0YXR1cygnR2F0aGVyaW5nIG5vdGVzLi4uJyk7XG4gICAgXG4gICAgLy8gR2V0IGFsbCBtYXJrZG93biBmaWxlcyBpbiB0aGUgdmF1bHRcbiAgICBjb25zdCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgLy8gTGltaXQgdG8gYSByZWFzb25hYmxlIG51bWJlciBvZiBmaWxlcyBmb3IgcGVyZm9ybWFuY2VcbiAgICAgIGNvbnN0IG1heEZpbGVzID0gMjAwO1xuICAgICAgY29uc3Qgc2VsZWN0ZWRGaWxlcyA9IGZpbGVzLnNsaWNlKDAsIG1heEZpbGVzKTtcbiAgICAgIFxuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoYFByb2Nlc3NpbmcgJHtzZWxlY3RlZEZpbGVzLmxlbmd0aH0gbm90ZXMuLi5gKTtcbiAgICAgIFxuICAgICAgLy8gUHJlcGFyZSBub3RlcyBkYXRhIGZvciB0aGUgUHl0aG9uIHNlcnZlclxuICAgICAgY29uc3Qgbm90ZXMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgc2VsZWN0ZWRGaWxlcy5tYXAoYXN5bmMgKGZpbGUpID0+IHtcbiAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgICBjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5zdGF0KGZpbGUucGF0aCk7XG4gICAgICAgICAgY29uc3Qgd29yZENvdW50ID0gY29udGVudC5zcGxpdCgvXFxzKy8pLmxlbmd0aDtcbiAgICAgICAgICBjb25zdCByZWFkaW5nVGltZSA9IE1hdGguY2VpbCh3b3JkQ291bnQgLyAyMDApOyAvLyBBdmcgcmVhZGluZyBzcGVlZCB+MjAwIHdvcmRzL21pbnV0ZVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIEV4dHJhY3QgdGFncyAobG9va2luZyBmb3IgI3RhZyBmb3JtYXQpXG4gICAgICAgICAgY29uc3QgdGFnUmVnZXggPSAvIyhbYS16QS1aMC05Xy1dKykvZztcbiAgICAgICAgICBjb25zdCB0YWdzID0gWy4uLmNvbnRlbnQubWF0Y2hBbGwodGFnUmVnZXgpXS5tYXAobWF0Y2ggPT4gbWF0Y2hbMV0pO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIEdldCBhIGNvbnRlbnQgcHJldmlldyAoZmlyc3QgMTUwIGNoYXJzKVxuICAgICAgICAgIGNvbnN0IGNvbnRlbnRQcmV2aWV3ID0gY29udGVudC5zdWJzdHJpbmcoMCwgMTUwKS5yZXBsYWNlKC9cXG4vZywgJyAnKSArIFxuICAgICAgICAgICAgKGNvbnRlbnQubGVuZ3RoID4gMTUwID8gJy4uLicgOiAnJyk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBhdGg6IGZpbGUucGF0aCxcbiAgICAgICAgICAgIHRpdGxlOiBmaWxlLmJhc2VuYW1lLFxuICAgICAgICAgICAgY29udGVudDogY29udGVudCxcbiAgICAgICAgICAgIG10aW1lOiBzdGF0Lm10aW1lLFxuICAgICAgICAgICAgY3RpbWU6IHN0YXQuY3RpbWUsXG4gICAgICAgICAgICB3b3JkQ291bnQ6IHdvcmRDb3VudCxcbiAgICAgICAgICAgIHJlYWRpbmdUaW1lOiByZWFkaW5nVGltZSxcbiAgICAgICAgICAgIHRhZ3M6IHRhZ3MsXG4gICAgICAgICAgICBjb250ZW50UHJldmlldzogY29udGVudFByZXZpZXdcbiAgICAgICAgICB9O1xuICAgICAgICB9KVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoJ1NlbmRpbmcgZGF0YSB0byB0LVNORSBzZXJ2ZXIuLi4nKTtcbiAgICAgIFxuICAgICAgLy8gQ2hlY2sgaWYgUHl0aG9uIHNlcnZlciBpcyBydW5uaW5nXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBoZWFsdGhDaGVjayA9IGF3YWl0IGZldGNoKCdodHRwOi8vMTI3LjAuMC4xOjEyMzQvaGVhbHRoJywgeyBcbiAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFoZWFsdGhDaGVjay5vaykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlB5dGhvbiBzZXJ2ZXIgaXMgbm90IHJlc3BvbmRpbmdcIik7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBcIkNhbm5vdCBjb25uZWN0IHRvIFB5dGhvbiBzZXJ2ZXIuIE1ha2Ugc3VyZSB0aGUgc2VydmVyIGlzIHJ1bm5pbmcgYXQgaHR0cDovLzEyNy4wLjAuMToxMjM0LiBcIiArXG4gICAgICAgICAgXCJSdW4gJ3B5dGhvbiBzcmMvcHl0aG9uL3RzbmUvc2VydmVyLnB5JyB0byBzdGFydCBpdC5cIlxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBTZW5kIHRvIFB5dGhvbiBzZXJ2ZXIgZm9yIHByb2Nlc3NpbmdcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGBSdW5uaW5nIHQtU05FIGFuYWx5c2lzIHdpdGggcGVycGxleGl0eT0ke3RoaXMuc2V0dGluZ3MucGVycGxleGl0eX0sIGl0ZXJhdGlvbnM9JHt0aGlzLnNldHRpbmdzLml0ZXJhdGlvbnN9Li4uYCk7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCdodHRwOi8vMTI3LjAuMC4xOjEyMzQvcHJvY2VzcycsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgbm90ZXM6IG5vdGVzLFxuICAgICAgICAgIHNldHRpbmdzOiB7XG4gICAgICAgICAgICBwZXJwbGV4aXR5OiB0aGlzLnNldHRpbmdzLnBlcnBsZXhpdHksXG4gICAgICAgICAgICBpdGVyYXRpb25zOiB0aGlzLnNldHRpbmdzLml0ZXJhdGlvbnMsXG4gICAgICAgICAgICBsZWFybmluZ19yYXRlOiB0aGlzLnNldHRpbmdzLmVwc2lsb25cbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNlcnZlciByZXNwb25kZWQgd2l0aCBzdGF0dXM6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICBcbiAgICAgIGlmIChyZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgZXJyb3I6ICR7cmVzdWx0LmVycm9yfWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnVmlzdWFsaXppbmcgcmVzdWx0cy4uLicpO1xuICAgICAgXG4gICAgICAvLyBEZWJ1ZyAtIGxvZyB0aGUgcmVzdWx0IHN0cnVjdHVyZSB0byBjaGVjayBtZXRhZGF0YVxuICAgICAgY29uc29sZS5sb2coJ1Zpc3VhbGl6aW5nIHJlc3VsdCB3aXRoIG1ldGFkYXRhOicsIHJlc3VsdCk7XG4gICAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGFkZGl0aW9uYWwgbWV0YWRhdGFcbiAgICAgIGlmIChyZXN1bHQucG9pbnRzICYmIHJlc3VsdC5wb2ludHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBzYW1wbGVQb2ludCA9IHJlc3VsdC5wb2ludHNbMF07XG4gICAgICAgIGNvbnNvbGUubG9nKCdTYW1wbGUgcG9pbnQgbWV0YWRhdGE6Jywge1xuICAgICAgICAgIGhhc1dvcmRDb3VudDogc2FtcGxlUG9pbnQud29yZENvdW50ICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzTXRpbWU6IHNhbXBsZVBvaW50Lm10aW1lICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzQ3RpbWU6IHNhbXBsZVBvaW50LmN0aW1lICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzVGFnczogc2FtcGxlUG9pbnQudGFncyAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc0NvbnRlbnRQcmV2aWV3OiBzYW1wbGVQb2ludC5jb250ZW50UHJldmlldyAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc0Rpc3RhbmNlVG9DZW50ZXI6IHNhbXBsZVBvaW50LmRpc3RhbmNlVG9DZW50ZXIgIT09IHVuZGVmaW5lZFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gU3RvcmUgdGhlIHJlc3VsdCBmb3IgbGF0ZXIgdXNlIGluIGxpbmsgc3VnZ2VzdGlvbnNcbiAgICAgIHRoaXMubGFzdFJlc3VsdCA9IHJlc3VsdDtcbiAgICAgIFxuICAgICAgLy8gVmlzdWFsaXplIHRoZSByZXN1bHRcbiAgICAgIHRoaXMudmlzdWFsaXplUmVzdWx0KHJlc3VsdCk7XG4gICAgICBcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGBWaXN1YWxpemF0aW9uIGNvbXBsZXRlISBEaXNwbGF5aW5nICR7cmVzdWx0LnBvaW50cy5sZW5ndGh9IG5vdGVzLmApO1xuICAgICAgbmV3IE5vdGljZSgndC1TTkUgYW5hbHlzaXMgY29tcGxldGUhJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHJ1bm5pbmcgdC1TTkUgYW5hbHlzaXM6JywgZXJyb3IpO1xuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoYEVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICBuZXcgTm90aWNlKGB0LVNORSBhbmFseXNpcyBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgdXBkYXRlU3RhdHVzKG1lc3NhZ2U6IHN0cmluZykge1xuICAgIC8vIEZpbmQgdGhlIHN0YXR1cyBlbGVtZW50IGluIHRoZSB2aWV3IGFuZCB1cGRhdGUgaXRcbiAgICBjb25zdCBzdGF0dXNFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RzbmUtc3RhdHVzIC50c25lLXN0YXR1cy10ZXh0Jyk7XG4gICAgaWYgKHN0YXR1c0VsZW1lbnQpIHtcbiAgICAgIHN0YXR1c0VsZW1lbnQudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICAgIH1cbiAgICBjb25zb2xlLmxvZyhgU3RhdHVzOiAke21lc3NhZ2V9YCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgdmlzdWFsaXplUmVzdWx0KHJlc3VsdDogYW55KSB7XG4gICAgLy8gR2V0IG9yIGNyZWF0ZSB0aGUgdmlzdWFsaXphdGlvbiB2aWV3XG4gICAgbGV0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9UU05FKVswXTtcbiAgICBpZiAoIWxlYWYpIHtcbiAgICAgIC8vIEFjdGl2YXRlIHRoZSB2aWV3IGlmIG5vdCBmb3VuZFxuICAgICAgYXdhaXQgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICAgIC8vIFRyeSB0byBnZXQgdGhlIGxlYWYgYWdhaW5cbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9UU05FKVswXTtcbiAgICAgIFxuICAgICAgaWYgKCFsZWFmKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NvdWxkIG5vdCBjcmVhdGUgdmlzdWFsaXphdGlvbiB2aWV3Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gQWNjZXNzIHRoZSB2aWV3IGNvbnRhaW5lclxuICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXcgYXMgVFNORVZpZXc7XG4gICAgY29uc3QgY29udGFpbmVyID0gdmlldy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignI3RzbmUtY29udGFpbmVyJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgaWYgKCFjb250YWluZXIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0NvbnRhaW5lciBub3QgZm91bmQgaW4gdmlldycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICAvLyBDbGVhciBhbnkgZXhpc3RpbmcgY29udGVudFxuICAgIHdoaWxlIChjb250YWluZXIuZmlyc3RDaGlsZCkge1xuICAgICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKGNvbnRhaW5lci5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ3JlYXRlIHRoZSB2aXN1YWxpemVyXG4gICAgY29uc3Qgb3BlbkNhbGxiYWNrID0gKHBhdGg6IHN0cmluZykgPT4ge1xuICAgICAgLy8gT3BlbiB0aGUgc2VsZWN0ZWQgbm90ZVxuICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcbiAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoKS5vcGVuRmlsZShmaWxlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIC8vIENyZWF0ZSBhbmQgdXNlIHRoZSB2aXN1YWxpemVyIGRpcmVjdGx5XG4gICAgY29uc3QgdmlzdWFsaXplciA9IG5ldyBUU05FVmlzdWFsaXplcihjb250YWluZXIsIG9wZW5DYWxsYmFjayk7XG4gICAgdmlzdWFsaXplci5zZXREYXRhKHJlc3VsdCk7XG4gIH1cbiAgXG4gIC8vIE1ldGhvZCB0byBzdWdnZXN0IGxpbmtzIGJldHdlZW4gbm90ZXMgdXNpbmcgTExNXG4gIGFzeW5jIHN1Z2dlc3RMaW5rcygpIHtcbiAgICBpZiAoIXRoaXMubGFzdFJlc3VsdCB8fCAhdGhpcy5sYXN0UmVzdWx0LnBvaW50cyB8fCB0aGlzLmxhc3RSZXN1bHQucG9pbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbmV3IE5vdGljZSgnUGxlYXNlIHJ1biB0LVNORSBhbmFseXNpcyBmaXJzdCB0byBnZW5lcmF0ZSBub3RlIGRhdGEnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgLy8gU2hvdyBhIG5vdGljZSB0aGF0IHdlJ3JlIHN0YXJ0aW5nIHRoZSBwcm9jZXNzXG4gICAgbmV3IE5vdGljZSgnRmluZGluZyBwb3RlbnRpYWwgbm90ZSBjb25uZWN0aW9ucy4uLicpO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICAvLyBGaW5kIHBvdGVudGlhbCBjb25uZWN0aW9ucyBiYXNlZCBvbiB0LVNORSBwcm94aW1pdHkgYW5kIGNsdXN0ZXJpbmdcbiAgICAgIGNvbnN0IGNvbm5lY3Rpb25zID0gdGhpcy5maW5kUG90ZW50aWFsQ29ubmVjdGlvbnModGhpcy5sYXN0UmVzdWx0KTtcbiAgICAgIFxuICAgICAgaWYgKGNvbm5lY3Rpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBuZXcgTm90aWNlKCdObyBzdHJvbmcgY29ubmVjdGlvbnMgZm91bmQgYmV0d2VlbiBub3RlcycpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIENyZWF0ZSBhIG1vZGFsIHRvIGRpc3BsYXkgdGhlIHN1Z2dlc3RlZCBjb25uZWN0aW9uc1xuICAgICAgY29uc3QgbW9kYWwgPSBuZXcgU3VnZ2VzdGVkTGlua3NNb2RhbCh0aGlzLmFwcCwgY29ubmVjdGlvbnMsIHRoaXMpO1xuICAgICAgbW9kYWwub3BlbigpO1xuICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHN1Z2dlc3RpbmcgbGlua3M6JywgZXJyb3IpO1xuICAgICAgbmV3IE5vdGljZShgRXJyb3Igc3VnZ2VzdGluZyBsaW5rczogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxuICBcbiAgLy8gU3RvcmUgdGhlIGxhc3QgcmVzdWx0IGZvciB1c2UgaW4gbGluayBzdWdnZXN0aW9uc1xuICBwcml2YXRlIGxhc3RSZXN1bHQ6IGFueSA9IG51bGw7XG4gIFxuICAvLyBGaW5kIHBvdGVudGlhbCBjb25uZWN0aW9ucyBiZXR3ZWVuIG5vdGVzIGJhc2VkIG9uIHQtU05FIHJlc3VsdHNcbiAgcHJpdmF0ZSBmaW5kUG90ZW50aWFsQ29ubmVjdGlvbnMocmVzdWx0OiBhbnkpOiBOb3RlQ29ubmVjdGlvbltdIHtcbiAgICBjb25zdCBjb25uZWN0aW9uczogTm90ZUNvbm5lY3Rpb25bXSA9IFtdO1xuICAgIGNvbnN0IHBvaW50cyA9IHJlc3VsdC5wb2ludHMgYXMgVFNORVBvaW50W107XG4gICAgXG4gICAgLy8gMS4gRmluZCBub3RlcyBpbiB0aGUgc2FtZSBjbHVzdGVyXG4gICAgY29uc3QgY2x1c3Rlckdyb3VwczogeyBba2V5OiBudW1iZXJdOiBUU05FUG9pbnRbXSB9ID0ge307XG4gICAgXG4gICAgLy8gR3JvdXAgcG9pbnRzIGJ5IGNsdXN0ZXJcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHBvaW50cykge1xuICAgICAgaWYgKHBvaW50LmNsdXN0ZXIgPT09IC0xKSBjb250aW51ZTsgLy8gU2tpcCB1bmNsdXN0ZXJlZCBwb2ludHNcbiAgICAgIFxuICAgICAgaWYgKCFjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdKSB7XG4gICAgICAgIGNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0gPSBbXTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXS5wdXNoKHBvaW50KTtcbiAgICB9XG4gICAgXG4gICAgLy8gRm9yIGVhY2ggY2x1c3RlciwgZmluZCB0aGUgbW9zdCBjZW50cmFsIG5vdGVzXG4gICAgT2JqZWN0LmVudHJpZXMoY2x1c3Rlckdyb3VwcykuZm9yRWFjaCgoW2NsdXN0ZXJJZCwgY2x1c3RlclBvaW50c10pID0+IHtcbiAgICAgIC8vIE9ubHkgY29uc2lkZXIgY2x1c3RlcnMgd2l0aCBhdCBsZWFzdCAyIG5vdGVzXG4gICAgICBpZiAoY2x1c3RlclBvaW50cy5sZW5ndGggPCAyKSByZXR1cm47XG4gICAgICBcbiAgICAgIC8vIEZpbmQgbW9zdCBjZW50cmFsIG5vdGVzIGluIHRoZSBjbHVzdGVyIChjbG9zZXN0IHRvIGNsdXN0ZXIgY2VudGVyKVxuICAgICAgY2x1c3RlclBvaW50cy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGRpc3RBID0gYS5kaXN0YW5jZVRvQ2VudGVyIHx8IEluZmluaXR5O1xuICAgICAgICBjb25zdCBkaXN0QiA9IGIuZGlzdGFuY2VUb0NlbnRlciB8fCBJbmZpbml0eTtcbiAgICAgICAgcmV0dXJuIGRpc3RBIC0gZGlzdEI7XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gVGFrZSB0aGUgbW9zdCBjZW50cmFsIG5vdGVzXG4gICAgICBjb25zdCBjZW50cmFsTm90ZXMgPSBjbHVzdGVyUG9pbnRzLnNsaWNlKDAsIE1hdGgubWluKDMsIGNsdXN0ZXJQb2ludHMubGVuZ3RoKSk7XG4gICAgICBcbiAgICAgIC8vIENyZWF0ZSBjb25uZWN0aW9ucyBiZXR3ZWVuIHRoZSBjZW50cmFsIG5vdGVzXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNlbnRyYWxOb3Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCBjZW50cmFsTm90ZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBjb25zdCBub3RlQSA9IGNlbnRyYWxOb3Rlc1tpXTtcbiAgICAgICAgICBjb25zdCBub3RlQiA9IGNlbnRyYWxOb3Rlc1tqXTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBTa2lwIGlmIHRoZSB0d28gbm90ZXMgYXJlIHZlcnkgZmFyIGFwYXJ0IGluIHRoZSB2aXN1YWxpemF0aW9uXG4gICAgICAgICAgY29uc3QgZGlzdGFuY2UgPSBNYXRoLnNxcnQoXG4gICAgICAgICAgICBNYXRoLnBvdyhub3RlQS54IC0gbm90ZUIueCwgMikgKyBNYXRoLnBvdyhub3RlQS55IC0gbm90ZUIueSwgMilcbiAgICAgICAgICApO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChkaXN0YW5jZSA+IDAuNSkgY29udGludWU7IC8vIFNraXAgaWYgdG9vIGZhclxuICAgICAgICAgIFxuICAgICAgICAgIC8vIENhbGN1bGF0ZSBhIHNpbWlsYXJpdHkgc2NvcmUgKDAtMTAwKVxuICAgICAgICAgIGNvbnN0IHNpbWlsYXJpdHkgPSAxMDAgLSBNYXRoLm1pbigxMDAsIGRpc3RhbmNlICogMTAwKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBGaW5kIGNvbW1vbiB0ZXJtc1xuICAgICAgICAgIGNvbnN0IGNvbW1vblRlcm1zID0gbm90ZUEudG9wX3Rlcm1zLmZpbHRlcih0ZXJtID0+IFxuICAgICAgICAgICAgbm90ZUIudG9wX3Rlcm1zLmluY2x1ZGVzKHRlcm0pXG4gICAgICAgICAgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIHNvdXJjZU5vdGU6IG5vdGVBLFxuICAgICAgICAgICAgdGFyZ2V0Tm90ZTogbm90ZUIsXG4gICAgICAgICAgICBzaW1pbGFyaXR5OiBzaW1pbGFyaXR5LFxuICAgICAgICAgICAgY29tbW9uVGVybXM6IGNvbW1vblRlcm1zLFxuICAgICAgICAgICAgY2x1c3RlclRlcm1zOiByZXN1bHQuY2x1c3Rlcl90ZXJtcz8uW2NsdXN0ZXJJZF0/LnNsaWNlKDAsIDUpLm1hcCgodDogYW55KSA9PiB0LnRlcm0pIHx8IFtdLFxuICAgICAgICAgICAgcmVhc29uOiBgQm90aCBub3RlcyBhcmUgY2VudHJhbCBpbiBjbHVzdGVyICR7Y2x1c3RlcklkfWBcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIC8vIDIuIEZpbmQgbm90ZXMgdGhhdCBhcmUgY2xvc2UgaW4gdGhlIHQtU05FIHByb2plY3Rpb24gYnV0IG1heSBiZSBpbiBkaWZmZXJlbnQgY2x1c3RlcnNcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgZm9yIChsZXQgaiA9IGkgKyAxOyBqIDwgcG9pbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGNvbnN0IG5vdGVBID0gcG9pbnRzW2ldO1xuICAgICAgICBjb25zdCBub3RlQiA9IHBvaW50c1tqXTtcbiAgICAgICAgXG4gICAgICAgIC8vIFNraXAgbm90ZXMgaW4gdGhlIHNhbWUgY2x1c3RlciAoYWxyZWFkeSBoYW5kbGVkIGFib3ZlKVxuICAgICAgICBpZiAobm90ZUEuY2x1c3RlciAhPT0gLTEgJiYgbm90ZUEuY2x1c3RlciA9PT0gbm90ZUIuY2x1c3RlcikgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICAvLyBDYWxjdWxhdGUgRXVjbGlkZWFuIGRpc3RhbmNlIGluIHQtU05FIHNwYWNlXG4gICAgICAgIGNvbnN0IGRpc3RhbmNlID0gTWF0aC5zcXJ0KFxuICAgICAgICAgIE1hdGgucG93KG5vdGVBLnggLSBub3RlQi54LCAyKSArIE1hdGgucG93KG5vdGVBLnkgLSBub3RlQi55LCAyKVxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgLy8gT25seSBjb25zaWRlciB2ZXJ5IGNsb3NlIG5vdGVzXG4gICAgICAgIGlmIChkaXN0YW5jZSA+IDAuMikgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICAvLyBDYWxjdWxhdGUgYSBzaW1pbGFyaXR5IHNjb3JlICgwLTEwMClcbiAgICAgICAgY29uc3Qgc2ltaWxhcml0eSA9IDEwMCAtIE1hdGgubWluKDEwMCwgZGlzdGFuY2UgKiAyMDApO1xuICAgICAgICBcbiAgICAgICAgLy8gRmluZCBjb21tb24gdGVybXNcbiAgICAgICAgY29uc3QgY29tbW9uVGVybXMgPSBub3RlQS50b3BfdGVybXMuZmlsdGVyKHRlcm0gPT4gXG4gICAgICAgICAgbm90ZUIudG9wX3Rlcm1zLmluY2x1ZGVzKHRlcm0pXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICAvLyBPbmx5IGluY2x1ZGUgaWYgdGhleSBoYXZlIGNvbW1vbiB0ZXJtc1xuICAgICAgICBpZiAoY29tbW9uVGVybXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgc291cmNlTm90ZTogbm90ZUEsXG4gICAgICAgICAgICB0YXJnZXROb3RlOiBub3RlQixcbiAgICAgICAgICAgIHNpbWlsYXJpdHk6IHNpbWlsYXJpdHksXG4gICAgICAgICAgICBjb21tb25UZXJtczogY29tbW9uVGVybXMsXG4gICAgICAgICAgICBjbHVzdGVyVGVybXM6IFtdLFxuICAgICAgICAgICAgcmVhc29uOiBgTm90ZXMgYXJlIHZlcnkgY2xvc2UgaW4gdGhlIHZpc3VhbGl6YXRpb24gYW5kIHNoYXJlIGNvbW1vbiB0ZXJtc2BcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBTb3J0IGNvbm5lY3Rpb25zIGJ5IHNpbWlsYXJpdHkgKGhpZ2hlc3QgZmlyc3QpXG4gICAgY29ubmVjdGlvbnMuc29ydCgoYSwgYikgPT4gYi5zaW1pbGFyaXR5IC0gYS5zaW1pbGFyaXR5KTtcbiAgICBcbiAgICAvLyBSZXR1cm4gdG9wIDEwIGNvbm5lY3Rpb25zIHRvIGF2b2lkIG92ZXJ3aGVsbWluZyB0aGUgdXNlclxuICAgIHJldHVybiBjb25uZWN0aW9ucy5zbGljZSgwLCAxMCk7XG4gIH1cbiAgXG4gIC8vIENyZWF0ZSBhIGxpbmsgYmV0d2VlbiB0d28gbm90ZXNcbiAgYXN5bmMgY3JlYXRlTm90ZUxpbmsoc291cmNlTm90ZVBhdGg6IHN0cmluZywgdGFyZ2V0Tm90ZVBhdGg6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZykge1xuICAgIHRyeSB7XG4gICAgICAvLyBHZXQgdGhlIHNvdXJjZSBmaWxlXG4gICAgICBjb25zdCBzb3VyY2VGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHNvdXJjZU5vdGVQYXRoKTtcbiAgICAgIGlmICghKHNvdXJjZUZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTb3VyY2UgZmlsZSBub3QgZm91bmQ6ICR7c291cmNlTm90ZVBhdGh9YCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFJlYWQgdGhlIGZpbGUgY29udGVudFxuICAgICAgY29uc3Qgc291cmNlQ29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoc291cmNlRmlsZSk7XG4gICAgICBcbiAgICAgIC8vIEdlbmVyYXRlIHRoZSBsaW5rIHRleHQgd2l0aCB0aGUgZm9ybWF0dGVkIGNvbm5lY3Rpb24gZGVzY3JpcHRpb25cbiAgICAgIGNvbnN0IHRhcmdldEZpbGVOYW1lID0gdGFyZ2V0Tm90ZVBhdGguc3BsaXQoJy8nKS5wb3AoKSB8fCB0YXJnZXROb3RlUGF0aDtcbiAgICAgIGNvbnN0IGxpbmtUZXh0ID0gYFxcblxcbiMjIFJlbGF0ZWQgTm90ZXNcXG5cXG4tIFtbJHt0YXJnZXRGaWxlTmFtZX1dXSAtICR7ZGVzY3JpcHRpb24udHJpbSgpfVxcbmA7XG4gICAgICBcbiAgICAgIC8vIEFwcGVuZCB0aGUgbGluayB0byB0aGUgc291cmNlIGZpbGVcbiAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShzb3VyY2VGaWxlLCBzb3VyY2VDb250ZW50ICsgbGlua1RleHQpO1xuICAgICAgXG4gICAgICAvLyBPcGVuIHRoZSBzb3VyY2UgZmlsZSBpbiBhIG5ldyBwYW5lIHRvIHNob3cgdGhlIGxpbmtcbiAgICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLmFjdGl2ZUxlYWYgIT09IG51bGwgJiYgXG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmICE9PSB1bmRlZmluZWRcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGF3YWl0IGxlYWYub3BlbkZpbGUoc291cmNlRmlsZSwgeyBcbiAgICAgICAgYWN0aXZlOiB0cnVlLCAgIC8vIE1ha2UgdGhlIHBhbmUgYWN0aXZlXG4gICAgICAgIGVTdGF0ZTogeyAgICAgICAvLyBUcnkgdG8gc2Nyb2xsIHRvIHRoZSBuZXdseSBhZGRlZCBsaW5rXG4gICAgICAgICAgbGluZTogc291cmNlQ29udGVudC5zcGxpdCgnXFxuJykubGVuZ3RoICsgMiwgLy8gQXBwcm94aW1hdGUgbGluZSBudW1iZXIgb2YgdGhlIG5ldyBsaW5rXG4gICAgICAgICAgZm9jdXM6IHRydWUgICAvLyBGb2N1cyB0aGUgZWRpdG9yXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyBTaG93IGEgc3VjY2VzcyBub3RpY2VcbiAgICAgIG5ldyBOb3RpY2UoXCJMaW5rIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5ISDwn5SXXCIsIDIwMDApO1xuICAgICAgXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgY3JlYXRpbmcgbm90ZSBsaW5rOicsIGVycm9yKTtcbiAgICAgIG5ldyBOb3RpY2UoYEZhaWxlZCB0byBjcmVhdGUgbGluazogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxufVxuXG4vLyBJbnRlcmZhY2UgZm9yIHQtU05FIHJlc3VsdCBwb2ludHNcbmludGVyZmFjZSBUU05FUG9pbnQge1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgdGl0bGU6IHN0cmluZztcbiAgcGF0aDogc3RyaW5nO1xuICB0b3BfdGVybXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyOiBudW1iZXI7IC8vIENsdXN0ZXIgSUQgKC0xIG1lYW5zIG5vaXNlL25vdCBjbHVzdGVyZWQpXG4gIFxuICAvLyBBZGRpdGlvbmFsIG1ldGFkYXRhXG4gIG10aW1lPzogbnVtYmVyOyAgICAgIC8vIExhc3QgbW9kaWZpZWQgdGltZVxuICBjdGltZT86IG51bWJlcjsgICAgICAvLyBDcmVhdGlvbiB0aW1lXG4gIHdvcmRDb3VudD86IG51bWJlcjsgIC8vIFdvcmQgY291bnRcbiAgcmVhZGluZ1RpbWU/OiBudW1iZXI7IC8vIEVzdGltYXRlZCByZWFkaW5nIHRpbWUgaW4gbWludXRlcyAgXG4gIHRhZ3M/OiBzdHJpbmdbXTsgICAgIC8vIE5vdGUgdGFnc1xuICBjb250ZW50UHJldmlldz86IHN0cmluZzsgLy8gU2hvcnQgcHJldmlldyBvZiBjb250ZW50XG4gIGRpc3RhbmNlVG9DZW50ZXI/OiBudW1iZXI7IC8vIERpc3RhbmNlIHRvIGNsdXN0ZXIgY2VudGVyXG59XG5cbi8vIEludGVyZmFjZSBmb3IgY2x1c3RlciB0ZXJtIGluZm9ybWF0aW9uXG5pbnRlcmZhY2UgQ2x1c3RlclRlcm0ge1xuICB0ZXJtOiBzdHJpbmc7XG4gIHNjb3JlOiBudW1iZXI7XG59XG5cbi8vIEludGVyZmFjZSBmb3IgY2x1c3RlciBpbmZvcm1hdGlvblxuaW50ZXJmYWNlIENsdXN0ZXJJbmZvIHtcbiAgW2tleTogc3RyaW5nXTogQ2x1c3RlclRlcm1bXTtcbn1cblxuLy8gSW50ZXJmYWNlIGZvciB0LVNORSByZXN1bHRzXG5pbnRlcmZhY2UgVFNORVJlc3VsdCB7XG4gIHBvaW50czogVFNORVBvaW50W107XG4gIGZlYXR1cmVfbmFtZXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyczogbnVtYmVyO1xuICBjbHVzdGVyX3Rlcm1zOiBDbHVzdGVySW5mbztcbn1cblxuLy8gVFNORVZpc3VhbGl6ZXIgaXMgbm93IGltcG9ydGVkIGZyb20gdmlzdWFsaXphdGlvbi50c1xuXG5jbGFzcyBTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHBsdWdpbjogVmliZUJveVBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBWaWJlQm95UGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7Y29udGFpbmVyRWx9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywge3RleHQ6ICdWaWJlIEJvaSAtIHQtU05FIFNldHRpbmdzJ30pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnUGVycGxleGl0eScpXG4gICAgICAuc2V0RGVzYygnQ29udHJvbHMgdGhlIGJhbGFuY2UgYmV0d2VlbiBsb2NhbCBhbmQgZ2xvYmFsIGFzcGVjdHMgb2YgdGhlIGRhdGEgKHJlY29tbWVuZGVkOiA1LTUwKScpXG4gICAgICAuYWRkU2xpZGVyKHNsaWRlciA9PiBzbGlkZXJcbiAgICAgICAgLnNldExpbWl0cyg1LCAxMDAsIDUpXG4gICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5wZXJwbGV4aXR5KVxuICAgICAgICAuc2V0RHluYW1pY1Rvb2x0aXAoKVxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucGVycGxleGl0eSA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdJdGVyYXRpb25zJylcbiAgICAgIC5zZXREZXNjKCdOdW1iZXIgb2YgaXRlcmF0aW9ucyB0byBydW4gdGhlIGFsZ29yaXRobScpXG4gICAgICAuYWRkU2xpZGVyKHNsaWRlciA9PiBzbGlkZXJcbiAgICAgICAgLnNldExpbWl0cygyNTAsIDIwMDAsIDI1MClcbiAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLml0ZXJhdGlvbnMpXG4gICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pdGVyYXRpb25zID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pKTtcbiAgICAgICAgXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnRXBzaWxvbiAobGVhcm5pbmcgcmF0ZSknKVxuICAgICAgLnNldERlc2MoJ0NvbnRyb2xzIHRoZSBzcGVlZCBvZiBvcHRpbWl6YXRpb24nKVxuICAgICAgLmFkZFNsaWRlcihzbGlkZXIgPT4gc2xpZGVyXG4gICAgICAgIC5zZXRMaW1pdHMoMSwgMTAwLCAxKVxuICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZXBzaWxvbilcbiAgICAgICAgLnNldER5bmFtaWNUb29sdGlwKClcbiAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmVwc2lsb24gPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkpO1xuICB9XG59Il0sIm5hbWVzIjpbIk1vZGFsIiwiQnV0dG9uQ29tcG9uZW50IiwiVGV4dEFyZWFDb21wb25lbnQiLCJURmlsZSIsIk5vdGljZSIsIkl0ZW1WaWV3IiwiUGx1Z2luIiwiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBb0dBO0FBQ08sU0FBUyxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFO0FBQzdELElBQUksU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsT0FBTyxLQUFLLFlBQVksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxVQUFVLE9BQU8sRUFBRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQ2hILElBQUksT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsVUFBVSxPQUFPLEVBQUUsTUFBTSxFQUFFO0FBQy9ELFFBQVEsU0FBUyxTQUFTLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUNuRyxRQUFRLFNBQVMsUUFBUSxD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QUcsS0FBSyxHQUFHLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDNUQsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxNQUFNLEdBQUcsTUFBTSxDQUFDLENBQUM7UUFDaEQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsR0FBRyxLQUFLLEdBQUcsTUFBTSxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDOUUsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztRQUN4QyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sR0FBRyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDOUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztBQUMvQixRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDNUMsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDO0tBQ3RCO0FBRU8sSUFBQSxTQUFTLENBQUMsS0FBZ0IsRUFBQTtBQUNoQyxRQUFBLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxD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
