package cloudlinkOmega

import (
	"sync"

	"github.com/gofiber/contrib/websocket"
	"github.com/google/uuid"
)

type Client struct {
	connection      *websocket.Conn
	connectionMutex sync.RWMutex
	manager         *Manager
	id              uuid.UUID

	// Manage username
	name      string
	nameSet   bool
	nameMutex sync.RWMutex

	// Manage state
	isHost     bool
	isPeer     bool
	lobbyID    string
	stateMutex sync.RWMutex

	// Lock state for rooms
	sync.RWMutex
}
