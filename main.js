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
                const runButton = actionBar.createEl("button", { text: "Run Analysis", cls: "mod-cta" });
                runButton.addEventListener("click", () => {
                    // Get the plugin instance and run t-SNE
                    const plugin = this.app.plugins.plugins["vibe-boi"];
                    plugin.runTSNE();
                });
                const suggestLinksButton = actionBar.createEl("button", { text: "Suggest Links", cls: "mod-cta" });
                suggestLinksButton.addEventListener("click", () => {
                    // Get the plugin instance and suggest links
                    const plugin = this.app.plugins.plugins["vibe-boi"];
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
                // Debugging: Draw a rectangle at the text position to verify positioning
                /*this.ctx.strokeStyle = 'red';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(
                  centerX - textWidth / 2,
                  minY - textHeight - 10,
                  textWidth,
                  textHeight
                );*/
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
        // Define all tooltip sections - more compact layout with grouping
        const sections = [
            {
                label: 'Title',
                text: title,
                font: 'bold 14px sans-serif',
                alwaysShow: true // Always show title
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
                const width = this.ctx.measureText(section.label ? `${section.label}: ${section.text}` : section.text).width + 20; // Add padding
                tooltipWidth = Math.max(tooltipWidth, width);
            }
        });
        // Limit tooltip width to a reasonable maximum (80% of canvas width)
        tooltipWidth = Math.min(tooltipWidth, this.width * 0.8);
        // Calculate tooltip height with more compact line spacing
        const lineHeight = 18; // Slightly smaller line height
        // Count how many sections will be visible
        const visibleSections = sections.filter(s => s.alwaysShow || (!s.skipIfEmpty || s.text)).length;
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
            tooltipX = Math.max(10, Math.min(this.width - tooltipWidth - 10, x - tooltipWidth / 2));
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
            if (!section.alwaysShow && (section.skipIfEmpty && !section.text))
                return;
            this.ctx.font = section.font || '12px sans-serif';
            // Use different text colors for different sections
            if (section.label === 'Title') {
                this.ctx.fillStyle = '#333333'; // Dark gray for title
            }
            else if (section.label === 'Preview') {
                this.ctx.fillStyle = '#666666'; // Medium gray for preview
            }
            else if (section.label === '') {
                this.ctx.fillStyle = '#999999'; // Light gray for notes
            }
            else {
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
                    }
                    else {
                        line = testLine;
                    }
                }
                this.ctx.fillText(line, tooltipX + 10, currentY);
            }
            else {
                this.ctx.fillText(text, tooltipX + 10, currentY);
            }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9vYnNpZGlhbi1wbHVnaW4vbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuLyogZ2xvYmFsIFJlZmxlY3QsIFByb21pc2UsIFN1cHByZXNzZWRFcnJvciwgU3ltYm9sLCBJdGVyYXRvciAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19lc0RlY29yYXRlKGN0b3IsIGRlc2NyaXB0b3JJbiwgZGVjb3JhdG9ycywgY29udGV4dEluLCBpbml0aWFsaXplcnMsIGV4dHJhSW5pdGlhbGl6ZXJzKSB7XHJcbiAgICBmdW5jdGlvbiBhY2NlcHQoZikgeyBpZiAoZiAhPT0gdm9pZCAwICYmIHR5cGVvZiBmICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGdW5jdGlvbiBleHBlY3RlZFwiKTsgcmV0dXJuIGY7IH1cclxuICAgIHZhciBraW5kID0gY29udGV4dEluLmtpbmQsIGtleSA9IGtpbmQgPT09IFwiZ2V0dGVyXCIgPyBcImdldFwiIDoga2luZCA9PT0gXCJzZXR0ZXJcIiA/IFwic2V0XCIgOiBcInZhbHVlXCI7XHJcbiAgICB2YXIgdGFyZ2V0ID0gIWRlc2NyaXB0b3JJbiAmJiBjdG9yID8gY29udGV4dEluW1wic3RhdGljXCJdID8gY3RvciA6IGN0b3IucHJvdG90eXBlIDogbnVsbDtcclxuICAgIHZhciBkZXNjcmlwdG9yID0gZGVzY3JpcHRvckluIHx8ICh0YXJnZXQgPyBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgY29udGV4dEluLm5hbWUpIDoge30pO1xyXG4gICAgdmFyIF8sIGRvbmUgPSBmYWxzZTtcclxuICAgIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgICAgdmFyIGNvbnRleHQgPSB7fTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbikgY29udGV4dFtwXSA9IHAgPT09IFwiYWNjZXNzXCIgPyB7fSA6IGNvbnRleHRJbltwXTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbi5hY2Nlc3MpIGNvbnRleHQuYWNjZXNzW3BdID0gY29udGV4dEluLmFjY2Vzc1twXTtcclxuICAgICAgICBjb250ZXh0LmFkZEluaXRpYWxpemVyID0gZnVuY3Rpb24gKGYpIHsgaWYgKGRvbmUpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgYWRkIGluaXRpYWxpemVycyBhZnRlciBkZWNvcmF0aW9uIGhhcyBjb21wbGV0ZWRcIik7IGV4dHJhSW5pdGlhbGl6ZXJzLnB1c2goYWNjZXB0KGYgfHwgbnVsbCkpOyB9O1xyXG4gICAgICAgIHZhciByZXN1bHQgPSAoMCwgZGVjb3JhdG9yc1tpXSkoa2luZCA9PT0gXCJhY2Nlc3NvclwiID8geyBnZXQ6IGRlc2NyaXB0b3IuZ2V0LCBzZXQ6IGRlc2NyaXB0b3Iuc2V0IH0gOiBkZXNjcmlwdG9yW2tleV0sIGNvbnRleHQpO1xyXG4gICAgICAgIGlmIChraW5kID09PSBcImFjY2Vzc29yXCIpIHtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gdm9pZCAwKSBjb250aW51ZTtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCB8fCB0eXBlb2YgcmVzdWx0ICE9PSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkXCIpO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuZ2V0KSkgZGVzY3JpcHRvci5nZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuc2V0KSkgZGVzY3JpcHRvci5zZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuaW5pdCkpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChfID0gYWNjZXB0KHJlc3VsdCkpIHtcclxuICAgICAgICAgICAgaWYgKGtpbmQgPT09IFwiZmllbGRcIikgaW5pdGlhbGl6ZXJzLnVuc2hpZnQoXyk7XHJcbiAgICAgICAgICAgIGVsc2UgZGVzY3JpcHRvcltrZXldID0gXztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAodGFyZ2V0KSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBjb250ZXh0SW4ubmFtZSwgZGVzY3JpcHRvcik7XHJcbiAgICBkb25lID0gdHJ1ZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3J1bkluaXRpYWxpemVycyh0aGlzQXJnLCBpbml0aWFsaXplcnMsIHZhbHVlKSB7XHJcbiAgICB2YXIgdXNlVmFsdWUgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5pdGlhbGl6ZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFsdWUgPSB1c2VWYWx1ZSA/IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcsIHZhbHVlKSA6IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHVzZVZhbHVlID8gdmFsdWUgOiB2b2lkIDA7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wcm9wS2V5KHgpIHtcclxuICAgIHJldHVybiB0eXBlb2YgeCA9PT0gXCJzeW1ib2xcIiA/IHggOiBcIlwiLmNvbmNhdCh4KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NldEZ1bmN0aW9uTmFtZShmLCBuYW1lLCBwcmVmaXgpIHtcclxuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gXCJzeW1ib2xcIikgbmFtZSA9IG5hbWUuZGVzY3JpcHRpb24gPyBcIltcIi5jb25jYXQobmFtZS5kZXNjcmlwdGlvbiwgXCJdXCIpIDogXCJcIjtcclxuICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkoZiwgXCJuYW1lXCIsIHsgY29uZmlndXJhYmxlOiB0cnVlLCB2YWx1ZTogcHJlZml4ID8gXCJcIi5jb25jYXQocHJlZml4LCBcIiBcIiwgbmFtZSkgOiBuYW1lIH0pO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpIHtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5tZXRhZGF0YSA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gUmVmbGVjdC5tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0ZXIodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19nZW5lcmF0b3IodGhpc0FyZywgYm9keSkge1xyXG4gICAgdmFyIF8gPSB7IGxhYmVsOiAwLCBzZW50OiBmdW5jdGlvbigpIHsgaWYgKHRbMF0gJiAxKSB0aHJvdyB0WzFdOyByZXR1cm4gdFsxXTsgfSwgdHJ5czogW10sIG9wczogW10gfSwgZiwgeSwgdCwgZyA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBJdGVyYXRvciA9PT0gXCJmdW5jdGlvblwiID8gSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSk7XHJcbiAgICByZXR1cm4gZy5uZXh0ID0gdmVyYigwKSwgZ1tcInRocm93XCJdID0gdmVyYigxKSwgZ1tcInJldHVyblwiXSA9IHZlcmIoMiksIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoZyAmJiAoZyA9IDAsIG9wWzBdICYmIChfID0gMCkpLCBfKSB0cnkge1xyXG4gICAgICAgICAgICBpZiAoZiA9IDEsIHkgJiYgKHQgPSBvcFswXSAmIDIgPyB5W1wicmV0dXJuXCJdIDogb3BbMF0gPyB5W1widGhyb3dcIl0gfHwgKCh0ID0geVtcInJldHVyblwiXSkgJiYgdC5jYWxsKHkpLCAwKSA6IHkubmV4dCkgJiYgISh0ID0gdC5jYWxsKHksIG9wWzFdKSkuZG9uZSkgcmV0dXJuIHQ7XHJcbiAgICAgICAgICAgIGlmICh5ID0gMCwgdCkgb3AgPSBbb3BbMF0gJiAyLCB0LnZhbHVlXTtcclxuICAgICAgICAgICAgc3dpdGNoIChvcFswXSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAwOiBjYXNlIDE6IHQgPSBvcDsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDQ6IF8ubGFiZWwrKzsgcmV0dXJuIHsgdmFsdWU6IG9wWzFdLCBkb25lOiBmYWxzZSB9O1xyXG4gICAgICAgICAgICAgICAgY2FzZSA1OiBfLmxhYmVsKys7IHkgPSBvcFsxXTsgb3AgPSBbMF07IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA3OiBvcCA9IF8ub3BzLnBvcCgpOyBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBpZiAoISh0ID0gXy50cnlzLCB0ID0gdC5sZW5ndGggPiAwICYmIHRbdC5sZW5ndGggLSAxXSkgJiYgKG9wWzBdID09PSA2IHx8IG9wWzBdID09PSAyKSkgeyBfID0gMDsgY29udGludWU7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDMgJiYgKCF0IHx8IChvcFsxXSA+IHRbMF0gJiYgb3BbMV0gPCB0WzNdKSkpIHsgXy5sYWJlbCA9IG9wWzFdOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gNiAmJiBfLmxhYmVsIDwgdFsxXSkgeyBfLmxhYmVsID0gdFsxXTsgdCA9IG9wOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ICYmIF8ubGFiZWwgPCB0WzJdKSB7IF8ubGFiZWwgPSB0WzJdOyBfLm9wcy5wdXNoKG9wKTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodFsyXSkgXy5vcHMucG9wKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvcCA9IGJvZHkuY2FsbCh0aGlzQXJnLCBfKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7IG9wID0gWzYsIGVdOyB5ID0gMDsgfSBmaW5hbGx5IHsgZiA9IHQgPSAwOyB9XHJcbiAgICAgICAgaWYgKG9wWzBdICYgNSkgdGhyb3cgb3BbMV07IHJldHVybiB7IHZhbHVlOiBvcFswXSA/IG9wWzFdIDogdm9pZCAwLCBkb25lOiB0cnVlIH07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19jcmVhdGVCaW5kaW5nID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihtLCBrKTtcclxuICAgIGlmICghZGVzYyB8fCAoXCJnZXRcIiBpbiBkZXNjID8gIW0uX19lc01vZHVsZSA6IGRlc2Mud3JpdGFibGUgfHwgZGVzYy5jb25maWd1cmFibGUpKSB7XHJcbiAgICAgICAgZGVzYyA9IHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfTtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBrMiwgZGVzYyk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tLCBwYWNrKSB7XHJcbiAgICBpZiAocGFjayB8fCBhcmd1bWVudHMubGVuZ3RoID09PSAyKSBmb3IgKHZhciBpID0gMCwgbCA9IGZyb20ubGVuZ3RoLCBhcjsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmIChhciB8fCAhKGkgaW4gZnJvbSkpIHtcclxuICAgICAgICAgICAgaWYgKCFhcikgYXIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tLCAwLCBpKTtcclxuICAgICAgICAgICAgYXJbaV0gPSBmcm9tW2ldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0by5jb25jYXQoYXIgfHwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSkpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdCh2KSB7XHJcbiAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIF9fYXdhaXQgPyAodGhpcy52ID0gdiwgdGhpcykgOiBuZXcgX19hd2FpdCh2KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNHZW5lcmF0b3IodGhpc0FyZywgX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIGcgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSksIGksIHEgPSBbXTtcclxuICAgIHJldHVybiBpID0gT2JqZWN0LmNyZWF0ZSgodHlwZW9mIEFzeW5jSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEFzeW5jSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSksIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiwgYXdhaXRSZXR1cm4pLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiBhd2FpdFJldHVybihmKSB7IHJldHVybiBmdW5jdGlvbiAodikgeyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZiwgcmVqZWN0KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlmIChnW25dKSB7IGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IGlmIChmKSBpW25dID0gZihpW25dKTsgfSB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogZmFsc2UgfSA6IGYgPyBmKHYpIDogdjsgfSA6IGY7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNWYWx1ZXMobykge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBtID0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sIGk7XHJcbiAgICByZXR1cm4gbSA/IG0uY2FsbChvKSA6IChvID0gdHlwZW9mIF9fdmFsdWVzID09PSBcImZ1bmN0aW9uXCIgPyBfX3ZhbHVlcyhvKSA6IG9bU3ltYm9sLml0ZXJhdG9yXSgpLCBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaSk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaVtuXSA9IG9bbl0gJiYgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgdiA9IG9bbl0odiksIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHYuZG9uZSwgdi52YWx1ZSk7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCBkLCB2KSB7IFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGZ1bmN0aW9uKHYpIHsgcmVzb2x2ZSh7IHZhbHVlOiB2LCBkb25lOiBkIH0pOyB9LCByZWplY3QpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdykge1xyXG4gICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkgeyBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29va2VkLCBcInJhd1wiLCB7IHZhbHVlOiByYXcgfSk7IH0gZWxzZSB7IGNvb2tlZC5yYXcgPSByYXc7IH1cclxuICAgIHJldHVybiBjb29rZWQ7XHJcbn07XHJcblxyXG52YXIgX19zZXRNb2R1bGVEZWZhdWx0ID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgXCJkZWZhdWx0XCIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgdmFsdWU6IHYgfSk7XHJcbn0pIDogZnVuY3Rpb24obywgdikge1xyXG4gICAgb1tcImRlZmF1bHRcIl0gPSB2O1xyXG59O1xyXG5cclxudmFyIG93bktleXMgPSBmdW5jdGlvbihvKSB7XHJcbiAgICBvd25LZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgfHwgZnVuY3Rpb24gKG8pIHtcclxuICAgICAgICB2YXIgYXIgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBrIGluIG8pIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgaykpIGFyW2FyLmxlbmd0aF0gPSBrO1xyXG4gICAgICAgIHJldHVybiBhcjtcclxuICAgIH07XHJcbiAgICByZXR1cm4gb3duS2V5cyhvKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrID0gb3duS2V5cyhtb2QpLCBpID0gMDsgaSA8IGsubGVuZ3RoOyBpKyspIGlmIChrW2ldICE9PSBcImRlZmF1bHRcIikgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrW2ldKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRJbihzdGF0ZSwgcmVjZWl2ZXIpIHtcclxuICAgIGlmIChyZWNlaXZlciA9PT0gbnVsbCB8fCAodHlwZW9mIHJlY2VpdmVyICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiByZWNlaXZlciAhPT0gXCJmdW5jdGlvblwiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgJ2luJyBvcGVyYXRvciBvbiBub24tb2JqZWN0XCIpO1xyXG4gICAgcmV0dXJuIHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgPT09IHN0YXRlIDogc3RhdGUuaGFzKHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlKGVudiwgdmFsdWUsIGFzeW5jKSB7XHJcbiAgICBpZiAodmFsdWUgIT09IG51bGwgJiYgdmFsdWUgIT09IHZvaWQgMCkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgZXhwZWN0ZWQuXCIpO1xyXG4gICAgICAgIHZhciBkaXNwb3NlLCBpbm5lcjtcclxuICAgICAgICBpZiAoYXN5bmMpIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuYXN5bmNEaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jRGlzcG9zZSBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICAgICAgICAgIGRpc3Bvc2UgPSB2YWx1ZVtTeW1ib2wuYXN5bmNEaXNwb3NlXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGRpc3Bvc2UgPT09IHZvaWQgMCkge1xyXG4gICAgICAgICAgICBpZiAoIVN5bWJvbC5kaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmRpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmRpc3Bvc2VdO1xyXG4gICAgICAgICAgICBpZiAoYXN5bmMpIGlubmVyID0gZGlzcG9zZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkaXNwb3NlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3Qgbm90IGRpc3Bvc2FibGUuXCIpO1xyXG4gICAgICAgIGlmIChpbm5lcikgZGlzcG9zZSA9IGZ1bmN0aW9uKCkgeyB0cnkgeyBpbm5lci5jYWxsKHRoaXMpOyB9IGNhdGNoIChlKSB7IHJldHVybiBQcm9taXNlLnJlamVjdChlKTsgfSB9O1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgdmFsdWU6IHZhbHVlLCBkaXNwb3NlOiBkaXNwb3NlLCBhc3luYzogYXN5bmMgfSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChhc3luYykge1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgYXN5bmM6IHRydWUgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcblxyXG59XHJcblxyXG52YXIgX1N1cHByZXNzZWRFcnJvciA9IHR5cGVvZiBTdXBwcmVzc2VkRXJyb3IgPT09IFwiZnVuY3Rpb25cIiA/IFN1cHByZXNzZWRFcnJvciA6IGZ1bmN0aW9uIChlcnJvciwgc3VwcHJlc3NlZCwgbWVzc2FnZSkge1xyXG4gICAgdmFyIGUgPSBuZXcgRXJyb3IobWVzc2FnZSk7XHJcbiAgICByZXR1cm4gZS5uYW1lID0gXCJTdXBwcmVzc2VkRXJyb3JcIiwgZS5lcnJvciA9IGVycm9yLCBlLnN1cHByZXNzZWQgPSBzdXBwcmVzc2VkLCBlO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGlzcG9zZVJlc291cmNlcyhlbnYpIHtcclxuICAgIGZ1bmN0aW9uIGZhaWwoZSkge1xyXG4gICAgICAgIGVudi5lcnJvciA9IGVudi5oYXNFcnJvciA/IG5ldyBfU3VwcHJlc3NlZEVycm9yKGUsIGVudi5lcnJvciwgXCJBbiBlcnJvciB3YXMgc3VwcHJlc3NlZCBkdXJpbmcgZGlzcG9zYWwuXCIpIDogZTtcclxuICAgICAgICBlbnYuaGFzRXJyb3IgPSB0cnVlO1xyXG4gICAgfVxyXG4gICAgdmFyIHIsIHMgPSAwO1xyXG4gICAgZnVuY3Rpb24gbmV4dCgpIHtcclxuICAgICAgICB3aGlsZSAociA9IGVudi5zdGFjay5wb3AoKSkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFyLmFzeW5jICYmIHMgPT09IDEpIHJldHVybiBzID0gMCwgZW52LnN0YWNrLnB1c2gociksIFByb21pc2UucmVzb2x2ZSgpLnRoZW4obmV4dCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoci5kaXNwb3NlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHIuZGlzcG9zZS5jYWxsKHIudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChyLmFzeW5jKSByZXR1cm4gcyB8PSAyLCBQcm9taXNlLnJlc29sdmUocmVzdWx0KS50aGVuKG5leHQsIGZ1bmN0aW9uKGUpIHsgZmFpbChlKTsgcmV0dXJuIG5leHQoKTsgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHMgfD0gMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgZmFpbChlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocyA9PT0gMSkgcmV0dXJuIGVudi5oYXNFcnJvciA/IFByb21pc2UucmVqZWN0KGVudi5lcnJvcikgOiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgICBpZiAoZW52Lmhhc0Vycm9yKSB0aHJvdyBlbnYuZXJyb3I7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV4dCgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24ocGF0aCwgcHJlc2VydmVKc3gpIHtcclxuICAgIGlmICh0eXBlb2YgcGF0aCA9PT0gXCJzdHJpbmdcIiAmJiAvXlxcLlxcLj9cXC8vLnRlc3QocGF0aCkpIHtcclxuICAgICAgICByZXR1cm4gcGF0aC5yZXBsYWNlKC9cXC4odHN4KSR8KCg/OlxcLmQpPykoKD86XFwuW14uL10rPyk/KVxcLihbY21dPyl0cyQvaSwgZnVuY3Rpb24gKG0sIHRzeCwgZCwgZXh0LCBjbSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHN4ID8gcHJlc2VydmVKc3ggPyBcIi5qc3hcIiA6IFwiLmpzXCIgOiBkICYmICghZXh0IHx8ICFjbSkgPyBtIDogKGQgKyBleHQgKyBcIi5cIiArIGNtLnRvTG93ZXJDYXNlKCkgKyBcImpzXCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBhdGg7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIF9fZXh0ZW5kczogX19leHRlbmRzLFxyXG4gICAgX19hc3NpZ246IF9fYXNzaWduLFxyXG4gICAgX19yZXN0OiBfX3Jlc3QsXHJcbiAgICBfX2RlY29yYXRlOiBfX2RlY29yYXRlLFxyXG4gICAgX19wYXJhbTogX19wYXJhbSxcclxuICAgIF9fZXNEZWNvcmF0ZTogX19lc0RlY29yYXRlLFxyXG4gICAgX19ydW5Jbml0aWFsaXplcnM6IF9fcnVuSW5pdGlhbGl6ZXJzLFxyXG4gICAgX19wcm9wS2V5OiBfX3Byb3BLZXksXHJcbiAgICBfX3NldEZ1bmN0aW9uTmFtZTogX19zZXRGdW5jdGlvbk5hbWUsXHJcbiAgICBfX21ldGFkYXRhOiBfX21ldGFkYXRhLFxyXG4gICAgX19hd2FpdGVyOiBfX2F3YWl0ZXIsXHJcbiAgICBfX2dlbmVyYXRvcjogX19nZW5lcmF0b3IsXHJcbiAgICBfX2NyZWF0ZUJpbmRpbmc6IF9fY3JlYXRlQmluZGluZyxcclxuICAgIF9fZXhwb3J0U3RhcjogX19leHBvcnRTdGFyLFxyXG4gICAgX192YWx1ZXM6IF9fdmFsdWVzLFxyXG4gICAgX19yZWFkOiBfX3JlYWQsXHJcbiAgICBfX3NwcmVhZDogX19zcHJlYWQsXHJcbiAgICBfX3NwcmVhZEFycmF5czogX19zcHJlYWRBcnJheXMsXHJcbiAgICBfX3NwcmVhZEFycmF5OiBfX3NwcmVhZEFycmF5LFxyXG4gICAgX19hd2FpdDogX19hd2FpdCxcclxuICAgIF9fYXN5bmNHZW5lcmF0b3I6IF9fYXN5bmNHZW5lcmF0b3IsXHJcbiAgICBfX2FzeW5jRGVsZWdhdG9yOiBfX2FzeW5jRGVsZWdhdG9yLFxyXG4gICAgX19hc3luY1ZhbHVlczogX19hc3luY1ZhbHVlcyxcclxuICAgIF9fbWFrZVRlbXBsYXRlT2JqZWN0OiBfX21ha2VUZW1wbGF0ZU9iamVjdCxcclxuICAgIF9faW1wb3J0U3RhcjogX19pbXBvcnRTdGFyLFxyXG4gICAgX19pbXBvcnREZWZhdWx0OiBfX2ltcG9ydERlZmF1bHQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0OiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldDogX19jbGFzc1ByaXZhdGVGaWVsZFNldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRJbjogX19jbGFzc1ByaXZhdGVGaWVsZEluLFxyXG4gICAgX19hZGREaXNwb3NhYmxlUmVzb3VyY2U6IF9fYWRkRGlzcG9zYWJsZVJlc291cmNlLFxyXG4gICAgX19kaXNwb3NlUmVzb3VyY2VzOiBfX2Rpc3Bvc2VSZXNvdXJjZXMsXHJcbiAgICBfX3Jld3JpdGVSZWxhdGl2ZUltcG9ydEV4dGVuc2lvbjogX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24sXHJcbn07XHJcbiIsImltcG9ydCB7IEFwcCwgSXRlbVZpZXcsIE1vZGFsLCBOb3RpY2UsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgVEZpbGUsIFdvcmtzcGFjZUxlYWYsIFRleHRBcmVhQ29tcG9uZW50LCBCdXR0b25Db21wb25lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgKiBhcyBUU05FIGZyb20gJ3RzbmUtanMnO1xuXG4vLyBJbnRlcmZhY2UgZm9yIG5vdGUgY29ubmVjdGlvbnNcbmludGVyZmFjZSBOb3RlQ29ubmVjdGlvbiB7XG4gIHNvdXJjZU5vdGU6IFRTTkVQb2ludDtcbiAgdGFyZ2V0Tm90ZTogVFNORVBvaW50O1xuICBzaW1pbGFyaXR5OiBudW1iZXI7XG4gIGNvbW1vblRlcm1zOiBzdHJpbmdbXTtcbiAgY2x1c3RlclRlcm1zOiBzdHJpbmdbXTtcbiAgcmVhc29uOiBzdHJpbmc7XG4gIGxsbURlc2NyaXB0aW9uPzogc3RyaW5nO1xufVxuXG4vLyBNb2RhbCBmb3IgZGlzcGxheWluZyBhbmQgcHJvY2Vzc2luZyBzdWdnZXN0ZWQgbGlua3NcbmNsYXNzIFN1Z2dlc3RlZExpbmtzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIHByaXZhdGUgY29ubmVjdGlvbnM6IE5vdGVDb25uZWN0aW9uW107XG4gIHByaXZhdGUgcGx1Z2luOiBWaWJlQm95UGx1Z2luO1xuICBwcml2YXRlIHNlbGVjdGVkQ29ubmVjdGlvbkluZGV4OiBudW1iZXIgPSAwO1xuICBwcml2YXRlIHByb2Nlc3NpbmdDb25uZWN0aW9uOiBib29sZWFuID0gZmFsc2U7XG4gIFxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgY29ubmVjdGlvbnM6IE5vdGVDb25uZWN0aW9uW10sIHBsdWdpbjogVmliZUJveVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5jb25uZWN0aW9ucyA9IGNvbm5lY3Rpb25zO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG4gIFxuICBhc3luYyBvbk9wZW4oKSB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgXG4gICAgLy8gU2V0IG1vZGFsIHRpdGxlXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1N1Z2dlc3RlZCBOb3RlIENvbm5lY3Rpb25zJyB9KTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IFxuICAgICAgdGV4dDogJ0JlbG93IGFyZSBwb3RlbnRpYWwgY29ubmVjdGlvbnMgYmV0d2VlbiBub3RlcyBiYXNlZCBvbiBjb250ZW50IHNpbWlsYXJpdHkuICcgK1xuICAgICAgICAgICAgJ1NlbGVjdCBhIGNvbm5lY3Rpb24gYW5kIGdlbmVyYXRlIGEgZGVzY3JpcHRpb24gdG8gY3JlYXRlIGEgbGluayBiZXR3ZWVuIHRoZSBub3Rlcy4nXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQ3JlYXRlIGNvbnRhaW5lciBmb3IgY29ubmVjdGlvbnMgbGlzdFxuICAgIGNvbnN0IGNvbm5lY3Rpb25zQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Nvbm5lY3Rpb25zLWNvbnRhaW5lcicgfSk7XG4gICAgXG4gICAgLy8gQ3JlYXRlIGNvbnRhaW5lciBmb3Igc2VsZWN0ZWQgY29ubmVjdGlvbiBkZXRhaWxzXG4gICAgY29uc3QgZGV0YWlsc0NvbnRhaW5lciA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdjb25uZWN0aW9uLWRldGFpbHMnIH0pO1xuICAgIFxuICAgIC8vIEFkZCBzb21lIENTU1xuICAgIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBzdHlsZS50ZXh0Q29udGVudCA9IGBcbiAgICAgIC5jb25uZWN0aW9ucy1jb250YWluZXIge1xuICAgICAgICBtYXgtaGVpZ2h0OiAxNTBweDtcbiAgICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTVweDtcbiAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICB9XG4gICAgICAuY29ubmVjdGlvbi1pdGVtIHtcbiAgICAgICAgcGFkZGluZzogOHB4IDEycHg7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyKTtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLWl0ZW06aG92ZXIge1xuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1iYWNrZ3JvdW5kLXNlY29uZGFyeSk7XG4gICAgICB9XG4gICAgICAuY29ubmVjdGlvbi1pdGVtLnNlbGVjdGVkIHtcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KTtcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtb24tYWNjZW50KTtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLWRldGFpbHMge1xuICAgICAgICBwYWRkaW5nOiAxMHB4O1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlcik7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTVweDtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLXN0YXRzIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuICAgICAgfVxuICAgICAgLmdlbmVyYXRlLWJ1dHRvbiB7XG4gICAgICAgIG1hcmdpbi10b3A6IDEwcHg7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7XG4gICAgICB9XG4gICAgICAubGxtLWRlc2NyaXB0aW9uIHtcbiAgICAgICAgbWFyZ2luLXRvcDogMTBweDtcbiAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgIG1pbi1oZWlnaHQ6IDEwMHB4O1xuICAgICAgfVxuICAgICAgLmJ1dHRvbi1jb250YWluZXIge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgIG1hcmdpbi10b3A6IDE1cHg7XG4gICAgICB9XG4gICAgYDtcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICBcbiAgICAvLyBSZW5kZXIgY29ubmVjdGlvbnMgbGlzdFxuICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbnNMaXN0KGNvbm5lY3Rpb25zQ29udGFpbmVyKTtcbiAgICBcbiAgICAvLyBSZW5kZXIgZGV0YWlscyBmb3IgdGhlIGZpcnN0IGNvbm5lY3Rpb25cbiAgICB0aGlzLnJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKGRldGFpbHNDb250YWluZXIsIHRoaXMuY29ubmVjdGlvbnNbMF0pO1xuICAgIFxuICAgIC8vIEZvY3VzIHRoZSBmaXJzdCBjb25uZWN0aW9uXG4gICAgdGhpcy5zZWxlY3RDb25uZWN0aW9uKDApO1xuICB9XG4gIFxuICBwcml2YXRlIHJlbmRlckNvbm5lY3Rpb25zTGlzdChjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgXG4gICAgdGhpcy5jb25uZWN0aW9ucy5mb3JFYWNoKChjb25uZWN0aW9uLCBpbmRleCkgPT4ge1xuICAgICAgY29uc3QgaXRlbSA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICdjb25uZWN0aW9uLWl0ZW0nIH0pO1xuICAgICAgaWYgKGluZGV4ID09PSB0aGlzLnNlbGVjdGVkQ29ubmVjdGlvbkluZGV4KSB7XG4gICAgICAgIGl0ZW0uYWRkQ2xhc3MoJ3NlbGVjdGVkJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNvdXJjZVRpdGxlID0gY29ubmVjdGlvbi5zb3VyY2VOb3RlLnRpdGxlO1xuICAgICAgY29uc3QgdGFyZ2V0VGl0bGUgPSBjb25uZWN0aW9uLnRhcmdldE5vdGUudGl0bGU7XG4gICAgICBjb25zdCBzaW1pbGFyaXR5ID0gTWF0aC5yb3VuZChjb25uZWN0aW9uLnNpbWlsYXJpdHkpO1xuICAgICAgXG4gICAgICBpdGVtLmNyZWF0ZUVsKCdkaXYnLCB7IHRleHQ6IGAke3NvdXJjZVRpdGxlfSDihpQgJHt0YXJnZXRUaXRsZX0gKCR7c2ltaWxhcml0eX0lIHNpbWlsYXJpdHkpYCB9KTtcbiAgICAgIFxuICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgdGhpcy5zZWxlY3RDb25uZWN0aW9uKGluZGV4KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIFxuICBwcml2YXRlIHJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGNvbm5lY3Rpb246IE5vdGVDb25uZWN0aW9uKSB7XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgXG4gICAgY29uc3Qgc291cmNlTm90ZSA9IGNvbm5lY3Rpb24uc291cmNlTm90ZTtcbiAgICBjb25zdCB0YXJnZXROb3RlID0gY29ubmVjdGlvbi50YXJnZXROb3RlO1xuICAgIFxuICAgIC8vIE5vdGUgdGl0bGVzIGFuZCBwYXRoc1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6IGBDb25uZWN0aW9uOiAke3NvdXJjZU5vdGUudGl0bGV9IOKGlCAke3RhcmdldE5vdGUudGl0bGV9YCB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYFNvdXJjZTogJHtzb3VyY2VOb3RlLnBhdGh9YCB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYFRhcmdldDogJHt0YXJnZXROb3RlLnBhdGh9YCB9KTtcbiAgICBcbiAgICAvLyBTdGF0c1xuICAgIGNvbnN0IHN0YXRzRGl2ID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ2Nvbm5lY3Rpb24tc3RhdHMnIH0pO1xuICAgIHN0YXRzRGl2LmNyZWF0ZUVsKCdkaXYnLCB7IHRleHQ6IGBTaW1pbGFyaXR5OiAke01hdGgucm91bmQoY29ubmVjdGlvbi5zaW1pbGFyaXR5KX0lYCB9KTtcbiAgICBzdGF0c0Rpdi5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgJHtzb3VyY2VOb3RlLndvcmRDb3VudCB8fCAnPyd9IHdvcmRzIC8gJHt0YXJnZXROb3RlLndvcmRDb3VudCB8fCAnPyd9IHdvcmRzYCB9KTtcbiAgICBcbiAgICAvLyBTaGFyZWQgdGVybXNcbiAgICBpZiAoY29ubmVjdGlvbi5jb21tb25UZXJtcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYENvbW1vbiB0ZXJtczogJHtjb25uZWN0aW9uLmNvbW1vblRlcm1zLmpvaW4oJywgJyl9YCB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ2x1c3RlciB0ZXJtc1xuICAgIGlmIChjb25uZWN0aW9uLmNsdXN0ZXJUZXJtcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYENsdXN0ZXIgdGVybXM6ICR7Y29ubmVjdGlvbi5jbHVzdGVyVGVybXMuam9pbignLCAnKX1gIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyBSZWFzb24gZm9yIGNvbm5lY3Rpb25cbiAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYENvbm5lY3Rpb24gcmVhc29uOiAke2Nvbm5lY3Rpb24ucmVhc29ufWAgfSk7XG4gICAgXG4gICAgLy8gR2VuZXJhdGUgZGVzY3JpcHRpb24gYnV0dG9uXG4gICAgY29uc3QgZ2VuZXJhdGVCdXR0b24gPSBuZXcgQnV0dG9uQ29tcG9uZW50KGNvbnRhaW5lcilcbiAgICAgIC5zZXRCdXR0b25UZXh0KCdHZW5lcmF0ZSBDb25uZWN0aW9uIERlc2NyaXB0aW9uJylcbiAgICAgIC5zZXRDdGEoKSAvLyBVc2Ugc2V0Q3RhKCkgaW5zdGVhZCBvZiBzZXRDbGFzcyB3aXRoIHNwYWNlc1xuICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLmdlbmVyYXRlTExNRGVzY3JpcHRpb24oY29ubmVjdGlvbik7XG4gICAgICB9KTtcbiAgICBcbiAgICAvLyBBZGQgY2xhc3Mgd2l0aG91dCBzcGFjZXNcbiAgICBnZW5lcmF0ZUJ1dHRvbi5idXR0b25FbC5hZGRDbGFzcygnZ2VuZXJhdGUtYnV0dG9uJyk7XG4gICAgXG4gICAgaWYgKHRoaXMucHJvY2Vzc2luZ0Nvbm5lY3Rpb24pIHtcbiAgICAgIGdlbmVyYXRlQnV0dG9uLnNldERpc2FibGVkKHRydWUpO1xuICAgICAgZ2VuZXJhdGVCdXR0b24uc2V0QnV0dG9uVGV4dCgnR2VuZXJhdGluZy4uLicpO1xuICAgIH1cbiAgICBcbiAgICAvLyBEZXNjcmlwdGlvbiB0ZXh0IGFyZWFcbiAgICBpZiAoY29ubmVjdGlvbi5sbG1EZXNjcmlwdGlvbikge1xuICAgICAgY29uc3QgZGVzY3JpcHRpb25Db250YWluZXIgPSBjb250YWluZXIuY3JlYXRlRGl2KCk7XG4gICAgICBkZXNjcmlwdGlvbkNvbnRhaW5lci5jcmVhdGVFbCgnaDQnLCB7IHRleHQ6ICdDb25uZWN0aW9uIERlc2NyaXB0aW9uOicgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRleHRBcmVhID0gbmV3IFRleHRBcmVhQ29tcG9uZW50KGRlc2NyaXB0aW9uQ29udGFpbmVyKVxuICAgICAgICAuc2V0VmFsdWUoY29ubmVjdGlvbi5sbG1EZXNjcmlwdGlvbilcbiAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdDb25uZWN0aW9uIGRlc2NyaXB0aW9uIHdpbGwgYXBwZWFyIGhlcmUuLi4nKTtcbiAgICAgIFxuICAgICAgdGV4dEFyZWEuaW5wdXRFbC5hZGRDbGFzcygnbGxtLWRlc2NyaXB0aW9uJyk7XG4gICAgICBcbiAgICAgIC8vIENyZWF0ZSBidXR0b25cbiAgICAgIGNvbnN0IGJ1dHRvbkNvbnRhaW5lciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICdidXR0b24tY29udGFpbmVyJyB9KTtcbiAgICAgIFxuICAgICAgbmV3IEJ1dHRvbkNvbXBvbmVudChidXR0b25Db250YWluZXIpXG4gICAgICAgIC5zZXRCdXR0b25UZXh0KCdDcmVhdGUgTGluaycpXG4gICAgICAgIC5zZXRDdGEoKSAvLyBVc2Ugc2V0Q3RhKCkgaW5zdGVhZCBvZiBzZXRDbGFzcyB3aXRoIHNwYWNlc1xuICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5jcmVhdGVMaW5rKGNvbm5lY3Rpb24sIHRleHRBcmVhLmdldFZhbHVlKCkpO1xuICAgICAgICB9KTtcbiAgICAgIFxuICAgICAgbmV3IEJ1dHRvbkNvbXBvbmVudChidXR0b25Db250YWluZXIpXG4gICAgICAgIC5zZXRCdXR0b25UZXh0KCdFZGl0IERlc2NyaXB0aW9uJylcbiAgICAgICAgLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRleHRBcmVhLnNldERpc2FibGVkKGZhbHNlKTtcbiAgICAgICAgICB0ZXh0QXJlYS5pbnB1dEVsLmZvY3VzKCk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBzZWxlY3RDb25uZWN0aW9uKGluZGV4OiBudW1iZXIpIHtcbiAgICBpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMuY29ubmVjdGlvbnMubGVuZ3RoKSByZXR1cm47XG4gICAgXG4gICAgdGhpcy5zZWxlY3RlZENvbm5lY3Rpb25JbmRleCA9IGluZGV4O1xuICAgIGNvbnN0IGNvbm5lY3Rpb25Db250YWluZXIgPSB0aGlzLmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKCcuY29ubmVjdGlvbnMtY29udGFpbmVyJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgY29uc3QgZGV0YWlsc0NvbnRhaW5lciA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJy5jb25uZWN0aW9uLWRldGFpbHMnKSBhcyBIVE1MRWxlbWVudDtcbiAgICBcbiAgICBpZiAoY29ubmVjdGlvbkNvbnRhaW5lciAmJiBkZXRhaWxzQ29udGFpbmVyKSB7XG4gICAgICB0aGlzLnJlbmRlckNvbm5lY3Rpb25zTGlzdChjb25uZWN0aW9uQ29udGFpbmVyKTtcbiAgICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoZGV0YWlsc0NvbnRhaW5lciwgdGhpcy5jb25uZWN0aW9uc1tpbmRleF0pO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBnZW5lcmF0ZUxMTURlc2NyaXB0aW9uKGNvbm5lY3Rpb246IE5vdGVDb25uZWN0aW9uKSB7XG4gICAgaWYgKHRoaXMucHJvY2Vzc2luZ0Nvbm5lY3Rpb24pIHJldHVybjtcbiAgICBcbiAgICB0aGlzLnByb2Nlc3NpbmdDb25uZWN0aW9uID0gdHJ1ZTtcbiAgICBjb25zdCBkZXRhaWxzQ29udGFpbmVyID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignLmNvbm5lY3Rpb24tZGV0YWlscycpIGFzIEhUTUxFbGVtZW50O1xuICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoZGV0YWlsc0NvbnRhaW5lciwgY29ubmVjdGlvbik7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIEZldGNoIHNvdXJjZSBhbmQgdGFyZ2V0IG5vdGUgY29udGVudFxuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb25uZWN0aW9uLnNvdXJjZU5vdGUucGF0aCk7XG4gICAgICBjb25zdCB0YXJnZXRGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbm5lY3Rpb24udGFyZ2V0Tm90ZS5wYXRoKTtcbiAgICAgIFxuICAgICAgaWYgKCEoc291cmNlRmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB8fCAhKHRhcmdldEZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBub3RlIGZpbGVzJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKHNvdXJjZUZpbGUpO1xuICAgICAgY29uc3QgdGFyZ2V0Q29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQodGFyZ2V0RmlsZSk7XG4gICAgICBcbiAgICAgIC8vIFByZXBhcmUgZGF0YSBmb3IgTExNIGNhbGxcbiAgICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgIHNvdXJjZU5vdGU6IHtcbiAgICAgICAgICB0aXRsZTogY29ubmVjdGlvbi5zb3VyY2VOb3RlLnRpdGxlLFxuICAgICAgICAgIGNvbnRlbnQ6IHNvdXJjZUNvbnRlbnQuc3Vic3RyaW5nKDAsIDEwMDApLCAvLyBMaW1pdCB0byBmaXJzdCAxMDAwIGNoYXJzXG4gICAgICAgICAgdG9wVGVybXM6IGNvbm5lY3Rpb24uc291cmNlTm90ZS50b3BfdGVybXNcbiAgICAgICAgfSxcbiAgICAgICAgdGFyZ2V0Tm90ZToge1xuICAgICAgICAgIHRpdGxlOiBjb25uZWN0aW9uLnRhcmdldE5vdGUudGl0bGUsXG4gICAgICAgICAgY29udGVudDogdGFyZ2V0Q29udGVudC5zdWJzdHJpbmcoMCwgMTAwMCksIC8vIExpbWl0IHRvIGZpcnN0IDEwMDAgY2hhcnNcbiAgICAgICAgICB0b3BUZXJtczogY29ubmVjdGlvbi50YXJnZXROb3RlLnRvcF90ZXJtc1xuICAgICAgICB9LFxuICAgICAgICBjb21tb25UZXJtczogY29ubmVjdGlvbi5jb21tb25UZXJtcyxcbiAgICAgICAgY2x1c3RlclRlcm1zOiBjb25uZWN0aW9uLmNsdXN0ZXJUZXJtcyxcbiAgICAgICAgcmVhc29uOiBjb25uZWN0aW9uLnJlYXNvblxuICAgICAgfTtcbiAgICAgIFxuICAgICAgLy8gQ2FsbCB0aGUgTExNIHNlcnZpY2VcbiAgICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gYXdhaXQgdGhpcy5jYWxsTExNU2VydmljZShkYXRhKTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIHRoZSBjb25uZWN0aW9uIHdpdGggdGhlIGdlbmVyYXRlZCBkZXNjcmlwdGlvblxuICAgICAgY29ubmVjdGlvbi5sbG1EZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgdGhlIFVJXG4gICAgICB0aGlzLnByb2Nlc3NpbmdDb25uZWN0aW9uID0gZmFsc2U7XG4gICAgICBjb25zdCBkZXRhaWxzQ29udGFpbmVyID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignLmNvbm5lY3Rpb24tZGV0YWlscycpIGFzIEhUTUxFbGVtZW50O1xuICAgICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uRGV0YWlscyhkZXRhaWxzQ29udGFpbmVyLCBjb25uZWN0aW9uKTtcbiAgICAgIFxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLnByb2Nlc3NpbmdDb25uZWN0aW9uID0gZmFsc2U7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZW5lcmF0aW5nIGRlc2NyaXB0aW9uOicsIGVycm9yKTtcbiAgICAgIG5ldyBOb3RpY2UoYEZhaWxlZCB0byBnZW5lcmF0ZSBkZXNjcmlwdGlvbjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgVUkgdG8gc2hvdyBlcnJvclxuICAgICAgY29uc3QgZGV0YWlsc0NvbnRhaW5lciA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJy5jb25uZWN0aW9uLWRldGFpbHMnKSBhcyBIVE1MRWxlbWVudDtcbiAgICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoZGV0YWlsc0NvbnRhaW5lciwgY29ubmVjdGlvbik7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGNhbGxMTE1TZXJ2aWNlKGRhdGE6IGFueSk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIFRyeSB0byBjb25uZWN0IHRvIHRoZSBsb2NhbCBMTE0gQVBJIHNlcnZlclxuICAgICAgY29uc3Qgc291cmNlVGl0bGUgPSBkYXRhLnNvdXJjZU5vdGUudGl0bGU7XG4gICAgICBjb25zdCB0YXJnZXRUaXRsZSA9IGRhdGEudGFyZ2V0Tm90ZS50aXRsZTtcbiAgICAgIGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBkYXRhLnNvdXJjZU5vdGUuY29udGVudDtcbiAgICAgIGNvbnN0IHRhcmdldENvbnRlbnQgPSBkYXRhLnRhcmdldE5vdGUuY29udGVudDtcbiAgICAgIGNvbnN0IGNvbW1vblRlcm1zID0gZGF0YS5jb21tb25UZXJtcy5qb2luKCcsICcpO1xuICAgICAgY29uc3QgY2x1c3RlclRlcm1zID0gZGF0YS5jbHVzdGVyVGVybXMuam9pbignLCAnKTtcbiAgICAgIFxuICAgICAgLy8gRmlyc3QsIHRyeSB0byB1c2UgdGhlIFB5dGhvbiBzZXJ2ZXIncyBMTE0gaW50ZWdyYXRpb25cbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJ2h0dHA6Ly8xMjcuMC4wLjE6MTIzNC9nZW5lcmF0ZV9jb25uZWN0aW9uJywge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBzb3VyY2Vfbm90ZToge1xuICAgICAgICAgICAgdGl0bGU6IHNvdXJjZVRpdGxlLFxuICAgICAgICAgICAgY29udGVudDogc291cmNlQ29udGVudCxcbiAgICAgICAgICAgIHRlcm1zOiBkYXRhLnNvdXJjZU5vdGUudG9wVGVybXNcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRhcmdldF9ub3RlOiB7XG4gICAgICAgICAgICB0aXRsZTogdGFyZ2V0VGl0bGUsXG4gICAgICAgICAgICBjb250ZW50OiB0YXJnZXRDb250ZW50LFxuICAgICAgICAgICAgdGVybXM6IGRhdGEudGFyZ2V0Tm90ZS50b3BUZXJtc1xuICAgICAgICAgIH0sXG4gICAgICAgICAgY29tbW9uX3Rlcm1zOiBkYXRhLmNvbW1vblRlcm1zLFxuICAgICAgICAgIGNsdXN0ZXJfdGVybXM6IGRhdGEuY2x1c3RlclRlcm1zXG4gICAgICAgIH0pXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgaWYgKHJlc3VsdC5kZXNjcmlwdGlvbikge1xuICAgICAgICAgIHJldHVybiByZXN1bHQuZGVzY3JpcHRpb247XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gSWYgc2VydmVyIGNhbGwgZmFpbHMgb3Igbm90IGF2YWlsYWJsZSwgdXNlIGZhbGxiYWNrIGxvZ2ljXG4gICAgICBjb25zb2xlLmxvZyhcIlVzaW5nIGZhbGxiYWNrIGNvbm5lY3Rpb24gZGVzY3JpcHRpb24gZ2VuZXJhdGlvblwiKTtcbiAgICAgIFxuICAgICAgLy8gQ3JlYXRlIGEgdGVtcGxhdGUtYmFzZWQgZGVzY3JpcHRpb24gKGZhbGxiYWNrKVxuICAgICAgbGV0IGRlc2NyaXB0aW9uID0gJyc7XG4gICAgICBcbiAgICAgIGlmIChjb21tb25UZXJtcykge1xuICAgICAgICBkZXNjcmlwdGlvbiArPSBgVGhlc2Ugbm90ZXMgc2hhcmUgY29uY2VwdHVhbCBvdmVybGFwIGFyb3VuZCAke2NvbW1vblRlcm1zfS4gYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlc2NyaXB0aW9uICs9IGBUaGVzZSBub3RlcyBhcHBlYXIgdG8gYmUgY29uY2VwdHVhbGx5IHJlbGF0ZWQuIGA7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGRlc2NyaXB0aW9uICs9IGBUaGUgbm90ZSBcIiR7dGFyZ2V0VGl0bGV9XCIgcHJvdmlkZXMgY29tcGxlbWVudGFyeSBpbmZvcm1hdGlvbiB0aGF0IGV4cGFuZHMgb24gaWRlYXMgaW4gXCIke3NvdXJjZVRpdGxlfVwiYDtcbiAgICAgIFxuICAgICAgaWYgKGNsdXN0ZXJUZXJtcykge1xuICAgICAgICBkZXNjcmlwdGlvbiArPSBgLCBwYXJ0aWN1bGFybHkgcmVnYXJkaW5nICR7Y2x1c3RlclRlcm1zfS5gO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVzY3JpcHRpb24gKz0gJy4nO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZGVzY3JpcHRpb247XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNhbGxpbmcgTExNIHNlcnZpY2U6JywgZXJyb3IpO1xuICAgICAgXG4gICAgICAvLyBSZXR1cm4gYSBiYXNpYyBkZXNjcmlwdGlvbiBhcyBmYWxsYmFja1xuICAgICAgcmV0dXJuIGBUaGVzZSBub3RlcyBhcHBlYXIgdG8gYmUgcmVsYXRlZCBpbiB0aGVpciBjb250ZW50LiBUaGUgbm90ZSBcIiR7ZGF0YS50YXJnZXROb3RlLnRpdGxlfVwiIGNvbXBsZW1lbnRzIFwiJHtkYXRhLnNvdXJjZU5vdGUudGl0bGV9XCIgd2l0aCBhZGRpdGlvbmFsIHJlbGV2YW50IGluZm9ybWF0aW9uLmA7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGNyZWF0ZUxpbmsoY29ubmVjdGlvbjogTm90ZUNvbm5lY3Rpb24sIGRlc2NyaXB0aW9uOiBzdHJpbmcpIHtcbiAgICBpZiAoIWRlc2NyaXB0aW9uIHx8IGRlc2NyaXB0aW9uLnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgIG5ldyBOb3RpY2UoJ1BsZWFzZSBnZW5lcmF0ZSBvciBwcm92aWRlIGEgZGVzY3JpcHRpb24gZm9yIHRoZSBjb25uZWN0aW9uJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIC8vIENsb3NlIHRoZSBtb2RhbCBmaXJzdCBzbyBpdCBkb2Vzbid0IGludGVyZmVyZSB3aXRoIHRoZSBub3RlIG9wZW5pbmdcbiAgICB0aGlzLmNsb3NlKCk7XG4gICAgXG4gICAgLy8gQ3JlYXRlIHRoZSBsaW5rIC0gdGhpcyB3aWxsIGFsc28gb3BlbiB0aGUgc291cmNlIG5vdGVcbiAgICBjb25zdCBzdWNjZXNzID0gYXdhaXQgdGhpcy5wbHVnaW4uY3JlYXRlTm90ZUxpbmsoXG4gICAgICBjb25uZWN0aW9uLnNvdXJjZU5vdGUucGF0aCxcbiAgICAgIGNvbm5lY3Rpb24udGFyZ2V0Tm90ZS5wYXRoLFxuICAgICAgZGVzY3JpcHRpb25cbiAgICApO1xuICAgIFxuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICAvLyBPcGVuIHRoZSB0YXJnZXQgbm90ZSBpbiBhIHNwbGl0IHBhbmUgYWZ0ZXIgYSBzaG9ydCBkZWxheSB0byBsZXQgdGhlIHNvdXJjZSBub3RlIG9wZW5cbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIEFsc28gb2ZmZXIgb3B0aW9uIHRvIHZpZXcgdGhlIHRhcmdldCBub3RlXG4gICAgICAgICAgY29uc3QgdGFyZ2V0RmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb25uZWN0aW9uLnRhcmdldE5vdGUucGF0aCk7XG4gICAgICAgICAgaWYgKHRhcmdldEZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbW9kYWwgYXNraW5nIGlmIHVzZXIgd2FudHMgdG8gb3BlbiB0aGUgdGFyZ2V0IG5vdGVcbiAgICAgICAgICAgIGNvbnN0IG1vZGFsID0gbmV3IE1vZGFsKHRoaXMuYXBwKTtcbiAgICAgICAgICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSBtb2RhbDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQWRkIHNvbWUgc3R5bGluZ1xuICAgICAgICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgICAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSBgXG4gICAgICAgICAgICAgIC5zdWNjZXNzLW1vZGFsIHtcbiAgICAgICAgICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICAgICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAuc3VjY2Vzcy1pY29uIHtcbiAgICAgICAgICAgICAgICBmb250LXNpemU6IDM2cHg7XG4gICAgICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMTVweDtcbiAgICAgICAgICAgICAgICBjb2xvcjogdmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAuc3VjY2Vzcy10aXRsZSB7XG4gICAgICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMTBweDtcbiAgICAgICAgICAgICAgICBjb2xvcjogdmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAubm90ZS1pbmZvIHtcbiAgICAgICAgICAgICAgICBtYXJnaW4tYm90dG9tOiAyMHB4O1xuICAgICAgICAgICAgICAgIGZvbnQtc3R5bGU6IGl0YWxpYztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAuY29uZmlybWF0aW9uLXF1ZXN0aW9uIHtcbiAgICAgICAgICAgICAgICBtYXJnaW4tYm90dG9tOiAyMHB4O1xuICAgICAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC5tb2RhbC1idXR0b24tY29udGFpbmVyIHtcbiAgICAgICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYXJvdW5kO1xuICAgICAgICAgICAgICAgIG1hcmdpbi10b3A6IDIwcHg7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGA7XG4gICAgICAgICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ3JlYXRlIHRoZSBtb2RhbCBjb250ZW50IHdpdGggc3R5bGluZ1xuICAgICAgICAgICAgY29uc3QgY29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ3N1Y2Nlc3MtbW9kYWwnIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBTdWNjZXNzIGljb24gLSB1c2luZyBlbW9qaSBmb3Igc2ltcGxpY2l0eVxuICAgICAgICAgICAgY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ3N1Y2Nlc3MtaWNvbicsIHRleHQ6ICfwn5SXJyB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29udGFpbmVyLmNyZWF0ZUVsKCdoMicsIHsgXG4gICAgICAgICAgICAgIHRleHQ6IGBMaW5rIENyZWF0ZWQgU3VjY2Vzc2Z1bGx5IWAsXG4gICAgICAgICAgICAgIGNsczogJ3N1Y2Nlc3MtdGl0bGUnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29udGFpbmVyLmNyZWF0ZUVsKCdwJywgeyBcbiAgICAgICAgICAgICAgdGV4dDogYEEgbGluayB0byBcIiR7Y29ubmVjdGlvbi50YXJnZXROb3RlLnRpdGxlfVwiIGhhcyBiZWVuIGFkZGVkIHRvIFwiJHtjb25uZWN0aW9uLnNvdXJjZU5vdGUudGl0bGV9XCIuYCxcbiAgICAgICAgICAgICAgY2xzOiAnbm90ZS1pbmZvJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnRhaW5lci5jcmVhdGVFbCgncCcsIHsgXG4gICAgICAgICAgICAgIHRleHQ6IGBXb3VsZCB5b3UgbGlrZSB0byBvcGVuIFwiJHtjb25uZWN0aW9uLnRhcmdldE5vdGUudGl0bGV9XCIgYXMgd2VsbD9gLFxuICAgICAgICAgICAgICBjbHM6ICdjb25maXJtYXRpb24tcXVlc3Rpb24nXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgYnV0dG9uQ29udGFpbmVyID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ21vZGFsLWJ1dHRvbi1jb250YWluZXInIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBCdXR0b24gdG8gb3BlbiB0aGUgdGFyZ2V0IG5vdGVcbiAgICAgICAgICAgIGNvbnN0IG9wZW5CdXR0b24gPSBuZXcgQnV0dG9uQ29tcG9uZW50KGJ1dHRvbkNvbnRhaW5lcilcbiAgICAgICAgICAgICAgLnNldEJ1dHRvblRleHQoYE9wZW4gXCIke2Nvbm5lY3Rpb24udGFyZ2V0Tm90ZS50aXRsZX1cImApXG4gICAgICAgICAgICAgIC5zZXRDdGEoKVxuICAgICAgICAgICAgICAub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gT3BlbiBpbiBhIG5ldyBsZWFmIChzcGxpdCBwYW5lKVxuICAgICAgICAgICAgICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuY3JlYXRlTGVhZkJ5U3BsaXQoXG4gICAgICAgICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZiwgXG4gICAgICAgICAgICAgICAgICAndmVydGljYWwnXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsZWFmLm9wZW5GaWxlKHRhcmdldEZpbGUpO1xuICAgICAgICAgICAgICAgIG1vZGFsLmNsb3NlKCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBCdXR0b24gdG8gc3RheSBvbiB0aGUgY3VycmVudCBub3RlXG4gICAgICAgICAgICBuZXcgQnV0dG9uQ29tcG9uZW50KGJ1dHRvbkNvbnRhaW5lcilcbiAgICAgICAgICAgICAgLnNldEJ1dHRvblRleHQoJ1N0YXkgb24gY3VycmVudCBub3RlJylcbiAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgICAgICAgIG1vZGFsLmNsb3NlKCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBtb2RhbC5vcGVuKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIG9wZW5pbmcgdGFyZ2V0IG5vdGU6JywgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9LCA1MDApO1xuICAgIH1cbiAgfVxuICBcbiAgb25DbG9zZSgpIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgfVxufVxuXG4vLyBEZWZpbmUgdGhlIHZpZXcgdHlwZSBmb3Igb3VyIHZpc3VhbGl6YXRpb25cbmNvbnN0IFZJRVdfVFlQRV9UU05FID0gXCJ0c25lLXZpc3VhbGl6YXRpb25cIjtcblxuaW50ZXJmYWNlIFZpYmVCb3lTZXR0aW5ncyB7XG4gIHBlcnBsZXhpdHk6IG51bWJlcjtcbiAgaXRlcmF0aW9uczogbnVtYmVyO1xuICBlcHNpbG9uOiBudW1iZXI7XG59XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFZpYmVCb3lTZXR0aW5ncyA9IHtcbiAgcGVycGxleGl0eTogMzAsXG4gIGl0ZXJhdGlvbnM6IDEwMDAsXG4gIGVwc2lsb246IDEwXG59XG5cbi8vIEN1c3RvbSB2aWV3IGZvciB0LVNORSB2aXN1YWxpemF0aW9uXG5jbGFzcyBUU05FVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZikge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gVklFV19UWVBFX1RTTkU7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBcInQtU05FIFZpc3VhbGl6YXRpb25cIjtcbiAgfVxuXG4gIGdldEljb24oKTogc3RyaW5nIHtcbiAgICByZXR1cm4gXCJncmFwaFwiO1xuICB9XG5cbiAgLy8gU2V0IG9uRHJvcCBoYW5kbGVyIHRvIHByZXZlbnQgZXJyb3JcbiAgb25Ecm9wKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcbiAgICAvLyBOb3QgaW1wbGVtZW50ZWRcbiAgfVxuXG4gIC8vIFNldCBvblBhbmVNZW51IGhhbmRsZXIgdG8gcHJldmVudCBlcnJvclxuICBvblBhbmVNZW51KG1lbnU6IGFueSwgc291cmNlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAvLyBOb3QgaW1wbGVtZW50ZWRcbiAgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRlbnRFbDtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICBcbiAgICAvLyBBZGQgaGVhZGVyXG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInRzbmUtaGVhZGVyXCIgfSwgKGhlYWRlcikgPT4ge1xuICAgICAgaGVhZGVyLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcInQtU05FIE5vdGUgVmlzdWFsaXphdGlvblwiIH0pO1xuICAgICAgXG4gICAgICAvLyBBZGQgYWN0aW9uIGJ1dHRvbnNcbiAgICAgIGNvbnN0IGFjdGlvbkJhciA9IGhlYWRlci5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJ0c25lLWFjdGlvbnNcIiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgcnVuQnV0dG9uID0gYWN0aW9uQmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJSdW4gQW5hbHlzaXNcIiwgY2xzOiBcIm1vZC1jdGFcIiB9KTtcbiAgICAgIHJ1bkJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICAvLyBHZXQgdGhlIHBsdWdpbiBpbnN0YW5jZSBhbmQgcnVuIHQtU05FXG4gICAgICAgIGNvbnN0IHBsdWdpbiA9ICh0aGlzLmFwcCBhcyBhbnkpLnBsdWdpbnMucGx1Z2luc1tcInZpYmUtYm9pXCJdIGFzIFZpYmVCb3lQbHVnaW47XG4gICAgICAgIHBsdWdpbi5ydW5UU05FKCk7XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc3VnZ2VzdExpbmtzQnV0dG9uID0gYWN0aW9uQmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJTdWdnZXN0IExpbmtzXCIsIGNsczogXCJtb2QtY3RhXCIgfSk7XG4gICAgICBzdWdnZXN0TGlua3NCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgLy8gR2V0IHRoZSBwbHVnaW4gaW5zdGFuY2UgYW5kIHN1Z2dlc3QgbGlua3NcbiAgICAgICAgY29uc3QgcGx1Z2luID0gKHRoaXMuYXBwIGFzIGFueSkucGx1Z2lucy5wbHVnaW5zW1widmliZS1ib2lcIl0gYXMgVmliZUJveVBsdWdpbjtcbiAgICAgICAgcGx1Z2luLnN1Z2dlc3RMaW5rcygpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdEZvbGRlckJ1dHRvbiA9IGFjdGlvbkJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiU2VsZWN0IEZvbGRlclwiIH0pO1xuICAgICAgc2VsZWN0Rm9sZGVyQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIC8vIFRPRE86IEltcGxlbWVudCBmb2xkZXIgc2VsZWN0aW9uXG4gICAgICAgIG5ldyBOb3RpY2UoXCJGb2xkZXIgc2VsZWN0aW9uIG5vdCBpbXBsZW1lbnRlZCB5ZXRcIik7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBcbiAgICAvLyBBZGQgaW5mbyB0ZXh0XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiLCB7IFxuICAgICAgdGV4dDogXCJSdW4gdC1TTkUgYW5hbHlzaXMgdG8gdmlzdWFsaXplIHlvdXIgbm90ZXMgYXMgY2x1c3RlcnMgYmFzZWQgb24gY29udGVudCBzaW1pbGFyaXR5LlwiLFxuICAgICAgY2xzOiBcInRzbmUtaW5mb1wiXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQWRkIHZpc3VhbGl6YXRpb24gY29udGFpbmVyXG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgXG4gICAgICBjbHM6IFwidHNuZS1jb250YWluZXJcIiwgXG4gICAgICBhdHRyOiB7IGlkOiBcInRzbmUtY29udGFpbmVyXCIgfSBcbiAgICB9KTtcbiAgICBcbiAgICAvLyBBZGQgc3RhdHVzIHRleHRcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBcbiAgICAgIGNsczogXCJ0c25lLXN0YXR1c1wiLFxuICAgICAgYXR0cjogeyBpZDogXCJ0c25lLXN0YXR1c1wiIH1cbiAgICB9LCAoc3RhdHVzKSA9PiB7XG4gICAgICBzdGF0dXMuY3JlYXRlRWwoXCJwXCIsIHsgXG4gICAgICAgIHRleHQ6IFwiVXNlIHRoZSAnUnVuIEFuYWx5c2lzJyBidXR0b24gdG8gc3RhcnQgcHJvY2Vzc2luZyB5b3VyIG5vdGVzLlwiLFxuICAgICAgICBjbHM6IFwidHNuZS1zdGF0dXMtdGV4dFwiXG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBcbiAgICAvLyBBZGQgc2ltcGxlIENTU1xuICAgIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBzdHlsZS50ZXh0Q29udGVudCA9IGBcbiAgICAgIC50c25lLWhlYWRlciB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMXJlbTtcbiAgICAgIH1cbiAgICAgIC50c25lLWFjdGlvbnMge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBnYXA6IDEwcHg7XG4gICAgICB9XG4gICAgICAudHNuZS1pbmZvIHtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMXJlbTtcbiAgICAgICAgb3BhY2l0eTogMC44O1xuICAgICAgfVxuICAgICAgLnRzbmUtY29udGFpbmVyIHtcbiAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgIGhlaWdodDogNjAwcHg7XG4gICAgICAgIG1hcmdpbjogMXJlbSAwO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICB9XG4gICAgICAudHNuZS1zdGF0dXMge1xuICAgICAgICBtYXJnaW4tdG9wOiAxcmVtO1xuICAgICAgICBwYWRkaW5nOiAwLjVyZW07XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tYmFja2dyb3VuZC1zZWNvbmRhcnkpO1xuICAgICAgfVxuICAgICAgLnRzbmUtc3RhdHVzLXRleHQge1xuICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgIGZvbnQtc2l6ZTogMC45cmVtO1xuICAgICAgICBvcGFjaXR5OiAwLjg7XG4gICAgICB9XG4gICAgYDtcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBWaWJlQm95UGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IFZpYmVCb3lTZXR0aW5ncztcblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblxuICAgIC8vIFJlZ2lzdGVyIHRoZSBjdXN0b20gdmlld1xuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFxuICAgICAgVklFV19UWVBFX1RTTkUsXG4gICAgICAobGVhZikgPT4gbmV3IFRTTkVWaWV3KGxlYWYpXG4gICAgKTtcblxuICAgIC8vIEFkZCBjb21tYW5kIHRvIG9wZW4gdGhlIHZpc3VhbGl6YXRpb25cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICdvcGVuLXRzbmUtdmlzdWFsaXphdGlvbicsXG4gICAgICBuYW1lOiAnT3BlbiB0LVNORSBWaXN1YWxpemF0aW9uJyxcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBZGQgY29tbWFuZCB0byBydW4gdC1TTkUgYW5hbHlzaXNcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICdydW4tdHNuZS1hbmFseXNpcycsXG4gICAgICBuYW1lOiAnUnVuIHQtU05FIEFuYWx5c2lzJyxcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIHRoaXMucnVuVFNORSgpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHNldHRpbmcgdGFiXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gIH1cblxuICBvbnVubG9hZCgpIHtcbiAgICAvLyBDbGVhbiB1cCByZXNvdXJjZXMgd2hlbiB0aGUgcGx1Z2luIGlzIGRpc2FibGVkXG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG4gIH1cblxuICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcbiAgfVxuXG4gIGFzeW5jIGFjdGl2YXRlVmlldygpIHtcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX1RTTkUpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYodHJ1ZSk7XG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoe1xuICAgICAgdHlwZTogVklFV19UWVBFX1RTTkUsXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBydW5UU05FKCkge1xuICAgIC8vIFByb2Nlc3Mgbm90ZXMgYW5kIHJ1biB0LVNORSBhbmFseXNpc1xuICAgIG5ldyBOb3RpY2UoJ3QtU05FIGFuYWx5c2lzIHN0YXJ0aW5nLi4uJyk7XG4gICAgdGhpcy51cGRhdGVTdGF0dXMoJ0dhdGhlcmluZyBub3Rlcy4uLicpO1xuICAgIFxuICAgIC8vIEdldCBhbGwgbWFya2Rvd24gZmlsZXMgaW4gdGhlIHZhdWx0XG4gICAgY29uc3QgZmlsZXMgPSB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIExpbWl0IHRvIGEgcmVhc29uYWJsZSBudW1iZXIgb2YgZmlsZXMgZm9yIHBlcmZvcm1hbmNlXG4gICAgICBjb25zdCBtYXhGaWxlcyA9IDIwMDtcbiAgICAgIGNvbnN0IHNlbGVjdGVkRmlsZXMgPSBmaWxlcy5zbGljZSgwLCBtYXhGaWxlcyk7XG4gICAgICBcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGBQcm9jZXNzaW5nICR7c2VsZWN0ZWRGaWxlcy5sZW5ndGh9IG5vdGVzLi4uYCk7XG4gICAgICBcbiAgICAgIC8vIFByZXBhcmUgbm90ZXMgZGF0YSBmb3IgdGhlIFB5dGhvbiBzZXJ2ZXJcbiAgICAgIGNvbnN0IG5vdGVzID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgIHNlbGVjdGVkRmlsZXMubWFwKGFzeW5jIChmaWxlKSA9PiB7XG4gICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICAgICAgY29uc3Qgc3RhdCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuc3RhdChmaWxlLnBhdGgpO1xuICAgICAgICAgIGNvbnN0IHdvcmRDb3VudCA9IGNvbnRlbnQuc3BsaXQoL1xccysvKS5sZW5ndGg7XG4gICAgICAgICAgY29uc3QgcmVhZGluZ1RpbWUgPSBNYXRoLmNlaWwod29yZENvdW50IC8gMjAwKTsgLy8gQXZnIHJlYWRpbmcgc3BlZWQgfjIwMCB3b3Jkcy9taW51dGVcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBFeHRyYWN0IHRhZ3MgKGxvb2tpbmcgZm9yICN0YWcgZm9ybWF0KVxuICAgICAgICAgIGNvbnN0IHRhZ1JlZ2V4ID0gLyMoW2EtekEtWjAtOV8tXSspL2c7XG4gICAgICAgICAgY29uc3QgdGFncyA9IFsuLi5jb250ZW50Lm1hdGNoQWxsKHRhZ1JlZ2V4KV0ubWFwKG1hdGNoID0+IG1hdGNoWzFdKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBHZXQgYSBjb250ZW50IHByZXZpZXcgKGZpcnN0IDE1MCBjaGFycylcbiAgICAgICAgICBjb25zdCBjb250ZW50UHJldmlldyA9IGNvbnRlbnQuc3Vic3RyaW5nKDAsIDE1MCkucmVwbGFjZSgvXFxuL2csICcgJykgKyBcbiAgICAgICAgICAgIChjb250ZW50Lmxlbmd0aCA+IDE1MCA/ICcuLi4nIDogJycpO1xuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXRoOiBmaWxlLnBhdGgsXG4gICAgICAgICAgICB0aXRsZTogZmlsZS5iYXNlbmFtZSxcbiAgICAgICAgICAgIGNvbnRlbnQ6IGNvbnRlbnQsXG4gICAgICAgICAgICBtdGltZTogc3RhdC5tdGltZSxcbiAgICAgICAgICAgIGN0aW1lOiBzdGF0LmN0aW1lLFxuICAgICAgICAgICAgd29yZENvdW50OiB3b3JkQ291bnQsXG4gICAgICAgICAgICByZWFkaW5nVGltZTogcmVhZGluZ1RpbWUsXG4gICAgICAgICAgICB0YWdzOiB0YWdzLFxuICAgICAgICAgICAgY29udGVudFByZXZpZXc6IGNvbnRlbnRQcmV2aWV3XG4gICAgICAgICAgfTtcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgICBcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKCdTZW5kaW5nIGRhdGEgdG8gdC1TTkUgc2VydmVyLi4uJyk7XG4gICAgICBcbiAgICAgIC8vIENoZWNrIGlmIFB5dGhvbiBzZXJ2ZXIgaXMgcnVubmluZ1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgaGVhbHRoQ2hlY2sgPSBhd2FpdCBmZXRjaCgnaHR0cDovLzEyNy4wLjAuMToxMjM0L2hlYWx0aCcsIHsgXG4gICAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGlmICghaGVhbHRoQ2hlY2sub2spIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJQeXRob24gc2VydmVyIGlzIG5vdCByZXNwb25kaW5nXCIpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgXCJDYW5ub3QgY29ubmVjdCB0byBQeXRob24gc2VydmVyLiBNYWtlIHN1cmUgdGhlIHNlcnZlciBpcyBydW5uaW5nIGF0IGh0dHA6Ly8xMjcuMC4wLjE6MTIzNC4gXCIgK1xuICAgICAgICAgIFwiUnVuICdweXRob24gc3JjL3B5dGhvbi90c25lL3NlcnZlci5weScgdG8gc3RhcnQgaXQuXCJcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gU2VuZCB0byBQeXRob24gc2VydmVyIGZvciBwcm9jZXNzaW5nXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhgUnVubmluZyB0LVNORSBhbmFseXNpcyB3aXRoIHBlcnBsZXhpdHk9JHt0aGlzLnNldHRpbmdzLnBlcnBsZXhpdHl9LCBpdGVyYXRpb25zPSR7dGhpcy5zZXR0aW5ncy5pdGVyYXRpb25zfS4uLmApO1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnaHR0cDovLzEyNy4wLjAuMToxMjM0L3Byb2Nlc3MnLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIG5vdGVzOiBub3RlcyxcbiAgICAgICAgICBzZXR0aW5nczoge1xuICAgICAgICAgICAgcGVycGxleGl0eTogdGhpcy5zZXR0aW5ncy5wZXJwbGV4aXR5LFxuICAgICAgICAgICAgaXRlcmF0aW9uczogdGhpcy5zZXR0aW5ncy5pdGVyYXRpb25zLFxuICAgICAgICAgICAgbGVhcm5pbmdfcmF0ZTogdGhpcy5zZXR0aW5ncy5lcHNpbG9uXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgcmVzcG9uZGVkIHdpdGggc3RhdHVzOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgXG4gICAgICBpZiAocmVzdWx0LmVycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgU2VydmVyIGVycm9yOiAke3Jlc3VsdC5lcnJvcn1gKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoJ1Zpc3VhbGl6aW5nIHJlc3VsdHMuLi4nKTtcbiAgICAgIFxuICAgICAgLy8gRGVidWcgLSBsb2cgdGhlIHJlc3VsdCBzdHJ1Y3R1cmUgdG8gY2hlY2sgbWV0YWRhdGFcbiAgICAgIGNvbnNvbGUubG9nKCdWaXN1YWxpemluZyByZXN1bHQgd2l0aCBtZXRhZGF0YTonLCByZXN1bHQpO1xuICAgICAgLy8gQ2hlY2sgaWYgd2UgaGF2ZSBhZGRpdGlvbmFsIG1ldGFkYXRhXG4gICAgICBpZiAocmVzdWx0LnBvaW50cyAmJiByZXN1bHQucG9pbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3Qgc2FtcGxlUG9pbnQgPSByZXN1bHQucG9pbnRzWzBdO1xuICAgICAgICBjb25zb2xlLmxvZygnU2FtcGxlIHBvaW50IG1ldGFkYXRhOicsIHtcbiAgICAgICAgICBoYXNXb3JkQ291bnQ6IHNhbXBsZVBvaW50LndvcmRDb3VudCAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc010aW1lOiBzYW1wbGVQb2ludC5tdGltZSAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc0N0aW1lOiBzYW1wbGVQb2ludC5jdGltZSAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc1RhZ3M6IHNhbXBsZVBvaW50LnRhZ3MgIT09IHVuZGVmaW5lZCxcbiAgICAgICAgICBoYXNDb250ZW50UHJldmlldzogc2FtcGxlUG9pbnQuY29udGVudFByZXZpZXcgIT09IHVuZGVmaW5lZCxcbiAgICAgICAgICBoYXNEaXN0YW5jZVRvQ2VudGVyOiBzYW1wbGVQb2ludC5kaXN0YW5jZVRvQ2VudGVyICE9PSB1bmRlZmluZWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFN0b3JlIHRoZSByZXN1bHQgZm9yIGxhdGVyIHVzZSBpbiBsaW5rIHN1Z2dlc3Rpb25zXG4gICAgICB0aGlzLmxhc3RSZXN1bHQgPSByZXN1bHQ7XG4gICAgICBcbiAgICAgIC8vIFZpc3VhbGl6ZSB0aGUgcmVzdWx0XG4gICAgICB0aGlzLnZpc3VhbGl6ZVJlc3VsdChyZXN1bHQpO1xuICAgICAgXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhgVmlzdWFsaXphdGlvbiBjb21wbGV0ZSEgRGlzcGxheWluZyAke3Jlc3VsdC5wb2ludHMubGVuZ3RofSBub3Rlcy5gKTtcbiAgICAgIG5ldyBOb3RpY2UoJ3QtU05FIGFuYWx5c2lzIGNvbXBsZXRlIScpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBydW5uaW5nIHQtU05FIGFuYWx5c2lzOicsIGVycm9yKTtcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGBFcnJvcjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgbmV3IE5vdGljZShgdC1TTkUgYW5hbHlzaXMgZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIHVwZGF0ZVN0YXR1cyhtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICAvLyBGaW5kIHRoZSBzdGF0dXMgZWxlbWVudCBpbiB0aGUgdmlldyBhbmQgdXBkYXRlIGl0XG4gICAgY29uc3Qgc3RhdHVzRWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN0c25lLXN0YXR1cyAudHNuZS1zdGF0dXMtdGV4dCcpO1xuICAgIGlmIChzdGF0dXNFbGVtZW50KSB7XG4gICAgICBzdGF0dXNFbGVtZW50LnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICB9XG4gICAgY29uc29sZS5sb2coYFN0YXR1czogJHttZXNzYWdlfWApO1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIHZpc3VhbGl6ZVJlc3VsdChyZXN1bHQ6IGFueSkge1xuICAgIC8vIEdldCBvciBjcmVhdGUgdGhlIHZpc3VhbGl6YXRpb24gdmlld1xuICAgIGxldCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfVFNORSlbMF07XG4gICAgaWYgKCFsZWFmKSB7XG4gICAgICAvLyBBY3RpdmF0ZSB0aGUgdmlldyBpZiBub3QgZm91bmRcbiAgICAgIGF3YWl0IHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgICAvLyBUcnkgdG8gZ2V0IHRoZSBsZWFmIGFnYWluXG4gICAgICBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfVFNORSlbMF07XG4gICAgICBcbiAgICAgIGlmICghbGVhZikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdDb3VsZCBub3QgY3JlYXRlIHZpc3VhbGl6YXRpb24gdmlldycpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIEFjY2VzcyB0aGUgdmlldyBjb250YWluZXJcbiAgICBjb25zdCB2aWV3ID0gbGVhZi52aWV3IGFzIFRTTkVWaWV3O1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IHZpZXcuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJyN0c25lLWNvbnRhaW5lcicpIGFzIEhUTUxFbGVtZW50O1xuICAgIGlmICghY29udGFpbmVyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdDb250YWluZXIgbm90IGZvdW5kIGluIHZpZXcnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgLy8gQ2xlYXIgYW55IGV4aXN0aW5nIGNvbnRlbnRcbiAgICB3aGlsZSAoY29udGFpbmVyLmZpcnN0Q2hpbGQpIHtcbiAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZChjb250YWluZXIuZmlyc3RDaGlsZCk7XG4gICAgfVxuICAgIFxuICAgIC8vIENyZWF0ZSB0aGUgdmlzdWFsaXplclxuICAgIGNvbnN0IG9wZW5DYWxsYmFjayA9IChwYXRoOiBzdHJpbmcpID0+IHtcbiAgICAgIC8vIE9wZW4gdGhlIHNlbGVjdGVkIG5vdGVcbiAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCk7XG4gICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKCkub3BlbkZpbGUoZmlsZSk7XG4gICAgICB9XG4gICAgfTtcbiAgICBcbiAgICAvLyBDcmVhdGUgYW5kIHVzZSB0aGUgdmlzdWFsaXplciBkaXJlY3RseVxuICAgIGNvbnN0IHZpc3VhbGl6ZXIgPSBuZXcgVFNORVZpc3VhbGl6ZXIoY29udGFpbmVyLCBvcGVuQ2FsbGJhY2spO1xuICAgIHZpc3VhbGl6ZXIuc2V0RGF0YShyZXN1bHQpO1xuICB9XG4gIFxuICAvLyBNZXRob2QgdG8gc3VnZ2VzdCBsaW5rcyBiZXR3ZWVuIG5vdGVzIHVzaW5nIExMTVxuICBhc3luYyBzdWdnZXN0TGlua3MoKSB7XG4gICAgaWYgKCF0aGlzLmxhc3RSZXN1bHQgfHwgIXRoaXMubGFzdFJlc3VsdC5wb2ludHMgfHwgdGhpcy5sYXN0UmVzdWx0LnBvaW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIG5ldyBOb3RpY2UoJ1BsZWFzZSBydW4gdC1TTkUgYW5hbHlzaXMgZmlyc3QgdG8gZ2VuZXJhdGUgbm90ZSBkYXRhJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIC8vIFNob3cgYSBub3RpY2UgdGhhdCB3ZSdyZSBzdGFydGluZyB0aGUgcHJvY2Vzc1xuICAgIG5ldyBOb3RpY2UoJ0ZpbmRpbmcgcG90ZW50aWFsIG5vdGUgY29ubmVjdGlvbnMuLi4nKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgLy8gRmluZCBwb3RlbnRpYWwgY29ubmVjdGlvbnMgYmFzZWQgb24gdC1TTkUgcHJveGltaXR5IGFuZCBjbHVzdGVyaW5nXG4gICAgICBjb25zdCBjb25uZWN0aW9ucyA9IHRoaXMuZmluZFBvdGVudGlhbENvbm5lY3Rpb25zKHRoaXMubGFzdFJlc3VsdCk7XG4gICAgICBcbiAgICAgIGlmIChjb25uZWN0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgbmV3IE5vdGljZSgnTm8gc3Ryb25nIGNvbm5lY3Rpb25zIGZvdW5kIGJldHdlZW4gbm90ZXMnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBDcmVhdGUgYSBtb2RhbCB0byBkaXNwbGF5IHRoZSBzdWdnZXN0ZWQgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG1vZGFsID0gbmV3IFN1Z2dlc3RlZExpbmtzTW9kYWwodGhpcy5hcHAsIGNvbm5lY3Rpb25zLCB0aGlzKTtcbiAgICAgIG1vZGFsLm9wZW4oKTtcbiAgICAgIFxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzdWdnZXN0aW5nIGxpbmtzOicsIGVycm9yKTtcbiAgICAgIG5ldyBOb3RpY2UoYEVycm9yIHN1Z2dlc3RpbmcgbGlua3M6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbiAgXG4gIC8vIFN0b3JlIHRoZSBsYXN0IHJlc3VsdCBmb3IgdXNlIGluIGxpbmsgc3VnZ2VzdGlvbnNcbiAgcHJpdmF0ZSBsYXN0UmVzdWx0OiBhbnkgPSBudWxsO1xuICBcbiAgLy8gRmluZCBwb3RlbnRpYWwgY29ubmVjdGlvbnMgYmV0d2VlbiBub3RlcyBiYXNlZCBvbiB0LVNORSByZXN1bHRzXG4gIHByaXZhdGUgZmluZFBvdGVudGlhbENvbm5lY3Rpb25zKHJlc3VsdDogYW55KTogTm90ZUNvbm5lY3Rpb25bXSB7XG4gICAgY29uc3QgY29ubmVjdGlvbnM6IE5vdGVDb25uZWN0aW9uW10gPSBbXTtcbiAgICBjb25zdCBwb2ludHMgPSByZXN1bHQucG9pbnRzIGFzIFRTTkVQb2ludFtdO1xuICAgIFxuICAgIC8vIDEuIEZpbmQgbm90ZXMgaW4gdGhlIHNhbWUgY2x1c3RlclxuICAgIGNvbnN0IGNsdXN0ZXJHcm91cHM6IHsgW2tleTogbnVtYmVyXTogVFNORVBvaW50W10gfSA9IHt9O1xuICAgIFxuICAgIC8vIEdyb3VwIHBvaW50cyBieSBjbHVzdGVyXG4gICAgZm9yIChjb25zdCBwb2ludCBvZiBwb2ludHMpIHtcbiAgICAgIGlmIChwb2ludC5jbHVzdGVyID09PSAtMSkgY29udGludWU7IC8vIFNraXAgdW5jbHVzdGVyZWQgcG9pbnRzXG4gICAgICBcbiAgICAgIGlmICghY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXSkge1xuICAgICAgICBjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdID0gW107XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0ucHVzaChwb2ludCk7XG4gICAgfVxuICAgIFxuICAgIC8vIEZvciBlYWNoIGNsdXN0ZXIsIGZpbmQgdGhlIG1vc3QgY2VudHJhbCBub3Rlc1xuICAgIE9iamVjdC5lbnRyaWVzKGNsdXN0ZXJHcm91cHMpLmZvckVhY2goKFtjbHVzdGVySWQsIGNsdXN0ZXJQb2ludHNdKSA9PiB7XG4gICAgICAvLyBPbmx5IGNvbnNpZGVyIGNsdXN0ZXJzIHdpdGggYXQgbGVhc3QgMiBub3Rlc1xuICAgICAgaWYgKGNsdXN0ZXJQb2ludHMubGVuZ3RoIDwgMikgcmV0dXJuO1xuICAgICAgXG4gICAgICAvLyBGaW5kIG1vc3QgY2VudHJhbCBub3RlcyBpbiB0aGUgY2x1c3RlciAoY2xvc2VzdCB0byBjbHVzdGVyIGNlbnRlcilcbiAgICAgIGNsdXN0ZXJQb2ludHMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBkaXN0QSA9IGEuZGlzdGFuY2VUb0NlbnRlciB8fCBJbmZpbml0eTtcbiAgICAgICAgY29uc3QgZGlzdEIgPSBiLmRpc3RhbmNlVG9DZW50ZXIgfHwgSW5maW5pdHk7XG4gICAgICAgIHJldHVybiBkaXN0QSAtIGRpc3RCO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIFRha2UgdGhlIG1vc3QgY2VudHJhbCBub3Rlc1xuICAgICAgY29uc3QgY2VudHJhbE5vdGVzID0gY2x1c3RlclBvaW50cy5zbGljZSgwLCBNYXRoLm1pbigzLCBjbHVzdGVyUG9pbnRzLmxlbmd0aCkpO1xuICAgICAgXG4gICAgICAvLyBDcmVhdGUgY29ubmVjdGlvbnMgYmV0d2VlbiB0aGUgY2VudHJhbCBub3Rlc1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjZW50cmFsTm90ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZm9yIChsZXQgaiA9IGkgKyAxOyBqIDwgY2VudHJhbE5vdGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgY29uc3Qgbm90ZUEgPSBjZW50cmFsTm90ZXNbaV07XG4gICAgICAgICAgY29uc3Qgbm90ZUIgPSBjZW50cmFsTm90ZXNbal07XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gU2tpcCBpZiB0aGUgdHdvIG5vdGVzIGFyZSB2ZXJ5IGZhciBhcGFydCBpbiB0aGUgdmlzdWFsaXphdGlvblxuICAgICAgICAgIGNvbnN0IGRpc3RhbmNlID0gTWF0aC5zcXJ0KFxuICAgICAgICAgICAgTWF0aC5wb3cobm90ZUEueCAtIG5vdGVCLngsIDIpICsgTWF0aC5wb3cobm90ZUEueSAtIG5vdGVCLnksIDIpXG4gICAgICAgICAgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoZGlzdGFuY2UgPiAwLjUpIGNvbnRpbnVlOyAvLyBTa2lwIGlmIHRvbyBmYXJcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBDYWxjdWxhdGUgYSBzaW1pbGFyaXR5IHNjb3JlICgwLTEwMClcbiAgICAgICAgICBjb25zdCBzaW1pbGFyaXR5ID0gMTAwIC0gTWF0aC5taW4oMTAwLCBkaXN0YW5jZSAqIDEwMCk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gRmluZCBjb21tb24gdGVybXNcbiAgICAgICAgICBjb25zdCBjb21tb25UZXJtcyA9IG5vdGVBLnRvcF90ZXJtcy5maWx0ZXIodGVybSA9PiBcbiAgICAgICAgICAgIG5vdGVCLnRvcF90ZXJtcy5pbmNsdWRlcyh0ZXJtKVxuICAgICAgICAgICk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgICBzb3VyY2VOb3RlOiBub3RlQSxcbiAgICAgICAgICAgIHRhcmdldE5vdGU6IG5vdGVCLFxuICAgICAgICAgICAgc2ltaWxhcml0eTogc2ltaWxhcml0eSxcbiAgICAgICAgICAgIGNvbW1vblRlcm1zOiBjb21tb25UZXJtcyxcbiAgICAgICAgICAgIGNsdXN0ZXJUZXJtczogcmVzdWx0LmNsdXN0ZXJfdGVybXM/LltjbHVzdGVySWRdPy5zbGljZSgwLCA1KS5tYXAoKHQ6IGFueSkgPT4gdC50ZXJtKSB8fCBbXSxcbiAgICAgICAgICAgIHJlYXNvbjogYEJvdGggbm90ZXMgYXJlIGNlbnRyYWwgaW4gY2x1c3RlciAke2NsdXN0ZXJJZH1gXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICAvLyAyLiBGaW5kIG5vdGVzIHRoYXQgYXJlIGNsb3NlIGluIHRoZSB0LVNORSBwcm9qZWN0aW9uIGJ1dCBtYXkgYmUgaW4gZGlmZmVyZW50IGNsdXN0ZXJzXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IHBvaW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICBjb25zdCBub3RlQSA9IHBvaW50c1tpXTtcbiAgICAgICAgY29uc3Qgbm90ZUIgPSBwb2ludHNbal07XG4gICAgICAgIFxuICAgICAgICAvLyBTa2lwIG5vdGVzIGluIHRoZSBzYW1lIGNsdXN0ZXIgKGFscmVhZHkgaGFuZGxlZCBhYm92ZSlcbiAgICAgICAgaWYgKG5vdGVBLmNsdXN0ZXIgIT09IC0xICYmIG5vdGVBLmNsdXN0ZXIgPT09IG5vdGVCLmNsdXN0ZXIpIGNvbnRpbnVlO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2FsY3VsYXRlIEV1Y2xpZGVhbiBkaXN0YW5jZSBpbiB0LVNORSBzcGFjZVxuICAgICAgICBjb25zdCBkaXN0YW5jZSA9IE1hdGguc3FydChcbiAgICAgICAgICBNYXRoLnBvdyhub3RlQS54IC0gbm90ZUIueCwgMikgKyBNYXRoLnBvdyhub3RlQS55IC0gbm90ZUIueSwgMilcbiAgICAgICAgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIE9ubHkgY29uc2lkZXIgdmVyeSBjbG9zZSBub3Rlc1xuICAgICAgICBpZiAoZGlzdGFuY2UgPiAwLjIpIGNvbnRpbnVlO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2FsY3VsYXRlIGEgc2ltaWxhcml0eSBzY29yZSAoMC0xMDApXG4gICAgICAgIGNvbnN0IHNpbWlsYXJpdHkgPSAxMDAgLSBNYXRoLm1pbigxMDAsIGRpc3RhbmNlICogMjAwKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEZpbmQgY29tbW9uIHRlcm1zXG4gICAgICAgIGNvbnN0IGNvbW1vblRlcm1zID0gbm90ZUEudG9wX3Rlcm1zLmZpbHRlcih0ZXJtID0+IFxuICAgICAgICAgIG5vdGVCLnRvcF90ZXJtcy5pbmNsdWRlcyh0ZXJtKVxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgLy8gT25seSBpbmNsdWRlIGlmIHRoZXkgaGF2ZSBjb21tb24gdGVybXNcbiAgICAgICAgaWYgKGNvbW1vblRlcm1zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIHNvdXJjZU5vdGU6IG5vdGVBLFxuICAgICAgICAgICAgdGFyZ2V0Tm90ZTogbm90ZUIsXG4gICAgICAgICAgICBzaW1pbGFyaXR5OiBzaW1pbGFyaXR5LFxuICAgICAgICAgICAgY29tbW9uVGVybXM6IGNvbW1vblRlcm1zLFxuICAgICAgICAgICAgY2x1c3RlclRlcm1zOiBbXSxcbiAgICAgICAgICAgIHJlYXNvbjogYE5vdGVzIGFyZSB2ZXJ5IGNsb3NlIGluIHRoZSB2aXN1YWxpemF0aW9uIGFuZCBzaGFyZSBjb21tb24gdGVybXNgXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gU29ydCBjb25uZWN0aW9ucyBieSBzaW1pbGFyaXR5IChoaWdoZXN0IGZpcnN0KVxuICAgIGNvbm5lY3Rpb25zLnNvcnQoKGEsIGIpID0+IGIuc2ltaWxhcml0eSAtIGEuc2ltaWxhcml0eSk7XG4gICAgXG4gICAgLy8gUmV0dXJuIHRvcCAxMCBjb25uZWN0aW9ucyB0byBhdm9pZCBvdmVyd2hlbG1pbmcgdGhlIHVzZXJcbiAgICByZXR1cm4gY29ubmVjdGlvbnMuc2xpY2UoMCwgMTApO1xuICB9XG4gIFxuICAvLyBDcmVhdGUgYSBsaW5rIGJldHdlZW4gdHdvIG5vdGVzXG4gIGFzeW5jIGNyZWF0ZU5vdGVMaW5rKHNvdXJjZU5vdGVQYXRoOiBzdHJpbmcsIHRhcmdldE5vdGVQYXRoOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcpIHtcbiAgICB0cnkge1xuICAgICAgLy8gR2V0IHRoZSBzb3VyY2UgZmlsZVxuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChzb3VyY2VOb3RlUGF0aCk7XG4gICAgICBpZiAoIShzb3VyY2VGaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgU291cmNlIGZpbGUgbm90IGZvdW5kOiAke3NvdXJjZU5vdGVQYXRofWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBSZWFkIHRoZSBmaWxlIGNvbnRlbnRcbiAgICAgIGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKHNvdXJjZUZpbGUpO1xuICAgICAgXG4gICAgICAvLyBHZW5lcmF0ZSB0aGUgbGluayB0ZXh0IHdpdGggdGhlIGZvcm1hdHRlZCBjb25uZWN0aW9uIGRlc2NyaXB0aW9uXG4gICAgICBjb25zdCB0YXJnZXRGaWxlTmFtZSA9IHRhcmdldE5vdGVQYXRoLnNwbGl0KCcvJykucG9wKCkgfHwgdGFyZ2V0Tm90ZVBhdGg7XG4gICAgICBjb25zdCBsaW5rVGV4dCA9IGBcXG5cXG4jIyBSZWxhdGVkIE5vdGVzXFxuXFxuLSBbWyR7dGFyZ2V0RmlsZU5hbWV9XV0gLSAke2Rlc2NyaXB0aW9uLnRyaW0oKX1cXG5gO1xuICAgICAgXG4gICAgICAvLyBBcHBlbmQgdGhlIGxpbmsgdG8gdGhlIHNvdXJjZSBmaWxlXG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoc291cmNlRmlsZSwgc291cmNlQ29udGVudCArIGxpbmtUZXh0KTtcbiAgICAgIFxuICAgICAgLy8gT3BlbiB0aGUgc291cmNlIGZpbGUgaW4gYSBuZXcgcGFuZSB0byBzaG93IHRoZSBsaW5rXG4gICAgICBjb25zdCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoXG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmICE9PSBudWxsICYmIFxuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZiAhPT0gdW5kZWZpbmVkXG4gICAgICApO1xuICAgICAgXG4gICAgICBhd2FpdCBsZWFmLm9wZW5GaWxlKHNvdXJjZUZpbGUsIHsgXG4gICAgICAgIGFjdGl2ZTogdHJ1ZSwgICAvLyBNYWtlIHRoZSBwYW5lIGFjdGl2ZVxuICAgICAgICBlU3RhdGU6IHsgICAgICAgLy8gVHJ5IHRvIHNjcm9sbCB0byB0aGUgbmV3bHkgYWRkZWQgbGlua1xuICAgICAgICAgIGxpbmU6IHNvdXJjZUNvbnRlbnQuc3BsaXQoJ1xcbicpLmxlbmd0aCArIDIsIC8vIEFwcHJveGltYXRlIGxpbmUgbnVtYmVyIG9mIHRoZSBuZXcgbGlua1xuICAgICAgICAgIGZvY3VzOiB0cnVlICAgLy8gRm9jdXMgdGhlIGVkaXRvclxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gU2hvdyBhIHN1Y2Nlc3Mgbm90aWNlXG4gICAgICBuZXcgTm90aWNlKFwiTGluayBjcmVhdGVkIHN1Y2Nlc3NmdWxseSEg8J+Ul1wiLCAyMDAwKTtcbiAgICAgIFxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNyZWF0aW5nIG5vdGUgbGluazonLCBlcnJvcik7XG4gICAgICBuZXcgTm90aWNlKGBGYWlsZWQgdG8gY3JlYXRlIGxpbms6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbn1cblxuLy8gSW50ZXJmYWNlIGZvciB0LVNORSByZXN1bHQgcG9pbnRzXG5pbnRlcmZhY2UgVFNORVBvaW50IHtcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIHBhdGg6IHN0cmluZztcbiAgdG9wX3Rlcm1zOiBzdHJpbmdbXTtcbiAgY2x1c3RlcjogbnVtYmVyOyAvLyBDbHVzdGVyIElEICgtMSBtZWFucyBub2lzZS9ub3QgY2x1c3RlcmVkKVxuICBcbiAgLy8gQWRkaXRpb25hbCBtZXRhZGF0YVxuICBtdGltZT86IG51bWJlcjsgICAgICAvLyBMYXN0IG1vZGlmaWVkIHRpbWVcbiAgY3RpbWU/OiBudW1iZXI7ICAgICAgLy8gQ3JlYXRpb24gdGltZVxuICB3b3JkQ291bnQ/OiBudW1iZXI7ICAvLyBXb3JkIGNvdW50XG4gIHJlYWRpbmdUaW1lPzogbnVtYmVyOyAvLyBFc3RpbWF0ZWQgcmVhZGluZyB0aW1lIGluIG1pbnV0ZXMgIFxuICB0YWdzPzogc3RyaW5nW107ICAgICAvLyBOb3RlIHRhZ3NcbiAgY29udGVudFByZXZpZXc/OiBzdHJpbmc7IC8vIFNob3J0IHByZXZpZXcgb2YgY29udGVudFxuICBkaXN0YW5jZVRvQ2VudGVyPzogbnVtYmVyOyAvLyBEaXN0YW5jZSB0byBjbHVzdGVyIGNlbnRlclxufVxuXG4vLyBJbnRlcmZhY2UgZm9yIGNsdXN0ZXIgdGVybSBpbmZvcm1hdGlvblxuaW50ZXJmYWNlIENsdXN0ZXJUZXJtIHtcbiAgdGVybTogc3RyaW5nO1xuICBzY29yZTogbnVtYmVyO1xufVxuXG4vLyBJbnRlcmZhY2UgZm9yIGNsdXN0ZXIgaW5mb3JtYXRpb25cbmludGVyZmFjZSBDbHVzdGVySW5mbyB7XG4gIFtrZXk6IHN0cmluZ106IENsdXN0ZXJUZXJtW107XG59XG5cbi8vIEludGVyZmFjZSBmb3IgdC1TTkUgcmVzdWx0c1xuaW50ZXJmYWNlIFRTTkVSZXN1bHQge1xuICBwb2ludHM6IFRTTkVQb2ludFtdO1xuICBmZWF0dXJlX25hbWVzOiBzdHJpbmdbXTtcbiAgY2x1c3RlcnM6IG51bWJlcjtcbiAgY2x1c3Rlcl90ZXJtczogQ2x1c3RlckluZm87XG59XG5cbmNsYXNzIFRTTkVWaXN1YWxpemVyIHtcbiAgcHJpdmF0ZSBjb250YWluZXI6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQ7XG4gIHByaXZhdGUgY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG4gIHByaXZhdGUgcmVzdWx0OiBUU05FUmVzdWx0IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgd2lkdGggPSA4MDA7XG4gIHByaXZhdGUgaGVpZ2h0ID0gNjAwO1xuICBwcml2YXRlIHBvaW50UmFkaXVzID0gMTA7XG4gIHByaXZhdGUgbW91c2VYID0gMDtcbiAgcHJpdmF0ZSBtb3VzZVkgPSAwO1xuICBwcml2YXRlIHNjYWxlID0gMTtcbiAgcHJpdmF0ZSBvZmZzZXRYID0gMDtcbiAgcHJpdmF0ZSBvZmZzZXRZID0gMDtcbiAgcHJpdmF0ZSBpc0RyYWdnaW5nID0gZmFsc2U7XG4gIHByaXZhdGUgbGFzdFggPSAwO1xuICBwcml2YXRlIGxhc3RZID0gMDtcbiAgcHJpdmF0ZSBob3ZlcmVkUG9pbnQ6IFRTTkVQb2ludCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIG9wZW5DYWxsYmFjazogKHBhdGg6IHN0cmluZykgPT4gdm9pZDtcblxuICBjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBvcGVuQ2FsbGJhY2s6IChwYXRoOiBzdHJpbmcpID0+IHZvaWQpIHtcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICB0aGlzLm9wZW5DYWxsYmFjayA9IG9wZW5DYWxsYmFjaztcbiAgICBcbiAgICAvLyBDcmVhdGUgY2FudmFzIGVsZW1lbnRcbiAgICB0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIHRoaXMuY2FudmFzLndpZHRoID0gdGhpcy53aWR0aDtcbiAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSB0aGlzLmhlaWdodDtcbiAgICB0aGlzLmNhbnZhcy5jbGFzc0xpc3QuYWRkKCd0c25lLWNhbnZhcycpO1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLmJvcmRlciA9ICcxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpJztcbiAgICBcbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBpZiAoIWNvbnRleHQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGNyZWF0ZSBjYW52YXMgY29udGV4dCcpO1xuICAgIH1cbiAgICB0aGlzLmN0eCA9IGNvbnRleHQ7XG4gICAgXG4gICAgLy8gQ2xlYXIgdGhlIGNvbnRhaW5lciBmaXJzdFxuICAgIHdoaWxlICh0aGlzLmNvbnRhaW5lci5maXJzdENoaWxkKSB7XG4gICAgICB0aGlzLmNvbnRhaW5lci5yZW1vdmVDaGlsZCh0aGlzLmNvbnRhaW5lci5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQWRkIGNhbnZhcyB0byBjb250YWluZXJcbiAgICB0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLmNhbnZhcyk7XG4gICAgXG4gICAgLy8gQWRkIGV2ZW50IGxpc3RlbmVyc1xuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnMoKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhZGRFdmVudExpc3RlbmVycygpIHtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmhhbmRsZU1vdXNlTW92ZS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuaGFuZGxlQ2xpY2suYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignd2hlZWwnLCB0aGlzLmhhbmRsZVdoZWVsLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMuaGFuZGxlTW91c2VEb3duLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmhhbmRsZU1vdXNlVXAuYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsIHRoaXMuaGFuZGxlTW91c2VVcC5iaW5kKHRoaXMpKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZU1vdmUoZTogTW91c2VFdmVudCkge1xuICAgIGNvbnN0IHJlY3QgPSB0aGlzLmNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB0aGlzLm1vdXNlWCA9IGUuY2xpZW50WCAtIHJlY3QubGVmdDtcbiAgICB0aGlzLm1vdXNlWSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xuICAgIFxuICAgIGlmICh0aGlzLmlzRHJhZ2dpbmcpIHtcbiAgICAgIGNvbnN0IGR4ID0gdGhpcy5tb3VzZVggLSB0aGlzLmxhc3RYO1xuICAgICAgY29uc3QgZHkgPSB0aGlzLm1vdXNlWSAtIHRoaXMubGFzdFk7XG4gICAgICBcbiAgICAgIHRoaXMub2Zmc2V0WCArPSBkeDtcbiAgICAgIHRoaXMub2Zmc2V0WSArPSBkeTtcbiAgICAgIFxuICAgICAgdGhpcy5sYXN0WCA9IHRoaXMubW91c2VYO1xuICAgICAgdGhpcy5sYXN0WSA9IHRoaXMubW91c2VZO1xuICAgICAgXG4gICAgICB0aGlzLmRyYXcoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51cGRhdGVIb3ZlcmVkUG9pbnQoKTtcbiAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVDbGljayhlOiBNb3VzZUV2ZW50KSB7XG4gICAgaWYgKHRoaXMuaG92ZXJlZFBvaW50KSB7XG4gICAgICB0aGlzLm9wZW5DYWxsYmFjayh0aGlzLmhvdmVyZWRQb2ludC5wYXRoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgaGFuZGxlV2hlZWwoZTogV2hlZWxFdmVudCkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBcbiAgICBjb25zdCBkZWx0YSA9IGUuZGVsdGFZID4gMCA/IDAuOSA6IDEuMTtcbiAgICB0aGlzLnNjYWxlICo9IGRlbHRhO1xuICAgIFxuICAgIC8vIExpbWl0IHpvb21cbiAgICB0aGlzLnNjYWxlID0gTWF0aC5tYXgoMC4xLCBNYXRoLm1pbig1LCB0aGlzLnNjYWxlKSk7XG4gICAgXG4gICAgdGhpcy5kcmF3KCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgaGFuZGxlTW91c2VEb3duKGU6IE1vdXNlRXZlbnQpIHtcbiAgICB0aGlzLmlzRHJhZ2dpbmcgPSB0cnVlO1xuICAgIHRoaXMubGFzdFggPSB0aGlzLm1vdXNlWDtcbiAgICB0aGlzLmxhc3RZID0gdGhpcy5tb3VzZVk7XG4gICAgdGhpcy5jYW52YXMuc3R5bGUuY3Vyc29yID0gJ2dyYWJiaW5nJztcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZVVwKGU6IE1vdXNlRXZlbnQpIHtcbiAgICB0aGlzLmlzRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS5jdXJzb3IgPSB0aGlzLmhvdmVyZWRQb2ludCA/ICdwb2ludGVyJyA6ICdkZWZhdWx0JztcbiAgfVxuICBcbiAgcHJpdmF0ZSB1cGRhdGVIb3ZlcmVkUG9pbnQoKSB7XG4gICAgaWYgKCF0aGlzLnJlc3VsdCkgcmV0dXJuO1xuICAgIFxuICAgIHRoaXMuaG92ZXJlZFBvaW50ID0gbnVsbDtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgY29uc3QgW3NjcmVlblgsIHNjcmVlblldID0gdGhpcy53b3JsZFRvU2NyZWVuKHBvaW50LngsIHBvaW50LnkpO1xuICAgICAgY29uc3QgZGlzdGFuY2UgPSBNYXRoLnNxcnQoXG4gICAgICAgIE1hdGgucG93KHNjcmVlblggLSB0aGlzLm1vdXNlWCwgMikgKyBcbiAgICAgICAgTWF0aC5wb3coc2NyZWVuWSAtIHRoaXMubW91c2VZLCAyKVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgaWYgKGRpc3RhbmNlIDw9IHRoaXMucG9pbnRSYWRpdXMpIHtcbiAgICAgICAgdGhpcy5ob3ZlcmVkUG9pbnQgPSBwb2ludDtcbiAgICAgICAgdGhpcy5jYW52YXMuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHRoaXMuY2FudmFzLnN0eWxlLmN1cnNvciA9IHRoaXMuaXNEcmFnZ2luZyA/ICdncmFiYmluZycgOiAnZGVmYXVsdCc7XG4gIH1cbiAgXG4gIC8vIENvbnZlcnRzIHdvcmxkIHNwYWNlICh0LVNORSkgY29vcmRpbmF0ZXMgdG8gc2NyZWVuIGNvb3JkaW5hdGVzXG4gIHByaXZhdGUgd29ybGRUb1NjcmVlbih4OiBudW1iZXIsIHk6IG51bWJlcik6IFtudW1iZXIsIG51bWJlcl0ge1xuICAgIC8vIE5vcm1hbGl6ZSB0byBjZW50ZXIgb2Ygc2NyZWVuXG4gICAgY29uc3QgY2VudGVyWCA9IHRoaXMud2lkdGggLyAyO1xuICAgIGNvbnN0IGNlbnRlclkgPSB0aGlzLmhlaWdodCAvIDI7XG4gICAgXG4gICAgLy8gQXBwbHkgc2NhbGUgYW5kIG9mZnNldFxuICAgIGNvbnN0IHNjcmVlblggPSB4ICogdGhpcy5zY2FsZSAqIDEwMCArIGNlbnRlclggKyB0aGlzLm9mZnNldFg7XG4gICAgY29uc3Qgc2NyZWVuWSA9IHkgKiB0aGlzLnNjYWxlICogMTAwICsgY2VudGVyWSArIHRoaXMub2Zmc2V0WTtcbiAgICBcbiAgICByZXR1cm4gW3NjcmVlblgsIHNjcmVlblldO1xuICB9XG4gIFxuICBwdWJsaWMgc2V0RGF0YShyZXN1bHQ6IFRTTkVSZXN1bHQpIHtcbiAgICB0aGlzLnJlc3VsdCA9IHJlc3VsdDtcbiAgICB0aGlzLnJlc2V0VmlldygpO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG4gIFxuICBwcml2YXRlIHJlc2V0VmlldygpIHtcbiAgICB0aGlzLnNjYWxlID0gMTtcbiAgICB0aGlzLm9mZnNldFggPSAwO1xuICAgIHRoaXMub2Zmc2V0WSA9IDA7XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhdygpIHtcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgLy8gQ2xlYXIgY2FudmFzXG4gICAgdGhpcy5jdHguY2xlYXJSZWN0KDAsIDAsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcbiAgICBcbiAgICAvLyBEcmF3IGJhY2tncm91bmQgZ3JpZFxuICAgIHRoaXMuZHJhd0dyaWQoKTtcbiAgICBcbiAgICAvLyBGaW5kIGNsdXN0ZXJzIHVzaW5nIGEgc2ltcGxlIGRpc3RhbmNlIG1ldHJpY1xuICAgIGNvbnN0IGNsdXN0ZXJzID0gdGhpcy5maW5kQ2x1c3RlcnMoKTtcbiAgICBcbiAgICAvLyBEcmF3IGNsdXN0ZXJzIGZpcnN0ICh1bmRlcm5lYXRoIHBvaW50cylcbiAgICB0aGlzLmRyYXdDbHVzdGVycyhjbHVzdGVycyk7XG4gICAgXG4gICAgLy8gRHJhdyBwb2ludHNcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgdGhpcy5kcmF3UG9pbnQocG9pbnQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBEcmF3IHRvb2x0aXAgZm9yIGhvdmVyZWQgcG9pbnRcbiAgICBpZiAodGhpcy5ob3ZlcmVkUG9pbnQpIHtcbiAgICAgIHRoaXMuZHJhd1Rvb2x0aXAoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhd0dyaWQoKSB7XG4gICAgY29uc3QgZ3JpZFNpemUgPSA1MCAqIHRoaXMuc2NhbGU7XG4gICAgXG4gICAgdGhpcy5jdHguc3Ryb2tlU3R5bGUgPSAncmdiYSh2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlci1yZ2IpLCAwLjMpJztcbiAgICB0aGlzLmN0eC5saW5lV2lkdGggPSAxO1xuICAgIFxuICAgIC8vIFZlcnRpY2FsIGxpbmVzXG4gICAgZm9yIChsZXQgeCA9IHRoaXMub2Zmc2V0WCAlIGdyaWRTaXplOyB4IDwgdGhpcy53aWR0aDsgeCArPSBncmlkU2l6ZSkge1xuICAgICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgICB0aGlzLmN0eC5tb3ZlVG8oeCwgMCk7XG4gICAgICB0aGlzLmN0eC5saW5lVG8oeCwgdGhpcy5oZWlnaHQpO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgfVxuICAgIFxuICAgIC8vIEhvcml6b250YWwgbGluZXNcbiAgICBmb3IgKGxldCB5ID0gdGhpcy5vZmZzZXRZICUgZ3JpZFNpemU7IHkgPCB0aGlzLmhlaWdodDsgeSArPSBncmlkU2l6ZSkge1xuICAgICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgICB0aGlzLmN0eC5tb3ZlVG8oMCwgeSk7XG4gICAgICB0aGlzLmN0eC5saW5lVG8odGhpcy53aWR0aCwgeSk7XG4gICAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZmluZENsdXN0ZXJzKCkge1xuICAgIGlmICghdGhpcy5yZXN1bHQpIHJldHVybiBbXTtcbiAgICBcbiAgICAvLyBTaW1wbGUgY2x1c3RlcmluZyBiYXNlZCBvbiBkaXN0YW5jZVxuICAgIGNvbnN0IHBvaW50cyA9IHRoaXMucmVzdWx0LnBvaW50cztcbiAgICBjb25zdCBjbHVzdGVyczogVFNORVBvaW50W11bXSA9IFtdO1xuICAgIGNvbnN0IHZpc2l0ZWQgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgICBcbiAgICBjb25zdCBkaXN0YW5jZVRocmVzaG9sZCA9IDAuMjsgIC8vIEFkanVzdCB0aGlzIHRocmVzaG9sZCBhcyBuZWVkZWRcbiAgICBcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHZpc2l0ZWQuaGFzKGkpKSBjb250aW51ZTtcbiAgICAgIFxuICAgICAgY29uc3QgY2x1c3RlcjogVFNORVBvaW50W10gPSBbcG9pbnRzW2ldXTtcbiAgICAgIHZpc2l0ZWQuYWRkKGkpO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHBvaW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICBpZiAoaSA9PT0gaiB8fCB2aXNpdGVkLmhhcyhqKSkgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBkaXN0YW5jZSA9IE1hdGguc3FydChcbiAgICAgICAgICBNYXRoLnBvdyhwb2ludHNbaV0ueCAtIHBvaW50c1tqXS54LCAyKSArIFxuICAgICAgICAgIE1hdGgucG93KHBvaW50c1tpXS55IC0gcG9pbnRzW2pdLnksIDIpXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICBpZiAoZGlzdGFuY2UgPCBkaXN0YW5jZVRocmVzaG9sZCkge1xuICAgICAgICAgIGNsdXN0ZXIucHVzaChwb2ludHNbal0pO1xuICAgICAgICAgIHZpc2l0ZWQuYWRkKGopO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChjbHVzdGVyLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgY2x1c3RlcnMucHVzaChjbHVzdGVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGNsdXN0ZXJzO1xuICB9XG4gIFxuICBwcml2YXRlIGRyYXdDbHVzdGVycyhjbHVzdGVyczogVFNORVBvaW50W11bXSkge1xuICAgIC8vIFNraXAgaWYgbm8gcmVzdWx0IGRhdGFcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgLy8gQ29sb3IgcGFsZXR0ZSBmb3IgY2x1c3RlcnMgKGV4Y2x1ZGluZyBub2lzZSBwb2ludHMpXG4gICAgY29uc3QgY29sb3JzID0gW1xuICAgICAgeyBmaWxsOiAncmdiYSgyNTUsIDk5LCAxMzIsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDI1NSwgOTksIDEzMiwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoNTQsIDE2MiwgMjM1LCAwLjEpJywgc3Ryb2tlOiAncmdiYSg1NCwgMTYyLCAyMzUsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDI1NSwgMjA2LCA4NiwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMjU1LCAyMDYsIDg2LCAwLjUpJyB9LFxuICAgICAgeyBmaWxsOiAncmdiYSg3NSwgMTkyLCAxOTIsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDc1LCAxOTIsIDE5MiwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoMTUzLCAxMDIsIDI1NSwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMTUzLCAxMDIsIDI1NSwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoMjU1LCAxNTksIDY0LCAwLjEpJywgc3Ryb2tlOiAncmdiYSgyNTUsIDE1OSwgNjQsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDE5OSwgMTk5LCAxOTksIDAuMSknLCBzdHJva2U6ICdyZ2JhKDE5OSwgMTk5LCAxOTksIDAuNSknIH0sXG4gICAgXTtcbiAgICBcbiAgICAvLyBHcm91cCBwb2ludHMgYnkgY2x1c3RlciBJRCBmcm9tIHRoZSBzZXJ2ZXIgcmVzcG9uc2VcbiAgICBjb25zdCBjbHVzdGVyR3JvdXBzOiB7IFtrZXk6IG51bWJlcl06IFRTTkVQb2ludFtdIH0gPSB7fTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgaWYgKHBvaW50LmNsdXN0ZXIgPT09IC0xKSBjb250aW51ZTsgLy8gU2tpcCBub2lzZSBwb2ludHNcbiAgICAgIFxuICAgICAgaWYgKCFjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdKSB7XG4gICAgICAgIGNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0gPSBbXTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXS5wdXNoKHBvaW50KTtcbiAgICB9XG4gICAgXG4gICAgLy8gRHJhdyBlYWNoIGNsdXN0ZXJcbiAgICBPYmplY3QuZW50cmllcyhjbHVzdGVyR3JvdXBzKS5mb3JFYWNoKChbY2x1c3RlcklkLCBwb2ludHNdLCBpbmRleCkgPT4ge1xuICAgICAgLy8gRmluZCB0aGUgY2VudHJvaWQgYW5kIGJvdW5kcyBvZiB0aGUgY2x1c3RlclxuICAgICAgbGV0IG1pblggPSBJbmZpbml0eSwgbWluWSA9IEluZmluaXR5O1xuICAgICAgbGV0IG1heFggPSAtSW5maW5pdHksIG1heFkgPSAtSW5maW5pdHk7XG4gICAgICBsZXQgc3VtWCA9IDAsIHN1bVkgPSAwO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHBvaW50cykge1xuICAgICAgICBjb25zdCBbc2NyZWVuWCwgc2NyZWVuWV0gPSB0aGlzLndvcmxkVG9TY3JlZW4ocG9pbnQueCwgcG9pbnQueSk7XG4gICAgICAgIG1pblggPSBNYXRoLm1pbihtaW5YLCBzY3JlZW5YKTtcbiAgICAgICAgbWluWSA9IE1hdGgubWluKG1pblksIHNjcmVlblkpO1xuICAgICAgICBtYXhYID0gTWF0aC5tYXgobWF4WCwgc2NyZWVuWCk7XG4gICAgICAgIG1heFkgPSBNYXRoLm1heChtYXhZLCBzY3JlZW5ZKTtcbiAgICAgICAgc3VtWCArPSBzY3JlZW5YO1xuICAgICAgICBzdW1ZICs9IHNjcmVlblk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIENhbGN1bGF0ZSBjZW50cm9pZFxuICAgICAgY29uc3QgY2VudGVyWCA9IHN1bVggLyBwb2ludHMubGVuZ3RoO1xuICAgICAgY29uc3QgY2VudGVyWSA9IHN1bVkgLyBwb2ludHMubGVuZ3RoO1xuICAgICAgXG4gICAgICAvLyBBZGQgcGFkZGluZ1xuICAgICAgY29uc3QgcGFkZGluZyA9IDIwO1xuICAgICAgbWluWCAtPSBwYWRkaW5nO1xuICAgICAgbWluWSAtPSBwYWRkaW5nO1xuICAgICAgbWF4WCArPSBwYWRkaW5nO1xuICAgICAgbWF4WSArPSBwYWRkaW5nO1xuICAgICAgXG4gICAgICAvLyBVc2UgY29sb3IgZnJvbSBwYWxldHRlIChjeWNsZSBpZiBtb3JlIGNsdXN0ZXJzIHRoYW4gY29sb3JzKVxuICAgICAgY29uc3QgY29sb3JJbmRleCA9IHBhcnNlSW50KGNsdXN0ZXJJZCkgJSBjb2xvcnMubGVuZ3RoO1xuICAgICAgY29uc3QgY29sb3IgPSBjb2xvcnNbY29sb3JJbmRleF07XG4gICAgICBcbiAgICAgIC8vIERyYXcgYSByb3VuZGVkIHJlY3RhbmdsZSBhcm91bmQgdGhlIGNsdXN0ZXJcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9IGNvbG9yLmZpbGw7XG4gICAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9IGNvbG9yLnN0cm9rZTtcbiAgICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgICBcbiAgICAgIHRoaXMucm91bmRSZWN0KFxuICAgICAgICBtaW5YLCBcbiAgICAgICAgbWluWSwgXG4gICAgICAgIG1heFggLSBtaW5YLCBcbiAgICAgICAgbWF4WSAtIG1pblksIFxuICAgICAgICAxMFxuICAgICAgKTtcbiAgICAgIFxuICAgICAgdGhpcy5jdHguZmlsbCgpO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgICBcbiAgICAgIC8vIERyYXcgY2x1c3RlciBsYWJlbCB3aXRoIHRvcCB0ZXJtcyBpZiBhdmFpbGFibGVcbiAgICAgIGlmICh0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zICYmIHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXSkge1xuICAgICAgICBjb25zdCB0ZXJtcyA9IHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXVxuICAgICAgICAgIC5zbGljZSgwLCAzKSAgLy8gVGFrZSB0b3AgMyB0ZXJtc1xuICAgICAgICAgIC5tYXAodCA9PiB0LnRlcm0pXG4gICAgICAgICAgLmpvaW4oJywgJyk7XG4gICAgICAgIFxuICAgICAgICAvLyBEcmF3IGEgbGFiZWwgd2l0aCBjbHVzdGVyIElEIGFuZCB0b3AgdGVybXNcbiAgICAgICAgY29uc3QgbGFiZWxUZXh0ID0gYENsdXN0ZXIgJHtjbHVzdGVySWR9OiAke3Rlcm1zfWA7XG4gICAgICAgIHRoaXMuY3R4LmZvbnQgPSAnYm9sZCAxNHB4IHZhcigtLWZvbnQtdGV4dCknOyAvLyBTbGlnaHRseSBsYXJnZXIgZm9udFxuICAgICAgICBcbiAgICAgICAgLy8gTWVhc3VyZSB0ZXh0IHRvIGNyZWF0ZSBiYWNrZ3JvdW5kXG4gICAgICAgIGNvbnN0IHRleHRNZXRyaWNzID0gdGhpcy5jdHgubWVhc3VyZVRleHQobGFiZWxUZXh0KTtcbiAgICAgICAgY29uc3QgdGV4dFdpZHRoID0gdGV4dE1ldHJpY3Mud2lkdGg7XG4gICAgICAgIGNvbnN0IHRleHRIZWlnaHQgPSAxODsgLy8gQXBwcm94aW1hdGlvbiBmb3IgaGVpZ2h0XG4gICAgICAgIFxuICAgICAgICAvLyBEcmF3IGJhY2tncm91bmQgZm9yIGxhYmVsXG4gICAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICdyZ2JhKDAsIDAsIDAsIDAuNyknOyAvLyBTZW1pLXRyYW5zcGFyZW50IGJsYWNrIGJhY2tncm91bmRcbiAgICAgICAgdGhpcy5jdHguZmlsbFJlY3QoXG4gICAgICAgICAgY2VudGVyWCAtIHRleHRXaWR0aCAvIDIgLSA1LCBcbiAgICAgICAgICBtaW5ZIC0gdGV4dEhlaWdodCAtIDUsIFxuICAgICAgICAgIHRleHRXaWR0aCArIDEwLCBcbiAgICAgICAgICB0ZXh0SGVpZ2h0XG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICAvLyBEcmF3IHRleHRcbiAgICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJyNmZmZmZmYnOyAvLyBCcmlnaHQgd2hpdGUgZm9yIGJldHRlciB2aXNpYmlsaXR5XG4gICAgICAgIHRoaXMuY3R4LnRleHRBbGlnbiA9ICdjZW50ZXInO1xuICAgICAgICB0aGlzLmN0eC5maWxsVGV4dChsYWJlbFRleHQsIGNlbnRlclgsIG1pblkgLSA1KTtcbiAgICAgICAgXG4gICAgICAgIC8vIERlYnVnZ2luZzogRHJhdyBhIHJlY3RhbmdsZSBhdCB0aGUgdGV4dCBwb3NpdGlvbiB0byB2ZXJpZnkgcG9zaXRpb25pbmdcbiAgICAgICAgLyp0aGlzLmN0eC5zdHJva2VTdHlsZSA9ICdyZWQnO1xuICAgICAgICB0aGlzLmN0eC5saW5lV2lkdGggPSAxO1xuICAgICAgICB0aGlzLmN0eC5zdHJva2VSZWN0KFxuICAgICAgICAgIGNlbnRlclggLSB0ZXh0V2lkdGggLyAyLCBcbiAgICAgICAgICBtaW5ZIC0gdGV4dEhlaWdodCAtIDEwLCBcbiAgICAgICAgICB0ZXh0V2lkdGgsIFxuICAgICAgICAgIHRleHRIZWlnaHRcbiAgICAgICAgKTsqL1xuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIFxuICBwcml2YXRlIHJvdW5kUmVjdCh4OiBudW1iZXIsIHk6IG51bWJlciwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHJhZGl1czogbnVtYmVyKSB7XG4gICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgdGhpcy5jdHgubW92ZVRvKHggKyByYWRpdXMsIHkpO1xuICAgIHRoaXMuY3R4LmxpbmVUbyh4ICsgd2lkdGggLSByYWRpdXMsIHkpO1xuICAgIHRoaXMuY3R4LmFyY1RvKHggKyB3aWR0aCwgeSwgeCArIHdpZHRoLCB5ICsgcmFkaXVzLCByYWRpdXMpO1xuICAgIHRoaXMuY3R4LmxpbmVUbyh4ICsgd2lkdGgsIHkgKyBoZWlnaHQgLSByYWRpdXMpO1xuICAgIHRoaXMuY3R4LmFyY1RvKHggKyB3aWR0aCwgeSArIGhlaWdodCwgeCArIHdpZHRoIC0gcmFkaXVzLCB5ICsgaGVpZ2h0LCByYWRpdXMpO1xuICAgIHRoaXMuY3R4LmxpbmVUbyh4ICsgcmFkaXVzLCB5ICsgaGVpZ2h0KTtcbiAgICB0aGlzLmN0eC5hcmNUbyh4LCB5ICsgaGVpZ2h0LCB4LCB5ICsgaGVpZ2h0IC0gcmFkaXVzLCByYWRpdXMpO1xuICAgIHRoaXMuY3R4LmxpbmVUbyh4LCB5ICsgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5hcmNUbyh4LCB5LCB4ICsgcmFkaXVzLCB5LCByYWRpdXMpO1xuICAgIHRoaXMuY3R4LmNsb3NlUGF0aCgpO1xuICB9XG4gIFxuICBwcml2YXRlIGRyYXdQb2ludChwb2ludDogVFNORVBvaW50KSB7XG4gICAgY29uc3QgW3gsIHldID0gdGhpcy53b3JsZFRvU2NyZWVuKHBvaW50LngsIHBvaW50LnkpO1xuICAgIFxuICAgIC8vIENvbG9yIHBhbGV0dGUgZm9yIGNsdXN0ZXJzXG4gICAgY29uc3QgY2x1c3RlckNvbG9ycyA9IFtcbiAgICAgICdyZ2JhKDI1NSwgOTksIDEzMiwgMSknLCAgICAvLyByZWRcbiAgICAgICdyZ2JhKDU0LCAxNjIsIDIzNSwgMSknLCAgICAvLyBibHVlXG4gICAgICAncmdiYSgyNTUsIDIwNiwgODYsIDEpJywgICAgLy8geWVsbG93XG4gICAgICAncmdiYSg3NSwgMTkyLCAxOTIsIDEpJywgICAgLy8gZ3JlZW5cbiAgICAgICdyZ2JhKDE1MywgMTAyLCAyNTUsIDEpJywgICAvLyBwdXJwbGVcbiAgICAgICdyZ2JhKDI1NSwgMTU5LCA2NCwgMSknLCAgICAvLyBvcmFuZ2VcbiAgICAgICdyZ2JhKDE5OSwgMTk5LCAxOTksIDEpJywgICAvLyBncmV5XG4gICAgXTtcbiAgICBcbiAgICAvLyBEcmF3IGNpcmNsZVxuICAgIHRoaXMuY3R4LmJlZ2luUGF0aCgpO1xuICAgIHRoaXMuY3R4LmFyYyh4LCB5LCB0aGlzLnBvaW50UmFkaXVzLCAwLCBNYXRoLlBJICogMik7XG4gICAgXG4gICAgLy8gRGV0ZXJtaW5lIGNvbG9yIGJhc2VkIG9uIGhvdmVyIHN0YXRlIGFuZCBjbHVzdGVyXG4gICAgaWYgKHRoaXMuaG92ZXJlZFBvaW50ID09PSBwb2ludCkge1xuICAgICAgLy8gSG92ZXJlZCBwb2ludHMgYXJlIGFsd2F5cyBoaWdobGlnaHRlZCBpbiB0aGUgYWNjZW50IGNvbG9yXG4gICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAndmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KSc7XG4gICAgfSBlbHNlIGlmIChwb2ludC5jbHVzdGVyID09PSAtMSkge1xuICAgICAgLy8gTm9pc2UgcG9pbnRzIChub3QgaW4gYSBjbHVzdGVyKSBhcmUgZ3JleVxuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3ZhcigtLXRleHQtbXV0ZWQpJztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUG9pbnRzIGluIGNsdXN0ZXJzIHVzZSB0aGUgY2x1c3RlciBjb2xvciBwYWxldHRlXG4gICAgICBjb25zdCBjb2xvckluZGV4ID0gcG9pbnQuY2x1c3RlciAlIGNsdXN0ZXJDb2xvcnMubGVuZ3RoO1xuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gY2x1c3RlckNvbG9yc1tjb2xvckluZGV4XTtcbiAgICB9XG4gICAgXG4gICAgdGhpcy5jdHguZmlsbCgpO1xuICAgIFxuICAgIC8vIEFkZCBib3JkZXIgdG8gcG9pbnRzXG4gICAgdGhpcy5jdHguc3Ryb2tlU3R5bGUgPSAndmFyKC0tYmFja2dyb3VuZC1wcmltYXJ5KSc7XG4gICAgdGhpcy5jdHgubGluZVdpZHRoID0gMTtcbiAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICBcbiAgICAvLyBEcmF3IHRpdGxlIGlmIG5vdCBob3ZlcmVkIChob3ZlcmVkIHNob3dzIGluIHRvb2x0aXApXG4gICAgaWYgKHRoaXMuaG92ZXJlZFBvaW50ICE9PSBwb2ludCkge1xuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3ZhcigtLXRleHQtbm9ybWFsKSc7XG4gICAgICB0aGlzLmN0eC5mb250ID0gJzEycHggdmFyKC0tZm9udC10ZXh0KSc7XG4gICAgICB0aGlzLmN0eC50ZXh0QWxpZ24gPSAnY2VudGVyJztcbiAgICAgIHRoaXMuY3R4LmZpbGxUZXh0KHBvaW50LnRpdGxlLCB4LCB5IC0gdGhpcy5wb2ludFJhZGl1cyAtIDUpO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBkcmF3VG9vbHRpcCgpIHtcbiAgICBpZiAoIXRoaXMuaG92ZXJlZFBvaW50IHx8ICF0aGlzLnJlc3VsdCkgcmV0dXJuO1xuICAgIFxuICAgIGNvbnN0IFt4LCB5XSA9IHRoaXMud29ybGRUb1NjcmVlbih0aGlzLmhvdmVyZWRQb2ludC54LCB0aGlzLmhvdmVyZWRQb2ludC55KTtcbiAgICBjb25zdCBwb2ludCA9IHRoaXMuaG92ZXJlZFBvaW50O1xuICAgIFxuICAgIC8vIFRvb2x0aXAgY29udGVudFxuICAgIGNvbnN0IHRpdGxlID0gcG9pbnQudGl0bGU7XG4gICAgY29uc3QgcGF0aCA9IHBvaW50LnBhdGg7XG4gICAgY29uc3QgdGVybXMgPSBwb2ludC50b3BfdGVybXMuam9pbignLCAnKTtcbiAgICBcbiAgICAvLyBGb3JtYXQgZGF0ZXMgaWYgYXZhaWxhYmxlXG4gICAgY29uc3QgZm9ybWF0RGF0ZSA9ICh0aW1lc3RhbXA/OiBudW1iZXIpID0+IHtcbiAgICAgIGlmICghdGltZXN0YW1wKSByZXR1cm4gJ1Vua25vd24nO1xuICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKHRpbWVzdGFtcCk7XG4gICAgICByZXR1cm4gZGF0ZS50b0xvY2FsZURhdGVTdHJpbmcoKSArICcgJyArIGRhdGUudG9Mb2NhbGVUaW1lU3RyaW5nKFtdLCB7IGhvdXI6ICcyLWRpZ2l0JywgbWludXRlOiAnMi1kaWdpdCcgfSk7XG4gICAgfTtcbiAgICBcbiAgICAvLyBHZXQgbWV0YWRhdGFcbiAgICBjb25zdCBtb2RpZmllZCA9IGZvcm1hdERhdGUocG9pbnQubXRpbWUpO1xuICAgIGNvbnN0IGNyZWF0ZWQgPSBmb3JtYXREYXRlKHBvaW50LmN0aW1lKTtcbiAgICBjb25zdCB3b3JkQ291bnQgPSBwb2ludC53b3JkQ291bnQgPyBgJHtwb2ludC53b3JkQ291bnR9IHdvcmRzYCA6ICdVbmtub3duJztcbiAgICBjb25zdCByZWFkaW5nVGltZSA9IHBvaW50LnJlYWRpbmdUaW1lID8gYH4ke3BvaW50LnJlYWRpbmdUaW1lfSBtaW4gcmVhZGAgOiAnJztcbiAgICBcbiAgICAvLyBGb3JtYXQgdGFnc1xuICAgIGNvbnN0IHRhZ3MgPSBwb2ludC50YWdzICYmIHBvaW50LnRhZ3MubGVuZ3RoID4gMCBcbiAgICAgID8gcG9pbnQudGFncy5tYXAodGFnID0+IGAjJHt0YWd9YCkuam9pbignICcpXG4gICAgICA6ICdObyB0YWdzJztcbiAgICBcbiAgICAvLyBGb3JtYXQgY29udGVudCBwcmV2aWV3XG4gICAgY29uc3QgcHJldmlldyA9IHBvaW50LmNvbnRlbnRQcmV2aWV3IHx8ICdObyBwcmV2aWV3IGF2YWlsYWJsZSc7XG4gICAgXG4gICAgLy8gR2V0IGRpc3RhbmNlIHRvIGNlbnRlclxuICAgIGNvbnN0IGRpc3RhbmNlSW5mbyA9IHBvaW50LmRpc3RhbmNlVG9DZW50ZXIgIT09IHVuZGVmaW5lZCAmJiBwb2ludC5jbHVzdGVyICE9PSAtMVxuICAgICAgPyBgRGlzdGFuY2UgdG8gY2VudGVyOiAke3BvaW50LmRpc3RhbmNlVG9DZW50ZXIudG9GaXhlZCgyKX1gXG4gICAgICA6ICcnO1xuICAgIFxuICAgIC8vIEdldCBjbHVzdGVyIGluZm9ybWF0aW9uXG4gICAgbGV0IGNsdXN0ZXJJbmZvID0gJ05vdCBjbHVzdGVyZWQnO1xuICAgIGlmIChwb2ludC5jbHVzdGVyICE9PSAtMSkge1xuICAgICAgY29uc3QgY2x1c3RlcklkID0gcG9pbnQuY2x1c3RlcjtcbiAgICAgIFxuICAgICAgLy8gR2V0IGNsdXN0ZXIgdGVybXMgaWYgYXZhaWxhYmxlXG4gICAgICBsZXQgY2x1c3RlclRlcm1zID0gJyc7XG4gICAgICBpZiAodGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtcyAmJiB0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zW2NsdXN0ZXJJZF0pIHtcbiAgICAgICAgY2x1c3RlclRlcm1zID0gdGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtc1tjbHVzdGVySWRdXG4gICAgICAgICAgLnNsaWNlKDAsIDMpIC8vIFRha2UgdG9wIDMgdGVybXNcbiAgICAgICAgICAubWFwKHQgPT4gdC50ZXJtKVxuICAgICAgICAgIC5qb2luKCcsICcpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjbHVzdGVySW5mbyA9IGBDbHVzdGVyICR7Y2x1c3RlcklkfTogJHtjbHVzdGVyVGVybXN9YDtcbiAgICB9XG4gICAgXG4gICAgLy8gRGVmaW5lIGFsbCB0b29sdGlwIHNlY3Rpb25zIC0gbW9yZSBjb21wYWN0IGxheW91dCB3aXRoIGdyb3VwaW5nXG4gICAgY29uc3Qgc2VjdGlvbnMgPSBbXG4gICAgICB7IFxuICAgICAgICBsYWJlbDogJ1RpdGxlJywgXG4gICAgICAgIHRleHQ6IHRpdGxlLCBcbiAgICAgICAgZm9udDogJ2JvbGQgMTRweCBzYW5zLXNlcmlmJyxcbiAgICAgICAgYWx3YXlzU2hvdzogdHJ1ZSAgLy8gQWx3YXlzIHNob3cgdGl0bGVcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGxhYmVsOiAnUGF0aCcsIFxuICAgICAgICB0ZXh0OiBwYXRoLCBcbiAgICAgICAgZm9udDogJ2l0YWxpYyAxMXB4IHNhbnMtc2VyaWYnLFxuICAgICAgICBza2lwSWZFbXB0eTogdHJ1ZVxuICAgICAgfSxcbiAgICAgIHsgXG4gICAgICAgIGxhYmVsOiAnS2V5d29yZHMnLCBcbiAgICAgICAgdGV4dDogdGVybXMsIFxuICAgICAgICBza2lwSWZFbXB0eTogdHJ1ZVxuICAgICAgfSxcbiAgICAgIHsgXG4gICAgICAgIGxhYmVsOiAnQ2x1c3RlcicsIFxuICAgICAgICB0ZXh0OiBjbHVzdGVySW5mbywgXG4gICAgICAgIHNraXBJZkVtcHR5OiB0cnVlXG4gICAgICB9LFxuICAgICAgLy8gQ29tYmluZSB0YWdzIGFuZCBzdGF0cyBpbnRvIG9uZSBsaW5lIGlmIGJvdGggZXhpc3RcbiAgICAgIHsgXG4gICAgICAgIGxhYmVsOiAnSW5mbycsIFxuICAgICAgICB0ZXh0OiBbXG4gICAgICAgICAgdGFncyAhPT0gJ05vIHRhZ3MnID8gdGFncyA6IG51bGwsXG4gICAgICAgICAgd29yZENvdW50ICYmIHJlYWRpbmdUaW1lID8gYCR7d29yZENvdW50fSAoJHtyZWFkaW5nVGltZX0pYCA6IHdvcmRDb3VudCB8fCAnJ1xuICAgICAgICBdLmZpbHRlcihCb29sZWFuKS5qb2luKCcg4oCiICcpLFxuICAgICAgICBza2lwSWZFbXB0eTogdHJ1ZVxuICAgICAgfSxcbiAgICAgIC8vIENvbWJpbmUgZGF0ZXMgaW50byBvbmUgbGluZSB0byBzYXZlIHNwYWNlXG4gICAgICB7IFxuICAgICAgICBsYWJlbDogJ0RhdGVzJywgXG4gICAgICAgIHRleHQ6IGBNb2RpZmllZDogJHttb2RpZmllZH0ke3BvaW50LmN0aW1lID8gYCDigKIgQ3JlYXRlZDogJHtjcmVhdGVkfWAgOiAnJ31gLFxuICAgICAgICBmb250OiAnMTFweCBzYW5zLXNlcmlmJyxcbiAgICAgICAgc2tpcElmRW1wdHk6IHBvaW50Lm10aW1lID09PSB1bmRlZmluZWRcbiAgICAgIH0sXG4gICAgICAvLyBDb250ZW50IHByZXZpZXcgaXMgc2hvd24gaW4gYSBkaXN0aW5jdCBzdHlsZVxuICAgICAgeyBcbiAgICAgICAgbGFiZWw6ICdQcmV2aWV3JywgXG4gICAgICAgIHRleHQ6IHByZXZpZXcsIFxuICAgICAgICBmb250OiAnaXRhbGljIDExcHggc2Fucy1zZXJpZicsXG4gICAgICAgIHNraXBJZkVtcHR5OiAhcG9pbnQuY29udGVudFByZXZpZXcgfHwgcG9pbnQuY29udGVudFByZXZpZXcubGVuZ3RoIDwgNVxuICAgICAgfSxcbiAgICAgIC8vIFNob3cgZGlzdGFuY2UgaW5mbyBvbmx5IGlmIGl0IGV4aXN0c1xuICAgICAgeyBcbiAgICAgICAgbGFiZWw6ICcnLCBcbiAgICAgICAgdGV4dDogZGlzdGFuY2VJbmZvLCBcbiAgICAgICAgZm9udDogJzEwcHggc2Fucy1zZXJpZicsXG4gICAgICAgIHNraXBJZkVtcHR5OiB0cnVlIFxuICAgICAgfVxuICAgIF07XG4gICAgXG4gICAgLy8gU2V0IHByb3BlciBmb250IGZvciBtZWFzdXJlbWVudHNcbiAgICB0aGlzLmN0eC5mb250ID0gJ2JvbGQgMTRweCBzYW5zLXNlcmlmJztcbiAgICBsZXQgdG9vbHRpcFdpZHRoID0gdGhpcy5jdHgubWVhc3VyZVRleHQodGl0bGUpLndpZHRoICsgMjA7IC8vIEFkZCBzb21lIHBhZGRpbmdcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgbWF4aW11bSB3aWR0aCBuZWVkZWRcbiAgICBzZWN0aW9ucy5mb3JFYWNoKHNlY3Rpb24gPT4ge1xuICAgICAgaWYgKHNlY3Rpb24uYWx3YXlzU2hvdyB8fCAoIXNlY3Rpb24uc2tpcElmRW1wdHkgfHwgc2VjdGlvbi50ZXh0KSkge1xuICAgICAgICB0aGlzLmN0eC5mb250ID0gc2VjdGlvbi5mb250IHx8ICcxMnB4IHNhbnMtc2VyaWYnO1xuICAgICAgICBjb25zdCB3aWR0aCA9IHRoaXMuY3R4Lm1lYXN1cmVUZXh0KFxuICAgICAgICAgIHNlY3Rpb24ubGFiZWwgPyBgJHtzZWN0aW9uLmxhYmVsfTogJHtzZWN0aW9uLnRleHR9YCA6IHNlY3Rpb24udGV4dFxuICAgICAgICApLndpZHRoICsgMjA7IC8vIEFkZCBwYWRkaW5nXG4gICAgICAgIHRvb2x0aXBXaWR0aCA9IE1hdGgubWF4KHRvb2x0aXBXaWR0aCwgd2lkdGgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIC8vIExpbWl0IHRvb2x0aXAgd2lkdGggdG8gYSByZWFzb25hYmxlIG1heGltdW0gKDgwJSBvZiBjYW52YXMgd2lkdGgpXG4gICAgdG9vbHRpcFdpZHRoID0gTWF0aC5taW4odG9vbHRpcFdpZHRoLCB0aGlzLndpZHRoICogMC44KTtcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgdG9vbHRpcCBoZWlnaHQgd2l0aCBtb3JlIGNvbXBhY3QgbGluZSBzcGFjaW5nXG4gICAgY29uc3QgbGluZUhlaWdodCA9IDE4OyAvLyBTbGlnaHRseSBzbWFsbGVyIGxpbmUgaGVpZ2h0XG4gICAgLy8gQ291bnQgaG93IG1hbnkgc2VjdGlvbnMgd2lsbCBiZSB2aXNpYmxlXG4gICAgY29uc3QgdmlzaWJsZVNlY3Rpb25zID0gc2VjdGlvbnMuZmlsdGVyKHMgPT4gXG4gICAgICBzLmFsd2F5c1Nob3cgfHwgKCFzLnNraXBJZkVtcHR5IHx8IHMudGV4dClcbiAgICApLmxlbmd0aDtcbiAgICBcbiAgICAvLyBNb3JlIGNvbXBhY3QgdG9vbHRpcCBoZWlnaHRcbiAgICBjb25zdCB0b29sdGlwSGVpZ2h0ID0gdmlzaWJsZVNlY3Rpb25zICogbGluZUhlaWdodCArIDEyOyAvLyBMZXNzIHBhZGRpbmdcbiAgICBcbiAgICAvLyBQb3NpdGlvbiB0b29sdGlwIC0gZW5zdXJlIGl0IHN0YXlzIGZ1bGx5IHZpc2libGUgd2l0aGluIHRoZSBjYW52YXNcbiAgICAvLyBJZiB0b29sdGlwIGlzIHRvbyB3aWRlLCBwb3NpdGlvbiBpdCB0byB0aGUgbGVmdCBvZiB0aGUgcG9pbnQgaW5zdGVhZCBvZiB0aGUgcmlnaHRcbiAgICBsZXQgdG9vbHRpcFggPSB4ICsgMTA7XG4gICAgaWYgKHRvb2x0aXBYICsgdG9vbHRpcFdpZHRoID4gdGhpcy53aWR0aCAtIDEwKSB7XG4gICAgICB0b29sdGlwWCA9IHggLSB0b29sdGlwV2lkdGggLSAxMDtcbiAgICB9XG4gICAgXG4gICAgLy8gSWYgdG9vbHRpcCBpcyBzdGlsbCBvdXQgb2YgYm91bmRzIChyYXJlIGNhc2Ugd2l0aCB2ZXJ5IHdpZGUgdG9vbHRpcHMpLCBjZW50ZXIgaXRcbiAgICBpZiAodG9vbHRpcFggPCAxMCkge1xuICAgICAgdG9vbHRpcFggPSBNYXRoLm1heCgxMCwgTWF0aC5taW4odGhpcy53aWR0aCAtIHRvb2x0aXBXaWR0aCAtIDEwLCB4IC0gdG9vbHRpcFdpZHRoLzIpKTtcbiAgICB9XG4gICAgXG4gICAgLy8gUG9zaXRpb24gdmVydGljYWxseSAtIHRyeSB0byBwbGFjZSBhYm92ZSB0aGUgcG9pbnQgaWYgaXQgd291bGQgZ28gb2ZmIGJvdHRvbVxuICAgIGxldCB0b29sdGlwWSA9IHkgKyAxMDtcbiAgICBpZiAodG9vbHRpcFkgKyB0b29sdGlwSGVpZ2h0ID4gdGhpcy5oZWlnaHQgLSAxMCkge1xuICAgICAgdG9vbHRpcFkgPSB5IC0gdG9vbHRpcEhlaWdodCAtIDEwO1xuICAgIH1cbiAgICBcbiAgICAvLyBJZiB0b29sdGlwIGlzIHN0aWxsIG91dCBvZiBib3VuZHMsIHBvc2l0aW9uIGl0IHRvIG1pbmltaXplIG92ZXJmbG93XG4gICAgaWYgKHRvb2x0aXBZIDwgMTApIHtcbiAgICAgIHRvb2x0aXBZID0gMTA7XG4gICAgfVxuICAgIFxuICAgIC8vIEZpbmFsIGNoZWNrIHRvIGVuc3VyZSB0b29sdGlwIGlzIGFzIHZpc2libGUgYXMgcG9zc2libGVcbiAgICB0b29sdGlwWCA9IE1hdGgubWF4KDEwLCBNYXRoLm1pbih0b29sdGlwWCwgdGhpcy53aWR0aCAtIHRvb2x0aXBXaWR0aCAtIDEwKSk7XG4gICAgdG9vbHRpcFkgPSBNYXRoLm1heCgxMCwgTWF0aC5taW4odG9vbHRpcFksIHRoaXMuaGVpZ2h0IC0gdG9vbHRpcEhlaWdodCAtIDEwKSk7XG4gICAgXG4gICAgLy8gRHJhdyB0b29sdGlwIGJhY2tncm91bmQgLSB1c2UgYSBuaWNlciBncmFkaWVudFxuICAgIGNvbnN0IGdyYWRpZW50ID0gdGhpcy5jdHguY3JlYXRlTGluZWFyR3JhZGllbnQodG9vbHRpcFgsIHRvb2x0aXBZLCB0b29sdGlwWCwgdG9vbHRpcFkgKyB0b29sdGlwSGVpZ2h0KTtcbiAgICBncmFkaWVudC5hZGRDb2xvclN0b3AoMCwgJ3JnYmEoMjU1LCAyNTUsIDI1NSwgMC45NSknKTtcbiAgICBncmFkaWVudC5hZGRDb2xvclN0b3AoMSwgJ3JnYmEoMjQ1LCAyNDUsIDI1MCwgMC45NSknKTtcbiAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSBncmFkaWVudDtcbiAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9ICdyZ2JhKDE1MCwgMTUwLCAxNjAsIDAuOCknO1xuICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgXG4gICAgdGhpcy5yb3VuZFJlY3QodG9vbHRpcFgsIHRvb2x0aXBZLCB0b29sdGlwV2lkdGgsIHRvb2x0aXBIZWlnaHQsIDUpO1xuICAgIHRoaXMuY3R4LmZpbGwoKTtcbiAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICBcbiAgICAvLyBEcmF3IHRvb2x0aXAgY29udGVudFxuICAgIHRoaXMuY3R4LnRleHRBbGlnbiA9ICdsZWZ0JztcbiAgICBcbiAgICAvLyBEcmF3IGVhY2ggc2VjdGlvblxuICAgIGxldCBjdXJyZW50WSA9IHRvb2x0aXBZICsgMTQ7XG4gICAgc2VjdGlvbnMuZm9yRWFjaChzZWN0aW9uID0+IHtcbiAgICAgIGlmICghc2VjdGlvbi5hbHdheXNTaG93ICYmIChzZWN0aW9uLnNraXBJZkVtcHR5ICYmICFzZWN0aW9uLnRleHQpKSByZXR1cm47XG4gICAgICBcbiAgICAgIHRoaXMuY3R4LmZvbnQgPSBzZWN0aW9uLmZvbnQgfHwgJzEycHggc2Fucy1zZXJpZic7XG4gICAgICBcbiAgICAgIC8vIFVzZSBkaWZmZXJlbnQgdGV4dCBjb2xvcnMgZm9yIGRpZmZlcmVudCBzZWN0aW9uc1xuICAgICAgaWYgKHNlY3Rpb24ubGFiZWwgPT09ICdUaXRsZScpIHtcbiAgICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJyMzMzMzMzMnOyAvLyBEYXJrIGdyYXkgZm9yIHRpdGxlXG4gICAgICB9IGVsc2UgaWYgKHNlY3Rpb24ubGFiZWwgPT09ICdQcmV2aWV3Jykge1xuICAgICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAnIzY2NjY2Nic7IC8vIE1lZGl1bSBncmF5IGZvciBwcmV2aWV3XG4gICAgICB9IGVsc2UgaWYgKHNlY3Rpb24ubGFiZWwgPT09ICcnKSB7XG4gICAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICcjOTk5OTk5JzsgLy8gTGlnaHQgZ3JheSBmb3Igbm90ZXNcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICcjNDQ0NDQ0JzsgLy8gTm9ybWFsIHRleHQgY29sb3JcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgdGV4dCA9IHNlY3Rpb24ubGFiZWwgJiYgc2VjdGlvbi5sYWJlbCAhPT0gJ1RpdGxlJ1xuICAgICAgICA/IGAke3NlY3Rpb24ubGFiZWx9OiAke3NlY3Rpb24udGV4dH1gXG4gICAgICAgIDogc2VjdGlvbi50ZXh0O1xuICAgICAgXG4gICAgICAvLyBGb3IgbG9uZ2VyIHRleHQsIGhhbmRsZSB3cmFwcGluZ1xuICAgICAgaWYgKHRoaXMuY3R4Lm1lYXN1cmVUZXh0KHRleHQpLndpZHRoID4gdG9vbHRpcFdpZHRoIC0gMjApIHtcbiAgICAgICAgY29uc3Qgd29yZHMgPSB0ZXh0LnNwbGl0KCcgJyk7XG4gICAgICAgIGxldCBsaW5lID0gJyc7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHdvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgdGVzdExpbmUgPSBsaW5lICsgd29yZHNbaV0gKyAnICc7XG4gICAgICAgICAgY29uc3QgbWV0cmljcyA9IHRoaXMuY3R4Lm1lYXN1cmVUZXh0KHRlc3RMaW5lKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAobWV0cmljcy53aWR0aCA+IHRvb2x0aXBXaWR0aCAtIDIwICYmIGkgPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmN0eC5maWxsVGV4dChsaW5lLCB0b29sdGlwWCArIDEwLCBjdXJyZW50WSk7XG4gICAgICAgICAgICBsaW5lID0gd29yZHNbaV0gKyAnICc7XG4gICAgICAgICAgICBjdXJyZW50WSArPSBsaW5lSGVpZ2h0ICogMC44OyAvLyBTbWFsbGVyIHNwYWNpbmcgZm9yIHdyYXBwZWQgdGV4dFxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsaW5lID0gdGVzdExpbmU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB0aGlzLmN0eC5maWxsVGV4dChsaW5lLCB0b29sdGlwWCArIDEwLCBjdXJyZW50WSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmN0eC5maWxsVGV4dCh0ZXh0LCB0b29sdGlwWCArIDEwLCBjdXJyZW50WSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGN1cnJlbnRZICs9IGxpbmVIZWlnaHQ7XG4gICAgfSk7XG4gIH1cbn1cblxuY2xhc3MgU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IFZpYmVCb3lQbHVnaW47XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogVmliZUJveVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3Qge2NvbnRhaW5lckVsfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcblxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHt0ZXh0OiAnVmliZSBCb2kgLSB0LVNORSBTZXR0aW5ncyd9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ1BlcnBsZXhpdHknKVxuICAgICAgLnNldERlc2MoJ0NvbnRyb2xzIHRoZSBiYWxhbmNlIGJldHdlZW4gbG9jYWwgYW5kIGdsb2JhbCBhc3BlY3RzIG9mIHRoZSBkYXRhIChyZWNvbW1lbmRlZDogNS01MCknKVxuICAgICAgLmFkZFNsaWRlcihzbGlkZXIgPT4gc2xpZGVyXG4gICAgICAgIC5zZXRMaW1pdHMoNSwgMTAwLCA1KVxuICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucGVycGxleGl0eSlcbiAgICAgICAgLnNldER5bmFtaWNUb29sdGlwKClcbiAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnBlcnBsZXhpdHkgPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnSXRlcmF0aW9ucycpXG4gICAgICAuc2V0RGVzYygnTnVtYmVyIG9mIGl0ZXJhdGlvbnMgdG8gcnVuIHRoZSBhbGdvcml0aG0nKVxuICAgICAgLmFkZFNsaWRlcihzbGlkZXIgPT4gc2xpZGVyXG4gICAgICAgIC5zZXRMaW1pdHMoMjUwLCAyMDAwLCAyNTApXG4gICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pdGVyYXRpb25zKVxuICAgICAgICAuc2V0RHluYW1pY1Rvb2x0aXAoKVxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaXRlcmF0aW9ucyA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KSk7XG4gICAgICAgIFxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0Vwc2lsb24gKGxlYXJuaW5nIHJhdGUpJylcbiAgICAgIC5zZXREZXNjKCdDb250cm9scyB0aGUgc3BlZWQgb2Ygb3B0aW1pemF0aW9uJylcbiAgICAgIC5hZGRTbGlkZXIoc2xpZGVyID0+IHNsaWRlclxuICAgICAgICAuc2V0TGltaXRzKDEsIDEwMCwgMSlcbiAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVwc2lsb24pXG4gICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lcHNpbG9uID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pKTtcbiAgfVxufSJdLCJuYW1lcyI6WyJNb2RhbCIsIkJ1dHRvbkNvbXBvbmVudCIsIlRleHRBcmVhQ29tcG9uZW50IiwiVEZpbGUiLCJOb3RpY2UiLCJJdGVtVmlldyIsIlBsdWdpbiIsIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQW9HQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDdEcsUUFBUSxTQUFTLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEVBQUU7QUFDdEgsUUFBUSxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsVUFBVSxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDOUUsS0FBSyxDQUFDLENBQUM7QUFDUCxDQUFDO0FBNk1EO0FBQ3VCLE9BQU8sZUFBZSxLQUFLLFVBQVUsR0FB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
