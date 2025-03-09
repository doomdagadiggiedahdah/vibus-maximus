import { App, ItemView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf } from 'obsidian';
import * as TSNE from 'tsne-js';

// Define the view type for our visualization
const VIEW_TYPE_TSNE = "tsne-visualization";

interface VibeBoySettings {
  perplexity: number;
  iterations: number;
  epsilon: number;
}

const DEFAULT_SETTINGS: VibeBoySettings = {
  perplexity: 30,
  iterations: 1000,
  epsilon: 10
}

// Custom view for t-SNE visualization
class TSNEView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_TSNE;
  }

  getDisplayText(): string {
    return "t-SNE Visualization";
  }

  getIcon(): string {
    return "graph";
  }

  // Set onDrop handler to prevent error
  onDrop(event: DragEvent): void {
    // Not implemented
  }

  // Set onPaneMenu handler to prevent error
  onPaneMenu(menu: any, source: string): void {
    // Not implemented
  }

  async onOpen(): Promise<void> {
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
        const plugin = (this.app as any).plugins.plugins["vibe-boi"] as VibeBoyPlugin;
        plugin.runTSNE();
      });
      
      const selectFolderButton = actionBar.createEl("button", { text: "Select Folder" });
      selectFolderButton.addEventListener("click", () => {
        // TODO: Implement folder selection
        new Notice("Folder selection not implemented yet");
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
  }
}

export default class VibeBoyPlugin extends Plugin {
  settings: VibeBoySettings;

  async onload() {
    await this.loadSettings();

    // Register the custom view
    this.registerView(
      VIEW_TYPE_TSNE,
      (leaf) => new TSNEView(leaf)
    );

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
  }

  onunload() {
    // Clean up resources when the plugin is disabled
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_TSNE);
    if (existing.length) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({
      type: VIEW_TYPE_TSNE,
      active: true,
    });
  }

  async runTSNE() {
    // Process notes and run t-SNE analysis
    new Notice('t-SNE analysis starting...');
    this.updateStatus('Gathering notes...');
    
    // Get all markdown files in the vault
    const files = this.app.vault.getMarkdownFiles();
    
    try {
      // Limit to a reasonable number of files for performance
      const maxFiles = 200;
      const selectedFiles = files.slice(0, maxFiles);
      
      this.updateStatus(`Processing ${selectedFiles.length} notes...`);
      
      // Prepare notes data for the Python server
      const notes = await Promise.all(
        selectedFiles.map(async (file) => {
          const content = await this.app.vault.read(file);
          const stat = await this.app.vault.adapter.stat(file.path);
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
        })
      );
      
      this.updateStatus('Sending data to t-SNE server...');
      
      // Check if Python server is running
      try {
        const healthCheck = await fetch('http://127.0.0.1:1234/health', { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!healthCheck.ok) {
          throw new Error("Python server is not responding");
        }
      } catch (error) {
        throw new Error(
          "Cannot connect to Python server. Make sure the server is running at http://127.0.0.1:1234. " +
          "Run 'python src/python/tsne/server.py' to start it."
        );
      }
      
      // Send to Python server for processing
      this.updateStatus(`Running t-SNE analysis with perplexity=${this.settings.perplexity}, iterations=${this.settings.iterations}...`);
      const response = await fetch('http://127.0.0.1:1234/process', {
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
      
      const result = await response.json();
      
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
      new Notice('t-SNE analysis complete!');
    } catch (error) {
      console.error('Error running t-SNE analysis:', error);
      this.updateStatus(`Error: ${error.message}`);
      new Notice(`t-SNE analysis failed: ${error.message}`);
    }
  }
  
  private updateStatus(message: string) {
    // Find the status element in the view and update it
    const statusElement = document.querySelector('#tsne-status .tsne-status-text');
    if (statusElement) {
      statusElement.textContent = message;
    }
    console.log(`Status: ${message}`);
  }
  
  private async visualizeResult(result: any) {
    // Get or create the visualization view
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_TSNE)[0];
    if (!leaf) {
      // Activate the view if not found
      await this.activateView();
      // Try to get the leaf again
      leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_TSNE)[0];
      
      if (!leaf) {
        console.error('Could not create visualization view');
        return;
      }
    }
    
    // Access the view container
    const view = leaf.view as TSNEView;
    const container = view.contentEl.querySelector('#tsne-container') as HTMLElement;
    if (!container) {
      console.error('Container not found in view');
      return;
    }
    
    // Clear any existing content
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    // Create the visualizer
    const openCallback = (path: string) => {
      // Open the selected note
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        this.app.workspace.getLeaf().openFile(file);
      }
    };
    
    // Create and use the visualizer directly
    const visualizer = new TSNEVisualizer(container, openCallback);
    visualizer.setData(result);
  }
}

