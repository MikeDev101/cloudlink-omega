(function (vm) {
    class WebRTCChatClient {
        constructor(username, ugi) {
            // Define the opcodes used for signalling
            this.signalingOpcodes = {
                VIOLATION: 0,
                KEEPALIVE: 1,
                INIT: 2,
                INIT_OK: 3,
                CONFIG_HOST: 4,
                CONFIG_PEER: 5,
                ACK_HOST: 6,
                ACK_PEER: 7,
                NEW_HOST: 8,
                NEW_PEER: 9,
                MAKE_OFFER: 10,
                MAKE_ANSWER: 11,
                ICE: 12,
                ABORT_OFFER: 13,
                ABORT_ANSWER: 14,
                SHUTDOWN: 15,
                LOBBY_EXISTS: 16,
                LOBBY_NOTFOUND: 17,
                LOBBY_FULL: 18,
                LOBBY_LOCKED: 19,
                LOBBY_CLOSE: 20,
                HOST_GONE: 21,
                PEER_GONE: 22,
                HOST_RECLAIM: 23,
                CLAIM_HOST: 24,
                TRANSFER_HOST: 25,
                ABANDON: 26,
                LOCK: 27,
                UNLOCK: 28,
                SIZE: 29,
                KICK: 30,
                PASSWORD_REQUIRED: 31,
                PASSWORD_ACK: 32,
                PASSWORD_FAIL: 33,
                PEER_INVALID: 34,
            }

            this.configuration = {
                iceServers: [
                    // Omega STUN/TURN servers
                    { urls: 'stun:stun.mikedev101.cc:3478' },
                    { urls: 'turn:stun.mikedev101.cc:3478', username: 'foobar', credential: 'foobar' },

                    // Google STUN server in case Omega STUN server is unavailable/overloaded
                    { urls: 'stun:stun.l.google.com:19302' },
                ]
            }

            this.ugi = encodeURI(ugi);
            this.username = username;
            this.sessionId = null;
            this.websocket = null;
            this.peers = {};
            this.mode = null;
            this.hostIceSent = false;
            this.lobbyID = null;

            // Signaling server URL
            this.signalingServerURL = `ws://127.0.0.1:3000/signaling/${ugi}?v=0`;

            // Initialize WebSocket connection
            this.initializeWebSocket();
        }

        async initializePeer(uuid) {
            // Create RTCPeerConnection and store it in our class
            const con = new RTCPeerConnection(this.configuration);
            this.peers[uuid] = {
				con: con,
				channels: {},
			};
            console.log(`Created WebRTC peer object with UUID ${uuid}!`);

            con.onicecandidate = (e) => {
                if (!e.candidate) return;
                this.sendSignallingMessage(
                    this.signalingOpcodes.ICE,
                    e.candidate.toJSON(),
                    uuid
                )
            }

            con.onicegatheringstatechange = (e) => {
                switch (e.target.iceGatheringState) {
                    case "gathering":
                        console.log(`Peer ${uuid} ICE is now gathering candidates...`);
                        break;
                    case "complete":
                        console.log(`Peer ${uuid} ICE has finished gathering candidates!`)
                        break;
                }
            }

            // handle error
            con.onicecandidateerror = (e) => {
                console.warn(`Peer ${uuid} ICE error on URL \"`, e.url, "\": ", e.errorText);
            }

            // Handle data channel events
            con.ondatachannel = (event) => {
                this.initializeDataChannel(event.channel, con, uuid);
            }

            return this.peers[uuid];
        }

        initializeDataChannel(chan, con, uuid) {
            const channelName = chan.label;
			const isOrdered = chan.ordered;

            chan.onopen = (e) => {
                console.log(`Peer ${uuid} channel \"${channelName}\" opened! Is this channel ordered: ${isOrdered}`);
				
				// Check if channel exists, and create reference it if it does not exist (in-band WebRTC channel creation).
				if (!this.peers[uuid].channels.hasOwnProperty(channelName)) {
					console.log(`Created channel reference for peer  ${uuid} with name \"${channelName}\".`);
					this.peers[uuid].channels[channelName] = chan;
				}
            }

            chan.onmessage = (e) => {
                console.log(`Peer ${uuid} channel \"${channelName}\" got new message from ${e.origin}: ${e.data}`);
            }

            chan.onerror = (e) => {
                console.log(`Peer ${uuid} channel \"${channelName}\" error!`, e.error);
            }

            chan.onclosing  = (e) => {
                console.log(`Peer ${uuid} channel \"${channelName}\" closing...`);
            }

            chan.onclose  = (e) => {
                console.log(`Peer ${uuid} channel \"${channelName}\" closed!`);
				
				// Destroy the channel object
				if (this.peers[uuid].channels.hasOwnProperty(channelName)) {
					console.log(`Deleted channel reference for peer  ${uuid} with name \"${channelName}\".`);
					this.peers[uuid].channels.delete(channelName);
				}
            }
        }

        initializeWebSocket() {
            console.log(`Connecting to signalling backend: ${this.signalingServerURL}`);
            this.websocket = new WebSocket(this.signalingServerURL);

            this.websocket.onopen = () => {
                console.log(`Connected to signalling backend!`);
                this.sendSignallingMessage(this.signalingOpcodes.INIT, this.username);
            };

            this.websocket.onmessage = (event) => {
                this.handleSignalingMessage(JSON.parse(event.data));
            };

            this.websocket.onclose = () => {
                console.log(`Signaling backend disconnected!`);
                this.websocket = null;
            }
        }

        isSignallingConnected() {
            return this.websocket && this.websocket.readyState === WebSocket.OPEN;
        }

        getPeers() {
			return Object.keys(this.peers);
        }

        acceptConnectionRequest(peerID) {
            if (peerID in this.peers) {
                // Handle the request to accept connection
                // Send the necessary signaling message
                // Update the peers and dataChannels maps
            }
        }

        rejectConnectionRequest(peerID) {
            if (peerID in this.peers) {
                // Handle the request to reject connection
                // Send the necessary signaling message
                // Remove the con from the peers list
            }
        }

        sendDataToPeer(peerID, channelName, message) {
            if (false) { // Stub. TODO: check if con exists
                // Send the message to the specified con using the data channel
                // Handle any errors
            }
        }

        shutdownLobby() {
            // Send a signaling command to shut down the lobby
            // Handle the closure of the WebSocket connection
        }

        transferLobbyOwnership(peerID) {
            // Send a signaling command to transfer ownership of the lobby to a con
        }

        initializeAsHost(lobbyID, password, allowHostReclaim, allowPeersClaimHost, maxPeers) {
            if ((this.mode == "peer") || (this.mode == "host")) return;
            this.mode = "host";
            this.lobbyID = lobbyID;

            // Send a signaling command to initialize as a host
            this.sendSignallingMessage(
                this.signalingOpcodes.CONFIG_HOST,
                {
                    lobby_id: lobbyID,
                    allow_host_reclaim: allowHostReclaim,
                    allow_peers_to_claim_host: allowPeersClaimHost,
                    password: password,
                    max_peers: maxPeers
                }
            );
        }

        waitForCondition(uuid, conditionalFunction) {
            const con = this.peers[uuid];
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (conditionalFunction()) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            })
        }

        initializeAsPeer(lobbyID, password) {
            if ((this.mode == "peer") || (this.mode == "host")) return;
			this.mode = "peer";
            this.lobbyID = lobbyID;

            // Send a signaling command to initialize as a con
            this.sendSignallingMessage(
                this.signalingOpcodes.CONFIG_PEER,
                {
                    lobby_id: lobbyID,
                    password: password
                }
            );
        }

        sendSignallingMessage(opcode, payload, rx) {
            if (!(this.websocket && this.websocket.readyState === WebSocket.OPEN)) return;
            const message = {
                opcode: opcode,
                payload: payload,
                rx: rx
            }
            this.websocket.send(JSON.stringify(message));
        }

        async handleSignalingMessage(message) {
            // Placeholders
            let uuid, offer, answer, con, temp, channels = null;

            // Handle various signaling messages and implement the negotiation process
            switch (message.opcode) {
                // Get session UUID for our client
                case this.signalingOpcodes.INIT_OK:
                    this.uuid = message.payload;
                    console.log(`Session UUID: ${this.uuid}`);
                    break;

                // Handle host mode request
                case this.signalingOpcodes.ACK_HOST:
                    console.log('Initialized as a host!');
                    break;

                // Handle con mode request
                case this.signalingOpcodes.ACK_PEER:
                    console.log('Initialized as a peer!');
                    break;

                // Handle host reclaim alerts
                case this.signalingOpcodes.HOST_RECLAIM:
                    if (this.uuid == message.payload.id) {
                        this.mode = "host";
                        console.log(`You are now the host of lobby \"${message.payload.lobby_id}\".`);
                    }

                // Handle con join requests
                case this.signalingOpcodes.NEW_PEER:
                    if (this.mode != "host") return;
                    uuid = message.payload.id;

                    // Create con connection object
					temp = await this.initializePeer(uuid);
                    con = temp.con;
					channels = temp.channels;

                    // Generate data channel
                    channels['default'] = con.createDataChannel('default', {ordered: true});

                    // Generate offer
                    offer = await con.createOffer();

                    // Set local description
                    await con.setLocalDescription(offer);

                    // Send offer back to con
                    this.sendSignallingMessage(
                        this.signalingOpcodes.MAKE_OFFER,
                        con.localDescription,
                        uuid
                    )
                    break;

                // Handle host offer
                case this.signalingOpcodes.MAKE_OFFER:
                    if (this.mode != "peer") return;
                    uuid = message.tx;
                    offer = new RTCSessionDescription(message.payload);

                    // Create con connection object
					temp = await this.initializePeer(uuid);
                    con = temp.con;
					channels = temp.channels;

                    // Generate data channel
                    channels['default'] = con.createDataChannel('default', {ordered: true});

                    // Configure remote description
                    await con.setRemoteDescription(offer);

                    // Generate answer
                    offer = await con.createAnswer();

                    // Set local description
                    await con.setLocalDescription(answer);

                    // Send answer to host
                    this.sendSignallingMessage(
                        this.signalingOpcodes.MAKE_ANSWER,
                        con.localDescription,
                        uuid
                    )
                    break;

                // Handle con answer
                case this.signalingOpcodes.MAKE_ANSWER:
                    if (this.mode != "host") return;
                    uuid = message.tx;
                    answer = new RTCSessionDescription(message.payload)

                    // Get con object
					temp = this.peers[uuid];
                    con = temp.con;

                    // Set local description
                    await con.setRemoteDescription(answer);

                    break;
                        
                // Handle host ICE offers
                case this.signalingOpcodes.ICE:
                    if ((this.mode == "host") || (this.mode == "peer")) {
                        uuid = message.tx;

                        // Get con object
                        temp = this.peers[uuid];
						con = temp.con;

                        // Set ICE candidates from con
                        con.addIceCandidate(new RTCIceCandidate(message.payload));
                    }
                    break;
            }
        }
    }

    function createClient(self, args) {
        self.client = new WebRTCChatClient(args.USERNAME, args.UGI);
    }

    class myExtension {
        constructor() {
            // WebRTCChatClient object
            this.client;
        }

        getInfo() {
            return {
                id: 'cloudlinkOmega',
                name: 'CloudLink Omega',
                // docsURI: # TODO: website
                // blockIconURI: TODO: add SVG
                // menuIconURI: TODO: add SVG
                color1: "#ff4d4c",
                color2: "#ff6160",
                color3: "#ff7473",
                blocks: [
                    {
                        opcode: 'is_signalling_connected',
                        blockType: 'Boolean',
                        text: 'Connected to signalling backend?',
                    },
                    {
                        opcode: 'get_peers',
                        blockType: 'reporter',
                        text: 'Peers',
                    },
                    {
                        opcode: 'is_peer_connected',
                        blockType: 'Boolean',
                        text: 'Connected to peer [PEER]?',
                        arguments: {
                            PEER: {
                                type: 'string',
                                defaultValue: 'UUID',
                            }
                        }
                    },
                    {
                        opcode: 'initalize',
                        blockType: 'command',
                        text: 'Connect to game [UGI] as username [USERNAME]',
                        arguments: {
                            UGI: {
                                type: 'string',
                                defaultValue: 'DemoUGI',
                            },
                            USERNAME: {
                                type: 'string',
                                defaultValue: 'Apple',
                            },
                        }
                    },
                    {
                        opcode: 'host',
                        blockType: 'command',
                        text: 'Host lobby [LOBBY] Maximum peers: (0 = unlimited): [PEERS] Password (set blank for no password): [PASSWORD] Settings: [CLAIMCONFIG]',
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
                        opcode: 'con',
                        blockType: 'command',
                        text: 'Join lobby [LOBBY] Password: [PASSWORD]',
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
                        opcode: 'send',
                        blockType: 'command',
                        text: 'Send data [DATA] Peer: [PEER] Channel: [CHANNEL] ',
                        arguments: {
                            DATA: {
                                type: 'string',
                                defaultValue: 'Hello',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'Banana',
                            },
							CHANNEL: {
                                type: 'string',
                                defaultValue: 'default',
                            },
                        }
                    },
					{
                        opcode: 'newchan',
                        blockType: 'command',
                        text: 'Open new data channel: [CHANNEL] Peer: [PEER] Settings: [CHANNELCONFIG]',
                        arguments: {
							CHANNEL: {
                                type: 'string',
                                defaultValue: 'foobar',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'UUID',
                            },
							CHANNELCONFIG: {
                                type: 'number',
                                menu: 'channelConfig',
                                defaultValue: "1",
                            },
						},
                    },
                ],
                menus: {
                    lobbyConfigMenu: {
                        items: [
                            {
                                text: "1. Don\'t allow this lobby to be reclaimed",
                                value: "1",
                            },
                            {
                                text: "2. Allow the server to reclaim the lobby",
                                value: "2",
                            },
                            {
                                text: "3. Allow peers to reclaim the lobby",
                                value: "3",
                            }
                        ],
                    },
					channelConfig: {
                        items: [
                            {
                                text: "1. Messages are ordered",
                                value: "1",
                            },
                            {
                                text: "2. Messages are unordered",
                                value: "2",
                            },
                        ],
                    },
                }
            };
        }

        is_signalling_connected() {
            if (!this.client) return false;
            if (!this.client.websocket) return false;
            return this.client.isSignallingConnected();
        }

        is_peer_connected(args) {
            if (!this.client) return false;
            if (!this.client.isSignallingConnected()) return false;
            return this.client.peers.hasOwnProperty(args.PEER);
        }

        get_peers() {
            if (!this.client) return JSON.stringify([]);
            if (!this.client.isSignallingConnected()) return JSON.stringify([]);
            return JSON.stringify(this.client.getPeers());
        }

        initalize(args) {
            if (!this.client) return createClient(this, args);
            if (!this.client.websocket) return createClient(this, args);
        }

        host(args) {
            if (!this.client) return;
            if (!this.client.isSignallingConnected()) return;

            let allowHostsReclaim;
            let allowPeersClaimHost;

            switch (args.CLAIMCONFIG) {
                case "1":
                    allowHostsReclaim = false;
                    allowPeersClaimHost = false;
                    break;
                case "2":
                    allowHostsReclaim = true;
                    allowPeersClaimHost = false;
                    break;
                case "3":
                    allowHostsReclaim = true;
                    allowPeersClaimHost = true;
                    break;
            }

            this.client.initializeAsHost(args.LOBBY, args.PASSWORD, allowHostsReclaim, allowPeersClaimHost, args.PEERS);
        }

        con(args) {
            if (!this.client) return;
            if (!this.client.isSignallingConnected()) return;
            this.client.initializeAsPeer(args.LOBBY, args.PASSWORD);
        }

        send(args) {
            if (!this.client) return;
            if (!this.client.isSignallingConnected()) return;
			if (!this.client.peers.hasOwnProperty(args.PEER)) {
				console.warn(`Can't send message in channel \"${args.CHANNEL}\" to peer ${args.PEER}: Peer not found.`);
				return;
			}
			
			// Get con object
			const temp = this.client.peers[args.PEER];
			const channels = temp.channels;
			
			if (!channels.hasOwnProperty(args.CHANNEL)) {
				console.warn(`Can't send message in channel \"${args.CHANNEL}\" to peer ${args.PEER}: Channel does not exist.`);
				return;
			};
			
			// Send message
			console.log(`Sending message \"${args.DATA}\" in channel \"${args.CHANNEL}\" to peer ${args.PEER}...`);
			channels[args.CHANNEL].send(args.DATA);
        }
		
		newchan(args) {
			if (!this.client) return;
            if (!this.client.isSignallingConnected()) return;
			if (!this.client.peers.hasOwnProperty(args.PEER)) {
				console.warn(`Can't create channel \"${args.CHANNEL}\" with peer ${args.PEER}: Peer not found.`);
				return;
			}
			
			// Get con object
			const temp = this.client.peers[args.PEER];
			const con = temp.con;
			const channels = temp.channels;
			
			if (channels.hasOwnProperty(args.CHANNEL)) {
				console.warn(`Can't create channel \"${args.CHANNEL}\" with peer ${args.PEER}: Channel already exists.`);
				return;
			};
			
			const ordered = (args.CHANNELCONFIG == "1");
			if (ordered) {
				console.log(`Creating ordered channel \"${args.CHANNEL}\" with peer ${args.PEER}...`);
			} else {
				console.log(`Creating unordered channel \"${args.CHANNEL}\" with peer ${args.PEER}...`);
			}
			
			// Create channel
			channels[args.CHANNEL] = con.createDataChannel(args.CHANNEL, {ordered: ordered}); 
		}
    };
    vm.extensionManager._registerInternalExtension(new myExtension());
})(vm);