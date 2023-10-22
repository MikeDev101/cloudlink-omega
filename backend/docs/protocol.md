# Signaling
CloudLink Omega utilizes WebSockets to handle signaling. The protocol for negotiating connections are as follows.

## URL endpoint
The server's websocket endpoint can be connected using the following format:
`wss://the.server.tld:port/ws/{ugi}?v={version}`

	ugi - Unique Game Identifier
	version - API version (should default to 0)


## Message format
All signaling events are JSON-encoded text frames. No newlines or special formatting.
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
		lobby_id: string // Name of your lobby you want to create
		allow_host_reclaim: bool // False - As soon as you leave, this lobby is destroyed. True - Server or peers will decide who becomes the host. Applies to argument allow_peers_to_claim_host.
		allow_peers_to_claim_host: bool // False - Server will decide the new host. True - Peers will decide who becomes host
		max_peers: int // set to 0 for unlimited peers
	},
}
```

### `NEW_HOST` format
This message is sent to peers when a new host is created.

```js
{
	opcode: 9, // NEW_HOST opcode 
	payload: {
		id: string // UUID of the host (use this for tx argument)
		username: string // username of the host
		lobby_id: string // lobby ID the host has created
	},
}
```

### `NEW_PEER` format
This message is sent to a host when a peer wants to join their game.

```js
{
	opcode: 8, // NEW_PEER opcode 
	payload: {
		id: string // UUID of the peer (use this for tx argument)
		username: string // username of the host
	},
}
```

### Opcodes
`opcode` is an integer that represents one of the following message states:

| opcode | name | path | description |
|--------|------|------|-------------|
| 0 | VIOLATION | server > client | Client, you did something that violated this protocol, I am kicking you. |
| 1 | KEEPALIVE | client <> server | Ping/pong eachother. |
| 2 | INIT | client > server | Hello signalier, I am a client. Here is my usernname. |
| 3 | INIT_OK | server > client | Hello client, I am your signaler. |
| 4 | CONFIG_HOST | client > server | Signaler, make me a game host. Here is the name of the lobby I'd like to make and it's configuration settings. | 
| 5 | CONFIG_PEER | client > server | Signaler, make me a game peer. Please let me know if there is a host for this lobby. |
| 6 | ACK_HOST | server > client | Client, I have made you a host and I'll notify peers of your existence. |
| 7 | ACK_PEER | server > client | Client, I'll let you know when a host creates a game for you. |
| 8 | NEW_HOST | server > client | Hello peer, here is a host. |
| 9 | NEW_PEER | server > client | Hello host, here is a peer. |
| 10 | MAKE_OFFER | client > server | Signaler, can you send this offer to this peer? |
| 11 | ANTICIPATE_OFFER | server > client | Hello client, here is an offer from your game host |
| 12 | ACCEPT_OFFER | client > server | Signaler, send my offer back to the host. I'd like to make this connection. |
| 13 | RETURN_OFFER | server > client | Host, here is a offer from a peer. |
| 14 | MAKE_ANSWER | client > server | Signaler, send my answer to this peer. |
| 15 | ANTICIPATE_ANSWER | server > client | Hello client, here is an answer from your peer. |
| 16 | ACK_CHECK | client > server > client | Hey client, are you ready to begin communication? |
| 17 | ACK_READY | client > server > client | Hey client, I'm ready. Let's talk over our RTC channels! |
| 18 | ACK_ABORT | client > server > client | Hey client, I'm not ready. Ignore me! |
| 19 | SHUTDOWN | client > server | Signaler, I'm going away. |
| 20 | SHUTDOWN_ACK | server > clients | Clients, this peer is going away. |
| 21 | LOBBY_EXISTS | server > client | You may not create this lobby because it already exists. |
| 22 | LOBBY_NOTFOUND | server > client | You may not join this lobby because it does not exist. |
| 23 | LOBBY_FULL | server > client | You may not join this lobby because it is full. |
| 24 | LOBBY_LOCKED | server > client | You may not join this lobby because the host has locked the lobby. |
| 25 | LOBBY_CLOSE | server > clients | Hello peers, the host has shut down this lobby. |
| 26 | HOST_GONE | server > clients | Hello peers, the host has left. I'm going to decide a host, or decide a new host amongst yourselves. |
| 27 | PEER_GONE | server > client | Hello host and peer(s), one of your peers have left. |
| 28 | HOST_RECLAIM | server > client | Clients, I have decided to make this peer your new host. |
| 29 | CLAIM_HOST | client > server | Signaler, please make me the new host. |
| 30 | TRANSFER_HOST | client > server | Signaler, please make this peer the host. |
| 31 | ABANDON | client > server | Signaler, please close this lobby. |
| 32 | LOCK | client > server | Signaler, please prevent any new peers from joining this lobby. |
| 33 | UNLOCK | client > server | Signaler, pleas allow peers to join my lobby again. |
| 34 | SIZE | client > server | Signaler, please change the maximum number of peers in the lobby. |
| 35 | KICK | client > server | Signaler, please kick this peer from my lobby. |

## Connection lifespan of a host

1. Connect to websocket.

2. Send INIT to server with our username.
	Tell the server we exist.

3. Server replies INIT_OK.
	Server is aware of our existence.

4. Send CONFIG_HOST while specifying our configuration (lobby name and host options) as payload to the server.
	Tell the server we want to host a game.

5. Server replies ACK_HOST.
	The server says it will honor our request.
	From here, the server will wait for any peers waiting for a game to join.

6. Server replies NEW_PEER with their peer ID as payload.
	The server tells us that someone would like to find a game host.

7. Send MAKE_OFFER with SDP offer as payload and recipient peer as rx to server.
	Tell the peer that we exist, and here's an offer.

8. Server sends ANTICIPATE_OFFER with SDP offer as payload, with originating peer as tx to peer.
	From here, peer will either ignore the request (do nothing) or accept the request (accept offer).

9. Server replies opcode RETURN_OFFER with SDP offer as payload and originating peer as tx.
	The server tells us a peer has accepted our offer and has made an offer of it's own.

10. Send opcode MAKE_ANSWER with SDP answer as payload and recipient peer as rx to server.
	Tell the server we are making an answer to our peer.

11. Server sends opcode ANTICIPATE_ANSWER with SDP answer as payload and originating peer as tx to peer.
	The server will tell the recipient our answer.
	From here, the recipient will make an offer of their own using MAKE_ANSWER to us.

12. Server replies opcode ANTICIPATE_ANSWER with SDP answer as payload and originating peer as tx.
	The sever wants us to be aware of our peer's reply to our answer.

13. Send opcode ACK_CHECK with recipient peer as rx to server.
	Ask the server to check if our peer is ready to begin communication.

14. Server replies ACK_READY with originating peer as tx.
	The server lets us know that our peer is fully ready to go.
	At this point, let the games begin!

## Connection lifespan of a peer

1. Connect to websocket.

2. Send INIT to server with our username.
	Tell the server we exist.

3. Server replies INIT_OK.
	Server is aware of our existence.

4. Send CONFIG_PEER while specifying a game lobby ID as payload to the server.
	Tell the server we want to join a game.

5. Server replies ACK_PEER.
	The server says it will honor our request.
	From here, the server will wait for any hosts providing a game for us to join.

6. Server replies NEW_HOST with their peer ID as payload.
	The server tells us that someone who's hosting a game.
	We will wait a little bit for the host to generate an offer.

7. Server replies with ANTICIPATE_OFFER with SDP offer as payload, with originating peer as tx.
	The host has created an offer for us to accept or ignore.
	We may accept the offer by continuing with the connection lifespan as follows, or ignore it and
	move on to another host.

8. Send opcode ACCEPT_OFFER with SDP offer as payload and recipient peer as tx.
	Tell the server to notify our game host we would like to connect to them.
	We generate an offer and send it to the host. After that, we will wait a 
	little bit for the host to generate an answer for our offer.

9. Server replies with opcode ANTICIPATE_ANSWER with SDP answer as payload and originating peer as tx.
	The server has notifed us of the host's answer, and will now patiently anticipate our answer.
	During this time, we will generate an answer.

10. Send opcode MAKE_ANSWER with SDP answer as payload and recipient peer as rx to server.
	Tell the server we are making an answer to our host.
	From here, we will continue to wait for the host.

11. Server replies with opcode ACK_CHECK with originating peer as tx.
	The server is letting us know that the host would like to check if we're ready to begin communication.
	If we manage to get this far, things are looking good.

12. Send opcode ACK_READY with originating peer as tx.
	Tell our peer that we're ready to go. Let the games begin!