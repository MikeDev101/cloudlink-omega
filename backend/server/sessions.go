package cloudlinkOmega

import (
	"log"

	"github.com/gofiber/contrib/websocket"
)

var Managers = map[string]*Manager{}

func Remove(manager *Manager) {
	delete(Managers, manager.Name)
	manager = nil
}

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
		SignalingOpcode(message, manager, client)
	}
}

func (manager *Manager) AbandonLobbies(client *Client) {
	// Manage host state
	if client.isHost {

		// Get lobby
		manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
		lobby := manager.lobbies[client.lobbyID]
		AllowHostReclaim := lobby.AllowHostReclaim
		AllowPeersToClaimHost := lobby.AllowPeersToClaimHost
		manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")

		// Unset host attribute
		if (AllowHostReclaim && AllowPeersToClaimHost) || (AllowHostReclaim) {
			manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
			manager.lobbies[client.lobbyID].Host = nil
			manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")
		}

		// Gather peers
		manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
		peers := manager.lobbies[client.lobbyID].Peers
		manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")

		// Notify peeers they can negotiate a new host on their own
		if AllowHostReclaim && AllowPeersToClaimHost {
			MulticastMessageArray(peers, JSONDump(&Packet{
				Opcode:  Opcodes["HOST_GONE"],
				Payload: client.lobbyID,
			}), client)

		} else if AllowHostReclaim { // Make the next entry in the peers slice the host

			// Update the lobby state
			manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
			lobby := manager.lobbies[client.lobbyID]
			manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")

			// There must be at least one peer to make this work
			if len(lobby.Peers) == 0 {

				// Destroy the lobby
				log.Printf("[%s] No peers left in lobby \"%s\", destroying lobby", manager.Name, client.lobbyID)
				manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
				manager.lobbies[client.lobbyID] = nil
				delete(manager.lobbies, client.lobbyID)
				manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")

			} else {
				manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
				lobby.Host = lobby.Peers[0]
				manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")

				// Update client state
				manager.AcquireAccessLock(&client.stateMutex, "client state")
				lobby.Host.isPeer = false
				lobby.Host.isHost = true
				lobby.Host.lobbyID = client.lobbyID
				manager.FreeAccessLock(&client.stateMutex, "client state")

				log.Printf("[%s] Made peer %s the new host of lobby \"%s\"", manager.Name, lobby.Host.id, client.lobbyID)

				// Tell peers the server has made this peer the host
				MulticastMessageArray(peers, JSONDump(&ReclaimHostConfig{
					Opcode: Opcodes["HOST_RECLAIM"],
					Payload: &ReclaimHost{
						Id:       lobby.Host.id.String(),
						LobbyID:  client.lobbyID,
						Username: lobby.Host.name,
					},
				}), client)
			}

		} else { // Close the lobby

			// Notify peers the lobby is being deleted
			MulticastMessageArray(peers, JSONDump(&Packet{
				Opcode:  Opcodes["LOBBY_CLOSE"],
				Payload: client.lobbyID,
			}), client)

			// Delete host and destroy the lobby
			log.Printf("[%s] Destroying lobby \"%s\"", manager.Name, client.lobbyID)
			manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
			manager.lobbies[client.lobbyID] = nil
			delete(manager.lobbies, client.lobbyID)
			manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")
		}

	} else if client.isPeer { // Manage peer state

		// Get lobby
		manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
		lobby := manager.lobbies[client.lobbyID]

		// Remove peer
		defer manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")
		removePeer(lobby, client)

		log.Printf("[%s] Removing peer %s from lobby \"%s\"", manager.Name, client.id, client.lobbyID)

	}
}

func SessionCleanup(manager *Manager, client *Client) {
	// Handle removing the client from any lobbies
	manager.AbandonLobbies(client)

	// Remove client from manager
	manager.RemoveClient(client)

	// Destroy manager if no clients are connected
	if len(manager.clients) == 0 {
		log.Printf("[%s] No clients connected, destroying manager", manager.Name)
		Remove(manager)
	}
}

func New(manager *Manager, con *websocket.Conn) {
	// Register client
	client := NewClient(con, manager)
	manager.AddClient(client)

	// Remove client from manager once the session has ended (and destroy manager if no clients are connected)
	defer SessionCleanup(manager, client)

	// Begin handling messages throughout the lifespan of the connection
	client.MessageHandler(manager)
}
