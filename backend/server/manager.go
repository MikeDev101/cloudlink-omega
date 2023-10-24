package cloudlinkOmega

import (
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofrs/uuid"
)

var ServerVersion string = "0.1.0"
var VerboselyLogLocks bool = false

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
	// Friendly Name for manager
	Name string

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

	// UUID generator
	uuidGen uuid.Gen
}

// Verbosely log RWMutex lock requests
func (manager *Manager) AcquireAccessLock(lock *sync.RWMutex, something string) {
	if VerboselyLogLocks {
		log.Printf("[%s] Acquiring lock to access %s...", manager.Name, something)
	}
	lock.Lock()
	if VerboselyLogLocks {
		log.Printf("[%s] Acquired lock to access %s!", manager.Name, something)
	}
}

// Verbosely log RWMutex unlock requests
func (manager *Manager) FreeAccessLock(lock *sync.RWMutex, something string) {
	if VerboselyLogLocks {
		log.Printf("[%s] Freeing lock to access %s...", manager.Name, something)
	}
	lock.Unlock()
	if VerboselyLogLocks {
		log.Printf("[%s] Freed lock to access %s!", manager.Name, something)
	}
}

func removePeer(lobby *Lobby, target *Client) {
	slice := lobby.Peers
	for i, value := range slice {
		if value == target {
			// Swap the element to remove with the last element
			slice[i] = slice[len(slice)-1]

			// Remove the last element
			slice = slice[:len(slice)-1]
			lobby.Peers = slice
		}
	}
}

func NewPeer(lobbyID string, client *Client, manager *Manager) bool {
	log.Printf("[%s] Checking for lobby \"%s\" existence", manager.Name, lobbyID)

	// Get lock
	manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
	lobby, exists := manager.lobbies[lobbyID]
	manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")

	// Check if lobby exists, and add peer to it
	if exists {

		// Add to lobby
		log.Printf("[%s] Lobby \"%s\" exists, adding client %s", manager.Name, lobbyID, client.id)
		manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
		lobby.Peers = append(lobby.Peers, client)
		manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")

		// Update client state
		manager.AcquireAccessLock(&client.stateMutex, "client state")
		client.isPeer = true
		client.lobbyID = lobbyID
		manager.FreeAccessLock(&client.stateMutex, "client state")

		log.Printf("[%s] Added client %s to lobby \"%s\"", manager.Name, client.id, lobbyID)
		return true
	}

	log.Printf("[%s] Lobby \"%s\" does not exist", manager.Name, lobbyID)
	return false
}

func NewHost(lobbyID string, client *Client, manager *Manager, AllowHostReclaim bool, AllowPeersToClaimHost bool, MaxPeers int, Password string) bool {
	log.Printf("[%s] Checking for lobby \"%s\" existence", manager.Name, lobbyID)

	// Check if lobby exists
	manager.AcquireAccessLock(&manager.lobbiesMutex, "manager lobbies state")
	_, exists := manager.lobbies[lobbyID]
	manager.FreeAccessLock(&manager.lobbiesMutex, "manager lobbies state")

	// Create lobby with host as client
	if !exists {

		// Create lobby
		log.Printf("[%s] Lobby \"%s\" does not exist, creating it now", manager.Name, lobbyID)
		manager.lobbies[lobbyID] = &Lobby{
			AllowHostReclaim:      AllowHostReclaim,
			AllowPeersToClaimHost: AllowPeersToClaimHost,
			MaxPeers:              MaxPeers,
			Password:              Password,
			Locked:                false,
		}
		manager.lobbies[lobbyID].Host = client
		manager.lobbies[lobbyID].Peers = append(manager.lobbies[lobbyID].Peers, client)

		// Update client state
		manager.AcquireAccessLock(&client.stateMutex, "client state")
		client.isHost = true
		client.lobbyID = lobbyID
		manager.FreeAccessLock(&client.stateMutex, "client state")

		log.Printf("[%s] Lobby \"%s\" created", manager.Name, lobbyID)
		return true
	}

	log.Printf("[%s] Lobby \"%s\" already exists", manager.Name, lobbyID)
	return false
}

// NewClient assigns a UUID to a websocket client, and returns a initialized Client struct for use with a manager's AddClient.
func NewClient(conn *websocket.Conn, manager *Manager) *Client {

	// Create client UUID
	manager.AcquireAccessLock(&manager.clientsMutex, "UUID generator")
	client_uuid, _ := manager.uuidGen.NewV7()
	manager.FreeAccessLock(&manager.clientsMutex, "UUID generator")

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
		Name:        name,
		clients:     make(map[uuid.UUID]*Client),
		clientNames: make(map[string]*Client),
		lobbies:     make(map[string]*Lobby),
		uuidGen:     *uuid.NewGen(),
	}

	return manager
}

func (manager *Manager) AddClient(client *Client) {
	manager.AcquireAccessLock(&manager.clientsMutex, "manager clients state")

	// Add client
	manager.clients[client.id] = client

	log.Printf("[%s] Client %s connected", manager.Name, client.id)

	manager.FreeAccessLock(&manager.clientsMutex, "manager clients state")
}

func (manager *Manager) RemoveClient(client *Client) {
	manager.AcquireAccessLock(&manager.clientsMutex, "manager clients state")

	// Remove client from manager's clients map
	delete(manager.clients, client.id)

	log.Printf("[%s] Client %s disconnected", manager.Name, client.id)

	manager.FreeAccessLock(&manager.clientsMutex, "manager clients state")
}
