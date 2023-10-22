package cloudlink

import (
	"log"
	"strconv"

	"github.com/goccy/go-json"
	"github.com/gofiber/contrib/websocket"
)

// See https://github.com/MikeDev101/cloudlink-omega/blob/main/backend/docs/protocol.md
var opcodeTable = map[string]int{
	"VIOLATION":         0,
	"KEEPALIVE":         1,
	"INIT":              2,
	"INIT_OK":           3,
	"CONFIG_HOST":       4,
	"CONFIG_PEER":       5,
	"ACK_PEER":          6,
	"ACK_HOST":          7,
	"NEW_PEER":          8,
	"NEW_HOST":          9,
	"MAKE_OFFER":        10,
	"ANTICIPATE_OFFER":  11,
	"ACCEPT_OFFER":      12,
	"RETURN_OFFER":      13,
	"MAKE_ANSWER":       14,
	"ANTICIPATE_ANSWER": 15,
	"ACK_CHECK":         16,
	"ACK_READY":         17,
	"SHUTDOWN":          18,
	"SHUTDOWN_ACK":      19,
	"SHUTDOWN_WRN":      20,
}

func SignalingOpcode(message []byte, manager *Manager, client *Client) {
	// Something - Handle messages here
	// UnicastMessage(client, message, client)
	// MulticastMessage(manager.clients, JSONDump(message), client)

	// Parse incoming JSON
	var packet Packet
	if err := json.Unmarshal(message, &packet); err != nil {
		client.CloseWithMessage(websocket.CloseUnsupportedData, "JSON Parsing error")
	}

	// Handle opcodes
	switch packet.Opcode {

	case opcodeTable["KEEPALIVE"]:
		// Return your ping with my pong
		UnicastMessage(client, JSONDump(&Packet{
			Opcode: opcodeTable["KEEPALIVE"],
		}), nil)

	case opcodeTable["INIT"]:
		// Log the server noticing the client saying "hello"
		log.Printf("Client %s declared existence on the server", client.id)

		// Let the client know the server said "hello" back
		UnicastMessage(client, JSONDump(&Packet{
			Opcode:  opcodeTable["INIT_OK"],
			Payload: client.id,
		}), nil)

	default:
		log.Printf("Unrecognized message opcode value %s", strconv.Itoa(packet.Opcode))
		UnicastMessage(client, JSONDump(&Packet{
			Opcode:  opcodeTable["VIOLATION"],
			Payload: ("Unrecognized message opcode value " + strconv.Itoa(packet.Opcode)),
		}), nil)
		client.CloseWithMessage(websocket.CloseProtocolError, "Unrecognized message opcode")
	}
}
