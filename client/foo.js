(function (vm) {
    class WebRTCChatClient {
        constructor(username, ugi) {
            // Define the opcodes used for signalling
            this.signalingOpcodes = {
                VIOLATION:         0,
                KEEPALIVE:         1,
                INIT:              2,
                INIT_OK:           3,
                CONFIG_HOST:       4,
                CONFIG_PEER:       5,
                ACK_HOST:          6,
                ACK_PEER:          7,
                NEW_HOST:          8,
                NEW_PEER:          9,
                MAKE_OFFER:        10,
                ANTICIPATE_OFFER:  11,
                ACCEPT_OFFER:      12,
                RETURN_OFFER:      13,
                MAKE_ANSWER:       14,
                ANTICIPATE_ANSWER: 15,
                ACK_CHECK:         16,
                ACK_READY:         17,
                ACK_ABORT:         18,
                SHUTDOWN:          19,
                SHUTDOWN_ACK:      20,
                LOBBY_EXISTS:      21,
                LOBBY_NOTFOUND:    22,
                LOBBY_FULL:        23,
                LOBBY_LOCKED:      24,
                LOBBY_CLOSE:       25,
                HOST_GONE:         26,
                PEER_GONE:         27,
                HOST_RECLAIM:      28,
                CLAIM_HOST:        29,
                TRANSFER_HOST:     30,
                ABANDON:           31,
                LOCK:              32,
                UNLOCK:            33,
                SIZE:              34,
                KICK:              35,
                PASSWORD_REQUIRED: 36,
                PASSWORD_ACK:      37,
                PASSWORD_FAIL:     38,
                PEER_INVALID:      39,
            }

            this.configuration = {
                iceServers: [
                    // Omega STUN/TURN servers
                    { urls: 'stun:stun.mikedev101.cc:3478' },
                    { urls: 'turn:stun.mikedev101.cc:3478', username: 'foobar', credentials: 'foobar' },

                    // Google STUN servers in case Omega STUN server is unavailable/overloaded
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                ]
            }

            this.ugi = encodeURI(ugi);
            this.username = username;
            this.sessionId = null;
            this.websocket = null;
            this.peers = [];
            this.peerConnections = new Map();
            this.dataChannels = new Map();
            this.initialOffer = null;
            this.mode = null;
            this.lobbyID = null;

            // Signaling server URL
            this.signalingServerURL = `ws://127.0.0.1:3000/signaling/${ugi}?v=0`;

            // Initialize WebSocket connection
            this.initializeWebSocket();
        }

        initializeWebRTCPeer(uuid) {
            console.log(`Creating WebRTC peer object with UUID ${uuid}`);
            const pc = new RTCPeerConnection(this.configuration);
            this.peerConnections.set(uuid, pc);

            pc.onicecandidate = (e) => {
                if (!e.candidate) return;
                console.log(e.candidate);
    
                // If a srflx candidate was found, notify that the STUN server works!
                if (e.candidate.type == 'srflx' || e.candidate.candidate.includes('srflx')) {
                    let ip = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
                    let address = e.candidate.address 
                        ? e.candidate.address 
                        : e.candidate.candidate.match(ip);
                    console.log(`Public IP Address is ${address}`);
                    console.log('STUN server is reachable!');
                }
    
                // If a relay candidate was found, notify that the TURN server works!
                if (e.candidate.type == 'relay' || e.candidate.candidate.includes('relay')) {
                    console.log('TURN server is reachable!');
                }
            }

            // handle error
            pc.onicecandidateerror = (e) => {
                console.error(`${uuid} ICE error: `, e);
            }
        }

        initializeWebRTCChannel(uuid, channelName, isOrdered) {
            const chanLabel = `${uuid}.${channelName}`
            if (!this.peerConnections.has(uuid)) {
                console.error(`Couldn\'t create WebRTC data channel: The WebRTC peer object with UUID ${uuid} was not found.`);
                return;
            };

            const pc = this.peerConnections.get(uuid);
            if (!this.dataChannels.has(channelName)) {
                console.warn(`Couldn\'t create WebRTC data channel for UUID ${uuid}: The channel ${channelName} already exists.`);
                return;
            };

            console.log(`Creating data channel \"${chanLabel}\" using WebRTC Peer object: `, pc);

            const chan = pc.createDataChannel(channelName, {ordered: isOrdered});

            this.dataChannels.set(chanLabel, chan);
            console.log(`Created data channel object \"${chanLabel}\": `, this.dataChannels.get(chanLabel));
        }

        createWebRTCOffer(uuid) {
            if (!this.peerConnections.has(uuid)) {
                console.error(`Couldn\'t create WebRTC offer: The WebRTC peer object with UUID ${uuid} was not found.`);
                return;
            };

            const pc = this.peerConnections.get(uuid);
            const offer = pc.createOffer();
            pc.setLocalDescription(offer);

            console.log(`Created WebRTC peer object \"${uuid}\" offer: `, offer);

            return offer;
        };

        initializeWebSocket() {
            console.log(`Connecting to signaller: ${this.signalingServerURL}`);
            this.websocket = new WebSocket(this.signalingServerURL);

            this.websocket.onopen = () => {
                console.log(`Connected to signaller!`);
                this.sendSignallingMessage(this.signalingOpcodes.INIT, this.username);
            };

            this.websocket.onmessage = (event) => {
                this.handleSignalingMessage(JSON.parse(event.data));
            };
        }

        isSignallingConnected() {
            return this.websocket && this.websocket.readyState === WebSocket.OPEN;
        }

        getUsernames() {
            return this.peers;
        }

        acceptConnectionRequest(peerID) {
            if (this.peers.includes(peerID)) {
                // Handle the request to accept connection
                // Send the necessary signaling message
                // Update the peerConnections and dataChannels maps
            }
        }

        rejectConnectionRequest(peerID) {
            if (this.peers.includes(peerID)) {
                // Handle the request to reject connection
                // Send the necessary signaling message
                // Remove the peer from the peers list
            }
        }

        sendDataToPeer(peerID, message) {
            if (this.dataChannels.has(peerID)) {
                // Send the message to the specified peer using the data channel
                // Handle any errors
            }
        }

        shutdownLobby() {
            // Send a signaling command to shut down the lobby
            // Handle the closure of the WebSocket connection
        }

        transferLobbyOwnership(peerID) {
            // Send a signaling command to transfer ownership of the lobby to a peer
        }

        initializeAsHost(lobbyID, password, allowHostReclaim, allowPeersClaimHost, maxPeers) {
            if (this.mode == "peer") return;
            this.mode = "host";
            this.lobbyID = lobbyID;

            // Send a signaling command to initialize as a host
            console.log(`Attempting to initialize client as a host of lobby \"${lobbyID}\"`);
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

        initializeAsPeer(lobbyID, password) {
            if (this.mode == "host") return;
            this.mode = "peer";
            this.lobbyID = lobbyID;

            // Send a signaling command to initialize as a peer
            console.log(`Attempting to initialize client as a peer of lobby \"${lobbyID}\"`);
            this.sendSignallingMessage(
                this.signalingOpcodes.CONFIG_PEER,
                {
                    lobby_id: lobbyID,
                    password: password
                }
            );
        }

        sendSignallingMessage(opcode, payload, rx){
            if (!(this.websocket && this.websocket.readyState === WebSocket.OPEN)) return;
            const message = {
                opcode: opcode,
                payload: payload,
                rx: rx
            }
            console.log(`Sending signaling message: `, message);
            this.websocket.send(JSON.stringify(message));
        }

        handleSignalingMessage(message) {
            console.log(`Got signaling message: `, message);

            // Handle various signaling messages and implement the negotiation process
            switch (message.opcode) {
                // Get session UUID for our client
                case this.signalingOpcodes.INIT_OK:
                    this.uuid = message.payload;
                    console.log(`Got session UUID: ${this.uuid}`);
                    break;
                
                // Handle host mode request
                case this.signalingOpcodes.ACK_HOST:
                    console.log('Server has made us a host');
                    break;
                
                // Handle peer mode request
                case this.signalingOpcodes.ACK_PEER:
                    console.log('Server has made us a peer');
                    break;
                
                // Handle host reclaim alerts
                case this.signalingOpcodes.HOST_RECLAIM:
                    if (this.uuid == message.payload.id) {
                        this.mode = "host";
                        console.log('Server has made us the new host');
                    } else {
                        console.log('Server has made someone else the new host');
                    }
                    
                    break;
            }
        }
    }

    class myExtension {
        constructor() {
            // WebRTCChatClient object
            this.client;
        }

        getInfo() {
            return {
                id: 'extensionID',
                name: 'extensionName',
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
                        opcode: 'get_usernames',
                        blockType: 'reporter',
                        text: 'Usernames',
                    },
                    {
                        opcode: 'is_peer_connected',
                        blockType: 'Boolean',
                        text: 'Connected to peer [PEER]?',
                        arguments: {
                            PEER: {
                                type: 'string',
                                defaultValue: '',
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
                        text: 'Host lobby [LOBBY] Maximum peers: (0 = unlimited): [PEERS] Password: [PASSWORD] Settings: [CLAIMCONFIG]',
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
                                defaultValue: 'Set me blank to allow anyone to join!',
                            },
                            CLAIMCONFIG: {
                                type: 'number',
                                menu: 'lobbyConfigMenu',
                                defaultValue: "1",
                            },
                        }
                    },
                    {
                        opcode: 'peer',
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
                        text: 'Send data [DATA] to peer [PEER]',
                        arguments: {
                            DATA: {
                                type: 'string',
                                defaultValue: 'Hello',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'Banana',
                            },
                        }
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
                }
            };
        }

        is_signalling_connected() {
            if (!this.client) return false;
            return this.client.isSignallingConnected();
        }

        is_peer_connected(args) {
            if (!this.client) return false;
            if (!this.client.isSignallingConnected()) return false;
            // TODO: check if peer is connected
            return true; // Stub
        }

        get_usernames() {
            if (!this.client) return JSON.stringify([]);
            if (!this.client.isSignallingConnected()) return JSON.stringify([]);
            return JSON.stringify(this.client.getUsernames());
        }

        initalize(args) {
            if (this.client) return;
            this.client = new WebRTCChatClient(args.USERNAME, args.UGI);
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

        peer(args) {
            if (!this.client) return;
            if (!this.client.isSignallingConnected()) return;
            this.client.initializeAsPeer(args.LOBBY, args.PASSWORD);
        }

        send(args) {
            if (!this.client) return;
            if (!this.client.isSignallingConnected()) return;
            // TODO: send payload to peer over WebRTC data channel
        }
    };
    vm.extensionManager._registerInternalExtension(new myExtension());
})(vm);