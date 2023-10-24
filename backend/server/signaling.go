package cloudlinkOmega

import (
	"log"
	"strconv"

	"github.com/goccy/go-json"
	"github.com/gofiber/contrib/websocket"
	"github.com/gofrs/uuid"
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
	"MAKE_ANSWER":       11,
	"ICE":               12,
	"ABORT_OFFER":       13,
	"ABORT_ANSWER":      14,
	"SHUTDOWN":          15,
	"LOBBY_EXISTS":      16,
	"LOBBY_NOTFOUND":    17,
	"LOBBY_FULL":        18,
	"LOBBY_LOCKED":      19,
	"LOBBY_CLOSE":       20,
	"HOST_GONE":         21,
	"PEER_GONE":         22,
	"HOST_RECLAIM":      23,
	"CLAIM_HOST":        24,
	"TRANSFER_HOST":     25,
	"ABANDON":           26,
	"LOCK":              27,
	"UNLOCK":            28,
	"SIZE":              29,
	"KICK":              30,
	"PASSWORD_REQUIRED": 31,
	"PASSWORD_ACK":      32,
	"PASSWORD_FAIL":     33,
	"PEER_INVALID":      34,
}

func NotifyPeersOfStateChange(eventType int, lobbyID string, manager *Manager, client *Client) {
	switch eventType {

	// Notify all clients there is a new host
	case Opcodes["NEW_HOST"]:

		// Get client name and ID
		manager.AcquireAccessLock(&client.stateMutex, "client names and ids")
		name := client.name
		id := client.id
		manager.FreeAccessLock(&client.stateMutex, "client names and ids")

		// Get lobby object
		manager.AcquireAccessLock(&manager.lobbiesMutex, "lobby object, password requirement, and maximum peers")
		lobby := manager.lobbies[lobbyID]
		password_required := (lobby.Password != "")
		max_peers := lobby.MaxPeers
		manager.FreeAccessLock(&manager.lobbiesMutex, "lobby object, password requirement, and maximum peers")

		// Broadcast to peers (but not to the host itself)
		MulticastMessage(manager.clients, JSONDump(&PacketHost{
			Opcode: Opcodes["NEW_HOST"],
			Payload: &HostDetails{
				Id:               id.String(),
				Username:         name,
				LobbyID:          lobbyID,
				PasswordRequired: password_required,
				MaxPeers:         max_peers,
			},
		}), client)

	// Notify host within the same lobby ID that there is a new peer
	case Opcodes["NEW_PEER"]:

		// Get lobby object
		manager.AcquireAccessLock(&manager.lobbiesMutex, "lobby object")
		lobby := manager.lobbies[lobbyID]
		manager.FreeAccessLock(&manager.lobbiesMutex, "lobby object")

		// Get client name and ID
		manager.AcquireAccessLock(&client.stateMutex, "client name and id")
		name := client.name
		id := client.id
		manager.FreeAccessLock(&client.stateMutex, "client name and id")

		// Notify host
		UnicastMessage(lobby.Host, JSONDump(&PacketPeer{
			Opcode: Opcodes["NEW_PEER"],
			Payload: &PeerDetails{
				Id:       id.String(),
				Username: name,
			},
		}), nil)

	default:
		panic(
			"[" + manager.Name + "] Unexpected eventType value! Expected NEW_HOST (" + strconv.Itoa(Opcodes["NEW_HOST"]) + ") or NEW_PEER (" + strconv.Itoa(Opcodes["NEW_PEER"]) + "), got " + strconv.Itoa(eventType),
		)
	}
}

