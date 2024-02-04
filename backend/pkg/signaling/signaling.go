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
	constants "github.com/mikedev101/cloudlink-omega/backend/pkg/constants"
	dm "github.com/mikedev101/cloudlink-omega/backend/pkg/data"
	clientmgr "github.com/mikedev101/cloudlink-omega/backend/pkg/signaling/clientmgr"
	structs "github.com/mikedev101/cloudlink-omega/backend/pkg/structs"
)

// Define global variables
var validate = validator.New(validator.WithRequiredStructEnabled())

var manager *clientmgr.ClientDB
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     AuthorizedOrigins,
}

func init() {
	log.Print("[Signaling] Initializing...")

	// Initialize client manager
	manager = clientmgr.New()

	// Register custom label function for validator
	validate.RegisterTagNameFunc(func(field reflect.StructField) string {
		return field.Tag.Get("label")
	})

	log.Print("[Signaling] Initialized!")
}

// AuthorizedOrigins is a Go function that implements CORS. It queries the database for authorized origins.
//
// r *http.Request
// bool
func AuthorizedOrigins(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	host := r.URL.Hostname()
	log.Printf("[Signaling] New incoming connection from origin: %s, Host: %s\n", origin, host)
	// TODO: Implement CORS. Query the database for authorized origins, etc. For now, return true.
	return true
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

// SignalingHandler handles the websocket connection upgrade and message handling.
//
// c *http.Request
func SignalingHandler(w http.ResponseWriter, r *http.Request) {
	dm := r.Context().Value(constants.DataMgrCtx).(*dm.Manager)

	// Upgrade initial GET request to a websocket connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "Could not open websocket connection", http.StatusInternalServerError)
		return
	}

	// Assert that the UGI query is a valid ULID
	ugi := r.URL.Query().Get("ugi")
	if VariableContainsValidationError(
		conn,
		"ugi",
		validate.Var(ugi, "ulid"),
	) {
		return
	}

	// Verify validity of provided UGI and get the name of the game, as well as the name of the developer
	var gameName, developerName string
	if gameName, developerName, err = dm.VerifyUGI(ugi); err != nil {
		SendCodeWithMessage(
			conn,
			err.Error(),
		)
		return
	}

	log.Printf("%s connected to \"%s\" by \"%s\"", r.RemoteAddr, gameName, developerName)

	// Create client
	client := manager.Add(&structs.Client{
		Conn:          conn,
		UGI:           ugi,
		GameName:      gameName,
		DeveloperName: developerName,
	})

	// Handle connection with websocket
	defer manager.Delete(client)
	MessageHandler(client, dm, r)
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
		}
	}
}

