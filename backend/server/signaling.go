package cloudlinkOmega

import (
	"log"
	"strconv"

	"github.com/goccy/go-json"
	"github.com/gofiber/contrib/websocket"
)

// See https://github.com/MikeDev101/cloudlink-omega/blob/main/backend/docs/protocol.md
var Opcodes = map[string]int{
	"VIOLATION":         0,
	"KEEPALIVE":         1,
	"INIT":              2,
	"INIT_OK":           3,
	"CONFIG_HOST":       4,
	"CONFIG_PEER":       5,
	"ACK_HOST":          6,
	"ACK_PEER":          7,
	"NEW_HOST":          8,
	"NEW_PEER":          9,
	"MAKE_OFFER":        10,
	"ANTICIPATE_OFFER":  11,
	"ACCEPT_OFFER":      12,
	"RETURN_OFFER":      13,
	"MAKE_ANSWER":       14,
	"ANTICIPATE_ANSWER": 15,
	"ACK_CHECK":         16,
	"ACK_READY":         17,
	"ACK_ABORT":         18,
	"SHUTDOWN":          19,
	"SHUTDOWN_ACK":      20,
	"LOBBY_EXISTS":      21,
	"LOBBY_NOTFOUND":    22,
	"LOBBY_FULL":        23,
	"LOBBY_LOCKED":      24,
	"LOBBY_CLOSE":       25,
	"HOST_GONE":         26,
	"PEER_GONE":         27,
	"HOST_RECLAIM":      28,
	"CLAIM_HOST":        29,
	"TRANSFER_HOST":     30,
	"ABANDON":           31,
	"LOCK":              32,
	"UNLOCK":            33,
	"SIZE":              34,
	"KICK":              35,
	"PASSWORD_REQUIRED": 36,
	"PASSWORD_ACK":      37,
	"PASSWORD_FAIL":     38,
}

func NotifyPeersOfStateChange(eventType int, lobbyID string, manager *Manager, client *Client) {
	switch eventType {

	// Notify all clients there is a new host
	case Opcodes["NEW_HOST"]:

		// Get client name and ID
		client.stateMutex.RLock()
		name := client.name
		id := client.id
		client.stateMutex.RUnlock()

		// Get lobby object
		manager.lobbiesMutex.RLock()
		lobby := manager.lobbies[lobbyID]
		password_required := (lobby.Password != "")
		max_peers := lobby.MaxPeers
		manager.lobbiesMutex.RUnlock()

		// Broadcast to peers (but not to the host itself)
		MulticastMessage(manager.clients, JSONDump(&PacketHost{
			Opcode: Opcodes["NEW_HOST"],
			Payload: &HostDetails{
				Id:               id,
				Username:         name,
				LobbyID:          lobbyID,
				PasswordRequired: password_required,
				MaxPeers:         max_peers,
			},
		}), client)

	// Notify host within the same lobby ID that there is a new peer
	case Opcodes["NEW_PEER"]:

		// Get lobby object
		manager.lobbiesMutex.RLock()
		lobby := manager.lobbies[lobbyID]
		manager.lobbiesMutex.RUnlock()

		// Get client name and ID
		client.stateMutex.RLock()
		name := client.name
		id := client.id
		client.stateMutex.RUnlock()

		// Notify host
		UnicastMessage(lobby.Host, JSONDump(&PacketPeer{
			Opcode: Opcodes["NEW_PEER"],
			Payload: &PeerDetails{
				Id:       id,
				Username: name,
			},
		}), nil)

	default:
		panic(
			"Unexpected eventType value! Expected NEW_HOST (" + strconv.Itoa(Opcodes["NEW_HOST"]) + ") or NEW_PEER (" + strconv.Itoa(Opcodes["NEW_PEER"]) + "), got " + strconv.Itoa(eventType),
		)
	}
}

func (client *Client) CloseConnectionOnError(opcode int, message string, errorcode int) {
	log.Printf("Disconnecting client %s due to an error: \"%s\"", client.id, message)
	UnicastMessage(client, JSONDump(&Packet{
		Opcode:  opcode,
		Payload: message,
	}), nil)
	client.CloseWithMessage(errorcode, message)
}

