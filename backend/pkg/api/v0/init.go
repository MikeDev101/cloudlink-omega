package v0

import (
	"github.com/go-chi/chi/v5"
	"github.com/mikedev101/cloudlink-omega/backend/pkg/api/v0/routes"
)

// Create chi router
var Router = chi.NewRouter()

func init() {
	Router.Route("/", routes.RootRouter)
}
