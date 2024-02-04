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
//
// Parameter(s):
//
//	conn *websocket.Conn - the websocket connection
//
// Return type(s): None
func MessageHandler(c *structs.Client, dm *dm.Manager, r *http.Request) {
	log.Printf("[Signaling] Spawning handler for client %d", c.ID)

	var err error
	defer c.Conn.Close()
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
			HandleKeepaliveOpcode(c)
		case "CONFIG_HOST":
			HandleConfigHostOpcode(c, rawPacket)
		case "CONFIG_PEER":
			HandleConfigPeerOpcode(c, rawPacket)
		}
	}
}

// SendCodeWithMessage sends a websocket message with an error code.
// If customcode is provided, the VIOLATION opcode will be used, and the
// connection will be closed afterwards.
func SendCodeWithMessage(conn any, message any, customcode ...string) {
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

	// Send code
	if customcode != nil {
		client.WriteJSON(&structs.SignalPacket{
			Opcode:  customcode[0],
			Payload: message,
		})
	} else {
		defer client.Close()
		client.WriteJSON(&structs.SignalPacket{
			Opcode:  "VIOLATION",
			Payload: message,
		})
	}
}

func PrepareToClose(client *structs.Client) {
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
}

func HandleConfigPeerOpcode(c *structs.Client, rawPacket []byte) {
	// Check if the client has a valid session
	if !c.ValidSession {
		SendCodeWithMessage(c, nil, "CONFIG_REQUIRED")
		return
	}

	// Check if the client is already a peer
	if c.IsPeer {
		SendCodeWithMessage(c, nil, "ALREADY_HOST")
		return
	}

	// Remarshal using PeerConfigPacket
	packet := &structs.PeerConfigPacket{}
	if err := json.Unmarshal(rawPacket, &packet); err != nil {
		log.Printf("[Signaling] Error reading packet: %s", err)
		SendCodeWithMessage(c, err.Error())
		return
	}

	// Validate
	if msg := utils.StructContainsValidationError(validate.Struct(packet.Payload)); msg != nil {
		SendCodeWithMessage(c, msg)
		return
	}

	// Check if the desired lobby exists. If not, return a message.
	hosts := Manager.GetHostClientsByUGIAndLobby(c.UGI, packet.Payload.LobbyID)
	if len(hosts) == 0 {
		// Cannot join lobby since it does not exist
		SendCodeWithMessage(c, nil, "LOBBY_NOTFOUND")
		return
	}
	if len(hosts) > 1 {
		log.Fatalf("[Signaling] Multiple hosts found for UGI %s and lobby %s. This should never happen. Shutting down...", c.UGI, packet.Payload.LobbyID)
	}

	// Get lobby
	lobby := Manager.GetLobbyConfigStorage(c.UGI, packet.Payload.LobbyID)

	// Check if lobby is full, or no limit is set (0)
	if lobby.MaximumPeers != 0 {

		// Get a count of all peers in the lobby
		peers := len(Manager.GetPeerClientsByUGIAndLobby(c.UGI, packet.Payload.LobbyID))

		// Check if the lobby is full
		if peers >= lobby.MaximumPeers {
			SendCodeWithMessage(c, nil, "LOBBY_FULL")
			return
		}
	}

	// Check if the lobby is currently locked, and if so, abort
	if lobby.Locked {
		SendCodeWithMessage(c, nil, "LOBBY_LOCKED")
		return
	}

	// Check if a password is required, and if so, verify the password
	/*if lobby.PasswordRequired {
		if err := accounts.VerifyPassword(packet.Payload.Password, lobby.Password); err != nil {
			SendCodeWithMessage(c,
				"Password incorrect.",
				"PASSWORD_FAIL",
			)
			return
		}
	}*/
	if err := accounts.VerifyPassword(packet.Payload.Password, lobby.Password); err != nil {
		SendCodeWithMessage(c, nil, "PASSWORD_FAIL")
		return
	}

	// Config the client as a peer
	c.IsPeer = true
	c.Lobby = packet.Payload.LobbyID

	// Notify the host that a new peer has joined
	SendMessage(hosts[0], &structs.SignalPacket{
		Opcode: "NEW_PEER",
		Payload: &structs.NewPeerParams{
			ID:   c.ULID,
			User: c.Username,
		},
	})

	// Tell the client that they are now a peer
	SendCodeWithMessage(c, nil, "ACK_PEER")
}

