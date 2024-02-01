package routes

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/mikedev101/cloudlink-omega/backend/pkg/accounts"
	dm "github.com/mikedev101/cloudlink-omega/backend/pkg/data"
	"github.com/mikedev101/cloudlink-omega/backend/pkg/structs"
)

func RootRouter(r chi.Router) {
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		dm := r.Context().Value("dm").(*dm.Manager)
		w.Write([]byte("Hello, World!"))
		fmt.Printf("Users: %v\n", dm.FindAllUsers()) // DEVELOPMENT ONLY - REMOVE IN PRODUCTION
	})

	r.Post("/register", func(w http.ResponseWriter, r *http.Request) {
		dm := r.Context().Value("dm").(*dm.Manager)

		// Load request body as JSON into User struct
		var u structs.User
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// Hash password
		u.Password = accounts.HashPassword(u.Password)

		// Register user
		res := dm.RegisterUser(&u)

		_, err := res.RowsAffected()
		if err != nil {
			w.Write([]byte(err.Error()))
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		fmt.Printf("Registered user %s\n", u.Username)

		// Scan output
		w.WriteHeader(http.StatusOK)
	})
}
