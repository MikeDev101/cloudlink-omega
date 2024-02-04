(function (Scratch) {

    // Define class for authentication
    class AuthManager {
        constructor() {
            this.loginUrl = "http://localhost:3000/api/v0/login";
            this.registerUrl = "http://localhost:3000/api/v0/register";
            this.registerSuccess = false;
            this.loginSuccess = false;
            this.sessionToken = null;
        }

        async Login(email, password) {
            try {
                const response = await fetch(this.loginUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email,
                        password,
                    }),
                });

                const data = await response.text(); // text/plain response. Should be just "OK".
                if (response.ok) {
                    console.log("Account logged in successfully.");
                    this.sessionToken = data;

                } else {
                    console.warn("Account logged in failed:", data);
                }
                this.loginSuccess = response.ok;
            } catch (error) {
                console.error('Error getting login token:', error);
            }
        }

        async Register(email, username, password) {
            try {
                const response = await fetch(this.registerUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email,
                        username,
                        password,
                    }),
                });

                const data = await response.text(); // text/plain response. Should be just "OK".
                if (data == 'OK') {
                    console.log("Account registered successfully.");
                    
                } else {
                    console.warn("Account registration failed:", data);
                }
                this.registerSuccess = (data == 'OK');
            } catch (error) {
                console.error('Error getting response:', error);
                this.registerSuccess = false;
            }
        }
    }

    // Define class to enable WebRTC connectivity
    class OmegaRTC {
        constructor() {
            this.configuration = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                ]
            }
            this.peerConnections = new Map();
            this.dataChannels = new Map();
            this.messageHandlers = {
                onIceGatheringDone: {},
                onChannelOpen: null,
                onChannelMessage: null,
                onChannelClose: null,
            }
            this.iceCandidates = [];
        }

        async createOffer(remoteUserId) {
            const peerConnection = this.createPeerConnection(remoteUserId);
            const dataChannel = this.createDefaultChannel(peerConnection, remoteUserId);
            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                return { offer, dataChannel };
            } catch (error) {
                console.error(`Error creating offer for ${remoteUserId}: ${error}`);
                return null;
            }
        }

        async createAnswer(remoteUserId, offer) {
            const peerConnection = this.createPeerConnection(remoteUserId);
            const dataChannel = this.createDefaultChannel(peerConnection, remoteUserId);
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                return { answer, dataChannel };
            } catch (error) {
                console.error(`Error creating answer for ${remoteUserId}: ${error}`);
                return null;
            }
        }

        async handleAnswer(remoteUserId, answer) {
            const peerConnection = this.peerConnections.get(remoteUserId);
            if (peerConnection) {
                try {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (error) {
                    console.error(`Error handling answer for ${remoteUserId}: ${error}`);
                }
            } else {
                console.error(`Peer connection not found for ${remoteUserId}`);
            }
        }

        addIceCandidate(remoteUserId, iceCandidate) {
            const peerConnection = this.peerConnections.get(remoteUserId);
            if (peerConnection) {
                try {
                    const candidate = new RTCIceCandidate(iceCandidate);
                    peerConnection.addIceCandidate(candidate);
                } catch (error) {
                    console.error(`Error adding ice candidate for ${remoteUserId}: ${error}`);
                }
            } else {
                console.error(`Peer connection not found for ${remoteUserId}`);
            }
        }

        createPeerConnection(remoteUserId) {
            const peerConnection = new RTCPeerConnection(this.configuration);

            peerConnection.onicecandidate = (event) => {

                // Store the ICE candidate for later use
                if (event.candidate) {
                    this.iceCandidates.push(event.candidate);
                }

                // When all ICE candidates are gathered, send them to the remote peer
                if (event.target.iceGatheringState === 'complete') {
                    if (this.messageHandlers.onIceGatheringDone[remoteUserId]) {
                        console.log("ICE candidate gathering done for", remoteUserId);
                        this.messageHandlers.onIceGatheringDone[remoteUserId]();
                    }
                }
            };

            peerConnection.ondatachannel = (event) => {
                const dataChannel = event.channel;
                this.handleDataChannel(dataChannel, remoteUserId);
            };

            this.peerConnections.set(remoteUserId, peerConnection);

            return peerConnection;
        }

        handleDataChannel(dataChannel, remoteUserId) {
            if (!this.dataChannels.has(remoteUserId)) {
                const defaultDataChannel = dataChannel;
                this.dataChannels.set(remoteUserId, defaultDataChannel);

                defaultDataChannel.onmessage = (event) => {
                    console.log(`Received message from ${remoteUserId}: ${event.data}`);
                    if (this.messageHandlers.onChannelMessage) {
                        this.messageHandlers.onChannelMessage(event.data, remoteUserId);
                    }
                };

                defaultDataChannel.onopen = () => {
                    console.log(`Data channel with ${remoteUserId} opened`);
                    if (this.messageHandlers.onChannelOpen) {
                        this.messageHandlers.onChannelOpen(remoteUserId);
                    }
                };

                defaultDataChannel.onclose = () => {
                    console.log(`Data channel with ${remoteUserId} closed`);
                    if (this.messageHandlers.onChannelClose) {
                        this.messageHandlers.onChannelClose(remoteUserId);
                    }
                };
            }
        }

        createDefaultChannel(peerConnection, remoteUserId) {
            const dataChannel = peerConnection.createDataChannel(
                'default',
                { negotiated: true, id: 0, ordered: true, protocol: 'clomega' }
            );
            this.handleDataChannel(dataChannel, remoteUserId);
            return dataChannel;
        }

        createNewDataChannel(remoteUserId, label, id, ordered) {
            const peerConnection = this.peerConnections.get(remoteUserId);
            const dataChannel = peerConnection.createDataChannel(
                label,
                { negotiated: true, id: id, ordered: ordered, protocol: 'clomega' }
            );
            this.handleDataChannel(dataChannel, remoteUserId);
            return dataChannel;
        }

        onIceGatheringDone(remoteUserId, callback) {
            this.messageHandlers.onIceGatheringDone[remoteUserId] = callback;
        }

        onChannelOpen(callback) {
            this.messageHandlers.onChannelOpen = callback;
        }

        onChannelClose(callback) {
            this.messageHandlers.onChannelClose = callback;
        }

        onChannelMessage(callback) {
            this.messageHandlers.onChannelMessage = callback;
        }
    }

    // Define class to provide signaling for WebRTC and for WebSocket relay (too lazy to make a TURN server)
    class OmegaSignaling {
        constructor() {
            this.messageHandlers = {
                onInitSuccess: null,
                onConnect: null,
                onClose: null,
                offer: null,
                answer: null,
                keepalive: null,
                onHostModeConfig: null,
                onPeerModeConfig: null,
                onNewHost: null,
                onNewPeer: null,
                onIceCandidate: {},
                onOffer: null,
                onAnswer: {},
                listeners: {},
            };
            this.state = {
                user: "", // username
                id: "", // ULID
                game: "", // game name
                developer: "", // developer name
                mode: 0, // 0 - configuring, 1 - host, 2 - peer
            };
        }

        Connect(ugi) {
            this.url = new URL("ws://localhost:3000/api/v0/signaling");
            this.url.searchParams.append('ugi', ugi);
            this.socket = new WebSocket(this.url);

            this.socket.onopen = () => {
                console.log('WebSocket connection opened');
                if (this.messageHandlers.onConnect) {
                    this.messageHandlers.onConnect();
                }
            };

            this.socket.onclose = (event) => {
                console.log('WebSocket connection closed:', event);

                // Clear values
                this.state.id = "";
                this.state.user = "";
                this.state.developer = "";
                this.state.game = "";
                this.state.mode = 0;
                this.socket = null;

                if (this.messageHandlers.onClose) {
                    this.messageHandlers.onClose(event);
                }
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            this.socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Error handling message:', error);
                }
            };
        }

        handleMessage(message) {
            const { opcode, payload, origin, listener } = message;
            switch (opcode) {
                case 'INIT_OK':
                    console.log('Protocol initialization successful.');
                    this.state.user = payload.user;
                    this.state.id = payload.id;
                    this.state.game = payload.game;
                    this.state.developer = payload.developer;
                    if (this.messageHandlers.onInitSuccess) {
                        this.messageHandlers.onInitSuccess();
                    }
                    break;
                case "ACK_HOST":
                    console.log("Protocol acknowledgement received: Operating in host mode.");
                    this.state.mode = 1;
                    break;
                case "ACK_PEER":
                    console.log("Protocol acknowledgement received: Operating in peer mode.");
                    this.state.mode = 2;
                    break;
                case "VIOLATION":
                    console.error("Protocol violation: " + payload);
                    break;
                case "WARNING": 
                    console.warn("Protocol warning: " + payload);
                    break;
                case "CONFIG_REQUIRED":
                    console.warn("Configuration required: " + payload);
                    break;
                case "RELAY_OK":
                    break;
                case "NOT_HOST":
                    console.warn("Protocol warning: Attempted to send offer while operating in peer mode.");
                    break;
                case "NOT_PEER":
                    console.warn("Protocol warning: Attempted to send answer while operating in host mode.");
                    break;
                case "KEEPALIVE":
                    break;
                case "LOBBY_FULL":
                    console.warn("Lobby is full.");
                    break;
                case "LOBBY_EXISTS":
                    console.warn("Lobby already exists.");
                    break;
                case "LOBBY_NOTFOUND":
                    console.warn("Lobby does not exist.");
                    break;
                case "LOBBY_LOCKED":
                    console.warn("Lobby does not exist.");
                    break;
                case "LOBBY_CLOSE":
                    console.log("Lobby closed.");
                    break;
                case "HOST_GONE":
                    console.log("The host has left.");
                    break;
                case "PEER_GONE":
                    console.log("A peer has left.");
                    break;
                case "SESSION_EXISTS":
                    console.warn("Protocol warning: Session already exists.");
                    break;
                case "TOKEN_INVALID":
                    console.warn("Protocol warning: Invalid token.");
                    break;
                case "TOKEN_EXPIRED":
                    console.warn("Protocol warning: Token expired.");
                    break;
                case "TOKEN_ORIGIN_MISMATCH":
                    console.warn("Protocol warning: Attempted to use a token generated on a different domain.");
                    break;
                case "NEW_PEER":
                    if (this.state.mode != 1) { // require host mode
                        console.warn("Protocol bug: Received NEW_PEER message while operating in peer/configuring mode.");
                        return;
                    }
                    this.messageHandlers.onNewPeer(payload.id, payload.user);
                    break;
                case "NEW_HOST":
                    if (this.state.mode != 0) { // require configuring mode
                        console.warn("Protocol bug: Received NEW_HOST message while operating in host/peer mode.");
                        return;
                    }
                    this.messageHandlers.onNewHost(payload.id, payload.lobby_id, payload.user);
                    break;
                case "MAKE_OFFER":
                    if (this.state.mode != 2) { // require peer mode
                        console.warn("Protocol bug: Received MAKE_OFFER message while operating in host/configuring mode.");
                        return;
                    }
                    this.messageHandlers.onOffer(origin, payload);
                    break;
                case "MAKE_ANSWER":
                    if (this.state.mode != 1) { // require host mode
                        console.warn("Protocol bug: Received MAKE_ANSWER message while operating in peer/configuring mode.");
                        return;
                    }
                    this.messageHandlers.onAnswer[origin](origin, payload);
                    break;
                case "ICE":
                    if (this.state.mode == 0) { // require host/peer mode
                        console.warn("Protocol bug: Received ICE message while operating in configuring mode.");
                        return;
                    }
                    this.messageHandlers.onIceCandidate(origin, payload);
                    break;
            }

            // Call listeners   
            if (this.messageHandlers[listener]) {
                if (this.messageHandlers[listener]) {
                    this.messageHandlers[listener](message);
                }
            }
        }
