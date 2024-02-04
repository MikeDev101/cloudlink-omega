package structs

// Managing lobbies
type LobbyConfigStore struct {
	ID                  string
	MaximumPeers        int
	AllowHostReclaim    bool
	AllowPeersToReclaim bool
	CurrentOwnerID      uint64 // For client manager tracking only
	CurrentOwnerULID    string // For signaling
	Password            string // Scrypt hash, otherwise optional.
	PasswordRequired    bool
	Locked              bool
}
