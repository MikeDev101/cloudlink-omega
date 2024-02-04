# CL Omega Protocol
This wiki page defines the WebRTC/WebSocket protocol used by CL Omega for signaling and messaging.
> Note: this is a draft!

# Message format
All protocol messages are JSON-encoded text frames.
```js
{
	opcode: string, // See opcodes
	payload: any,
	origin: string, // ULID, defined server-side to identify relayed message's sender
	recipient: string, // ULID, defined client-side to specify which peer to relay to
}
```

# Signaling
This section defines the various commands used for managing game lobbies and negotiating WebRTC connections (or preparing WebSocket Relays).

## URL
To connect to a CL Omega signaling server, open a websocket connection using the following URL format:
`wss://the.server.tld:port/api/v0/signaling?ugi={ugi}`
> `ugi` - Unique Game Identifier. Used to specify which game to connect to.

## Commands

### `INIT`
All clients are required to send this message to the server when connecting.

This authorizes your session with the server and permits connecting to a game.

This requires a valid account on the server, and a valid session token provided by the API.

```js
{
	opcode: "INIT",
	payload: string, // See API docs for getting a session token
}
```

### `INIT_OK`
This response code is returned by the server upon successful authentication. 

The payload contains information about your current gamertag (`user`) and account ULID (`id`), as well as
metadata about the connected game.

Use the `id` parameter value to identify sessions and to negotiate WebRTC connections using the signaling server.

```js
{
	opcode: "INIT_OK",
	payload: {
		user: string, // Provided for human-friendly identification
		id: string, // Required to identify/relay requests to other peers on the signaling server
		game: string, // Game name
		developer: string, // Developer of game
	},
}
```

### `CONFIG_HOST`
Send this message to the server to create a game host.

```js
{
	opcode: "CONFIG_HOST",
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
	opcode: "CONFIG_PEER",
	payload: {
		lobby_id: string, // Name of your lobby you want to join
		password: string, // Optional. Server will respond with PASSWORD_REQUIRED if blank and the room is configured for a password.
	},
}
```

### `NEW_HOST` format
This message is broadcasted to all peers waiting for a host.

```js
{
	opcode: "NEW_HOST",
	payload: {
		id: string, // ULID of the host
		user: string, // gamertag of the host
		lobby_id: string, // lobby ID the host has created
	},
}
```

### `NEW_PEER` format
This message is sent to a host when a client wishes to connect to your lobby.

```js
{
	opcode: "NEW_PEER",
	payload: {
		id: string // ULID of the peer
		user: string // gamertag of the peer
	},
}
```

### `HOST_RECLAIM` format
This message is sent when the server has made a peer the new host of a lobby.

```js
{
	opcode: "HOST_RECLAIM",
	payload: {
		id: string // ULID of the peer
		user: string // gamertag of the host
		lobby_id: string // The lobby ID the peer has been made the host on
	},
}
```

## Opcodes
`opcode` is a string that represents one of the following message states:

| Opcode | Description |
|--------|-------------|
| INIT | Authenticates the connection given a valid login token. |
| INIT_OK | Returns game info and username data upon successful login. |
| VIOLATION | Protocol exception. |
| WARNING | Generic warning message. |
| CONFIG_REQUIRED | Warning message when you haven't sent the INIT command. |
| KEEPALIVE | Ping/pong. |
| RELAY_OK | Generic success code for MAKE_OFFER, MAKE_ANSWER, and ICE. |
| ALREADY_HOST | Warning message when trying to use CONFIG_HOST more than once. |
| ALREADY_PEER | Warning message when trying to use CONFIG_PEER more than once. |
| NOT_PEER | Warning message when trying to use MAKE_ANSWER as a host (should be a peer). |
| NOT_HOST | Warning message when trying to use MAKE_OFFER as a peer (should be a host). |
| SESSION_EXISTS | Warning message when trying to login to the same account on more than once device or attempting to reuse INIT command. |
| TOKEN_INVALID | Warning message when the provided token in INIT is invalid. |
| TOKEN_ORIGIN_MISMATCH | Warning message when the provided token is used on a different website than it was generated for. |
| TOKEN_EXPIRED | Warning message when the provided token has expired (tokens have a lifespan of 24 hours). |
| PEER_INVALID | Message undeliverable: Peer not found. |
| CONFIG_HOST | Tells the server to make the client a game host, and create a lobby. |
| CONFIG_PEER | Tells the server to make the client a game peer, and join a lobby. |
| ACK_HOST | Server replied to host request, made the client a host, and has created a lobby. |
| ACK_PEER | Server replied to peer request, made the client a peer, and has sent a join request to the lobby host. |
| NEW_HOST | Server notifies a peer that a new lobby was created. |
| NEW_PEER | Server notifies a host that a peer wants to join the lobby. |
| MAKE_OFFER | Relay an SDP offer from host to peer. |
| MAKE_ANSWER | Relay an SDP answer from peer to host. |
| ICE | Relay ICE candidates to/from peer/host. |
| LOBBY_EXISTS | Cannot create lobby because it already exists. |
| LOBBY_NOTFOUND | Cannot join lobby because it does not exist. |
| LOBBY_FULL | Cannot join lobby because it is currently full. |
| LOBBY_LOCKED | Cannot join lobby because it is currently locked. |
| LOBBY_CLOSE | The host/server has decided to shutdown the lobby. |
| HOST_GONE | Server event that notifies peers that the host has disconnected. |
| PEER_GONE | Server event that notifies a host that a peer has disconnected. |
| HOST_RECLAIM | Server has made a different peer the lobby host. |
| CLAIM_HOST | Ask the server to become the new lobby host. |
| TRANSFER_HOST | Ask the server to transfer ownership of the lobby to a peer. |
| LOCK | Ask the server to prevent access to the lobby. |
| UNLOCK | Ask the server to allow access to the lobby. |
| SIZE | Ask the server to change the maximum peers value for a lobby. |
| KICK | Ask the server to remove a peer from a lobby. |
| PASSWORD_REQUIRED | Cannot join lobby because it requires a password. |
| PASSWORD_ACK | Joining lobby: password accepted. |
| PASSWORD_FAIL | Not joining lobby: password rejected. |
