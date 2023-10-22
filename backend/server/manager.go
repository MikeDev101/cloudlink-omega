package cloudlink

import (
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"
	"github.com/google/uuid"
)

var ServerVersion string = "0.1.0"

type Manager struct {
	// Friendly name for manager
	name string

	// Registered client sessions
	clients      map[uuid.UUID]*Client
	clientsMutex sync.RWMutex

	// Registered hosts
	hosts      map[interface{}]*Client
	hostsMutex sync.RWMutex

	// Registered peers
	peers      map[interface{}]*Client
	peersMutex sync.RWMutex

	// Locks states before registering sessions
	sync.RWMutex
}

func NewPeer(room interface{}, client *Client, manager *Manager) {
	// Get lock
	manager.peersMutex.Lock()

	// Create peer
	manager.peers[room] = client

	// Free lock
	manager.peersMutex.Unlock()
}

func NewHost(room interface{}, client *Client, manager *Manager) {
	// Get lock
	manager.hostsMutex.Lock()

	// Create host
	manager.hosts[room] = client

	// Free lock
	manager.hostsMutex.Unlock()
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
	}
}

func New(name string) *Manager {
	manager := &Manager{
		name:    name,
		clients: make(map[uuid.UUID]*Client),
		hosts:   make(map[interface{}]*Client),
		peers:   make(map[interface{}]*Client),
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
