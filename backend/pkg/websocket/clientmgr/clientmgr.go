package clientmgr

import (
	"strings"
	"sync"
)

/*
Client manager is a pseudo-database for managing websocket clients.
It functionally mimics a in-memory database. It supports basic CRUD operations and queries.
*/

// Client structure
type Client struct {
	ID   string      `json:"id"`   // Primary key (ULID).
	Conn interface{} `json:"-"`    // Websocket connection.
	Game string      `json:"-"`    // Game name.
	Name string      `json:"name"` // Gamertag.
	Lock sync.Mutex  `json:"-"`    // Access lock.
}

// In-memory pseudo-DB
type ClientDB struct {
	clients       map[string]*Client // Client table.
	idIncrementer int                // ID Autoincrement.
	queryLock     sync.Mutex         // Locks the entire query process. Prevents deadlocks.
}

// CREATE TABLE clients (ID INTEGER PRIMARY KEY, Game TEXT, Name TEXT)
func New() *ClientDB {
	return &ClientDB{
		clients:       make(map[string]*Client),
		idIncrementer: 0, // AUTOINCREMENT
		queryLock:     sync.Mutex{},
	}
}

// INSERT INTO clients (Game, Name) VALUES (?, ?)
func (db *ClientDB) Add(client *Client) (createdId string) {
	// Get write lock
	db.queryLock.Lock()

	// Add client and free lock
	defer db.queryLock.Unlock()
	func() {
		db.clients[client.ID] = client
	}()
	return client.ID
}

// SELECT client FROM clients WHERE ID = (id)
func (db *ClientDB) GetClientByID(id string) *Client {
	// Get read lock
	db.queryLock.Lock()

	// Return match and free lock
	defer db.queryLock.Unlock()
	return db.clients[id]
}

// SELECT id FROM clients
func (db *ClientDB) GetAllClientIDs() (ids []string) {
	// Get read lock
	db.queryLock.Lock()

	// Return all IDs and free lock
	defer db.queryLock.Unlock()
	func() {
		for id := range db.clients {
			ids = append(ids, id)
		}
	}()
	return ids
}

// SELECT client FROM clients
func (db *ClientDB) GetAllClients() (clients []*Client) {

	// Get read lock
	db.queryLock.Lock()

	// Return all clients and free lock
	defer db.queryLock.Unlock()
	func() {
		for id := range db.clients {
			clients = append(clients, db.clients[id])
		}
	}()
	return clients
}

// SELECT * FROM clients WHERE Game LIKE (game)
func (db *ClientDB) GetClientsByGame(game string) []*Client {
	var clients []*Client

	// Get read lock
	db.queryLock.Lock()

	// lowercase game
	game = strings.ToUpper(game)

	defer db.queryLock.Unlock()
	for _, client := range db.clients {
		if strings.ToUpper(client.Game) == game {
			clients = append(clients, client)
		}
	}
	return clients
}

// GetClientsBySimilarName returns all clients that have a name similar to the query.
// Each individual client will get a read lock if matched.
// SELECT * FROM clients WHERE Name LIKE (query)%
func (db *ClientDB) GetClientsByNameSimilarTo(query string) (clients []*Client) {
	// Get read lock
	db.queryLock.Lock()

	// Return all matches and release locks
	defer db.queryLock.Unlock()
	for _, client := range db.clients {
		if strings.HasPrefix(client.Name, query) {
			clients = append(clients, client)
		}
	}
	return clients
}
