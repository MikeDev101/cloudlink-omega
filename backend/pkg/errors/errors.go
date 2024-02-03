package errors

import (
	"errors"
)

// Create custom errors
var ErrUserNotFound = errors.New("user not found")
var ErrUserExists = errors.New("user already exists")
var ErrSessionNotFound = errors.New("session not found")
var ErrEmailInUse = errors.New("email in use")
var ErrUsernameInUse = errors.New("username taken")
var ErrDatabaseError = errors.New("db error")
var ErrGameNotFound = errors.New("game not found")
