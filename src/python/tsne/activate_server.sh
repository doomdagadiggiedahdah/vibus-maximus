#!/bin/bash

# Script to start the t-SNE server

# Determine the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_DIR="$SCRIPT_DIR/venv"

# Check if virtual environment exists
if [ ! -d "$VENV_DIR" ]; then
    echo "Virtual environment not found. Please run setup.sh first."
    exit 1
fi

# Activate the virtual environment
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Start the server
echo "Starting t-SNE server on http://127.0.0.1:5678..."
echo "Press Ctrl+C to stop the server."
python "$SCRIPT_DIR/server.py"