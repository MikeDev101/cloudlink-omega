package main

import (
	"log"
	"runtime/debug"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"

	cloudlinkOmega "github.com/mikedev101/cloudlink-omega/backend/server"
)

func main() {
	// Configure runtime settings
	debug.SetGCPercent(35) // 35% limit for GC

	// Create fiber application
	app := fiber.New()

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
		cloudlinkOmega.SessionHandler(client)
	}))

	//log.Fatal(app.Listen(":3000"))
	// Access the websocket server: ws://0.0.0.0:3000/

	log.Fatal(app.ListenTLS("0.0.0.0:3000", "./cert.crt", "./cert.key"))
	// Access the websocket server: wss://0.0.0.0:3000/
}
