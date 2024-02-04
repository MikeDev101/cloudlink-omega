package signaling

import (
	"fmt"
	"log"
	"net/http"
	"reflect"
	"time"

	"github.com/gorilla/websocket"

	validator "github.com/go-playground/validator/v10"
	json "github.com/goccy/go-json"
	accounts "github.com/mikedev101/cloudlink-omega/backend/pkg/accounts"
	dm "github.com/mikedev101/cloudlink-omega/backend/pkg/data"
	clientmgr "github.com/mikedev101/cloudlink-omega/backend/pkg/signaling/clientmgr"
	structs "github.com/mikedev101/cloudlink-omega/backend/pkg/structs"
	utils "github.com/mikedev101/cloudlink-omega/backend/pkg/utils"
)

// Define global variables
var validate = validator.New(validator.WithRequiredStructEnabled())
var Manager *clientmgr.ClientDB

func init() {
	log.Print("[Signaling] Initializing...")

	// Initialize client manager
	Manager = clientmgr.New()

	// Register custom label function for validator
	validate.RegisterTagNameFunc(func(field reflect.StructField) string {
		return field.Tag.Get("label")
	})

	log.Print("[Signaling] Initialized!")
}

// MessageHandler handles incoming messages from the browser using a websocket connection.
func MessageHandler(c *structs.Client, dm *dm.Manager, r *http.Request) {
	log.Printf("[Signaling] Spawning handler for client %d", c.ID)

	var err error
	defer CloseHandler(c)
	for {
		_, rawPacket, _ := c.Conn.ReadMessage()

		// Read messages from browser as JSON using SignalPacket struct.
		packet := &structs.SignalPacket{}
		if err = json.Unmarshal(rawPacket, &packet); err != nil {
			errstring := fmt.Sprintf("[Signaling] Error reading packet: %s", err)
			log.Println(errstring)
			SendCodeWithMessage(
				c.Conn,
				errstring,
			)
			return
		}

		// Handle packet
		switch packet.Opcode {
		case "INIT":
			HandleInitOpcode(c, packet, dm, r)
		case "KEEPALIVE":
			HandleKeepaliveOpcode(c, packet)
		case "CONFIG_HOST":
			HandleConfigHostOpcode(c, packet, rawPacket)
		case "CONFIG_PEER":
			HandleConfigPeerOpcode(c, packet, rawPacket)
		case "MAKE_OFFER":
			HandleMakeOfferOpcode(c, packet)
		case "MAKE_ANSWER":
			HandleMakeAnswerOpcode(c, packet)
		case "ICE":
			HandleICEOpcode(c, packet)
		}
	}
}

func HandleICEOpcode(c *structs.Client, packet *structs.SignalPacket) {
	// Check if the client has a valid session
	if !c.ValidSession {
		SendCodeWithMessage(c, nil, "CONFIG_REQUIRED", packet.Listener)
		return
	}

	// Verify the recipient argument is a valid ULID
	if msg := utils.VariableContainsValidationError("recipient", validate.Var(packet.Recipient, "ulid")); msg != nil {
		SendCodeWithMessage(c, msg, "WARNING", packet.Listener)
		return
	}

	// Check if the recipient exists
	recipient := Manager.GetClientBySpecificULIDinUGIAndLobby(packet.Recipient, c.UGI, c.Lobby)
	if recipient == nil {
		SendCodeWithMessage(c, nil, "PEER_INVALID", packet.Listener)
		return
	}

	// Relay the offer
	SendMessage(recipient, &structs.SignalPacket{
		Opcode:  "ICE",
		Origin:  c.UGI,
		Payload: packet.Payload,
	})

	// Tell the peer that the answer was relayed successfully
	SendCodeWithMessage(c, nil, "RELAY_OK", packet.Listener)
}

func HandleMakeAnswerOpcode(c *structs.Client, packet *structs.SignalPacket) {
	// Check if the client has a valid session
	if !c.ValidSession {
		SendCodeWithMessage(c, nil, "CONFIG_REQUIRED", packet.Listener)
		return
	}

	// Require that the client is a peer
	if !c.IsPeer {
		SendCodeWithMessage(c, nil, "NOT_PEER", packet.Listener)
		return
	}

	// Verify the recipient argument is a valid ULID
	if msg := utils.VariableContainsValidationError("recipient", validate.Var(packet.Recipient, "ulid")); msg != nil {
		SendCodeWithMessage(c, msg, "WARNING", packet.Listener)
		return
	}

	// Check if the recipient exists
	recipient := Manager.GetClientBySpecificULIDinUGIAndLobby(packet.Recipient, c.UGI, c.Lobby)
	if recipient == nil {
		SendCodeWithMessage(c, nil, "PEER_INVALID", packet.Listener)
		return
	}

	// Relay the offer
	SendMessage(recipient, &structs.SignalPacket{
		Opcode:  "MAKE_ANSWER",
		Origin:  c.UGI,
		Payload: packet.Payload,
	})

	// Tell the peer that the answer was relayed successfully
	SendCodeWithMessage(c, nil, "RELAY_OK", packet.Listener)
}

