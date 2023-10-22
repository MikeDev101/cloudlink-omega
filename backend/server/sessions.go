package cloudlink

import (
	"log"

	"github.com/gofiber/contrib/websocket"
)

func (client *Client) CloseWithMessage(statuscode int, closeMessage string) {
	client.connection.WriteMessage(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(
			statuscode,
			closeMessage,
		),
	)
	client.connection.Close()
}

func (client *Client) MessageHandler(manager *Manager) {
	// websocket.Conn bindings https://pkg.go.dev/github.com/fasthttp/websocket?tab=doc#pkg-index
	var (
		_       int
		message []byte
		err     error
	)
	for {
		// Listen for new messages
		if _, message, err = client.connection.ReadMessage(); err != nil {
			break
		}

		log.Printf("[%s] Client %s incoming message: %s", manager.name, client.id, message)

		// Something - Handle messages here
		// UnicastMessage(client, message, client)
		MulticastMessage(manager.clients, message, client)
	}
}

func SessionCleanup(manager *Manager, client *Client) {
	// Remove client from manager
	manager.RemoveClient(client)

	// Destroy manager if no clients are connected
	if length(manager.clients) == 0 {
		log.Printf("Deleting empty manager %s", manager.name)
		manager = Manager{}
	}
}

// SessionHandler is the root function that makes CloudLink work. As soon as a client request gets upgraded to the websocket protocol, this function should be called.
func SessionHandler(con *websocket.Conn) {
	// con.Locals is added to the *websocket.Conn
	log.Println(con.Locals("allowed"))  // true
	log.Println(con.Params("id"))       // 123
	log.Println(con.Query("v"))         // 1.0
	log.Println(con.Cookies("session")) // ""

	// Create manager
	manager := New(con.Params("id"))

	// Register client
	client := NewClient(con, manager)
	manager.AddClient(client)

	// Log IP address of client (if enabled)
	log.Printf("[%s] Client %s IP address: %s", manager.name, client.id, con.RemoteAddr().String())

	// Remove client from manager once the session has ended (and destroy manager if no clients are connected)
	defer SessionCleanup(manager, client)

	// Begin handling messages throughout the lifespan of the connection
	client.MessageHandler(manager)
}
