# Vibe Boi - t-SNE Note Visualization for Obsidian

This plugin creates interactive t-SNE visualizations of your Obsidian notes, generating clusters based on content similarity. It helps you discover connections and patterns in your notes that might not be immediately obvious.

## Features

- Interactive t-SNE visualization of your notes
- Automatic clustering of similar notes
- Color-coded clusters with top terms for each cluster
- Interactive interface with zooming, panning, and tooltips
- Customizable t-SNE parameters (perplexity, iterations)

## Installation

### Prerequisites

- Obsidian v0.15.0 or higher
- Node.js and npm for building the plugin
- Python 3.7+ for running the t-SNE server

### Setup

1. **Clone this repository**:
   ```bash
   git clone https://github.com/yourusername/vibe-boi.git
   cd vibe-boi
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Build the plugin**:
   ```bash
   npm run build
   ```

4. **Set up the Python environment**:
   ```bash
   cd src/python/tsne
   ./setup.sh
   ```

## Usage

### Starting the t-SNE Server

The plugin requires a Python server to perform the t-SNE analysis. Start the server before using the plugin:

```bash
cd src/python/tsne
./activate_server.sh
```

The server will run at http://127.0.0.1:5678.

### Using the Plugin in Obsidian

1. Install the plugin in Obsidian by copying the built files to your Obsidian plugins folder or using the "Load plugin from disk" option.

2. Enable the plugin in Obsidian settings.

3. Open the visualization:
   - Use the command palette (Ctrl/Cmd+P) and search for "Open t-SNE Visualization"
   - Or use the ribbon icon

4. Click the "Run Analysis" button to process your notes and generate the visualization.

5. Interact with the visualization:
   - Hover over points to see note information
   - Click on points to open notes
   - Scroll to zoom in/out
   - Drag to pan the view

### Configuration

You can configure the t-SNE parameters in the plugin settings:

- **Perplexity**: Controls the balance between local and global aspects of the data (recommended: 5-50)
- **Iterations**: Number of iterations to run the algorithm (more = better quality but slower)
- **Epsilon (learning rate)**: Controls the speed of optimization

## How It Works

1. The plugin collects your Obsidian notes
2. Notes are sent to the Python server for processing
3. The server converts note content to numerical vectors using TF-IDF
4. t-SNE algorithm reduces these high-dimensional vectors to 2D coordinates
5. DBSCAN clustering identifies groups of similar notes
6. The visualization displays the notes as an interactive plot

## Development

### Project Structure

- `src/obsidian-plugin/`: Obsidian plugin code (TypeScript)
  - `main.ts`: Plugin main file
  - `visualization.ts`: t-SNE visualization component

- `src/python/tsne/`: Python server for t-SNE processing
  - `server.py`: Flask server
  - `processor.py`: t-SNE and clustering implementation

### Building

```bash
npm run build
```

### Debugging

Check the developer console in Obsidian (Ctrl+Shift+I) for plugin logs.

For Python server logs, monitor the terminal where you started the server.

## License

[MIT License](LICENSE)