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

var clients *clientmgr.ClientDB
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     AuthorizedOrigins,
}

func init() {
	log.Print("[Signaling] Initializing...")

	// Initialize client manager
	clients = clientmgr.New()

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

// CloseWithCode closes the websocket connection and writes a JSON signal
// packet with a error/warning opcode and the provided message.
//
// conn *websocket.Conn - the websocket connection to be closed
// message string - the message to be included in the violation signal packet
// customcode string - the custom violation code to be included in the signal packet. If not provided, "VIOLATION" is used.
func CloseWithCode(conn *websocket.Conn, message any, customcode ...string) {
	var opcode = "VIOLATION"
	if customcode != nil {
		opcode = customcode[0]
	}

	defer conn.Close()
	conn.WriteJSON(&structs.SignalPacket{Opcode: opcode, Payload: message})
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
	if VariableContainsValidationError(&structs.Client{Conn: conn}, "ugi", validate.Var(ugi, "ulid")) {
		return
	}

	// Verify validity of provided UGI and get the name of the game, as well as the name of the developer
	var gameName, developerName string
	if gameName, developerName, err = dm.VerifyUGI(ugi); err != nil {
		CloseWithCode(conn, err.Error())
		return
	}

	log.Printf("%s connected to \"%s\" by \"%s\"", r.RemoteAddr, gameName, developerName)

	// Create client
	client := clients.Add(&structs.Client{Conn: conn, UGI: ugi, GameName: gameName, DeveloperName: developerName})

	// Handle connection with websocket
	defer clients.Delete(client)
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
			CloseWithCode(c.Conn, errstring)
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
	if !c.ValidSession {
		CloseWithCode(c.Conn, "CONFIG_REQUIRED: You must initialize a session before declaring a host.")
		return
	}

	// Create temporary nested struct
	packet := &structs.SignalPacket{
		Payload: &structs.HostConfigParams{},
	}

	// Unmarshal
	if err := json.Unmarshal(rawPacket, &packet); err != nil {
		CloseWithCode(c.Conn, err.Error())
		return
	}

	// Validate
	if StructContainsValidationError(c, validate.Struct(packet)) {
		return
	}
}

func HandleKeepaliveOpcode(c *structs.Client) {
	SendMessage(c, &structs.SignalPacket{
		Opcode: "KEEPALIVE",
	})
}

func HandleInitOpcode(c *structs.Client, packet *structs.SignalPacket, dm *dm.Manager, r *http.Request) {
	if c.ValidSession {
		SendMessage(c, &structs.SignalPacket{
			Opcode:  "WARN",
			Payload: "CONFIG_EXISTS: You have already initialized a session. Please close the current session before initializing a new one.",
		})
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
		CloseWithCode(c.Conn, err.Error())
		return
	}

	// Check if the user is already connected
	if clients.GetClientByULID(tmpClient.ULID) != nil {
		CloseWithCode(c.Conn, "SESSION_EXISTS: You are already connected in another session. Please close the current session before initializing a new one.")
		return
	}

	// Check if origin matches
	if tmpClient.Origin != r.URL.Hostname() {
		CloseWithCode(c.Conn, "TOKEN_ORIGIN_MISMATCH: Session token's origin does not match the origin of the signaling request.")
		return
	}

	// Check if token has expired
	if tmpClient.Expiry < time.Now().Unix() {
		CloseWithCode(c.Conn, "TOKEN_EXPIRED: Session token has expired.")
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

func SendMessage(c *structs.Client, packet *structs.SignalPacket) {
	c.Conn.WriteJSON(packet)
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
		CloseWithCode(c.Conn, msg)
		return true
	}

	return false
}

func VariableContainsValidationError(c *structs.Client, varname string, err error) bool {
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
		CloseWithCode(c.Conn, msg)
		return true
	}
	return false
}
