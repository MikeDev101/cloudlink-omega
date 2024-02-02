package routes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"

	accounts "github.com/mikedev101/cloudlink-omega/backend/pkg/accounts"
	dm "github.com/mikedev101/cloudlink-omega/backend/pkg/data"
	errors "github.com/mikedev101/cloudlink-omega/backend/pkg/errors"
	structs "github.com/mikedev101/cloudlink-omega/backend/pkg/structs"
)

var validate = validator.New(validator.WithRequiredStructEnabled())

func RootRouter(r chi.Router) {
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		dm := r.Context().Value("dm").(*dm.Manager)
		w.Write([]byte("Hello, World!"))
		fmt.Printf("Users: %v\n", dm.FindAllUsers()) // DEVELOPMENT ONLY - REMOVE IN PRODUCTION
	})

	r.Post("/login", func(w http.ResponseWriter, r *http.Request) {
		dm := r.Context().Value("dm").(*dm.Manager)

		// Load request body as JSON into login struct
		var u structs.Login
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// Validate login struct
		err := validate.Struct(u)

		if err != nil && len(err.(validator.ValidationErrors)) > 0 {
			// Create error message
			msg := "Validation failed:\n"
			for _, err := range err.(validator.ValidationErrors) {
				msg += fmt.Sprintf("%s: %s\n", err.Field(), err.Tag())
			}

			// Write error message to response
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(msg))
			return
		}

		// Define vars
		var hash string
		var userid string
		var usertoken string

		// Grab user's password hash
		if res, err := dm.GetUserPasswordHash(u.Email); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(err.Error()))
			return
		} else {
			hash = res
		}

		// Verify the hash matches the provided password
		if err := accounts.VerifyPassword(u.Password, hash); err != nil {
			// Incorrect password
			if strings.Contains(err.Error(), "does not match") {
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte("Incorrect password"))
				return
			}
			// Something else went wrong
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("Something went wrong while verifying your login credentials. Please try again."))
			return
		}

		// Grab user ID from email
		if res, err := dm.GetUserID(u.Email); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(err.Error()))
			return
		} else {
			userid = res
		}

		// Generate session token
		if res, err := dm.GenerateSessionToken(userid, r.RemoteAddr); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(err.Error()))
			return
		} else {
			usertoken = res
		}

		// Write response to client with the session token
		w.Write([]byte(usertoken))
	})

	r.Post("/register", func(w http.ResponseWriter, r *http.Request) {
		dm := r.Context().Value("dm").(*dm.Manager)

		// Load request body as JSON into register struct
		var u structs.Register
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// Validate register struct
		err := validate.Struct(u)

		if err != nil && len(err.(validator.ValidationErrors)) > 0 {
			// Create error message
			msg := "Validation failed:\n"
			for _, err := range err.(validator.ValidationErrors) {
				msg += fmt.Sprintf("%s: %s\n", err.Field(), err.Tag())
			}

			// Write error message to response
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(msg))
			return
		}

		// Hash password
		u.Password = accounts.HashPassword(u.Password)

		// Register user
		res, err := dm.RegisterUser(&u)

		if err != nil {
			switch err {
			case errors.ErrUsernameInUse:
				w.WriteHeader(http.StatusConflict)
			case errors.ErrEmailInUse:
				w.WriteHeader(http.StatusConflict)
			case errors.ErrGamertagInUse:
				w.WriteHeader(http.StatusConflict)
			default:
				w.WriteHeader(http.StatusInternalServerError)
			}
			w.Write([]byte(err.Error()))
			return
		}

		if !res {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("something went wrong while registering your account. please try again later"))
			return
		}

		fmt.Printf("Registered user %s\n", u.Username)

		// Scan output
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte("OK"))
	})
}
