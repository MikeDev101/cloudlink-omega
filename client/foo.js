(function (vm) {
    class WebRTCChatClient {
        constructor(username, ugi) {
            this.configuration = { // Self-hosted coturn server
                iceServers: [
                    { urls: 'stun:stun.mikedev101.cc:3478' },
                    { urls: 'turn:stun.mikedev101.cc:3478', username: 'foobar', credentials: 'foobar' }
                ]
            }
            this.ugi = encodeURI(ugi);
            this.username = username;
            this.sessionId = null;
            this.websocket = null;
            this.peers = [];
            this.peerConnections = new Map();
            this.dataChannels = new Map();

            // Signaling server URL
            this.signalingServerURL = `wss://i5-imac.local:3000/signaling/${ugi}?v=0`;

            // Initialize WebSocket connection
            this.initializeWebSocket();
        }

        initializeWebSocket() {
            console.log(`Connecting to signaller: ${this.signalingServerURL}`);
            this.websocket = new WebSocket(this.signalingServerURL);

            this.websocket.onopen = () => {
                console.log(`Connected to signaller!`);
                this.websocket.send(JSON.stringify({ opcode: 2, payload: this.username }));
            };

            this.websocket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleSignalingMessage(message);
            };
        }

        isConnected() {
            return this.websocket && this.websocket.readyState === WebSocket.OPEN;
        }

        getUsernames() {
            return this.peers;
        }

        acceptConnectionRequest(peerId) {
            if (this.peers.includes(peerId)) {
                // Handle the request to accept connection
                // Send the necessary signaling message
                // Update the peerConnections and dataChannels maps
            }
        }

        rejectConnectionRequest(peerId) {
            if (this.peers.includes(peerId)) {
                // Handle the request to reject connection
                // Send the necessary signaling message
                // Remove the peer from the peers list
            }
        }

        sendDataToPeer(peerId, message) {
            if (this.dataChannels.has(peerId)) {
                // Send the message to the specified peer using the data channel
                // Handle any errors
            }
        }

        shutdownLobby() {
            // Send a signaling command to shut down the lobby
            // Handle the closure of the WebSocket connection
        }

        transferLobbyOwnership(peerId) {
            // Send a signaling command to transfer ownership of the lobby to a peer
        }

        initializeAsHost(lobbyId, password, allowHostsReclaim, allowPeersClaimHost, maxPeers) {
            // Send a signaling command to initialize as a host
        }

        initializeAsPeer(lobbyId) {
            // Send a signaling command to initialize as a peer
        }

        handleSignalingMessage(message) {
            // Handle various signaling messages and implement the negotiation process
        }
    }

    class myExtension {
        constructor() {
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
                        text: 'Host lobby [LOBBY] Maximum peers: (0 = unlimited): [PEERS] Password: [PASSWORD] Allow new hosts? [ALLOWHOSTSRECLAIM] Allow peers to claim host? [ALLOWPEERSTOCLAIMHOST]',
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
                                defaultValue: 'Make me blank to allow anyone to join!',
                            },
                            ALLOWHOSTSRECLAIM: {
                                type: 'Boolean',
                                // menu: 'boolMenu',
                                defaultValue: false,
                            },
                            ALLOWPEERSTOCLAIMHOST: {
                                type: 'Boolean',
                                // menu: 'boolMenu',
                                defaultValue: false,
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
                    boolMenu: {
                        items: ["Yes", "No"],
                    },
                }
            };
        }

        is_signalling_connected() {
            if (!this.client) return false;
            return this.client.isConnected();
        }

        get_usernames() {
            if (!this.client) return JSON.stringify([]);
            if (!this.client.isConnected()) return JSON.stringify([]);
            return JSON.stringify(this.client.getUsernames());
        }

        initalize(args) {
            this.client = new WebRTCChatClient(args.USERNAME, args.UGI);
        }

        host(args) {}

        send(args) {
        }
    };
    vm.extensionManager._registerInternalExtension(new myExtension());
})(vm);