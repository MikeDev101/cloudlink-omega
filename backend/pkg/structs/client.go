package structs

import (
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	Conn          *websocket.Conn
	ID            uint64 // For client manager tracking only
	UGI           string
	IsHost        bool   // Set to true when CONFIG_HOST is received or the server makes another peer the host with HOST_RECLAIM, or a peer with CLAIM_HOST
	IsPeer        bool   // Set to true when CONFIG_PEER is received
	Authorization string // ULID session token
	Username      string
	ULID          string
	Expiry        int64 // UNIX time
	ValidSession  bool
	Origin        string // Hostname of the origin of the connection
	GameName      string
	DeveloperName string
	Lobby         string
	Lock          sync.RWMutex
}
