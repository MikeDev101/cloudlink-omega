package routes

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	constants "github.com/mikedev101/cloudlink-omega/backend/pkg/constants"
	dm "github.com/mikedev101/cloudlink-omega/backend/pkg/data"
	signaling "github.com/mikedev101/cloudlink-omega/backend/pkg/signaling"
	structs "github.com/mikedev101/cloudlink-omega/backend/pkg/structs"
	utils "github.com/mikedev101/cloudlink-omega/backend/pkg/utils"
)

// Define websocket upgrader
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     AuthorizedOrigins,
}

func SignalingRouter(r chi.Router) {
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		dm := r.Context().Value(constants.DataMgrCtx).(*dm.Manager)

		// Upgrade initial GET request to a websocket connection
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			http.Error(w, "Could not open websocket connection", http.StatusInternalServerError)
			return
		}

		// Assert that the UGI query is a valid ULID
		ugi := r.URL.Query().Get("ugi")
		if msg := utils.VariableContainsValidationError("ugi", validate.Var(ugi, "ulid")); msg != nil {
			signaling.SendCodeWithMessage(
				conn,
				msg,
			)
			return
		}

		// Verify validity of provided UGI and get the name of the game, as well as the name of the developer
		var gameName, developerName string
		if gameName, developerName, err = dm.VerifyUGI(ugi); err != nil {
			signaling.SendCodeWithMessage(
				conn,
				err.Error(),
			)
			return
		}

		log.Printf("[Signaling] %s connected to \"%s\" by \"%s\"", r.RemoteAddr, gameName, developerName)

		// Create client
		client := signaling.Manager.Add(&structs.Client{
			Conn:          conn,
			UGI:           ugi,
			GameName:      gameName,
			DeveloperName: developerName,
		})

		// Handle connection with websocket
		signaling.MessageHandler(client, dm, r)

	})
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