0
        hostMode(lobby_id, allow_host_reclaim, allow_peers_to_claim_host, max_peers, password, listener) {
            this.sendMessage({
                opcode: 'CONFIG_HOST',
                payload: {
                    lobby_id,
                    allow_host_reclaim,
                    allow_peers_to_claim_host,
                    max_peers,
                    password
                },
                listener
            });
        }

        peerMode(lobby_id, password, listener) {
            this.sendMessage({
                opcode: 'CONFIG_PEER',
                payload: {
                    lobby_id,
                    password
                },
                listener
            });
        }

        authenticateWithToken(token, listener) {
            this.sendMessage({ opcode: 'INIT', payload: token, listener });
        }

        sendOffer(recipient, offer, listener) {
            this.sendMessage({ opcode: 'MAKE_OFFER', payload: offer, recipient, listener });
        }

        sendAnswer(recipient, answer, listener) {
            this.sendMessage({ opcode: 'MAKE_ANSWER', payload: answer, recipient, listener });
        }

        sendIceCandidate(recipient, answer, listener) {
            this.sendMessage({ opcode: 'ICE', payload: answer, recipient, listener });
        }

        Disconnect() {
            this.socket.close();
        }

        sendMessage(message) {
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify(message));
            } else {
                console.error('WebSocket connection not open. Cannot send message:', message);
            }
        }

        onAnswer(remoteUserId, callback) {
            this.messageHandlers.onAnswer[remoteUserId] = callback;
        }

        onNewHost(callback) {
            this.messageHandlers.onNewHost = callback;
        }

        onNewPeer(callback) {
            this.messageHandlers.onNewPeer = callback;
        }

        onHostModeConfig(callback) {
            this.messageHandlers.onHostModeConfig = callback;
        }

        onPeerModeConfig(callback) {
            this.messageHandlers.onPeerModeConfig = callback;
        }

        onIceCandidate(callback) {
            this.messageHandlers.onIceCandidate = callback;
        }

        onListener(name, callback) {
            this.messageHandlers.listeners[name] = callback;
        }

        onConnect(callback) {
            this.messageHandlers.onConnect = callback;
        }

        onInitSuccess(callback) {
            this.messageHandlers.onInitSuccess = callback;
        }

        onOffer(callback) {
            this.messageHandlers.onOffer = callback;
        }

        onClose(callback) {
            this.messageHandlers.onClose = callback;
        }
    }

    // Define the extension class that glues the two previous classes together
    class CloudLinkOmega {
        constructor(Scratch) {
            this.vm = Scratch.vm; // VM
            this.runtime = Scratch.vm.runtime; // Runtime
            this.targets = Scratch.vm.runtime.targets // Access variables
            this.Signaling = new OmegaSignaling();
            this.WebRTC = new OmegaRTC();
            this.AuthManager = new AuthManager();
            this.blockIconURI =
                "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSIxNzYuMzk4NTQiIGhlaWdodD0iMTIyLjY3MDY5IiB2aWV3Qm94PSIwLDAsMTc2LjM5ODU0LDEyMi42NzA2OSI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTE1MS44MDA3MywtMTE4LjY2NDY1KSI+PGcgZGF0YS1wYXBlci1kYXRhPSJ7JnF1b3Q7aXNQYWludGluZ0xheWVyJnF1b3Q7OnRydWV9IiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIHN0cm9rZS1taXRlcmxpbWl0PSIxMCIgc3Ryb2tlLWRhc2hhcnJheT0iIiBzdHJva2UtZGFzaG9mZnNldD0iMCIgc3R5bGU9Im1peC1ibGVuZC1tb2RlOiBub3JtYWwiPjxwYXRoIGQ9Ik0yODYuMTIwMzcsMTU3LjE3NzU1YzIzLjI0MDg2LDAgNDIuMDc4OSwxOC44Mzk0NiA0Mi4wNzg5LDQyLjA3ODljMCwyMy4yMzk0NCAtMTguODM4MDMsNDIuMDc4OSAtNDIuMDc4OSw0Mi4wNzg5aC05Mi4yNDA3NGMtMjMuMjQwODYsMCAtNDIuMDc4OSwtMTguODM5NDYgLTQyLjA3ODksLTQyLjA3ODljMCwtMjMuMjM5NDQgMTguODM4MDMsLTQyLjA3ODkgNDIuMDc4OSwtNDIuMDc4OWg0LjE4ODg3YzEuODExNTMsLTIxLjU3MDU1IDE5Ljg5MzU3LC0zOC41MTI4OSA0MS45MzE1LC0zOC41MTI4OWMyMi4wMzc5MywwIDQwLjExOTk3LDE2Ljk0MjM0IDQxLjkzMTUsMzguNTEyODl6IiBmaWxsPSIjZmZmZmZmIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz48cGF0aCBkPSJNMjY5LjA3ODMzLDIxNy42MzQ5NGMwLDIuMzkzMzMgLTEuOTQwMDYsNC4zMzMzNyAtNC4zMzMzNyw0LjMzMzM3aC0xNS4zOTYwNGMtMi4zOTMzMywwIC00LjMzMzM3LC0xLjk0MDA1IC00LjMzMzM3LC00LjMzMzM3di05LjM1NDQ1YzAsLTEuNjc1MDYgMC45NjU0NywtMy4xOTk5OCAyLjQ3OTMzLC0zLjkxNjcyYzUuODkwNTcsLTIuNzg4MDkgOS42OTY3OSwtOC43OTc4MyA5LjY5Njc5LC0xNS4zMTAyNGMwLC05LjMzNDMgLTcuNTk0MjMsLTE2LjkyODUzIC0xNi45Mjg3NSwtMTYuOTI4NTNjLTkuMzM0NTIsMCAtMTYuOTI4NTMsNy41OTQyMyAtMTYuOTI4NTMsMTYuOTI4NTNjMCw2LjUxMjYyIDMuODA2MjIsMTIuNTIyMTQgOS42OTY3OSwxNS4zMTAyNGMxLjUxNDA4LDAuNzE2NTIgMi40Nzk1NiwyLjI0MTQ0IDIuNDc5NTYsMy45MTY3MnY5LjM1NDQ1YzAsMi4zOTMzMyAtMS45NDAwNiw0LjMzMzM3IC00LjMzMzM3LDQuMzMzMzdoLTE1LjM5NjQ3Yy0yLjM5MzMzLDAgLTQuMzMzMzcsLTEuOTQwMDUgLTQuMzMzMzcsLTQuMzMzMzdjMCwtMi4zOTMzMyAxLjk0MDA2LC00LjMzMzM3IDQuMzMzMzcsLTQuMzMzMzdoMTEuMDYzMXYtMi40NDk0NGMtMy4yNDMxLC0xLjk5ODEyIC02LjAwOTA5LC00LjY5OTc2IC04LjA5MzY2LC03LjkyNjgyYy0yLjY3MDg3LC00LjEzNDQ3IC00LjA4MjY4LC04LjkzMTA4IC00LjA4MjY4LC0xMy44NzE3N2MwLC0xNC4xMTMzNiAxMS40ODE5MiwtMjUuNTk1MjggMjUuNTk1MjcsLTI1LjU5NTI4YzE0LjExMzM2LDAgMjUuNTk1NSwxMS40ODE5MiAyNS41OTU1LDI1LjU5NTA2YzAsNC45NDA3IC0xLjQxMTgxLDkuNzM3NTIgLTQuMDgyNDcsMTMuODcxNzdjLTIuMDg0NTcsMy4yMjcwNiAtNC44NTAzNSw1LjkyODkyIC04LjA5MzY2LDcuOTI3MDR2Mi40NDk0NGgxMS4wNjI2N2MyLjM5MzMzLDAgNC4zMzMzNywxLjk0MDA2IDQuMzMzMzcsNC4zMzMzN3oiIGZpbGw9IiNmZjRkNGMiIGZpbGwtcnVsZT0ibm9uemVybyIvPjwvZz48L2c+PC9zdmc+PCEtLXJvdGF0aW9uQ2VudGVyOjg4LjE5OTI2OTk5OTk5OTk4OjYxLjMzNTM0NTAwMDAwMDAwNC0tPg==";

            this.menuIconURI =
                "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSIyMjUuMzU0OCIgaGVpZ2h0PSIyMjUuMzU0OCIgdmlld0JveD0iMCwwLDIyNS4zNTQ4LDIyNS4zNTQ4Ij48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMTI3LjMyMjYsLTY3LjMyMjYpIj48ZyBkYXRhLXBhcGVyLWRhdGE9InsmcXVvdDtpc1BhaW50aW5nTGF5ZXImcXVvdDs6dHJ1ZX0iIHN0cm9rZT0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIHN0cm9rZS1taXRlcmxpbWl0PSIxMCIgc3Ryb2tlLWRhc2hhcnJheT0iIiBzdHJva2UtZGFzaG9mZnNldD0iMCIgc3R5bGU9Im1peC1ibGVuZC1tb2RlOiBub3JtYWwiPjxwYXRoIGQ9Ik0xMjcuMzIyNiwxODBjMCwtNjIuMjMwMDEgNTAuNDQ3MzksLTExMi42Nzc0IDExMi42Nzc0LC0xMTIuNjc3NGM2Mi4yMzAwMSwwIDExMi42Nzc0LDUwLjQ0NzM5IDExMi42Nzc0LDExMi42Nzc0YzAsNjIuMjMwMDEgLTUwLjQ0NzM5LDExMi42Nzc0IC0xMTIuNjc3NCwxMTIuNjc3NGMtNjIuMjMwMDEsMCAtMTEyLjY3NzQsLTUwLjQ0NzM5IC0xMTIuNjc3NCwtMTEyLjY3NzR6IiBmaWxsPSIjZmY0ZDRjIiBmaWxsLXJ1bGU9Im5vbnplcm8iIHN0cm9rZS13aWR0aD0iMCIvPjxwYXRoIGQ9Ik0yODUuODU3NDIsMTUxLjA4Mzg1YzIzLjI0MDg2LDAgNDIuMDc4OSwxOC44Mzk0NiA0Mi4wNzg5LDQyLjA3ODljMCwyMy4yMzk0NCAtMTguODM4MDMsNDIuMDc4OSAtNDIuMDc4OSw0Mi4wNzg5aC05Mi4yNDA3NGMtMjMuMjQwODYsMCAtNDIuMDc4OSwtMTguODM5NDYgLTQyLjA3ODksLTQyLjA3ODljMCwtMjMuMjM5NDQgMTguODM4MDMsLTQyLjA3ODkgNDIuMDc4OSwtNDIuMDc4OWg0LjE4ODg3YzEuODExNTMsLTIxLjU3MDU1IDE5Ljg5MzU3LC0zOC41MTI4OSA0MS45MzE1LC0zOC41MTI4OWMyMi4wMzc5MywwIDQwLjExOTk3LDE2Ljk0MjM0IDQxLjkzMTUsMzguNTEyODl6IiBmaWxsPSIjZmZmZmZmIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0yNjguODE1MzcsMjExLjU0MTI1YzAsMi4zOTMzMiAtMS45NDAwNSw0LjMzMzM3IC00LjMzMzM3LDQuMzMzMzdoLTE1LjM5NjAzYy0yLjM5MzMyLDAgLTQuMzMzMzcsLTEuOTQwMDUgLTQuMzMzMzcsLTQuMzMzMzd2LTkuMzU0NDVjMCwtMS42NzUwNyAwLjk2NTQ4LC0zLjE5OTk4IDIuNDc5MzQsLTMuOTE2NzJjNS44OTA1NywtMi43ODgwOSA5LjY5Njc5LC04Ljc5NzgzIDkuNjk2NzksLTE1LjMxMDI0YzAsLTkuMzM0MyAtNy41OTQyMywtMTYuOTI4NTMgLTE2LjkyODc1LC0xNi45Mjg1M2MtOS4zMzQ1MiwwIC0xNi45Mjg1Myw3LjU5NDIzIC0xNi45Mjg1MywxNi45Mjg1M2MwLDYuNTEyNjIgMy44MDYyMiwxMi41MjIxNSA5LjY5Njc5LDE1LjMxMDI0YzEuNTE0MDgsMC43MTY1MiAyLjQ3OTU2LDIuMjQxNDQgMi40Nzk1NiwzLjkxNjcydjkuMzU0NDVjMCwyLjM5MzMyIC0xLjk0MDA1LDQuMzMzMzcgLTQuMzMzMzcsNC4zMzMzN2gtMTUuMzk2NDdjLTIuMzkzMzIsMCAtNC4zMzMzNywtMS45NDAwNSAtNC4zMzMzNywtNC4zMzMzN2MwLC0yLjM5MzMyIDEuOTQwMDUsLTQuMzMzMzcgNC4zMzMzNywtNC4zMzMzN2gxMS4wNjMxdi0yLjQ0OTQ0Yy0zLjI0MzA5LC0xLjk5ODEyIC02LjAwOTA5LC00LjY5OTc2IC04LjA5MzY2LC03LjkyNjgyYy0yLjY3MDg4LC00LjEzNDQ3IC00LjA4MjY5LC04LjkzMTA4IC00LjA4MjY5LC0xMy44NzE3OGMwLC0xNC4xMTMzNiAxMS40ODE5MiwtMjUuNTk1MjcgMjUuNTk1MjcsLTI1LjU5NTI3YzE0LjExMzM2LDAgMjUuNTk1NDksMTEuNDgxOTIgMjUuNTk1NDksMjUuNTk1MDZjMCw0Ljk0MDcgLTEuNDExODEsOS43Mzc1MiAtNC4wODI0NywxMy44NzE3OGMtMi4wODQ1NywzLjIyNzA2IC00Ljg1MDM0LDUuOTI4OTIgLTguMDkzNjYsNy45MjcwNHYyLjQ0OTQ0aDExLjA2MjY2YzIuMzkzMzIsMCA0LjMzMzM3LDEuOTQwMDUgNC4zMzMzNyw0LjMzMzM3eiIgZmlsbD0iI2ZmNGQ0YyIgZmlsbC1ydWxlPSJub256ZXJvIiBzdHJva2Utd2lkdGg9IjEiLz48L2c+PC9nPjwvc3ZnPjwhLS1yb3RhdGlvbkNlbnRlcjoxMTIuNjc3Mzk5OTk5OTk5OTk6MTEyLjY3NzQtLT4=";
        }

        // Define blocks used in the extension
        getInfo() {
            return {
                id: 'cloudlinkomega',
                name: 'CloudLink Ω',
                docsURI: 'about:blank', // TODO: docs webpage
                blockIconURI: this.blockIconURI,
                menuIconURI: this.menuIconURI,
                color1: "#ff4d4c",
                color2: "#ff6160",
                color3: "#ff7473",
                blocks: [
                    {
                        opcode: "on_signalling_connect",
                        blockType: "event",
                        text: "When I get connected to the game server",
                        isEdgeActivated: false,
                    },
                    {
                        opcode: 'initialize',
                        blockType: 'command',
                        text: 'Connect to game [UGI]',
                        arguments: {
                            UGI: {
                                type: 'string',
                                defaultValue: '01HNPHRWS0N0AYMM5K4HN31V4W',
                            },
                        }
                    },
                    {
                        opcode: 'authenticateWithCredentials',
                        blockType: 'command',
                        text: 'Login with email: [EMAIL] password: [PASSWORD]',
                        arguments: {
                            EMAIL: {
                                type: 'string',
                                defaultValue: '',
                            },
                            PASSWORD: {
                                type: 'string',
                                defaultValue: '',
                            }
                        }
                    },
                    {
                        opcode: 'authenticateWithToken',
                        blockType: 'command',
                        text: 'Login with session token: [TOKEN]',
                        arguments: {
                            TOKEN: {
                                type: 'string',
                                defaultValue: '',
                            }
                        }
                    },
                    {
                        opcode: 'register',
                        blockType: 'command',
                        text: 'Register with email: [EMAIL] username: [USERNAME] password: [PASSWORD]',
                        arguments: {
                            EMAIL: {
                                type: 'string',
                                defaultValue: '',
                            },
                            USERNAME: {
                                type: 'string',
                                defaultValue: '',
                            },
                            PASSWORD: {
                                type: 'string',
                                defaultValue: '',
                            }
                        }
                    },
                    {
                        opcode: 'is_signalling_connected',
                        blockType: 'Boolean',
                        text: 'Connected to game server?',
                    },
                    "---",
                    {
                        opcode: 'my_ID',
                        blockType: 'reporter',
                        text: 'My ID',
                    },
                    {
                        opcode: 'my_Username',
                        blockType: 'reporter',
                        text: 'My Username',
                    },
                    {
                        opcode: 'my_SessionToken',
                        blockType: 'reporter',
                        text: 'My Session Token',
                    },
                    "---",
                    {
                        opcode: 'get_peers',
                        blockType: 'reporter',
                        text: 'Connected peers',
                    },
                    {
                        opcode: 'get_peer_channels',
                        blockType: 'reporter',
                        text: 'Peer [PEER] channels',
                        arguments: {
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                        },
                    },
                    {
                        opcode: 'is_peer_connected',
                        blockType: 'Boolean',
                        text: 'Connected to peer [PEER]?',
                        arguments: {
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            }
                        }
                    },
                    "---",
                    {
                        opcode: 'init_host_mode',
                        blockType: 'command',
                        text: 'Host a lobby named [LOBBY], set the peer limit to [PEERS], set password to [PASSWORD], and [CLAIMCONFIG]',
                        arguments: {
                            LOBBY: {
                                type: 'string',
                                defaultValue: 'DemoLobby',
                            },
                            PEERS: {
                                type: 'number',
                                defaultValue: 0,
                            },
                            PASSWORD: {
                                type: 'string',
                                defaultValue: '',
                            },
                            CLAIMCONFIG: {
                                type: 'number',
                                menu: 'lobbyConfigMenu',
                                defaultValue: "1",
                            },
                        }
                    },
                    {
                        opcode: 'init_peer_mode',
                        blockType: 'command',
                        text: 'Join lobby [LOBBY] with password [PASSWORD]',
                        arguments: {
                            LOBBY: {
                                type: 'string',
                                defaultValue: 'DemoLobby',
                            },
                            PASSWORD: {
                                type: 'string',
                                defaultValue: '',
                            },
                        }
                    },
                    {
                        opcode: "get_client_mode",
                        blockType: "reporter",
                        text: "Am I a host or a peer?",
                    },
                    "---",
                    {
                        opcode: 'on_new_peer',
                        blockType: 'event',
                        isEdgeActivated: false,
                        text: 'When I get connected to a new peer',
                    },
                    {
                        opcode: "get_new_peer",
                        blockType: "reporter",
                        text: "Newest peer connected",
                    },
                    "---",
                    {
                        opcode: "on_dchan_message",
                        blockType: "hat",
                        text: "When I get a message from peer [PEER] in channel [CHANNEL]",
                        isEdgeActivated: false,
                        arguments: {
                            CHANNEL: {
                                type: 'string',
                                defaultValue: 'default',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                        },
                    },
                    {
                        opcode: 'send',
                        blockType: 'command',
                        text: 'Send data [DATA] to peer [PEER] using channel [CHANNEL] and wait for message to finish sending? [WAIT]',
                        arguments: {
                            DATA: {
                                type: 'string',
                                defaultValue: 'Hello',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                            CHANNEL: {
                                type: 'string',
                                defaultValue: 'default',
                            },
                            WAIT: {
                                type: 'Boolean',
                                defaultValue: false,
                            },
                        }
                    },
                    {
                        opcode: "channel_data_store_in_variable",
                        blockType: "command",
                        text: "Store received messages from peer [PEER]'s channel [CHANNEL] into variable [VAR]",
                        arguments: {
                            CHANNEL: {
                                type: 'string',
                                defaultValue: 'default',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                            VAR: {
                                type: 'string',
                                defaultValue: 'my variable',
                            },
                        },
                    },
                    {
                        opcode: "get_channel_data",
                        blockType: "reporter",
                        text: "Channel [CHANNEL] data from peer [PEER]",
                        arguments: {
                            CHANNEL: {
                                type: 'string',
                                defaultValue: 'default',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                        },
                    },
                    "---",
                    {
                        opcode: "on_channel_networked_list",
                        blockType: "hat",
                        text: "When I get a networked list named [LISTNAME] from peer [PEER] in channel [CHANNEL]",
                        isEdgeActivated: false,
                        arguments: {
                            LISTNAME: {
                                type: 'string',
                                defaultValue: 'my cloud list',
                            },
                            CHANNEL: {
                                type: 'string',
                                defaultValue: 'default',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                        },
                    },
                    {
                        opcode: "send_networked_list",
                        blockType: "command",
                        text: "Send networked list [LISTNAME] to peer [PEER] using channel [CHANNEL] and wait for cloud list to finish sending? [WAIT]",
                        arguments: {
                            LISTNAME: {
                                type: 'string',
                                defaultValue: 'my cloud list',
                            },
                            CHANNEL: {
                                type: 'string',
                                defaultValue: 'default',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                            WAIT: {
                                type: 'Boolean',
                                defaultValue: false,
                            },
                        },
                    },
                    {
                        opcode: "make_networked_list",
                        blockType: "command",
                        text: "Make list [LIST] a networked list named [LISTNAME] with peer [PEER] in channel [CHANNEL]",
                        arguments: {
                            LIST: {
                                type: 'string',
                                defaultValue: 'my list',
                            },
                            LISTNAME: {
                                type: 'string',
                                defaultValue: 'my cloud list',
                            },
                            CHANNEL: {
                                type: 'string',
                                defaultValue: 'default',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                        },
                    },
                    "---",
                    {
                        opcode: 'new_dchan',
                        blockType: 'command',
                        text: 'Open a new data channel named [CHANNEL] with peer [PEER] and make messages [ORDERED]',
                        arguments: {
                            CHANNEL: {
                                type: 'string',
                                defaultValue: 'foobar',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                            ORDERED: {
                                type: 'number',
                                menu: 'channelConfig',
                                defaultValue: "1",
                            },
                        },
                    },
                    {
                        opcode: 'close_dchan',
                        blockType: 'command',
                        text: 'Close data channel named [CHANNEL] with peer [PEER]',
                        arguments: {
                            CHANNEL: {
                                type: 'string',
                                defaultValue: 'foobar',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                        },
                    },
                    "---",
                    {
                        opcode: "disconnect_peer",
                        blockType: "command",
                        text: "Close connection with peer [PEER]",
                        arguments: {
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                        },
                    },
                    {
                        opcode: "leave",
                        blockType: "command",
                        text: "Disconnect from game",
                    },
                    "---",
                    {
                        opcode: "request_mic_perms",
                        blockType: "command",
                        text: "Request microphone access",
                    },
                    {
                        opcode: "get_mic_perms",
                        blockType: "reporter",
                        text: "Do I have microphone access?",
                    },
                    {
                        opcode: 'is_peer_vchan_open',
                        blockType: 'Boolean',
                        text: 'Connected to voice chat with peer [PEER]?',
                        arguments: {
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            }
                        }
                    },
                    {
                        opcode: 'change_mic_state',
                        blockType: 'command',
                        text: '[MICSTATE] my microphone with peer [PEER]',
                        arguments: {
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                            MICSTATE: {
                                type: 'number',
                                menu: 'micStateMenu',
                                defaultValue: "1",
                            },
                        },
                    },
                    {
                        opcode: 'new_vchan',
                        blockType: 'command',
                        text: 'Open a voice chat with peer [PEER]',
                        arguments: {
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                        },
                    },
                    {
                        opcode: 'close_vchan',
                        blockType: 'command',
                        text: 'Close voice chat with peer [PEER]',
                        arguments: {
                            PEER: {
                                type: 'string',
                                defaultValue: 'ID',
                            },
                        },
                    },
                ],
                menus: {
                    lobbyConfigMenu: {
                        items: [
                            {
                                text: "don\'t allow this lobby to be reclaimed",
                                value: "1",
                            },
                            {
                                text: "allow the server to reclaim the lobby",
                                value: "2",
                            },
                            {
                                text: "allow peers to reclaim the lobby",
                                value: "3",
                            }
                        ],
                    },
                    micStateMenu: {
                        items: [
                            {
                                text: "Mute",
                                value: "1",
                            },
                            {
                                text: "Unmute",
                                value: "2",
                            },
                        ],
                    },
                    channelConfig: {
                        items: [
                            {
                                text: "reliable/ordered (For reliability)",
                                value: "1",
                            },
                            {
                                text: "unreliable/unordered (For speed)",
                                value: "2",
                            },
                        ],
                    },
                }
            };
        }

        initialize({ UGI }) {
            const self = this;
            if (!self.Signaling.socket) {
                self.Signaling.Connect(UGI);

                // Bind event handlers
                self.Signaling.onClose(() => {
                    console.log('Disconnected from signaling server:');
                })

                self.Signaling.onNewPeer(async (peer, user) => {

                    // Create offer
                    console.log('New peer:', peer, user);
                    const { offer, dataChannel } = await self.WebRTC.createOffer(peer);

                    // Send created offer
                    console.log("Sending offer to", peer);
                    self.Signaling.sendOffer(peer, offer, null);

                    // Configure onAnswer event
                    self.Signaling.onAnswer(peer, async(origin, answer) => {

                        // Handle answer to offer
                        console.log("Got answer from", origin);
                        await self.WebRTC.handleAnswer(origin, answer);

                        // Send ICE candidates to the host
                        self.WebRTC.onIceGatheringDone(origin, () => {
                            self.WebRTC.iceCandidates.forEach((candidate) => {
                                console.log("Sending ice candidate to", origin);
                                self.Signaling.sendIceCandidate(origin, candidate);
                            })
                        })
                    })
                })

                self.Signaling.onNewHost((peer, lobby, user) => {
                    console.log('New host:', peer, lobby, user);

                    // Configure onOffer event
                    self.Signaling.onOffer(async (origin, offer) => {

                        // Make answer from offer
                        console.log("Got offer from", origin);
                        const { answer, dataChannel } = await self.WebRTC.createAnswer(origin, offer);
                        
                        // Send answer
                        console.log("Sending answer to", origin);
                        self.Signaling.sendAnswer(origin, answer, null);

                        // Send ICE candidates to the host
                        self.WebRTC.onIceGatheringDone(origin, () => {
                            self.WebRTC.iceCandidates.forEach((candidate) => {
                                console.log("Sending ice candidate to", origin);
                                self.Signaling.sendIceCandidate(origin, candidate);
                            })
                        })
                    })
                })

                self.Signaling.onIceCandidate(async(origin, iceCandidate) => {
                    console.log("Got ice candidate from", origin);
                    self.WebRTC.addIceCandidate(origin, iceCandidate);
                })
            }
        }

        init_host_mode({LOBBY, PEERS, PASSWORD, CLAIMCONFIG}) {
            const self = this;
            if (!self.Signaling.socket) {
                throw new Error('Signaling server not connected');
            }
            let allow_host_reclaim = false;
            let allow_peers_to_claim_host = false;
            switch (CLAIMCONFIG) {
                case 1:
                    allow_host_reclaim = false;
                    allow_peers_to_claim_host = false;
                    break;
                case 2:
                    allow_host_reclaim = true;
                    allow_peers_to_claim_host = false;
                    break;
                case 3:
                    allow_host_reclaim = true;
                    allow_peers_to_claim_host = true;
                    break;
            }
            self.Signaling.hostMode(LOBBY, allow_host_reclaim, allow_peers_to_claim_host, PEERS, PASSWORD, null);
        }

        init_peer_mode({LOBBY, PASSWORD}) {
            const self = this;
            if (!self.Signaling.socket) {
                throw new Error('Signaling server not connected');
            }
            self.Signaling.peerMode(LOBBY, PASSWORD, null);
        }

        leave() {
            const self = this;
            if (!self.Signaling.socket) {
                return;
            }
            self.Signaling.Disconnect();
        }

        is_signalling_connected() {
            if (!this.Signaling.socket) {
                return false;
            }
            return this.Signaling.socket.readyState === 1;
        }

        my_ID() {
            return this.Signaling.state.id;
        }

        my_SessionToken() {
            return this.AuthManager.sessionToken;
        }

        my_Username() {
            return this.Signaling.state.user;
        }

        async authenticateWithCredentials({ EMAIL, PASSWORD }) {
            const self = this;
            if (!self.Signaling.socket) {
                throw new Error('Signaling server not connmected');
            };
            await self.AuthManager.Login(EMAIL, PASSWORD);
            if (self.AuthManager.loginSuccess) {
                self.Signaling.authenticateWithToken(self.AuthManager.sessionToken, null);
            }
        }

        authenticateWithToken({TOKEN}) {
            const self = this;
            if (!self.Signaling.socket) {
                throw new Error('Signaling server not connected');
            };
            self.AuthManager.sessionToken = TOKEN;
            self.Signaling.authenticateWithToken(self.AuthManager.sessionToken, null);
        }

        async register({ EMAIL, USERNAME, PASSWORD }) {
            const self = this;
            await self.AuthManager.Register(EMAIL, USERNAME, PASSWORD);
            return self.AuthManager.registerSuccess;
        }

        // Request microphone permission
        async request_mic_perms(args, util) {
            const self = this;
            self.hasMicPerms = false;
            // Try to get microphone permission
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                self.hasMicPerms = true;
            } catch (e) {
                console.warn(`Failed to get microphone permission. ${e}`);
                return;
            }
        }

        get_mic_perms(args, util) {
            const self = this;
            return (self.hasMicPerms);
        }
    };

    /*
    Scratch.vm.runtime.on('BEFORE_EXECUTE', () => {
        Scratch.vm.runtime.startHats('cloudlinkomega_on_dchan_message');
        Scratch.vm.runtime.startHats('cloudlinkomega_on_channel_networked_list');
    });*/

    Scratch.extensions.register(new CloudLinkOmega(Scratch));
})(Scratch);