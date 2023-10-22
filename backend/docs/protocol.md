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
	payload: any, // Can be a SDP offer/answer, or a lobby ID.
	tx: string, // provided by the server only
	rx: string, // provided by a client only
}
```

### Opcodes
`opcode` is an integer that represents one of the following message states:
	
	0 - VIOLATION (server > client, "client, you did something that violated this protocol, I am kicking you")

	1 - KEEPALIVE (client <> server, "you still there? yep")

	2 - INIT (client > server, "Hello signaler, I am a client")
	3 - INIT_OK (server > client, "Hi client, I am your signaler")
	
	4 - CONFIG_HOST (client > server, "hi signaler, i would like to host a game")
	5 - CONFIG_PEER (client > server, "hi signaler, i would like to join a game")

	6 - ACK_PEER (server > client, "hi client, i will let you know when a host creates a game")
	7 - ACK_HOST (server > client, "hi client, i will let you know when a client wants to join you")

	8 - NEW_PEER (server > client, "hi client, here is a peer wanting to join your game")
	9 - NEW_HOST (server > client, "hi client, here is a peer wanting to host a game")

	10 - MAKE_OFFER (client > server, "hi signaler, can you send this offer to this peer?")
	11 - ANTICIPATE_OFFER (server > clients, "hello client, here is a new offer")

	12 - ACCEPT_OFFER (client > server, "signaler, please tell the offerer I would like to make this connection. here is my own offer")
	13 - RETURN_OFFER (server > client, "hello client, here is an offer from another peer")
	
	14 - MAKE_ANSWER (client > server, "hello server, please give my answer to my replying peer")
	15 - ANTICIPATE_ANSWER (server > client, "hello client, here is an answer from a peer")

	16 - ACK_CHECK ("can you confirm that you are ready to switch over?")
	17 - ACK_READY ("yes, let's switch over")

	18 - SHUTDOWN ("hello signaler, I am leaving")
	19 - SHUTDOWN_ACK ("hello other clients, one of your peers are disconnecting")
	20 - SHUTDOWN_WRN ("hello signaler, i think one of our peers have suddently disconnected")

## Connection lifespan of a host

	1. Connect to websocket.

	2. Send opcode 2 (INIT) to server.
		Tell the server we exist.

	3. Server replies opcode 3 (INIT_OK).
		Server is aware of our existence.
		From here, the server will periodically send opcode 1 (KEEPALIVE),
		and the client will reply with opcode 1 (KEEPALIVE) as well.

	4. Send opcode 4 (CONFIG_HOST) while specifying a game lobby ID as payload to the server.
		Tell the server we want to host a game.

	5. Server replies opcode 7 (ACK_HOST).
		The server says it will honor our request.
		From here, the server will wait for any peers waiting for a game to join.

	6. Server replies opcode 8 (NEW_PEER) with their peer ID as payload.
		The server tells us that someone would like to find a game host.

	7. Send opcode 10 (MAKE_OFFER) with SDP offer as payload and recipient peer as rx to server.
		Tell the peer that we exist, and here's an offer.

	8. Server sends opcode 11 (ANTICIPATE_OFFER) with SDP offer as payload, with originating peer as tx to peer.
		From here, peer will either ignore the request (do nothing) or accept the request (accept offer).

	9. Server replies opcode 13 (RETURN_OFFER) with SDP offer as payload and originating peer as tx.
		The server tells us a peer has accepted our offer and has made an offer of it's own.
	
	10. Send opcode 14 (MAKE_ANSWER) with SDP answer as payload and recipient peer as rx to server.
		Tell the server we are making an answer to our peer.
	
	11. Server sends opcode 15 (ANTICIPATE_ANSWER) with SDP answer as payload and originating peer as tx to peer.
		The server will tell the recipient our answer.
		From here, the recipient will make an offer of their own using opcode 14 (MAKE_ANSWER) to us.
	
	12. Server replies opcode 15 (ANTICIPATE_ANSWER) with SDP answer as payload and originating peer as tx.
		The sever wants us to be aware of our peer's reply to our answer.

	13. Send opcode 16 (ACK_CHECK) with recipient peer as rx to server.
		Ask the server to check if our peer is ready to begin communication.
	
	14. Server replies opcode 17 (ACK_READY) with originating peer as tx.
		The server lets us know that our peer is fully ready to go.
		At this point, let the games begin!

## Connection lifespan of a peer

	1. Connect to websocket.

	2. Send opcode 2 (INIT) to server.
		Tell the server we exist.

	3. Server replies opcode 3 (INIT_OK).
		Server is aware of our existence.
		From here, the server will periodically send opcode 1 (KEEPALIVE),
		and the client will reply with opcode 1 (KEEPALIVE) as well.

	4. Send opcode 5 (CONFIG_PEER) while specifying a game lobby ID as payload to the server.
		Tell the server we want to join a game.

	5. Server replies opcode 6 (ACK_PEER).
		The server says it will honor our request.
		From here, the server will wait for any hosts providing a game for us to join.

	6. Server replies opcode 9 (NEW_HOST) with their peer ID as payload.
		The server tells us that someone who's hosting a game.
		We will wait a little bit for the host to generate an offer.

	7. Server replies with opcode 11 (ANTICIPATE_OFFER) with SDP offer as payload, with originating peer as tx.
		The host has created an offer for us to accept or ignore.
		We may accept the offer by continuing with the connection lifespan as follows, or ignore it and
		move on to another host.
	
	8. Send opcode 12 (ACCEPT_OFFER) with SDP offer as payload and recipient peer as tx.
		Tell the server to notify our game host we would like to connect to them.
		We generate an offer and send it to the host. After that, we will wait a 
		little bit for the host to generate an answer for our offer.
	
	9. Server replies with opcode 15 (ANTICIPATE_ANSWER) with SDP answer as payload and originating peer as tx.
		The server has notifed us of the host's answer, and will now patiently anticipate our answer.
		During this time, we will generate an answer.

	10. Send opcode 14 (MAKE_ANSWER) with SDP answer as payload and recipient peer as rx to server.
		Tell the server we are making an answer to our host.
		From here, we will continue to wait for the host.
	
	11. Server replies with opcode 16 (ACK_CHECK) with originating peer as tx.
		The server is letting us know that the host would like to check if we're ready to begin communication.
		If we manage to get this far, things are looking good.
	
	12. Send opcode 17 (ACK_READY) with originating peer as tx.
		Tell our peer that we're ready to go. Let the games begin!