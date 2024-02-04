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
	clients       map[uint64]*structs.Client                      // Clients.
	idIncrementer uint64                                          // ID Autoincrement.
	queryLock     sync.Mutex                                      // Locks the entire query process. Prevents deadlocks.
	Lobbies       map[string]map[string]*structs.LobbyConfigStore // Lobbies.
}

// CREATE TABLE clients (ID INTEGER PRIMARY KEY, Game TEXT, Name TEXT)
func New() *ClientDB {
	log.Print("[Client Manager] Initializing new signaling client manager...")
	return &ClientDB{
		clients:       make(map[uint64]*structs.Client),
		idIncrementer: 0, // AUTOINCREMENT
		queryLock:     sync.Mutex{},
		Lobbies:       make(map[string]map[string]*structs.LobbyConfigStore),
	}
}

// CreateLobbyConfigStorage creates a new lobby config store for a specified UGI.
// Returns the lobby config store.
func (db *ClientDB) CreateLobbyConfigStorage(ugi string, lobbyname string) *structs.LobbyConfigStore {

	// Get write lock
	db.queryLock.Lock()

	// Delete client and free lock
	defer db.queryLock.Unlock()
	func() {
		// Check if the root UGI lobby store manager exists, and create it if it doesn't.
		if _, ok := db.Lobbies[ugi]; !ok {
			log.Printf("[Client Manager] Creating UGI %s root lobby config store...", ugi)
			db.Lobbies[ugi] = make(map[string]*structs.LobbyConfigStore)
		}

		// Create the lobby config store
		log.Printf("[Client Manager] Creating lobby %s configuration store in UGI %s...", lobbyname, ugi)
		db.Lobbies[ugi][lobbyname] = &structs.LobbyConfigStore{}
	}()
	return db.Lobbies[ugi][lobbyname]
}

func (db *ClientDB) GetLobbyConfigStorage(ugi string, lobbyname string) *structs.LobbyConfigStore {

	// Get read lock
	db.queryLock.Lock()

	// Read config and free lock
	defer db.queryLock.Unlock()
	return func() *structs.LobbyConfigStore {
		if _, ok := db.Lobbies[ugi]; !ok {
			return nil
		}
		return db.Lobbies[ugi][lobbyname]
	}()
}

func (db *ClientDB) Delete(client *structs.Client) {

	// Get write lock
	db.queryLock.Lock()

	log.Printf("[Client Manager] Deleting client (%d) in %s...", client.ID, client.UGI)

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

	// Get read lock
	db.queryLock.Lock()

	log.Printf("[Client Manager] Finding client given ULID %s...", query)

	// Return match and free lock
	defer db.queryLock.Unlock()
	func() {
		for _, client := range db.clients {
			if client.ULID == query {
				log.Printf("[Client Manager] Found match, returning client %d...", client.ID)
				res = client
			}
		}
	}()
	if res == nil {
		log.Printf("[Client Manager] No client found matching ULID %s", query)
	}
	return res
}

// SELECT client FROM clients WHERE UGI = (ugi) AND Lobby = (lobby) AND Peer = 1
func (db *ClientDB) GetPeerClientsByUGIAndLobby(ugi string, lobby string) []*structs.Client {
	log.Printf("[Client Manager] Finding all peers given UGI %s and lobby %s...", ugi, lobby)

	// Get read lock
	db.queryLock.Lock()

	// Return match and free lock
	defer db.queryLock.Unlock()
	return func() (res []*structs.Client) {
		for _, client := range db.clients {
			if client.UGI == ugi && client.Lobby == lobby && client.IsPeer {
				log.Printf("[Client Manager] Found match, appending client %d...", client.ID)
				res = append(res, client)
			}
		}
		if len(res) == 0 {
			log.Printf("[Client Manager] No peers found matching lobby %s in UGI %s", lobby, ugi)
		}
		return res
	}()
}

// SELECT client FROM clients WHERE ULID = (ulid) AND UGI = (ugi) AND Lobby = (lobby) AND Peer = 1
func (db *ClientDB) GetPeerClientBySpecificULIDinUGIAndLobby(ulid string, ugi string, lobby string) *structs.Client {
	log.Printf("[Client Manager] Finding peer given ULID %s in UGI %s and lobby %s...", ulid, ugi, lobby)

	// Get read lock
	db.queryLock.Lock()

	// Return match and free lock
	defer db.queryLock.Unlock()
	return func() *structs.Client {
		for _, client := range db.clients {
			if client.UGI == ugi && client.Lobby == lobby && client.IsPeer && client.ULID == ulid {
				log.Printf("[Client Manager] Found match, returning client %d...", client.ID)
				return client
			}
		}
		log.Printf("[Client Manager] No peer found matching ULID %s in lobby %s in UGI %s", ulid, lobby, ugi)
		return nil
	}()
}

