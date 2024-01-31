package clomega

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	log "github.com/charmbracelet/log"
	_ "github.com/go-sql-driver/mysql"
)

// CreateUserHandler handles the creation of a new user.
func CreateUserHandler(c *gin.Context) {
	// Require this endpoint to only accept POST requests
	if c.Request.Method != http.MethodPost {
		c.AbortWithStatusJSON(http.StatusMethodNotAllowed, gin.H{"error": "Method not allowed: See documentation."})
		return
	}

	// Decode the request body into the user struct
	var user User
	if err := c.ShouldBindJSON(&user); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON: See documentation."})
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
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Incomplete JSON: " + missingArgsStr + ". See documentation."})
		return
	}

	// Create the user (intentionally force hashing a password before checking, even if the username is taken or email is in use.
	// This is to slow down brute force attacks and prevent registration spamming.)
	hash := HashPassword(user.Password, GlobalConfig.ScryptParams)

	result, err := CreateUser(GlobalConfig.Database, user.Username, hash, user.Gamertag, user.Email)
	if err != nil {
		internalErrorHandler(c, result, err)
		return
	}

	c.String(http.StatusOK, result)
}

// @Summary Login
// @Description This endpoint takes a username and password and returns a session token if the login is successful.
// @Tags Sessions
// @Accept json
// @Produce plain
// @Param login body Login true "Login information"
// @Success 200 {string} string "(ULID)"
// @Success 404 {string} string "USER_NOTFOUND"
// @Success 401 {string} string "Invalid password.
// @Router /api/login [post]
func CreateSessionHandler(c *gin.Context) {
	// Require this endpoint to only accept POST requests
	if c.Request.Method != http.MethodPost {

		// Return plaintext 405 if not a POST request
		c.String(http.StatusMethodNotAllowed, "Method not allowed: See documentation.")
		return
	}

	// Decode the request body into the login struct
	var login Login
	if err := c.ShouldBindJSON(&login); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	// Check for empty fields
	if login.Username == "" || login.Password == "" {
		c.String(http.StatusBadRequest, "No arguments may be empty: See documentation.")
		return
	}

	// Get the user's ULID
	ulid, err := GetUserULID(GlobalConfig.Database, login.Username)
	if err != nil {
		internalErrorHandler(c, ulid, err)
		return
	}

	// Retrieve the user's hashed password
	hashedPassword, err := GetUserPassword(GlobalConfig.Database, ulid)
	if err != nil {
		internalErrorHandler(c, hashedPassword, err)
		return
	}

	// Verify the password
	err = VerifyPassword(login.Password, hashedPassword)
	if err != nil {
		c.String(http.StatusUnauthorized, "Invalid password.")
		return
	}

	// Create the session
	sessionToken, err := CreateSession(GlobalConfig.Database, ulid, c.Request.RemoteAddr)
	if err != nil {
		internalErrorHandler(c, hashedPassword, err)
		return
	}

	// Return the ULID session token
	c.String(http.StatusOK, sessionToken)
}

// internalErrorHandler handles internal errors in OmegaServer.
//
// It takes a gin.Context, a result string, and an error as parameters.
// It returns an error.
func internalErrorHandler(c *gin.Context, result string, err error) error {
	switch err {
	case ErrUserExists, ErrEmailInUse, ErrUsernameInUse:
		c.JSON(http.StatusConflict, result)
		return err
	case ErrSessionNotFound, ErrUserNotFound:
		c.JSON(http.StatusNotFound, result)
		return err
	case ErrDatabaseError:
		c.JSON(http.StatusInternalServerError, result)
		return err
	default:
		c.JSON(http.StatusInternalServerError, "Internal server error.")
		return err
	}
}
