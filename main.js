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
            .setClass('generate-button mod-cta')
            .onClick(() => __awaiter(this, void 0, void 0, function* () {
            yield this.generateLLMDescription(connection);
        }));
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
                .setClass('mod-cta')
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9vYnNpZGlhbi1wbHVnaW4vbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuLyogZ2xvYmFsIFJlZmxlY3QsIFByb21pc2UsIFN1cHByZXNzZWRFcnJvciwgU3ltYm9sLCBJdGVyYXRvciAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19lc0RlY29yYXRlKGN0b3IsIGRlc2NyaXB0b3JJbiwgZGVjb3JhdG9ycywgY29udGV4dEluLCBpbml0aWFsaXplcnMsIGV4dHJhSW5pdGlhbGl6ZXJzKSB7XHJcbiAgICBmdW5jdGlvbiBhY2NlcHQoZikgeyBpZiAoZiAhPT0gdm9pZCAwICYmIHR5cGVvZiBmICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGdW5jdGlvbiBleHBlY3RlZFwiKTsgcmV0dXJuIGY7IH1cclxuICAgIHZhciBraW5kID0gY29udGV4dEluLmtpbmQsIGtleSA9IGtpbmQgPT09IFwiZ2V0dGVyXCIgPyBcImdldFwiIDoga2luZCA9PT0gXCJzZXR0ZXJcIiA/IFwic2V0XCIgOiBcInZhbHVlXCI7XHJcbiAgICB2YXIgdGFyZ2V0ID0gIWRlc2NyaXB0b3JJbiAmJiBjdG9yID8gY29udGV4dEluW1wic3RhdGljXCJdID8gY3RvciA6IGN0b3IucHJvdG90eXBlIDogbnVsbDtcclxuICAgIHZhciBkZXNjcmlwdG9yID0gZGVzY3JpcHRvckluIHx8ICh0YXJnZXQgPyBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwgY29udGV4dEluLm5hbWUpIDoge30pO1xyXG4gICAgdmFyIF8sIGRvbmUgPSBmYWxzZTtcclxuICAgIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgICAgdmFyIGNvbnRleHQgPSB7fTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbikgY29udGV4dFtwXSA9IHAgPT09IFwiYWNjZXNzXCIgPyB7fSA6IGNvbnRleHRJbltwXTtcclxuICAgICAgICBmb3IgKHZhciBwIGluIGNvbnRleHRJbi5hY2Nlc3MpIGNvbnRleHQuYWNjZXNzW3BdID0gY29udGV4dEluLmFjY2Vzc1twXTtcclxuICAgICAgICBjb250ZXh0LmFkZEluaXRpYWxpemVyID0gZnVuY3Rpb24gKGYpIHsgaWYgKGRvbmUpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgYWRkIGluaXRpYWxpemVycyBhZnRlciBkZWNvcmF0aW9uIGhhcyBjb21wbGV0ZWRcIik7IGV4dHJhSW5pdGlhbGl6ZXJzLnB1c2goYWNjZXB0KGYgfHwgbnVsbCkpOyB9O1xyXG4gICAgICAgIHZhciByZXN1bHQgPSAoMCwgZGVjb3JhdG9yc1tpXSkoa2luZCA9PT0gXCJhY2Nlc3NvclwiID8geyBnZXQ6IGRlc2NyaXB0b3IuZ2V0LCBzZXQ6IGRlc2NyaXB0b3Iuc2V0IH0gOiBkZXNjcmlwdG9yW2tleV0sIGNvbnRleHQpO1xyXG4gICAgICAgIGlmIChraW5kID09PSBcImFjY2Vzc29yXCIpIHtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gdm9pZCAwKSBjb250aW51ZTtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCB8fCB0eXBlb2YgcmVzdWx0ICE9PSBcIm9iamVjdFwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiT2JqZWN0IGV4cGVjdGVkXCIpO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuZ2V0KSkgZGVzY3JpcHRvci5nZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuc2V0KSkgZGVzY3JpcHRvci5zZXQgPSBfO1xyXG4gICAgICAgICAgICBpZiAoXyA9IGFjY2VwdChyZXN1bHQuaW5pdCkpIGluaXRpYWxpemVycy51bnNoaWZ0KF8pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChfID0gYWNjZXB0KHJlc3VsdCkpIHtcclxuICAgICAgICAgICAgaWYgKGtpbmQgPT09IFwiZmllbGRcIikgaW5pdGlhbGl6ZXJzLnVuc2hpZnQoXyk7XHJcbiAgICAgICAgICAgIGVsc2UgZGVzY3JpcHRvcltrZXldID0gXztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAodGFyZ2V0KSBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBjb250ZXh0SW4ubmFtZSwgZGVzY3JpcHRvcik7XHJcbiAgICBkb25lID0gdHJ1ZTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3J1bkluaXRpYWxpemVycyh0aGlzQXJnLCBpbml0aWFsaXplcnMsIHZhbHVlKSB7XHJcbiAgICB2YXIgdXNlVmFsdWUgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5pdGlhbGl6ZXJzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFsdWUgPSB1c2VWYWx1ZSA/IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcsIHZhbHVlKSA6IGluaXRpYWxpemVyc1tpXS5jYWxsKHRoaXNBcmcpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHVzZVZhbHVlID8gdmFsdWUgOiB2b2lkIDA7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wcm9wS2V5KHgpIHtcclxuICAgIHJldHVybiB0eXBlb2YgeCA9PT0gXCJzeW1ib2xcIiA/IHggOiBcIlwiLmNvbmNhdCh4KTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NldEZ1bmN0aW9uTmFtZShmLCBuYW1lLCBwcmVmaXgpIHtcclxuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gXCJzeW1ib2xcIikgbmFtZSA9IG5hbWUuZGVzY3JpcHRpb24gPyBcIltcIi5jb25jYXQobmFtZS5kZXNjcmlwdGlvbiwgXCJdXCIpIDogXCJcIjtcclxuICAgIHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkoZiwgXCJuYW1lXCIsIHsgY29uZmlndXJhYmxlOiB0cnVlLCB2YWx1ZTogcHJlZml4ID8gXCJcIi5jb25jYXQocHJlZml4LCBcIiBcIiwgbmFtZSkgOiBuYW1lIH0pO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpIHtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5tZXRhZGF0YSA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gUmVmbGVjdC5tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0ZXIodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19nZW5lcmF0b3IodGhpc0FyZywgYm9keSkge1xyXG4gICAgdmFyIF8gPSB7IGxhYmVsOiAwLCBzZW50OiBmdW5jdGlvbigpIHsgaWYgKHRbMF0gJiAxKSB0aHJvdyB0WzFdOyByZXR1cm4gdFsxXTsgfSwgdHJ5czogW10sIG9wczogW10gfSwgZiwgeSwgdCwgZyA9IE9iamVjdC5jcmVhdGUoKHR5cGVvZiBJdGVyYXRvciA9PT0gXCJmdW5jdGlvblwiID8gSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSk7XHJcbiAgICByZXR1cm4gZy5uZXh0ID0gdmVyYigwKSwgZ1tcInRocm93XCJdID0gdmVyYigxKSwgZ1tcInJldHVyblwiXSA9IHZlcmIoMiksIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoZyAmJiAoZyA9IDAsIG9wWzBdICYmIChfID0gMCkpLCBfKSB0cnkge1xyXG4gICAgICAgICAgICBpZiAoZiA9IDEsIHkgJiYgKHQgPSBvcFswXSAmIDIgPyB5W1wicmV0dXJuXCJdIDogb3BbMF0gPyB5W1widGhyb3dcIl0gfHwgKCh0ID0geVtcInJldHVyblwiXSkgJiYgdC5jYWxsKHkpLCAwKSA6IHkubmV4dCkgJiYgISh0ID0gdC5jYWxsKHksIG9wWzFdKSkuZG9uZSkgcmV0dXJuIHQ7XHJcbiAgICAgICAgICAgIGlmICh5ID0gMCwgdCkgb3AgPSBbb3BbMF0gJiAyLCB0LnZhbHVlXTtcclxuICAgICAgICAgICAgc3dpdGNoIChvcFswXSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAwOiBjYXNlIDE6IHQgPSBvcDsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDQ6IF8ubGFiZWwrKzsgcmV0dXJuIHsgdmFsdWU6IG9wWzFdLCBkb25lOiBmYWxzZSB9O1xyXG4gICAgICAgICAgICAgICAgY2FzZSA1OiBfLmxhYmVsKys7IHkgPSBvcFsxXTsgb3AgPSBbMF07IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA3OiBvcCA9IF8ub3BzLnBvcCgpOyBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBpZiAoISh0ID0gXy50cnlzLCB0ID0gdC5sZW5ndGggPiAwICYmIHRbdC5sZW5ndGggLSAxXSkgJiYgKG9wWzBdID09PSA2IHx8IG9wWzBdID09PSAyKSkgeyBfID0gMDsgY29udGludWU7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDMgJiYgKCF0IHx8IChvcFsxXSA+IHRbMF0gJiYgb3BbMV0gPCB0WzNdKSkpIHsgXy5sYWJlbCA9IG9wWzFdOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gNiAmJiBfLmxhYmVsIDwgdFsxXSkgeyBfLmxhYmVsID0gdFsxXTsgdCA9IG9wOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ICYmIF8ubGFiZWwgPCB0WzJdKSB7IF8ubGFiZWwgPSB0WzJdOyBfLm9wcy5wdXNoKG9wKTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodFsyXSkgXy5vcHMucG9wKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvcCA9IGJvZHkuY2FsbCh0aGlzQXJnLCBfKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7IG9wID0gWzYsIGVdOyB5ID0gMDsgfSBmaW5hbGx5IHsgZiA9IHQgPSAwOyB9XHJcbiAgICAgICAgaWYgKG9wWzBdICYgNSkgdGhyb3cgb3BbMV07IHJldHVybiB7IHZhbHVlOiBvcFswXSA/IG9wWzFdIDogdm9pZCAwLCBkb25lOiB0cnVlIH07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19jcmVhdGVCaW5kaW5nID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihtLCBrKTtcclxuICAgIGlmICghZGVzYyB8fCAoXCJnZXRcIiBpbiBkZXNjID8gIW0uX19lc01vZHVsZSA6IGRlc2Mud3JpdGFibGUgfHwgZGVzYy5jb25maWd1cmFibGUpKSB7XHJcbiAgICAgICAgZGVzYyA9IHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfTtcclxuICAgIH1cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBrMiwgZGVzYyk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tLCBwYWNrKSB7XHJcbiAgICBpZiAocGFjayB8fCBhcmd1bWVudHMubGVuZ3RoID09PSAyKSBmb3IgKHZhciBpID0gMCwgbCA9IGZyb20ubGVuZ3RoLCBhcjsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmIChhciB8fCAhKGkgaW4gZnJvbSkpIHtcclxuICAgICAgICAgICAgaWYgKCFhcikgYXIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tLCAwLCBpKTtcclxuICAgICAgICAgICAgYXJbaV0gPSBmcm9tW2ldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0by5jb25jYXQoYXIgfHwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSkpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdCh2KSB7XHJcbiAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIF9fYXdhaXQgPyAodGhpcy52ID0gdiwgdGhpcykgOiBuZXcgX19hd2FpdCh2KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNHZW5lcmF0b3IodGhpc0FyZywgX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIGcgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSksIGksIHEgPSBbXTtcclxuICAgIHJldHVybiBpID0gT2JqZWN0LmNyZWF0ZSgodHlwZW9mIEFzeW5jSXRlcmF0b3IgPT09IFwiZnVuY3Rpb25cIiA/IEFzeW5jSXRlcmF0b3IgOiBPYmplY3QpLnByb3RvdHlwZSksIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiwgYXdhaXRSZXR1cm4pLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiBhd2FpdFJldHVybihmKSB7IHJldHVybiBmdW5jdGlvbiAodikgeyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZiwgcmVqZWN0KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlmIChnW25dKSB7IGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IGlmIChmKSBpW25dID0gZihpW25dKTsgfSB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogZmFsc2UgfSA6IGYgPyBmKHYpIDogdjsgfSA6IGY7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNWYWx1ZXMobykge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBtID0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sIGk7XHJcbiAgICByZXR1cm4gbSA/IG0uY2FsbChvKSA6IChvID0gdHlwZW9mIF9fdmFsdWVzID09PSBcImZ1bmN0aW9uXCIgPyBfX3ZhbHVlcyhvKSA6IG9bU3ltYm9sLml0ZXJhdG9yXSgpLCBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaSk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaVtuXSA9IG9bbl0gJiYgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgdiA9IG9bbl0odiksIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHYuZG9uZSwgdi52YWx1ZSk7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCBkLCB2KSB7IFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGZ1bmN0aW9uKHYpIHsgcmVzb2x2ZSh7IHZhbHVlOiB2LCBkb25lOiBkIH0pOyB9LCByZWplY3QpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdykge1xyXG4gICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkgeyBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29va2VkLCBcInJhd1wiLCB7IHZhbHVlOiByYXcgfSk7IH0gZWxzZSB7IGNvb2tlZC5yYXcgPSByYXc7IH1cclxuICAgIHJldHVybiBjb29rZWQ7XHJcbn07XHJcblxyXG52YXIgX19zZXRNb2R1bGVEZWZhdWx0ID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgXCJkZWZhdWx0XCIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgdmFsdWU6IHYgfSk7XHJcbn0pIDogZnVuY3Rpb24obywgdikge1xyXG4gICAgb1tcImRlZmF1bHRcIl0gPSB2O1xyXG59O1xyXG5cclxudmFyIG93bktleXMgPSBmdW5jdGlvbihvKSB7XHJcbiAgICBvd25LZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgfHwgZnVuY3Rpb24gKG8pIHtcclxuICAgICAgICB2YXIgYXIgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBrIGluIG8pIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgaykpIGFyW2FyLmxlbmd0aF0gPSBrO1xyXG4gICAgICAgIHJldHVybiBhcjtcclxuICAgIH07XHJcbiAgICByZXR1cm4gb3duS2V5cyhvKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrID0gb3duS2V5cyhtb2QpLCBpID0gMDsgaSA8IGsubGVuZ3RoOyBpKyspIGlmIChrW2ldICE9PSBcImRlZmF1bHRcIikgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrW2ldKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRJbihzdGF0ZSwgcmVjZWl2ZXIpIHtcclxuICAgIGlmIChyZWNlaXZlciA9PT0gbnVsbCB8fCAodHlwZW9mIHJlY2VpdmVyICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiByZWNlaXZlciAhPT0gXCJmdW5jdGlvblwiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgJ2luJyBvcGVyYXRvciBvbiBub24tb2JqZWN0XCIpO1xyXG4gICAgcmV0dXJuIHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgPT09IHN0YXRlIDogc3RhdGUuaGFzKHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYWRkRGlzcG9zYWJsZVJlc291cmNlKGVudiwgdmFsdWUsIGFzeW5jKSB7XHJcbiAgICBpZiAodmFsdWUgIT09IG51bGwgJiYgdmFsdWUgIT09IHZvaWQgMCkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgZXhwZWN0ZWQuXCIpO1xyXG4gICAgICAgIHZhciBkaXNwb3NlLCBpbm5lcjtcclxuICAgICAgICBpZiAoYXN5bmMpIHtcclxuICAgICAgICAgICAgaWYgKCFTeW1ib2wuYXN5bmNEaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jRGlzcG9zZSBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICAgICAgICAgIGRpc3Bvc2UgPSB2YWx1ZVtTeW1ib2wuYXN5bmNEaXNwb3NlXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGRpc3Bvc2UgPT09IHZvaWQgMCkge1xyXG4gICAgICAgICAgICBpZiAoIVN5bWJvbC5kaXNwb3NlKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmRpc3Bvc2UgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgICAgICAgICBkaXNwb3NlID0gdmFsdWVbU3ltYm9sLmRpc3Bvc2VdO1xyXG4gICAgICAgICAgICBpZiAoYXN5bmMpIGlubmVyID0gZGlzcG9zZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkaXNwb3NlICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3Qgbm90IGRpc3Bvc2FibGUuXCIpO1xyXG4gICAgICAgIGlmIChpbm5lcikgZGlzcG9zZSA9IGZ1bmN0aW9uKCkgeyB0cnkgeyBpbm5lci5jYWxsKHRoaXMpOyB9IGNhdGNoIChlKSB7IHJldHVybiBQcm9taXNlLnJlamVjdChlKTsgfSB9O1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgdmFsdWU6IHZhbHVlLCBkaXNwb3NlOiBkaXNwb3NlLCBhc3luYzogYXN5bmMgfSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChhc3luYykge1xyXG4gICAgICAgIGVudi5zdGFjay5wdXNoKHsgYXN5bmM6IHRydWUgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcblxyXG59XHJcblxyXG52YXIgX1N1cHByZXNzZWRFcnJvciA9IHR5cGVvZiBTdXBwcmVzc2VkRXJyb3IgPT09IFwiZnVuY3Rpb25cIiA/IFN1cHByZXNzZWRFcnJvciA6IGZ1bmN0aW9uIChlcnJvciwgc3VwcHJlc3NlZCwgbWVzc2FnZSkge1xyXG4gICAgdmFyIGUgPSBuZXcgRXJyb3IobWVzc2FnZSk7XHJcbiAgICByZXR1cm4gZS5uYW1lID0gXCJTdXBwcmVzc2VkRXJyb3JcIiwgZS5lcnJvciA9IGVycm9yLCBlLnN1cHByZXNzZWQgPSBzdXBwcmVzc2VkLCBlO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGlzcG9zZVJlc291cmNlcyhlbnYpIHtcclxuICAgIGZ1bmN0aW9uIGZhaWwoZSkge1xyXG4gICAgICAgIGVudi5lcnJvciA9IGVudi5oYXNFcnJvciA/IG5ldyBfU3VwcHJlc3NlZEVycm9yKGUsIGVudi5lcnJvciwgXCJBbiBlcnJvciB3YXMgc3VwcHJlc3NlZCBkdXJpbmcgZGlzcG9zYWwuXCIpIDogZTtcclxuICAgICAgICBlbnYuaGFzRXJyb3IgPSB0cnVlO1xyXG4gICAgfVxyXG4gICAgdmFyIHIsIHMgPSAwO1xyXG4gICAgZnVuY3Rpb24gbmV4dCgpIHtcclxuICAgICAgICB3aGlsZSAociA9IGVudi5zdGFjay5wb3AoKSkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFyLmFzeW5jICYmIHMgPT09IDEpIHJldHVybiBzID0gMCwgZW52LnN0YWNrLnB1c2gociksIFByb21pc2UucmVzb2x2ZSgpLnRoZW4obmV4dCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoci5kaXNwb3NlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHIuZGlzcG9zZS5jYWxsKHIudmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChyLmFzeW5jKSByZXR1cm4gcyB8PSAyLCBQcm9taXNlLnJlc29sdmUocmVzdWx0KS50aGVuKG5leHQsIGZ1bmN0aW9uKGUpIHsgZmFpbChlKTsgcmV0dXJuIG5leHQoKTsgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBlbHNlIHMgfD0gMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgZmFpbChlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocyA9PT0gMSkgcmV0dXJuIGVudi5oYXNFcnJvciA/IFByb21pc2UucmVqZWN0KGVudi5lcnJvcikgOiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgICBpZiAoZW52Lmhhc0Vycm9yKSB0aHJvdyBlbnYuZXJyb3I7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV4dCgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24ocGF0aCwgcHJlc2VydmVKc3gpIHtcclxuICAgIGlmICh0eXBlb2YgcGF0aCA9PT0gXCJzdHJpbmdcIiAmJiAvXlxcLlxcLj9cXC8vLnRlc3QocGF0aCkpIHtcclxuICAgICAgICByZXR1cm4gcGF0aC5yZXBsYWNlKC9cXC4odHN4KSR8KCg/OlxcLmQpPykoKD86XFwuW14uL10rPyk/KVxcLihbY21dPyl0cyQvaSwgZnVuY3Rpb24gKG0sIHRzeCwgZCwgZXh0LCBjbSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHN4ID8gcHJlc2VydmVKc3ggPyBcIi5qc3hcIiA6IFwiLmpzXCIgOiBkICYmICghZXh0IHx8ICFjbSkgPyBtIDogKGQgKyBleHQgKyBcIi5cIiArIGNtLnRvTG93ZXJDYXNlKCkgKyBcImpzXCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBhdGg7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHtcclxuICAgIF9fZXh0ZW5kczogX19leHRlbmRzLFxyXG4gICAgX19hc3NpZ246IF9fYXNzaWduLFxyXG4gICAgX19yZXN0OiBfX3Jlc3QsXHJcbiAgICBfX2RlY29yYXRlOiBfX2RlY29yYXRlLFxyXG4gICAgX19wYXJhbTogX19wYXJhbSxcclxuICAgIF9fZXNEZWNvcmF0ZTogX19lc0RlY29yYXRlLFxyXG4gICAgX19ydW5Jbml0aWFsaXplcnM6IF9fcnVuSW5pdGlhbGl6ZXJzLFxyXG4gICAgX19wcm9wS2V5OiBfX3Byb3BLZXksXHJcbiAgICBfX3NldEZ1bmN0aW9uTmFtZTogX19zZXRGdW5jdGlvbk5hbWUsXHJcbiAgICBfX21ldGFkYXRhOiBfX21ldGFkYXRhLFxyXG4gICAgX19hd2FpdGVyOiBfX2F3YWl0ZXIsXHJcbiAgICBfX2dlbmVyYXRvcjogX19nZW5lcmF0b3IsXHJcbiAgICBfX2NyZWF0ZUJpbmRpbmc6IF9fY3JlYXRlQmluZGluZyxcclxuICAgIF9fZXhwb3J0U3RhcjogX19leHBvcnRTdGFyLFxyXG4gICAgX192YWx1ZXM6IF9fdmFsdWVzLFxyXG4gICAgX19yZWFkOiBfX3JlYWQsXHJcbiAgICBfX3NwcmVhZDogX19zcHJlYWQsXHJcbiAgICBfX3NwcmVhZEFycmF5czogX19zcHJlYWRBcnJheXMsXHJcbiAgICBfX3NwcmVhZEFycmF5OiBfX3NwcmVhZEFycmF5LFxyXG4gICAgX19hd2FpdDogX19hd2FpdCxcclxuICAgIF9fYXN5bmNHZW5lcmF0b3I6IF9fYXN5bmNHZW5lcmF0b3IsXHJcbiAgICBfX2FzeW5jRGVsZWdhdG9yOiBfX2FzeW5jRGVsZWdhdG9yLFxyXG4gICAgX19hc3luY1ZhbHVlczogX19hc3luY1ZhbHVlcyxcclxuICAgIF9fbWFrZVRlbXBsYXRlT2JqZWN0OiBfX21ha2VUZW1wbGF0ZU9iamVjdCxcclxuICAgIF9faW1wb3J0U3RhcjogX19pbXBvcnRTdGFyLFxyXG4gICAgX19pbXBvcnREZWZhdWx0OiBfX2ltcG9ydERlZmF1bHQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0OiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZFNldDogX19jbGFzc1ByaXZhdGVGaWVsZFNldCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRJbjogX19jbGFzc1ByaXZhdGVGaWVsZEluLFxyXG4gICAgX19hZGREaXNwb3NhYmxlUmVzb3VyY2U6IF9fYWRkRGlzcG9zYWJsZVJlc291cmNlLFxyXG4gICAgX19kaXNwb3NlUmVzb3VyY2VzOiBfX2Rpc3Bvc2VSZXNvdXJjZXMsXHJcbiAgICBfX3Jld3JpdGVSZWxhdGl2ZUltcG9ydEV4dGVuc2lvbjogX19yZXdyaXRlUmVsYXRpdmVJbXBvcnRFeHRlbnNpb24sXHJcbn07XHJcbiIsImltcG9ydCB7IEFwcCwgSXRlbVZpZXcsIE1vZGFsLCBOb3RpY2UsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgVEZpbGUsIFdvcmtzcGFjZUxlYWYsIFRleHRBcmVhQ29tcG9uZW50LCBCdXR0b25Db21wb25lbnQgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgKiBhcyBUU05FIGZyb20gJ3RzbmUtanMnO1xuXG4vLyBJbnRlcmZhY2UgZm9yIG5vdGUgY29ubmVjdGlvbnNcbmludGVyZmFjZSBOb3RlQ29ubmVjdGlvbiB7XG4gIHNvdXJjZU5vdGU6IFRTTkVQb2ludDtcbiAgdGFyZ2V0Tm90ZTogVFNORVBvaW50O1xuICBzaW1pbGFyaXR5OiBudW1iZXI7XG4gIGNvbW1vblRlcm1zOiBzdHJpbmdbXTtcbiAgY2x1c3RlclRlcm1zOiBzdHJpbmdbXTtcbiAgcmVhc29uOiBzdHJpbmc7XG4gIGxsbURlc2NyaXB0aW9uPzogc3RyaW5nO1xufVxuXG4vLyBNb2RhbCBmb3IgZGlzcGxheWluZyBhbmQgcHJvY2Vzc2luZyBzdWdnZXN0ZWQgbGlua3NcbmNsYXNzIFN1Z2dlc3RlZExpbmtzTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIHByaXZhdGUgY29ubmVjdGlvbnM6IE5vdGVDb25uZWN0aW9uW107XG4gIHByaXZhdGUgcGx1Z2luOiBWaWJlQm95UGx1Z2luO1xuICBwcml2YXRlIHNlbGVjdGVkQ29ubmVjdGlvbkluZGV4OiBudW1iZXIgPSAwO1xuICBwcml2YXRlIHByb2Nlc3NpbmdDb25uZWN0aW9uOiBib29sZWFuID0gZmFsc2U7XG4gIFxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgY29ubmVjdGlvbnM6IE5vdGVDb25uZWN0aW9uW10sIHBsdWdpbjogVmliZUJveVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5jb25uZWN0aW9ucyA9IGNvbm5lY3Rpb25zO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG4gIFxuICBhc3luYyBvbk9wZW4oKSB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgXG4gICAgLy8gU2V0IG1vZGFsIHRpdGxlXG4gICAgY29udGVudEVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1N1Z2dlc3RlZCBOb3RlIENvbm5lY3Rpb25zJyB9KTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoJ3AnLCB7IFxuICAgICAgdGV4dDogJ0JlbG93IGFyZSBwb3RlbnRpYWwgY29ubmVjdGlvbnMgYmV0d2VlbiBub3RlcyBiYXNlZCBvbiBjb250ZW50IHNpbWlsYXJpdHkuICcgK1xuICAgICAgICAgICAgJ1NlbGVjdCBhIGNvbm5lY3Rpb24gYW5kIGdlbmVyYXRlIGEgZGVzY3JpcHRpb24gdG8gY3JlYXRlIGEgbGluayBiZXR3ZWVuIHRoZSBub3Rlcy4nXG4gICAgfSk7XG4gICAgXG4gICAgLy8gQ3JlYXRlIGNvbnRhaW5lciBmb3IgY29ubmVjdGlvbnMgbGlzdFxuICAgIGNvbnN0IGNvbm5lY3Rpb25zQ29udGFpbmVyID0gY29udGVudEVsLmNyZWF0ZURpdih7IGNsczogJ2Nvbm5lY3Rpb25zLWNvbnRhaW5lcicgfSk7XG4gICAgXG4gICAgLy8gQ3JlYXRlIGNvbnRhaW5lciBmb3Igc2VsZWN0ZWQgY29ubmVjdGlvbiBkZXRhaWxzXG4gICAgY29uc3QgZGV0YWlsc0NvbnRhaW5lciA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoeyBjbHM6ICdjb25uZWN0aW9uLWRldGFpbHMnIH0pO1xuICAgIFxuICAgIC8vIEFkZCBzb21lIENTU1xuICAgIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBzdHlsZS50ZXh0Q29udGVudCA9IGBcbiAgICAgIC5jb25uZWN0aW9ucy1jb250YWluZXIge1xuICAgICAgICBtYXgtaGVpZ2h0OiAxNTBweDtcbiAgICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTVweDtcbiAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYmFja2dyb3VuZC1tb2RpZmllci1ib3JkZXIpO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICB9XG4gICAgICAuY29ubmVjdGlvbi1pdGVtIHtcbiAgICAgICAgcGFkZGluZzogOHB4IDEycHg7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyKTtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLWl0ZW06aG92ZXIge1xuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1iYWNrZ3JvdW5kLXNlY29uZGFyeSk7XG4gICAgICB9XG4gICAgICAuY29ubmVjdGlvbi1pdGVtLnNlbGVjdGVkIHtcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KTtcbiAgICAgICAgY29sb3I6IHZhcigtLXRleHQtb24tYWNjZW50KTtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLWRldGFpbHMge1xuICAgICAgICBwYWRkaW5nOiAxMHB4O1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlcik7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTVweDtcbiAgICAgIH1cbiAgICAgIC5jb25uZWN0aW9uLXN0YXRzIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICBtYXJnaW4tYm90dG9tOiAxMHB4O1xuICAgICAgfVxuICAgICAgLmdlbmVyYXRlLWJ1dHRvbiB7XG4gICAgICAgIG1hcmdpbi10b3A6IDEwcHg7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDEwcHg7XG4gICAgICB9XG4gICAgICAubGxtLWRlc2NyaXB0aW9uIHtcbiAgICAgICAgbWFyZ2luLXRvcDogMTBweDtcbiAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgIG1pbi1oZWlnaHQ6IDEwMHB4O1xuICAgICAgfVxuICAgICAgLmJ1dHRvbi1jb250YWluZXIge1xuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgIG1hcmdpbi10b3A6IDE1cHg7XG4gICAgICB9XG4gICAgYDtcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcbiAgICBcbiAgICAvLyBSZW5kZXIgY29ubmVjdGlvbnMgbGlzdFxuICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbnNMaXN0KGNvbm5lY3Rpb25zQ29udGFpbmVyKTtcbiAgICBcbiAgICAvLyBSZW5kZXIgZGV0YWlscyBmb3IgdGhlIGZpcnN0IGNvbm5lY3Rpb25cbiAgICB0aGlzLnJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKGRldGFpbHNDb250YWluZXIsIHRoaXMuY29ubmVjdGlvbnNbMF0pO1xuICAgIFxuICAgIC8vIEZvY3VzIHRoZSBmaXJzdCBjb25uZWN0aW9uXG4gICAgdGhpcy5zZWxlY3RDb25uZWN0aW9uKDApO1xuICB9XG4gIFxuICBwcml2YXRlIHJlbmRlckNvbm5lY3Rpb25zTGlzdChjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgXG4gICAgdGhpcy5jb25uZWN0aW9ucy5mb3JFYWNoKChjb25uZWN0aW9uLCBpbmRleCkgPT4ge1xuICAgICAgY29uc3QgaXRlbSA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6ICdjb25uZWN0aW9uLWl0ZW0nIH0pO1xuICAgICAgaWYgKGluZGV4ID09PSB0aGlzLnNlbGVjdGVkQ29ubmVjdGlvbkluZGV4KSB7XG4gICAgICAgIGl0ZW0uYWRkQ2xhc3MoJ3NlbGVjdGVkJyk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHNvdXJjZVRpdGxlID0gY29ubmVjdGlvbi5zb3VyY2VOb3RlLnRpdGxlO1xuICAgICAgY29uc3QgdGFyZ2V0VGl0bGUgPSBjb25uZWN0aW9uLnRhcmdldE5vdGUudGl0bGU7XG4gICAgICBjb25zdCBzaW1pbGFyaXR5ID0gTWF0aC5yb3VuZChjb25uZWN0aW9uLnNpbWlsYXJpdHkpO1xuICAgICAgXG4gICAgICBpdGVtLmNyZWF0ZUVsKCdkaXYnLCB7IHRleHQ6IGAke3NvdXJjZVRpdGxlfSDihpQgJHt0YXJnZXRUaXRsZX0gKCR7c2ltaWxhcml0eX0lIHNpbWlsYXJpdHkpYCB9KTtcbiAgICAgIFxuICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgdGhpcy5zZWxlY3RDb25uZWN0aW9uKGluZGV4KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIFxuICBwcml2YXRlIHJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGNvbm5lY3Rpb246IE5vdGVDb25uZWN0aW9uKSB7XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgXG4gICAgY29uc3Qgc291cmNlTm90ZSA9IGNvbm5lY3Rpb24uc291cmNlTm90ZTtcbiAgICBjb25zdCB0YXJnZXROb3RlID0gY29ubmVjdGlvbi50YXJnZXROb3RlO1xuICAgIFxuICAgIC8vIE5vdGUgdGl0bGVzIGFuZCBwYXRoc1xuICAgIGNvbnRhaW5lci5jcmVhdGVFbCgnaDMnLCB7IHRleHQ6IGBDb25uZWN0aW9uOiAke3NvdXJjZU5vdGUudGl0bGV9IOKGlCAke3RhcmdldE5vdGUudGl0bGV9YCB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYFNvdXJjZTogJHtzb3VyY2VOb3RlLnBhdGh9YCB9KTtcbiAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYFRhcmdldDogJHt0YXJnZXROb3RlLnBhdGh9YCB9KTtcbiAgICBcbiAgICAvLyBTdGF0c1xuICAgIGNvbnN0IHN0YXRzRGl2ID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ2Nvbm5lY3Rpb24tc3RhdHMnIH0pO1xuICAgIHN0YXRzRGl2LmNyZWF0ZUVsKCdkaXYnLCB7IHRleHQ6IGBTaW1pbGFyaXR5OiAke01hdGgucm91bmQoY29ubmVjdGlvbi5zaW1pbGFyaXR5KX0lYCB9KTtcbiAgICBzdGF0c0Rpdi5jcmVhdGVFbCgnZGl2JywgeyB0ZXh0OiBgJHtzb3VyY2VOb3RlLndvcmRDb3VudCB8fCAnPyd9IHdvcmRzIC8gJHt0YXJnZXROb3RlLndvcmRDb3VudCB8fCAnPyd9IHdvcmRzYCB9KTtcbiAgICBcbiAgICAvLyBTaGFyZWQgdGVybXNcbiAgICBpZiAoY29ubmVjdGlvbi5jb21tb25UZXJtcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYENvbW1vbiB0ZXJtczogJHtjb25uZWN0aW9uLmNvbW1vblRlcm1zLmpvaW4oJywgJyl9YCB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ2x1c3RlciB0ZXJtc1xuICAgIGlmIChjb25uZWN0aW9uLmNsdXN0ZXJUZXJtcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYENsdXN0ZXIgdGVybXM6ICR7Y29ubmVjdGlvbi5jbHVzdGVyVGVybXMuam9pbignLCAnKX1gIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyBSZWFzb24gZm9yIGNvbm5lY3Rpb25cbiAgICBjb250YWluZXIuY3JlYXRlRWwoJ2RpdicsIHsgdGV4dDogYENvbm5lY3Rpb24gcmVhc29uOiAke2Nvbm5lY3Rpb24ucmVhc29ufWAgfSk7XG4gICAgXG4gICAgLy8gR2VuZXJhdGUgZGVzY3JpcHRpb24gYnV0dG9uXG4gICAgY29uc3QgZ2VuZXJhdGVCdXR0b24gPSBuZXcgQnV0dG9uQ29tcG9uZW50KGNvbnRhaW5lcilcbiAgICAgIC5zZXRCdXR0b25UZXh0KCdHZW5lcmF0ZSBDb25uZWN0aW9uIERlc2NyaXB0aW9uJylcbiAgICAgIC5zZXRDbGFzcygnZ2VuZXJhdGUtYnV0dG9uIG1vZC1jdGEnKVxuICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLmdlbmVyYXRlTExNRGVzY3JpcHRpb24oY29ubmVjdGlvbik7XG4gICAgICB9KTtcbiAgICBcbiAgICBpZiAodGhpcy5wcm9jZXNzaW5nQ29ubmVjdGlvbikge1xuICAgICAgZ2VuZXJhdGVCdXR0b24uc2V0RGlzYWJsZWQodHJ1ZSk7XG4gICAgICBnZW5lcmF0ZUJ1dHRvbi5zZXRCdXR0b25UZXh0KCdHZW5lcmF0aW5nLi4uJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIERlc2NyaXB0aW9uIHRleHQgYXJlYVxuICAgIGlmIChjb25uZWN0aW9uLmxsbURlc2NyaXB0aW9uKSB7XG4gICAgICBjb25zdCBkZXNjcmlwdGlvbkNvbnRhaW5lciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoKTtcbiAgICAgIGRlc2NyaXB0aW9uQ29udGFpbmVyLmNyZWF0ZUVsKCdoNCcsIHsgdGV4dDogJ0Nvbm5lY3Rpb24gRGVzY3JpcHRpb246JyB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgdGV4dEFyZWEgPSBuZXcgVGV4dEFyZWFDb21wb25lbnQoZGVzY3JpcHRpb25Db250YWluZXIpXG4gICAgICAgIC5zZXRWYWx1ZShjb25uZWN0aW9uLmxsbURlc2NyaXB0aW9uKVxuICAgICAgICAuc2V0UGxhY2Vob2xkZXIoJ0Nvbm5lY3Rpb24gZGVzY3JpcHRpb24gd2lsbCBhcHBlYXIgaGVyZS4uLicpO1xuICAgICAgXG4gICAgICB0ZXh0QXJlYS5pbnB1dEVsLmFkZENsYXNzKCdsbG0tZGVzY3JpcHRpb24nKTtcbiAgICAgIFxuICAgICAgLy8gQ3JlYXRlIGJ1dHRvblxuICAgICAgY29uc3QgYnV0dG9uQ29udGFpbmVyID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogJ2J1dHRvbi1jb250YWluZXInIH0pO1xuICAgICAgXG4gICAgICBuZXcgQnV0dG9uQ29tcG9uZW50KGJ1dHRvbkNvbnRhaW5lcilcbiAgICAgICAgLnNldEJ1dHRvblRleHQoJ0NyZWF0ZSBMaW5rJylcbiAgICAgICAgLnNldENsYXNzKCdtb2QtY3RhJylcbiAgICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuY3JlYXRlTGluayhjb25uZWN0aW9uLCB0ZXh0QXJlYS5nZXRWYWx1ZSgpKTtcbiAgICAgICAgfSk7XG4gICAgICBcbiAgICAgIG5ldyBCdXR0b25Db21wb25lbnQoYnV0dG9uQ29udGFpbmVyKVxuICAgICAgICAuc2V0QnV0dG9uVGV4dCgnRWRpdCBEZXNjcmlwdGlvbicpXG4gICAgICAgIC5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICB0ZXh0QXJlYS5zZXREaXNhYmxlZChmYWxzZSk7XG4gICAgICAgICAgdGV4dEFyZWEuaW5wdXRFbC5mb2N1cygpO1xuICAgICAgICB9KTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgc2VsZWN0Q29ubmVjdGlvbihpbmRleDogbnVtYmVyKSB7XG4gICAgaWYgKGluZGV4IDwgMCB8fCBpbmRleCA+PSB0aGlzLmNvbm5lY3Rpb25zLmxlbmd0aCkgcmV0dXJuO1xuICAgIFxuICAgIHRoaXMuc2VsZWN0ZWRDb25uZWN0aW9uSW5kZXggPSBpbmRleDtcbiAgICBjb25zdCBjb25uZWN0aW9uQ29udGFpbmVyID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignLmNvbm5lY3Rpb25zLWNvbnRhaW5lcicpIGFzIEhUTUxFbGVtZW50O1xuICAgIGNvbnN0IGRldGFpbHNDb250YWluZXIgPSB0aGlzLmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKCcuY29ubmVjdGlvbi1kZXRhaWxzJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgXG4gICAgaWYgKGNvbm5lY3Rpb25Db250YWluZXIgJiYgZGV0YWlsc0NvbnRhaW5lcikge1xuICAgICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uc0xpc3QoY29ubmVjdGlvbkNvbnRhaW5lcik7XG4gICAgICB0aGlzLnJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKGRldGFpbHNDb250YWluZXIsIHRoaXMuY29ubmVjdGlvbnNbaW5kZXhdKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgZ2VuZXJhdGVMTE1EZXNjcmlwdGlvbihjb25uZWN0aW9uOiBOb3RlQ29ubmVjdGlvbikge1xuICAgIGlmICh0aGlzLnByb2Nlc3NpbmdDb25uZWN0aW9uKSByZXR1cm47XG4gICAgXG4gICAgdGhpcy5wcm9jZXNzaW5nQ29ubmVjdGlvbiA9IHRydWU7XG4gICAgY29uc3QgZGV0YWlsc0NvbnRhaW5lciA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJy5jb25uZWN0aW9uLWRldGFpbHMnKSBhcyBIVE1MRWxlbWVudDtcbiAgICB0aGlzLnJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKGRldGFpbHNDb250YWluZXIsIGNvbm5lY3Rpb24pO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICAvLyBGZXRjaCBzb3VyY2UgYW5kIHRhcmdldCBub3RlIGNvbnRlbnRcbiAgICAgIGNvbnN0IHNvdXJjZUZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY29ubmVjdGlvbi5zb3VyY2VOb3RlLnBhdGgpO1xuICAgICAgY29uc3QgdGFyZ2V0RmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb25uZWN0aW9uLnRhcmdldE5vdGUucGF0aCk7XG4gICAgICBcbiAgICAgIGlmICghKHNvdXJjZUZpbGUgaW5zdGFuY2VvZiBURmlsZSkgfHwgISh0YXJnZXRGaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgbm90ZSBmaWxlcycpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzb3VyY2VDb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChzb3VyY2VGaWxlKTtcbiAgICAgIGNvbnN0IHRhcmdldENvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKHRhcmdldEZpbGUpO1xuICAgICAgXG4gICAgICAvLyBQcmVwYXJlIGRhdGEgZm9yIExMTSBjYWxsXG4gICAgICBjb25zdCBkYXRhID0ge1xuICAgICAgICBzb3VyY2VOb3RlOiB7XG4gICAgICAgICAgdGl0bGU6IGNvbm5lY3Rpb24uc291cmNlTm90ZS50aXRsZSxcbiAgICAgICAgICBjb250ZW50OiBzb3VyY2VDb250ZW50LnN1YnN0cmluZygwLCAxMDAwKSwgLy8gTGltaXQgdG8gZmlyc3QgMTAwMCBjaGFyc1xuICAgICAgICAgIHRvcFRlcm1zOiBjb25uZWN0aW9uLnNvdXJjZU5vdGUudG9wX3Rlcm1zXG4gICAgICAgIH0sXG4gICAgICAgIHRhcmdldE5vdGU6IHtcbiAgICAgICAgICB0aXRsZTogY29ubmVjdGlvbi50YXJnZXROb3RlLnRpdGxlLFxuICAgICAgICAgIGNvbnRlbnQ6IHRhcmdldENvbnRlbnQuc3Vic3RyaW5nKDAsIDEwMDApLCAvLyBMaW1pdCB0byBmaXJzdCAxMDAwIGNoYXJzXG4gICAgICAgICAgdG9wVGVybXM6IGNvbm5lY3Rpb24udGFyZ2V0Tm90ZS50b3BfdGVybXNcbiAgICAgICAgfSxcbiAgICAgICAgY29tbW9uVGVybXM6IGNvbm5lY3Rpb24uY29tbW9uVGVybXMsXG4gICAgICAgIGNsdXN0ZXJUZXJtczogY29ubmVjdGlvbi5jbHVzdGVyVGVybXMsXG4gICAgICAgIHJlYXNvbjogY29ubmVjdGlvbi5yZWFzb25cbiAgICAgIH07XG4gICAgICBcbiAgICAgIC8vIENhbGwgdGhlIExMTSBzZXJ2aWNlXG4gICAgICBjb25zdCBkZXNjcmlwdGlvbiA9IGF3YWl0IHRoaXMuY2FsbExMTVNlcnZpY2UoZGF0YSk7XG4gICAgICBcbiAgICAgIC8vIFVwZGF0ZSB0aGUgY29ubmVjdGlvbiB3aXRoIHRoZSBnZW5lcmF0ZWQgZGVzY3JpcHRpb25cbiAgICAgIGNvbm5lY3Rpb24ubGxtRGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIHRoZSBVSVxuICAgICAgdGhpcy5wcm9jZXNzaW5nQ29ubmVjdGlvbiA9IGZhbHNlO1xuICAgICAgY29uc3QgZGV0YWlsc0NvbnRhaW5lciA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJy5jb25uZWN0aW9uLWRldGFpbHMnKSBhcyBIVE1MRWxlbWVudDtcbiAgICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbkRldGFpbHMoZGV0YWlsc0NvbnRhaW5lciwgY29ubmVjdGlvbik7XG4gICAgICBcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhpcy5wcm9jZXNzaW5nQ29ubmVjdGlvbiA9IGZhbHNlO1xuICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2VuZXJhdGluZyBkZXNjcmlwdGlvbjonLCBlcnJvcik7XG4gICAgICBuZXcgTm90aWNlKGBGYWlsZWQgdG8gZ2VuZXJhdGUgZGVzY3JpcHRpb246ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIFVJIHRvIHNob3cgZXJyb3JcbiAgICAgIGNvbnN0IGRldGFpbHNDb250YWluZXIgPSB0aGlzLmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKCcuY29ubmVjdGlvbi1kZXRhaWxzJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICB0aGlzLnJlbmRlckNvbm5lY3Rpb25EZXRhaWxzKGRldGFpbHNDb250YWluZXIsIGNvbm5lY3Rpb24pO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBjYWxsTExNU2VydmljZShkYXRhOiBhbnkpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHRyeSB7XG4gICAgICAvLyBUcnkgdG8gY29ubmVjdCB0byB0aGUgbG9jYWwgTExNIEFQSSBzZXJ2ZXJcbiAgICAgIGNvbnN0IHNvdXJjZVRpdGxlID0gZGF0YS5zb3VyY2VOb3RlLnRpdGxlO1xuICAgICAgY29uc3QgdGFyZ2V0VGl0bGUgPSBkYXRhLnRhcmdldE5vdGUudGl0bGU7XG4gICAgICBjb25zdCBzb3VyY2VDb250ZW50ID0gZGF0YS5zb3VyY2VOb3RlLmNvbnRlbnQ7XG4gICAgICBjb25zdCB0YXJnZXRDb250ZW50ID0gZGF0YS50YXJnZXROb3RlLmNvbnRlbnQ7XG4gICAgICBjb25zdCBjb21tb25UZXJtcyA9IGRhdGEuY29tbW9uVGVybXMuam9pbignLCAnKTtcbiAgICAgIGNvbnN0IGNsdXN0ZXJUZXJtcyA9IGRhdGEuY2x1c3RlclRlcm1zLmpvaW4oJywgJyk7XG4gICAgICBcbiAgICAgIC8vIEZpcnN0LCB0cnkgdG8gdXNlIHRoZSBQeXRob24gc2VydmVyJ3MgTExNIGludGVncmF0aW9uXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCdodHRwOi8vMTI3LjAuMC4xOjEyMzQvZ2VuZXJhdGVfY29ubmVjdGlvbicsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgc291cmNlX25vdGU6IHtcbiAgICAgICAgICAgIHRpdGxlOiBzb3VyY2VUaXRsZSxcbiAgICAgICAgICAgIGNvbnRlbnQ6IHNvdXJjZUNvbnRlbnQsXG4gICAgICAgICAgICB0ZXJtczogZGF0YS5zb3VyY2VOb3RlLnRvcFRlcm1zXG4gICAgICAgICAgfSxcbiAgICAgICAgICB0YXJnZXRfbm90ZToge1xuICAgICAgICAgICAgdGl0bGU6IHRhcmdldFRpdGxlLFxuICAgICAgICAgICAgY29udGVudDogdGFyZ2V0Q29udGVudCxcbiAgICAgICAgICAgIHRlcm1zOiBkYXRhLnRhcmdldE5vdGUudG9wVGVybXNcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbW1vbl90ZXJtczogZGF0YS5jb21tb25UZXJtcyxcbiAgICAgICAgICBjbHVzdGVyX3Rlcm1zOiBkYXRhLmNsdXN0ZXJUZXJtc1xuICAgICAgICB9KVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGlmIChyZXNwb25zZS5vaykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICAgIGlmIChyZXN1bHQuZGVzY3JpcHRpb24pIHtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0LmRlc2NyaXB0aW9uO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIElmIHNlcnZlciBjYWxsIGZhaWxzIG9yIG5vdCBhdmFpbGFibGUsIHVzZSBmYWxsYmFjayBsb2dpY1xuICAgICAgY29uc29sZS5sb2coXCJVc2luZyBmYWxsYmFjayBjb25uZWN0aW9uIGRlc2NyaXB0aW9uIGdlbmVyYXRpb25cIik7XG4gICAgICBcbiAgICAgIC8vIENyZWF0ZSBhIHRlbXBsYXRlLWJhc2VkIGRlc2NyaXB0aW9uIChmYWxsYmFjaylcbiAgICAgIGxldCBkZXNjcmlwdGlvbiA9ICcnO1xuICAgICAgXG4gICAgICBpZiAoY29tbW9uVGVybXMpIHtcbiAgICAgICAgZGVzY3JpcHRpb24gKz0gYFRoZXNlIG5vdGVzIHNoYXJlIGNvbmNlcHR1YWwgb3ZlcmxhcCBhcm91bmQgJHtjb21tb25UZXJtc30uIGA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZXNjcmlwdGlvbiArPSBgVGhlc2Ugbm90ZXMgYXBwZWFyIHRvIGJlIGNvbmNlcHR1YWxseSByZWxhdGVkLiBgO1xuICAgICAgfVxuICAgICAgXG4gICAgICBkZXNjcmlwdGlvbiArPSBgVGhlIG5vdGUgXCIke3RhcmdldFRpdGxlfVwiIHByb3ZpZGVzIGNvbXBsZW1lbnRhcnkgaW5mb3JtYXRpb24gdGhhdCBleHBhbmRzIG9uIGlkZWFzIGluIFwiJHtzb3VyY2VUaXRsZX1cImA7XG4gICAgICBcbiAgICAgIGlmIChjbHVzdGVyVGVybXMpIHtcbiAgICAgICAgZGVzY3JpcHRpb24gKz0gYCwgcGFydGljdWxhcmx5IHJlZ2FyZGluZyAke2NsdXN0ZXJUZXJtc30uYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlc2NyaXB0aW9uICs9ICcuJztcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIGRlc2NyaXB0aW9uO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBjYWxsaW5nIExMTSBzZXJ2aWNlOicsIGVycm9yKTtcbiAgICAgIFxuICAgICAgLy8gUmV0dXJuIGEgYmFzaWMgZGVzY3JpcHRpb24gYXMgZmFsbGJhY2tcbiAgICAgIHJldHVybiBgVGhlc2Ugbm90ZXMgYXBwZWFyIHRvIGJlIHJlbGF0ZWQgaW4gdGhlaXIgY29udGVudC4gVGhlIG5vdGUgXCIke2RhdGEudGFyZ2V0Tm90ZS50aXRsZX1cIiBjb21wbGVtZW50cyBcIiR7ZGF0YS5zb3VyY2VOb3RlLnRpdGxlfVwiIHdpdGggYWRkaXRpb25hbCByZWxldmFudCBpbmZvcm1hdGlvbi5gO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBhc3luYyBjcmVhdGVMaW5rKGNvbm5lY3Rpb246IE5vdGVDb25uZWN0aW9uLCBkZXNjcmlwdGlvbjogc3RyaW5nKSB7XG4gICAgaWYgKCFkZXNjcmlwdGlvbiB8fCBkZXNjcmlwdGlvbi50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICBuZXcgTm90aWNlKCdQbGVhc2UgZ2VuZXJhdGUgb3IgcHJvdmlkZSBhIGRlc2NyaXB0aW9uIGZvciB0aGUgY29ubmVjdGlvbicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBzdWNjZXNzID0gYXdhaXQgdGhpcy5wbHVnaW4uY3JlYXRlTm90ZUxpbmsoXG4gICAgICBjb25uZWN0aW9uLnNvdXJjZU5vdGUucGF0aCxcbiAgICAgIGNvbm5lY3Rpb24udGFyZ2V0Tm90ZS5wYXRoLFxuICAgICAgZGVzY3JpcHRpb25cbiAgICApO1xuICAgIFxuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICBuZXcgTm90aWNlKGBTdWNjZXNzZnVsbHkgbGlua2VkICR7Y29ubmVjdGlvbi5zb3VyY2VOb3RlLnRpdGxlfSB0byAke2Nvbm5lY3Rpb24udGFyZ2V0Tm90ZS50aXRsZX1gKTtcbiAgICAgIFxuICAgICAgLy8gUmVtb3ZlIHRoaXMgY29ubmVjdGlvbiBmcm9tIHRoZSBsaXN0XG4gICAgICB0aGlzLmNvbm5lY3Rpb25zID0gdGhpcy5jb25uZWN0aW9ucy5maWx0ZXIoKF8sIGluZGV4KSA9PiBpbmRleCAhPT0gdGhpcy5zZWxlY3RlZENvbm5lY3Rpb25JbmRleCk7XG4gICAgICBcbiAgICAgIGlmICh0aGlzLmNvbm5lY3Rpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBObyBtb3JlIGNvbm5lY3Rpb25zLCBjbG9zZSB0aGUgbW9kYWxcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFNlbGVjdCB0aGUgbmV4dCBjb25uZWN0aW9uXG4gICAgICB0aGlzLnNlbGVjdGVkQ29ubmVjdGlvbkluZGV4ID0gTWF0aC5taW4odGhpcy5zZWxlY3RlZENvbm5lY3Rpb25JbmRleCwgdGhpcy5jb25uZWN0aW9ucy5sZW5ndGggLSAxKTtcbiAgICAgIFxuICAgICAgLy8gVXBkYXRlIHRoZSBVSVxuICAgICAgY29uc3QgY29ubmVjdGlvbkNvbnRhaW5lciA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoJy5jb25uZWN0aW9ucy1jb250YWluZXInKSBhcyBIVE1MRWxlbWVudDtcbiAgICAgIGNvbnN0IGRldGFpbHNDb250YWluZXIgPSB0aGlzLmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKCcuY29ubmVjdGlvbi1kZXRhaWxzJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgICBcbiAgICAgIHRoaXMucmVuZGVyQ29ubmVjdGlvbnNMaXN0KGNvbm5lY3Rpb25Db250YWluZXIpO1xuICAgICAgdGhpcy5yZW5kZXJDb25uZWN0aW9uRGV0YWlscyhcbiAgICAgICAgZGV0YWlsc0NvbnRhaW5lciwgXG4gICAgICAgIHRoaXMuY29ubmVjdGlvbnNbdGhpcy5zZWxlY3RlZENvbm5lY3Rpb25JbmRleF1cbiAgICAgICk7XG4gICAgfVxuICB9XG4gIFxuICBvbkNsb3NlKCkge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICB9XG59XG5cbi8vIERlZmluZSB0aGUgdmlldyB0eXBlIGZvciBvdXIgdmlzdWFsaXphdGlvblxuY29uc3QgVklFV19UWVBFX1RTTkUgPSBcInRzbmUtdmlzdWFsaXphdGlvblwiO1xuXG5pbnRlcmZhY2UgVmliZUJveVNldHRpbmdzIHtcbiAgcGVycGxleGl0eTogbnVtYmVyO1xuICBpdGVyYXRpb25zOiBudW1iZXI7XG4gIGVwc2lsb246IG51bWJlcjtcbn1cblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogVmliZUJveVNldHRpbmdzID0ge1xuICBwZXJwbGV4aXR5OiAzMCxcbiAgaXRlcmF0aW9uczogMTAwMCxcbiAgZXBzaWxvbjogMTBcbn1cblxuLy8gQ3VzdG9tIHZpZXcgZm9yIHQtU05FIHZpc3VhbGl6YXRpb25cbmNsYXNzIFRTTkVWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmKSB7XG4gICAgc3VwZXIobGVhZik7XG4gIH1cblxuICBnZXRWaWV3VHlwZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiBWSUVXX1RZUEVfVFNORTtcbiAgfVxuXG4gIGdldERpc3BsYXlUZXh0KCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIFwidC1TTkUgVmlzdWFsaXphdGlvblwiO1xuICB9XG5cbiAgZ2V0SWNvbigpOiBzdHJpbmcge1xuICAgIHJldHVybiBcImdyYXBoXCI7XG4gIH1cblxuICAvLyBTZXQgb25Ecm9wIGhhbmRsZXIgdG8gcHJldmVudCBlcnJvclxuICBvbkRyb3AoZXZlbnQ6IERyYWdFdmVudCk6IHZvaWQge1xuICAgIC8vIE5vdCBpbXBsZW1lbnRlZFxuICB9XG5cbiAgLy8gU2V0IG9uUGFuZU1lbnUgaGFuZGxlciB0byBwcmV2ZW50IGVycm9yXG4gIG9uUGFuZU1lbnUobWVudTogYW55LCBzb3VyY2U6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIE5vdCBpbXBsZW1lbnRlZFxuICB9XG5cbiAgYXN5bmMgb25PcGVuKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuY29udGVudEVsO1xuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIFxuICAgIC8vIEFkZCBoZWFkZXJcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwidHNuZS1oZWFkZXJcIiB9LCAoaGVhZGVyKSA9PiB7XG4gICAgICBoZWFkZXIuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwidC1TTkUgTm90ZSBWaXN1YWxpemF0aW9uXCIgfSk7XG4gICAgICBcbiAgICAgIC8vIEFkZCBhY3Rpb24gYnV0dG9uc1xuICAgICAgY29uc3QgYWN0aW9uQmFyID0gaGVhZGVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcInRzbmUtYWN0aW9uc1wiIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBydW5CdXR0b24gPSBhY3Rpb25CYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlJ1biBBbmFseXNpc1wiLCBjbHM6IFwibW9kLWN0YVwiIH0pO1xuICAgICAgcnVuQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIC8vIEdldCB0aGUgcGx1Z2luIGluc3RhbmNlIGFuZCBydW4gdC1TTkVcbiAgICAgICAgY29uc3QgcGx1Z2luID0gKHRoaXMuYXBwIGFzIGFueSkucGx1Z2lucy5wbHVnaW5zW1widmliZS1ib2lcIl0gYXMgVmliZUJveVBsdWdpbjtcbiAgICAgICAgcGx1Z2luLnJ1blRTTkUoKTtcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICBjb25zdCBzdWdnZXN0TGlua3NCdXR0b24gPSBhY3Rpb25CYXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlN1Z2dlc3QgTGlua3NcIiwgY2xzOiBcIm1vZC1jdGFcIiB9KTtcbiAgICAgIHN1Z2dlc3RMaW5rc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICAvLyBHZXQgdGhlIHBsdWdpbiBpbnN0YW5jZSBhbmQgc3VnZ2VzdCBsaW5rc1xuICAgICAgICBjb25zdCBwbHVnaW4gPSAodGhpcy5hcHAgYXMgYW55KS5wbHVnaW5zLnBsdWdpbnNbXCJ2aWJlLWJvaVwiXSBhcyBWaWJlQm95UGx1Z2luO1xuICAgICAgICBwbHVnaW4uc3VnZ2VzdExpbmtzKCk7XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3Qgc2VsZWN0Rm9sZGVyQnV0dG9uID0gYWN0aW9uQmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJTZWxlY3QgRm9sZGVyXCIgfSk7XG4gICAgICBzZWxlY3RGb2xkZXJCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgLy8gVE9ETzogSW1wbGVtZW50IGZvbGRlciBzZWxlY3Rpb25cbiAgICAgICAgbmV3IE5vdGljZShcIkZvbGRlciBzZWxlY3Rpb24gbm90IGltcGxlbWVudGVkIHlldFwiKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBpbmZvIHRleHRcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJwXCIsIHsgXG4gICAgICB0ZXh0OiBcIlJ1biB0LVNORSBhbmFseXNpcyB0byB2aXN1YWxpemUgeW91ciBub3RlcyBhcyBjbHVzdGVycyBiYXNlZCBvbiBjb250ZW50IHNpbWlsYXJpdHkuXCIsXG4gICAgICBjbHM6IFwidHNuZS1pbmZvXCJcbiAgICB9KTtcbiAgICBcbiAgICAvLyBBZGQgdmlzdWFsaXphdGlvbiBjb250YWluZXJcbiAgICBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwgeyBcbiAgICAgIGNsczogXCJ0c25lLWNvbnRhaW5lclwiLCBcbiAgICAgIGF0dHI6IHsgaWQ6IFwidHNuZS1jb250YWluZXJcIiB9IFxuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBzdGF0dXMgdGV4dFxuICAgIGNvbnRhaW5lci5jcmVhdGVFbChcImRpdlwiLCB7IFxuICAgICAgY2xzOiBcInRzbmUtc3RhdHVzXCIsXG4gICAgICBhdHRyOiB7IGlkOiBcInRzbmUtc3RhdHVzXCIgfVxuICAgIH0sIChzdGF0dXMpID0+IHtcbiAgICAgIHN0YXR1cy5jcmVhdGVFbChcInBcIiwgeyBcbiAgICAgICAgdGV4dDogXCJVc2UgdGhlICdSdW4gQW5hbHlzaXMnIGJ1dHRvbiB0byBzdGFydCBwcm9jZXNzaW5nIHlvdXIgbm90ZXMuXCIsXG4gICAgICAgIGNsczogXCJ0c25lLXN0YXR1cy10ZXh0XCJcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIFxuICAgIC8vIEFkZCBzaW1wbGUgQ1NTXG4gICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgICAgLnRzbmUtaGVhZGVyIHtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuO1xuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICBtYXJnaW4tYm90dG9tOiAxcmVtO1xuICAgICAgfVxuICAgICAgLnRzbmUtYWN0aW9ucyB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGdhcDogMTBweDtcbiAgICAgIH1cbiAgICAgIC50c25lLWluZm8ge1xuICAgICAgICBtYXJnaW4tYm90dG9tOiAxcmVtO1xuICAgICAgICBvcGFjaXR5OiAwLjg7XG4gICAgICB9XG4gICAgICAudHNuZS1jb250YWluZXIge1xuICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgaGVpZ2h0OiA2MDBweDtcbiAgICAgICAgbWFyZ2luOiAxcmVtIDA7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgIH1cbiAgICAgIC50c25lLXN0YXR1cyB7XG4gICAgICAgIG1hcmdpbi10b3A6IDFyZW07XG4gICAgICAgIHBhZGRpbmc6IDAuNXJlbTtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1iYWNrZ3JvdW5kLXNlY29uZGFyeSk7XG4gICAgICB9XG4gICAgICAudHNuZS1zdGF0dXMtdGV4dCB7XG4gICAgICAgIG1hcmdpbjogMDtcbiAgICAgICAgZm9udC1zaXplOiAwLjlyZW07XG4gICAgICAgIG9wYWNpdHk6IDAuODtcbiAgICAgIH1cbiAgICBgO1xuICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFZpYmVCb3lQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBzZXR0aW5nczogVmliZUJveVNldHRpbmdzO1xuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG4gICAgLy8gUmVnaXN0ZXIgdGhlIGN1c3RvbSB2aWV3XG4gICAgdGhpcy5yZWdpc3RlclZpZXcoXG4gICAgICBWSUVXX1RZUEVfVFNORSxcbiAgICAgIChsZWFmKSA9PiBuZXcgVFNORVZpZXcobGVhZilcbiAgICApO1xuXG4gICAgLy8gQWRkIGNvbW1hbmQgdG8gb3BlbiB0aGUgdmlzdWFsaXphdGlvblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogJ29wZW4tdHNuZS12aXN1YWxpemF0aW9uJyxcbiAgICAgIG5hbWU6ICdPcGVuIHQtU05FIFZpc3VhbGl6YXRpb24nLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEFkZCBjb21tYW5kIHRvIHJ1biB0LVNORSBhbmFseXNpc1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogJ3J1bi10c25lLWFuYWx5c2lzJyxcbiAgICAgIG5hbWU6ICdSdW4gdC1TTkUgQW5hbHlzaXMnLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgdGhpcy5ydW5UU05FKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBZGQgc2V0dGluZyB0YWJcbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IFNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgfVxuXG4gIG9udW5sb2FkKCkge1xuICAgIC8vIENsZWFuIHVwIHJlc291cmNlcyB3aGVuIHRoZSBwbHVnaW4gaXMgZGlzYWJsZWRcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG5cbiAgYXN5bmMgYWN0aXZhdGVWaWV3KCkge1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEVfVFNORSk7XG4gICAgaWYgKGV4aXN0aW5nLmxlbmd0aCkge1xuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYoZXhpc3RpbmdbMF0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZih0cnVlKTtcbiAgICBhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7XG4gICAgICB0eXBlOiBWSUVXX1RZUEVfVFNORSxcbiAgICAgIGFjdGl2ZTogdHJ1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIHJ1blRTTkUoKSB7XG4gICAgLy8gUHJvY2VzcyBub3RlcyBhbmQgcnVuIHQtU05FIGFuYWx5c2lzXG4gICAgbmV3IE5vdGljZSgndC1TTkUgYW5hbHlzaXMgc3RhcnRpbmcuLi4nKTtcbiAgICB0aGlzLnVwZGF0ZVN0YXR1cygnR2F0aGVyaW5nIG5vdGVzLi4uJyk7XG4gICAgXG4gICAgLy8gR2V0IGFsbCBtYXJrZG93biBmaWxlcyBpbiB0aGUgdmF1bHRcbiAgICBjb25zdCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgLy8gTGltaXQgdG8gYSByZWFzb25hYmxlIG51bWJlciBvZiBmaWxlcyBmb3IgcGVyZm9ybWFuY2VcbiAgICAgIGNvbnN0IG1heEZpbGVzID0gMjAwO1xuICAgICAgY29uc3Qgc2VsZWN0ZWRGaWxlcyA9IGZpbGVzLnNsaWNlKDAsIG1heEZpbGVzKTtcbiAgICAgIFxuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoYFByb2Nlc3NpbmcgJHtzZWxlY3RlZEZpbGVzLmxlbmd0aH0gbm90ZXMuLi5gKTtcbiAgICAgIFxuICAgICAgLy8gUHJlcGFyZSBub3RlcyBkYXRhIGZvciB0aGUgUHl0aG9uIHNlcnZlclxuICAgICAgY29uc3Qgbm90ZXMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgc2VsZWN0ZWRGaWxlcy5tYXAoYXN5bmMgKGZpbGUpID0+IHtcbiAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcbiAgICAgICAgICBjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5zdGF0KGZpbGUucGF0aCk7XG4gICAgICAgICAgY29uc3Qgd29yZENvdW50ID0gY29udGVudC5zcGxpdCgvXFxzKy8pLmxlbmd0aDtcbiAgICAgICAgICBjb25zdCByZWFkaW5nVGltZSA9IE1hdGguY2VpbCh3b3JkQ291bnQgLyAyMDApOyAvLyBBdmcgcmVhZGluZyBzcGVlZCB+MjAwIHdvcmRzL21pbnV0ZVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIEV4dHJhY3QgdGFncyAobG9va2luZyBmb3IgI3RhZyBmb3JtYXQpXG4gICAgICAgICAgY29uc3QgdGFnUmVnZXggPSAvIyhbYS16QS1aMC05Xy1dKykvZztcbiAgICAgICAgICBjb25zdCB0YWdzID0gWy4uLmNvbnRlbnQubWF0Y2hBbGwodGFnUmVnZXgpXS5tYXAobWF0Y2ggPT4gbWF0Y2hbMV0pO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIEdldCBhIGNvbnRlbnQgcHJldmlldyAoZmlyc3QgMTUwIGNoYXJzKVxuICAgICAgICAgIGNvbnN0IGNvbnRlbnRQcmV2aWV3ID0gY29udGVudC5zdWJzdHJpbmcoMCwgMTUwKS5yZXBsYWNlKC9cXG4vZywgJyAnKSArIFxuICAgICAgICAgICAgKGNvbnRlbnQubGVuZ3RoID4gMTUwID8gJy4uLicgOiAnJyk7XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBhdGg6IGZpbGUucGF0aCxcbiAgICAgICAgICAgIHRpdGxlOiBmaWxlLmJhc2VuYW1lLFxuICAgICAgICAgICAgY29udGVudDogY29udGVudCxcbiAgICAgICAgICAgIG10aW1lOiBzdGF0Lm10aW1lLFxuICAgICAgICAgICAgY3RpbWU6IHN0YXQuY3RpbWUsXG4gICAgICAgICAgICB3b3JkQ291bnQ6IHdvcmRDb3VudCxcbiAgICAgICAgICAgIHJlYWRpbmdUaW1lOiByZWFkaW5nVGltZSxcbiAgICAgICAgICAgIHRhZ3M6IHRhZ3MsXG4gICAgICAgICAgICBjb250ZW50UHJldmlldzogY29udGVudFByZXZpZXdcbiAgICAgICAgICB9O1xuICAgICAgICB9KVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoJ1NlbmRpbmcgZGF0YSB0byB0LVNORSBzZXJ2ZXIuLi4nKTtcbiAgICAgIFxuICAgICAgLy8gQ2hlY2sgaWYgUHl0aG9uIHNlcnZlciBpcyBydW5uaW5nXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBoZWFsdGhDaGVjayA9IGF3YWl0IGZldGNoKCdodHRwOi8vMTI3LjAuMC4xOjEyMzQvaGVhbHRoJywgeyBcbiAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFoZWFsdGhDaGVjay5vaykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlB5dGhvbiBzZXJ2ZXIgaXMgbm90IHJlc3BvbmRpbmdcIik7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBcIkNhbm5vdCBjb25uZWN0IHRvIFB5dGhvbiBzZXJ2ZXIuIE1ha2Ugc3VyZSB0aGUgc2VydmVyIGlzIHJ1bm5pbmcgYXQgaHR0cDovLzEyNy4wLjAuMToxMjM0LiBcIiArXG4gICAgICAgICAgXCJSdW4gJ3B5dGhvbiBzcmMvcHl0aG9uL3RzbmUvc2VydmVyLnB5JyB0byBzdGFydCBpdC5cIlxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBTZW5kIHRvIFB5dGhvbiBzZXJ2ZXIgZm9yIHByb2Nlc3NpbmdcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGBSdW5uaW5nIHQtU05FIGFuYWx5c2lzIHdpdGggcGVycGxleGl0eT0ke3RoaXMuc2V0dGluZ3MucGVycGxleGl0eX0sIGl0ZXJhdGlvbnM9JHt0aGlzLnNldHRpbmdzLml0ZXJhdGlvbnN9Li4uYCk7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCdodHRwOi8vMTI3LjAuMC4xOjEyMzQvcHJvY2VzcycsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgbm90ZXM6IG5vdGVzLFxuICAgICAgICAgIHNldHRpbmdzOiB7XG4gICAgICAgICAgICBwZXJwbGV4aXR5OiB0aGlzLnNldHRpbmdzLnBlcnBsZXhpdHksXG4gICAgICAgICAgICBpdGVyYXRpb25zOiB0aGlzLnNldHRpbmdzLml0ZXJhdGlvbnMsXG4gICAgICAgICAgICBsZWFybmluZ19yYXRlOiB0aGlzLnNldHRpbmdzLmVwc2lsb25cbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNlcnZlciByZXNwb25kZWQgd2l0aCBzdGF0dXM6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICBcbiAgICAgIGlmIChyZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgZXJyb3I6ICR7cmVzdWx0LmVycm9yfWApO1xuICAgICAgfVxuICAgICAgXG4gICAgICB0aGlzLnVwZGF0ZVN0YXR1cygnVmlzdWFsaXppbmcgcmVzdWx0cy4uLicpO1xuICAgICAgXG4gICAgICAvLyBEZWJ1ZyAtIGxvZyB0aGUgcmVzdWx0IHN0cnVjdHVyZSB0byBjaGVjayBtZXRhZGF0YVxuICAgICAgY29uc29sZS5sb2coJ1Zpc3VhbGl6aW5nIHJlc3VsdCB3aXRoIG1ldGFkYXRhOicsIHJlc3VsdCk7XG4gICAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGFkZGl0aW9uYWwgbWV0YWRhdGFcbiAgICAgIGlmIChyZXN1bHQucG9pbnRzICYmIHJlc3VsdC5wb2ludHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBzYW1wbGVQb2ludCA9IHJlc3VsdC5wb2ludHNbMF07XG4gICAgICAgIGNvbnNvbGUubG9nKCdTYW1wbGUgcG9pbnQgbWV0YWRhdGE6Jywge1xuICAgICAgICAgIGhhc1dvcmRDb3VudDogc2FtcGxlUG9pbnQud29yZENvdW50ICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzTXRpbWU6IHNhbXBsZVBvaW50Lm10aW1lICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzQ3RpbWU6IHNhbXBsZVBvaW50LmN0aW1lICE9PSB1bmRlZmluZWQsXG4gICAgICAgICAgaGFzVGFnczogc2FtcGxlUG9pbnQudGFncyAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc0NvbnRlbnRQcmV2aWV3OiBzYW1wbGVQb2ludC5jb250ZW50UHJldmlldyAhPT0gdW5kZWZpbmVkLFxuICAgICAgICAgIGhhc0Rpc3RhbmNlVG9DZW50ZXI6IHNhbXBsZVBvaW50LmRpc3RhbmNlVG9DZW50ZXIgIT09IHVuZGVmaW5lZFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gU3RvcmUgdGhlIHJlc3VsdCBmb3IgbGF0ZXIgdXNlIGluIGxpbmsgc3VnZ2VzdGlvbnNcbiAgICAgIHRoaXMubGFzdFJlc3VsdCA9IHJlc3VsdDtcbiAgICAgIFxuICAgICAgLy8gVmlzdWFsaXplIHRoZSByZXN1bHRcbiAgICAgIHRoaXMudmlzdWFsaXplUmVzdWx0KHJlc3VsdCk7XG4gICAgICBcbiAgICAgIHRoaXMudXBkYXRlU3RhdHVzKGBWaXN1YWxpemF0aW9uIGNvbXBsZXRlISBEaXNwbGF5aW5nICR7cmVzdWx0LnBvaW50cy5sZW5ndGh9IG5vdGVzLmApO1xuICAgICAgbmV3IE5vdGljZSgndC1TTkUgYW5hbHlzaXMgY29tcGxldGUhJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHJ1bm5pbmcgdC1TTkUgYW5hbHlzaXM6JywgZXJyb3IpO1xuICAgICAgdGhpcy51cGRhdGVTdGF0dXMoYEVycm9yOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICBuZXcgTm90aWNlKGB0LVNORSBhbmFseXNpcyBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbiAgXG4gIHByaXZhdGUgdXBkYXRlU3RhdHVzKG1lc3NhZ2U6IHN0cmluZykge1xuICAgIC8vIEZpbmQgdGhlIHN0YXR1cyBlbGVtZW50IGluIHRoZSB2aWV3IGFuZCB1cGRhdGUgaXRcbiAgICBjb25zdCBzdGF0dXNFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RzbmUtc3RhdHVzIC50c25lLXN0YXR1cy10ZXh0Jyk7XG4gICAgaWYgKHN0YXR1c0VsZW1lbnQpIHtcbiAgICAgIHN0YXR1c0VsZW1lbnQudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICAgIH1cbiAgICBjb25zb2xlLmxvZyhgU3RhdHVzOiAke21lc3NhZ2V9YCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgYXN5bmMgdmlzdWFsaXplUmVzdWx0KHJlc3VsdDogYW55KSB7XG4gICAgLy8gR2V0IG9yIGNyZWF0ZSB0aGUgdmlzdWFsaXphdGlvbiB2aWV3XG4gICAgbGV0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9UU05FKVswXTtcbiAgICBpZiAoIWxlYWYpIHtcbiAgICAgIC8vIEFjdGl2YXRlIHRoZSB2aWV3IGlmIG5vdCBmb3VuZFxuICAgICAgYXdhaXQgdGhpcy5hY3RpdmF0ZVZpZXcoKTtcbiAgICAgIC8vIFRyeSB0byBnZXQgdGhlIGxlYWYgYWdhaW5cbiAgICAgIGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRV9UU05FKVswXTtcbiAgICAgIFxuICAgICAgaWYgKCFsZWFmKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NvdWxkIG5vdCBjcmVhdGUgdmlzdWFsaXphdGlvbiB2aWV3Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gQWNjZXNzIHRoZSB2aWV3IGNvbnRhaW5lclxuICAgIGNvbnN0IHZpZXcgPSBsZWFmLnZpZXcgYXMgVFNORVZpZXc7XG4gICAgY29uc3QgY29udGFpbmVyID0gdmlldy5jb250ZW50RWwucXVlcnlTZWxlY3RvcignI3RzbmUtY29udGFpbmVyJykgYXMgSFRNTEVsZW1lbnQ7XG4gICAgaWYgKCFjb250YWluZXIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0NvbnRhaW5lciBub3QgZm91bmQgaW4gdmlldycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICAvLyBDbGVhciBhbnkgZXhpc3RpbmcgY29udGVudFxuICAgIHdoaWxlIChjb250YWluZXIuZmlyc3RDaGlsZCkge1xuICAgICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKGNvbnRhaW5lci5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ3JlYXRlIHRoZSB2aXN1YWxpemVyXG4gICAgY29uc3Qgb3BlbkNhbGxiYWNrID0gKHBhdGg6IHN0cmluZykgPT4ge1xuICAgICAgLy8gT3BlbiB0aGUgc2VsZWN0ZWQgbm90ZVxuICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcbiAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoKS5vcGVuRmlsZShmaWxlKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIC8vIENyZWF0ZSBhbmQgdXNlIHRoZSB2aXN1YWxpemVyIGRpcmVjdGx5XG4gICAgY29uc3QgdmlzdWFsaXplciA9IG5ldyBUU05FVmlzdWFsaXplcihjb250YWluZXIsIG9wZW5DYWxsYmFjayk7XG4gICAgdmlzdWFsaXplci5zZXREYXRhKHJlc3VsdCk7XG4gIH1cbiAgXG4gIC8vIE1ldGhvZCB0byBzdWdnZXN0IGxpbmtzIGJldHdlZW4gbm90ZXMgdXNpbmcgTExNXG4gIGFzeW5jIHN1Z2dlc3RMaW5rcygpIHtcbiAgICBpZiAoIXRoaXMubGFzdFJlc3VsdCB8fCAhdGhpcy5sYXN0UmVzdWx0LnBvaW50cyB8fCB0aGlzLmxhc3RSZXN1bHQucG9pbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbmV3IE5vdGljZSgnUGxlYXNlIHJ1biB0LVNORSBhbmFseXNpcyBmaXJzdCB0byBnZW5lcmF0ZSBub3RlIGRhdGEnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgLy8gU2hvdyBhIG5vdGljZSB0aGF0IHdlJ3JlIHN0YXJ0aW5nIHRoZSBwcm9jZXNzXG4gICAgbmV3IE5vdGljZSgnRmluZGluZyBwb3RlbnRpYWwgbm90ZSBjb25uZWN0aW9ucy4uLicpO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICAvLyBGaW5kIHBvdGVudGlhbCBjb25uZWN0aW9ucyBiYXNlZCBvbiB0LVNORSBwcm94aW1pdHkgYW5kIGNsdXN0ZXJpbmdcbiAgICAgIGNvbnN0IGNvbm5lY3Rpb25zID0gdGhpcy5maW5kUG90ZW50aWFsQ29ubmVjdGlvbnModGhpcy5sYXN0UmVzdWx0KTtcbiAgICAgIFxuICAgICAgaWYgKGNvbm5lY3Rpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBuZXcgTm90aWNlKCdObyBzdHJvbmcgY29ubmVjdGlvbnMgZm91bmQgYmV0d2VlbiBub3RlcycpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIENyZWF0ZSBhIG1vZGFsIHRvIGRpc3BsYXkgdGhlIHN1Z2dlc3RlZCBjb25uZWN0aW9uc1xuICAgICAgY29uc3QgbW9kYWwgPSBuZXcgU3VnZ2VzdGVkTGlua3NNb2RhbCh0aGlzLmFwcCwgY29ubmVjdGlvbnMsIHRoaXMpO1xuICAgICAgbW9kYWwub3BlbigpO1xuICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHN1Z2dlc3RpbmcgbGlua3M6JywgZXJyb3IpO1xuICAgICAgbmV3IE5vdGljZShgRXJyb3Igc3VnZ2VzdGluZyBsaW5rczogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxuICBcbiAgLy8gU3RvcmUgdGhlIGxhc3QgcmVzdWx0IGZvciB1c2UgaW4gbGluayBzdWdnZXN0aW9uc1xuICBwcml2YXRlIGxhc3RSZXN1bHQ6IGFueSA9IG51bGw7XG4gIFxuICAvLyBGaW5kIHBvdGVudGlhbCBjb25uZWN0aW9ucyBiZXR3ZWVuIG5vdGVzIGJhc2VkIG9uIHQtU05FIHJlc3VsdHNcbiAgcHJpdmF0ZSBmaW5kUG90ZW50aWFsQ29ubmVjdGlvbnMocmVzdWx0OiBhbnkpOiBOb3RlQ29ubmVjdGlvbltdIHtcbiAgICBjb25zdCBjb25uZWN0aW9uczogTm90ZUNvbm5lY3Rpb25bXSA9IFtdO1xuICAgIGNvbnN0IHBvaW50cyA9IHJlc3VsdC5wb2ludHMgYXMgVFNORVBvaW50W107XG4gICAgXG4gICAgLy8gMS4gRmluZCBub3RlcyBpbiB0aGUgc2FtZSBjbHVzdGVyXG4gICAgY29uc3QgY2x1c3Rlckdyb3VwczogeyBba2V5OiBudW1iZXJdOiBUU05FUG9pbnRbXSB9ID0ge307XG4gICAgXG4gICAgLy8gR3JvdXAgcG9pbnRzIGJ5IGNsdXN0ZXJcbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHBvaW50cykge1xuICAgICAgaWYgKHBvaW50LmNsdXN0ZXIgPT09IC0xKSBjb250aW51ZTsgLy8gU2tpcCB1bmNsdXN0ZXJlZCBwb2ludHNcbiAgICAgIFxuICAgICAgaWYgKCFjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdKSB7XG4gICAgICAgIGNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0gPSBbXTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXS5wdXNoKHBvaW50KTtcbiAgICB9XG4gICAgXG4gICAgLy8gRm9yIGVhY2ggY2x1c3RlciwgZmluZCB0aGUgbW9zdCBjZW50cmFsIG5vdGVzXG4gICAgT2JqZWN0LmVudHJpZXMoY2x1c3Rlckdyb3VwcykuZm9yRWFjaCgoW2NsdXN0ZXJJZCwgY2x1c3RlclBvaW50c10pID0+IHtcbiAgICAgIC8vIE9ubHkgY29uc2lkZXIgY2x1c3RlcnMgd2l0aCBhdCBsZWFzdCAyIG5vdGVzXG4gICAgICBpZiAoY2x1c3RlclBvaW50cy5sZW5ndGggPCAyKSByZXR1cm47XG4gICAgICBcbiAgICAgIC8vIEZpbmQgbW9zdCBjZW50cmFsIG5vdGVzIGluIHRoZSBjbHVzdGVyIChjbG9zZXN0IHRvIGNsdXN0ZXIgY2VudGVyKVxuICAgICAgY2x1c3RlclBvaW50cy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGRpc3RBID0gYS5kaXN0YW5jZVRvQ2VudGVyIHx8IEluZmluaXR5O1xuICAgICAgICBjb25zdCBkaXN0QiA9IGIuZGlzdGFuY2VUb0NlbnRlciB8fCBJbmZpbml0eTtcbiAgICAgICAgcmV0dXJuIGRpc3RBIC0gZGlzdEI7XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gVGFrZSB0aGUgbW9zdCBjZW50cmFsIG5vdGVzXG4gICAgICBjb25zdCBjZW50cmFsTm90ZXMgPSBjbHVzdGVyUG9pbnRzLnNsaWNlKDAsIE1hdGgubWluKDMsIGNsdXN0ZXJQb2ludHMubGVuZ3RoKSk7XG4gICAgICBcbiAgICAgIC8vIENyZWF0ZSBjb25uZWN0aW9ucyBiZXR3ZWVuIHRoZSBjZW50cmFsIG5vdGVzXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNlbnRyYWxOb3Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCBjZW50cmFsTm90ZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBjb25zdCBub3RlQSA9IGNlbnRyYWxOb3Rlc1tpXTtcbiAgICAgICAgICBjb25zdCBub3RlQiA9IGNlbnRyYWxOb3Rlc1tqXTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBTa2lwIGlmIHRoZSB0d28gbm90ZXMgYXJlIHZlcnkgZmFyIGFwYXJ0IGluIHRoZSB2aXN1YWxpemF0aW9uXG4gICAgICAgICAgY29uc3QgZGlzdGFuY2UgPSBNYXRoLnNxcnQoXG4gICAgICAgICAgICBNYXRoLnBvdyhub3RlQS54IC0gbm90ZUIueCwgMikgKyBNYXRoLnBvdyhub3RlQS55IC0gbm90ZUIueSwgMilcbiAgICAgICAgICApO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChkaXN0YW5jZSA+IDAuNSkgY29udGludWU7IC8vIFNraXAgaWYgdG9vIGZhclxuICAgICAgICAgIFxuICAgICAgICAgIC8vIENhbGN1bGF0ZSBhIHNpbWlsYXJpdHkgc2NvcmUgKDAtMTAwKVxuICAgICAgICAgIGNvbnN0IHNpbWlsYXJpdHkgPSAxMDAgLSBNYXRoLm1pbigxMDAsIGRpc3RhbmNlICogMTAwKTtcbiAgICAgICAgICBcbiAgICAgICAgICAvLyBGaW5kIGNvbW1vbiB0ZXJtc1xuICAgICAgICAgIGNvbnN0IGNvbW1vblRlcm1zID0gbm90ZUEudG9wX3Rlcm1zLmZpbHRlcih0ZXJtID0+IFxuICAgICAgICAgICAgbm90ZUIudG9wX3Rlcm1zLmluY2x1ZGVzKHRlcm0pXG4gICAgICAgICAgKTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIHNvdXJjZU5vdGU6IG5vdGVBLFxuICAgICAgICAgICAgdGFyZ2V0Tm90ZTogbm90ZUIsXG4gICAgICAgICAgICBzaW1pbGFyaXR5OiBzaW1pbGFyaXR5LFxuICAgICAgICAgICAgY29tbW9uVGVybXM6IGNvbW1vblRlcm1zLFxuICAgICAgICAgICAgY2x1c3RlclRlcm1zOiByZXN1bHQuY2x1c3Rlcl90ZXJtcz8uW2NsdXN0ZXJJZF0/LnNsaWNlKDAsIDUpLm1hcCgodDogYW55KSA9PiB0LnRlcm0pIHx8IFtdLFxuICAgICAgICAgICAgcmVhc29uOiBgQm90aCBub3RlcyBhcmUgY2VudHJhbCBpbiBjbHVzdGVyICR7Y2x1c3RlcklkfWBcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIC8vIDIuIEZpbmQgbm90ZXMgdGhhdCBhcmUgY2xvc2UgaW4gdGhlIHQtU05FIHByb2plY3Rpb24gYnV0IG1heSBiZSBpbiBkaWZmZXJlbnQgY2x1c3RlcnNcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgZm9yIChsZXQgaiA9IGkgKyAxOyBqIDwgcG9pbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGNvbnN0IG5vdGVBID0gcG9pbnRzW2ldO1xuICAgICAgICBjb25zdCBub3RlQiA9IHBvaW50c1tqXTtcbiAgICAgICAgXG4gICAgICAgIC8vIFNraXAgbm90ZXMgaW4gdGhlIHNhbWUgY2x1c3RlciAoYWxyZWFkeSBoYW5kbGVkIGFib3ZlKVxuICAgICAgICBpZiAobm90ZUEuY2x1c3RlciAhPT0gLTEgJiYgbm90ZUEuY2x1c3RlciA9PT0gbm90ZUIuY2x1c3RlcikgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICAvLyBDYWxjdWxhdGUgRXVjbGlkZWFuIGRpc3RhbmNlIGluIHQtU05FIHNwYWNlXG4gICAgICAgIGNvbnN0IGRpc3RhbmNlID0gTWF0aC5zcXJ0KFxuICAgICAgICAgIE1hdGgucG93KG5vdGVBLnggLSBub3RlQi54LCAyKSArIE1hdGgucG93KG5vdGVBLnkgLSBub3RlQi55LCAyKVxuICAgICAgICApO1xuICAgICAgICBcbiAgICAgICAgLy8gT25seSBjb25zaWRlciB2ZXJ5IGNsb3NlIG5vdGVzXG4gICAgICAgIGlmIChkaXN0YW5jZSA+IDAuMikgY29udGludWU7XG4gICAgICAgIFxuICAgICAgICAvLyBDYWxjdWxhdGUgYSBzaW1pbGFyaXR5IHNjb3JlICgwLTEwMClcbiAgICAgICAgY29uc3Qgc2ltaWxhcml0eSA9IDEwMCAtIE1hdGgubWluKDEwMCwgZGlzdGFuY2UgKiAyMDApO1xuICAgICAgICBcbiAgICAgICAgLy8gRmluZCBjb21tb24gdGVybXNcbiAgICAgICAgY29uc3QgY29tbW9uVGVybXMgPSBub3RlQS50b3BfdGVybXMuZmlsdGVyKHRlcm0gPT4gXG4gICAgICAgICAgbm90ZUIudG9wX3Rlcm1zLmluY2x1ZGVzKHRlcm0pXG4gICAgICAgICk7XG4gICAgICAgIFxuICAgICAgICAvLyBPbmx5IGluY2x1ZGUgaWYgdGhleSBoYXZlIGNvbW1vbiB0ZXJtc1xuICAgICAgICBpZiAoY29tbW9uVGVybXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgc291cmNlTm90ZTogbm90ZUEsXG4gICAgICAgICAgICB0YXJnZXROb3RlOiBub3RlQixcbiAgICAgICAgICAgIHNpbWlsYXJpdHk6IHNpbWlsYXJpdHksXG4gICAgICAgICAgICBjb21tb25UZXJtczogY29tbW9uVGVybXMsXG4gICAgICAgICAgICBjbHVzdGVyVGVybXM6IFtdLFxuICAgICAgICAgICAgcmVhc29uOiBgTm90ZXMgYXJlIHZlcnkgY2xvc2UgaW4gdGhlIHZpc3VhbGl6YXRpb24gYW5kIHNoYXJlIGNvbW1vbiB0ZXJtc2BcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBTb3J0IGNvbm5lY3Rpb25zIGJ5IHNpbWlsYXJpdHkgKGhpZ2hlc3QgZmlyc3QpXG4gICAgY29ubmVjdGlvbnMuc29ydCgoYSwgYikgPT4gYi5zaW1pbGFyaXR5IC0gYS5zaW1pbGFyaXR5KTtcbiAgICBcbiAgICAvLyBSZXR1cm4gdG9wIDEwIGNvbm5lY3Rpb25zIHRvIGF2b2lkIG92ZXJ3aGVsbWluZyB0aGUgdXNlclxuICAgIHJldHVybiBjb25uZWN0aW9ucy5zbGljZSgwLCAxMCk7XG4gIH1cbiAgXG4gIC8vIENyZWF0ZSBhIGxpbmsgYmV0d2VlbiB0d28gbm90ZXNcbiAgYXN5bmMgY3JlYXRlTm90ZUxpbmsoc291cmNlTm90ZVBhdGg6IHN0cmluZywgdGFyZ2V0Tm90ZVBhdGg6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZykge1xuICAgIHRyeSB7XG4gICAgICAvLyBHZXQgdGhlIHNvdXJjZSBmaWxlXG4gICAgICBjb25zdCBzb3VyY2VGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHNvdXJjZU5vdGVQYXRoKTtcbiAgICAgIGlmICghKHNvdXJjZUZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTb3VyY2UgZmlsZSBub3QgZm91bmQ6ICR7c291cmNlTm90ZVBhdGh9YCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIFJlYWQgdGhlIGZpbGUgY29udGVudFxuICAgICAgY29uc3Qgc291cmNlQ29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoc291cmNlRmlsZSk7XG4gICAgICBcbiAgICAgIC8vIEdlbmVyYXRlIHRoZSBsaW5rIHRleHQgd2l0aCB0aGUgZm9ybWF0dGVkIGNvbm5lY3Rpb24gZGVzY3JpcHRpb25cbiAgICAgIGNvbnN0IHRhcmdldEZpbGVOYW1lID0gdGFyZ2V0Tm90ZVBhdGguc3BsaXQoJy8nKS5wb3AoKSB8fCB0YXJnZXROb3RlUGF0aDtcbiAgICAgIGNvbnN0IGxpbmtUZXh0ID0gYFxcblxcbiMjIFJlbGF0ZWQgTm90ZXNcXG5cXG4tIFtbJHt0YXJnZXRGaWxlTmFtZX1dXSAtICR7ZGVzY3JpcHRpb24udHJpbSgpfVxcbmA7XG4gICAgICBcbiAgICAgIC8vIEFwcGVuZCB0aGUgbGluayB0byB0aGUgc291cmNlIGZpbGVcbiAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShzb3VyY2VGaWxlLCBzb3VyY2VDb250ZW50ICsgbGlua1RleHQpO1xuICAgICAgXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgY3JlYXRpbmcgbm90ZSBsaW5rOicsIGVycm9yKTtcbiAgICAgIG5ldyBOb3RpY2UoYEZhaWxlZCB0byBjcmVhdGUgbGluazogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxufVxuXG4vLyBJbnRlcmZhY2UgZm9yIHQtU05FIHJlc3VsdCBwb2ludHNcbmludGVyZmFjZSBUU05FUG9pbnQge1xuICB4OiBudW1iZXI7XG4gIHk6IG51bWJlcjtcbiAgdGl0bGU6IHN0cmluZztcbiAgcGF0aDogc3RyaW5nO1xuICB0b3BfdGVybXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyOiBudW1iZXI7IC8vIENsdXN0ZXIgSUQgKC0xIG1lYW5zIG5vaXNlL25vdCBjbHVzdGVyZWQpXG4gIFxuICAvLyBBZGRpdGlvbmFsIG1ldGFkYXRhXG4gIG10aW1lPzogbnVtYmVyOyAgICAgIC8vIExhc3QgbW9kaWZpZWQgdGltZVxuICBjdGltZT86IG51bWJlcjsgICAgICAvLyBDcmVhdGlvbiB0aW1lXG4gIHdvcmRDb3VudD86IG51bWJlcjsgIC8vIFdvcmQgY291bnRcbiAgcmVhZGluZ1RpbWU/OiBudW1iZXI7IC8vIEVzdGltYXRlZCByZWFkaW5nIHRpbWUgaW4gbWludXRlcyAgXG4gIHRhZ3M/OiBzdHJpbmdbXTsgICAgIC8vIE5vdGUgdGFnc1xuICBjb250ZW50UHJldmlldz86IHN0cmluZzsgLy8gU2hvcnQgcHJldmlldyBvZiBjb250ZW50XG4gIGRpc3RhbmNlVG9DZW50ZXI/OiBudW1iZXI7IC8vIERpc3RhbmNlIHRvIGNsdXN0ZXIgY2VudGVyXG59XG5cbi8vIEludGVyZmFjZSBmb3IgY2x1c3RlciB0ZXJtIGluZm9ybWF0aW9uXG5pbnRlcmZhY2UgQ2x1c3RlclRlcm0ge1xuICB0ZXJtOiBzdHJpbmc7XG4gIHNjb3JlOiBudW1iZXI7XG59XG5cbi8vIEludGVyZmFjZSBmb3IgY2x1c3RlciBpbmZvcm1hdGlvblxuaW50ZXJmYWNlIENsdXN0ZXJJbmZvIHtcbiAgW2tleTogc3RyaW5nXTogQ2x1c3RlclRlcm1bXTtcbn1cblxuLy8gSW50ZXJmYWNlIGZvciB0LVNORSByZXN1bHRzXG5pbnRlcmZhY2UgVFNORVJlc3VsdCB7XG4gIHBvaW50czogVFNORVBvaW50W107XG4gIGZlYXR1cmVfbmFtZXM6IHN0cmluZ1tdO1xuICBjbHVzdGVyczogbnVtYmVyO1xuICBjbHVzdGVyX3Rlcm1zOiBDbHVzdGVySW5mbztcbn1cblxuY2xhc3MgVFNORVZpc3VhbGl6ZXIge1xuICBwcml2YXRlIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudDtcbiAgcHJpdmF0ZSBjdHg6IENhbnZhc1JlbmRlcmluZ0NvbnRleHQyRDtcbiAgcHJpdmF0ZSByZXN1bHQ6IFRTTkVSZXN1bHQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB3aWR0aCA9IDgwMDtcbiAgcHJpdmF0ZSBoZWlnaHQgPSA2MDA7XG4gIHByaXZhdGUgcG9pbnRSYWRpdXMgPSAxMDtcbiAgcHJpdmF0ZSBtb3VzZVggPSAwO1xuICBwcml2YXRlIG1vdXNlWSA9IDA7XG4gIHByaXZhdGUgc2NhbGUgPSAxO1xuICBwcml2YXRlIG9mZnNldFggPSAwO1xuICBwcml2YXRlIG9mZnNldFkgPSAwO1xuICBwcml2YXRlIGlzRHJhZ2dpbmcgPSBmYWxzZTtcbiAgcHJpdmF0ZSBsYXN0WCA9IDA7XG4gIHByaXZhdGUgbGFzdFkgPSAwO1xuICBwcml2YXRlIGhvdmVyZWRQb2ludDogVFNORVBvaW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgb3BlbkNhbGxiYWNrOiAocGF0aDogc3RyaW5nKSA9PiB2b2lkO1xuXG4gIGNvbnN0cnVjdG9yKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIG9wZW5DYWxsYmFjazogKHBhdGg6IHN0cmluZykgPT4gdm9pZCkge1xuICAgIHRoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuICAgIHRoaXMub3BlbkNhbGxiYWNrID0gb3BlbkNhbGxiYWNrO1xuICAgIFxuICAgIC8vIENyZWF0ZSBjYW52YXMgZWxlbWVudFxuICAgIHRoaXMuY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgdGhpcy5jYW52YXMud2lkdGggPSB0aGlzLndpZHRoO1xuICAgIHRoaXMuY2FudmFzLmhlaWdodCA9IHRoaXMuaGVpZ2h0O1xuICAgIHRoaXMuY2FudmFzLmNsYXNzTGlzdC5hZGQoJ3RzbmUtY2FudmFzJyk7XG4gICAgdGhpcy5jYW52YXMuc3R5bGUuYm9yZGVyID0gJzFweCBzb2xpZCB2YXIoLS1iYWNrZ3JvdW5kLW1vZGlmaWVyLWJvcmRlciknO1xuICAgIFxuICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgIGlmICghY29udGV4dCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgY3JlYXRlIGNhbnZhcyBjb250ZXh0Jyk7XG4gICAgfVxuICAgIHRoaXMuY3R4ID0gY29udGV4dDtcbiAgICBcbiAgICAvLyBDbGVhciB0aGUgY29udGFpbmVyIGZpcnN0XG4gICAgd2hpbGUgKHRoaXMuY29udGFpbmVyLmZpcnN0Q2hpbGQpIHtcbiAgICAgIHRoaXMuY29udGFpbmVyLnJlbW92ZUNoaWxkKHRoaXMuY29udGFpbmVyLmZpcnN0Q2hpbGQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBBZGQgY2FudmFzIHRvIGNvbnRhaW5lclxuICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuY2FudmFzKTtcbiAgICBcbiAgICAvLyBBZGQgZXZlbnQgbGlzdGVuZXJzXG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVycygpO1xuICB9XG4gIFxuICBwcml2YXRlIGFkZEV2ZW50TGlzdGVuZXJzKCkge1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuaGFuZGxlTW91c2VNb3ZlLmJpbmQodGhpcykpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5oYW5kbGVDbGljay5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCd3aGVlbCcsIHRoaXMuaGFuZGxlV2hlZWwuYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcy5oYW5kbGVNb3VzZURvd24uYmluZCh0aGlzKSk7XG4gICAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuaGFuZGxlTW91c2VVcC5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWxlYXZlJywgdGhpcy5oYW5kbGVNb3VzZVVwLmJpbmQodGhpcykpO1xuICB9XG4gIFxuICBwcml2YXRlIGhhbmRsZU1vdXNlTW92ZShlOiBNb3VzZUV2ZW50KSB7XG4gICAgY29uc3QgcmVjdCA9IHRoaXMuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHRoaXMubW91c2VYID0gZS5jbGllbnRYIC0gcmVjdC5sZWZ0O1xuICAgIHRoaXMubW91c2VZID0gZS5jbGllbnRZIC0gcmVjdC50b3A7XG4gICAgXG4gICAgaWYgKHRoaXMuaXNEcmFnZ2luZykge1xuICAgICAgY29uc3QgZHggPSB0aGlzLm1vdXNlWCAtIHRoaXMubGFzdFg7XG4gICAgICBjb25zdCBkeSA9IHRoaXMubW91c2VZIC0gdGhpcy5sYXN0WTtcbiAgICAgIFxuICAgICAgdGhpcy5vZmZzZXRYICs9IGR4O1xuICAgICAgdGhpcy5vZmZzZXRZICs9IGR5O1xuICAgICAgXG4gICAgICB0aGlzLmxhc3RYID0gdGhpcy5tb3VzZVg7XG4gICAgICB0aGlzLmxhc3RZID0gdGhpcy5tb3VzZVk7XG4gICAgICBcbiAgICAgIHRoaXMuZHJhdygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVwZGF0ZUhvdmVyZWRQb2ludCgpO1xuICAgICAgdGhpcy5kcmF3KCk7XG4gICAgfVxuICB9XG4gIFxuICBwcml2YXRlIGhhbmRsZUNsaWNrKGU6IE1vdXNlRXZlbnQpIHtcbiAgICBpZiAodGhpcy5ob3ZlcmVkUG9pbnQpIHtcbiAgICAgIHRoaXMub3BlbkNhbGxiYWNrKHRoaXMuaG92ZXJlZFBvaW50LnBhdGgpO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVXaGVlbChlOiBXaGVlbEV2ZW50KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIFxuICAgIGNvbnN0IGRlbHRhID0gZS5kZWx0YVkgPiAwID8gMC45IDogMS4xO1xuICAgIHRoaXMuc2NhbGUgKj0gZGVsdGE7XG4gICAgXG4gICAgLy8gTGltaXQgem9vbVxuICAgIHRoaXMuc2NhbGUgPSBNYXRoLm1heCgwLjEsIE1hdGgubWluKDUsIHRoaXMuc2NhbGUpKTtcbiAgICBcbiAgICB0aGlzLmRyYXcoKTtcbiAgfVxuICBcbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZURvd24oZTogTW91c2VFdmVudCkge1xuICAgIHRoaXMuaXNEcmFnZ2luZyA9IHRydWU7XG4gICAgdGhpcy5sYXN0WCA9IHRoaXMubW91c2VYO1xuICAgIHRoaXMubGFzdFkgPSB0aGlzLm1vdXNlWTtcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS5jdXJzb3IgPSAnZ3JhYmJpbmcnO1xuICB9XG4gIFxuICBwcml2YXRlIGhhbmRsZU1vdXNlVXAoZTogTW91c2VFdmVudCkge1xuICAgIHRoaXMuaXNEcmFnZ2luZyA9IGZhbHNlO1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLmN1cnNvciA9IHRoaXMuaG92ZXJlZFBvaW50ID8gJ3BvaW50ZXInIDogJ2RlZmF1bHQnO1xuICB9XG4gIFxuICBwcml2YXRlIHVwZGF0ZUhvdmVyZWRQb2ludCgpIHtcbiAgICBpZiAoIXRoaXMucmVzdWx0KSByZXR1cm47XG4gICAgXG4gICAgdGhpcy5ob3ZlcmVkUG9pbnQgPSBudWxsO1xuICAgIFxuICAgIGZvciAoY29uc3QgcG9pbnQgb2YgdGhpcy5yZXN1bHQucG9pbnRzKSB7XG4gICAgICBjb25zdCBbc2NyZWVuWCwgc2NyZWVuWV0gPSB0aGlzLndvcmxkVG9TY3JlZW4ocG9pbnQueCwgcG9pbnQueSk7XG4gICAgICBjb25zdCBkaXN0YW5jZSA9IE1hdGguc3FydChcbiAgICAgICAgTWF0aC5wb3coc2NyZWVuWCAtIHRoaXMubW91c2VYLCAyKSArIFxuICAgICAgICBNYXRoLnBvdyhzY3JlZW5ZIC0gdGhpcy5tb3VzZVksIDIpXG4gICAgICApO1xuICAgICAgXG4gICAgICBpZiAoZGlzdGFuY2UgPD0gdGhpcy5wb2ludFJhZGl1cykge1xuICAgICAgICB0aGlzLmhvdmVyZWRQb2ludCA9IHBvaW50O1xuICAgICAgICB0aGlzLmNhbnZhcy5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgdGhpcy5jYW52YXMuc3R5bGUuY3Vyc29yID0gdGhpcy5pc0RyYWdnaW5nID8gJ2dyYWJiaW5nJyA6ICdkZWZhdWx0JztcbiAgfVxuICBcbiAgLy8gQ29udmVydHMgd29ybGQgc3BhY2UgKHQtU05FKSBjb29yZGluYXRlcyB0byBzY3JlZW4gY29vcmRpbmF0ZXNcbiAgcHJpdmF0ZSB3b3JsZFRvU2NyZWVuKHg6IG51bWJlciwgeTogbnVtYmVyKTogW251bWJlciwgbnVtYmVyXSB7XG4gICAgLy8gTm9ybWFsaXplIHRvIGNlbnRlciBvZiBzY3JlZW5cbiAgICBjb25zdCBjZW50ZXJYID0gdGhpcy53aWR0aCAvIDI7XG4gICAgY29uc3QgY2VudGVyWSA9IHRoaXMuaGVpZ2h0IC8gMjtcbiAgICBcbiAgICAvLyBBcHBseSBzY2FsZSBhbmQgb2Zmc2V0XG4gICAgY29uc3Qgc2NyZWVuWCA9IHggKiB0aGlzLnNjYWxlICogMTAwICsgY2VudGVyWCArIHRoaXMub2Zmc2V0WDtcbiAgICBjb25zdCBzY3JlZW5ZID0geSAqIHRoaXMuc2NhbGUgKiAxMDAgKyBjZW50ZXJZICsgdGhpcy5vZmZzZXRZO1xuICAgIFxuICAgIHJldHVybiBbc2NyZWVuWCwgc2NyZWVuWV07XG4gIH1cbiAgXG4gIHB1YmxpYyBzZXREYXRhKHJlc3VsdDogVFNORVJlc3VsdCkge1xuICAgIHRoaXMucmVzdWx0ID0gcmVzdWx0O1xuICAgIHRoaXMucmVzZXRWaWV3KCk7XG4gICAgdGhpcy5kcmF3KCk7XG4gIH1cbiAgXG4gIHByaXZhdGUgcmVzZXRWaWV3KCkge1xuICAgIHRoaXMuc2NhbGUgPSAxO1xuICAgIHRoaXMub2Zmc2V0WCA9IDA7XG4gICAgdGhpcy5vZmZzZXRZID0gMDtcbiAgfVxuICBcbiAgcHJpdmF0ZSBkcmF3KCkge1xuICAgIGlmICghdGhpcy5yZXN1bHQpIHJldHVybjtcbiAgICBcbiAgICAvLyBDbGVhciBjYW52YXNcbiAgICB0aGlzLmN0eC5jbGVhclJlY3QoMCwgMCwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpO1xuICAgIFxuICAgIC8vIERyYXcgYmFja2dyb3VuZCBncmlkXG4gICAgdGhpcy5kcmF3R3JpZCgpO1xuICAgIFxuICAgIC8vIEZpbmQgY2x1c3RlcnMgdXNpbmcgYSBzaW1wbGUgZGlzdGFuY2UgbWV0cmljXG4gICAgY29uc3QgY2x1c3RlcnMgPSB0aGlzLmZpbmRDbHVzdGVycygpO1xuICAgIFxuICAgIC8vIERyYXcgY2x1c3RlcnMgZmlyc3QgKHVuZGVybmVhdGggcG9pbnRzKVxuICAgIHRoaXMuZHJhd0NsdXN0ZXJzKGNsdXN0ZXJzKTtcbiAgICBcbiAgICAvLyBEcmF3IHBvaW50c1xuICAgIGZvciAoY29uc3QgcG9pbnQgb2YgdGhpcy5yZXN1bHQucG9pbnRzKSB7XG4gICAgICB0aGlzLmRyYXdQb2ludChwb2ludCk7XG4gICAgfVxuICAgIFxuICAgIC8vIERyYXcgdG9vbHRpcCBmb3IgaG92ZXJlZCBwb2ludFxuICAgIGlmICh0aGlzLmhvdmVyZWRQb2ludCkge1xuICAgICAgdGhpcy5kcmF3VG9vbHRpcCgpO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBkcmF3R3JpZCgpIHtcbiAgICBjb25zdCBncmlkU2l6ZSA9IDUwICogdGhpcy5zY2FsZTtcbiAgICBcbiAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9ICdyZ2JhKHZhcigtLWJhY2tncm91bmQtbW9kaWZpZXItYm9yZGVyLXJnYiksIDAuMyknO1xuICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgXG4gICAgLy8gVmVydGljYWwgbGluZXNcbiAgICBmb3IgKGxldCB4ID0gdGhpcy5vZmZzZXRYICUgZ3JpZFNpemU7IHggPCB0aGlzLndpZHRoOyB4ICs9IGdyaWRTaXplKSB7XG4gICAgICB0aGlzLmN0eC5iZWdpblBhdGgoKTtcbiAgICAgIHRoaXMuY3R4Lm1vdmVUbyh4LCAwKTtcbiAgICAgIHRoaXMuY3R4LmxpbmVUbyh4LCB0aGlzLmhlaWdodCk7XG4gICAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICB9XG4gICAgXG4gICAgLy8gSG9yaXpvbnRhbCBsaW5lc1xuICAgIGZvciAobGV0IHkgPSB0aGlzLm9mZnNldFkgJSBncmlkU2l6ZTsgeSA8IHRoaXMuaGVpZ2h0OyB5ICs9IGdyaWRTaXplKSB7XG4gICAgICB0aGlzLmN0eC5iZWdpblBhdGgoKTtcbiAgICAgIHRoaXMuY3R4Lm1vdmVUbygwLCB5KTtcbiAgICAgIHRoaXMuY3R4LmxpbmVUbyh0aGlzLndpZHRoLCB5KTtcbiAgICAgIHRoaXMuY3R4LnN0cm9rZSgpO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBmaW5kQ2x1c3RlcnMoKSB7XG4gICAgaWYgKCF0aGlzLnJlc3VsdCkgcmV0dXJuIFtdO1xuICAgIFxuICAgIC8vIFNpbXBsZSBjbHVzdGVyaW5nIGJhc2VkIG9uIGRpc3RhbmNlXG4gICAgY29uc3QgcG9pbnRzID0gdGhpcy5yZXN1bHQucG9pbnRzO1xuICAgIGNvbnN0IGNsdXN0ZXJzOiBUU05FUG9pbnRbXVtdID0gW107XG4gICAgY29uc3QgdmlzaXRlZCA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuICAgIFxuICAgIGNvbnN0IGRpc3RhbmNlVGhyZXNob2xkID0gMC4yOyAgLy8gQWRqdXN0IHRoaXMgdGhyZXNob2xkIGFzIG5lZWRlZFxuICAgIFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmlzaXRlZC5oYXMoaSkpIGNvbnRpbnVlO1xuICAgICAgXG4gICAgICBjb25zdCBjbHVzdGVyOiBUU05FUG9pbnRbXSA9IFtwb2ludHNbaV1dO1xuICAgICAgdmlzaXRlZC5hZGQoaSk7XG4gICAgICBcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgcG9pbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmIChpID09PSBqIHx8IHZpc2l0ZWQuaGFzKGopKSBjb250aW51ZTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGRpc3RhbmNlID0gTWF0aC5zcXJ0KFxuICAgICAgICAgIE1hdGgucG93KHBvaW50c1tpXS54IC0gcG9pbnRzW2pdLngsIDIpICsgXG4gICAgICAgICAgTWF0aC5wb3cocG9pbnRzW2ldLnkgLSBwb2ludHNbal0ueSwgMilcbiAgICAgICAgKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChkaXN0YW5jZSA8IGRpc3RhbmNlVGhyZXNob2xkKSB7XG4gICAgICAgICAgY2x1c3Rlci5wdXNoKHBvaW50c1tqXSk7XG4gICAgICAgICAgdmlzaXRlZC5hZGQoaik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKGNsdXN0ZXIubGVuZ3RoID4gMSkge1xuICAgICAgICBjbHVzdGVycy5wdXNoKGNsdXN0ZXIpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gY2x1c3RlcnM7XG4gIH1cbiAgXG4gIHByaXZhdGUgZHJhd0NsdXN0ZXJzKGNsdXN0ZXJzOiBUU05FUG9pbnRbXVtdKSB7XG4gICAgLy8gU2tpcCBpZiBubyByZXN1bHQgZGF0YVxuICAgIGlmICghdGhpcy5yZXN1bHQpIHJldHVybjtcbiAgICBcbiAgICAvLyBDb2xvciBwYWxldHRlIGZvciBjbHVzdGVycyAoZXhjbHVkaW5nIG5vaXNlIHBvaW50cylcbiAgICBjb25zdCBjb2xvcnMgPSBbXG4gICAgICB7IGZpbGw6ICdyZ2JhKDI1NSwgOTksIDEzMiwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMjU1LCA5OSwgMTMyLCAwLjUpJyB9LFxuICAgICAgeyBmaWxsOiAncmdiYSg1NCwgMTYyLCAyMzUsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDU0LCAxNjIsIDIzNSwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoMjU1LCAyMDYsIDg2LCAwLjEpJywgc3Ryb2tlOiAncmdiYSgyNTUsIDIwNiwgODYsIDAuNSknIH0sXG4gICAgICB7IGZpbGw6ICdyZ2JhKDc1LCAxOTIsIDE5MiwgMC4xKScsIHN0cm9rZTogJ3JnYmEoNzUsIDE5MiwgMTkyLCAwLjUpJyB9LFxuICAgICAgeyBmaWxsOiAncmdiYSgxNTMsIDEwMiwgMjU1LCAwLjEpJywgc3Ryb2tlOiAncmdiYSgxNTMsIDEwMiwgMjU1LCAwLjUpJyB9LFxuICAgICAgeyBmaWxsOiAncmdiYSgyNTUsIDE1OSwgNjQsIDAuMSknLCBzdHJva2U6ICdyZ2JhKDI1NSwgMTU5LCA2NCwgMC41KScgfSxcbiAgICAgIHsgZmlsbDogJ3JnYmEoMTk5LCAxOTksIDE5OSwgMC4xKScsIHN0cm9rZTogJ3JnYmEoMTk5LCAxOTksIDE5OSwgMC41KScgfSxcbiAgICBdO1xuICAgIFxuICAgIC8vIEdyb3VwIHBvaW50cyBieSBjbHVzdGVyIElEIGZyb20gdGhlIHNlcnZlciByZXNwb25zZVxuICAgIGNvbnN0IGNsdXN0ZXJHcm91cHM6IHsgW2tleTogbnVtYmVyXTogVFNORVBvaW50W10gfSA9IHt9O1xuICAgIFxuICAgIGZvciAoY29uc3QgcG9pbnQgb2YgdGhpcy5yZXN1bHQucG9pbnRzKSB7XG4gICAgICBpZiAocG9pbnQuY2x1c3RlciA9PT0gLTEpIGNvbnRpbnVlOyAvLyBTa2lwIG5vaXNlIHBvaW50c1xuICAgICAgXG4gICAgICBpZiAoIWNsdXN0ZXJHcm91cHNbcG9pbnQuY2x1c3Rlcl0pIHtcbiAgICAgICAgY2x1c3Rlckdyb3Vwc1twb2ludC5jbHVzdGVyXSA9IFtdO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjbHVzdGVyR3JvdXBzW3BvaW50LmNsdXN0ZXJdLnB1c2gocG9pbnQpO1xuICAgIH1cbiAgICBcbiAgICAvLyBEcmF3IGVhY2ggY2x1c3RlclxuICAgIE9iamVjdC5lbnRyaWVzKGNsdXN0ZXJHcm91cHMpLmZvckVhY2goKFtjbHVzdGVySWQsIHBvaW50c10sIGluZGV4KSA9PiB7XG4gICAgICAvLyBGaW5kIHRoZSBjZW50cm9pZCBhbmQgYm91bmRzIG9mIHRoZSBjbHVzdGVyXG4gICAgICBsZXQgbWluWCA9IEluZmluaXR5LCBtaW5ZID0gSW5maW5pdHk7XG4gICAgICBsZXQgbWF4WCA9IC1JbmZpbml0eSwgbWF4WSA9IC1JbmZpbml0eTtcbiAgICAgIGxldCBzdW1YID0gMCwgc3VtWSA9IDA7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgcG9pbnQgb2YgcG9pbnRzKSB7XG4gICAgICAgIGNvbnN0IFtzY3JlZW5YLCBzY3JlZW5ZXSA9IHRoaXMud29ybGRUb1NjcmVlbihwb2ludC54LCBwb2ludC55KTtcbiAgICAgICAgbWluWCA9IE1hdGgubWluKG1pblgsIHNjcmVlblgpO1xuICAgICAgICBtaW5ZID0gTWF0aC5taW4obWluWSwgc2NyZWVuWSk7XG4gICAgICAgIG1heFggPSBNYXRoLm1heChtYXhYLCBzY3JlZW5YKTtcbiAgICAgICAgbWF4WSA9IE1hdGgubWF4KG1heFksIHNjcmVlblkpO1xuICAgICAgICBzdW1YICs9IHNjcmVlblg7XG4gICAgICAgIHN1bVkgKz0gc2NyZWVuWTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gQ2FsY3VsYXRlIGNlbnRyb2lkXG4gICAgICBjb25zdCBjZW50ZXJYID0gc3VtWCAvIHBvaW50cy5sZW5ndGg7XG4gICAgICBjb25zdCBjZW50ZXJZID0gc3VtWSAvIHBvaW50cy5sZW5ndGg7XG4gICAgICBcbiAgICAgIC8vIEFkZCBwYWRkaW5nXG4gICAgICBjb25zdCBwYWRkaW5nID0gMjA7XG4gICAgICBtaW5YIC09IHBhZGRpbmc7XG4gICAgICBtaW5ZIC09IHBhZGRpbmc7XG4gICAgICBtYXhYICs9IHBhZGRpbmc7XG4gICAgICBtYXhZICs9IHBhZGRpbmc7XG4gICAgICBcbiAgICAgIC8vIFVzZSBjb2xvciBmcm9tIHBhbGV0dGUgKGN5Y2xlIGlmIG1vcmUgY2x1c3RlcnMgdGhhbiBjb2xvcnMpXG4gICAgICBjb25zdCBjb2xvckluZGV4ID0gcGFyc2VJbnQoY2x1c3RlcklkKSAlIGNvbG9ycy5sZW5ndGg7XG4gICAgICBjb25zdCBjb2xvciA9IGNvbG9yc1tjb2xvckluZGV4XTtcbiAgICAgIFxuICAgICAgLy8gRHJhdyBhIHJvdW5kZWQgcmVjdGFuZ2xlIGFyb3VuZCB0aGUgY2x1c3RlclxuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gY29sb3IuZmlsbDtcbiAgICAgIHRoaXMuY3R4LnN0cm9rZVN0eWxlID0gY29sb3Iuc3Ryb2tlO1xuICAgICAgdGhpcy5jdHgubGluZVdpZHRoID0gMTtcbiAgICAgIFxuICAgICAgdGhpcy5yb3VuZFJlY3QoXG4gICAgICAgIG1pblgsIFxuICAgICAgICBtaW5ZLCBcbiAgICAgICAgbWF4WCAtIG1pblgsIFxuICAgICAgICBtYXhZIC0gbWluWSwgXG4gICAgICAgIDEwXG4gICAgICApO1xuICAgICAgXG4gICAgICB0aGlzLmN0eC5maWxsKCk7XG4gICAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICAgIFxuICAgICAgLy8gRHJhdyBjbHVzdGVyIGxhYmVsIHdpdGggdG9wIHRlcm1zIGlmIGF2YWlsYWJsZVxuICAgICAgaWYgKHRoaXMucmVzdWx0LmNsdXN0ZXJfdGVybXMgJiYgdGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtc1tjbHVzdGVySWRdKSB7XG4gICAgICAgIGNvbnN0IHRlcm1zID0gdGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtc1tjbHVzdGVySWRdXG4gICAgICAgICAgLnNsaWNlKDAsIDMpICAvLyBUYWtlIHRvcCAzIHRlcm1zXG4gICAgICAgICAgLm1hcCh0ID0+IHQudGVybSlcbiAgICAgICAgICAuam9pbignLCAnKTtcbiAgICAgICAgXG4gICAgICAgIC8vIERyYXcgYSBsYWJlbCB3aXRoIGNsdXN0ZXIgSUQgYW5kIHRvcCB0ZXJtc1xuICAgICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAndmFyKC0tdGV4dC1ub3JtYWwpJztcbiAgICAgICAgdGhpcy5jdHguZm9udCA9ICdib2xkIDEycHggdmFyKC0tZm9udC10ZXh0KSc7XG4gICAgICAgIHRoaXMuY3R4LnRleHRBbGlnbiA9ICdjZW50ZXInO1xuICAgICAgICB0aGlzLmN0eC5maWxsVGV4dChgQ2x1c3RlciAke2NsdXN0ZXJJZH06ICR7dGVybXN9YCwgY2VudGVyWCwgbWluWSAtIDUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIFxuICBwcml2YXRlIHJvdW5kUmVjdCh4OiBudW1iZXIsIHk6IG51bWJlciwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHJhZGl1czogbnVtYmVyKSB7XG4gICAgdGhpcy5jdHguYmVnaW5QYXRoKCk7XG4gICAgdGhpcy5jdHgubW92ZVRvKHggKyByYWRpdXMsIHkpO1xuICAgIHRoaXMuY3R4LmxpbmVUbyh4ICsgd2lkdGggLSByYWRpdXMsIHkpO1xuICAgIHRoaXMuY3R4LmFyY1RvKHggKyB3aWR0aCwgeSwgeCArIHdpZHRoLCB5ICsgcmFkaXVzLCByYWRpdXMpO1xuICAgIHRoaXMuY3R4LmxpbmVUbyh4ICsgd2lkdGgsIHkgKyBoZWlnaHQgLSByYWRpdXMpO1xuICAgIHRoaXMuY3R4LmFyY1RvKHggKyB3aWR0aCwgeSArIGhlaWdodCwgeCArIHdpZHRoIC0gcmFkaXVzLCB5ICsgaGVpZ2h0LCByYWRpdXMpO1xuICAgIHRoaXMuY3R4LmxpbmVUbyh4ICsgcmFkaXVzLCB5ICsgaGVpZ2h0KTtcbiAgICB0aGlzLmN0eC5hcmNUbyh4LCB5ICsgaGVpZ2h0LCB4LCB5ICsgaGVpZ2h0IC0gcmFkaXVzLCByYWRpdXMpO1xuICAgIHRoaXMuY3R4LmxpbmVUbyh4LCB5ICsgcmFkaXVzKTtcbiAgICB0aGlzLmN0eC5hcmNUbyh4LCB5LCB4ICsgcmFkaXVzLCB5LCByYWRpdXMpO1xuICAgIHRoaXMuY3R4LmNsb3NlUGF0aCgpO1xuICB9XG4gIFxuICBwcml2YXRlIGRyYXdQb2ludChwb2ludDogVFNORVBvaW50KSB7XG4gICAgY29uc3QgW3gsIHldID0gdGhpcy53b3JsZFRvU2NyZWVuKHBvaW50LngsIHBvaW50LnkpO1xuICAgIFxuICAgIC8vIENvbG9yIHBhbGV0dGUgZm9yIGNsdXN0ZXJzXG4gICAgY29uc3QgY2x1c3RlckNvbG9ycyA9IFtcbiAgICAgICdyZ2JhKDI1NSwgOTksIDEzMiwgMSknLCAgICAvLyByZWRcbiAgICAgICdyZ2JhKDU0LCAxNjIsIDIzNSwgMSknLCAgICAvLyBibHVlXG4gICAgICAncmdiYSgyNTUsIDIwNiwgODYsIDEpJywgICAgLy8geWVsbG93XG4gICAgICAncmdiYSg3NSwgMTkyLCAxOTIsIDEpJywgICAgLy8gZ3JlZW5cbiAgICAgICdyZ2JhKDE1MywgMTAyLCAyNTUsIDEpJywgICAvLyBwdXJwbGVcbiAgICAgICdyZ2JhKDI1NSwgMTU5LCA2NCwgMSknLCAgICAvLyBvcmFuZ2VcbiAgICAgICdyZ2JhKDE5OSwgMTk5LCAxOTksIDEpJywgICAvLyBncmV5XG4gICAgXTtcbiAgICBcbiAgICAvLyBEcmF3IGNpcmNsZVxuICAgIHRoaXMuY3R4LmJlZ2luUGF0aCgpO1xuICAgIHRoaXMuY3R4LmFyYyh4LCB5LCB0aGlzLnBvaW50UmFkaXVzLCAwLCBNYXRoLlBJICogMik7XG4gICAgXG4gICAgLy8gRGV0ZXJtaW5lIGNvbG9yIGJhc2VkIG9uIGhvdmVyIHN0YXRlIGFuZCBjbHVzdGVyXG4gICAgaWYgKHRoaXMuaG92ZXJlZFBvaW50ID09PSBwb2ludCkge1xuICAgICAgLy8gSG92ZXJlZCBwb2ludHMgYXJlIGFsd2F5cyBoaWdobGlnaHRlZCBpbiB0aGUgYWNjZW50IGNvbG9yXG4gICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAndmFyKC0taW50ZXJhY3RpdmUtYWNjZW50KSc7XG4gICAgfSBlbHNlIGlmIChwb2ludC5jbHVzdGVyID09PSAtMSkge1xuICAgICAgLy8gTm9pc2UgcG9pbnRzIChub3QgaW4gYSBjbHVzdGVyKSBhcmUgZ3JleVxuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3ZhcigtLXRleHQtbXV0ZWQpJztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUG9pbnRzIGluIGNsdXN0ZXJzIHVzZSB0aGUgY2x1c3RlciBjb2xvciBwYWxldHRlXG4gICAgICBjb25zdCBjb2xvckluZGV4ID0gcG9pbnQuY2x1c3RlciAlIGNsdXN0ZXJDb2xvcnMubGVuZ3RoO1xuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gY2x1c3RlckNvbG9yc1tjb2xvckluZGV4XTtcbiAgICB9XG4gICAgXG4gICAgdGhpcy5jdHguZmlsbCgpO1xuICAgIFxuICAgIC8vIEFkZCBib3JkZXIgdG8gcG9pbnRzXG4gICAgdGhpcy5jdHguc3Ryb2tlU3R5bGUgPSAndmFyKC0tYmFja2dyb3VuZC1wcmltYXJ5KSc7XG4gICAgdGhpcy5jdHgubGluZVdpZHRoID0gMTtcbiAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICBcbiAgICAvLyBEcmF3IHRpdGxlIGlmIG5vdCBob3ZlcmVkIChob3ZlcmVkIHNob3dzIGluIHRvb2x0aXApXG4gICAgaWYgKHRoaXMuaG92ZXJlZFBvaW50ICE9PSBwb2ludCkge1xuICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJ3ZhcigtLXRleHQtbm9ybWFsKSc7XG4gICAgICB0aGlzLmN0eC5mb250ID0gJzEycHggdmFyKC0tZm9udC10ZXh0KSc7XG4gICAgICB0aGlzLmN0eC50ZXh0QWxpZ24gPSAnY2VudGVyJztcbiAgICAgIHRoaXMuY3R4LmZpbGxUZXh0KHBvaW50LnRpdGxlLCB4LCB5IC0gdGhpcy5wb2ludFJhZGl1cyAtIDUpO1xuICAgIH1cbiAgfVxuICBcbiAgcHJpdmF0ZSBkcmF3VG9vbHRpcCgpIHtcbiAgICBpZiAoIXRoaXMuaG92ZXJlZFBvaW50IHx8ICF0aGlzLnJlc3VsdCkgcmV0dXJuO1xuICAgIFxuICAgIGNvbnN0IFt4LCB5XSA9IHRoaXMud29ybGRUb1NjcmVlbih0aGlzLmhvdmVyZWRQb2ludC54LCB0aGlzLmhvdmVyZWRQb2ludC55KTtcbiAgICBjb25zdCBwb2ludCA9IHRoaXMuaG92ZXJlZFBvaW50O1xuICAgIFxuICAgIC8vIFRvb2x0aXAgY29udGVudFxuICAgIGNvbnN0IHRpdGxlID0gcG9pbnQudGl0bGU7XG4gICAgY29uc3QgcGF0aCA9IHBvaW50LnBhdGg7XG4gICAgY29uc3QgdGVybXMgPSBwb2ludC50b3BfdGVybXMuam9pbignLCAnKTtcbiAgICBcbiAgICAvLyBGb3JtYXQgZGF0ZXMgaWYgYXZhaWxhYmxlXG4gICAgY29uc3QgZm9ybWF0RGF0ZSA9ICh0aW1lc3RhbXA/OiBudW1iZXIpID0+IHtcbiAgICAgIGlmICghdGltZXN0YW1wKSByZXR1cm4gJ1Vua25vd24nO1xuICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKHRpbWVzdGFtcCk7XG4gICAgICByZXR1cm4gZGF0ZS50b0xvY2FsZURhdGVTdHJpbmcoKSArICcgJyArIGRhdGUudG9Mb2NhbGVUaW1lU3RyaW5nKFtdLCB7IGhvdXI6ICcyLWRpZ2l0JywgbWludXRlOiAnMi1kaWdpdCcgfSk7XG4gICAgfTtcbiAgICBcbiAgICAvLyBHZXQgbWV0YWRhdGFcbiAgICBjb25zdCBtb2RpZmllZCA9IGZvcm1hdERhdGUocG9pbnQubXRpbWUpO1xuICAgIGNvbnN0IGNyZWF0ZWQgPSBmb3JtYXREYXRlKHBvaW50LmN0aW1lKTtcbiAgICBjb25zdCB3b3JkQ291bnQgPSBwb2ludC53b3JkQ291bnQgPyBgJHtwb2ludC53b3JkQ291bnR9IHdvcmRzYCA6ICdVbmtub3duJztcbiAgICBjb25zdCByZWFkaW5nVGltZSA9IHBvaW50LnJlYWRpbmdUaW1lID8gYH4ke3BvaW50LnJlYWRpbmdUaW1lfSBtaW4gcmVhZGAgOiAnJztcbiAgICBcbiAgICAvLyBGb3JtYXQgdGFnc1xuICAgIGNvbnN0IHRhZ3MgPSBwb2ludC50YWdzICYmIHBvaW50LnRhZ3MubGVuZ3RoID4gMCBcbiAgICAgID8gcG9pbnQudGFncy5tYXAodGFnID0+IGAjJHt0YWd9YCkuam9pbignICcpXG4gICAgICA6ICdObyB0YWdzJztcbiAgICBcbiAgICAvLyBGb3JtYXQgY29udGVudCBwcmV2aWV3XG4gICAgY29uc3QgcHJldmlldyA9IHBvaW50LmNvbnRlbnRQcmV2aWV3IHx8ICdObyBwcmV2aWV3IGF2YWlsYWJsZSc7XG4gICAgXG4gICAgLy8gR2V0IGRpc3RhbmNlIHRvIGNlbnRlclxuICAgIGNvbnN0IGRpc3RhbmNlSW5mbyA9IHBvaW50LmRpc3RhbmNlVG9DZW50ZXIgIT09IHVuZGVmaW5lZCAmJiBwb2ludC5jbHVzdGVyICE9PSAtMVxuICAgICAgPyBgRGlzdGFuY2UgdG8gY2VudGVyOiAke3BvaW50LmRpc3RhbmNlVG9DZW50ZXIudG9GaXhlZCgyKX1gXG4gICAgICA6ICcnO1xuICAgIFxuICAgIC8vIEdldCBjbHVzdGVyIGluZm9ybWF0aW9uXG4gICAgbGV0IGNsdXN0ZXJJbmZvID0gJ05vdCBjbHVzdGVyZWQnO1xuICAgIGlmIChwb2ludC5jbHVzdGVyICE9PSAtMSkge1xuICAgICAgY29uc3QgY2x1c3RlcklkID0gcG9pbnQuY2x1c3RlcjtcbiAgICAgIFxuICAgICAgLy8gR2V0IGNsdXN0ZXIgdGVybXMgaWYgYXZhaWxhYmxlXG4gICAgICBsZXQgY2x1c3RlclRlcm1zID0gJyc7XG4gICAgICBpZiAodGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtcyAmJiB0aGlzLnJlc3VsdC5jbHVzdGVyX3Rlcm1zW2NsdXN0ZXJJZF0pIHtcbiAgICAgICAgY2x1c3RlclRlcm1zID0gdGhpcy5yZXN1bHQuY2x1c3Rlcl90ZXJtc1tjbHVzdGVySWRdXG4gICAgICAgICAgLnNsaWNlKDAsIDMpIC8vIFRha2UgdG9wIDMgdGVybXNcbiAgICAgICAgICAubWFwKHQgPT4gdC50ZXJtKVxuICAgICAgICAgIC5qb2luKCcsICcpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjbHVzdGVySW5mbyA9IGBDbHVzdGVyICR7Y2x1c3RlcklkfTogJHtjbHVzdGVyVGVybXN9YDtcbiAgICB9XG4gICAgXG4gICAgLy8gRGVmaW5lIGFsbCB0b29sdGlwIHNlY3Rpb25zIC0gbW9yZSBjb21wYWN0IGxheW91dCB3aXRoIGdyb3VwaW5nXG4gICAgY29uc3Qgc2VjdGlvbnMgPSBbXG4gICAgICB7IFxuICAgICAgICBsYWJlbDogJ1RpdGxlJywgXG4gICAgICAgIHRleHQ6IHRpdGxlLCBcbiAgICAgICAgZm9udDogJ2JvbGQgMTRweCBzYW5zLXNlcmlmJyxcbiAgICAgICAgYWx3YXlzU2hvdzogdHJ1ZSAgLy8gQWx3YXlzIHNob3cgdGl0bGVcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGxhYmVsOiAnUGF0aCcsIFxuICAgICAgICB0ZXh0OiBwYXRoLCBcbiAgICAgICAgZm9udDogJ2l0YWxpYyAxMXB4IHNhbnMtc2VyaWYnLFxuICAgICAgICBza2lwSWZFbXB0eTogdHJ1ZVxuICAgICAgfSxcbiAgICAgIHsgXG4gICAgICAgIGxhYmVsOiAnS2V5d29yZHMnLCBcbiAgICAgICAgdGV4dDogdGVybXMsIFxuICAgICAgICBza2lwSWZFbXB0eTogdHJ1ZVxuICAgICAgfSxcbiAgICAgIHsgXG4gICAgICAgIGxhYmVsOiAnQ2x1c3RlcicsIFxuICAgICAgICB0ZXh0OiBjbHVzdGVySW5mbywgXG4gICAgICAgIHNraXBJZkVtcHR5OiB0cnVlXG4gICAgICB9LFxuICAgICAgLy8gQ29tYmluZSB0YWdzIGFuZCBzdGF0cyBpbnRvIG9uZSBsaW5lIGlmIGJvdGggZXhpc3RcbiAgICAgIHsgXG4gICAgICAgIGxhYmVsOiAnSW5mbycsIFxuICAgICAgICB0ZXh0OiBbXG4gICAgICAgICAgdGFncyAhPT0gJ05vIHRhZ3MnID8gdGFncyA6IG51bGwsXG4gICAgICAgICAgd29yZENvdW50ICYmIHJlYWRpbmdUaW1lID8gYCR7d29yZENvdW50fSAoJHtyZWFkaW5nVGltZX0pYCA6IHdvcmRDb3VudCB8fCAnJ1xuICAgICAgICBdLmZpbHRlcihCb29sZWFuKS5qb2luKCcg4oCiICcpLFxuICAgICAgICBza2lwSWZFbXB0eTogdHJ1ZVxuICAgICAgfSxcbiAgICAgIC8vIENvbWJpbmUgZGF0ZXMgaW50byBvbmUgbGluZSB0byBzYXZlIHNwYWNlXG4gICAgICB7IFxuICAgICAgICBsYWJlbDogJ0RhdGVzJywgXG4gICAgICAgIHRleHQ6IGBNb2RpZmllZDogJHttb2RpZmllZH0ke3BvaW50LmN0aW1lID8gYCDigKIgQ3JlYXRlZDogJHtjcmVhdGVkfWAgOiAnJ31gLFxuICAgICAgICBmb250OiAnMTFweCBzYW5zLXNlcmlmJyxcbiAgICAgICAgc2tpcElmRW1wdHk6IHBvaW50Lm10aW1lID09PSB1bmRlZmluZWRcbiAgICAgIH0sXG4gICAgICAvLyBDb250ZW50IHByZXZpZXcgaXMgc2hvd24gaW4gYSBkaXN0aW5jdCBzdHlsZVxuICAgICAgeyBcbiAgICAgICAgbGFiZWw6ICdQcmV2aWV3JywgXG4gICAgICAgIHRleHQ6IHByZXZpZXcsIFxuICAgICAgICBmb250OiAnaXRhbGljIDExcHggc2Fucy1zZXJpZicsXG4gICAgICAgIHNraXBJZkVtcHR5OiAhcG9pbnQuY29udGVudFByZXZpZXcgfHwgcG9pbnQuY29udGVudFByZXZpZXcubGVuZ3RoIDwgNVxuICAgICAgfSxcbiAgICAgIC8vIFNob3cgZGlzdGFuY2UgaW5mbyBvbmx5IGlmIGl0IGV4aXN0c1xuICAgICAgeyBcbiAgICAgICAgbGFiZWw6ICcnLCBcbiAgICAgICAgdGV4dDogZGlzdGFuY2VJbmZvLCBcbiAgICAgICAgZm9udDogJzEwcHggc2Fucy1zZXJpZicsXG4gICAgICAgIHNraXBJZkVtcHR5OiB0cnVlIFxuICAgICAgfVxuICAgIF07XG4gICAgXG4gICAgLy8gU2V0IHByb3BlciBmb250IGZvciBtZWFzdXJlbWVudHNcbiAgICB0aGlzLmN0eC5mb250ID0gJ2JvbGQgMTRweCBzYW5zLXNlcmlmJztcbiAgICBsZXQgdG9vbHRpcFdpZHRoID0gdGhpcy5jdHgubWVhc3VyZVRleHQodGl0bGUpLndpZHRoICsgMjA7IC8vIEFkZCBzb21lIHBhZGRpbmdcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgbWF4aW11bSB3aWR0aCBuZWVkZWRcbiAgICBzZWN0aW9ucy5mb3JFYWNoKHNlY3Rpb24gPT4ge1xuICAgICAgaWYgKHNlY3Rpb24uYWx3YXlzU2hvdyB8fCAoIXNlY3Rpb24uc2tpcElmRW1wdHkgfHwgc2VjdGlvbi50ZXh0KSkge1xuICAgICAgICB0aGlzLmN0eC5mb250ID0gc2VjdGlvbi5mb250IHx8ICcxMnB4IHNhbnMtc2VyaWYnO1xuICAgICAgICBjb25zdCB3aWR0aCA9IHRoaXMuY3R4Lm1lYXN1cmVUZXh0KFxuICAgICAgICAgIHNlY3Rpb24ubGFiZWwgPyBgJHtzZWN0aW9uLmxhYmVsfTogJHtzZWN0aW9uLnRleHR9YCA6IHNlY3Rpb24udGV4dFxuICAgICAgICApLndpZHRoICsgMjA7IC8vIEFkZCBwYWRkaW5nXG4gICAgICAgIHRvb2x0aXBXaWR0aCA9IE1hdGgubWF4KHRvb2x0aXBXaWR0aCwgd2lkdGgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIC8vIExpbWl0IHRvb2x0aXAgd2lkdGggdG8gYSByZWFzb25hYmxlIG1heGltdW0gKDgwJSBvZiBjYW52YXMgd2lkdGgpXG4gICAgdG9vbHRpcFdpZHRoID0gTWF0aC5taW4odG9vbHRpcFdpZHRoLCB0aGlzLndpZHRoICogMC44KTtcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgdG9vbHRpcCBoZWlnaHQgd2l0aCBtb3JlIGNvbXBhY3QgbGluZSBzcGFjaW5nXG4gICAgY29uc3QgbGluZUhlaWdodCA9IDE4OyAvLyBTbGlnaHRseSBzbWFsbGVyIGxpbmUgaGVpZ2h0XG4gICAgLy8gQ291bnQgaG93IG1hbnkgc2VjdGlvbnMgd2lsbCBiZSB2aXNpYmxlXG4gICAgY29uc3QgdmlzaWJsZVNlY3Rpb25zID0gc2VjdGlvbnMuZmlsdGVyKHMgPT4gXG4gICAgICBzLmFsd2F5c1Nob3cgfHwgKCFzLnNraXBJZkVtcHR5IHx8IHMudGV4dClcbiAgICApLmxlbmd0aDtcbiAgICBcbiAgICAvLyBNb3JlIGNvbXBhY3QgdG9vbHRpcCBoZWlnaHRcbiAgICBjb25zdCB0b29sdGlwSGVpZ2h0ID0gdmlzaWJsZVNlY3Rpb25zICogbGluZUhlaWdodCArIDEyOyAvLyBMZXNzIHBhZGRpbmdcbiAgICBcbiAgICAvLyBQb3NpdGlvbiB0b29sdGlwIC0gZW5zdXJlIGl0IHN0YXlzIGZ1bGx5IHZpc2libGUgd2l0aGluIHRoZSBjYW52YXNcbiAgICAvLyBJZiB0b29sdGlwIGlzIHRvbyB3aWRlLCBwb3NpdGlvbiBpdCB0byB0aGUgbGVmdCBvZiB0aGUgcG9pbnQgaW5zdGVhZCBvZiB0aGUgcmlnaHRcbiAgICBsZXQgdG9vbHRpcFggPSB4ICsgMTA7XG4gICAgaWYgKHRvb2x0aXBYICsgdG9vbHRpcFdpZHRoID4gdGhpcy53aWR0aCAtIDEwKSB7XG4gICAgICB0b29sdGlwWCA9IHggLSB0b29sdGlwV2lkdGggLSAxMDtcbiAgICB9XG4gICAgXG4gICAgLy8gSWYgdG9vbHRpcCBpcyBzdGlsbCBvdXQgb2YgYm91bmRzIChyYXJlIGNhc2Ugd2l0aCB2ZXJ5IHdpZGUgdG9vbHRpcHMpLCBjZW50ZXIgaXRcbiAgICBpZiAodG9vbHRpcFggPCAxMCkge1xuICAgICAgdG9vbHRpcFggPSBNYXRoLm1heCgxMCwgTWF0aC5taW4odGhpcy53aWR0aCAtIHRvb2x0aXBXaWR0aCAtIDEwLCB4IC0gdG9vbHRpcFdpZHRoLzIpKTtcbiAgICB9XG4gICAgXG4gICAgLy8gUG9zaXRpb24gdmVydGljYWxseSAtIHRyeSB0byBwbGFjZSBhYm92ZSB0aGUgcG9pbnQgaWYgaXQgd291bGQgZ28gb2ZmIGJvdHRvbVxuICAgIGxldCB0b29sdGlwWSA9IHkgKyAxMDtcbiAgICBpZiAodG9vbHRpcFkgKyB0b29sdGlwSGVpZ2h0ID4gdGhpcy5oZWlnaHQgLSAxMCkge1xuICAgICAgdG9vbHRpcFkgPSB5IC0gdG9vbHRpcEhlaWdodCAtIDEwO1xuICAgIH1cbiAgICBcbiAgICAvLyBJZiB0b29sdGlwIGlzIHN0aWxsIG91dCBvZiBib3VuZHMsIHBvc2l0aW9uIGl0IHRvIG1pbmltaXplIG92ZXJmbG93XG4gICAgaWYgKHRvb2x0aXBZIDwgMTApIHtcbiAgICAgIHRvb2x0aXBZID0gMTA7XG4gICAgfVxuICAgIFxuICAgIC8vIEZpbmFsIGNoZWNrIHRvIGVuc3VyZSB0b29sdGlwIGlzIGFzIHZpc2libGUgYXMgcG9zc2libGVcbiAgICB0b29sdGlwWCA9IE1hdGgubWF4KDEwLCBNYXRoLm1pbih0b29sdGlwWCwgdGhpcy53aWR0aCAtIHRvb2x0aXBXaWR0aCAtIDEwKSk7XG4gICAgdG9vbHRpcFkgPSBNYXRoLm1heCgxMCwgTWF0aC5taW4odG9vbHRpcFksIHRoaXMuaGVpZ2h0IC0gdG9vbHRpcEhlaWdodCAtIDEwKSk7XG4gICAgXG4gICAgLy8gRHJhdyB0b29sdGlwIGJhY2tncm91bmQgLSB1c2UgYSBuaWNlciBncmFkaWVudFxuICAgIGNvbnN0IGdyYWRpZW50ID0gdGhpcy5jdHguY3JlYXRlTGluZWFyR3JhZGllbnQodG9vbHRpcFgsIHRvb2x0aXBZLCB0b29sdGlwWCwgdG9vbHRpcFkgKyB0b29sdGlwSGVpZ2h0KTtcbiAgICBncmFkaWVudC5hZGRDb2xvclN0b3AoMCwgJ3JnYmEoMjU1LCAyNTUsIDI1NSwgMC45NSknKTtcbiAgICBncmFkaWVudC5hZGRDb2xvclN0b3AoMSwgJ3JnYmEoMjQ1LCAyNDUsIDI1MCwgMC45NSknKTtcbiAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSBncmFkaWVudDtcbiAgICB0aGlzLmN0eC5zdHJva2VTdHlsZSA9ICdyZ2JhKDE1MCwgMTUwLCAxNjAsIDAuOCknO1xuICAgIHRoaXMuY3R4LmxpbmVXaWR0aCA9IDE7XG4gICAgXG4gICAgdGhpcy5yb3VuZFJlY3QodG9vbHRpcFgsIHRvb2x0aXBZLCB0b29sdGlwV2lkdGgsIHRvb2x0aXBIZWlnaHQsIDUpO1xuICAgIHRoaXMuY3R4LmZpbGwoKTtcbiAgICB0aGlzLmN0eC5zdHJva2UoKTtcbiAgICBcbiAgICAvLyBEcmF3IHRvb2x0aXAgY29udGVudFxuICAgIHRoaXMuY3R4LnRleHRBbGlnbiA9ICdsZWZ0JztcbiAgICBcbiAgICAvLyBEcmF3IGVhY2ggc2VjdGlvblxuICAgIGxldCBjdXJyZW50WSA9IHRvb2x0aXBZICsgMTQ7XG4gICAgc2VjdGlvbnMuZm9yRWFjaChzZWN0aW9uID0+IHtcbiAgICAgIGlmICghc2VjdGlvbi5hbHdheXNTaG93ICYmIChzZWN0aW9uLnNraXBJZkVtcHR5ICYmICFzZWN0aW9uLnRleHQpKSByZXR1cm47XG4gICAgICBcbiAgICAgIHRoaXMuY3R4LmZvbnQgPSBzZWN0aW9uLmZvbnQgfHwgJzEycHggc2Fucy1zZXJpZic7XG4gICAgICBcbiAgICAgIC8vIFVzZSBkaWZmZXJlbnQgdGV4dCBjb2xvcnMgZm9yIGRpZmZlcmVudCBzZWN0aW9uc1xuICAgICAgaWYgKHNlY3Rpb24ubGFiZWwgPT09ICdUaXRsZScpIHtcbiAgICAgICAgdGhpcy5jdHguZmlsbFN0eWxlID0gJyMzMzMzMzMnOyAvLyBEYXJrIGdyYXkgZm9yIHRpdGxlXG4gICAgICB9IGVsc2UgaWYgKHNlY3Rpb24ubGFiZWwgPT09ICdQcmV2aWV3Jykge1xuICAgICAgICB0aGlzLmN0eC5maWxsU3R5bGUgPSAnIzY2NjY2Nic7IC8vIE1lZGl1bSBncmF5IGZvciBwcmV2aWV3XG4gICAgICB9IGVsc2UgaWYgKHNlY3Rpb24ubGFiZWwgPT09ICcnKSB7XG4gICAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICcjOTk5OTk5JzsgLy8gTGlnaHQgZ3JheSBmb3Igbm90ZXNcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICcjNDQ0NDQ0JzsgLy8gTm9ybWFsIHRleHQgY29sb3JcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgdGV4dCA9IHNlY3Rpb24ubGFiZWwgJiYgc2VjdGlvbi5sYWJlbCAhPT0gJ1RpdGxlJ1xuICAgICAgICA/IGAke3NlY3Rpb24ubGFiZWx9OiAke3NlY3Rpb24udGV4dH1gXG4gICAgICAgIDogc2VjdGlvbi50ZXh0O1xuICAgICAgXG4gICAgICAvLyBGb3IgbG9uZ2VyIHRleHQsIGhhbmRsZSB3cmFwcGluZ1xuICAgICAgaWYgKHRoaXMuY3R4Lm1lYXN1cmVUZXh0KHRleHQpLndpZHRoID4gdG9vbHRpcFdpZHRoIC0gMjApIHtcbiAgICAgICAgY29uc3Qgd29yZHMgPSB0ZXh0LnNwbGl0KCcgJyk7XG4gICAgICAgIGxldCBsaW5lID0gJyc7XG4gICAgICAgIFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHdvcmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgdGVzdExpbmUgPSBsaW5lICsgd29yZHNbaV0gKyAnICc7XG4gICAgICAgICAgY29uc3QgbWV0cmljcyA9IHRoaXMuY3R4Lm1lYXN1cmVUZXh0KHRlc3RMaW5lKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAobWV0cmljcy53aWR0aCA+IHRvb2x0aXBXaWR0aCAtIDIwICYmIGkgPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmN0eC5maWxsVGV4dChsaW5lLCB0b29sdGlwWCArIDEwLCBjdXJyZW50WSk7XG4gICAgICAgICAgICBsaW5lID0gd29yZHNbaV0gKyAnICc7XG4gICAgICAgICAgICBjdXJyZW50WSArPSBsaW5lSGVpZ2h0ICogMC44OyAvLyBTbWFsbGVyIHNwYWNpbmcgZm9yIHdyYXBwZWQgdGV4dFxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsaW5lID0gdGVzdExpbmU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICB0aGlzLmN0eC5maWxsVGV4dChsaW5lLCB0b29sdGlwWCArIDEwLCBjdXJyZW50WSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmN0eC5maWxsVGV4dCh0ZXh0LCB0b29sdGlwWCArIDEwLCBjdXJyZW50WSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGN1cnJlbnRZICs9IGxpbmVIZWlnaHQ7XG4gICAgfSk7XG4gIH1cbn1cblxuY2xhc3MgU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IFZpYmVCb3lQbHVnaW47XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogVmliZUJveVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3Qge2NvbnRhaW5lckVsfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcblxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHt0ZXh0OiAnVmliZSBCb2kgLSB0LVNORSBTZXR0aW5ncyd9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ1BlcnBsZXhpdHknKVxuICAgICAgLnNldERlc2MoJ0NvbnRyb2xzIHRoZSBiYWxhbmNlIGJldHdlZW4gbG9jYWwgYW5kIGdsb2JhbCBhc3BlY3RzIG9mIHRoZSBkYXRhIChyZWNvbW1lbmRlZDogNS01MCknKVxuICAgICAgLmFkZFNsaWRlcihzbGlkZXIgPT4gc2xpZGVyXG4gICAgICAgIC5zZXRMaW1pdHMoNSwgMTAwLCA1KVxuICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucGVycGxleGl0eSlcbiAgICAgICAgLnNldER5bmFtaWNUb29sdGlwKClcbiAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnBlcnBsZXhpdHkgPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSgnSXRlcmF0aW9ucycpXG4gICAgICAuc2V0RGVzYygnTnVtYmVyIG9mIGl0ZXJhdGlvbnMgdG8gcnVuIHRoZSBhbGdvcml0aG0nKVxuICAgICAgLmFkZFNsaWRlcihzbGlkZXIgPT4gc2xpZGVyXG4gICAgICAgIC5zZXRMaW1pdHMoMjUwLCAyMDAwLCAyNTApXG4gICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pdGVyYXRpb25zKVxuICAgICAgICAuc2V0RHluYW1pY1Rvb2x0aXAoKVxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaXRlcmF0aW9ucyA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KSk7XG4gICAgICAgIFxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoJ0Vwc2lsb24gKGxlYXJuaW5nIHJhdGUpJylcbiAgICAgIC5zZXREZXNjKCdDb250cm9scyB0aGUgc3BlZWQgb2Ygb3B0aW1pemF0aW9uJylcbiAgICAgIC5hZGRTbGlkZXIoc2xpZGVyID0+IHNsaWRlclxuICAgICAgICAuc2V0TGltaXRzKDEsIDEwMCwgMSlcbiAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmVwc2lsb24pXG4gICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5lcHNpbG9uID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pKTtcbiAgfVxufSJdLCJuYW1lcyI6WyJNb2RhbCIsIkJ1dHRvbkNvbXBvbmVudCIsIlRleHRBcmVhQ29tcG9uZW50IiwiVEZpbGUiLCJOb3RpY2UiLCJJdGVtVmlldyIsIlBsdWdpbiIsIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQW9HQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDdEcsUUFBUSxTQUFTLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEVBQUU7QUFDdEgsUUFBUSxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsVUFBVSxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDOUUsS0FBSyxDQUFDLENBQUM7QUFDUCxDQUFDO0FBNk1EO0FBQ3VCLE9BQU8sZUFBZSxLQUFLLFVBQVUsR0FBRyxlQUFlLEdBQUcsVUFBVSxLQUFL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Q0FBQyxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQy9CLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUssR0FBRyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzVELFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsTUFBTSxHQUFHLE1BQU0sQ0FBQyxDQUFDO1FBQ2hELElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEdBQUcsS0FBSyxHQUFHLE1BQU0sRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzlFLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7UUFDeEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEdBQUcsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzlELElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7QUFDL0IsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzVDLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxT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