// Some payloads must be asserted as a string. This function checks if the value is a string,
// and returns opcode 0 (VIOLATION) to the client if the assertion fails. It will also
// disconnect the client for violating the protocol.
func (client *Client) assertString(i interface{}) (string, bool) {
	s, ok := i.(string)
	if !ok {
		go client.CloseConnectionOnError(
			Opcodes["VIOLATION"],
			"Assertion error: payload argument must be a string type",
			websocket.CloseUnsupportedData,
		)
		return "", false
	}
	return s, true
}

// Same as assertString, but for boolean arguments instead.
func (client *Client) assertBool(i interface{}) (bool, bool) {
	s, ok := i.(bool)
	if !ok {
		go client.CloseConnectionOnError(
			Opcodes["VIOLATION"],
			"Assertion error: payload argument must be a boolean type",
			websocket.CloseUnsupportedData,
		)
		return false, false
	}
	return s, true
}

// Same as assertString, but for int arguments instead.
func (client *Client) assertInt(i interface{}) (int, bool) {
	s, ok := i.(int)
	if !ok {
		go client.CloseConnectionOnError(
			Opcodes["VIOLATION"],
			"Assertion error: payload argument must be a int type",
			websocket.CloseUnsupportedData,
		)
		return -1, false
	}
	return s, true
}

// All commands (except for KEEPAlIVE and INIT) require a username to be set. This function
// checks if a client has used the INIT opcode (2) before executing a different opcode.
func (client *Client) assertUsernameSet() bool {

	// Get state
	client.nameMutex.RLock()
	nameset := client.nameSet
	client.nameMutex.RUnlock()

	// Handle username not being set
	if !nameset {
		go client.CloseConnectionOnError(
			Opcodes["VIOLATION"],
			"State error: a username is required",
			websocket.CloseUnsupportedData,
		)
		return false
	}
	return true
}

