package structs

import (
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	Conn          *websocket.Conn
	ID            uint64 // For client manager tracking only
	UGI           string
	IsHost        bool
	Authorization string // ULID session token
	Username      string
	ULID          string
	Expiry        int64 // UNIX time
	ValidSession  bool
	Origin        string // Hostname of the origin of the connection
	GameName      string
	DeveloperName string
	Lock          sync.RWMutex
}