// SELECT client FROM clients WHERE UGI = (ugi) AND Lobby = (lobby) AND Host = 1 AND Peer = 0
func (db *ClientDB) GetHostClientsByUGIAndLobby(ugi string, lobby string) []*structs.Client {
	log.Printf("[Client Manager] Finding all hosts given UGI %s and lobby %s...", ugi, lobby)

	// Get read lock
	db.queryLock.Lock()

	// Return match and free lock
	defer db.queryLock.Unlock()
	return func() (res []*structs.Client) {
		for _, client := range db.clients {
			if client.UGI == ugi && client.Lobby == lobby && client.IsHost {
				log.Printf("[Client Manager] Found match, appending client %d...", client.ID)
				res = append(res, client)
			}
		}
		if len(res) == 0 {
			log.Printf("[Client Manager] No host found matching lobby %s in UGI %s", lobby, ugi)
		}
		return res
	}()
}

// SELECT client FROM clients WHERE UGI = (ugi) AND Lobby = ""
func (db *ClientDB) GetAllClientsWithoutLobby(ugi string) []*structs.Client {
	log.Printf("[Client Manager] Finding all clients without a lobby in UGI %s...", ugi)

	// Get read lock
	db.queryLock.Lock()

	// Return match and free lock
	defer db.queryLock.Unlock()
	return func() (res []*structs.Client) {
		for _, client := range db.clients {
			if client.UGI == ugi && client.Lobby == "" {
				log.Printf("[Client Manager] Found match, appending client %d...", client.ID)
				res = append(res, client)
			}
		}
		if len(res) == 0 {
			log.Printf("[Client Manager] No clients found without a lobby in UGI %s", ugi)
		}
		return res
	}()
}

// SELECT ulid FROM clients
func (db *ClientDB) GetAllClientULIDs() []string {
	log.Println("[Client Manager] Gathering all client ULIDs...")

	// Get read lock
	db.queryLock.Lock()

	// Return all IDs and free lock
	defer db.queryLock.Unlock()
	return func() (ulids []string) {
		for _, client := range db.clients {
			ulids = append(ulids, client.ULID)
		}
		return ulids
	}()
}

// SELECT client FROM clients
func (db *ClientDB) GetAllClients() []*structs.Client {
	log.Println("[Client Manager] Gathering all clients...")

	// Get read lock
	db.queryLock.Lock()

	// Return all clients and free lock
	defer db.queryLock.Unlock()
	return func() (clients []*structs.Client) {
		for _, client := range db.clients {
			clients = append(clients, client)
		}
		return clients
	}()
}

// SELECT * FROM clients WHERE UGI LIKE (ugi)
func (db *ClientDB) GetClientsByUGI(ugi string) []*structs.Client {

	// Get read lock
	db.queryLock.Lock()

	log.Printf("[Client Manager] Gathering all clients with UGI %s...", ugi)

	defer db.queryLock.Unlock()
	return func() (clients []*structs.Client) {
		for _, client := range db.clients {
			if strings.Compare(client.UGI, ugi) == 0 {
				clients = append(clients, client)
			}
		}
		return clients
	}()
}

// GetAllHostsByUGI returns all clients that are hosts for the given UGI.
// SELECT * FROM clients WHERE UGI LIKE (ugi) AND IsHost = 1
func (db *ClientDB) GetAllHostsByUGI(ugi string) []*structs.Client {

	// Get read lock
	db.queryLock.Lock()

	log.Printf("[Client Manager] Gathering all hosts within UGI %s...", ugi)

	defer db.queryLock.Unlock()
	return func() (clients []*structs.Client) {
		for _, client := range db.clients {
			if client.IsHost {
				continue
			}
			if strings.Compare(client.UGI, ugi) == 0 {
				clients = append(clients, client)
			}
		}
		return clients
	}()
}

// GetAllHostsByUGI returns all clients that are peers for the given UGI.
// SELECT * FROM clients WHERE UGI LIKE (ugi) AND IsHost = 0
func (db *ClientDB) GetAllPeersByUGI(ugi string) []*structs.Client {
	log.Printf("[Client Manager] Gathering all peers within UGI %s...", ugi)

	// Get read lock
	db.queryLock.Lock()

	defer db.queryLock.Unlock()
	return func() (clients []*structs.Client) {
		for _, client := range db.clients {
			if !client.IsHost {
				continue
			}
			if strings.Compare(client.UGI, ugi) == 0 {
				clients = append(clients, client)
			}
		}
		return clients
	}()
}

// GetClientsByUsernameSimilarTo returns all clients that have a username similar to the query.
// Each individual client will get a read lock if matched.
// SELECT * FROM clients WHERE Name LIKE (query)%
func (db *ClientDB) GetClientsByUsernameSimilarTo(query string) []*structs.Client {
	log.Printf("[Client Manager] Finding all clients with similar username: %s...", query)

	// Get read lock
	db.queryLock.Lock()

	// Return all matches and release locks
	defer db.queryLock.Unlock()
	return func() (clients []*structs.Client) {
		for _, client := range db.clients {
			if strings.Contains(client.Username, query) {
				clients = append(clients, client)
			}
		}
		return clients
	}()
}
