import { TFile } from 'obsidian';

// Interface for t-SNE result points
interface TSNEPoint {
  x: number;
  y: number;
  title: string;
  path: string;
  top_terms: string[];
  cluster: number; // Cluster ID (-1 means noise/not clustered)
}

// Interface for cluster term information
interface ClusterTerm {
  term: string;
  score: number;
}

// Interface for cluster information
interface ClusterInfo {
  [key: string]: ClusterTerm[];
}

// Interface for t-SNE results
interface TSNEResult {
  points: TSNEPoint[];
  feature_names: string[];
  clusters: number;
  cluster_terms: ClusterInfo;
}

export class TSNEVisualizer {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private result: TSNEResult | null = null;
  private width = 800;
  private height = 600;
  private pointRadius = 10;
  private mouseX = 0;
  private mouseY = 0;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private hoveredPoint: TSNEPoint | null = null;
  private openCallback: (path: string) => void;

  constructor(container: HTMLElement, openCallback: (path: string) => void) {
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
  
  private addEventListeners() {
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('click', this.handleClick.bind(this));
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
  }
  
  private handleMouseMove(e: MouseEvent) {
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
    } else {
      this.updateHoveredPoint();
      this.draw();
    }
  }
  
  private handleClick(e: MouseEvent) {
    if (this.hoveredPoint) {
      this.openCallback(this.hoveredPoint.path);
    }
  }
  
  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.scale *= delta;
    
    // Limit zoom
    this.scale = Math.max(0.1, Math.min(5, this.scale));
    
    this.draw();
  }
  
  private handleMouseDown(e: MouseEvent) {
    this.isDragging = true;
    this.lastX = this.mouseX;
    this.lastY = this.mouseY;
    this.canvas.style.cursor = 'grabbing';
  }
  
  private handleMouseUp(e: MouseEvent) {
    this.isDragging = false;
    this.canvas.style.cursor = this.hoveredPoint ? 'pointer' : 'default';
  }
  
  private updateHoveredPoint() {
    if (!this.result) return;
    
    this.hoveredPoint = null;
    
    for (const point of this.result.points) {
      const [screenX, screenY] = this.worldToScreen(point.x, point.y);
      const distance = Math.sqrt(
        Math.pow(screenX - this.mouseX, 2) + 
        Math.pow(screenY - this.mouseY, 2)
      );
      
      if (distance <= this.pointRadius) {
        this.hoveredPoint = point;
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }
    
    this.canvas.style.cursor = this.isDragging ? 'grabbing' : 'default';
  }
  
  // Converts world space (t-SNE) coordinates to screen coordinates
  private worldToScreen(x: number, y: number): [number, number] {
    // Normalize to center of screen
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    // Apply scale and offset
    const screenX = x * this.scale * 100 + centerX + this.offsetX;
    const screenY = y * this.scale * 100 + centerY + this.offsetY;
    
    return [screenX, screenY];
  }
  
  public setData(result: TSNEResult) {
    this.result = result;
    this.resetView();
    this.draw();
  }
  
  private resetView() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
  }
  
  private draw() {
    if (!this.result) return;
    
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
  
  private drawGrid() {
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
  
  private findClusters() {
    if (!this.result) return [];
    
    // Simple clustering based on distance
    const points = this.result.points;
    const clusters: TSNEPoint[][] = [];
    const visited = new Set<number>();
    
    const distanceThreshold = 0.2;  // Adjust this threshold as needed
    
    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;
      
      const cluster: TSNEPoint[] = [points[i]];
      visited.add(i);
      
      for (let j = 0; j < points.length; j++) {
        if (i === j || visited.has(j)) continue;
        
        const distance = Math.sqrt(
          Math.pow(points[i].x - points[j].x, 2) + 
          Math.pow(points[i].y - points[j].y, 2)
        );
        
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
  
  private drawClusters(clusters: TSNEPoint[][]) {
    // Skip if no result data
    if (!this.result) return;
    
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
    const clusterGroups: { [key: number]: TSNEPoint[] } = {};
    
    for (const point of this.result.points) {
      if (point.cluster === -1) continue; // Skip noise points
      
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
      const centerY = sumY / points.length;
      
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
      
      this.roundRect(
        minX, 
        minY, 
        maxX - minX, 
        maxY - minY, 
        10
      );
      
      this.ctx.fill();
      this.ctx.stroke();
      
      // Draw cluster label with top terms if available
      if (this.result.cluster_terms && this.result.cluster_terms[clusterId]) {
        const terms = this.result.cluster_terms[clusterId]
          .slice(0, 3)  // Take top 3 terms
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
  
  private roundRect(x: number, y: number, width: number, height: number, radius: number) {
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
  
  private drawPoint(point: TSNEPoint) {
    const [x, y] = this.worldToScreen(point.x, point.y);
    
    // Color palette for clusters
    const clusterColors = [
      'rgba(255, 99, 132, 1)',    // red
      'rgba(54, 162, 235, 1)',    // blue
      'rgba(255, 206, 86, 1)',    // yellow
      'rgba(75, 192, 192, 1)',    // green
      'rgba(153, 102, 255, 1)',   // purple
      'rgba(255, 159, 64, 1)',    // orange
      'rgba(199, 199, 199, 1)',   // grey
    ];
    
    // Draw circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.pointRadius, 0, Math.PI * 2);
    
    // Determine color based on hover state and cluster
    if (this.hoveredPoint === point) {
      // Hovered points are always highlighted in the accent color
      this.ctx.fillStyle = 'var(--interactive-accent)';
    } else if (point.cluster === -1) {
      // Noise points (not in a cluster) are grey
      this.ctx.fillStyle = 'var(--text-muted)';
    } else {
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
  
  private drawTooltip() {
    if (!this.hoveredPoint || !this.result) return;
    
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