func HandleMakeOfferOpcode(c *structs.Client, packet *structs.SignalPacket) {
	// Check if the client has a valid session
	if !c.ValidSession {
		SendCodeWithMessage(c, nil, "CONFIG_REQUIRED", packet.Listener)
		return
	}

	// Require that the client is a host
	if !c.IsHost {
		SendCodeWithMessage(c, nil, "NOT_HOST", packet.Listener)
		return
	}

	// Verify the recipient argument is a valid ULID
	if msg := utils.VariableContainsValidationError("recipient", validate.Var(packet.Recipient, "ulid")); msg != nil {
		SendCodeWithMessage(c, msg, "WARNING", packet.Listener)
		return
	}

	// Check if the recipient exists
	recipient := Manager.GetClientBySpecificULIDinUGIAndLobby(packet.Recipient, c.UGI, c.Lobby)
	if recipient == nil {
		SendCodeWithMessage(c, nil, "PEER_INVALID", packet.Listener)
		return
	}

	// Relay the offer
	SendMessage(recipient, &structs.SignalPacket{
		Opcode:  "MAKE_OFFER",
		Origin:  c.UGI,
		Payload: packet.Payload,
	})

	// Tell the host that the offer was relayed successfully
	SendCodeWithMessage(c, nil, "RELAY_OK", packet.Listener)
}

// HandleConfigPeerOpcode handles the CONFIG_PEER opcode.
func HandleConfigPeerOpcode(c *structs.Client, packet *structs.SignalPacket, rawPacket []byte) {
	// Check if the client has a valid session
	if !c.ValidSession {
		SendCodeWithMessage(c, nil, "CONFIG_REQUIRED", packet.Listener)
		return
	}

	// Check if the client is already a peer
	if c.IsPeer {
		SendCodeWithMessage(c, nil, "ALREADY_HOST", packet.Listener)
		return
	}

	// Remarshal using PeerConfigPacket
	rePacket := &structs.PeerConfigPacket{}
	if err := json.Unmarshal(rawPacket, &rePacket); err != nil {
		log.Printf("[Signaling] Error reading packet: %s", err)
		SendCodeWithMessage(c, err.Error())
		return
	}

	// Validate
	if msg := utils.StructContainsValidationError(validate.Struct(rePacket.Payload)); msg != nil {
		SendCodeWithMessage(c, msg)
		return
	}

	// Check if the desired lobby exists. If not, return a message.
	hosts := Manager.GetHostClientsByUGIAndLobby(c.UGI, rePacket.Payload.LobbyID)
	if len(hosts) == 0 {
		// Cannot join lobby since it does not exist
		SendCodeWithMessage(c, nil, "LOBBY_NOTFOUND", packet.Listener)
		return
	}
	if len(hosts) > 1 {
		log.Fatalf("[Signaling] Multiple hosts found for UGI %s and lobby %s. This should never happen. Shutting down...", c.UGI, rePacket.Payload.LobbyID)
	}

	// Get lobby
	lobby := Manager.GetLobbyConfigStorage(c.UGI, rePacket.Payload.LobbyID)

	// Check if lobby is full, or no limit is set (0)
	if lobby.MaximumPeers != 0 {

		// Get a count of all peers in the lobby
		peers := len(Manager.GetPeerClientsByUGIAndLobby(c.UGI, rePacket.Payload.LobbyID))

		// Check if the lobby is full
		if peers >= lobby.MaximumPeers {
			SendCodeWithMessage(c, nil, "LOBBY_FULL", packet.Listener)
			return
		}
	}

	// Check if the lobby is currently locked, and if so, abort
	if lobby.Locked {
		SendCodeWithMessage(c, nil, "LOBBY_LOCKED", packet.Listener)
		return
	}

	// Verify password
	if err := accounts.VerifyPassword(rePacket.Payload.Password, lobby.Password); err != nil {
		SendCodeWithMessage(c, nil, "PASSWORD_FAIL", packet.Listener)
		return
	}

	// Config the client as a peer
	c.IsPeer = true
	c.Lobby = rePacket.Payload.LobbyID

	// Notify the host that a new peer has joined
	SendMessage(hosts[0], &structs.SignalPacket{
		Opcode: "NEW_PEER",
		Payload: &structs.NewPeerParams{
			ID:   c.ULID,
			User: c.Username,
		},
	})

	// Tell the client that they are now a peer
	SendCodeWithMessage(c, nil, "ACK_PEER", packet.Listener)
}

