package cloudlink

import (
	"sync"

	"github.com/gofiber/contrib/websocket"
	"github.com/google/uuid"
)

type Client struct {
	connection      *websocket.Conn
	connectionMutex sync.RWMutex
	manager         *Manager
	id            uuid.UUID

	// Lock state for rooms
	sync.RWMutex
}
