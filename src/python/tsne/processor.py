import numpy as np
from sklearn.manifold import TSNE
from sklearn.feature_extraction.text import TfidfVectorizer
import json
import os
from typing import List, Dict, Any

class NoteProcessor:
    def __init__(self, perplexity: int = 30, iterations: int = 1000, learning_rate: float = 200.0):
        self.perplexity = perplexity
        self.iterations = iterations
        self.learning_rate = learning_rate
        self.vectorizer = TfidfVectorizer(
            max_features=100,  # Limit features to prevent dimensionality issues
            stop_words='english',
            ngram_range=(1, 2)  # Use both unigrams and bigrams
        )
        
    def process_notes(self, notes: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Process a list of notes and return t-SNE coordinates
        
        Args:
            notes: List of note dictionaries with 'path', 'content', and 'title' keys
            
        Returns:
            Dictionary with t-SNE results including coordinates and metadata
        """
        if len(notes) < 5:
            raise ValueError("Need at least 5 notes to perform meaningful t-SNE")
            
        # Extract content for vectorization
        contents = [note['content'] for note in notes]
        
        # Vectorize the text content
        X = self.vectorizer.fit_transform(contents)
        
        # Get feature names for later analysis
        feature_names = self.vectorizer.get_feature_names_out()
        
        # Run t-SNE
        tsne = TSNE(
            n_components=2,
            perplexity=min(self.perplexity, len(notes) - 1),  # Adjust perplexity if too few notes
            n_iter=self.iterations,
            learning_rate=self.learning_rate,
            random_state=42
        )
        
        X_tsne = tsne.fit_transform(X.toarray())
        
        # Find clusters using a simple distance-based approach
        from sklearn.cluster import DBSCAN
        
        # Use DBSCAN for clustering (automatically determines number of clusters)
        clustering = DBSCAN(eps=0.5, min_samples=2).fit(X_tsne)
        cluster_labels = clustering.labels_
        
        # Count clusters (excluding noise points labeled as -1)
        n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
        
        # Prepare results
        result = {
            "points": [],
            "feature_names": feature_names.tolist(),
            "clusters": n_clusters
        }
        
        # Determine top terms for each cluster
        cluster_terms = {}
        for cluster_id in set(cluster_labels):
            if cluster_id != -1:  # Skip noise points
                # Get all points in this cluster
                cluster_indices = np.where(cluster_labels == cluster_id)[0]
                
                # Aggregate TF-IDF scores for this cluster
                cluster_vectors = X[cluster_indices].toarray()
                cluster_sum = np.sum(cluster_vectors, axis=0)
                
                # Get top terms for this cluster
                top_indices = np.argsort(cluster_sum)[-10:]  # Top 10 terms
                cluster_terms[int(cluster_id)] = [
                    {
                        "term": feature_names[idx],
                        "score": float(cluster_sum[idx])
                    } 
                    for idx in top_indices if cluster_sum[idx] > 0
                ]
        
        # Extract top terms for each note
        for i, note in enumerate(notes):
            # Get top terms for this note
            feature_importance = X[i].toarray()[0]
            top_indices = np.argsort(feature_importance)[-5:]  # Top 5 terms
            top_terms = [feature_names[idx] for idx in top_indices if feature_importance[idx] > 0]
            
            # Get cluster ID (or -1 if noise)
            cluster_id = int(cluster_labels[i])
            
            # Add to results
            result["points"].append({
                "x": float(X_tsne[i, 0]),
                "y": float(X_tsne[i, 1]),
                "title": note['title'],
                "path": note['path'],
                "top_terms": top_terms,
                "cluster": cluster_id
            })
        
        # Add cluster information to results
        result["cluster_terms"] = cluster_terms
        
        return result

def main():
    """Simple demo function"""
    # Create some test notes
    test_notes = [
        {"path": "note1.md", "title": "Machine Learning", 
         "content": "Machine learning is a subset of artificial intelligence that focuses on data."},
        {"path": "note2.md", "title": "Deep Learning", 
         "content": "Deep learning uses neural networks with many layers to learn from data."},
        {"path": "note3.md", "title": "Python Programming", 
         "content": "Python is a popular programming language used for data science and web development."},
        {"path": "note4.md", "title": "JavaScript", 
         "content": "JavaScript is used for web development and creating interactive websites."},
        {"path": "note5.md", "title": "Data Science", 
         "content": "Data science combines statistics, programming, and domain knowledge."},
        {"path": "note6.md", "title": "Web Development", 
         "content": "Web development includes frontend and backend programming for websites."},
        {"path": "note7.md", "title": "Neural Networks", 
         "content": "Neural networks are inspired by the human brain and use neurons for learning."},
        {"path": "note8.md", "title": "Frontend Development", 
         "content": "Frontend development uses HTML, CSS, and JavaScript to create user interfaces."},
        {"path": "note9.md", "title": "Backend Development", 
         "content": "Backend development focuses on servers, databases, and application logic."},
        {"path": "note10.md", "title": "Natural Language Processing", 
         "content": "NLP allows computers to understand and generate human language."},
    ]
    
    processor = NoteProcessor()
    result = processor.process_notes(test_notes)
    
    print(json.dumps(result, indent=2))
    
if __name__ == "__main__":
    main()