// Handles incoming messages from the websocket server
func SignalingOpcode(message []byte, manager *Manager, client *Client) {
	// Parse incoming JSON
	var packet Packet
	if err := json.Unmarshal(message, &packet); err != nil {
		go client.CloseConnectionOnError(
			Opcodes["VIOLATION"],
			"Got invalid/malformed JSON: JSON parsing error!",
			websocket.CloseUnsupportedData,
		)
		return
	}

	// Handle opcodes
	switch packet.Opcode {

	case Opcodes["KEEPALIVE"]:
		// Return your ping with my pong
		UnicastMessage(client, JSONDump(&Packet{
			Opcode: Opcodes["KEEPALIVE"],
		}), nil)

	case Opcodes["INIT"]:

		// Require a username to be declared
		if packet.Payload == nil {
			go client.CloseConnectionOnError(
				Opcodes["VIOLATION"],
				"Value error: missing username (payload) value",
				websocket.CloseUnsupportedData,
			)
			return
		}

		// Assert name (payload) must be string type
		var username, ok = client.assertString(packet.Payload)
		if !ok {
			return
		}

		// Check if username has already been set, and prevent re-sending this command
		if client.nameSet {
			go client.CloseConnectionOnError(
				Opcodes["VIOLATION"],
				"State error: username has already been set",
				websocket.CloseUnsupportedData,
			)
			return
		}

		// Set username
		client.nameMutex.Lock()
		client.name = username
		client.nameSet = true
		client.nameMutex.Unlock()

		// Log the server noticing the client saying "hello"
		log.Printf("Client %s exists! Hello there, \"%s\"!", client.id, username)

		// Update state
		manager.clientNamesMutex.Lock()
		manager.clientNames[username] = client
		manager.clientNamesMutex.Unlock()

		// Let the client know the server said "hello" back
		UnicastMessage(client, JSONDump(&Packet{
			Opcode:  Opcodes["INIT_OK"],
			Payload: client.id,
		}), nil)

	case Opcodes["CONFIG_HOST"]:

		// Require a lobby ID to be declared
		if packet.Payload == nil {
			go client.CloseConnectionOnError(
				Opcodes["VIOLATION"],
				"Value error: missing lobby ID (payload) value",
				websocket.CloseUnsupportedData,
			)
			return
		}

		// Require a username to be set
		if ok := client.assertUsernameSet(); !ok {
			return
		}

		// Re-marshal the message using HostConfig struct
		config := &HostConfig{}
		if err := json.Unmarshal(message, &config); err != nil {
			go client.CloseConnectionOnError(
				Opcodes["VIOLATION"],
				"Argument error: failed to parse payload keyvalue as JSON. Did you read the documentation?",
				websocket.CloseUnsupportedData,
			)
			return
		}

		// Assert lobbyID (payload) must be string type
		lobbyID, ok := client.assertString(config.Payload.LobbyID)
		if !ok {
			return
		}

		// Assert configuration
		AllowHostReclaim, ok := client.assertBool(config.Payload.AllowHostReclaim)
		if !ok {
			return
		}
		AllowPeersToReclaim, ok := client.assertBool(config.Payload.AllowPeersToReclaim)
		if !ok {
			return
		}
		MaxPeers, ok := client.assertInt(config.Payload.MaxPeers)
		if !ok {
			return
		}
		Password, ok := client.assertString(config.Payload.Password)
		if !ok {
			return
		}

		// Add client to hosts storage for manager
		if ok := NewHost(lobbyID, client, manager, AllowHostReclaim, AllowPeersToReclaim, MaxPeers, Password); !ok {
			// Tell the client that the lobby already exists (couldn't create lobby)
			go UnicastMessage(client, JSONDump(&Packet{
				Opcode: Opcodes["LOBBY_EXISTS"],
			}), nil)
			return
		}

		// Log the server noticing the client becoming a host
		log.Printf(
			"Client %s is a game host, and wants to create lobby \"%s\"\n	Does this lobby allow for host reclaim: %s\n	Does this lobby permit peers to negotiate a new host: %s\n	Maximum number of peers (0 means unlimited): %s\n	Password required: %s",
			client.id,
			lobbyID,
			strconv.FormatBool(AllowHostReclaim),
			strconv.FormatBool(AllowPeersToReclaim),
			strconv.Itoa(MaxPeers),
			strconv.FormatBool(Password != ""),
		)

		// Let the client know the server has made it a game host
		UnicastMessage(client, JSONDump(&Packet{
			Opcode: Opcodes["ACK_HOST"],
		}), nil)

		// Notify all peers that are looking for a host from this lobby ID (opcode 9 NEW_HOST)
		NotifyPeersOfStateChange(Opcodes["NEW_HOST"], lobbyID, manager, client)

	case Opcodes["CONFIG_PEER"]:

		// Require a lobby ID to be declared
		if packet.Payload == nil {
			go client.CloseConnectionOnError(
				Opcodes["VIOLATION"],
				"Value error: missing lobby ID (payload) value",
				websocket.CloseUnsupportedData,
			)
			return
		}

		// Require a username to be set
		if ok := client.assertUsernameSet(); !ok {
			return
		}

		// Assert lobbyID (payload) must be string type
		var lobbyID, ok = client.assertString(packet.Payload)
		if !ok {
			return
		}

		// Get lobby object
		manager.lobbiesMutex.RLock()
		lobby := manager.lobbies[lobbyID]
		password_required := (lobby.Password != "")
		// max_peers := lobby.MaxPeers
		locked := lobby.Locked
		manager.lobbiesMutex.RUnlock()

		// Check if a password is required
		if password_required {
			// Tell the client that the lobby requires a password
			go UnicastMessage(client, JSONDump(&Packet{
				Opcode: Opcodes["PASSWORD_REQUIRED"],
			}), nil)
			return
		}

		// Check if lobby is currently locked
		if locked {
			// Tell the client that the lobby is locked
			go UnicastMessage(client, JSONDump(&Packet{
				Opcode: Opcodes["LOBBY_LOCKED"],
			}), nil)
			return
		}

		// TODO: check if the lobby is full

		// Add client to peers storage for manager
		if ok := NewPeer(lobbyID, client, manager); !ok {
			// Tell the client that the lobby doesn't exist (couldn't add to a lobby)
			go UnicastMessage(client, JSONDump(&Packet{
				Opcode: Opcodes["LOBBY_NOTFOUND"],
			}), nil)
			return
		}

		// Log the server noticing the client becoming a peer
		log.Printf("Client %s is a game peer, and wants to join lobby %s", client.id, lobbyID)

		// Let the client know the server has made it a game peer
		UnicastMessage(client, JSONDump(&Packet{
			Opcode: Opcodes["ACK_PEER"],
		}), nil)

		// Notify all hosts in that lobby ID that there is a new peer (opcode 8 NEW_PEER)
		NotifyPeersOfStateChange(Opcodes["NEW_PEER"], lobbyID, manager, client)

	default:
		client.CloseConnectionOnError(
			Opcodes["VIOLATION"],
			("Unrecognized message opcode value: " + strconv.Itoa(packet.Opcode)),
			websocket.CloseUnsupportedData,
		)
	}
}
