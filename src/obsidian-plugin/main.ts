import { App, ItemView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, TextAreaComponent, ButtonComponent } from 'obsidian';
import * as TSNE from 'tsne-js';
import { TSNEVisualizer } from './visualization';

// Interface for note connections
interface NoteConnection {
  sourceNote: TSNEPoint;
  targetNote: TSNEPoint;
  similarity: number;
  commonTerms: string[];
  clusterTerms: string[];
  reason: string;
  llmDescription?: string;
}

// Modal for displaying and processing suggested links
class SuggestedLinksModal extends Modal {
  private connections: NoteConnection[];
  private plugin: VibeBoyPlugin;
  private selectedConnectionIndex: number = 0;
  private processingConnection: boolean = false;
  
  constructor(app: App, connections: NoteConnection[], plugin: VibeBoyPlugin) {
    super(app);
    this.connections = connections;
    this.plugin = plugin;
  }
  
  async onOpen() {
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
  }
  
  private renderConnectionsList(container: HTMLElement) {
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
  
  private renderConnectionDetails(container: HTMLElement, connection: NoteConnection) {
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
    const generateButton = new ButtonComponent(container)
      .setButtonText('Generate Connection Description')
      .setCta() // Use setCta() instead of setClass with spaces
      .onClick(async () => {
        await this.generateLLMDescription(connection);
      });
    
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
      
      const textArea = new TextAreaComponent(descriptionContainer)
        .setValue(connection.llmDescription)
        .setPlaceholder('Connection description will appear here...');
      
      textArea.inputEl.addClass('llm-description');
      
      // Create button
      const buttonContainer = container.createDiv({ cls: 'button-container' });
      
      new ButtonComponent(buttonContainer)
        .setButtonText('Create Link')
        .setCta() // Use setCta() instead of setClass with spaces
        .onClick(async () => {
          this.createLink(connection, textArea.getValue());
        });
      
      new ButtonComponent(buttonContainer)
        .setButtonText('Edit Description')
        .onClick(() => {
          textArea.setDisabled(false);
          textArea.inputEl.focus();
        });
    }
  }
  
  private selectConnection(index: number) {
    if (index < 0 || index >= this.connections.length) return;
    
    this.selectedConnectionIndex = index;
    const connectionContainer = this.contentEl.querySelector('.connections-container') as HTMLElement;
    const detailsContainer = this.contentEl.querySelector('.connection-details') as HTMLElement;
    
    if (connectionContainer && detailsContainer) {
      this.renderConnectionsList(connectionContainer);
      this.renderConnectionDetails(detailsContainer, this.connections[index]);
    }
  }
  
  private async generateLLMDescription(connection: NoteConnection) {
    if (this.processingConnection) return;
    
    this.processingConnection = true;
    const detailsContainer = this.contentEl.querySelector('.connection-details') as HTMLElement;
    this.renderConnectionDetails(detailsContainer, connection);
    
    try {
      // Fetch source and target note content
      const sourceFile = this.app.vault.getAbstractFileByPath(connection.sourceNote.path);
      const targetFile = this.app.vault.getAbstractFileByPath(connection.targetNote.path);
      
      if (!(sourceFile instanceof TFile) || !(targetFile instanceof TFile)) {
        throw new Error('Could not find note files');
      }
      
      const sourceContent = await this.app.vault.read(sourceFile);
      const targetContent = await this.app.vault.read(targetFile);
      
      // Prepare data for LLM call
      const data = {
        sourceNote: {
          title: connection.sourceNote.title,
          content: sourceContent.substring(0, 1000), // Limit to first 1000 chars
          topTerms: connection.sourceNote.top_terms
        },
        targetNote: {
          title: connection.targetNote.title,
          content: targetContent.substring(0, 1000), // Limit to first 1000 chars
          topTerms: connection.targetNote.top_terms
        },
        commonTerms: connection.commonTerms,
        clusterTerms: connection.clusterTerms,
        reason: connection.reason
      };
      
      // Call the LLM service
      const description = await this.callLLMService(data);
      
      // Update the connection with the generated description
      connection.llmDescription = description;
      
      // Update the UI
      this.processingConnection = false;
      const detailsContainer = this.contentEl.querySelector('.connection-details') as HTMLElement;
      this.renderConnectionDetails(detailsContainer, connection);
      
    } catch (error) {
      this.processingConnection = false;
      console.error('Error generating description:', error);
      new Notice(`Failed to generate description: ${error.message}`);
      
      // Update UI to show error
      const detailsContainer = this.contentEl.querySelector('.connection-details') as HTMLElement;
      this.renderConnectionDetails(detailsContainer, connection);
    }
  }
  