func (client *Client) CloseConnectionOnError(opcode int, message string, errorcode int) {
	log.Printf("[%s] Disconnecting client %s due to an error: \"%s\"", client.manager.Name, client.id, message)
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
	client.manager.AcquireAccessLock(&client.nameMutex, "client username state")
	nameset := client.nameSet
	client.manager.FreeAccessLock(&client.nameMutex, "client username state")

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

// Handle KEEPALIVE opcodes.
func opcode_KEEPALIVE(message []byte, packet *Packet, client *Client, manager *Manager) {
	// Return your ping with my pong
	UnicastMessage(client, JSONDump(&Packet{
		Opcode: Opcodes["KEEPALIVE"],
	}), nil)
}

// Handle INIT opcodes.
func opcode_INIT(message []byte, packet *Packet, client *Client, manager *Manager) {
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
	manager.AcquireAccessLock(&client.nameMutex, "client username state")
	client.name = username
	client.nameSet = true
	manager.FreeAccessLock(&client.nameMutex, "client username state")

	// Log the server noticing the client saying "hello"
	log.Printf("[%s] Client %s exists! Hello there, \"%s\"!", manager.Name, client.id, username)

	// Update state
	manager.AcquireAccessLock(&manager.clientNamesMutex, "manager client usernames slice")
	manager.clientNames[username] = client
	manager.FreeAccessLock(&manager.clientNamesMutex, "manager client usernames slice")

	// Let the client know the server said "hello" back
	UnicastMessage(client, JSONDump(&Packet{
		Opcode:  Opcodes["INIT_OK"],
		Payload: client.id,
	}), nil)
}

// Handle CONFIG_HOST opcodes.
func opcode_CONFIG_HOST(message []byte, packet *Packet, client *Client, manager *Manager) {
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
		"[%s] Client %s is a game host, and wants to create lobby \"%s\"\n	Does this lobby allow for host reclaim: %s\n	Does this lobby permit peers to negotiate a new host: %s\n	Maximum number of peers (0 means unlimited): %s\n	Password required: %s",
		manager.Name,
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

	// Notify all peers that are looking for a host from this lobby ID (NEW_HOST)
	NotifyPeersOfStateChange(Opcodes["NEW_HOST"], lobbyID, manager, client)
}

// Handle CONFIG_PEER opcodes.
func opcode_CONFIG_PEER(message []byte, packet *Packet, client *Client, manager *Manager) {
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

	// Re-marshal the message using PeerConfig struct
	config := &PeerConfig{}
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

	Password, ok := client.assertString(config.Payload.Password)
	if !ok {
		return
	}

	// Get lobby object
	manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
	lobby, exists := manager.lobbies[lobbyID]
	if !exists {
		// Free the lock
		manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")

		// Tell the client that the lobby doesn't exist
		go UnicastMessage(client, JSONDump(&Packet{
			Opcode: Opcodes["LOBBY_NOTFOUND"],
		}), nil)
		return
	}
	lobby_password := lobby.Password
	password_required := (lobby.Password != "")
	max_peers := lobby.MaxPeers
	peer_count := len(lobby.Peers)
	locked := lobby.Locked
	manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")

	// Check if lobby is currently locked
	if locked {
		// Tell the client that the lobby is locked
		go UnicastMessage(client, JSONDump(&Packet{
			Opcode: Opcodes["LOBBY_LOCKED"],
		}), nil)
		return
	}

	// Check if the lobby is full
	if (max_peers != 0) && (max_peers == peer_count) {
		// Tell the client that the lobby is full
		go UnicastMessage(client, JSONDump(&Packet{
			Opcode: Opcodes["LOBBY_FULL"],
		}), nil)
		return
	}

	// Check if a password is required
	if password_required {
		if Password == "" {
			// Tell the client that the lobby requires a password
			go UnicastMessage(client, JSONDump(&Packet{
				Opcode: Opcodes["PASSWORD_REQUIRED"],
			}), nil)
			return
		} else if Password != lobby_password {
			// Tell the client that the lobby password is incorrect
			go UnicastMessage(client, JSONDump(&Packet{
				Opcode: Opcodes["PASSWORD_FAIL"],
			}), nil)
			return
		} else {
			// Tell the client the password was accepted
			UnicastMessage(client, JSONDump(&Packet{
				Opcode: Opcodes["PASSWORD_ACK"],
			}), nil)
		}
	}

	// Add client to peers storage for manager
	if ok := NewPeer(lobbyID, client, manager); !ok {
		// Tell the client that the lobby doesn't exist (couldn't add to a lobby)
		go UnicastMessage(client, JSONDump(&Packet{
			Opcode: Opcodes["LOBBY_NOTFOUND"],
		}), nil)
		return
	}

	// Log the server noticing the client becoming a peer
	log.Printf("[%s] Client %s is a game peer, and wants to join lobby \"%s\"", manager.Name, client.id, lobbyID)

	// Let the client know the server has made it a game peer
	UnicastMessage(client, JSONDump(&Packet{
		Opcode: Opcodes["ACK_PEER"],
	}), nil)

	// Notify all hosts in that lobby ID that there is a new peer (NEW_PEER)
	NotifyPeersOfStateChange(Opcodes["NEW_PEER"], lobbyID, manager, client)
}

// Handle MAKE_OFFER opcodes.
func opcode_MAKE_OFFER(message []byte, packet *Packet, client *Client, manager *Manager) {
	// Require a username to be set
	if ok := client.assertUsernameSet(); !ok {
		return
	}

	// Assert recipient (rx) must be string type
	var rx, ok = client.assertString(packet.Rx)
	if !ok {
		return
	}

	// Parse UUID
	id, err := uuid.FromString(rx)
	if err != nil {

		// Tell the client the UUID was invalid and close the connection
		go client.CloseConnectionOnError(
			Opcodes["VIOLATION"],
			"UUID parsing error: peer ID (rx) not a valid UUID format",
			websocket.CloseUnsupportedData,
		)
		return
	}

	// Find client
	manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
	var rxclient, exists = manager.clients[id]
	manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")
	if !exists {

		// Tell origin the recipient peer is invalid
		go UnicastMessage(client, JSONDump(&Packet{
			Opcode: Opcodes["PEER_INVALID"],
		}), nil)
		return
	}

	// Send offer to peer
	UnicastMessage(rxclient, JSONDump(&Packet{
		Opcode:  Opcodes["MAKE_OFFER"],
		Payload: packet.Payload,
		Tx:      client.id.String(),
	}), nil)
}

// Handle MAKE_ANSWER opcodes.
func opcode_MAKE_ANSWER(message []byte, packet *Packet, client *Client, manager *Manager) {
	// Require a username to be set
	if ok := client.assertUsernameSet(); !ok {
		return
	}

	// Assert recipient (rx) must be string type
	var rx, ok = client.assertString(packet.Rx)
	if !ok {
		return
	}

	// Parse UUID
	id, err := uuid.FromString(rx)
	if err != nil {

		// Tell the client the UUID was invalid and close the connection
		go client.CloseConnectionOnError(
			Opcodes["VIOLATION"],
			"UUID parsing error: peer ID (rx) not a valid UUID format",
			websocket.CloseUnsupportedData,
		)
		return
	}

	// Find client
	manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
	var rxclient, exists = manager.clients[id]
	manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")
	if !exists {

		// Tell origin the recipient peer is invalid
		go UnicastMessage(client, JSONDump(&Packet{
			Opcode: Opcodes["PEER_INVALID"],
		}), nil)
		return
	}

	// Send answer to peer
	UnicastMessage(rxclient, JSONDump(&Packet{
		Opcode:  Opcodes["MAKE_ANSWER"],
		Payload: packet.Payload,
		Tx:      client.id.String(),
	}), nil)
}

// Handle ICE opcodes.
func opcode_ICE(message []byte, packet *Packet, client *Client, manager *Manager) {
	// Require a username to be set
	if ok := client.assertUsernameSet(); !ok {
		return
	}

	// Assert recipient (rx) must be string type
	var rx, ok = client.assertString(packet.Rx)
	if !ok {
		return
	}

	// Parse UUID
	id, err := uuid.FromString(rx)
	if err != nil {

		// Tell the client the UUID was invalid and close the connection
		go client.CloseConnectionOnError(
			Opcodes["VIOLATION"],
			"UUID parsing error: peer ID (rx) not a valid UUID format",
			websocket.CloseUnsupportedData,
		)
		return
	}

	// Find client
	manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
	var rxclient, exists = manager.clients[id]
	manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")
	if !exists {

		// Tell origin the recipient peer is invalid
		go UnicastMessage(client, JSONDump(&Packet{
			Opcode: Opcodes["PEER_INVALID"],
		}), nil)
		return
	}

	// Send ICE data to peer
	UnicastMessage(rxclient, JSONDump(&Packet{
		Opcode:  Opcodes["ICE"],
		Payload: packet.Payload,
		Tx:      client.id.String(),
	}), nil)
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
		opcode_KEEPALIVE(message, &packet, client, manager)

	case Opcodes["INIT"]:
		opcode_INIT(message, &packet, client, manager)

	case Opcodes["CONFIG_HOST"]:
		opcode_CONFIG_HOST(message, &packet, client, manager)

	case Opcodes["CONFIG_PEER"]:
		opcode_CONFIG_PEER(message, &packet, client, manager)

	case Opcodes["MAKE_OFFER"]:
		opcode_MAKE_OFFER(message, &packet, client, manager)

	case Opcodes["MAKE_ANSWER"]:
		opcode_MAKE_ANSWER(message, &packet, client, manager)

	case Opcodes["ICE"]:
		opcode_ICE(message, &packet, client, manager)

	default:
		client.CloseConnectionOnError(
			Opcodes["VIOLATION"],
			"Unrecognized opcode / Not a command opcode!",
			websocket.CloseUnsupportedData,
		)
	}
}
