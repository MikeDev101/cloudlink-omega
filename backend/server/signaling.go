package cloudlinkOmega

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
		log.Printf("Got invalid/malformed JSON: JSON parsing error!")
		UnicastMessage(client, JSONDump(&Packet{
			Opcode:  opcodeTable["VIOLATION"],
			Payload: "Got invalid/malformed JSON: JSON parsing error!",
		}), nil)
		client.CloseWithMessage(websocket.CloseUnsupportedData, "Got invalid/malformed JSON: JSON parsing error!")
		return
	}

	// Handle opcodes
	switch packet.Opcode {

	case opcodeTable["KEEPALIVE"]:
		// Return your ping with my pong
		UnicastMessage(client, JSONDump(&Packet{
			Opcode: opcodeTable["KEEPALIVE"],
		}), nil)

	case opcodeTable["INIT"]:

		// Require a username to be declared
		if packet.Payload == nil {
			log.Printf("Missing username (payload) value")
			UnicastMessage(client, JSONDump(&Packet{
				Opcode:  opcodeTable["VIOLATION"],
				Payload: "Missing username (payload) value",
			}), nil)
			client.CloseWithMessage(websocket.CloseProtocolError, "Missing username (payload) value")
			return
		}

		// Log the server noticing the client saying "hello"
		log.Printf("Client %s exists! Hello there, \"%s\"!", client.id, packet.Payload)

		// Let the client know the server said "hello" back
		UnicastMessage(client, JSONDump(&Packet{
			Opcode:  opcodeTable["INIT_OK"],
			Payload: client.id,
		}), nil)

	case opcodeTable["CONFIG_HOST"]:

		// Require a lobby ID to be declared
		if packet.Payload == nil {
			log.Printf("Missing lobby ID (payload) value")
			UnicastMessage(client, JSONDump(&Packet{
				Opcode:  opcodeTable["VIOLATION"],
				Payload: "Missing lobby ID (payload) value",
			}), nil)
			client.CloseWithMessage(websocket.CloseProtocolError, "Missing lobby ID (payload) value")
			return
		}

		// Log the server noticing the client becoming a host
		log.Printf("Client %s is a game host, and wants to create room %s", client.id, packet.Payload)

		// Add client to hosts storage for manager
		NewHost(packet.Payload, client, manager)

		// Let the client know the server has made it a game host
		UnicastMessage(client, JSONDump(&Packet{
			Opcode: opcodeTable["ACK_HOST"],
		}), nil)

		// TODO: notify all peers that are looking for a host from this lobby ID (opcode 9 NEW_HOST)

	case opcodeTable["CONFIG_PEER"]:

		// Require a lobby ID to be declared
		if packet.Payload == nil {
			log.Printf("Missing lobby ID (payload) value")
			UnicastMessage(client, JSONDump(&Packet{
				Opcode:  opcodeTable["VIOLATION"],
				Payload: "Missing lobby ID (payload) value",
			}), nil)
			client.CloseWithMessage(websocket.CloseProtocolError, "Missing lobby ID (payload) value")
			return
		}

		// Log the server noticing the client becoming a peer
		log.Printf("Client %s is a game peer, and wants to join room %s", client.id, packet.Payload)

		// Add client to peers storage for manager
		NewPeer(packet.Payload, client, manager)

		// Let the client know the server has made it a game peer
		UnicastMessage(client, JSONDump(&Packet{
			Opcode: opcodeTable["ACK_PEER"],
		}), nil)

		// TODO: notify all hosts in that lobby ID that there is a new peer (opcode 8 NEW_PEER)

	default:
		log.Printf("Unrecognized message opcode value %s", strconv.Itoa(packet.Opcode))
		UnicastMessage(client, JSONDump(&Packet{
			Opcode:  opcodeTable["VIOLATION"],
			Payload: ("Unrecognized message opcode value " + strconv.Itoa(packet.Opcode)),
		}), nil)
		client.CloseWithMessage(websocket.CloseProtocolError, "Unrecognized message opcode")
	}
}
