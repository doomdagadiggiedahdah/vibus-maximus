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
            const success = yield this.plugin.createNoteLink(connection.sourceNote.path, connection.targetNote.path, description);
            if (success) {
                new obsidian.Notice(`Successfully linked ${connection.sourceNote.title} to ${connection.targetNote.title}`);
                // Remove this connection from the list
                this.connections = this.connections.filter((_, index) => index !== this.selectedConnectionIndex);
                if (this.connections.length === 0) {
                    // No more connections, close the modal
                    this.close();
                    return;
                }
                // Select the next connection
                this.selectedConnectionIndex = Math.min(this.selectedConnectionIndex, this.connections.length - 1);
                // Update the UI
                const connectionContainer = this.contentEl.querySelector('.connections-container');
                const detailsContainer = this.contentEl.querySelector('.connection-details');
                this.renderConnectionsList(connectionContainer);
                this.renderConnectionDetails(detailsContainer, this.connections[this.selectedConnectionIndex]);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIi4uLy4uLy4uLy4uL3NyYy9vYnNpZGlhbi1wbHVnaW4vbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuLyogZ2xvYmFsIFJlZmxlY3QsIFByb21pc2UsIFN1cHByZXNzZWRFcnJvciwgU3ltYm9sLCBJdGVyYXRvciAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19lc0RlY29yYXRlKGN0b3IsIGRlc2NyaXB0b3JJbiwgZGVjb3JhdG9ycywgY29udGV4dEluLCBpbml0aWFsaXplcnMsIGV4dHJhSW5pdGlhbGl6ZXJzKSB7XHJcbiAgICBmdW5jdGlvbiBhY2NlcHQoZikgeyBpZiAoZiAhPT0gdm9pZCAwICYmIHR5cGVvZiBmICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGdW5jdGlvbiBleHBlY3RlZFwiKTsgcmV0dXJuIGY7IH1cclxuICAgIHZhciBraW5kID0gY29udGV4dEluLmtpbmQsIGtleSA9IGtpbmQgPT09IFwiZ2V0dGVyXCIgPyBcImdldFwiIDoga2luZCA9PT0gXCJzZXR0ZXJcIiA/IFwic2V0XCIgOiBcInZhbHVlXCI7XHJcbiAgICB2YXIgdGFyZ2V0ID0gIWRlc2NyaXB0b3JJbiAmJiBjdG9yID8gY29udGV4dEluW1wic3RhdGljXCJdID8gY3RvciA6IGN0b3IucHJvdG90eXBlIDogbnVsbDtcclxuICAgIHZhciBkZXNjcmlwdG9yID0gZGVzY3JpcHRvckluIHx8ICh0YXJnZXQgPyBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgY29udGV4dEluLm5hbWUpIDoge30pO1xyXG4gICAgdmFyIF8sIGRvbmUgPSBmYWxzZTtcclxuICAgIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgICAgdmFyIGNvbnRleHQgPSB7fTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbikgY29udGV4dFtwXSA9IHAgPT09IFwiYWNjZXNzXCIgPyB7fSA6IGNvbnRleHRJbltwXTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbi5hY2Nlc3MpIGNvbnRleHQuYWNjZXNzW3BdID0gY29udGV4dEluLmFjY2Vzc1twXTtcclxuICAgICAgICBjb250ZXh0LmFkZEluaXRpYWxpemVyID0gZnVuY3Rpb24gKGYpIHsgaWYgKGRvbmUpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgYWRkIGluaXRpYWxpemVycyBhZnRlciBkZWNvcmF0aW9uIGhhcyBjb21wbGV0ZWRcIik7IGV4dHJhSW5pdGlhbGl6ZXJzLnB1c2goYWNjZXB0KGYgfHwgbnVsbCkpOyB9O1xyXG4gICAgICAgIHZhciByZXN1bHQgPSAoMCwgZGVjb3JhdG9yc1tpXSkoa2luZCA9PT0gXCJhY2Nlc3NvclwiID8geyBnZXQ6IGRlc2NyaXB0b3IuZ2V0LCBzZXQ6IGRlc2NyaXB0b3Iuc2V0IH0gOiBkZXNjcmlwdG9yW2tleV0sIGNvbnRleHQpO1xyXG4gICAgICAgIGlmIChraW5kID09PSBcImFjY2Vzc29yXCIpIHtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gdm9pZCAwKSBjb250aW51ZTtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCB8fCB0eXBlb2YgcmVzdWx0ICE9PSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkXCIpO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuZ2V0KSkgZGVzY3JpcHRvci5nZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuc2V0KSkgZGVzY3JpcHRvci5zZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuaW5pdCkpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChfID0gYWNjZXB0KHJlc3VsdCkpIHtcclxuICAgICAgICAgICAgaWYgKGtpbmQgPT09IFwiZmllbGRcIikgaW5pdGlhbGl6ZXJzLnVuc2hpZnQoXyk7XHJcbiAgICAgICAgICAgIGVsc2UgZGVzY3JpcHRvcltrZXldID0gXztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAodGFyZ2V0KSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBjb250ZXh0SW4ubmFtZSwgZGVzY3JpcHRvcik7XHJcbiAgICBkb25lID0gdHJ1ZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3J1bkluaXRpYWxpemVycyh0aGlzQXJnLCBpbml0aWFsaXplcnMsIHZhbHVlKSB7XHJcbiAgICB2YXIgdXNlVmFsdWUgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5pdGlhbGl6ZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFsdWUgPSB1c2VWYWx1ZSA/IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcsIHZhbHVlKSA6IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHVzZVZhbHVlID8gdmFsdWUgOiB2b2lkIDA7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wcm9wS2V5KHgpIHtcclxuICAgIHJldHVybiB0eXBlb2YgeCA9PT0gXCJzeW1ib2xcIiA/IHggOiBcIlwiLmNvbmNhdCh4KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NldEZ1bmN0aW9uTmFtZShmLCBuYW1lLCBwcmVmaXgpIHtcclxuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gXCJzeW1ib2xcIikgbmFtZSA9IG5hbWUuZGVzY3JpcHRpb24gPyBcIltcIi5jb25jYXQobmFtZS5kZXNjcmlwdGlvbiwgXCJdXCIpIDogXCJcIjtcclxuICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkoZiwgXCJuYW1lXCIsIHsgY29uZmlndXJhYmxlOiB0cnVlLCB2YWx1ZTogcHJlZml4ID8gXCJcIi5jb25jYXQocHJlZml4LCBcIiBcIiwgbmFtZSkgOiBuYW1lIH0pO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpIHtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5tZXRhZGF0YSA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gUmVmbGVjdC5tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0ZXIodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19nZW5lcmF0b3IodGhpc0FyZywgYm9keSkge1xyXG4gICAgdmFyIF8gPSB7IGxhYmVsOiAwLCBzZW50OiBmdW5jdGlvbigpIHsgaWYgKHRbMF0gJiAxKSB0aHJvdyB0WzFdOyByZXR1cm4gdFsxXTsgfSwgdHJ5czogW10sIG9wczogW10gfSwgZiwgeSwgdCwgZyA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBJdGVyYXRvciA9PT0gXCJmdW5jdGlvblwiID8gSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSk7XHJcbiAgICByZXR1cm4gZy5uZXh0ID0gdmVyYigwKSwgZ1tcInRocm93XCJdID0gdmVyYigxKSwgZ1tcInJldHVyblwiXSA9IHZlcmIoMiksIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoZyAmJiAoZyA9IDAsIG9wWzBdICYmIChfID0gMCkpLCBfKSB0cnkge1xyXG4gICAgICAgICAgICBpZiAoZiA9IDEsIHkgJiYgKHQgPSBvcFswXSAmIDIgPyB5W1wicmV0dXJuXCJdIDogb3BbMF0gPyB5W1widGhyb3dcIl0gfHwgKCh0ID0geVtcInJldHVyblwiXSkgJiYgdC5jYWxsKHkpLCAwKSA6IHkubmV4dCkgJiYgISh0ID0gdC5jYWxsKHksIG9wWzFdKSkuZG9uZSkgcmV0dXJuIHQ7XHJcbiAgICAgICAgICAgIGlmICh5ID0gMCwgdCkgb3AgPSBbb3BbMF0gJiAyLCB0LnZhbHVlXTtcclxuICAgICAgICAgICAgc3dpdGNoIChvcFswXSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAwOiBjYXNlIDE6IHQgPSBvcDsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDQ6IF8ubGFiZWwrKzsgcmV0dXJuIHsgdmFsdWU6IG9wWzFdLCBkb25lOiBmYWxzZSB9O1xyXG4gICAgICAgICAgICAgICAgY2FzZSA1OiBfLmxhYmVsKys7IHkgPSBvcFsxXTsgb3AgPSBbMF07IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA3OiBvcCA9IF8ub3BzLnBvcCgpOyBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBpZiAoISh0ID0gXy50cnlzLCB0ID0gdC5sZW5ndGggPiAwICYmIHRbdC5sZW5ndGggLSAxXSkgJiYgKG9wWzBdID09PSA2IHx8IG9wWzBdID09PSAyKSkgeyBfID0gMDsgY29udGludWU7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDMgJiYgKCF0IHx8IChvcFsxXSA+IHRbMF0gJiYgb3BbMV0gPCB0WzNdKSkpIHsgXy5sYWJlbCA9IG9wWzFdOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gNiAmJiBfLmxhYmVsIDwgdFsxXSkgeyBfLmxhYmVsID0gdFsxXTsgdCA9IG9wOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ICYmIF8ubGFiZWwgPCB0WzJdKSB7IF8ubGFiZWwgPSB0WzJdOyBfLm9wcy5wdXNoKG9wKTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodFsyXSkgXy5vcHMucG9wKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvcCA9IGJvZHkuY2FsbCh0aGlzQXJnLCBfKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7IG9wID0gWzYsIGVdOyB5ID0gMDsgfSBmaW5hbGx5IHsgZiA9IHQgPSAwOyB9XHJcbiAgICAgICAgaWYgKG9wWzBdICYgNSkgdGhyb3cgb3BbMV07IHJldHVybiB7IHZhbHVlOiBvcFswXSA/IG9wWzFdIDogdm9pZCAwLCBkb25lOiB0cnVlIH07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19jcmVhdGVCaW5kaW5nID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihtLCBrKTtcclxuICAgIGlmICghZGVzYyB8fCAoXCJnZXRcIiBpbiBkZXNjID8gIW0uX19lc01vZHVsZSA6IGRlc2Mud3JpdGFibGUgfHwgZGVzYy5jb25maWd1cmFibGUpKSB7XHJcbiAgICAgICAgZGVzYyA9IHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfTtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBrMiwgZGVzYyk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tLCBwYWNrKSB7XHJcbiAgICBpZiAocGFjayB8fCBhcmd1bWVudHMubGVuZ3RoID09PSAyKSBmb3IgKHZhciBpID0gMCwgbCA9IGZyb20ubGVuZ3RoLCBhcjsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmIChhciB8fCAhKGkgaW4gZnJvbSkpIHtcclxuICAgICAgICAgICAgaWYgKCFhcikgYXIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tLCAwLCBpKTtcclxuICAgICAgICAgICAgYXJbaV0gPSBmcm9tW2ldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0by5jb25jYXQoYXIgfHwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSkpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdCh2KSB7XHJcbiAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIF9fYXdhaXQgPyAodGhpcy52ID0gdiwgdGhpcykgOiBuZXcgX19hd2FpdCh2KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNHZW5lcmF0b3IodGhpc0FyZywgX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIGcgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSksIGksIHEgPSBbXTtcclxuICAgIHJldHVybiBpID0gT2JqZWN0LmNyZWF0ZSgodHlwZW9mIEFzeW5jSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEFzeW5jSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSksIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiwgYXdhaXRSZXR1cm4pLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiBhd2FpdFJldHVybihmKSB7IHJldHVybiBmdW5jdGlvbiAodikgeyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZiwgcmVqZWN0KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlmIChnW25dKSB7IGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IGlmIChmKSBpW25dID0gZihpW25dKTsgfSB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogZmFsc2UgfSA6IGYgPyBmKHYpIDogdjsgfSA6IGY7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNWYWx1ZXMobykge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBtID0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sIGk7XHJcbiAgICByZXR1cm4gbSA/IG0uY2FsbChvKSA6IChvID0gdHlwZW9mIF9fdmFsdWVzID09PSBcImZ1bmN0aW9uXCIgPyBfX3ZhbHVlcyhvKSA6IG9bU3ltYm9sLml0ZXJhdG9yXSgpLCBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaSk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaVtuXSA9IG9bbl0gJiYgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgdiA9IG9bbl0odiksIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHYuZG9uZSwgdi52YWx1ZSk7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCBkLCB2KSB7IFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGZ1bmN0aW9uKHYpIHsgcmVzb2x2ZSh7IHZhbHVlOiB2LCBkb25lOiBkIH0pOyB9LCByZWplY3QpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdykge1xyXG4gICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkgeyBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29va2VkLCBcInJhd1wiLCB7IHZhbHVlOiByYXcgfSk7IH0gZWxzZSB7IGNvb2tlZC5yYXcgPSByYXc7IH1cclxuICAgIHJldHVybiBjb29rZWQ7XHJcbn07XHJcblxyXG52YXIgX19zZXRNb2R1bGVEZWZhdWx0ID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgXCJkZWZhdWx0XCIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgdmFsdWU6IHYgfSk7XHJcbn0pIDogZnVuY3Rpb24obywgdikge1xyXG4gICAgb1tcImRlZmF1bHRcIl0gPSB2O1xyXG59O1xyXG5cclxudmFyIG93bktleXMgPSBmdW5jdGlvbihvKSB7XHJcbiAgICBvd25LZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgfHwgZnVuY3Rpb24gKG8pIHtcclxuICAgICAgICB2YXIgYXIgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBrIGluIG8pIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgaykpIGFyW2FyLmxlbmd0aF0gPSBrO1xyXG4gICAgICAgIHJldHVybiBhcjtcclxuICAgIH07XHJcbiAgICByZXR1cm4gb3duS2V5cyhvKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrID0gb3duS2V5cyhtb2QpLCBpID0gMDsgaSA8IGsubGVuZ3RoOyBpKyspIGlmIChrW2ldICE9PSBcImRlZmF1bHRcIikgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrW2ldKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRJbihzdGF0ZSwgcmVjZWl2ZXIpIHtcclxuICAgIGlmIChyZWNlaXZlciA9PT0gbnVsbCB8fCAodHlwZW9mIHJlY2VpdmVyICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiByZWNlaXZlciAhPT0gXCJmdW5jdGlvblwiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgJ2luJyBvcGVyYXRvciBvbiBub24tb2JqZWN0XCIpO1xyXG4gICAgcmV0dXJuIHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgPT09IHN0YXRlIDogc3RhdGUuaGFzKHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlKGVudiwgdmFsdWUsIGFzeW5jKSB7XHJcbiAgICBpZiAodmFsdWUgIT09IG51bGwgJiYgdmFsdWUgIT09IHZvaWQgMCkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgZXhwZWN0ZWQuXCIpO1xyXG4gICAgICAgIHZhciBkaXNwb3NlLCBpbm5lcjtcclxuICAgICAgICBpZiAoYXN5bmMpIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuYXN5bmNEaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jRGlzcG9zZSBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICAgICAgICAgIGRpc3Bvc2UgPSB2YWx1ZVtTeW1ib2wuYXN5bmNEaXNwb3NlXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGRpc3Bvc2UgPT09IHZvaWQgMCkge1xyXG4gICAgICAgICAgICBpZiAoIVN5bWJvbC5kaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmRpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmRpc3Bvc2VdO1xyXG4gICAgICAgICAgICBpZiAoYXN5bmMpIGlubmVyID0gZGlzcG9zZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkaXNwb3NlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3Qgbm90IGRpc3Bvc2FibGUuXCIpO1xyXG4gICAgICAgIGlmIChpbm5lcikgZGlzcG9zZSA9IGZ1bmN0aW9uKCkgeyB0cnkgeyBpbm5lci5jYWxsKHRoaXMpOyB9IGNhdGNoIChlKSB7IHJldHVybiBQcm9taXNlLnJlamVjdChlKTsgfSB9O1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgdmFsdWU6IHZhbHVlLCBkaXNwb3NlOiBkaXNwb3NlLCBhc3luYzogYXN5bmMgfSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChhc3luYykge1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgYXN5bmM6IHRydWUgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcblxyXG59XHJcblxyXG52YXIgX1N1cHByZXNzZWRFcnJvciA9IHR5cGVvZiBTdXBwcmVzc2VkRXJyb3IgPT09IFwiZnVuY3Rpb25cIiA/IFN1cHByZXNzZWRFcnJvciA6IGZ1bmN0aW9uIChlcnJvciwgc3VwcHJlc3NlZCwgbWVzc2FnZSkge1xyXG4gICAgdmFyIGUgPSBuZXcgRXJyb3IobWVzc2FnZSk7XHJcbiAgICByZXR1cm4gZS5uYW1lID0gXCJTdXBwcmVzc2VkRXJyb3JcIiwgZS5lcnJvciA9IGVycm9yLCBlLnN1cHByZXNzZWQgPSBzdXBwcmVzc2VkLCBlO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGlzcG9zZVJlc291cmNlcyhlbnYpIHtcclxuICAgIGZ1bmN0aW9uIGZhaWwoZSkge1xyXG4gICAgICAgIGVudi5lcnJvciA9IGVudi5oYXNFcnJvciA/IG5ldyBfU3VwcHJlc3NlZEVycm9yKGUsIGVudi5lcnJvciwgXCJBbiBlcnJvciB3YXMgc3VwcHJlc3NlZCBkdXJpbmcgZGlzcG9zYWwuXCIpIDogZTtcclxuICAgICAgICBlbnYuaGFzRXJyb3IgPSB0cnVlO1xyXG4gICAgfVxyXG4gICAgdmFyIHIsIHMgPSAwO1xyXG4gICAgZnVuY3Rpb24gbmV4dCgpIHtcclxuICAgICAgICB3aGlsZSAociA9IGVudi5zdGFjay5wb3AoKSkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFyLmFzeW5jICYmIHMgPT09IDEpIHJldHVybiBzID0gMCwgZW52LnN0YWNrLnB1c2gociksIFByb21pc2UucmVzb2x2ZSgpLnRoZW4obmV4dCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoci5kaXNwb3NlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHIuZGlzcG9zZS5jYWxsKHIudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChyLmFzeW5jKSByZXR1cm4gcyB8PSAyLCBQcm9taXNlLnJlc29sdmUocmVzdWx0KS50aGVuKG5leHQsIGZ1bmN0aW9uKGUpIHsgZmFpbChlKTsgcmV0dXJuIG5leHQoKTsgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHMgfD0gMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgZmFpbChlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocyA9PT0gMSkgcmV0dXJuIGVudi5oYXNFcnJvciA/IFByb21pc2UucmVqZWN0KGVudi5lcnJvcikgOiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgICBpZiAoZW52Lmhhc0Vycm9yKSB0aHJvdyBlbnYuZXJyb3I7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV4dCgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24ocGF0aCwgcHJlc2VydmVKc3gpIHtcclxuICAgIGlmICh0eXBlb2YgcGF0aCA9PT0gXCJzdHJpbmdcIiAmJiAvXlxcLlxcLj9cXC8vLnRlc3QocGF0aCkpIHtcclxuICAgICAgICByZXR1cm4gcGF0aC5yZXBsYWNlKC9cXC4odHN4KSR8KCg/OlxcLmQpPykoKD86XFwuW14uL10rPyk/KVxcLihbY21dPyl0cyQvaSwgZnVuY3Rpb24gKG0sIHRzeCwgZCwgZXh0LCBjbSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHN4ID8gcHJlc2VydmVKc3ggPyBcIi5qc3hcIiA6IFwiLmpzXCIgOiBkICYmICghZXh0IHx8ICFjbSkgPyBtIDogKGQgKyBleHQgKyBcIi5cIiArIGNtLnRvTG93ZXJDYXNlKCkgKyBcImpzXCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBhdGg7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIF9fZXh0ZW5kczogX19leHRlbmRzLFxyXG4gICAgX19hc3NpZ246IF9fYXNzaWduLFxyXG4gICAgX19yZXN0OiBfX3Jlc3QsXHJcbiAgICBfX2RlY29yYXRlOiBfX2RlY29yYXRlLFxyXG4gICAgX19wYXJhbTogX19wYXJhbSxcclxuICAgIF9fZXNEZWNvcmF0ZTogX19lc0RlY29yYXRlLFxyXG4gICAgX19ydW5Jbml0aWFsaXplcnM6IF9fcnVuSW5pdGlhbGl6ZXJzLFxyXG4gICAgX19wcm9wS2V5OiBfX3Byb3BLZXksXHJcbiAgICBfX3NldEZ1bmN0aW9uTmFtZTogX19zZXRGdW5jdGlvbk5hbWUsXHJcbiAgICBfX21ldGFkYXRhOiBfX21ldGFkYXRhLFxyXG4gICAgX19hd2FpdGVyOiBfX2F3YWl0ZXIsXHJcbiAgICBfX2dlbmVyYXRvcjogX19nZW5lcmF0b3IsXHJcbiAgICBfX2NyZWF0ZUJpbmRpbmc6IF9fY3JlYXRlQmluZGluZyxcclxuICAgIF9fZXhwb3J0U3RhcjogX19leHBvcnRTdGFyLFxyXG4gICAgX192YWx1ZXM6IF9fdmFsdWVzLFxyXG4gICAgX19yZWFkOiBfX3JlYWQsXHJcbiAgICBfX3NwcmVhZDogX19zcHJlYWQsXHJcbiAgICBfX3NwcmVhZEFycmF5czogX19zcHJlYWRBcnJheXMsXHJcbiAgICBfX3NwcmVhZEFycmF5OiBfX3NwcmVhZEFycmF5LFxyXG4gICAgX19hd2FpdDogX19hd2FpdCxcclxuICAgIF9fYXN5bmNHZW5lcmF0b3I6IF9fYXN5bmNHZW5lcmF0b3IsXHJcbiAgICBfX2FzeW5jRGVsZWdhdG9yOiBfX2FzeW5jRGVsZWdhdG9yLFxyXG4gICAgX19hc3luY1ZhbHVlczogX19hc3luY1ZhbHVlcyxcclxuICAgIF9fbWFrZVRlbXBsYXRlT2JqZWN0OiBfX21ha2VUZW1wbGF0ZU9iamVjdCxcclxuICAgIF9faW1wb3J0U3RhcjogX19pbXBvcnRTdGFyLFxyXG4gICAgX19pbXBvcnREZWZhdWx0OiBfX2ltcG9ydERlZmF1bHQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0OiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldDogX19jbGFzc1ByaXZhdGVGaWVsZFNldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRJbjogX19jbGFzc1ByaXZhdGVGaWVsZEluLFxyXG4gICAgX19hZGREaXNwb3NhYmxlUmVzb3VyY2U6IF9fYWRkRGlzcG9zYWJsZVJlc291cmNlLFxyXG4gICAgX19kaXNwb3NlUmVzb3VyY2VzOiBfX2Rpc3Bvc2VSZXNvdXJjZXMsXHJcbiAgICBfX3Jld3JpdGVSZWxhdGl2ZUltcG9ydEV4dGVuc2lvbjogX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24sXHJcbn07XHJcbiIsImltcG9ydCB7IEFwcCwgSXRlbVZpZXcsIE1vZGFsLCBOb3RpY2UsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgVEZpbGUsIFdvcmtzcGFjZUxlYWYsIFRleHRBcmVhQ29tcG9uZW50LCBCdXR0b25Db21wb25lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgKiBhcyBUU05FIGZyb20gJ3RzbmUtanMnO1xuXG4vLyBJbnRlcmZhY2UgZm9yIG5vdGUgY29ubmVjdGlvbnNcbmludGVyZmFjZSBOb3RlQ29ubmVjdGlvbiB7XG4gIHNvdXJjZU5vdGU6IFRTTkVQb2ludDtcbiAgdGFyZ2V0Tm90ZTogVFNORVBvaW50O1xuICBzaW1pbGFyaXR5OiBudW1iZXI7XG4gIGNvbW1vblRlcm1zOiBzdHJpbmdbXTtcbiAgY2x1c3RlclRlcm1zOiBzdHJpbmdbXTtcbiAgcmVhc29uOiBzdHJpbmc7XG4gIGxsbURlc2NyaXB0aW9uPzogc3RyaW5nO1xufVxuXG4vLyBNb2RhbCBmb3IgZGlzcGxheWluZyBhbmQgcHJvY2Vzc2luZyBzdWdnZXN0ZWQgbGlua3NcbmNsYXNzIFN1Z2dlc3RlZExpbmtzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIHByaXZhdGUgY29ubmVjdGlvbnM6IE5vdGVDb25uZWN0aW9uW107XG4gIHByaXZhdGUgcGx1Z2luOiBWaWJlQm95UGx1Z2luO1xuICBwcml2YXRlIHNlbGVjdGVkQ29ubmVjdGlvbkluZGV4OiBudW1iZXIgPSAwO1xuICBwcml2YXRlIHByb2Nlc3NpbmdDb25uZWN0aW9uOiBib29sZWFuID0gZmFsc2U7XG4gIFxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgY29ubmVjdGlvbnM6IE5vdGVDb25uZWN0aW9uW10sIHBsdWdpbjogVmliZUJveVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5jb25uZWN0aW9ucyA9IGNvbm5lY3Rpb25zO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG4gIFxuICBhc3luYyBvbk9wZW4oKSB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgXG4gICAgLy8gU2V0IG1vZGFsIHRpdGxlXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1N1Z2dlc3RlZCBOb3RlIENvbm5lY3Rpb25zJyB9KTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IFxuICAgICAgdGV4dDogJ0JlbG93IGFyZSBwb3RlbnRpYWwgY29ubmVjdGlvbnMgYmV0d2VlbiBub3RlcyBiYXNlZCBvbiBjb250ZW50IHNpbWlsYXJpdHkuICcgK1xuICAgICAgICAgICAgJ1NlbGVjdCBhIGNvbm5lY3Rpb24gYW5kIGdlbmVyYXRlIGEgZGVzY3JpcHRpb24gdG8gY3JlYXRlIGEgbGluayBiZXR3ZWVuIHRoZSBub3Rlcy4nXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQ3JlYXRlIGNvbnRhaW5lciBmb3IgY29ubmVjdGlvbnMgbGlzdFxuICAgIGNvbnN0IGNvbm5lY3Rpb25zQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Nvbm5lY3Rpb25zLWNvbnRhaW5lcicgfSk7XG4gICAgXG4gICAgLy8gQ3JlYXRlIGNvbnRhaW5lciBmb3Igc2VsZWN0ZWQgY29ubmVjdGlvbiBkZXRhaWxzXG4gICAgY29uc3QgZGV0YWlsc0NvbnRhaW5lciA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdjb25uZWN0aW9uLWRldGFpbHMnIH0pO1xuICAgIFxuICAgIC8vIEFkZCBzb21lIENTU1xuICAgIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBzdHlsZS50ZXh0Q29udGVudCA9IGBcbiAgICAgIC5jb25uZWN0aW9ucy1jb250YWluZXIge1xuICAgICAgICBtYXgtaGVpZ2h0OiAxNTBweDtcbiAgICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTVweDtcbiAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICB9XG4gICAgICAuY29ubmVjdGlvbi1pdGVtIHtcbiAgICAgICAgcGFkZGluZzogOHB4IDEycHg7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyKTtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLWl0ZW06aG92ZXIge1xuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1iYWNrZ3JvdW5kLXNlY29uZGFyeSk7XG4gICAgICB9XG4gICAgICAuY29ubmVjdGlvbi1pdGVtLnNlbGVjdGVkIHtcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KTtcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtb24tYWNjZW50KTtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLWRldGFpbHMge1xuICAgICAgICBwYWRkaW5nOiAxMHB4O1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlcik7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTVweDtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLXN0YXRzIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuICAgICAgfVxuICAgICAgLmdlbmVyYXRlLWJ1dHRvbiB7XG4gICAgICAgIG1hcmdpbi10b3A6IDEwcHg7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7XG4gICAgICB9XG4gICAgICAubGxtLWRlc2NyaXB0aW9uIHtcbiAgICAgICAgbWFyZ2luLXRvcDogMTBweDtcbiAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgIG1pbi1oZWlnaHQ6IDEwMHB4O1xuICAgICAgfVxuICAgICAgLmJ1dHRvbi1jb250YWluZXIge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgIG1hcmdpbi10b3A6IDE1cHg7XG4gICAgICB9XG4gICAgYDtcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICBcbiAgICAvLyBSZW5kZXIgY29ubmVjdGlvbnMgbGlzdFxuICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbnNMaXN0KGNvbm5lY3Rpb25zQ29udGFpbmVyKTtcbiAgICBcbiAgICAvLyBSZW5kZXIgZGV0YWlscyBmb3IgdGhlIGZpcnN0IGNvbm5lY3Rpb25cbiAgICB0aGlzLnJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKGRldGFpbHNDb250YWluZXIsIHRoaXMuY29ubmVjdGlvbnNbMF0pO1xuICAgIFxuICAgIC8vIEZvY3VzIHRoZSBmaXJzdCBjb25uZWN0aW9uXG4gICAgdGhpcy5zZWxlY3RDb25uZWN0aW9uKDApO1xuICB9XG4gIFxuICBwcml2YXRlIHJlbmRlckNvbm5lY3Rpb25zTGlzdChjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgXG4gICAgdGhpcy5jb25uZWN0aW9ucy5mb3JFYWNoKChjb25uZWN0aW9uLCBpbmRleCkgPT4ge1xuICAgICAgY29uc3QgaXRlbSA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICdjb25uZWN0aW9uLWl0ZW0nIH0pO1xuICAgICAgaWYgKGluZGV4ID09PSB0aGlzLnNlbGVjdGVkQ29ubmVjdGlvbkluZGV4KSB7XG4gICAgICAgIGl0ZW0uYWRkQ2xhc3MoJ3NlbGVjdGVkJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNvdXJjZVRpdGxlID0gY29ubmVjdGlvbi5zb3VyY2VOb3RlLnRpdGxlO1xuICAgICAgY29uc3QgdGFyZ2V0VGl0bGUgPSBjb25uZWN0aW9uLnRhcmdldE5vdGUudGl0bGU7XG4gICAgICBjb25zdCBzaW1pbGFyaXR5ID0gTWF0aC5yb3VuZChjb25uZWN0aW9uLnNpbWlsYXJpdHkpO1xuICAgICAgXG4gICAgICBpdGVtLmNyZWF0ZUVsKCdkaXYnLCB7IHRleHQ6IGAke3NvdXJjZVRpdGxlfSDihpQgJHt0YXJnZXRUaXRsZX0gKCR7c2ltaWxhcml0eX0lIHNpbWlsYXJpdHkpYCB9KTtcbiAgICAgIFxuICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgdGhpcy5zZWxlY3RDb25uZWN0aW9uKGluZGV4KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIFxuICBwcml2YXRlIHJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGNvbm5lY3Rpb246IE5vdGVDb25uZWN0aW9uKSB7XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgXG4gICAgY29uc3Qgc291cmNlTm90ZSA9IGNvbm5lY3Rpb24uc291cmNlTm90ZTtcbiAgICBjb25zdCB0YXJnZXROb3RlID0gY29ubmVjdGlvbi50YXJnZXROb3RlO1xuICAgIFxuICAgIC8vIE5vdGUgdGl0bGVzIGFuZCBwYXRoc1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6IGBDb25uZWN0aW9uOiAke3NvdXJjZU5vdGUudGl0bGV9IOKGlCAke3RhcmdldE5vdGUudGl0bGV9YCB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYFNvdXJjZTogJHtzb3VyY2VOb3RlLnBhdGh9YCB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYFRhcmdldDogJHt0YXJnZXROb3RlLnBhdGh9YCB9KTtcbiAgICBcbiAgICAvLyBTdGF0c1xuICAgIGNvbnN0IHN0YXRzRGl2ID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ2Nvbm5lY3Rpb24tc3RhdHMnIH0pO1xuICAgIHN0YXRzRGl2LmNyZWF0ZUVsKCdkaXYnLCB7IHRleHQ6IGBTaW1pbGFyaXR5OiAke01hdGgucm91bmQoY29ubmVjdGlvbi5zaW1pbGFyaXR5KX0lYCB9KTtcbiAgICBzdGF0c0Rpdi5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgJHtzb3VyY2VOb3RlLndvcmRDb3VudCB8fCAnPyd9IHdvcmRzIC8gJHt0YXJnZXROb3RlLndvcmRDb3VudCB8fCAnPyd9IHdvcmRzYCB9KTtcbiAgICBcbiAgICAvLyBTaGFyZWQgdGVybXNcbiAgICBpZiAoY29ubmVjdGlvbi5jb21tb25UZXJtcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYENvbW1vbiB0ZXJtczogJHtjb25uZWN0aW9uLmNvbW1vblRlcm1zLmpvaW4oJywgJyl9YCB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ2x1c3RlciB0ZXJtc1xuICAgIGlmIChjb25uZWN0aW9uLmNsdXN0ZXJUZXJtcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYENsdXN0ZXIgdGVybXM6ICR7Y29ubmVjdGlvbi5jbHVzdGVyVGVybXMuam9pbignLCAnKX1gIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyBSZWFzb24gZm9yIGNvbm5lY3Rpb25cbiAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYENvbm5lY3Rpb24gcmVhc29uOiAke2Nvbm5lY3Rpb24ucmVhc29ufWAgfSk7XG4gICAgXG4gICAgLy8gR2VuZXJhdGUgZGVzY3JpcHRpb24gYnV0dG9uXG4gICAgY29uc3QgZ2VuZXJhdGVCdXR0b24gPSBuZXcgQnV0dG9uQ29tcG9uZW50KGNvbnRhaW5lcilcbiAgICAgIC5zZXRCdXR0b25UZXh0KCdHZW5lcmF0ZSBDb25uZWN0aW9uIERlc2NyaXB0aW9uJylcbiAgICAgIC5zZXRDdGEoKSAvLyBVc2Ugc2V0Q3RhKCkgaW5zdGVhZCBvZiBzZXRDbGFzcyB3aXRoIHNwYWNlc1xuICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLmdlbmVyYXRlTExNRGVzY3JpcHRpb24oY29ubmVjdGlvbik7XG4gICAgICB9KTtcbiAgICBcbiAgICAvLyBBZGQgY2xhc3Mgd2l0aG91dCBzcGFjZXNcbiAgICBnZW5lcmF0ZUJ1dHRvbi5idXR0b25FbC5hZGRDbGFzcygnZ2VuZXJhdGUtYnV0dG9uJyk7XG4gICAgXG4gICAgaWYgKHRoaXMucHJvY2Vzc2luZ0Nvbm5lY3Rpb24pIHtcbiAgICAgIGdlbmVyYXRlQnV0dG9uLnNldERpc2FibGVkKHRydWUpO1xuICAgICAgZ2VuZXJhdGVCdXR0b24uc2V0QnV0dG9uVGV4dCgnR2VuZXJhdGluZy4uLicpO1xuICAgIH1cbiAgICBcbiAgICAvLyBEZXNjcmlwdGlvbiB0ZXh0IGFyZWFcbiAgICBpZiAoY29ubmVjdGlvbi5sbG1EZXNjcmlwdGlvbikge1xuICAgICAgY29uc3QgZGVzY3JpcHRpb25Db250YWluZXIgPSBjb250YWluZXIuY3JlYXRlRGl2KCk7XG4gICAgICBkZXNjcmlwdGlvbkNvbnRhaW5lci5jcmVhdGVFbCgnaDQnLCB7IHRleHQ6ICdDb25uZWN0aW9uIERlc2NyaXB0aW9uOicgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRleHRBcmVhID0gbmV3IFRleHRBcmVhQ29tcG9uZW50KGRlc2NyaXB0aW9uQ29udGFpbmVyKVxuICAgICAgICAuc2V0VmFsdWUoY29ubmVjdGlvbi5sbG1EZXNjcmlwdGlvbilcbiAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdDb25uZWN0aW9uIGRlc2NyaXB0aW9uIHdpbGwgYXBwZWFyIGhlcmUuLi4nKTtcbiAgICAgIFxuICAgICAgdGV4dEFyZWEuaW5wdXRFbC5hZGRDbGFzcygnbGxtLWRlc2NyaXB0aW9uJyk7XG4gICAgICBcbiAgICAgIC8vIENyZWF0ZSBidXR0b25cbiAgICAgIGNvbnN0IGJ1dHRvbkNvbnRhaW5lciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICdidXR0b24tY29udGFpbmVyJyB9KTtcbiAgICAgIFxuICAgICAgbmV3IEJ1dHRvbkNvbXBvbmVudChidXR0b25Db250YWluZXIpXG4gICAgICAgIC5zZXRCdXR0b25UZXh0KCdDcmVhdGUgTGluaycpXG4gICAgICAgIC5zZXRDdGEoKSAvLyBVc2Ugc2V0Q3RhKCkgaW5zdGVhZCBvZiBzZXRDbGFzcyB3aXRoIHNwYWNlc1xuICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5jcmVhdGVMaW5rKGNvbm5lY3Rpb24sIHRleHRBcmVhLmdldFZhbHVlKCkpO1xuICAgICAgICB9KTtcbiAgICAgIFxuICAgICAgbmV3IEJ1dHRvbkNvbXBvbmVudChidXR0b25Db250YWluZXIpXG4gICAgICAgIC5zZXRCdXR0b25UZXh0KCdFZGl0IERlc2NyaXB0aW9uJylcbiAgICAgICAgLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgIHRleHRBcmVhLnNldERpc2FibGVkKGZhbHNlKTtcbiAgICAgICAgICB0ZXh0QXJlYS5pbnB1dEVsLmZvY3VzKCk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBzZWxlY3RDb25uZWN0aW9uKGluZGV4OiBudW1iZXIpIHtcbiAgICBpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMuY29ubmVjdGlvbnMubGVuZ3RoKSByZXR1cm47XG4gICAgXG4gICAgdGhpcy5zZWxlY3RlZENvbm5lY3Rpb25JbmRleCA9IGluZGV4O1xuICAgIGNvbnN0IGNvbm5lY3Rpb25Db250YWluZXIgPSB0aGlzLmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKCcuY29ubmVjdGlvbnMtY29udGFpbmVyJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgY29uc3QgZGV0YWlsc0NvbnRhaW5lciA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJy5jb25uZWN0aW9uLWRldGFpbHMnKSBhcyBIVE1MRWxlbWVudDtcbiAgICBcbiAgICBpZiAoY29ubmVjdGlvbkNvbnRhaW5lciAmJiBkZXRhaWxzQ29udGFpbmVyKSB7XG4gICAgICB0aGlzLnJlbmRlckNvbm5lY3Rpb25zTGlzdChjb25uZWN0aW9uQ29udGFpbmVyKTtcbiAgICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoZGV0YWlsc0NvbnRhaW5lciwgdGhpcy5jb25uZWN0aW9uc1tpbmRleF0pO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBnZW5lcmF0ZUxMTURlc2NyaXB0aW9uKGNvbm5lY3Rpb246IE5vdGVDb25uZWN0aW9uKSB7XG4gICAgaWYgKHRoaXMucHJvY2Vzc2luZ0Nvbm5lY3Rpb24pIHJldHVybjtcbiAgICBcbiAgICB0aGlzLnByb2Nlc3NpbmdDb25uZWN0aW9uID0gdHJ1ZTtcbiAgICBjb25zdCBkZXRhaWxzQ29udGFpbmVyID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignLmNvbm5lY3Rpb24tZGV0YWlscycpIGFzIEhUTUxFbGVtZW50O1xuICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoZGV0YWlsc0NvbnRhaW5lciwgY29ubmVjdGlvbik7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIEZldGNoIHNvdXJjZSBhbmQgdGFyZ2V0IG5vdGUgY29udGVudFxuICAgICAgY29uc3Qgc291cmNlRmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb25uZWN0aW9uLnNvdXJjZU5vdGUucGF0aCk7XG4gICAgICBjb25zdCB0YXJnZXRGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbm5lY3Rpb24udGFyZ2V0Tm90ZS5wYXRoKTtcbiAgICAgIFxuICAgICAgaWYgKCEoc291cmNlRmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB8fCAhKHRhcmdldEZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBub3RlIGZpbGVzJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKHNvdXJjZUZpbGUpO1xuICAgICAgY29uc3QgdGFyZ2V0Q29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQodGFyZ2V0RmlsZSk7XG4gICAgICBcbiAgICAgIC8vIFByZXBhcmUgZGF0YSBmb3IgTExNIGNhbGxcbiAgICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgIHNvdXJjZU5vdGU6IHtcbiAgICAgICAgICB0aXRsZTogY29ubmVjdGlvbi5zb3VyY2VOb3RlLnRpdGxlLFxuICAgICAgICAgIGNvbnRlbnQ6IHNvdXJjZUNvbnRlbnQuc3Vic3RyaW5nKDAsIDEwMDApLCAvLyBMaW1pdCB0byBmaXJzdCAxMDAwIGNoYXJzXG4gICAgICAgICAgdG9wVGVybXM6IGNvbm5lY3Rpb24uc291cmNlTm90ZS50b3BfdGVybXNcbiAgICAgICAgfSxcbiAgICAgICAgdGFyZ2V0Tm90ZToge1xuICAgICAgICAgIHRpdGxlOiBjb25uZWN0aW9uLnRhcmdldE5vdGUudGl0bGUsXG4gICAgICAgICAgY29udGVudDogdGFyZ2V0Q29udGVudC5zdWJzdHJpbmcoMCwgMTAwMCksIC8vIExpbWl0IHRvIGZpcnN0IDEwMDAgY2hhcnNcbiAgICAgICAgICB0b3BUZXJtczogY29ubmVjdGlvbi50YXJnZXROb3RlLnRvcF90ZXJtc1xuICAgICAgICB9LFxuICAgICAgICBjb21tb25UZXJtczogY29ubmVjdGlvbi5jb21tb25UZXJtcyxcbiAgICAgICAgY2x1c3RlclRlcm1zOiBjb25uZWN0aW9uLmNsdXN0ZXJUZXJtcyxcbiAgICAgICAgcmVhc29uOiBjb25uZWN0aW9uLnJlYXNvblxuICAgICAgfTtcbiAgICAgIFxuICAgICAgLy8gQ2FsbCB0aGUgTExNIHNlcnZpY2VcbiAgICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gYXdhaXQgdGhpcy5jYWxsTExNU2VydmljZShkYXRhKTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIHRoZSBjb25uZWN0aW9uIHdpdGggdGhlIGdlbmVyYXRlZCBkZXNjcmlwdGlvblxuICAgICAgY29ubmVjdGlvbi5sbG1EZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgdGhlIFVJXG4gICAgICB0aGlzLnByb2Nlc3NpbmdDb25uZWN0aW9uID0gZmFsc2U7XG4gICAgICBjb25zdCBkZXRhaWxzQ29udGFpbmVyID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignLmNvbm5lY3Rpb24tZGV0YWlscycpIGFzIEhUTUxFbGVtZW50O1xuICAgICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uRGV0YWlscyhkZXRhaWxzQ29udGFpbmVyLCBjb25uZWN0aW9uKTtcbiAgICAgIFxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLnByb2Nlc3NpbmdDb25uZWN0aW9uID0gZmFsc2U7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZW5lcmF0aW5nIGRlc2NyaXB0aW9uOicsIGVycm9yKTtcbiAgICAgIG5ldyBOb3RpY2UoYEZhaWxlZCB0byBnZW5lcmF0ZSBkZXNjcmlwdGlvbjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgVUkgdG8gc2hvdyBlcnJvclxuICAgICAgY29uc3QgZGV0YWlsc0NvbnRhaW5lciA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJy5jb25uZWN0aW9uLWRldGFpbHMnKSBhcyBIVE1MRWxlbWVudDtcbiAgICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoZGV0YWlsc0NvbnRhaW5lciwgY29ubmVjdGlvbik7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGNhbGxMTE1TZXJ2aWNlKGRhdGE6IGFueSk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIFRyeSB0byBjb25uZWN0IHRvIHRoZSBsb2NhbCBMTE0gQVBJIHNlcnZlclxuICAgICAgY29uc3Qgc291cmNlVGl0bGUgPSBkYXRhLnNvdXJjZU5vdGUudGl0bGU7XG4gICAgICBjb25zdCB0YXJnZXRUaXRsZSA9IGRhdGEudGFyZ2V0Tm90ZS50aXRsZTtcbiAgICAgIGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBkYXRhLnNvdXJjZU5vdGUuY29udGVudDtcbiAgICAgIGNvbnN0IHRhcmdldENvbnRlbnQgPSBkYXRhLnRhcmdldE5vdGUuY29udGVudDtcbiAgICAgIGNvbnN0IGNvbW1vblRlcm1zID0gZGF0YS5jb21tb25UZXJtcy5qb2luKCcsICcpO1xuICAgICAgY29uc3QgY2x1c3RlclRlcm1zID0gZGF0YS5jbHVzdGVyVGVybXMuam9pbignLCAnKTtcbiAgICAgIFxuICAgICAgLy8gRmlyc3QsIHRyeSB0byB1c2UgdGhlIFB5dGhvbiBzZXJ2ZXIncyBMTE0gaW50ZWdyYXRpb25cbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJ2h0dHA6Ly8xMjcuMC4wLjE6MTIzNC9nZW5lcmF0ZV9jb25uZWN0aW9uJywge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBzb3VyY2Vfbm90ZToge1xuICAgICAgICAgICAgdGl0bGU6IHNvdXJjZVRpdGxlLFxuICAgICAgICAgICAgY29udGVudDogc291cmNlQ29udGVudCxcbiAgICAgICAgICAgIHRlcm1zOiBkYXRhLnNvdXJjZU5vdGUudG9wVGVybXNcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRhcmdldF9ub3RlOiB7XG4gICAgICAgICAgICB0aXRsZTogdGFyZ2V0VGl0bGUsXG4gICAgICAgICAgICBjb250ZW50OiB0YXJnZXRDb250ZW50LFxuICAgICAgICAgICAgdGVybXM6IGRhdGEudGFyZ2V0Tm90ZS50b3BUZXJtc1xuICAgICAgICAgIH0sXG4gICAgICAgICAgY29tbW9uX3Rlcm1zOiBkYXRhLmNvbW1vblRlcm1zLFxuICAgICAgICAgIGNsdXN0ZXJfdGVybXM6IGRhdGEuY2x1c3RlclRlcm1zXG4gICAgICAgIH0pXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgaWYgKHJlc3VsdC5kZXNjcmlwdGlvbikge1xuICAgICAgICAgIHJldHVybiByZXN1bHQuZGVzY3JpcHRpb247XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gSWYgc2VydmVyIGNhbGwgZmFpbHMgb3Igbm90IGF2YWlsYWJsZSwgdXNlIGZhbGxiYWNrIGxvZ2ljXG4gICAgICBjb25zb2xlLmxvZyhcIlVzaW5nIGZhbGxiYWNrIGNvbm5lY3Rpb24gZGVzY3JpcHRpb24gZ2VuZXJhdGlvblwiKTtcbiAgICAgIFxuICAgICAgLy8gQ3JlYXRlIGEgdGVtcGxhdGUtYmFzZWQgZGVzY3JpcHRpb24gKGZhbGxiYWNrKVxuICAgICAgbGV0IGRlc2NyaXB0aW9uID0gJyc7XG4gICAgICBcbiAgICAgIGlmIChjb21tb25UZXJtcykge1xuICAgICAgICBkZXNjcmlwdGlvbiArPSBgVGhlc2Ugbm90ZXMgc2hhcmUgY29uY2VwdHVhbCBvdmVybGFwIGFyb3VuZCAke2NvbW1vblRlcm1zfS4gYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlc2NyaXB0aW9uICs9IGBUaGVzZSBub3RlcyBhcHBlYXIgdG8gYmUgY29uY2VwdHVhbGx5IHJlbGF0ZWQuIGA7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGRlc2NyaXB0aW9uICs9IGBUaGUgbm90ZSBcIiR7dGFyZ2V0VGl0bGV9XCIgcHJvdmlkZXMgY29tcGxlbWVudGFyeSBpbmZvcm1hdGlvbiB0aGF0IGV4cGFuZHMgb24gaWRlYXMgaW4gXCIke3NvdXJjZVRpdGxlfVwiYDtcbiAgICAgIFxuICAgICAgaWYgKGNsdXN0ZXJUZXJtcykge1xuICAgICAgICBkZXNjcmlwdGlvbiArPSBgLCBwYXJ0aWN1bGFybHkgcmVnYXJkaW5nICR7Y2x1c3RlclRlcm1zfS5gO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVzY3JpcHRpb24gKz0gJy4nO1xuICAgICAgfVxuICAgICAgXG4gICAgICByZXR1cm4gZGVzY3JpcHRpb247XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNhbGxpbmcgTExNIHNlcnZpY2U6JywgZXJyb3IpO1xuICAgICAgXG4gICAgICAvLyBSZXR1cm4gYSBiYXNpYyBkZXNjcmlwdGlvbiBhcyBmYWxsYmFja1xuICAgICAgcmV0dXJuIGBUaGVzZSBub3RlcyBhcHBlYXIgdG8gYmUgcmVsYXRlZCBpbiB0aGVpciBjb250ZW50LiBUaGUgbm90ZSBcIiR7ZGF0YS50YXJnZXROb3RlLnRpdGxlfVwiIGNvbXBsZW1lbnRzIFwiJHtkYXRhLnNvdXJjZU5vdGUudGl0bGV9XCIgd2l0aCBhZGRpdGlvbmFsIHJlbGV2YW50IGluZm9ybWF0aW9uLmA7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGFzeW5jIGNyZWF0ZUxpbmsoY29ubmVjdGlvbjogTm90ZUNvbm5lY3Rpb24sIGRlc2NyaXB0aW9uOiBzdHJpbmcpIHtcbiAgICBpZiAoIWRlc2NyaXB0aW9uIHx8IGRlc2NyaXB0aW9uLnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAgIG5ldyBOb3RpY2UoJ1BsZWFzZSBnZW5lcmF0ZSBvciBwcm92aWRlIGEgZGVzY3JpcHRpb24gZm9yIHRoZSBjb25uZWN0aW9uJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCB0aGlzLnBsdWdpbi5jcmVhdGVOb3RlTGluayhcbiAgICAgIGNvbm5lY3Rpb24uc291cmNlTm90ZS5wYXRoLFxuICAgICAgY29ubmVjdGlvbi50YXJnZXROb3RlLnBhdGgsXG4gICAgICBkZXNjcmlwdGlvblxuICAgICk7XG4gICAgXG4gICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgIG5ldyBOb3RpY2UoYFN1Y2Nlc3NmdWxseSBsaW5rZWQgJHtjb25uZWN0aW9uLnNvdXJjZU5vdGUudGl0bGV9IHRvICR7Y29ubmVjdGlvbi50YXJnZXROb3RlLnRpdGxlfWApO1xuICAgICAgXG4gICAgICAvLyBSZW1vdmUgdGhpcyBjb25uZWN0aW9uIGZyb20gdGhlIGxpc3RcbiAgICAgIHRoaXMuY29ubmVjdGlvbnMgPSB0aGlzLmNvbm5lY3Rpb25zLmZpbHRlcigoXywgaW5kZXgpID0+IGluZGV4ICE9PSB0aGlzLnNlbGVjdGVkQ29ubmVjdGlvbkluZGV4KTtcbiAgICAgIFxuICAgICAgaWYgKHRoaXMuY29ubmVjdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIE5vIG1vcmUgY29ubmVjdGlvbnMsIGNsb3NlIHRoZSBtb2RhbFxuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gU2VsZWN0IHRoZSBuZXh0IGNvbm5lY3Rpb25cbiAgICAgIHRoaXMuc2VsZWN0ZWRDb25uZWN0aW9uSW5kZXggPSBNYXRoLm1pbih0aGlzLnNlbGVjdGVkQ29ubmVjdGlvbkluZGV4LCB0aGlzLmNvbm5lY3Rpb25zLmxlbmd0aCAtIDEpO1xuICAgICAgXG4gICAgICAvLyBVcGRhdGUgdGhlIFVJXG4gICAgICBjb25zdCBjb25uZWN0aW9uQ29udGFpbmVyID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignLmNvbm5lY3Rpb25zLWNvbnRhaW5lcicpIGFzIEhUTUxFbGVtZW50O1xuICAgICAgY29uc3QgZGV0YWlsc0NvbnRhaW5lciA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJy5jb25uZWN0aW9uLWRldGFpbHMnKSBhcyBIVE1MRWxlbWVudDtcbiAgICAgIFxuICAgICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uc0xpc3QoY29ubmVjdGlvbkNvbnRhaW5lcik7XG4gICAgICB0aGlzLnJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKFxuICAgICAgICBkZXRhaWxzQ29udGFpbmVyLCBcbiAgICAgICAgdGhpcy5jb25uZWN0aW9uc1t0aGlzLnNlbGVjdGVkQ29ubmVjdGlvbkluZGV4XVxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgXG4gIG9uQ2xvc2UoKSB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gIH1cbn1cblxuLy8gRGVmaW5lIHRoZSB2aWV3IHR5cGUgZm9yIG91ciB2aXN1YWxpemF0aW9uXG5jb25zdCBWSUVXX1RZUEVfVFNORSA9IFwidHNuZS12aXN1YWxpemF0aW9uXCI7XG5cbmludGVyZmFjZSBWaWJlQm95U2V0dGluZ3Mge1xuICBwZXJwbGV4aXR5OiBudW1iZXI7XG4gIGl0ZXJhdGlvbnM6IG51bWJlcjtcbiAgZXBzaWxvbjogbnVtYmVyO1xufVxuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBWaWJlQm95U2V0dGluZ3MgPSB7XG4gIHBlcnBsZXhpdHk6IDMwLFxuICBpdGVyYXRpb25zOiAxMDAwLFxuICBlcHNpbG9uOiAxMFxufVxuXG4vLyBDdXN0b20gdmlldyBmb3IgdC1TTkUgdmlzdWFsaXphdGlvblxuY2xhc3MgVFNORVZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYpIHtcbiAgICBzdXBlcihsZWFmKTtcbiAgfVxuXG4gIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFZJRVdfVFlQRV9UU05FO1xuICB9XG5cbiAgZ2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gXCJ0LVNORSBWaXN1YWxpemF0aW9uXCI7XG4gIH1cblxuICBnZXRJY29uKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFwiZ3JhcGhcIjtcbiAgfVxuXG4gIC8vIFNldCBvbkRyb3AgaGFuZGxlciB0byBwcmV2ZW50IGVycm9yXG4gIG9uRHJvcChldmVudDogRHJhZ0V2ZW50KTogdm9pZCB7XG4gICAgLy8gTm90IGltcGxlbWVudGVkXG4gIH1cblxuICAvLyBTZXQgb25QYW5lTWVudSBoYW5kbGVyIHRvIHByZXZlbnQgZXJyb3JcbiAgb25QYW5lTWVudShtZW51OiBhbnksIHNvdXJjZTogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gTm90IGltcGxlbWVudGVkXG4gIH1cblxuICBhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY29udGFpbmVyID0gdGhpcy5jb250ZW50RWw7XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgXG4gICAgLy8gQWRkIGhlYWRlclxuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJ0c25lLWhlYWRlclwiIH0sIChoZWFkZXIpID0+IHtcbiAgICAgIGhlYWRlci5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJ0LVNORSBOb3RlIFZpc3VhbGl6YXRpb25cIiB9KTtcbiAgICAgIFxuICAgICAgLy8gQWRkIGFjdGlvbiBidXR0b25zXG4gICAgICBjb25zdCBhY3Rpb25CYXIgPSBoZWFkZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwidHNuZS1hY3Rpb25zXCIgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJ1bkJ1dHRvbiA9IGFjdGlvbkJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiUnVuIEFuYWx5c2lzXCIsIGNsczogXCJtb2QtY3RhXCIgfSk7XG4gICAgICBydW5CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgLy8gR2V0IHRoZSBwbHVnaW4gaW5zdGFuY2UgYW5kIHJ1biB0LVNORVxuICAgICAgICBjb25zdCBwbHVnaW4gPSAodGhpcy5hcHAgYXMgYW55KS5wbHVnaW5zLnBsdWdpbnNbXCJ2aWJlLWJvaVwiXSBhcyBWaWJlQm95UGx1Z2luO1xuICAgICAgICBwbHVnaW4ucnVuVFNORSgpO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHN1Z2dlc3RMaW5rc0J1dHRvbiA9IGFjdGlvbkJhci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiU3VnZ2VzdCBMaW5rc1wiLCBjbHM6IFwibW9kLWN0YVwiIH0pO1xuICAgICAgc3VnZ2VzdExpbmtzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIC8vIEdldCB0aGUgcGx1Z2luIGluc3RhbmNlIGFuZCBzdWdnZXN0IGxpbmtzXG4gICAgICAgIGNvbnN0IHBsdWdpbiA9ICh0aGlzLmFwcCBhcyBhbnkpLnBsdWdpbnMucGx1Z2luc1tcInZpYmUtYm9pXCJdIGFzIFZpYmVCb3lQbHVnaW47XG4gICAgICAgIHBsdWdpbi5zdWdnZXN0TGlua3MoKTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBzZWxlY3RGb2xkZXJCdXR0b24gPSBhY3Rpb25CYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlNlbGVjdCBGb2xkZXJcIiB9KTtcbiAgICAgIHNlbGVjdEZvbGRlckJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICAvLyBUT0RPOiBJbXBsZW1lbnQgZm9sZGVyIHNlbGVjdGlvblxuICAgICAgICBuZXcgTm90aWNlKFwiRm9sZGVyIHNlbGVjdGlvbiBub3QgaW1wbGVtZW50ZWQgeWV0XCIpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgXG4gICAgLy8gQWRkIGluZm8gdGV4dFxuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcInBcIiwgeyBcbiAgICAgIHRleHQ6IFwiUnVuIHQtU05FIGFuYWx5c2lzIHRvIHZpc3VhbGl6ZSB5b3VyIG5vdGVzIGFzIGNsdXN0ZXJzIGJhc2VkIG9uIGNvbnRlbnQgc2ltaWxhcml0eS5cIixcbiAgICAgIGNsczogXCJ0c25lLWluZm9cIlxuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCB2aXN1YWxpemF0aW9uIGNvbnRhaW5lclxuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7IFxuICAgICAgY2xzOiBcInRzbmUtY29udGFpbmVyXCIsIFxuICAgICAgYXR0cjogeyBpZDogXCJ0c25lLWNvbnRhaW5lclwiIH0gXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQWRkIHN0YXR1cyB0ZXh0XG4gICAgY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgXG4gICAgICBjbHM6IFwidHNuZS1zdGF0dXNcIixcbiAgICAgIGF0dHI6IHsgaWQ6IFwidHNuZS1zdGF0dXNcIiB9XG4gICAgfSwgKHN0YXR1cykgPT4ge1xuICAgICAgc3RhdHVzLmNyZWF0ZUVsKFwicFwiLCB7IFxuICAgICAgICB0ZXh0OiBcIlVzZSB0aGUgJ1J1biBBbmFseXNpcycgYnV0dG9uIHRvIHN0YXJ0IHByb2Nlc3NpbmcgeW91ciBub3Rlcy5cIixcbiAgICAgICAgY2xzOiBcInRzbmUtc3RhdHVzLXRleHRcIlxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgXG4gICAgLy8gQWRkIHNpbXBsZSBDU1NcbiAgICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgc3R5bGUudGV4dENvbnRlbnQgPSBgXG4gICAgICAudHNuZS1oZWFkZXIge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDFyZW07XG4gICAgICB9XG4gICAgICAudHNuZS1hY3Rpb25zIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgZ2FwOiAxMHB4O1xuICAgICAgfVxuICAgICAgLnRzbmUtaW5mbyB7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDFyZW07XG4gICAgICAgIG9wYWNpdHk6IDAuODtcbiAgICAgIH1cbiAgICAgIC50c25lLWNvbnRhaW5lciB7XG4gICAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgICBoZWlnaHQ6IDYwMHB4O1xuICAgICAgICBtYXJnaW46IDFyZW0gMDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgfVxuICAgICAgLnRzbmUtc3RhdHVzIHtcbiAgICAgICAgbWFyZ2luLXRvcDogMXJlbTtcbiAgICAgICAgcGFkZGluZzogMC41cmVtO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWJhY2tncm91bmQtc2Vjb25kYXJ5KTtcbiAgICAgIH1cbiAgICAgIC50c25lLXN0YXR1cy10ZXh0IHtcbiAgICAgICAgbWFyZ2luOiAwO1xuICAgICAgICBmb250LXNpemU6IDAuOXJlbTtcbiAgICAgICAgb3BhY2l0eTogMC44O1xuICAgICAgfVxuICAgIGA7XG4gICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVmliZUJveVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzOiBWaWJlQm95U2V0dGluZ3M7XG5cbiAgYXN5bmMgb25sb2FkKCkge1xuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG5cbiAgICAvLyBSZWdpc3RlciB0aGUgY3VzdG9tIHZpZXdcbiAgICB0aGlzLnJlZ2lzdGVyVmlldyhcbiAgICAgIFZJRVdfVFlQRV9UU05FLFxuICAgICAgKGxlYWYpID0+IG5ldyBUU05FVmlldyhsZWFmKVxuICAgICk7XG5cbiAgICAvLyBBZGQgY29tbWFuZCB0byBvcGVuIHRoZSB2aXN1YWxpemF0aW9uXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAnb3Blbi10c25lLXZpc3VhbGl6YXRpb24nLFxuICAgICAgbmFtZTogJ09wZW4gdC1TTkUgVmlzdWFsaXphdGlvbicsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICB0aGlzLmFjdGl2YXRlVmlldygpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGNvbW1hbmQgdG8gcnVuIHQtU05FIGFuYWx5c2lzXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiAncnVuLXRzbmUtYW5hbHlzaXMnLFxuICAgICAgbmFtZTogJ1J1biB0LVNORSBBbmFseXNpcycsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICB0aGlzLnJ1blRTTkUoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEFkZCBzZXR0aW5nIHRhYlxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuICB9XG5cbiAgb251bmxvYWQoKSB7XG4gICAgLy8gQ2xlYW4gdXAgcmVzb3VyY2VzIHdoZW4gdGhlIHBsdWdpbiBpcyBkaXNhYmxlZFxuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cblxuICBhc3luYyBhY3RpdmF0ZVZpZXcoKSB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9UU05FKTtcbiAgICBpZiAoZXhpc3RpbmcubGVuZ3RoKSB7XG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihleGlzdGluZ1swXSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKHRydWUpO1xuICAgIGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHtcbiAgICAgIHR5cGU6IFZJRVdfVFlQRV9UU05FLFxuICAgICAgYWN0aXZlOiB0cnVlLFxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgcnVuVFNORSgpIHtcbiAgICAvLyBQcm9jZXNzIG5vdGVzIGFuZCBydW4gdC1TTkUgYW5hbHlzaXNcbiAgICBuZXcgTm90aWNlKCd0LVNORSBhbmFseXNpcyBzdGFydGluZy4uLicpO1xuICAgIHRoaXMudXBkYXRlU3RhdHVzKCdHYXRoZXJpbmcgbm90ZXMuLi4nKTtcbiAgICBcbiAgICAvLyBHZXQgYWxsIG1hcmtkb3duIGZpbGVzIGluIHRoZSB2YXVsdFxuICAgIGNvbnN0IGZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICAvLyBMaW1pdCB0byBhIHJlYXNvbmFibGUgbnVtYmVyIG9mIGZpbGVzIGZvciBwZXJmb3JtYW5jZVxuICAgICAgY29uc3QgbWF4RmlsZXMgPSAyMDA7XG4gICAgICBjb25zdCBzZWxlY3RlZEZpbGVzID0gZmlsZXMuc2xpY2UoMCwgbWF4RmlsZXMpO1xuICAgICAgXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhgUHJvY2Vzc2luZyAke3NlbGVjdGVkRmlsZXMubGVuZ3RofSBub3Rlcy4uLmApO1xuICAgICAgXG4gICAgICAvLyBQcmVwYXJlIG5vdGVzIGRhdGEgZm9yIHRoZSBQeXRob24gc2VydmVyXG4gICAgICBjb25zdCBub3RlcyA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICBzZWxlY3RlZEZpbGVzLm1hcChhc3luYyAoZmlsZSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuICAgICAgICAgIGNvbnN0IHN0YXQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnN0YXQoZmlsZS5wYXRoKTtcbiAgICAgICAgICBjb25zdCB3b3JkQ291bnQgPSBjb250ZW50LnNwbGl0KC9cXHMrLykubGVuZ3RoO1xuICAgICAgICAgIGNvbnN0IHJlYWRpbmdUaW1lID0gTWF0aC5jZWlsKHdvcmRDb3VudCAvIDIwMCk7IC8vIEF2ZyByZWFkaW5nIHNwZWVkIH4yMDAgd29yZHMvbWludXRlXG4gICAgICAgICAgXG4gICAgICAgICAgLy8gRXh0cmFjdCB0YWdzIChsb29raW5nIGZvciAjdGFnIGZvcm1hdClcbiAgICAgICAgICBjb25zdCB0YWdSZWdleCA9IC8jKFthLXpBLVowLTlfLV0rKS9nO1xuICAgICAgICAgIGNvbnN0IHRhZ3MgPSBbLi4uY29udGVudC5tYXRjaEFsbCh0YWdSZWdleCldLm1hcChtYXRjaCA9PiBtYXRjaFsxXSk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gR2V0IGEgY29udGVudCBwcmV2aWV3IChmaXJzdCAxNTAgY2hhcnMpXG4gICAgICAgICAgY29uc3QgY29udGVudFByZXZpZXcgPSBjb250ZW50LnN1YnN0cmluZygwLCAxNTApLnJlcGxhY2UoL1xcbi9nLCAnICcpICsgXG4gICAgICAgICAgICAoY29udGVudC5sZW5ndGggPiAxNTAgPyAnLi4uJyA6ICcnKTtcbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcGF0aDogZmlsZS5wYXRoLFxuICAgICAgICAgICAgdGl0bGU6IGZpbGUuYmFzZW5hbWUsXG4gICAgICAgICAgICBjb250ZW50OiBjb250ZW50LFxuICAgICAgICAgICAgbXRpbWU6IHN0YXQubXRpbWUsXG4gICAgICAgICAgICBjdGltZTogc3RhdC5jdGltZSxcbiAgICAgICAgICAgIHdvcmRDb3VudDogd29yZENvdW50LFxuICAgICAgICAgICAgcmVhZGluZ1RpbWU6IHJlYWRpbmdUaW1lLFxuICAgICAgICAgICAgdGFnczogdGFncyxcbiAgICAgICAgICAgIGNvbnRlbnRQcmV2aWV3OiBjb250ZW50UHJldmlld1xuICAgICAgICAgIH07XG4gICAgICAgIH0pXG4gICAgICApO1xuICAgICAgXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnU2VuZGluZyBkYXRhIHRvIHQtU05FIHNlcnZlci4uLicpO1xuICAgICAgXG4gICAgICAvLyBDaGVjayBpZiBQeXRob24gc2VydmVyIGlzIHJ1bm5pbmdcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGhlYWx0aENoZWNrID0gYXdhaXQgZmV0Y2goJ2h0dHA6Ly8xMjcuMC4wLjE6MTIzNC9oZWFsdGgnLCB7IFxuICAgICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH1cbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBpZiAoIWhlYWx0aENoZWNrLm9rKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUHl0aG9uIHNlcnZlciBpcyBub3QgcmVzcG9uZGluZ1wiKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIFwiQ2Fubm90IGNvbm5lY3QgdG8gUHl0aG9uIHNlcnZlci4gTWFrZSBzdXJlIHRoZSBzZXJ2ZXIgaXMgcnVubmluZyBhdCBodHRwOi8vMTI3LjAuMC4xOjEyMzQuIFwiICtcbiAgICAgICAgICBcIlJ1biAncHl0aG9uIHNyYy9weXRob24vdHNuZS9zZXJ2ZXIucHknIHRvIHN0YXJ0IGl0LlwiXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFNlbmQgdG8gUHl0aG9uIHNlcnZlciBmb3IgcHJvY2Vzc2luZ1xuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoYFJ1bm5pbmcgdC1TTkUgYW5hbHlzaXMgd2l0aCBwZXJwbGV4aXR5PSR7dGhpcy5zZXR0aW5ncy5wZXJwbGV4aXR5fSwgaXRlcmF0aW9ucz0ke3RoaXMuc2V0dGluZ3MuaXRlcmF0aW9uc30uLi5gKTtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJ2h0dHA6Ly8xMjcuMC4wLjE6MTIzNC9wcm9jZXNzJywge1xuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBub3Rlczogbm90ZXMsXG4gICAgICAgICAgc2V0dGluZ3M6IHtcbiAgICAgICAgICAgIHBlcnBsZXhpdHk6IHRoaXMuc2V0dGluZ3MucGVycGxleGl0eSxcbiAgICAgICAgICAgIGl0ZXJhdGlvbnM6IHRoaXMuc2V0dGluZ3MuaXRlcmF0aW9ucyxcbiAgICAgICAgICAgIGxlYXJuaW5nX3JhdGU6IHRoaXMuc2V0dGluZ3MuZXBzaWxvblxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgU2VydmVyIHJlc3BvbmRlZCB3aXRoIHN0YXR1czogJHtyZXNwb25zZS5zdGF0dXN9YCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgIFxuICAgICAgaWYgKHJlc3VsdC5lcnJvcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNlcnZlciBlcnJvcjogJHtyZXN1bHQuZXJyb3J9YCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKCdWaXN1YWxpemluZyByZXN1bHRzLi4uJyk7XG4gICAgICBcbiAgICAgIC8vIERlYnVnIC0gbG9nIHRoZSByZXN1bHQgc3RydWN0dXJlIHRvIGNoZWNrIG1ldGFkYXRhXG4gICAgICBjb25zb2xlLmxvZygnVmlzdWFsaXppbmcgcmVzdWx0IHdpdGggbWV0YWRhdGE6JywgcmVzdWx0KTtcbiAgICAgIC8vIENoZWNrIGlmIHdlIGhhdmUgYWRkaXRpb25hbCBtZXRhZGF0YVxuICAgICAgaWYgKHJlc3VsdC5wb2ludHMgJiYgcmVzdWx0LnBvaW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IHNhbXBsZVBvaW50ID0gcmVzdWx0LnBvaW50c1swXTtcbiAgICAgICAgY29uc29sZS5sb2coJ1NhbXBsZSBwb2ludCBtZXRhZGF0YTonLCB7XG4gICAgICAgICAgaGFzV29yZENvdW50OiBzYW1wbGVQb2ludC53b3JkQ291bnQgIT09IHVuZGVmaW5lZCxcbiAgICAgICAgICBoYXNNdGltZTogc2FtcGxlUG9pbnQubXRpbWUgIT09IHVuZGVmaW5lZCxcbiAgICAgICAgICBoYXNDdGltZTogc2FtcGxlUG9pbnQuY3RpbWUgIT09IHVuZGVmaW5lZCxcbiAgICAgICAgICBoYXNUYWdzOiBzYW1wbGVQb2ludC50YWdzICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzQ29udGVudFByZXZpZXc6IHNhbXBsZVBvaW50LmNvbnRlbnRQcmV2aWV3ICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzRGlzdGFuY2VUb0NlbnRlcjogc2FtcGxlUG9pbnQuZGlzdGFuY2VUb0NlbnRlciAhPT0gdW5kZWZpbmVkXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBTdG9yZSB0aGUgcmVzdWx0IGZvciBsYXRlciB1c2UgaW4gbGluayBzdWdnZXN0aW9uc1xuICAgICAgdGhpcy5sYXN0UmVzdWx0ID0gcmVzdWx0O1xuICAgICAgXG4gICAgICAvLyBWaXN1YWxpemUgdGhlIHJlc3VsdFxuICAgICAgdGhpcy52aXN1YWxpemVSZXN1bHQocmVzdWx0KTtcbiAgICAgIFxuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoYFZpc3VhbGl6YXRpb24gY29tcGxldGUhIERpc3BsYXlpbmcgJHtyZXN1bHQucG9pbnRzLmxlbmd0aH0gbm90ZXMuYCk7XG4gICAgICBuZXcgTm90aWNlKCd0LVNORSBhbmFseXNpcyBjb21wbGV0ZSEnKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgcnVubmluZyB0LVNORSBhbmFseXNpczonLCBlcnJvcik7XG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cyhgRXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgIG5ldyBOb3RpY2UoYHQtU05FIGFuYWx5c2lzIGZhaWxlZDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSB1cGRhdGVTdGF0dXMobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgLy8gRmluZCB0aGUgc3RhdHVzIGVsZW1lbnQgaW4gdGhlIHZpZXcgYW5kIHVwZGF0ZSBpdFxuICAgIGNvbnN0IHN0YXR1c0VsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdHNuZS1zdGF0dXMgLnRzbmUtc3RhdHVzLXRleHQnKTtcbiAgICBpZiAoc3RhdHVzRWxlbWVudCkge1xuICAgICAgc3RhdHVzRWxlbWVudC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKGBTdGF0dXM6ICR7bWVzc2FnZX1gKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyB2aXN1YWxpemVSZXN1bHQocmVzdWx0OiBhbnkpIHtcbiAgICAvLyBHZXQgb3IgY3JlYXRlIHRoZSB2aXN1YWxpemF0aW9uIHZpZXdcbiAgICBsZXQgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX1RTTkUpWzBdO1xuICAgIGlmICghbGVhZikge1xuICAgICAgLy8gQWN0aXZhdGUgdGhlIHZpZXcgaWYgbm90IGZvdW5kXG4gICAgICBhd2FpdCB0aGlzLmFjdGl2YXRlVmlldygpO1xuICAgICAgLy8gVHJ5IHRvIGdldCB0aGUgbGVhZiBhZ2FpblxuICAgICAgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFX1RTTkUpWzBdO1xuICAgICAgXG4gICAgICBpZiAoIWxlYWYpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignQ291bGQgbm90IGNyZWF0ZSB2aXN1YWxpemF0aW9uIHZpZXcnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBBY2Nlc3MgdGhlIHZpZXcgY29udGFpbmVyXG4gICAgY29uc3QgdmlldyA9IGxlYWYudmlldyBhcyBUU05FVmlldztcbiAgICBjb25zdCBjb250YWluZXIgPSB2aWV3LmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKCcjdHNuZS1jb250YWluZXInKSBhcyBIVE1MRWxlbWVudDtcbiAgICBpZiAoIWNvbnRhaW5lcikge1xuICAgICAgY29uc29sZS5lcnJvcignQ29udGFpbmVyIG5vdCBmb3VuZCBpbiB2aWV3Jyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIC8vIENsZWFyIGFueSBleGlzdGluZyBjb250ZW50XG4gICAgd2hpbGUgKGNvbnRhaW5lci5maXJzdENoaWxkKSB7XG4gICAgICBjb250YWluZXIucmVtb3ZlQ2hpbGQoY29udGFpbmVyLmZpcnN0Q2hpbGQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBDcmVhdGUgdGhlIHZpc3VhbGl6ZXJcbiAgICBjb25zdCBvcGVuQ2FsbGJhY2sgPSAocGF0aDogc3RyaW5nKSA9PiB7XG4gICAgICAvLyBPcGVuIHRoZSBzZWxlY3RlZCBub3RlXG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xuICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZigpLm9wZW5GaWxlKGZpbGUpO1xuICAgICAgfVxuICAgIH07XG4gICAgXG4gICAgLy8gQ3JlYXRlIGFuZCB1c2UgdGhlIHZpc3VhbGl6ZXIgZGlyZWN0bHlcbiAgICBjb25zdCB2aXN1YWxpemVyID0gbmV3IFRTTkVWaXN1YWxpemVyKGNvbnRhaW5lciwgb3BlbkNhbGxiYWNrKTtcbiAgICB2aXN1YWxpemVyLnNldERhdGEocmVzdWx0KTtcbiAgfVxuICBcbiAgLy8gTWV0aG9kIHRvIHN1Z2dlc3QgbGlua3MgYmV0d2VlbiBub3RlcyB1c2luZyBMTE1cbiAgYXN5bmMgc3VnZ2VzdExpbmtzKCkge1xuICAgIGlmICghdGhpcy5sYXN0UmVzdWx0IHx8ICF0aGlzLmxhc3RSZXN1bHQucG9pbnRzIHx8IHRoaXMubGFzdFJlc3VsdC5wb2ludHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBuZXcgTm90aWNlKCdQbGVhc2UgcnVuIHQtU05FIGFuYWx5c2lzIGZpcnN0IHRvIGdlbmVyYXRlIG5vdGUgZGF0YScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICAvLyBTaG93IGEgbm90aWNlIHRoYXQgd2UncmUgc3RhcnRpbmcgdGhlIHByb2Nlc3NcbiAgICBuZXcgTm90aWNlKCdGaW5kaW5nIHBvdGVudGlhbCBub3RlIGNvbm5lY3Rpb25zLi4uJyk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIEZpbmQgcG90ZW50aWFsIGNvbm5lY3Rpb25zIGJhc2VkIG9uIHQtU05FIHByb3hpbWl0eSBhbmQgY2x1c3RlcmluZ1xuICAgICAgY29uc3QgY29ubmVjdGlvbnMgPSB0aGlzLmZpbmRQb3RlbnRpYWxDb25uZWN0aW9ucyh0aGlzLmxhc3RSZXN1bHQpO1xuICAgICAgXG4gICAgICBpZiAoY29ubmVjdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIG5ldyBOb3RpY2UoJ05vIHN0cm9uZyBjb25uZWN0aW9ucyBmb3VuZCBiZXR3ZWVuIG5vdGVzJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gQ3JlYXRlIGEgbW9kYWwgdG8gZGlzcGxheSB0aGUgc3VnZ2VzdGVkIGNvbm5lY3Rpb25zXG4gICAgICBjb25zdCBtb2RhbCA9IG5ldyBTdWdnZXN0ZWRMaW5rc01vZGFsKHRoaXMuYXBwLCBjb25uZWN0aW9ucywgdGhpcyk7XG4gICAgICBtb2RhbC5vcGVuKCk7XG4gICAgICBcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igc3VnZ2VzdGluZyBsaW5rczonLCBlcnJvcik7XG4gICAgICBuZXcgTm90aWNlKGBFcnJvciBzdWdnZXN0aW5nIGxpbmtzOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG4gIFxuICAvLyBTdG9yZSB0aGUgbGFzdCByZXN1bHQgZm9yIHVzZSBpbiBsaW5rIHN1Z2dlc3Rpb25zXG4gIHByaXZhdGUgbGFzdFJlc3VsdDogYW55ID0gbnVsbDtcbiAgXG4gIC8vIEZpbmQgcG90ZW50aWFsIGNvbm5lY3Rpb25zIGJldHdlZW4gbm90ZXMgYmFzZWQgb24gdC1TTkUgcmVzdWx0c1xuICBwcml2YXRlIGZpbmRQb3RlbnRpYWxDb25uZWN0aW9ucyhyZXN1bHQ6IGFueSk6IE5vdGVDb25uZWN0aW9uW10ge1xuICAgIGNvbnN0IGNvbm5lY3Rpb25zOiBOb3RlQ29ubmVjdGlvbltdID0gW107XG4gICAgY29uc3QgcG9pbnRzID0gcmVzdWx0LnBvaW50cyBhcyBUU05FUG9pbnRbXTtcbiAgICBcbiAgICAvLyAxLiBGaW5kIG5vdGVzIGluIHRoZSBzYW1lIGNsdXN0ZXJcbiAgICBjb25zdCBjbHVzdGVyR3JvdXBzOiB7IFtrZXk6IG51bWJlcl06IFRTTkVQb2ludFtdIH0gPSB7fTtcbiAgICBcbiAgICAvLyBHcm91cCBwb2ludHMgYnkgY2x1c3RlclxuICAgIGZvciAoY29uc3QgcG9pbnQgb2YgcG9pbnRzKSB7XG4gICAgICBpZiAocG9pbnQuY2x1c3RlciA9PT0gLTEpIGNvbnRpbnVlOyAvLyBTa2lwIHVuY2x1c3RlcmVkIHBvaW50c1xuICAgICAgXG4gICAgICBpZiAoIWNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0pIHtcbiAgICAgICAgY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXSA9IFtdO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdLnB1c2gocG9pbnQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBGb3IgZWFjaCBjbHVzdGVyLCBmaW5kIHRoZSBtb3N0IGNlbnRyYWwgbm90ZXNcbiAgICBPYmplY3QuZW50cmllcyhjbHVzdGVyR3JvdXBzKS5mb3JFYWNoKChbY2x1c3RlcklkLCBjbHVzdGVyUG9pbnRzXSkgPT4ge1xuICAgICAgLy8gT25seSBjb25zaWRlciBjbHVzdGVycyB3aXRoIGF0IGxlYXN0IDIgbm90ZXNcbiAgICAgIGlmIChjbHVzdGVyUG9pbnRzLmxlbmd0aCA8IDIpIHJldHVybjtcbiAgICAgIFxuICAgICAgLy8gRmluZCBtb3N0IGNlbnRyYWwgbm90ZXMgaW4gdGhlIGNsdXN0ZXIgKGNsb3Nlc3QgdG8gY2x1c3RlciBjZW50ZXIpXG4gICAgICBjbHVzdGVyUG9pbnRzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgY29uc3QgZGlzdEEgPSBhLmRpc3RhbmNlVG9DZW50ZXIgfHwgSW5maW5pdHk7XG4gICAgICAgIGNvbnN0IGRpc3RCID0gYi5kaXN0YW5jZVRvQ2VudGVyIHx8IEluZmluaXR5O1xuICAgICAgICByZXR1cm4gZGlzdEEgLSBkaXN0QjtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyBUYWtlIHRoZSBtb3N0IGNlbnRyYWwgbm90ZXNcbiAgICAgIGNvbnN0IGNlbnRyYWxOb3RlcyA9IGNsdXN0ZXJQb2ludHMuc2xpY2UoMCwgTWF0aC5taW4oMywgY2x1c3RlclBvaW50cy5sZW5ndGgpKTtcbiAgICAgIFxuICAgICAgLy8gQ3JlYXRlIGNvbm5lY3Rpb25zIGJldHdlZW4gdGhlIGNlbnRyYWwgbm90ZXNcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2VudHJhbE5vdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IGNlbnRyYWxOb3Rlcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgIGNvbnN0IG5vdGVBID0gY2VudHJhbE5vdGVzW2ldO1xuICAgICAgICAgIGNvbnN0IG5vdGVCID0gY2VudHJhbE5vdGVzW2pdO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIFNraXAgaWYgdGhlIHR3byBub3RlcyBhcmUgdmVyeSBmYXIgYXBhcnQgaW4gdGhlIHZpc3VhbGl6YXRpb25cbiAgICAgICAgICBjb25zdCBkaXN0YW5jZSA9IE1hdGguc3FydChcbiAgICAgICAgICAgIE1hdGgucG93KG5vdGVBLnggLSBub3RlQi54LCAyKSArIE1hdGgucG93KG5vdGVBLnkgLSBub3RlQi55LCAyKVxuICAgICAgICAgICk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGRpc3RhbmNlID4gMC41KSBjb250aW51ZTsgLy8gU2tpcCBpZiB0b28gZmFyXG4gICAgICAgICAgXG4gICAgICAgICAgLy8gQ2FsY3VsYXRlIGEgc2ltaWxhcml0eSBzY29yZSAoMC0xMDApXG4gICAgICAgICAgY29uc3Qgc2ltaWxhcml0eSA9IDEwMCAtIE1hdGgubWluKDEwMCwgZGlzdGFuY2UgKiAxMDApO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIEZpbmQgY29tbW9uIHRlcm1zXG4gICAgICAgICAgY29uc3QgY29tbW9uVGVybXMgPSBub3RlQS50b3BfdGVybXMuZmlsdGVyKHRlcm0gPT4gXG4gICAgICAgICAgICBub3RlQi50b3BfdGVybXMuaW5jbHVkZXModGVybSlcbiAgICAgICAgICApO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgc291cmNlTm90ZTogbm90ZUEsXG4gICAgICAgICAgICB0YXJnZXROb3RlOiBub3RlQixcbiAgICAgICAgICAgIHNpbWlsYXJpdHk6IHNpbWlsYXJpdHksXG4gICAgICAgICAgICBjb21tb25UZXJtczogY29tbW9uVGVybXMsXG4gICAgICAgICAgICBjbHVzdGVyVGVybXM6IHJlc3VsdC5jbHVzdGVyX3Rlcm1zPy5bY2x1c3RlcklkXT8uc2xpY2UoMCwgNSkubWFwKCh0OiBhbnkpID0+IHQudGVybSkgfHwgW10sXG4gICAgICAgICAgICByZWFzb246IGBCb3RoIG5vdGVzIGFyZSBjZW50cmFsIGluIGNsdXN0ZXIgJHtjbHVzdGVySWR9YFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgLy8gMi4gRmluZCBub3RlcyB0aGF0IGFyZSBjbG9zZSBpbiB0aGUgdC1TTkUgcHJvamVjdGlvbiBidXQgbWF5IGJlIGluIGRpZmZlcmVudCBjbHVzdGVyc1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCBwb2ludHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgY29uc3Qgbm90ZUEgPSBwb2ludHNbaV07XG4gICAgICAgIGNvbnN0IG5vdGVCID0gcG9pbnRzW2pdO1xuICAgICAgICBcbiAgICAgICAgLy8gU2tpcCBub3RlcyBpbiB0aGUgc2FtZSBjbHVzdGVyIChhbHJlYWR5IGhhbmRsZWQgYWJvdmUpXG4gICAgICAgIGlmIChub3RlQS5jbHVzdGVyICE9PSAtMSAmJiBub3RlQS5jbHVzdGVyID09PSBub3RlQi5jbHVzdGVyKSBjb250aW51ZTtcbiAgICAgICAgXG4gICAgICAgIC8vIENhbGN1bGF0ZSBFdWNsaWRlYW4gZGlzdGFuY2UgaW4gdC1TTkUgc3BhY2VcbiAgICAgICAgY29uc3QgZGlzdGFuY2UgPSBNYXRoLnNxcnQoXG4gICAgICAgICAgTWF0aC5wb3cobm90ZUEueCAtIG5vdGVCLngsIDIpICsgTWF0aC5wb3cobm90ZUEueSAtIG5vdGVCLnksIDIpXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICAvLyBPbmx5IGNvbnNpZGVyIHZlcnkgY2xvc2Ugbm90ZXNcbiAgICAgICAgaWYgKGRpc3RhbmNlID4gMC4yKSBjb250aW51ZTtcbiAgICAgICAgXG4gICAgICAgIC8vIENhbGN1bGF0ZSBhIHNpbWlsYXJpdHkgc2NvcmUgKDAtMTAwKVxuICAgICAgICBjb25zdCBzaW1pbGFyaXR5ID0gMTAwIC0gTWF0aC5taW4oMTAwLCBkaXN0YW5jZSAqIDIwMCk7XG4gICAgICAgIFxuICAgICAgICAvLyBGaW5kIGNvbW1vbiB0ZXJtc1xuICAgICAgICBjb25zdCBjb21tb25UZXJtcyA9IG5vdGVBLnRvcF90ZXJtcy5maWx0ZXIodGVybSA9PiBcbiAgICAgICAgICBub3RlQi50b3BfdGVybXMuaW5jbHVkZXModGVybSlcbiAgICAgICAgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIE9ubHkgaW5jbHVkZSBpZiB0aGV5IGhhdmUgY29tbW9uIHRlcm1zXG4gICAgICAgIGlmIChjb21tb25UZXJtcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgICBzb3VyY2VOb3RlOiBub3RlQSxcbiAgICAgICAgICAgIHRhcmdldE5vdGU6IG5vdGVCLFxuICAgICAgICAgICAgc2ltaWxhcml0eTogc2ltaWxhcml0eSxcbiAgICAgICAgICAgIGNvbW1vblRlcm1zOiBjb21tb25UZXJtcyxcbiAgICAgICAgICAgIGNsdXN0ZXJUZXJtczogW10sXG4gICAgICAgICAgICByZWFzb246IGBOb3RlcyBhcmUgdmVyeSBjbG9zZSBpbiB0aGUgdmlzdWFsaXphdGlvbiBhbmQgc2hhcmUgY29tbW9uIHRlcm1zYFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIFNvcnQgY29ubmVjdGlvbnMgYnkgc2ltaWxhcml0eSAoaGlnaGVzdCBmaXJzdClcbiAgICBjb25uZWN0aW9ucy5zb3J0KChhLCBiKSA9PiBiLnNpbWlsYXJpdHkgLSBhLnNpbWlsYXJpdHkpO1xuICAgIFxuICAgIC8vIFJldHVybiB0b3AgMTAgY29ubmVjdGlvbnMgdG8gYXZvaWQgb3ZlcndoZWxtaW5nIHRoZSB1c2VyXG4gICAgcmV0dXJuIGNvbm5lY3Rpb25zLnNsaWNlKDAsIDEwKTtcbiAgfVxuICBcbiAgLy8gQ3JlYXRlIGEgbGluayBiZXR3ZWVuIHR3byBub3Rlc1xuICBhc3luYyBjcmVhdGVOb3RlTGluayhzb3VyY2VOb3RlUGF0aDogc3RyaW5nLCB0YXJnZXROb3RlUGF0aDogc3RyaW5nLCBkZXNjcmlwdGlvbjogc3RyaW5nKSB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIEdldCB0aGUgc291cmNlIGZpbGVcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoc291cmNlTm90ZVBhdGgpO1xuICAgICAgaWYgKCEoc291cmNlRmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNvdXJjZSBmaWxlIG5vdCBmb3VuZDogJHtzb3VyY2VOb3RlUGF0aH1gKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gUmVhZCB0aGUgZmlsZSBjb250ZW50XG4gICAgICBjb25zdCBzb3VyY2VDb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChzb3VyY2VGaWxlKTtcbiAgICAgIFxuICAgICAgLy8gR2VuZXJhdGUgdGhlIGxpbmsgdGV4dCB3aXRoIHRoZSBmb3JtYXR0ZWQgY29ubmVjdGlvbiBkZXNjcmlwdGlvblxuICAgICAgY29uc3QgdGFyZ2V0RmlsZU5hbWUgPSB0YXJnZXROb3RlUGF0aC5zcGxpdCgnLycpLnBvcCgpIHx8IHRhcmdldE5vdGVQYXRoO1xuICAgICAgY29uc3QgbGlua1RleHQgPSBgXFxuXFxuIyMgUmVsYXRlZCBOb3Rlc1xcblxcbi0gW1ske3RhcmdldEZpbGVOYW1lfV1dIC0gJHtkZXNjcmlwdGlvbi50cmltKCl9XFxuYDtcbiAgICAgIFxuICAgICAgLy8gQXBwZW5kIHRoZSBsaW5rIHRvIHRoZSBzb3VyY2UgZmlsZVxuICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KHNvdXJjZUZpbGUsIHNvdXJjZUNvbnRlbnQgKyBsaW5rVGV4dCk7XG4gICAgICBcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBjcmVhdGluZyBub3RlIGxpbms6JywgZXJyb3IpO1xuICAgICAgbmV3IE5vdGljZShgRmFpbGVkIHRvIGNyZWF0ZSBsaW5rOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG59XG5cbi8vIEludGVyZmFjZSBmb3IgdC1TTkUgcmVzdWx0IHBvaW50c1xuaW50ZXJmYWNlIFRTTkVQb2ludCB7XG4gIHg6IG51bWJlcjtcbiAgeTogbnVtYmVyO1xuICB0aXRsZTogc3RyaW5nO1xuICBwYXRoOiBzdHJpbmc7XG4gIHRvcF90ZXJtczogc3RyaW5nW107XG4gIGNsdXN0ZXI6IG51bWJlcjsgLy8gQ2x1c3RlciBJRCAoLTEgbWVhbnMgbm9pc2Uvbm90IGNsdXN0ZXJlZClcbiAgXG4gIC8vIEFkZGl0aW9uYWwgbWV0YWRhdGFcbiAgbXRpbWU/OiBudW1iZXI7ICAgICAgLy8gTGFzdCBtb2RpZmllZCB0aW1lXG4gIGN0aW1lPzogbnVtYmVyOyAgICAgIC8vIENyZWF0aW9uIHRpbWVcbiAgd29yZENvdW50PzogbnVtYmVyOyAgLy8gV29yZCBjb3VudFxuICByZWFkaW5nVGltZT86IG51bWJlcjsgLy8gRXN0aW1hdGVkIHJlYWRpbmcgdGltZSBpbiBtaW51dGVzICBcbiAgdGFncz86IHN0cmluZ1tdOyAgICAgLy8gTm90ZSB0YWdzXG4gIGNvbnRlbnRQcmV2aWV3Pzogc3RyaW5nOyAvLyBTaG9ydCBwcmV2aWV3IG9mIGNvbnRlbnRcbiAgZGlzdGFuY2VUb0NlbnRlcj86IG51bWJlcjsgLy8gRGlzdGFuY2UgdG8gY2x1c3RlciBjZW50ZXJcbn1cblxuLy8gSW50ZXJmYWNlIGZvciBjbHVzdGVyIHRlcm0gaW5mb3JtYXRpb25cbmludGVyZmFjZSBDbHVzdGVyVGVybSB7XG4gIHRlcm06IHN0cmluZztcbiAgc2NvcmU6IG51bWJlcjtcbn1cblxuLy8gSW50ZXJmYWNlIGZvciBjbHVzdGVyIGluZm9ybWF0aW9uXG5pbnRlcmZhY2UgQ2x1c3RlckluZm8ge1xuICBba2V5OiBzdHJpbmddOiBDbHVzdGVyVGVybVtdO1xufVxuXG4vLyBJbnRlcmZhY2UgZm9yIHQtU05FIHJlc3VsdHNcbmludGVyZmFjZSBUU05FUmVzdWx0IHtcbiAgcG9pbnRzOiBUU05FUG9pbnRbXTtcbiAgZmVhdHVyZV9uYW1lczogc3RyaW5nW107XG4gIGNsdXN0ZXJzOiBudW1iZXI7XG4gIGNsdXN0ZXJfdGVybXM6IENsdXN0ZXJJbmZvO1xufVxuXG5jbGFzcyBUU05FVmlzdWFsaXplciB7XG4gIHByaXZhdGUgY29udGFpbmVyOiBIVE1MRWxlbWVudDtcbiAgcHJpdmF0ZSBjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50O1xuICBwcml2YXRlIGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEO1xuICBwcml2YXRlIHJlc3VsdDogVFNORVJlc3VsdCB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHdpZHRoID0gODAwO1xuICBwcml2YXRlIGhlaWdodCA9IDYwMDtcbiAgcHJpdmF0ZSBwb2ludFJhZGl1cyA9IDEwO1xuICBwcml2YXRlIG1vdXNlWCA9IDA7XG4gIHByaXZhdGUgbW91c2VZID0gMDtcbiAgcHJpdmF0ZSBzY2FsZSA9IDE7XG4gIHByaXZhdGUgb2Zmc2V0WCA9IDA7XG4gIHByaXZhdGUgb2Zmc2V0WSA9IDA7XG4gIHByaXZhdGUgaXNEcmFnZ2luZyA9IGZhbHNlO1xuICBwcml2YXRlIGxhc3RYID0gMDtcbiAgcHJpdmF0ZSBsYXN0WSA9IDA7XG4gIHByaXZhdGUgaG92ZXJlZFBvaW50OiBUU05FUG9pbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBvcGVuQ2FsbGJhY2s6IChwYXRoOiBzdHJpbmcpID0+IHZvaWQ7XG5cbiAgY29uc3RydWN0b3IoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgb3BlbkNhbGxiYWNrOiAocGF0aDogc3RyaW5nKSA9PiB2b2lkKSB7XG4gICAgdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgdGhpcy5vcGVuQ2FsbGJhY2sgPSBvcGVuQ2FsbGJhY2s7XG4gICAgXG4gICAgLy8gQ3JlYXRlIGNhbnZhcyBlbGVtZW50XG4gICAgdGhpcy5jYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICB0aGlzLmNhbnZhcy53aWR0aCA9IHRoaXMud2lkdGg7XG4gICAgdGhpcy5jYW52YXMuaGVpZ2h0ID0gdGhpcy5oZWlnaHQ7XG4gICAgdGhpcy5jYW52YXMuY2xhc3NMaXN0LmFkZCgndHNuZS1jYW52YXMnKTtcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS5ib3JkZXIgPSAnMXB4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyKSc7XG4gICAgXG4gICAgY29uc3QgY29udGV4dCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgaWYgKCFjb250ZXh0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBjcmVhdGUgY2FudmFzIGNvbnRleHQnKTtcbiAgICB9XG4gICAgdGhpcy5jdHggPSBjb250ZXh0O1xuICAgIFxuICAgIC8vIENsZWFyIHRoZSBjb250YWluZXIgZmlyc3RcbiAgICB3aGlsZSAodGhpcy5jb250YWluZXIuZmlyc3RDaGlsZCkge1xuICAgICAgdGhpcy5jb250YWluZXIucmVtb3ZlQ2hpbGQodGhpcy5jb250YWluZXIuZmlyc3RDaGlsZCk7XG4gICAgfVxuICAgIFxuICAgIC8vIEFkZCBjYW52YXMgdG8gY29udGFpbmVyXG4gICAgdGhpcy5jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5jYW52YXMpO1xuICAgIFxuICAgIC8vIEFkZCBldmVudCBsaXN0ZW5lcnNcbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXJzKCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgYWRkRXZlbnRMaXN0ZW5lcnMoKSB7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5oYW5kbGVNb3VzZU1vdmUuYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmhhbmRsZUNsaWNrLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ3doZWVsJywgdGhpcy5oYW5kbGVXaGVlbC5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCB0aGlzLmhhbmRsZU1vdXNlRG93bi5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5oYW5kbGVNb3VzZVVwLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbGVhdmUnLCB0aGlzLmhhbmRsZU1vdXNlVXAuYmluZCh0aGlzKSk7XG4gIH1cbiAgXG4gIHByaXZhdGUgaGFuZGxlTW91c2VNb3ZlKGU6IE1vdXNlRXZlbnQpIHtcbiAgICBjb25zdCByZWN0ID0gdGhpcy5jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgdGhpcy5tb3VzZVggPSBlLmNsaWVudFggLSByZWN0LmxlZnQ7XG4gICAgdGhpcy5tb3VzZVkgPSBlLmNsaWVudFkgLSByZWN0LnRvcDtcbiAgICBcbiAgICBpZiAodGhpcy5pc0RyYWdnaW5nKSB7XG4gICAgICBjb25zdCBkeCA9IHRoaXMubW91c2VYIC0gdGhpcy5sYXN0WDtcbiAgICAgIGNvbnN0IGR5ID0gdGhpcy5tb3VzZVkgLSB0aGlzLmxhc3RZO1xuICAgICAgXG4gICAgICB0aGlzLm9mZnNldFggKz0gZHg7XG4gICAgICB0aGlzLm9mZnNldFkgKz0gZHk7XG4gICAgICBcbiAgICAgIHRoaXMubGFzdFggPSB0aGlzLm1vdXNlWDtcbiAgICAgIHRoaXMubGFzdFkgPSB0aGlzLm1vdXNlWTtcbiAgICAgIFxuICAgICAgdGhpcy5kcmF3KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudXBkYXRlSG92ZXJlZFBvaW50KCk7XG4gICAgICB0aGlzLmRyYXcoKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgaGFuZGxlQ2xpY2soZTogTW91c2VFdmVudCkge1xuICAgIGlmICh0aGlzLmhvdmVyZWRQb2ludCkge1xuICAgICAgdGhpcy5vcGVuQ2FsbGJhY2sodGhpcy5ob3ZlcmVkUG9pbnQucGF0aCk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGhhbmRsZVdoZWVsKGU6IFdoZWVsRXZlbnQpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgXG4gICAgY29uc3QgZGVsdGEgPSBlLmRlbHRhWSA+IDAgPyAwLjkgOiAxLjE7XG4gICAgdGhpcy5zY2FsZSAqPSBkZWx0YTtcbiAgICBcbiAgICAvLyBMaW1pdCB6b29tXG4gICAgdGhpcy5zY2FsZSA9IE1hdGgubWF4KDAuMSwgTWF0aC5taW4oNSwgdGhpcy5zY2FsZSkpO1xuICAgIFxuICAgIHRoaXMuZHJhdygpO1xuICB9XG4gIFxuICBwcml2YXRlIGhhbmRsZU1vdXNlRG93bihlOiBNb3VzZUV2ZW50KSB7XG4gICAgdGhpcy5pc0RyYWdnaW5nID0gdHJ1ZTtcbiAgICB0aGlzLmxhc3RYID0gdGhpcy5tb3VzZVg7XG4gICAgdGhpcy5sYXN0WSA9IHRoaXMubW91c2VZO1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLmN1cnNvciA9ICdncmFiYmluZyc7XG4gIH1cbiAgXG4gIHByaXZhdGUgaGFuZGxlTW91c2VVcChlOiBNb3VzZUV2ZW50KSB7XG4gICAgdGhpcy5pc0RyYWdnaW5nID0gZmFsc2U7XG4gICAgdGhpcy5jYW52YXMuc3R5bGUuY3Vyc29yID0gdGhpcy5ob3ZlcmVkUG9pbnQgPyAncG9pbnRlcicgOiAnZGVmYXVsdCc7XG4gIH1cbiAgXG4gIHByaXZhdGUgdXBkYXRlSG92ZXJlZFBvaW50KCkge1xuICAgIGlmICghdGhpcy5yZXN1bHQpIHJldHVybjtcbiAgICBcbiAgICB0aGlzLmhvdmVyZWRQb2ludCA9IG51bGw7XG4gICAgXG4gICAgZm9yIChjb25zdCBwb2ludCBvZiB0aGlzLnJlc3VsdC5wb2ludHMpIHtcbiAgICAgIGNvbnN0IFtzY3JlZW5YLCBzY3JlZW5ZXSA9IHRoaXMud29ybGRUb1NjcmVlbihwb2ludC54LCBwb2ludC55KTtcbiAgICAgIGNvbnN0IGRpc3RhbmNlID0gTWF0aC5zcXJ0KFxuICAgICAgICBNYXRoLnBvdyhzY3JlZW5YIC0gdGhpcy5tb3VzZVgsIDIpICsgXG4gICAgICAgIE1hdGgucG93KHNjcmVlblkgLSB0aGlzLm1vdXNlWSwgMilcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGlmIChkaXN0YW5jZSA8PSB0aGlzLnBvaW50UmFkaXVzKSB7XG4gICAgICAgIHRoaXMuaG92ZXJlZFBvaW50ID0gcG9pbnQ7XG4gICAgICAgIHRoaXMuY2FudmFzLnN0eWxlLmN1cnNvciA9ICdwb2ludGVyJztcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS5jdXJzb3IgPSB0aGlzLmlzRHJhZ2dpbmcgPyAnZ3JhYmJpbmcnIDogJ2RlZmF1bHQnO1xuICB9XG4gIFxuICAvLyBDb252ZXJ0cyB3b3JsZCBzcGFjZSAodC1TTkUpIGNvb3JkaW5hdGVzIHRvIHNjcmVlbiBjb29yZGluYXRlc1xuICBwcml2YXRlIHdvcmxkVG9TY3JlZW4oeDogbnVtYmVyLCB5OiBudW1iZXIpOiBbbnVtYmVyLCBudW1iZXJdIHtcbiAgICAvLyBOb3JtYWxpemUgdG8gY2VudGVyIG9mIHNjcmVlblxuICAgIGNvbnN0IGNlbnRlclggPSB0aGlzLndpZHRoIC8gMjtcbiAgICBjb25zdCBjZW50ZXJZID0gdGhpcy5oZWlnaHQgLyAyO1xuICAgIFxuICAgIC8vIEFwcGx5IHNjYWxlIGFuZCBvZmZzZXRcbiAgICBjb25zdCBzY3JlZW5YID0geCAqIHRoaXMuc2NhbGUgKiAxMDAgKyBjZW50ZXJYICsgdGhpcy5vZmZzZXRYO1xuICAgIGNvbnN0IHNjcmVlblkgPSB5ICogdGhpcy5zY2FsZSAqIDEwMCArIGNlbnRlclkgKyB0aGlzLm9mZnNldFk7XG4gICAgXG4gICAgcmV0dXJuIFtzY3JlZW5YLCBzY3JlZW5ZXTtcbiAgfVxuICBcbiAgcHVibGljIHNldERhdGEocmVzdWx0OiBUU05FUmVzdWx0KSB7XG4gICAgdGhpcy5yZXN1bHQgPSByZXN1bHQ7XG4gICAgdGhpcy5yZXNldFZpZXcoKTtcbiAgICB0aGlzLmRyYXcoKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSByZXNldFZpZXcoKSB7XG4gICAgdGhpcy5zY2FsZSA9IDE7XG4gICAgdGhpcy5vZmZzZXRYID0gMDtcbiAgICB0aGlzLm9mZnNldFkgPSAwO1xuICB9XG4gIFxuICBwcml2YXRlIGRyYXcoKSB7XG4gICAgaWYgKCF0aGlzLnJlc3VsdCkgcmV0dXJuO1xuICAgIFxuICAgIC8vIENsZWFyIGNhbnZhc1xuICAgIHRoaXMuY3R4LmNsZWFyUmVjdCgwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG4gICAgXG4gICAgLy8gRHJhdyBiYWNrZ3JvdW5kIGdyaWRcbiAgICB0aGlzLmRyYXdHcmlkKCk7XG4gICAgXG4gICAgLy8gRmluZCBjbHVzdGVycyB1c2luZyBhIHNpbXBsZSBkaXN0YW5jZSBtZXRyaWNcbiAgICBjb25zdCBjbHVzdGVycyA9IHRoaXMuZmluZENsdXN0ZXJzKCk7XG4gICAgXG4gICAgLy8gRHJhdyBjbHVzdGVycyBmaXJzdCAodW5kZXJuZWF0aCBwb2ludHMpXG4gICAgdGhpcy5kcmF3Q2x1c3RlcnMoY2x1c3RlcnMpO1xuICAgIFxuICAgIC8vIERyYXcgcG9pbnRzXG4gICAgZm9yIChjb25zdCBwb2ludCBvZiB0aGlzLnJlc3VsdC5wb2ludHMpIHtcbiAgICAgIHRoaXMuZHJhd1BvaW50KHBvaW50KTtcbiAgICB9XG4gICAgXG4gICAgLy8gRHJhdyB0b29sdGlwIGZvciBob3ZlcmVkIHBvaW50XG4gICAgaWYgKHRoaXMuaG92ZXJlZFBvaW50KSB7XG4gICAgICB0aGlzLmRyYXdUb29sdGlwKCk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGRyYXdHcmlkKCkge1xuICAgIGNvbnN0IGdyaWRTaXplID0gNTAgKiB0aGlzLnNjYWxlO1xuICAgIFxuICAgIHRoaXMuY3R4LnN0cm9rZVN0eWxlID0gJ3JnYmEodmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXItcmdiKSwgMC4zKSc7XG4gICAgdGhpcy5jdHgubGluZVdpZHRoID0gMTtcbiAgICBcbiAgICAvLyBWZXJ0aWNhbCBsaW5lc1xuICAgIGZvciAobGV0IHggPSB0aGlzLm9mZnNldFggJSBncmlkU2l6ZTsgeCA8IHRoaXMud2lkdGg7IHggKz0gZ3JpZFNpemUpIHtcbiAgICAgIHRoaXMuY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgdGhpcy5jdHgubW92ZVRvKHgsIDApO1xuICAgICAgdGhpcy5jdHgubGluZVRvKHgsIHRoaXMuaGVpZ2h0KTtcbiAgICAgIHRoaXMuY3R4LnN0cm9rZSgpO1xuICAgIH1cbiAgICBcbiAgICAvLyBIb3Jpem9udGFsIGxpbmVzXG4gICAgZm9yIChsZXQgeSA9IHRoaXMub2Zmc2V0WSAlIGdyaWRTaXplOyB5IDwgdGhpcy5oZWlnaHQ7IHkgKz0gZ3JpZFNpemUpIHtcbiAgICAgIHRoaXMuY3R4LmJlZ2luUGF0aCgpO1xuICAgICAgdGhpcy5jdHgubW92ZVRvKDAsIHkpO1xuICAgICAgdGhpcy5jdHgubGluZVRvKHRoaXMud2lkdGgsIHkpO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlKCk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGZpbmRDbHVzdGVycygpIHtcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm4gW107XG4gICAgXG4gICAgLy8gU2ltcGxlIGNsdXN0ZXJpbmcgYmFzZWQgb24gZGlzdGFuY2VcbiAgICBjb25zdCBwb2ludHMgPSB0aGlzLnJlc3VsdC5wb2ludHM7XG4gICAgY29uc3QgY2x1c3RlcnM6IFRTTkVQb2ludFtdW10gPSBbXTtcbiAgICBjb25zdCB2aXNpdGVkID0gbmV3IFNldDxudW1iZXI+KCk7XG4gICAgXG4gICAgY29uc3QgZGlzdGFuY2VUaHJlc2hvbGQgPSAwLjI7ICAvLyBBZGp1c3QgdGhpcyB0aHJlc2hvbGQgYXMgbmVlZGVkXG4gICAgXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh2aXNpdGVkLmhhcyhpKSkgY29udGludWU7XG4gICAgICBcbiAgICAgIGNvbnN0IGNsdXN0ZXI6IFRTTkVQb2ludFtdID0gW3BvaW50c1tpXV07XG4gICAgICB2aXNpdGVkLmFkZChpKTtcbiAgICAgIFxuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBwb2ludHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKGkgPT09IGogfHwgdmlzaXRlZC5oYXMoaikpIGNvbnRpbnVlO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgZGlzdGFuY2UgPSBNYXRoLnNxcnQoXG4gICAgICAgICAgTWF0aC5wb3cocG9pbnRzW2ldLnggLSBwb2ludHNbal0ueCwgMikgKyBcbiAgICAgICAgICBNYXRoLnBvdyhwb2ludHNbaV0ueSAtIHBvaW50c1tqXS55LCAyKVxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgaWYgKGRpc3RhbmNlIDwgZGlzdGFuY2VUaHJlc2hvbGQpIHtcbiAgICAgICAgICBjbHVzdGVyLnB1c2gocG9pbnRzW2pdKTtcbiAgICAgICAgICB2aXNpdGVkLmFkZChqKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoY2x1c3Rlci5sZW5ndGggPiAxKSB7XG4gICAgICAgIGNsdXN0ZXJzLnB1c2goY2x1c3Rlcik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBjbHVzdGVycztcbiAgfVxuICBcbiAgcHJpdmF0ZSBkcmF3Q2x1c3RlcnMoY2x1c3RlcnM6IFRTTkVQb2ludFtdW10pIHtcbiAgICAvLyBTa2lwIGlmIG5vIHJlc3VsdCBkYXRhXG4gICAgaWYgKCF0aGlzLnJlc3VsdCkgcmV0dXJuO1xuICAgIFxuICAgIC8vIENvbG9yIHBhbGV0dGUgZm9yIGNsdXN0ZXJzIChleGNsdWRpbmcgbm9pc2UgcG9pbnRzKVxuICAgIGNvbnN0IGNvbG9ycyA9IFtcbiAgICAgIHsgZmlsbDogJ3JnYmEoMjU1LCA5OSwgMTMyLCAwLjEpJywgc3Ryb2tlOiAncmdiYSgyNTUsIDk5LCAxMzIsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDU0LCAxNjIsIDIzNSwgMC4xKScsIHN0cm9rZTogJ3JnYmEoNTQsIDE2MiwgMjM1LCAwLjUpJyB9LFxuICAgICAgeyBmaWxsOiAncmdiYSgyNTUsIDIwNiwgODYsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDI1NSwgMjA2LCA4NiwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoNzUsIDE5MiwgMTkyLCAwLjEpJywgc3Ryb2tlOiAncmdiYSg3NSwgMTkyLCAxOTIsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDE1MywgMTAyLCAyNTUsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDE1MywgMTAyLCAyNTUsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDI1NSwgMTU5LCA2NCwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMjU1LCAxNTksIDY0LCAwLjUpJyB9LFxuICAgICAgeyBmaWxsOiAncmdiYSgxOTksIDE5OSwgMTk5LCAwLjEpJywgc3Ryb2tlOiAncmdiYSgxOTksIDE5OSwgMTk5LCAwLjUpJyB9LFxuICAgIF07XG4gICAgXG4gICAgLy8gR3JvdXAgcG9pbnRzIGJ5IGNsdXN0ZXIgSUQgZnJvbSB0aGUgc2VydmVyIHJlc3BvbnNlXG4gICAgY29uc3QgY2x1c3Rlckdyb3VwczogeyBba2V5OiBudW1iZXJdOiBUU05FUG9pbnRbXSB9ID0ge307XG4gICAgXG4gICAgZm9yIChjb25zdCBwb2ludCBvZiB0aGlzLnJlc3VsdC5wb2ludHMpIHtcbiAgICAgIGlmIChwb2ludC5jbHVzdGVyID09PSAtMSkgY29udGludWU7IC8vIFNraXAgbm9pc2UgcG9pbnRzXG4gICAgICBcbiAgICAgIGlmICghY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXSkge1xuICAgICAgICBjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdID0gW107XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0ucHVzaChwb2ludCk7XG4gICAgfVxuICAgIFxuICAgIC8vIERyYXcgZWFjaCBjbHVzdGVyXG4gICAgT2JqZWN0LmVudHJpZXMoY2x1c3Rlckdyb3VwcykuZm9yRWFjaCgoW2NsdXN0ZXJJZCwgcG9pbnRzXSwgaW5kZXgpID0+IHtcbiAgICAgIC8vIEZpbmQgdGhlIGNlbnRyb2lkIGFuZCBib3VuZHMgb2YgdGhlIGNsdXN0ZXJcbiAgICAgIGxldCBtaW5YID0gSW5maW5pdHksIG1pblkgPSBJbmZpbml0eTtcbiAgICAgIGxldCBtYXhYID0gLUluZmluaXR5LCBtYXhZID0gLUluZmluaXR5O1xuICAgICAgbGV0IHN1bVggPSAwLCBzdW1ZID0gMDtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBwb2ludCBvZiBwb2ludHMpIHtcbiAgICAgICAgY29uc3QgW3NjcmVlblgsIHNjcmVlblldID0gdGhpcy53b3JsZFRvU2NyZWVuKHBvaW50LngsIHBvaW50LnkpO1xuICAgICAgICBtaW5YID0gTWF0aC5taW4obWluWCwgc2NyZWVuWCk7XG4gICAgICAgIG1pblkgPSBNYXRoLm1pbihtaW5ZLCBzY3JlZW5ZKTtcbiAgICAgICAgbWF4WCA9IE1hdGgubWF4KG1heFgsIHNjcmVlblgpO1xuICAgICAgICBtYXhZID0gTWF0aC5tYXgobWF4WSwgc2NyZWVuWSk7XG4gICAgICAgIHN1bVggKz0gc2NyZWVuWDtcbiAgICAgICAgc3VtWSArPSBzY3JlZW5ZO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBDYWxjdWxhdGUgY2VudHJvaWRcbiAgICAgIGNvbnN0IGNlbnRlclggPSBzdW1YIC8gcG9pbnRzLmxlbmd0aDtcbiAgICAgIGNvbnN0IGNlbnRlclkgPSBzdW1ZIC8gcG9pbnRzLmxlbmd0aDtcbiAgICAgIFxuICAgICAgLy8gQWRkIHBhZGRpbmdcbiAgICAgIGNvbnN0IHBhZGRpbmcgPSAyMDtcbiAgICAgIG1pblggLT0gcGFkZGluZztcbiAgICAgIG1pblkgLT0gcGFkZGluZztcbiAgICAgIG1heFggKz0gcGFkZGluZztcbiAgICAgIG1heFkgKz0gcGFkZGluZztcbiAgICAgIFxuICAgICAgLy8gVXNlIGNvbG9yIGZyb20gcGFsZXR0ZSAoY3ljbGUgaWYgbW9yZSBjbHVzdGVycyB0aGFuIGNvbG9ycylcbiAgICAgIGNvbnN0IGNvbG9ySW5kZXggPSBwYXJzZUludChjbHVzdGVySWQpICUgY29sb3JzLmxlbmd0aDtcbiAgICAgIGNvbnN0IGNvbG9yID0gY29sb3JzW2NvbG9ySW5kZXhdO1xuICAgICAgXG4gICAgICAvLyBEcmF3IGEgcm91bmRlZCByZWN0YW5nbGUgYXJvdW5kIHRoZSBjbHVzdGVyXG4gICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSBjb2xvci5maWxsO1xuICAgICAgdGhpcy5jdHguc3Ryb2tlU3R5bGUgPSBjb2xvci5zdHJva2U7XG4gICAgICB0aGlzLmN0eC5saW5lV2lkdGggPSAxO1xuICAgICAgXG4gICAgICB0aGlzLnJvdW5kUmVjdChcbiAgICAgICAgbWluWCwgXG4gICAgICAgIG1pblksIFxuICAgICAgICBtYXhYIC0gbWluWCwgXG4gICAgICAgIG1heFkgLSBtaW5ZLCBcbiAgICAgICAgMTBcbiAgICAgICk7XG4gICAgICBcbiAgICAgIHRoaXMuY3R4LmZpbGwoKTtcbiAgICAgIHRoaXMuY3R4LnN0cm9rZSgpO1xuICAgICAgXG4gICAgICAvLyBEcmF3IGNsdXN0ZXIgbGFiZWwgd2l0aCB0b3AgdGVybXMgaWYgYXZhaWxhYmxlXG4gICAgICBpZiAodGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtcyAmJiB0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zW2NsdXN0ZXJJZF0pIHtcbiAgICAgICAgY29uc3QgdGVybXMgPSB0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zW2NsdXN0ZXJJZF1cbiAgICAgICAgICAuc2xpY2UoMCwgMykgIC8vIFRha2UgdG9wIDMgdGVybXNcbiAgICAgICAgICAubWFwKHQgPT4gdC50ZXJtKVxuICAgICAgICAgIC5qb2luKCcsICcpO1xuICAgICAgICBcbiAgICAgICAgLy8gRHJhdyBhIGxhYmVsIHdpdGggY2x1c3RlciBJRCBhbmQgdG9wIHRlcm1zXG4gICAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS10ZXh0LW5vcm1hbCknO1xuICAgICAgICB0aGlzLmN0eC5mb250ID0gJ2JvbGQgMTJweCB2YXIoLS1mb250LXRleHQpJztcbiAgICAgICAgdGhpcy5jdHgudGV4dEFsaWduID0gJ2NlbnRlcic7XG4gICAgICAgIHRoaXMuY3R4LmZpbGxUZXh0KGBDbHVzdGVyICR7Y2x1c3RlcklkfTogJHt0ZXJtc31gLCBjZW50ZXJYLCBtaW5ZIC0gNSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgXG4gIHByaXZhdGUgcm91bmRSZWN0KHg6IG51bWJlciwgeTogbnVtYmVyLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgcmFkaXVzOiBudW1iZXIpIHtcbiAgICB0aGlzLmN0eC5iZWdpblBhdGgoKTtcbiAgICB0aGlzLmN0eC5tb3ZlVG8oeCArIHJhZGl1cywgeSk7XG4gICAgdGhpcy5jdHgubGluZVRvKHggKyB3aWR0aCAtIHJhZGl1cywgeSk7XG4gICAgdGhpcy5jdHguYXJjVG8oeCArIHdpZHRoLCB5LCB4ICsgd2lkdGgsIHkgKyByYWRpdXMsIHJhZGl1cyk7XG4gICAgdGhpcy5jdHgubGluZVRvKHggKyB3aWR0aCwgeSArIGhlaWdodCAtIHJhZGl1cyk7XG4gICAgdGhpcy5jdHguYXJjVG8oeCArIHdpZHRoLCB5ICsgaGVpZ2h0LCB4ICsgd2lkdGggLSByYWRpdXMsIHkgKyBoZWlnaHQsIHJhZGl1cyk7XG4gICAgdGhpcy5jdHgubGluZVRvKHggKyByYWRpdXMsIHkgKyBoZWlnaHQpO1xuICAgIHRoaXMuY3R4LmFyY1RvKHgsIHkgKyBoZWlnaHQsIHgsIHkgKyBoZWlnaHQgLSByYWRpdXMsIHJhZGl1cyk7XG4gICAgdGhpcy5jdHgubGluZVRvKHgsIHkgKyByYWRpdXMpO1xuICAgIHRoaXMuY3R4LmFyY1RvKHgsIHksIHggKyByYWRpdXMsIHksIHJhZGl1cyk7XG4gICAgdGhpcy5jdHguY2xvc2VQYXRoKCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhd1BvaW50KHBvaW50OiBUU05FUG9pbnQpIHtcbiAgICBjb25zdCBbeCwgeV0gPSB0aGlzLndvcmxkVG9TY3JlZW4ocG9pbnQueCwgcG9pbnQueSk7XG4gICAgXG4gICAgLy8gQ29sb3IgcGFsZXR0ZSBmb3IgY2x1c3RlcnNcbiAgICBjb25zdCBjbHVzdGVyQ29sb3JzID0gW1xuICAgICAgJ3JnYmEoMjU1LCA5OSwgMTMyLCAxKScsICAgIC8vIHJlZFxuICAgICAgJ3JnYmEoNTQsIDE2MiwgMjM1LCAxKScsICAgIC8vIGJsdWVcbiAgICAgICdyZ2JhKDI1NSwgMjA2LCA4NiwgMSknLCAgICAvLyB5ZWxsb3dcbiAgICAgICdyZ2JhKDc1LCAxOTIsIDE5MiwgMSknLCAgICAvLyBncmVlblxuICAgICAgJ3JnYmEoMTUzLCAxMDIsIDI1NSwgMSknLCAgIC8vIHB1cnBsZVxuICAgICAgJ3JnYmEoMjU1LCAxNTksIDY0LCAxKScsICAgIC8vIG9yYW5nZVxuICAgICAgJ3JnYmEoMTk5LCAxOTksIDE5OSwgMSknLCAgIC8vIGdyZXlcbiAgICBdO1xuICAgIFxuICAgIC8vIERyYXcgY2lyY2xlXG4gICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgdGhpcy5jdHguYXJjKHgsIHksIHRoaXMucG9pbnRSYWRpdXMsIDAsIE1hdGguUEkgKiAyKTtcbiAgICBcbiAgICAvLyBEZXRlcm1pbmUgY29sb3IgYmFzZWQgb24gaG92ZXIgc3RhdGUgYW5kIGNsdXN0ZXJcbiAgICBpZiAodGhpcy5ob3ZlcmVkUG9pbnQgPT09IHBvaW50KSB7XG4gICAgICAvLyBIb3ZlcmVkIHBvaW50cyBhcmUgYWx3YXlzIGhpZ2hsaWdodGVkIGluIHRoZSBhY2NlbnQgY29sb3JcbiAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICd2YXIoLS1pbnRlcmFjdGl2ZS1hY2NlbnQpJztcbiAgICB9IGVsc2UgaWYgKHBvaW50LmNsdXN0ZXIgPT09IC0xKSB7XG4gICAgICAvLyBOb2lzZSBwb2ludHMgKG5vdCBpbiBhIGNsdXN0ZXIpIGFyZSBncmV5XG4gICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAndmFyKC0tdGV4dC1tdXRlZCknO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBQb2ludHMgaW4gY2x1c3RlcnMgdXNlIHRoZSBjbHVzdGVyIGNvbG9yIHBhbGV0dGVcbiAgICAgIGNvbnN0IGNvbG9ySW5kZXggPSBwb2ludC5jbHVzdGVyICUgY2x1c3RlckNvbG9ycy5sZW5ndGg7XG4gICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSBjbHVzdGVyQ29sb3JzW2NvbG9ySW5kZXhdO1xuICAgIH1cbiAgICBcbiAgICB0aGlzLmN0eC5maWxsKCk7XG4gICAgXG4gICAgLy8gQWRkIGJvcmRlciB0byBwb2ludHNcbiAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9ICd2YXIoLS1iYWNrZ3JvdW5kLXByaW1hcnkpJztcbiAgICB0aGlzLmN0eC5saW5lV2lkdGggPSAxO1xuICAgIHRoaXMuY3R4LnN0cm9rZSgpO1xuICAgIFxuICAgIC8vIERyYXcgdGl0bGUgaWYgbm90IGhvdmVyZWQgKGhvdmVyZWQgc2hvd3MgaW4gdG9vbHRpcClcbiAgICBpZiAodGhpcy5ob3ZlcmVkUG9pbnQgIT09IHBvaW50KSB7XG4gICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAndmFyKC0tdGV4dC1ub3JtYWwpJztcbiAgICAgIHRoaXMuY3R4LmZvbnQgPSAnMTJweCB2YXIoLS1mb250LXRleHQpJztcbiAgICAgIHRoaXMuY3R4LnRleHRBbGlnbiA9ICdjZW50ZXInO1xuICAgICAgdGhpcy5jdHguZmlsbFRleHQocG9pbnQudGl0bGUsIHgsIHkgLSB0aGlzLnBvaW50UmFkaXVzIC0gNSk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGRyYXdUb29sdGlwKCkge1xuICAgIGlmICghdGhpcy5ob3ZlcmVkUG9pbnQgfHwgIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgY29uc3QgW3gsIHldID0gdGhpcy53b3JsZFRvU2NyZWVuKHRoaXMuaG92ZXJlZFBvaW50LngsIHRoaXMuaG92ZXJlZFBvaW50LnkpO1xuICAgIGNvbnN0IHBvaW50ID0gdGhpcy5ob3ZlcmVkUG9pbnQ7XG4gICAgXG4gICAgLy8gVG9vbHRpcCBjb250ZW50XG4gICAgY29uc3QgdGl0bGUgPSBwb2ludC50aXRsZTtcbiAgICBjb25zdCBwYXRoID0gcG9pbnQucGF0aDtcbiAgICBjb25zdCB0ZXJtcyA9IHBvaW50LnRvcF90ZXJtcy5qb2luKCcsICcpO1xuICAgIFxuICAgIC8vIEZvcm1hdCBkYXRlcyBpZiBhdmFpbGFibGVcbiAgICBjb25zdCBmb3JtYXREYXRlID0gKHRpbWVzdGFtcD86IG51bWJlcikgPT4ge1xuICAgICAgaWYgKCF0aW1lc3RhbXApIHJldHVybiAnVW5rbm93bic7XG4gICAgICBjb25zdCBkYXRlID0gbmV3IERhdGUodGltZXN0YW1wKTtcbiAgICAgIHJldHVybiBkYXRlLnRvTG9jYWxlRGF0ZVN0cmluZygpICsgJyAnICsgZGF0ZS50b0xvY2FsZVRpbWVTdHJpbmcoW10sIHsgaG91cjogJzItZGlnaXQnLCBtaW51dGU6ICcyLWRpZ2l0JyB9KTtcbiAgICB9O1xuICAgIFxuICAgIC8vIEdldCBtZXRhZGF0YVxuICAgIGNvbnN0IG1vZGlmaWVkID0gZm9ybWF0RGF0ZShwb2ludC5tdGltZSk7XG4gICAgY29uc3QgY3JlYXRlZCA9IGZvcm1hdERhdGUocG9pbnQuY3RpbWUpO1xuICAgIGNvbnN0IHdvcmRDb3VudCA9IHBvaW50LndvcmRDb3VudCA/IGAke3BvaW50LndvcmRDb3VudH0gd29yZHNgIDogJ1Vua25vd24nO1xuICAgIGNvbnN0IHJlYWRpbmdUaW1lID0gcG9pbnQucmVhZGluZ1RpbWUgPyBgfiR7cG9pbnQucmVhZGluZ1RpbWV9IG1pbiByZWFkYCA6ICcnO1xuICAgIFxuICAgIC8vIEZvcm1hdCB0YWdzXG4gICAgY29uc3QgdGFncyA9IHBvaW50LnRhZ3MgJiYgcG9pbnQudGFncy5sZW5ndGggPiAwIFxuICAgICAgPyBwb2ludC50YWdzLm1hcCh0YWcgPT4gYCMke3RhZ31gKS5qb2luKCcgJylcbiAgICAgIDogJ05vIHRhZ3MnO1xuICAgIFxuICAgIC8vIEZvcm1hdCBjb250ZW50IHByZXZpZXdcbiAgICBjb25zdCBwcmV2aWV3ID0gcG9pbnQuY29udGVudFByZXZpZXcgfHwgJ05vIHByZXZpZXcgYXZhaWxhYmxlJztcbiAgICBcbiAgICAvLyBHZXQgZGlzdGFuY2UgdG8gY2VudGVyXG4gICAgY29uc3QgZGlzdGFuY2VJbmZvID0gcG9pbnQuZGlzdGFuY2VUb0NlbnRlciAhPT0gdW5kZWZpbmVkICYmIHBvaW50LmNsdXN0ZXIgIT09IC0xXG4gICAgICA/IGBEaXN0YW5jZSB0byBjZW50ZXI6ICR7cG9pbnQuZGlzdGFuY2VUb0NlbnRlci50b0ZpeGVkKDIpfWBcbiAgICAgIDogJyc7XG4gICAgXG4gICAgLy8gR2V0IGNsdXN0ZXIgaW5mb3JtYXRpb25cbiAgICBsZXQgY2x1c3RlckluZm8gPSAnTm90IGNsdXN0ZXJlZCc7XG4gICAgaWYgKHBvaW50LmNsdXN0ZXIgIT09IC0xKSB7XG4gICAgICBjb25zdCBjbHVzdGVySWQgPSBwb2ludC5jbHVzdGVyO1xuICAgICAgXG4gICAgICAvLyBHZXQgY2x1c3RlciB0ZXJtcyBpZiBhdmFpbGFibGVcbiAgICAgIGxldCBjbHVzdGVyVGVybXMgPSAnJztcbiAgICAgIGlmICh0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zICYmIHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXNbY2x1c3RlcklkXSkge1xuICAgICAgICBjbHVzdGVyVGVybXMgPSB0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zW2NsdXN0ZXJJZF1cbiAgICAgICAgICAuc2xpY2UoMCwgMykgLy8gVGFrZSB0b3AgMyB0ZXJtc1xuICAgICAgICAgIC5tYXAodCA9PiB0LnRlcm0pXG4gICAgICAgICAgLmpvaW4oJywgJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNsdXN0ZXJJbmZvID0gYENsdXN0ZXIgJHtjbHVzdGVySWR9OiAke2NsdXN0ZXJUZXJtc31gO1xuICAgIH1cbiAgICBcbiAgICAvLyBEZWZpbmUgYWxsIHRvb2x0aXAgc2VjdGlvbnMgLSBtb3JlIGNvbXBhY3QgbGF5b3V0IHdpdGggZ3JvdXBpbmdcbiAgICBjb25zdCBzZWN0aW9ucyA9IFtcbiAgICAgIHsgXG4gICAgICAgIGxhYmVsOiAnVGl0bGUnLCBcbiAgICAgICAgdGV4dDogdGl0bGUsIFxuICAgICAgICBmb250OiAnYm9sZCAxNHB4IHNhbnMtc2VyaWYnLFxuICAgICAgICBhbHdheXNTaG93OiB0cnVlICAvLyBBbHdheXMgc2hvdyB0aXRsZVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbGFiZWw6ICdQYXRoJywgXG4gICAgICAgIHRleHQ6IHBhdGgsIFxuICAgICAgICBmb250OiAnaXRhbGljIDExcHggc2Fucy1zZXJpZicsXG4gICAgICAgIHNraXBJZkVtcHR5OiB0cnVlXG4gICAgICB9LFxuICAgICAgeyBcbiAgICAgICAgbGFiZWw6ICdLZXl3b3JkcycsIFxuICAgICAgICB0ZXh0OiB0ZXJtcywgXG4gICAgICAgIHNraXBJZkVtcHR5OiB0cnVlXG4gICAgICB9LFxuICAgICAgeyBcbiAgICAgICAgbGFiZWw6ICdDbHVzdGVyJywgXG4gICAgICAgIHRleHQ6IGNsdXN0ZXJJbmZvLCBcbiAgICAgICAgc2tpcElmRW1wdHk6IHRydWVcbiAgICAgIH0sXG4gICAgICAvLyBDb21iaW5lIHRhZ3MgYW5kIHN0YXRzIGludG8gb25lIGxpbmUgaWYgYm90aCBleGlzdFxuICAgICAgeyBcbiAgICAgICAgbGFiZWw6ICdJbmZvJywgXG4gICAgICAgIHRleHQ6IFtcbiAgICAgICAgICB0YWdzICE9PSAnTm8gdGFncycgPyB0YWdzIDogbnVsbCxcbiAgICAgICAgICB3b3JkQ291bnQgJiYgcmVhZGluZ1RpbWUgPyBgJHt3b3JkQ291bnR9ICgke3JlYWRpbmdUaW1lfSlgIDogd29yZENvdW50IHx8ICcnXG4gICAgICAgIF0uZmlsdGVyKEJvb2xlYW4pLmpvaW4oJyDigKIgJyksXG4gICAgICAgIHNraXBJZkVtcHR5OiB0cnVlXG4gICAgICB9LFxuICAgICAgLy8gQ29tYmluZSBkYXRlcyBpbnRvIG9uZSBsaW5lIHRvIHNhdmUgc3BhY2VcbiAgICAgIHsgXG4gICAgICAgIGxhYmVsOiAnRGF0ZXMnLCBcbiAgICAgICAgdGV4dDogYE1vZGlmaWVkOiAke21vZGlmaWVkfSR7cG9pbnQuY3RpbWUgPyBgIOKAoiBDcmVhdGVkOiAke2NyZWF0ZWR9YCA6ICcnfWAsXG4gICAgICAgIGZvbnQ6ICcxMXB4IHNhbnMtc2VyaWYnLFxuICAgICAgICBza2lwSWZFbXB0eTogcG9pbnQubXRpbWUgPT09IHVuZGVmaW5lZFxuICAgICAgfSxcbiAgICAgIC8vIENvbnRlbnQgcHJldmlldyBpcyBzaG93biBpbiBhIGRpc3RpbmN0IHN0eWxlXG4gICAgICB7IFxuICAgICAgICBsYWJlbDogJ1ByZXZpZXcnLCBcbiAgICAgICAgdGV4dDogcHJldmlldywgXG4gICAgICAgIGZvbnQ6ICdpdGFsaWMgMTFweCBzYW5zLXNlcmlmJyxcbiAgICAgICAgc2tpcElmRW1wdHk6ICFwb2ludC5jb250ZW50UHJldmlldyB8fCBwb2ludC5jb250ZW50UHJldmlldy5sZW5ndGggPCA1XG4gICAgICB9LFxuICAgICAgLy8gU2hvdyBkaXN0YW5jZSBpbmZvIG9ubHkgaWYgaXQgZXhpc3RzXG4gICAgICB7IFxuICAgICAgICBsYWJlbDogJycsIFxuICAgICAgICB0ZXh0OiBkaXN0YW5jZUluZm8sIFxuICAgICAgICBmb250OiAnMTBweCBzYW5zLXNlcmlmJyxcbiAgICAgICAgc2tpcElmRW1wdHk6IHRydWUgXG4gICAgICB9XG4gICAgXTtcbiAgICBcbiAgICAvLyBTZXQgcHJvcGVyIGZvbnQgZm9yIG1lYXN1cmVtZW50c1xuICAgIHRoaXMuY3R4LmZvbnQgPSAnYm9sZCAxNHB4IHNhbnMtc2VyaWYnO1xuICAgIGxldCB0b29sdGlwV2lkdGggPSB0aGlzLmN0eC5tZWFzdXJlVGV4dCh0aXRsZSkud2lkdGggKyAyMDsgLy8gQWRkIHNvbWUgcGFkZGluZ1xuICAgIFxuICAgIC8vIENhbGN1bGF0ZSBtYXhpbXVtIHdpZHRoIG5lZWRlZFxuICAgIHNlY3Rpb25zLmZvckVhY2goc2VjdGlvbiA9PiB7XG4gICAgICBpZiAoc2VjdGlvbi5hbHdheXNTaG93IHx8ICghc2VjdGlvbi5za2lwSWZFbXB0eSB8fCBzZWN0aW9uLnRleHQpKSB7XG4gICAgICAgIHRoaXMuY3R4LmZvbnQgPSBzZWN0aW9uLmZvbnQgfHwgJzEycHggc2Fucy1zZXJpZic7XG4gICAgICAgIGNvbnN0IHdpZHRoID0gdGhpcy5jdHgubWVhc3VyZVRleHQoXG4gICAgICAgICAgc2VjdGlvbi5sYWJlbCA/IGAke3NlY3Rpb24ubGFiZWx9OiAke3NlY3Rpb24udGV4dH1gIDogc2VjdGlvbi50ZXh0XG4gICAgICAgICkud2lkdGggKyAyMDsgLy8gQWRkIHBhZGRpbmdcbiAgICAgICAgdG9vbHRpcFdpZHRoID0gTWF0aC5tYXgodG9vbHRpcFdpZHRoLCB3aWR0aCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgLy8gTGltaXQgdG9vbHRpcCB3aWR0aCB0byBhIHJlYXNvbmFibGUgbWF4aW11bSAoODAlIG9mIGNhbnZhcyB3aWR0aClcbiAgICB0b29sdGlwV2lkdGggPSBNYXRoLm1pbih0b29sdGlwV2lkdGgsIHRoaXMud2lkdGggKiAwLjgpO1xuICAgIFxuICAgIC8vIENhbGN1bGF0ZSB0b29sdGlwIGhlaWdodCB3aXRoIG1vcmUgY29tcGFjdCBsaW5lIHNwYWNpbmdcbiAgICBjb25zdCBsaW5lSGVpZ2h0ID0gMTg7IC8vIFNsaWdodGx5IHNtYWxsZXIgbGluZSBoZWlnaHRcbiAgICAvLyBDb3VudCBob3cgbWFueSBzZWN0aW9ucyB3aWxsIGJlIHZpc2libGVcbiAgICBjb25zdCB2aXNpYmxlU2VjdGlvbnMgPSBzZWN0aW9ucy5maWx0ZXIocyA9PiBcbiAgICAgIHMuYWx3YXlzU2hvdyB8fCAoIXMuc2tpcElmRW1wdHkgfHwgcy50ZXh0KVxuICAgICkubGVuZ3RoO1xuICAgIFxuICAgIC8vIE1vcmUgY29tcGFjdCB0b29sdGlwIGhlaWdodFxuICAgIGNvbnN0IHRvb2x0aXBIZWlnaHQgPSB2aXNpYmxlU2VjdGlvbnMgKiBsaW5lSGVpZ2h0ICsgMTI7IC8vIExlc3MgcGFkZGluZ1xuICAgIFxuICAgIC8vIFBvc2l0aW9uIHRvb2x0aXAgLSBlbnN1cmUgaXQgc3RheXMgZnVsbHkgdmlzaWJsZSB3aXRoaW4gdGhlIGNhbnZhc1xuICAgIC8vIElmIHRvb2x0aXAgaXMgdG9vIHdpZGUsIHBvc2l0aW9uIGl0IHRvIHRoZSBsZWZ0IG9mIHRoZSBwb2ludCBpbnN0ZWFkIG9mIHRoZSByaWdodFxuICAgIGxldCB0b29sdGlwWCA9IHggKyAxMDtcbiAgICBpZiAodG9vbHRpcFggKyB0b29sdGlwV2lkdGggPiB0aGlzLndpZHRoIC0gMTApIHtcbiAgICAgIHRvb2x0aXBYID0geCAtIHRvb2x0aXBXaWR0aCAtIDEwO1xuICAgIH1cbiAgICBcbiAgICAvLyBJZiB0b29sdGlwIGlzIHN0aWxsIG91dCBvZiBib3VuZHMgKHJhcmUgY2FzZSB3aXRoIHZlcnkgd2lkZSB0b29sdGlwcyksIGNlbnRlciBpdFxuICAgIGlmICh0b29sdGlwWCA8IDEwKSB7XG4gICAgICB0b29sdGlwWCA9IE1hdGgubWF4KDEwLCBNYXRoLm1pbih0aGlzLndpZHRoIC0gdG9vbHRpcFdpZHRoIC0gMTAsIHggLSB0b29sdGlwV2lkdGgvMikpO1xuICAgIH1cbiAgICBcbiAgICAvLyBQb3NpdGlvbiB2ZXJ0aWNhbGx5IC0gdHJ5IHRvIHBsYWNlIGFib3ZlIHRoZSBwb2ludCBpZiBpdCB3b3VsZCBnbyBvZmYgYm90dG9tXG4gICAgbGV0IHRvb2x0aXBZID0geSArIDEwO1xuICAgIGlmICh0b29sdGlwWSArIHRvb2x0aXBIZWlnaHQgPiB0aGlzLmhlaWdodCAtIDEwKSB7XG4gICAgICB0b29sdGlwWSA9IHkgLSB0b29sdGlwSGVpZ2h0IC0gMTA7XG4gICAgfVxuICAgIFxuICAgIC8vIElmIHRvb2x0aXAgaXMgc3RpbGwgb3V0IG9mIGJvdW5kcywgcG9zaXRpb24gaXQgdG8gbWluaW1pemUgb3ZlcmZsb3dcbiAgICBpZiAodG9vbHRpcFkgPCAxMCkge1xuICAgICAgdG9vbHRpcFkgPSAxMDtcbiAgICB9XG4gICAgXG4gICAgLy8gRmluYWwgY2hlY2sgdG8gZW5zdXJlIHRvb2x0aXAgaXMgYXMgdmlzaWJsZSBhcyBwb3NzaWJsZVxuICAgIHRvb2x0aXBYID0gTWF0aC5tYXgoMTAsIE1hdGgubWluKHRvb2x0aXBYLCB0aGlzLndpZHRoIC0gdG9vbHRpcFdpZHRoIC0gMTApKTtcbiAgICB0b29sdGlwWSA9IE1hdGgubWF4KDEwLCBNYXRoLm1pbih0b29sdGlwWSwgdGhpcy5oZWlnaHQgLSB0b29sdGlwSGVpZ2h0IC0gMTApKTtcbiAgICBcbiAgICAvLyBEcmF3IHRvb2x0aXAgYmFja2dyb3VuZCAtIHVzZSBhIG5pY2VyIGdyYWRpZW50XG4gICAgY29uc3QgZ3JhZGllbnQgPSB0aGlzLmN0eC5jcmVhdGVMaW5lYXJHcmFkaWVudCh0b29sdGlwWCwgdG9vbHRpcFksIHRvb2x0aXBYLCB0b29sdGlwWSArIHRvb2x0aXBIZWlnaHQpO1xuICAgIGdyYWRpZW50LmFkZENvbG9yU3RvcCgwLCAncmdiYSgyNTUsIDI1NSwgMjU1LCAwLjk1KScpO1xuICAgIGdyYWRpZW50LmFkZENvbG9yU3RvcCgxLCAncmdiYSgyNDUsIDI0NSwgMjUwLCAwLjk1KScpO1xuICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9IGdyYWRpZW50O1xuICAgIHRoaXMuY3R4LnN0cm9rZVN0eWxlID0gJ3JnYmEoMTUwLCAxNTAsIDE2MCwgMC44KSc7XG4gICAgdGhpcy5jdHgubGluZVdpZHRoID0gMTtcbiAgICBcbiAgICB0aGlzLnJvdW5kUmVjdCh0b29sdGlwWCwgdG9vbHRpcFksIHRvb2x0aXBXaWR0aCwgdG9vbHRpcEhlaWdodCwgNSk7XG4gICAgdGhpcy5jdHguZmlsbCgpO1xuICAgIHRoaXMuY3R4LnN0cm9rZSgpO1xuICAgIFxuICAgIC8vIERyYXcgdG9vbHRpcCBjb250ZW50XG4gICAgdGhpcy5jdHgudGV4dEFsaWduID0gJ2xlZnQnO1xuICAgIFxuICAgIC8vIERyYXcgZWFjaCBzZWN0aW9uXG4gICAgbGV0IGN1cnJlbnRZID0gdG9vbHRpcFkgKyAxNDtcbiAgICBzZWN0aW9ucy5mb3JFYWNoKHNlY3Rpb24gPT4ge1xuICAgICAgaWYgKCFzZWN0aW9uLmFsd2F5c1Nob3cgJiYgKHNlY3Rpb24uc2tpcElmRW1wdHkgJiYgIXNlY3Rpb24udGV4dCkpIHJldHVybjtcbiAgICAgIFxuICAgICAgdGhpcy5jdHguZm9udCA9IHNlY3Rpb24uZm9udCB8fCAnMTJweCBzYW5zLXNlcmlmJztcbiAgICAgIFxuICAgICAgLy8gVXNlIGRpZmZlcmVudCB0ZXh0IGNvbG9ycyBmb3IgZGlmZmVyZW50IHNlY3Rpb25zXG4gICAgICBpZiAoc2VjdGlvbi5sYWJlbCA9PT0gJ1RpdGxlJykge1xuICAgICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAnIzMzMzMzMyc7IC8vIERhcmsgZ3JheSBmb3IgdGl0bGVcbiAgICAgIH0gZWxzZSBpZiAoc2VjdGlvbi5sYWJlbCA9PT0gJ1ByZXZpZXcnKSB7XG4gICAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICcjNjY2NjY2JzsgLy8gTWVkaXVtIGdyYXkgZm9yIHByZXZpZXdcbiAgICAgIH0gZWxzZSBpZiAoc2VjdGlvbi5sYWJlbCA9PT0gJycpIHtcbiAgICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJyM5OTk5OTknOyAvLyBMaWdodCBncmF5IGZvciBub3Rlc1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJyM0NDQ0NDQnOyAvLyBOb3JtYWwgdGV4dCBjb2xvclxuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCB0ZXh0ID0gc2VjdGlvbi5sYWJlbCAmJiBzZWN0aW9uLmxhYmVsICE9PSAnVGl0bGUnXG4gICAgICAgID8gYCR7c2VjdGlvbi5sYWJlbH06ICR7c2VjdGlvbi50ZXh0fWBcbiAgICAgICAgOiBzZWN0aW9uLnRleHQ7XG4gICAgICBcbiAgICAgIC8vIEZvciBsb25nZXIgdGV4dCwgaGFuZGxlIHdyYXBwaW5nXG4gICAgICBpZiAodGhpcy5jdHgubWVhc3VyZVRleHQodGV4dCkud2lkdGggPiB0b29sdGlwV2lkdGggLSAyMCkge1xuICAgICAgICBjb25zdCB3b3JkcyA9IHRleHQuc3BsaXQoJyAnKTtcbiAgICAgICAgbGV0IGxpbmUgPSAnJztcbiAgICAgICAgXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd29yZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBjb25zdCB0ZXN0TGluZSA9IGxpbmUgKyB3b3Jkc1tpXSArICcgJztcbiAgICAgICAgICBjb25zdCBtZXRyaWNzID0gdGhpcy5jdHgubWVhc3VyZVRleHQodGVzdExpbmUpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChtZXRyaWNzLndpZHRoID4gdG9vbHRpcFdpZHRoIC0gMjAgJiYgaSA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuY3R4LmZpbGxUZXh0KGxpbmUsIHRvb2x0aXBYICsgMTAsIGN1cnJlbnRZKTtcbiAgICAgICAgICAgIGxpbmUgPSB3b3Jkc1tpXSArICcgJztcbiAgICAgICAgICAgIGN1cnJlbnRZICs9IGxpbmVIZWlnaHQgKiAwLjg7IC8vIFNtYWxsZXIgc3BhY2luZyBmb3Igd3JhcHBlZCB0ZXh0XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxpbmUgPSB0ZXN0TGluZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHRoaXMuY3R4LmZpbGxUZXh0KGxpbmUsIHRvb2x0aXBYICsgMTAsIGN1cnJlbnRZKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY3R4LmZpbGxUZXh0KHRleHQsIHRvb2x0aXBYICsgMTAsIGN1cnJlbnRZKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY3VycmVudFkgKz0gbGluZUhlaWdodDtcbiAgICB9KTtcbiAgfVxufVxuXG5jbGFzcyBTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHBsdWdpbjogVmliZUJveVBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBWaWJlQm95UGx1Z2luKSB7XG4gICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG5cbiAgZGlzcGxheSgpOiB2b2lkIHtcbiAgICBjb25zdCB7Y29udGFpbmVyRWx9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywge3RleHQ6ICdWaWJlIEJvaSAtIHQtU05FIFNldHRpbmdzJ30pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnUGVycGxleGl0eScpXG4gICAgICAuc2V0RGVzYygnQ29udHJvbHMgdGhlIGJhbGFuY2UgYmV0d2VlbiBsb2NhbCBhbmQgZ2xvYmFsIGFzcGVjdHMgb2YgdGhlIGRhdGEgKHJlY29tbWVuZGVkOiA1LTUwKScpXG4gICAgICAuYWRkU2xpZGVyKHNsaWRlciA9PiBzbGlkZXJcbiAgICAgICAgLnNldExpbWl0cyg1LCAxMDAsIDUpXG4gICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5wZXJwbGV4aXR5KVxuICAgICAgICAuc2V0RHluYW1pY1Rvb2x0aXAoKVxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucGVycGxleGl0eSA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKCdJdGVyYXRpb25zJylcbiAgICAgIC5zZXREZXNjKCdOdW1iZXIgb2YgaXRlcmF0aW9ucyB0byBydW4gdGhlIGFsZ29yaXRobScpXG4gICAgICAuYWRkU2xpZGVyKHNsaWRlciA9PiBzbGlkZXJcbiAgICAgICAgLnNldExpbWl0cygyNTAsIDIwMDAsIDI1MClcbiAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLml0ZXJhdGlvbnMpXG4gICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pdGVyYXRpb25zID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pKTtcbiAgICAgICAgXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnRXBzaWxvbiAobGVhcm5pbmcgcmF0ZSknKVxuICAgICAgLnNldERlc2MoJ0NvbnRyb2xzIHRoZSBzcGVlZCBvZiBvcHRpbWl6YXRpb24nKVxuICAgICAgLmFkZFNsaWRlcihzbGlkZXIgPT4gc2xpZGVyXG4gICAgICAgIC5zZXRMaW1pdHMoMSwgMTAwLCAxKVxuICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZXBzaWxvbilcbiAgICAgICAgLnNldER5bmFtaWNUb29sdGlwKClcbiAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmVwc2lsb24gPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkpO1xuICB9XG59Il0sIm5hbWVzIjpbIk1vZGFsIiwiQnV0dG9uQ29tcG9uZW50IiwiVGV4dEFyZWFDb21wb25lbnQiLCJURmlsZSIsIk5vdGljZSIsIkl0ZW1WaWV3IiwiUGx1Z2luIiwiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBb0dBO0FBQ08sU0FBUyxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFO0FBQzdELElBQUksU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsT0FBTyxLQUFLLFlBQVksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxVQUFVLE9BQU8sRUFBRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQ2hILElBQUksT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsVUFBVSxPQUFPLEVBQUUsTUFBTSxFQUFFO0FBQy9ELFFBQVEsU0FBUyxTQUFTLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUNuRyxRQUFRLFNBQVMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUN0RyxRQUFRLFNBQVMsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRTtBQUN0SCxRQUFRLElBQUksQ0FB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
