package cloudlinkOmega

type HostDetails struct {
	Id               string `json:"id"`
	Username         string `json:"username"`
	LobbyID          string `json:"lobby_id"`
	MaxPeers         int    `json:"max_peers"`
	PasswordRequired bool   `json:"password_required"`
}

type PeerDetails struct {
	Id       string `json:"id"`
	Username string `json:"username"`
}

type Packet struct {
	Opcode  int         `json:"opcode"`
	Payload interface{} `json:"payload,omitempty"`
	Tx      string      `json:"tx,omitempty"`
	Rx      string      `json:"rx,omitempty"`
}

type PacketHost struct {
	Opcode  int          `json:"opcode"`
	Payload *HostDetails `json:"payload"`
}

type PacketPeer struct {
	Opcode  int          `json:"opcode"`
	Payload *PeerDetails `json:"payload"`
}

type HostConfig struct {
	Opcode  int `json:"opcode"`
	Payload struct {
		LobbyID             string `json:"lobby_id"`
		AllowHostReclaim    bool   `json:"allow_host_reclaim"`
		AllowPeersToReclaim bool   `json:"allow_peers_to_claim_host"`
		MaxPeers            int    `json:"max_peers"`
		Password            string `json:"password"`
	} `json:"payload"`
}
