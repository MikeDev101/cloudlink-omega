package server

import (
	"context"
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

	// Init DB
	mgr.InitDB()

	// Add logging and recovery middeware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// TODO: implement custom CORS middleware

	// Mount middleware to pass data manager into requests
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			ctx = context.WithValue(ctx, "dm", mgr)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	})

	// Mount v0 route
	r.Mount("/api/v0", v0.Router)

	// Mount default route (v0)
	r.Mount("/api", v0.Router)

	// Serve root router
	log.Printf("Serving HTTP server on localhost:%d", port)
	err := http.ListenAndServe("localhost:"+fmt.Sprint(port), r)
	return err
}
