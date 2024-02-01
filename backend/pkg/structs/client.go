package structs

import "github.com/gorilla/websocket"

type Client struct {
	Conn          *websocket.Conn
	UGI           string
	Authorization string // ULID session token
	Gamertag      string
	ID            string
	Expiry        int // UNIX time
	ValidSession  bool
}
