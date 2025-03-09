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
            "/generate_connection": "POST - Generate a description of the connection between two notes",
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

@app.route('/generate_connection', methods=['POST'])
def generate_connection():
    """
    Generate a description of the connection between two notes
    
    Expects a JSON payload with:
    {
        "source_note": {
            "title": "Source Note Title",
            "content": "Source note content...",
            "terms": ["term1", "term2", ...]
        },
        "target_note": {
            "title": "Target Note Title",
            "content": "Target note content...",
            "terms": ["term1", "term2", ...]
        },
        "common_terms": ["term1", "term2", ...],
        "cluster_terms": ["term1", "term2", ...]
    }
    """
    try:
        data = request.json
        logger.info(f"Received connection generation request for {data.get('source_note', {}).get('title')} and {data.get('target_note', {}).get('title')}")
        
        # Check if we have the required data
        if not data or 'source_note' not in data or 'target_note' not in data:
            return jsonify({"error": "Missing required data"}), 400
        
        # Try to generate a description using a locally running LLM server
        # This is the place where you'd connect to a real LLM API
        try:
            # Placeholder for actual LLM integration
            # This could be replaced with a call to an API like OpenAI or a local LLM server
            
            # Prepare a prompt for the LLM
            source_title = data['source_note']['title']
            source_content = data['source_note']['content'][:500]  # Truncate to 500 chars
            target_title = data['target_note']['title']
            target_content = data['target_note']['content'][:500]  # Truncate to 500 chars
            common_terms = ', '.join(data.get('common_terms', []))
            cluster_terms = ', '.join(data.get('cluster_terms', []))
            
            prompt = f"""
            I need to create a link between two notes in my knowledge base.
            
            Note 1: "{source_title}"
            Content snippet: {source_content}
            
            Note 2: "{target_title}"
            Content snippet: {target_content}
            
            These notes appear to be related because they share terms like: {common_terms}
            They're part of a cluster with these terms: {cluster_terms}
            
            Please write a brief (2-3 sentences) description explaining how these notes are conceptually related
            and why someone might want to link from Note 1 to Note 2. The description should be specific to the 
            content of these notes, not generic.
            """
            
            # For now, generate a simple template-based description
            # In a real implementation, this would call an LLM API
            description = generate_placeholder_description(source_title, target_title, common_terms, cluster_terms)
            
            return jsonify({"description": description})
            
        except Exception as e:
            logger.error(f"Error generating description with LLM: {str(e)}")
            return jsonify({"error": f"LLM service error: {str(e)}"}), 500
        
    except Exception as e:
        logger.error(f"Error processing connection generation request: {str(e)}")
        return jsonify({"error": str(e)}), 500


def generate_placeholder_description(source_title, target_title, common_terms, cluster_terms):
    """
    Generate a placeholder description based on the note data.
    This would be replaced with a real LLM call in production.
    """
    import random
    
    templates = [
        f"These notes share conceptual overlap around {common_terms or 'related topics'}. '{target_title}' expands on ideas found in '{source_title}', particularly regarding {cluster_terms or 'these concepts'}.",
        f"The note '{target_title}' provides valuable context that complements '{source_title}'. They both explore themes related to {common_terms or 'similar subjects'}.",
        f"While reading '{source_title}', you may want to reference '{target_title}' for additional perspectives on {cluster_terms or 'related ideas'}. They share a focus on {common_terms or 'connected topics'}.",
        f"'{source_title}' and '{target_title}' approach similar questions from different angles. Both discuss aspects of {common_terms or 'related concepts'}, making them natural companions.",
        f"To deepen your understanding of topics in '{source_title}', '{target_title}' offers complementary insights, especially regarding {common_terms or 'shared concepts'}."
    ]
    
    return random.choice(templates)


@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=1234, debug=True)