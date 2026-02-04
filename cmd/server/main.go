package main

import (
	"encoding/json"
	"fmt"
	"log"
	"md-cover-creator/internal/musicbrainz"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Serve static files from the frontend build directory
	fs := http.FileServer(http.Dir("./web/dist"))
	http.Handle("/", fs)

	// API endpoints
	mbClient := musicbrainz.NewClient()

	http.HandleFunc("/api/search", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query().Get("q")
		if query == "" {
			http.Error(w, "missing query parameter 'q'", http.StatusBadRequest)
			return
		}

		results, err := mbClient.SearchReleases(query)
		if err != nil {
			log.Printf("Search error: %v", err)
			http.Error(w, "search failed", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(results)
	})

	http.HandleFunc("/api/release/", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Path[len("/api/release/"):]
		if id == "" {
			http.Error(w, "missing release id", http.StatusBadRequest)
			return
		}

		result, err := mbClient.GetRelease(id)
		if err != nil {
			log.Printf("GetRelease error: %v", err)
			http.Error(w, "failed to get release", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})

	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	fmt.Printf("Server starting on port %s...\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
