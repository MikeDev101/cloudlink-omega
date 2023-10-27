# Signaling
CloudLink Omega utilizes WebSockets to handle signaling. The protocol for negotiating connections are as follows.

## URL endpoint
The server's websocket endpoint can be connected using the following format:
`wss://the.server.tld:port/signaling/{ugi}?v={version}`

`ugi` - Unique Game Identifier - See API docs
`version` - API version (always 0)


## Message format
All signaling events are JSON-encoded text frames. No newlines or special formatting. Unless stated below with extra formatting info, messages will comply with this format.
```js
{
	opcode: int, // See opcodes
	payload: any, // Can be a SDP offer/answer, a configuration, or a lobby ID.
	tx: string, // provided by the server only
	rx: string, // provided by a client only
}
```

### `CONFIG_HOST` format
Send this message to the server to create a game host.

```js
{
	opcode: 4, // CONFIG_HOST opcode 
	payload: {
		lobby_id: string, // Name of your lobby you want to create
		allow_host_reclaim: bool, // False - As soon as you leave, this lobby is destroyed. True - Server or peers will decide who becomes the host. Applies to argument allow_peers_to_claim_host.
		allow_peers_to_claim_host: bool, // False - Server will decide the new host. True - Peers will decide who becomes host
		max_peers: int, // set to 0 for unlimited peers
		password: string, // Prevent access to your room with a password. Set to an empty string to allow any peer to join.
	},
}
```

### `CONFIG_PEER` format
Send this message to the server to join a game host.
```js
{
	opcode: 5, // CONFIG_PEER opcode 
	payload: {
		lobby_id: string, // Name of your lobby you want to join
		password: string, // Optional. Server will respond with PASSWORD_REQUIRED if blank and the room is configured for a password.
	},
}
```

### `NEW_HOST` format
This message is sent to peers when a new host is created.

```js
{
	opcode: 8, // NEW_HOST opcode 
	payload: {
		id: string, // UUID of the host (use this for tx argument)
		username: string, // username of the host
		lobby_id: string, // lobby ID the host has created
	},
}
```

### `NEW_PEER` format
This message is sent to a host when a peer wants to join their game.

```js
{
	opcode: 9, // NEW_PEER opcode 
	payload: {
		id: string // UUID of the peer (use this for tx argument)
		username: string // username of the host
	},
}
```

### `NEW_CHANNEL` format
This message is sent between peers to open a new data channel. Both peers must implement out-of-band channel negotiation.

```js
{
	opcode: 35, // NEW_CHANNEL opcode 
	payload: {
		name: string, // Name of the new channel
		id: int, // Agreed upon RTCDataChannel ID of the channel
		ordered: boolean, // True - Use ordered channel, False - Use unordered channel
	},
	tx: string, // provided by the server only
	rx: string, // provided by a client only
}
```

### `HOST_RECLAIM` format
This message is sent when the server has made a peer the new host of a lobby.

```js
{
	opcode: 28, // HOST_RECLAIM opcode 
	payload: {
		id: string // UUID of the peer (use this for tx argument)
		lobby_id: string // The lobby ID the peer has been made the host on
		username: string // username of the host
	},
}
```

### Opcodes
`opcode` is an integer that represents one of the following message states:

| opcode | path | name | description |
|--------|------|------|-------------|
| 0 | server -> client | VIOLATION | Protocol exception. |
| 1 | server <> client | KEEPALIVE | Ping/pong. |
| 2 | server <- client | INIT | Requests a Session UUID by offering a username. |
| 3 | server -> client | INIT_OK | Returns a Session UUID from the server. |
| 4 | server <- client | CONFIG_HOST | Tells the server to make the client a game host, and create a lobby. |
| 5 | server <- client | CONFIG_PEER | Tells the server to make the client a game peer, and join a lobby. |
| 6 | server -> client | ACK_HOST | Server replied to host request, made the client a host, and has created a lobby. |
| 7 | server -> client | ACK_PEER | Server replied to peer request, made the client a peer, and has sent a join request to the lobby host. |
| 8 | server -> client | NEW_HOST | Server notifies a peer that a new lobby was created. |
| 9 | server -> client | NEW_PEER | Server notifies a host that a peer wants to join the lobby. |
| 10 | server <> client | MAKE_OFFER | Relay an SDP offer from host to peer. |
| 11 | server <> client | MAKE_ANSWER | Relay an SDP answer from peer to host. |
| 12 | server <> client | ICE | Relay ICE candidates to/from peer/host. |
| 13 | server <> client | ABORT_OFFER | Abort an SDP offer. |
| 14 | server <> client | ABORT_ANSWER | Abort an SDP answer. |
| 15 | server <> client | SHUTDOWN | Notify the signaller that the host has disconnected. |
| 16 | server -> client | LOBBY_EXISTS | Cannot create lobby because it already exists. |
| 17 | server -> client | LOBBY_NOTFOUND | Cannot join lobby because it does not exist. |
| 18 | server -> client | LOBBY_FULL | Cannot join lobby because it is currently full. |
| 19 | server -> client | LOBBY_LOCKED | Cannot join lobby because it is currently locked. |
| 20 | server -> client | LOBBY_CLOSE | The host/server has decided to shutdown the lobby. |
| 21 | server -> client | HOST_GONE | The server has decided to allow peers to negotiate who will be the new lobby host. |
| 22 | server <- client | PEER_GONE | Notify the server that a peer has disconnected. |
| 23 | server -> client | HOST_RECLAIM | Server has made a different peer the lobby host. |
| 24 | server <- client | CLAIM_HOST | Ask the server to become the new lobby host. |
| 25 | server <- client | TRANSFER_HOST | Ask the server to transfer ownership of the lobby to a peer. |
| 26 | server <- client | ABANDON | Tell the server you are leaving a lobby. |
| 27 | server <- client | LOCK | Ask the server to prevent access to the lobby. |
| 28 | server <- client | UNLOCK | Ask the server to allow access to the lobby. |
| 29 | server <- client | SIZE | Ask the server to change the maximum peers value for a lobby. |
| 30 | server <- client | KICK | Ask the server to remove a peer from a lobby. |
| 31 | server -> client | PASSWORD_REQUIRED | Cannot join lobby because it requires a password. |
| 32 | server -> client | PASSWORD_ACK | Joining lobby: password accepted. |
| 33 | server -> client | PASSWORD_FAIL | Not joining lobby: password rejected. |
| 34 | server -> client | PEER_INVALID | Message undeliverable: Peer not found. |
| 35 | server -> client | DISCOVER | Server will notify peer of other peers present. Used to negotiate an adhoc connection mode. |

## Connection handshake flow
TODO