// Interface for t-SNE result points
interface TSNEPoint {
  x: number;
  y: number;
  title: string;
  path: string;
  top_terms: string[];
  cluster: number; // Cluster ID (-1 means noise/not clustered)
  
  // Additional metadata
  mtime?: number;      // Last modified time
  ctime?: number;      // Creation time
  wordCount?: number;  // Word count
  readingTime?: number; // Estimated reading time in minutes  
  tags?: string[];     // Note tags
  contentPreview?: string; // Short preview of content
  distanceToCenter?: number; // Distance to cluster center
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

class TSNEVisualizer {
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
    const point = this.hoveredPoint;
    
    // Tooltip content
    const title = point.title;
    const path = point.path;
    const terms = point.top_terms.join(', ');
    
    // Format dates if available
    const formatDate = (timestamp?: number) => {
      if (!timestamp) return 'Unknown';
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
    
    // Define all tooltip sections - more compact layout with grouping
    const sections = [
      { 
        label: 'Title', 
        text: title, 
        font: 'bold 14px sans-serif',
        alwaysShow: true  // Always show title
      },
      {
        label: 'Path', 
        text: path, 
        font: 'italic 11px sans-serif',
        skipIfEmpty: true
      },
      { 
        label: 'Keywords', 
        text: terms, 
        skipIfEmpty: true
      },
      { 
        label: 'Cluster', 
        text: clusterInfo, 
        skipIfEmpty: true
      },
      // Combine tags and stats into one line if both exist
      { 
        label: 'Info', 
        text: [
          tags !== 'No tags' ? tags : null,
          wordCount && readingTime ? `${wordCount} (${readingTime})` : wordCount || ''
        ].filter(Boolean).join(' • '),
        skipIfEmpty: true
      },
      // Combine dates into one line to save space
      { 
        label: 'Dates', 
        text: `Modified: ${modified}${point.ctime ? ` • Created: ${created}` : ''}`,
        font: '11px sans-serif',
        skipIfEmpty: point.mtime === undefined
      },
      // Content preview is shown in a distinct style
      { 
        label: 'Preview', 
        text: preview, 
        font: 'italic 11px sans-serif',
        skipIfEmpty: !point.contentPreview || point.contentPreview.length < 5
      },
      // Show distance info only if it exists
      { 
        label: '', 
        text: distanceInfo, 
        font: '10px sans-serif',
        skipIfEmpty: true 
      }
    ];
    
    // Set proper font for measurements
    this.ctx.font = 'bold 14px sans-serif';
    let tooltipWidth = this.ctx.measureText(title).width + 20; // Add some padding
    
    // Calculate maximum width needed
    sections.forEach(section => {
      if (section.alwaysShow || (!section.skipIfEmpty || section.text)) {
        this.ctx.font = section.font || '12px sans-serif';
        const width = this.ctx.measureText(
          section.label ? `${section.label}: ${section.text}` : section.text
        ).width + 20; // Add padding
        tooltipWidth = Math.max(tooltipWidth, width);
      }
    });
    
    // Limit tooltip width to a reasonable maximum (80% of canvas width)
    tooltipWidth = Math.min(tooltipWidth, this.width * 0.8);
    
    // Calculate tooltip height with more compact line spacing
    const lineHeight = 18; // Slightly smaller line height
    // Count how many sections will be visible
    const visibleSections = sections.filter(s => 
      s.alwaysShow || (!s.skipIfEmpty || s.text)
    ).length;
    
    // More compact tooltip height
    const tooltipHeight = visibleSections * lineHeight + 12; // Less padding
    
    // Position tooltip - ensure it stays fully visible within the canvas
    // If tooltip is too wide, position it to the left of the point instead of the right
    let tooltipX = x + 10;
    if (tooltipX + tooltipWidth > this.width - 10) {
      tooltipX = x - tooltipWidth - 10;
    }
    
    // If tooltip is still out of bounds (rare case with very wide tooltips), center it
    if (tooltipX < 10) {
      tooltipX = Math.max(10, Math.min(this.width - tooltipWidth - 10, x - tooltipWidth/2));
    }
    
    // Position vertically - try to place above the point if it would go off bottom
    let tooltipY = y + 10;
    if (tooltipY + tooltipHeight > this.height - 10) {
      tooltipY = y - tooltipHeight - 10;
    }
    
    // If tooltip is still out of bounds, position it to minimize overflow
    if (tooltipY < 10) {
      tooltipY = 10;
    }
    
    // Final check to ensure tooltip is as visible as possible
    tooltipX = Math.max(10, Math.min(tooltipX, this.width - tooltipWidth - 10));
    tooltipY = Math.max(10, Math.min(tooltipY, this.height - tooltipHeight - 10));
    
    // Draw tooltip background - use a nicer gradient
    const gradient = this.ctx.createLinearGradient(tooltipX, tooltipY, tooltipX, tooltipY + tooltipHeight);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    gradient.addColorStop(1, 'rgba(245, 245, 250, 0.95)');
    this.ctx.fillStyle = gradient;
    this.ctx.strokeStyle = 'rgba(150, 150, 160, 0.8)';
    this.ctx.lineWidth = 1;
    
    this.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 5);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Draw tooltip content
    this.ctx.textAlign = 'left';
    