  private async callLLMService(data: any): Promise<string> {
    try {
      // Try to connect to the local LLM API server
      const sourceTitle = data.sourceNote.title;
      const targetTitle = data.targetNote.title;
      const sourceContent = data.sourceNote.content;
      const targetContent = data.targetNote.content;
      const commonTerms = data.commonTerms.join(', ');
      const clusterTerms = data.clusterTerms.join(', ');
      
      // First, try to use the Python server's LLM integration
      const response = await fetch('http://127.0.0.1:1234/generate_connection', {
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
        const result = await response.json();
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
      } else {
        description += `These notes appear to be conceptually related. `;
      }
      
      description += `The note "${targetTitle}" provides complementary information that expands on ideas in "${sourceTitle}"`;
      
      if (clusterTerms) {
        description += `, particularly regarding ${clusterTerms}.`;
      } else {
        description += '.';
      }
      
      return description;
    } catch (error) {
      console.error('Error calling LLM service:', error);
      
      // Return a basic description as fallback
      return `These notes appear to be related in their content. The note "${data.targetNote.title}" complements "${data.sourceNote.title}" with additional relevant information.`;
    }
  }
  
  private async createLink(connection: NoteConnection, description: string) {
    if (!description || description.trim().length === 0) {
      new Notice('Please generate or provide a description for the connection');
      return;
    }
    
    // Close the modal first so it doesn't interfere with the note opening
    this.close();
    
    // Create the link - this will also open the source note
    const success = await this.plugin.createNoteLink(
      connection.sourceNote.path,
      connection.targetNote.path,
      description
    );
    
    if (success) {
      // Open the target note in a split pane after a short delay to let the source note open
      setTimeout(() => {
        try {
          // Also offer option to view the target note
          const targetFile = this.app.vault.getAbstractFileByPath(connection.targetNote.path);
          if (targetFile instanceof TFile) {
            // Create a modal asking if user wants to open the target note
            const modal = new Modal(this.app);
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
            const openButton = new ButtonComponent(buttonContainer)
              .setButtonText(`Open "${connection.targetNote.title}"`)
              .setCta()
              .onClick(() => {
                // Open in a new leaf (split pane)
                const leaf = this.app.workspace.createLeafBySplit(
                  this.app.workspace.activeLeaf, 
                  'vertical'
                );
                
                leaf.openFile(targetFile);
                modal.close();
              });
            
            // Button to stay on the current note
            new ButtonComponent(buttonContainer)
              .setButtonText('Stay on current note')
              .onClick(() => {
                modal.close();
              });
            
            modal.open();
          }
        } catch (error) {
          console.error('Error opening target note:', error);
        }
      }, 500);
    }
  }
  
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

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
      
      // Create parameter control panel
      const paramPanel = header.createEl("div", { cls: "tsne-param-panel" });
      paramPanel.style.marginBottom = "15px";
      paramPanel.style.display = "flex";
      paramPanel.style.flexWrap = "wrap";
      paramPanel.style.gap = "15px";
      paramPanel.style.alignItems = "center";
      
      // Add perplexity slider
      const plugin = (this.app as any).plugins.plugins["vibe-boi"] as VibeBoyPlugin;
      
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
      
      perplexitySlider.addEventListener("input", async (e) => {
        const value = parseInt((e.target as HTMLInputElement).value);
        perplexityValue.textContent = value.toString();
        plugin.settings.perplexity = value;
        await plugin.saveSettings();
      });
      
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
      
      iterationsSlider.addEventListener("input", async (e) => {
        const value = parseInt((e.target as HTMLInputElement).value);
        iterationsValue.textContent = value.toString();
        plugin.settings.iterations = value;
        await plugin.saveSettings();
      });
      
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
        new Notice("Folder selection not implemented yet");
      });
    });
    
    // Add info text
    container.createEl("p", { 
      text: "Run t-SNE analysis to visualize your notes as clusters based on content similarity.",
      cls: "tsne-info"
    });
    
    // Add visualization container
    const tsneContainer = container.createEl("div", { 
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
      
      // Store the result for later use in link suggestions
      this.lastResult = result;
      
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
  
  // Method to suggest links between notes using LLM
  async suggestLinks() {
    if (!this.lastResult || !this.lastResult.points || this.lastResult.points.length === 0) {
      new Notice('Please run t-SNE analysis first to generate note data');
      return;
    }
    
    // Show a notice that we're starting the process
    new Notice('Finding potential note connections...');
    
    try {
      // Find potential connections based on t-SNE proximity and clustering
      const connections = this.findPotentialConnections(this.lastResult);
      
      if (connections.length === 0) {
        new Notice('No strong connections found between notes');
        return;
      }
      
      // Create a modal to display the suggested connections
      const modal = new SuggestedLinksModal(this.app, connections, this);
      modal.open();
      
    } catch (error) {
      console.error('Error suggesting links:', error);
      new Notice(`Error suggesting links: ${error.message}`);
    }
  }
  
  // Store the last result for use in link suggestions
  private lastResult: any = null;
  
  // Find potential connections between notes based on t-SNE results
  private findPotentialConnections(result: any): NoteConnection[] {
    const connections: NoteConnection[] = [];
    const points = result.points as TSNEPoint[];
    
    // 1. Find notes in the same cluster
    const clusterGroups: { [key: number]: TSNEPoint[] } = {};
    
    // Group points by cluster
    for (const point of points) {
      if (point.cluster === -1) continue; // Skip unclustered points
      
      if (!clusterGroups[point.cluster]) {
        clusterGroups[point.cluster] = [];
      }
      
      clusterGroups[point.cluster].push(point);
    }
    
    // For each cluster, find the most central notes
    Object.entries(clusterGroups).forEach(([clusterId, clusterPoints]) => {
      // Only consider clusters with at least 2 notes
      if (clusterPoints.length < 2) return;
      
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
          const distance = Math.sqrt(
            Math.pow(noteA.x - noteB.x, 2) + Math.pow(noteA.y - noteB.y, 2)
          );
          
          if (distance > 0.5) continue; // Skip if too far
          
          // Calculate a similarity score (0-100)
          const similarity = 100 - Math.min(100, distance * 100);
          
          // Find common terms
          const commonTerms = noteA.top_terms.filter(term => 
            noteB.top_terms.includes(term)
          );
          
          connections.push({
            sourceNote: noteA,
            targetNote: noteB,
            similarity: similarity,
            commonTerms: commonTerms,
            clusterTerms: result.cluster_terms?.[clusterId]?.slice(0, 5).map((t: any) => t.term) || [],
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
        if (noteA.cluster !== -1 && noteA.cluster === noteB.cluster) continue;
        
        // Calculate Euclidean distance in t-SNE space
        const distance = Math.sqrt(
          Math.pow(noteA.x - noteB.x, 2) + Math.pow(noteA.y - noteB.y, 2)
        );
        
        // Only consider very close notes
        if (distance > 0.2) continue;
        
        // Calculate a similarity score (0-100)
        const similarity = 100 - Math.min(100, distance * 200);
        
        // Find common terms
        const commonTerms = noteA.top_terms.filter(term => 
          noteB.top_terms.includes(term)
        );
        
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
  async createNoteLink(sourceNotePath: string, targetNotePath: string, description: string) {
    try {
      // Get the source file
      const sourceFile = this.app.vault.getAbstractFileByPath(sourceNotePath);
      if (!(sourceFile instanceof TFile)) {
        throw new Error(`Source file not found: ${sourceNotePath}`);
      }
      
      // Read the file content
      const sourceContent = await this.app.vault.read(sourceFile);
      
      // Generate the link text with the formatted connection description
      const targetFileName = targetNotePath.split('/').pop() || targetNotePath;
      const linkText = `\n\n## Related Notes\n\n- [[${targetFileName}]] - ${description.trim()}\n`;
      
      // Append the link to the source file
      await this.app.vault.modify(sourceFile, sourceContent + linkText);
      
      // Open the source file in a new pane to show the link
      const leaf = this.app.workspace.getLeaf(
        this.app.workspace.activeLeaf !== null && 
        this.app.workspace.activeLeaf !== undefined
      );
      
      await leaf.openFile(sourceFile, { 
        active: true,   // Make the pane active
        eState: {       // Try to scroll to the newly added link
          line: sourceContent.split('\n').length + 2, // Approximate line number of the new link
          focus: true   // Focus the editor
        }
      });
      
      // Show a success notice
      new Notice("Link created successfully! 🔗", 2000);
      
      return true;
    } catch (error) {
      console.error('Error creating note link:', error);
      new Notice(`Failed to create link: ${error.message}`);
      return false;
    }
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

// TSNEVisualizer is now imported from visualization.ts

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