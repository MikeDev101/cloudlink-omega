package clomega

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     AuthorizedOrigins,
}

type Client struct {
	Conn          *websocket.Conn
	UGI           string
	Authorization string // ULID session token
	Gamertag      string
	ID            string
	Expiry        int // UNIX time
	ValidSession  bool
}

func (c *Client) Delete() {
	c = nil
}

// AuthorizedOrigins is a Go function that implements CORS. It queries the database for authorized origins.
//
// r *http.Request
// bool
func AuthorizedOrigins(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	fmt.Printf("Origin: %s\n", origin)
	// TODO: Implement CORS. Query the database for authorized origins, etc. For now, return true.
	return true
}

// CloseWithViolationCode closes the websocket connection and writes a JSON signal
// packet with the violation opcode and the provided message.
//
// conn *websocket.Conn - the websocket connection to be closed
// message string - the message to be included in the violation signal packet
func CloseWithViolationCode(conn *websocket.Conn, message string) {
	defer conn.Close()
	conn.WriteJSON(SignalPacket{Opcode: "VIOLATION", Payload: message})
}

// signalingHandler handles the websocket connection upgrade and message handling.
//
// c *gin.Context
func signalingHandler(c *gin.Context) {
	// Upgrade initial GET request to a websocket connection
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		http.Error(c.Writer, "Could not open websocket connection", http.StatusInternalServerError)
		return
	}

	// Parse URL parameter and close the connection if UGI is not provided
	ugi := c.Query("ugi")
	if ugi == "" {
		CloseWithViolationCode(conn, "UGI not provided in URL parameter.")
		return
	}

	fmt.Printf("%s connecting to game %s\n", conn.RemoteAddr(), string(ugi))

	// Verify validity of provided UGI and get game_name and developer_name
	game_name, developer_name, err := GetUGIInfo(GlobalConfig.Database, ugi)
	if err != nil {
		CloseWithViolationCode(conn, err.Error())
		return
	}

	// Log connected game
	fmt.Printf("%s connected to \"%s\" by \"%s\"", conn.RemoteAddr(), game_name, developer_name)

	// Create client
	client := &Client{Conn: conn, UGI: ugi}

	// Handle connection with websocket
	defer client.Delete()
	client.messageHandler()
}

// messageHandler handles incoming messages from the browser using a websocket connection.
//
// Parameter(s):
//
//	conn *websocket.Conn - the websocket connection
//
// Return type(s): None
func (c *Client) messageHandler() {
	var err error
	defer c.Conn.Close()
	for {
		// Read messages from browser as JSON using SignalPacket struct.
		packet := SignalPacket{}
		if err = c.Conn.ReadJSON(&packet); err != nil {
			errstring := fmt.Sprintf("Error reading packet: %s", err)
			fmt.Println(errstring)
			CloseWithViolationCode(c.Conn, errstring)
			return
		}

		// Print the message to the console
		// fmt.Printf("%s sent: %s\n", c.Conn.RemoteAddr(), packet)

		// TODO: handle packet

		// Write message back to browser
		if err = c.Conn.WriteJSON(packet); err != nil {
			fmt.Printf("Error writing packet: %s\n", err)
			return
		}
	}
}
