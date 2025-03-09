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

// Color mode options for visualization
export enum ColorMode {
  Cluster = 'cluster',  // Color by automatically detected clusters
  Tags = 'tags',        // Color by note tags
  Folder = 'folder',    // Color by folder/path
  Created = 'created',  // Color by creation date
  Modified = 'modified' // Color by modification date
}

export class TSNEVisualizer {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private result: TSNEResult | null = null;
  private width = 1600;  // Increased from 800 to 1600
  private height = 700;  // Increased from 600 to 700
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
  private colorMode: ColorMode = ColorMode.Cluster; // Default color mode
  private colorMap: Map<string, string> = new Map(); // For mapping values to colors

  constructor(container: HTMLElement, openCallback: (path: string) => void) {
    this.container = container;
    this.openCallback = openCallback;
    
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.classList.add('tsne-canvas');
    this.canvas.style.border = '1px solid var(--background-modifier-border)';
    
    // Center the canvas in the container
    this.canvas.style.display = 'block';
    this.canvas.style.marginLeft = 'auto';
    this.canvas.style.marginRight = 'auto';
    
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
  private createControlPanel() {
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
        this.setColorMode(mode.value as ColorMode);
      });
      
      buttonGroup.appendChild(button);
    });
    
    controlPanel.appendChild(buttonGroup);
    this.container.appendChild(controlPanel);
  }
  
  // Set the color mode and redraw
  public setColorMode(mode: ColorMode) {
    this.colorMode = mode;
    this.colorMap.clear(); // Reset color mapping
    if (this.result) {
      this.generateColorMap();
      this.draw();
      this.createLegend();
    }
  }
  
  // Create a legend showing what the colors represent
  private createLegend() {
    // Remove any existing legend
    const existingLegend = this.container.querySelector('.tsne-color-legend');
    if (existingLegend) {
      existingLegend.remove();
    }
    
    if (!this.result) return;
    
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
    } else {
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
  private getColorModeLabel(): string {
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
  private getLegendItems(): Array<{color: string, label: string}> {
    if (!this.result) return [];
    
    const items: Array<{color: string, label: string}> = [];
    
    switch (this.colorMode) {
      case ColorMode.Cluster:
        // For clusters, show each cluster ID and the top terms
        this.colorMap.forEach((color, clusterId) => {
          let label = `Cluster ${clusterId}`;
          
          // Add top terms if available
          if (this.result?.cluster_terms && this.result.cluster_terms[clusterId]) {
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
          const formatDate = (date: Date) => {
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
    this.generateColorMap();
    this.draw();
    this.createLegend();
  }
  
  // Generate color mapping based on current color mode
  private generateColorMap() {
    if (!this.result) return;
    
    this.colorMap.clear();
    
    // Color palette for different categories
    const colorPalette = [
      'rgba(255, 99, 132, 1)',    // red
      'rgba(54, 162, 235, 1)',    // blue
      'rgba(255, 206, 86, 1)',    // yellow
      'rgba(75, 192, 192, 1)',    // green
      'rgba(153, 102, 255, 1)',   // purple
      'rgba(255, 159, 64, 1)',    // orange
      'rgba(199, 199, 199, 1)',   // grey
      'rgba(83, 123, 156, 1)',    // steel blue
      'rgba(172, 114, 89, 1)',    // sienna
      'rgba(127, 255, 212, 1)',   // aquamarine
      'rgba(102, 205, 170, 1)',   // medium aquamarine
      'rgba(186, 85, 211, 1)',    // medium orchid
      'rgba(219, 112, 147, 1)',   // pale violet red
      'rgba(143, 188, 143, 1)',   // dark sea green
      'rgba(233, 150, 122, 1)',   // dark salmon
      'rgba(240, 230, 140, 1)',   // khaki
      'rgba(221, 160, 221, 1)',   // plum
      'rgba(176, 196, 222, 1)',   // light steel blue
    ];
    
    // Different mapping strategies based on color mode
    switch (this.colorMode) {
      case ColorMode.Cluster:
        // For cluster mode, use the cluster ID as key
        const clusters = new Set<number>();
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
        const tags = new Set<string>();
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
        const folders = new Set<string>();
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
        const dates: number[] = [];
        
        // Collect all valid date values
        this.result.points.forEach(point => {
          const date = point[dateField];
          if (date) {
            dates.push(date);
          }
        });
        
        if (dates.length === 0) break;
        
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
          const bucketMiddle = new Date((bucketStart + bucketEnd) / 2);
          
          // Store the time range as a key (e.g., "timestamp1-timestamp2")
          const rangeKey = `${bucketStart}-${bucketEnd}`;
          const colorIndex = i % colorPalette.length;
          this.colorMap.set(rangeKey, colorPalette[colorIndex]);
        }
        break;
    }
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
        const labelText = `Cluster ${clusterId}: ${terms}`;
        this.ctx.font = 'bold 14px var(--font-text)'; // Slightly larger font
        
        // Measure text to create background
        const textMetrics = this.ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const textHeight = 18; // Approximation for height
        
        // Draw background for label
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Semi-transparent black background
        this.ctx.fillRect(
          centerX - textWidth / 2 - 5, 
          minY - textHeight - 5, 
          textWidth + 10, 
          textHeight
        );
        
        // Draw text
        this.ctx.fillStyle = '#ffffff'; // Bright white for better visibility
        this.ctx.textAlign = 'center';
        this.ctx.fillText(labelText, centerX, minY - 5);
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
    
    // Draw circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.pointRadius, 0, Math.PI * 2);
    
    // Determine color based on hover state and current color mode
    if (this.hoveredPoint === point) {
      // Hovered points are always highlighted in the accent color
      this.ctx.fillStyle = 'var(--interactive-accent)';
    } else {
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
  private getPointColor(point: TSNEPoint): string {
    // Default color for points with no applicable metadata
    const defaultColor = 'var(--text-muted)';
    
    switch (this.colorMode) {
      case ColorMode.Cluster:
        if (point.cluster === -1) return defaultColor;
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
        
        if (!date) return defaultColor;
        
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
  
  private drawTooltip() {
    if (!this.hoveredPoint || !this.result) return;
    
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
        } else {
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
    
    // Add color mode specific information
    this.ctx.fillText(colorInfo, tooltipX + 10, tooltipY + 80);
  }
}