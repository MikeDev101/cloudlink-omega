package cloudlinkOmega

import (
	"log"

	"github.com/gofiber/contrib/websocket"
)

var Managers = map[string]*Manager{}

func (client *Client) CloseWithMessage(statuscode int, closeMessage string) {
	client.connection.WriteMessage(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(
			statuscode,
			closeMessage,
		),
	)
	client.connection.Close()
}

func (client *Client) MessageHandler(manager *Manager) {
	// websocket.Conn bindings https://pkg.go.dev/github.com/fasthttp/websocket?tab=doc#pkg-index
	var (
		_       int
		message []byte
		err     error
	)
	for {
		// Listen for new messages
		if _, message, err = client.connection.ReadMessage(); err != nil {
			break
		}

		log.Printf("[%s] Client %s incoming message: %s", manager.name, client.id, message)
		SignalingOpcode(message, manager, client)
	}
}

func SessionCleanup(manager *Manager, client *Client) {
	// Remove client from manager
	manager.RemoveClient(client)

	// Manage host state
	if client.isHost {

		// Get lobby
		manager.lobbiesMutex.Lock()
		lobby := manager.lobbies[client.lobbyID]
		AllowHostReclaim := lobby.AllowHostReclaim
		AllowPeersToClaimHost := lobby.AllowPeersToClaimHost
		manager.lobbiesMutex.Unlock()

		// Unset host attribute
		if (AllowHostReclaim && AllowPeersToClaimHost) || (AllowHostReclaim) {
			manager.lobbiesMutex.Lock()
			manager.lobbies[client.lobbyID].Host = nil
			manager.lobbiesMutex.Unlock()
		}

		// Gather peers
		manager.lobbiesMutex.RLock()
		peers := manager.lobbies[client.lobbyID].Peers
		manager.lobbiesMutex.RUnlock()

		// Notify peeers they can negotiate a new host on their own
		if AllowHostReclaim && AllowPeersToClaimHost {
			MulticastMessageArray(peers, JSONDump(&Packet{
				Opcode:  Opcodes["HOST_GONE"],
				Payload: client.lobbyID,
			}), client)

		} else if AllowHostReclaim { // Make the next entry in the peers slice the host

			// Update the lobby state
			manager.lobbiesMutex.Lock()
			lobby := manager.lobbies[client.lobbyID]
			lobby.Host = lobby.Peers[0]
			manager.lobbiesMutex.Unlock()

			// Tell peers the server has made this peer the host
			MulticastMessageArray(peers, JSONDump(&PacketPeer{
				Opcode: Opcodes["HOST_RECLAIM"],
				Payload: &PeerDetails{
					Id:       lobby.Host.id,
					Username: lobby.Host.name,
				},
			}), client)

		} else { // Close the lobby

			// Notify peers the lobby is being deleted
			MulticastMessageArray(peers, JSONDump(&Packet{
				Opcode:  Opcodes["LOBBY_CLOSE"],
				Payload: client.lobbyID,
			}), client)

			// Delete host and destroy the lobby
			manager.lobbiesMutex.Lock()
			delete(manager.lobbies, client.lobbyID)
			manager.lobbiesMutex.Unlock()
		}

	} else if client.isPeer { // Manage peer state

		// Get lobby
		manager.lobbiesMutex.Lock()
		lobby := manager.lobbies[client.lobbyID]

		// Remove peer
		lobby.removePeer(client)
		manager.lobbiesMutex.Unlock()

	}

	// Destroy manager if no clients are connected
	if len(manager.clients) == 0 {
		log.Printf("Manager %s is empty", manager.name)
		manager = &Manager{}
	}

}

func New(manager *Manager, con *websocket.Conn) {
	// Register client
	client := NewClient(con, manager)
	manager.AddClient(client)

	// Log IP address of client (if enabled)
	log.Printf("[%s] Client %s IP address: %s", manager.name, client.id, con.RemoteAddr().String())

	// Remove client from manager once the session has ended (and destroy manager if no clients are connected)
	defer SessionCleanup(manager, client)

	// Begin handling messages throughout the lifespan of the connection
	client.MessageHandler(manager)
}
