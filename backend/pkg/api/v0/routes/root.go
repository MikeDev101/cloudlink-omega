package routes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

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

	r.Post("/login", func(w http.ResponseWriter, r *http.Request) {
		dm := r.Context().Value("dm").(*dm.Manager)

		// Load request body as JSON into User struct
		var u structs.User
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		var hash string

		// Verify hash
		if res, err := dm.GetUserPasswordHash(u.Username); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		} else {
			if res.Next() {
				if err := res.Scan(&hash); err != nil {
					w.WriteHeader(http.StatusInternalServerError)
					return
				}
			} else {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
		}

		if err := accounts.VerifyPassword(u.Password, hash); err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		// TODO: Generate session token
		w.Write([]byte("Login successful"))
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
		res, err := dm.RegisterUser(&u)

		if err != nil {
			if strings.Contains(err.Error(), "Duplicate entry") {
				w.WriteHeader(http.StatusConflict)
				if strings.Contains(err.Error(), "username") {
					w.Write([]byte("Username already exists"))
				} else if strings.Contains(err.Error(), "email") {
					w.Write([]byte("Email already in use"))
				} else if strings.Contains(err.Error(), "gamertag") {
					w.Write([]byte("Gamertag already in use"))
				}
			}
			return
		}

		rows, _ := res.RowsAffected()
		fmt.Printf("Registered user %s (%d row(s) affected)\n", u.Username, rows)

		// Scan output
		w.WriteHeader(http.StatusCreated)
	})
}