    // Draw each section
    let currentY = tooltipY + 14;
    sections.forEach(section => {
      if (!section.alwaysShow && (section.skipIfEmpty && !section.text)) return;
      
      this.ctx.font = section.font || '12px sans-serif';
      
      // Use different text colors for different sections
      if (section.label === 'Title') {
        this.ctx.fillStyle = '#333333'; // Dark gray for title
      } else if (section.label === 'Preview') {
        this.ctx.fillStyle = '#666666'; // Medium gray for preview
      } else if (section.label === '') {
        this.ctx.fillStyle = '#999999'; // Light gray for notes
      } else {
        this.ctx.fillStyle = '#444444'; // Normal text color
      }
      
      const text = section.label && section.label !== 'Title'
        ? `${section.label}: ${section.text}`
        : section.text;
      
      // For longer text, handle wrapping
      if (this.ctx.measureText(text).width > tooltipWidth - 20) {
        const words = text.split(' ');
        let line = '';
        
        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i] + ' ';
          const metrics = this.ctx.measureText(testLine);
          
          if (metrics.width > tooltipWidth - 20 && i > 0) {
            this.ctx.fillText(line, tooltipX + 10, currentY);
            line = words[i] + ' ';
            currentY += lineHeight * 0.8; // Smaller spacing for wrapped text
          } else {
            line = testLine;
          }
        }
        
        this.ctx.fillText(line, tooltipX + 10, currentY);
      } else {
        this.ctx.fillText(text, tooltipX + 10, currentY);
      }
      
      currentY += lineHeight;
    });
  }
}

class SettingTab extends PluginSettingTab {
  plugin: VibeBoyPlugin;

  constructor(app: App, plugin: VibeBoyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const {containerEl} = this;
    containerEl.empty();

    containerEl.createEl('h2', {text: 'Vibe Boi - t-SNE Settings'});

    new Setting(containerEl)
      .setName('Perplexity')
      .setDesc('Controls the balance between local and global aspects of the data (recommended: 5-50)')
      .addSlider(slider => slider
        .setLimits(5, 100, 5)
        .setValue(this.plugin.settings.perplexity)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.perplexity = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Iterations')
      .setDesc('Number of iterations to run the algorithm')
      .addSlider(slider => slider
        .setLimits(250, 2000, 250)
        .setValue(this.plugin.settings.iterations)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.iterations = value;
          await this.plugin.saveSettings();
        }));
        
    new Setting(containerEl)
      .setName('Epsilon (learning rate)')
      .setDesc('Controls the speed of optimization')
      .addSlider(slider => slider
        .setLimits(1, 100, 1)
        .setValue(this.plugin.settings.epsilon)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.epsilon = value;
          await this.plugin.saveSettings();
        }));
  }
}