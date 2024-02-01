package v0

import (
	"github.com/go-chi/chi/v5"
	routes "github.com/mikedev101/cloudlink-omega/backend/pkg/api/v0/routes"
	dm "github.com/mikedev101/cloudlink-omega/backend/pkg/data"
)

// Create chi router
var Router = chi.NewRouter()

// Passthrough for data manager
var DataManager *dm.Manager

func init() {
	// Mount routes
	Router.Route("/", routes.RootRouter)
	Router.Route("/signaling", routes.SignalingRouter)
}
