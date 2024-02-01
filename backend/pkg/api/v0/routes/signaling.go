package routes

import (
	"github.com/go-chi/chi/v5"
	signaling "github.com/mikedev101/cloudlink-omega/backend/pkg/signaling"
)

func SignalingRouter(r chi.Router) {
	r.Get("/", signaling.SignalingHandler)
}
