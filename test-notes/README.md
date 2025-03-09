# Test Notes for Vibe Boi

This directory contains a set of test notes that can be used to evaluate the Vibe Boi t-SNE visualization plugin for Obsidian. These notes cover different but related topics in technology, which should form visible clusters when processed by the plugin.

## Note Topics

The test notes cover the following areas:

### Programming and Development
- **Python Programming**: General Python language features and ecosystem
- **JavaScript Frameworks**: Overview of popular JavaScript frameworks
- **Web Development**: General web development concepts
- **React Native**: Mobile app development with React Native

### Data and AI
- **Machine Learning**: Overview of machine learning concepts
- **Deep Learning**: Neural networks and deep learning
- **Natural Language Processing**: NLP concepts and applications
- **Data Science**: Data science process, tools, and applications

### Database Systems
- **Database Systems**: Types, concepts, and applications of databases

## How to Use

1. Copy these markdown files to your Obsidian vault
2. Start the t-SNE Python server by running `./activate_server.sh` in the src/python/tsne directory
3. Open the Vibe Boi visualization panel in Obsidian
4. Run the analysis to see how these notes cluster together

## Expected Results

You should observe the following clusters:

1. **AI/ML Cluster**: Machine Learning, Deep Learning, Natural Language Processing
2. **Data Cluster**: Data Science, Database Systems
3. **Web Development Cluster**: Web Development, JavaScript Frameworks
4. **Programming Cluster**: Python Programming, React Native

Notes with overlapping topics (like Python Programming and Data Science) may appear between clusters, showing how t-SNE captures semantic relationships between content.

## Adding Your Own Notes

Feel free to add your own notes to see how they cluster with these test notes. Notes on similar topics should appear near each other in the visualization.