'use strict';

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

exports.TSNEVisualizer = TSNEVisualizer;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlzdWFsaXphdGlvbi01ZTc1NjA1Mi5qcyIsInNvdXJjZXMiOlsic3JjL29ic2lkaWFuLXBsdWdpbi92aXN1YWxpemF0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vLyBJbnRlcmZhY2UgZm9yIHQtU05FIHJlc3VsdCBwb2ludHNcbmludGVyZmFjZSBUU05FUG9pbnQge1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgdGl0bGU6IHN0cmluZztcbiAgcGF0aDogc3RyaW5nO1xuICB0b3BfdGVybXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyOiBudW1iZXI7IC8vIENsdXN0ZXIgSUQgKC0xIG1lYW5zIG5vaXNlL25vdCBjbHVzdGVyZWQpXG59XG5cbi8vIEludGVyZmFjZSBmb3IgY2x1c3RlciB0ZXJtIGluZm9ybWF0aW9uXG5pbnRlcmZhY2UgQ2x1c3RlclRlcm0ge1xuICB0ZXJtOiBzdHJpbmc7XG4gIHNjb3JlOiBudW1iZXI7XG59XG5cbi8vIEludGVyZmFjZSBmb3IgY2x1c3RlciBpbmZvcm1hdGlvblxuaW50ZXJmYWNlIENsdXN0ZXJJbmZvIHtcbiAgW2tleTogc3RyaW5nXTogQ2x1c3RlclRlcm1bXTtcbn1cblxuLy8gSW50ZXJmYWNlIGZvciB0LVNORSByZXN1bHRzXG5pbnRlcmZhY2UgVFNORVJlc3VsdCB7XG4gIHBvaW50czogVFNORVBvaW50W107XG4gIGZlYXR1cmVfbmFtZXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyczogbnVtYmVyO1xuICBjbHVzdGVyX3Rlcm1zOiBDbHVzdGVySW5mbztcbn1cblxuZXhwb3J0IGNsYXNzIFRTTkVWaXN1YWxpemVyIHtcbiAgcHJpdmF0ZSBjb250YWluZXI6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQ7XG4gIHByaXZhdGUgY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG4gIHByaXZhdGUgcmVzdWx0OiBUU05FUmVzdWx0IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgd2lkdGggPSA4MDA7XG4gIHByaXZhdGUgaGVpZ2h0ID0gNjAwO1xuICBwcml2YXRlIHBvaW50UmFkaXVzID0gMTA7XG4gIHByaXZhdGUgbW91c2VYID0gMDtcbiAgcHJpdmF0ZSBtb3VzZVkgPSAwO1xuICBwcml2YXRlIHNjYWxlID0gMTtcbiAgcHJpdmF0ZSBvZmZzZXRYID0gMDtcbiAgcHJpdmF0ZSBvZmZzZXRZID0gMDtcbiAgcHJpdmF0ZSBpc0RyYWdnaW5nID0gZmFsc2U7XG4gIHByaXZhdGUgbGFzdFggPSAwO1xuICBwcml2YXRlIGxhc3RZID0gMDtcbiAgcHJpdmF0ZSBob3ZlcmVkUG9pbnQ6IFRTTkVQb2ludCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIG9wZW5DYWxsYmFjazogKHBhdGg6IHN0cmluZykgPT4gdm9pZDtcblxuICBjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBvcGVuQ2FsbGJhY2s6IChwYXRoOiBzdHJpbmcpID0+IHZvaWQpIHtcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICB0aGlzLm9wZW5DYWxsYmFjayA9IG9wZW5DYWxsYmFjaztcbiAgICBcbiAgICAvLyBDcmVhdGUgY2FudmFzIGVsZW1lbnRcbiAgICB0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIHRoaXMuY2FudmFzLndpZHRoID0gdGhpcy53aWR0aDtcbiAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSB0aGlzLmhlaWdodDtcbiAgICB0aGlzLmNhbnZhcy5jbGFzc0xpc3QuYWRkKCd0c25lLWNhbnZhcycpO1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLmJvcmRlciA9ICcxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpJztcbiAgICBcbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBpZiAoIWNvbnRleHQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGNyZWF0ZSBjYW52YXMgY29udGV4dCcpO1xuICAgIH1cbiAgICB0aGlzLmN0eCA9IGNvbnRleHQ7XG4gICAgXG4gICAgLy8gQWRkIGNhbnZhcyB0byBjb250YWluZXJcbiAgICB0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLmNhbnZhcyk7XG4gICAgXG4gICAgLy8gQWRkIGV2ZW50IGxpc3RlbmVyc1xuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnMoKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhZGRFdmVudExpc3RlbmVycygpIHtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmhhbmRsZU1vdXNlTW92ZS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuaGFuZGxlQ2xpY2suYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignd2hlZWwnLCB0aGlzLmhhbmRsZVdoZWVsLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMuaGFuZGxlTW91c2VEb3duLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmhhbmRsZU1vdXNlVXAuYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsIHRoaXMuaGFuZGxlTW91c2VVcC5iaW5kKHRoaXMpKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZU1vdmUoZTogTW91c2VFdmVudCkge1xuICAgIGNvbnN0IHJlY3QgPSB0aGlzLmNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB0aGlzLm1vdXNlWCA9IGUuY2xpZW50WCAtIHJlY3QubGVmdDtcbiAgICB0aGlzLm1vdXNlWSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xuICAgIFxuICAgIGlmICh0aGlzLmlzRHJhZ2dpbmcpIHtcbiAgICAgIGNvbnN0IGR4ID0gdGhpcy5tb3VzZVggLSB0aGlzLmxhc3RYO1xuICAgICAgY29uc3QgZHkgPSB0aGlzLm1vdXNlWSAtIHRoaXMubGFzdFk7XG4gICAgICBcbiAgICAgIHRoaXMub2Zmc2V0WCArPSBkeDtcbiAgICAgIHRoaXMub2Zmc2V0WSArPSBkeTtcbiAgICAgIFxuICAgICAgdGhpcy5sYXN0WCA9IHRoaXMubW91c2VYO1xuICAgICAgdGhpcy5sYXN0WSA9IHRoaXMubW91c2VZO1xuICAgICAgXG4gICAgICB0aGlzLmRyYXcoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51cGRhdGVIb3ZlcmVkUG9pbnQoKTtcbiAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVDbGljayhlOiBNb3VzZUV2ZW50KSB7XG4gICAgaWYgKHRoaXMuaG92ZXJlZFBvaW50KSB7XG4gICAgICB0aGlzLm9wZW5DYWxsYmFjayh0aGlzLmhvdmVyZWRQb2ludC5wYXRoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgaGFuZGxlV2hlZWwoZTogV2hlZWxFdmVudCkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBcbiAgICBjb25zdCBkZWx0YSA9IGUuZGVsdGFZID4gMCA/IDAuOSA6IDEuMTtcbiAgICB0aGlzLnNjYWxlICo9IGRlbHRhO1xuICAgIFxuICAgIC8vIExpbWl0IHpvb21cbiAgICB0aGlzLnNjYWxlID0gTWF0aC5tYXgoMC4xLCBNYXRoLm1pbig1LCB0aGlzLnNjYWxlKSk7XG4gICAgXG4gICAgdGhpcy5kcmF3KCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgaGFuZGxlTW91c2VEb3duKGU6IE1vdXNlRXZlbnQpIHtcbiAgICB0aGlzLmlzRHJhZ2dpbmcgPSB0cnVlO1xuICAgIHRoaXMubGFzdFggPSB0aGlzLm1vdXNlWDtcbiAgICB0aGlzLmxhc3RZID0gdGhpcy5tb3VzZVk7XG4gICAgdGhpcy5jYW52YXMuc3R5bGUuY3Vyc29yID0gJ2dyYWJiaW5nJztcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZVVwKGU6IE1vdXNlRXZlbnQpIHtcbiAgICB0aGlzLmlzRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS5jdXJzb3IgPSB0aGlzLmhvdmVyZWRQb2ludCA/ICdwb2ludGVyJyA6ICdkZWZhdWx0JztcbiAgfVxuICBcbiAgcHJpdmF0ZSB1cGRhdGVIb3ZlcmVkUG9pbnQoKSB7XG4gICAgaWYgKCF0aGlzLnJlc3VsdCkgcmV0dXJuO1xuICAgIFxuICAgIHRoaXMuaG92ZXJlZFBvaW50ID0gbnVsbDtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgY29uc3QgW3NjcmVlblgsIHNjcmVlblldID0gdGhpcy53b3JsZFRvU2NyZWVuKHBvaW50LngsIHBvaW50LnkpO1xuICAgICAgY29uc3QgZGlzdGFuY2UgPSBNYXRoLnNxcnQoXG4gICAgICAgIE1hdGgucG93KHNjcmVlblggLSB0aGlzLm1vdXNlWCwgMikgKyBcbiAgICAgICAgTWF0aC5wb3coc2NyZWVuWSAtIHRoaXMubW91c2VZLCAyKVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgaWYgKGRpc3RhbmNlIDw9IHRoaXMucG9pbnRSYWRpdXMpIHtcbiAgICAgICAgdGhpcy5ob3ZlcmVkUG9pbnQgPSBwb2ludDtcbiAgICAgICAgdGhpcy5jYW52YXMuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHRoaXMuY2FudmFzLnN0eWxlLmN1cnNvciA9IHRoaXMuaXNEcmFnZ2luZyA/ICdncmFiYmluZycgOiAnZGVmYXVsdCc7XG4gIH1cbiAgXG4gIC8vIENvbnZlcnRzIHdvcmxkIHNwYWNlICh0LVNORSkgY29vcmRpbmF0ZXMgdG8gc2NyZWVuIGNvb3JkaW5hdGVzXG4gIHByaXZhdGUgd29ybGRUb1NjcmVlbih4OiBudW1iZXIsIHk6IG51bWJlcik6IFtudW1iZXIsIG51bWJlcl0ge1xuICAgIC8vIE5vcm1hbGl6ZSB0byBjZW50ZXIgb2Ygc2NyZWVuXG4gICAgY29uc3QgY2VudGVyWCA9IHRoaXMud2lkdGggLyAyO1xuICAgIGNvbnN0IGNlbnRlclkgPSB0aGlzLmhlaWdodCAvIDI7XG4gICAgXG4gICAgLy8gQXBwbHkgc2NhbGUgYW5kIG9mZnNldFxuICAgIGNvbnN0IHNjcmVlblggPSB4ICogdGhpcy5zY2FsZSAqIDEwMCArIGNlbnRlclggKyB0aGlzLm9mZnNldFg7XG4gICAgY29uc3Qgc2NyZWVuWSA9IHkgKiB0aGlzLnNjYWxlICogMTAwICsgY2VudGVyWSArIHRoaXMub2Zmc2V0WTtcbiAgICBcbiAgICByZXR1cm4gW3NjcmVlblgsIHNjcmVlblldO1xuICB9XG4gIFxuICBwdWJsaWMgc2V0RGF0YShyZXN1bHQ6IFRTTkVSZXN1bHQpIHtcbiAgICB0aGlzLnJlc3VsdCA9IHJlc3VsdDtcbiAgICB0aGlzLnJlc2V0VmlldygpO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG4gIFxuICBwcml2YXRlIHJlc2V0VmlldygpIHtcbiAgICB0aGlzLnNjYWxlID0gMTtcbiAgICB0aGlzLm9mZnNldFggPSAwO1xuICAgIHRoaXMub2Zmc2V0WSA9IDA7XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhdygpIHtcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgLy8gQ2xlYXIgY2FudmFzXG4gICAgdGhpcy5jdHguY2xlYXJSZWN0KDAsIDAsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcbiAgICBcbiAgICAvLyBEcmF3IGJhY2tncm91bmQgZ3JpZFxuICAgIHRoaXMuZHJhd0dyaWQoKTtcbiAgICBcbiAgICAvLyBGaW5kIGNsdXN0ZXJzIHVzaW5nIGEgc2ltcGxlIGRpc3RhbmNlIG1ldHJpY1xuICAgIGNvbnN0IGNsdXN0ZXJzID0gdGhpcy5maW5kQ2x1c3RlcnMoKTtcbiAgICBcbiAgICAvLyBEcmF3IGNsdXN0ZXJzIGZpcnN0ICh1bmRlcm5lYXRoIHBvaW50cylcbiAgICB0aGlzLmRyYXdDbHVzdGVycyhjbHVzdGVycyk7XG4gICAgXG4gICAgLy8gRHJhdyBwb2ludHNcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgdGhpcy5kcmF3UG9pbnQocG9pbnQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBEcmF3IHRvb2x0aXAgZm9yIGhvdmVyZWQgcG9pbnRcbiAgICBpZiAodGhpcy5ob3ZlcmVkUG9pbnQpIHtcbiAgICAgIHRoaXMuZHJhd1Rvb2x0aXAoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhd0dyaWQoKSB7XG4gICAgY29uc3QgZ3JpZFNpemUgPSA1MCAqIHRoaXMuc2NhbGU7XG4gICAgXG4gICAgdGhpcy5jdHguc3Ryb2tlU3R5bGUgPSAncmdiYSh2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlci1yZ2IpLCAwLjMpJztcbiAgICB0aGlzLmN0eC5saW5lV2lkdGggPSAxO1xuICAgIFxuICAgIC8vIFZlcnRpY2FsIGxpbmVzXG4gICAgZm9yIChsZXQgeCA9IHRoaXMub2Zmc2V0WCAlIGdyaWRTaXplOyB4IDwgdGhpcy53aWR0aDsgeCArPSBncmlkU2l6ZSkge1xuICAgICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgICB0aGlzLmN0eC5tb3ZlVG8oeCwgMCk7XG4gICAgICB0aGlzLmN0eC5saW5lVG8oeCwgdGhpcy5oZWlnaHQpO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgfVxuICAgIFxuICAgIC8vIEhvcml6b250YWwgbGluZXNcbiAgICBmb3IgKGxldCB5ID0gdGhpcy5vZmZzZXRZICUgZ3JpZFNpemU7IHkgPCB0aGlzLmhlaWdodDsgeSArPSBncmlkU2l6ZSkge1xuICAgICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgICB0aGlzLmN0eC5tb3ZlVG8oMCwgeSk7XG4gICAgICB0aGlzLmN0eC5saW5lVG8odGhpcy53aWR0aCwgeSk7XG4gICAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZmluZENsdXN0ZXJzKCkge1xuICAgIGlmICghdGhpcy5yZXN1bHQpIHJldHVybiBbXTtcbiAgICBcbiAgICAvLyBTaW1wbGUgY2x1c3RlcmluZyBiYXNlZCBvbiBkaXN0YW5jZVxuICAgIGNvbnN0IHBvaW50cyA9IHRoaXMucmVzdWx0LnBvaW50cztcbiAgICBjb25zdCBjbHVzdGVyczogVFNORVBvaW50W11bXSA9IFtdO1xuICAgIGNvbnN0IHZpc2l0ZWQgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgICBcbiAgICBjb25zdCBkaXN0YW5jZVRocmVzaG9sZCA9IDAuMjsgIC8vIEFkanVzdCB0aGlzIHRocmVzaG9sZCBhcyBuZWVkZWRcbiAgICBcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHZpc2l0ZWQuaGFzKGkpKSBjb250aW51ZTtcbiAgICAgIFxuICAgICAgY29uc3QgY2x1c3RlcjogVFNORVBvaW50W10gPSBbcG9pbnRzW2ldXTtcbiAgICAgIHZpc2l0ZWQuYWRkKGkpO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHBvaW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICBpZiAoaSA9PT0gaiB8fCB2aXNpdGVkLmhhcyhqKSkgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBkaXN0YW5jZSA9IE1hdGguc3FydChcbiAgICAgICAgICBNYXRoLnBvdyhwb2ludHNbaV0ueCAtIHBvaW50c1tqXS54LCAyKSArIFxuICAgICAgICAgIE1hdGgucG93KHBvaW50c1tpXS55IC0gcG9pbnRzW2pdLnksIDIpXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICBpZiAoZGlzdGFuY2UgPCBkaXN0YW5jZVRocmVzaG9sZCkge1xuICAgICAgICAgIGNsdXN0ZXIucHVzaChwb2ludHNbal0pO1xuICAgICAgICAgIHZpc2l0ZWQuYWRkKGopO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChjbHVzdGVyLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgY2x1c3RlcnMucHVzaChjbHVzdGVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGNsdXN0ZXJzO1xuICB9XG4gIFxuICBwcml2YXRlIGRyYXdDbHVzdGVycyhjbHVzdGVyczogVFNORVBvaW50W11bXSkge1xuICAgIC8vIFNraXAgaWYgbm8gcmVzdWx0IGRhdGFcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgLy8gQ29sb3IgcGFsZXR0ZSBmb3IgY2x1c3RlcnMgKGV4Y2x1ZGluZyBub2lzZSBwb2ludHMpXG4gICAgY29uc3QgY29sb3JzID0gW1xuICAgICAgeyBmaWxsOiAncmdiYSgyNTUsIDk5LCAxMzIsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDI1NSwgOTksIDEzMiwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoNTQsIDE2MiwgMjM1LCAwLjEpJywgc3Ryb2tlOiAncmdiYSg1NCwgMTYyLCAyMzUsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDI1NSwgMjA2LCA4NiwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMjU1LCAyMDYsIDg2LCAwLjUpJyB9LFxuICAgICAgeyBmaWxsOiAncmdiYSg3NSwgMTkyLCAxOTIsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDc1LCAxOTIsIDE5MiwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoMTUzLCAxMDIsIDI1NSwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMTUzLCAxMDIsIDI1NSwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoMjU1LCAxNTksIDY0LCAwLjEpJywgc3Ryb2tlOiAncmdiYSgyNTUsIDE1OSwgNjQsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDE5OSwgMTk5LCAxOTksIDAuMSknLCBzdHJva2U6ICdyZ2JhKDE5OSwgMTk5LCAxOTksIDAuNSknIH0sXG4gICAgXTtcbiAgICBcbiAgICAvLyBHcm91cCBwb2ludHMgYnkgY2x1c3RlciBJRCBmcm9tIHRoZSBzZXJ2ZXIgcmVzcG9uc2VcbiAgICBjb25zdCBjbHVzdGVyR3JvdXBzOiB7IFtrZXk6IG51bWJlcl06IFRTTkVQb2ludFtdIH0gPSB7fTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgaWYgKHBvaW50LmNsdXN0ZXIgPT09IC0xKSBjb250aW51ZTsgLy8gU2tpcCBub2lzZSBwb2ludHNcbiAgICAgIFxuICAgICAgaWYgKCFjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdKSB7XG4gICAgICAgIGNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0gPSBbXTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXS5wdXNoKHBvaW50KTtcbiAgICB9XG4gICAgXG4gICAgLy8gRHJhdyBlYWNoIGNsdXN0ZXJcbiAgICBPYmplY3QuZW50cmllcyhjbHVzdGVyR3JvdXBzKS5mb3JFYWNoKChbY2x1c3RlcklkLCBwb2ludHNdLCBpbmRleCkgPT4ge1xuICAgICAgLy8gRmluZCB0aGUgY2VudHJvaWQgYW5kIGJvdW5kcyBvZiB0aGUgY2x1c3RlclxuICAgICAgbGV0IG1pblggPSBJbmZpbml0eSwgbWluWSA9IEluZmluaXR5O1xuICAgICAgbGV0IG1heFggPSAtSW5maW5pdHksIG1heFkgPSAtSW5maW5pdHk7XG4gICAgICBsZXQgc3VtWCA9IDAsIHN1bVkgPSAwO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHBvaW50cykge1xuICAgICAgICBjb25zdCBbc2NyZWVuWCwgc2NyZWVuWV0gPSB0aGlzLndvcmxkVG9TY3JlZW4ocG9pbnQueCwgcG9pbnQueSk7XG4gICAgICAgIG1pblggPSBNYXRoLm1pbihtaW5YLCBzY3JlZW5YKTtcbiAgICAgICAgbWluWSA9IE1hdGgubWluKG1pblksIHNjcmVlblkpO1xuICAgICAgICBtYXhYID0gTWF0aC5tYXgobWF4WCwgc2NyZWVuWCk7XG4gICAgICAgIG1heFkgPSBNYXRoLm1heChtYXhZLCBzY3JlZW5ZKTtcbiAgICAgICAgc3VtWCArPSBzY3JlZW5YO1xuICAgICAgICBzdW1ZICs9IHNjcmVlblk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIENhbGN1bGF0ZSBjZW50cm9pZFxuICAgICAgY29uc3QgY2VudGVyWCA9IHN1bVggLyBwb2ludHMubGVuZ3RoO1xuICAgICAgY29uc3QgY2VudGVyWSA9IHN1bVkgLyBwb2ludHMubGVuZ3RoO1xuICAgICAgXG4gICAgICAvLyBBZGQgcGFkZGluZ1xuICAgICAgY29uc3QgcGFkZGluZyA9IDIwO1xuICAgICAgbWluWCAtPSBwYWRkaW5nO1xuICAgICAgbWluWSAtPSBwYWRkaW5nO1xuICAgICAgbWF4WCArPSBwYWRkaW5nO1xuICAgICAgbWF4WSArPSBwYWRkaW5nO1xuICAgICAgXG4gICAgICAvLyBVc2UgY29sb3IgZnJvbSBwYWxldHRlIChjeWNsZSBpZiBtb3JlIGNsdXN0ZXJzIHRoYW4gY29sb3JzKVxuICAgICAgY29uc3QgY29sb3JJbmRleCA9IHBhcnNlSW50KGNsdXN0ZXJJZCkgJSBjb2xvcnMubGVuZ3RoO1xuICAgICAgY29uc3QgY29sb3IgPSBjb2xvcnNbY29sb3JJbmRleF07XG4gICAgICBcbiAgICAgIC8vIERyYXcgYSByb3VuZGVkIHJlY3RhbmdsZSBhcm91bmQgdGhlIGNsdXN0ZXJcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9IGNvbG9yLmZpbGw7XG4gICAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9IGNvbG9yLnN0cm9rZTtcbiAgICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgICBcbiAgICAgIHRoaXMucm91bmRSZWN0KFxuICAgICAgICBtaW5YLCBcbiAgICAgICAgbWluWSwgXG4gICAgICAgIG1heFggLSBtaW5YLCBcbiAgICAgICAgbWF4WSAtIG1pblksIFxuICAgICAgICAxMFxuICAgICAgKTtcbiAgICAgIFxuICAgICAgdGhpcy5jdHguZmlsbCgpO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgICBcbiAgICAgIC8vIERyYXcgY2x1c3RlciBsYWJlbCB3aXRoIHRvcCB0ZXJtcyBpZiBhdmFpbGFibGVcbiAgICAgIGlmICh0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zICYmIHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXSkge1xuICAgICAgICBjb25zdCB0ZXJtcyA9IHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXVxuICAgICAgICAgIC5zbGljZSgwLCAzKSAgLy8gVGFrZSB0b3AgMyB0ZXJtc1xuICAgICAgICAgIC5tYXAodCA9PiB0LnRlcm0pXG4gICAgICAgICAgLmpvaW4oJywgJyk7XG4gICAgICAgIFxuICAgICAgICAvLyBEcmF3IGEgbGFiZWwgd2l0aCBjbHVzdGVyIElEIGFuZCB0b3AgdGVybXNcbiAgICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3ZhcigtLXRleHQtbm9ybWFsKSc7XG4gICAgICAgIHRoaXMuY3R4LmZvbnQgPSAnYm9sZCAxMnB4IHZhcigtLWZvbnQtdGV4dCknO1xuICAgICAgICB0aGlzLmN0eC50ZXh0QWxpZ24gPSAnY2VudGVyJztcbiAgICAgICAgdGhpcy5jdHguZmlsbFRleHQoYENsdXN0ZXIgJHtjbHVzdGVySWR9OiAke3Rlcm1zfWAsIGNlbnRlclgsIG1pblkgLSA1KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBcbiAgcHJpdmF0ZSByb3VuZFJlY3QoeDogbnVtYmVyLCB5OiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCByYWRpdXM6IG51bWJlcikge1xuICAgIHRoaXMuY3R4LmJlZ2luUGF0aCgpO1xuICAgIHRoaXMuY3R4Lm1vdmVUbyh4ICsgcmFkaXVzLCB5KTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCArIHdpZHRoIC0gcmFkaXVzLCB5KTtcbiAgICB0aGlzLmN0eC5hcmNUbyh4ICsgd2lkdGgsIHksIHggKyB3aWR0aCwgeSArIHJhZGl1cywgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCArIHdpZHRoLCB5ICsgaGVpZ2h0IC0gcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5hcmNUbyh4ICsgd2lkdGgsIHkgKyBoZWlnaHQsIHggKyB3aWR0aCAtIHJhZGl1cywgeSArIGhlaWdodCwgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCArIHJhZGl1cywgeSArIGhlaWdodCk7XG4gICAgdGhpcy5jdHguYXJjVG8oeCwgeSArIGhlaWdodCwgeCwgeSArIGhlaWdodCAtIHJhZGl1cywgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCwgeSArIHJhZGl1cyk7XG4gICAgdGhpcy5jdHguYXJjVG8oeCwgeSwgeCArIHJhZGl1cywgeSwgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5jbG9zZVBhdGgoKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBkcmF3UG9pbnQocG9pbnQ6IFRTTkVQb2ludCkge1xuICAgIGNvbnN0IFt4LCB5XSA9IHRoaXMud29ybGRUb1NjcmVlbihwb2ludC54LCBwb2ludC55KTtcbiAgICBcbiAgICAvLyBDb2xvciBwYWxldHRlIGZvciBjbHVzdGVyc1xuICAgIGNvbnN0IGNsdXN0ZXJDb2xvcnMgPSBbXG4gICAgICAncmdiYSgyNTUsIDk5LCAxMzIsIDEpJywgICAgLy8gcmVkXG4gICAgICAncmdiYSg1NCwgMTYyLCAyMzUsIDEpJywgICAgLy8gYmx1ZVxuICAgICAgJ3JnYmEoMjU1LCAyMDYsIDg2LCAxKScsICAgIC8vIHllbGxvd1xuICAgICAgJ3JnYmEoNzUsIDE5MiwgMTkyLCAxKScsICAgIC8vIGdyZWVuXG4gICAgICAncmdiYSgxNTMsIDEwMiwgMjU1LCAxKScsICAgLy8gcHVycGxlXG4gICAgICAncmdiYSgyNTUsIDE1OSwgNjQsIDEpJywgICAgLy8gb3JhbmdlXG4gICAgICAncmdiYSgxOTksIDE5OSwgMTk5LCAxKScsICAgLy8gZ3JleVxuICAgIF07XG4gICAgXG4gICAgLy8gRHJhdyBjaXJjbGVcbiAgICB0aGlzLmN0eC5iZWdpblBhdGgoKTtcbiAgICB0aGlzLmN0eC5hcmMoeCwgeSwgdGhpcy5wb2ludFJhZGl1cywgMCwgTWF0aC5QSSAqIDIpO1xuICAgIFxuICAgIC8vIERldGVybWluZSBjb2xvciBiYXNlZCBvbiBob3ZlciBzdGF0ZSBhbmQgY2x1c3RlclxuICAgIGlmICh0aGlzLmhvdmVyZWRQb2ludCA9PT0gcG9pbnQpIHtcbiAgICAgIC8vIEhvdmVyZWQgcG9pbnRzIGFyZSBhbHdheXMgaGlnaGxpZ2h0ZWQgaW4gdGhlIGFjY2VudCBjb2xvclxuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3ZhcigtLWludGVyYWN0aXZlLWFjY2VudCknO1xuICAgIH0gZWxzZSBpZiAocG9pbnQuY2x1c3RlciA9PT0gLTEpIHtcbiAgICAgIC8vIE5vaXNlIHBvaW50cyAobm90IGluIGEgY2x1c3RlcikgYXJlIGdyZXlcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS10ZXh0LW11dGVkKSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFBvaW50cyBpbiBjbHVzdGVycyB1c2UgdGhlIGNsdXN0ZXIgY29sb3IgcGFsZXR0ZVxuICAgICAgY29uc3QgY29sb3JJbmRleCA9IHBvaW50LmNsdXN0ZXIgJSBjbHVzdGVyQ29sb3JzLmxlbmd0aDtcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9IGNsdXN0ZXJDb2xvcnNbY29sb3JJbmRleF07XG4gICAgfVxuICAgIFxuICAgIHRoaXMuY3R4LmZpbGwoKTtcbiAgICBcbiAgICAvLyBBZGQgYm9yZGVyIHRvIHBvaW50c1xuICAgIHRoaXMuY3R4LnN0cm9rZVN0eWxlID0gJ3ZhcigtLWJhY2tncm91bmQtcHJpbWFyeSknO1xuICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgXG4gICAgLy8gRHJhdyB0aXRsZSBpZiBub3QgaG92ZXJlZCAoaG92ZXJlZCBzaG93cyBpbiB0b29sdGlwKVxuICAgIGlmICh0aGlzLmhvdmVyZWRQb2ludCAhPT0gcG9pbnQpIHtcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS10ZXh0LW5vcm1hbCknO1xuICAgICAgdGhpcy5jdHguZm9udCA9ICcxMnB4IHZhcigtLWZvbnQtdGV4dCknO1xuICAgICAgdGhpcy5jdHgudGV4dEFsaWduID0gJ2NlbnRlcic7XG4gICAgICB0aGlzLmN0eC5maWxsVGV4dChwb2ludC50aXRsZSwgeCwgeSAtIHRoaXMucG9pbnRSYWRpdXMgLSA1KTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhd1Rvb2x0aXAoKSB7XG4gICAgaWYgKCF0aGlzLmhvdmVyZWRQb2ludCB8fCAhdGhpcy5yZXN1bHQpIHJldHVybjtcbiAgICBcbiAgICBjb25zdCBbeCwgeV0gPSB0aGlzLndvcmxkVG9TY3JlZW4odGhpcy5ob3ZlcmVkUG9pbnQueCwgdGhpcy5ob3ZlcmVkUG9pbnQueSk7XG4gICAgXG4gICAgLy8gVG9vbHRpcCBjb250ZW50XG4gICAgY29uc3QgdGl0bGUgPSB0aGlzLmhvdmVyZWRQb2ludC50aXRsZTtcbiAgICBjb25zdCBwYXRoID0gdGhpcy5ob3ZlcmVkUG9pbnQucGF0aDtcbiAgICBjb25zdCB0ZXJtcyA9IHRoaXMuaG92ZXJlZFBvaW50LnRvcF90ZXJtcy5qb2luKCcsICcpO1xuICAgIFxuICAgIC8vIEdldCBjbHVzdGVyIGluZm9ybWF0aW9uXG4gICAgbGV0IGNsdXN0ZXJJbmZvID0gJ05vdCBjbHVzdGVyZWQnO1xuICAgIGlmICh0aGlzLmhvdmVyZWRQb2ludC5jbHVzdGVyICE9PSAtMSkge1xuICAgICAgY29uc3QgY2x1c3RlcklkID0gdGhpcy5ob3ZlcmVkUG9pbnQuY2x1c3RlcjtcbiAgICAgIFxuICAgICAgLy8gR2V0IGNsdXN0ZXIgdGVybXMgaWYgYXZhaWxhYmxlXG4gICAgICBsZXQgY2x1c3RlclRlcm1zID0gJyc7XG4gICAgICBpZiAodGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtcyAmJiB0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zW2NsdXN0ZXJJZF0pIHtcbiAgICAgICAgY2x1c3RlclRlcm1zID0gdGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtc1tjbHVzdGVySWRdXG4gICAgICAgICAgLnNsaWNlKDAsIDMpIC8vIFRha2UgdG9wIDMgdGVybXNcbiAgICAgICAgICAubWFwKHQgPT4gdC50ZXJtKVxuICAgICAgICAgIC5qb2luKCcsICcpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjbHVzdGVySW5mbyA9IGBDbHVzdGVyICR7Y2x1c3RlcklkfTogJHtjbHVzdGVyVGVybXN9YDtcbiAgICB9XG4gICAgXG4gICAgLy8gUHJlcGFyZSB0ZXh0XG4gICAgdGhpcy5jdHguZm9udCA9ICdib2xkIDE0cHggdmFyKC0tZm9udC10ZXh0KSc7XG4gICAgY29uc3QgdGl0bGVXaWR0aCA9IHRoaXMuY3R4Lm1lYXN1cmVUZXh0KHRpdGxlKS53aWR0aDtcbiAgICBcbiAgICB0aGlzLmN0eC5mb250ID0gJzEycHggdmFyKC0tZm9udC10ZXh0KSc7XG4gICAgY29uc3QgcGF0aFdpZHRoID0gdGhpcy5jdHgubWVhc3VyZVRleHQocGF0aCkud2lkdGg7XG4gICAgY29uc3QgdGVybXNXaWR0aCA9IHRoaXMuY3R4Lm1lYXN1cmVUZXh0KGBLZXl3b3JkczogJHt0ZXJtc31gKS53aWR0aDtcbiAgICBjb25zdCBjbHVzdGVyV2lkdGggPSB0aGlzLmN0eC5tZWFzdXJlVGV4dChgQ2x1c3RlcjogJHtjbHVzdGVySW5mb31gKS53aWR0aDtcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgdG9vbHRpcCBkaW1lbnNpb25zXG4gICAgY29uc3QgdG9vbHRpcFdpZHRoID0gTWF0aC5tYXgodGl0bGVXaWR0aCwgcGF0aFdpZHRoLCB0ZXJtc1dpZHRoLCBjbHVzdGVyV2lkdGgpICsgMjA7XG4gICAgY29uc3QgdG9vbHRpcEhlaWdodCA9IDk1OyAvLyBJbmNyZWFzZWQgaGVpZ2h0IGZvciB0aGUgY2x1c3RlciBpbmZvXG4gICAgY29uc3QgdG9vbHRpcFggPSBNYXRoLm1pbih4ICsgMTAsIHRoaXMud2lkdGggLSB0b29sdGlwV2lkdGggLSAxMCk7XG4gICAgY29uc3QgdG9vbHRpcFkgPSBNYXRoLm1pbih5IC0gMTAsIHRoaXMuaGVpZ2h0IC0gdG9vbHRpcEhlaWdodCAtIDEwKTtcbiAgICBcbiAgICAvLyBEcmF3IHRvb2x0aXAgYmFja2dyb3VuZFxuICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS1iYWNrZ3JvdW5kLXByaW1hcnkpJztcbiAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9ICd2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlciknO1xuICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgXG4gICAgdGhpcy5yb3VuZFJlY3QodG9vbHRpcFgsIHRvb2x0aXBZLCB0b29sdGlwV2lkdGgsIHRvb2x0aXBIZWlnaHQsIDUpO1xuICAgIHRoaXMuY3R4LmZpbGwoKTtcbiAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICBcbiAgICAvLyBEcmF3IHRvb2x0aXAgY29udGVudFxuICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS10ZXh0LW5vcm1hbCknO1xuICAgIHRoaXMuY3R4LnRleHRBbGlnbiA9ICdsZWZ0JztcbiAgICBcbiAgICB0aGlzLmN0eC5mb250ID0gJ2JvbGQgMTRweCB2YXIoLS1mb250LXRleHQpJztcbiAgICB0aGlzLmN0eC5maWxsVGV4dCh0aXRsZSwgdG9vbHRpcFggKyAxMCwgdG9vbHRpcFkgKyAyMCk7XG4gICAgXG4gICAgdGhpcy5jdHguZm9udCA9ICcxMnB4IHZhcigtLWZvbnQtdGV4dCknO1xuICAgIHRoaXMuY3R4LmZpbGxUZXh0KHBhdGgsIHRvb2x0aXBYICsgMTAsIHRvb2x0aXBZICsgNDApO1xuICAgIHRoaXMuY3R4LmZpbGxUZXh0KGBLZXl3b3JkczogJHt0ZXJtc31gLCB0b29sdGlwWCArIDEwLCB0b29sdGlwWSArIDYwKTtcbiAgICBcbiAgICAvLyBBZGQgY2x1c3RlciBpbmZvcm1hdGlvblxuICAgIHRoaXMuY3R4LmZpbGxUZXh0KGBDbHVzdGVyOiAke2NsdXN0ZXJJbmZvfWAsIHRvb2x0aXBYICsgMTAsIHRvb2x0aXBZICsgODApO1xuICB9XG59Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O01BK0JhLGNBQWMsQ0FBQTtJQW1CekIsV0FBWSxDQUFBLFNBQXNCLEVBQUUsWUFBb0MsRUFBQTtRQWZoRSxJQUFNLENBQUEsTUFBQSxHQUFzQixJQUFJLENBQUM7UUFDakMsSUFBSyxDQUFBLEtBQUEsR0FBRyxHQUFHLENBQUM7UUFDWixJQUFNLENBQUEsTUFBQSxHQUFHLEdBQUcsQ0FBQztRQUNiLElBQVcsQ0FBQSxXQUFBLEdBQUcsRUFBRSxDQUFDO1FBQ2pCLElBQU0sQ0FBQSxNQUFBLEdBQUcsQ0FBQyxDQUFDO1FBQ1gsSUFBTSxDQUFBLE1BQUEsR0FBRyxDQUFDLENBQUM7UUFDWCxJQUFLLENBQUEsS0FBQSxHQUFHLENBQUMsQ0FBQztRQUNWLElBQU8sQ0FBQSxPQUFBLEdBQUcsQ0FBQyxDQUFDO1FBQ1osSUFBTyxDQUFBLE9BQUEsR0FBRyxDQUFDLENBQUM7UUFDWixJQUFVLENBQUEsVUFBQSxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFLLENBQUEsS0FBQSxHQUFHLENBQUMsQ0FBQztRQUNWLElBQUssQ0FBQSxLQUFBLEdBQUcsQ0FBQyxDQUFDO1FBQ1YsSUFBWSxDQUFBLFlBQUEsR0FBcUIsSUFBSSxDQUFDO0FBSTVDLFFBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7QUFDM0IsUUFBQSxJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQzs7UUFHakMs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QUcsS0FBSyxHQUFHLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDNUQsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxNQUFNLEdBQUcsTUFBTSxDQUFDLENBQUM7UUFDaEQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsR0FBRyxLQUFLLEdBQUcsTUFBTSxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDOUUsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztRQUN4QyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sR0FBRyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDOUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztBQUMvQixRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDNUMsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDO0tBQ3RCO0FBRU8sSUFBQSxTQUFTLENBQUMsS0FBZ0IsRUFBQTtBQUNoQyxRQUFBLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFHcEQsUUFBQSxNQUFNLGFBQWEsR0FBRztZQUNwQix1QkFBdUI7WUFDdkIsdUJBQXVCO1lBQ3ZCLHVCQUF1QjtZQUN2Qix1QkFBdUI7WUFDdkIsd0JBQXdCO1lBQ3hCLHVCQUF1QjtBQUN2QixZQUFBLHdCQUF3QjtTQUN6QixDQUFDOztBQUdGLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNyQixJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7O0FBR3JELFFBQUEsSUFBSSxJQUFJLENBQUMsWUFBWSxLQUFLLEtBQUssRUFBRTs7QUFFL0IsWUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRywyQkFBMkIsQ0FBQztBQUNsRCxTQUFBO0FBQU0sYUFBQSxJQUFJLEtBQUssQ0FBQyxPQUFPLEtBQUssQ0FBQyxDQUFDLEVBQUU7O0FBRS9CLFlBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsbUJBQW1CLENBQUM7QUFDMUMsU0FBQTtBQUFNLGFBQUE7O1lBRUwsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLE9BQU8sR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDO1lBQ3hELElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNoRCxTQUFBO0FBRUQsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDOztBQUdoQixRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxHQUFHLDJCQUEyQixDQUFDO0FBQ25ELFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQzs7QUFHbEIsUUFBQSxJQUFJLElBQUksQ0FBQyxZQUFZLEtBQUssS0FBSyxFQUFFO0FBQy9CLFlBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsb0JBQW9CLENBQUM7QUFDMUMsWUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyx1QkFBdUIsQ0FBQztBQUN4QyxZQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztBQUM5QixZQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzdELFNBQUE7S0FDRjtJQUVPLFdBQVcsR0FBQTtRQUNqQixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNO1lBQUUsT0FBTztRQUUvQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFHNUUsUUFBQSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQztBQUN0QyxRQUFBLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDO0FBQ3BDLFFBQUEsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDOztRQUdyRCxJQUFJLFdBQVcsR0FBRyxlQUFlLENBQUM7UUFDbEMsSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsRUFBRTtBQUNwQyxZQUFBLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDOztZQUc1QyxJQUFJLFlBQVksR0FBRyxFQUFFLENBQUM7QUFDdEIsWUFBQSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUNyRSxZQUFZLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDO0FBQ2hELHFCQUFBLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO3FCQUNYLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQztxQkFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2YsYUFBQTtBQUVELFlBQUEsV0FBVyxHQUFHLENBQVcsUUFBQSxFQUFBLFNBQVMsQ0FBSyxFQUFBLEVBQUEsWUFBWSxFQUFFLENBQUM7QUFDdkQsU0FBQTs7QUFHRCxRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLDRCQUE0QixDQUFDO0FBQzdDLFFBQUEsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBRXJELFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsdUJBQXVCLENBQUM7QUFDeEMsUUFBQSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFDbkQsUUFBQSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFBLFVBQUEsRUFBYSxLQUFLLENBQUEsQ0FBRSxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3BFLFFBQUEsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQSxTQUFBLEVBQVksV0FBVyxDQUFBLENBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQzs7QUFHM0UsUUFBQSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLFlBQVksQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUNwRixRQUFBLE1BQU0sYUFBYSxHQUFHLEVBQUUsQ0FBQztBQUN6QixRQUFBLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQztBQUNsRSxRQUFBLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLGFBQWEsR0FBRyxFQUFFLENBQUMsQ0FBQzs7QUFHcEUsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRywyQkFBMkIsQ0FBQztBQUNqRCxRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxHQUFHLG1DQUFtQyxDQUFDO0FBQzNELFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBRXZCLFFBQUEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDbkUsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ2hCLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQzs7QUFHbEIsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxvQkFBb0IsQ0FBQztBQUMxQyxRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQztBQUU1QixRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLDRCQUE0QixDQUFDO0FBQzdDLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLFFBQVEsR0FBRyxFQUFFLEVBQUUsUUFBUSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBRXZELFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsdUJBQXVCLENBQUM7QUFDeEMsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxHQUFHLEVBQUUsRUFBRSxRQUFRLEdBQUcsRUFBRSxDQUFDLENBQUM7QUFDdEQsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEtBQUssQ0FBQSxDQUFFLEVBQUUsUUFBUSxHQUFHLEVBQUUsRUFBRSxRQUFRLEdBQUcsRUFBRSxDQUFDLENBQUM7O0FBR3RFLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsWUFBWSxXQUFXLENBQUEsQ0FBRSxFQUFFLFFBQVEsR0FBRyxFQUFFLEVBQUUsUUFBUSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0tBQzVFO0FBQ0Y7Ozs7In0=
