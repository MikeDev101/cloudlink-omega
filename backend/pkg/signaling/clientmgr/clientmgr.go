package clientmgr

import (
	"log"
	"strings"
	"sync"

	structs "github.com/mikedev101/cloudlink-omega/backend/pkg/structs"
)

// Client manager is a pseudo-database for signaling clients.

// In-memory pseudo-DB
type ClientDB struct {
	clients       map[uint64]*structs.Client // Client table.
	idIncrementer uint64                     // ID Autoincrement.
	queryLock     sync.Mutex                 // Locks the entire query process. Prevents deadlocks.
}

// CREATE TABLE clients (ID INTEGER PRIMARY KEY, Game TEXT, Name TEXT)
func New() *ClientDB {
	log.Print("[Client Manager] Initializing new signaling client manager...")
	return &ClientDB{
		clients:       make(map[uint64]*structs.Client),
		idIncrementer: 0, // AUTOINCREMENT
		queryLock:     sync.Mutex{},
	}
}

func (db *ClientDB) Delete(client *structs.Client) {
	log.Printf("[Client Manager] Deleting client (%d) in %s...", client.ID, client.UGI)

	// Get write lock
	db.queryLock.Lock()

	// Delete client and free lock
	defer db.queryLock.Unlock()
	delete(db.clients, client.ID)
}

// INSERT INTO clients (Game, Name) VALUES (?, ?)
func (db *ClientDB) Add(client *structs.Client) *structs.Client {
	// Get write lock
	db.queryLock.Lock()

	// Add client and free lock
	defer db.queryLock.Unlock()
	func() {
		client.ID = db.idIncrementer
		db.idIncrementer++
		log.Printf("[Client Manager] Adding client (%d) in %s...", client.ID, client.UGI)
		db.clients[client.ID] = client
	}()

	return client
}

// SELECT client FROM clients WHERE ULID = (ulid)
func (db *ClientDB) GetClientByULID(query string) *structs.Client {
	var res *structs.Client = nil

	log.Printf("[Client Manager] Finding client given ULID %s...", query)

	// Get read lock
	db.queryLock.Lock()

	// Return match and free lock
	defer db.queryLock.Unlock()
	func() {
		for _, client := range db.clients {
			if client.ULID == query {
				log.Printf("[Client Manager] Found client ULID match, returning client %d...", client.ID)
				res = client
			}
		}
	}()
	if res == nil {
		log.Printf("[Client Manager] No client found matching ULID %s", query)
	}
	return res
}

// SELECT ulid FROM clients
func (db *ClientDB) GetAllClientULIDs() (ulids []string) {
	log.Println("[Client Manager] Gathering all client ULIDs...")

	// Get read lock
	db.queryLock.Lock()

	// Return all IDs and free lock
	defer db.queryLock.Unlock()
	func() {
		for _, client := range db.clients {
			ulids = append(ulids, client.ULID)
		}
	}()
	return ulids
}

// SELECT client FROM clients
func (db *ClientDB) GetAllClients() (clients []*structs.Client) {
	log.Println("[Client Manager] Gathering all clients...")

	// Get read lock
	db.queryLock.Lock()

	// Return all clients and free lock
	defer db.queryLock.Unlock()
	func() {
		for _, client := range db.clients {
			clients = append(clients, client)
		}
	}()
	return clients
}

// SELECT * FROM clients WHERE UGI LIKE (ugi)
func (db *ClientDB) GetClientsByUGI(ugi string) []*structs.Client {
	log.Printf("[Client Manager] Gathering all clients with UGI %s...", ugi)

	var clients []*structs.Client

	// Get read lock
	db.queryLock.Lock()

	defer db.queryLock.Unlock()
	for _, client := range db.clients {
		if strings.Compare(client.UGI, ugi) == 0 {
			clients = append(clients, client)
		}
	}
	return clients
}

// GetAllHostsByUGI returns all clients that are hosts for the given UGI.
// SELECT * FROM clients WHERE UGI LIKE (ugi) AND IsHost = 1
func (db *ClientDB) GetAllHostsByUGI(ugi string) []*structs.Client {
	log.Printf("[Client Manager] Gathering all hosts within UGI %s...", ugi)

	var clients []*structs.Client

	// Get read lock
	db.queryLock.Lock()

	defer db.queryLock.Unlock()
	for _, client := range db.clients {
		if client.IsHost {
			continue
		}
		if strings.Compare(client.UGI, ugi) == 0 {
			clients = append(clients, client)
		}
	}
	return clients
}

// GetAllHostsByUGI returns all clients that are peers for the given UGI.
// SELECT * FROM clients WHERE UGI LIKE (ugi) AND IsHost = 0
func (db *ClientDB) GetAllPeersByUGI(ugi string) []*structs.Client {
	log.Printf("[Client Manager] Gathering all peers within UGI %s...", ugi)

	var clients []*structs.Client

	// Get read lock
	db.queryLock.Lock()

	defer db.queryLock.Unlock()
	for _, client := range db.clients {
		if !client.IsHost {
			continue
		}
		if strings.Compare(client.UGI, ugi) == 0 {
			clients = append(clients, client)
		}
	}
	return clients
}

// GetClientsByUsernameSimilarTo returns all clients that have a username similar to the query.
// Each individual client will get a read lock if matched.
// SELECT * FROM clients WHERE Name LIKE (query)%
func (db *ClientDB) GetClientsByUsernameSimilarTo(query string) (clients []*structs.Client) {
	log.Printf("[Client Manager] Finding all clients with similar username: %s...", query)

	// Get read lock
	db.queryLock.Lock()

	// Return all matches and release locks
	defer db.queryLock.Unlock()
	for _, client := range db.clients {
		if strings.HasPrefix(client.Username, query) {
			clients = append(clients, client)
		}
	}
	return clients
}
