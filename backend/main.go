package main

import (
	"log"
	"runtime/debug"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"

	cloudlink "github.com/mikedev101/cloudlink-omega/backend/server"
)

func main() {
	// Configure runtime settings
	debug.SetGCPercent(35) // 35% limit for GC

	// Create fiber application
	app := fiber.New()

	// Create CloudLink server
	manager := cloudlink.New("root")

	// Add a websocket path
	app.Use("/ws", func(c *fiber.Ctx) error {
		// IsWebSocketUpgrade returns true if the client
		// requested upgrade to the WebSocket protocol.
		if websocket.IsWebSocketUpgrade(c) {
			// c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	// Bind CloudLink server to websocket path
	app.Get("/ws/:id", websocket.New(func(client *websocket.Conn) {
		cloudlink.SessionHandler(client, manager)
	}))

	log.Fatal(app.Listen(":3000"))
	// Access the websocket server: ws://0.0.0.0:3000/

	//log.Fatal(app.ListenTLS("0.0.0.0:3000", "./cert.pem", "./key.pem"))
	// Access the websocket server: wss://0.0.0.0:3000/
}