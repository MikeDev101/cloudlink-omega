package db

import (
	"database/sql"
	"errors"
	"strings"

	log "github.com/charmbracelet/log"
	_ "github.com/go-sql-driver/mysql"
)

// Create custom errors
var ErrUserNotFound = errors.New("user not found")
var ErrUserExists = errors.New("user already exists")
var ErrSessionNotFound = errors.New("session not found")
var ErrEmailInUse = errors.New("email in use")
var ErrUsernameInUse = errors.New("username taken")
var ErrDatabaseError = errors.New("database error")

// CreateUser creates a new user with the provided username, hash, gamertag, and email.
//
// Parameters:
// - db (*sql.DB): The database connection object.
// - username (string): the username of the user
// - hash (string): the hashed password of the user
// - gamertag (string): the gamertag of the user
// - email (string): the email address of the user
//
// Returns:
// - result (string): the result of the createUser operation, or an error message if the operation failed.
// - err (error): an error object if any error occurred during the operation. Returns nil if no error occurred.
func CreateUser(db *sql.DB, username, hash, gamertag, email string) (result string, err error) {
	var stmt *sql.Stmt
	stmt, err = db.Prepare("SELECT createUser(?, ?, ?, ?)")
	if err != nil {
		log.Fatalf("Failed to prepare statement: %s", err)
		return "", ErrDatabaseError
	}

	err = stmt.QueryRow(username, hash, gamertag, email).Scan(&result)
	if err != nil {
		errMsg := err.Error()
		splitError := strings.SplitN(errMsg, ":", 2)
		if len(splitError) > 1 {
			errMsg = splitError[1]
		}

		if strings.Contains(errMsg, "USERNAME_TAKEN") {
			log.Errorf("User with username %s already exists", username)
			return errMsg, ErrUsernameInUse
		}
		if strings.Contains(errMsg, "EMAIL_IN_USE") {
			log.Errorf("User with email %s already exists", email)
			return errMsg, ErrEmailInUse
		}
		log.Errorf("Failed to create user: %s", err)
		return errMsg, ErrDatabaseError
	}
	log.Debugf("Created user with username %s", username)
	return result, nil
}

// CreateSession creates a session with the given ULID and origin.
//
// Parameters:
// - db (*sql.DB): The database connection object.
// - ulid (string): The unique identifier for the session.
// - origin (string): The origin of the session (IP address).
//
// Returns:
// - result (string): A session ULID token, or an error message if the session creation fails.
// - err (error): Any error that occurred during the session creation, or nil if no error occurred.
func CreateSession(db *sql.DB, ulid string, origin string) (result string, err error) {
	var stmt *sql.Stmt
	stmt, err = db.Prepare("CALL createSession(?, ?)")
	if err != nil {
		return "", ErrDatabaseError
	}

	err = stmt.QueryRow(
		ulid,
		origin,
	).Scan(&result)

	if err != nil {
		errMsg := err.Error()
		splitError := strings.SplitN(errMsg, ":", 2)
		if len(splitError) > 1 {
			errMsg = splitError[1]
		}

		if strings.Contains(errMsg, "USER_NOTFOUND") {
			return errMsg, ErrUserNotFound
		}
		return errMsg, ErrDatabaseError
	}

	return result, nil
}

// GetUserULID retrieves the ULID of a user based on their username.
//
// Parameters:
// - db (*sql.DB): The database connection object.
// - username (string): the username of the user.
//
// Returns:
// - result (string): the ULID of the user, or an error message if the user is not found.
// - err (error): an error that occurred during the execution of the function, or nil if no error occurred.
func GetUserULID(db *sql.DB, username string) (result string, err error) {
	var stmt *sql.Stmt
	stmt, err = db.Prepare("CALL getUserULID(?)")
	if err != nil {
		return "", ErrDatabaseError
	}

	err = stmt.QueryRow(username).Scan(&result)
	if err != nil {
		errMsg := err.Error()
		splitError := strings.SplitN(errMsg, ":", 2)
		if len(splitError) > 1 {
			errMsg = splitError[1]
		}
		if strings.Contains(errMsg, "USER_NOTFOUND") {
			return errMsg, ErrUserNotFound
		}
		return errMsg, ErrDatabaseError
	}

	return result, nil
}

// UpdateUserPassword is a function that updates the user password in the database.
//
// Parameters:
// - db (*sql.DB): The database connection object.
// - ulid (string): The unique ID of the user.
// - newhash (string): The new hashed password.
//
// It returns three values:
// - result (string): The result of the password update operation, or an error message if the operation failed.
// - err (error): An error object, if any.
func UpdateUserPassword(db *sql.DB, ulid string, newhash string) (result string, err error) {
	stmt, err := db.Prepare("CALL updateUserPassword(?, ?)")
	if err != nil {
		return "", ErrDatabaseError
	}
	err = stmt.QueryRow(ulid, newhash).Scan(&result)
	if err != nil {
		errorMessage := err.Error()
		splitError := strings.SplitN(errorMessage, ":", 2)
		if len(splitError) > 1 {
			errorMessage = splitError[1]
		}
		if strings.Contains(errorMessage, "USER_NOTFOUND") {
			return errorMessage, ErrUserNotFound
		}
		return errorMessage, ErrDatabaseError
	}
	return result, nil
}

// GetUserPassword retrieves the password hash for a given user ID.
//
// Parameters:
// - db (*sql.DB): The database connection object.
// - userID (string): the user ID for which to retrieve the password hash.
//
// Returns:
// - passwordHash (string): the password hash for the given user ID, or an error message.
// - err (error): an error object if the operation encountered an error, or nil if no error occurred.
func GetUserPassword(db *sql.DB, userID string) (passwordHash string, err error) {
	var stmt *sql.Stmt
	stmt, err = db.Prepare("CALL getUserPassword(?)")
	if err != nil {
		return "", ErrDatabaseError
	}

	err = stmt.QueryRow(userID).Scan(&passwordHash)
	if err != nil {
		errorMessage := err.Error()
		splitError := strings.SplitN(errorMessage, ":", 2)
		if len(splitError) > 1 {
			errorMessage = splitError[1]
		}
		if strings.Contains(errorMessage, "USER_NOTFOUND") {
			return errorMessage, ErrUserNotFound
		}
		return errorMessage, ErrDatabaseError
	}

	return passwordHash, nil
}