// HandleConfigHostOpcode handles the CONFIG_HOST opcode.
func HandleConfigHostOpcode(c *structs.Client, packet *structs.SignalPacket, rawPacket []byte) {
	// Check if the client has a valid session
	if !c.ValidSession {
		SendCodeWithMessage(c, nil, "CONFIG_REQUIRED", packet.Listener)
		return
	}

	// Check if the client is already a host
	if c.IsHost {
		SendCodeWithMessage(c, nil, "ALREADY_HOST", packet.Listener)
		return
	}

	// Remarshal using HostConfigPacket
	rePacket := &structs.HostConfigPacket{}
	if err := json.Unmarshal(rawPacket, &rePacket); err != nil {
		log.Printf("[Signaling] Error reading packet: %s", err)
		SendCodeWithMessage(c, err.Error())
		return
	}

	// Validate
	if msg := utils.StructContainsValidationError(validate.Struct(rePacket.Payload)); msg != nil {
		SendCodeWithMessage(c, msg)
		return
	}

	// Check if a lobby exists within the current game. If not, create one.
	matches := Manager.GetHostClientsByUGIAndLobby(c.UGI, rePacket.Payload.LobbyID)
	if len(matches) != 0 {
		// Cannot create lobby since it already exists
		SendCodeWithMessage(c, "LOBBY_EXISTS", packet.Listener)
		return
	}

	// Config the client as a host
	c.IsHost = true
	c.Lobby = rePacket.Payload.LobbyID

	// Create lobby and store the desired settings
	lobby := Manager.CreateLobbyConfigStorage(c.UGI, rePacket.Payload.LobbyID)

	// Store lobby settings.
	// TODO: I'm pretty sure there's a more elegant way to do this...
	lobby.ID = rePacket.Payload.LobbyID
	lobby.MaximumPeers = rePacket.Payload.MaximumPeers
	lobby.AllowHostReclaim = rePacket.Payload.AllowHostReclaim
	lobby.AllowPeersToReclaim = rePacket.Payload.AllowPeersToReclaim
	lobby.CurrentOwnerID = c.ID
	lobby.CurrentOwnerULID = c.ULID
	lobby.Locked = false

	// Hash the password to store
	lobby.Password = accounts.HashPassword(rePacket.Payload.Password)

	// Broadcast new host
	log.Printf("[Signaling] Client %d is now a host in lobby %s and UGI %s", c.ID, rePacket.Payload.LobbyID, c.UGI)
	BroadcastMessage(Manager.GetAllClientsWithoutLobby(c.UGI), &structs.SignalPacket{
		Opcode: "NEW_HOST",
		Payload: &structs.NewHostParams{
			ID:      c.ULID,
			User:    c.Username,
			LobbyID: c.Lobby,
		},
	})

	// Tell the client the lobby has been created
	SendCodeWithMessage(c, nil, "ACK_HOST", packet.Listener)
}

// HandleKeepaliveOpcode handles the KEEPALIVE opcode.
func HandleKeepaliveOpcode(c *structs.Client, packet *structs.SignalPacket) {
	SendCodeWithMessage(c, nil, "KEEPALIVE", packet.Listener)
}

// HandleInitOpcode handles the INIT opcode.
func HandleInitOpcode(c *structs.Client, packet *structs.SignalPacket, dm *dm.Manager, r *http.Request) {
	if c.ValidSession {
		SendCodeWithMessage(c, nil, "SESSION_EXISTS", packet.Listener)
		return
	}

	// Assert the payload is a string, and a valid ULID
	var ulidToken string
	if msg := utils.VariableContainsValidationError("payload", validate.Var(packet.Payload, "ulid")); msg != nil {
		SendCodeWithMessage(c, msg)
		return
	} else {
		ulidToken = packet.Payload.(string)
	}

	// Check if the token is valid in the DB
	tmpClient, err := dm.VerifySessionToken(ulidToken)
	if err != nil {
		SendCodeWithMessage(c, err.Error(), "TOKEN_INVALID", packet.Listener)
		return
	}

	// Check if the user is already connected
	if Manager.GetClientByULID(tmpClient.ULID) != nil {
		SendCodeWithMessage(c, nil, "SESSION_EXISTS", packet.Listener)
		return
	}

	// Check if origin matches
	if tmpClient.Origin != r.URL.Hostname() {
		SendCodeWithMessage(c, nil, "TOKEN_ORIGIN_MISMATCH", packet.Listener)
		return
	}

	// Check if token has expired
	if tmpClient.Expiry < time.Now().Unix() {
		SendCodeWithMessage(c, nil, "TOKEN_EXPIRED", packet.Listener)
		return
	}

	// Configure client session
	c.Authorization = packet.Payload.(string)
	c.ULID = tmpClient.ULID
	c.Username = tmpClient.Username
	c.Expiry = tmpClient.Expiry
	c.ValidSession = true

	// Get game name and developer name for the client
	gameName, developerName, _ := dm.VerifyUGI(c.UGI)

	// Send INIT_OK signal

	SendCodeWithMessage(c, &structs.InitOK{
		User:      c.Username,
		Id:        tmpClient.ULID,
		Game:      gameName,
		Developer: developerName,
	},
		"INIT_OK",
		packet.Listener,
	)
}