func HandleConfigHostOpcode(c *structs.Client, rawPacket []byte) {
	// Check if the client has a valid session
	if !c.ValidSession {
		SendCodeWithMessage(
			c,
			"You must initialize a session before declaring a host.",
			"CONFIG_REQUIRED",
		)
		return
	}

	// Check if the client is already a host
	if c.IsHost {
		SendCodeWithMessage(c,
			"You are already a host.",
			"ALREADY_HOST",
		)
		return
	}

	// Remarshal using HostConfigPacket
	packet := &structs.HostConfigPacket{}
	if err := json.Unmarshal(rawPacket, &packet); err != nil {
		errstring := fmt.Sprintf("[Signaling] Error reading packet: %s", err)
		log.Println(errstring)
		SendCodeWithMessage(
			c.Conn,
			errstring,
		)
		return
	}

	// Validate
	if StructContainsValidationError(c, validate.Struct(packet.Payload)) {
		return
	}

	// Check if a lobby exists within the current game. If not, create one.
	matches := manager.GetHostClientsByUGIAndLobby(c.UGI, packet.Payload.LobbyID)
	if len(matches) != 0 {
		// Cannot create lobby since it already exists
		SendCodeWithMessage(c,
			"Lobby already exists.",
			"LOBBY_EXISTS",
		)
		return
	}

	// Config the client as a host
	c.IsHost = true
	c.Lobby = packet.Payload.LobbyID

	// Create lobby and store the desired settings
	lobby := manager.CreateLobbyConfigStorage(c.UGI, packet.Payload.LobbyID)

	// Store lobby settings. TODO: I'm pretty sure there's a more elegant way to do this...
	lobby.ID = packet.Payload.LobbyID
	lobby.MaximumPeers = packet.Payload.MaximumPeers
	lobby.AllowHostReclaim = packet.Payload.AllowHostReclaim
	lobby.AllowPeersToReclaim = packet.Payload.AllowPeersToReclaim
	lobby.CurrentOwnerID = c.ID
	lobby.CurrentOwnerULID = c.ULID

	// Broadcast new host
	log.Printf("[Signaling] Client %d is now a host in lobby %s and UGI %s", c.ID, packet.Payload.LobbyID, c.UGI)
	BroadcastMessage(manager.GetAllClientsWithoutLobby(c.UGI), &structs.SignalPacket{
		Opcode: "NEW_HOST",
		Payload: &structs.NewHostParams{
			ID:      c.ULID,
			User:    c.Username,
			LobbyID: c.Lobby,
		},
	})

	// Tell the client the lobby has been created
	SendMessage(c, &structs.SignalPacket{
		Opcode: "ACK_HOST",
	})
}

func HandleKeepaliveOpcode(c *structs.Client) {
	SendMessage(c, &structs.SignalPacket{
		Opcode: "KEEPALIVE",
	})
}

func HandleInitOpcode(c *structs.Client, packet *structs.SignalPacket, dm *dm.Manager, r *http.Request) {
	if c.ValidSession {
		SendCodeWithMessage(
			c,
			"You have already initialized a session. Please close the current session before initializing a new one.",
			"SESSION_EXISTS",
		)
		return
	}

	// Assert the payload is a string, and a valid ULID
	var ulidToken string
	if VariableContainsValidationError(c, "payload", validate.Var(packet.Payload, "ulid")) {
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
	if manager.GetClientByULID(tmpClient.ULID) != nil {
		SendCodeWithMessage(c.Conn, "You are already connected in another session. Please close the current session before initializing a new one.", "SESSION_EXISTS")
		return
	}

	// Check if origin matches
	if tmpClient.Origin != r.URL.Hostname() {
		SendCodeWithMessage(c.Conn, "Session token's origin does not match the origin of the signaling request.", "TOKEN_ORIGIN_MISMATCH")
		return
	}

	// Check if token has expired
	if tmpClient.Expiry < time.Now().Unix() {
		SendCodeWithMessage(c.Conn, "Session token has expired.", "TOKEN_EXPIRED")
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

func StructContainsValidationError(c *structs.Client, err error) bool {
	if err != nil && len(err.(validator.ValidationErrors)) > 0 {
		type RootError struct {
			Errors []map[string]string `json:"Validation error"`
		}

		// Create error messages
		msg := RootError{}
		// Unwrap all errors
		for _, err := range err.(validator.ValidationErrors) {
			// Create all error messages
			entry := map[string]string{}
			entry[err.Field()] = err.Tag()
			msg.Errors = append(msg.Errors, entry)
		}

		// Write error message to response
		SendCodeWithMessage(c.Conn, msg)
		return true
	}

	return false
}

func VariableContainsValidationError(c any, varname string, err error) bool {
	if err != nil && len(err.(validator.ValidationErrors)) > 0 {
		type RootError struct {
			Errors []map[string]string `json:"Validation error"`
		}

		// Create error message
		msg := RootError{}

		// Unwrap single error
		err := err.(validator.ValidationErrors)[0]

		// Create error message
		entry := map[string]string{}
		entry[varname] = err.Tag()
		msg.Errors = append(msg.Errors, entry)

		// Write error message to response
		SendCodeWithMessage(
			c,
			msg,
		)
		return true
	}
	return false
}
