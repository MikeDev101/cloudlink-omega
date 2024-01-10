package clomega

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	db "clomega/pkg/db"
	passwords "clomega/pkg/passwords"

	log "github.com/charmbracelet/log"
	scrypt "github.com/elithrar/simple-scrypt"
	_ "github.com/go-sql-driver/mysql"

	structs "clomega/internal/structs"
)

// Create a config structure for the server, providing public variable configurations for the params and the database.
type Config struct {
	ScryptParams scrypt.Params
	Database     *sql.DB
}

// CreateUserHandler handles the creation of a new user.
func (s Config) CreateUserHandler(w http.ResponseWriter, r *http.Request) {
	// Require this endpoint to only accept POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed: See documentation.", http.StatusMethodNotAllowed)
		return
	}

	// Decode the request body into the user struct
	var user structs.User
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		http.Error(w, "Invalid JSON: See documentation.", http.StatusBadRequest)
		return
	}

	// Check for empty fields
	log.Debug("Checking for empty fields...")
	var missingArgs []string

	if user.Username == "" {
		log.Debug("Username argument not provided!")
		missingArgs = append(missingArgs, "username")
	}
	if user.Password == "" {
		log.Debug("Password argument not provided!")
		missingArgs = append(missingArgs, "password")
	}
	if user.Gamertag == "" {
		log.Debug("Gamertag argument not provided!")
		missingArgs = append(missingArgs, "gamertag")
	}
	if user.Email == "" {
		log.Debug("Email argument not provided!")
		missingArgs = append(missingArgs, "email")
	}

	if len(missingArgs) > 0 {
		missingArgsStr := strings.Join(missingArgs, ", ")
		http.Error(w, "Incomplete JSON: "+missingArgsStr+". See documentation.", http.StatusBadRequest)
		return
	}

	// Create the user (intentionally force hashing a password before checking, even if the username is taken or email is in use.
	// This is to slow down brute force attacks and prevent registration spamming.)
	hash := passwords.HashPassword(user.Password, s.ScryptParams)

	result, err := db.CreateUser(s.Database, user.Username, hash, user.Gamertag, user.Email)
	if err != nil {
		s.internalErrorHandler(w, r, result, err)
		return
	}

	fmt.Fprint(w, result)
}

// CreateSessionHandler handles the creation of a session.
func (s Config) CreateSessionHandler(w http.ResponseWriter, r *http.Request) {
	// Require this endpoint to only accept POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed: See documentation.", http.StatusMethodNotAllowed)
		return
	}

	// Decode the request body into the login struct
	var login structs.Login
	if err := json.NewDecoder(r.Body).Decode(&login); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Check for empty fields
	if login.Username == "" || login.Password == "" {
		http.Error(w, "No arguments may be empty: See documentation.", http.StatusBadRequest)
		return
	}

	// Get the user's ULID
	ulid, err := db.GetUserULID(s.Database, login.Username)
	if err != nil {
		s.internalErrorHandler(w, r, ulid, err)
		return
	}

	// Retrieve the user's hashed password
	hashedPassword, err := db.GetUserPassword(s.Database, ulid)
	if err != nil {
		s.internalErrorHandler(w, r, hashedPassword, err)
		return
	}

	// Verify the password
	err = passwords.VerifyPassword(login.Password, hashedPassword)
	if err != nil {
		http.Error(w, "Invalid password.", http.StatusUnauthorized)
		return
	}

	// Create the session
	sessionToken, err := db.CreateSession(s.Database, ulid, r.RemoteAddr)
	if err != nil {
		s.internalErrorHandler(w, r, hashedPassword, err)
		return
	}

	// Return the ULID session token
	w.Write([]byte(sessionToken))
}

// internalErrorHandler handles internal errors in OmegaServer.
//
// It takes an http.ResponseWriter, an http.Request, a result string, and an error as parameters.
// It returns an error.
func (s Config) internalErrorHandler(w http.ResponseWriter, r *http.Request, result string, err error) error {
	switch err {
	case db.ErrUserExists, db.ErrEmailInUse, db.ErrUsernameInUse:
		w.WriteHeader(http.StatusConflict)
		_, err := w.Write([]byte(result))
		return err
	case db.ErrSessionNotFound, db.ErrUserNotFound:
		w.WriteHeader(http.StatusNotFound)
		_, err := w.Write([]byte(result))
		return err
	case db.ErrDatabaseError:
		w.WriteHeader(http.StatusInternalServerError)
		_, err := w.Write([]byte(result))
		return err
	default:
		w.WriteHeader(http.StatusInternalServerError)
		_, err := w.Write([]byte("Internal server error."))
		return err
	}
}