// SendMessage sends a signaling message to a client.
func SendMessage(c *structs.Client, packet any) {
	if c == nil {
		log.Println("[Signaling] WARNING: Attempted to send a message to a nil client.")
		return
	}

	// Get a lock so that we don't send multiple messages at once
	c.Lock.Lock()

	// Send message and unlock
	defer c.Lock.Unlock()
	c.Conn.WriteJSON(packet)
}

// BroadcastMessage sends a signaling message to an array of clients.
func BroadcastMessage(c []*structs.Client, packet any) {
	for _, client := range c {
		go SendMessage(client, packet)
	}
}

// SendCodeWithMessage sends a signaling message to a client.
// If a custom error code is not provided, the VIOLATION opcode will be used and the
// connection will be closed afterwards.
func SendCodeWithMessage(conn any, message any, extraargs ...string) {
	var client *websocket.Conn

	// Handle connection type
	switch v := conn.(type) {
	case *websocket.Conn:
		client = v
	case *structs.Client:
		client = v.Conn
	default:
		panic("[Signaling] Attempted to send a code message to a invalid type. ")
	}

	if len(extraargs) == 0 || extraargs == nil {
		defer client.Close()
		client.WriteJSON(&structs.SignalPacket{
			Opcode:  "VIOLATION",
			Payload: message,
		})
		return
	}

	// Send code
	if len(extraargs) == 1 {
		client.WriteJSON(&structs.SignalPacket{
			Opcode:  extraargs[0],
			Payload: message,
		})
		return
	}

	// Send code with listener
	client.WriteJSON(&structs.SignalPacket{
		Opcode:   extraargs[0],
		Payload:  message,
		Listener: extraargs[1],
	})
}

// CloseHandler prepares a client to be deleted.
func CloseHandler(client *structs.Client) {
	// Before we delete the client, check if it was a host.
	if client.IsHost {

		// For the time being, remove all peers from the lobby. Same as disabling host reclaim.
		for _, peer := range Manager.GetPeerClientsByUGIAndLobby(client.UGI, client.Lobby) {
			// Lock the peer, set it to not a peer, and unlock it
			peer.Lock.Lock()
			defer peer.Lock.Unlock()
			func() {
				peer.IsPeer = false
				peer.Lobby = ""
			}()

			// Tell the peer the lobby is closing
			SendCodeWithMessage(peer, nil, "LOBBY_CLOSE")
		}

		// If the client was a host, check if the lobby is empty. If it is, delete the lobby.
		peers := len(Manager.GetPeerClientsByUGIAndLobby(client.UGI, client.Lobby))
		if peers == 0 {
			log.Printf("[Client Manager] Deleting unused lobby config store %s in UGI %s...", client.Lobby, client.UGI)
			delete(Manager.Lobbies[client.UGI], client.Lobby)
		}

		// Check if the root UGI has no remaining lobbies. If there are no remaining lobbies, delete the root UGI lobby manager.
		if len(Manager.Lobbies[client.UGI]) == 0 {
			log.Printf("[Client Manager] Deleting unused UGI %s root lobby config store...", client.UGI)
			delete(Manager.Lobbies, client.UGI)
		}

	} else if client.IsPeer { // Check if the client is a peer. If it is, remove it from the lobby.

		// Notify the host that the peer is going away.
		lobby := Manager.GetLobbyConfigStorage(client.UGI, client.Lobby)
		host := Manager.GetClientByULID(lobby.CurrentOwnerULID)
		SendCodeWithMessage(host, client.ULID, "PEER_GONE")

	}

	// Finally, delete the client
	Manager.Delete(client)

	// Close connection.
	client.Conn.Close()
}