func HandleConfigHostOpcode(c *structs.Client, rawPacket []byte) {
	// Check if the client has a valid session
	if !c.ValidSession {
		SendCodeWithMessage(c, nil, "CONFIG_REQUIRED")
		return
	}

	// Check if the client is already a host
	if c.IsHost {
		SendCodeWithMessage(c, nil, "ALREADY_HOST")
		return
	}

	// Remarshal using HostConfigPacket
	packet := &structs.HostConfigPacket{}
	if err := json.Unmarshal(rawPacket, &packet); err != nil {
		log.Printf("[Signaling] Error reading packet: %s", err)
		SendCodeWithMessage(c, err.Error())
		return
	}

	// Validate
	if msg := utils.StructContainsValidationError(validate.Struct(packet.Payload)); msg != nil {
		SendCodeWithMessage(c, msg)
		return
	}

	// Check if a lobby exists within the current game. If not, create one.
	matches := Manager.GetHostClientsByUGIAndLobby(c.UGI, packet.Payload.LobbyID)
	if len(matches) != 0 {
		// Cannot create lobby since it already exists
		SendCodeWithMessage(c, "LOBBY_EXISTS")
		return
	}

	// Config the client as a host
	c.IsHost = true
	c.Lobby = packet.Payload.LobbyID

	// Create lobby and store the desired settings
	lobby := Manager.CreateLobbyConfigStorage(c.UGI, packet.Payload.LobbyID)

	// Store lobby settings.
	// TODO: I'm pretty sure there's a more elegant way to do this...
	lobby.ID = packet.Payload.LobbyID
	lobby.MaximumPeers = packet.Payload.MaximumPeers
	lobby.AllowHostReclaim = packet.Payload.AllowHostReclaim
	lobby.AllowPeersToReclaim = packet.Payload.AllowPeersToReclaim
	lobby.CurrentOwnerID = c.ID
	lobby.CurrentOwnerULID = c.ULID
	// lobby.PasswordRequired = (packet.Payload.Password != "")
	lobby.Locked = false

	// Hash the password to store
	/*if lobby.PasswordRequired {
		lobby.Password = accounts.HashPassword(packet.Payload.Password)
	}*/
	lobby.Password = accounts.HashPassword(packet.Payload.Password)

	// Broadcast new host
	log.Printf("[Signaling] Client %d is now a host in lobby %s and UGI %s", c.ID, packet.Payload.LobbyID, c.UGI)
	BroadcastMessage(Manager.GetAllClientsWithoutLobby(c.UGI), &structs.SignalPacket{
		Opcode: "NEW_HOST",
		Payload: &structs.NewHostParams{
			ID:      c.ULID,
			User:    c.Username,
			LobbyID: c.Lobby,
		},
	})

	// Tell the client the lobby has been created
	SendCodeWithMessage(c, nil, "ACK_HOST")
}

func HandleKeepaliveOpcode(c *structs.Client) {
	SendCodeWithMessage(c, nil, "KEEPALIVE")
}

func HandleInitOpcode(c *structs.Client, packet *structs.SignalPacket, dm *dm.Manager, r *http.Request) {
	if c.ValidSession {
		SendCodeWithMessage(c, nil, "SESSION_EXISTS")
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
		SendCodeWithMessage(c.Conn, err.Error())
		return
	}

	// Check if the user is already connected
	if Manager.GetClientByULID(tmpClient.ULID) != nil {
		SendCodeWithMessage(c, nil, "SESSION_EXISTS")
		return
	}

	// Check if origin matches
	if tmpClient.Origin != r.URL.Hostname() {
		SendCodeWithMessage(c, nil, "TOKEN_ORIGIN_MISMATCH")
		return
	}

	// Check if token has expired
	if tmpClient.Expiry < time.Now().Unix() {
		SendCodeWithMessage(c, nil, "TOKEN_EXPIRED")
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
	SendMessage(c, &structs.SignalPacket{
		Opcode: "INIT_OK",
		Payload: &structs.InitOK{
			User:      c.Username,
			Id:        tmpClient.ULID,
			Game:      gameName,
			Developer: developerName,
		},
	})
}

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

func BroadcastMessage(c []*structs.Client, packet any) {
	for _, client := range c {
		go SendMessage(client, packet)
	}
}
