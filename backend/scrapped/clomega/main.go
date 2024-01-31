package clomega

// Create a gin controller for API paths defined in api.go
import (
	"github.com/gin-gonic/gin"
)

// Config structure for the server, providing public variable configurations for the params and the database.
var GlobalConfig Config

// Create a gin controller for API paths defined in api.go
func New(router *gin.Engine, apipath string, config Config) *gin.RouterGroup {
	// Set the global config
	GlobalConfig = config

	// Create a new gin router
	api := router.Group(apipath)
	{
		// Register the API paths defined in api.go
		api.POST("/login", CreateSessionHandler)
		api.POST("/register", CreateUserHandler)

		// Register the signaling websocket handler
		api.GET("/signaling", signalingHandler)
	}

	return api
}
