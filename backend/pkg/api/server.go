package server

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	v0 "github.com/mikedev101/cloudlink-omega/backend/pkg/api/v0"
	constants "github.com/mikedev101/cloudlink-omega/backend/pkg/constants"
	dm "github.com/mikedev101/cloudlink-omega/backend/pkg/data"
)

func RunServer(host string, port int, mgr *dm.Manager) error {
	if mgr == nil {
		log.Fatal("[Server] Got a null data manager. This should never happen, but if you see this message it happened anyways. Aborting...")
	}

	// Thoust shall shoot the core!
	log.Printf("[Server] CLΩ Server v%s - Presented by @MikeDEV. Warming up now...", constants.Version)

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
			ctx = context.WithValue(ctx, constants.DataMgrCtx, mgr)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	})

	// Mount v0 route
	r.Mount("/api/v0", v0.Router)

	// Mount default route (v0)
	r.Mount("/api", v0.Router)

	// Serve root router
	log.Printf("[Server] Listening to %s:%d - Go play some games!", host, port)
	err := http.ListenAndServe(fmt.Sprintf("%s:%d", host, port), r)
	return err
}
