from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import logging
from processor import NoteProcessor

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create a processor instance
processor = NoteProcessor()

@app.route('/', methods=['GET'])
def index():
    """Root endpoint that provides basic info about the API"""
    return jsonify({
        "info": "Note Processing API",
        "endpoints": {
            "/process": "POST - Process notes and return t-SNE results",
            "/health": "GET - Health check endpoint"
        }
    })

@app.route('/process', methods=['POST'])
def process_notes():
    """
    Process notes and return t-SNE results
    
    Expects a JSON payload with:
    {
        "notes": [
            {
                "path": "path/to/note.md",
                "title": "Note Title",
                "content": "Note content..."
            },
            ...
        ],
        "settings": {
            "perplexity": 30,
            "iterations": 1000,
            "learning_rate": 200.0
        }
    }
    """
    try:
        data = request.json
        logger.info(f"Received request with {len(data.get('notes', []))} notes")
        
        # Update processor settings if provided
        settings = data.get('settings', {})
        processor.perplexity = settings.get('perplexity', processor.perplexity)
        processor.iterations = settings.get('iterations', processor.iterations)
        processor.learning_rate = settings.get('learning_rate', processor.learning_rate)
        
        # Process the notes
        result = processor.process_notes(data['notes'])
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error processing notes: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=1234, debug=True)