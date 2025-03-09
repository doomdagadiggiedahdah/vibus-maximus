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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIi4uLy4uLy4uLy4uL3NyYy9vYnNpZGlhbi1wbHVnaW4vbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuLyogZ2xvYmFsIFJlZmxlY3QsIFByb21pc2UsIFN1cHByZXNzZWRFcnJvciwgU3ltYm9sLCBJdGVyYXRvciAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19lc0RlY29yYXRlKGN0b3IsIGRlc2NyaXB0b3JJbiwgZGVjb3JhdG9ycywgY29udGV4dEluLCBpbml0aWFsaXplcnMsIGV4dHJhSW5pdGlhbGl6ZXJzKSB7XHJcbiAgICBmdW5jdGlvbiBhY2NlcHQoZikgeyBpZiAoZiAhPT0gdm9pZCAwICYmIHR5cGVvZiBmICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGdW5jdGlvbiBleHBlY3RlZFwiKTsgcmV0dXJuIGY7IH1cclxuICAgIHZhciBraW5kID0gY29udGV4dEluLmtpbmQsIGtleSA9IGtpbmQgPT09IFwiZ2V0dGVyXCIgPyBcImdldFwiIDoga2luZCA9PT0gXCJzZXR0ZXJcIiA/IFwic2V0XCIgOiBcInZhbHVlXCI7XHJcbiAgICB2YXIgdGFyZ2V0ID0gIWRlc2NyaXB0b3JJbiAmJiBjdG9yID8gY29udGV4dEluW1wic3RhdGljXCJdID8gY3RvciA6IGN0b3IucHJvdG90eXBlIDogbnVsbDtcclxuICAgIHZhciBkZXNjcmlwdG9yID0gZGVzY3JpcHRvckluIHx8ICh0YXJnZXQgPyBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgY29udGV4dEluLm5hbWUpIDoge30pO1xyXG4gICAgdmFyIF8sIGRvbmUgPSBmYWxzZTtcclxuICAgIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgICAgdmFyIGNvbnRleHQgPSB7fTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbikgY29udGV4dFtwXSA9IHAgPT09IFwiYWNjZXNzXCIgPyB7fSA6IGNvbnRleHRJbltwXTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbi5hY2Nlc3MpIGNvbnRleHQuYWNjZXNzW3BdID0gY29udGV4dEluLmFjY2Vzc1twXTtcclxuICAgICAgICBjb250ZXh0LmFkZEluaXRpYWxpemVyID0gZnVuY3Rpb24gKGYpIHsgaWYgKGRvbmUpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgYWRkIGluaXRpYWxpemVycyBhZnRlciBkZWNvcmF0aW9uIGhhcyBjb21wbGV0ZWRcIik7IGV4dHJhSW5pdGlhbGl6ZXJzLnB1c2goYWNjZXB0KGYgfHwgbnVsbCkpOyB9O1xyXG4gICAgICAgIHZhciByZXN1bHQgPSAoMCwgZGVjb3JhdG9yc1tpXSkoa2luZCA9PT0gXCJhY2Nlc3NvclwiID8geyBnZXQ6IGRlc2NyaXB0b3IuZ2V0LCBzZXQ6IGRlc2NyaXB0b3Iuc2V0IH0gOiBkZXNjcmlwdG9yW2tleV0sIGNvbnRleHQpO1xyXG4gICAgICAgIGlmIChraW5kID09PSBcImFjY2Vzc29yXCIpIHtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gdm9pZCAwKSBjb250aW51ZTtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCB8fCB0eXBlb2YgcmVzdWx0ICE9PSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkXCIpO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuZ2V0KSkgZGVzY3JpcHRvci5nZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuc2V0KSkgZGVzY3JpcHRvci5zZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuaW5pdCkpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChfID0gYWNjZXB0KHJlc3VsdCkpIHtcclxuICAgICAgICAgICAgaWYgKGtpbmQgPT09IFwiZmllbGRcIikgaW5pdGlhbGl6ZXJzLnVuc2hpZnQoXyk7XHJcbiAgICAgICAgICAgIGVsc2UgZGVzY3JpcHRvcltrZXldID0gXztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAodGFyZ2V0KSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBjb250ZXh0SW4ubmFtZSwgZGVzY3JpcHRvcik7XHJcbiAgICBkb25lID0gdHJ1ZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3J1bkluaXRpYWxpemVycyh0aGlzQXJnLCBpbml0aWFsaXplcnMsIHZhbHVlKSB7XHJcbiAgICB2YXIgdXNlVmFsdWUgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5pdGlhbGl6ZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFsdWUgPSB1c2VWYWx1ZSA/IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcsIHZhbHVlKSA6IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHVzZVZhbHVlID8gdmFsdWUgOiB2b2lkIDA7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wcm9wS2V5KHgpIHtcclxuICAgIHJldHVybiB0eXBlb2YgeCA9PT0gXCJzeW1ib2xcIiA/IHggOiBcIlwiLmNvbmNhdCh4KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NldEZ1bmN0aW9uTmFtZShmLCBuYW1lLCBwcmVmaXgpIHtcclxuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gXCJzeW1ib2xcIikgbmFtZSA9IG5hbWUuZGVzY3JpcHRpb24gPyBcIltcIi5jb25jYXQobmFtZS5kZXNjcmlwdGlvbiwgXCJdXCIpIDogXCJcIjtcclxuICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkoZiwgXCJuYW1lXCIsIHsgY29uZmlndXJhYmxlOiB0cnVlLCB2YWx1ZTogcHJlZml4ID8gXCJcIi5jb25jYXQocHJlZml4LCBcIiBcIiwgbmFtZSkgOiBuYW1lIH0pO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpIHtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5tZXRhZGF0YSA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gUmVmbGVjdC5tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0ZXIodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19nZW5lcmF0b3IodGhpc0FyZywgYm9keSkge1xyXG4gICAgdmFyIF8gPSB7IGxhYmVsOiAwLCBzZW50OiBmdW5jdGlvbigpIHsgaWYgKHRbMF0gJiAxKSB0aHJvdyB0WzFdOyByZXR1cm4gdFsxXTsgfSwgdHJ5czogW10sIG9wczogW10gfSwgZiwgeSwgdCwgZyA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBJdGVyYXRvciA9PT0gXCJmdW5jdGlvblwiID8gSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSk7XHJcbiAgICByZXR1cm4gZy5uZXh0ID0gdmVyYigwKSwgZ1tcInRocm93XCJdID0gdmVyYigxKSwgZ1tcInJldHVyblwiXSA9IHZlcmIoMiksIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoZyAmJiAoZyA9IDAsIG9wWzBdICYmIChfID0gMCkpLCBfKSB0cnkge1xyXG4gICAgICAgICAgICBpZiAoZiA9IDEsIHkgJiYgKHQgPSBvcFswXSAmIDIgPyB5W1wicmV0dXJuXCJdIDogb3BbMF0gPyB5W1widGhyb3dcIl0gfHwgKCh0ID0geVtcInJldHVyblwiXSkgJiYgdC5jYWxsKHkpLCAwKSA6IHkubmV4dCkgJiYgISh0ID0gdC5jYWxsKHksIG9wWzFdKSkuZG9uZSkgcmV0dXJuIHQ7XHJcbiAgICAgICAgICAgIGlmICh5ID0gMCwgdCkgb3AgPSBbb3BbMF0gJiAyLCB0LnZhbHVlXTtcclxuICAgICAgICAgICAgc3dpdGNoIChvcFswXSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAwOiBjYXNlIDE6IHQgPSBvcDsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDQ6IF8ubGFiZWwrKzsgcmV0dXJuIHsgdmFsdWU6IG9wWzFdLCBkb25lOiBmYWxzZSB9O1xyXG4gICAgICAgICAgICAgICAgY2FzZSA1OiBfLmxhYmVsKys7IHkgPSBvcFsxXTsgb3AgPSBbMF07IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA3OiBvcCA9IF8ub3BzLnBvcCgpOyBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBpZiAoISh0ID0gXy50cnlzLCB0ID0gdC5sZW5ndGggPiAwICYmIHRbdC5sZW5ndGggLSAxXSkgJiYgKG9wWzBdID09PSA2IHx8IG9wWzBdID09PSAyKSkgeyBfID0gMDsgY29udGludWU7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDMgJiYgKCF0IHx8IChvcFsxXSA+IHRbMF0gJiYgb3BbMV0gPCB0WzNdKSkpIHsgXy5sYWJlbCA9IG9wWzFdOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gNiAmJiBfLmxhYmVsIDwgdFsxXSkgeyBfLmxhYmVsID0gdFsxXTsgdCA9IG9wOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ICYmIF8ubGFiZWwgPCB0WzJdKSB7IF8ubGFiZWwgPSB0WzJdOyBfLm9wcy5wdXNoKG9wKTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodFsyXSkgXy5vcHMucG9wKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvcCA9IGJvZHkuY2FsbCh0aGlzQXJnLCBfKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7IG9wID0gWzYsIGVdOyB5ID0gMDsgfSBmaW5hbGx5IHsgZiA9IHQgPSAwOyB9XHJcbiAgICAgICAgaWYgKG9wWzBdICYgNSkgdGhyb3cgb3BbMV07IHJldHVybiB7IHZhbHVlOiBvcFswXSA/IG9wWzFdIDogdm9pZCAwLCBkb25lOiB0cnVlIH07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19jcmVhdGVCaW5kaW5nID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihtLCBrKTtcclxuICAgIGlmICghZGVzYyB8fCAoXCJnZXRcIiBpbiBkZXNjID8gIW0uX19lc01vZHVsZSA6IGRlc2Mud3JpdGFibGUgfHwgZGVzYy5jb25maWd1cmFibGUpKSB7XHJcbiAgICAgICAgZGVzYyA9IHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfTtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBrMiwgZGVzYyk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tLCBwYWNrKSB7XHJcbiAgICBpZiAocGFjayB8fCBhcmd1bWVudHMubGVuZ3RoID09PSAyKSBmb3IgKHZhciBpID0gMCwgbCA9IGZyb20ubGVuZ3RoLCBhcjsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmIChhciB8fCAhKGkgaW4gZnJvbSkpIHtcclxuICAgICAgICAgICAgaWYgKCFhcikgYXIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tLCAwLCBpKTtcclxuICAgICAgICAgICAgYXJbaV0gPSBmcm9tW2ldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0by5jb25jYXQoYXIgfHwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSkpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdCh2KSB7XHJcbiAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIF9fYXdhaXQgPyAodGhpcy52ID0gdiwgdGhpcykgOiBuZXcgX19hd2FpdCh2KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNHZW5lcmF0b3IodGhpc0FyZywgX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIGcgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSksIGksIHEgPSBbXTtcclxuICAgIHJldHVybiBpID0gT2JqZWN0LmNyZWF0ZSgodHlwZW9mIEFzeW5jSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEFzeW5jSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSksIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiwgYXdhaXRSZXR1cm4pLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiBhd2FpdFJldHVybihmKSB7IHJldHVybiBmdW5jdGlvbiAodikgeyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZiwgcmVqZWN0KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlmIChnW25dKSB7IGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IGlmIChmKSBpW25dID0gZihpW25dKTsgfSB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogZmFsc2UgfSA6IGYgPyBmKHYpIDogdjsgfSA6IGY7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNWYWx1ZXMobykge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBtID0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sIGk7XHJcbiAgICByZXR1cm4gbSA/IG0uY2FsbChvKSA6IChvID0gdHlwZW9mIF9fdmFsdWVzID09PSBcImZ1bmN0aW9uXCIgPyBfX3ZhbHVlcyhvKSA6IG9bU3ltYm9sLml0ZXJhdG9yXSgpLCBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaSk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaVtuXSA9IG9bbl0gJiYgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgdiA9IG9bbl0odiksIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHYuZG9uZSwgdi52YWx1ZSk7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCBkLCB2KSB7IFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGZ1bmN0aW9uKHYpIHsgcmVzb2x2ZSh7IHZhbHVlOiB2LCBkb25lOiBkIH0pOyB9LCByZWplY3QpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdykge1xyXG4gICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkgeyBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29va2VkLCBcInJhd1wiLCB7IHZhbHVlOiByYXcgfSk7IH0gZWxzZSB7IGNvb2tlZC5yYXcgPSByYXc7IH1cclxuICAgIHJldHVybiBjb29rZWQ7XHJcbn07XHJcblxyXG52YXIgX19zZXRNb2R1bGVEZWZhdWx0ID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgXCJkZWZhdWx0XCIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgdmFsdWU6IHYgfSk7XHJcbn0pIDogZnVuY3Rpb24obywgdikge1xyXG4gICAgb1tcImRlZmF1bHRcIl0gPSB2O1xyXG59O1xyXG5cclxudmFyIG93bktleXMgPSBmdW5jdGlvbihvKSB7XHJcbiAgICBvd25LZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgfHwgZnVuY3Rpb24gKG8pIHtcclxuICAgICAgICB2YXIgYXIgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBrIGluIG8pIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgaykpIGFyW2FyLmxlbmd0aF0gPSBrO1xyXG4gICAgICAgIHJldHVybiBhcjtcclxuICAgIH07XHJcbiAgICByZXR1cm4gb3duS2V5cyhvKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrID0gb3duS2V5cyhtb2QpLCBpID0gMDsgaSA8IGsubGVuZ3RoOyBpKyspIGlmIChrW2ldICE9PSBcImRlZmF1bHRcIikgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrW2ldKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRJbihzdGF0ZSwgcmVjZWl2ZXIpIHtcclxuICAgIGlmIChyZWNlaXZlciA9PT0gbnVsbCB8fCAodHlwZW9mIHJlY2VpdmVyICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiByZWNlaXZlciAhPT0gXCJmdW5jdGlvblwiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgJ2luJyBvcGVyYXRvciBvbiBub24tb2JqZWN0XCIpO1xyXG4gICAgcmV0dXJuIHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgPT09IHN0YXRlIDogc3RhdGUuaGFzKHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlKGVudiwgdmFsdWUsIGFzeW5jKSB7XHJcbiAgICBpZiAodmFsdWUgIT09IG51bGwgJiYgdmFsdWUgIT09IHZvaWQgMCkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgZXhwZWN0ZWQuXCIpO1xyXG4gICAgICAgIHZhciBkaXNwb3NlLCBpbm5lcjtcclxuICAgICAgICBpZiAoYXN5bmMpIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuYXN5bmNEaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jRGlzcG9zZSBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICAgICAgICAgIGRpc3Bvc2UgPSB2YWx1ZVtTeW1ib2wuYXN5bmNEaXNwb3NlXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGRpc3Bvc2UgPT09IHZvaWQgMCkge1xyXG4gICAgICAgICAgICBpZiAoIVN5bWJvbC5kaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmRpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmRpc3Bvc2VdO1xyXG4gICAgICAgICAgICBpZiAoYXN5bmMpIGlubmVyID0gZGlzcG9zZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkaXNwb3NlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3Qgbm90IGRpc3Bvc2FibGUuXCIpO1xyXG4gICAgICAgIGlmIChpbm5lcikgZGlzcG9zZSA9IGZ1bmN0aW9uKCkgeyB0cnkgeyBpbm5lci5jYWxsKHRoaXMpOyB9IGNhdGNoIChlKSB7IHJldHVybiBQcm9taXNlLnJlamVjdChlKTsgfSB9O1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgdmFsdWU6IHZhbHVlLCBkaXNwb3NlOiBkaXNwb3NlLCBhc3luYzogYXN5bmMgfSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChhc3luYykge1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgYXN5bmM6IHRydWUgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcblxyXG59XHJcblxyXG52YXIgX1N1cHByZXNzZWRFcnJvciA9IHR5cGVvZiBTdXBwcmVzc2VkRXJyb3IgPT09IFwiZnVuY3Rpb25cIiA/IFN1cHByZXNzZWRFcnJvciA6IGZ1bmN0aW9uIChlcnJvciwgc3VwcHJlc3NlZCwgbWVzc2FnZSkge1xyXG4gICAgdmFyIGUgPSBuZXcgRXJyb3IobWVzc2FnZSk7XHJcbiAgICByZXR1cm4gZS5uYW1lID0gXCJTdXBwcmVzc2VkRXJyb3JcIiwgZS5lcnJvciA9IGVycm9yLCBlLnN1cHByZXNzZWQgPSBzdXBwcmVzc2VkLCBlO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGlzcG9zZVJlc291cmNlcyhlbnYpIHtcclxuICAgIGZ1bmN0aW9uIGZhaWwoZSkge1xyXG4gICAgICAgIGVudi5lcnJvciA9IGVudi5oYXNFcnJvciA/IG5ldyBfU3VwcHJlc3NlZEVycm9yKGUsIGVudi5lcnJvciwgXCJBbiBlcnJvciB3YXMgc3VwcHJlc3NlZCBkdXJpbmcgZGlzcG9zYWwuXCIpIDogZTtcclxuICAgICAgICBlbnYuaGFzRXJyb3IgPSB0cnVlO1xyXG4gICAgfVxyXG4gICAgdmFyIHIsIHMgPSAwO1xyXG4gICAgZnVuY3Rpb24gbmV4dCgpIHtcclxuICAgICAgICB3aGlsZSAociA9IGVudi5zdGFjay5wb3AoKSkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFyLmFzeW5jICYmIHMgPT09IDEpIHJldHVybiBzID0gMCwgZW52LnN0YWNrLnB1c2gociksIFByb21pc2UucmVzb2x2ZSgpLnRoZW4obmV4dCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoci5kaXNwb3NlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHIuZGlzcG9zZS5jYWxsKHIudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChyLmFzeW5jKSByZXR1cm4gcyB8PSAyLCBQcm9taXNlLnJlc29sdmUocmVzdWx0KS50aGVuKG5leHQsIGZ1bmN0aW9uKGUpIHsgZmFpbChlKTsgcmV0dXJuIG5leHQoKTsgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHMgfD0gMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgZmFpbChlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocyA9PT0gMSkgcmV0dXJuIGVudi5oYXNFcnJvciA/IFByb21pc2UucmVqZWN0KGVudi5lcnJvcikgOiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgICBpZiAoZW52Lmhhc0Vycm9yKSB0aHJvdyBlbnYuZXJyb3I7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV4dCgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24ocGF0aCwgcHJlc2VydmVKc3gpIHtcclxuICAgIGlmICh0eXBlb2YgcGF0aCA9PT0gXCJzdHJpbmdcIiAmJiAvXlxcLlxcLj9cXC8vLnRlc3QocGF0aCkpIHtcclxuICAgICAgICByZXR1cm4gcGF0aC5yZXBsYWNlKC9cXC4odHN4KSR8KCg/OlxcLmQpPykoKD86XFwuW14uL10rPyk/KVxcLihbY21dPyl0cyQvaSwgZnVuY3Rpb24gKG0sIHRzeCwgZCwgZXh0LCBjbSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHN4ID8gcHJlc2VydmVKc3ggPyBcIi5qc3hcIiA6IFwiLmpzXCIgOiBkICYmICghZXh0IHx8ICFjbSkgPyBtIDogKGQgKyBleHQgKyBcIi5cIiArIGNtLnRvTG93ZXJDYXNlKCkgKyBcImpzXCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBhdGg7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIF9fZXh0ZW5kczogX19leHRlbmRzLFxyXG4gICAgX19hc3NpZ246IF9fYXNzaWduLFxyXG4gICAgX19yZXN0OiBfX3Jlc3QsXHJcbiAgICBfX2RlY29yYXRlOiBfX2RlY29yYXRlLFxyXG4gICAgX19wYXJhbTogX19wYXJhbSxcclxuICAgIF9fZXNEZWNvcmF0ZTogX19lc0RlY29yYXRlLFxyXG4gICAgX19ydW5Jbml0aWFsaXplcnM6IF9fcnVuSW5pdGlhbGl6ZXJzLFxyXG4gICAgX19wcm9wS2V5OiBfX3Byb3BLZXksXHJcbiAgICBfX3NldEZ1bmN0aW9uTmFtZTogX19zZXRGdW5jdGlvbk5hbWUsXHJcbiAgICBfX21ldGFkYXRhOiBfX21ldGFkYXRhLFxyXG4gICAgX19hd2FpdGVyOiBfX2F3YWl0ZXIsXHJcbiAgICBfX2dlbmVyYXRvcjogX19nZW5lcmF0b3IsXHJcbiAgICBfX2NyZWF0ZUJpbmRpbmc6IF9fY3JlYXRlQmluZGluZyxcclxuICAgIF9fZXhwb3J0U3RhcjogX19leHBvcnRTdGFyLFxyXG4gICAgX192YWx1ZXM6IF9fdmFsdWVzLFxyXG4gICAgX19yZWFkOiBfX3JlYWQsXHJcbiAgICBfX3NwcmVhZDogX19zcHJlYWQsXHJcbiAgICBfX3NwcmVhZEFycmF5czogX19zcHJlYWRBcnJheXMsXHJcbiAgICBfX3NwcmVhZEFycmF5OiBfX3NwcmVhZEFycmF5LFxyXG4gICAgX19hd2FpdDogX19hd2FpdCxcclxuICAgIF9fYXN5bmNHZW5lcmF0b3I6IF9fYXN5bmNHZW5lcmF0b3IsXHJcbiAgICBfX2FzeW5jRGVsZWdhdG9yOiBfX2FzeW5jRGVsZWdhdG9yLFxyXG4gICAgX19hc3luY1ZhbHVlczogX19hc3luY1ZhbHVlcyxcclxuICAgIF9fbWFrZVRlbXBsYXRlT2JqZWN0OiBfX21ha2VUZW1wbGF0ZU9iamVjdCxcclxuICAgIF9faW1wb3J0U3RhcjogX19pbXBvcnRTdGFyLFxyXG4gICAgX19pbXBvcnREZWZhdWx0OiBfX2ltcG9ydERlZmF1bHQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0OiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldDogX19jbGFzc1ByaXZhdGVGaWVsZFNldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRJbjogX19jbGFzc1ByaXZhdGVGaWVsZEluLFxyXG4gICAgX19hZGREaXNwb3NhYmxlUmVzb3VyY2U6IF9fYWRkRGlzcG9zYWJsZVJlc291cmNlLFxyXG4gICAgX19kaXNwb3NlUmVzb3VyY2VzOiBfX2Rpc3Bvc2VSZXNvdXJjZXMsXHJcbiAgICBfX3Jld3JpdGVSZWxhdGl2ZUltcG9ydEV4dGVuc2lvbjogX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24sXHJcbn07XHJcbiIsImltcG9ydCB7IEFwcCwgSXRlbVZpZXcsIE1vZGFsLCBOb3RpY2UsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgVEZpbGUsIFdvcmtzcGFjZUxlYWYsIFRleHRBcmVhQ29tcG9uZW50LCBCdXR0b25Db21wb25lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgKiBhcyBUU05FIGZyb20gJ3RzbmUtanMnO1xuXG4vLyBJbnRlcmZhY2UgZm9yIG5vdGUgY29ubmVjdGlvbnNcbmludGVyZmFjZSBOb3RlQ29ubmVjdGlvbiB7XG4gIHNvdXJjZU5vdGU6IFRTTkVQb2ludDtcbiAgdGFyZ2V0Tm90ZTogVFNORVBvaW50O1xuICBzaW1pbGFyaXR5OiBudW1iZXI7XG4gIGNvbW1vblRlcm1zOiBzdHJpbmdbXTtcbiAgY2x1c3RlclRlcm1zOiBzdHJpbmdbXTtcbiAgcmVhc29uOiBzdHJpbmc7XG4gIGxsbURlc2NyaXB0aW9uPzogc3RyaW5nO1xufVxuXG4vLyBNb2RhbCBmb3IgZGlzcGxheWluZyBhbmQgcHJvY2Vzc2luZyBzdWdnZXN0ZWQgbGlua3NcbmNsYXNzIFN1Z2dlc3RlZExpbmtzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIHByaXZhdGUgY29ubmVjdGlvbnM6IE5vdGVDb25uZWN0aW9uW107XG4gIHByaXZhdGUgcGx1Z2luOiBWaWJlQm95UGx1Z2luO1xuICBwcml2YXRlIHNlbGVjdGVkQ29ubmVjdGlvbkluZGV4OiBudW1iZXIgPSAwO1xuICBwcml2YXRlIHByb2Nlc3NpbmdDb25uZWN0aW9uOiBib29sZWFuID0gZmFsc2U7XG4gIFxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgY29ubmVjdGlvbnM6IE5vdGVDb25uZWN0aW9uW10sIHBsdWdpbjogVmliZUJveVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5jb25uZWN0aW9ucyA9IGNvbm5lY3Rpb25zO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG4gIFxuICBhc3luYyBvbk9wZW4oKSB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgXG4gICAgLy8gU2V0IG1vZGFsIHRpdGxlXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1N1Z2dlc3RlZCBOb3RlIENvbm5lY3Rpb25zJyB9KTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IFxuICAgICAgdGV4dDogJ0JlbG93IGFyZSBwb3RlbnRpYWwgY29ubmVjdGlvbnMgYmV0d2VlbiBub3RlcyBiYXNlZCBvbiBjb250ZW50IHNpbWlsYXJpdHkuICcgK1xuICAgICAgICAgICAgJ1NlbGVjdCBhIGNvbm5lY3Rpb24gYW5kIGdlbmVyYXRlIGEgZGVzY3JpcHRpb24gdG8gY3JlYXRlIGEgbGluayBiZXR3ZWVuIHRoZSBub3Rlcy4nXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQ3JlYXRlIGNvbnRhaW5lciBmb3IgY29ubmVjdGlvbnMgbGlzdFxuICAgIGNvbnN0IGNvbm5lY3Rpb25zQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Nvbm5lY3Rpb25zLWNvbnRhaW5lcicgfSk7XG4gICAgXG4gICAgLy8gQ3JlYXRlIGNvbnRhaW5lciBmb3Igc2VsZWN0ZWQgY29ubmVjdGlvbiBkZXRhaWxzXG4gICAgY29uc3QgZGV0YWlsc0NvbnRhaW5lciA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdjb25uZWN0aW9uLWRldGFpbHMnIH0pO1xuICAgIFxuICAgIC8vIEFkZCBzb21lIENTU1xuICAgIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBzdHlsZS50ZXh0Q29udGVudCA9IGBcbiAgICAgIC5jb25uZWN0aW9ucy1jb250YWluZXIge1xuICAgICAgICBtYXgtaGVpZ2h0OiAxNTBweDtcbiAgICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTVweDtcbiAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICB9XG4gICAgICAuY29ubmVjdGlvbi1pdGVtIHtcbiAgICAgICAgcGFkZGluZzogOHB4IDEycHg7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyKTtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLWl0ZW06aG92ZXIge1xuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1iYWNrZ3JvdW5kLXNlY29uZGFyeSk7XG4gICAgICB9XG4gICAgICAuY29ubmVjdGlvbi1pdGVtLnNlbGVjdGVkIHtcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KTtcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtb24tYWNjZW50KTtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLWRldGFpbHMge1xuICAgICAgICBwYWRkaW5nOiAxMHB4O1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlcik7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTVweDtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLXN0YXRzIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuICAgICAgfVxuICAgICAgLmdlbmVyYXRlLWJ1dHRvbiB7XG4gICAgICAgIG1hcmdpbi10b3A6IDEwcHg7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7XG4gICAgICB9XG4gICAgICAubGxtLWRlc2NyaXB0aW9uIHtcbiAgICAgICAgbWFyZ2luLXRvcDogMTBweDtcbiAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgIG1pbi1oZWlnaHQ6IDEwMHB4O1xuICAgICAgfVxuICAgICAgLmJ1dHRvbi1jb250YWluZXIge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgIG1hcmdpbi10b3A6IDE1cHg7XG4gICAgICB9XG4gICAgYDtcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICBcbiAgICAvLyBSZW5kZXIgY29ubmVjdGlvbnMgbGlzdFxuICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbnNMaXN0KGNvbm5lY3Rpb25zQ29udGFpbmVyKTtcbiAgICBcbiAgICAvLyBSZW5kZXIgZGV0YWlscyBmb3IgdGhlIGZpcnN0IGNvbm5lY3Rpb25cbiAgICB0aGlzLnJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKGRldGFpbHNDb250YWluZXIsIHRoaXMuY29ubmVjdGlvbnNbMF0pO1xuICAgIFxuICAgIC8vIEZvY3VzIHRoZSBmaXJzdCBjb25uZWN0aW9uXG4gICAgdGhpcy5zZWxlY3RDb25uZWN0aW9uKDApO1xuICB9XG4gIFxuICBwcml2YXRlIHJlbmRlckNvbm5lY3Rpb25zTGlzdChjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgXG4gICAgdGhpcy5jb25uZWN0aW9ucy5mb3JFYWNoKChjb25uZWN0aW9uLCBpbmRleCkgPT4ge1xuICAgICAgY29uc3QgaXRlbSA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICdjb25uZWN0aW9uLWl0ZW0nIH0pO1xuICAgICAgaWYgKGluZGV4ID09PSB0aGlzLnNlbGVjdGVkQ29ubmVjdGlvbkluZGV4KSB7XG4gICAgICAgIGl0ZW0uYWRkQ2xhc3MoJ3NlbGVjdGVkJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNvdXJjZVRpdGxlID0gY29ubmVjdGlvbi5zb3VyY2VOb3RlLnRpdGxlO1xuICAgICAgY29uc3QgdGFyZ2V0VGl0bGUgPSBjb25uZWN0aW9uLnRhcmdldE5vdGUudGl0bGU7XG4gICAgICBjb25zdCBzaW1pbGFyaXR5ID0gTWF0aC5yb3VuZChjb25uZWN0aW9uLnNpbWlsYXJpdHkpO1xuICAgICAgXG4gICAgICBpdGVtLmNyZWF0ZUVsKCdkaXYnLCB7IHRleHQ6IGAke3NvdXJjZVRpdGxlfSDihpQgJHt0YXJnZXRUaXRsZX0gKCR7c2ltaWxhcml0eX0lIHNpbWlsYXJpdHkpYCB9KTtcbiAgICAgIFxuICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgdGhpcy5zZWxlY3RDb25uZWN0aW9uKGluZGV4KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIFxuICBwcml2YXRlIHJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGNvbm5lY3Rpb246IE5vdGVDb25uZWN0aW9uKSB7XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgXG4gICAgY29uc3Qgc291cmNlTm90ZSA9IGNvbm5lY3Rpb24uc291cmNlTm90ZTtcbiAgICBjb25zdCB0YXJnZXROb3RlID0gY29ubmVjdGlvbi50YXJnZXROb3RlO1xuICAgIFxuICAgIC8vIE5vdGUgdGl0bGVzIGFuZCBwYXRoc1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6IGBDb25uZWN0aW9uOiAke3NvdXJjZU5vdGUudGl0bGV9IOKGlCAke3RhcmdldE5vdGUudGl0bGV9YCB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYFNvdXJjZTogJHtzb3VyY2VOb3RlLnBhdGh9YCB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYFRhcmdldDogJHt0YXJnZXROb3RlLnBhdGh9YCB9KTtcbiAgICBcbiAgICAvLyBTdGF0c1xuICAgIGNvbnN0IHN0YXRzRGl2ID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ2Nvbm5lY3Rpb24tc3RhdHMnIH0pO1xuICAgIHN0YXRzRGl2LmNyZWF0ZUVsKCdkaXYnLCB7IHRleHQ6IGBTaW1pbGFyaXR5OiAke01hdGgucm91bmQoY29ubmVjdGlvbi5zaW1pbGFyaXR5KX0lYCB9KTtcbiAgICBzdGF0c0Rpdi5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgJHtzb3VyY2VOb3RlLndvcmRDb3VudCB8fCAnPyd9IHdvcmRzIC8gJHt0YXJnZXROb3RlLndvcmRDb3VudCB8fCAnPyd9IHdvcmRzYCB9KTtcbiAgICBcbiAgICAvLyBTaGFyZWQgdGVybXNcbiAgICBpZiAoY29ubmVjdGlvbi5jb21tb25UZXJtcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYENvbW1vbiB0ZXJtczogJHtjb25uZWN0aW9uLmNvbW1vblRlcm1zLmpvaW4oJywgJyl9YCB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ2x1c3RlciB0ZXJtc1xuICAgIGlmIChjb25uZWN0aW9uLmNsdXN0ZXJUZXJtcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYENsdXN0ZXIgdGVybXM6ICR7Y29ubmVjdGlvbi5jbHVzdGVyVGVybXMuam9pbignLCAnKX1gIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyBSZWFzb24gZm9yIGNvbm5lY3Rpb25cbiAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYENvbm5lY3Rpb24gcmVhc29uOiAke2Nvbm5lY3Rpb24ucmVhc29ufWAgfSk7XG4gICAgXG4gICAgLy8gR2VuZXJhdGUgZGVzY3JpcHRpb24gYnV0dG9uXG4gICAgY29uc3QgZ2VuZXJhdGVCdXR0b24gPSBuZXcgQnV0dG9uQ29tcG9uZW50KGNvbnRhaW5lcilcbiAgICAgIC5zZXRCdXR0b25UZXh0KCdHZW5lcmF0ZSBDb25uZWN0aW9uIERlc2NyaXB0aW9uJylcbiAgICAgIC5zZXRDdGEoKSAvLyBVc2Ugc2V0Q3RhKCkgaW5zdGVhZCBvZiBzZXRDbGFzcyB3aXRoIHNwYWNlc1xuICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLmdlbmVyYXRlTExNRGVzY3JpcHRpb24oY29ubmVjdGlvbik7XG4gICAgICB9KTtcbiAgICBcbiAgICAvLyBBZGQgY2xhc3Mgd2l0aG91dCBzcGFjZXNcbiAgICBnZW5lcmF0ZUJ1dHRvbi5idXR0b25FbC5hZGRDbGFzcygnZ2VuZXJhdGUtYnV0dG9uJyk7XG4gICAgXG4gICAgaWYgKHRoaXMucHJvY2Vzc2luZ0Nvbm5lY3Rpb24pIHtcbiAgICAgIGdlbmVyYXRlQnV0dG9uLnNldERpc2FibGVkKHRydWUpO1xuICAgICAgZ2VuZXJhdGVCdXR0b24uc2V0QnV0dG9uVGV4dCgnR2VuZXJhdGluZy4uLicpO1xuICAgIH1cbiAgICBcbiAgICAvLyBEZXNjcmlwdGlvbiB0ZXh0IGFyZWFcbiAgICBpZiAoY29ubmVjdGlvbi5sbG1EZXNjcmlwdGlvbikge1xuICAgICAgY29uc3QgZGVzY3JpcHRpb25Db250YWluZXIgPSBjb250YWluZXIuY3JlYXRlRGl2KCk7XG4gICAgICBkZXNjcmlwdGlvbkNvbnRhaW5lci5jcmVhdGVFbCgnaDQnLCB7IHRleHQ6ICdDb25uZWN0aW9uIERlc2NyaXB0aW9uOicgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRleHRBcmVhID0gbmV3IFRleHRBcmVhQ29tcG9uZW50KGRlc2NyaXB0aW9uQ29udGFpbmVyKVxuICAgICAgICAuc2V0VmFsdWUoY29ubmVjdGlvbi5sbG1EZXNjcmlwdGlvbilcbiAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdDb25uZWN0aW9uIGRlc2NyaXB0aW9uIHdpbGwgYXBwZWFyIGhlcmUuLi4nKTtcbiAgICAgIFxuICAgICAgdGV4dEFyZWEuaW5wdXRFbC5hZGRDbGFzcygnbGxtLWRlc2NyaXB0aW9uJyk7XG4gICAgICBcbiAgICAgIC8vIENyZWF0ZSBidXR0b25cbiAgICAgIGNvbnN0IGJ1dHRvbkNvbnRhaW5lciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICdidXR0b24tY29udGFpbmVyJyB9KTtcbiAgICAgIFxuICAgICAgbmV3IEJ1dHRvbkNvbXBvbmVudChidXR0b25Db250YWluZXIpXG4gICAgICAgIC5zZXRCdXR0b25UZXh0KCdDcmVhdGUgTGluaycpXG4gICAgICAgIC5zZXRDdGEoKSAvLyBVc2Ugc2V0Q3RhKCkgaW5zdGVhZCBvZiBzZXRDbGFzcyB3aXRoIHNwYWNlc1xuICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5jcmVhdGVMaW5rKGNvbm5lY3Rpb24sIHRleHRBcmVhLmdldFZhbHVlKCkpO1xuICAgICAgICB9KTtcbiAgICAgIFxuICAgICAgbmV3IEJ1dHRvbkNvbXBvbmVudChidXR0b25Db250YWluZXIpXG4gICAgICAgIC5zZXRCdXR0b25UZXh0KCdFZGl0IERlc2NyaXB0aW9uJylcbiAgICAgICAgLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRleHRBcmVhLnNldERpc2FibGVkKGZhbHNlKTtcbiAgICAgICAgICB0ZXh0QXJlYS5pbnB1dEVsLmZvY3VzKCk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBzZWxlY3RDb25uZWN0aW9uKGluZGV4OiBudW1iZXIpIHtcbiAgICBpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMuY29ubmVjdGlvbnMubGVuZ3RoKSByZXR1cm47XG4gICAgXG4gICAgdGhpcy5zZWxlY3RlZENvbm5lY3Rpb25JbmRleCA9IGluZGV4O1xuICAgIGNvbnN0IGNvbm5lY3Rpb25Db250YWluZXIgPSB0aGlzLmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKCcuY29ubmVjdGlvbnMtY29udGFpbmVyJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgY29uc3QgZGV0YWlsc0NvbnRhaW5lciA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJy5jb25uZWN0aW9uLWRldGFpbHMnKSBhcyBIVE1MRWxlbWVudDtcbiAgICBcbiAgICBpZiAoY29ubmVjdGlvbkNvbnRhaW5lciAmJiBkZXRhaWxzQ29udGFpbmVyKSB7XG4gICAgICB0aGlzLnJlbmRlckNvbm5lY3Rpb25zTGlzdChjb25uZWN0aW9uQ29udGFpbmVyKTtcbiAgICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoZGV0YWlsc0NvbnRhaW5lciwgdGhpcy5jb25uZWN0aW9uc1tpbmRleF0pO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBnZW5lcmF0ZUxMTURlc2NyaXB0aW9uKGNvbm5lY3Rpb246IE5vdGVDb25uZWN0aW9uKSB7XG4gICAgaWYgKHRoaXMucHJvY2Vzc2luZ0Nvbm5lY3Rpb24pIHJldHVybjtcbiAgICBcbiAgICB0aGlzLnByb2Nlc3NpbmdDb25uZWN0aW9uID0gdHJ1ZTtcbiAgICBjb25zdCBkZXRhaWxzQ29udGFpbmVyID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignLmNvbm5lY3Rpb24tZGV0YWlscycpIGFzIEhUTUxFbGVtZW50O1xuICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoZGV0YWlsc0NvbnRhaW5lciwgY29ubmVjdGlvbik7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIEZldGNoIHNvdXJjZSBhbmQgdGFyZ2V0IG5vdGUgY29udGVudFxuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb25uZWN0aW9uLnNvdXJjZU5vdGUucGF0aCk7XG4gICAgICBjb25zdCB0YXJnZXRGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbm5lY3Rpb24udGFyZ2V0Tm90ZS5wYXRoKTtcbiAgICAgIFxuICAgICAgaWYgKCEoc291cmNlRmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB8fCAhKHRhcmdldEZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBub3RlIGZpbGVzJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKHNvdXJjZUZpbGUpO1xuICAgICAgY29uc3QgdGFyZ2V0Q29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQodGFyZ2V0RmlsZSk7XG4gICAgICBcbiAgICAgIC8vIFByZXBhcmUgZGF0YSBmb3IgTExNIGNhbGxcbiAgICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgIHNvdXJjZU5vdGU6IHtcbiAgICAgICAgICB0aXRsZTogY29ubmVjdGlvbi5zb3VyY2VOb3RlLnRpdGxlLFxuICAgICAgICAgIGNvbnRlbnQ6IHNvdXJjZUNvbnRlbnQuc3Vic3RyaW5nKDAsIDEwMDApLCAvLyBMaW1pdCB0byBmaXJzdCAxMDAwIGNoYXJzXG4gICAgICAgICAgdG9wVGVybXM6IGNvbm5lY3Rpb24uc291cmNlTm90ZS50b3BfdGVybXNcbiAgICAgICAgfSxcbiAgICAgICAgdGFyZ2V0Tm90ZToge1xuICAgICAgICAgIHRpdGxlOiBjb25uZWN0aW9uLnRhcmdldE5vdGUudGl0bGUsXG4gICAgICAgICAgY29udGVudDogdGFyZ2V0Q29udGVudC5zdWJzdHJpbmcoMCwgMTAwMCksIC8vIExpbWl0IHRvIGZpcnN0IDEwMDAgY2hhcnNcbiAgICAgICAgICB0b3BUZXJtczogY29ubmVjdGlvbi50YXJnZXROb3RlLnRvcF90ZXJtc1xuICAgICAgICB9LFxuICAgICAgICBjb21tb25UZXJtczogY29ubmVjdGlvbi5jb21tb25UZXJtcyxcbiAgICAgICAgY2x1c3RlclRlcm1zOiBjb25uZWN0aW9uLmNsdXN0ZXJUZXJtcyxcbiAgICAgICAgcmVhc29uOiBjb25uZWN0aW9uLnJlYXNvblxuICAgICAgfTtcbiAgICAgIFxuICAgICAgLy8gQ2FsbCB0aGUgTExNIHNlcnZpY2VcbiAgICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gYXdhaXQgdGhpcy5jYWxsTExNU2VydmljZShkYXRhKTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIHRoZSBjb25uZWN0aW9uIHdpdGggdGhlIGdlbmVyYXRlZCBkZXNjcmlwdGlvblxuICAgICAgY29ubmVjdGlvbi5sbG1EZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgdGhlIFVJXG4gICAgICB0aGlzLnByb2Nlc3NpbmdDb25uZWN0aW9uID0gZmFsc2U7XG4gICAgICBjb25zdCBkZXRhaWxzQ29udGFpbmVyID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignLmNvbm5lY3Rpb24tZGV0YWlscycpIGFzIEhUTUxFbGVtZW50O1xuICAgICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uRGV0YWlscyhkZXRhaWxzQ29udGFpbmVyLCBjb25uZWN0aW9uKTtcbiAgICAgIFxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLnByb2Nlc3NpbmdDb25uZWN0aW9uID0gZmFsc2U7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZW5lcmF0aW5nIGRlc2NyaXB0aW9uOicsIGVycm9yKTtcbiAgICAgIG5ldyBOb3RpY2UoYEZhaWxlZCB0byBnZW5lcmF0ZSBkZXNjcmlwdGlvbjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgVUkgdG8gc2hvdyBlcnJvclxuICAgICAgY29uc3QgZGV0YWlsc0NvbnRhaW5lciA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJy5jb25uZWN0aW9uLWRldGFpbHMnKSBhcyBIVE1MRWxlbWVudDtcbiAgICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoZGV0YWlsc0NvbnRhaW5lciwgY29ubmVjdGlvbik7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGNhbGxMTE1TZXJ2aWNlKGRhdGE6IGFueSk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIFRyeSB0byBjb25uZWN0IHRvIHRoZSBsb2NhbCBMTE0gQVBJIHNlcnZlclxuICAgICAgY29uc3Qgc291cmNlVGl0bGUgPSBkYXRhLnNvdXJjZU5vdGUudGl0bGU7XG4gICAgICBjb25zdCB0YXJnZXRUaXRsZSA9IGRhdGEudGFyZ2V0Tm90ZS50aXRsZTtcbiAgICAgIGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBkYXRhLnNvdXJjZU5vdGUuY29udGVudDtcbiAgICAgIGNvbnN0IHRhcmdldENvbnRlbnQgPSBkYXRhLnRhcmdldE5vdGUuY29udGVudDtcbiAgICAgIGNvbnN0IGNvbW1vblRlcm1zID0gZGF0YS5jb21tb25UZXJtcy5qb2luKCcsICcpO1xuICAgICAgY29uc3QgY2x1c3RlclRlcm1zID0gZGF0YS5jbHVzdGVyVGVybXMuam9pbignLCAnKTtcbiAgICAgIFxuICAgICAgLy8gRmlyc3QsIHRyeSB0byB1c2UgdGhlIFB5dGhvbiBzZXJ2ZXIncyBMTE0gaW50ZWdyYXRpb25cbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJ2h0dHA6Ly8xMjcuMC4wLjE6MTIzNC9nZW5lcmF0ZV9jb25uZWN0aW9uJywge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBzb3VyY2Vfbm90ZToge1xuICAgICAgICAgICAgdGl0bGU6IHNvdXJjZVRpdGxlLFxuICAgICAgICAgICAgY29udGVudDogc291cmNlQ29udGVudCxcbiAgICAgICAgICAgIHRlcm1zOiBkYXRhLnNvdXJjZU5vdGUudG9wVGVybXNcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRhcmdldF9ub3RlOiB7XG4gICAgICAgICAgICB0aXRsZTogdGFyZ2V0VGl0bGUsXG4gICAgICAgICAgICBjb250ZW50OiB0YXJnZXRDb250ZW50LFxuICAgICAgICAgICAgdGVybXM6IGRhdGEudGFyZ2V0Tm90ZS50b3BUZXJtc1xuICAgICAgICAgIH0sXG4gICAgICAgICAgY29tbW9uX3Rlcm1zOiBkYXRhLmNvbW1vblRlcm1zLFxuICAgICAgICAgIGNsdXN0ZXJfdGVybXM6IGRhdGEuY2x1c3RlclRlcm1zXG4gICAgICAgIH0pXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgaWYgKHJlc3VsdC5kZXNjcmlwdGlvbikge1xuICAgICAgICAgIHJldHVybiByZXN1bHQuZGVzY3JpcHRpb247XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gSWYgc2VydmVyIGNhbGwgZmFpbHMgb3Igbm90IGF2YWlsYWJsZSwgdXNlIGZhbGxiYWNrIGxvZ2ljXG4gICAgICBjb25zb2xlLmxvZyhcIlVzaW5nIGZhbGxiYWNrIGNvbm5lY3Rpb24gZGVzY3JpcHRpb24gZ2VuZXJhdGlvblwiKTtcbiAgICAgIFxuICAgICAgLy8gQ3JlYXRlIGEgdGVtcGxhdGUtYmFzZWQgZGVzY3JpcHRpb24gKGZhbGxiYWNrKVxuICAgICAgbGV0IGRlc2NyaXB0aW9uID0gJyc7XG4gICAgICBcbiAgICAgIGlmIChjb21tb25UZXJtcykge1xuICAgICAgICBkZXNjcmlwdGlvbiArPSBgVGhlc2Ugbm90ZXMgc2hhcmUgY29uY2VwdHVhbCBvdmVybGFwIGFyb3VuZCAke2NvbW1vblRlcm1zfS4gYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlc2NyaXB0aW9uICs9IGBUaGVzZSBub3RlcyBhcHBlYXIgdG8gYmUgY29uY2VwdHVhbGx5IHJlbGF0ZWQuIGA7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGRlc2NyaXB0aW9uICs9IGBUaGUgbm90ZSBcIiR7dGFyZ2V0VGl0bGV9XCIgcHJvdmlkZXMgY29tcGxlbWVudGFyeSBpbmZvcm1hdGlvbiB0aGF0IGV4cGFuZHMgb24gaWRlYXMgaW4gXCIke3NvdXJjZVRpdGxlfVwiYDtcbiAgICAgIFxuICAgICAgaWYgKGNsdXN0ZXJUZXJtcykge1xuICAgICAgICBkZXNjcmlwdGlvbiArPSBgLCBwYXJ0aWN1bGFybHkgcmVnYXJkaW5nICR7Y2x1c3RlclRlcm1zfS5gO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVzY3JpcHRpb24gKz0gJy4nO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZGVzY3JpcHRpb247XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNhbGxpbmcgTExNIHNlcnZpY2U6JywgZXJyb3IpO1xuICAgICAgXG4gICAgICAvLyBSZXR1cm4gYSBiYXNpYyBkZXNjcmlwdGlvbiBhcyBmYWxsYmFja1xuICAgICAgcmV0dXJuIGBUaGVzZSBub3RlcyBhcHBlYXIgdG8gYmUgcmVsYXRlZCBpbiB0aGVpciBjb250ZW50LiBUaGUgbm90ZSBcIiR7ZGF0YS50YXJnZXROb3RlLnRpdGxlfVwiIGNvbXBsZW1lbnRzIFwiJHtkYXRhLnNvdXJjZU5vdGUudGl0bGV9XCIgd2l0aCBhZGRpdGlvbmFsIHJlbGV2YW50IGluZm9ybWF0aW9uLmA7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGNyZWF0ZUxpbmsoY29ubmVjdGlvbjogTm90ZUNvbm5lY3Rpb24sIGRlc2NyaXB0aW9uOiBzdHJpbmcpIHtcbiAgICBpZiAoIWRlc2NyaXB0aW9uIHx8IGRlc2NyaXB0aW9uLnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgIG5ldyBOb3RpY2UoJ1BsZWFzZSBnZW5lcmF0ZSBvciBwcm92aWRlIGEgZGVzY3JpcHRpb24gZm9yIHRoZSBjb25uZWN0aW9uJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIC8vIENsb3NlIHRoZSBtb2RhbCBmaXJzdCBzbyBpdCBkb2Vzbid0IGludGVyZmVyZSB3aXRoIHRoZSBub3RlIG9wZW5pbmdcbiAgICB0aGlzLmNsb3NlKCk7XG4gICAgXG4gICAgLy8gQ3JlYXRlIHRoZSBsaW5rIC0gdGhpcyB3aWxsIGFsc28gb3BlbiB0aGUgc291cmNlIG5vdGVcbiAgICBjb25zdCBzdWNjZXNzID0gYXdhaXQgdGhpcy5wbHVnaW4uY3JlYXRlTm90ZUxpbmsoXG4gICAgICBjb25uZWN0aW9uLnNvdXJjZU5vdGUucGF0aCxcbiAgICAgIGNvbm5lY3Rpb24udGFyZ2V0Tm90ZS5wYXRoLFxuICAgICAgZGVzY3JpcHRpb25cbiAgICApO1xuICAgIFxuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICAvLyBPcGVuIHRoZSB0YXJnZXQgbm90ZSBpbiBhIHNwbGl0IHBhbmUgYWZ0ZXIgYSBzaG9ydCBkZWxheSB0byBsZXQgdGhlIHNvdXJjZSBub3RlIG9wZW5cbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIEFsc28gb2ZmZXIgb3B0aW9uIHRvIHZpZXcgdGhlIHRhcmdldCBub3RlXG4gICAgICAgICAgY29uc3QgdGFyZ2V0RmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb25uZWN0aW9uLnRhcmdldE5vdGUucGF0aCk7XG4gICAgICAgICAgaWYgKHRhcmdldEZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbW9kYWwgYXNraW5nIGlmIHVzZXIgd2FudHMgdG8gb3BlbiB0aGUgdGFyZ2V0IG5vdGVcbiAgICAgICAgICAgIGNvbnN0IG1vZGFsID0gbmV3IE1vZGFsKHRoaXMuYXBwKTtcbiAgICAgICAgICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSBtb2RhbDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQWRkIHNvbWUgc3R5bGluZ1xuICAgICAgICAgICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgICAgICAgICAgc3R5bGUudGV4dENvbnRlbnQgPSBgXG4gICAgICAgICAgICAgIC5zdWNjZXNzLW1vZGFsIHtcbiAgICAgICAgICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICAgICAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAuc3VjY2Vzcy1pY29uIHtcbiAgICAgICAgICAgICAgICBmb250LXNpemU6IDM2cHg7XG4gICAgICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMTVweDtcbiAgICAgICAgICAgICAgICBjb2xvcjogdmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAuc3VjY2Vzcy10aXRsZSB7XG4gICAgICAgICAgICAgICAgbWFyZ2luLWJvdHRvbTogMTBweDtcbiAgICAgICAgICAgICAgICBjb2xvcjogdmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAubm90ZS1pbmZvIHtcbiAgICAgICAgICAgICAgICBtYXJnaW4tYm90dG9tOiAyMHB4O1xuICAgICAgICAgICAgICAgIGZvbnQtc3R5bGU6IGl0YWxpYztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAuY29uZmlybWF0aW9uLXF1ZXN0aW9uIHtcbiAgICAgICAgICAgICAgICBtYXJnaW4tYm90dG9tOiAyMHB4O1xuICAgICAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC5tb2RhbC1idXR0b24tY29udGFpbmVyIHtcbiAgICAgICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYXJvdW5kO1xuICAgICAgICAgICAgICAgIG1hcmdpbi10b3A6IDIwcHg7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGA7XG4gICAgICAgICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ3JlYXRlIHRoZSBtb2RhbCBjb250ZW50IHdpdGggc3R5bGluZ1xuICAgICAgICAgICAgY29uc3QgY29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ3N1Y2Nlc3MtbW9kYWwnIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBTdWNjZXNzIGljb24gLSB1c2luZyBlbW9qaSBmb3Igc2ltcGxpY2l0eVxuICAgICAgICAgICAgY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ3N1Y2Nlc3MtaWNvbicsIHRleHQ6ICfwn5SXJyB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29udGFpbmVyLmNyZWF0ZUVsKCdoMicsIHsgXG4gICAgICAgICAgICAgIHRleHQ6IGBMaW5rIENyZWF0ZWQgU3VjY2Vzc2Z1bGx5IWAsXG4gICAgICAgICAgICAgIGNsczogJ3N1Y2Nlc3MtdGl0bGUnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29udGFpbmVyLmNyZWF0ZUVsKCdwJywgeyBcbiAgICAgICAgICAgICAgdGV4dDogYEEgbGluayB0byBcIiR7Y29ubmVjdGlvbi50YXJnZXROb3RlLnRpdGxlfVwiIGhhcyBiZWVuIGFkZGVkIHRvIFwiJHtjb25uZWN0aW9uLnNvdXJjZU5vdGUudGl0bGV9XCIuYCxcbiAgICAgICAgICAgICAgY2xzOiAnbm90ZS1pbmZvJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnRhaW5lci5jcmVhdGVFbCgncCcsIHsgXG4gICAgICAgICAgICAgIHRleHQ6IGBXb3VsZCB5b3UgbGlrZSB0byBvcGVuIFwiJHtjb25uZWN0aW9uLnRhcmdldE5vdGUudGl0bGV9XCIgYXMgd2VsbD9gLFxuICAgICAgICAgICAgICBjbHM6ICdjb25maXJtYXRpb24tcXVlc3Rpb24nXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgYnV0dG9uQ29udGFpbmVyID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ21vZGFsLWJ1dHRvbi1jb250YWluZXInIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBCdXR0b24gdG8gb3BlbiB0aGUgdGFyZ2V0IG5vdGVcbiAgICAgICAgICAgIGNvbnN0IG9wZW5CdXR0b24gPSBuZXcgQnV0dG9uQ29tcG9uZW50KGJ1dHRvbkNvbnRhaW5lcilcbiAgICAgICAgICAgICAgLnNldEJ1dHRvblRleHQoYE9wZW4gXCIke2Nvbm5lY3Rpb24udGFyZ2V0Tm90ZS50aXRsZX1cImApXG4gICAgICAgICAgICAgIC5zZXRDdGEoKVxuICAgICAgICAgICAgICAub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gT3BlbiBpbiBhIG5ldyBsZWFmIChzcGxpdCBwYW5lKVxuICAgICAgICAgICAgICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuY3JlYXRlTGVhZkJ5U3BsaXQoXG4gICAgICAgICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZiwgXG4gICAgICAgICAgICAgICAgICAndmVydGljYWwnXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBsZWFmLm9wZW5GaWxlKHRhcmdldEZpbGUpO1xuICAgICAgICAgICAgICAgIG1vZGFsLmNsb3NlKCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBCdXR0b24gdG8gc3RheSBvbiB0aGUgY3VycmVudCBub3RlXG4gICAgICAgICAgICBuZXcgQnV0dG9uQ29tcG9uZW50KGJ1dHRvbkNvbnRhaW5lcilcbiAgICAgICAgICAgICAgLnNldEJ1dHRvblRleHQoJ1N0YXkgb24gY3VycmVudCBub3RlJylcbiAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgICAgICAgIG1vZGFsLmNsb3NlKCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBtb2RhbC5vcGVuKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIG9wZW5pbmcgdGFyZ2V0IG5vdGU6JywgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9LCA1MDApO1xuICAgIH1cbiAgfVxuICBcbiAgb25DbG9zZSgpIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgfVxufVxuXG4vLyBEZWZpbmUgdGhlIHZpZXcgdHlwZSBmb3Igb3VyIHZpc3VhbGl6YXRpb25cbmNvbnN0IFZJRVdfVFlQRV9UU05FID0gXCJ0c25lLXZpc3VhbGl6YXRpb25cIjtcblxuaW50ZXJmYWNlIFZpYmVCb3lTZXR0aW5ncyB7XG4gIHBlcnBsZXhpdHk6IG51bWJlcjtcbiAgaXRlcmF0aW9uczogbnVtYmVyO1xuICBlcHNpbG9uOiBudW1iZXI7XG59XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFZpYmVCb3lTZXR0aW5ncyA9IHtcbiAgcGVycGxleGl0eTogMzAsXG4gIGl0ZXJhdGlvbnM6IDEwMDAsXG4gIGVwc2lsb246IDEwXG59XG5cbi8vIEN1c3RvbSB2aWV3IGZvciB0LVNORSB2aXN1YWxpemF0aW9uXG5jbGFzcyBUU05FVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgY29uc3RydWN0b3IobGVhZjogV29ya3NwYWNlTGVhZikge1xuICAgIHN1cGVyKGxlYWYpO1xuICB9XG5cbiAgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gVklFV19UWVBFX1RTTkU7XG4gIH1cblxuICBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBcInQtU05FIFZpc3VhbGl6YXRpb25cIjtcbiAgfVxuXG4gIGdldEljb24oKTogc3RyaW5nIHtcbiAgICByZXR1cm4gXCJncmFwaFwiO1xuICB9XG5cbiAgLy8gU2V0IG9uRHJvcCBoYW5kbGVyIHRvIHByZXZlbnQgZXJyb3JcbiAgb25Ecm9wKGV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcbiAgICAvLyBOb3QgaW1wbGVtZW50ZWRcbiAgfVxuXG4gIC8vIFNldCBvblBhbmVNZW51IGhhbmRsZXIgdG8gcHJldmVudCBlcnJvclxuICBvblBhbmVNZW51KG1lbnU6IGFueSwgc291cmNlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAvLyBOb3QgaW1wbGVtZW50ZWRcbiAgfVxuXG4gIGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRlbnRFbDtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICBcbiAgICAvLyBBZGQgaGVhZGVyXG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInRzbmUtaGVhZGVyXCIgfSwgKGhlYWRlcikgPT4ge1xuICAgICAgaGVhZGVyLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcInQtU05FIE5vdGUgVmlzdWFsaXphdGlvblwiIH0pO1xuICAgICAgXG4gICAgICAvLyBBZGQgYWN0aW9uIGJ1dHRvbnNcbiAgICAgIGNvbnN0IGFjdGlvbkJhciA9IGhlYWRlci5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJ0c25lLWFjdGlvbnNcIiB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgcnVuQnV0dG9uID0gYWN0aW9uQmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJSdW4gQW5hbHlzaXNcIiwgY2xzOiBcIm1vZC1jdGFcIiB9KTtcbiAgICAgIHJ1bkJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICAvLyBHZXQgdGhlIHBsdWdpbiBpbnN0YW5jZSBhbmQgcnVuIHQtU05FXG4gICAgICAgIGNvbnN0IHBsdWdpbiA9ICh0aGlzLmFwcCBhcyBhbnkpLnBsdWdpbnMucGx1Z2luc1tcInZpYmUtYm9pXCJdIGFzIFZpYmVCb3lQbHVnaW47XG4gICAgICAgIHBsdWdpbi5ydW5UU05FKCk7XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc3VnZ2VzdExpbmtzQnV0dG9uID0gYWN0aW9uQmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJTdWdnZXN0IExpbmtzXCIsIGNsczogXCJtb2QtY3RhXCIgfSk7XG4gICAgICBzdWdnZXN0TGlua3NCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgLy8gR2V0IHRoZSBwbHVnaW4gaW5zdGFuY2UgYW5kIHN1Z2dlc3QgbGlua3NcbiAgICAgICAgY29uc3QgcGx1Z2luID0gKHRoaXMuYXBwIGFzIGFueSkucGx1Z2lucy5wbHVnaW5zW1widmliZS1ib2lcIl0gYXMgVmliZUJveVBsdWdpbjtcbiAgICAgICAgcGx1Z2luLnN1Z2dlc3RMaW5rcygpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHNlbGVjdEZvbGRlckJ1dHRvbiA9IGFjdGlvbkJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiU2VsZWN0IEZvbGRlclwiIH0pO1xuICAgICAgc2VsZWN0Rm9sZGVyQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIC8vIFRPRE86IEltcGxlbWVudCBmb2xkZXIgc2VsZWN0aW9uXG4gICAgICAgIG5ldyBOb3RpY2UoXCJGb2xkZXIgc2VsZWN0aW9uIG5vdCBpbXBsZW1lbnRlZCB5ZXRcIik7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBcbiAgICAvLyBBZGQgaW5mbyB0ZXh0XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwicFwiLCB7IFxuICAgICAgdGV4dDogXCJSdW4gdC1TTkUgYW5hbHlzaXMgdG8gdmlzdWFsaXplIHlvdXIgbm90ZXMgYXMgY2x1c3RlcnMgYmFzZWQgb24gY29udGVudCBzaW1pbGFyaXR5LlwiLFxuICAgICAgY2xzOiBcInRzbmUtaW5mb1wiXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQWRkIHZpc3VhbGl6YXRpb24gY29udGFpbmVyXG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgXG4gICAgICBjbHM6IFwidHNuZS1jb250YWluZXJcIiwgXG4gICAgICBhdHRyOiB7IGlkOiBcInRzbmUtY29udGFpbmVyXCIgfSBcbiAgICB9KTtcbiAgICBcbiAgICAvLyBBZGQgc3RhdHVzIHRleHRcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBcbiAgICAgIGNsczogXCJ0c25lLXN0YXR1c1wiLFxuICAgICAgYXR0cjogeyBpZDogXCJ0c25lLXN0YXR1c1wiIH1cbiAgICB9LCAoc3RhdHVzKSA9PiB7XG4gICAgICBzdGF0dXMuY3JlYXRlRWwoXCJwXCIsIHsgXG4gICAgICAgIHRleHQ6IFwiVXNlIHRoZSAnUnVuIEFuYWx5c2lzJyBidXR0b24gdG8gc3RhcnQgcHJvY2Vzc2luZyB5b3VyIG5vdGVzLlwiLFxuICAgICAgICBjbHM6IFwidHNuZS1zdGF0dXMtdGV4dFwiXG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBcbiAgICAvLyBBZGQgc2ltcGxlIENTU1xuICAgIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBzdHlsZS50ZXh0Q29udGVudCA9IGBcbiAgICAgIC50c25lLWhlYWRlciB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMXJlbTtcbiAgICAgIH1cbiAgICAgIC50c25lLWFjdGlvbnMge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBnYXA6IDEwcHg7XG4gICAgICB9XG4gICAgICAudHNuZS1pbmZvIHtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMXJlbTtcbiAgICAgICAgb3BhY2l0eTogMC44O1xuICAgICAgfVxuICAgICAgLnRzbmUtY29udGFpbmVyIHtcbiAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgIGhlaWdodDogNjAwcHg7XG4gICAgICAgIG1hcmdpbjogMXJlbSAwO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICB9XG4gICAgICAudHNuZS1zdGF0dXMge1xuICAgICAgICBtYXJnaW4tdG9wOiAxcmVtO1xuICAgICAgICBwYWRkaW5nOiAwLjVyZW07XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tYmFja2dyb3VuZC1zZWNvbmRhcnkpO1xuICAgICAgfVxuICAgICAgLnRzbmUtc3RhdHVzLXRleHQge1xuICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgIGZvbnQtc2l6ZTogMC45cmVtO1xuICAgICAgICBvcGFjaXR5OiAwLjg7XG4gICAgICB9XG4gICAgYDtcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBWaWJlQm95UGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IFZpYmVCb3lTZXR0aW5ncztcblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblxuICAgIC8vIFJlZ2lzdGVyIHRoZSBjdXN0b20gdmlld1xuICAgIHRoaXMucmVnaXN0ZXJWaWV3KFxuICAgICAgVklFV19UWVBFX1RTTkUsXG4gICAgICAobGVhZikgPT4gbmV3IFRTTkVWaWV3KGxlYWYpXG4gICAgKTtcblxuICAgIC8vIEFkZCBjb21tYW5kIHRvIG9wZW4gdGhlIHZpc3VhbGl6YXRpb25cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICdvcGVuLXRzbmUtdmlzdWFsaXphdGlvbicsXG4gICAgICBuYW1lOiAnT3BlbiB0LVNORSBWaXN1YWxpemF0aW9uJyxcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBZGQgY29tbWFuZCB0byBydW4gdC1TTkUgYW5hbHlzaXNcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6ICdydW4tdHNuZS1hbmFseXNpcycsXG4gICAgICBuYW1lOiAnUnVuIHQtU05FIEFuYWx5c2lzJyxcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIHRoaXMucnVuVFNORSgpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHNldHRpbmcgdGFiXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gIH1cblxuICBvbnVubG9hZCgpIHtcbiAgICAvLyBDbGVhbiB1cCByZXNvdXJjZXMgd2hlbiB0aGUgcGx1Z2luIGlzIGRpc2FibGVkXG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG4gIH1cblxuICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcbiAgfVxuXG4gIGFzeW5jIGFjdGl2YXRlVmlldygpIHtcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX1RTTkUpO1xuICAgIGlmIChleGlzdGluZy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nWzBdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYodHJ1ZSk7XG4gICAgYXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoe1xuICAgICAgdHlwZTogVklFV19UWVBFX1RTTkUsXG4gICAgICBhY3RpdmU6IHRydWUsXG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBydW5UU05FKCkge1xuICAgIC8vIFByb2Nlc3Mgbm90ZXMgYW5kIHJ1biB0LVNORSBhbmFseXNpc1xuICAgIG5ldyBOb3RpY2UoJ3QtU05FIGFuYWx5c2lzIHN0YXJ0aW5nLi4uJyk7XG4gICAgdGhpcy51cGRhdGVTdGF0dXMoJ0dhdGhlcmluZyBub3Rlcy4uLicpO1xuICAgIFxuICAgIC8vIEdldCBhbGwgbWFya2Rvd24gZmlsZXMgaW4gdGhlIHZhdWx0XG4gICAgY29uc3QgZmlsZXMgPSB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIExpbWl0IHRvIGEgcmVhc29uYWJsZSBudW1iZXIgb2YgZmlsZXMgZm9yIHBlcmZvcm1hbmNlXG4gICAgICBjb25zdCBtYXhGaWxlcyA9IDIwMDtcbiAgICAgIGNvbnN0IHNlbGVjdGVkRmlsZXMgPSBmaWxlcy5zbGljZSgwLCBtYXhGaWxlcyk7XG4gICAgICBcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGBQcm9jZXNzaW5nICR7c2VsZWN0ZWRGaWxlcy5sZW5ndGh9IG5vdGVzLi4uYCk7XG4gICAgICBcbiAgICAgIC8vIFByZXBhcmUgbm90ZXMgZGF0YSBmb3IgdGhlIFB5dGhvbiBzZXJ2ZXJcbiAgICAgIGNvbnN0IG5vdGVzID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgIHNlbGVjdGVkRmlsZXMubWFwKGFzeW5jIChmaWxlKSA9PiB7XG4gICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG4gICAgICAgICAgY29uc3Qgc3RhdCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIuc3RhdChmaWxlLnBhdGgpO1xuICAgICAgICAgIGNvbnN0IHdvcmRDb3VudCA9IGNvbnRlbnQuc3BsaXQoL1xccysvKS5sZW5ndGg7XG4gICAgICAgICAgY29uc3QgcmVhZGluZ1RpbWUgPSBNYXRoLmNlaWwod29yZENvdW50IC8gMjAwKTsgLy8gQXZnIHJlYWRpbmcgc3BlZWQgfjIwMCB3b3Jkcy9taW51dGVcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBFeHRyYWN0IHRhZ3MgKGxvb2tpbmcgZm9yICN0YWcgZm9ybWF0KVxuICAgICAgICAgIGNvbnN0IHRhZ1JlZ2V4ID0gLyMoW2EtekEtWjAtOV8tXSspL2c7XG4gICAgICAgICAgY29uc3QgdGFncyA9IFsuLi5jb250ZW50Lm1hdGNoQWxsKHRhZ1JlZ2V4KV0ubWFwKG1hdGNoID0+IG1hdGNoWzFdKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBHZXQgYSBjb250ZW50IHByZXZpZXcgKGZpcnN0IDE1MCBjaGFycylcbiAgICAgICAgICBjb25zdCBjb250ZW50UHJldmlldyA9IGNvbnRlbnQuc3Vic3RyaW5nKDAsIDE1MCkucmVwbGFjZSgvXFxuL2csICcgJykgKyBcbiAgICAgICAgICAgIChjb250ZW50Lmxlbmd0aCA+IDE1MCA/ICcuLi4nIDogJycpO1xuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwYXRoOiBmaWxlLnBhdGgsXG4gICAgICAgICAgICB0aXRsZTogZmlsZS5iYXNlbmFtZSxcbiAgICAgICAgICAgIGNvbnRlbnQ6IGNvbnRlbnQsXG4gICAgICAgICAgICBtdGltZTogc3RhdC5tdGltZSxcbiAgICAgICAgICAgIGN0aW1lOiBzdGF0LmN0aW1lLFxuICAgICAgICAgICAgd29yZENvdW50OiB3b3JkQ291bnQsXG4gICAgICAgICAgICByZWFkaW5nVGltZTogcmVhZGluZ1RpbWUsXG4gICAgICAgICAgICB0YWdzOiB0YWdzLFxuICAgICAgICAgICAgY29udGVudFByZXZpZXc6IGNvbnRlbnRQcmV2aWV3XG4gICAgICAgICAgfTtcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgICBcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKCdTZW5kaW5nIGRhdGEgdG8gdC1TTkUgc2VydmVyLi4uJyk7XG4gICAgICBcbiAgICAgIC8vIENoZWNrIGlmIFB5dGhvbiBzZXJ2ZXIgaXMgcnVubmluZ1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgaGVhbHRoQ2hlY2sgPSBhd2FpdCBmZXRjaCgnaHR0cDovLzEyNy4wLjAuMToxMjM0L2hlYWx0aCcsIHsgXG4gICAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIGlmICghaGVhbHRoQ2hlY2sub2spIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJQeXRob24gc2VydmVyIGlzIG5vdCByZXNwb25kaW5nXCIpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgXCJDYW5ub3QgY29ubmVjdCB0byBQeXRob24gc2VydmVyLiBNYWtlIHN1cmUgdGhlIHNlcnZlciBpcyBydW5uaW5nIGF0IGh0dHA6Ly8xMjcuMC4wLjE6MTIzNC4gXCIgK1xuICAgICAgICAgIFwiUnVuICdweXRob24gc3JjL3B5dGhvbi90c25lL3NlcnZlci5weScgdG8gc3RhcnQgaXQuXCJcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gU2VuZCB0byBQeXRob24gc2VydmVyIGZvciBwcm9jZXNzaW5nXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhgUnVubmluZyB0LVNORSBhbmFseXNpcyB3aXRoIHBlcnBsZXhpdHk9JHt0aGlzLnNldHRpbmdzLnBlcnBsZXhpdHl9LCBpdGVyYXRpb25zPSR7dGhpcy5zZXR0aW5ncy5pdGVyYXRpb25zfS4uLmApO1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnaHR0cDovLzEyNy4wLjAuMToxMjM0L3Byb2Nlc3MnLCB7XG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIG5vdGVzOiBub3RlcyxcbiAgICAgICAgICBzZXR0aW5nczoge1xuICAgICAgICAgICAgcGVycGxleGl0eTogdGhpcy5zZXR0aW5ncy5wZXJwbGV4aXR5LFxuICAgICAgICAgICAgaXRlcmF0aW9uczogdGhpcy5zZXR0aW5ncy5pdGVyYXRpb25zLFxuICAgICAgICAgICAgbGVhcm5pbmdfcmF0ZTogdGhpcy5zZXR0aW5ncy5lcHNpbG9uXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgcmVzcG9uZGVkIHdpdGggc3RhdHVzOiAke3Jlc3BvbnNlLnN0YXR1c31gKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgXG4gICAgICBpZiAocmVzdWx0LmVycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgU2VydmVyIGVycm9yOiAke3Jlc3VsdC5lcnJvcn1gKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoJ1Zpc3VhbGl6aW5nIHJlc3VsdHMuLi4nKTtcbiAgICAgIFxuICAgICAgLy8gRGVidWcgLSBsb2cgdGhlIHJlc3VsdCBzdHJ1Y3R1cmUgdG8gY2hlY2sgbWV0YWRhdGFcbiAgICAgIGNvbnNvbGUubG9nKCdWaXN1YWxpemluZyByZXN1bHQgd2l0aCBtZXRhZGF0YTonLCByZXN1bHQpO1xuICAgICAgLy8gQ2hlY2sgaWYgd2UgaGF2ZSBhZGRpdGlvbmFsIG1ldGFkYXRhXG4gICAgICBpZiAocmVzdWx0LnBvaW50cyAmJiByZXN1bHQucG9pbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3Qgc2FtcGxlUG9pbnQgPSByZXN1bHQucG9pbnRzWzBdO1xuICAgICAgICBjb25zb2xlLmxvZygnU2FtcGxlIHBvaW50IG1ldGFkYXRhOicsIHtcbiAgICAgICAgICBoYXNXb3JkQ291bnQ6IHNhbXBsZVBvaW50LndvcmRDb3VudCAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc010aW1lOiBzYW1wbGVQb2ludC5tdGltZSAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc0N0aW1lOiBzYW1wbGVQb2ludC5jdGltZSAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc1RhZ3M6IHNhbXBsZVBvaW50LnRhZ3MgIT09IHVuZGVmaW5lZCxcbiAgICAgICAgICBoYXNDb250ZW50UHJldmlldzogc2FtcGxlUG9pbnQuY29udGVudFByZXZpZXcgIT09IHVuZGVmaW5lZCxcbiAgICAgICAgICBoYXNEaXN0YW5jZVRvQ2VudGVyOiBzYW1wbGVQb2ludC5kaXN0YW5jZVRvQ2VudGVyICE9PSB1bmRlZmluZWRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFN0b3JlIHRoZSByZXN1bHQgZm9yIGxhdGVyIHVzZSBpbiBsaW5rIHN1Z2dlc3Rpb25zXG4gICAgICB0aGlzLmxhc3RSZXN1bHQgPSByZXN1bHQ7XG4gICAgICBcbiAgICAgIC8vIFZpc3VhbGl6ZSB0aGUgcmVzdWx0XG4gICAgICB0aGlzLnZpc3VhbGl6ZVJlc3VsdChyZXN1bHQpO1xuICAgICAgXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhgVmlzdWFsaXphdGlvbiBjb21wbGV0ZSEgRGlzcGxheWluZyAke3Jlc3VsdC5wb2ludHMubGVuZ3RofSBub3Rlcy5gKTtcbiAgICAgIG5ldyBOb3RpY2UoJ3QtU05FIGFuYWx5c2lzIGNvbXBsZXRlIScpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBydW5uaW5nIHQtU05FIGFuYWx5c2lzOicsIGVycm9yKTtcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGBFcnJvcjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgbmV3IE5vdGljZShgdC1TTkUgYW5hbHlzaXMgZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIHVwZGF0ZVN0YXR1cyhtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICAvLyBGaW5kIHRoZSBzdGF0dXMgZWxlbWVudCBpbiB0aGUgdmlldyBhbmQgdXBkYXRlIGl0XG4gICAgY29uc3Qgc3RhdHVzRWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN0c25lLXN0YXR1cyAudHNuZS1zdGF0dXMtdGV4dCcpO1xuICAgIGlmIChzdGF0dXNFbGVtZW50KSB7XG4gICAgICBzdGF0dXNFbGVtZW50LnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICB9XG4gICAgY29uc29sZS5sb2coYFN0YXR1czogJHttZXNzYWdlfWApO1xuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIHZpc3VhbGl6ZVJlc3VsdChyZXN1bHQ6IGFueSkge1xuICAgIC8vIEdldCBvciBjcmVhdGUgdGhlIHZpc3VhbGl6YXRpb24gdmlld1xuICAgIGxldCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfVFNORSlbMF07XG4gICAgaWYgKCFsZWFmKSB7XG4gICAgICAvLyBBY3RpdmF0ZSB0aGUgdmlldyBpZiBub3QgZm91bmRcbiAgICAgIGF3YWl0IHRoaXMuYWN0aXZhdGVWaWV3KCk7XG4gICAgICAvLyBUcnkgdG8gZ2V0IHRoZSBsZWFmIGFnYWluXG4gICAgICBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfVFNORSlbMF07XG4gICAgICBcbiAgICAgIGlmICghbGVhZikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdDb3VsZCBub3QgY3JlYXRlIHZpc3VhbGl6YXRpb24gdmlldycpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIEFjY2VzcyB0aGUgdmlldyBjb250YWluZXJcbiAgICBjb25zdCB2aWV3ID0gbGVhZi52aWV3IGFzIFRTTkVWaWV3O1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IHZpZXcuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJyN0c25lLWNvbnRhaW5lcicpIGFzIEhUTUxFbGVtZW50O1xuICAgIGlmICghY29udGFpbmVyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdDb250YWluZXIgbm90IGZvdW5kIGluIHZpZXcnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgLy8gQ2xlYXIgYW55IGV4aXN0aW5nIGNvbnRlbnRcbiAgICB3aGlsZSAoY29udGFpbmVyLmZpcnN0Q2hpbGQpIHtcbiAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZChjb250YWluZXIuZmlyc3RDaGlsZCk7XG4gICAgfVxuICAgIFxuICAgIC8vIENyZWF0ZSB0aGUgdmlzdWFsaXplclxuICAgIGNvbnN0IG9wZW5DYWxsYmFjayA9IChwYXRoOiBzdHJpbmcpID0+IHtcbiAgICAgIC8vIE9wZW4gdGhlIHNlbGVjdGVkIG5vdGVcbiAgICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCk7XG4gICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKCkub3BlbkZpbGUoZmlsZSk7XG4gICAgICB9XG4gICAgfTtcbiAgICBcbiAgICAvLyBDcmVhdGUgYW5kIHVzZSB0aGUgdmlzdWFsaXplciBkaXJlY3RseVxuICAgIGNvbnN0IHZpc3VhbGl6ZXIgPSBuZXcgVFNORVZpc3VhbGl6ZXIoY29udGFpbmVyLCBvcGVuQ2FsbGJhY2spO1xuICAgIHZpc3VhbGl6ZXIuc2V0RGF0YShyZXN1bHQpO1xuICB9XG4gIFxuICAvLyBNZXRob2QgdG8gc3VnZ2VzdCBsaW5rcyBiZXR3ZWVuIG5vdGVzIHVzaW5nIExMTVxuICBhc3luYyBzdWdnZXN0TGlua3MoKSB7XG4gICAgaWYgKCF0aGlzLmxhc3RSZXN1bHQgfHwgIXRoaXMubGFzdFJlc3VsdC5wb2ludHMgfHwgdGhpcy5sYXN0UmVzdWx0LnBvaW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIG5ldyBOb3RpY2UoJ1BsZWFzZSBydW4gdC1TTkUgYW5hbHlzaXMgZmlyc3QgdG8gZ2VuZXJhdGUgbm90ZSBkYXRhJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIC8vIFNob3cgYSBub3RpY2UgdGhhdCB3ZSdyZSBzdGFydGluZyB0aGUgcHJvY2Vzc1xuICAgIG5ldyBOb3RpY2UoJ0ZpbmRpbmcgcG90ZW50aWFsIG5vdGUgY29ubmVjdGlvbnMuLi4nKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgLy8gRmluZCBwb3RlbnRpYWwgY29ubmVjdGlvbnMgYmFzZWQgb24gdC1TTkUgcHJveGltaXR5IGFuZCBjbHVzdGVyaW5nXG4gICAgICBjb25zdCBjb25uZWN0aW9ucyA9IHRoaXMuZmluZFBvdGVudGlhbENvbm5lY3Rpb25zKHRoaXMubGFzdFJlc3VsdCk7XG4gICAgICBcbiAgICAgIGlmIChjb25uZWN0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgbmV3IE5vdGljZSgnTm8gc3Ryb25nIGNvbm5lY3Rpb25zIGZvdW5kIGJldHdlZW4gbm90ZXMnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBDcmVhdGUgYSBtb2RhbCB0byBkaXNwbGF5IHRoZSBzdWdnZXN0ZWQgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG1vZGFsID0gbmV3IFN1Z2dlc3RlZExpbmtzTW9kYWwodGhpcy5hcHAsIGNvbm5lY3Rpb25zLCB0aGlzKTtcbiAgICAgIG1vZGFsLm9wZW4oKTtcbiAgICAgIFxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzdWdnZXN0aW5nIGxpbmtzOicsIGVycm9yKTtcbiAgICAgIG5ldyBOb3RpY2UoYEVycm9yIHN1Z2dlc3RpbmcgbGlua3M6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbiAgXG4gIC8vIFN0b3JlIHRoZSBsYXN0IHJlc3VsdCBmb3IgdXNlIGluIGxpbmsgc3VnZ2VzdGlvbnNcbiAgcHJpdmF0ZSBsYXN0UmVzdWx0OiBhbnkgPSBudWxsO1xuICBcbiAgLy8gRmluZCBwb3RlbnRpYWwgY29ubmVjdGlvbnMgYmV0d2VlbiBub3RlcyBiYXNlZCBvbiB0LVNORSByZXN1bHRzXG4gIHByaXZhdGUgZmluZFBvdGVudGlhbENvbm5lY3Rpb25zKHJlc3VsdDogYW55KTogTm90ZUNvbm5lY3Rpb25bXSB7XG4gICAgY29uc3QgY29ubmVjdGlvbnM6IE5vdGVDb25uZWN0aW9uW10gPSBbXTtcbiAgICBjb25zdCBwb2ludHMgPSByZXN1bHQucG9pbnRzIGFzIFRTTkVQb2ludFtdO1xuICAgIFxuICAgIC8vIDEuIEZpbmQgbm90ZXMgaW4gdGhlIHNhbWUgY2x1c3RlclxuICAgIGNvbnN0IGNsdXN0ZXJHcm91cHM6IHsgW2tleTogbnVtYmVyXTogVFNORVBvaW50W10gfSA9IHt9O1xuICAgIFxuICAgIC8vIEdyb3VwIHBvaW50cyBieSBjbHVzdGVyXG4gICAgZm9yIChjb25zdCBwb2ludCBvZiBwb2ludHMpIHtcbiAgICAgIGlmIChwb2ludC5jbHVzdGVyID09PSAtMSkgY29udGludWU7IC8vIFNraXAgdW5jbHVzdGVyZWQgcG9pbnRzXG4gICAgICBcbiAgICAgIGlmICghY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXSkge1xuICAgICAgICBjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdID0gW107XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0ucHVzaChwb2ludCk7XG4gICAgfVxuICAgIFxuICAgIC8vIEZvciBlYWNoIGNsdXN0ZXIsIGZpbmQgdGhlIG1vc3QgY2VudHJhbCBub3Rlc1xuICAgIE9iamVjdC5lbnRyaWVzKGNsdXN0ZXJHcm91cHMpLmZvckVhY2goKFtjbHVzdGVySWQsIGNsdXN0ZXJQb2ludHNdKSA9PiB7XG4gICAgICAvLyBPbmx5IGNvbnNpZGVyIGNsdXN0ZXJzIHdpdGggYXQgbGVhc3QgMiBub3Rlc1xuICAgICAgaWYgKGNsdXN0ZXJQb2ludHMubGVuZ3RoIDwgMikgcmV0dXJuO1xuICAgICAgXG4gICAgICAvLyBGaW5kIG1vc3QgY2VudHJhbCBub3RlcyBpbiB0aGUgY2x1c3RlciAoY2xvc2VzdCB0byBjbHVzdGVyIGNlbnRlcilcbiAgICAgIGNsdXN0ZXJQb2ludHMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBkaXN0QSA9IGEuZGlzdGFuY2VUb0NlbnRlciB8fCBJbmZpbml0eTtcbiAgICAgICAgY29uc3QgZGlzdEIgPSBiLmRpc3RhbmNlVG9DZW50ZXIgfHwgSW5maW5pdHk7XG4gICAgICAgIHJldHVybiBkaXN0QSAtIGRpc3RCO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIC8vIFRha2UgdGhlIG1vc3QgY2VudHJhbCBub3Rlc1xuICAgICAgY29uc3QgY2VudHJhbE5vdGVzID0gY2x1c3RlclBvaW50cy5zbGljZSgwLCBNYXRoLm1pbigzLCBjbHVzdGVyUG9pbnRzLmxlbmd0aCkpO1xuICAgICAgXG4gICAgICAvLyBDcmVhdGUgY29ubmVjdGlvbnMgYmV0d2VlbiB0aGUgY2VudHJhbCBub3Rlc1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjZW50cmFsTm90ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZm9yIChsZXQgaiA9IGkgKyAxOyBqIDwgY2VudHJhbE5vdGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgY29uc3Qgbm90ZUEgPSBjZW50cmFsTm90ZXNbaV07XG4gICAgICAgICAgY29uc3Qgbm90ZUIgPSBjZW50cmFsTm90ZXNbal07XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gU2tpcCBpZiB0aGUgdHdvIG5vdGVzIGFyZSB2ZXJ5IGZhciBhcGFydCBpbiB0aGUgdmlzdWFsaXphdGlvblxuICAgICAgICAgIGNvbnN0IGRpc3RhbmNlID0gTWF0aC5zcXJ0KFxuICAgICAgICAgICAgTWF0aC5wb3cobm90ZUEueCAtIG5vdGVCLngsIDIpICsgTWF0aC5wb3cobm90ZUEueSAtIG5vdGVCLnksIDIpXG4gICAgICAgICAgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoZGlzdGFuY2UgPiAwLjUpIGNvbnRpbnVlOyAvLyBTa2lwIGlmIHRvbyBmYXJcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBDYWxjdWxhdGUgYSBzaW1pbGFyaXR5IHNjb3JlICgwLTEwMClcbiAgICAgICAgICBjb25zdCBzaW1pbGFyaXR5ID0gMTAwIC0gTWF0aC5taW4oMTAwLCBkaXN0YW5jZSAqIDEwMCk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gRmluZCBjb21tb24gdGVybXNcbiAgICAgICAgICBjb25zdCBjb21tb25UZXJtcyA9IG5vdGVBLnRvcF90ZXJtcy5maWx0ZXIodGVybSA9PiBcbiAgICAgICAgICAgIG5vdGVCLnRvcF90ZXJtcy5pbmNsdWRlcyh0ZXJtKVxuICAgICAgICAgICk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgICBzb3VyY2VOb3RlOiBub3RlQSxcbiAgICAgICAgICAgIHRhcmdldE5vdGU6IG5vdGVCLFxuICAgICAgICAgICAgc2ltaWxhcml0eTogc2ltaWxhcml0eSxcbiAgICAgICAgICAgIGNvbW1vblRlcm1zOiBjb21tb25UZXJtcyxcbiAgICAgICAgICAgIGNsdXN0ZXJUZXJtczogcmVzdWx0LmNsdXN0ZXJfdGVybXM/LltjbHVzdGVySWRdPy5zbGljZSgwLCA1KS5tYXAoKHQ6IGFueSkgPT4gdC50ZXJtKSB8fCBbXSxcbiAgICAgICAgICAgIHJlYXNvbjogYEJvdGggbm90ZXMgYXJlIGNlbnRyYWwgaW4gY2x1c3RlciAke2NsdXN0ZXJJZH1gXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICAvLyAyLiBGaW5kIG5vdGVzIHRoYXQgYXJlIGNsb3NlIGluIHRoZSB0LVNORSBwcm9qZWN0aW9uIGJ1dCBtYXkgYmUgaW4gZGlmZmVyZW50IGNsdXN0ZXJzXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IHBvaW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICBjb25zdCBub3RlQSA9IHBvaW50c1tpXTtcbiAgICAgICAgY29uc3Qgbm90ZUIgPSBwb2ludHNbal07XG4gICAgICAgIFxuICAgICAgICAvLyBTa2lwIG5vdGVzIGluIHRoZSBzYW1lIGNsdXN0ZXIgKGFscmVhZHkgaGFuZGxlZCBhYm92ZSlcbiAgICAgICAgaWYgKG5vdGVBLmNsdXN0ZXIgIT09IC0xICYmIG5vdGVBLmNsdXN0ZXIgPT09IG5vdGVCLmNsdXN0ZXIpIGNvbnRpbnVlO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2FsY3VsYXRlIEV1Y2xpZGVhbiBkaXN0YW5jZSBpbiB0LVNORSBzcGFjZVxuICAgICAgICBjb25zdCBkaXN0YW5jZSA9IE1hdGguc3FydChcbiAgICAgICAgICBNYXRoLnBvdyhub3RlQS54IC0gbm90ZUIueCwgMikgKyBNYXRoLnBvdyhub3RlQS55IC0gbm90ZUIueSwgMilcbiAgICAgICAgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIE9ubHkgY29uc2lkZXIgdmVyeSBjbG9zZSBub3Rlc1xuICAgICAgICBpZiAoZGlzdGFuY2UgPiAwLjIpIGNvbnRpbnVlO1xuICAgICAgICBcbiAgICAgICAgLy8gQ2FsY3VsYXRlIGEgc2ltaWxhcml0eSBzY29yZSAoMC0xMDApXG4gICAgICAgIGNvbnN0IHNpbWlsYXJpdHkgPSAxMDAgLSBNYXRoLm1pbigxMDAsIGRpc3RhbmNlICogMjAwKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEZpbmQgY29tbW9uIHRlcm1zXG4gICAgICAgIGNvbnN0IGNvbW1vblRlcm1zID0gbm90ZUEudG9wX3Rlcm1zLmZpbHRlcih0ZXJtID0+IFxuICAgICAgICAgIG5vdGVCLnRvcF90ZXJtcy5pbmNsdWRlcyh0ZXJtKVxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgLy8gT25seSBpbmNsdWRlIGlmIHRoZXkgaGF2ZSBjb21tb24gdGVybXNcbiAgICAgICAgaWYgKGNvbW1vblRlcm1zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIHNvdXJjZU5vdGU6IG5vdGVBLFxuICAgICAgICAgICAgdGFyZ2V0Tm90ZTogbm90ZUIsXG4gICAgICAgICAgICBzaW1pbGFyaXR5OiBzaW1pbGFyaXR5LFxuICAgICAgICAgICAgY29tbW9uVGVybXM6IGNvbW1vblRlcm1zLFxuICAgICAgICAgICAgY2x1c3RlclRlcm1zOiBbXSxcbiAgICAgICAgICAgIHJlYXNvbjogYE5vdGVzIGFyZSB2ZXJ5IGNsb3NlIGluIHRoZSB2aXN1YWxpemF0aW9uIGFuZCBzaGFyZSBjb21tb24gdGVybXNgXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gU29ydCBjb25uZWN0aW9ucyBieSBzaW1pbGFyaXR5IChoaWdoZXN0IGZpcnN0KVxuICAgIGNvbm5lY3Rpb25zLnNvcnQoKGEsIGIpID0+IGIuc2ltaWxhcml0eSAtIGEuc2ltaWxhcml0eSk7XG4gICAgXG4gICAgLy8gUmV0dXJuIHRvcCAxMCBjb25uZWN0aW9ucyB0byBhdm9pZCBvdmVyd2hlbG1pbmcgdGhlIHVzZXJcbiAgICByZXR1cm4gY29ubmVjdGlvbnMuc2xpY2UoMCwgMTApO1xuICB9XG4gIFxuICAvLyBDcmVhdGUgYSBsaW5rIGJldHdlZW4gdHdvIG5vdGVzXG4gIGFzeW5jIGNyZWF0ZU5vdGVMaW5rKHNvdXJjZU5vdGVQYXRoOiBzdHJpbmcsIHRhcmdldE5vdGVQYXRoOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcpIHtcbiAgICB0cnkge1xuICAgICAgLy8gR2V0IHRoZSBzb3VyY2UgZmlsZVxuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChzb3VyY2VOb3RlUGF0aCk7XG4gICAgICBpZiAoIShzb3VyY2VGaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgU291cmNlIGZpbGUgbm90IGZvdW5kOiAke3NvdXJjZU5vdGVQYXRofWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBSZWFkIHRoZSBmaWxlIGNvbnRlbnRcbiAgICAgIGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKHNvdXJjZUZpbGUpO1xuICAgICAgXG4gICAgICAvLyBHZW5lcmF0ZSB0aGUgbGluayB0ZXh0IHdpdGggdGhlIGZvcm1hdHRlZCBjb25uZWN0aW9uIGRlc2NyaXB0aW9uXG4gICAgICBjb25zdCB0YXJnZXRGaWxlTmFtZSA9IHRhcmdldE5vdGVQYXRoLnNwbGl0KCcvJykucG9wKCkgfHwgdGFyZ2V0Tm90ZVBhdGg7XG4gICAgICBjb25zdCBsaW5rVGV4dCA9IGBcXG5cXG4jIyBSZWxhdGVkIE5vdGVzXFxuXFxuLSBbWyR7dGFyZ2V0RmlsZU5hbWV9XV0gLSAke2Rlc2NyaXB0aW9uLnRyaW0oKX1cXG5gO1xuICAgICAgXG4gICAgICAvLyBBcHBlbmQgdGhlIGxpbmsgdG8gdGhlIHNvdXJjZSBmaWxlXG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoc291cmNlRmlsZSwgc291cmNlQ29udGVudCArIGxpbmtUZXh0KTtcbiAgICAgIFxuICAgICAgLy8gT3BlbiB0aGUgc291cmNlIGZpbGUgaW4gYSBuZXcgcGFuZSB0byBzaG93IHRoZSBsaW5rXG4gICAgICBjb25zdCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoXG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmICE9PSBudWxsICYmIFxuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZiAhPT0gdW5kZWZpbmVkXG4gICAgICApO1xuICAgICAgXG4gICAgICBhd2FpdCBsZWFmLm9wZW5GaWxlKHNvdXJjZUZpbGUsIHsgXG4gICAgICAgIGFjdGl2ZTogdHJ1ZSwgICAvLyBNYWtlIHRoZSBwYW5lIGFjdGl2ZVxuICAgICAgICBlU3RhdGU6IHsgICAgICAgLy8gVHJ5IHRvIHNjcm9sbCB0byB0aGUgbmV3bHkgYWRkZWQgbGlua1xuICAgICAgICAgIGxpbmU6IHNvdXJjZUNvbnRlbnQuc3BsaXQoJ1xcbicpLmxlbmd0aCArIDIsIC8vIEFwcHJveGltYXRlIGxpbmUgbnVtYmVyIG9mIHRoZSBuZXcgbGlua1xuICAgICAgICAgIGZvY3VzOiB0cnVlICAgLy8gRm9jdXMgdGhlIGVkaXRvclxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gU2hvdyBhIHN1Y2Nlc3Mgbm90aWNlXG4gICAgICBuZXcgTm90aWNlKFwiTGluayBjcmVhdGVkIHN1Y2Nlc3NmdWxseSEg8J+Ul1wiLCAyMDAwKTtcbiAgICAgIFxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNyZWF0aW5nIG5vdGUgbGluazonLCBlcnJvcik7XG4gICAgICBuZXcgTm90aWNlKGBGYWlsZWQgdG8gY3JlYXRlIGxpbms6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbn1cblxuLy8gSW50ZXJmYWNlIGZvciB0LVNORSByZXN1bHQgcG9pbnRzXG5pbnRlcmZhY2UgVFNORVBvaW50IHtcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIHBhdGg6IHN0cmluZztcbiAgdG9wX3Rlcm1zOiBzdHJpbmdbXTtcbiAgY2x1c3RlcjogbnVtYmVyOyAvLyBDbHVzdGVyIElEICgtMSBtZWFucyBub2lzZS9ub3QgY2x1c3RlcmVkKVxuICBcbiAgLy8gQWRkaXRpb25hbCBtZXRhZGF0YVxuICBtdGltZT86IG51bWJlcjsgICAgICAvLyBMYXN0IG1vZGlmaWVkIHRpbWVcbiAgY3RpbWU/OiBudW1iZXI7ICAgICAgLy8gQ3JlYXRpb24gdGltZVxuICB3b3JkQ291bnQ/OiBudW1iZXI7ICAvLyBXb3JkIGNvdW50XG4gIHJlYWRpbmdUaW1lPzogbnVtYmVyOyAvLyBFc3RpbWF0ZWQgcmVhZGluZyB0aW1lIGluIG1pbnV0ZXMgIFxuICB0YWdzPzogc3RyaW5nW107ICAgICAvLyBOb3RlIHRhZ3NcbiAgY29udGVudFByZXZpZXc/OiBzdHJpbmc7IC8vIFNob3J0IHByZXZpZXcgb2YgY29udGVudFxuICBkaXN0YW5jZVRvQ2VudGVyPzogbnVtYmVyOyAvLyBEaXN0YW5jZSB0byBjbHVzdGVyIGNlbnRlclxufVxuXG4vLyBJbnRlcmZhY2UgZm9yIGNsdXN0ZXIgdGVybSBpbmZvcm1hdGlvblxuaW50ZXJmYWNlIENsdXN0ZXJUZXJtIHtcbiAgdGVybTogc3RyaW5nO1xuICBzY29yZTogbnVtYmVyO1xufVxuXG4vLyBJbnRlcmZhY2UgZm9yIGNsdXN0ZXIgaW5mb3JtYXRpb25cbmludGVyZmFjZSBDbHVzdGVySW5mbyB7XG4gIFtrZXk6IHN0cmluZ106IENsdXN0ZXJUZXJtW107XG59XG5cbi8vIEludGVyZmFjZSBmb3IgdC1TTkUgcmVzdWx0c1xuaW50ZXJmYWNlIFRTTkVSZXN1bHQge1xuICBwb2ludHM6IFRTTkVQb2ludFtdO1xuICBmZWF0dXJlX25hbWVzOiBzdHJpbmdbXTtcbiAgY2x1c3RlcnM6IG51bWJlcjtcbiAgY2x1c3Rlcl90ZXJtczogQ2x1c3RlckluZm87XG59XG5cbmNsYXNzIFRTTkVWaXN1YWxpemVyIHtcbiAgcHJpdmF0ZSBjb250YWluZXI6IEhUTUxFbGVtZW50O1xuICBwcml2YXRlIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQ7XG4gIHByaXZhdGUgY3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG4gIHByaXZhdGUgcmVzdWx0OiBUU05FUmVzdWx0IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgd2lkdGggPSA4MDA7XG4gIHByaXZhdGUgaGVpZ2h0ID0gNjAwO1xuICBwcml2YXRlIHBvaW50UmFkaXVzID0gMTA7XG4gIHByaXZhdGUgbW91c2VYID0gMDtcbiAgcHJpdmF0ZSBtb3VzZVkgPSAwO1xuICBwcml2YXRlIHNjYWxlID0gMTtcbiAgcHJpdmF0ZSBvZmZzZXRYID0gMDtcbiAgcHJpdmF0ZSBvZmZzZXRZID0gMDtcbiAgcHJpdmF0ZSBpc0RyYWdnaW5nID0gZmFsc2U7XG4gIHByaXZhdGUgbGFzdFggPSAwO1xuICBwcml2YXRlIGxhc3RZID0gMDtcbiAgcHJpdmF0ZSBob3ZlcmVkUG9pbnQ6IFRTTkVQb2ludCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIG9wZW5DYWxsYmFjazogKHBhdGg6IHN0cmluZykgPT4gdm9pZDtcblxuICBjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBvcGVuQ2FsbGJhY2s6IChwYXRoOiBzdHJpbmcpID0+IHZvaWQpIHtcbiAgICB0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICB0aGlzLm9wZW5DYWxsYmFjayA9IG9wZW5DYWxsYmFjaztcbiAgICBcbiAgICAvLyBDcmVhdGUgY2FudmFzIGVsZW1lbnRcbiAgICB0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIHRoaXMuY2FudmFzLndpZHRoID0gdGhpcy53aWR0aDtcbiAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSB0aGlzLmhlaWdodDtcbiAgICB0aGlzLmNhbnZhcy5jbGFzc0xpc3QuYWRkKCd0c25lLWNhbnZhcycpO1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLmJvcmRlciA9ICcxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpJztcbiAgICBcbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICBpZiAoIWNvbnRleHQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGNyZWF0ZSBjYW52YXMgY29udGV4dCcpO1xuICAgIH1cbiAgICB0aGlzLmN0eCA9IGNvbnRleHQ7XG4gICAgXG4gICAgLy8gQ2xlYXIgdGhlIGNvbnRhaW5lciBmaXJzdFxuICAgIHdoaWxlICh0aGlzLmNvbnRhaW5lci5maXJzdENoaWxkKSB7XG4gICAgICB0aGlzLmNvbnRhaW5lci5yZW1vdmVDaGlsZCh0aGlzLmNvbnRhaW5lci5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQWRkIGNhbnZhcyB0byBjb250YWluZXJcbiAgICB0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLmNhbnZhcyk7XG4gICAgXG4gICAgLy8gQWRkIGV2ZW50IGxpc3RlbmVyc1xuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnMoKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhZGRFdmVudExpc3RlbmVycygpIHtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLmhhbmRsZU1vdXNlTW92ZS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuaGFuZGxlQ2xpY2suYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignd2hlZWwnLCB0aGlzLmhhbmRsZVdoZWVsLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMuaGFuZGxlTW91c2VEb3duLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLmhhbmRsZU1vdXNlVXAuYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsIHRoaXMuaGFuZGxlTW91c2VVcC5iaW5kKHRoaXMpKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZU1vdmUoZTogTW91c2VFdmVudCkge1xuICAgIGNvbnN0IHJlY3QgPSB0aGlzLmNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB0aGlzLm1vdXNlWCA9IGUuY2xpZW50WCAtIHJlY3QubGVmdDtcbiAgICB0aGlzLm1vdXNlWSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xuICAgIFxuICAgIGlmICh0aGlzLmlzRHJhZ2dpbmcpIHtcbiAgICAgIGNvbnN0IGR4ID0gdGhpcy5tb3VzZVggLSB0aGlzLmxhc3RYO1xuICAgICAgY29uc3QgZHkgPSB0aGlzLm1vdXNlWSAtIHRoaXMubGFzdFk7XG4gICAgICBcbiAgICAgIHRoaXMub2Zmc2V0WCArPSBkeDtcbiAgICAgIHRoaXMub2Zmc2V0WSArPSBkeTtcbiAgICAgIFxuICAgICAgdGhpcy5sYXN0WCA9IHRoaXMubW91c2VYO1xuICAgICAgdGhpcy5sYXN0WSA9IHRoaXMubW91c2VZO1xuICAgICAgXG4gICAgICB0aGlzLmRyYXcoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51cGRhdGVIb3ZlcmVkUG9pbnQoKTtcbiAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVDbGljayhlOiBNb3VzZUV2ZW50KSB7XG4gICAgaWYgKHRoaXMuaG92ZXJlZFBvaW50KSB7XG4gICAgICB0aGlzLm9wZW5DYWxsYmFjayh0aGlzLmhvdmVyZWRQb2ludC5wYXRoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgaGFuZGxlV2hlZWwoZTogV2hlZWxFdmVudCkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBcbiAgICBjb25zdCBkZWx0YSA9IGUuZGVsdGFZID4gMCA/IDAuOSA6IDEuMTtcbiAgICB0aGlzLnNjYWxlICo9IGRlbHRhO1xuICAgIFxuICAgIC8vIExpbWl0IHpvb21cbiAgICB0aGlzLnNjYWxlID0gTWF0aC5tYXgoMC4xLCBNYXRoLm1pbig1LCB0aGlzLnNjYWxlKSk7XG4gICAgXG4gICAgdGhpcy5kcmF3KCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgaGFuZGxlTW91c2VEb3duKGU6IE1vdXNlRXZlbnQpIHtcbiAgICB0aGlzLmlzRHJhZ2dpbmcgPSB0cnVlO1xuICAgIHRoaXMubGFzdFggPSB0aGlzLm1vdXNlWDtcbiAgICB0aGlzLmxhc3RZID0gdGhpcy5tb3VzZVk7XG4gICAgdGhpcy5jYW52YXMuc3R5bGUuY3Vyc29yID0gJ2dyYWJiaW5nJztcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZVVwKGU6IE1vdXNlRXZlbnQpIHtcbiAgICB0aGlzLmlzRHJhZ2dpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS5jdXJzb3IgPSB0aGlzLmhvdmVyZWRQb2ludCA/ICdwb2ludGVyJyA6ICdkZWZhdWx0JztcbiAgfVxuICBcbiAgcHJpdmF0ZSB1cGRhdGVIb3ZlcmVkUG9pbnQoKSB7XG4gICAgaWYgKCF0aGlzLnJlc3VsdCkgcmV0dXJuO1xuICAgIFxuICAgIHRoaXMuaG92ZXJlZFBvaW50ID0gbnVsbDtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgY29uc3QgW3NjcmVlblgsIHNjcmVlblldID0gdGhpcy53b3JsZFRvU2NyZWVuKHBvaW50LngsIHBvaW50LnkpO1xuICAgICAgY29uc3QgZGlzdGFuY2UgPSBNYXRoLnNxcnQoXG4gICAgICAgIE1hdGgucG93KHNjcmVlblggLSB0aGlzLm1vdXNlWCwgMikgKyBcbiAgICAgICAgTWF0aC5wb3coc2NyZWVuWSAtIHRoaXMubW91c2VZLCAyKVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgaWYgKGRpc3RhbmNlIDw9IHRoaXMucG9pbnRSYWRpdXMpIHtcbiAgICAgICAgdGhpcy5ob3ZlcmVkUG9pbnQgPSBwb2ludDtcbiAgICAgICAgdGhpcy5jYW52YXMuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHRoaXMuY2FudmFzLnN0eWxlLmN1cnNvciA9IHRoaXMuaXNEcmFnZ2luZyA/ICdncmFiYmluZycgOiAnZGVmYXVsdCc7XG4gIH1cbiAgXG4gIC8vIENvbnZlcnRzIHdvcmxkIHNwYWNlICh0LVNORSkgY29vcmRpbmF0ZXMgdG8gc2NyZWVuIGNvb3JkaW5hdGVzXG4gIHByaXZhdGUgd29ybGRUb1NjcmVlbih4OiBudW1iZXIsIHk6IG51bWJlcik6IFtudW1iZXIsIG51bWJlcl0ge1xuICAgIC8vIE5vcm1hbGl6ZSB0byBjZW50ZXIgb2Ygc2NyZWVuXG4gICAgY29uc3QgY2VudGVyWCA9IHRoaXMud2lkdGggLyAyO1xuICAgIGNvbnN0IGNlbnRlclkgPSB0aGlzLmhlaWdodCAvIDI7XG4gICAgXG4gICAgLy8gQXBwbHkgc2NhbGUgYW5kIG9mZnNldFxuICAgIGNvbnN0IHNjcmVlblggPSB4ICogdGhpcy5zY2FsZSAqIDEwMCArIGNlbnRlclggKyB0aGlzLm9mZnNldFg7XG4gICAgY29uc3Qgc2NyZWVuWSA9IHkgKiB0aGlzLnNjYWxlICogMTAwICsgY2VudGVyWSArIHRoaXMub2Zmc2V0WTtcbiAgICBcbiAgICByZXR1cm4gW3NjcmVlblgsIHNjcmVlblldO1xuICB9XG4gIFxuICBwdWJsaWMgc2V0RGF0YShyZXN1bHQ6IFRTTkVSZXN1bHQpIHtcbiAgICB0aGlzLnJlc3VsdCA9IHJlc3VsdDtcbiAgICB0aGlzLnJlc2V0VmlldygpO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG4gIFxuICBwcml2YXRlIHJlc2V0VmlldygpIHtcbiAgICB0aGlzLnNjYWxlID0gMTtcbiAgICB0aGlzLm9mZnNldFggPSAwO1xuICAgIHRoaXMub2Zmc2V0WSA9IDA7XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhdygpIHtcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgLy8gQ2xlYXIgY2FudmFzXG4gICAgdGhpcy5jdHguY2xlYXJSZWN0KDAsIDAsIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcbiAgICBcbiAgICAvLyBEcmF3IGJhY2tncm91bmQgZ3JpZFxuICAgIHRoaXMuZHJhd0dyaWQoKTtcbiAgICBcbiAgICAvLyBGaW5kIGNsdXN0ZXJzIHVzaW5nIGEgc2ltcGxlIGRpc3RhbmNlIG1ldHJpY1xuICAgIGNvbnN0IGNsdXN0ZXJzID0gdGhpcy5maW5kQ2x1c3RlcnMoKTtcbiAgICBcbiAgICAvLyBEcmF3IGNsdXN0ZXJzIGZpcnN0ICh1bmRlcm5lYXRoIHBvaW50cylcbiAgICB0aGlzLmRyYXdDbHVzdGVycyhjbHVzdGVycyk7XG4gICAgXG4gICAgLy8gRHJhdyBwb2ludHNcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgdGhpcy5kcmF3UG9pbnQocG9pbnQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBEcmF3IHRvb2x0aXAgZm9yIGhvdmVyZWQgcG9pbnRcbiAgICBpZiAodGhpcy5ob3ZlcmVkUG9pbnQpIHtcbiAgICAgIHRoaXMuZHJhd1Rvb2x0aXAoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhd0dyaWQoKSB7XG4gICAgY29uc3QgZ3JpZFNpemUgPSA1MCAqIHRoaXMuc2NhbGU7XG4gICAgXG4gICAgdGhpcy5jdHguc3Ryb2tlU3R5bGUgPSAncmdiYSh2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlci1yZ2IpLCAwLjMpJztcbiAgICB0aGlzLmN0eC5saW5lV2lkdGggPSAxO1xuICAgIFxuICAgIC8vIFZlcnRpY2FsIGxpbmVzXG4gICAgZm9yIChsZXQgeCA9IHRoaXMub2Zmc2V0WCAlIGdyaWRTaXplOyB4IDwgdGhpcy53aWR0aDsgeCArPSBncmlkU2l6ZSkge1xuICAgICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgICB0aGlzLmN0eC5tb3ZlVG8oeCwgMCk7XG4gICAgICB0aGlzLmN0eC5saW5lVG8oeCwgdGhpcy5oZWlnaHQpO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgfVxuICAgIFxuICAgIC8vIEhvcml6b250YWwgbGluZXNcbiAgICBmb3IgKGxldCB5ID0gdGhpcy5vZmZzZXRZICUgZ3JpZFNpemU7IHkgPCB0aGlzLmhlaWdodDsgeSArPSBncmlkU2l6ZSkge1xuICAgICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgICB0aGlzLmN0eC5tb3ZlVG8oMCwgeSk7XG4gICAgICB0aGlzLmN0eC5saW5lVG8odGhpcy53aWR0aCwgeSk7XG4gICAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZmluZENsdXN0ZXJzKCkge1xuICAgIGlmICghdGhpcy5yZXN1bHQpIHJldHVybiBbXTtcbiAgICBcbiAgICAvLyBTaW1wbGUgY2x1c3RlcmluZyBiYXNlZCBvbiBkaXN0YW5jZVxuICAgIGNvbnN0IHBvaW50cyA9IHRoaXMucmVzdWx0LnBvaW50cztcbiAgICBjb25zdCBjbHVzdGVyczogVFNORVBvaW50W11bXSA9IFtdO1xuICAgIGNvbnN0IHZpc2l0ZWQgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgICBcbiAgICBjb25zdCBkaXN0YW5jZVRocmVzaG9sZCA9IDAuMjsgIC8vIEFkanVzdCB0aGlzIHRocmVzaG9sZCBhcyBuZWVkZWRcbiAgICBcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHZpc2l0ZWQuaGFzKGkpKSBjb250aW51ZTtcbiAgICAgIFxuICAgICAgY29uc3QgY2x1c3RlcjogVFNORVBvaW50W10gPSBbcG9pbnRzW2ldXTtcbiAgICAgIHZpc2l0ZWQuYWRkKGkpO1xuICAgICAgXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHBvaW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICBpZiAoaSA9PT0gaiB8fCB2aXNpdGVkLmhhcyhqKSkgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBkaXN0YW5jZSA9IE1hdGguc3FydChcbiAgICAgICAgICBNYXRoLnBvdyhwb2ludHNbaV0ueCAtIHBvaW50c1tqXS54LCAyKSArIFxuICAgICAgICAgIE1hdGgucG93KHBvaW50c1tpXS55IC0gcG9pbnRzW2pdLnksIDIpXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICBpZiAoZGlzdGFuY2UgPCBkaXN0YW5jZVRocmVzaG9sZCkge1xuICAgICAgICAgIGNsdXN0ZXIucHVzaChwb2ludHNbal0pO1xuICAgICAgICAgIHZpc2l0ZWQuYWRkKGopO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChjbHVzdGVyLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgY2x1c3RlcnMucHVzaChjbHVzdGVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGNsdXN0ZXJzO1xuICB9XG4gIFxuICBwcml2YXRlIGRyYXdDbHVzdGVycyhjbHVzdGVyczogVFNORVBvaW50W11bXSkge1xuICAgIC8vIFNraXAgaWYgbm8gcmVzdWx0IGRhdGFcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgLy8gQ29sb3IgcGFsZXR0ZSBmb3IgY2x1c3RlcnMgKGV4Y2x1ZGluZyBub2lzZSBwb2ludHMpXG4gICAgY29uc3QgY29sb3JzID0gW1xuICAgICAgeyBmaWxsOiAncmdiYSgyNTUsIDk5LCAxMzIsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDI1NSwgOTksIDEzMiwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoNTQsIDE2MiwgMjM1LCAwLjEpJywgc3Ryb2tlOiAncmdiYSg1NCwgMTYyLCAyMzUsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDI1NSwgMjA2LCA4NiwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMjU1LCAyMDYsIDg2LCAwLjUpJyB9LFxuICAgICAgeyBmaWxsOiAncmdiYSg3NSwgMTkyLCAxOTIsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDc1LCAxOTIsIDE5MiwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoMTUzLCAxMDIsIDI1NSwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMTUzLCAxMDIsIDI1NSwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoMjU1LCAxNTksIDY0LCAwLjEpJywgc3Ryb2tlOiAncmdiYSgyNTUsIDE1OSwgNjQsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDE5OSwgMTk5LCAxOTksIDAuMSknLCBzdHJva2U6ICdyZ2JhKDE5OSwgMTk5LCAxOTksIDAuNSknIH0sXG4gICAgXTtcbiAgICBcbiAgICAvLyBHcm91cCBwb2ludHMgYnkgY2x1c3RlciBJRCBmcm9tIHRoZSBzZXJ2ZXIgcmVzcG9uc2VcbiAgICBjb25zdCBjbHVzdGVyR3JvdXBzOiB7IFtrZXk6IG51bWJlcl06IFRTTkVQb2ludFtdIH0gPSB7fTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucmVzdWx0LnBvaW50cykge1xuICAgICAgaWYgKHBvaW50LmNsdXN0ZXIgPT09IC0xKSBjb250aW51ZTsgLy8gU2tpcCBub2lzZSBwb2ludHNcbiAgICAgIFxuICAgICAgaWYgKCFjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdKSB7XG4gICAgICAgIGNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0gPSBbXTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXS5wdXNoKHBvaW50KTtcbiAgICB9XG4gICAgXG4gICAgLy8gRHJhdyBlYWNoIGNsdXN0ZXJcbiAgICBPYmplY3QuZW50cmllcyhjbHVzdGVyR3JvdXBzKS5mb3JFYWNoKChbY2x1c3RlcklkLCBwb2ludHNdLCBpbmRleCkgPT4ge1xuICAgICAgLy8gRmluZCB0aGUgY2VudHJvaWQgYW5kIGJvdW5kcyBvZiB0aGUgY2x1c3RlclxuICAgICAgbGV0IG1pblggPSBJbmZpbml0eSwgbWluWSA9IEluZmluaXR5O1xuICAgICAgbGV0IG1heFggPSAtSW5maW5pdHksIG1heFkgPSAtSW5maW5pdHk7XG4gICAgICBsZXQgc3VtWCA9IDAsIHN1bVkgPSAwO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHBvaW50cykge1xuICAgICAgICBjb25zdCBbc2NyZWVuWCwgc2NyZWVuWV0gPSB0aGlzLndvcmxkVG9TY3JlZW4ocG9pbnQueCwgcG9pbnQueSk7XG4gICAgICAgIG1pblggPSBNYXRoLm1pbihtaW5YLCBzY3JlZW5YKTtcbiAgICAgICAgbWluWSA9IE1hdGgubWluKG1pblksIHNjcmVlblkpO1xuICAgICAgICBtYXhYID0gTWF0aC5tYXgobWF4WCwgc2NyZWVuWCk7XG4gICAgICAgIG1heFkgPSBNYXRoLm1heChtYXhZLCBzY3JlZW5ZKTtcbiAgICAgICAgc3VtWCArPSBzY3JlZW5YO1xuICAgICAgICBzdW1ZICs9IHNjcmVlblk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIENhbGN1bGF0ZSBjZW50cm9pZFxuICAgICAgY29uc3QgY2VudGVyWCA9IHN1bVggLyBwb2ludHMubGVuZ3RoO1xuICAgICAgY29uc3QgY2VudGVyWSA9IHN1bVkgLyBwb2ludHMubGVuZ3RoO1xuICAgICAgXG4gICAgICAvLyBBZGQgcGFkZGluZ1xuICAgICAgY29uc3QgcGFkZGluZyA9IDIwO1xuICAgICAgbWluWCAtPSBwYWRkaW5nO1xuICAgICAgbWluWSAtPSBwYWRkaW5nO1xuICAgICAgbWF4WCArPSBwYWRkaW5nO1xuICAgICAgbWF4WSArPSBwYWRkaW5nO1xuICAgICAgXG4gICAgICAvLyBVc2UgY29sb3IgZnJvbSBwYWxldHRlIChjeWNsZSBpZiBtb3JlIGNsdXN0ZXJzIHRoYW4gY29sb3JzKVxuICAgICAgY29uc3QgY29sb3JJbmRleCA9IHBhcnNlSW50KGNsdXN0ZXJJZCkgJSBjb2xvcnMubGVuZ3RoO1xuICAgICAgY29uc3QgY29sb3IgPSBjb2xvcnNbY29sb3JJbmRleF07XG4gICAgICBcbiAgICAgIC8vIERyYXcgYSByb3VuZGVkIHJlY3RhbmdsZSBhcm91bmQgdGhlIGNsdXN0ZXJcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9IGNvbG9yLmZpbGw7XG4gICAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9IGNvbG9yLnN0cm9rZTtcbiAgICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgICBcbiAgICAgIHRoaXMucm91bmRSZWN0KFxuICAgICAgICBtaW5YLCBcbiAgICAgICAgbWluWSwgXG4gICAgICAgIG1heFggLSBtaW5YLCBcbiAgICAgICAgbWF4WSAtIG1pblksIFxuICAgICAgICAxMFxuICAgICAgKTtcbiAgICAgIFxuICAgICAgdGhpcy5jdHguZmlsbCgpO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgICBcbiAgICAgIC8vIERyYXcgY2x1c3RlciBsYWJlbCB3aXRoIHRvcCB0ZXJtcyBpZiBhdmFpbGFibGVcbiAgICAgIGlmICh0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zICYmIHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXSkge1xuICAgICAgICBjb25zdCB0ZXJtcyA9IHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXVxuICAgICAgICAgIC5zbGljZSgwLCAzKSAgLy8gVGFrZSB0b3AgMyB0ZXJtc1xuICAgICAgICAgIC5tYXAodCA9PiB0LnRlcm0pXG4gICAgICAgICAgLmpvaW4oJywgJyk7XG4gICAgICAgIFxuICAgICAgICAvLyBEcmF3IGEgbGFiZWwgd2l0aCBjbHVzdGVyIElEIGFuZCB0b3AgdGVybXNcbiAgICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3ZhcigtLXRleHQtbm9ybWFsKSc7XG4gICAgICAgIHRoaXMuY3R4LmZvbnQgPSAnYm9sZCAxMnB4IHZhcigtLWZvbnQtdGV4dCknO1xuICAgICAgICB0aGlzLmN0eC50ZXh0QWxpZ24gPSAnY2VudGVyJztcbiAgICAgICAgdGhpcy5jdHguZmlsbFRleHQoYENsdXN0ZXIgJHtjbHVzdGVySWR9OiAke3Rlcm1zfWAsIGNlbnRlclgsIG1pblkgLSA1KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBcbiAgcHJpdmF0ZSByb3VuZFJlY3QoeDogbnVtYmVyLCB5OiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCByYWRpdXM6IG51bWJlcikge1xuICAgIHRoaXMuY3R4LmJlZ2luUGF0aCgpO1xuICAgIHRoaXMuY3R4Lm1vdmVUbyh4ICsgcmFkaXVzLCB5KTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCArIHdpZHRoIC0gcmFkaXVzLCB5KTtcbiAgICB0aGlzLmN0eC5hcmNUbyh4ICsgd2lkdGgsIHksIHggKyB3aWR0aCwgeSArIHJhZGl1cywgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCArIHdpZHRoLCB5ICsgaGVpZ2h0IC0gcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5hcmNUbyh4ICsgd2lkdGgsIHkgKyBoZWlnaHQsIHggKyB3aWR0aCAtIHJhZGl1cywgeSArIGhlaWdodCwgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCArIHJhZGl1cywgeSArIGhlaWdodCk7XG4gICAgdGhpcy5jdHguYXJjVG8oeCwgeSArIGhlaWdodCwgeCwgeSArIGhlaWdodCAtIHJhZGl1cywgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5saW5lVG8oeCwgeSArIHJhZGl1cyk7XG4gICAgdGhpcy5jdHguYXJjVG8oeCwgeSwgeCArIHJhZGl1cywgeSwgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5jbG9zZVBhdGgoKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBkcmF3UG9pbnQocG9pbnQ6IFRTTkVQb2ludCkge1xuICAgIGNvbnN0IFt4LCB5XSA9IHRoaXMud29ybGRUb1NjcmVlbihwb2ludC54LCBwb2ludC55KTtcbiAgICBcbiAgICAvLyBDb2xvciBwYWxldHRlIGZvciBjbHVzdGVyc1xuICAgIGNvbnN0IGNsdXN0ZXJDb2xvcnMgPSBbXG4gICAgICAncmdiYSgyNTUsIDk5LCAxMzIsIDEpJywgICAgLy8gcmVkXG4gICAgICAncmdiYSg1NCwgMTYyLCAyMzUsIDEpJywgICAgLy8gYmx1ZVxuICAgICAgJ3JnYmEoMjU1LCAyMDYsIDg2LCAxKScsICAgIC8vIHllbGxvd1xuICAgICAgJ3JnYmEoNzUsIDE5MiwgMTkyLCAxKScsICAgIC8vIGdyZWVuXG4gICAgICAncmdiYSgxNTMsIDEwMiwgMjU1LCAxKScsICAgLy8gcHVycGxlXG4gICAgICAncmdiYSgyNTUsIDE1OSwgNjQsIDEpJywgICAgLy8gb3JhbmdlXG4gICAgICAncmdiYSgxOTksIDE5OSwgMTk5LCAxKScsICAgLy8gZ3JleVxuICAgIF07XG4gICAgXG4gICAgLy8gRHJhdyBjaXJjbGVcbiAgICB0aGlzLmN0eC5iZWdpblBhdGgoKTtcbiAgICB0aGlzLmN0eC5hcmMoeCwgeSwgdGhpcy5wb2ludFJhZGl1cywgMCwgTWF0aC5QSSAqIDIpO1xuICAgIFxuICAgIC8vIERldGVybWluZSBjb2xvciBiYXNlZCBvbiBob3ZlciBzdGF0ZSBhbmQgY2x1c3RlclxuICAgIGlmICh0aGlzLmhvdmVyZWRQb2ludCA9PT0gcG9pbnQpIHtcbiAgICAgIC8vIEhvdmVyZWQgcG9pbnRzIGFyZSBhbHdheXMgaGlnaGxpZ2h0ZWQgaW4gdGhlIGFjY2VudCBjb2xvclxuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3ZhcigtLWludGVyYWN0aXZlLWFjY2VudCknO1xuICAgIH0gZWxzZSBpZiAocG9pbnQuY2x1c3RlciA9PT0gLTEpIHtcbiAgICAgIC8vIE5vaXNlIHBvaW50cyAobm90IGluIGEgY2x1c3RlcikgYXJlIGdyZXlcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS10ZXh0LW11dGVkKSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFBvaW50cyBpbiBjbHVzdGVycyB1c2UgdGhlIGNsdXN0ZXIgY29sb3IgcGFsZXR0ZVxuICAgICAgY29uc3QgY29sb3JJbmRleCA9IHBvaW50LmNsdXN0ZXIgJSBjbHVzdGVyQ29sb3JzLmxlbmd0aDtcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9IGNsdXN0ZXJDb2xvcnNbY29sb3JJbmRleF07XG4gICAgfVxuICAgIFxuICAgIHRoaXMuY3R4LmZpbGwoKTtcbiAgICBcbiAgICAvLyBBZGQgYm9yZGVyIHRvIHBvaW50c1xuICAgIHRoaXMuY3R4LnN0cm9rZVN0eWxlID0gJ3ZhcigtLWJhY2tncm91bmQtcHJpbWFyeSknO1xuICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgXG4gICAgLy8gRHJhdyB0aXRsZSBpZiBub3QgaG92ZXJlZCAoaG92ZXJlZCBzaG93cyBpbiB0b29sdGlwKVxuICAgIGlmICh0aGlzLmhvdmVyZWRQb2ludCAhPT0gcG9pbnQpIHtcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS10ZXh0LW5vcm1hbCknO1xuICAgICAgdGhpcy5jdHguZm9udCA9ICcxMnB4IHZhcigtLWZvbnQtdGV4dCknO1xuICAgICAgdGhpcy5jdHgudGV4dEFsaWduID0gJ2NlbnRlcic7XG4gICAgICB0aGlzLmN0eC5maWxsVGV4dChwb2ludC50aXRsZSwgeCwgeSAtIHRoaXMucG9pbnRSYWRpdXMgLSA1KTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhd1Rvb2x0aXAoKSB7XG4gICAgaWYgKCF0aGlzLmhvdmVyZWRQb2ludCB8fCAhdGhpcy5yZXN1bHQpIHJldHVybjtcbiAgICBcbiAgICBjb25zdCBbeCwgeV0gPSB0aGlzLndvcmxkVG9TY3JlZW4odGhpcy5ob3ZlcmVkUG9pbnQueCwgdGhpcy5ob3ZlcmVkUG9pbnQueSk7XG4gICAgY29uc3QgcG9pbnQgPSB0aGlzLmhvdmVyZWRQb2ludDtcbiAgICBcbiAgICAvLyBUb29sdGlwIGNvbnRlbnRcbiAgICBjb25zdCB0aXRsZSA9IHBvaW50LnRpdGxlO1xuICAgIGNvbnN0IHBhdGggPSBwb2ludC5wYXRoO1xuICAgIGNvbnN0IHRlcm1zID0gcG9pbnQudG9wX3Rlcm1zLmpvaW4oJywgJyk7XG4gICAgXG4gICAgLy8gRm9ybWF0IGRhdGVzIGlmIGF2YWlsYWJsZVxuICAgIGNvbnN0IGZvcm1hdERhdGUgPSAodGltZXN0YW1wPzogbnVtYmVyKSA9PiB7XG4gICAgICBpZiAoIXRpbWVzdGFtcCkgcmV0dXJuICdVbmtub3duJztcbiAgICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSh0aW1lc3RhbXApO1xuICAgICAgcmV0dXJuIGRhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKCkgKyAnICcgKyBkYXRlLnRvTG9jYWxlVGltZVN0cmluZyhbXSwgeyBob3VyOiAnMi1kaWdpdCcsIG1pbnV0ZTogJzItZGlnaXQnIH0pO1xuICAgIH07XG4gICAgXG4gICAgLy8gR2V0IG1ldGFkYXRhXG4gICAgY29uc3QgbW9kaWZpZWQgPSBmb3JtYXREYXRlKHBvaW50Lm10aW1lKTtcbiAgICBjb25zdCBjcmVhdGVkID0gZm9ybWF0RGF0ZShwb2ludC5jdGltZSk7XG4gICAgY29uc3Qgd29yZENvdW50ID0gcG9pbnQud29yZENvdW50ID8gYCR7cG9pbnQud29yZENvdW50fSB3b3Jkc2AgOiAnVW5rbm93bic7XG4gICAgY29uc3QgcmVhZGluZ1RpbWUgPSBwb2ludC5yZWFkaW5nVGltZSA/IGB+JHtwb2ludC5yZWFkaW5nVGltZX0gbWluIHJlYWRgIDogJyc7XG4gICAgXG4gICAgLy8gRm9ybWF0IHRhZ3NcbiAgICBjb25zdCB0YWdzID0gcG9pbnQudGFncyAmJiBwb2ludC50YWdzLmxlbmd0aCA+IDAgXG4gICAgICA/IHBvaW50LnRhZ3MubWFwKHRhZyA9PiBgIyR7dGFnfWApLmpvaW4oJyAnKVxuICAgICAgOiAnTm8gdGFncyc7XG4gICAgXG4gICAgLy8gRm9ybWF0IGNvbnRlbnQgcHJldmlld1xuICAgIGNvbnN0IHByZXZpZXcgPSBwb2ludC5jb250ZW50UHJldmlldyB8fCAnTm8gcHJldmlldyBhdmFpbGFibGUnO1xuICAgIFxuICAgIC8vIEdldCBkaXN0YW5jZSB0byBjZW50ZXJcbiAgICBjb25zdCBkaXN0YW5jZUluZm8gPSBwb2ludC5kaXN0YW5jZVRvQ2VudGVyICE9PSB1bmRlZmluZWQgJiYgcG9pbnQuY2x1c3RlciAhPT0gLTFcbiAgICAgID8gYERpc3RhbmNlIHRvIGNlbnRlcjogJHtwb2ludC5kaXN0YW5jZVRvQ2VudGVyLnRvRml4ZWQoMil9YFxuICAgICAgOiAnJztcbiAgICBcbiAgICAvLyBHZXQgY2x1c3RlciBpbmZvcm1hdGlvblxuICAgIGxldCBjbHVzdGVySW5mbyA9ICdOb3QgY2x1c3RlcmVkJztcbiAgICBpZiAocG9pbnQuY2x1c3RlciAhPT0gLTEpIHtcbiAgICAgIGNvbnN0IGNsdXN0ZXJJZCA9IHBvaW50LmNsdXN0ZXI7XG4gICAgICBcbiAgICAgIC8vIEdldCBjbHVzdGVyIHRlcm1zIGlmIGF2YWlsYWJsZVxuICAgICAgbGV0IGNsdXN0ZXJUZXJtcyA9ICcnO1xuICAgICAgaWYgKHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXMgJiYgdGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtc1tjbHVzdGVySWRdKSB7XG4gICAgICAgIGNsdXN0ZXJUZXJtcyA9IHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXVxuICAgICAgICAgIC5zbGljZSgwLCAzKSAvLyBUYWtlIHRvcCAzIHRlcm1zXG4gICAgICAgICAgLm1hcCh0ID0+IHQudGVybSlcbiAgICAgICAgICAuam9pbignLCAnKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2x1c3RlckluZm8gPSBgQ2x1c3RlciAke2NsdXN0ZXJJZH06ICR7Y2x1c3RlclRlcm1zfWA7XG4gICAgfVxuICAgIFxuICAgIC8vIERlZmluZSBhbGwgdG9vbHRpcCBzZWN0aW9ucyAtIG1vcmUgY29tcGFjdCBsYXlvdXQgd2l0aCBncm91cGluZ1xuICAgIGNvbnN0IHNlY3Rpb25zID0gW1xuICAgICAgeyBcbiAgICAgICAgbGFiZWw6ICdUaXRsZScsIFxuICAgICAgICB0ZXh0OiB0aXRsZSwgXG4gICAgICAgIGZvbnQ6ICdib2xkIDE0cHggc2Fucy1zZXJpZicsXG4gICAgICAgIGFsd2F5c1Nob3c6IHRydWUgIC8vIEFsd2F5cyBzaG93IHRpdGxlXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBsYWJlbDogJ1BhdGgnLCBcbiAgICAgICAgdGV4dDogcGF0aCwgXG4gICAgICAgIGZvbnQ6ICdpdGFsaWMgMTFweCBzYW5zLXNlcmlmJyxcbiAgICAgICAgc2tpcElmRW1wdHk6IHRydWVcbiAgICAgIH0sXG4gICAgICB7IFxuICAgICAgICBsYWJlbDogJ0tleXdvcmRzJywgXG4gICAgICAgIHRleHQ6IHRlcm1zLCBcbiAgICAgICAgc2tpcElmRW1wdHk6IHRydWVcbiAgICAgIH0sXG4gICAgICB7IFxuICAgICAgICBsYWJlbDogJ0NsdXN0ZXInLCBcbiAgICAgICAgdGV4dDogY2x1c3RlckluZm8sIFxuICAgICAgICBza2lwSWZFbXB0eTogdHJ1ZVxuICAgICAgfSxcbiAgICAgIC8vIENvbWJpbmUgdGFncyBhbmQgc3RhdHMgaW50byBvbmUgbGluZSBpZiBib3RoIGV4aXN0XG4gICAgICB7IFxuICAgICAgICBsYWJlbDogJ0luZm8nLCBcbiAgICAgICAgdGV4dDogW1xuICAgICAgICAgIHRhZ3MgIT09ICdObyB0YWdzJyA/IHRhZ3MgOiBudWxsLFxuICAgICAgICAgIHdvcmRDb3VudCAmJiByZWFkaW5nVGltZSA/IGAke3dvcmRDb3VudH0gKCR7cmVhZGluZ1RpbWV9KWAgOiB3b3JkQ291bnQgfHwgJydcbiAgICAgICAgXS5maWx0ZXIoQm9vbGVhbikuam9pbignIOKAoiAnKSxcbiAgICAgICAgc2tpcElmRW1wdHk6IHRydWVcbiAgICAgIH0sXG4gICAgICAvLyBDb21iaW5lIGRhdGVzIGludG8gb25lIGxpbmUgdG8gc2F2ZSBzcGFjZVxuICAgICAgeyBcbiAgICAgICAgbGFiZWw6ICdEYXRlcycsIFxuICAgICAgICB0ZXh0OiBgTW9kaWZpZWQ6ICR7bW9kaWZpZWR9JHtwb2ludC5jdGltZSA/IGAg4oCiIENyZWF0ZWQ6ICR7Y3JlYXRlZH1gIDogJyd9YCxcbiAgICAgICAgZm9udDogJzExcHggc2Fucy1zZXJpZicsXG4gICAgICAgIHNraXBJZkVtcHR5OiBwb2ludC5tdGltZSA9PT0gdW5kZWZpbmVkXG4gICAgICB9LFxuICAgICAgLy8gQ29udGVudCBwcmV2aWV3IGlzIHNob3duIGluIGEgZGlzdGluY3Qgc3R5bGVcbiAgICAgIHsgXG4gICAgICAgIGxhYmVsOiAnUHJldmlldycsIFxuICAgICAgICB0ZXh0OiBwcmV2aWV3LCBcbiAgICAgICAgZm9udDogJ2l0YWxpYyAxMXB4IHNhbnMtc2VyaWYnLFxuICAgICAgICBza2lwSWZFbXB0eTogIXBvaW50LmNvbnRlbnRQcmV2aWV3IHx8IHBvaW50LmNvbnRlbnRQcmV2aWV3Lmxlbmd0aCA8IDVcbiAgICAgIH0sXG4gICAgICAvLyBTaG93IGRpc3RhbmNlIGluZm8gb25seSBpZiBpdCBleGlzdHNcbiAgICAgIHsgXG4gICAgICAgIGxhYmVsOiAnJywgXG4gICAgICAgIHRleHQ6IGRpc3RhbmNlSW5mbywgXG4gICAgICAgIGZvbnQ6ICcxMHB4IHNhbnMtc2VyaWYnLFxuICAgICAgICBza2lwSWZFbXB0eTogdHJ1ZSBcbiAgICAgIH1cbiAgICBdO1xuICAgIFxuICAgIC8vIFNldCBwcm9wZXIgZm9udCBmb3IgbWVhc3VyZW1lbnRzXG4gICAgdGhpcy5jdHguZm9udCA9ICdib2xkIDE0cHggc2Fucy1zZXJpZic7XG4gICAgbGV0IHRvb2x0aXBXaWR0aCA9IHRoaXMuY3R4Lm1lYXN1cmVUZXh0KHRpdGxlKS53aWR0aCArIDIwOyAvLyBBZGQgc29tZSBwYWRkaW5nXG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIG1heGltdW0gd2lkdGggbmVlZGVkXG4gICAgc2VjdGlvbnMuZm9yRWFjaChzZWN0aW9uID0+IHtcbiAgICAgIGlmIChzZWN0aW9uLmFsd2F5c1Nob3cgfHwgKCFzZWN0aW9uLnNraXBJZkVtcHR5IHx8IHNlY3Rpb24udGV4dCkpIHtcbiAgICAgICAgdGhpcy5jdHguZm9udCA9IHNlY3Rpb24uZm9udCB8fCAnMTJweCBzYW5zLXNlcmlmJztcbiAgICAgICAgY29uc3Qgd2lkdGggPSB0aGlzLmN0eC5tZWFzdXJlVGV4dChcbiAgICAgICAgICBzZWN0aW9uLmxhYmVsID8gYCR7c2VjdGlvbi5sYWJlbH06ICR7c2VjdGlvbi50ZXh0fWAgOiBzZWN0aW9uLnRleHRcbiAgICAgICAgKS53aWR0aCArIDIwOyAvLyBBZGQgcGFkZGluZ1xuICAgICAgICB0b29sdGlwV2lkdGggPSBNYXRoLm1heCh0b29sdGlwV2lkdGgsIHdpZHRoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICAvLyBMaW1pdCB0b29sdGlwIHdpZHRoIHRvIGEgcmVhc29uYWJsZSBtYXhpbXVtICg4MCUgb2YgY2FudmFzIHdpZHRoKVxuICAgIHRvb2x0aXBXaWR0aCA9IE1hdGgubWluKHRvb2x0aXBXaWR0aCwgdGhpcy53aWR0aCAqIDAuOCk7XG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIHRvb2x0aXAgaGVpZ2h0IHdpdGggbW9yZSBjb21wYWN0IGxpbmUgc3BhY2luZ1xuICAgIGNvbnN0IGxpbmVIZWlnaHQgPSAxODsgLy8gU2xpZ2h0bHkgc21hbGxlciBsaW5lIGhlaWdodFxuICAgIC8vIENvdW50IGhvdyBtYW55IHNlY3Rpb25zIHdpbGwgYmUgdmlzaWJsZVxuICAgIGNvbnN0IHZpc2libGVTZWN0aW9ucyA9IHNlY3Rpb25zLmZpbHRlcihzID0+IFxuICAgICAgcy5hbHdheXNTaG93IHx8ICghcy5za2lwSWZFbXB0eSB8fCBzLnRleHQpXG4gICAgKS5sZW5ndGg7XG4gICAgXG4gICAgLy8gTW9yZSBjb21wYWN0IHRvb2x0aXAgaGVpZ2h0XG4gICAgY29uc3QgdG9vbHRpcEhlaWdodCA9IHZpc2libGVTZWN0aW9ucyAqIGxpbmVIZWlnaHQgKyAxMjsgLy8gTGVzcyBwYWRkaW5nXG4gICAgXG4gICAgLy8gUG9zaXRpb24gdG9vbHRpcCAtIGVuc3VyZSBpdCBzdGF5cyBmdWxseSB2aXNpYmxlIHdpdGhpbiB0aGUgY2FudmFzXG4gICAgLy8gSWYgdG9vbHRpcCBpcyB0b28gd2lkZSwgcG9zaXRpb24gaXQgdG8gdGhlIGxlZnQgb2YgdGhlIHBvaW50IGluc3RlYWQgb2YgdGhlIHJpZ2h0XG4gICAgbGV0IHRvb2x0aXBYID0geCArIDEwO1xuICAgIGlmICh0b29sdGlwWCArIHRvb2x0aXBXaWR0aCA+IHRoaXMud2lkdGggLSAxMCkge1xuICAgICAgdG9vbHRpcFggPSB4IC0gdG9vbHRpcFdpZHRoIC0gMTA7XG4gICAgfVxuICAgIFxuICAgIC8vIElmIHRvb2x0aXAgaXMgc3RpbGwgb3V0IG9mIGJvdW5kcyAocmFyZSBjYXNlIHdpdGggdmVyeSB3aWRlIHRvb2x0aXBzKSwgY2VudGVyIGl0XG4gICAgaWYgKHRvb2x0aXBYIDwgMTApIHtcbiAgICAgIHRvb2x0aXBYID0gTWF0aC5tYXgoMTAsIE1hdGgubWluKHRoaXMud2lkdGggLSB0b29sdGlwV2lkdGggLSAxMCwgeCAtIHRvb2x0aXBXaWR0aC8yKSk7XG4gICAgfVxuICAgIFxuICAgIC8vIFBvc2l0aW9uIHZlcnRpY2FsbHkgLSB0cnkgdG8gcGxhY2UgYWJvdmUgdGhlIHBvaW50IGlmIGl0IHdvdWxkIGdvIG9mZiBib3R0b21cbiAgICBsZXQgdG9vbHRpcFkgPSB5ICsgMTA7XG4gICAgaWYgKHRvb2x0aXBZICsgdG9vbHRpcEhlaWdodCA+IHRoaXMuaGVpZ2h0IC0gMTApIHtcbiAgICAgIHRvb2x0aXBZID0geSAtIHRvb2x0aXBIZWlnaHQgLSAxMDtcbiAgICB9XG4gICAgXG4gICAgLy8gSWYgdG9vbHRpcCBpcyBzdGlsbCBvdXQgb2YgYm91bmRzLCBwb3NpdGlvbiBpdCB0byBtaW5pbWl6ZSBvdmVyZmxvd1xuICAgIGlmICh0b29sdGlwWSA8IDEwKSB7XG4gICAgICB0b29sdGlwWSA9IDEwO1xuICAgIH1cbiAgICBcbiAgICAvLyBGaW5hbCBjaGVjayB0byBlbnN1cmUgdG9vbHRpcCBpcyBhcyB2aXNpYmxlIGFzIHBvc3NpYmxlXG4gICAgdG9vbHRpcFggPSBNYXRoLm1heCgxMCwgTWF0aC5taW4odG9vbHRpcFgsIHRoaXMud2lkdGggLSB0b29sdGlwV2lkdGggLSAxMCkpO1xuICAgIHRvb2x0aXBZID0gTWF0aC5tYXgoMTAsIE1hdGgubWluKHRvb2x0aXBZLCB0aGlzLmhlaWdodCAtIHRvb2x0aXBIZWlnaHQgLSAxMCkpO1xuICAgIFxuICAgIC8vIERyYXcgdG9vbHRpcCBiYWNrZ3JvdW5kIC0gdXNlIGEgbmljZXIgZ3JhZGllbnRcbiAgICBjb25zdCBncmFkaWVudCA9IHRoaXMuY3R4LmNyZWF0ZUxpbmVhckdyYWRpZW50KHRvb2x0aXBYLCB0b29sdGlwWSwgdG9vbHRpcFgsIHRvb2x0aXBZICsgdG9vbHRpcEhlaWdodCk7XG4gICAgZ3JhZGllbnQuYWRkQ29sb3JTdG9wKDAsICdyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuOTUpJyk7XG4gICAgZ3JhZGllbnQuYWRkQ29sb3JTdG9wKDEsICdyZ2JhKDI0NSwgMjQ1LCAyNTAsIDAuOTUpJyk7XG4gICAgdGhpcy5jdHguZmlsbFN0eWxlID0gZ3JhZGllbnQ7XG4gICAgdGhpcy5jdHguc3Ryb2tlU3R5bGUgPSAncmdiYSgxNTAsIDE1MCwgMTYwLCAwLjgpJztcbiAgICB0aGlzLmN0eC5saW5lV2lkdGggPSAxO1xuICAgIFxuICAgIHRoaXMucm91bmRSZWN0KHRvb2x0aXBYLCB0b29sdGlwWSwgdG9vbHRpcFdpZHRoLCB0b29sdGlwSGVpZ2h0LCA1KTtcbiAgICB0aGlzLmN0eC5maWxsKCk7XG4gICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgXG4gICAgLy8gRHJhdyB0b29sdGlwIGNvbnRlbnRcbiAgICB0aGlzLmN0eC50ZXh0QWxpZ24gPSAnbGVmdCc7XG4gICAgXG4gICAgLy8gRHJhdyBlYWNoIHNlY3Rpb25cbiAgICBsZXQgY3VycmVudFkgPSB0b29sdGlwWSArIDE0O1xuICAgIHNlY3Rpb25zLmZvckVhY2goc2VjdGlvbiA9PiB7XG4gICAgICBpZiAoIXNlY3Rpb24uYWx3YXlzU2hvdyAmJiAoc2VjdGlvbi5za2lwSWZFbXB0eSAmJiAhc2VjdGlvbi50ZXh0KSkgcmV0dXJuO1xuICAgICAgXG4gICAgICB0aGlzLmN0eC5mb250ID0gc2VjdGlvbi5mb250IHx8ICcxMnB4IHNhbnMtc2VyaWYnO1xuICAgICAgXG4gICAgICAvLyBVc2UgZGlmZmVyZW50IHRleHQgY29sb3JzIGZvciBkaWZmZXJlbnQgc2VjdGlvbnNcbiAgICAgIGlmIChzZWN0aW9uLmxhYmVsID09PSAnVGl0bGUnKSB7XG4gICAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICcjMzMzMzMzJzsgLy8gRGFyayBncmF5IGZvciB0aXRsZVxuICAgICAgfSBlbHNlIGlmIChzZWN0aW9uLmxhYmVsID09PSAnUHJldmlldycpIHtcbiAgICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJyM2NjY2NjYnOyAvLyBNZWRpdW0gZ3JheSBmb3IgcHJldmlld1xuICAgICAgfSBlbHNlIGlmIChzZWN0aW9uLmxhYmVsID09PSAnJykge1xuICAgICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAnIzk5OTk5OSc7IC8vIExpZ2h0IGdyYXkgZm9yIG5vdGVzXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAnIzQ0NDQ0NCc7IC8vIE5vcm1hbCB0ZXh0IGNvbG9yXG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHRleHQgPSBzZWN0aW9uLmxhYmVsICYmIHNlY3Rpb24ubGFiZWwgIT09ICdUaXRsZSdcbiAgICAgICAgPyBgJHtzZWN0aW9uLmxhYmVsfTogJHtzZWN0aW9uLnRleHR9YFxuICAgICAgICA6IHNlY3Rpb24udGV4dDtcbiAgICAgIFxuICAgICAgLy8gRm9yIGxvbmdlciB0ZXh0LCBoYW5kbGUgd3JhcHBpbmdcbiAgICAgIGlmICh0aGlzLmN0eC5tZWFzdXJlVGV4dCh0ZXh0KS53aWR0aCA+IHRvb2x0aXBXaWR0aCAtIDIwKSB7XG4gICAgICAgIGNvbnN0IHdvcmRzID0gdGV4dC5zcGxpdCgnICcpO1xuICAgICAgICBsZXQgbGluZSA9ICcnO1xuICAgICAgICBcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3b3Jkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGNvbnN0IHRlc3RMaW5lID0gbGluZSArIHdvcmRzW2ldICsgJyAnO1xuICAgICAgICAgIGNvbnN0IG1ldHJpY3MgPSB0aGlzLmN0eC5tZWFzdXJlVGV4dCh0ZXN0TGluZSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKG1ldHJpY3Mud2lkdGggPiB0b29sdGlwV2lkdGggLSAyMCAmJiBpID4gMCkge1xuICAgICAgICAgICAgdGhpcy5jdHguZmlsbFRleHQobGluZSwgdG9vbHRpcFggKyAxMCwgY3VycmVudFkpO1xuICAgICAgICAgICAgbGluZSA9IHdvcmRzW2ldICsgJyAnO1xuICAgICAgICAgICAgY3VycmVudFkgKz0gbGluZUhlaWdodCAqIDAuODsgLy8gU21hbGxlciBzcGFjaW5nIGZvciB3cmFwcGVkIHRleHRcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGluZSA9IHRlc3RMaW5lO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdGhpcy5jdHguZmlsbFRleHQobGluZSwgdG9vbHRpcFggKyAxMCwgY3VycmVudFkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jdHguZmlsbFRleHQodGV4dCwgdG9vbHRpcFggKyAxMCwgY3VycmVudFkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjdXJyZW50WSArPSBsaW5lSGVpZ2h0O1xuICAgIH0pO1xuICB9XG59XG5cbmNsYXNzIFNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgcGx1Z2luOiBWaWJlQm95UGx1Z2luO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IFZpYmVCb3lQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHtjb250YWluZXJFbH0gPSB0aGlzO1xuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDInLCB7dGV4dDogJ1ZpYmUgQm9pIC0gdC1TTkUgU2V0dGluZ3MnfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdQZXJwbGV4aXR5JylcbiAgICAgIC5zZXREZXNjKCdDb250cm9scyB0aGUgYmFsYW5jZSBiZXR3ZWVuIGxvY2FsIGFuZCBnbG9iYWwgYXNwZWN0cyBvZiB0aGUgZGF0YSAocmVjb21tZW5kZWQ6IDUtNTApJylcbiAgICAgIC5hZGRTbGlkZXIoc2xpZGVyID0+IHNsaWRlclxuICAgICAgICAuc2V0TGltaXRzKDUsIDEwMCwgNSlcbiAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnBlcnBsZXhpdHkpXG4gICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wZXJwbGV4aXR5ID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0l0ZXJhdGlvbnMnKVxuICAgICAgLnNldERlc2MoJ051bWJlciBvZiBpdGVyYXRpb25zIHRvIHJ1biB0aGUgYWxnb3JpdGhtJylcbiAgICAgIC5hZGRTbGlkZXIoc2xpZGVyID0+IHNsaWRlclxuICAgICAgICAuc2V0TGltaXRzKDI1MCwgMjAwMCwgMjUwKVxuICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuaXRlcmF0aW9ucylcbiAgICAgICAgLnNldER5bmFtaWNUb29sdGlwKClcbiAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLml0ZXJhdGlvbnMgPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkpO1xuICAgICAgICBcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdFcHNpbG9uIChsZWFybmluZyByYXRlKScpXG4gICAgICAuc2V0RGVzYygnQ29udHJvbHMgdGhlIHNwZWVkIG9mIG9wdGltaXphdGlvbicpXG4gICAgICAuYWRkU2xpZGVyKHNsaWRlciA9PiBzbGlkZXJcbiAgICAgICAgLnNldExpbWl0cygxLCAxMDAsIDEpXG4gICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5lcHNpbG9uKVxuICAgICAgICAuc2V0RHluYW1pY1Rvb2x0aXAoKVxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZXBzaWxvbiA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KSk7XG4gIH1cbn0iXSwibmFtZXMiOlsiTW9kYWwiLCJCdXR0b25Db21wb25lbnQiLCJUZXh0QXJlYUNvbXBvbmVudCIsIlRGaWxlIiwiTm90aWNlIiwiSXRlbVZpZXciLCJQbHVnaW4iLCJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFvR0E7QUFDTyxTQUFTLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUU7QUFDN0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEtBQUssWUFBWSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsT0FBTyxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFDaEgsSUFBSSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsRUFBRSxVQUFVLE9BQU8sRUFBRSxNQUFNLEVBQUU7QUFDL0QsUUFBUSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ25HLFFBQVEsU0FBUyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ3RHLFFBQVEsU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsTUFBTSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyxFQUFFO0FBQ3RILFFBQVEsSUFBSSxDQUFDLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLFVBQVUsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzlFLEtBQUssQ0FBQyxDQUFDO0FBQ1AsQ0FBQztBQTZNRDtBQUN1QixPQUFPLGVBQWUsS0FBSyxVQUFVLEdBQUcsZUFBZSxHQUFHLFVBQVUsS0FBSyxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUU7QUFDdkgsSUFBSSxJQUFJLENBQUMsR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUMvQixJQUFJLE9BQU8sQ0FBQyxDQUFDLElBQUksR0FBRyxpQkFBaUIsRUFBRSxDQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssRUFBRSxDQUFDLENBQUMsVUFBVSxHQUFHLFVBQVUsRUFBRSxDQUFDLENBQUM7QUFDckY7O0FDN1RBO0FBQ0EsTUFBTSxtQkFBb0IsU0FBUUEsY0FBSyxDQUFBO0FBTXJDLElBQUEsV0FBQSxDQUFZLEdBQVEsRUFBRSxXQUE2QixFQUFFLE1BQXFCLEVBQUE7UUFDeEUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBSkwsSUFBdUIsQ0FBQSx1QkFBQSxHQUFXLENBQUMsQ0FBQztRQUNwQyxJQUFvQixDQUFBLG9CQUFBLEdBQVksS0FBSyxDQUFDO0FBSTVDLFFBQUEsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7QUFDL0IsUUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztLQUN0QjtJQUVLLE1BQU0sR0FBQTs7QUFDVixZQUFBLE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUM7O1lBRzNCLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLDRCQUE0QixFQUFFLENBQUMsQ0FBQztBQUNqRSxZQUFBLFNBQVMsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFO0FBQ3RCLGdCQUFBLElBQUksRUFBRSw2RUFBNkU7b0JBQzdFLG9GQUFvRjtBQUMzRixhQUFBLENBQUMsQ0FBQzs7QUFHSCxZQUFBLE1BQU0sb0JBQW9CLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsRUFBRSx1QkFBdUIsRUFBRSxDQUFDLENBQUM7O0FBR25GLFlBQUEsTUFBTSxnQkFBZ0IsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxFQUFFLG9CQUFvQixFQUFFLENBQUMsQ0FBQzs7WUFHNUUsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUM5QyxLQUFLLENBQUMsV0FBVyxHQUFHLENBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztLQTZDbkIsQ0FBQztBQUNGLFlBQUEsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7O0FBR2pDLFlBQUEsSUFBSSxDQUFDLHFCQUFxQixDQUFDLG9CQUFvQixDQUFDLENBQUM7O0FBR2pELFlBQUEsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFHcEUsWUFBQSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDMUIsQ0FBQSxDQUFBO0FBQUEsS0FBQTtBQUVPLElBQUEscUJBQXFCLENBQUMsU0FBc0IsRUFBQTtRQUNsRCxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFbEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLEVBQUUsS0FBSyxLQUFJO0FBQzdDLFlBQUEsTUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7QUFDN0QsWUFBQSxJQUFJLEtBQUssS0FBSyxJQUFJLENBQUMsdUJBQXVCLEVBQUU7QUFDMUMsZ0JBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUMzQixhQUFBO0FBRUQsWUFBQSxNQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQztBQUNoRCxZQUFBLE1BQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDO1lBQ2hELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBRXJELFlBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBRyxFQUFBLFdBQVcsTUFBTSxXQUFXLENBQUEsRUFBQSxFQUFLLFVBQVUsQ0FBZSxhQUFBLENBQUEsRUFBRSxDQUFDLENBQUM7QUFFOUYsWUFBQSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLE1BQUs7QUFDbEMsZ0JBQUEsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQy9CLGFBQUMsQ0FBQyxDQUFDO0FBQ0wsU0FBQyxDQUFDLENBQUM7S0FDSjtJQUVPLHVCQUF1QixDQUFDLFNBQXNCLEVBQUUsVUFBMEIsRUFBQTtRQUNoRixTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7QUFFbEIsUUFBQSxNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDO0FBQ3pDLFFBQUEsTUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQzs7QUFHekMsUUFBQSxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxDQUFBLFlBQUEsRUFBZSxVQUFVLENBQUMsS0FBSyxNQUFNLFVBQVUsQ0FBQyxLQUFLLENBQUUsQ0FBQSxFQUFFLENBQUMsQ0FBQztBQUM1RixRQUFBLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUEsUUFBQSxFQUFXLFVBQVUsQ0FBQyxJQUFJLENBQUUsQ0FBQSxFQUFFLENBQUMsQ0FBQztBQUNsRSxRQUFBLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUEsUUFBQSxFQUFXLFVBQVUsQ0FBQyxJQUFJLENBQUUsQ0FBQSxFQUFFLENBQUMsQ0FBQzs7QUFHbEUsUUFBQSxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxFQUFFLGtCQUFrQixFQUFFLENBQUMsQ0FBQztRQUNsRSxRQUFRLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxDQUFlLFlBQUEsRUFBQSxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBRyxDQUFBLENBQUEsRUFBRSxDQUFDLENBQUM7UUFDeEYsUUFBUSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQSxFQUFHLFVBQVUsQ0FBQyxTQUFTLElBQUksR0FBRyxDQUFZLFNBQUEsRUFBQSxVQUFVLENBQUMsU0FBUyxJQUFJLEdBQUcsQ0FBQSxNQUFBLENBQVEsRUFBRSxDQUFDLENBQUM7O0FBR2xILFFBQUEsSUFBSSxVQUFVLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDckMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBaUIsY0FBQSxFQUFBLFVBQVUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFFLENBQUEsRUFBRSxDQUFDLENBQUM7QUFDM0YsU0FBQTs7QUFHRCxRQUFBLElBQUksVUFBVSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ3RDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQWtCLGVBQUEsRUFBQSxVQUFVLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBRSxDQUFBLEVBQUUsQ0FBQyxDQUFDO0FBQzdGLFNBQUE7O0FBR0QsUUFBQSxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxDQUFBLG1CQUFBLEVBQXNCLFVBQVUsQ0FBQyxNQUFNLENBQUUsQ0FBQSxFQUFFLENBQUMsQ0FBQzs7QUFHL0UsUUFBQSxNQUFNLGNBQWMsR0FBRyxJQUFJQyx3QkFBZSxDQUFDLFNBQVMsQ0FBQzthQUNsRCxhQUFhLENBQUMsaUNBQWlDLENBQUM7YUFDaEQsTUFBTSxFQUFFO2FBQ1IsT0FBTyxDQUFDLE1BQVcsU0FBQSxDQUFBLElBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxhQUFBO0FBQ2xCLFlBQUEsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDL0MsQ0FBQSxDQUFDLENBQUM7O0FBR0wsUUFBQSxjQUFjLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRXBELElBQUksSUFBSSxDQUFDLG9CQUFvQixFQUFFO0FBQzdCLFlBQUEsY0FBYyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNqQyxZQUFBLGNBQWMsQ0FBQyxhQUFhLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDL0MsU0FBQTs7UUFHRCxJQUFJLFVBQVUsQ0FBQyxjQUFjLEVBQUU7QUFDN0IsWUFBQSxNQUFNLG9CQUFvQixHQUFHLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNuRCxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLHlCQUF5QixFQUFFLENBQUMsQ0FBQztBQUV6RSxZQUFBLE1BQU0sUUFBUSxHQUFHLElBQUlDLDBCQUFpQixDQUFDLG9CQUFvQixDQUFDO0FBQ3pELGlCQUFBLFFBQVEsQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDO2lCQUNuQyxjQUFjLENBQUMsNENBQTRDLENBQUMsQ0FBQztBQUVoRSxZQUFBLFFBQVEsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLENBQUM7O0FBRzdDLFlBQUEsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxrQkFBa0IsRUFBRSxDQUFDLENBQUM7WUFFekUsSUFBSUQsd0JBQWUsQ0FBQyxlQUFlLENBQUM7aUJBQ2pDLGFBQWEsQ0FBQyxhQUFhLENBQUM7aUJBQzVCLE1BQU0sRUFBRTtpQkFDUixPQUFPLENBQUMsTUFBVyxTQUFBLENBQUEsSUFBQSxFQUFBLEtBQUEsQ0FBQSxFQUFBLEtBQUEsQ0FBQSxFQUFBLGFBQUE7Z0JBQ2xCLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO2FBQ2xELENBQUEsQ0FBQyxDQUFDO1lBRUwsSUFBSUEsd0JBQWUsQ0FBQyxlQUFlLENBQUM7aUJBQ2pDLGFBQWEsQ0FBQyxrQkFBa0IsQ0FBQztpQkFDakMsT0FBTyxDQUFDLE1BQUs7QUFDWixnQkFBQSxRQUFRLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzVCLGdCQUFBLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDM0IsYUFBQyxDQUFDLENBQUM7QUFDTixTQUFBO0tBQ0Y7QUFFTyxJQUFBLGdCQUFnQixDQUFDLEtBQWEsRUFBQTtRQUNwQyxJQUFJLEtBQUssR0FBRyxDQUFDLElBQUksS0FBSyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTTtZQUFFLE9BQU87QUFFMUQsUUFBQSxJQUFJLENBQUMsdUJBQXVCLEdBQUcsS0FBSyxDQUFDO1FBQ3JDLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQWdCLENBQUM7UUFDbEcsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxxQkFBcUIsQ0FBZ0IsQ0FBQztRQUU1RixJQUFJLG1CQUFtQixJQUFJLGdCQUFnQixFQUFFO0FBQzNDLFlBQUEsSUFBSSxDQUFDLHFCQUFxQixDQUFDLG1CQUFtQixDQUFDLENBQUM7QUFDaEQsWUFBQSxJQUFJLENBQUMsdUJBQXVCLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3pFLFNBQUE7S0FDRjtBQUVhLElBQUEsc0JBQXNCLENBQUMsVUFBMEIsRUFBQTs7WUFDN0QsSUFBSSxJQUFJLENBQUMsb0JBQW9CO2dCQUFFLE9BQU87QUFFdEMsWUFBQSxJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxDQUFDO1lBQ2pDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMscUJBQXFCLENBQWdCLENBQUM7QUFDNUYsWUFBQSxJQUFJLENBQUMsdUJBQXVCLENBQUMsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFFM0QsSUFBSTs7QUFFRixnQkFBQSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3BGLGdCQUFBLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLHFCQUFxQixDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7QUFFcEYsZ0JBQUEsSUFBSSxFQUFFLFVBQVUsWUFBWUUsY0FBSyxDQUFDLElBQUksRUFBRSxVQUFVLFlBQVlBLGNBQUssQ0FBQyxFQUFFO0FBQ3BFLG9CQUFBLE1BQU0sSUFBSSxLQUFLLENBQUMsMkJBQTJCLENBQUMsQ0FBQztBQUM5QyxpQkFBQTtBQUVELGdCQUFBLE1BQU0sYUFBYSxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQzVELGdCQUFBLE1BQU0sYUFBYSxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDOztBQUc1RCxnQkFBQSxNQUFNLElBQUksR0FBRztBQUNYLG9CQUFBLFVBQVUsRUFBRTtBQUNWLHdCQUFBLEtBQUssRUFBRSxVQUFVLENBQUMsVUFBVSxDQUFDLEtBQUs7d0JBQ2xDLE9BQU8sRUFBRSxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUM7QUFDekMsd0JBQUEsUUFBUSxFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsU0FBUztBQUMxQyxxQkFBQTtBQUNELG9CQUFBLFVBQVUsRUFBRTtBQUNWLHdCQUFBLEtBQUssRUFBRSxVQUFVLENBQUMsVUFBVSxDQUFDLEtBQUs7d0JBQ2xDLE9BQU8sRUFBRSxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUM7QUFDekMsd0JBQUEsUUFBUSxFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsU0FBUztBQUMxQyxxQkFBQTtvQkFDRCxXQUFXLEVBQUUsVUFBVSxDQUFDLFdBQVc7b0JBQ25DLFlBQVksRUFBRSxVQUFVLENBQUMsWUFBWTtvQkFDckMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxNQUFNO2lCQUMxQixDQUFDOztnQkFHRixNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7O0FBR3BELGdCQUFBLFVBQVUsQ0FBQyxjQUFjLEdBQUcsV0FBVyxDQUFDOztBQUd4QyxnQkFBQSxJQUFJLENBQUMsb0JBQW9CLEdBQUcsS0FBSyxDQUFDO2dCQUNsQyxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLHFCQUFxQixDQUFnQixDQUFDO0FBQzVGLGdCQUFBLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxnQkFBZ0IsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUU1RCxhQUFBO0FBQUMsWUFBQSxPQUFPLEtBQUssRUFBRTtBQUNkLGdCQUFBLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxLQUFLLENBQUM7QUFDbEMsZ0JBQUEsT0FBTyxDQUFDLEtBQUssQ0FBQywrQkFBK0IsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDdEQsSUFBSUMsZUFBTSxDQUFDLENBQW1DLGdDQUFBLEVBQUEsS0FBSyxDQUFDLE9BQU8sQ0FBQSxDQUFFLENBQUMsQ0FBQzs7Z0JBRy9ELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMscUJBQXFCLENBQWdCLENBQUM7QUFDNUYsZ0JBQUEsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQzVELGFBQUE7U0FDRixDQUFBLENBQUE7QUFBQSxLQUFBO0FBRWEsSUFBQSxjQUFjLENBQUMsSUFBUyxFQUFBOztZQUNwQyxJQUFJOztBQUVGLGdCQUFBLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDO0FBQzFDLGdCQUFBLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDO0FBQzFDLGdCQUFBLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDO0FBQzlDLGdCQUFBLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDO2dCQUM5QyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDaEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7O0FBR2xELGdCQUFBLE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLDJDQUEyQyxFQUFFO0FBQ3hFLG9CQUFBLE1BQU0sRUFBRSxNQUFNO0FBQ2Qsb0JBQUEsT0FBTyxFQUFFO0FBQ1Asd0JBQUEsY0FBYyxFQUFFLGtCQUFrQjtBQUNuQyxxQkFBQTtBQUNELG9CQUFBLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO0FBQ25CLHdCQUFBLFdBQVcsRUFBRTtBQUNYLDRCQUFBLEtBQUssRUFBRSxXQUFXO0FBQ2xCLDRCQUFBLE9BQU8sRUFBRSxhQUFhO0FBQ3RCLDRCQUFBLEtBQUssRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVE7QUFDaEMseUJBQUE7QUFDRCx3QkFBQSxXQUFXLEVBQUU7QUFDWCw0QkFBQSxLQUFLLEVBQUUsV0FBVztBQUNsQiw0QkFBQSxPQUFPLEVBQUUsYUFBYTtBQUN0Qiw0QkFBQSxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRO0FBQ2hDLHlCQUFBO3dCQUNELFlBQVksRUFBRSxJQUFJLENBQUMsV0FBVzt3QkFDOUIsYUFBYSxFQUFFLElBQUksQ0FBQyxZQUFZO3FCQUNqQyxDQUFDO0FBQ0gsaUJBQUEsQ0FBQyxDQUFDO2dCQUVILElBQUksUUFBUSxDQUFDLEVBQUUsRUFBRTtBQUNmLG9CQUFBLE1BQU0sTUFBTSxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUNyQyxJQUFJLE1BQU0sQ0FBQyxXQUFXLEVBQUU7d0JBQ3RCLE9BQU8sTUFBTSxDQUFDLFdBQVcsQ0FBQztBQUMzQixxQkFBQTtBQUNGLGlCQUFBOztBQUdELGdCQUFBLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0RBQWtELENBQUMsQ0FBQzs7Z0JBR2hFLElBQUksV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUVyQixnQkFBQSxJQUFJLFdBQVcsRUFBRTtBQUNmLG9CQUFBLFdBQVcsSUFBSSxDQUFBLDRDQUFBLEVBQStDLFdBQVcsQ0FBQSxFQUFBLENBQUksQ0FBQztBQUMvRSxpQkFBQTtBQUFNLHFCQUFBO29CQUNMLFdBQVcsSUFBSSxpREFBaUQsQ0FBQztBQUNsRSxpQkFBQTtBQUVELGdCQUFBLFdBQVcsSUFBSSxDQUFhLFVBQUEsRUFBQSxXQUFXLENBQWtFLCtEQUFBLEVBQUEsV0FBVyxHQUFHLENBQUM7QUFFeEgsZ0JBQUEsSUFBSSxZQUFZLEVBQUU7QUFDaEIsb0JBQUEsV0FBVyxJQUFJLENBQUEseUJBQUEsRUFBNEIsWUFBWSxDQUFBLENBQUEsQ0FBRyxDQUFDO0FBQzVELGlCQUFBO0FBQU0scUJBQUE7b0JBQ0wsV0FBVyxJQUFJLEdBQUcsQ0FBQztBQUNwQixpQkFBQTtBQUVELGdCQUFBLE9BQU8sV0FBVyxDQUFDO0FBQ3BCLGFBQUE7QUFBQyxZQUFBLE9BQU8sS0FBSyxFQUFFO0FBQ2QsZ0JBQUEsT0FBTyxDQUFDLEtBQUssQ0FBQyw0QkFBNEIsRUFBRSxLQUFLLENBQUMsQ0FBQzs7QUFHbkQsZ0JBQUEsT0FBTyxDQUFnRSw2REFBQSxFQUFBLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFrQixlQUFBLEVBQUEsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLHlDQUF5QyxDQUFDO0FBQzlLLGFBQUE7U0FDRixDQUFBLENBQUE7QUFBQSxLQUFBO0lBRWEsVUFBVSxDQUFDLFVBQTBCLEVBQUUsV0FBbUIsRUFBQTs7WUFDdEUsSUFBSSxDQUFDLFdBQVcsSUFBSSxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUNuRCxnQkFBQSxJQUFJQSxlQUFNLENBQUMsNkRBQTZELENBQUMsQ0FBQztnQkFDMUUsT0FBTztBQUNSLGFBQUE7O1lBR0QsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDOztZQUdiLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQzlDLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUMxQixVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksRUFDMUIsV0FBVyxDQUNaLENBQUM7QUFFRixZQUFBLElBQUksT0FBTyxFQUFFOztnQkFFWCxVQUFVLENBQUMsTUFBSztvQkFDZCxJQUFJOztBQUVGLHdCQUFBLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLHFCQUFxQixDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ3BGLElBQUksVUFBVSxZQUFZRCxjQUFLLEVBQUU7OzRCQUUvQixNQUFNLEtBQUssR0FBRyxJQUFJSCxjQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDLDRCQUFBLE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxLQUFLLENBQUM7OzRCQUc1QixNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDOzRCQUM5QyxLQUFLLENBQUMsV0FBVyxHQUFHLENBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzthQTJCbkIsQ0FBQztBQUNGLDRCQUFBLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDOztBQUdqQyw0QkFBQSxNQUFNLFNBQVMsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsR0FBRyxFQUFFLGVBQWUsRUFBRSxDQUFDLENBQUM7O0FBR2hFLDRCQUFBLFNBQVMsQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBRXpELDRCQUFBLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFO0FBQ3ZCLGdDQUFBLElBQUksRUFBRSxDQUE0QiwwQkFBQSxDQUFBO0FBQ2xDLGdDQUFBLEdBQUcsRUFBRSxlQUFlO0FBQ3JCLDZCQUFBLENBQUMsQ0FBQztBQUVILDRCQUFBLFNBQVMsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFO0FBQ3RCLGdDQUFBLElBQUksRUFBRSxDQUFBLFdBQUEsRUFBYyxVQUFVLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQSxxQkFBQSxFQUF3QixVQUFVLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBSSxFQUFBLENBQUE7QUFDdEcsZ0NBQUEsR0FBRyxFQUFFLFdBQVc7QUFDakIsNkJBQUEsQ0FBQyxDQUFDO0FBRUgsNEJBQUEsU0FBUyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUU7QUFDdEIsZ0NBQUEsSUFBSSxFQUFFLENBQTJCLHdCQUFBLEVBQUEsVUFBVSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQVksVUFBQSxDQUFBO0FBQ3hFLGdDQUFBLEdBQUcsRUFBRSx1QkFBdUI7QUFDN0IsNkJBQUEsQ0FBQyxDQUFDO0FBRUgsNEJBQUEsTUFBTSxlQUFlLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsRUFBRSx3QkFBd0IsRUFBRSxDQUFDLENBQUM7O0FBRy9FLDRCQUFBLE1BQU0sVUFBVSxHQUFHLElBQUlDLHdCQUFlLENBQUMsZUFBZSxDQUFDO2lDQUNwRCxhQUFhLENBQUMsU0FBUyxVQUFVLENBQUMsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDO0FBQ3RELGlDQUFBLE1BQU0sRUFBRTtpQ0FDUixPQUFPLENBQUMsTUFBSzs7Z0NBRVosTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsaUJBQWlCLENBQy9DLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFDN0IsVUFBVSxDQUNYLENBQUM7QUFFRixnQ0FBQSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dDQUMxQixLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDaEIsNkJBQUMsQ0FBQyxDQUFDOzs0QkFHTCxJQUFJQSx3QkFBZSxDQUFDLGVBQWUsQ0FBQztpQ0FDakMsYUFBYSxDQUFDLHNCQUFzQixDQUFDO2lDQUNyQyxPQUFPLENBQUMsTUFBSztnQ0FDWixLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDaEIsNkJBQUMsQ0FBQyxDQUFDOzRCQUVMLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUNkLHlCQUFBO0FBQ0YscUJBQUE7QUFBQyxvQkFBQSxPQUFPLEtBQUssRUFBRTtBQUNkLHdCQUFBLE9BQU8sQ0FBQyxLQUFLLENBQUMsNEJBQTRCLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDcEQscUJBQUE7aUJBQ0YsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNULGFBQUE7U0FDRixDQUFBLENBQUE7QUFBQSxLQUFBO0lBRUQsT0FBTyxHQUFBO0FBQ0wsUUFBQSxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQzNCLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztLQUNuQjtBQUNGLENBQUE7QUFFRDtBQUNBLE1BQU0sY0FBYyxHQUFHLG9CQUFvQixDQUFDO0FBUTVDLE1BQU0sZ0JBQWdCLEdBQW9CO0FBQ3hDLElBQUEsVUFBVSxFQUFFLEVBQUU7QUFDZCxJQUFBLFVBQVUsRUFBRSxJQUFJO0FBQ2hCLElBQUEsT0FBTyxFQUFFLEVBQUU7Q0FDWixDQUFBO0FBRUQ7QUFDQSxNQUFNLFFBQVMsU0FBUUksaUJBQVEsQ0FBQTtBQUM3QixJQUFBLFdBQUEsQ0FBWSxJQUFtQixFQUFBO1FBQzdCLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUNiO0lBRUQsV0FBVyxHQUFBO0FBQ1QsUUFBQSxPQUFPLGNBQWMsQ0FBQztLQUN2QjtJQUVELGNBQWMsR0FBQTtBQUNaLFFBQUEsT0FBTyxxQkFBcUIsQ0FBQztLQUM5QjtJQUVELE9BQU8sR0FBQTtBQUNMLFFBQUEsT0FBTyxPQUFPLENBQUM7S0FDaEI7O0FBR0QsSUFBQSxNQUFNLENBQUMsS0FBZ0IsRUFBQTs7S0FFdEI7O0lBR0QsVUFBVSxDQUFDLElBQVMsRUFBRSxNQUFjLEVBQUE7O0tBRW5DO0lBRUssTUFBTSxHQUFBOztBQUNWLFlBQUEsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUNqQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7O0FBR2xCLFlBQUEsU0FBUyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxHQUFHLEVBQUUsYUFBYSxFQUFFLEVBQUUsQ0FBQyxNQUFNLEtBQUk7Z0JBQzNELE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLDBCQUEwQixFQUFFLENBQUMsQ0FBQzs7QUFHNUQsZ0JBQUEsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxHQUFHLEVBQUUsY0FBYyxFQUFFLENBQUMsQ0FBQztBQUVsRSxnQkFBQSxNQUFNLFNBQVMsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7QUFDekYsZ0JBQUEsU0FBUyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxNQUFLOztBQUV2QyxvQkFBQSxNQUFNLE1BQU0sR0FBSSxJQUFJLENBQUMsR0FBVyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFrQixDQUFDO29CQUM5RSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDbkIsaUJBQUMsQ0FBQyxDQUFDO0FBRUgsZ0JBQUEsTUFBTSxrQkFBa0IsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7QUFDbkcsZ0JBQUEsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLE1BQUs7O0FBRWhELG9CQUFBLE1BQU0sTUFBTSxHQUFJLElBQUksQ0FBQyxHQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQWtCLENBQUM7b0JBQzlFLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztBQUN4QixpQkFBQyxDQUFDLENBQUM7QUFFSCxnQkFBQSxNQUFNLGtCQUFrQixHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBRSxDQUFDLENBQUM7QUFDbkYsZ0JBQUEsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLE1BQUs7O0FBRWhELG9CQUFBLElBQUlELGVBQU0sQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO0FBQ3JELGlCQUFDLENBQUMsQ0FBQztBQUNMLGFBQUMsQ0FBQyxDQUFDOztBQUdILFlBQUEsU0FBUyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUU7QUFDdEIsZ0JBQUEsSUFBSSxFQUFFLHFGQUFxRjtBQUMzRixnQkFBQSxHQUFHLEVBQUUsV0FBVztBQUNqQixhQUFBLENBQUMsQ0FBQzs7QUFHSCxZQUFBLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFO0FBQ3hCLGdCQUFBLEdBQUcsRUFBRSxnQkFBZ0I7QUFDckIsZ0JBQUEsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLGdCQUFnQixFQUFFO0FBQy9CLGFBQUEsQ0FBQyxDQUFDOztBQUdILFlBQUEsU0FBUyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUU7QUFDeEIsZ0JBQUEsR0FBRyxFQUFFLGFBQWE7QUFDbEIsZ0JBQUEsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRTthQUM1QixFQUFFLENBQUMsTUFBTSxLQUFJO0FBQ1osZ0JBQUEsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUU7QUFDbkIsb0JBQUEsSUFBSSxFQUFFLCtEQUErRDtBQUNyRSxvQkFBQSxHQUFHLEVBQUUsa0JBQWtCO0FBQ3hCLGlCQUFBLENBQUMsQ0FBQztBQUNMLGFBQUMsQ0FBQyxDQUFDOztZQUdILE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDOUMsS0FBSyxDQUFDLFdBQVcsR0FBRyxDQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztLQWdDbkIsQ0FBQztBQUNGLFlBQUEsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDbEMsQ0FBQSxDQUFBO0FBQUEsS0FBQTtBQUNGLENBQUE7QUFFb0IsTUFBQSxhQUFjLFNBQVFFLGVBQU0sQ0FBQTtBQUFqRCxJQUFBLFdBQUEsR0FBQTs7O1FBd1FVLElBQVUsQ0FBQSxVQUFBLEdBQVEsSUFBSSxDQUFDO0tBOEpoQztJQW5hTyxNQUFNLEdBQUE7O0FBQ1YsWUFBQSxNQUFNLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQzs7QUFHMUIsWUFBQSxJQUFJLENBQUMsWUFBWSxDQUNmLGNBQWMsRUFDZCxDQUFDLElBQUksS0FBSyxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FDN0IsQ0FBQzs7WUFHRixJQUFJLENBQUMsVUFBVSxDQUFDO0FBQ2QsZ0JBQUEsRUFBRSxFQUFFLHlCQUF5QjtBQUM3QixnQkFBQSxJQUFJLEVBQUUsMEJBQTBCO2dCQUNoQyxRQUFRLEVBQUUsTUFBSztvQkFDYixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7aUJBQ3JCO0FBQ0YsYUFBQSxDQUFDLENBQUM7O1lBR0gsSUFBSSxDQUFDLFVBQVUsQ0FBQztBQUNkLGdCQUFBLEVBQUUsRUFBRSxtQkFBbUI7QUFDdkIsZ0JBQUEsSUFBSSxFQUFFLG9CQUFvQjtnQkFDMUIsUUFBUSxFQUFFLE1BQUs7b0JBQ2IsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2lCQUNoQjtBQUNGLGFBQUEsQ0FBQyxDQUFDOztBQUdILFlBQUEsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDcEQsQ0FBQSxDQUFBO0FBQUEsS0FBQTtJQUVELFFBQVEsR0FBQTs7S0FFUDtJQUVLLFlBQVksR0FBQTs7QUFDaEIsWUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLGdCQUFnQixFQUFFLE1BQU0sSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7U0FDNUUsQ0FBQSxDQUFBO0FBQUEsS0FBQTtJQUVLLFlBQVksR0FBQTs7WUFDaEIsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUNwQyxDQUFBLENBQUE7QUFBQSxLQUFBO0lBRUssWUFBWSxHQUFBOztBQUNoQixZQUFBLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUNwRSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEVBQUU7QUFDbkIsZ0JBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMzQyxPQUFPO0FBQ1IsYUFBQTtBQUVELFlBQUEsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzlDLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQztBQUN0QixnQkFBQSxJQUFJLEVBQUUsY0FBYztBQUNwQixnQkFBQSxNQUFNLEVBQUUsSUFBSTtBQUNiLGFBQUEsQ0FBQyxDQUFDO1NBQ0osQ0FBQSxDQUFBO0FBQUEsS0FBQTtJQUVLLE9BQU8sR0FBQTs7O0FBRVgsWUFBQSxJQUFJRixlQUFNLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUN6QyxZQUFBLElBQUksQ0FBQyxZQUFZLENBQUMsb0JBQW9CLENBQUMsQ0FBQzs7WUFHeEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUVoRCxJQUFJOztnQkFFRixNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUM7Z0JBQ3JCLE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUUvQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUEsV0FBQSxFQUFjLGFBQWEsQ0FBQyxNQUFNLENBQVcsU0FBQSxDQUFBLENBQUMsQ0FBQzs7QUFHakUsZ0JBQUEsTUFBTSxLQUFLLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUM3QixhQUFhLENBQUMsR0FBRyxDQUFDLENBQU8sSUFBSSxLQUFJLFNBQUEsQ0FBQSxJQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsYUFBQTtBQUMvQixvQkFBQSxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoRCxvQkFBQSxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUMxRCxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUM5QyxvQkFBQSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxHQUFHLENBQUMsQ0FBQzs7b0JBRy9DLE1BQU0sUUFBUSxHQUFHLG9CQUFvQixDQUFDO29CQUN0QyxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBR3BFLG9CQUFBLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDO0FBQ2xFLHlCQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsR0FBRyxHQUFHLEtBQUssR0FBRyxFQUFFLENBQUMsQ0FBQztvQkFFdEMsT0FBTzt3QkFDTCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7d0JBQ2YsS0FBSyxFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ3BCLHdCQUFBLE9BQU8sRUFBRSxPQUFPO3dCQUNoQixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7d0JBQ2pCLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSztBQUNqQix3QkFBQSxTQUFTLEVBQUUsU0FBUztBQUNwQix3QkFBQSxXQUFXLEVBQUUsV0FBVztBQUN4Qix3QkFBQSxJQUFJLEVBQUUsSUFBSTtBQUNWLHdCQUFBLGNBQWMsRUFBRSxjQUFjO3FCQUMvQixDQUFDO2lCQUNILENBQUEsQ0FBQyxDQUNILENBQUM7QUFFRixnQkFBQSxJQUFJLENBQUMsWUFBWSxDQUFDLGlDQUFpQyxDQUFDLENBQUM7O2dCQUdyRCxJQUFJO0FBQ0Ysb0JBQUEsTUFBTSxXQUFXLEdBQUcsTUFBTSxLQUFLLENBQUMsOEJBQThCLEVBQUU7QUFDOUQsd0JBQUEsTUFBTSxFQUFFLEtBQUs7QUFDYix3QkFBQSxPQUFPLEVBQUUsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUU7QUFDaEQscUJBQUEsQ0FBQyxDQUFDO0FBRUgsb0JBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLEVBQUU7QUFDbkIsd0JBQUEsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0FBQ3BELHFCQUFBO0FBQ0YsaUJBQUE7QUFBQyxnQkFBQSxPQUFPLEtBQUssRUFBRTtvQkFDZCxNQUFNLElBQUksS0FBSyxDQUNiLDZGQUE2RjtBQUM3Rix3QkFBQSxxREFBcUQsQ0FDdEQsQ0FBQztBQUNILGlCQUFBOztBQUdELGdCQUFBLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBMEMsdUNBQUEsRUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQSxhQUFBLEVBQWdCLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFBLEdBQUEsQ0FBSyxDQUFDLENBQUM7QUFDbkksZ0JBQUEsTUFBTSxRQUFRLEdBQUcsTUFBTSxLQUFLLENBQUMsK0JBQStCLEVBQUU7QUFDNUQsb0JBQUEsTUFBTSxFQUFFLE1BQU07QUFDZCxvQkFBQSxPQUFPLEVBQUU7QUFDUCx3QkFBQSxjQUFjLEVBQUUsa0JBQWtCO0FBQ25DLHFCQUFBO0FBQ0Qsb0JBQUEsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7QUFDbkIsd0JBQUEsS0FBSyxFQUFFLEtBQUs7QUFDWix3QkFBQSxRQUFRLEVBQUU7QUFDUiw0QkFBQSxVQUFVLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVO0FBQ3BDLDRCQUFBLFVBQVUsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVU7QUFDcEMsNEJBQUEsYUFBYSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTztBQUNyQyx5QkFBQTtxQkFDRixDQUFDO0FBQ0gsaUJBQUEsQ0FBQyxDQUFDO0FBRUgsZ0JBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUU7b0JBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQSw4QkFBQSxFQUFpQyxRQUFRLENBQUMsTUFBTSxDQUFFLENBQUEsQ0FBQyxDQUFDO0FBQ3JFLGlCQUFBO0FBRUQsZ0JBQUEsTUFBTSxNQUFNLEdBQUcsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBRXJDLElBQUksTUFBTSxDQUFDLEtBQUssRUFBRTtvQkFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFBLGNBQUEsRUFBaUIsTUFBTSxDQUFDLEtBQUssQ0FBRSxDQUFBLENBQUMsQ0FBQztBQUNsRCxpQkFBQTtBQUVELGdCQUFBLElBQUksQ0FBQyxZQUFZLENBQUMsd0JBQXdCLENBQUMsQ0FBQzs7QUFHNUMsZ0JBQUEsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsRUFBRSxNQUFNLENBQUMsQ0FBQzs7Z0JBRXpELElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7b0JBQzdDLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckMsb0JBQUEsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsRUFBRTtBQUNwQyx3QkFBQSxZQUFZLEVBQUUsV0FBVyxDQUFDLFNBQVMsS0FBSyxTQUFTO0FBQ2pELHdCQUFBLFFBQVEsRUFBRSxXQUFXLENBQUMsS0FBSyxLQUFLLFNBQVM7QUFDekMsd0JBQUEsUUFBUSxFQUFFLFdBQVcsQ0FBQyxLQUFLLEtBQUssU0FBUztBQUN6Qyx3QkFBQSxPQUFPLEVBQUUsV0FBVyxDQUFDLElBQUksS0FBSyxTQUFTO0FBQ3ZDLHdCQUFBLGlCQUFpQixFQUFFLFdBQVcsQ0FBQyxjQUFjLEtBQUssU0FBUztBQUMzRCx3QkFBQSxtQkFBbUIsRUFBRSxXQUFXLENBQUMsZ0JBQWdCLEtBQUssU0FBUztBQUNoRSxxQkFBQSxDQUFDLENBQUM7QUFDSixpQkFBQTs7QUFHRCxnQkFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQzs7QUFHekIsZ0JBQUEsSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFFN0IsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFzQyxtQ0FBQSxFQUFBLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFTLE9BQUEsQ0FBQSxDQUFDLENBQUM7QUFDdkYsZ0JBQUEsSUFBSUEsZUFBTSxDQUFDLDBCQUEwQixDQUFDLENBQUM7QUFDeEMsYUFBQTtBQUFDLFlBQUEsT0FBTyxLQUFLLEVBQUU7QUFDZCxnQkFBQSxPQUFPLENBQUMsS0FBSyxDQUFDLCtCQUErQixFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUN0RCxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUEsT0FBQSxFQUFVLEtBQUssQ0FBQyxPQUFPLENBQUUsQ0FBQSxDQUFDLENBQUM7Z0JBQzdDLElBQUlBLGVBQU0sQ0FBQyxDQUEwQix1QkFBQSxFQUFBLEtBQUssQ0FBQyxPQUFPLENBQUEsQ0FBRSxDQUFDLENBQUM7QUFDdkQsYUFBQTtTQUNGLENBQUEsQ0FBQTtBQUFBLEtBQUE7QUFFTyxJQUFBLFlBQVksQ0FBQyxPQUFlLEVBQUE7O1FBRWxDLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztBQUMvRSxRQUFBLElBQUksYUFBYSxFQUFFO0FBQ2pCLFlBQUEsYUFBYSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUM7QUFDckMsU0FBQTtBQUNELFFBQUEsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLE9BQU8sQ0FBQSxDQUFFLENBQUMsQ0FBQztLQUNuQztBQUVhLElBQUEsZUFBZSxDQUFDLE1BQVcsRUFBQTs7O0FBRXZDLFlBQUEsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pFLElBQUksQ0FBQyxJQUFJLEVBQUU7O0FBRVQsZ0JBQUEsTUFBTSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7O0FBRTFCLGdCQUFBLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRTdELElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDVCxvQkFBQSxPQUFPLENBQUMsS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7b0JBQ3JELE9BQU87QUFDUixpQkFBQTtBQUNGLGFBQUE7O0FBR0QsWUFBQSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBZ0IsQ0FBQztZQUNuQyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBZ0IsQ0FBQztZQUNqRixJQUFJLENBQUMsU0FBUyxFQUFFO0FBQ2QsZ0JBQUEsT0FBTyxDQUFDLEtBQUssQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO2dCQUM3QyxPQUFPO0FBQ1IsYUFBQTs7WUFHRCxPQUFPLFNBQVMsQ0FBQyxVQUFVLEVBQUU7QUFDM0IsZ0JBQUEsU0FBUyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDN0MsYUFBQTs7QUFHRCxZQUFBLE1BQU0sWUFBWSxHQUFHLENBQUMsSUFBWSxLQUFJOztBQUVwQyxnQkFBQSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDeEQsSUFBSSxJQUFJLFlBQVlELGNBQUssRUFBRTtBQUN6QixvQkFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDN0MsaUJBQUE7QUFDSCxhQUFDLENBQUM7O1lBR0YsTUFBTSxVQUFVLEdBQUcsSUFBSSxjQUFjLENBQUMsU0FBUyxFQUFFLFlBQVksQ0FBQyxDQUFDO0FBQy9ELFlBQUEsVUFBVSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUM1QixDQUFBLENBQUE7QUFBQSxLQUFBOztJQUdLLFlBQVksR0FBQTs7WUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ3RGLGdCQUFBLElBQUlDLGVBQU0sQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO2dCQUNwRSxPQUFPO0FBQ1IsYUFBQTs7QUFHRCxZQUFBLElBQUlBLGVBQU0sQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO1lBRXBELElBQUk7O2dCQUVGLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7QUFFbkUsZ0JBQUEsSUFBSSxXQUFXLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUM1QixvQkFBQSxJQUFJQSxlQUFNLENBQUMsMkNBQTJDLENBQUMsQ0FBQztvQkFDeEQsT0FBTztBQUNSLGlCQUFBOztBQUdELGdCQUFBLE1BQU0sS0FBSyxHQUFHLElBQUksbUJBQW1CLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ25FLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUVkLGFBQUE7QUFBQyxZQUFBLE9BQU8sS0FBSyxFQUFFO0FBQ2QsZ0JBQUEsT0FBTyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDaEQsSUFBSUEsZUFBTSxDQUFDLENBQTJCLHdCQUFBLEVBQUEsS0FBSyxDQUFDLE9BQU8sQ0FBQSxDQUFFLENBQUMsQ0FBQztBQUN4RCxhQUFBO1NBQ0YsQ0FBQSxDQUFBO0FBQUEsS0FBQTs7QUFNTyxJQUFBLHdCQUF3QixDQUFDLE1BQVcsRUFBQTtRQUMxQyxNQUFNLFdBQVcsR0FBcUIsRUFBRSxDQUFDO0FBQ3pDLFFBQUEsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQXFCLENBQUM7O1FBRzVDLE1BQU0sYUFBYSxHQUFtQyxFQUFFLENBQUM7O0FBR3pELFFBQUEsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLEVBQUU7QUFDMUIsWUFBQSxJQUFJLEtBQUssQ0FBQyxPQUFPLEtBQUssQ0FBQyxDQUFDO0FBQUUsZ0JBQUEsU0FBUztBQUVuQyxZQUFBLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFO0FBQ2pDLGdCQUFBLGFBQWEsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBQ25DLGFBQUE7WUFFRCxhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUMxQyxTQUFBOztBQUdELFFBQUEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxhQUFhLENBQUMsS0FBSTs7O0FBRW5FLFlBQUEsSUFBSSxhQUFhLENBQUMsTUFBTSxHQUFHLENBQUM7Z0JBQUUsT0FBTzs7WUFHckMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUk7QUFDMUIsZ0JBQUEsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLGdCQUFnQixJQUFJLFFBQVEsQ0FBQztBQUM3QyxnQkFBQSxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsZ0JBQWdCLElBQUksUUFBUSxDQUFDO2dCQUM3QyxPQUFPLEtBQUssR0FBRyxLQUFLLENBQUM7QUFDdkIsYUFBQyxDQUFDLENBQUM7O0FBR0gsWUFBQSxNQUFNLFlBQVksR0FBRyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQzs7QUFHL0UsWUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUM1QyxnQkFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDaEQsb0JBQUEsTUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzlCLG9CQUFBLE1BQU0sS0FBSyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFHOUIsb0JBQUEsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FDeEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQ2hFLENBQUM7b0JBRUYsSUFBSSxRQUFRLEdBQUcsR0FBRztBQUFFLHdCQUFBLFNBQVM7O0FBRzdCLG9CQUFBLE1BQU0sVUFBVSxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxRQUFRLEdBQUcsR0FBRyxDQUFDLENBQUM7O29CQUd2RCxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQzdDLEtBQUssQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUMvQixDQUFDO29CQUVGLFdBQVcsQ0FBQyxJQUFJLENBQUM7QUFDZix3QkFBQSxVQUFVLEVBQUUsS0FBSztBQUNqQix3QkFBQSxVQUFVLEVBQUUsS0FBSztBQUNqQix3QkFBQSxVQUFVLEVBQUUsVUFBVTtBQUN0Qix3QkFBQSxXQUFXLEVBQUUsV0FBVztBQUN4Qix3QkFBQSxZQUFZLEVBQUUsQ0FBQSxDQUFBLEVBQUEsR0FBQSxDQUFBLEVBQUEsR0FBQSxNQUFNLENBQUMsYUFBYSxNQUFBLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFHLFNBQVMsQ0FBQyxNQUFFLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFFLENBQUEsR0FBRyxDQUFDLENBQUMsQ0FBTSxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSSxFQUFFO3dCQUMxRixNQUFNLEVBQUUsQ0FBcUMsa0NBQUEsRUFBQSxTQUFTLENBQUUsQ0FBQTtBQUN6RCxxQkFBQSxDQUFDLENBQUM7QUFDSixpQkFBQTtBQUNGLGFBQUE7QUFDSCxTQUFDLENBQUMsQ0FBQzs7QUFHSCxRQUFBLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3RDLFlBQUEsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzFDLGdCQUFBLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4QixnQkFBQSxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBR3hCLGdCQUFBLElBQUksS0FBSyxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsT0FBTyxLQUFLLEtBQUssQ0FBQyxPQUFPO29CQUFFLFNBQVM7O0FBR3RFLGdCQUFBLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQ3hCLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUNoRSxDQUFDOztnQkFHRixJQUFJLFFBQVEsR0FBRyxHQUFHO29CQUFFLFNBQVM7O0FBRzdCLGdCQUFBLE1BQU0sVUFBVSxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxRQUFRLEdBQUcsR0FBRyxDQUFDLENBQUM7O2dCQUd2RCxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQzdDLEtBQUssQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUMvQixDQUFDOztBQUdGLGdCQUFBLElBQUksV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7b0JBQzFCLFdBQVcsQ0FBQyxJQUFJLENBQUM7QUFDZix3QkFBQSxVQUFVLEVBQUUsS0FBSztBQUNqQix3QkFBQSxVQUFVLEVBQUUsS0FBSztBQUNqQix3QkFBQSxVQUFVLEVBQUUsVUFBVTtBQUN0Qix3QkFBQSxXQUFXLEVBQUUsV0FBVztBQUN4Qix3QkFBQSxZQUFZLEVBQUUsRUFBRTtBQUNoQix3QkFBQSxNQUFNLEVBQUUsQ0FBa0UsZ0VBQUEsQ0FBQTtBQUMzRSxxQkFBQSxDQUFDLENBQUM7QUFDSixpQkFBQTtBQUNGLGFBQUE7QUFDRixTQUFBOztBQUdELFFBQUEsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUM7O1FBR3hELE9BQU8sV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7S0FDakM7O0FBR0ssSUFBQSxjQUFjLENBQUMsY0FBc0IsRUFBRSxjQUFzQixFQUFFLFdBQW1CLEVBQUE7O1lBQ3RGLElBQUk7O0FBRUYsZ0JBQUEsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDeEUsZ0JBQUEsSUFBSSxFQUFFLFVBQVUsWUFBWUQsY0FBSyxDQUFDLEVBQUU7QUFDbEMsb0JBQUEsTUFBTSxJQUFJLEtBQUssQ0FBQywwQkFBMEIsY0FBYyxDQUFBLENBQUUsQ0FBQyxDQUFDO0FBQzdELGlCQUFBOztBQUdELGdCQUFBLE1BQU0sYUFBYSxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDOztBQUc1RCxnQkFBQSxNQUFNLGNBQWMsR0FBRyxjQUFjLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLGNBQWMsQ0FBQztnQkFDekUsTUFBTSxRQUFRLEdBQUcsQ0FBQSw0QkFBQSxFQUErQixjQUFjLENBQUEsS0FBQSxFQUFRLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQSxFQUFBLENBQUksQ0FBQzs7QUFHN0YsZ0JBQUEsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLGFBQWEsR0FBRyxRQUFRLENBQUMsQ0FBQzs7QUFHbEUsZ0JBQUEsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUNyQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxVQUFVLEtBQUssSUFBSTtvQkFDdEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsVUFBVSxLQUFLLFNBQVMsQ0FDNUMsQ0FBQztBQUVGLGdCQUFBLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUU7QUFDOUIsb0JBQUEsTUFBTSxFQUFFLElBQUk7QUFDWixvQkFBQSxNQUFNLEVBQUU7d0JBQ04sSUFBSSxFQUFFLGFBQWEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUM7d0JBQzFDLEtBQUssRUFBRSxJQUFJO0FBQ1oscUJBQUE7QUFDRixpQkFBQSxDQUFDLENBQUM7O0FBR0gsZ0JBQUEsSUFBSUMsZUFBTSxDQUFDLCtCQUErQixFQUFFLElBQUksQ0FBQyxDQUFDO0FBRWxELGdCQUFBLE9BQU8sSUFBSSxDQUFDO0FBQ2IsYUFBQTtBQUFDLFlBQUEsT0FBTyxLQUFLLEVBQUU7QUFDZCxnQkFBQSxPQUFPLENBQUMsS0FBSyxDQUFDLDJCQUEyQixFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUNsRCxJQUFJQSxlQUFNLENBQUMsQ0FBMEIsdUJBQUEsRUFBQSxLQUFLLENBQUMsT0FBTyxDQUFBLENBQUUsQ0FBQyxDQUFDO0FBQ3RELGdCQUFBLE9BQU8sS0FBSyxDQUFDO0FBQ2QsYUFBQTtTQUNGLENBQUEsQ0FBQTtBQUFBLEtBQUE7QUFDRixDQUFBO0FBd0NELE1BQU0sY0FBYyxDQUFBO0lBbUJsQixXQUFZLENBQUEsU0FBc0IsRUFBRSxZQUFvQyxFQUFBO1FBZmhFLElBQU0sQ0FBQSxNQUFBLEdBQXNCLElBQUksQ0FBQztRQUNqQyxJQUFLLENBQUEsS0FBQSxHQUFHLEdBQUcsQ0FBQztRQUNaLElBQU0sQ0FBQSxNQUFBLEdBQUcsR0FBRyxDQUFDO1FBQ2IsSUFBVyxDQUFBLFdBQUEsR0FBRyxFQUFFLENBQUM7UUFDakIsSUFBTSxDQUFBLE1BQUEsR0FBRyxDQUFDLENBQUM7UUFDWCxJQUFNLENBQUEsTUFBQSxHQUFHLENBQUMsQ0FBQztRQUNYLElBQUssQ0FBQSxLQUFBLEdBQUcsQ0FBQyxDQUFDO1FBQ1YsSUFBTyxDQUFBLE9BQUEsR0FBRyxDQUFDLENBQUM7UUFDWixJQUFPLENBQUEsT0FBQSxHQUFHLENBQUMsQ0FBQztRQUNaLElBQVUsQ0FBQSxVQUFBLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUssQ0FBQSxLQUFBLEdBQUcsQ0FBQyxDQUFDO1FBQ1YsSUFBSyxDQUFBLEtBQUEsR0FBRyxDQUFDLENBQUM7UUFDVixJQUFZLENBQUEsWUFBQSxHQUFxQixJQUFJLENBQUM7QUFJNUMsUUFBQSxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztBQUMzQixRQUFBLElBQUksQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDOztRQUdqQyxJQUFJLENBQUMsTUFBTSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUMvQixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUN6QyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsNkNBQTZDLENBQUM7UUFFekUsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0MsSUFBSSxDQUFDLE9BQU8sRUFBRTtBQUNaLFlBQUEsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0FBQ3BELFNBQUE7QUFDRCxRQUFBLElBQUksQ0FBQyxHQUFHLEdBQUcsT0FBTyxDQUFDOztBQUduQixRQUFBLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLEVBQUU7WUFDaEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUN2RCxTQUFBOztRQUdELElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQzs7UUFHeEMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7S0FDMUI7SUFFTyxpQkFBaUIsR0FBQTtBQUN2QixRQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDM0UsUUFBQSxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ25FLFFBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNuRSxRQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDM0UsUUFBQSxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3ZFLFFBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztLQUMzRTtBQUVPLElBQUEsZUFBZSxDQUFDLENBQWEsRUFBQTtRQUNuQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDakQsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDcEMsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUM7UUFFbkMsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ25CLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztZQUNwQyxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFFcEMsWUFBQSxJQUFJLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQztBQUNuQixZQUFBLElBQUksQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO0FBRW5CLFlBQUEsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0FBQ3pCLFlBQUEsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1lBRXpCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUNiLFNBQUE7QUFBTSxhQUFBO1lBQ0wsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDMUIsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ2IsU0FBQTtLQUNGO0FBRU8sSUFBQSxXQUFXLENBQUMsQ0FBYSxFQUFBO1FBQy9CLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtZQUNyQixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDM0MsU0FBQTtLQUNGO0FBRU8sSUFBQSxXQUFXLENBQUMsQ0FBYSxFQUFBO1FBQy9CLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQztBQUVuQixRQUFBLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDdkMsUUFBQSxJQUFJLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQzs7UUFHcEIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUVwRCxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7S0FDYjtBQUVPLElBQUEsZUFBZSxDQUFDLENBQWEsRUFBQTtBQUNuQyxRQUFBLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO0FBQ3ZCLFFBQUEsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0FBQ3pCLFFBQUEsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUM7S0FDdkM7QUFFTyxJQUFBLGFBQWEsQ0FBQyxDQUFhLEVBQUE7QUFDakMsUUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztBQUN4QixRQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxHQUFHLFNBQVMsR0FBRyxTQUFTLENBQUM7S0FDdEU7SUFFTyxrQkFBa0IsR0FBQTtRQUN4QixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU07WUFBRSxPQUFPO0FBRXpCLFFBQUEsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUM7UUFFekIsS0FBSyxNQUFNLEtBQUssSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtBQUN0QyxZQUFBLE1BQU0sQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoRSxZQUFBLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQ3hCLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ2xDLGdCQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQ25DLENBQUM7QUFFRixZQUFBLElBQUksUUFBUSxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7QUFDaEMsZ0JBQUEsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUM7Z0JBQzFCLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxTQUFTLENBQUM7Z0JBQ3JDLE9BQU87QUFDUixhQUFBO0FBQ0YsU0FBQTtBQUVELFFBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxHQUFHLFNBQVMsQ0FBQztLQUNyRTs7SUFHTyxhQUFhLENBQUMsQ0FBUyxFQUFFLENBQVMsRUFBQTs7QUFFeEMsUUFBQSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztBQUMvQixRQUFBLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDOztBQUdoQyxRQUFBLE1BQU0sT0FBTyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztBQUM5RCxRQUFBLE1BQU0sT0FBTyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsR0FBRyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztBQUU5RCxRQUFBLE9BQU8sQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7S0FDM0I7QUFFTSxJQUFBLE9BQU8sQ0FBQyxNQUFrQixFQUFBO0FBQy9CLFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztLQUNiO0lBRU8sU0FBUyxHQUFBO0FBQ2YsUUFBQSxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztBQUNmLFFBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFDakIsUUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQztLQUNsQjtJQUVPLElBQUksR0FBQTtRQUNWLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTTtZQUFFLE9BQU87O0FBR3pCLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQzs7UUFHbEQsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDOztBQUdoQixRQUFBLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQzs7QUFHckMsUUFBQSxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDOztRQUc1QixLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO0FBQ3RDLFlBQUEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN2QixTQUFBOztRQUdELElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtZQUNyQixJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7QUFDcEIsU0FBQTtLQUNGO0lBRU8sUUFBUSxHQUFBO0FBQ2QsUUFBQSxNQUFNLFFBQVEsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUVqQyxRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxHQUFHLGtEQUFrRCxDQUFDO0FBQzFFLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDOztBQUd2QixRQUFBLEtBQUssSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sR0FBRyxRQUFRLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLFFBQVEsRUFBRTtBQUNuRSxZQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDckIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3RCLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDaEMsWUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ25CLFNBQUE7O0FBR0QsUUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLEdBQUcsUUFBUSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxRQUFRLEVBQUU7QUFDcEUsWUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3JCLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN0QixJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQy9CLFlBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUNuQixTQUFBO0tBQ0Y7SUFFTyxZQUFZLEdBQUE7UUFDbEIsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNO0FBQUUsWUFBQSxPQUFPLEVBQUUsQ0FBQzs7QUFHNUIsUUFBQSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUNsQyxNQUFNLFFBQVEsR0FBa0IsRUFBRSxDQUFDO0FBQ25DLFFBQUEsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztBQUVsQyxRQUFBLE1BQU0saUJBQWlCLEdBQUcsR0FBRyxDQUFDO0FBRTlCLFFBQUEsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDdEMsWUFBQSxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUFFLFNBQVM7WUFFN0IsTUFBTSxPQUFPLEdBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDekMsWUFBQSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBRWYsWUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDdEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUFFLFNBQVM7Z0JBRXhDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQ3hCLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDdEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQ3ZDLENBQUM7Z0JBRUYsSUFBSSxRQUFRLEdBQUcsaUJBQWlCLEVBQUU7b0JBQ2hDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEIsb0JBQUEsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQixpQkFBQTtBQUNGLGFBQUE7QUFFRCxZQUFBLElBQUksT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDdEIsZ0JBQUEsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN4QixhQUFBO0FBQ0YsU0FBQTtBQUVELFFBQUEsT0FBTyxRQUFRLENBQUM7S0FDakI7QUFFTyxJQUFBLFlBQVksQ0FBQyxRQUF1QixFQUFBOztRQUUxQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU07WUFBRSxPQUFPOztBQUd6QixRQUFBLE1BQU0sTUFBTSxHQUFHO0FBQ2IsWUFBQSxFQUFFLElBQUksRUFBRSx5QkFBeUIsRUFBRSxNQUFNLEVBQUUseUJBQXlCLEVBQUU7QUFDdEUsWUFBQSxFQUFFLElBQUksRUFBRSx5QkFBeUIsRUFBRSxNQUFNLEVBQUUseUJBQXlCLEVBQUU7QUFDdEUsWUFBQSxFQUFFLElBQUksRUFBRSx5QkFBeUIsRUFBRSxNQUFNLEVBQUUseUJBQXlCLEVBQUU7QUFDdEUsWUFBQSxFQUFFLElBQUksRUFBRSx5QkFBeUIsRUFBRSxNQUFNLEVBQUUseUJBQXlCLEVBQUU7QUFDdEUsWUFBQSxFQUFFLElBQUksRUFBRSwwQkFBMEIsRUFBRSxNQUFNLEVBQUUsMEJBQTBCLEVBQUU7QUFDeEUsWUFBQSxFQUFFLElBQUksRUFBRSx5QkFBeUIsRUFBRSxNQUFNLEVBQUUseUJBQXlCLEVBQUU7QUFDdEUsWUFBQSxFQUFFLElBQUksRUFBRSwwQkFBMEIsRUFBRSxNQUFNLEVBQUUsMEJBQTBCLEVBQUU7U0FDekUsQ0FBQzs7UUFHRixNQUFNLGFBQWEsR0FBbUMsRUFBRSxDQUFDO1FBRXpELEtBQUssTUFBTSxLQUFLLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7QUFDdEMsWUFBQSxJQUFJLEtBQUssQ0FBQyxPQUFPLEtBQUssQ0FBQyxDQUFDO0FBQUUsZ0JBQUEsU0FBUztBQUVuQyxZQUFBLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFO0FBQ2pDLGdCQUFBLGFBQWEsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBQ25DLGFBQUE7WUFFRCxhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUMxQyxTQUFBOztBQUdELFFBQUEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsRUFBRSxLQUFLLEtBQUk7O0FBRW5FLFlBQUEsSUFBSSxJQUFJLEdBQUcsUUFBUSxFQUFFLElBQUksR0FBRyxRQUFRLENBQUM7WUFDckMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDO0FBQ3ZDLFlBQUEsSUFBSSxJQUFJLEdBQUcsQ0FBQyxFQUFFLElBQUksR0FBRyxDQUFDLENBQUM7QUFFdkIsWUFBQSxLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sRUFBRTtBQUMxQixnQkFBQSxNQUFNLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hFLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDL0IsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUMvQixJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQy9CLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDL0IsSUFBSSxJQUFJLE9BQU8sQ0FBQztnQkFDaEIsSUFBSSxJQUFJLE9BQU8sQ0FBQztBQUNqQixhQUFBOztBQUdELFlBQUEsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7QUFDckMsWUFBZ0IsSUFBSSxHQUFHLE1BQU0sQ0FBQyxPQUFPOztZQUdyQyxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7WUFDbkIsSUFBSSxJQUFJLE9BQU8sQ0FBQztZQUNoQixJQUFJLElBQUksT0FBTyxDQUFDO1lBQ2hCLElBQUksSUFBSSxPQUFPLENBQUM7WUFDaEIsSUFBSSxJQUFJLE9BQU8sQ0FBQzs7WUFHaEIsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7QUFDdkQsWUFBQSxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7O1lBR2pDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDaEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztBQUNwQyxZQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztBQUV2QixZQUFBLElBQUksQ0FBQyxTQUFTLENBQ1osSUFBSSxFQUNKLElBQUksRUFDSixJQUFJLEdBQUcsSUFBSSxFQUNYLElBQUksR0FBRyxJQUFJLEVBQ1gsRUFBRSxDQUNILENBQUM7QUFFRixZQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDaEIsWUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDOztBQUdsQixZQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQ3JFLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQztBQUMvQyxxQkFBQSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztxQkFDWCxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUM7cUJBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzs7QUFHZCxnQkFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxvQkFBb0IsQ0FBQztBQUMxQyxnQkFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyw0QkFBNEIsQ0FBQztBQUM3QyxnQkFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7QUFDOUIsZ0JBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsV0FBVyxTQUFTLENBQUEsRUFBQSxFQUFLLEtBQUssQ0FBQSxDQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN4RSxhQUFBO0FBQ0gsU0FBQyxDQUFDLENBQUM7S0FDSjtJQUVPLFNBQVMsQ0FBQyxDQUFTLEVBQUUsQ0FBUyxFQUFFLEtBQWEsRUFBRSxNQUFjLEVBQUUsTUFBYyxFQUFBO0FBQ25GLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNyQixJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQy9CLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUssR0FBRyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzVELFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsTUFBTSxHQUFHLE1BQU0sQ0FBQyxDQUFDO1FBQ2hELElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEdBQUcsS0FBSyxHQUFHLE1BQU0sRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzlFLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7UUFDeEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEdBQUcsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzlELElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7QUFDL0IsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzVDLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztLQUN0QjtBQUVPLElBQUEsU0FBUyxDQUFDLEtBQWdCLEVBQUE7QUFDaEMsUUFBQSxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBR3BELFFBQUEsTUFBTSxhQUFhLEdBQUc7WUFDcEIsdUJBQXVCO1lBQ3ZCLHVCQUF1QjtZQUN2Qix1QkFBdUI7WUFDdkIsdUJBQXVCO1lBQ3ZCLHdCQUF3QjtZQUN4Qix1QkFBdUI7QUFDdkIsWUFBQSx3QkFBd0I7U0FDekIsQ0FBQzs7QUFHRixRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDckIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDOztBQUdyRCxRQUFBLElBQUksSUFBSSxDQUFDLFlBQVksS0FBSyxLQUFLLEVBQUU7O0FBRS9CLFlBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsMkJBQTJCLENBQUM7QUFDbEQsU0FBQTtBQUFNLGFBQUEsSUFBSSxLQUFLLENBQUMsT0FBTyxLQUFLLENBQUMsQ0FBQyxFQUFFOztBQUUvQixZQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLG1CQUFtQixDQUFDO0FBQzFDLFNBQUE7QUFBTSxhQUFBOztZQUVMLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxPQUFPLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQztZQUN4RCxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDaEQsU0FBQTtBQUVELFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQzs7QUFHaEIsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsR0FBRywyQkFBMkIsQ0FBQztBQUNuRCxRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztBQUN2QixRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUM7O0FBR2xCLFFBQUEsSUFBSSxJQUFJLENBQUMsWUFBWSxLQUFLLEtBQUssRUFBRTtBQUMvQixZQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLG9CQUFvQixDQUFDO0FBQzFDLFlBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsdUJBQXVCLENBQUM7QUFDeEMsWUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7QUFDOUIsWUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUM3RCxTQUFBO0tBQ0Y7SUFFTyxXQUFXLEdBQUE7UUFDakIsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTTtZQUFFLE9BQU87UUFFL0MsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUUsUUFBQSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDOztBQUdoQyxRQUFBLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUM7QUFDMUIsUUFBQSxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1FBQ3hCLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDOztBQUd6QyxRQUFBLE1BQU0sVUFBVSxHQUFHLENBQUMsU0FBa0IsS0FBSTtBQUN4QyxZQUFBLElBQUksQ0FBQyxTQUFTO0FBQUUsZ0JBQUEsT0FBTyxTQUFTLENBQUM7QUFDakMsWUFBQSxNQUFNLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNqQyxPQUFPLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztBQUMvRyxTQUFDLENBQUM7O1FBR0YsTUFBTSxRQUFRLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN6QyxNQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3hDLFFBQUEsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLFNBQVMsR0FBRyxDQUFHLEVBQUEsS0FBSyxDQUFDLFNBQVMsQ0FBQSxNQUFBLENBQVEsR0FBRyxTQUFTLENBQUM7QUFDM0UsUUFBQSxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsV0FBVyxHQUFHLENBQUksQ0FBQSxFQUFBLEtBQUssQ0FBQyxXQUFXLENBQUEsU0FBQSxDQUFXLEdBQUcsRUFBRSxDQUFDOztBQUc5RSxRQUFBLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQztBQUM5QyxjQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFBLENBQUEsRUFBSSxHQUFHLENBQUUsQ0FBQSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztjQUMxQyxTQUFTLENBQUM7O0FBR2QsUUFBQSxNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsY0FBYyxJQUFJLHNCQUFzQixDQUFDOztBQUcvRCxRQUFBLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTLElBQUksS0FBSyxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUM7Y0FDN0UsQ0FBdUIsb0JBQUEsRUFBQSxLQUFLLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFFLENBQUE7Y0FDMUQsRUFBRSxDQUFDOztRQUdQLElBQUksV0FBVyxHQUFHLGVBQWUsQ0FBQztBQUNsQyxRQUFBLElBQUksS0FBSyxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsRUFBRTtBQUN4QixZQUFBLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7O1lBR2hDLElBQUksWUFBWSxHQUFHLEVBQUUsQ0FBQztBQUN0QixZQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQ3JFLFlBQVksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUM7QUFDaEQscUJBQUEsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7cUJBQ1gsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDO3FCQUNoQixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDZixhQUFBO0FBRUQsWUFBQSxXQUFXLEdBQUcsQ0FBVyxRQUFBLEVBQUEsU0FBUyxDQUFLLEVBQUEsRUFBQSxZQUFZLEVBQUUsQ0FBQztBQUN2RCxTQUFBOztBQUdELFFBQUEsTUFBTSxRQUFRLEdBQUc7QUFDZixZQUFBO0FBQ0UsZ0JBQUEsS0FBSyxFQUFFLE9BQU87QUFDZCxnQkFBQSxJQUFJLEVBQUUsS0FBSztBQUNYLGdCQUFBLElBQUksRUFBRSxzQkFBc0I7Z0JBQzVCLFVBQVUsRUFBRSxJQUFJO0FBQ2pCLGFBQUE7QUFDRCxZQUFBO0FBQ0UsZ0JBQUEsS0FBSyxFQUFFLE1BQU07QUFDYixnQkFBQSxJQUFJLEVBQUUsSUFBSTtBQUNWLGdCQUFBLElBQUksRUFBRSx3QkFBd0I7QUFDOUIsZ0JBQUEsV0FBVyxFQUFFLElBQUk7QUFDbEIsYUFBQTtBQUNELFlBQUE7QUFDRSxnQkFBQSxLQUFLLEVBQUUsVUFBVTtBQUNqQixnQkFBQSxJQUFJLEVBQUUsS0FBSztBQUNYLGdCQUFBLFdBQVcsRUFBRSxJQUFJO0FBQ2xCLGFBQUE7QUFDRCxZQUFBO0FBQ0UsZ0JBQUEsS0FBSyxFQUFFLFNBQVM7QUFDaEIsZ0JBQUEsSUFBSSxFQUFFLFdBQVc7QUFDakIsZ0JBQUEsV0FBVyxFQUFFLElBQUk7QUFDbEIsYUFBQTs7QUFFRCxZQUFBO0FBQ0UsZ0JBQUEsS0FBSyxFQUFFLE1BQU07QUFDYixnQkFBQSxJQUFJLEVBQUU7b0JBQ0osSUFBSSxLQUFLLFNBQVMsR0FBRyxJQUFJLEdBQUcsSUFBSTtBQUNoQyxvQkFBQSxTQUFTLElBQUksV0FBVyxHQUFHLENBQUcsRUFBQSxTQUFTLENBQUssRUFBQSxFQUFBLFdBQVcsR0FBRyxHQUFHLFNBQVMsSUFBSSxFQUFFO2lCQUM3RSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO0FBQzdCLGdCQUFBLFdBQVcsRUFBRSxJQUFJO0FBQ2xCLGFBQUE7O0FBRUQsWUFBQTtBQUNFLGdCQUFBLEtBQUssRUFBRSxPQUFPO0FBQ2QsZ0JBQUEsSUFBSSxFQUFFLENBQWEsVUFBQSxFQUFBLFFBQVEsQ0FBRyxFQUFBLEtBQUssQ0FBQyxLQUFLLEdBQUcsZUFBZSxPQUFPLENBQUEsQ0FBRSxHQUFHLEVBQUUsQ0FBRSxDQUFBO0FBQzNFLGdCQUFBLElBQUksRUFBRSxpQkFBaUI7QUFDdkIsZ0JBQUEsV0FBVyxFQUFFLEtBQUssQ0FBQyxLQUFLLEtBQUssU0FBUztBQUN2QyxhQUFBOztBQUVELFlBQUE7QUFDRSxnQkFBQSxLQUFLLEVBQUUsU0FBUztBQUNoQixnQkFBQSxJQUFJLEVBQUUsT0FBTztBQUNiLGdCQUFBLElBQUksRUFBRSx3QkFBd0I7QUFDOUIsZ0JBQUEsV0FBVyxFQUFFLENBQUMsS0FBSyxDQUFDLGNBQWMsSUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDLE1BQU0sR0FBRyxDQUFDO0FBQ3RFLGFBQUE7O0FBRUQsWUFBQTtBQUNFLGdCQUFBLEtBQUssRUFBRSxFQUFFO0FBQ1QsZ0JBQUEsSUFBSSxFQUFFLFlBQVk7QUFDbEIsZ0JBQUEsSUFBSSxFQUFFLGlCQUFpQjtBQUN2QixnQkFBQSxXQUFXLEVBQUUsSUFBSTtBQUNsQixhQUFBO1NBQ0YsQ0FBQzs7QUFHRixRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLHNCQUFzQixDQUFDO0FBQ3ZDLFFBQUEsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQzs7QUFHMUQsUUFBQSxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBRztBQUN6QixZQUFBLElBQUksT0FBTyxDQUFDLFVBQVUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUNoRSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxJQUFJLGlCQUFpQixDQUFDO0FBQ2xELGdCQUFBLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUNoQyxPQUFPLENBQUMsS0FBSyxHQUFHLENBQUEsRUFBRyxPQUFPLENBQUMsS0FBSyxDQUFLLEVBQUEsRUFBQSxPQUFPLENBQUMsSUFBSSxDQUFBLENBQUUsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUNuRSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7Z0JBQ2IsWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzlDLGFBQUE7QUFDSCxTQUFDLENBQUMsQ0FBQzs7QUFHSCxRQUFBLFlBQVksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFDOztBQUd4RCxRQUFBLE1BQU0sVUFBVSxHQUFHLEVBQUUsQ0FBQzs7UUFFdEIsTUFBTSxlQUFlLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQ3ZDLENBQUMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxDQUFDLENBQUMsV0FBVyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FDM0MsQ0FBQyxNQUFNLENBQUM7O1FBR1QsTUFBTSxhQUFhLEdBQUcsZUFBZSxHQUFHLFVBQVUsR0FBRyxFQUFFLENBQUM7OztBQUl4RCxRQUFBLElBQUksUUFBUSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDdEIsSUFBSSxRQUFRLEdBQUcsWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxFQUFFO0FBQzdDLFlBQUEsUUFBUSxHQUFHLENBQUMsR0FBRyxZQUFZLEdBQUcsRUFBRSxDQUFDO0FBQ2xDLFNBQUE7O1FBR0QsSUFBSSxRQUFRLEdBQUcsRUFBRSxFQUFFO1lBQ2pCLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsWUFBWSxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsWUFBWSxHQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdkYsU0FBQTs7QUFHRCxRQUFBLElBQUksUUFBUSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDdEIsSUFBSSxRQUFRLEdBQUcsYUFBYSxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxFQUFFO0FBQy9DLFlBQUEsUUFBUSxHQUFHLENBQUMsR0FBRyxhQUFhLEdBQUcsRUFBRSxDQUFDO0FBQ25DLFNBQUE7O1FBR0QsSUFBSSxRQUFRLEdBQUcsRUFBRSxFQUFFO1lBQ2pCLFFBQVEsR0FBRyxFQUFFLENBQUM7QUFDZixTQUFBOztRQUdELFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVFLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLGFBQWEsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDOztBQUc5RSxRQUFBLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxHQUFHLGFBQWEsQ0FBQyxDQUFDO0FBQ3ZHLFFBQUEsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUUsMkJBQTJCLENBQUMsQ0FBQztBQUN0RCxRQUFBLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLDJCQUEyQixDQUFDLENBQUM7QUFDdEQsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7QUFDOUIsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsR0FBRywwQkFBMEIsQ0FBQztBQUNsRCxRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztBQUV2QixRQUFBLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ25FLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUNoQixRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUM7O0FBR2xCLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDOztBQUc1QixRQUFBLElBQUksUUFBUSxHQUFHLFFBQVEsR0FBRyxFQUFFLENBQUM7QUFDN0IsUUFBQSxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sSUFBRztBQUN6QixZQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxLQUFLLE9BQU8sQ0FBQyxXQUFXLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO2dCQUFFLE9BQU87WUFFMUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxpQkFBaUIsQ0FBQzs7QUFHbEQsWUFBQSxJQUFJLE9BQU8sQ0FBQyxLQUFLLEtBQUssT0FBTyxFQUFFO2dCQUM3QixJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7QUFDaEMsYUFBQTtBQUFNLGlCQUFBLElBQUksT0FBTyxDQUFDLEtBQUssS0FBSyxTQUFTLEVBQUU7Z0JBQ3RDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztBQUNoQyxhQUFBO0FBQU0saUJBQUEsSUFBSSxPQUFPLENBQUMsS0FBSyxLQUFLLEVBQUUsRUFBRTtnQkFDL0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO0FBQ2hDLGFBQUE7QUFBTSxpQkFBQTtnQkFDTCxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7QUFDaEMsYUFBQTtZQUVELE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxLQUFLLElBQUksT0FBTyxDQUFDLEtBQUssS0FBSyxPQUFPO2tCQUNuRCxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUssRUFBQSxFQUFBLE9BQU8sQ0FBQyxJQUFJLENBQUUsQ0FBQTtBQUNyQyxrQkFBRSxPQUFPLENBQUMsSUFBSSxDQUFDOztBQUdqQixZQUFBLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxHQUFHLFlBQVksR0FBRyxFQUFFLEVBQUU7Z0JBQ3hELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQzlCLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUVkLGdCQUFBLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO29CQUNyQyxNQUFNLFFBQVEsR0FBRyxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztvQkFDdkMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBRS9DLElBQUksT0FBTyxDQUFDLEtBQUssR0FBRyxZQUFZLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDOUMsd0JBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFFBQVEsR0FBRyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDakQsd0JBQUEsSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUM7QUFDdEIsd0JBQUEsUUFBUSxJQUFJLFVBQVUsR0FBRyxHQUFHLENBQUM7QUFDOUIscUJBQUE7QUFBTSx5QkFBQTt3QkFDTCxJQUFJLEdBQUcsUUFBUSxDQUFDO0FBQ2pCLHFCQUFBO0FBQ0YsaUJBQUE7QUFFRCxnQkFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxHQUFHLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNsRCxhQUFBO0FBQU0saUJBQUE7QUFDTCxnQkFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsUUFBUSxHQUFHLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNsRCxhQUFBO1lBRUQsUUFBUSxJQUFJLFVBQVUsQ0FBQztBQUN6QixTQUFDLENBQUMsQ0FBQztLQUNKO0FBQ0YsQ0FBQTtBQUVELE1BQU0sVUFBVyxTQUFRRyx5QkFBZ0IsQ0FBQTtJQUd2QyxXQUFZLENBQUEsR0FBUSxFQUFFLE1BQXFCLEVBQUE7QUFDekMsUUFBQSxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ25CLFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7S0FDdEI7SUFFRCxPQUFPLEdBQUE7QUFDTCxRQUFBLE1BQU0sRUFBQyxXQUFXLEVBQUMsR0FBRyxJQUFJLENBQUM7UUFDM0IsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBRXBCLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUMsSUFBSSxFQUFFLDJCQUEyQixFQUFDLENBQUMsQ0FBQztRQUVoRSxJQUFJQyxnQkFBTyxDQUFDLFdBQVcsQ0FBQzthQUNyQixPQUFPLENBQUMsWUFBWSxDQUFDO2FBQ3JCLE9BQU8sQ0FBQyx1RkFBdUYsQ0FBQztBQUNoRyxhQUFBLFNBQVMsQ0FBQyxNQUFNLElBQUksTUFBTTtBQUN4QixhQUFBLFNBQVMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQzthQUNwQixRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDO0FBQ3pDLGFBQUEsaUJBQWlCLEVBQUU7QUFDbkIsYUFBQSxRQUFRLENBQUMsQ0FBTyxLQUFLLEtBQUksU0FBQSxDQUFBLElBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxhQUFBO1lBQ3hCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7QUFDeEMsWUFBQSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDbEMsQ0FBQSxDQUFDLENBQUMsQ0FBQztRQUVSLElBQUlBLGdCQUFPLENBQUMsV0FBVyxDQUFDO2FBQ3JCLE9BQU8sQ0FBQyxZQUFZLENBQUM7YUFDckIsT0FBTyxDQUFDLDJDQUEyQyxDQUFDO0FBQ3BELGFBQUEsU0FBUyxDQUFDLE1BQU0sSUFBSSxNQUFNO0FBQ3hCLGFBQUEsU0FBUyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDO2FBQ3pCLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7QUFDekMsYUFBQSxpQkFBaUIsRUFBRTtBQUNuQixhQUFBLFFBQVEsQ0FBQyxDQUFPLEtBQUssS0FBSSxTQUFBLENBQUEsSUFBQSxFQUFBLEtBQUEsQ0FBQSxFQUFBLEtBQUEsQ0FBQSxFQUFBLGFBQUE7WUFDeEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztBQUN4QyxZQUFBLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztTQUNsQyxDQUFBLENBQUMsQ0FBQyxDQUFDO1FBRVIsSUFBSUEsZ0JBQU8sQ0FBQyxXQUFXLENBQUM7YUFDckIsT0FBTyxDQUFDLHlCQUF5QixDQUFDO2FBQ2xDLE9BQU8sQ0FBQyxvQ0FBb0MsQ0FBQztBQUM3QyxhQUFBLFNBQVMsQ0FBQyxNQUFNLElBQUksTUFBTTtBQUN4QixhQUFBLFNBQVMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQzthQUNwQixRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDO0FBQ3RDLGFBQUEsaUJBQWlCLEVBQUU7QUFDbkIsYUFBQSxRQUFRLENBQUMsQ0FBTyxLQUFLLEtBQUksU0FBQSxDQUFBLElBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxhQUFBO1lBQ3hCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUM7QUFDckMsWUFBQSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDbEMsQ0FBQSxDQUFDLENBQUMsQ0FBQztLQUNUO0FBQ0Y7Ozs7In0=
