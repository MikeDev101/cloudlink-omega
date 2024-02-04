package structs

// Managing lobbies
type LobbyConfigStore struct {
	ID                  string
	MaximumPeers        int
	AllowHostReclaim    bool
	AllowPeersToReclaim bool
	CurrentOwnerID      uint64
	CurrentOwnerULID    string
}
