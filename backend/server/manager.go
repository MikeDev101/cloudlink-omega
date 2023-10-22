package cloudlinkOmega

import (
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"
	"github.com/google/uuid"
)

var ServerVersion string = "0.1.0"

type Lobby struct {
	Host                  *Client
	Peers                 []*Client
	AllowHostReclaim      bool
	AllowPeersToClaimHost bool
	MaxPeers              int
	Password              string
	Locked                bool
}

type Manager struct {
	// Friendly name for manager
	name string

	// Registered client sessions
	clients          map[uuid.UUID]*Client
	clientNames      map[string]*Client
	clientsMutex     sync.RWMutex
	clientNamesMutex sync.RWMutex

	// Lobbies storage
	lobbies      map[string]*Lobby
	lobbiesMutex sync.RWMutex

	// Locks states before registering sessions
	sync.RWMutex
}

func (lobby *Lobby) removePeer(target *Client) []*Client {
	slice := lobby.Peers
	for i, value := range slice {
		if value == target {
			// Swap the element to remove with the last element
			slice[i] = slice[len(slice)-1]

			// Remove the last element
			slice = slice[:len(slice)-1]
			return slice
		}
	}
	return slice
}

func NewPeer(lobbyID string, client *Client, manager *Manager) bool {
	var result = false

	// Get lock
	manager.lobbiesMutex.Lock()

	// Check if lobby exists, and add peer to it
	if lobby, exists := manager.lobbies[lobbyID]; exists {

		// Add to lobby
		result = true
		lobby.Peers = append(lobby.Peers, client)

		// Update client state
		client.stateMutex.Lock()
		client.isPeer = true
		client.lobbyID = lobbyID
		client.stateMutex.Unlock()
	}

	// Free lock
	manager.lobbiesMutex.Unlock()

	return result
}

func NewHost(lobbyID string, client *Client, manager *Manager, AllowHostReclaim bool, AllowPeersToClaimHost bool, MaxPeers int, Password string) bool {
	var result = false

	// Get lock
	manager.lobbiesMutex.Lock()

	// Check if lobby doesn't exist, and create lobby with host as client
	if _, exists := manager.lobbies[lobbyID]; !exists {

		// Create lobby
		result = true
		manager.lobbies[lobbyID] = &Lobby{
			AllowHostReclaim:      AllowHostReclaim,
			AllowPeersToClaimHost: AllowPeersToClaimHost,
			MaxPeers:              MaxPeers,
			Password:              Password,
			Locked:                false,
		}
		manager.lobbies[lobbyID].Host = client

		// Update client state
		client.stateMutex.Lock()
		client.isHost = true
		client.lobbyID = lobbyID
		client.stateMutex.Unlock()
	}

	// Free lock
	manager.lobbiesMutex.Unlock()

	return result
}

// NewClient assigns a UUID to a websocket client, and returns a initialized Client struct for use with a manager's AddClient.
func NewClient(conn *websocket.Conn, manager *Manager) *Client {
	// Request and create a lock before generating ID values
	manager.clientsMutex.Lock()

	// Generate client ID values
	client_uuid := uuid.New()

	// Release the lock
	manager.clientsMutex.Unlock()

	return &Client{
		connection: conn,
		manager:    manager,
		id:         client_uuid,
		name:       "",
		nameSet:    false,
		isHost:     false,
		isPeer:     false,
		lobbyID:    "",
	}
}

func NewManager(name string) *Manager {
	manager := &Manager{
		name:        name,
		clients:     make(map[uuid.UUID]*Client),
		clientNames: make(map[string]*Client),
		lobbies:     make(map[string]*Lobby),
	}

	return manager
}

func (manager *Manager) AddClient(client *Client) {
	manager.clientsMutex.Lock()

	// Add client
	manager.clients[client.id] = client

	log.Printf("[%s] Client %s connected", manager.name, client.id)

	manager.clientsMutex.Unlock()
}

func (manager *Manager) RemoveClient(client *Client) {
	manager.clientsMutex.Lock()

	// Remove client from manager's clients map
	delete(manager.clients, client.id)

	log.Printf("[%s] Client %s disconnected", manager.name, client.id)

	manager.clientsMutex.Unlock()
}
