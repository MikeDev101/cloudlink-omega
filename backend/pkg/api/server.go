package server

import (
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	v0 "github.com/mikedev101/cloudlink-omega/backend/pkg/api/v0"
	dm "github.com/mikedev101/cloudlink-omega/backend/pkg/data"
)

func RunServer(port int, mgr *dm.Manager) error {
	r := chi.NewRouter()

	// Add logging and recovery middeware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// TODO: implement custom CORS middleware

	// Mount v0 route
	r.Mount("/api/v0", v0.Router)

	// Mount default route (v0)
	r.Mount("/api", v0.Router)

	// Serve root router
	log.Printf("Serving HTTP server on :%d", port)
	err := http.ListenAndServe(":"+fmt.Sprint(port), r)
	return err
}
